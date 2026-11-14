# Step prompt handoff by file Implementation Plan

## Overview

Add `prompts.byFile: false` to the shared policy. Opting in gives each numbered step a router-owned task file and a short dispatch prompt, reducing the text the orchestrator must receive and transcribe. Preserve the exact rendered task, RESULT contract, provider dispatch, neutral retries, commit/recovery ordering and default inline behavior. Both archive actions remain inline.

This is a plan, not an implementation. Complexity is **HIGH** because the change crosses prompt rendering, durable pending state, file cleanup, two providers and both chains. The unattended instruction delegates interview and phase decisions to repository evidence; no human approval is claimed. All implementation rows below start pending.

## Current State Analysis

- `route.mjs:83` owns `next`: prompt validation precedes result intake; `neutralRetry` precedes `attachResult`; successful-step commit and failed-step rollback follow intake. At `route.mjs:215` the router assembles worktree rules, rendered task, advisor and rule tail; at `route.mjs:264` it stores the whole string in `pendingPrompt` and returns the same string.
- `flow.mjs:355` replays `pendingPrompt` without rendering again. It preserves dispatch identity, timestamps, baseline and retry accounting. `flow.mjs:491` verifies and durably records a result before deleting `last-result.json`. The full pending prompt is removed when the result is consumed.
- `run-codex.mjs:25` compares `action.prompt` with `entry.pendingPrompt`, checks identity and dispatch, and refuses stale actions before launch. It repeats validation after the permission probe (`:235`) and sends `action.prompt` unchanged to child stdin (`:258`). A shortened prompt would currently fail this check.
- `checkPrompts` and `promptProblem` enumerate every key under `prompts` (`flow.mjs:822`, `:891`). `promptsHash` does likewise (`isolation.mjs:43`). A boolean in that object needs explicit classification; ignoring all non-string values would hide malformed templates.
- `isolation.mjs:731` emits the archive action after the pre-archive commit, without a numbered entry or result file. It must not acquire a task-file lifecycle. The restricted `agents/score.md` agent already has Read.
- `compare` reads recorded step usage and uses `isFailure` for failed attempts (`route.mjs:503`). ADR-005 explicitly excludes orchestrator-session tokens. It cannot directly measure the intended orchestrator savings, and synthetic results cannot establish instruction-following quality.

Planning measurement on 2026-11-14, Node v24.19.0: the current merged plugin policy was rendered with this 97-byte worktree root, isolation enabled, id `step-prompt-by-file`, goal `Add opt-in prompt handoff by file`, phase/lastPhase `1`, no advisor or upstream artifacts, empty retry/findings fields, and the shipped rule tail. These are UTF-8 **task bytes**, not model tokens or complete router output:

| Template | Bytes |
| --- | ---: |
| plan | 4,910 |
| implement | 5,500 |
| fix | 5,084 |
| plan-review | 7,111 |
| impl-review | 8,762 |
| impl-review-confirm | 10,335 |
| os-propose | 11,776 |
| manual-verify | 13,210 |
| manual-verify-openai | 12,188 |

The original ticket's measurements predate the current layered rules/provider architecture. A design-only short-prompt sample, repeating the exact final RESULT line and carrying a relative `promptFile`, serialized to 860 bytes at `/work/run` and 1,036 bytes at this worktree root. These are feasibility estimates, **not implemented output measurements**. No `byFile`, `promptFile` or `pendingHandoff` fields were found in repository run/meta records; no matched inline/file live pairs are available. No live provider experiment was run in this planning step.

## Desired End State

