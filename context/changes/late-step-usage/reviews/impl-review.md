<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Late Step Usage Figure Implementation Plan

- **Plan**: context/changes/late-step-usage/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

Reviewed in this subagent, no sub-agent launched (orchestrator note). Diff range `814bf33..e885b1c` (commits ddc694f, 3dbaff5, 800768f, ca65ab8, e885b1c). Every file in the diff is named in the plan; no planned file is missing.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Success criteria

- `node --test skills/10x-pipeline/test/late-usage.test.mjs`: 26 of 26 pass (covers 1.1, 1.3, 2.1).
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 966 tests, 964 pass, 0 fail, 2 skipped, on the code before the fix and again after it (covers 1.2, 2.2, 2.3, 3.1, 3.2, 4.2).
- `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/rules.test.mjs`: 21 of 21 pass after the fix (4.1).
- 4.3: `init`, `next` and `status` print valid JSON in a scratch project under `$TMPDIR`; `usage demo 1 --tokens 1234` printed `attached: true`, exit 0.
- Manual 3.3: both `archive` branches run the `usage` call in step 1, before step 3 launches the subagent, and say a later figure is dropped. Confirmed by reading both skills; the evidence file agrees.
- Manual 4.4: the evidence file says the docs match `route.mjs`; F1 is one sentence of `REFERENCE.md` that does not.

## Findings

### F1 — REFERENCE says a bad usage value is dropped; the command refuses it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:231
- **Detail**: The "Late usage figure" block says the figure is cleaned like an on-time one, "a field that is not a number of 0 or more is dropped". `usageCommand` (`route.mjs`) refuses any flag value that is not a decimal non-negative safe integer, and a flag with no value, with `attached: false` and exit 1 before anything is read; `cleanUsage` never sees a bad value. ADR-019 D2 and the `AGENTS.md` command line describe the refusal correctly, so the three docs disagree on a guard. The plan's Manual row 4.4 asks for the same guards in all docs and the router.
- **Fix**: Say that a value that is not a non-negative integer, or a flag with no value, is refused before anything is read, and that the figure then goes through the same cleaning as an on-time one.
- **Decision**: APPLIED - 50c0da2

### F2 — `done` branch runs `status` before it attaches late figures

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md (`done` branch), skills/openspec-pipeline/SKILL.md:70-72
- **Detail**: In the `archive` branch the `usage` calls come first "so `status` and the committed `report.md` show them". In the `done` branch the text first runs `status` and only then, "Before the pull request step", attaches the late figures, so the `status` output the orchestrator reads has no late figure. `report.md` is rewritten by the command, so the report is right; only the shown `status` lags. The plan asked only for "before the pull request step", which holds. In the `halt` branch the paragraph starts "Before that" right after "STOP.", which reads correctly only together with the next line.
- **Fix**: Optionally move the attach paragraph of the `done` branch before its `status` call in both skills, as in the `archive` branch.
- **Decision**: PENDING — observation only, no change needed for correctness; the owner decides whether the `done` branch should attach before `status`, which also changes the text pinned by `skill-loop.test.mjs`.

### F3 — `changeRel` helper added next to two inline copies of the same path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:362 (`changeRel`), :416 (`startCommit`), :547 (`archiveDone`)
- **Detail**: The new `changeRel(p, id)` computes `openspec/changes/<id>` or `context/changes/<id>`. `startCommit` and `archiveDone` keep their own inline copies of the same expression. Behavior is identical today; three copies can drift when a chain is added.
- **Fix**: Use `changeRel` in `startCommit` and `archiveDone` in a later refactor.
- **Decision**: PENDING — observation only; the plan rules out changes to `archiveDone`, so the owner decides whether a follow-up refactor is worth it.
