<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Atomic Run State Implementation Plan

- **Plan**: `context/changes/run-state-atomic-writes/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict, dimension ratings and counts describe the plan before review edits. Both findings have been applied to the plan and brief. There are zero pending findings.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding checked 7/7 existing modification paths and 20/20 referenced existing symbols. The brief and plan agree on phases and scope. `run-state.test.mjs` is an explicitly planned new file. All 13 Progress rows match their phase success criteria, with exactly one terminal Progress section.

The existing paths are `state.mjs`, `route.mjs`, `flow.mjs`, `isolation.mjs`, `run-codex.mjs`, `docs/REFERENCE.md` and the 10x test `README.md`. Symbol checks cover both path resolvers, `readLog`, `writeLog`, `acquireRunLock`, `next`, `usageCommand`, `status`, `riskCommand`, `readSide`, `comparePair`, both archive verifiers, `writeReport`, `finishRun`, `neutralRetry`, `attachResult`, `startCommit`, `writeState` and `validateAction`.

## Codebase verification

| Risky claim | Evidence and result |
| --- | --- |
| One shared storage layer reaches both chains | Both path resolvers select the same state basenames, with chain-specific roots. The proposed helper belongs in `state.mjs`. [Source](../../../../skills/10x-pipeline/scripts/state.mjs#L446) |
| Every reader can migrate together | Nine production `readLog` calls occur in `route.mjs` and `run-codex.mjs`. The plan accounts for the three init reads, next, status, risk, comparison ingestion, usage and execution validation. [Router](../../../../skills/10x-pipeline/scripts/route.mjs#L91) [Runner](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L52) |
| Atomic writes must cover recovery and reports | `writeState` rewrites log and metadata after reset. Usage restores captured Buffers or absence. `writeReport` centralizes report publication. These are included in the plan. [Recovery](../../../../skills/10x-pipeline/scripts/isolation.mjs#L534) [Usage restoration](../../../../skills/10x-pipeline/scripts/route.mjs#L804) [Report](../../../../skills/10x-pipeline/scripts/flow.mjs#L308) |
| Cleanup can precede staging while preserving usage guards | The reviewed ordering needs correction because `lateUsagePrecheck` can refuse for policy, Git safety, branch or dirty files after the proposed cleanup. F1 resolves the ordering. [Precheck](../../../../skills/10x-pipeline/scripts/isolation.mjs#L420) |
| The new publication primitive preserves caller behavior | Temp-and-rename fits the synchronous built-in approach already used for lock updates. Existing in-place writes preserve file permissions, which the initial helper contract omitted. F2 adds that contract. [Lock precedent](../../../../skills/10x-pipeline/scripts/state.mjs#L942) [Current writer](../../../../skills/10x-pipeline/scripts/state.mjs#L516) |

The blast-radius sweep also checked standalone PR scripts. They consume reports and write their own scratch bodies. Their writes belong outside the three router state publications. Comparison diagnostics remain confined to ingestion and additive rendering, respecting the sibling comparison change's ownership. The repository lessons about chain ownership, finding counts and documentation searches informed this review. No contract-surfaces registry exists in this checkout.

## Findings

### F1 — Cleanup can mutate a refused late-usage call

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff, pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details / State sequencing, Phase 1 / Every publication and restoration call site, Phase 3 / Test index and recovery regressions
- **Detail**: The reviewed plan explicitly requests archive-state cleanup before cleanliness checks. Its general sequence also leaves requested-step, existing-figure and Git-safety guards unspecified relative to deletion. A recognized stale temp alongside an unrelated dirty file or staged change can therefore be deleted before the command refuses. Common cleanup before usage handling can also alter an identical-figure response. ADR-019 requires refused calls to preserve the folder, and the existing tests assert byte-identical refusal and idempotence. [Usage guards](../../../../skills/10x-pipeline/scripts/route.mjs#L748) [Archive-state guards](../../../../skills/10x-pipeline/scripts/isolation.mjs#L420) [Refusal and idempotence tests](../../../../skills/10x-pipeline/test/late-usage.test.mjs#L158) [ADR-019](../../../../docs/ADR/ADR-019-late-usage-figure.md)
- **Fix**: Complete usage guards and the identical-figure return before cleanup. Extend the read-only archive-state precheck to tolerate only exact untracked regular temp candidates identified through the shared matcher, and reject every other dirty path before deletion. Then clean candidates before publication and staging. Add paired refusal/idempotence tests with temps present and successful archive-state cleanup coverage.
  - Strength — preserves ADR-019 while allowing stale temps to be removed for eligible commits.
  - Tradeoff — requires a small change to `lateUsagePrecheck` in addition to state-write replacements.
  - Confidence — HIGH, established by the existing precheck sequence and byte-preserving tests.
  - Blind spot — implementation tests must confirm Git path attribution in nested project roots.
- **Decision**: APPLIED — changed plan sections Critical Implementation Details / State sequencing, Phase 1 / Shared storage primitives, Every publication and restoration call site and Atomic-publication regression cases, and Phase 3 / Test index and recovery regressions. Updated the brief's Ordering decision and Architecture / Approach.

### F2 — Atomic replacement can widen existing state-file permissions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach / Assumptions decided unattended, Phase 1 / Shared storage primitives and Atomic-publication regression cases
- **Detail**: The planned temp writer specifies bytes and exclusive creation but leaves permission handling implicit. Existing `fs.writeFileSync` calls retain an existing file's mode. A fresh temp created with default permissions under umask `0022` can replace a `0600` state file with a `0644` inode. Logs also retain the full pending prompt, so widening permissions exposes previously restricted content to additional local readers. [Existing write](../../../../skills/10x-pipeline/scripts/state.mjs#L516) [Stored prompt](../../../../skills/10x-pipeline/scripts/route.mjs#L264) [Node file-write options](https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options)
- **Fix**: Preserve existing regular-target permission bits on the temp before writing data and retain the current umask-derived mode for fresh targets. Treat permission setup failure as publication failure. Add POSIX `0600` replacement and Buffer-restoration assertions under umask `0022`, fresh-file mode coverage and a permission-failure case.
- **Decision**: APPLIED — changed plan sections Implementation Approach / Assumptions decided unattended, Phase 1 / Shared storage primitives and Atomic-publication regression cases. Updated the brief's Publication decision and Architecture / Approach.

## Assumptions and verification limits

- The unattended step's explicit instructions authorize applying every clear fix and constrain edits to the plan, brief and report. The review and triage ran in this subagent. The saved change identity remains under the orchestrator's ownership.
- Candidate-only cleanliness tolerance is restricted to untracked regular files so existing tracked-state and unrelated-dirt guards continue to apply. ADR-019 and the current precheck establish that decision.
- Preserving existing file modes follows current `fs.writeFileSync` behavior. The plan's per-file process-termination guarantee, empty-log compatibility and existing lock-root assumptions continue to define implementation acceptance.
- This review verifies the design through code and existing test inspection. Runtime crash, filesystem-failure and complete-suite evidence belongs to implementation. The document checks verify finding parsing, applied/open counts, phase-to-Progress consistency, byte-identical Progress preservation and whitespace correctness.