1. Omitted or false `prompts.byFile` retains existing inline action/pending-state behavior and creates no task file. True applies to numbered `run` actions of both chains and providers. Invalid explicit values halt before state mutation.
2. File mode writes the exact already-rendered task to `<change>/agent-smith/prompt.md`. `promptFile` is run-root-relative, like `resultFile`; the short `prompt` names its absolute path, instructs a complete read and exact execution, and repeats the exact final RESULT contract, including optional signals. The orchestrator forwards this short prompt unchanged and never reads or expands the file.
3. `pendingPrompt` remains the canonical full task. A file-mode pending entry additionally stores `pendingHandoff: { promptFile, prompt }`, the exact dispatch descriptor. Legacy entries without it remain inline regardless of the current flag. Archive descriptors have neither a file nor this pending state.
4. Neutral retries restore the same task file and replay the stored handoff, provider/model/effort/profile/agent and step identity even if policy changes. They never regenerate task text or spend an attempt, tier bump, rollback or step budget.
5. Consumed task files and their owned atomic-write temporaries are absent before router step, final-state and pre-archive commits. Cleanup is recoverable after interruption and cannot silently fail into a commit. Missing results preserve the pending task. A newly scheduled step may immediately recreate the same path with its own task; tests distinguish this from stale content.
6. Codex retains exact pending-dispatch validation, read-only router state, permission preflight, process lifetime, RESULT parsing and measured usage. File mode adds validation of the expected task file and its exact bytes; it does not relax existing checks.
7. Template/rule provenance stays meaningful and unchanged by transport alone. A comparison evidence record explains the default decision; absent live evidence means **keep false**, not an invented saving or successful quality check.

### Key Discoveries:

- Reuse `writeFileAtomic`, the run lock and chain-aware `paths` (`state.mjs:446`, `:556`, `:962`); do not introduce another state store, runner or dependency.
- Preserve `pendingPrompt` semantics and ADR-015 replay rather than reconstructing a task from mutable policy.
- Resolve the Wave 6 “prompt output” ownership against today's `next` and provider runner, not only the older `flow.mjs` location named in the ticket.
- `guardedStat` (`state.mjs:863`) is reusable for regular-file checks, but the new boundary also needs exact expected-path/parent containment checks, following `run-codex.mjs:31`; a caller-supplied path is not authority to read or delete a file.

## What We're NOT Doing

- Changing task templates, rule precedence, RESULT schemas, model ladders, rigor, budgets, archive semantics, compare arithmetic or usage attribution.
- Changing the shipped default to true without new reviewed live evidence; adding a CLI flag, configurable filename, provider-specific transport switch or a general transport framework.
- Editing `context/changes/WAVES.md`, anything under `context/archive/`, Wave 6 sibling regions, release versions, toolkit skills, CI configuration or `rollback.test.mjs`.
- Launching nested agents or live A/B runs from an unattended step, fabricating telemetry, or treating byte counts as tokens or billing savings.
- Solving the separately scheduled stale-result cleanup or nested-subagent guard changes.

## Implementation Approach

Keep transport in the shared prompt owner, `flow.mjs`, with minimal wiring in `next`. Render once using today's assembly, retain that full task as pending state, and publish either the existing inline action or the stored compact handoff. Extend the existing Codex validator to understand both forms. The OpenAI child receives the same compact prompt as a Claude agent and reads the file itself; the runner validates it without copying the full task back through the orchestrator.

### Evidence-backed assumptions and decisions

| Decision | Evidence and consequence |
| --- | --- |
| Use `prompts.byFile`, strictly boolean and false by default | The change direction explicitly names this location and opt-in rollout. ADR-022 establishes validation before writes. Missing is compatible with old policy; null, strings, numbers, arrays and objects are invalid explicit values. |
| One fixed file per run, shared by providers | The run lock and sequential dispatch already serialize execution. The change asks for replacement at each step; no new filename option or per-step directory is needed. |
| Persist the short descriptor alongside the full pending task | ADR-015 promises an unchanged replay; ADR-024 validates exact dispatch. Persisting both avoids dependence on later policy, template or wrapper changes. |
| Exclude only `byFile` from template enumeration/hash input | The ticket requires unchanged provenance; `promptsHash` hashes resolved templates, not rendered tasks. Keep real template errors and rule-file drift visible, and record experiment transport settings in evidence. |
| Keep false when live evidence is absent | The change requires a data-based decision, and ADR-005 says one pair is anecdotal and orchestrator tokens are excluded. Missing evidence is a reason to retain the existing default, not a blocker to delivering the opt-in. |
| Interpret “about 1 KB” as measured normal action size | The design sample is 1,036 bytes at this root. Test complete pretty-printed actions, including metadata and retries, with a 1,280-byte representative ceiling; also report longer paths/reasons without truncating required fields. A universal 1 KB cap is impossible with unbounded existing path/reason fields. |
| Map ownership by current behavior region | WAVES explicitly requires resolving rows against PRs #155/#157. Necessary unowned validation/runner/hash call sites are supporting edits; no sibling-owned region is needed. If implementation discovers an actual overlap, report it for scheduling rather than edit WAVES or that region. |

