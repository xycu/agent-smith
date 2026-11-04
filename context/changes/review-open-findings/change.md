---
change_id: review-open-findings
title: Route plan and implementation reviews on open findings, with a stopping rule for review rounds
status: planned
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

Route plan-review and impl-review on open findings (Decision not APPLIED) instead of pre-edit counts, and add a stopping rule for review rounds, in both plan-review and impl-review

Context: the `worktree-step-commits` run halted twice with "Plan still REVISE after N revisions. Needs a human." Every review had applied all its own fixes. The run after the first review cost about 1.38M subagent tokens: 3 opus/xhigh re-plans, 3 plan reviews and 1 research round. Across rounds the criticals went 1, 3, 1, 1, each a new finding.

Problem 1, the router ignores the Decision fields:

- `readReview` (`skills/10x-pipeline/scripts/route.mjs:113-127`) reads only the `**Verdict**` line and the `**Findings**` counts.
- `prompts/plan-review-apply.md:6` and `prompts/impl-review-apply.md:6` make the counts pre-edit.
- `decide` re-plans on REVISE with any critical (`route.mjs:859-860`) and runs `fix` on NEEDS ATTENTION with a critical (`route.mjs:900-901`), even when every finding is `Decision: APPLIED`.

Problem 2, there is no stopping rule:

- Each fresh review of a large plan finds new findings, so counting open findings alone would end the loop but leave self-applied fixes unchecked.
- In this run, the later rounds found real bugs: the worktree location, the start commit deleting the run's inputs, and the opt-out path.

Starting points for the plan (proposals, not decisions):

1. Parse each `### F<n>` block: `**Severity**` and `**Decision**`. Open means the Decision is not `APPLIED`.
2. Route REVISE (plan review) and NEEDS ATTENTION (impl review) on the open critical and warning counts.
   - No open critical and open warnings within `review.reviseToleranceWarnings` means plan review goes on to implement, and impl review goes on to done.
   - Impl-review applied fixes are already tested and committed by the apply rules.
3. RETHINK and REJECTED keep their current routing. They judge the approach, not a local fix.
4. A PENDING finding that needs an owner decision halts for a human instead of re-planning.
   - In this run the re-plan subagent decided an owner question (editing `loops-existing.test.mjs`) on its own.
5. Stopping rule: an optional confirmation review, `review.confirmRounds`, defaulting to 0, perhaps 1 at `thorough`.
   - It re-reviews self-applied fixes with no re-plan in between, under a hard cap.
   - Decide in the plan whether a confirmation round that finds new criticals re-plans, goes on, or halts.
6. Keep the measured counts in the log for the tier bumps (noisy plan review, `reviseBump`, `rejectedBump`) and the report. Add the open counts beside them.
7. Fall back to today's behaviour when a review has no Decision lines, for example when a project override replaces a review prompt with a plain string.

Constraints:

- Never edit `skills/10x-pipeline/test/loops-existing.test.mjs`. If the RETHINK/REVISE characterization changes, that is an owner decision to surface, not to make.
- Update the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md` (AGENTS.md coding style).
- The budget tests for the longest legal path must still hold.
- Policy keys go in `policy.json`, camelCase.

Relation to `worktree-step-commits`: independent. It touches `decide` too, so whichever lands second rebases.
