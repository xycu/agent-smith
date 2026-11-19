---
change_id: plan-zero-rows-skips-implement
title: Stop a plan with no readable Progress rows from skipping the implement step
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 2 (must fix). Case A reproduced with a full CLI run in a scratch project; case B reproduced by importing `readPlan`.

**The defect.** `readPlan` in `skills/10x-pipeline/scripts/state.mjs:268-288` finds the first `## Progress` heading and counts rows that match `^- \[( |x|X)\] ` at column 0. Two places then trust a count of zero:

- `skills/10x-pipeline/scripts/flow.mjs:572` verifies the `plan` step on `plan.hasProgress` and a fresh mtime alone (only the code re-plan templates add `verifyCodeReplan`).
- `flow.mjs:773` runs `implement` only when `plan.autoPending > 0`. Zero pending rows reads as "implementation complete".

**Case A (reproduced).** The plan step writes its rows as `* [ ] 1.1 ...`, as `1. [ ] ...`, or indented under a list. `readPlan` returns `rows: 0`. The plan step is recorded `verified: true`; the plan review runs with the reason `(1 phase, 0 rows)`; the next step is `impl-review` with the reason `implementation complete`; an `APPROVED` review returns `{"action":"done"}`. No `implement` step ran.

**Case B (reproduced on the reader).** The plan body quotes the Progress format inside a code fence before the real section. `text.search` takes the first `## Progress`, and the loop stops at the next `## ` heading, so the real section is never read. With two pending rows in the real section the result is `{"phases":1,"rows":1,"autoDone":1,"autoPending":0}`. This has not happened yet: each of the 92 archived plans has exactly one `## Progress`.

**The chains disagree.** The OpenSpec chain halts on zero task rows (`skills/openspec-pipeline/scripts/openspec.mjs:176`), and its `TASK_ROW` (line 11) accepts `*`, `+`, numbered items and indentation.

**Why it matters.** An unattended run can finish and open a pull request that holds a plan and a review, and no code.

**Direction (for the plan to confirm).**
- `flow.mjs:572`: the `plan` and `plan-revise` templates verify only when the plan has at least one pending Automated row, as `verifyCodeReplan` already requires for re-plans. The step then fails and retries instead of skipping code.
- Decide whether `readPlan` should accept the same row forms as `TASK_ROW`, or stay strict and rely on the failed verification. Being strict keeps one written format; being tolerant avoids a wasted retry. Pick one and say why.
- For case B: take the last `## Progress` heading, or track code-fence state while scanning. The same fence blindness exists in `readFindings` (`state.mjs:321-327`), where a `###` line inside a fence cuts a finding block and drops its `**Decision**`; fix both in the same way if the plan takes the fence route.

**Constraints.**
- A plan whose rows are all done on purpose (a resumed run after the code is written) must still route to review; the new check applies to verifying a fresh `plan` step, not to every read of the plan.
- The prompt and rule files for the plan step (`skills/10x-pipeline/prompts/`, `skills/10x-pipeline/rules/steps/`) state the row format; keep them and the reader in agreement.
- Archived plans must read the same as before: run the reader over `context/archive/*/plan.md` (read-only) and compare the counts.

**Done when.**
- A test where the plan step writes `* [ ]` rows: the step does not verify, and the run never reaches `impl-review` or `done` without an `implement` step.
- A test for a quoted `## Progress` inside a code fence before the real section: the real rows are counted.
- `docs/REFERENCE.md` states the minimum a plan needs to verify.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
