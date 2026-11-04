<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Route Reviews on Open Findings, With a Confirmation Round

- **Plan**: context/changes/review-open-findings/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: pass (757 tests, 755 pass, 2 skipped) on the code before the fix. After the fix: 758 tests, 756 pass, 2 skipped.
- `node --test skills/10x-pipeline/test/openfindings.test.mjs`: pass (123 tests after the fix).
- `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs` and `git diff --exit-code 5333a53 -- ...`: no diff.
- `node tools/version-check.mjs`: `version-check: OK (0.5.0)`.
- Manual rows 1.5, 1.6, 2.5, 2.6, 3.6, 3.7, 4.6 and 4.7 are pending (unticked). Evidence for 1.6 from this review: the parser, run on `context/archive/2026-11-03-worktree-step-commits/reviews/plan-review.md`, reads `REVISE`, 1 critical and 2 warnings measured, 0 open critical, 0 open warnings, 3 applied. The archived `impl-review.md` of that change reads 0 open from 5 measured warnings. The rows stay pending for a human to tick.

## Findings

### F1 — Decision and Severity parsing is narrower than the plan and ADR-011 state

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:124-126
- **Detail**: The plan (Phase 1, Review parser) and ADR-011 say the decision is "the first run of ASCII letters after `**Decision**:`". The regex `[ \t]*([A-Za-z]+)` accepted only spaces before the word, so `**Decision**: **APPLIED**` or `` **Decision**: `APPLIED` `` read as `null`, which is an open finding. When any sibling block had a decision, that halted the run with an applied finding listed as open. The Severity regex also accepted only `**Severity**`, while the Decision regex accepts both label forms. A `**Severity:** CRITICAL` then read as a warning. The header count guard still turned the critical into an open `unparsed` one, which gave a false halt with a confusing "no ### F<n> block" sentence. Both failures are conservative (a halt, never a cleaner reading), but either one stops an unattended run for nothing.
- **Fix**: Allow non-letters before the Decision word (`[^A-Za-z\n]*`) and accept `**Severity:**`, then add a parser test for the bold word, the backticked word, the `**Severity:**` label and an empty Decision line.
- **Decision**: APPLIED — 71aeb8b (route.mjs `readFindings`, new test "a Decision word in bold or backticks and a **Severity:** label are read" in openfindings.test.mjs; full suite passes)

### F2 — advisor.test.mjs edited outside the plan's file list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/test/advisor.test.mjs:151-157, :243-252, :590
- **Detail**: The plan does not name `advisor.test.mjs`. The diff adds the two confirm templates to its per-template case list and changes the ADR range to `(ADR-001 to ADR-011)`. Both edits are needed for the existing advisor checks to pass with the new templates and with ADR-011. They are benign and change no assertion about the advisor.
- **Fix**: None needed. Optionally mention the file in the PR text.
- **Decision**: PENDING — no code change needed. The owner decides whether to record the extra test edit in the PR text.

### F3 — An open PENDING warning within the tolerance goes on without a halt

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs `openOverTolerance` and its callers in `decide`
- **Detail**: In change.md, starting point 4 says "A PENDING finding that needs an owner decision halts for a human instead of re-planning." The plan (Desired End State) narrows this. Open warnings within `review.reviseToleranceWarnings` (shipped 1) go on, so one PENDING owner-decision warning passes silently into implement or done, visible only in `## Review findings`. The code matches the plan, and README and ADR-011 document it.
- **Fix A ⭐ Recommended**: Keep as planned, because the tolerance is the documented knob.
  - Strength: Matches the plan, README, SKILL.md, ADR-011 and the tests; a project sets the tolerance to 0 to halt on every open warning.
  - Tradeoff: One owner question can go unanswered in an unattended run.
  - Confidence: MED — the plan chose this on purpose, but change.md worded the halt more strictly.
  - Blind spot: How often reviews leave a single PENDING warning in live runs.
- **Fix B**: Halt on any PENDING finding regardless of the tolerance.
  - Strength: Literal reading of change.md starting point 4.
  - Tradeoff: More halts, and it changes the shared-tolerance design and its tests and docs.
  - Confidence: LOW — needs an owner call on the intended semantics.
  - Blind spot: Effect on the budget and halt rate is unmeasured.
- **Decision**: PENDING — the owner decides between the planned tolerance semantics and a strict halt on every PENDING finding (change.md starting point 4).
