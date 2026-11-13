<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Slim AGENTS.md to rules and pointers

- **Plan**: context/changes/agents-md-slim/plan.md
- **Mode**: Deep (checked by hand; no sub-agent, because a nested subagent is banned)
- **Date**: 2026-11-12
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths checked (all test files, `tools/test/*`, ADR files, prompts README, `release-please-config.json`) ✓, symbols ✓ (`route.mjs:833` usage line, `DEFAULT_TIMEOUT_MS`, the three pins at the named lines, `removeTree` scan lists), brief↔plan ✓. The smoke-check claim was run in a scratch dir: `init` halts with the shipped policy and returns `action: "run", step: "plan"` with `{ "isolation": { "require": false } }`. `release-please-config.json` has no `changelog-sections`, the manifest says 1.6.1.

## Findings

### F1 — The 8 KB target cannot be met with Hard Rules kept verbatim

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Overview, Desired End State, Phase 2 Intent, criterion 2.1, Performance Considerations
- **Detail**: Measured on the current file: Hard Rules 2,454 bytes (kept word for word), Commits 1,020, Coding Style 696 plus the import-order sentence, Releases 2,059 (cut to about 1,300), the intro about 400. Commands is 4,923 today and keeps a synopsis per command plus the test command and smoke check (about 3 KB). Layout adds about 2 KB. The sum is 10 to 11 KB, not 8 KB. The 12,288-byte test limit is then the only slack, and an implementer chasing 8 KB would be tempted to cut Hard Rules or the flags, which the plan forbids.
- **Fix**: State the target as about 10 KB everywhere, keep 12,288 as the binding limit, and say that Hard Rules are never cut to make room.
- **Decision**: APPLIED — plan.md Overview, Desired End State, Phase 2 Intent (names the "about 8000" in criterion 2.1 as an early estimate) and Performance Considerations; plan-brief.md What & Why, Open Risks and Success Criteria. The text of Progress row 2.1 and its twin criterion line is unchanged on purpose, because a run may not edit Progress rows.

### F2 — Layout pointers written short would fail the advisor pin

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 1 (`## Layout`) and item 2 (advisor pin)
- **Detail**: The rewritten advisor test requires `AGENTS.md` to include the strings `skills/10x-pipeline/test/README.md` and `docs/ADR/README.md`. The Layout contract wrote the pointers as `test/README.md` and `prompts/README.md`, which does not contain the full test path. Test 3.6 would fail at 2.2 and the implementer would have to guess why.
- **Fix**: Write the three index pointers as full repo paths in Layout.
- **Decision**: APPLIED — plan.md Phase 2 item 1, `## Layout` bullet.

### F3 — Check 1.1 is a substring match and passes when an entry is missing

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 1 and criterion 1.1
- **Detail**: `grep -q "$(basename $f)"` finds `archive.test.mjs` inside `openspec-archive.test.mjs`, and `helpers.mjs` inside `openspec-helpers.mjs` and `phase-helpers.mjs`. A forgotten index entry would not show. The Contract also listed short names (`route`, `churn`), which an implementer could copy instead of the file names.
- **Fix**: Require the full file name in backticks per entry and say the short names stand for `<name>.test.mjs`.
- **Decision**: APPLIED — plan.md Phase 1 item 1, Contract. The command in criterion 1.1 and Progress row 1.1 is unchanged on purpose, because a run may not edit Progress rows; the owner can tighten it to `grep -qF "\`$(basename $f)\`"`.

### F4 — The size test reads `AGENTS.md` relative to the working directory

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 5
- **Detail**: The Contract says `statSync("AGENTS.md")`, which breaks when the suite starts from another directory. The model file `agents-md-no-imports.test.mjs` builds `root` from `import.meta.url`.
- **Fix**: Use `join(root, "AGENTS.md")` with `root` built as in that file.
- **Decision**: APPLIED — plan.md Phase 2 item 5, Contract.

### F5 — The bump table keeps a clause that is stale at 1.6.1

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 1, `## Commits`
- **Detail**: The plan fixes three stale statements but keeps the table row "minor while the version is below 1.0.0, major from 1.0.0". The version is 1.6.1, so a breaking commit is major, and `bump-minor-pre-major` in `release-please-config.json` only acts below 1.0.0. The row is not false but it repeats the `0.x` framing the plan removes elsewhere.
- **Fix**: State major for a breaking commit and drop the pre-1.0 clause.
- **Decision**: APPLIED — plan.md Phase 2 item 1, `## Commits` bullet.

### F6 — Nothing tells a contributor where a new test, prompt or ADR is listed

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 item 1, `## Layout`
- **Detail**: The old `Project Structure` list was the rule "add your file here" (ADR-013 line 119 says so). After the cut, the size test stops `AGENTS.md` from growing, but no text says that the index READMEs are the place to add a row, so the new indexes can drift the way the catalog did.
- **Fix**: End Layout with one sentence: a new test, prompt or ADR gets its row in the README of its folder.
- **Decision**: APPLIED — plan.md Phase 2 item 1, `## Layout` bullet.
