# ADR-011: Route reviews on open findings, halt on a pending owner decision, and add an opt-in confirmation round

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-04
- **Deciders:** unattended implementation run of change `review-open-findings`; the repository owner confirms or changes the readings below
- **Origin:** change `review-open-findings` (`context/changes/review-open-findings/change.md`, `plan.md` and `reviews/plan-review.md`). It changes the `REVISE` and `NEEDS ATTENTION` gates of `decide` (ADR-003, ADR-001) and leaves `RETHINK`, `REJECTED`, the frame round and the research round as they were.

## Context

- Both reviews apply their own fixes (`prompts/plan-review-apply.md`, `prompts/impl-review-apply.md`) and mark each finding `Decision: APPLIED` or `Decision: PENDING`. The `Verdict` and `Findings` header counts stay as measured before the edits, because the noisy-review bump and the clean-review drop read them.
- `decide` read only those header counts. A plan review `REVISE` with a critical, or with more warnings than `review.reviseToleranceWarnings`, re-planned. An implementation review `NEEDS ATTENTION` ran `fix` on a critical, or on any `NEEDS ATTENTION` while `review.fixOnNeedsAttention` was `true`. A review whose every finding was already applied therefore still sent the run to a re-plan or a `fix`.
- A re-plan is a subagent that cannot make an owner decision. A finding left `PENDING` because it needs one was re-planned around, and the next review found new things.
- Review files carry per-finding blocks (`### F<n>`, `- **Severity**: ...`, `- **Decision**: ...`). The review skills write `PENDING`; human triage writes `FIXED`, `SKIPPED`, `ACCEPTED`, `DISMISSED` and, in the implementation review skill, `ACCEPTED-AS-RULE: <title>`. Older hand-written lines start with `Accepted.`, `Fix (<sha>):`, `Skip` or `Deferred`.
- Every test fixture written through `writeReview` has a header and no `### F` block, and `loops-existing.test.mjs` characterizes `RETHINK` and `REVISE` on such files. Nothing may change for them.

## Evidence

| Source | What it shows |
| --- | --- |
| Run of change `worktree-step-commits` (`context/archive/2026-11-03-worktree-step-commits/`, `agent-smith/report.md`) | The run halted with `Plan still REVISE after 3 revisions. Needs a human.` after 9 steps: three `opus/xhigh` re-plans, four plan reviews and one research round. `change.md` of this change records the same pattern as two halts, about 1.38M subagent tokens after the first review, and criticals of 1, 3, 1, 1 across rounds, each a new finding. The archived log holds no token figures, so the 1.38M is the owner's figure from `change.md`, not one this ADR re-derived. |
| The same archive, `reviews/plan-review.md` | The last review reads `1 critical, 2 warnings` in its header and marks every one of its findings `APPLIED`. The header counts are pre-edit by design, so they cannot tell an applied critical from an open one. |
| Run of this change (`agent-smith/run.jsonl`, step 3 and step 4) | The step 3 plan review applied all six of its findings (0 critical, 4 warnings, 2 observations; tolerance 1). The router still logged `plan review REVISE (0 critical, 4 warnings)` and sent step 4 to a `plan-revise` re-plan on `opus/xhigh`. |
| `context/archive/*/reviews/` | 67 `Decision` lines read `FIXED` and 28 read `APPLIED`, so a parser that knew only `APPLIED` would read a human triage as open findings. |

## Decision

Open findings decide the route. The measured header counts remain the fallback and keep feeding the bump and the drop. Rules, written as scenarios (the form of ADR-004):

### Reading a review

**GIVEN** a review file **WHEN** the router reads it **THEN** it **MUST** record every `### F<n>` block, which runs to the next `##` or `###` heading, with its severity and its decision.

**GIVEN** a `**Decision**:` line **WHEN** the router reads it **THEN** it **MUST** take the first run of ASCII letters after the colon, upper-cased, as the decision, so `APPLIED - abc1234` reads `APPLIED`, `Accepted.` reads `ACCEPTED` and `ACCEPTED-AS-RULE: <title>` reads `ACCEPTED`.

**GIVEN** a finding of severity CRITICAL or WARNING **WHEN** its decision is in `review.openFindings.closedDecisions` (default `APPLIED`, `FIXED`, `ACCEPTED`, `SKIPPED`, `DISMISSED`) **THEN** the router **MUST** count it closed.

**GIVEN** a finding of severity CRITICAL or WARNING **WHEN** its decision is missing, `PENDING` or a word outside that list **THEN** the router **MUST** count it open.

**GIVEN** a block whose `**Severity**` line names none of CRITICAL, WARNING or OBSERVATION **WHEN** the router counts findings **THEN** it **MUST** count the block as a warning.

