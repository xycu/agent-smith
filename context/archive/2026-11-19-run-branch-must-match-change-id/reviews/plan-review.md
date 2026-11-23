<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Refuse to run a change on another change's run branch

- **Plan**: context/changes/run-branch-must-match-change-id/plan.md
- **Mode**: Deep (claims checked against the code by the reviewer, no sub-agent)
- **Date**: 2026-11-20
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

12/12 paths and line references checked (`run-identity.mjs:60-104`, `prepare-run.mjs:171-201`, `isolation.mjs:316-318`, `open-pr.mjs:149-151`, test lines 69, 798, 851-890, 149, 241-262, `docs/REFERENCE.md` lines 141, 146, 173, 482), brief and plan agree, Progress block and phase Success Criteria match row for row, no publication-dependent Automated row.

## Findings

### F1 — Two more existing tests fail under the new check and the plan says they pass unchanged

- **Severity**: WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 3. Tests; Success Criteria 1.2 and 1.3; Current State Analysis
- **Detail**: The plan lists two tests that encode the defect and says the rest keep passing. `validateRunIdentity` will now run the id check on `meta.branch` before it compares `meta.branch` with HEAD. `isolation.test.mjs:286-287` records `{ id: "demo", isolated: true, branch: "codex/other" }` with HEAD on `codex/demo` and expects `/started on branch codex\/other/`. The `{ id: "demo", isolated: true, branch: "codex/other", chain }` case at `open-pr.test.mjs:904` expects `/saved run identity|Saved run identity|started on branch|Invalid run branch/`. Both now get the other-change message, so rows 1.2, 1.3 and 1.4 fail as the plan is written.
- **Fix**: Change the recorded branch of those two fixtures to `codex/demo-other` (the saved tier accepts it and the HEAD-mismatch message stays), and list both in Phase 1 section 3 and in Current State Analysis.
- **Decision**: APPLIED — Current State Analysis (new bullet), Phase 1 section 3 Contract (two fixture bullet), plan-brief Open Risks.

### F2 — Known limit missing: defect-written `foo` on `agent-smith/foo-bar` still resumes

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes; What We're NOT Doing
- **Detail**: The saved tier accepts any recorded branch that starts with `<prefix><id>`. A `meta.json` that the defect wrote for `foo` inside the worktree of `foo-bar` (the case the plan calls out as why `startsWith` is not enough) therefore still resumes. The Migration Notes only describe the `foo` on `agent-smith/bar` case.
- **Fix**: Name the limit in Migration Notes.
- **Decision**: APPLIED — Migration Notes (known limit sentence), plan-brief Open Risks.

### F3 — Baseline arm on another suffix: the escape hatch is circular and the message does not list accepted names

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: What We're NOT Doing (last bullet); Phase 1 — 1. Guard, Contract
- **Detail**: The plan says a baseline on another suffix needs the saved identity, which "the baseline arm writes at its first `init`". The first `init` runs the unsaved tier, so it refuses before any identity exists. A user on `agent-smith/foo-scorer-off` would also read that the branch "belongs to" change `foo-scorer-off`, with no hint of the accepted names.
- **Fix**: State that the first `init` needs `<prefix><id>` or `<prefix><id>-baseline`, and make the unsaved-tier message list those two names.
- **Decision**: APPLIED — What We're NOT Doing (last bullet), Phase 1 section 1 Contract (message bullet), Desired End State left as is.

### F4 — The boundary cases named in Testing Strategy have no test in Phase 1

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy — Unit Tests; Phase 1 — 3. Tests
- **Detail**: Testing Strategy promises that `demo-baselines` and `demo-baseline-2` refuse without saved identity, but the Phase 1 test list has no such case, and nothing else proves the exact-match boundary of the `-baseline` constant.
- **Fix**: Add the two `init` cases to Phase 1 section 3.
- **Decision**: APPLIED — Phase 1 section 3 Contract (boundary cases bullet).
