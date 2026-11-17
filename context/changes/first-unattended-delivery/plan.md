# First Unattended Delivery Implementation Plan

## Overview

Establish S-12 with one fresh Claude-only 10x workflow that completes an authorized change and reaches a reviewable pull request without steering. Prepare a reproducible launch contract and local verification first, then retain the complete live attempt and publication evidence under this change.

## Current State Analysis

The router, isolation, guarded dispatch, result intake, step commits and terminal publication already exist. Research identifies missing live proof across their installed integration. Wave 2 is merged and Wave 3 is eligible, subject to authenticated Claude access, project trust and review-remote access. [research.md](research.md), [WAVES.md](../WAVES.md)

This run is hosted on Codex on branch `agent-smith/first-unattended-delivery`, with planning baseline `fca25820008d11270fcb59fc7e1df57165ac3454`. Its project override supplies an OpenAI-only ladder. Selecting the Claude host retains that override, and saved run host identity is immutable. A separate fresh acceptance run needs its own committed Claude-only configuration. [state.mjs:40](../../../skills/10x-pipeline/scripts/state.mjs), [state.mjs:82](../../../skills/10x-pipeline/scripts/state.mjs), [providers.test.mjs:158](../../../skills/10x-pipeline/test/providers.test.mjs)

### Key Discoveries

- Fresh isolation starts from committed HEAD and transfers the selected change folder. Policy and depth settings must be committed in the acceptance source before launch. [research.md](research.md)
- Installed `agent-smith:step` and synchronous Bash hooks supply the guard. Synthetic hook events prove classification, while a fresh host must establish native identity and enforcement. [step-guard.mjs:121](../../../skills/10x-pipeline/scripts/step-guard.mjs), [hooks.json](../../../hooks/hooks.json)
- Existing tests cover providers, isolation, local commits, result ownership and publication with local Git repositories and fake GitHub clients. They provide executable pre-publication gates. [providers.test.mjs](../../../skills/10x-pipeline/test/providers.test.mjs), [open-pr.test.mjs](../../../skills/10x-pipeline/test/open-pr.test.mjs)
- Publication can follow a halt, and final-state commit failure can leave unpublished working-copy bytes. Acceptance needs terminal verdict, review state, published SHA and residual status together. [research.md](research.md)

## Desired End State

An acceptance record names the exact candidate, installed plugin and toolkit revisions, host versions, effective configuration, launch command, invocation identities, outcomes and interventions. Local proof passes independently of live access. A fresh Claude-only 10x run completes the selected README change through planning, plan review, implementation and implementation review, and the top-level orchestrator publishes its actual completed head to a reviewable PR.

S-12 acceptance requires all Manual criteria below. Automated completion establishes readiness for that acceptance. Every attempted live run retains its outcome, including blocked and failed attempts.

## Scope Boundaries

S-12 owns first-flow discovery, installed guard evidence, locally reproducible proof and narrowly justified fixes for observed first-flow failures. The selected representative workload is documentation delivery. S-15 owns broader prerequisite diagnostics, S-16 recovery expansion, S-18 wider protection qualification, and S-20 the final 18-run matrix. The parked quoting change retains its owner-directed resumption gate. Archives and human-maintained lessons retain their existing ownership. [WAVES.md](../WAVES.md)

## Implementation Approach

Use the existing execution path and test fixtures. Persist launch decisions and a readable evidence checklist under `context/changes/first-unattended-delivery/evidence/`. Add production changes only after an observed failure identifies the responsible layer and a regression can reproduce it.

The representative change is `claude-only-10x-example` in a separate acceptance copy of this repository. Its goal is to extend README Configure with a working recipe that restores the shipped Claude ladder in an existing OpenAI-configured project, preserves unrelated override keys, explains whole-array replacement and establishes effective providers before a fresh run. This is a bounded product documentation gap grounded in the research and current README. Its success checks use the existing provider tests and local configuration assertions. The acceptance plan keeps every check of that README change locally executable, so publication of its own PR cannot become a prerequisite of its implementation.