### Wave 6 scope map

| Owned behavior | Current files and bounded edits |
| --- | --- |
| Prompt dispatch, retry and cleanup | `flow.mjs`; `route.mjs` imports and `next` prompt/intake wiring only; no `init` ID check or compare changes |
| Policy and local file primitives | `policy.json` prompts block; `state.mjs` new-key validation and owned prompt temporary recognition; no `agents` block or new routing policy |
| Provider boundary and provenance | `run-codex.mjs` pending prompt/file validation; `isolation.mjs` template hash enumeration only |
| Orchestrator guidance | Both `SKILL.md` Loop step 2 only; preserve archive branches, anti-stall section, invocation identity and PR-comment text |
| Tests and indexing | New handoff tests plus affected prompt-enumeration and dispatch tests; shared test index; do not edit sibling-owned `rollback.test.mjs` |
| User-facing reference | A new “Step prompt handoff by file” subsection and narrowly relevant provider paragraph in `docs/REFERENCE.md`, a shared-file exception; leave docs-drift's listed fixes and six ADRs alone |
| Evidence | This change's `evidence/` only; roadmap has no exact matching Change ID and remains untouched |

## Critical Implementation Details

### Durable intake and cleanup

Persist the verified result before removing the task file, as for result intake today. Keep the small `pendingHandoff` cleanup marker durable until removal succeeds, then prune it before committing; a resume with an already attached result must still finish cleanup. Clear the full `pendingPrompt` on intake as today, and never let an error after result persistence lose the result or let an early return bypass cleanup.

### Retry and terminal ordering

An allowed neutral retry recreates the file from stored text before returning `run`; policy changes apply only to later steps. A neutral-cap terminal halt removes the transient file before final-state publication/commit while retaining sufficient pending data to restore it if the cap is later raised. Missing-result and pre-validation refusals preserve pending state; successful intake removes the previous file before step commit, rollback snapshot, archive checks or new prompt publication.

### File ownership and failure behavior

Resolve only the router's fixed path beneath the selected change/run root, refuse symlink redirects and non-regular targets, and never follow a recorded or action-supplied arbitrary path for I/O. A pre-existing `prompt.md` without matching router ownership is a collision: preserve it and halt rather than overwrite or delete it. Reuse atomic publication and extend exact owned-temp recognition for `prompt.md`; do not broaden cleanup to arbitrary Markdown or temporary files. A write/read/delete error returns a recoverable diagnostic and no usable dispatch or commit; do not fall back silently to inline or weaken the current prelaunch/after-launch failure distinction.

## Phase 1: Implement the complete transport boundary

### Overview

Implement opt-in file dispatch for both chains and providers, with characterization checks for the existing inline path, then prove lifecycle and recovery invariants before integrating skill guidance.

### Changes Required:

#### 1. Policy classification and provenance

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Add the transport boolean without making it a template or invalidating provenance. Keep malformed template values visible and classify the one reserved key consistently across production readers.

**Contract**: `prompts.byFile` defaults to false and accepts only booleans when present. `checkPrompts`, `promptProblem` and `promptsHash` enumerate the same actual templates. Toggling transport alone preserves template hashes and all existing provenance fields; edits to task text still change hashes/drift. Shared `paths` already provides `p.dir`; derive the fixed task path there without a second chain-path implementation.

