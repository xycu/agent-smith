# OpenSpec 2.0.0 Upgrade Implementation Plan

## Overview

Deliver Wave 2 / roadmap S-13 from accepted Wave 1 revision `58ce4ea8`. Make the OpenSpec workflow, committed project integration, setup guidance and CI contracts work with exactly OpenSpec `2.0.0`. Preserve project inputs and saved execution contracts, and revalidate the OpenSpec portion of Wave 0's child-delegation contract.

The change remains the sole Wave 2 implementation. The enclosing orchestrator owns the final reviewable PR and requested run-report comment. [Wave schedule](../../changes/WAVES.md) [Roadmap S-13](../../foundation/roadmap.md#s-13-complete-the-specification-based-workflow-on-openspec-200)

## Current State Analysis

The planning HEAD is `55d711d23d84fd880b3d55c9d83948ae55519f0e`, containing the run start and score commits above the accepted baseline. Local OpenSpec is already `2.0.0`. CI installs `1.16.1`, and executable workflow tests hard-code that version in install assertions, fake binaries and availability stubs. The real contract probe currently accepts any successful version response. [CI](../../../.github/workflows/ci.yml:47) [CI tests](../../../tools/test/ci-runner.test.mjs:47) [CLI contracts](../../../skills/openspec-pipeline/test/openspec-contract.test.mjs:16)

The repository tracks twelve generated 1.16.1 Claude skill copies and twelve legacy `/opsx:*` command files. OpenSpec 2.0.0 generates canonical `.agents/skills/` files with Claude links. Its `core` profile omits `verify`, so setup must explicitly retain that workflow. The project has custom schema/context/rules in `openspec/config.yaml`. [Project config](../../../openspec/config.yaml) [Upstream upgrade guide](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md)

The router reads artifacts directly. Proposal, delta specs and tasks determine apply readiness, with design optional. Task counting, verification counts, fix routing, pre-archive checks, state publication and isolation already have owners and tests. A historical archived OpenSpec run predates host metadata. Current fixtures additionally cover flat/delegated, inline/file pending dispatches and exact replay after settings drift. [OpenSpec reader](../../../skills/openspec-pipeline/scripts/openspec.mjs:53) [Saved dispatch tests](../../../skills/10x-pipeline/test/prompt-handoff.test.mjs:480)

Planning executed all five existing real apply fixtures successfully against 2.0.0. An isolated fresh installation generated the required three skills and valid Claude links. Valid validation, JSON archive, spec merge and extra-folder preservation passed. A target collision returned structured errors with an optional `fix` field. Full-suite, real legacy-update and upgraded live-host proof remain implementation work. [Research and executable probes](research.md)

## Desired End State

CI selects and verifies exactly `@fission-ai/openspec@2.0.0`. Local contract tests distinguish an unavailable executable from a successful wrong-version response and enforce the actual compatibility target. Real CLI fixtures cover apply readiness, setup/update, validation and archive.

The repository's generated integration uses the 2.0.0 shared-skill layout and preserves the existing twelve-workflow selection. Installation and upgrade instructions explain explicit `verify` selection, fresh-host discovery, Git tracking and preservation of custom inputs. OpenSpec policy and runtime semantics follow the proven existing contracts.

The final evidence identifies candidate revision, exact tools, commands, skips, attempts and unresolved host proof. Local gates establish saved-run, ownership, delegation, archive and publication behavior. Manual criteria retain the live-host and external-publication obligations.

### Key Discoveries

- OpenSpec 2.0.0 tag `d12c2817776779e06891d68230773b3bb673b106` retains Node `>=22.12.0`. This project continues using Node 24+. [Registry](https://registry.npmjs.org/@fission-ai/openspec/2.0.0)
- The task pattern and the named skill interfaces used by pipeline prompts remain compatible. The five real status fixtures passed with zero skips. [Research](research.md) [Upstream task parser](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/utils/task-progress.ts#L55)
- A default core installation lacks `openspec-verify-change`. Custom profiles can retain existing workflows while supplying propose/apply/verify. [Profiles](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/core/profiles.ts#L14)
- Canonical generated-skill edits can be overwritten by upstream update. Customized legacy tool copies and commands can be retained by update and need deliberate reconciliation. [Upgrade preservation behavior](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md#skills-you-customized)
- The archive CLI retains `--yes --json`, success fields and error codes. `fix` can be absent, so the error-reporting prompt must describe that optionality accurately. [Archive prompt](../../../skills/openspec-pipeline/prompts/os-archive.md:13) [Upstream diagnostic schema](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/core/archive.ts#L195)
- Wave 0's final-candidate native matrix remains pending. Existing bounded smoke and deterministic ownership/recovery tests supply reusable evidence with explicit scope. [Wave 0 acceptance](../../changes/nested-step-delegation/evidence/acceptance.md)

## Scope and Delivery Assumptions

1. The unattended invocation authorizes evidence-backed planning decisions in place of an interview. Complexity is medium because setup/layout, CI contracts and retained execution semantics interact. Three implementation phases follow those ownership boundaries. [S-13 scope](../../foundation/roadmap.md#s-13-complete-the-specification-based-workflow-on-openspec-200)
2. Existing project inputs include schema/context/rules, change metadata, artifacts, completed task rows, project overrides and the currently installed workflow set. Preserve all twelve existing repository workflows during migration. A separate clean-install fixture may select only the pipeline's three requirements. [Current config](../../../openspec/config.yaml) [Research inventory](research.md)
3. Evidence supports preserving the current state schema, policy, router decisions, invocation ownership and archive command. A newly demonstrated compatibility failure must be fixed in its existing owner with a regression. A required incompatible state-contract change needs an explicit owner decision. [PRD constraints](../../foundation/prd.md#constraints--compatibility)
4. S-12 owns the first complete plan-based delivery. S-15 through S-19 own their scheduled reliability slices. S-20 owns the final 18-run qualification. This change records fresh OpenSpec compatibility and delegation evidence and carries unresolved live cells forward explicitly. [Wave schedule](../../changes/WAVES.md)
5. Tool versions observed during planning are Node `v24.19.0`, npm `11.17.0`, Git `2.54.0 (Apple Git-157)`, OpenSpec `2.0.0`, Codex CLI `0.169.0` and Claude Code `2.1.311`. Implementation records its actual versions again. Version inspection supplies a prerequisite observation, while live support requires the corresponding run evidence. [Research](research.md)

## Implementation Approach

Pin and test the exact executable first. Then migrate generated project integration using upstream 2.0.0 output, reconcile customized material and update the affected prerequisite/discovery guidance. Clarify the archive error prompt for optional diagnostics. Finally run the shared compatibility/delegation gates and record honest local and native evidence.

Use existing Node built-ins, fixture helpers, `removeTree`, router behavior and fake Git/GitHub clients. The existing CI-only OpenSpec installation exception supplies the pinned tool. Runtime changes require a reproducible compatibility mismatch in the responsible module. [Repository guidelines](../../../AGENTS.md)

## Critical Implementation Details

### Preserved execution and generated instructions

Updating generated toolkit files can change newly rendered prompts and provenance hashes. Pending inline prompts and prompt-file handoffs retain their original bytes through neutral replay, and their owner identity remains fixed. Complete or safely settle active descendants before touching generated inputs used by an executing invocation. Existing execution locks and router recovery own that boundary.

### Safe migration preparation

Inventory generated files and compare local copies with upstream 1.16.1 before replacing them. Preserve differing material in Git and reconcile meaningful project instructions into the existing project context/rules or a separately named user skill. Generate and exercise 2.0.0 output in isolated fixtures with scratch-local HOME/XDG configuration and update checks disabled. Upstream update can affect user-global configuration and Codex prompts, so repository migration must constrain all such writes to the run worktree.

### Local gates and publication

Prepare an ignored worktree-local TMPDIR and a verified scratch Git discovery boundary as in Wave 0. Fixtures must remain inside this worktree and must never discover the enclosing run repository accidentally. A test cleanup uses `removeTree`. Local fake Git/GitHub tests establish publication contracts before publication. The enclosing orchestrator performs actual push, PR and comment actions after the step completes.

## Phase 1: Pin the CLI and expand executable contracts

### Overview

Select exactly OpenSpec 2.0.0 and establish executable coverage for its exposed integration contracts before changing committed project integration.

### Changes Required

#### 1. CI pin and executable workflow fixtures

**Files** — `.github/workflows/ci.yml`, `tools/test/ci-runner.test.mjs`.

**Intent** — Upgrade the install pin and exact-version assertion together with every affected success, wrong-version and availability stub. Preserve fresh runner-temp isolation, selected-binary export, failure propagation and the current expected-skip policy.

**Contract** — CI installs `@fission-ai/openspec@2.0.0` using its existing no-save/no-lockfile tool exception. An ambient executable cannot replace the selected binary. Missing Git, failed installation, failed version probing and mismatched versions fail CI before publication of `OPENSPEC_BIN`.

#### 2. Real OpenSpec contracts

**Files** — `skills/openspec-pipeline/test/openspec-contract.test.mjs`, `skills/openspec-pipeline/test/openspec-helpers.mjs`, `skills/openspec-pipeline/test/README.md`.

**Intent** — Retain the five original named fixtures and add focused real setup/update, validation and archive checks. Assert CLI subprocess success before interpreting successful JSON. Require the selected executable to report exactly 2.0.0. Extend existing helper ownership only where shared fixture behavior requires it.

**Contract** — An unavailable CLI retains local skip behavior and fails nonempty CI. A successfully started incompatible or malformed version response fails locally and in CI. Probe meta-tests target the five original status-fixture names independently of added integration tests, preserving their fake-tool isolation and per-identity assertions.

The real-CLI fixtures must prove the following cases.

- All five existing readiness/task-count cases continue matching `instructions apply`, including missing design and every existing list/marker form.
- A clean custom profile with `propose,apply,verify` generates 2.0.0 `.agents/skills/` files and working project-relative Claude links. The default core profile's missing verify workflow is an explicit setup case.
- A representative legacy 1.16.1 project retaining all twelve workflows upgrades in isolated configuration. Dry-run is read-only, configuration/change input bytes survive, customized legacy inputs are retained or explicitly reconciled, and a repeated update is idempotent.
- Valid artifacts pass `validate --json`. A malformed delta reports validation errors. Dedicated valid specimens include scenarios, since the generic minimal helper specimens are intentionally insufficient for real validation.
- `archive <id> --yes --json` returns the expected archive object, merges specs, preserves the extra `agent-smith/` directory and uses the existing date/path convention. Validation failure and target collision expose structured errors and preserve the pre-command inputs. Diagnostics may omit `fix`.

#### 3. Contract documentation

**Files** — `docs/REFERENCE.md`, `docs/ADR/ADR-013-openspec-pipeline.md`, `skills/openspec-pipeline/scripts/openspec.mjs` parser provenance comment.

**Intent** — Record the verified 2.0.0 CLI/parser provenance and expanded executable fixture scope. Keep the task parser expression consistent with the proven upstream expression. Add a dated amendment to ADR-013 D2 superseding its 1.16.1 CI pin and defining exact-version probe outcomes, while retaining its historical observations.

**Contract** — The OpenSpec reference and ADR-013 amendment agree on the selected 2.0.0 executable, local skips for unavailable or failed probes, failure in nonempty CI for those probes, and failure everywhere for successful incompatible or malformed version responses. The reference records task/readiness compatibility. Search active documentation for the superseded pin and probe behavior, reconcile normative instructions, and retain dated evidence with its original tested version.

### Success Criteria

#### Automated Verification

- The exact-version CI/probe tests pass, including unavailable, failed, wrong-version and selected-binary cases, using `node --test tools/test/ci-runner.test.mjs`.
- All five original status contracts and the added setup/update/validation/archive fixtures execute against exactly 2.0.0 with zero skips using `CI=1 node --test skills/openspec-pipeline/test/openspec-contract.test.mjs` with an explicitly selected `OPENSPEC_BIN`.
- The full repository gate passes after the CI, fixture and parser-provenance changes, recording actual counts and skip identities.

## Phase 2: Upgrade generated integration and setup instructions

### Overview

Make the committed project integration and user instructions agree with the proven 2.0.0 installation and discovery behavior.

### Changes Required

#### 1. Generated project integration

**Files** — existing `.claude/skills/openspec-*/SKILL.md`, existing `.claude/commands/opsx/*.md`, new `.agents/skills/openspec-*/SKILL.md`, corresponding `.claude/skills/openspec-*` links.

**Intent** — Adopt upstream 2.0.0 shared skills while preserving the repository's installed workflow set and meaningful customizations. Review the dry-run and generated diff before replacing tracked files. Remove superseded generated command files and old copies individually after checking the inventory, then remove empty directories deepest first.

**Contract** — Preserve workflow IDs `propose,explore,new,continue,apply,update,ff,sync,archive,bulk-archive,verify,onboard`, MIT notices and project configuration. Canonical skills report `generatedBy: "2.0.0"`, Claude links resolve inside the project, and fresh worktree checkouts contain their tracked targets. Repeated update produces an empty integration diff. Project config, main specs, change artifacts, overrides and real run state retain their existing contents.

#### 2. Installation and discovery guidance

**Files** — `README.md`, `docs/REFERENCE.md` OpenSpec setup sections, `skills/openspec-pipeline/SKILL.md` Start prerequisite/discovery and missing-change guidance, affected assertions in `skills/openspec-pipeline/test/openspec-skill.test.mjs`.

**Intent** — Explain exact-version installation, explicit custom-profile inclusion of verify, tool selection, shared skills, committed Claude links and fresh-child discovery from run worktrees. Replace active `/opsx:*` setup suggestions with the corresponding named skill or CLI command. Make missing verify guidance point to workflow selection and update.

**Contract** — Setup preserves additional user-selected workflows and existing global configuration through deliberate profile selection. Document that `config` profile commands are global and that scripted tests isolate HOME/XDG paths. Existing-project instructions preview update and preserve customizations in Git first. Skills carry neither literal routing models/efforts nor new routing decisions. The existing Anti-stall section and result/usage/publication procedures retain their tested contract.

#### 3. Accurate archive diagnostics

**Files** — `skills/openspec-pipeline/prompts/os-archive.md`, related prompt assertions in `skills/openspec-pipeline/test/openspec-archive.test.mjs` or the existing prompt-contract test owner, `docs/REFERENCE.md` where needed.

**Intent** — Have the archive child quote `code` and `message`, plus `fix` when supplied, matching observed 2.0.0 diagnostics.

**Contract** — Preserve the single archive command, validation, one-attempt failure behavior, scoped archive commit, staged-path guard, warning reporting and blocked result semantics. Propose/apply/verify policy and numbered prompt instructions continue using their compatible upstream interfaces.

### Success Criteria

#### Automated Verification

- The integration fixture proves the twelve-workflow migration, tracked shared-skill targets, valid in-project Claude links, input preservation and idempotence, and the prerequisite/prompt tests pass using `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs`.
- The full repository gate passes after generated-file, prerequisite and prompt changes, and the final integration diff matches the preserved workflow inventory.

## Phase 3: Revalidate saved runs, delegation and terminal handoff

### Overview

Verify compatibility through existing normal entry points and shared execution boundaries, then retain exact evidence and a publication-ready handoff.

### Changes Required

#### 1. Compatibility and delegation evidence

**Files** — `context/changes/openspec-2-upgrade/evidence/verification.md`, `context/changes/openspec-2-upgrade/evidence/acceptance.md`. Extend the existing relevant test files only for a demonstrated coverage gap.

**Intent** — Record final candidate revision, selected executable, tool versions, focused/full commands, counts, skips and every attempted native check. Reuse existing saved dispatch, result persistence, usage, runner, lock and recovery coverage.

**Contract** — Preserve exact old/current pending prompts and handoffs, fixed host identity, isolation branches/start commits, archived legacy metadata and provenance drift diagnostics. A descendant, foreign, late or superseded result cannot finish the enclosing step. Await children and native settlement before result intake, rollback, relaunch or publication. Preserve staged and working versions independently after collected child failure. Keep verified inclusive usage counted once and unknown coverage explicit.

Use these existing focused test owners.

- `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `result-persist.test.mjs` and `late-usage.test.mjs` for saved execution, persisted results and usage ownership.
- `skills/10x-pipeline/test/codex-runner.test.mjs`, `codex-chain.test.mjs`, `run-lock.test.mjs` and `nested-subagents.test.mjs` for awaited collection, native metadata settlement, cancellation, foreign events, crash exclusion and recovery.
- `skills/openspec-pipeline/test/*.test.mjs` for chain selection, legacy inputs, verification, fix loops, isolation, archive and read-only archive verification.

#### 2. Local terminal and publication proof

**Files** — existing `skills/10x-pipeline/test/open-pr.test.mjs`, `pr-comment.test.mjs`, `skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, evidence files above.

**Intent** — Execute deterministic fake-client checks for the existing default and archived terminal paths before external publication.

**Contract** — The normal terminal action retains publication/comment intent, the validated run branch and correct live/archived report location. Only the orchestrator publishes or comments. Suspended native execution continues excluding both actions. No step writes router-owned live metadata or results to satisfy a test.

#### 3. Native proof and orchestrator handoff

**Files** — evidence files above and the plan's canonical Progress.

**Intent** — Revalidate upgraded OpenSpec discovery and child delegation through normal pipeline entry points in trusted acceptance projects. Hand the enclosing orchestrator completed local work and exact pending Manual rows for publication.

**Contract** — Record the OpenSpec-specific Wave 0 cells for Claude-only, mixed Claude/OpenAI and OpenAI-only ladders in interactive and headless launches. Each attempted cell records versions, configuration, launch identity, discovered 2.0.0 skills, child identity/nonce, collection before enclosing RESULT, exactly one router advance, failure/interruption/late-result behavior, effective restrictions and available usage scope. Unavailable or incomplete cells remain pending with their concrete prerequisite. Model-free fixtures retain their local evidence classification. S-20 keeps the final combined-candidate qualification obligation.

### Success Criteria

#### Automated Verification

- Focused saved-dispatch, result/usage, child-settlement, lock/recovery and fake publication tests pass through their normal existing entry points, including the OpenSpec cases.
- The final full repository gate passes on the candidate with all real 2.0.0 CLI contracts executed, exact counts and skip identities recorded, and a clean whitespace/version check.
- The verification and acceptance records identify candidate/tool versions, executable commands, failed attempts and unresolved host coverage, with every completed Automated Progress row backed by local evidence.

#### Manual Verification

- Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded.
- The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof.

## Testing Strategy

### Executable local gates

Run commands from the absolute run root. Prepare an ignored local scratch directory and its verified Git discovery boundary, then export its absolute path as TMPDIR for all fixture commands. Resolve `OPENSPEC_BIN` to the selected 2.0.0 executable, verify its output, and set `OPENSPEC_TELEMETRY=0`, `DO_NOT_TRACK=1` and `OPENSPEC_NO_UPDATE_CHECK=1`. Fixtures that invoke config/init/update additionally provide scratch-local HOME and XDG config/data/cache paths.

The required full repository gate is the following command with those prepared environment values.

```sh
cd "/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade" && node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Run the final document/version checks from the same root.

```sh
cd "/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade" && git diff --check && node tools/version-check.mjs
```

Record expected skip identities according to the actual platform and tool availability. Run contract fixtures with nonempty CI to enforce selected-tool availability. Preserve the two opt-in live GitHub test skips unless the authorized controller separately runs them. Every new test file receives its folder README row.

### Native verification procedure

Use a bounded disposable acceptance change with a valid spec and task. Start through `/agent-smith:openspec-pipeline` with upgraded installed skills. Have the step collect a read-only child nonce before its own result, retain parent/child identity and settlement evidence, and observe one router advance. Exercise a collected child failure and interruption/resume without losing independently staged/working work. Check late/foreign completion exclusion, the verify verdict and default versus optional archive behavior. Retain raw evidence or stable sanitized references per attempt. Record missing account/quota/trust/discovery prerequisites exactly, retaining affected rows as pending.

The step has no publication authority. External PR, CI and report-comment acceptance occurs in the enclosing orchestrator's terminal handling and remains Manual here.

## Performance Considerations

The router continues its file-derived execution path. Capture elapsed time and usage only at their observed scope. Retain child/retry overhead and omit inferred inclusive token totals. Product-wide performance and savings qualification follow their existing roadmap ownership.

## Migration Notes

**Readers and writers** — OpenSpec 2.0.0 owns generated toolkit output and CLI archive operations. The project owns its config/artifacts. The router owns metadata/results/recovery, and verify owns its verdict file. Host-native discovery reads the shared skills and Claude links.

**Forward path** — Expand executable contracts and pin the CLI, preserve and reconcile legacy instruction inputs, migrate generated layout, verify repeat update and fresh worktree discovery, then run saved-execution/delegation gates. Preserve the existing state shape throughout. New dispatches may render updated instruction text while saved pending dispatches replay their exact captured bytes.

**Compatibility window** — Historical flat dispatches, delegated pending inline/file dispatches and archived legacy host-unspecified metadata remain readable under the existing contracts. The exact 2.0.0 target applies to new compatibility certification. Never regenerate an in-flight saved prompt to make its instruction references look current. An active or unsettled execution remains suspended under its current ownership lock.

**Rollback path** — Settle executing descendants first. Preserve the upgrade in an ordinary commit, then revert the migration commit on the run branch and select the earlier pinned CLI in an isolated tool location. Retain project changes, archived outcomes, accepted results and all recovery refs. Directory-to-link reversals use Git-backed contents and inspected file-by-file operations. Router-owned recovery remains the authority for interrupted executions. A completed archive retains its completed outcome and evidence.

**Partial failure** — A failed layout migration retains its diff and preserved source material for reconciliation. A failed CLI archive follows the existing blocked outcome and reports its actual JSON diagnostics. Retry idempotence is proved for setup/update, while archive retains its single-attempt workflow. Unknown descendant settlement holds the existing lock and excludes result intake and terminal publication.

## References

- [Planning research and executable probes](research.md)
- [Wave 2 scope and acceptance anchors](../../changes/WAVES.md)
- [Roadmap S-13](../../foundation/roadmap.md#s-13-complete-the-specification-based-workflow-on-openspec-200)
- [PRD compatibility obligations](../../foundation/prd.md#constraints--compatibility)
- [Wave 0 acceptance](../../changes/nested-step-delegation/evidence/acceptance.md)
- [Wave 0 native observations](../../changes/nested-step-delegation/evidence/capabilities.md)
- [OpenSpec 2.0.0 upgrade guide](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md)
- [OpenSpec release comparison](https://github.com/Fission-AI/OpenSpec/compare/v1.16.1...v2.0.0)

## Progress

### Phase 1: Pin the CLI and expand executable contracts

#### Automated

- [x] 1.1 The exact-version CI/probe tests pass, including unavailable, failed, wrong-version and selected-binary cases, using `node --test tools/test/ci-runner.test.mjs`. — bef2a2e1
- [x] 1.2 All five original status contracts and the added setup/update/validation/archive fixtures execute against exactly 2.0.0 with zero skips using `CI=1 node --test skills/openspec-pipeline/test/openspec-contract.test.mjs` with an explicitly selected `OPENSPEC_BIN`. — bef2a2e1
- [x] 1.3 The full repository gate passes after the CI, fixture and parser-provenance changes, recording actual counts and skip identities. — bef2a2e1

### Phase 2: Upgrade generated integration and setup instructions

#### Automated

- [x] 2.1 The integration fixture proves the twelve-workflow migration, tracked shared-skill targets, valid in-project Claude links, input preservation and idempotence, and the prerequisite/prompt tests pass using `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs`. — c7c9436d
- [x] 2.2 The full repository gate passes after generated-file, prerequisite and prompt changes, and the final integration diff matches the preserved workflow inventory. — c7c9436d

### Phase 3: Revalidate saved runs, delegation and terminal handoff

#### Automated

- [x] 3.1 Focused saved-dispatch, result/usage, child-settlement, lock/recovery and fake publication tests pass through their normal existing entry points, including the OpenSpec cases. — 7057cd07
- [x] 3.2 The final full repository gate passes on the candidate with all real 2.0.0 CLI contracts executed, exact counts and skip identities recorded, and a clean whitespace/version check. — 7057cd07
- [x] 3.3 The verification and acceptance records identify candidate/tool versions, executable commands, failed attempts and unresolved host coverage, with every completed Automated Progress row backed by local evidence. — 7057cd07

#### Manual

- [ ] 3.4 Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded.
- [x] 3.5 The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof. — cb67ce4e