Use a fresh headless Claude top-level launch, standard rigor, default completion, Chrome disabled and comments disabled. The operator runs the normal installed `/agent-smith:10x-pipeline` entry point. The effective ladder comes from the candidate plugin defaults, with every rung verified through `providerOf`; router policy owns model and effort selection. Retain the shipped tier layout and the documented depth-two setting. [README.md](../../../README.md), [providers.test.mjs:34](../../../skills/10x-pipeline/test/providers.test.mjs)

### Assumptions and Decisions

- High complexity is selected for host, policy, guard and publication integration. The unattended task instruction supplies evidence-backed decisions in place of the skill interview.
- A documentation change qualifies as the first plan-based delivery because S-12 specifies authorized completed work on a PR and assigns workload selection to planning. It exercises the same normal execution and review path. [roadmap.md:94](../../foundation/roadmap.md)
- Headless mode is selected because the goal is unattended delivery and README explicitly identifies its complete-flow acceptance as pending. Interactive qualification remains assigned to S-20. [README.md:97](../../../README.md), [WAVES.md](../WAVES.md)
- The review remote is the existing `origin`, `git@github.com:xycu/agent-smith.git`, with PR base `main`. Current authentication and quota are launch prerequisites whose actual observations must be retained. Source selection and remote identity were verified during planning.
- Exact runtime versions and candidate hashes are pinned from observations before each attempt. Research observed Claude Code 2.1.311, but current access and installed activation require fresh evidence. The guard prerequisite is Claude Code 2.1.295+ and Node 24+. [research.md](research.md), [README.md:30](../../../README.md)

## Critical Implementation Details

The acceptance source lives at `<run-root>/.claude/worktrees/acceptance-first-unattended-delivery/project`, with its generated run worktree beneath that project. `<run-root>` is `/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery`. A separately authorized top-level acceptance session prepares an independent clone of the committed S-12 candidate there. Retained raw transcripts and dedicated test scratch parents also live beneath this existing ignored acceptance parent. Verify exclusion with `git check-ignore` from the enclosing run root before creating acceptance files, then verify that the clone resolves its own Git top level and common directory beneath its project path. The router and terminal publication both stage the whole enclosing worktree, so this boundary keeps acceptance repositories and scratch contents out of those commits. Durable evidence summaries remain under this change's `evidence/` directory and link the retained raw files. All acceptance paths stay beneath the run root. The existing worktree and active Codex policy retain their ownership. The acceptance source uses a committed configuration setup, followed by a fresh representative change identity, and the candidate plugin revision is recorded separately from those preparation commits.

A step subagent can prepare local evidence and fixtures. Full normal-entry launch and publication belong to the separately authorized top-level orchestrator. Phase 3 is Manual because its outcome requires real host access and publication. Missing external prerequisites produce an actionable blocked record while local preparation continues. An unresolved execution lock requires the existing settlement and router-owned recovery path, retaining its enabling revision and TMPDIR.

## Phase 1: Define the Acceptance Launch

### Overview

Create a concrete launch specification and evidence convention that can be checked locally before account access or publication.

### Changes Required

#### 1. Launch specification

**File**: `context/changes/first-unattended-delivery/evidence/launch.md`

**Intent**. Record the selected workload, versions, candidate identity, configuration preparation and exact launch procedure for a fresh Claude-only run.

**Contract**. Include candidate Git SHA and plugin version, installation source and absolute installed path, toolkit skill revisions or hashes, host/Node/Git versions, effective ladder provenance, hooks/depth/trust state, acceptance project/run roots, branch and remote/base. Each field is either measured with its command/evidence anchor or explicitly pending with its prerequisite. Record the historical version floors separately from measured versions. Include one fenced JSON manifest with `candidate`, `versions`, `paths`, `invocation` and `effectivePolicy` fields. Represent unavailable observations as null with a sibling pending reason. Validate the manifest using inline Node built-in assertions for the chosen id and flags, expected remote/base, paths beneath the run root, and all-Claude providers for any observed effective ladder. Record the assertion command and exit code in the acceptance record.

The launch specification contains this normal-entry command, to be run by the acceptance top-level session from the prepared acceptance project, with the entire slash invocation passed as one argument.

```sh
claude -p '/agent-smith:10x-pipeline claude-only-10x-example "Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically." --rigor standard --chrome false --pr-comment false'
```

