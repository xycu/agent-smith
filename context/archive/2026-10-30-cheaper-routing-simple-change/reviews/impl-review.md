<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cheaper Routing for a Simple Change

- **Plan**: context/changes/cheaper-routing-simple-change/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Failed-step guard skipped on the plan step

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:263
- **Detail**: The `plan` branch of `simpleSignal` returns before the `!log.some((e) => e.ok === false)` check. With `--size s`, a failed first plan retries at 4 - 1 (size) + 1 (failure) - 1 (discount) = tier 3, and the third attempt lands on tier 4 instead of 5. The discount cancels the per-failure escalation. SKILL.md and the plan Overview say the discount is withheld after any failed step.
- **Fix**: Apply the same `!log.some((e) => e.ok === false)` guard in the `plan` branch.
- **Decision**: FIXED (Fix now)

### F2 — Docs overstate the plan-step rule and hide the `--size s` stacking

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md:64, README.md:32
- **Detail**: The bullet says a plan with at most 1 phase and 6 rows takes -1 on "plan, plan review, implement and implementation review". The plan step can never use the plan-size test because no plan exists yet; for `plan-revise` it never applies. Only `--size s` on the first plan triggers it. Also, on that path `--size s` counts twice (`sizeBump` -1 plus the discount -1, base 4 to tier 2). This is what plan row 2.4 expects, but the docs list `--size: s = -1` and the simple bullet separately and never say they stack.
- **Fix A ⭐ Recommended**: Reword SKILL.md:64 so the plan step is "`--size s` on the first plan only" and other steps use the 1 phase / 6 rows test, and note that `--size s` stacks with the `--size` bullet on the first plan.
  - Strength: Matches the code and plan row 2.4 exactly; no behaviour change, no risk.
  - Tradeoff: The stacking stays, so `--size s` cuts the first plan by two tiers.
  - Confidence: HIGH — plan row 2.4 and `minTier` 2 on `plan` were set for this result.
  - Blind spot: None significant.
- **Fix B**: Drop the `plan` discount (set `discount.plan` to 0) and keep `sizeBump` as the only `--size s` effect.
  - Strength: Removes the double count; `plan` would then land on sonnet/high.
  - Tradeoff: Contradicts plan row 2.4 and the Desired End State (plan on sonnet/medium).
  - Confidence: MEDIUM — depends on whether the first plan should be that cheap.
  - Blind spot: Not checked against the S-06 baseline comparison.
- **Decision**: FIXED (Fix A)

### F3 — Discount has no effect on `implement` after a clean review

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:216, 285
- **Detail**: Clean `SOUND` review plus simple change: 3 - 1 - 1 = 1, clamped to `minTier` 2, the same tier as without the discount. `tierWhy` prints `-1 simple change` then `clamped to 2`. The plan keeps `implement.minTier` at 2 on purpose.
- **Fix**: None needed; optionally note it in the docs.
- **Decision**: FIXED (docs note in SKILL.md)

### F4 — `simple: true` logged on a step that got no discount

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:340
- **Detail**: `fix` has discount 0, yet its log entry and `status` row show `simple: true`. The plan defines `simple` as the classification, so this matches the plan, but a reader may assume a discount applied.
- **Fix**: Leave as is, or store `simple && discount > 0`.
- **Decision**: FIXED (Fix now: `simple` is stored as `discount > 0`)

### F5 — First failure on a simple change moves the retry up two tiers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:267-268
- **Detail**: A failed step loses the -1 discount and gains +1 for the failure, so the retry jumps two tiers (seen in scenario 2.6: tier 1 to 3). The withholding is documented; the two-tier jump is not.
- **Fix**: Optionally add a half-sentence to SKILL.md; no code change.
- **Decision**: FIXED (docs note in SKILL.md)

### F6 — `rows` counts checklist lines after `## Progress`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:71-77
- **Detail**: The loop reads from `## Progress` to the end of the file, so a checklist under a later `##` heading inflates `rows`. It is fail-safe (it only withholds the discount), but the docs say "`## Progress` rows".
- **Fix**: Optionally stop counting at the next `^## ` heading.
- **Decision**: FIXED (readPlan stops at the next `## ` heading)
