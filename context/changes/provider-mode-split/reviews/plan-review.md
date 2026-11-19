<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Provider Mode Implementation Plan

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 3 critical, 5 warnings, 1 observation

The verdict and counts describe the original plan. All nine findings were applied. The original Progress rows match their phase criteria, with local fake-client checks in Automated and live publication checks in Manual.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Checked 18 of 18 named existing paths and traced `hostProblem`, `policyProblems`, `dispatchTarget`, `tierFor`, `archiveDescriptor`, `validateAction`, `isGuarded`, `acquireRunLock`, `verifyManual` and `normalizeAccounting` in source. The brief matched the original scope and phases. The headless runner and its fixture are planned additions. A read-only verification agent checked dispatch and retry callers, the guard and settlement boundary, and both skill entrypoints. Evidence for live headless CLI behavior comes from the recorded probes. Final-candidate qualification is Manual. [Frame](../frame.md) · [Delegation probe](../../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md#claude-headless)

## Findings

### F1 — The headless guard needs an exact-session startup gate

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes, with a wide execution and permission boundary
- **Dimension**: Blind Spots
- **Location**: Phase 2, Runner dispatch and permissions
- **Detail**: The native guard requires `agent_id`, including on its separate oversized-input path. The plugin manifest for hooks registers only Bash pre-tool checks. A main session selected with `--agent` can therefore pass through the existing classifier, and a successful separate probe leaves the task session's binding and allowed descendants unproved. [Guard classifier](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L495) · [Oversized input path](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L685) · [Hook manifest](../../../../hooks/hooks.json#L2) · [Restricted scorer](../../../../agents/score.md)
- **Fix**: Require a matching startup handshake from the actual session before task access. Wire the hook manifest and both identity paths. Require evidence of allowed foreground leaves and effective restricted-agent tools. A single session ties startup proof to execution, at the cost of testing the exact supported CLI protocol. Confidence is high in the required boundary. The final CLI signals and tool limits still need live qualification.
- **Decision**: APPLIED in Phase 2, Runner dispatch and permissions.

### F2 — The archive descriptor leaves the prompt and agent unverified

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — a shared descriptor changes both archive paths and their validators
- **Dimension**: Blind Spots
- **Location**: Phase 1, State, dispatch and visibility, and Phase 2, Runner dispatch and permissions
- **Detail**: The current validator accepts a non-empty archive prompt and checks provider, model, effort, profile and path. The router renders the archive prompt and selects its agent separately after the pre-archive commit. The original exact-action requirement still allowed this partial descriptor to control a commit-capable execution. [Runner validator](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L75) · [Archive descriptor](../../../../skills/10x-pipeline/scripts/isolation.mjs#L810) · [Archive action](../../../../skills/10x-pipeline/scripts/isolation.mjs#L929)
- **Fix**: Derive the agent and rendered prompt in the shared read-only descriptor before committing. Compare both fields under each runner's lock and test a changed prompt or agent. This keeps one source of truth. It makes rules or configuration drift a reason to request a fresh action. Confidence is high because the router already has all rendering inputs.
- **Decision**: APPLIED in Phase 1, State, dispatch and visibility, and Phase 2, Runner dispatch and permissions.

### F3 — Retained ownership can be bypassed at recovery and publication

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes, with a shared ownership and recovery contract
- **Dimension**: Blind Spots
- **Location**: Phase 2, Result, ownership and usage, and Phase 3, Orchestrator loops and acceptance evidence
- **Detail**: The preceding reader treats the presence of `native` as a durable latch. A new headless-only marker can fall through to stale cleanup once the group disappears. The direct publication scripts can commit, push, open a PR or post a report without taking the run lock. A skill-level stop alone leaves those supported mutation entrypoints outside the boundary. [Run lock](../../../../skills/10x-pipeline/scripts/state.mjs#L1095) · [PR publication](../../../../skills/10x-pipeline/scripts/open-pr.mjs#L448) · [Comment publication](../../../../skills/10x-pipeline/scripts/pr-comment.mjs#L154)
- **Fix**: Retain the existing latch and add typed Claude identity. Share the run lock with the terminal publication scripts and cover retained and active ownership with local fake clients, including moved reports. This protects the same decision across readers and scripts. Publication holds the lock longer while its terminal operations finish. Confidence is high for the preceding reader and standalone paths. Older releases still require the documented downgrade precautions.
- **Decision**: APPLIED in Phase 2, Result, ownership and usage, and Phase 3, Orchestrator loops and acceptance evidence.

### F4 — Ladder validation needs the selected role and a separate replay path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — validation order affects state mutation and replay compatibility
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, Policy and mode resolution and Router fixtures
- **Detail**: The current validator checks every step against one merged ladder before reading locked run state. Applying it independently to each provider would reject bounds for steps owned by the other provider or chain. Exact replay already uses the pending entry, and the repair floor carries the previous code tier as an ordinal. [Policy validation](../../../../skills/10x-pipeline/scripts/state.mjs#L193) · [Router validation order](../../../../skills/10x-pipeline/scripts/route.mjs#L982) · [Exact replay](../../../../skills/10x-pipeline/scripts/flow.mjs#L453) · [Repair floor source](../../../../skills/10x-pipeline/scripts/flow.mjs#L894)
- **Fix**: Validate effective bounds against the selected chain and role before state mutation. Keep replay and late usage independent of current effective rung lookup and preserve the numeric repair floor and existing same-step retry semantics. This scopes diagnostics to the provider that can run the step, with separate test cases for live dispatch and saved attempts. Confidence is high based on the existing tier-index contract.
- **Decision**: APPLIED in Phase 1, Policy and mode resolution, State, dispatch and visibility, and Router fixtures.

### F5 — Browser evidence enforcement uses the provider as a proxy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — a saved capability and a focused fixture cover the new transport
- **Dimension**: End-State Alignment
- **Location**: Phase 1, State, dispatch and visibility, and Phase 3, Orchestrator loops and acceptance evidence
- **Detail**: The dispatcher chooses a browser fallback by checking for OpenAI, and the verifier rejects browser-prefixed evidence only for OpenAI. Headless Claude carries provider `claude`. Changing the prompt alone can leave a browser claim acceptable to the router even when the transport has no supported browser. [Template selection](../../../../skills/10x-pipeline/scripts/route.mjs#L196) · [Evidence verification](../../../../skills/10x-pipeline/scripts/steps.mjs#L416)
- **Fix**: Record the effective capability on new manual-verification dispatches and use it for both prompt choice and evidence intake. Keep the explicit Chrome-off reason and legacy behavior. Test rejection, local proof and pending reasons.
- **Decision**: APPLIED in Phase 1, State, dispatch and visibility, and Router fixtures.

### F6 — Normal entry needs to check the skill in its executing transport

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — prerequisites span both host entrypoints and the routed executors
- **Dimension**: End-State Alignment
- **Location**: Phase 2, Runner dispatch and permissions, and Phase 3, Orchestrator loops and acceptance evidence
- **Detail**: Both skill entrypoints check the parent catalog before init. The effective step skill is saved on the entry, and TDD/E2E templates can substitute their own prerequisite. A successful check in the parent can therefore coexist with a missing child skill, or stop a run whose executing child already has the skill. Both entrypoints parse flags before preparing isolation. [10x entrypoint](../../../../skills/10x-pipeline/SKILL.md#L32) · [OpenSpec entrypoint](../../../../skills/openspec-pipeline/SKILL.md#L34) · [Saved skill](../../../../skills/10x-pipeline/scripts/route.mjs#L217) · [Executor overrides](../../../../skills/10x-pipeline/policy.json#L332)
- **Fix**: Parse both flag forms before worktree preparation and check prerequisites in the executing transport against the saved skill and template. Resolve the runner from the loaded skill location. This preserves host-owned prerequisites and adds the child checks needed for split mode. Confidence is high in the routing and entrypoint evidence. The real host catalog still requires qualification.
- **Decision**: APPLIED in Phase 2, Runner dispatch and permissions, and Phase 3, Orchestrator loops and acceptance evidence.

### F7 — Unavailable tokens need a structured accounting record

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the existing accounting helper owns the representation
- **Dimension**: Blind Spots
- **Location**: Phase 2, Result, ownership and usage
- **Detail**: A bounded explanation alone leaves accounting absent and lets supplied counters fall through as legacy numbers. A Claude headless session UUID also lacks the `agentId` and `runId` required for native identity. [Usage normalization](../../../../skills/10x-pipeline/scripts/usage.mjs#L33) · [Result intake](../../../../skills/10x-pipeline/scripts/flow.mjs#L641)
- **Fix**: Replace child-authored usage with measured elapsed duration and structured unavailable evidence from the shared helper. Exercise the router projections with a result carrying its own token claim.
- **Decision**: APPLIED in Phase 2, Result, ownership and usage.

### F8 — The full implementation gate is deferred past earlier code changes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the required command and prerequisites already exist
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy, Integration Tests
- **Detail**: The original plan defers the full test command until Phase 3, while repository rules require it for router, policy and prompt changes in earlier phases. The suite's OpenSpec contract tests also need the exact local CLI, and missing it can lead to local skips. [Repository test rule](../../../../AGENTS.md#L14) · [OpenSpec fixtures](../../../../skills/openspec-pipeline/test/README.md#L12) · [Suite prerequisites](../../../../.github/workflows/ci.yml#L44)
- **Fix**: Keep focused commands for diagnosis and run the full suite before closing each code-changing phase, with Git, OpenSpec CLI 2.0.0 and documented skip checks. Leave live GitHub tests disabled.
- **Decision**: APPLIED in Testing Strategy, Integration Tests, and the plan brief prerequisites and success criteria.

### F9 — Manual qualification needs an explicit handoff

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the existing Manual entries already have the correct classification
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Manual Verification
- **Detail**: At eligible rigor, the in-run manual verifier treats every pending Manual row as in scope before implementation review. Fresh-host qualification needs an authorized top-level session, and the publication row is only provable after the orchestrator publishes. [Manual verification scheduler](../../../../skills/10x-pipeline/scripts/steps.mjs#L281) · [Publication ownership](../../../../skills/10x-pipeline/rules/top.md#L11)
- **Fix**: Keep both rows pending during unattended verification. Specify all six host/mode combinations per chain for an authorized live qualification pass, retain the archive gate and keep publication evidence after terminal publication.
- **Decision**: APPLIED in Phase 3, Manual Verification, and the plan brief success criteria.
