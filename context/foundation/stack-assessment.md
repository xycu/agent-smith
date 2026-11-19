---
project: agent-smith
assessed_at: 2026-11-15T12:35:15+01:00
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: JavaScript ES modules on Node.js 24+
  framework: null
  build_tool: null
  test_runner: node:test with node:assert/strict
  package_manager: null
  ci_provider: GitHub Actions
  deployment_target: Claude Code and Codex plugin distribution
gates_passed: 4
gates_failed: 2
---

# Stack assessment

## Stack Components

Assessment context is PRD v2's priority of reliable unattended execution across supported hosts. Detection was confirmed by the owner on 2026-11-15. The initial inspection used revision `45a7a5087f0298536ee9d74181846a503583bb4a`. The Wave 7 reassessment used revision `cbbd64013b71225559d2fc347a56d7b4a26ba462`. The latest delivery reassessment uses revision `8a3ba5929b891aa5fac9f79c2c339b43539d44a8` and the working PRD v2. Original documentation observations are retained, with delivery-specific verification recorded below. [PRD](prd.md)

### Language and runtime

The router and supporting tools use plain JavaScript ES modules with explicit `node:` imports. Node.js 24+ is the documented floor and the CI runtime. The locally observed runtime was v24.19.0. There is no static type-checking configuration or systematic JSDoc contract typing in the inspected runtime modules. Runtime validation checks policy, dispatch, run identity and persisted input. [Runtime decision](../../docs/ADR/ADR-006-node-runtime-floor.md) · [State and validation](../../skills/10x-pipeline/scripts/state.mjs) · [CI](../../.github/workflows/ci.yml)

### Architecture and external execution

The project implements its own deterministic CLI router and two workflow skills. Either host selects Claude, Codex or a role-based split. Codex-hosted Claude uses a guarded headless runner, with authenticated host qualification pending. Git worktrees and commits provide isolation and recovery. The standalone Codex runner validates a pending action before execution. The documented runner contract is Codex CLI 0.169.0. New Claude dispatches use the guarded default step agent. Its scoped Bash hook and registration are additional integration contracts requiring fresh-host acceptance; fail-closed handling requires Claude Code 2.1.295+. The guard covers documented literal command forms, while custom agents and OpenAI children use existing host controls. Host configuration, child skill discovery, effective permissions and invocation behavior are version-sensitive integration concerns. [Router](../../skills/10x-pipeline/scripts/route.mjs) · [Runner](../../skills/10x-pipeline/scripts/run-codex.mjs) · [Host contract](../../docs/ADR/ADR-024-openai-codex-support.md)

### Build and package management

Source modules execute directly through Node. The repository deliberately has no root `package.json`, lockfile, bundler or transpilation stage. The plugin manifest supplies the recognizable project marker for this dependency-free project. The inspected immediate router, chain and tool inventory now contains 17 modules, including the standalone step guard. Imports remain built-in or relative. CI separately installs the pinned OpenSpec 1.16.1 contract CLI into temporary storage under the documented CI-tool exception. [Plugin manifest](../../.claude-plugin/plugin.json) · [Runtime decision](../../docs/ADR/ADR-006-node-runtime-floor.md) · [CI](../../.github/workflows/ci.yml)

### Testing

The test runner is `node:test`, with `node:assert/strict`. Tests exercise the real router CLI in scratch projects, including both workflow chains, policy validation, state publication, locks, rollback and external-command fixtures. Some integration tests use fake host executables. Live acceptance evidence must identify the actual host, version and execution conditions. [Test index](../../skills/10x-pipeline/test/README.md) · [Shared fixtures](../../skills/10x-pipeline/test/helpers.mjs) · [Host fixtures](../../skills/10x-pipeline/test/codex-helpers.mjs) · [Specification-chain tests](../../skills/openspec-pipeline/test/README.md)

### CI, releases and instructions

GitHub Actions runs the suite on Node 24, checks version alignment and lints commit subjects. Internal runs select self-hosted Linux runners, with a hosted-runner expression for fork pull requests. Release-please follows successful main-branch CI and publishes the plugin release. Repository instructions define module import order, decision ownership, state ownership, policy placement, coding style and verification commands. The inspected configuration includes `AGENTS.md` and `.claude/settings.json`. Dedicated formatter and source-code linter configuration was absent from the detected stack. [Contributor instructions](../../AGENTS.md) · [CI](../../.github/workflows/ci.yml) · [Release workflow](../../.github/workflows/release.yml) · [Release configuration](../../release-please-config.json) · [Host settings](../../.claude/settings.json)

### Wave 7 reassessment

Three deliveries strengthen the existing architecture and verification. The commit-lint change adds regression coverage for invalid merge-prefixed subjects while preserving the established runtime validator. The pin guard now follows referenced local actions recursively outside the workflow directory and fails on missing metadata. The skill-context change consolidates terminal procedures and assigns routing documentation to the behavior reference. [Commit regression](../../tools/test/commit-lint.test.mjs) · [Pin traversal](../../tools/workflow-pins.mjs) · [Context change review](../archive/2026-11-12-skill-md-context-diet/reviews/impl-review.md)

