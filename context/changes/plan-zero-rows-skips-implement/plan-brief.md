# Plan With No Readable Progress Rows Must Not Skip Implement — Plan Brief

> Full plan: `context/changes/plan-zero-rows-skips-implement/plan.md`

## What & Why

A plan whose Progress rows the router cannot read (`* [ ]`, `1. [ ]`, indented) reads as zero rows. The `plan` step still verifies, the run goes to `impl-review` with "implementation complete" and can finish and open a pull request with a plan and a review but no code. A quoted Progress heading inside a code fence can also hide the real rows. This change makes the router refuse such a plan and read fenced text correctly.

## Starting Point

`readPlan` in `state.mjs` counts `- [ ]` lines at column 0 after the first Progress heading. `flow.mjs` verifies a `plan` step on "has the heading, file is fresh". Only the code re-plans also need a pending Automated row. In a non-isolated run a failed first plan is not asked for again, because the plan already has a Progress heading.

## Desired End State

A `plan` or `plan-revise` step passes only with at least one pending Automated row in `- [ ] N.M title` form. A failed first plan is retried until the attempt limit halts the run. The reader and the findings reader skip code fences. Archived plans read exactly as before. `docs/REFERENCE.md` states the minimum.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Reader strictness | Strict: only `- [ ]` at column 0 counts | The executors tick exactly that line, so a tolerant reader would count rows nobody ticks; one retry is the bounded cost | Plan |
| Fence handling | Fence-state scanning, not "last Progress heading" | A quoted example can sit after the real section, and a fence inside the section must not end it | Plan |
| `readFindings` | Same tracker, same change | The helper is shared and the defect is the same | Plan |
| Verification bar | `autoPending > 0` for `plan` and `plan-revise` | Same bar `verifyCodeReplan` already sets for code re-plans | Change.md |
| Retry of a failed first plan | `decide` schedules `plan` again when no pending or done Automated row was read | Isolated runs roll back, non-isolated runs do not; without this the run still reaches `impl-review` | Plan |
| Row form told to the planner | New always-true rule in `rules/steps/plan.md`, prompts untouched | The prompts are pinned verbatim by tests; the rule file is appended to all four plan templates | Plan |
| User-supplied or all-done plans | Unchanged | The new check is for verifying a fresh plan step only | Change.md |

## Scope

**In scope:** `readPlan` and `readFindings` fence tracking; `plan` and `plan-revise` verification; retry of a failed first plan in `decide`; one rule line; REFERENCE and two index rows; tests.

**Out of scope:** tolerant row forms; the OpenSpec `TASK_ROW`; code re-plan verification; the review verdict parser; policy prompts; existing archives.

## Architecture / Approach

A module-private fence tracker in `state.mjs` marks each line as inside or outside a fence; both readers consult it. In `flow.mjs` the `plan` verification and one `decide` branch change; `tierFor` and the attempt limit already bound the retries. Tests drive the real router through the CLI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fence-aware readers | Tracker, `readPlan` and `readFindings` changes, archive-equivalence tests | A different count on an archived plan |
| 2. Verify and retry | New verification bar, `decide` retry, rule line, CLI tests | Existing fixtures that verify a plan with no pending Automated row |
| 3. Docs, indexes, full suite | REFERENCE bullets, index rows, full suite and smoke check | Wording drift between docs and code |

**Prerequisites:** none; the change touches the Flow lane (`state.mjs` `readPlan`, `flow.mjs` `decide`) after `review-verdict-unknown-passes`, which is merged.
**Estimated effort:** about 1 to 2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumption: no archived or open plan has an unclosed or deeply indented fence; checked on the 98 archived plans, to be re-checked by the equivalence test.
- Assumption: the retry in `decide` does not disturb the fixtures that seed a failed first plan; the full suite decides.
- Risk: `replan-failure-halt-recoverable` also edits `decide`; it comes after this change in the lane.

## Success Criteria (Summary)

- A plan step that writes `* [ ]` rows fails and is asked for again; the run never reaches `impl-review` or `done` without an `implement` step.
- A quoted Progress heading inside a fence no longer hides the real rows, and the 98 archived plans read the same.
- The REFERENCE states the minimum a plan needs to verify and the full suite passes.
