# Late Step Usage Figure — Plan Brief

> Full plan: `context/changes/late-step-usage/plan.md`

## What & Why

GitHub issue #71. A step's usage figure often reaches the orchestrator in the task notification after the orchestrator has written the result file without `usage` and run `next`. Anti-stall rule 3 then drops the figure. `report.md` shows `-` for that step, the totals and the cost estimate leave it out, and `compare` counts the side as `usage-incomplete`. A router command that attaches a late figure to a logged step keeps the figure no matter which message arrives first.

## Starting Point

Usage is stored only when the result file is consumed (`attachResult` in `flow.mjs`). `status`, `report.md` and `compare` read `e.usage` from the log entry. Isolated runs roll back failed steps with `git reset --hard`, then write the log that `next` read back to disk. `--archive` runs commit the change folder before the archive subagent starts.

## Desired End State

`route.mjs usage <id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]` attaches the figure to executed step `<n>` on both chains. The figure survives a later rollback and reaches the run branch. On an ended run the command rewrites `report.md`. On an `--archive` run it also commits the change folder before the archive subagent starts. Both skills call it instead of dropping the figure.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Fix shape | Router command (suggestion 2 of #71) | It works whatever the order of messages; suggestion 1 only makes a late figure less likely. |
| Overwrite | Never; an equal figure is a no-op, any other is refused | A figure from the result file is the original, and a refusal writes nothing. |
| Pending, skip, archive step | Refused (pending, skip) or not addressable (archive) | A pending step takes its figure through its result file. Skip and archive steps have no figure. |
| Git while a step runs | None; disk only | The next step commit or the `open-pr.mjs` leftover commit carries it, and rollback writes back the log `next` read. |
| Ended run | Rewrite `report.md` | The report is the record people read and the one archived. |
| Archive state | Commit the folder as `archive.usageMessage`; restore the old bytes if no commit was made | `/10x-archive` needs a committed folder, and a failed write must not leave it dirty. |
| Cut-off | Before the pull request step (`done`, `halt`) or the archive subagent launch | After that point the figure would miss the pushed branch or the archived report, so it is dropped. |
| Concurrency | `usage` runs as its own call, never next to another router call | `next` and `usage` both rewrite the whole log. |
| ADR | New ADR-019 | ADR-018 is taken by the in-flight `no-nested-subagents` change. |

## Scope

**In scope:**
- The `usage` command, its guards and output, on both chains.
- Ended-run report rewrite. Archive-state commit with restore on failure.
- Rule 3 and the `done`, `halt` and `archive` branches of both skills.
- `REFERENCE.md`, `AGENTS.md`, ADR-019, the route.mjs header and usage line.
- New `late-usage.test.mjs`. Updated `skill-loop` and `openspec-skill` tests.

**Out of scope:**
- Changes to `attachResult`, `status`, report building, `compare`, rollback, step commit, `archiveDone` or `open-pr.mjs`.
- A lock between router calls.
- Re-running the pull request or PR comment step for a late figure.
- Restoring figures lost by runs before this change (possible by hand while not archived).

## Architecture / Approach

`usageCommand` in `route.mjs` validates the arguments, resolves the chain, checks the guards, and writes `usage` and `usageLate: true` onto the entry with `writeLog`. An ended run also gets `writeReport`. The archive state runs a precheck from `isolation.mjs` (git safety, run branch, clean folder) before any write. It then commits only the change folder through an exported wrapper of `routerCommit`, and writes the old bytes back when no commit was made.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The `usage` command | Attach on running and ended runs, both chains, with rollback-survival tests | A race with `next` if the skill rule is not followed |
| 2. Archive state | Folder commit with `archive.usageMessage`, restore on failure, isolated resume | Leaving the folder dirty before the archive subagent |
| 3. Orchestrator skills | Rule 3 and branch calls in both skills, equal anti-stall sections | Rule form and ladder-word tests on the shared section |
| 4. Docs and ADR | REFERENCE, AGENTS, ADR-019, full verification | Docs drifting from the guard texts |

**Prerequisites:** none beyond the current branch.
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- The parallel `no-nested-subagents` change edits the same anti-stall sections and rule tests. Whichever merges second rebases.
- The skill rule is what keeps `usage` and `next` apart. The router does not enforce it.
- A figure that arrives after the cut-off is still lost. That is a narrower window than today, not none.
- The new policy key gives in-flight runs `provenance.drift` for `archive`. Routing does not change.

## Success Criteria (Summary)

- A late figure shows in `status`, `report.md`, the cost estimate and `compare` like an on-time one.
- In an isolated run the figure survives a rollback and is on the pushed branch.
- An `--archive` run's archived `report.md` holds a figure that arrived before the archive subagent started.
