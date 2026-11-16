# Nested Step Delegation Implementation Plan

## Overview

Enable pipeline steps to delegate bounded work to native child subagents, collect their results and finish through both normal workflow entry points. Preserve invocation identity, effective permissions, recoverable edits and orchestrator-owned publication throughout the change.

This is S-14, the sole Wave 0 change. The owner deferred performance benchmarking in this invocation. Functional host evidence remains required. This plan covers the change through implementation and acceptance, while the current step delivers planning artifacts only. [Research](research.md) [Scope and ordering](../WAVES.md#wave-0-child-subagents-alone)

## Current State Analysis

The shared rules prohibit delegation across both chains. Implementation templates and executor guides repeat that instruction, and mapped research runs its three analyses sequentially. Claude project settings cap depth at one. Codex preflight and execution disable native agents. The installed implementation skill already assigns coding to children and verification, commits and Progress to the invoking step, according to the supplied research. [Shared rule](../../../skills/10x-pipeline/rules/top.md:14) [Implementation templates](../../../skills/10x-pipeline/policy.json:222) [Runner controls](../../../skills/10x-pipeline/scripts/run-codex.mjs:127) [Research](research.md)

Both orchestrators match reports and usage to the exact enclosing invocation. Their equal sixth anti-stall rule rejects unrelated and child notifications. The runner additionally requires process close, successful exit, a successful terminal turn and agreement between its final-message file and parsed assistant message. Its current parser has no thread filter. The scoped Claude Bash hook recognizes identity-bearing `agent-smith:step` calls. Generic agents pass through that hook. [10x loop](../../../skills/10x-pipeline/SKILL.md:58) [Runner completion](../../../skills/10x-pipeline/scripts/run-codex.mjs:254) [Guard selector](../../../skills/10x-pipeline/scripts/step-guard.mjs:121)

Router modules own pending dispatches, result intake, locks, commits, rollback and recovery refs. Neutral retries retain the stored prompt. Existing tests establish flat-run behavior with fake CLIs. Native child completion, event isolation, usage inclusion, inherited permissions and cancellation remain unverified in the supplied research. [Neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs:404) [Result intake](../../../skills/10x-pipeline/scripts/flow.mjs:547) [Runner fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs:1)

## Desired End State

A delegating step can start one child layer, await every child it started, reconcile completed work and emit its own final RESULT. The orchestrator advances exactly once from that enclosing report. Children receive bounded tasks and applicable safety rules. The step retains verification, Progress and authorized commit ownership. Router state and terminal publication retain their current owners.

Coverage includes Claude-hosted Claude-only and mixed Claude/OpenAI ladders, plus Codex-hosted OpenAI-only ladders, on both 10x and OpenSpec. Each combination receives interactive and headless functional evidence. Mixed runs exercise both provider dispatches. This focused S-14 matrix has twelve configuration/mode cells. The milestone's eighteen complete qualifying runs remain assigned to S-20. [Configuration scope](../../foundation/roadmap.md#milestone) [S-14 acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)

## Delivery Scope and Assumptions

- A1. Use native, awaited child execution and one child layer below the step. This is the smallest delegation capability matching S-14 and the existing implementation skill's phase/child ownership. Claude's session depth becomes two after verification. Codex exec starts a separate root process, so its child-depth setting must follow that runner's observed native contract. [Research](research.md#delegation-restrictions-and-instruction-delivery) [Depth semantics](../../../docs/ADR/ADR-018-no-nested-subagents.md#amendment-2--harness-depth-cap)
- A2. Preserve restricted score tools, read-only verification and archive-specific rules. Each child receives restrictions at least as strong as its invoking step and task. The existing dedicated Claude step agent supplies the guarded child identity where delegation is allowed. [Score agent](../../../agents/score.md) [Safety contract](../../../docs/ADR/ADR-024-openai-codex-support.md#amendment-1--provider-specific-step-safety-2026-11-15)
- A3. Use capability evidence as an implementation prerequisite. A gap in an agreed configuration blocks its enablement and the S-14 support claim, with `signals.needsHuman` identifying unavailable access or the required owner scope decision. Existing flat execution remains available while evidence is pending. The roadmap explicitly permits planning before that evidence exists. [Roadmap question 13](../../foundation/roadmap.md#open-roadmap-questions)
- A4. Retain existing persistent schemas and exact historical retry prompts. Child orchestration belongs within the step and native host. Existing runner, lock and intake owners receive only changes needed to uphold their contracts. [Runner boundary](../../../docs/ADR/ADR-024-openai-codex-support.md#decision) [Neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs:404)
- A5. Performance benchmarking and savings claims are deferred by the owner's instruction. This delivery records functional outcomes, available usage and failures. Later measurement can establish comparative performance.

The scope is delegation, its regression proof and matching instructions. OpenSpec 2.0.0, broader prerequisite onboarding and full milestone qualification retain their separate roadmap slices. [Wave ordering](../WAVES.md#wave-map)

## Implementation Approach

First establish the native host contract in isolated acceptance projects and extend the existing deterministic fixtures. Then update host controls, shared rules and delegating prompts as one coherent feature. Keep the existing guarded Claude agent for children and retain parent-only result ownership in both skills. Adapt the Codex parser and lifecycle only where recorded native behavior requires it. Finally verify recovery, compatibility and documentation, and execute the focused live matrix.

Every Automated criterion below is executable locally before publication. Tests use scratch repositories, fake Codex processes and inert hook payloads. Existing publication tests use their fake Git/GitHub clients. Live host behavior is classified Manual. A top-level acceptance session must execute the live checks because this planning step's always-true rules prohibit starting children, including through another CLI session.

## Critical Implementation Details

Phase 1's live capability criterion is a prerequisite for Phase 2 activation. An unattended implementer must return `blocked` with the specific missing evidence or capability when it cannot establish that prerequisite. Merely treating a skill's human confirmation as answered cannot satisfy it. This ordering follows the research's explicit completion, permissions and process-lifetime gaps.

Children must be settled before a parent RESULT can trigger result intake, commits or rollback. A timeout or interrupted foreground wait retains the existing process handle and run lock until closure is established. An uncertain descendant lifetime blocks mutation and relaunch through the existing lock owner. Exact old prompts continue to govern their pending dispatches across an upgrade.

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

- Native capability evidence covers all twelve configuration/mode cells, establishing parent receipt, event and usage semantics, cancellation and applicable child restrictions before activation.

## Phase 2: Enable bounded delegation with parent ownership

### Overview

Activate native children with verified controls and reconcile all delivered instructions. Phase 1's capability evidence is the activation prerequisite.

### Changes Required

#### 1. Shared child and step contract

**Files** `skills/10x-pipeline/rules/top.md`, `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-retry.md`, `executor-tdd.md`, `executor-e2e.md` and `research-with-map.md` in that prompts directory.

**Intent** Replace the blanket prohibition and repeated self-execution requirements with one bounded delegation contract. Permit the named implementation skills and mapped research analyses to delegate where their installed contracts call for it.

**Contract** The parent step forwards the run root, change/step/invocation identity, bounded task, applicable always-true/chain/step safety rules and stricter task restrictions. Claude child calls use the verified guarded `agent-smith:step` identity. Children perform their assigned work, await no further child layer and return findings, touched paths and failures to their parent. The parent collects every launched child, reconciles edits, runs gates, updates Progress and performs only its authorized commits. Child prompts prohibit router/result-file writes, Progress changes, staging/commits and publication. Parallel children receive disjoint write ownership, while overlapping writes run sequentially. Child failure is reconciled by the parent before it reports its own outcome. Routing values retain policy ownership.

#### 2. Host capability controls and safety delivery

**Files** `.claude/settings.json`, `agents/step.md`, `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/test/step-guard.test.mjs`, `step-safety.test.mjs` and `agents.test.mjs` in the test directory.

**Intent** Permit the verified child layer and retain effective step protection. Reuse the existing Claude guarded agent, preserving the guard's orchestrator/unrelated-agent boundary.

**Contract** Claude permits the orchestrator → step → child depth and requires a fresh session. Child identity and applicable permissions are verified through the actual host. Codex removes the two delegation-disabling overrides and applies the exact supported enablement/depth controls recorded in Phase 1 to the existing runner configuration path. Profile, sandbox, approval, trust, model and effort selection retain their current authority. Permission preflight retains its model-free Git proof. Restricted score tools retain their declared set. Custom mappings remain subject to their effective restrictions. An unavailable guarded or restriction-preserving child path produces a truthful blocked result. Guard changes, if required by observed identity delivery, stay scoped to pipeline children and preserve unrelated main-session calls.

#### 3. Result, usage and process boundaries

**Files** Both pipeline `SKILL.md` files, `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `nested-subagents.test.mjs` and `skill-loop.test.mjs`.

**Intent** Make parent completion after child collection explicit and retain exact invocation matching. Update ban/depth assertions to prove the replacement contract.

**Contract** The equal anti-stall sections keep child, foreign, earlier, superseded, archive and ambiguous notifications from supplying the awaited parent result or usage. Children never write `last-result.json`. The runner accepts only the enclosing exec's final reply after successful close. Use the observed native event identity or documented root-only stream boundary to exclude child terminal/message events. Preserve final-file equality, malformed/oversized event checks and rejection of later failed or unfinished parent turns. Count a verified inclusive usage snapshot once. When complete child-inclusive usage is unavailable, omit `totalTokens` and record its coverage limitation through bounded result assumptions and evidence. Model-authored usage stays replaced by measured data. Apply the same coverage rule to Claude Agent results and matched notifications in Loop step 4 and Late usage in both pipeline skills. Identity matching establishes attribution. Phase 1 evidence separately establishes whether each host provides a parent token snapshot including all children. For partial or unknown coverage, omit `totalTokens` and the late `--tokens` flag, retain independently measured tool/duration figures at their documented scope and disclose the limitation in bounded result assumptions and evidence. The existing `usage` command accepts tool/duration-only figures. Keep its one-call, immutable-figure behavior and omit a call when no admissible figure exists. Keep archive usage in the final message with its coverage limitation. Child-level figures stay attributable in evidence and never attach to an unrelated numbered step. Retain the current normalized runner envelope and result-file ownership. Extend both-chain written-contract tests for inclusive, partial and unknown Claude usage on both on-time and late paths, alongside the runner fixtures.

### Success Criteria

#### Automated Verification

- Both chains deliver bounded delegation rules through inline and file task carriers, keep restricted tools and exact anti-stall equality, and pass `node --test --test-concurrency=2 skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs`.
- Fake CLI and inert hook cases prove parent-only completion and usage, child failure handling, partial-usage disclosure, guarded child denials and orchestrator pass-through with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/step-guard.test.mjs`.
- All repository tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 3: Verify recovery, compatibility and supported behavior

### Overview

Prove delegated work survives failure and resume, synchronize the documented contract and record final functional host acceptance.

### Changes Required

#### 1. Recovery and saved-run regressions

**Files** `skills/10x-pipeline/test/run-lock.test.mjs`, `result-persist.test.mjs`, `codex-chain.test.mjs`, `neutral.test.mjs`, `prompt-handoff.test.mjs`, `stepcommit.test.mjs`, `rollback.test.mjs` and `provenance.test.mjs`, plus the existing OpenSpec integration tests where their chain-specific assertions live.

**Intent** Extend existing scratch-repository scenarios across both chains and transports. Retain the current state and recovery architecture.

**Contract** Test child failure after edits, parent interruption while a descendant remains alive, runner crash, late child completion, duplicate or foreign reports, retry with a repeated description, post-result persistence failure and archive relocation. Assertions inspect real Git/index/worktree content and refs. Child edits, staged-only versions and unrelated edits survive the appropriate router commit or preservation path. Exactly one pending invocation can be accepted. Mutations and relaunch stay blocked while a descendant can still write. Preserve exact historical inline/file prompts and dispatch fields, including old flat-delegation instructions, nullable profile and legacy agent selection. Cover old flat dispatches on the enabling revision and exact retries of child-enabled dispatches on that same revision. Assert that a settings change leaves saved inline/file prompt bytes unchanged, including their child-delegation instructions. These regressions support the rollback precondition in Migration Notes. Provenance reports changed prompt/rule/agent bytes using existing sections. Any demonstrated lifecycle defect is fixed in its existing runner or lock owner, with both old flat and new delegated paths covered.

#### 2. Behavior documentation and historical decision

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-024-openai-codex-support.md`, `context/foundation/lessons.md`, relevant prompt/rule/test README indexes and both skill descriptions where required.

**Intent** Document verified depth, launch-mode prerequisites, parent ownership, usage coverage, recovery and fresh-session migration. Preserve historical observations and their evidence.

**Contract** Append an ADR amendment explaining the replacement delegation decision and an append-only lesson explicitly superseding the earlier universal no-nesting lesson for the verified contract. The shared always-true rule resolves that historical conflict when installed skills load lessons. Update live behavior descriptions and stale unwired-prompt notes without enabling additional features. Keep literal routing models, efforts and tiers in their established policy/reference owners. Search task-relevant live docs and prompts for the old ban and depth instructions, classifying retained historical text. The current twelve-cell evidence supports only the exact tested candidate and modes.

#### 3. Functional acceptance through normal entry points

**Files** `context/changes/nested-step-delegation/evidence/acceptance.md` and the capability evidence from Phase 1.

**Intent** Exercise both pipeline skills on bounded representative tasks in fresh trusted projects using the final candidate. Record results against the twelve-cell matrix and retain every failed attempt.

**Contract** Each cell proves child result receipt before parent completion, one router advance, applicable effective safety, usage ownership, child failure, interruption/resume and late-result rejection. Mixed-ladder cells exercise Claude and OpenAI dispatch. Verify restricted scoring, read-only verification and archive boundaries using harmless probes in isolated projects. Record host settings, installed skill versions, candidate revision, intervention and evidence paths. Publication acceptance is performed by the authorized top-level orchestrator after local verification. Step subagents leave publication to that owner.

### Success Criteria

#### Automated Verification

- Both-chain recovery and saved-run compatibility cases pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/neutral.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/provenance.test.mjs`.
- Updated behavior documentation and indexes agree with delegation assertions, and all repository tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- `git diff --check` and `node tools/version-check.mjs` pass, and existing fake-client publication tests preserve orchestrator-only publication with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`.

#### Manual Verification

- Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points, including child collection, failure, interruption/resume, late-result rejection, usage attribution and effective child restrictions.
- The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds, and any explicitly requested report comment describes the actual delegation outcome and pending host evidence.

## Testing Strategy

Unit and prompt contracts cover rule delivery, depth, restricted tools, guarded identities and equal anti-stall sections. Both-chain written contracts check Claude on-time, late and archive usage against the recorded coverage rule. Inclusive snapshots count once, while partial or unknown token coverage omits `totalTokens` and late `--tokens` without delaying completion. Runner fixtures replay the native event shapes recorded in Phase 1, including misleading child RESULT text, terminal events after a parent report and unknown or partial usage. Fake descendants provide deterministic readiness and closure barriers.

Integration tests drive the real router in scratch repositories for both chains. They inspect state only through existing fixtures and router interfaces, proving commit/rollback preservation, lock exclusion, exact retries, task-file handoff and result persistence. Fake Git/GitHub clients cover publication before a remote exists. Run the full repository suite after every runtime, policy, prompt or tools change as required by AGENTS.md. Runtime fixture cleanup uses the existing `removeTree` helper.

Manual checks start in a top-level authorized session, prove fresh-child discovery and effective settings, then run the twelve-cell matrix. Capture safe negative permissions probes in scratch projects. Leave each Manual row pending until its qualifying evidence exists. If live access or mode capability is unavailable, record the exact reason and return a needs-human blocker for the affected prerequisite or support claim.

## Performance Considerations

The parent waits for all child work and coordinates overlapping edits sequentially. This can affect elapsed time and usage. Benchmarking is deferred by the owner, and this plan sets no performance threshold or savings claim.

## Migration Notes

The readers and writers retain their existing ownership. The router writes run state and pending task carriers, the orchestrator writes the enclosing result, the step manages its own children and authorized Progress/commits, and the runner reads dispatch state and normalizes host output. Children write only assigned task artifacts. Persistent run/result schemas remain compatible.

The forward path is evidence and fixture expansion, coordinated host/prompt activation, then recovery and live verification. Pin a coherent plugin revision for each run. Start fresh Claude sessions with verified depth settings. In-flight old prompts remain byte-exact and continue their flat instructions. Mixed old/new installations use their recorded dispatch and existing drift reporting. Pending historical prompts are never rewritten to opt them into delegation.

Rollback begins by awaiting or stopping children through their existing native parent/runner and proving closure. Before downgrading code or host settings, resolve every pending child-enabled dispatch, including neutral retries, through completion or existing router-owned recovery on the recorded enabling revision and controls. A saved child-enabled prompt retains those requirements after process closure. If it cannot be resolved, keep the affected run pinned to that revision, record the blocked recovery reason and return `signals.needsHuman` for the unavailable recovery prerequisite. Once affected pending dispatches are resolved, revert the feature commit through ordinary preserving Git history and restore prior host settings in a fresh session. Resume historical flat dispatches only with their recorded compatible controls. Retain failed-work refs, logs and evidence. Router recovery owns any snapshots and rollback. The plan requires no destructive data migration or contraction of historical artifacts.

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

- [x] 1.1 Existing flat dispatch, completion and invocation-identity tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs`.
- [x] 1.2 Fake descendant readiness, close ordering and cleanup are deterministic, and the repository suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual

- [ ] 1.3 Native capability evidence covers all twelve configuration/mode cells, establishing parent receipt, event and usage semantics, cancellation and applicable child restrictions before activation.

### Phase 2: Enable bounded delegation with parent ownership

#### Automated

- [ ] 2.1 Both chains deliver bounded delegation rules through inline and file task carriers, keep restricted tools and exact anti-stall equality, and pass `node --test --test-concurrency=2 skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs`.
- [ ] 2.2 Fake CLI and inert hook cases prove parent-only completion and usage, child failure handling, partial-usage disclosure, guarded child denials and orchestrator pass-through with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/step-guard.test.mjs`.
- [ ] 2.3 All repository tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Phase 3: Verify recovery, compatibility and supported behavior

#### Automated

- [ ] 3.1 Both-chain recovery and saved-run compatibility cases pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/neutral.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/provenance.test.mjs`.
- [ ] 3.2 Updated behavior documentation and indexes agree with delegation assertions, and all repository tests pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- [ ] 3.3 `git diff --check` and `node tools/version-check.mjs` pass, and existing fake-client publication tests preserve orchestrator-only publication with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`.

#### Manual

- [ ] 3.4 Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points, including child collection, failure, interruption/resume, late-result rejection, usage attribution and effective child restrictions.
- [ ] 3.5 The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds, and any explicitly requested report comment describes the actual delegation outcome and pending host evidence.
