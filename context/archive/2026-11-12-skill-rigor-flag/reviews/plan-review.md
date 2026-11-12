<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Parse --rigor in both skills as the README offers it

- **Plan**: context/changes/skill-rigor-flag/plan.md
- **Mode**: Quick (document and grounding only; no sub-agent)
- **Date**: 2026-11-12
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

6/6 paths checked (both SKILL.md, REFERENCE.md headings at :5 and :388, route.mjs:824 and :846-849, openspec-skill.test.mjs:72, pr-comment.test.mjs hint match) ✓, symbols `INIT_FLAGS`, the `--rigor` resume rule at route.mjs:914 ✓, brief↔plan ✓ (brief updated after F1). Progress↔Phase consistency ✓.

## Findings

### F1 — Phase 1 leaves the full suite red

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Implementation Note; Phase 2 change 2
- **Detail**: Phase 1 changes the OpenSpec `argument-hint`, and `openspec-skill.test.mjs:72` asserts the whole hint string. The plan accepts a red suite until Phase 2. An unattended per-phase gate (plan criteria plus full suite, as `/10x-goal-implement` and the pipeline's implement step run) would fail Phase 1 and retry or halt on a failure the plan itself predicted. Phase 1's own criterion 1.4 does not run that test, so the plan never notices.
- **Fix**: Move the line 72 assertion update into Phase 1 (new change 4), add `openspec-skill.test.mjs` and `pr-comment.test.mjs` to the 1.4 command, and leave only the new step 1 test in Phase 2.
- **Decision**: APPLIED — Phase 1 Overview, new Phase 1 change "4. OpenSpec hint assertion", Phase 1 criterion 1.4 command, Phase 1 Implementation Note, Phase 2 change 2 (and the Phases at a Glance table in plan-brief.md).

### F2 — Step 1 pin can pass on the `--archive` sentence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 1 contract
- **Detail**: The contract asks for "a removal from the goal text" in the step 1 line. The existing `--archive` sentence already holds `goal text`, so a check on the whole line cannot tell whether the `--rigor` sentence says it. The needle list is not concrete enough to write the test from.
- **Fix**: Assert on the sentence of step 1 that contains `--rigor`: it must also include `--rigor=<level>`, `goal text`, `lean`, `standard` and `thorough`.
- **Decision**: APPLIED — Phase 2 change 1 contract (10x skill content check); change 2 reuses it.

### F3 — Criterion 2.4 does not prove its title

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Automated Verification, 2.4
- **Detail**: The row says the router "keeps it out of the goal", but the command passes the goal by hand, so it proves only that `init --rigor thorough` stores rigor `thorough`. Stripping the flag is the orchestrator's job and only manual row 2.5 shows it. The command also needs a git repo or `isolation.require: false` in a scratch project, or `init` halts at the isolation gate.
- **Fix**: Reword the criterion to claim the router side only, name the scratch-project prerequisite, and point to the manual row for the goal.
- **Decision**: APPLIED — Phase 2 Automated Verification, bullet for 2.4 (Progress row title unchanged).

### F4 — Deliberate break covers only the 10x test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Automated Verification, 2.2
- **Detail**: `openspec-skill.test.mjs` honours `OPENSPEC_SKILL_PATH` for the same check, but the plan runs the break only for the 10x skill, so the new OpenSpec test is never shown to fail.
- **Fix**: Add the same run with `OPENSPEC_SKILL_PATH=<scratch copy>` to 2.2.
- **Decision**: APPLIED — Phase 2 Automated Verification, bullet for 2.2.
