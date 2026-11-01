<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Lesson candidates in the pipeline report

- **Plan**: context/changes/lesson-candidates/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

Commits reviewed: dc172dc (p1), e545631 (p2), 1a080f1 (p3), 638e5f7 (p4), 664d4e9 (epilogue), plus 92313ed (ADR-007, in range but outside the plan). Every Automated row is ticked; Manual rows 2.3, 3.3 and 4.4 are pending and need a human (3.3 needs a live run).

Automated checks run for this review:

| Check | Result |
| --- | --- |
| `node --test skills/10x-pipeline/test/*.test.mjs` | pass on the second run: 426 tests, 424 pass, 0 fail, 2 skipped. The first run had one failure in `pr-comment.test.mjs` (see F5). |
| `node --test skills/10x-pipeline/test/lessons.test.mjs` | pass: 29 of 29 |
| `node -e "JSON.parse(...policy.json...)"` | pass |
| `git diff -U0 dc172dc^..HEAD -- skills/10x-pipeline/SKILL.md \| grep -Ei "opus\|sonnet\|haiku"` | prints nothing (pass) |
| `init` and `status` on a scratch change folder | both print valid JSON (pass) |

The code matches the plan contract: `lessonLimits`, `cleanLessonCandidate` and `cleanLessonCandidates` in `route.mjs:345-384`, `cleanSignals(raw, policy, step)` and its call site at `route.mjs:445`, `lessonLines` at `route.mjs:228-255`, the `render` variables at `route.mjs:1990`, the `lessons` policy block, both review templates wired, the two edits in `executors.test.mjs`, and the docs listed in Phase 4. An `impl-review-warn` entry keeps the step name `impl-review` (`route.mjs:1398` sets only `template`), so its candidates are sanitized too.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — ADR-003 has a stale skeleton line and a broken code span

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/ADR/ADR-003-rigor-gated-routing.md:17, docs/ADR/ADR-003-rigor-gated-routing.md:416
- **Detail**: Line 17 still says "This ADR is a skeleton: changes 1 and 4 are written in full, changes 2, 3 and 5 only listed." Change 5 now has a full `## Lesson candidates` section, and change 3 already had one (`## Phase executors and manual verification`), so the line contradicts the table below it. The plan's Phase 4 contract did not name this line, which is why it was missed. Separately, the "Report section" paragraph writes the bullet shape as `` `- `/10x-lesson <seed>` (step <n>)` `` with single backticks. The inner backticks close the span early, so `<seed>` and `<n>` fall outside any code span and GitHub drops them as unknown HTML tags. The README writes the same shape correctly with double backticks.
- **Fix**: Change line 17 to say that changes 1, 3, 4 and 5 are written in full and change 2 is only listed, and write the bullet shape in the "Report section" paragraph with double backticks, as the README does.
- **Decision**: PENDING

### F2 — Unplanned ADR-007 commit inside the change range

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md (commit 92313ed)
- **Detail**: Commit 92313ed sits between p1 and p2 and splits five ADR-007 rule lines into one bold keyword each. The plan does not mention it. It is benign: the commit message says the earlier ADR-007 commit (07dcce1) failed `rules.test.mjs`, so without it the Phase 2 to 4 suite checks could not pass. It is still a change of S-11's ADR made on this branch.
- **Fix**: Leave the commit as it is and mention it in the PR description as a suite repair outside the plan.
- **Decision**: PENDING

### F3 — Roadmap status edit is uncommitted and the plan's claim about it is wrong

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/roadmap.md:55, context/foundation/roadmap.md:215
- **Detail**: The plan ("What We're NOT Doing") says S-10 "is already `planning` in the working tree". The committed roadmap has S-10 `proposed`, and the working tree has an uncommitted edit to `in-progress` (two places plus `updated`). Meanwhile `change.md` says `implemented`, and the next-step table at `roadmap.md:245` still says "no plan yet". The roadmap is outside the plan's file list, so nothing in the change is wrong, but the uncommitted edit can be lost or committed by accident with the change folder.
- **Fix**: Commit the roadmap edit on this branch (set S-10 to the status `/10x-roadmap` expects for an implemented slice), or drop it, before the archive step.
- **Decision**: PENDING

### F4 — Docs use "characters" where the code counts code points

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/SKILL.md:113, skills/10x-pipeline/prompts/impl-review-lessons.md:6, AGENTS.md:25
- **Detail**: The README and ADR-003 say the cut is at `lessons.maxChars` code points; `SKILL.md` and the prompt say "characters". For the prompt this is intended (a subagent cannot count code points), but `SKILL.md` describes router behavior and should match the README. Also, `AGENTS.md:25` now lists `impl-review-lessons.md` among "prompts of the phase executors and `manual-verify`", which it is not. Both are wording only; the manual row 4.4 (same caps, key and rule in README, `SKILL.md` and ADR-003) otherwise holds.
- **Fix**: Say "code points" in the `SKILL.md` bullet, and widen the `AGENTS.md` line to "prompts of the phase executors, the implementation review and `manual-verify`".
- **Decision**: PENDING

### F5 — Flaky timeout test in pr-comment.test.mjs

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/pr-comment.test.mjs:387, skills/10x-pipeline/test/pr-comment.test.mjs:391
- **Detail**: The first full-suite run failed one assertion: actual `gh timed out`, expected `/^comment request failed: gh timed out$/`. The second run passed. The test uses `--timeout-ms 300`; with the whole suite running in parallel, an earlier `gh` call (before the comment request) can hit the 300 ms limit first, which changes the skip reason. This change does not touch `pr-comment.mjs` or its tests, so it is not a regression here. It does make the plan's "whole suite passes" rows (3.1, 4.1) depend on load.
- **Fix**: Give the stubbed calls before the comment request no delay and keep the 300 ms limit for the comment request only, or raise the limit in those two cases; track it as a separate change.
- **Decision**: PENDING
