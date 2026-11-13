<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Layered Rules and OpenSpec Definitions in the OpenSpec Folder

- **Plan**: context/changes/proper-structure-of-rules/plan.md
- **Mode**: Quick (no sub-agent; the run forbids nested subagents, so the riskiest claims were checked by hand against the code)
- **Date**: 2026-11-13
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths checked (scripts, policy.json, os prompts, ADR-013/022, ci.yml, openspec/config.yaml, the seven shared tests that import `openspec-helpers.mjs`) ✓, symbols ✓ (`deepMerge`, `mergedPolicy`, `PROMPT_REF`, `NARROW_PLACEHOLDERS`, `checkPrompts`, `promptText`, `provenanceSections`, `PLUGIN_ROOT`, both assembly sites at `route.mjs:197-199` and `isolation.mjs:696-697`), brief↔plan ✓, Progress↔Phase rows ✓ (9, 7, 7 rows match the criteria; no checkbox outside Progress). `docs/reference/contract-surfaces.md` does not exist, so that check was skipped. Lessons prior: "grep every doc" is already applied by the plan.

## Findings

### F1 — Two always-true rules of different levels have no tie rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Decisions settled 1; Phase 2 §4 (`top.md` precedence rules)
- **Detail**: Precedence 1 says an always-true rule beats every other rule, and precedence 2 says the earlier rule wins among the others. Step file, chain file and `top.md` are all always-true and `top.md` is last, so a step or chain always-true rule that contradicts a top rule has no decided winner. The level model says a lower level may not change a higher always-true rule.
- **Fix**: Add a clause to precedence 1: between two always-true rules the higher level wins (top, then chain, then step), and pin it in case (h).
- **Decision**: APPLIED — Decisions settled 1; Phase 2 §4 contract (Precedence 1); Phase 2 §6 case (h); `plan-brief.md` Precedence row.

### F2 — `checkPrompts` guards only `top.md`; other rule files can fail after the result file is consumed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (`ruleTail`, `checkPrompts`)
- **Detail**: `ruleTail` reads `chain.md` and step files with "ENOENT reads as none", so any other read error (permission, a folder in the place) throws during prompt assembly, after `attachResult` consumed `last-result.json`. `checkPrompts` (`route.mjs:79`, before `attachResult`) exists to stop that case, but the plan makes it read only `top.md`.
- **Fix**: Make `checkPrompts` read every present rule file (both `chain.md`, `rules/steps/<step>.md` for each name in `policy.steps`) through the same reader, and add an unreadable-`chain.md` case to (d).
- **Decision**: APPLIED — Phase 2 §1 contract (last sentence); Phase 2 §6 case (d).

### F3 — Phase 1 byte-identity checks cannot hold after Phase 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria (R100 check, Manual spot-check)
- **Detail**: The R100 check diffs `b79777b..HEAD`, but Phase 2 edits `os-archive.md`, `os-propose.md`, `os-apply.md` and `os-verify.md` (precedence line, `--change`/`--store` rules), so those files are no longer R100 once Phase 2 lands. The manual spot-check against `b79777b` has the same limit.
- **Fix**: State that both checks run at the Phase 1 commit, before Phase 2 edits the files.
- **Decision**: APPLIED — Phase 1 Success Criteria (Automated R100 bullet, Manual bullet); Progress rows untouched.

### F4 — `top.md` is rendered although it may hold no placeholder

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (step 3), Critical Implementation Details (Rendering)
- **Detail**: `render` replaces any `{word}` with its value or `""` (`steps.mjs:674-676`). The plan renders `top.md` and also bans placeholders in it by a test, so the render is dead code, and a future `{x}` typed into the file nothing may change would vanish silently. `prompts.suffix`, which holds the same `RESULT:` text today, is already unrendered.
- **Fix**: Read `top.md` unrendered, like the suffix; render only the step file, the chain file and `prompts.chain-*`.
- **Decision**: APPLIED — Phase 2 §1 contract (item 3); Critical Implementation Details (Rendering).

### F5 — The list of changes that collide with the moved paths is incomplete

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Decisions settled 5; Phase 3 Manual verification (the notes to open changes)
- **Detail**: Four more `new` changes without a plan name a moved path or a re-pinned rule: `tests-strip-git-env` (`change.md:19`, the OpenSpec tests), `agent-call-parameters` (`change.md:31`, `openspec-skill.test.mjs`), `delete-guard-gaps` (owns `no-recursive-delete.test.mjs`, which pins suffix rules; WAVES.md wave 5) and `coverage-and-failed-undo-test` (owns the `ci.yml` test command; WAVES.md wave 6). The plan's claim that retargeting costs only `change.md` text still holds, but the owner's note list would miss them.
- **Fix**: Add the four changes to Decision 5 and to the Manual row 3.7 note list.
- **Decision**: APPLIED — Decisions settled 5; Phase 3 Manual verification (second bullet).