#### 2. Dispatch, replay and consumable file lifecycle

**Files**: `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Publish the canonical rendered task atomically and return a compact descriptor, with cleanup attached to the same result lifecycle that already precedes Git writes. Reuse this path for initial dispatch and neutral replay.

**Contract**: Preserve full `pendingPrompt`; add pending-only `pendingHandoff` in file mode. The wrapper repeats the final contract from the canonical task rather than maintaining a second independently editable RESULT schema, directs a full read, and gives a valid failure RESULT instruction if the file cannot be read. All worktree, advisor, chain/default and always-true rules remain byte-identical in the file. New dispatch publication failure leaves recoverable pending state and never returns `action: run` referencing an unavailable task. Remove only an owned file/temporary; keep enough durable cleanup state to recover after each write/delete boundary. Archive rendering remains untouched and inline.

#### 3. Codex exact-action validation

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Accept the compact descriptor while preserving the existing runner trust boundary and passing exactly that descriptor's prompt to the child.

**Contract**: Inline entries keep exact `entry.pendingPrompt === action.prompt` and reject an unexpected `promptFile`. File entries require exact stored stub/path, canonical expected location, regular non-redirected file and file bytes equal to `pendingPrompt`. Validate at both existing preflight boundaries; refuse missing, modified, stale, cross-chain, cross-root and forged-path actions before model launch. Archive rejects file handoff fields. Keep locks, child-close ordering, profile selection, RESULT normalization and usage untouched.

#### 4. Focused regression coverage and affected callers

**Files**: `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/policy-validate.test.mjs`, `skills/10x-pipeline/test/provenance.test.mjs`, `skills/10x-pipeline/test/advisor.test.mjs`, `skills/10x-pipeline/test/host-integration.test.mjs`, `skills/10x-pipeline/test/preplan.test.mjs`, `skills/10x-pipeline/test/rules.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Exercise real router CLI actions and fake provider execution, including recovery/commit ordering, without editing the Wave 6 rollback-test owner. Update only template-enumeration assumptions that the new reserved key actually breaks.

**Contract**: Reuse `helpers.mjs`, `ahead.mjs`, `codex-helpers.mjs` and OpenSpec helpers as installed. Cover both chains, legacy/off/on policy, restricted Claude score Read, advisor and manual-provider variants, special characters/Unicode in task and root, next-step replacement, terminal completion/halt, isolated commits, pre-archive cleanliness, replay after policy mutation, and file/write/log/delete failure recovery. Put new isolation/rollback cases in the new test file. Ensure template-enumeration tests exclude exactly the reserved option and still reject malformed templates. Index the new file.

### Success Criteria:

#### Automated Verification:

- Default and legacy inline actions remain unchanged; the new boolean validates before writes and both chains accept the opt-in.
- File contents equal the canonical rendered task byte for byte, the wrapper repeats the exact RESULT contract, and initial/next dispatch covers both providers and the restricted score agent.
- Neutral replay restores the original file and descriptor across policy changes, preserving identity, usage ownership, attempts, budget, tier, timestamps and rollback baseline.
- Consumed files and owned temporaries are absent from router step/final/pre-archive commits; next-step replacement, terminal cleanup and interruption recovery preserve results and unrelated files.
- Codex accepts valid file dispatch and rejects altered stubs, file bytes, paths, stale actions, redirects and archive file fields before model launch, with existing runner behavior preserved.
- Transport-only changes preserve provenance hashes while template/rule changes still produce drift; affected template-enumeration tests remain strict.
- The required full Node suite passes after the phase's code changes, with any environment-dependent skips identified rather than counted as proof.

#### Manual Verification:

None required for this phase; live host acceptance is explicitly separate in Phase 3.

## Phase 2: Integrate dispatch guidance and document the opt-in

### Overview

Teach each orchestrator to preserve the compact handoff and document its lifecycle without changing routing or Wave 6 neighboring text.

### Changes Required:

