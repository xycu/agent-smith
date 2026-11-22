---
change_id: replan-failure-halt-recoverable
title: Let a run continue after a human fixes a failed re-plan
status: archived
created: 2026-11-19
updated: 2026-11-22
archived_at: 2026-11-22T14:44:26Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 12 (should fix). Reproduced through the router CLI in a scratch project.

**The defect.** After two failed `implement` attempts the router runs a `plan-replan` step. When that step fails, `decide` halts for a human (`skills/10x-pipeline/scripts/flow.mjs:768-770`): "The re-plan after 2 failed implement attempts did not produce a valid plan. Needs a human." The check reads only the last log entry (`lastRan?.template === "plan-replan" && !lastRan.ok`). That entry never changes, so every later `init` or `next` halts with the same text, whatever the human fixes.

**Reproduced.** Plan ok, plan review ok, `implement` failed twice, `plan-replan` failed, halt. Then:

- a row was appended to `plan.md` and `init` was run: the same halt;
- `next`: the same halt;
- `plan-review.md` was touched and `init` was run: the same halt.

The plan-review freshness check that runs before it compares log indexes, so editing files does not help. The only exit is to delete `reviews/plan-review.md`, and `docs/REFERENCE.md` (line 261) names no exit.

**What is covered.** The halt itself has a test (`codereplan.test.mjs:120`). The resume after it has none.

**Direction (for the plan to confirm).** Halt once, then mark the log entry as acknowledged, the way `needsHumanAck` works for a step that asked for a human (`skills/10x-pipeline/scripts/route.mjs:126-127`). On the next `init` or `next`, route from the files: a plan with pending Automated rows goes on to `implement`, and a plan that is still invalid halts again with the reason.

**Constraints.**
- `route.mjs` and the modules it imports own `run.jsonl`; the acknowledgement is written by the router, never by hand or from a skill.
- The limits stay: the re-plan count and the implement attempt count are not reset by the acknowledgement unless the plan says so and explains why.
- The halt text tells the human what to do before running the pipeline again.

**Done when.**
- A test: after the failed re-plan halt, a human edit that gives the plan pending rows lets the next `init` return a step instead of the same halt.
- A test: without any edit, the second call halts again and says why.
- `docs/REFERENCE.md` describes the exit.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