Direct source measurements show skill sizes falling from 47,969 to 25,867 bytes and from 36,450 to 29,230 bytes. Those are source-byte reductions of 46.08% and 19.81%. Provider usage and delivered-change savings still need live measurements. Wave 7 CI passed 1,548 of 1,551 tests, with three expected skips. A fresh local selection covering the changed contracts passed 179 of 181 tests, with two live-GitHub skips. [Current CI](https://github.com/xycu/agent-smith/actions/runs/43659138438)

### Latest delivery reassessment

Step safety now has shared immutable rules, a default guarded Claude step agent, a synchronous literal-command Bash classifier and independent hook provenance. Planning and review carriers assign publication-dependent checks to Manual acceptance. The classifier is deliberately bounded, and its fresh-host identity/blocking checks and live planning adherence remain pending. Existing neutral retries retain their stored prompt and agent identity. [Safety contract](../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance) · [Hook](../../hooks/hooks.json) · [Classifier](../../skills/10x-pipeline/scripts/step-guard.mjs) · [Safety review](../archive/2026-11-13-step-subagent-git-guard/reviews/impl-review.md)

Consumed-result cleanup now follows the latest persisted completion across both chains and both handoff transports. Crash and unlink-failure fixtures verify that later steps require their own result, cleanup failures retain recoverable state and late usage preserves later pending input. These automated improvements support the reliability milestone. [Recovery implementation](../../skills/10x-pipeline/scripts/flow.mjs) · [Recovery review](../archive/2026-11-13-stale-last-result-cleanup/reviews/impl-review.md)

The latest source passed 150 focused local tests with zero failures or skips. Current-revision CI passed 1,621 of 1,624 tests, with three expected skips, and version alignment passed at 1.11.2. Archived TrueNAS and release-gate acceptance now supplies operational proof for those infrastructure paths. Live fork execution remains unobserved, and the agreed 18 normal product runs plus recovery/owner-decision checks still require evidence. [Current CI](https://github.com/xycu/agent-smith/actions/runs/43708971476) · [Runner acceptance](../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) · [Release acceptance](../archive/2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md)

## Quality Gate Assessment

Scores describe the components actually present. Framework and build-tool criteria are inapplicable because the project executes a custom CLI directly. The custom integration receives its own row so its conventions and familiarity risks remain visible.

| Component | Typed | Convention | Ecosystem familiarity | Documented | Verdict |
| --- | --- | --- | --- | --- | --- |
| JavaScript language | Fail | N/A | N/A | N/A | Compensation required |
| Application framework | N/A | N/A | N/A | N/A | Absent by design |
| Build tool | N/A | N/A | N/A | N/A | Direct execution |
| Node test runner | N/A | N/A | Pass | Pass | Ready |
| Custom CLI and host integration | N/A | Pass with note | Fail | Pass with note | Compensation required |

Four of six applicable checks are satisfied, including two passes supported by repository-specific guidance. Two checks fail. Inapplicable cells are excluded from the count.

Ecosystem familiarity is a qualitative proxy for the skill's training-data criterion. Actual model training-corpus coverage is unavailable. The assessment uses standard-library adoption and the project's bespoke execution contracts as evidence for expected agent familiarity.

### Gate Details

**Static typing fails.** The runtime is JavaScript without configured static checking. Function boundaries and serialized object shapes are inferred from implementation, validators and tests. `policyProblems`, `readLog`, `hostProblem` and action validation provide runtime safeguards. They support safe execution while the static contract gap remains. [State module](../../skills/10x-pipeline/scripts/state.mjs) · [Action validation](../../skills/10x-pipeline/scripts/run-codex.mjs)

**Conventions pass with repository guidance.** The custom CLI relies on explicit local conventions for module layering, routing decisions, policy overrides, state writes and standalone-script entry points. Those conventions are documented in the contributor instructions and supported by focused contract tests. An agent needs that context before extending the integration. [Contributor instructions](../../AGENTS.md) · [Behavior reference](../../docs/REFERENCE.md) · [Test index](../../skills/10x-pipeline/test/README.md)

**Test-runner familiarity passes.** The suite uses Node's own test and assertion APIs, familiar within the JavaScript/Node ecosystem. Its fixtures and CLI entry points are indexed locally. This score concerns recognizable API patterns. Version-specific CI and focused local results are recorded in the delivery reassessments. [Test fixtures](../../skills/10x-pipeline/test/helpers.mjs) · [Official Node test documentation](https://nodejs.org/docs/latest-v24.x/api/test.html) · [Official assertion documentation](https://nodejs.org/docs/latest-v24.x/api/assert.html)

**Custom integration familiarity fails.** Per-rung provider dispatch, fixed run hosts, invocation identity, late usage, neutral replay and router-owned lifecycle files are project-specific contracts. Generic agent-framework patterns provide limited guidance for these interactions. The compensation is a short execution-path map backed by existing examples and fixtures. [Host contract](../../docs/ADR/ADR-024-openai-codex-support.md) · [Behavior reference](../../docs/REFERENCE.md) · [Host integration tests](../../skills/10x-pipeline/test/host-integration.test.mjs)

**Test documentation passes.** Official Node 24 test and assertion pages were retrieved successfully during this assessment. They identified the current v24 documentation set as v24.22.3. The repository's test indexes explain its fixture conventions and supported commands. API changes still need compatibility with the supported runtime floor. [Test index](../../skills/10x-pipeline/test/README.md) · [Node test documentation](https://nodejs.org/docs/latest-v24.x/api/test.html) · [Node assertion documentation](https://nodejs.org/docs/latest-v24.x/api/assert.html)

**Integration documentation passes with a version caveat.** The README, behavior reference and ADRs document the current execution contracts, including the verified runner version and pending live acceptance. Official ESM, worktree, workflow and host-skill pages were reachable. The previous Codex CLI-reference URL currently redirects to a developer-commands page. Rolling host documentation needs reconciliation with the exact runner version and live evidence when changing execution behavior. [Behavior reference](../../docs/REFERENCE.md) · [Host contract](../../docs/ADR/ADR-024-openai-codex-support.md) · [Node ESM documentation](https://nodejs.org/docs/latest-v24.x/api/esm.html) · [Git worktree documentation](https://git-scm.com/docs/git-worktree) · [Actions documentation](https://docs.github.com/en/actions) · [Host skill documentation](https://code.claude.com/docs/en/skills) · [CLI reference destination](https://learn.chatgpt.com/docs/developer-commands?surface=cli)

## Gaps & Compensation

### Implicit serialized contracts

Policy, actions, results and saved-run entries cross process or persistence boundaries. Without static checking, changing one producer can leave a consumer or historical fixture inconsistent. For a changed contract, document the ambiguous boundary shape with focused JSDoc, trace its producer and consumers, and retain the existing runtime validator. Reuse current validation functions and compatibility fixtures. These measures fit the existing plain-JavaScript architecture and built-in-only dependency policy. [Validation](../../skills/10x-pipeline/scripts/state.mjs) · [Dispatch capability checks](../../skills/10x-pipeline/scripts/flow.mjs) · [Policy tests](../../skills/10x-pipeline/test/policy-validate.test.mjs) · [Provider compatibility tests](../../skills/10x-pipeline/test/providers.test.mjs)

### Bespoke execution lifecycle

An agent needs to trace policy selection through dispatch, execution, normalized result intake, advancement and resume. The host/provider ADR and reference document that path. Shared fixtures cover the process boundary and both chains. Keep these as the first examples for integration changes, and record the actual environment and version for live acceptance. This compensation also addresses the rolling-documentation caveat. [Host contract](../../docs/ADR/ADR-024-openai-codex-support.md) · [Runner](../../skills/10x-pipeline/scripts/run-codex.mjs) · [Runner fixtures](../../skills/10x-pipeline/test/codex-helpers.mjs) · [Both-chain execution tests](../../skills/10x-pipeline/test/codex-chain.test.mjs)

### Recommended Instruction File Additions

The following two rules are ready to append under the existing coding guidance. `AGENTS.md` currently occupies 11,942 bytes against its 12,288-byte limit. Appending this block with one separating newline produces 12,211 bytes. Keep fuller examples in the existing reference and test indexes. [Instruction size check](../../tools/test/agents-md-size.test.mjs)

```markdown
- For changed JSON contracts, use focused JSDoc at boundaries and retain runtime validation.
- For host/provider changes, trace dispatch, execution, RESULT intake and resume using docs/REFERENCE.md, docs/ADR/ADR-024-openai-codex-support.md and existing host fixtures.
```

## Summary

Overall readiness is **ready-with-compensation**. Direct Node execution, built-in testing, documented module ownership and extensive CLI fixtures make the stack approachable. The remaining agent-facing friction comes from implicit object contracts and custom host lifecycle behavior. Focused boundary documentation and the existing integration examples provide a small compensation path.

PRD v2's reliability goal still requires live evidence for the agreed host/chain matrix, clean installation, fresh-context discovery, effective permissions, completion, interruption/resume and owner-required halts. Stack suitability alone leaves those acceptance claims unverified. [PRD](prd.md) · [Current acceptance limits](../../docs/ADR/ADR-024-openai-codex-support.md)

The initial assessment used source/configuration inspection, a static import inventory, local runtime identification, official-document retrieval and document checks. The delivery reassessments add focused local tests, workflow/version/pin checks and successful full CI through the current revision. Infrastructure acceptance has additional live proof. Product-host execution and new hook delivery remain unverified.

Next command is `/10x-health-check`.