#### 1. Both host dispatch loops

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`

**Intent**: Keep the full task out of orchestrator context while preserving all provider-specific launch and failure rules.

**Contract**: Loop step 2 says to forward the router's `prompt` verbatim even when `promptFile` exists, without reading, expanding, editing or deleting the task file. Claude retains the router agent and exact invocation identity; OpenAI sends the entire action JSON unchanged to the shared runner. Cleanup belongs to the router. Preserve launch classification, matched/late usage, process waiting, archive dispatch and byte-equal anti-stall sections.

#### 2. Focused reference update

**File**: `docs/REFERENCE.md`

**Intent**: Explain how to opt in, how pending runs behave, and what the experiment can establish.

**Contract**: Document `{ "prompts": { "byFile": true } }` as a project override, default false, both providers/chains, relative `promptFile` and absolute wrapper path, unchanged RESULT/task text, pending-state replay, cleanup failures and inline archive exception. Describe the Codex validator's two prompt forms and link this change's evidence. Keep docs-drift's corrections and existing ADRs out of this edit.

### Success Criteria:

#### Automated Verification:

- Both Loop step 2 contracts forward compact prompts unchanged without loading files, preserve provider/usage/error rules, and keep both anti-stall sections identical.
- The reference describes the default, opt-in, replay, cleanup, archive and evidence limits consistently with tested behavior; a search for obsolete full-inline claims resolves only task-owned text.
- The required full Node suite and `git diff --check` pass after skill/content changes, with the final diff confined to the scope map.

#### Manual Verification:

None required for this phase; the content checks do not claim a live agent read the task.

## Phase 3: Record measurements and the default decision

### Overview

Measure emitted bytes deterministically, then assess real matched-run evidence if available. Record the distinction between available proof and acceptance still requiring a host session.

### Changes Required:

#### 1. Output measurements and comparison record

**Files**: `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `context/changes/step-prompt-by-file/evidence/comparison.md`, `context/changes/step-prompt-by-file/evidence/size-measurements.json`

**Intent**: Verify the transport reduces copied text without claiming unmeasured token or quality savings. Produce a reviewable, reproducible default recommendation.

**Contract**: Record actual complete pretty-printed action bytes, wrapper bytes, full task bytes, root/id lengths and retry metadata for representative 10x/OpenSpec, Claude/OpenAI, advisor/review/manual and neutral-retry paths. Use a 1,280-byte normal-fixture ceiling with roots up to 100 UTF-8 bytes and ordinary routing reasons; separately report long-path/reason overhead. Required text is never truncated to satisfy this budget. Archive is explicitly excluded. Save commands, input policy, revision and output; label synthetic fixtures as synthetic.

For live evidence, use the existing read-only `compare <id> --baseline <inline-root> --routed <file-root> --unpinned [--chain openspec]` in separate runs with the same change ID, goal, starting commit, plugin revision, host, provider/model ladder, rigor, inputs and policy except `prompts.byFile`. Use `--unpinned` to avoid replacing the tested routing with the shipped fixed baseline. Save both JSON and Markdown output when a pair exists. Inspect outcome, coverage, failed attempts, warnings and review correctness; count neutral reruns separately from recorded log entries because compare's failed-attempt count deliberately excludes them.

Record every available attempted pair, including halted runs and incomplete usage; do not discard failures to improve the result. A meaningful default-on recommendation needs multiple independent matched changes, coverage of both chains and providers to which it would apply, no observed task/RESULT/quality regression, and end-to-end benefit including orchestrator telemetry. Use at least five matched changes as the repository roadmap's existing provisional evidence floor, not a statistical guarantee. If orchestrator telemetry is unavailable, report copied-byte reduction separately and leave total token benefit unknown. Do not invent a percentage target or extend compare's schema.

The delivery decision is **retain false** unless a separately reviewed future default change is justified. The evidence record must state actual pair counts, missing capabilities/telemetry and the reason for that decision. This unattended implementation can complete evidence bookkeeping with zero live pairs; it cannot mark live acceptance complete. Do not launch child agents to collect data from inside a pipeline step.

