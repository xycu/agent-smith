# Archive Manual Gate — Plan Brief

> Full plan: `context/changes/archive-manual-gate/plan.md`

## What & Why

A run started with `--archive` archives the change even when Manual rows are still pending, because the unattended archive subagent continues past that warning. Archive only when no Manual rows are pending; otherwise the orchestrator asks the user yes or no. Subagents cannot ask, the orchestrator can.

## Starting Point

The router's `archive` action already carries `summary.manualPending`, and the pre-archive commit is already made when it returns. The `archive` branch of both `SKILL.md` files reports the checklist, runs the archive subagent and repeats the checklist. The only existing stop is `archive.haltOnManualPending` (default off), an all-or-nothing halt before the commit.

## Desired End State

With pending Manual rows, the orchestrator lists them in one `AskUserQuestion` before it launches the archive subagent. Yes archives as today. No, any other answer, or no question tool (headless) ends the run like `done`: unarchived, change folder committed on the run branch, checklist repeated, `/10x-archive <id>` named. No pending rows: nothing changes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Who asks | The orchestrator, in the `archive` branch | Subagents cannot ask and the router never talks to the user or a model. |
| Router change | None | `summary.manualPending` already carries the data. |
| Trigger | `summary.manualPending` not empty | The goal says pending rows; unproven ticks are shown in the text but do not ask. |
| No answer or no tool | Treated as no | Fail closed: never archive without an explicit yes. |
| Place in the branch | End of step 1, after the PR comment pointer | Keeps step numbers, the anti-stall rule 1 reference and the PR comment test order. |
| Rule form | Plain prose, no new `**GIVEN**` line | Both skill tests pin exactly five rule lines. |
| OpenSpec chain | Mirrored, dormant | `manualPending` is always `[]` there; the goal asks for both chains. |
| Stale report line | Left; the final message corrects it | `report.md` is router-owned. |
| Off switch | None | `archive.haltOnManualPending` or no `--archive` already exist. |
| ADR | ADR-014 | A new orchestrator interaction and a changed unattended contract. |

## Scope

**In scope:** both `SKILL.md` archive branches and `allowed-tools`; a content test file; ADR-014; `docs/REFERENCE.md`, `README.md`, `AGENTS.md`.

**Out of scope:** router, policy and prompts; the anti-stall section; the `10x-archive` unattended prompt; `report.md` rewrite; undoing the pre-archive commit.

## Architecture / Approach

Orchestrator-only change. After step 1 reports the run and posts the PR comment, a paragraph checks `summary.manualPending`. Empty: step 2. Not empty: one `AskUserQuestion` (no first and recommended, yes second); only yes continues at step 2; everything else prints a skipped line and STOPs with a final message.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Orchestrator gate and content tests | Gate text in both skills, `archive-gate.test.mjs`, existing skill tests green | Tests pin exact step text and rule counts; a wrong edit breaks them. |
| 2. ADR-014 and documentation | ADR, REFERENCE, README, AGENTS updates | Docs and skill text drifting apart. |

**Prerequisites:** none.
**Estimated effort:** about 1 session, 2 phases, 7 files.

## Open Risks & Assumptions

- No harness drives `AskUserQuestion`; yes and no are checked live (manual rows).
- Headless sessions are assumed to lack the question tool or get an error; both read as no. Not verified in a live headless run.
- `report.md` keeps `Archive: requested` on a no.
- The cap of 10 listed rows and the option labels are readings, listed in ADR-014 for owner confirmation.
- The pre-archive commit stays after a no (local, not pushed).

## Success Criteria (Summary)

- A run with pending Manual rows never archives without an explicit yes.
- A run with none behaves exactly as before.
- The full test suite passes and the router files are unchanged.
