# ADR-019: Attach a late usage figure with a router command

- **Status:** Accepted (the repository owner accepted it on 2026-11-10; no live run has used the command yet)
- **Date:** 2026-11-10
- **Deciders:** the repository owner (GitHub issue #71, which chose suggestion 2); unattended plan and implementation runs of change `late-step-usage` for the readings below
- **Origin:** change `late-step-usage` (`context/archive/2026-11-10-late-step-usage/change.md`, `plan.md` and `reviews/plan-review.md`), GitHub issue #71 "late usage figure". It builds on ADR-010 (isolated run, step commits, rollback) and on the archive commit of `docs/REFERENCE.md`; no earlier decision is superseded.
- **Number:** ADR-018 is taken by the change `no-nested-subagents`, so this record is ADR-019.

## Context

- Run reports showed `-` in the Tokens column for most steps, although every subagent reported its usage. A subagent that handed its report back as a message reports its figure in the `<usage>` block of the task notification that says it finished. That notification often arrives after the orchestrator has written `last-result.json` and run `next`.
- Anti-stall rule 2 makes the orchestrator write the result file without `usage` and run `next` in the same turn. Rule 3 forbade using a figure that arrives later, so the step kept `-`. Whether a step kept its figure depended on tool batching and message order.
- Both chains store a figure through `attachResult` and `cleanUsage` in `flow.mjs`, and both skills carry the same `## Anti-stall rules` section, so the loss hit the OpenSpec chain too.
- The issue offered two fixes. Suggestion 1: write the result file in its own call and wait for the notification before `next`. Suggestion 2: a router command that attaches a late figure to a logged step.
- `run.jsonl`, `meta.json` and `report.md` are written by the router only. The `archive` action commits the change folder before the archive subagent moves it, so a write into that folder after the commit leaves it dirty and the archive refuses.

## Decision

### The command (D1)

**GIVEN** a figure reached the orchestrator after `next` ran for its step **WHEN** the orchestrator wants to keep it **THEN** it **MUST** call `route.mjs usage <change-id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]`, a command of the router, because the router owns the log.

The command validates the figure with the same `cleanUsage` as a result file, so a late figure and an on-time one cannot differ. It attaches to the executed step `<n>` and marks the entry `usageLate: true`. Suggestion 1 was not taken: it only lowers the odds of the wrong order, and it depends on a message the orchestrator cannot wait for (anti-stall rule 1).

### Guards (D2)

**GIVEN** the arguments, the change or the step are wrong **WHEN** the command runs **THEN** it **MUST NOT** write anything, and it prints `attached: false` with a `reason` and exits 1.

The arguments are checked first: `<n>` is a positive integer that directly follows the change id, every flag is a non-negative integer and at least one flag is given. Then the guards run in this order: a change that is not archived, a change folder for the OpenSpec chain, a run log, a logged step and a step with a result. A step with no result is refused, because its figure belongs in its result file. A figure is never overwritten: an equal figure answers `unchanged: true`, a different one is refused. The router cannot tell which step a notification belongs to, so a wrong `<n>` is accepted when that entry has no figure; the orchestrator recovers `<n>` from the earlier matched launch. Before a Claude call, inspect the exposed Agent schema: set `run_in_background` to `false` only when declared, otherwise omit it. Always supply `description` as `agent-smith <change-id> step <n> <step>` for a numbered step, or `agent-smith <change-id> archive` for archive (OpenSpec uses `<change-name>`). Record the exact description, router change, number and step for each invocation, with any returned agent id. A known agent id selects its recorded launch and any supplied description must agree. Otherwise the exact description must identify one recorded launch uniquely, with no conflict against its known id; associate a newly supplied id when that unique launch has no recorded id. Keep separate invocation records even when a neutral retry repeats the description. Only the awaited invocation can supply its completion: superseded invocations and ambiguous description-only notifications cannot advance it. Confirm its full recorded change, number and step against the exact description; the printed `Step <n>` line only corroborates it, never the latest step or a repeated step name. The same identity check governs on-time and late usage. Loop step 4 takes figures only from the current invocation's result or its matched notification. An earlier numbered step's figure follows the late-usage path, even when already present as the current report arrives; unmatched or ambiguous figures remain unattached. Without a matched current figure, omit `usage` and run `next` in the same turn. Archive-agent usage belongs only in the final message.

### Ended runs (D3)

**GIVEN** the run has ended **WHEN** a figure is attached **THEN** the router **MUST** write `report.md` again, so the Tokens column, the totals and the cost estimate include it.

A run in progress gets no report. A refused call leaves the change folder byte-identical (a snapshot test checks it).

### Archive state (D4)

**GIVEN** the run ended in `done`, started with `--archive`, and its folder is committed for the archive **WHEN** a figure is attached **THEN** the router **MUST** commit the change folder again before it answers.

The command checks first, before the first write: a non-blank `archive.usageMessage`, the git safety checks of the archive commit (nothing staged, a symbolic HEAD, no merge, rebase, cherry-pick or revert in progress), the run branch of an isolated run and a clean change folder. It then writes the log and the report and commits the folder as `chore(<id>): add late usage figure of step <n>` (`archive.usageMessage`), with the folder-only checks of the archive commit. This is its only git write. Hooks and signing apply, nothing is pushed, and no `--no-verify` is used. The commit adds one record to the git writes listed next to ADR-010 in `AGENTS.md`.

**GIVEN** the commit does not exist after a failure **WHEN** the command answers **THEN** it **MUST** put the old bytes of `run.jsonl` and `report.md` back, so the change folder is as committed.

A commit that exists but fails a later check answers `attached: true` with a `reason`. In an isolated run a following `next` resumes the `archive` action with `commit: null`, because HEAD is no longer the pre-archive commit and nothing is left to stage.

### Cut-off points (D5)

**GIVEN** a run has reached the pull request step or the archive subagent launch **WHEN** a figure arrives after that point **THEN** the orchestrator **MUST** drop it, because the branch is pushed or the folder is about to move.

Both skills call the command first in the `done` and `halt` branches, before `status` and the pull request step, and in step 1 of the `archive` branch, before `status`, so the committed `report.md` shows the figure. Rule 3 of `## Anti-stall rules` carries the rule in one line and the two skill sections stay equal. The command is a call of its own, never alongside another router call. A refusal is no fault of the orchestrator: it writes no `orchestrator-error` result for it, and it never changes the run.

### Rollback (D6)

The rollback of an isolated run and its undo on halt write the in-memory log back. A figure attached before `next` therefore survives both. The command itself makes no commit in a run outside the archive state: the next step commit, or the leftover commit of the pull request step for an ended run, holds the figure.

## Assumptions

- A notification that arrives before the pull request step is the common case. The cut-off points are chosen so a figure that arrives later costs a push or a second archive attempt, not a wrong report.
- The 7-character `commit` of the output is the short hash of the new commit, or `null` when no commit was made.
- Not run live: no real orchestrator has called the command from a task notification yet.

## Consequences

- A step keeps its figure when its notification arrives before the pull request step, in either order of messages. `compare` reads fewer `usage-incomplete` sides.
- The router gains a command and a policy key (`archive.usageMessage`). A run in flight records `provenance.drift` for `archive` at its next `next` call, and `compare` warns `provenance-drift:<side>:archive`. Routing does not change. Entries without `usageLate` read as before, and runs that lost figures keep `-` unless a person attaches them by hand before the change is archived.
- A figure that arrives after the cut-off point is still dropped, and the step shows `-`.
- The archive state has one more commit on the run branch when a figure is attached there.

## Alternatives considered

- **Suggestion 1 of the issue, write the file and wait.** Rejected: the order of messages is not under the orchestrator's control, and waiting for a notification that may not come stalls the run.
- **Let `next` accept a figure for an earlier step.** Rejected: `next` consumes the result file of the last step, and a second meaning would blur the neutral rerun and the missing-result halt.
- **Write the figure without a commit in the archive state.** Rejected: the folder would be dirty and the archive would refuse or move an uncommitted log.
