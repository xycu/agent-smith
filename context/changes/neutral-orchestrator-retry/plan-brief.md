# Neutral Orchestrator Retry — Plan Brief

> Full plan: `context/changes/neutral-orchestrator-retry/plan.md`

## What & Why

When the orchestrator or harness fails (the prompt was truncated, the Agent call never started, the report was lost), no subagent failed, yet the router can only count a failed attempt: tier up, attempt count, rigor rise, rollback. The router needs a neutral rerun of the same step with the same prompt, for both chains.

## Starting Point

`attachResult` halts on a missing result file, and any non-`done` status becomes `ok: false`, which every reader (tier, attempt cap, rigor, budget, rollback) treats as a failure. A log entry keeps tier and reason but not the rendered prompt.

## Desired End State

One extra result file, `{"status":"orchestrator-error","note":"..."}`, and one `next` call rerun the logged step unchanged. `run.jsonl`, `status` and `report.md` show the reruns, and a cap of 2 per step stops a loop.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Trigger | Explicit result status `orchestrator-error`, not a re-emit on a missing file | A missing file may mean a background subagent is still running, and a re-emit would duplicate it |
| Record | The same log entry gets `neutralRetries`; no new entry | No count, streak, budget or rigor reader changes, so nothing can bump |
| Prompt | Stored as `pendingPrompt` while the step is pending, deleted at the result | `decide()` may answer differently after a lost run edited files |
| Start state | Original `startedAt`, `startSha` and `before` kept | Edits of a lost run still verify the step, and a later rollback goes to the true start |
| Cap | `limits.maxNeutralRetries`, 2 per entry, `0` is off; the step budget bounds the entries | An endless loop needs a hard stop with a way forward for a human |
| `unknown` status | Stays a failed attempt | An unresolved agent type or a missing `RESULT:` line is deterministic or a model fault |
| Scope | Both chains, one code path in `next` | Both skills share the router |
| ADR | ADR-015 as named by the owner (ADR-014 is absent in this tree) | Follows the request |

## Scope

**In scope:** router intake and cap, stored prompt, `status` and report fields, both chains, isolated runs, both skills, `docs/REFERENCE.md`, `AGENTS.md`, ADR-015, tests.

**Out of scope:** re-emit without a result file, the `archive` action, `compare` counts, token figures of lost runs, any change to rigor, tier, budget or rollback rules.

## Architecture / Approach

`next()` calls a new intake function before `attachResult`. If the last entry has no result and the file says `orchestrator-error`, the router consumes the file, records the fault on the entry and prints the `run` action rebuilt from the entry. At the cap it halts through `endRun`. Anything else flows through today's code unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router core and the 10x chain | Policy key, stored prompt, intake, cap, tests | Breaking an existing test through the new entry field or halt text |
| 2. Visibility, OpenSpec chain, isolation | `status` field, report cell and section, tests on both chains and a real worktree | Neutral rerun interacting with rollback of an isolated run |
| 3. Skills, docs, ADR-015 | Orchestrator rule in both skills, REFERENCE, AGENTS, ADR | Skill tests that pin loop text and the anti-stall section |

**Prerequisites:** Node 24 and git; none else.
**Estimated effort:** about 2 to 3 sessions across 3 phases.

## Open Risks & Assumptions

- Decided unattended from the code and docs, no owner interview: the explicit status over a re-emit, cap 2 and the stored prompt are assumptions the owner can overrule.
- An orchestrator could misuse the status for a model failure; the cap bounds it and the skill text limits it to faults of its own.
- A run in flight at upgrade cannot rerun its pending step unchanged (no stored prompt).
- Nothing was checked against a live harness fault.

## Success Criteria (Summary)

- A neutral result reruns the same step with the same prompt, tier and counts, on both chains and in an isolated run.
- The third fault of one step halts with a clear way forward.
- Reruns appear in `run.jsonl`, `status` and `report.md`, and the full suite passes.
