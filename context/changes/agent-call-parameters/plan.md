# Agent Call Parameters Implementation Plan

## Overview

Make both pipeline skills describe Claude Agent calls that fit the host's exposed parameter schema. Give every step and archive agent the fixed description specified in the change request, then use that identity to correlate completion and late usage notifications. OpenAI actions continue through the shared Codex runner.

## Current State Analysis

The Agent-call correction, its content assertions and matching documentation are already present in commit `43e28f3aaf5f37a7becd05f9933c67da60b9ff93` (`chore(agent-call-parameters): final run state`). The failure note describes the worker leaving its patch uncommitted; the later final-run commit captured it. Do not reimplement the correction. Preserve checked rows 1.1–1.3 exactly and verify the existing implementation during the remaining gates. This analysis supersedes the original plan's pre-correction description. [Current dispatch](../../../skills/10x-pipeline/SKILL.md#L57), [saved evidence](evidence/automated.md)

The original problem was a reported Claude Code 2.1.311 schema requiring `description` and rejecting `run_in_background`. Both skills now construct the required step/archive descriptions, condition the flag on the exposed schema, and correlate completion and usage through per-invocation records. The router already supplies `change`, `n` and `step`; neutral retries reuse them. No router interface change is needed. [Change request](change.md), [current rule 6](../../../skills/10x-pipeline/SKILL.md#L92)

The failed implementation recorded 60 passing content/dispatch tests, 79 passing provider/runner tests and 18 expected mutation failures on Node v24.19.0. Its full-suite attempt was interrupted after runner-lock failures, so there is no completed full-suite verdict. An isolated recheck passed for 10x and failed for OpenSpec at `run-lock.test.mjs:215`, expecting status 1 but observing 0. These are historical results, not fresh acceptance of this revision. [Automated evidence](evidence/automated.md), [exact failure](evidence/run-lock-failure.tap)

The failing test uses `closeDelay: 350`, sends SIGTERM, waits for the fake child's `terminating` marker, then starts a router CLI to check exclusion. The child can close legitimately before that process checks the lock. The fixture already has `ready`, `terminating` and `release` files, which provide a synchronization seam. A second consumer in `codex-runner.test.mjs:155–173` checks raw-file retention against a 250 ms shutdown timer. The shared fixture is also used by `codex-chain.test.mjs`; preserve its default behavior. [Lock test](../../../skills/10x-pipeline/test/run-lock.test.mjs#L188), [fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs#L36)

The production runner waits for child `close`, then clears child ownership and releases the lock during cleanup. Cancellation has a five-second SIGKILL fallback. Preserve both guarantees. The evidence supports correcting test synchronization, not changing production locking or extending shutdown timeouts; it does not rule out every possible runtime defect. [Cancellation](../../../skills/10x-pipeline/scripts/run-codex.mjs#L154), [close handling](../../../skills/10x-pipeline/scripts/run-codex.mjs#L192), [cleanup](../../../skills/10x-pipeline/scripts/run-codex.mjs#L290)

Live Claude acceptance remains unverified. This unattended host has no Claude Agent tool and cannot launch nested agents. That limitation belongs to Manual row 1.6 and does not prevent completing the automated correction and commit. [Manual evidence](evidence/unproven.md)

## Desired End State

- A Claude Agent call always supplies `description`, `prompt`, the router-selected `subagent_type` or its existing fallback, `model` and `effort`. It includes `run_in_background: false` exactly when that parameter exists in the currently exposed Agent schema. The orchestrator inspects the schema before dispatch.
- Every numbered Claude step uses `agent-smith <change-id> step <n> <step>`. OpenSpec substitutes its `<change-name>` for the same change identifier. Archive uses `agent-smith <change-id> archive`, with the same OpenSpec substitution.
- The orchestrator records each launch's exact description, its change and step identity, and the agent id when returned. Direct replies belong to their Agent invocation. A known agent id identifies its recorded launch, with any supplied description agreeing. Exact-description fallback requires exactly one compatible recorded launch. A conflicting id never overrides a known launch id. A completion advances only the currently awaited invocation, including after a neutral retry reuses its description.
- The same identity check governs on-time usage in Loop step 4 and late usage. Only usage matched to the current invocation enters its result JSON. A figure matched to an earlier numbered step follows the existing late-usage path, and unmatched or ambiguous figures remain unattached. A current report without its own figure continues without usage in the same turn.
- A foreign or earlier-step completion cannot advance the current step or archive agent. A valid late usage notification can still attach to its own earlier numbered step before the existing cutoff.
- Both skills' anti-stall sections remain word-for-word equal, with six scenario-form rules. OpenAI dispatch follows the existing runner process and normalized-result contracts.
- Automated content and regression checks establish the written contract. A separate Manual row records live Claude completion and usage acceptance.

### Key Discoveries

- Loop step 2 is currently at line 57 of the 10x skill and line 65 of the OpenSpec skill. The ownership in Wave 4 is defined by those behavior regions. [Wave 4 ownership](../WAVES.md#wave-4-run-state-and-isolation-setup-6)
- The optional router-generated description would expand the runtime interface. Constructing it from existing action fields satisfies the requested behavior within the assigned skill regions. [action fields](../../../skills/10x-pipeline/scripts/route.mjs#L268), [change direction](change.md#fix-direction)
- The actual OpenSpec content test is `skills/openspec-pipeline/test/openspec-skill.test.mjs`. The rule already resides in chain-local `rules/` files following the structural migration. [test layout](../../../skills/openspec-pipeline/test/README.md), [rule ownership](../../../docs/ADR/ADR-018-no-nested-subagents.md#subagent-side)
- The original `skill-loop.test.mjs:36` background-flag assertion has been replaced by the implemented content checks. `agents.test.mjs:359` pins Loop step 2 and the archive parameter reuse. [rule assertions](../../../skills/10x-pipeline/test/skill-loop.test.mjs#L35), [agent assertions](../../../skills/10x-pipeline/test/agents.test.mjs#L359)
- `docs/REFERENCE.md:275–276` and ADR-019's Guards paragraph also explain recovering the usage step number. Their caller guidance needs the same identity correction as the skill paragraphs. [reference](../../../docs/REFERENCE.md#L273), [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)

## Scope Boundaries

The implementation owns the following regions in both skills, plus assertions and documentation directly describing these behaviors.

| Owned region | Intended edit |
| --- | --- |
| Loop step 2 | Required descriptions, schema-dependent background flag, per-launch identity recording, the usage ownership guard governing Loop step 4, and the archive description override inherited by archive step 3 |
| Anti-stall rule 1 | Launch-notice handling independent of the background flag |
| Anti-stall rule 6 | Completion correlation through the recorded launch identity |
| Late-usage prose in `done`, `archive` and `halt` | Match the notification to its recorded deterministic description or agent id, then recover its numbered step |
| Existing content tests | Assertions for these requirements and existing provider contracts |
| Reference and existing ADR prose | Agent parameters, report identity and usage-number correlation |

Recovery additionally permits test-only synchronization edits in `skills/10x-pipeline/test/codex-helpers.mjs`, `run-lock.test.mjs` and `codex-runner.test.mjs`, plus their existing test-index descriptions if needed. These are the smallest additional files needed to remove the failed verification race; none is assigned to another Wave 4 change by its ownership row or the `tests-strip-git-env` change request. This explicitly extends the original plan's test scope, without changing sibling-owned Git environment helpers or production locking.

Sibling ownership covers isolation setup and Start step 3, CI scratch directories, Git test environments, router state writes and their callers, and comparison accounting. `WAVES.md` belongs to post-wave maintenance. Runtime scripts, policies, runner dispatch, rule files, permissions, version fields and archived change folders are outside this implementation's edit surface. The optional router description field is excluded. The worktree stays on `agent-smith/agent-call-parameters`. [ownership table](../WAVES.md#wave-4-run-state-and-isolation-setup-6)

## Implementation Approach

Use the existing skills as the responsible layer for Agent parameter adaptation and notification matching. Retain the implemented paired edits, assertions and documentation. Finish the same phase by removing the test shutdown race, obtaining a completed green suite, and committing the remaining scoped work with an honest manual handoff. Keep the archive description exception in Loop step 2 so archive step 3 inherits the correct parameters through its existing reference.

### Assumptions and Decisions

- A1. Keep one phase; recovery includes a bounded shared test-fixture correction. The unattended instruction delegates interview decisions, and the change request specifies the descriptions and conditional flag behavior. Local research supplies the remaining choices. [change request](change.md), [Wave 4](../WAVES.md)
- A2. Build descriptions from the router's existing `change`, `n` and `step` values. This keeps ownership in the assigned region and preserves the current runtime interface. Neutral retries use the same description because they retain those values. [ordinary action](../../../skills/10x-pipeline/scripts/route.mjs#L268), [neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs#L389)
- A3. Apply the archive description override in Loop step 2. The existing archive dispatch already references those parameters, so the exception reaches archive without broadening the edit region. [10x archive dispatch](../../../skills/10x-pipeline/SKILL.md#L73), [OpenSpec archive dispatch](../../../skills/openspec-pipeline/SKILL.md#L80)
- A4. Keep separate records for successive invocations even when a neutral retry reuses the full description. A known notification agent id identifies its recorded launch, and any supplied description must agree. Otherwise require the exact description to identify one recorded launch uniquely, with no conflict against that launch's known id. When that unique launch has no recorded id, associate a newly supplied id with it. Apply this ownership check to completion and every usage source, including on-time usage in Loop step 4. A current completion belongs only to the awaited invocation. A figure identified with an earlier numbered step follows the existing late-usage path, while unidentified figures remain unattached. This reading follows the existing foreign-report and wrong-number guards and preserves matching when the launch returned no id. [neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs#L389), [usage guards](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2), [foreign report rule](../../../docs/ADR/ADR-018-no-nested-subagents.md#orchestrator-side)
- A5. Restrict ADR-018 edits to its orchestrator-side identity wording, and ADR-019 edits to the caller's number-correlation guidance. Their historical statuses, evidence statements and other rules retain their existing ownership. [change direction](change.md#fix-direction), [ADR-019 guards](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)
- A6. Live Claude acceptance requires a top-level Claude Code session. This unattended subagent is forbidden to launch another agent, and its host exposes no Claude Agent tool. Keep the Manual row pending until actual launch, completion and usage evidence exists. [nested-agent lesson](../../foundation/lessons.md#never-let-a-subagent-spawn-its-own-subagent)

- A7. Treat `43e28f3` as the existing implementation checkpoint. The worker's uncommitted status was true at handoff, but `git show --stat 43e28f3` and the current skills establish that final-run cleanup committed the patch. Preserve completed rows without changing their SHA suffixes; new closeout evidence names the checkpoint.
- A8. Extend only the unassigned test-fixture surface above to eliminate elapsed-time ordering. The existing release marker is preferable to larger sleeps or production changes. Shared fixture callers and sibling ownership were checked directly. [Fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs#L36), [Wave 4](../WAVES.md#wave-4-run-state-and-isolation-setup-6), [Git-environment scope](../tests-strip-git-env/change.md)
- A9. Keep the full-suite gate strict: every required file, `--test-concurrency=2`, and a terminal result. An interrupted run, known-flake label, selective skip or lucky retry does not close 1.4. The prior environment workaround supplies the scratch ceiling. [Repository command](../../../AGENTS.md#commands), [failure evidence](evidence/automated.md#blocking-full-suite-gate)
- A10. Automated completion and live acceptance are separate. Record the missing capability and top-level checklist as automated handoff work; keep 1.6 pending. Neither a CLI executable nor static assertions prove live Agent acceptance. The explicit unattended instruction supplies the decision instead of an interview; no nested agents are authorized.

## Phase 1: Correct Agent calls and notification correlation

### Overview

Preserve the delivered correction and finish verification and commit. Changes Required 1–3 retain the implemented contract for review; edit it only for a concrete mismatch found by fresh checks. Execute synchronization work (1.7) before the full-suite gate (1.4), prepare the manual handoff (1.8), then close out the diff and commit (1.5). Indices remain stable despite this dependency order. Manual 1.6 does not block the automated phase commit.

### Changes Required

#### 1. Paired skill dispatch and notification rules

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**

Make valid Claude calls under either exposed Agent schema and give every launch an identity that survives asynchronous reporting. Match completion and late usage to that identity while respecting the existing provider and archive lifecycles.

**Contract**

- In Loop step 2's Claude branch, require `description` with the exact numbered-step format from Desired End State. State that the reused archive parameters override it with the exact archive format, with the respective chain's change placeholder.
- Set `run_in_background` to `false` only when the Agent tool declares that parameter. Otherwise omit the property. Describe the schema choice before the call, so a rejected probe never becomes the compatibility mechanism.
- Record each invocation separately with its exact description, router change, number and step, and associate any returned agent id with that launch. Use the action's actual number for retries, including neutral retries. Preserve prior launch records when their descriptions repeat.
- In Loop step 2, state a usage ownership guard that also governs Loop step 4's selection from already available figures. Take on-time usage only from the current invocation's result or its matched notification. Route a figure matched to an earlier numbered step through the existing late-usage path. Leave unmatched or ambiguous figures unattached. When the current report has no matched figure, omit `usage` and run `next` in the same turn under rule 2. This guard fits the assigned Loop step 2 region.
- Reword rule 1's condition to the Agent tool returning a launch notice instead of a final report. Retain its continuation at run step 3, the intro's archive continuation at step 4, and the existing OpenAI process-handle wait behavior.
- In rule 6, use the direct invocation or a notification matched to that invocation's recorded identity. A known agent id selects its launch and requires any supplied description to agree. Otherwise an exact description must identify one recorded launch uniquely, with no conflict against its known id. Associate a newly supplied id when the uniquely matched launch has no recorded id. A completion from a superseded invocation cannot satisfy the awaited call even when a neutral retry reuses its description. Keep its foreign-hand-back rejection, result-file guard, `next` guard and own-report behavior. The same wording serves both chains.
- In each of the three late-usage paragraphs per skill, recover `<n>` from the earlier launch identified by the same agent-id precedence and unique-description fallback. Confirm its full change/step identity. Keep the printed `Step <n>` line as corroborating context. Ambiguous or unmatched figures stay unattached, and archive usage belongs only in the final message.
- Respect the current usage cutoffs, one standalone `usage` call, missing-figure flags, refusal handling, OpenSpec `--chain openspec`, and archive's result-file prohibition. The OpenAI runner receives its exact action JSON and prompt and returns through its existing completed/launched envelope handling.

#### 2. Focused content regression checks

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/agents.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`

**Intent**

Pin the corrected instructions at their existing test seams. Protect the paired skill sections and existing router-selected dispatch behavior with assertions specific to this change.

**Contract**

- Replace rule 1's obsolete background-flag needle with assertions for flag-independent launch handling, end-of-turn behavior and continuation. Retain the six-rule and identical-section assertions.
- Assert Loop step 2 supplies the exact step description and archive override in both chains, and places background-flag handling behind the exposed-schema condition with explicit omission when absent.
- Assert rule 6 pins known-agent-id precedence, agreement with any supplied description, and unique-description fallback compatible with any recorded id. Cover an earlier step, another change, the archive agent, a conflicting id alongside a matching description, and an earlier invocation with the same neutral-retry description. Also cover a unique description when the launch returned no id, including associating an id first supplied in its notification. A superseded invocation or ambiguous description-only completion cannot advance the awaited call.
- Assert Loop step 2's usage ownership guard explicitly governs on-time selection in Loop step 4. Cover a current final report without its own usage while an earlier step's notification is already present, a foreign notification, and a correctly matched current figure. The first two cases keep current `usage` absent and preserve rule 2's same-turn `next` behavior. The earlier step's figure retains its late-usage path.
- Assert all six terminal late-usage paragraphs recover the correct earlier step through that launch identity. Preserve cutoff, refusal and chain-flag assertions. Include repeated step names with different numbers and a late notification while a newer step is active in the content review scenarios.
- Retain the existing agent fallback, exact prompt, router model/effort and archive-reuse assertions. Use the existing provider/runner tests as regression coverage for OpenAI execution. These content assertions verify the written instructions, with live behavior covered by the Manual criterion.

#### 3. Matching documentation

**Files**: `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`

**Intent**

Make the reference and existing decision records explain the exact identity the skills assign and how it determines completion ownership and the usage step number.

**Contract**

Update only the reference's Orchestrator anti-stall and Late usage figure guidance and directly related Agent-call prose. Amend ADR-018's orchestrator-side correlation and ADR-019's Guards caller guidance. Document the conditional flag and both fixed description formats. Explain agent-id precedence, unique-description fallback, and the ownership check for both on-time and late usage. Maintain the distinction between a current step's completion and an earlier step's valid late usage. Preserve the recorded limits and historical live-verification statements. Existing files and test assertions carry this change, with folder indexes needed only if implementation introduces a new file.

#### 4. Deterministic cancellation fixture and assertions

**Files**: `skills/10x-pipeline/test/codex-helpers.mjs`, `skills/10x-pipeline/test/run-lock.test.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`; existing `test/README.md` rows if needed.

**Intent**

Replace the observed 350 ms race and the same 250 ms retention-test pattern with explicit test-controlled child release. Reuse the fake CLI and its marker protocol.

**Contract**

- A test-selected hold-until-release mode acknowledges cancellation through `terminating` but does not finish because a delay elapsed. Reuse the existing `release` marker to permit close after assertions; keep other consumers' defaults compatible, including `codex-chain.test.mjs`.
- For both chains, retain exclusion checks before cancellation, wait for its acknowledgement, then assert lock/report and raw-output retention while the child is held. Explicitly release it, await `running.closed`, and retain cancellation-envelope, cleanup and post-close availability assertions.
- Keep the production five-second forced-termination fallback unchanged. Keep post-signal checks small and bounded. Register cleanup before assertions, release/terminate on failure, and await child termination before deleting fixtures. Forced SIGKILL before explicit release fails diagnostically; it cannot count as successful controlled shutdown. Reuse `waitForFile` and `startRunner`, without a new synchronization framework or dependency.
- Do not increase sleeps, skip either chain or weaken exclusion assertions. If synchronization exposes a real runtime defect, record it and stop that gate rather than silently expanding into production lock ownership.

#### 5. Completed regression evidence and commit recovery

**Files**: this change's `evidence/automated.md`, `plan.md`, and the scoped implementation/test files above.

**Intent**

Finish the failed gate against the existing correction and leave a durable completion record.

**Contract**

- Preserve old evidence; append a dated recovery section with Node version, exact commands, exit statuses, pass/fail/skip counts and tested revision/diff. Recheck content/provider assertions and shared fixture consumers. Run the targeted lock/cancellation checks twice to exercise the timing correction, then complete the required full suite. Repeat further only after a relevant change or diagnosed failure.
- Use an absolute worktree-local scratch root as both `TMPDIR` and `GIT_CEILING_DIRECTORIES`. Fixture projects and runner temporary directories must be siblings inside it: the runner forbids temporary output inside its individual fixture project. Do not edit sibling-owned environment helpers or CI setup.
- Review the implementation in `43e28f3` as well as the recovery diff: `git diff` alone cannot show the already committed correction. Check docs against both skills and run `git diff --check`. Never stage unrelated files or hand-edit router-owned `agent-smith/meta.json` and `run.jsonl`.
- After automated gates pass, the later implementation workflow commits the recovery and evidence on this run branch using a Conventional Commit and AI coauthor trailer, without bypassing hooks. Verify the commit's intended file list and record its SHA for newly completed Automated rows under that workflow. Leave 1.1–1.3 unchanged. This planning invocation makes no commit.

#### 6. Explicit live-acceptance handoff

**File**: `context/changes/agent-call-parameters/evidence/unproven.md`

**Intent**

Make the unavailable live check actionable without pretending this unattended subagent can perform it.

**Contract**

Retain Manual 1.6 pending. Record host/tool availability, the no-nesting restriction, the implementation checkpoint and later recovery commit, and a checklist from Live Acceptance Procedure for an authorized top-level Claude Code session. Distinguish static results from unobserved schema acceptance, completion delivery and usage attribution. Row 1.8 verifies this handoff only; it neither certifies Claude behavior nor waives 1.6. Do not launch Claude or another agent for this step.

### Success Criteria

#### Automated Verification

- Paired skill content tests pass with required descriptions, schema-dependent background flags, identical six-rule sections and identity-based completion and late usage correlation.
- Existing agent dispatch and OpenAI provider, runner, chain and host-integration regression tests pass.
- Deliberate mutations of scratch skill copies fail the corresponding description, conditional-flag, rule-1, rule-6 and late-usage assertions through the existing skill-path overrides.
- After deterministic shutdown verification (1.7), the full repository test suite completes with zero failures on Node 24 or later using --test-concurrency=2, with its terminal summary saved.
- The implementation checkpoint and scoped recovery diff are reviewed, git diff --check passes, documentation agrees with both skills, and the authorized implementation workflow commits the recovery with evidence while Manual 1.6 remains pending.

- Both chains pass deterministic child-release checks for lock/report and raw-output retention through cancellation, with bounded cleanup and unchanged production shutdown behavior.
- The manual handoff records the missing Claude host capability, no-nesting restriction, implementation checkpoint and top-level acceptance checklist without claiming live verification.

#### Manual Verification

- An authorized top-level Claude Code session records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step; this row stays pending in unattended recovery.

Proceed through automated work under the authorized implementation workflow. Keep the Manual row pending whenever live Claude access or top-level launch authority is unavailable, recording the exact reason under this change's `evidence/unproven.md` when the verification workflow reaches it.

## Testing Strategy

### Focused Verification

Run `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs` after the paired edits. Run `node --test skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/host-integration.test.mjs` for existing provider and runner contracts. Include `run-lock.test.mjs` in focused fixture verification. Run the lock/cancellation name-pattern checks twice after synchronization changes, then finish with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `git diff --check`. Capture a completed terminal summary; the old interrupted log is insufficient.

Use existing test patterns and dependency-free assertions. Keep disposable files and scratch directories inside this run worktree under the working-directory rules. Set both `TMPDIR` and `GIT_CEILING_DIRECTORIES` to the same absolute worktree-local scratch root for every test command, preventing non-repository fixtures discovering the enclosing checkout. Clear inherited Git redirection variables for the test process if present, without editing sibling-owned helpers. Every shell command starts with the explicit `cd` to this run worktree. Scratch roots stay outside individual fixture project roots. Remove scratch files individually, followed by empty directories, using the repository's `removeTree` helper where appropriate.

The 18 historical deliberate-break results support completed row 1.3. Repeat affected mutations only if recovery changes their skill or content assertion; fixture-only edits do not require replaying them. For a recheck, use disposable skill copies with `SKILL_PATH` and `OPENSPEC_SKILL_PATH`. Independently remove a required description, the archive override, the conditional flag instruction, the fixed-identity match, agent-id precedence, unique-description fallback, the on-time usage ownership guard, or the late-usage identity mapping, and restore the old rule-1 condition. Each mutation must fail the relevant assertion. Keep mutations in scratch copies and record the failing test names and exit statuses in the implementation evidence.

### Live Acceptance Procedure

1. From an authorized top-level Claude Code session, record the Claude version and the actual Agent tool schema. Capture whether `run_in_background` is declared. Use the edited skills on a disposable project.
2. Capture a numbered launch's actual parameters and completion. Confirm its exact description and the flag's presence or omission against that schema. Record the agent id if supplied. Capture an archive launch with its archive description and the existing archive result handling.
3. Capture an on-time usage figure and a figure delivered after `next` for an earlier numbered step. Apply the same identity check to both. Include an earlier notification already present when a current report arrives without its own usage, confirming current usage stays absent and the earlier figure follows its own late-usage path. Include a newer step with the same step name. Record the standalone `usage` response and the resulting numbered status/report entry.
4. Verify an earlier or unrelated completion cannot supply the waiting step's result. Record the waiting launch identity and accepted completion identity. The content scenarios additionally cover conflicting metadata, superseded invocations sharing a neutral-retry description, ambiguous description-only notifications, and matching when the launch returned no id. Archive usage appears in the final message.
5. Record every observed schema and outcome precisely. Static checks cover the alternate-schema instructions when a live session exposes only one schema. Keep the Manual row pending if its required live completion and usage evidence is missing.

Planning availability on 2026-11-14 is limited to static repository checks and read-only code tracing. A Claude executable is on `PATH`, but this session has no callable Claude Agent tool, and the unattended no-nesting rule prohibits starting a live acceptance run here. Live Claude acceptance remains unverified.

## Performance Considerations

Description construction and matching use the action fields and launch information already held by the orchestrator. The proposed change adds no runtime process, storage format or dependency.

## Migration Notes

Existing router state supplies the fields used by the descriptions, including neutral retries. Resume behavior and `usage` validation follow their current contracts. The new correlation instructions apply to launches that carry the assigned identity. When prior launch information cannot establish a notification's owner, leave its figure unattached and report the missing evidence. Rollback uses a normal scoped revert; do not blindly revert the final-run checkpoint because it also contains unrelated state and AGENTS.md changes. Recovery changes test synchronization and evidence, with no data migration.

## References

- [Change request](change.md)
- [Wave 4 ownership and structural-migration notes](../WAVES.md)
- [Repository rules](../../../AGENTS.md)
- [Lessons](../../foundation/lessons.md)
- [10x pipeline](../../../skills/10x-pipeline/SKILL.md)
- [OpenSpec pipeline](../../../skills/openspec-pipeline/SKILL.md)
- [Router dispatch fields](../../../skills/10x-pipeline/scripts/route.mjs#L268)
- [Neutral retry fields](../../../skills/10x-pipeline/scripts/flow.mjs#L355)
- [Reference correlation and usage guidance](../../../docs/REFERENCE.md#L273)
- [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
- [Saved automated failure evidence](evidence/automated.md)
- [Captured runner-lock failure](evidence/run-lock-failure.tap)
- [Shared fake CLI](../../../skills/10x-pipeline/test/codex-helpers.mjs)
- [Runner-lock regression](../../../skills/10x-pipeline/test/run-lock.test.mjs)
- [Runner cancellation regression](../../../skills/10x-pipeline/test/codex-runner.test.mjs)
- [Host/provider integration assertions](../../../skills/10x-pipeline/test/host-integration.test.mjs)

## Progress

### Phase 1: Correct Agent calls and notification correlation

#### Automated

- [x] 1.1 Paired skill content tests pass with required descriptions, schema-dependent background flags, identical six-rule sections and identity-based completion and late usage correlation.
- [x] 1.2 Existing agent dispatch and OpenAI provider, runner, chain and host-integration regression tests pass.
- [x] 1.3 Deliberate mutations of scratch skill copies fail the corresponding description, conditional-flag, rule-1, rule-6 and late-usage assertions through the existing skill-path overrides.
- [ ] 1.4 After deterministic shutdown verification (1.7), the full repository test suite completes with zero failures on Node 24 or later using --test-concurrency=2, with its terminal summary saved.
- [ ] 1.5 The implementation checkpoint and scoped recovery diff are reviewed, git diff --check passes, documentation agrees with both skills, and the authorized implementation workflow commits the recovery with evidence while Manual 1.6 remains pending.

- [ ] 1.7 Both chains pass deterministic child-release checks for lock/report and raw-output retention through cancellation, with bounded cleanup and unchanged production shutdown behavior.
- [ ] 1.8 The manual handoff records the missing Claude host capability, no-nesting restriction, implementation checkpoint and top-level acceptance checklist without claiming live verification.

#### Manual

- [ ] 1.6 An authorized top-level Claude Code session records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step; this row stays pending in unattended recovery.
