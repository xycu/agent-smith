# Nested Step Delegation Implementation Plan

## Overview

Enable pipeline steps to delegate bounded work to native child subagents, collect their results and finish through both normal workflow entry points. Preserve invocation identity, effective permissions, recoverable edits and orchestrator-owned publication throughout the change.

This is S-14, the sole Wave 0 change. The owner deferred performance benchmarking in this invocation. Functional host evidence remains required. This plan covers the change through implementation and acceptance, while the current step delivers planning artifacts only. [Research](research.md) [Scope and ordering](../WAVES.md#wave-0-child-subagents-alone)

## Current State Analysis

The shared rules prohibit delegation across both chains. Implementation templates and executor guides repeat that instruction, and mapped research runs its three analyses sequentially. Claude project settings cap depth at one. Codex preflight and execution disable native agents. The installed implementation skill already assigns coding to children and verification, commits and Progress to the invoking step, according to the supplied research. [Shared rule](../../../skills/10x-pipeline/rules/top.md:14) [Implementation templates](../../../skills/10x-pipeline/policy.json:222) [Runner controls](../../../skills/10x-pipeline/scripts/run-codex.mjs:127) [Research](research.md)

Both orchestrators match reports and usage to the exact enclosing invocation. Their equal sixth anti-stall rule rejects unrelated and child notifications. The runner additionally requires process close, successful exit, a successful terminal turn and agreement between its final-message file and parsed assistant message. Its current parser has no thread filter. The scoped Claude Bash hook recognizes identity-bearing `agent-smith:step` calls. Generic agents pass through that hook. [10x loop](../../../skills/10x-pipeline/SKILL.md:58) [Runner completion](../../../skills/10x-pipeline/scripts/run-codex.mjs:254) [Guard selector](../../../skills/10x-pipeline/scripts/step-guard.mjs:121)

Router modules own pending dispatches, result intake, locks, commits, rollback and recovery refs. Neutral retries retain the stored prompt. Existing tests establish flat-run behavior with fake CLIs. Native child completion, event isolation, usage inclusion, inherited permissions and cancellation remain unverified in the supplied research. [Neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs:404) [Result intake](../../../skills/10x-pipeline/scripts/flow.mjs:547) [Runner fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs:1)

### Re-plan findings (2026-11-16)

Phase 1 is committed at `c4f7b69`; its two completed Automated rows remain unchanged. The failure note described uncommitted Phase 2 work. By this re-plan, router recovery had preserved that attempt at `refs/agent-smith/nested-step-delegation/a0b7de060795/failed-4` and returned implementation files to Phase 1. The working changes now comprise planning/evidence documents and router-owned state. Use the preserved ref as read-only source material, not as a replacement tree. [Recovery record](evidence/implementation-feedback.md#preserved-phase-2-attempt)

The saved implementation changed 28 files, including broad shortening of the 10x skill unrelated to delegation. The last focused contract log has 149 passes and two failures: removed resume/setup wording and changed capitalization in the file-handoff instruction. The earlier full-suite log also has two archive-gate contract failures and pending-promise cancellations. Their lifecycle cause is not established by that log. Recover the targeted delegation edits, retain existing unrelated instruction contracts, and require a fresh complete suite on the recovered candidate. [Gate evidence](evidence/implementation-feedback.md#re-plan-source-check)

The native SIGKILL probe supplies a separate, demonstrated recovery defect: an out-of-group child wrote after its parent's group vanished. `acquireRunLock()` currently allows takeover when that group is gone, and `runCodex()` clears child ownership on process close before validating the final protocol. Same-group tests cannot prove native-child closure. The saved attempt changes runner enablement/parsing but not either lifecycle boundary. Phase 2 must deliver this missing safety work before its feature gate can pass. [Lock owner](../../../skills/10x-pipeline/scripts/state.mjs:969) [Close handling](../../../skills/10x-pipeline/scripts/run-codex.mjs:202) [Native observation](evidence/capabilities.md#codex-cancellation-and-forced-parent-termination)

## Desired End State

A delegating step can start one child layer, await every child it started, reconcile completed work and emit its own final RESULT. The orchestrator advances exactly once from that enclosing report. Children receive bounded tasks and applicable safety rules. The step retains verification, Progress and authorized commit ownership. Router state and terminal publication retain their current owners.

Coverage includes Claude-hosted Claude-only and mixed Claude/OpenAI ladders, plus Codex-hosted OpenAI-only ladders, on both 10x and OpenSpec. Each combination receives interactive and headless functional evidence. Mixed runs exercise both provider dispatches. This focused S-14 matrix has twelve configuration/mode cells. The milestone's eighteen complete qualifying runs remain assigned to S-20. [Configuration scope](../../foundation/roadmap.md#milestone) [S-14 acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)

## Delivery Scope and Assumptions

- A1. Use native, awaited child execution and one child layer below the step. This is the smallest delegation capability matching S-14 and the existing implementation skill's phase/child ownership. Claude's session depth becomes two after verification. Codex exec starts a separate root process, so its child-depth setting must follow that runner's observed native contract. [Research](research.md#delegation-restrictions-and-instruction-delivery) [Depth semantics](../../../docs/ADR/ADR-018-no-nested-subagents.md#amendment-2--harness-depth-cap)
- A2. Preserve restricted score tools, read-only verification and archive-specific rules. Each child receives restrictions at least as strong as its invoking step and task. The existing dedicated Claude step agent supplies the guarded child identity where delegation is allowed. [Score agent](../../../agents/score.md) [Safety contract](../../../docs/ADR/ADR-024-openai-codex-support.md#amendment-1--provider-specific-step-safety-2026-11-15)
- A3. Use native capability observations and authoritative host contracts to select implementation controls. Complete the twelve-cell qualification on the final candidate before claiming that support matrix. A quota-blocked acceptance cell stays pending with its observed reason while implementation and local regression gates continue. The top-level probes and their limits are recorded in capabilities.md. [Capability evidence](evidence/capabilities.md) [Roadmap question 13](../../foundation/roadmap.md#open-roadmap-questions)
- A4. Retain existing persistent schemas and exact historical retry prompts. Child orchestration belongs within the step and native host. Existing runner, lock and intake owners receive only changes needed to uphold their contracts. [Runner boundary](../../../docs/ADR/ADR-024-openai-codex-support.md#decision) [Neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs:404)
- A5. Performance benchmarking and savings claims are deferred by the owner's instruction. This delivery records functional outcomes, available usage and failures. Later measurement can establish comparative performance.
- A6. Resume from Phase 1 and selectively reuse the preserved Phase 2 diff. Preserve the completed rows, existing instruction contracts and stronger safety assertions; no broad skill rewrite or weakening tests to accept unrelated wording drift. This unattended decision follows the recovery ref, focused failures and archive failures. [Re-plan evidence](evidence/implementation-feedback.md#re-plan-source-check)
- A7. Extend the existing execution-lock record and its reader for native-capable execution; keep `run.jsonl`, `meta.json`, result and saved-dispatch schemas unchanged. Record native ownership before model spawn, and retain the lock with an actionable reason whenever closure cannot be established. The recorded ephemeral-host limitation supplies no reliable automatic reconciliation mechanism, so fail-closed retention is the required fallback, not an invented recovery API. [Lock owner](../../../skills/10x-pipeline/scripts/state.mjs:969) [Feedback limitation](evidence/capabilities.md#codex-cancellation-and-forced-parent-termination)
- A8. Repair only demonstrated fixture/lifecycle defects after reproducing the pending-promise cancellations; do not infer a product defect or extend timeouts from the log alone. A cancelled or incomplete suite cannot close an Automated row. Manual qualification remains separate. [Recorded failed gates](evidence/implementation-feedback.md)

## What We're NOT Doing

The scope is delegation, its regression proof and matching instructions. OpenSpec 2.0.0, broader prerequisite onboarding and full milestone qualification retain their separate roadmap slices. [Wave ordering](../WAVES.md#wave-map)

This re-plan edits only this change folder. It does not restore implementation files, mutate router state/recovery refs, change lessons, publish, or run native children. The later implementation reuses the existing runner and lock; it introduces no independent child scheduler or recovery service.

## Implementation Approach

Retain Phase 1's committed fixtures and the top-level observations. Resume Phase 2 by comparing the saved attempt with the current tree, retaining only required feature changes. Repair the unchanged setup, file-handoff and archive contracts first; then implement durable native-child exclusion in the existing runner/lock, followed by coordinated controls, prompts and directly coupled documentation. Run focused gates and a complete local suite before closing Phase 2. Phase 3 then proves broader recovery/compatibility, completes documentation and records the final live matrix. The native-child lock defect is a Phase 2 dependency, not a Phase 3 follow-up.

Every Automated criterion below is executable locally before publication. Tests use scratch repositories, fake Codex processes and inert hook payloads. Existing publication tests use their fake Git/GitHub clients. Live host behavior is classified Manual. A top-level acceptance session must execute the live checks because this planning step's always-true rules prohibit starting children, including through another CLI session.

## Critical Implementation Details

The top-level session has observed successful Codex desktop and headless child collection and successful Claude headless nested collection. The Claude interactive attempt reached nested spawning and then failed with the account's weekly quota limit. Use these bounded observations and the documented host controls for implementation. Keep unproved event, usage, cancellation and safety behavior explicit and cover the implementation with deterministic regression tests. The complete live matrix qualifies the final candidate. Its pending or quota-blocked cells do not prevent Phase 2 coding or local verification, and they cannot be reported as passing. [Top-level observations](evidence/capabilities.md#top-level-native-probes)

Children must be settled before a parent RESULT can trigger result intake, commits or rollback. A timeout or interrupted foreground wait retains the existing process handle and run lock until closure is established. An uncertain descendant lifetime blocks mutation and relaunch through the existing lock owner. Exact old prompts continue to govern their pending dispatches across an upgrade.

A top-level native probe demonstrated a child writing after SIGKILL closed its parent and the parent's process group was gone. A gone process group therefore cannot certify native-child closure. Preserve durable mutation/relaunch exclusion after native runner or parent crashes until native ownership is reconciled, or retain an actionable fail-closed lock when reconciliation is unavailable. Add a regression using a child outside the parent group and preserve flat-run lock compatibility. This concrete recovery defect must be fixed before accepting the child-enabled implementation. [Forced termination evidence](evidence/capabilities.md#codex-cancellation-and-forced-parent-termination)

The failed Phase 2 diff and focused contract failures are identified in the re-plan feedback. Inspect the preserved work before repeating it, and retain the recorded native failure as an explicit regression requirement. [Implementation feedback](evidence/implementation-feedback.md)

## Phase 1: Establish the native child contract

### Overview

Record the capability evidence needed to enable delegation and prepare deterministic process/event fixtures while retaining the delivered flat behavior.

### Changes Required

#### 1. Capability and acceptance evidence

**Files** `context/changes/nested-step-delegation/evidence/capabilities.md` and `context/changes/nested-step-delegation/evidence/acceptance.md`.

**Intent** Record exact tested revisions, Node/host/toolkit/OpenSpec versions, launch modes, effective settings and fresh-child skill discovery. Use a small bounded task whose child returns a unique value and whose parent incorporates that value only after child completion. Capture failed attempts and interventions.

**Contract** For all twelve cells, record spawning, waiting and return delivery, parent/child identities, relevant sanitized event shapes, whether child usage is included in the parent snapshot, descendant lifetime under cancellation and effective inherited permissions. Claude evidence includes ordinary and fork behavior relevant to the selected mode. Select the supported awaited form and record its exact controls. Codex evidence includes its installed agent flags, JSONL scope and process-exit behavior. Keep secrets and unrelated transcripts out of retained evidence. Capability probes run from an authorized top-level session in isolated projects.

#### 2. Existing fake host fixtures

**Files** `skills/10x-pipeline/test/codex-helpers.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/run-lock.test.mjs` and their existing test index.

**Intent** Reuse fake CLI modes to reproduce observed child event interleaving and parent/descendant lifecycle. Add a held descendant with observable readiness and termination so later lifecycle tests have deterministic ordering.

**Contract** Fixtures start no model and access no live account. Baseline flat fixtures remain usable. Introduce assertions for fixture lifecycle and existing boundaries in this phase, then add enabled-delegation acceptance assertions alongside Phase 2's implementation. Reuse `removeTree` for inspected cleanup. Every new test file, if needed, receives an index row.

### Success Criteria

#### Automated Verification

- Existing flat dispatch, completion and invocation-identity tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs`.
- Fake descendant readiness, close ordering and cleanup are deterministic, and the repository suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification

- Native capability evidence records parent receipt, event and usage semantics, cancellation and applicable child restrictions for the twelve configuration/mode cells, with unavailable proof explicitly pending until final-candidate qualification.

## Phase 2: Enable bounded delegation with parent ownership

### Overview

Recover the useful parts of the failed attempt, restore unchanged instruction contracts and implement the missing native-child lock boundary before accepting enabled delegation. Execute the work in dependency order: preserved-diff inspection and instruction repair; lifecycle regression and lock fix; remaining feature/usage changes and coupled docs; focused gates; full suite. Row 2.4 adds the missing safety proof without renumbering existing rows. Full live qualification remains a final-candidate acceptance obligation.

### Changes Required

#### 0. Selective recovery and instruction-contract repair

**Files** Both pipeline `SKILL.md` files; `skills/10x-pipeline/test/skill-loop.test.mjs`, `archive-gate.test.mjs` and `nested-subagents.test.mjs`; `evidence/implementation-feedback.md` in this change folder.

**Intent** Reuse the preserved feature work without replaying the unrelated prose changes that consumed the gate-fix attempts.

**Contract** Inspect `git status --short` and the path-scoped diff between `c4f7b69` and `refs/agent-smith/nested-step-delegation/a0b7de060795/failed-4` before editing. Integrate required hunks into the current files; never restore the entire ref, its planning artifacts, router state or report. Retain staged and working versions if new partial work is present. Keep the baseline setup sentence `Setup resolves resumes before this check, even after complete source cleanup` and file-handoff wording “when `promptFile` exists, forward the router's short `prompt` verbatim”. Preserve archive labels, fail-closed/no-answer behavior, refusal STOP ordering and orchestrator publication/comment ownership pinned by `archive-gate.test.mjs`. Add only delegation and usage changes to these skills. Change existing tests only where the intended delegation contract changes; do not relax setup, handoff, archive or safety assertions. Inspect all failures in the saved full-suite log as well as the last focused log.

#### 1. Shared child and step contract

**Files** `skills/10x-pipeline/rules/top.md`, `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-retry.md`, `executor-tdd.md`, `executor-e2e.md` and `research-with-map.md` in that prompts directory.

**Intent** Replace the blanket prohibition and repeated self-execution requirements with one bounded delegation contract. Permit the named implementation skills and mapped research analyses to delegate where their installed contracts call for it.

**Contract** The parent step forwards the run root, change/step/invocation identity, bounded task, applicable always-true/chain/step safety rules and stricter task restrictions. Claude child calls use the verified guarded `agent-smith:step` identity. Children perform their assigned work, await no further child layer and return findings, touched paths and failures to their parent. The parent collects every launched child, reconciles edits, runs gates, updates Progress and performs only its authorized commits. Child prompts prohibit router/result-file writes, Progress changes, staging/commits and publication. Parallel children receive disjoint write ownership, while overlapping writes run sequentially. Child failure is reconciled by the parent before it reports its own outcome. Routing values retain policy ownership.

#### 2. Host capability controls and safety delivery

**Files** `.claude/settings.json`, `agents/step.md`, `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/test/step-guard.test.mjs`, `step-safety.test.mjs` and `agents.test.mjs` in the test directory.

**Intent** Permit the verified child layer and retain effective step protection. Reuse the existing Claude guarded agent, preserving the guard's orchestrator/unrelated-agent boundary.

**Contract** Claude permits the orchestrator → step → child depth and requires a fresh session. Child identity and applicable permissions are verified through the actual host. Codex removes the two delegation-disabling overrides and applies the exact supported enablement/depth controls recorded in Phase 1 to the existing runner configuration path. Profile, sandbox, approval, trust, model and effort selection retain their current authority. Permission preflight retains its model-free Git proof. Restricted score tools retain their declared set. Custom mappings remain subject to their effective restrictions. An unavailable guarded or restriction-preserving child path produces a truthful blocked result. Guard changes, if required by observed identity delivery, stay scoped to pipeline children and preserve unrelated main-session calls.

Use the recorded Codex enablement controls without inventing a native depth flag: the one-child-layer limit is a leaf-instruction contract where the host exposes no verified runtime cap. Bring the README, reference depth instructions and ADR-018 amendment checked by `nested-subagents.test.mjs` into Phase 2 with their new assertions. Those tests already require the corresponding docs, so postponing every documentation edit to Phase 3 makes the Phase 2 gate impossible. Retain unqualified native modes as pending. [Control limits](evidence/capabilities.md#implementation-controls-and-limits)

#### 3. Result, usage and process boundaries

**Files** Both pipeline `SKILL.md` files, `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `nested-subagents.test.mjs` and `skill-loop.test.mjs`.

**Intent** Make parent completion after child collection explicit and retain exact invocation matching. Update ban/depth assertions to prove the replacement contract.

**Contract** The equal anti-stall sections keep child, foreign, earlier, superseded, archive and ambiguous notifications from supplying the awaited parent result or usage. Children never write `last-result.json`. The runner accepts only the enclosing exec's final reply after successful close. Use the observed native event identity or documented root-only stream boundary to exclude child terminal/message events. Preserve final-file equality, malformed/oversized event checks and rejection of later failed or unfinished parent turns. Count a verified inclusive usage snapshot once. When complete child-inclusive usage is unavailable, omit `totalTokens` and record its coverage limitation through bounded result assumptions and evidence. Model-authored usage stays replaced by measured data. Apply the same coverage rule to Claude Agent results and matched notifications in Loop step 4 and Late usage in both pipeline skills. Identity matching establishes attribution. Phase 1 evidence separately establishes whether each host provides a parent token snapshot including all children. For partial or unknown coverage, omit `totalTokens` and the late `--tokens` flag, retain independently measured tool/duration figures at their documented scope and disclose the limitation in bounded result assumptions and evidence. The existing `usage` command accepts tool/duration-only figures. Keep its one-call, immutable-figure behavior and omit a call when no admissible figure exists. Keep archive usage in the final message with its coverage limitation. Child-level figures stay attributable in evidence and never attach to an unrelated numbered step. Retain the current normalized runner envelope and result-file ownership. Extend both-chain written-contract tests for inclusive, partial and unknown Claude usage on both on-time and late paths, alongside the runner fixtures.

#### 4. Durable native-child exclusion in the existing lock

**Files** `skills/10x-pipeline/scripts/state.mjs` (`acquireRunLock`, `setChild`, `clearChild`), `skills/10x-pipeline/scripts/run-codex.mjs` (`launch`, close/cancellation handling and result validation), `skills/10x-pipeline/test/codex-helpers.mjs`, `run-lock.test.mjs` and `codex-runner.test.mjs`. Check the existing `route.mjs` lock callers; add no parallel lock path.

**Intent** Prevent mutation and relaunch while a native child may still write after its runner or parent disappears.

**Contract** Extend the current execution-lock metadata additively to distinguish native-capable model execution from legacy flat execution and model-free preflight. Publish that distinction before model spawn, including the null-child-PID window; do not wait for the first collaboration event. Both stale-lock takeover and normal close handling must honor it. A missing process group, elapsed timeout, clean exit code or final-file equality alone is insufficient closure proof. Clear native ownership only after the enclosing completion protocol and supported native lifecycle evidence establish settlement; an interrupted, crashed, malformed or otherwise uncertain execution retains the lock, returns an incomplete envelope and explains the lock path, unresolved ownership and required external verification. Do not report that all children stopped merely because the CLI closed. Keep diagnostic evidence sufficient for reconciliation, without persisting secrets or rewriting run state. A step cannot manually remove a production lock or change TMPDIR to evade it. Where native ownership cannot be reconciled, retain exclusion and hand the reason to the authorized top-level owner.

Legacy numeric locks, existing flat execution records and preflight retain their established semantics. The enabled reader must understand both old records and the additive native record. Existing `init`, `next`, `usage`, `status --report` and runner launch callers continue sharing that owner; read-only `status` stays available. Both chains receive a fake child in a separate process group with independent stdio, a readiness marker, a release marker and a late-write marker. Kill the fake parent/runner, establish that its group is gone, demonstrate the surviving child's write, and assert all mutation/relaunch paths remain blocked with unchanged run/report bytes. Cover runner crash, parent SIGKILL, closure uncertainty and successful collection. Prove legacy flat takeover still works. Do not relabel the existing flat crash fixture as delegated and keep its unsafe automatic-takeover expectation. Stop/reap every fixture process in failure cleanup and use `removeTree` only after closure. This is model-free proof; actual native reconciliation remains a Manual obligation.

#### 5. Complete local gates and retain diagnostic outcomes

**Files** The existing runner/lock fixtures and tests above, plus this change folder's verification evidence; no unrelated harness redesign.

**Intent** Replace the incomplete full-suite run with a trustworthy result on the recovered feature candidate.

**Contract** Run the focused instruction gate including `archive-gate.test.mjs`, then runner/guard/lock cases, then the exact repository suite below. Capture command, Node version, candidate revision/diff, exit status and final pass/fail/cancel/skip totals in change evidence. Use the established worktree-local scratch area and Git discovery boundary; runner temp directories must still be outside each scratch run root. If pending-promise cancellations recur, isolate the first failing test file and inspect process handles, close listeners and teardown before changing code. Repair the responsible fixture/runtime owner only on demonstrated evidence. No new skips, timeout inflation or passing subset may substitute for a completed gate. A long tool wait is not a failed test: keep polling the same suite process to its exit rather than starting concurrent copies. Existing platform/opt-in skips must be identified and justified.

### Success Criteria

#### Automated Verification

- Recovered delegation instructions preserve setup/resume, verbatim file handoff, archive refusal/publication contracts, restricted tools and exact anti-stall equality; their coupled depth docs agree, and `node --test --test-concurrency=2 skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs` passes.
- Recovered fake CLI and inert hook cases prove parent-only completion after settlement, inclusive/unknown usage handling, child failure, guarded child denials and orchestrator pass-through with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/step-guard.test.mjs`.
- After instruction and lifecycle repairs, a fresh `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` exits zero with zero failures/cancellations, only justified existing skips and a recorded final summary; earlier partial-suite results do not qualify.

- Both chains retain native execution exclusion after parent/runner death with a live out-of-group child, close uncertainty remains actionable, successful settlement releases safely and legacy flat locks still recover: `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs` passes.

## Phase 3: Verify recovery, compatibility and supported behavior

### Overview

Build on the completed Phase 2 lock boundary to prove delegated work survives failure and resume, finish the documentation beyond the already-coupled depth contracts and record final functional host acceptance. Do not defer the known out-of-group-child exclusion defect to this phase.

### Changes Required

#### 1. Recovery and saved-run regressions

**Files** `skills/10x-pipeline/test/run-lock.test.mjs`, `result-persist.test.mjs`, `codex-chain.test.mjs`, `neutral.test.mjs`, `prompt-handoff.test.mjs`, `stepcommit.test.mjs`, `rollback.test.mjs` and `provenance.test.mjs`, plus the existing OpenSpec integration tests where their chain-specific assertions live.

**Intent** Extend Phase 2’s proven lifecycle boundary into existing result-persistence, preservation and retry scenarios across both chains and transports. Retain the current state and recovery architecture.

**Contract** Test child failure after edits, parent interruption while a descendant remains alive, runner crash, late child completion, duplicate or foreign reports, retry with a repeated description, post-result persistence failure and archive relocation. Assertions inspect real Git/index/worktree content and refs. Child edits, staged-only versions and unrelated edits survive the appropriate router commit or preservation path. Exactly one pending invocation can be accepted. Mutations and relaunch stay blocked while a descendant can still write. Preserve exact historical inline/file prompts and dispatch fields, including old flat-delegation instructions, nullable profile and legacy agent selection. Cover old flat dispatches on the enabling revision and exact retries of child-enabled dispatches on that same revision. Assert that a settings change leaves saved inline/file prompt bytes unchanged, including their child-delegation instructions. These regressions support the rollback precondition in Migration Notes. Provenance reports changed prompt/rule/agent bytes using existing sections. Any demonstrated lifecycle defect is fixed in its existing runner or lock owner, with both old flat and new delegated paths covered.

#### 2. Behavior documentation and historical decision

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-024-openai-codex-support.md`, relevant prompt/rule/test README indexes and both skill descriptions where required.

**Intent** Finish and review the depth documentation already required by Phase 2, plus launch-mode prerequisites, parent ownership, usage coverage, retained-lock recovery and fresh-session migration. Preserve historical observations and their evidence.

**Contract** Append an ADR amendment explaining the replacement delegation decision. Leave `context/foundation/lessons.md` and `/10x-lesson` to the human, as required by the pipeline skill, and surface a lesson candidate in the review/report when appropriate. The shared always-true rule resolves the historical lesson conflict when installed skills load lessons. Update live behavior descriptions and stale unwired-prompt notes without enabling additional features. Keep literal routing models, efforts and tiers in their established policy/reference owners. Search task-relevant live docs and prompts for the old ban and depth instructions, classifying retained historical text. Support claims identify the exact tested candidate and modes and retain pending live cells.

#### 3. Functional acceptance through normal entry points

**Files** `context/changes/nested-step-delegation/evidence/acceptance.md` and the capability evidence from Phase 1.

**Intent** Exercise both pipeline skills on bounded representative tasks in fresh trusted projects using the final candidate. Record results against the twelve-cell matrix and retain every failed attempt.

**Contract** Each cell proves child result receipt before parent completion, one router advance, applicable effective safety, usage ownership, child failure, interruption/resume and late-result rejection. Mixed-ladder cells exercise Claude and OpenAI dispatch. Verify restricted scoring, read-only verification and archive boundaries using harmless probes in isolated projects. Record host settings, installed skill versions, candidate revision, intervention and evidence paths. Publication acceptance is performed by the authorized top-level orchestrator after local verification. Step subagents leave publication to that owner.

### Success Criteria

#### Automated Verification

- Both-chain tests extend Phase 2 native-lock safety to preserved child/staged edits, late results and exact saved flat/delegated retries, passing `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/neutral.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/provenance.test.mjs`.
- Final docs/indexes describe retained native locks, legacy compatibility and pending host qualification consistently with Phase 2; `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` completes with zero failures/cancellations and only justified existing skips.
- `git diff --check` and `node tools/version-check.mjs` pass, and existing fake-client publication tests preserve orchestrator-only publication with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`.

#### Manual Verification

- Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points, including child collection, failure, interruption/resume, late-result rejection, usage attribution and effective child restrictions.
- The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds, and any explicitly requested report comment describes the actual delegation outcome and pending host evidence.

## Testing Strategy

Unit and prompt contracts cover rule delivery, depth, restricted tools, guarded identities and equal anti-stall sections. Both-chain written contracts check Claude on-time, late and archive usage against the recorded coverage rule. Inclusive snapshots count once, while partial or unknown token coverage omits `totalTokens` and late `--tokens` without delaying completion. Runner fixtures replay the native event shapes recorded in Phase 1, including misleading child RESULT text, terminal events after a parent report and unknown or partial usage. Fake descendants provide deterministic readiness and closure barriers. Add the out-of-group fixture before accepting native enablement; same-group tests remain the flat compatibility baseline. Archive/setup/handoff contracts run in the Phase 2 focused gate to catch the observed prose regressions. Pending-promise cancellations require diagnosis and a complete replacement run, never an inferred pass.

Integration tests drive the real router in scratch repositories for both chains. They inspect state only through existing fixtures and router interfaces, proving commit/rollback preservation, lock exclusion, exact retries, task-file handoff and result persistence. Fake Git/GitHub clients cover publication before a remote exists. Run the full repository suite after every runtime, policy, prompt or tools change as required by AGENTS.md. Runtime fixture cleanup uses the existing `removeTree` helper.

Manual checks start in a top-level authorized session, prove fresh-child discovery and effective settings, then run the twelve-cell matrix. Capture safe negative permissions probes in scratch projects. Leave each Manual row pending until its qualifying evidence exists. If live access or mode capability is unavailable, record the exact reason and retain the affected support claim as unqualified. Continue available implementation and automated verification while those acceptance rows remain pending.

## Performance Considerations

The parent waits for all child work and coordinates overlapping edits sequentially. This can affect elapsed time and usage. Benchmarking is deferred by the owner, and this plan sets no performance threshold or savings claim.

## Migration Notes

The readers and writers retain their existing ownership. The router writes run state and pending task carriers, the orchestrator writes the enclosing result, the step manages its own children and authorized Progress/commits, and the runner reads dispatch state and normalizes host output. Children write only assigned task artifacts. Persistent run/result schemas remain compatible. Execution locks alone gain additive native-ownership metadata in `state.mjs`, written by the runner through its existing lock handle and read by all current lock callers. Preserve numeric and legacy flat records. The lock location remains derived from the run path and the configured temporary directory; use the same environment during recovery, never a new temporary root to bypass exclusion.

The forward path is Phase 1 evidence and fixture expansion, Phase 2 compatible lock-reader/writer changes and out-of-group proof alongside coordinated host/prompt activation, then Phase 3 recovery and live verification. Pin a coherent plugin revision for each run. Start fresh Claude sessions with verified depth settings. In-flight old prompts remain byte-exact and continue their flat instructions. Mixed old/new installations use their recorded dispatch and existing drift reporting. Pending historical prompts are never rewritten to opt them into delegation.

Rollback begins by awaiting or stopping children through their existing native parent/runner and proving closure. An older reader can ignore additive native-lock metadata and reclaim a dead process group, so no downgraded process may touch an unresolved native execution lock. Keep affected runs pinned to the enabling revision and retain their lock when native reconciliation is unavailable; parent/group disappearance is not permission to delete it. Before downgrading code or host settings, resolve every pending child-enabled dispatch, including neutral retries, through completion or existing router-owned recovery on the recorded enabling revision and controls. A saved child-enabled prompt retains those requirements after process closure. If it cannot be resolved, keep the affected run pinned to that revision, record the blocked recovery reason and return `signals.needsHuman` for the unavailable recovery prerequisite. Once affected pending dispatches are resolved, revert the feature commit through ordinary preserving Git history and restore prior host settings in a fresh session. Resume historical flat dispatches only with their recorded compatible controls. Retain failed-work refs, logs and evidence. Router recovery owns any snapshots and rollback. The plan requires no destructive data migration or contraction of historical artifacts.

## References

- [Supplied source research](research.md)
- [S-14 scope and acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)
- [Wave 0 ordering](../WAVES.md#wave-0-child-subagents-alone)
- [Historical nesting decision and depth amendment](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [Runner and provider-specific safety contract](../../../docs/ADR/ADR-024-openai-codex-support.md)
- [Existing nesting regressions](../../../skills/10x-pipeline/test/nested-subagents.test.mjs)
- [Existing fake CLI fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs)
- [Claude native nesting documentation cited by research](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)
- [Codex native agent documentation cited by research](https://learn.chatgpt.com/docs/agent-configuration/subagents)

## Progress

### Phase 1: Establish the native child contract

#### Automated

- [x] 1.1 Existing flat dispatch, completion and invocation-identity tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs`. — c4f7b69
- [x] 1.2 Fake descendant readiness, close ordering and cleanup are deterministic, and the repository suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — c4f7b69

#### Manual

- [ ] 1.3 Native capability evidence records parent receipt, event and usage semantics, cancellation and applicable child restrictions for the twelve configuration/mode cells, with unavailable proof explicitly pending until final-candidate qualification.

### Phase 2: Enable bounded delegation with parent ownership

#### Automated

- [ ] 2.1 Recovered delegation instructions preserve setup/resume, verbatim file handoff, archive refusal/publication contracts, restricted tools and exact anti-stall equality; their coupled depth docs agree, and `node --test --test-concurrency=2 skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs` passes.
- [ ] 2.2 Recovered fake CLI and inert hook cases prove parent-only completion after settlement, inclusive/unknown usage handling, child failure, guarded child denials and orchestrator pass-through with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/step-guard.test.mjs`.
- [ ] 2.3 After instruction and lifecycle repairs, a fresh `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` exits zero with zero failures/cancellations, only justified existing skips and a recorded final summary; earlier partial-suite results do not qualify.

- [ ] 2.4 Both chains retain native execution exclusion after parent/runner death with a live out-of-group child, close uncertainty remains actionable, successful settlement releases safely and legacy flat locks still recover: `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs` passes.

### Phase 3: Verify recovery, compatibility and supported behavior

#### Automated

- [ ] 3.1 Both-chain tests extend Phase 2 native-lock safety to preserved child/staged edits, late results and exact saved flat/delegated retries, passing `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/neutral.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/provenance.test.mjs`.
- [ ] 3.2 Final docs/indexes describe retained native locks, legacy compatibility and pending host qualification consistently with Phase 2; `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` completes with zero failures/cancellations and only justified existing skips.
- [ ] 3.3 `git diff --check` and `node tools/version-check.mjs` pass, and existing fake-client publication tests preserve orchestrator-only publication with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`.

#### Manual

- [ ] 3.4 Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points, including child collection, failure, interruption/resume, late-result rejection, usage attribution and effective child restrictions.
- [ ] 3.5 The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds, and any explicitly requested report comment describes the actual delegation outcome and pending host evidence.
