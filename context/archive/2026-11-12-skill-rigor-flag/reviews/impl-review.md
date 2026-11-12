<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Parse --rigor in both skills as the README offers it

- **Plan**: context/changes/skill-rigor-flag/plan.md
- **Scope**: full plan (Phase 1 and Phase 2), commits 19634aa..5c94d3c on the run branch
- **Date**: 2026-11-12
- **Verdict**: PASS WITH NOTES
- **Findings**: 0 critical, 1 warnings, 1 observations

## Plan compliance

- Hint of both skills, Start step 1, step 4, both REFERENCE headings, the OpenSpec exact-hint assertion and both new content tests match the plan contract. No router, policy, prompt, README or Anti-stall change.
- Anti-stall sections stay byte-equal; no new model, effort or tier word (only `lean`, `standard`, `thorough`, already named in step 4).
- Suite before my edit: 1077 tests, 1074 pass, 0 fail, 3 skipped.

## Findings

### F1 — `--pr-comment` "the same way" lost its antecedent

- **Severity**: ⚠️ WARNING
- **Decision**: APPLIED in bad44b0. The `--rigor` sentence moved after the `--pr-comment` sentence in both skills and now reads "like `--archive`, but its value is the next word"; the content tests still pass.
- **Where**: `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`, Start step 1.
- **Problem**: The new `--rigor` sentence was inserted before "Parse the optional flag `--pr-comment` the same way". "The same way" then pointed at a flag with a mandatory next-word value, so an orchestrator could read `--pr-comment` as taking a value and strip a goal word after it.
- **Fix**: Keep `--pr-comment` right after the `--archive`/`--chrome` sentence, as before, and put `--rigor` last.

### F2 — Manual row 2.5 stays pending

- **Severity**: ℹ️ OBSERVATION
- **Decision**: PENDING. Row 2.5 needs a live `/agent-smith:10x-pipeline ... --rigor thorough` run; an unattended subagent cannot launch one. The owner runs it in a scratch project and ticks the row. The router half is covered by Automated 2.4.
- **Note**: the orchestrator-side stripping of the flag from the goal is pinned only by the text tests, not by a run.