Commit the acceptance source policy before worktree creation. Remove only its project `ladder` override so the installed candidate defaults supply the ladder, preserving unrelated keys. The representative README recipe follows this same existing merge behavior. Preserve isolation and guard controls. Verify that every effective rung resolves to Claude and that the four toolkit skills are discoverable in a fresh child from the intended run root. Installation must resolve to the recorded candidate. Record its actual path and quoting behavior, and use the existing parked-change procedure if that path exposes the known quoting dependency.

Before the recorded pipeline launch, the authorized acceptance top-level session creates `context/changes/claude-only-10x-example/change.md` inside the independent acceptance source using `/10x-new claude-only-10x-example`. Verify that the id is unused across live and archived changes and has no saved run before creation. Retain the generated identity and record the selected README goal in its Notes, leaving planning to the normal pipeline. Record the preparation command and resulting source path in the launch manifest. Assert that `change.md` exists and has the selected identity before launch. This preparation precedes the zero-steering attempt window. Missing creation-skill discovery leaves launch pending with the installation prerequisite recorded. The normal pipeline requires this file before setup/init and provides missing-change guidance when it is absent. [SKILL.md](../../../skills/10x-pipeline/SKILL.md), [prepare-run.mjs](../../../skills/10x-pipeline/scripts/prepare-run.mjs)

#### 2. Acceptance record

**File**: `context/changes/first-unattended-delivery/evidence/acceptance.md`

**Intent**. Establish a durable record for readiness, attempts, failures and final acceptance.

**Contract**. Include a row for every phase Success Criterion, separating local evidence from native host and publication evidence. Each attempted launch has a stable attempt id, timestamp, candidate/configuration identity, command/mode, outcome, intervention count, evidence paths and missing-proof reason. Link retained transcripts using paths beneath the run root. Preserve previous attempts when appending retries. Derive expected rows with `readPlan(planPath).phaseList.flatMap((phase) => [...phase.auto, ...phase.manual])`, then compare their `id` values with the acceptance table. Reject duplicate ids on either side before set comparison, missing statuses and missing reasons for pending rows. This includes all five Automated and three Manual rows even while live proof is pending. [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs)

### Success Criteria

#### Automated Verification

- Launch specification passes inline Node assertions for the chosen change, command flags, manifest fields, provider constraints and paths, with the command and exit code retained in the acceptance record.
- Acceptance record passes an inline Node assertion matching every Progress row id to one evidenced or explicitly pending status and reason.

## Phase 2: Verify the Local Delivery Contracts

### Overview

Exercise current behavior through the real local CLI fixtures and retain reproducible evidence. Correct first-flow defects only when reproduced.

### Changes Required

#### 1. Local verification record

**File**: `context/changes/first-unattended-delivery/evidence/verification.md`

**Intent**. Retain the commands, revisions, exit codes, counts and limitations supporting readiness.

