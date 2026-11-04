# Route Reviews on Open Findings, With a Confirmation Round — Plan Brief

> Full plan: `context/changes/review-open-findings/plan.md`

## What & Why

The router sends a run back to a re-plan or a `fix` from the pre-edit counts in a review header, even when every finding is `Decision: APPLIED`. In the `worktree-step-commits` run this halted twice and cost about 1.38M subagent tokens. The plan makes the router read the per-finding `Severity` and `Decision` lines, route on what is still open, halt for a human when an owner decision is pending, and add an opt-in, capped confirmation review for self-applied fixes.

## Starting Point

`readReview` (`route.mjs:113-127`) reads the verdict and the header counts only. `decide` re-plans on `REVISE` with a critical or too many warnings and runs `fix` on `NEEDS ATTENTION` (always, with `fixOnNeedsAttention: true`). The apply prompts keep the counts pre-edit, so they never fall after a clean apply. No test fixture has a `### F` block.

## Desired End State

A review with Decision lines routes on open findings: all applied goes on, an open critical or too many open warnings halts with the finding ids. A review with no Decision lines routes exactly as today. `review.confirmRounds` (default 0) can add up to N more reviews of the same kind per run after a review that applied fixes and left nothing open. A halt names the open finding ids and the way back in: set the Decision lines or triage with the review skill, commit the edit in an isolated run, run again. The log, `status` and `report.md` show measured and open counts.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Open means | PENDING, missing or unknown Decision; APPLIED, FIXED (the review skills' triage word), ACCEPTED, SKIPPED, DISMISSED are closed (`closedDecisions`). The word is the first run of letters, so `ACCEPTED-AS-RULE` reads ACCEPTED | A human who triages in the review skill must be able to resume the run without editing words to APPLIED | Plan (adapts change.md "not APPLIED") |
| Open finding after REVISE or NEEDS ATTENTION | Halt for a human; `onOpen: "retry"` re-plans or runs `fix` on open findings above the tolerance (full opt-out: `openFindings.enabled: false`). Under `halt`, the REVISE-to-research loop and `maxPlanRevisions` no longer see a REVISE that has Decision lines | A re-plan subagent must not decide an owner question, as it did in the `worktree-step-commits` run | Change notes #4 |
| RETHINK and REJECTED | Routing unchanged | They judge the approach, not a local fix, and `loops-existing.test.mjs` characterizes them | Change notes #3 |
| No Decision lines | Fall back to today's counts, same `reason` text | Keeps every existing test and plain-string prompt overrides valid with no edit | Change notes #7 |
| Header counts the parse cannot match | Count the surplus as open | A review that lists fewer blocks than its header must not read cleaner than it says | Plan |
| Confirmation round | Opt-in, per rigor level, default 0 at every level, hard cap per review kind per run | Budgets are sized for the shipped longest path, so shipping it on would break them | Plan (change notes: "perhaps 1 at thorough") |
| Confirmation finds something | Same open-findings rule: open halts (or re-plans on `retry`), applied goes on; another confirmation only while the per-run cap N allows (none with N = 1) | One rule to explain, and the cap bounds cost (+2 steps per round, so `budgetDelta` +2 per round) | Plan |
| Confirmation mechanics | Same step name, new template (`plan-review-confirm`, `impl-review-confirm`) | Freshness checks and tier policy key on the step name | Plan |
| Counts in log | `review` field on review entries, measured and open; noisy-review bump keeps measured counts | Tier bumps stay as calibrated; open counts sit beside them | Change notes #6 |
| Decision-word contract | Apply prompts require Severity and a Decision of APPLIED or PENDING with a reason | The router now depends on those lines | Plan |

## Scope

**In scope:** `readReview` and a new open-count helper, `decide` gates for plan review and implementation review, `review` policy keys, two apply prompts, two confirm prompts and templates, log field, `status`, `report.md` section, `SKILL.md`, `README.md`, `AGENTS.md`, ADR-011, new `openfindings.test.mjs` and budget test cases.

**Out of scope:** `loops-existing.test.mjs`, RETHINK, REJECTED, frame and research round routing, `budgetDelta` and other limits, the noisy-review bump, `baseline-policy.json`, the toolkit review skills, checking that an APPLIED claim is true.

## Architecture / Approach

Parse once into `findings`, derive `openCounts(review, policy)` with an `aware` flag, and branch on `aware` at the existing four gates. The unaware branch is the untouched current code. The confirmation round is one more branch beside the gates that returns the same step with a new template and is capped by counting executed entries of that template.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parse findings and log the counts | `readReview` findings, `openCounts`, `review` policy keys, `review` log field, new test file | Parser misreads a real review layout |
| 2. Route on open findings | REVISE and NEEDS ATTENTION routed on open counts, halts, `onOpen`, apply-prompt rules | Unaware path drifts from today's `reason` text |
| 3. Confirmation round | `confirmRounds`, two templates and prompts, budget tests | New step kind breaks the longest-path budget |
| 4. Surface and document | `## Review findings`, `status`, `SKILL.md`, `README.md`, `AGENTS.md`, ADR-011 | Docs and router wording disagree |

**Prerequisites:** none; independent of `worktree-step-commits` (already archived), rebase on `main` if `decide` moves.
**Estimated effort:** ~3-4 sessions across 4 phases.

## Open Risks & Assumptions

- Closing ACCEPTED, SKIPPED and DISMISSED is an assumption that departs from "open means not APPLIED"; it is one policy list, easy to narrow.
- Halting on a pending finding removes the automatic REVISE re-plan for Decision-bearing reviews unless `onOpen` is `retry`; real runs have not shown which default owners prefer.
- Thresholds are uncalibrated. `confirmRounds` ships at 0 and needs a `budgetDelta` raise before use; one pair is an anecdote.
- Behaviour change for a plain-prompt override or an old review: none. Commit type (`feat` or `feat!`) is the owner's call.

## Success Criteria (Summary)

- A review whose findings are all applied no longer re-plans or fixes; a pending finding halts with its id.
- Reviews without Decision lines, and `loops-existing.test.mjs`, behave exactly as before.
- The full suite and the longest-path budget test pass with the shipped policy.
