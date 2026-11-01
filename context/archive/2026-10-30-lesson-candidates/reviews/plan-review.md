<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Lesson candidates in the pipeline report Implementation Plan

- **Plan**: context/changes/lesson-candidates/plan.md
- **Mode**: Deep (claims checked directly against the code by the reviewer, no sub-agent)
- **Date**: 2026-11-01
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 3 observations

This is a second review. It replaces the REVISE review of 2026-10-31 (F1 to F6 of that review are resolved in the current plan and are not repeated here).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

8/8 paths ✓ (route.mjs, policy.json, executors.test.mjs, impl-review-warn.md, prompts/README.md, SKILL.md, README.md, ADR-003), 9/9 symbols and line references ✓ (`cleanSignals` at `route.mjs:313` with one caller at `:368`, `attachResult`, `buildReport`, `promptText`, `render`, the `render` call at `:1908-1912`, signal readers at `:460`, `:910`, `:1849`, `policy.json` `suffix` `:151`, `impl-review` `:156`, `impl-review-warn` `:200-203`, `executors.test.mjs` `:275`, `:522`, `:565`, `:567`), brief↔plan ✓, Progress↔Phase ✓ (4 phases, every Success Criteria bullet has a row, no checkboxes in phase bodies). `docs/reference/contract-surfaces.md` and `context/foundation/lessons.md` do not exist: contract-surface check skipped, no priors.

Claims checked against the code:

- SKILL.md Loop step 3 tells the orchestrator to keep every key of `signals` and copy it untouched, so a new key reaches `last-result.json`.
- `deepMerge` merges the new `lessons` block key by key; the other signal readers test single keys only.
- `render` pattern `\{(\w+)\}` leaves the `{"lessonCandidates":[...]}` fragment alone.
- `rules.test.mjs` checks policy prompts as arrays and every file in `prompts/`; strict mode bans a bold keyword and SHALL/REQUIRED/RECOMMENDED/OPTIONAL in prose lines only.
- The `startsWith` checks at `executors.test.mjs:522` and `:565` hold, because `promptText` joins the parts with one newline and `PLAIN_REVIEW` is the trimmed first part.
- ADR-003 has the `lesson-candidates` table row (`:26`), the "Signals" section with "two keys" (`:69`) and a "Sources" list (`:174`); README has the "two keys" sentence; SKILL.md has `done`, `archive` step 1 (`:47`, `:50`), "Rules" and "Tuning".

## Findings

### F1 — Two verification rows are not runnable as written

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Success Criteria 4.2 and 4.3
- **Detail**: Row 4.3 says "`init` and `status` ... print valid JSON" but gives only `status <scratch-id>`, with a placeholder id and no scratch project set up, and it does not pipe to a JSON parser. Row 4.2 uses `git diff -U0 skills/10x-pipeline/SKILL.md`, which compares against the index or HEAD: it is empty (and the row passes vacuously) if the SKILL.md edit was already committed when the row runs, for example on a resumed or retried phase.
- **Fix**: For 4.2 use `git diff -U0 main -- skills/10x-pipeline/SKILL.md | grep -E '^\+' | grep -Ei "opus|sonnet|haiku"`. For 4.3 name the sequence (scratch dir with `context/changes/demo/change.md`, `init demo --goal x`, then `status demo | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"`).
- **Decision**: PENDING

### F2 — Policy override that is not an object is not in the sanitizer tests

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Policy limits (item 1) and Tests (item 3)
- **Detail**: `deepMerge` returns the override as it is when the override value is not an object, so `{"lessons": null}` or `{"lessons": 5}` in `agent-smith-policy.json` replaces the whole default block. `lessonLimits(policy)` is called in `attachResult` and, in Phase 3, at every prompt render. The plan's invalid-value cases are 0, a string and a fraction for the two keys, not a non-object block. If `lessonLimits` reads `policy.lessons.maxCandidates` without an `isObject` guard, a bad override throws on every `next` call, including steps that have nothing to do with lessons.
- **Fix**: State in the contract that `lessonLimits` returns both defaults when `policy.lessons` is not an object, and add `"lessons": null` and `"lessons": 5` to the invalid-override test cases.
- **Decision**: PENDING

### F3 — Dropped and cut candidates leave no trace, so prompt noise cannot be measured

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Manual Verification 3.3; Decisions table ("Over-long candidate", "Run-level bound")
- **Detail**: The plan relies on live runs to judge whether the prompt yields noise ("judge the noise on the first real runs"). But the raw `signals` object never reaches `run.jsonl` (`route.mjs:363`), and the sanitizer drops over-cap, non-string, empty and repeated items without a record. After a real run, nobody can tell whether the subagent sent 3 clean candidates or 12 that were cut, or whether the prompt's length limit is respected. The numbers that would calibrate `lessons.maxCandidates` and `lessons.maxChars` are lost.
- **Fix**: Keep a small count on the stored signal, for example `lessonDropped: <n>` (items offered minus items kept), set only when above 0 and shown nowhere except `run.jsonl`. This also needs one test row and one line in ADR-003. Alternative: accept the gap and say in the ADR that the caps are uncalibrated and unmeasured, as the README does for other word lists.
- **Decision**: PENDING