### Success Criteria:

#### Automated Verification:

- Actual action-size evidence covers representative dispatch/retry paths near the 1 KB target, quantifies long-path overhead, and distinguishes emitted measurements from estimates and tokens.
- The comparison record includes available compare outputs or an explicit zero-pair/unavailable explanation, usage coverage and failure limitations, and a justified decision retaining the false default.
- The final required full Node suite passes after the last code/test change; evidence and the scoped diff are checked without modifying WAVES, archive or sibling-owned regions.

#### Manual Verification:

- Live Claude and OpenAI sessions for both chains demonstrate a full file read, correct task/RESULT behavior, matched usage and inline archives; unavailable combinations remain pending with reasons.
- At least five matched inline/file live change pairs are reviewed with compare, task quality and orchestrator telemetry before recommending any later default-on change.

## Testing Strategy

### Unit Tests:

Check the reserved option's type and template classification, wrapper/RESULT identity, canonical file checks and transport-independent provenance. Test Unicode and paths containing spaces/quotes without shell interpolation. Use actual shipped templates and rule composition rather than an independently rewritten task oracle.

### Integration Tests:

Drive real CLI `init`/`next` calls using existing helpers in owned scratch projects, with `TMPDIR` placed inside this worktree for router-only test runs under these working-directory rules. Use fake Codex through `codex-helpers` for execution/validation tests; its existing nested temporary layout must remain outside the fixture's run root. Run isolated success, failed-step rollback, undo-on-halt and pre-archive scenarios in fixtures, leaving the repository's own archive untouched. Assert the hook/index/commit view is clean of task files, not merely that the final worktree path is absent. Include crash boundaries for publication, durable result intake and cleanup; an injected failure must preserve enough state to resume.

Focused commands may select the new handoff tests and `codex-runner`, `neutral`, `providers`, `policy-validate`, `provenance`, `rule-levels`, `skill-loop`, `host-integration`, `advisor` and `openspec-skill` tests. Repository rules require the full command after script, policy or prompt changes:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

In this run, prefix shell commands with the exact worktree `cd` required by the task. Never run `init`, `next` or a provider child against this active planning run as a test, and never edit its router-owned state manually. If cleanup is needed, use the existing `removeTree` helper on verified fixture paths only.

### Manual Testing Steps:

The top-level host/operator performs live acceptance after implementation, using independent runs rather than nested delegation. Capture the initial short action, evidence that the child read the complete task, final RESULT, usage ownership and archive behavior. Preserve test sources/logs and keep missing observations unticked. Live comparison is a later acceptance gate for a default change, not permission to fabricate data or block the opt-in implementation.

## Performance Considerations

File mode adds an atomic small-file write and a child read per numbered step. The full task remains in pending state and the task file, so this is orchestrator-context reduction, not task compression or a proven reduction in total tokens. The short path-bearing wrapper is constant with respect to task length; path and existing metadata length still contribute to output. No new dependency or permanent per-step prompt archive is needed.

## Migration Notes

No migration rewrites old logs. Entries without `pendingHandoff` replay inline even after enabling the option; newly scheduled steps follow current policy. Turning the option off affects later dispatches while an existing file-mode pending entry retains its original contract until consumption. Finish that entry with a supporting router before downgrading the plugin. A neutral retry restores a missing or edited owned task file from canonical pending text; a redirect/non-regular path halts for repair. No tool or skill edits live run/meta files by hand.

Removing a consumed `prompt.md` before router commits does not undo an earlier subagent-authored commit that improperly staged transient files. A missing-result or pre-validation halt deliberately retains the unconsumed task; the existing final-PR script's general staging behavior is not a guarantee against publishing that still-pending state. Existing task-specific commit scopes remain authoritative; the wrapper must not encourage adding the task file. Preserve these limitations truthfully rather than claiming that no prompt can ever enter Git history or adding unrelated Git policy/history rewriting.

## References

