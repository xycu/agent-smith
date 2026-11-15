---
project: agent-smith
checked_at: 2026-11-15T12:35:15+01:00
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 0
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

# Project health check

This assessment uses PRD v2's priority of reliable unattended execution and current repository revision `8a3ba5929b891aa5fac9f79c2c339b43539d44a8`. The original local full suite and dependency snapshots were collected against revision `45a7a5087f0298536ee9d74181846a503583bb4a`. The Wave 7 reassessment and latest safety/recovery reassessment add version-specific source review, focused local tests and CI evidence. The latest refresh also incorporates the archived runner/release acceptance records. The existing plugin manifest and executable Node modules identify the dependency-free JavaScript project. Findings concern the current project and its execution environment. The audit counts above retain the original dependency-snapshot and direct-package advisory results described below. Operational findings appear separately in the recommendations. [PRD](prd.md) · [Stack assessment](stack-assessment.md) · [Plugin manifest](../../.claude-plugin/plugin.json)

## Dependency Health

### Lockfile

The runtime has no package-manager dependency tree. The immediate router, chain and tool inventory now contains 17 modules, including the standalone guard, with built-in or relative imports. The repository deliberately carries no root package manifest or lockfile. Package-manager lockfile checks are inapplicable to that runtime.

CI separately installs the approved OpenSpec 1.16.1 contract CLI in temporary storage, pins its direct version and checks the selected binary. That installation resolves its transitive dependencies at execution time. The local OpenSpec executable reports 2.0.0. [Runtime policy](../../docs/ADR/ADR-006-node-runtime-floor.md) · [CI installation](../../.github/workflows/ci.yml)

### Security Audit

Two scratch-only package-manager snapshots were resolved for `@fission-ai/openspec` versions 1.16.1 and 2.0.0. Resolution used `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, with package manifests, lockfiles, npm cache and user configuration under temporary storage. Each snapshot contained 57 resolved dependency entries. `npm audit --json --package-lock-only --ignore-scripts` exited 0 for each, reporting zero critical, high, moderate or low vulnerabilities. Neither snapshot installed dependency code or ran install scripts.

OSV direct-version queries for both releases also returned zero advisories. No direct or transitive advisory was reported in the resolved snapshots. The snapshots describe fresh local-platform resolution at check time. Existing installed trees, different-platform/future resolutions, runtime/toolchain vulnerabilities and full host environments remain outside that evidence. [OSV query service](https://google.github.io/osv.dev/post-v1-query/)

A root package-manager audit and `npm outdated --json` were inapplicable because its package-manager manifest and lockfile are intentionally absent. Dependency advisory checks instead used the isolated external-tool snapshots above.

The original redacted credential-pattern scan examined 141 tracked source, prompt, agent-definition, workflow/configuration and root-instruction files. A fresh scan including shipped hooks examined 149 current tracked files with zero matches. It checked common access-token and private-key-header patterns and found zero matches. Gitleaks was unavailable. Pattern coverage is limited and repository history was outside this scan.

Workflow security checks confirmed full-SHA action pins, scoped workflow permissions, environment-based pull-request-title intake and the test job's non-root guard. The current fork-workflow approval setting reads `all_external_contributors`. A sampled successful CI run passed its non-root guard on a self-hosted runner. These live readings supersede the older operational observations recorded in the runner ADR for this assessment. [CI](../../.github/workflows/ci.yml) · [Title workflow](../../.github/workflows/pr-title.yml) · [Release workflow](../../.github/workflows/release.yml) · [Runner decision](../../docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md) · [Sampled run](https://github.com/xycu/agent-smith/actions/runs/43653495147)

The Wave 7 pin-guard delivery expands this control to recursively referenced local action metadata outside the workflow directory. Missing, unreadable, malformed and escaping targets fail the guard. The new coverage includes cycles, repeated targets and transitive references. The fresh guard check passed on the current tree. [Pin guard](../../tools/workflow-pins.mjs) · [Regression tests](../../tools/test/workflow-pins.test.mjs)

### Outdated Dependencies

One direct external-tool major-version gap was observed. CI selects OpenSpec 1.16.1, while the installed CLI and registry's current latest release are 2.0.0. The owner has selected 2.0.0 as the target of a future separate upgrade change. The contract suite selects the executable through `OPENSPEC_BIN`, or uses the local executable by default. Results below identify the version exercised. [Pinned installation](../../.github/workflows/ci.yml) · [Contract fixtures](../../skills/openspec-pipeline/test/openspec-contract.test.mjs) · [Package registry](https://www.npmjs.com/package/@fission-ai/openspec)

The locally observed runtime is Node v24.19.0, within the documented Node 24+ floor. Git reports 2.54.0, GitHub CLI 2.104.0 and actionlint 1.7.12. Host version probes reported Claude Code 2.1.311 and Codex CLI 0.169.0. The Codex version command exited 0 and emitted `WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)`. Actual execution acceptance remains open. Broader toolchain staleness and advisory coverage remain open.

## Test Suite

The detected runner is `node:test` with `node:assert/strict`. Test commands and fixture ownership are documented in the contributor guide and test indexes. The original full local execution used Node v24.19.0 and OpenSpec 2.0.0, and fresh version probes confirmed the same local versions during this reassessment. `GH_LIVE=0` selected the suite's offline GitHub fixtures. [Commands](../../AGENTS.md) · [Test index](../../skills/10x-pipeline/test/README.md) · [Specification-chain tests](../../skills/openspec-pipeline/test/README.md)

```sh
GH_LIVE=0 OPENSPEC_TELEMETRY=0 DO_NOT_TRACK=1 node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