**GIVEN** a finding of severity OBSERVATION **WHEN** the router counts open findings **THEN** it **MUST NOT** count it, whatever its decision.

**GIVEN** a header count larger than the CRITICAL or WARNING blocks the file lists **WHEN** the router counts open findings **THEN** it **MUST** add the difference as open.

**GIVEN** `review.openFindings.enabled` is not `true`, or no block carries a `Decision` line **WHEN** a review is routed **THEN** the router **MUST** use the measured header counts and the routing, reason text and tier it had before this change.

### Plan review

**GIVEN** a `REVISE` whose review has `Decision` lines **WHEN** no critical is open and the open warnings are at most `review.reviseToleranceWarnings` **THEN** the router **MUST** go on to implement with no re-plan.

**GIVEN** a `REVISE` whose review has `Decision` lines and open findings above the tolerance **WHEN** `review.openFindings.onOpen` is `halt` **THEN** the router **MUST** halt with the open finding ids and the way back in: set each `Decision` in the review file or triage with `/10x-plan-review`, then run again.

**GIVEN** the same review **WHEN** `onOpen` is `retry` **THEN** the router **MUST** re-plan through the revision path with a `reason` that carries the open counts.

**GIVEN** a halt for open findings in an isolated run **WHEN** the router words it **THEN** the text **MUST** tell the owner to commit the edit in the run worktree first, because a failed step rolls back to its `startSha` and would restore the open lines.

**GIVEN** a plan review `RETHINK` **WHEN** the router routes it **THEN** it **MUST** keep the routing it had, including the frame round.

### Implementation review

**GIVEN** a `NEEDS ATTENTION` whose review has `Decision` lines **WHEN** no critical is open and the open warnings are at most `review.reviseToleranceWarnings` **THEN** the router **MUST** end the run as done with no `fix` step, whatever `review.fixOnNeedsAttention` says.

**GIVEN** a `NEEDS ATTENTION` whose review has `Decision` lines and open findings above the tolerance **WHEN** `onOpen` is `halt` **THEN** the router **MUST** halt with the open finding ids and the way back in.

**GIVEN** the same review **WHEN** `onOpen` is `retry` **THEN** the router **MUST** run `fix`.

**GIVEN** a `NEEDS ATTENTION` whose review has no `Decision` line **WHEN** the router routes it **THEN** it **MUST** apply `review.fixOnNeedsAttention` as before.

**GIVEN** an implementation review `REJECTED` **WHEN** the router routes it **THEN** it **MUST** keep the code re-plan, the fix-loop cap and the tier bump it had.

### Confirmation round

**GIVEN** `review.confirmRounds` for the run's rigor level is `N` above 0 **WHEN** an aware plan review `REVISE` (before implementation starts) or implementation review `NEEDS ATTENTION` applied at least one critical or warning fix, left nothing open, and fewer than `N` confirmations of that kind have run **THEN** the router **MUST** return one more review of the same kind, with the same step name and the template `plan-review-confirm` or `impl-review-confirm`.

**GIVEN** the executed entries of a run **WHEN** the router counts confirmations of a kind **THEN** it **MUST** count every entry with that template, failed ones included, so `N` bounds the chain.

**GIVEN** a `RETHINK`, a `REJECTED`, a review without `Decision` lines, or a level whose `confirmRounds` value is 0 or not a non-negative integer **WHEN** the router routes the review **THEN** it **MUST NOT** return a confirmation.

**GIVEN** a confirmation review **WHEN** the router routes it **THEN** it **MUST** apply the same open-findings rules as to a first review, so an open finding halts or retries and a clean one goes on.

### Log entry

**GIVEN** a verified `plan-review` or `impl-review` step **WHEN** the router completes its log entry **THEN** it **MUST** store `review` with the verdict and the measured counts, and the open counts only for a review with `Decision` lines.

## What each rule covers

- Policy keys, all under `review` and read tolerantly (a value of the wrong shape reads as the shipped default, a non-boolean `enabled` reads as off, nothing halts): `openFindings: { enabled: true, closedDecisions: [...], onOpen: "halt" }` and `confirmRounds: { lean: 0, standard: 0, thorough: 0 }`. `review.openFindings.enabled: false` is the full opt-out.
- `review.reviseToleranceWarnings` (shipped 1) now bounds the open warnings of both reviews. Before, it bounded the plan review only. An aware implementation review with open warnings within it goes to done, and those warnings stay visible in `## Review findings` of `report.md`, whose lines read `- step <n> <step>[ (confirmation)]: <VERDICT>, <c> critical, <w> warnings measured[; <oc> critical, <ow> warnings open]`. `review.fixOnNeedsAttention` applies only to a review without `Decision` lines.
- The router does not judge whether a `Decision` claim is true and does not check that an `APPLIED` finding names a commit. The confirmation round is the opt-in check of that claim, made by a reviewer.
- The confirmation round keeps the step name (`plan-review`, `impl-review`), so the freshness checks and the tier policy of the first round apply. Only the template differs. The confirm templates carry the base review text, the confirm prompt and the apply prompt (the implementation one also the lessons prompt) and ignore `reviewWarning`.
- Unchanged: the noisy-review bump and the clean-review drop read the measured counts, `RETHINK` and `REJECTED` routing, `rigor.budgetDelta`, `extraSteps.allowance` and `limits`, `baseline-policy.json`, and `loops-existing.test.mjs`.