**Contract**. Run the focused and full commands below automatically with Node 24+. Place dedicated TMPDIR scratch parents beneath the ignored acceptance parent defined in Critical Implementation Details, verify their exclusion from the enclosing repository, and assign TMPDIR only for the test subprocess. Preserve production execution-lock TMPDIR. Record every skip with its reason. Publication tests use their existing fake GitHub client and local repositories. Keep live opt-in tests disabled during this gate. Test scratch beneath this Git worktree also needs a discovery boundary. Put a `.git` gitfile in the dedicated temporary parent pointing at a nonexistent child path, then assert that an uninitialized scratch project cannot discover the enclosing repository and an initialized fixture still resolves its own HEAD. Test helpers strip inherited Git controls, so a process-level ceiling alone cannot establish this boundary. Planning reproduced three executor failures with the unbounded scratch parent and observed all three pass with this test-only boundary.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/step-guard.test.mjs skills/10x-pipeline/test/open-pr.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node tools/version-check.mjs
```

Use the existing `providers.test.mjs` default/explicit-Claude and mixed-ladder cases to verify that host selection and provider selection are independent. A fixture run from an acceptance-configured scratch project must return `action: run`, `host: claude`, `provider: claude` and the guarded agent. Existing setup-to-init tests supply the isolation/committed-configuration coverage. Run these only on scratch state. Record the shipped ladder assertion alongside the actual effective acceptance configuration when the latter becomes available.

#### 2. Observed failures

**Files**: `skills/10x-pipeline/scripts/`, `skills/10x-pipeline/test/`, `skills/10x-pipeline/prompts/`, `skills/10x-pipeline/rules/`, `hooks/hooks.json`, `agents/step.md`, `docs/REFERENCE.md`

**Intent**. Repair a reproduced first-flow failure in its existing owner, with a regression that fails before the fix.

**Contract**. These paths are conditional ownership boundaries. Name the observed failure, affected callers and precise files in the evidence before editing. Reuse existing helpers and Node built-ins. Run the full repository gate for affected scripts, prompts or policy. Document behavior changes in the reference and index any new test. Shared skill-section changes serialize with parked quoting work. A change to persisted state or the public compatibility contract requires a revised migration plan before implementation.

### Success Criteria

#### Automated Verification

- Focused setup, provider, commit, skill-loop, guard and local publication tests pass with recorded exit codes and explained skips.
- The full repository test command and `node tools/version-check.mjs` pass with recorded counts and explained skips.
- Every repaired first-flow defect has a reproduced failure and passing regression, or verification explicitly records that the observed-fix set is empty.

## Phase 3: Accept the Fresh Claude Delivery

### Overview

The authorized top-level acceptance session performs the actual installed-host run and publication, then records the observed result. These criteria remain Manual through local implementation.

### Changes Required

#### 1. Native and complete-flow evidence

**Files**: `context/changes/first-unattended-delivery/evidence/launch.md`, `context/changes/first-unattended-delivery/evidence/acceptance.md`

**Intent**. Fill the prepared evidence contract with native discovery, guard delivery and complete-flow observations.

**Contract**. Pin the candidate, toolkit and effective setup before launch. Record fresh-child discovery, actual Agent schema, guarded identity, hook event identity, effective permissions and authorized Write/Edit/local commit behavior from the run root. Retain a safe guard-denial observation in a separate disposable scratch project, using `git checkout -h` in that scratch project and recording that denial occurred before execution. This help request is read-only if the hook is absent, which makes the expected guard denial safe to observe. Record scratch HEAD and status before and after the probe. Guard payload fixtures alone leave native denial pending.

Launch the selected normal pipeline once after readiness. Retain the unedited enclosing RESULT reports and invocation associations, child collection order when delegation occurs, actual routing and terminal action, plan/review/verification artifacts, elapsed duration and scoped measured usage. Count every human correction or permission intervention after launch. Partial or unknown child-inclusive usage stays explicitly scoped. An unexpected halt or intervention remains an unsuccessful attempt, with repairs followed by a fresh attempt on a newly pinned candidate.

#### 2. Publication acceptance

**File**: `context/changes/first-unattended-delivery/evidence/acceptance.md`

**Intent**. Connect the completed work and exact final Git state to the reviewable PR.

**Contract**. The top-level orchestrator alone runs normal terminal publication. Record PR URL, base/head branches, published head SHA, terminal verdict, review outcome, local HEAD, diff/status and remaining Manual evidence. Confirm the README recipe is present in the published tree and all intended code/artifact bytes are committed. Record PR CI if available. The S-12 candidate PR and representative delivery PR each retain their own identity. Archive and report-comment opt-ins remain assigned to their later qualification flows.

### Success Criteria

#### Manual Verification

- Fresh Claude discovers the pinned plugin/toolkit, delivers native guarded identity and a safe denial, and permits authorized work in the generated worktree with retained evidence.
- One fresh headless Claude-only normal-entry run completes the selected change through planning, plan review, implementation and approved implementation review with zero post-launch steering.
- The representative run has a reviewable PR whose published head contains the completed README change and final artifacts, with terminal outcome, CI state and residual worktree state recorded accurately.

## Testing Strategy

### Unit and Contract Tests

Reuse provider, skill-loop and guard tests for deterministic configuration and dispatch behavior. Extend an existing test only for a specific reproduced regression. Synthetic events and fake publication evidence retain their fixture scope.

### Integration Tests

Use the real router CLI in scratch projects for setup-to-init, step commits and provider dispatch. Existing `open-pr.test.mjs` proves local publication contracts with a bare remote and fake GitHub client. All local commands can execute before any candidate PR exists.

### Manual Testing Steps

1. The acceptance top-level session verifies the enclosing ignore boundary and independent clone identity, prepares and commits the acceptance source configuration, creates the representative `change.md` with `/10x-new`, records exact versions and verifies trust/account readiness.
2. Observe fresh-child discovery, native hook identity and safe enforcement in the prepared environment.
3. Launch the recorded installed slash command once and let the orchestrator own every transition and terminal publication.
4. Inspect completed artifacts, PR head and residual Git state, then append the attempt outcome to the acceptance record.
5. Keep unproved criteria pending and report the precise prerequisite for any blocked attempt. S-12 closes only after all its acceptance evidence is present or a separately recorded owner scope decision changes the contract.

## Performance Considerations

Capture elapsed time and available usage per attempt with retries and coordination included. This slice establishes a first-flow observation. Performance and savings claims require their separately assigned measurements.

## Migration Notes

Current readers are policy loading, router artifact parsers, orchestrator result handling and publication scripts. Current writers are the router for `run.jsonl`/`meta.json` and step commits, enclosing steps for scoped artifacts, and the top-level publication scripts for push/PR state. This plan adds Markdown evidence and a separately configured fresh acceptance run.

Expand by adding the evidence contract, verify the existing local paths, then exercise the fresh installed path. Preserve saved runs and provider/host identity. Acceptance setup clones the candidate into an independent project beneath the verified ignored acceptance parent, commits its Claude-only configuration before isolation, and creates the representative change identity before normal-entry launch. Remove only the project ladder override to reuse the plugin defaults. Its configuration applies to that fresh project. The active Codex run keeps its existing effective ladder and history.

For rollback, preserve the acceptance copy, branches, commits and failed-attempt evidence. Return to a separately pinned prior candidate in a fresh acceptance copy when an observed fix fails. Production execution recovery stays router-owned. Destructive contraction or historical state conversion requires separate authorization and a revised plan. Retry evidence is append-only by attempt identity, and rerunning local gates updates their measured verification record without manufacturing a successful live attempt.

## References

- [Upstream research](research.md)
- [Roadmap S-12](../../foundation/roadmap.md#s-12-first-unattended-plan-based-delivery)
- [Wave 3 ownership and exit](../WAVES.md)
- [Installed pipeline loop](../../../skills/10x-pipeline/SKILL.md)
- [Policy loading and Progress parser](../../../skills/10x-pipeline/scripts/state.mjs)
- [Provider contracts](../../../skills/10x-pipeline/test/providers.test.mjs)
- [Existing publication fixtures](../../../skills/10x-pipeline/test/open-pr.test.mjs)
- [Repository lessons](../../foundation/lessons.md)

## Progress

### Phase 1: Define the Acceptance Launch

#### Automated

- [x] 1.1 Launch specification passes inline Node assertions for the chosen change, command flags, manifest fields, provider constraints and paths, with the command and exit code retained in the acceptance record.
- [x] 1.2 Acceptance record passes an inline Node assertion matching every Progress row id to one evidenced or explicitly pending status and reason.

### Phase 2: Verify the Local Delivery Contracts

#### Automated

- [ ] 2.1 Focused setup, provider, commit, skill-loop, guard and local publication tests pass with recorded exit codes and explained skips.
- [ ] 2.2 The full repository test command and `node tools/version-check.mjs` pass with recorded counts and explained skips.
- [ ] 2.3 Every repaired first-flow defect has a reproduced failure and passing regression, or verification explicitly records that the observed-fix set is empty.

### Phase 3: Accept the Fresh Claude Delivery

#### Manual

- [ ] 3.1 Fresh Claude discovers the pinned plugin/toolkit, delivers native guarded identity and a safe denial, and permits authorized work in the generated worktree with retained evidence.
- [ ] 3.2 One fresh headless Claude-only normal-entry run completes the selected change through planning, plan review, implementation and approved implementation review with zero post-launch steering.
- [ ] 3.3 The representative run has a reviewable PR whose published head contains the completed README change and final artifacts, with terminal outcome, CI state and residual worktree state recorded accurately.
