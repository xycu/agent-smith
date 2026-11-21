<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Restore the shipped Claude-only ladder: README recipe

- **Plan**: context/changes/claude-only-10x-example/plan.md
- **Mode**: Quick (document and grounding checks, plus one scratch `init` run to test the plan's own claim; no sub-agent)
- **Date**: 2026-11-21
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (README.md, docs/REFERENCE.md, policy.json, codex-policy.json, state.mjs, ladder.test.mjs, helpers.mjs, both agents-md tests), symbols ✓ (`providerLadder`, `loadPolicy`, `stepPolicy`, `providerOf`, `makeProject`), brief↔plan ✓. Progress↔Phase consistent (4+1 and 4 rows). No Automated criterion needs a pushed branch, PR, PR CI or PR comment.

## Findings

### F1 — The provider check cannot tell a restored ladder from an unrestored one

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State (5); Phase 1 README contract; Phase 2 test contract
- **Detail**: The recipe's closing check (`init --provider-mode claude`, require `providerMode: "claude"`, all-Claude `providersByStep`, Claude first-step model) and Test 2's `init` assertions also hold before the recipe is applied. A scratch run with the full `codex-policy.json` ladder as the project override and `--provider-mode claude` returned `providerMode: "claude"`, all-Claude `providersByStep` and `model: "sonnet"` for the first step, because `providerLadder` (`state.mjs:120-131`) falls back to the shipped Claude rungs when the override is homogeneous OpenAI. The check therefore proves the run mode, not the restored ladder, and Test 2 can pass without the recipe.
- **Fix**: Make the README check two-part (verify the override's `ladder` has no `provider` key and equals the fence, then read `init` for the run mode), and give Test 2 a negative control: probe `loadPolicy` before the recipe (merged ladder is OpenAI) and after it (equals `policy.ladder`). State that the `init` assertions only confirm a Claude run.
- **Decision**: APPLIED — plan.md: Current State Analysis (review note), Desired End State (5), Phase 1 README contract, Phase 2 test contract; plan-brief.md: Key Decisions, Open Risks.

### F2 — `init` is presented as a check but it starts the run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 README contract; Desired End State (5)
- **Detail**: `init` writes `run.jsonl` and `meta.json` and fixes host and mode for the run (`docs/REFERENCE.md:8`: "Host and mode are fixed for the run"; no in-place conversion, line 21). A reader who runs it "to check" the providers has already started the run, so a wrong ladder found afterwards cannot be fixed in that run.
- **Fix**: Word the README step as "restore and verify the ladder in the file, then start the run with `init`", and say plainly that `init` starts the run and fixes its mode.
- **Decision**: APPLIED — plan.md: Current State Analysis, Desired End State (5), Phase 1 README contract; plan-brief.md: Desired End State, Open Risks.

### F3 — Insertion point is ambiguous and one option swallows two paragraphs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — README Configure recipe
- **Detail**: The plan allowed a `###` subsection "before the missing-price paragraph". That would place the price paragraph and the "Opt-in extras" paragraph under the new heading, and the Phase 2 test and the `### Claude Code subagent depth` test (`nested-subagents.test.mjs:192`) both read by heading, so the position matters.
- **Fix**: Fix the position to directly before `### Claude Code subagent depth`.
- **Decision**: APPLIED — plan.md: Phase 1, README Configure recipe, Intent.

### F4 — The "no SKILL.md changed" command is wrong after a commit and exits 1 on success

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria, Automated (1.3)
- **Detail**: `git diff --name-only | grep -c SKILL.md` diffs only the working tree, so after the phase commit it is empty and proves nothing. `grep -c` prints 0 but exits 1 when nothing matches, so a gate that reads the exit code reports a pass as a failure.
- **Fix**: Use `! git diff --name-only main...HEAD | grep -q SKILL.md`.
- **Decision**: APPLIED — plan.md: Phase 1, Success Criteria, Automated (1.3).

### F5 — The smoke criterion has no runnable command and the leftover-rung claim is untested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria, Automated (2.4); Phase 2 test contract
- **Detail**: Row 2.4 is an Automated criterion with `<id>` and `<text>` placeholders and no pass/fail command. The README prose that a leftover `provider: "openai"` rung keeps its position OpenAI rests on code reading only (`state.mjs:120-131`), with no test behind it.
- **Fix**: Give 2.4 a concrete command that exits 0 on pass, and add a third test that a mixed override keeps the OpenAI rung at its index through `stepPolicy`.
- **Decision**: APPLIED — plan.md: Phase 2, Success Criteria, Automated (2.4), and Phase 2 test contract.