## Consequences

- Behaviour change: a `REVISE` or `NEEDS ATTENTION` whose findings are all closed now continues instead of re-planning or running `fix`, and an open finding now halts instead of re-planning. `onOpen: "retry"` restores the old reaction to open findings above the tolerance. It does not bring back a re-plan for an all-applied `REVISE`, nor a `fix` for a `NEEDS ATTENTION` with nothing open or open warnings within the tolerance. The owner decides at commit time whether it ships as `feat` or `feat!` (`AGENTS.md`, "Commits").
- REVISE loops: under the default `halt`, a `REVISE` that carries `Decision` lines never re-plans. The `preplan.loops` REVISE-to-research loop (`loops.reviseResearchAfter`) and the `limits.maxPlanRevisions` cap therefore act on a `REVISE` only for a review without `Decision` lines or with `onOpen: "retry"`. `RETHINK` still reaches both. A run that used to reach the revision cap by re-planning around a pending finding now halts earlier, on that finding.
- The confirmation round ships off because `rigor.budgetDelta` is sized for the longest legal path (`budget-executors.test.mjs`). Each round adds one `plan-review` and one `impl-review` step to that path. A project that turns it on raises `rigor.budgetDelta` by 2 per round at each level that turns it on; a test measures the 2N steps and the point at which the shipped delta stops leaving room for a failed step and its retry.
- A run in flight keeps working: a review with no `Decision` lines routes as before, and one that already has them is routed on its open findings from the next `next` call. The policy gains keys and the two apply prompts and the two confirm templates change, so such a run records `provenance.drift` for `review` and `prompts` at its next `next` call, and `compare` warns `provenance-drift:<side>:prompts,review`. That is expected and changes no routing.
- A project override that replaces a review prompt with a plain string produces no `Decision` lines and keeps the old routing.
- The router still never calls a model and never reads anything outside the change folder for this decision. `AGENTS.md` Hard Rules are unchanged: no new git write, no new network call, no new dependency.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Make the apply prompts rewrite the `Findings` header to post-edit counts | rejected | The noisy-review bump and the clean-review drop read the measured counts, the verdict loses its meaning as a measurement, and a model that rewrites its own count is a second place for the claim to be wrong. |
| Keep re-planning on a `REVISE` with open findings | rejected | A pending finding needs an owner decision that a re-plan subagent must not make; the `worktree-step-commits` run spent about 1.38M tokens that way. `onOpen: "retry"` keeps it as an opt-in. |
| Halt for every `REVISE`, applied or not | rejected | It would stop a run that has nothing left for a human, which is the case the step 3 plan review of this change shows. |
| Keep `review.fixOnNeedsAttention` for an aware review | rejected | A `fix` step for a review whose findings are all applied or tolerated repeats work already committed by the review step, and the next review finds new warnings. The tolerance now bounds both reviews. |
| Confirmation round on by default | rejected | It adds two steps to the longest legal path and breaks the budget sizing. It ships off and states its cost. |
| Count only `APPLIED` as closed | rejected | 67 of the 95 `APPLIED` or `FIXED` `Decision` lines in the archive read `FIXED`, so a human who triages and resumes would be halted again. |
| Let the router verify an `APPLIED` claim against git | rejected | It would need a mapping from finding to commit and file that the review files do not carry; the confirmation review is the check. |

## Unverified assumptions

- No live run has used the halt text, `onOpen: "retry"` or a confirmation round. The wording of the way back in is checked by tests and by reading, not by an owner on a halted run.
- The word lists are the ones the review skills write today. A skill that changes its triage words needs `review.openFindings.closedDecisions` updated; an unknown word reads as open and halts.
- Whether a confirmation round finds problems that the first round missed, and whether that is worth its tokens, is not measured. The default stays 0 until a project reports a run.
- The tolerance of 1 for both reviews is the plan review's shipped value. Whether the implementation review wants a different tolerance is the owner's call; the shared key is the smaller change.
