<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Late Usage Help Implementation Plan

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

The verdict and count reflect the implementation before triage at `1c0be05e`.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Phase 1 coverage

- Both router messages match the header's two-form synopsis. The usage refusal retains the missing-step explanation and chain option. The top-level halt retains the shared chain note. The router diff changes only those two literals, preserving argument handling, response envelopes, evidence validation and state handling. [Router help](../../../../skills/10x-pipeline/scripts/route.mjs#L794) · [Top-level help](../../../../skills/10x-pipeline/scripts/route.mjs#L970)
- The Commands row shows both forms. The shared reference explains which numeric flags can be supplied, their safe-integer bound and validation before the usage log is read. The OpenSpec summary places its chain-qualified command after the read-only list and links the shared rules. The OpenSpec skill explains the evidence requirement and keeps its command, timing and cleanup procedure. [Commands](../../../../AGENTS.md#L26) · [Shared reference](../../../../docs/REFERENCE.md#L413) · [OpenSpec summary](../../../../docs/REFERENCE.md#L678) · [OpenSpec skill](../../../../skills/openspec-pipeline/SKILL.md#L144)
- The regression test uses the existing CLI helpers and checks exit status, response fields and both alternatives inside each synopsis. Restoring each old message independently triggered its corresponding assertion. The current messages passed. [CLI regression](../../../../skills/10x-pipeline/test/late-usage.test.mjs#L90)
- ADR-019 retains the historical numeric-only decision and describes structured input in its amendment. [ADR-019](../../../../docs/ADR/ADR-019-late-usage-figure.md)

## Verification

| Plan item | Evidence |
| --- | --- |
| 1.1 Focused CLI regression | `node --test --test-name-pattern='usage help advertises --usage-file' skills/10x-pipeline/test/late-usage.test.mjs` passed. Each original message independently failed the relevant assertion. |
| 1.2 Documentation scan | All four positive `rg` checks in the plan matched. The scan for individual numeric-only invocations returned zero lines. |
| 1.3 Suite and whitespace | `GH_LIVE=0 node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` finished with 1,921 passed, 0 failed and 3 skipped. `git diff --check` passed. |

Two skips were live GitHub tests disabled by the plan. The third checks a local `CLAUDE.md`, which was absent. The OpenSpec CLI fixtures ran with version 2.0.0.

Scratch projects stayed inside the run worktree. On the first suite run, three non-repository fixtures discovered the enclosing Git repository. All three passed in a focused retry and in the full rerun after Git discovery was isolated. Phase 1 had no manual criteria.

Both read-only review agents reported their findings. Their token coverage is unknown.

## Findings

### F1 — Structured usage file location was unspecified

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `docs/REFERENCE.md:416`
- **Detail**: The structured usage paragraph specified a bounded regular JSON file. The router also requires a stable file within the run root, so a valid payload in the system temporary directory would be refused. The existing file-validation tests cover both restrictions. [Router validation](../../../../skills/10x-pipeline/scripts/route.mjs#L805) · [File validation tests](../../../../skills/10x-pipeline/test/usage-evidence.test.mjs#L70)
- **Fix**: State both conditions beside the structured usage synopsis.
- **Decision**: APPLIED in `97d632c7` (`fix: document the late usage file location`).