At the original source revision, the command exited 0 after 921.52 seconds, covering 73 test files. The runner reported 1,523 tests across 13 suites, with 1,520 passed, zero failed, zero cancelled and three skipped. All five real OpenSpec CLI contract fixtures passed against local version 2.0.0.

The three skips were the two opt-in live GitHub tests and the optional `CLAUDE.md` import check because that file is absent. All remaining reported tests executed. The successful original local run establishes that source revision's behavior in the inspected test environment. Host-model execution acceptance remains a separate open item.

The retained temporary test log has SHA-256 `04fa875668a523318d68ea34c158863ac13b1423a6315f82c22d3256d77b77f1`.

The original additional checks passed.

- Syntax checks across all 95 `.mjs` files under `skills/` and `tools/`.
- `node tools/version-check.mjs`, reporting aligned version 1.11.0.
- The existing `tools/workflow-pins.mjs` checker, reporting zero pin errors.
- `actionlint` against all three workflow files.

The original revision also passed CI and its release workflow. [Original CI](https://github.com/xycu/agent-smith/actions/runs/43645509170) · [Original release workflow](https://github.com/xycu/agent-smith/actions/runs/43646033162)

### Wave 7 verification

Wave 7 Linux CI completed successfully with 1,551 tests across 13 suites. It reported 1,548 passed, zero failed, zero cancelled, three skipped and 339,082.119354 ms duration. The workflow still installs the pinned OpenSpec 1.16.1 contract CLI. Version alignment passed at 1.11.1. [Current CI](https://github.com/xycu/agent-smith/actions/runs/43659138438)

Fresh local verification covered commit-lint, workflow-pins, instruction size, both skill contracts, agent dispatch, archive gating and PR-comment behavior. The selected eight test files reported 181 tests, 179 passed, zero failed and two opt-in live-GitHub skips in 20.215 seconds.

```sh
GH_LIVE=0 node --test --test-concurrency=2 --test-reporter=tap tools/test/commit-lint.test.mjs tools/test/workflow-pins.test.mjs tools/test/agents-md-size.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs
```

Current-tree version alignment, action-pin checking and actionlint also passed. The commit-lint delivery adds a regression against a merge-prefixed invalid subject to the established validator. The context-reduction delivery preserves shared procedure ownership, invocation matching, strict comment opt-in, archive sequencing and the fixed anti-stall contract through expanded tests. These results strengthen automated assurance. Live-provider and end-to-end unattended acceptance remain open. [Commit regression](../../tools/test/commit-lint.test.mjs) · [Skill change review](../archive/2026-11-12-skill-md-context-diet/reviews/impl-review.md)

### Latest safety, recovery and infrastructure verification

The current revision passed Linux CI with 1,624 tests across 13 suites, reporting 1,621 passed, zero failures or cancellations, three expected skips and 336,162.931079 ms duration. Version alignment passed at 1.11.2. [Current CI](https://github.com/xycu/agent-smith/actions/runs/43708971476)

Fresh local tests covered the literal-command guard, shared safety carriers, persisted-result recovery, agent/provider dispatch, provenance and neutral replay. All 150 tests passed with zero skips in 31.528 seconds. Syntax checks passed across all 98 source/test modules, and actionlint, current-tree action-pin checks and version alignment passed.

```sh
GH_LIVE=0 node --test --test-concurrency=2 --test-reporter=tap skills/10x-pipeline/test/step-guard.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/neutral.test.mjs
```

The default guarded Claude agent and hook add tested runtime checks for documented direct unsafe Git/deletion/publication commands. The guard requires enabled hooks, supported identity fields and Claude Code 2.1.295+ for fail-closed handling. Dynamic programs, custom agents and OpenAI children retain their existing semantic and host-control boundaries. Live host-mediated identity/deny transcripts and planning-rule adherence remain pending. Hook provenance changes are recorded independently, while historical neutral retries retain their stored prompt and agent. [Safety reference](../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance) · [Safety review](../archive/2026-11-13-step-subagent-git-guard/reviews/impl-review.md)

Persisted-result recovery now removes surviving consumed input before later dispatch or Git work, on both chains and transports. Non-absence unlink errors halt for recovery. Crash, isolated rollback, handoff cleanup and late-usage tests verify ownership boundaries. This supplies direct automated evidence for the recovery requirement. [Recovery review](../archive/2026-11-13-stale-last-result-cleanup/reviews/impl-review.md)

Archived acceptance confirms six online labelled TrueNAS runners, owner-confirmed operation, passing same-repository PR/main CI, the non-root guard and the required external-contributor approval setting. No fork PR was available among 177 records, so live fork execution was recorded as inapplicable to that evidence set. Eight runner-selection expression checks passed. Release acceptance includes failed main CI producing a skipped release, successful rerun triggering release, and a skipped release preserving a queued valid release. These are infrastructure acceptance outcomes. The agreed 18 normal unattended product runs and recovery/owner-decision cases still require their own evidence. [Runner acceptance](../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) · [Release acceptance](../archive/2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md)

## CI/CD

GitHub Actions defines test/version, commit-subject, pull-request-title and release workflows. Internal test jobs use the documented self-hosted Linux runners, and fork pull requests select hosted runners through the workflow expression. External-contributor approval is separately configured and was verified through the read-only settings API. [CI](../../.github/workflows/ci.yml) · [Title checks](../../.github/workflows/pr-title.yml) · [Release](../../.github/workflows/release.yml)

| Stage | Status | Evidence |
| --- | --- | --- |
| Source lint and format | Partial | Commit/title lint and specialized contract guards exist. Merge-prefixed invalid subjects have explicit regression coverage. Dedicated source-code lint and format enforcement is absent. |
| Tests | Present | Built-in Node runner exercises both chains and tools. CI installs and selects OpenSpec 1.16.1. |
| Build | Inapplicable | Source executes directly through Node. Version and packaging fields have dedicated checks. |
| Type checking | Absent | JavaScript contracts rely on runtime validation and tests. |
| Security automation | Partial | Recursive action-pin checks, root refusal, workflow guards and the scoped literal-command hook exist. Live hook delivery and recurring vulnerability/credential automation remain open. |
| Release | Present | Release-please follows successful push CI. Archived live acceptance verifies failure/skip/rerun and queued-release behavior. |

The absence of security workflow files does not establish the state of separately configured platform security features. Those settings were outside the API reads in this check.

## Configuration

### High severity

No high-severity configuration gap was identified within the inspected scope. The repository has a tracked `.gitignore`, working test entry points and established contributor instructions. [Exclusions](../../.gitignore) · [Instructions](../../AGENTS.md)

### Medium severity

- Dedicated source formatter/linter configuration is absent. Existing style rules and contract guards provide partial compensation. A built-in syntax check already passed locally and can be considered for CI alongside the existing guards.
- Static type checking is absent. The stack assessment's two proposed boundary-contract and host-integration instruction rules are absent from `AGENTS.md`. Existing runtime validators and lifecycle guidance mitigate the gap.
- The inspected automation lacks a recurring dependency-advisory check for the external contract CLI and a dedicated credential scanner. This limits the security evidence available to future agents.

These are addressable development and assurance gaps. Concrete actions appear below. [Stack compensation](stack-assessment.md) · [Contributor rules](../../AGENTS.md) · [CI](../../.github/workflows/ci.yml)

### Low severity

- `.editorconfig` is absent. The contributor guide already specifies two-space indentation and other style conventions.
- An environment template is absent. This project uses host configuration and existing authentication, and its README documents relevant environment controls. A dotenv template has no demonstrated need in the inspected runtime. [Setup and configuration](../../README.md)

## Stack Assessment Cross-Reference

The companion assessment classified the stack as ready with compensation. Its findings remain applicable. [Stack assessment](stack-assessment.md)

| Stack concern | Health-check evidence | Assessment |
| --- | --- | --- |
| Implicit JavaScript object contracts | Static checking is absent from CI. Runtime validation, syntax checks and contract fixtures exist. | Compensation remains relevant. |
| Custom host/provider lifecycle | Guarded default dispatch, hook provenance and persisted-result cleanup have focused tests and passing CI. Fresh-host guard delivery and agreed product acceptance remain pending. | Recovery and safety evidence are strengthened. |
| Proposed instruction additions | Neither of the two recommended rules is present in `AGENTS.md`. | Review and adoption remain open. |
| Rolling external documentation | Local OpenSpec major version differs from CI's contract pin. | Record exact versions for reproducible evidence. |

## Recommended Fixes

This is a project assessment outside an established course schedule. The ranked list uses project impact and the selected reliability goal.

### 1. Establish real-host unattended acceptance

The PRD and host ADR record outstanding acceptance for installation, fresh execution-context discovery, permissions, completion and recovery. New hook delivery and planning-rule adherence also need live evidence. Runner/release infrastructure acceptance is documented as resolved. Agents still need proof of the complete product workflow in the supported environment.

Severity is medium. Effort is significant, over one hour.

Use the agreed six combinations and 18 normal runs, with both launch modes represented within each combination's three runs. Certify exact tested versions while retaining documented prerequisite floors. Cover default execution, archive and requested report comments across applicable configurations. Include fresh plugin loading, guarded-agent/hook identity and deny checks on the applicable host, planning-rule adherence, clean setup, interruption/resume, owner-decision halts and truthful manual verification. Respect the hook-specific minimum version, preserve failed attempts and record exact environments and outcomes. [PRD](prd.md) · [Host acceptance limits](../../docs/ADR/ADR-024-openai-codex-support.md)

### 2. Retain external-tool advisory coverage

The scratch snapshot audits pass, while the inspected CI configuration has no recurring advisory check for its resolved external-tool tree. Future dependency resolution can differ from this assessment's snapshot.

Severity is medium. Effort is moderate, 15–30 minutes.

Retain a scratch-only dependency snapshot for the CI-selected OpenSpec version and run `npm audit --json --package-lock-only --ignore-scripts` there. Decide how to repeat that check and credential scanning within the existing workflow tooling, retaining resolved versions, advisory results and coverage. Keep runtime dependency policy intact. [CI tool installation](../../.github/workflows/ci.yml) · [Runtime dependency policy](../../docs/ADR/ADR-006-node-runtime-floor.md)

### 3. Review the existing instruction compensation

The two scoped instruction additions proposed by stack assessment are absent. They help agents trace serialized contracts and host lifecycle behavior in this plain-JavaScript codebase.

Severity is medium. Effort is quick, under five minutes.

Review and adopt the two ready-to-paste rules in the companion assessment. The current instruction file uses 11,942 bytes. Both proposed rules fit within its 12,288-byte limit, producing 12,211 bytes with the documented separating newline. [Proposed rules](stack-assessment.md) · [Instruction size guard](../../tools/test/agents-md-size.test.mjs)

### 4. Align external CLI compatibility evidence

Local tests use OpenSpec 2.0.0 while CI pins 1.16.1. Evidence must identify which version supplied the observed behavior.

Severity is low. Effort is moderate, 15–30 minutes.

Prepare the separately scoped `openspec-2-upgrade` change selected by the owner. Review the 2.0.0 major-version changes, CI pin, related assertions, generated integration instructions and active documentation, then verify all five real contract fixtures. Retain version-specific evidence through that upgrade. For a baseline rerun, set `OPENSPEC_BIN` to the approved existing executable and run `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs`. [Contract test](../../skills/openspec-pipeline/test/openspec-contract.test.mjs) · [CI pin](../../.github/workflows/ci.yml)

### 5. Decide source-check enforcement within the existing stack

Code-style conventions are documented, while dedicated source lint and format automation is absent. Agents currently rely on review and the suite for those aspects of consistency.

Severity is medium. Effort is moderate, 15–30 minutes.

Consider adding the already verified built-in syntax check to CI, and define which additional style checks justify a dependency-free guard in the existing tooling. Follow the repository's documented two-space, double-quote and semicolon conventions.

```sh
rg --files skills tools -g '*.mjs' -0 | xargs -0 -n 1 node --check
```

This command checks syntax. Formatting policy still requires a separate enforcement decision. [Coding style](../../AGENTS.md) · [Existing guards](../../tools/workflow-pins.mjs)

### 6. Add lightweight editor defaults

Editor settings can reduce whitespace drift while the repository retains its documented source style.

Severity is low. Effort is quick, under five minutes.

Add a reviewed `.editorconfig` with UTF-8, LF endings, final newline, trimmed trailing whitespace and two-space indentation for JavaScript, JSON and workflow YAML. Confirm any Markdown trailing-space convention before applying trimming to Markdown. [Existing coding style](../../AGENTS.md)

## Summary

Overall health is **needs-attention**. The project has a functioning built-in test setup, extensive contract coverage, passing workflow/version/pin checks and successful CI for the inspected committed revision. The reviewed deliveries strengthen action-pin traversal, orchestration contracts, default step safety and crash recovery. Archived infrastructure acceptance now verifies the runner/release paths with its stated fork-execution limit. Addressable gaps concern live-host acceptance, recurring external-tool security coverage, unapplied instruction compensation and development configuration.

The original local full suite passed with 1,520 tests passed and three documented skips. Wave 7 CI passed 1,548 tests with three skips and its focused local selection passed 179 tests with two skips. Latest-revision CI passed 1,621 tests with three skips, and the fresh safety/recovery selection passed all 150 tests. Both original dependency snapshots reported zero vulnerabilities. Six follow-ups are ranked above, comprising two quick items, three moderate items and one significant acceptance effort.

The two fresh dependency-snapshot audits and direct advisory queries found zero critical or high findings. Existing installed trees, runtime/toolchain vulnerabilities and complete host environments remain outside the audited scope. Next, review the ranked findings and carry the selected reliability work into roadmap planning.
