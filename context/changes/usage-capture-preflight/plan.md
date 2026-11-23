# Usage Capture Preflight Implementation Plan

## Overview

Tell the operator at `init`, before the first dispatch, when an assigned execution path lacks the prerequisites for verified token totals. In the final run report and its PR comment, explain missing figures from the evidence actually recorded for settled steps. This addresses issue #232 in both pipeline chains.

## Current State Analysis

Issue #232 observed an older Claude path without hook or OTLP capture. The owner subsequently chose an opt-in launcher. It creates private hook and OTLP JSONL files before agent work starts, and ordinary Claude sessions return `capture-disabled` when the native collector receives no explicit sources. The launcher accepts Claude Code at or above its reviewed floor. The collector also accepts independently authorized, invocation-specific descriptors after dispatch. [Change notes](change.md) · [Wave decision](../WAVES.md#decision-track) · [Capture setup](../../../docs/REFERENCE.md#accounting-activation-and-rollback)

`init` already emits advisory diagnostics after route selection and isolation checks. Both skills show that stderr before dispatch. Reports already give the reason per step, but lack an explanation near the coverage headline. [Router init](../../../skills/10x-pipeline/scripts/route.mjs#L1109) · [10x skill](../../../skills/10x-pipeline/SKILL.md#L52) · [OpenSpec skill](../../../skills/openspec-pipeline/SKILL.md#L58) · [Report renderer](../../../skills/10x-pipeline/scripts/flow.mjs#L109)

## Desired End State

On each eligible init, an operator sees at most one usage-preflight warning containing actionable guidance for each affected assigned path. A fresh ordinary Claude run warns that the default session has no token capture configured and points to the supported launcher. With a valid private launcher binding and two readable capture files, init proceeds quietly. On either host, routed OpenAI work uses a bounded CLI version check up front and verifies invocation rollouts after execution. Headless Claude on a Codex host reports its duration-only coverage.

Terminal reports and their PR comments show a concise reason for affected settled steps near the report header, including on mixed runs. When a step has no decisive evidence about configuration, the report describes only the observed limitation.

### Key Discoveries

- Launcher activation proves local prerequisites. Empty new files are expected. Event pairing, request reconciliation and transcript provenance are decided by the collector after invocation. [Launcher](../../../skills/10x-pipeline/scripts/claude-capture.mjs#L149) · [Binding and file checks](../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L41) · [Claude collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs#L76)
- OpenAI steps use a fresh `codex exec` on both hosts. Only the resulting thread and app-server metadata identify its rollouts. A clean Codex home may have no rollout yet. [Runner launch](../../../skills/10x-pipeline/scripts/run-codex.mjs#L263) · [Thread metadata](../../../skills/10x-pipeline/scripts/run-codex.mjs#L125) · [Codex collector](../../../skills/10x-pipeline/scripts/codex-usage.mjs#L46)
- The cross-provider Claude runner uses a separate guarded headless session and currently emits duration with unavailable usage evidence. [Runner settlement](../../../skills/10x-pipeline/scripts/run-claude.mjs#L363)
- The PR comment takes the report's Markdown through the existing marker, mention neutralization and length cap. Putting the summary before the step table also surfaces it in the existing PR body excerpt. [PR comment](../../../skills/10x-pipeline/scripts/pr-comment.mjs#L109) · [PR body](../../../skills/10x-pipeline/scripts/open-pr.mjs#L394)

## Scope

The plan covers initialization diagnostics, the shared run report, and the supported setup documentation. The issue marks strict enforcement as optional. The existing advisory model and opt-in owner decision support a warning-only release. The launcher already provides copy-paste setup with the collector's provenance contract. Continue to use it for interactive native Claude.

## Implementation Approach

Add a shared init advisory alongside the existing permission advisory. For ordinary init, use the distinct providers assigned by the chain's role map, including the possible providers in a legacy ladder. For a pending neutral replay, use the saved provider for that dispatch. Evaluate each selected host/provider transport once. Keep startup observations in stderr. Derive the report summary from normalized executed-step evidence so it follows the ledger after resume and verified late usage.

### Planning Assumptions

- Medium complexity. The change spans one shared startup path and one shared renderer, with three capture paths and two chains to verify. Group work in two phases so startup and reporting can each be verified through their existing entry points. [Router](../../../skills/10x-pipeline/scripts/route.mjs#L1109) · [Renderer](../../../skills/10x-pipeline/scripts/flow.mjs#L109)
- Apply the warning to startup for the effective selection, on fresh init and resume. Recheck current capture state on each invocation. This follows permissions preflight and accounts for users relaunching Claude with capture after an earlier warning. Explicit Claude source descriptors remain supported at collection time. The startup diagnostic describes the default session only. [Permission advisory](../../../skills/10x-pipeline/scripts/init-permissions.mjs#L143) · [Explicit sources](../../../docs/REFERENCE.md#observed-token-accounting)
- Treat Codex CLI version as a prerequisite. A known mismatch means unsupported capture. A missing, failed, timed-out or unrecognized version probe means readiness could not be checked. A matching version is enough for quiet startup, with invocation evidence still authoritative. [Codex collector](../../../skills/10x-pipeline/scripts/codex-usage.mjs#L57) · [Bounded model-free precedent](../../../skills/10x-pipeline/scripts/init-permissions.mjs#L32)
- Describe persisted `capture-disabled` as disabled native capture and qualify `missing-source` as unavailable source evidence. The latter also covers source loss and cannot prove configuration. Summarize headless coverage using the saved run host and normalized evidence. [Evidence reasons](../../../skills/10x-pipeline/scripts/usage.mjs#L8) · [Headless settlement](../../../skills/10x-pipeline/scripts/run-claude.mjs#L363)
- Treat review findings F1 and F2 as Phase 1 regression checks. The review records both fixes in `18adca92`. Use that implementation and its fixtures as the starting point for rows 1.3 and 1.4. [Implementation review](reviews/impl-review.md)

## Phase 1: Warn before step dispatch

### Overview

Surface a single advisory using the router's existing stdout/stderr contract. The remaining Phase 1 work is the test follow-up for rows 1.3 and 1.4. The checked criteria retain their existing implementation and regression commands.

### Changes Required

#### 1. Shared init advisory

**Files** `skills/10x-pipeline/scripts/route.mjs`, a focused init usage advisory module beside `init-permissions.mjs`, and `skills/10x-pipeline/scripts/codex-startup.mjs` if needed for startup probe reuse.

**Intent** Show capture prerequisites at the point the effective selection is known. The skill loops already forward init stderr.

**Contract** Run after existing selection and isolation guards in `init`. Use `providersByStep` for ordinary init. When `neutralReplay` exists, use only its saved provider because that init either replays the saved dispatch or halts. Keep the permission advisory's existing provider selection. Emit one bounded stderr warning with a clause per affected path, using fixed guidance and the capture setup reference. Preserve the stdout action, exit status and dispatch, even if stderr is closed. Warnings must omit raw paths supplied by the environment, binding fields, command output and record contents. Run the checks only for assigned transports. Keep the Codex probe model-free and use the same PATH executable, working directory and scrubbed child environment as the runner. Use the collector's version constant, closed stdin, capped output and a short timeout in line with the current permission probe. Accept a single successful `codex-cli <version>` stdout line with a recognizable semantic version and compare the parsed version exactly to the pin. Treat unexpected output or probe failure as indeterminate. Keep the skills' per-action CLI checks independent of this advisory.

#### 2. Native Claude launcher prerequisites

**Files** `skills/10x-pipeline/scripts/claude-capture-data.mjs` for the launcher source probe.

**Intent** Detect unavailable launcher capture without waiting for a step or interpreting any usage records.

**Contract** Use the native capture environment and guarded headless exclusion. Check the supported private binding with the existing age and failure-marker rules, plus both canonical, readable regular files within existing size limits. Reuse `readCaptureBinding` and `captureStat` for launcher validation. Use nonblocking, no-follow opens and recheck canonical path, opened device and inode, regular-file type, owner, private mode, single link and size cap. Allow concurrent append growth within the cap. Close probes immediately without reading payloads. Empty JSONL files qualify. Preserve the writer, checkpoint and collector contracts. For absent capture, point to a fresh launcher session. For unusable bound capture, guide the operator to recover using the documented launcher. For routed headless Claude on Codex, state that this execution path offers duration and lacks verified token totals. Start the interactive launcher in a fresh Claude session. From that session, start a new Claude-hosted run or resume an existing one with its saved host and provider mode.

#### 3. Startup regression tests

**Files** `skills/10x-pipeline/test/init-usage.test.mjs` (new), `skills/10x-pipeline/test/init-permissions.test.mjs` where it pins stderr and Codex argv, and `skills/10x-pipeline/test/README.md`.

**Intent** Run real router init in scratch worktrees with controlled capture inputs and a local fake Codex executable.

**Contract** Cover both chains, all three transports, split and legacy selection plus saved neutral replay. Include a neutral replay whose saved provider differs from the current selection, and assert that only the saved transport receives the usage check. Include fresh and resumed init, empty valid capture files, absent binding and invalid binding, age or failure marker, missing native or telemetry file, unreadable or unsafe source and resource cap. Prefer deterministic inaccessible-file simulation where privileged test users could read a permission-denied fixture. For Codex cover the pinned version in a fresh home, mismatch, unrecognized successful output, nonzero exit, timeout and output cap. Assert version probe count, cwd and credential scrub, and that no accounting process starts. Extend the permission test's fake CLI to recognize and log `--version` separately while retaining exact `sandbox` argv assertions. Verify one combined warning, independent permission diagnostics and exactly one JSON stdout action. Check that unrelated transports produce no warning text and raw fixture paths or probe output stay private.

#### 4. Verify the two startup regressions from implementation review

**Files** `skills/10x-pipeline/test/provenance.test.mjs` for the added assertions and `skills/10x-pipeline/test/init-usage.test.mjs` for the existing failure-marker regression.

**F1 — Optional capture module at router startup.** The native Claude init advisory dynamically imports `claude-capture-data.mjs`, catches load failures and returns a warning before dispatch. The launcher, capture hook and collector depend on the module during capture. Use the existing provenance fixture and a fresh scratch project for each variant. Explicitly select the Claude host and Claude provider mode. For the missing module and a directory in its place, assert zero exit, exactly one JSON `run` action on stdout, one usage warning on stderr with the native capture-check failure and setup guidance, and a null `provenance.sections.hookFiles`. The hash is null because those two inputs cannot be read as regular files. Keep the generic null-hash checks for the other hook inputs. [Advisory](../../../skills/10x-pipeline/scripts/init-usage.mjs#L35) · [Init call](../../../skills/10x-pipeline/scripts/route.mjs#L1134) · [Hook hash](../../../skills/10x-pipeline/scripts/isolation.mjs#L84) · [Provenance fixture](../../../skills/10x-pipeline/test/provenance.test.mjs#L539)

**F2 — Launcher failure during the probe.** After opening both sources, `claudeCaptureReadiness` calls `assertCaptureAvailable(root, binding)` with the binding it initially validated. Run the existing preload fixture that creates the failure marker when the telemetry file opens. Both sources remain readable. Init must still dispatch and warn that launcher capture is unavailable. The same fixture verifies that ordinary append growth within the size cap produces quiet init. [Readiness check](../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L102) · [Collector recheck](../../../skills/10x-pipeline/scripts/claude-usage.mjs#L388) · [Probe fixture](../../../skills/10x-pipeline/test/init-usage.test.mjs#L195)

### Success Criteria

#### Automated Verification

- Both chains route normally and issue one actionable, transport-specific init warning when capture prerequisites fail.
- Existing Claude launcher and collector fixtures still verify the same evidence and reject unsafe or incomplete capture.
- When the optional capture module cannot load, native Claude init returns one run action, warns on stderr and records a null hook hash.
- A launcher failure marker created during the telemetry probe produces an unavailable-capture warning and init still returns a run action.

For the two review checks, run `node --test --test-name-pattern='missing or unreadable hook inputs|native probe opens both sources safely' skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/init-usage.test.mjs`. Confirm both named tests execute and pass.

Run `node --test skills/10x-pipeline/test/init-usage.test.mjs skills/10x-pipeline/test/init-permissions.test.mjs`.

Run `node --test skills/10x-pipeline/test/claude-capture.test.mjs skills/10x-pipeline/test/claude-usage.test.mjs`.

## Phase 2: Explain missing figures in reports

### Overview

Render the evidence-based explanation once in the shared report and document how to enable or diagnose capture.

### Changes Required

#### 1. Report header and publication regression

**Files** `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/test/accounting-readers.test.mjs`, `skills/10x-pipeline/test/late-usage.test.mjs` and `skills/10x-pipeline/test/pr-comment.test.mjs`.

**Intent** Make the reason visible near the top of the report and in the PR comment while preserving detailed per-step evidence.

**Contract** Put one bounded line immediately after the report title, ahead of variable text such as the goal so it survives the comment length cap. Use only executed entries with a result object, normalized unavailable evidence and no token figure. Group fixed wording by source and reason, with step counts where scope could be ambiguous. Label launcher capture as off only for a Claude-hosted Claude dispatch with native `capture-disabled` evidence. Use availability wording for `missing-source` and version qualification for `unsupported-host`. Label headless coverage as duration-only only for a Claude dispatch on a saved Codex host with recorded duration and native `incomplete-capture` evidence. Other `incomplete-capture` cases retain their per-step evidence wording. Legacy entries without evidence and pending rows provide no basis for attribution. Keep precise per-step messages for all reasons. Rerender the summary from the same ledger as totals on finalization, archive handoff, report rebuild and late usage refresh. Use existing comment publication behavior. Pass a report generated from a scratch ledger with a long goal to the existing local fake GitHub client. Use the explicit `--report` path for OpenSpec, as its skill does. Assert that the same header line survives in the captured comment body.

#### 2. Operator reference

**Files** `docs/REFERENCE.md` and `README.md`.

**Intent** Give operators the setup and explain what the warning means before and after a step.

**Contract** Document the init warning, advisory semantics, launcher command and private hook/OTLP prerequisites, Codex version check and deferred rollout attribution, and duration-only headless coverage. Reuse the existing launcher example and preserve the supported explicit-source contract. Sweep active docs for old init/report behavior per the repository lesson. Historical change records are evidence for the behavior at the time. [Documentation lesson](../../foundation/lessons.md#grep-every-doc-for-the-old-behavior-when-a-scripts-output-changes)

### Success Criteria

#### Automated Verification

- Reports for both chains explain missing capture near the header, retain step reasons and keep mixed, legacy and late-verified figures accurate.
- A local fake GitHub client receives the same summary in the report comment payload.
- Active operator docs agree on the shared warning and supported setup.

Run `node --test skills/10x-pipeline/test/accounting-readers.test.mjs skills/10x-pipeline/test/late-usage.test.mjs`.

Run `node --test skills/10x-pipeline/test/pr-comment.test.mjs` with `GH_LIVE` unset.

Use `rg` assertions for the warning and launcher setup link in README.md, and for the launcher command, CLI version constraint and deferred rollout check in docs/REFERENCE.md. Run `git diff --check`.

#### Manual Verification

- On a supported interactive Claude host, observe the warning before step one in an ordinary session, then use the documented launcher in a fresh session and verify quiet init and captured figures.
- After authorized orchestrator publication of a run with capture disabled and comment intent, confirm the open PR comment displays the same missing-capture explanation as its report.

## Testing Strategy

- Unit and fixture coverage checks private binding and file safety, the distinction between empty and absent files, and bounded Codex version diagnostics. Use sanitized fixtures and fake executables.
- CLI coverage checks both chains, warning ordering and stdout shape, effective transports, recheck on resume, and no leakage. Keep permission stderr and sandbox argv assertions scoped to those diagnostics when a usage probe shares init.
- Report coverage checks verified and measured zero, partial figures, missing-source wording, explicit disabled coverage, headless coverage, historical ledgers without evidence, and disappearance of a stale limitation after late verified intake. Assert the disabled summary occurs once and the capped local comment payload includes the same line. Include a pending row in a `status --report` fixture and native and headless cases with the same `incomplete-capture` reason. Extend the late-usage test to prove that attaching verified evidence removes the stale clause from the refreshed report. Capture bodies locally using the existing fake-client test harness.
- Use the two Manual criteria only for real host and published-comment acceptance. Both are owner checks after implementation and do not gate local Automated rows. Row 2.5 stays pending until orchestrator publication makes the real comment available. The fake-client payload proves row 2.2.

## Performance Considerations

Read only the bounded launcher binding and metadata and open/close the two source files. Probe the Codex executable once per applicable init within the existing diagnostic time and output pattern. No rollout discovery is required at startup. Reporting adds a bounded summary over the executed entries already in memory.

## Migration Notes

The router owns init and report writes. The launcher creates capture files, hooks and the loopback receiver append records, and the collector reads them for the invocation. This change adds a read-only startup check and a rendering change. Both revisions read the existing `meta.json`, `run.jsonl` and capture files and use the same accounting schema and late-usage intake. Regenerate reports for eligible live change folders with `status <id> --report`, adding `--chain openspec` for OpenSpec. Reports in archived folders stay frozen. A Claude-hosted run can gain capture for later steps when resumed from the launcher with its saved host and mode.

The change to `claude-capture-data.mjs` changes the hook provenance hash computed by the plugin. A run with remaining guarded headless Claude dispatches must finish on its enabling plugin revision, including any headless archive dispatch. Settling the current invocation leaves that requirement in place for later dispatches. Apply the upgrade or rollback revision to new runs. Keep the original provenance, capture and ledger data and let launcher shutdown own capture cleanup. The previous revision can regenerate its report format from the same eligible ledgers. Published comments reflect a report snapshot and follow the current authorized refresh flow. [Hook provenance](../../../skills/10x-pipeline/scripts/isolation.mjs#L83) · [Headless dispatch guard](../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L33) · [Existing local guard fixture](../../../skills/10x-pipeline/test/claude-runner.test.mjs#L143) · [Revision guidance](../../../docs/REFERENCE.md#codex-and-provider-dispatch)

## References

- [Issue #232](https://github.com/xycu/agent-smith/issues/232)
- [Claude capture decision and evidence](../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md)
- [Accounting activation and rollback](../../../docs/REFERENCE.md#accounting-activation-and-rollback)
- [ADR-019 usage accounting](../../../docs/ADR/ADR-019-late-usage-figure.md)

## Progress

### Phase 1: Warn before step dispatch

#### Automated

- [x] 1.1 Both chains route normally and issue one actionable, transport-specific init warning when capture prerequisites fail. — 2a5fc3df
- [x] 1.2 Existing Claude launcher and collector fixtures still verify the same evidence and reject unsafe or incomplete capture. — 2a5fc3df
- [ ] 1.3 When the optional capture module cannot load, native Claude init returns one run action, warns on stderr and records a null hook hash.
- [ ] 1.4 A launcher failure marker created during the telemetry probe produces an unavailable-capture warning and init still returns a run action.

### Phase 2: Explain missing figures in reports

#### Automated

- [x] 2.1 Reports for both chains explain missing capture near the header, retain step reasons and keep mixed, legacy and late-verified figures accurate. — 80bf6f92
- [x] 2.2 A local fake GitHub client receives the same summary in the report comment payload. — 80bf6f92
- [x] 2.3 Active operator docs agree on the shared warning and supported setup. — 80bf6f92

#### Manual

- [ ] 2.4 On a supported interactive Claude host, observe the warning before step one in an ordinary session, then use the documented launcher in a fresh session and verify quiet init and captured figures.
- [ ] 2.5 After authorized orchestrator publication of a run with capture disabled and comment intent, confirm the open PR comment displays the same missing-capture explanation as its report.
