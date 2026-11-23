<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usage Capture Preflight Implementation Plan

- **Plan**: [Usage Capture Preflight Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

The verdict and counts describe the implementation before triage. Across both phases, all five Automated rows were checked and their planned commands passed. The existing provenance test exposed an additional startup regression. Phase 1 uses the effective provider selection and keeps its advice separate from permission diagnostics. Phase 2 uses settled evidence in the shared report renderer and retains the summary in capped local comment payloads for both chains. The review used the two implementation commits named in Progress and checked their connected callers at `cff9f1fb`.

## Findings

### F1 — Optional capture module can prevent the router from starting

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — the fix is narrowly scoped to the advisory's module load.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/init-usage.mjs:4` in `cff9f1fb`
- **Detail**: The static import of `claude-capture-data.mjs` makes it a startup dependency of every router command. When that optional capture file is missing, Node exits before the router can emit a JSON response. The existing provenance fixture expects missing or unreadable hook files to yield a null hook hash while init continues. [Provenance regression](../../../../skills/10x-pipeline/test/provenance.test.mjs#L539)
- **Fix**: Load the capture module only for the native Claude advisory, catch load failures there, and await the advisory before dispatch.
- **Decision**: APPLIED in `18adca92`. The missing-hook provenance fixture now returns a valid init result with a null hook hash.

### F2 — Launcher failure during source probes can leave init quiet

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is narrowly scoped and follows the collector's availability check.
- **Dimension**: Safety & Quality
- **Location**: [claude-capture-data.mjs:102](../../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L102)
- **Detail**: The initial binding read checks for a failure marker before opening either source. A live writer can mark capture failed during those probes while leaving both files readable. Init then treats capture as ready even though the collector would reject it. The collector already repeats the availability check at the end of its read. [Collector recheck](../../../../skills/10x-pipeline/scripts/claude-usage.mjs#L388) · [Writer failure marker](../../../../skills/10x-pipeline/scripts/claude-capture.mjs#L132)
- **Fix**: Reuse `assertCaptureAvailable` with the parsed binding after both source probes. Extend the preload fixture to create a failure marker during the telemetry probe and assert the warning.
- **Decision**: APPLIED in `18adca92`. The new race fixture fails on the original probe and passes after the final availability check.

## Verification

| Original implementation check | Result |
| --- | --- |
| `node --test skills/10x-pipeline/test/init-usage.test.mjs skills/10x-pipeline/test/init-permissions.test.mjs` | 22 passed |
| `node --test skills/10x-pipeline/test/claude-capture.test.mjs skills/10x-pipeline/test/claude-usage.test.mjs` | 78 passed |
| `node --test skills/10x-pipeline/test/accounting-readers.test.mjs skills/10x-pipeline/test/late-usage.test.mjs` | 62 passed |
| `env -u GH_LIVE node --test skills/10x-pipeline/test/pr-comment.test.mjs` | 56 passed, 2 live cases skipped as planned |
| `rg` assertions for README warning and setup link, plus reference launcher command, Codex pin and deferred attribution | Passed |
| `git diff --check` on the worktree and implementation range | Passed |
| `node --test skills/10x-pipeline/test/provenance.test.mjs` with the original loader | 28 passed, 1 failed. The missing-hook fixture exited 1 before returning a JSON action. |

- **Manual 2.4** remains pending for an owner to observe ordinary and launcher sessions on an interactive Claude host.
- **Manual 2.5** remains pending for an owner to compare the report with the live comment after authorized orchestrator publication. The local fake-client test passed. [Manual evidence](../evidence/unproven.md)

## Verification after triage

All five Automated criteria passed again after both fixes. The four planned test commands passed 218 tests, with the two live GitHub cases skipped. The focused provenance file passed all 29 tests, including the previously failing missing-hook case. The documentation assertions and `git diff --check` passed. The plan's Progress section retains its original rows.
