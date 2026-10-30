<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-Step Usage Report

- **Plan**: context/changes/per-step-usage-report/plan.md
- **Scope**: Full plan (phases 1, 2, 3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — A report write failure kills routing output

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:168-174
- **Detail**: `endRun` writes the log and meta.json, then calls `writeReport`. If that throws (read-only report.md, a directory at that path), `out()` never runs and the orchestrator gets a stack trace instead of the done/halt JSON, though the decision is already persisted. Not reproduced.
- **Fix**: Wrap `writeReport` in try/catch inside `endRun`; on failure emit `report: null` plus a `reportError` string so routing output always survives.
- **Decision**: FIXED — `endRun` catches a `writeReport` failure and emits `report: null` plus `reportError`.

### F2 — `status <id> --report` creates a change tree for an unknown id

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:436-439
- **Detail**: `status ghost --report` makes context/changes/ghost/agent-smith/report.md (reproduced). A mistyped id leaves an orphan folder that a later /10x-new finds already there. `next` on an unknown id already creates agent-smith/, so the damage is bounded.
- **Fix**: In `status`, when `--report` is set and context/changes/<id> does not exist, return the halt JSON with a "no such change" reason and write nothing.
- **Decision**: FIXED — `status --report` halts with "No change folder" for an unknown id and writes nothing.

### F3 — Corrupt state files crash status, status --report and next

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: route.mjs:121-124 (readLog), meta.json reads at :366 and :437
- **Detail**: A truncated run.jsonl line (`{bad`) or a `null` line throws; a meta.json holding `null` throws a TypeError. Older code paths; --report adds one more reader. Only a hand edit or a run killed mid-write produces these files.
- **Fix**: Skip lines in `readLog` that do not parse into objects; fall back to the default meta when meta.json is not a plain object.
- **Decision**: FIXED — `readLog` skips unparsable and non-object lines; new `readMeta` falls back when meta.json is not a plain object.

### F4 — README overstates when the report is written

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: README.md:38-43
- **Detail**: Says the report is written when a run ends (done or halt). The missing-result halt writes none. After a halt, report.md also keeps its old `Outcome: halt` line while a continued run is in progress, until the next end or a `status --report`.
- **Fix**: Add a clause for both: the missing-result halt writes no report, and a continued run keeps the previous report until it ends.
- **Decision**: FIXED — README Usage report group notes the missing-result halt writes no report and a continued run keeps the old report.

### F5 — Float token figures give odd totals

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: route.mjs:177-186 (cleanUsage), :152-155
- **Detail**: 0.1 + 0.2 renders as 0.30000000000000004; huge finite values sum to Infinity. Real token counts are integers.
- **Fix**: Accept only `Number.isSafeInteger` values in `cleanUsage`.
- **Decision**: FIXED — `cleanUsage` accepts only non-negative safe integers.

### F6 — Manual check 3.6 has no recorded evidence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress row 3.6
- **Detail**: 3.6 (a real skill run puts `usage` on a log entry and a number in report.md) is ticked on the user's confirmation. No artifact in the repo shows it, and nothing in the review session tested the one link the plan named as its top risk.
- **Fix**: Paste one real run.jsonl entry with `usage` and its report row into a note under the change folder, or re-run once and keep the output.
- **Decision**: FIXED — note file `real-run-evidence.md` created; owner pastes the real `run.jsonl` entry and report row into it.