- Task and acceptance: `context/changes/step-prompt-by-file/change.md`.
- Current ownership: `context/changes/WAVES.md`, Wave 6 and current-path note; competing scope: `context/changes/docs-drift-fixes/change.md`.
- Repository priors: `context/foundation/lessons.md`; provisional five-pair precedent: `context/foundation/roadmap.md`, Open Roadmap Question 1.
- Rendering and ordering: `skills/10x-pipeline/scripts/route.mjs:83`, `:215`, `:264`; replay/intake/template classification: `skills/10x-pipeline/scripts/flow.mjs:355`, `:491`, `:822`, `:891`.
- Durable files and parser: `skills/10x-pipeline/scripts/state.mjs:154`, `:253`, `:446`, `:556`, `:863`.
- Exact runner validation: `skills/10x-pipeline/scripts/run-codex.mjs:25`, `:208`, `:235`, `:258`; `docs/ADR/ADR-024-openai-codex-support.md`.
- Provenance and inline archives: `skills/10x-pipeline/scripts/isolation.mjs:43`, `:731`; `docs/ADR/ADR-015-neutral-orchestrator-retry.md`.
- Comparison limits: `skills/10x-pipeline/scripts/route.mjs:503`, `:534`; `docs/ADR/ADR-005-baseline-usage-comparison.md`.
- Exact RESULT authority: `skills/10x-pipeline/rules/top.md`; Read capability: `agents/score.md`.

## Progress

### Phase 1: Implement the complete transport boundary

#### Automated

- [ ] 1.1 Default and legacy inline actions remain unchanged; the new boolean validates before writes and both chains accept the opt-in.
- [ ] 1.2 File contents equal the canonical rendered task byte for byte, the wrapper repeats the exact RESULT contract, and initial/next dispatch covers both providers and the restricted score agent.
- [ ] 1.3 Neutral replay restores the original file and descriptor across policy changes, preserving identity, usage ownership, attempts, budget, tier, timestamps and rollback baseline.
- [ ] 1.4 Consumed files and owned temporaries are absent from router step/final/pre-archive commits; next-step replacement, terminal cleanup and interruption recovery preserve results and unrelated files.
- [ ] 1.5 Codex accepts valid file dispatch and rejects altered stubs, file bytes, paths, stale actions, redirects and archive file fields before model launch, with existing runner behavior preserved.
- [ ] 1.6 Transport-only changes preserve provenance hashes while template/rule changes still produce drift; affected template-enumeration tests remain strict.
- [ ] 1.7 The required full Node suite passes after the phase's code changes, with any environment-dependent skips identified rather than counted as proof.

### Phase 2: Integrate dispatch guidance and document the opt-in

#### Automated

- [ ] 2.1 Both Loop step 2 contracts forward compact prompts unchanged without loading files, preserve provider/usage/error rules, and keep both anti-stall sections identical.
- [ ] 2.2 The reference describes the default, opt-in, replay, cleanup, archive and evidence limits consistently with tested behavior; a search for obsolete full-inline claims resolves only task-owned text.
- [ ] 2.3 The required full Node suite and `git diff --check` pass after skill/content changes, with the final diff confined to the scope map.

### Phase 3: Record measurements and the default decision

#### Automated

- [ ] 3.1 Actual action-size evidence covers representative dispatch/retry paths near the 1 KB target, quantifies long-path overhead, and distinguishes emitted measurements from estimates and tokens.
- [ ] 3.2 The comparison record includes available compare outputs or an explicit zero-pair/unavailable explanation, usage coverage and failure limitations, and a justified decision retaining the false default.
- [ ] 3.3 The final required full Node suite passes after the last code/test change; evidence and the scoped diff are checked without modifying WAVES, archive or sibling-owned regions.

#### Manual

- [ ] 3.4 Live Claude and OpenAI sessions for both chains demonstrate a full file read, correct task/RESULT behavior, matched usage and inline archives; unavailable combinations remain pending with reasons.
- [ ] 3.5 At least five matched inline/file live change pairs are reviewed with compare, task quality and orchestrator telemetry before recommending any later default-on change.
