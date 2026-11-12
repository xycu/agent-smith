<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Skill directory variable for script paths

- **Plan**: context/changes/skill-dir-variable/plan.md
- **Mode**: Deep (done in-agent, no sub-agent; nested subagents are banned in this run)
- **Date**: 2026-11-12
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (both SKILL.md, four test files, README, tools), 6/6 line claims ✓ (SKILL.md:25-27,132; openspec:28-30,141; test lines 92, 79, 82, 155), brief↔plan ✓, Progress↔Phase ✓ (1.1-1.6, 2.1-2.4, 3.1-3.6). Changelog check: `${CLAUDE_SKILL_DIR}` is under 2.1.69 and the Agent `effort` parameter under 2.1.292, as the plan says. `agents.test.mjs` and `provenance.test.mjs` read no SKILL.md text, as the plan says.

## Findings

### F1 — Live check installs `main`, not this branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Contract, Manual rows 3.5 and 3.6, Manual Testing Steps
- **Detail**: The live check says to install "from the marketplace". The README marketplace is `xycu/agent-smith`, which serves `main`. Until this change is merged and released, that install still holds `<this skill's base directory>`, so rows 3.5 and 3.6 could never see a substituted path, or would pass on the wrong code. `marketplace.json` uses `"source": "./"`, so a marketplace added from a local path (the run worktree) installs this branch into the plugin cache and still avoids `--plugin-dir`.
- **Fix**: Name the marketplace source in the live-check procedure: add it from the run worktree path, then install `agent-smith@agent-smith`.
- **Decision**: APPLIED — Phase 3 Contract (live check procedure) and Manual Testing Steps item 1 now say to add a local marketplace on the run worktree.

### F2 — Plan says the openspec test has no path override; it has one

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — success criterion 1.4 (Progress row 1.4), Content tests contract
- **Detail**: 1.4 says "the openspec test has no path override; check by reasoning ... or add the same override". `openspec-skill.test.mjs:13` already reads `process.env.OPENSPEC_SKILL_PATH`. An implementer could add a second override or skip the break check for the openspec skill.
- **Fix**: State that both overrides exist and that the deliberate break runs for each file.
- **Decision**: APPLIED — Phase 1, Content tests Contract now names `SKILL_PATH` and `OPENSPEC_SKILL_PATH` and tells the implementer to run the break for each. The 1.4 text in the Progress block and in the Success Criteria list was left unchanged because Progress titles are frozen; the Contract note says the 1.4 parenthetical is out of date.

### F3 — End State says the old placeholder is gone from tests, but the tests must name it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State
- **Detail**: "no `<this skill's base directory>` remains in `skills/`, tests or docs" contradicts the plan's own tests, which hold the string to assert its absence (and criterion 1.1 greps only the SKILL.md files).
- **Fix**: Reword the end state to "either SKILL.md or docs", and say the tests name it only to assert its absence.
- **Decision**: APPLIED — Desired End State first paragraph reworded.

### F4 — Quote note does not reach the unquoted `node $ROUTER` calls

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 10x skill Contract, OpenSpec skill Contract
- **Detail**: The motive is a path with a space, but each SKILL.md holds 11 `node $ROUTER ...` calls that stay unquoted (tests pin them). The note "Quote the path for the shell." on the `Router:` line is only useful if it tells the orchestrator to quote when it substitutes `$ROUTER`, as the PR script steps do.
- **Fix**: Word the note as "When you put the path in a command, quote it for the shell."
- **Decision**: APPLIED — Phase 1, 10x skill Contract (note wording) and OpenSpec skill Contract ("same quote note").

### F5 — README sentence placement and the Node.js line

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — README Contract
- **Detail**: The contract says Node.js 24 is stated in `docs/REFERENCE.md` and not to repeat it "unless README already does". README already does, in the two `Needs:` lines of Quick start (lines 43 and 56), so the conditional is already decided.
- **Fix**: Say README already states Node.js 24+ and that the new sentence in Install does not repeat it.
- **Decision**: APPLIED — Phase 2 README Contract reworded.
