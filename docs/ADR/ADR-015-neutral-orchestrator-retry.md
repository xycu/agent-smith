# ADR-015: Rerun a step unchanged after an orchestrator fault, with no failed attempt

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-09
- **Deciders:** the repository owner (the request in `change.md`, 2026-11-09, which named this record ADR-015); unattended plan and implementation runs of change `neutral-orchestrator-retry` for the readings D1 to D8 below
- **Origin:** change `neutral-orchestrator-retry` (`context/changes/neutral-orchestrator-retry/change.md`, `plan.md` and `reviews/plan-review.md`). It adds a result status next to the result intake of ADR-010 and ADR-013; no earlier decision is superseded.

## Context

- In the `openspec-project-rules` run (OpenSpec chain, 0.8.0) the orchestrator truncated the prompt of step 2 (`os-apply`) before launch, so no subagent ran (`change.md`, "Notes").
- The router had no way to rerun a logged step. `next` without a result file halts with `Step <n> (<step>) has no result. Write <resultFile> first.`, and `init` on resume ends in the same `next` call. The only way out was a result whose status is not `done`, which `attachResult` records as `ok: false`.
- One `ok: false` entry feeds every failure reader: the retry tier (`trailingFailures`, read by `tierFor`), `escalation.maxAttemptsPerStep`, the failed-step rigor rise, the step budget and the rollback of an isolated run (ADR-010). In that run the retry went one tier up (`+1 for 1 failed attempt(s)`) and the step was rolled back to a side ref, although no model had failed.
- A log entry stored the tier, model, effort, reason and `tierWhy` of a step, but not its rendered prompt. The prompt is rebuilt from `decide()`, the template, the policy and the files, so it cannot be reproduced once a lost run has edited files.
- The router already has neutral entries: a `fallback` executor step, an `advisory` score attempt, a failed cheap first attempt (ADR-010) and a failed `manual-verify` attempt (ADR-012).

## Decision

The orchestrator declares a fault of its own with one result status, and the router returns the same step again from the same log entry. Rules, written as scenarios (the form of ADR-004):

### Trigger (D1)

**GIVEN** the last executed log entry has no result **WHEN** `last-result.json` parses with `status` `orchestrator-error` and `limits.maxNeutralRetries` is above 0 **THEN** the router **MUST** treat the result as a neutral rerun, not as a step result.

**GIVEN** `next` finds no result file for a pending entry **WHEN** it decides what to print **THEN** it **MUST** halt with the missing-result text, which names the `orchestrator-error` status.

**GIVEN** `next` finds no result file for a pending entry **WHEN** the orchestrator has declared nothing **THEN** the router **MUST NOT** return the step again by itself.

**GIVEN** the orchestrator would declare `orchestrator-error` **WHEN** a subagent of that step may still be running **THEN** it **MUST NOT** declare it, because the rerun and the late subagent would edit the same files.

### Record (D2)

**GIVEN** a neutral rerun **WHEN** the router records it **THEN** it **MUST** consume the result file and append `{ at, note }` to `neutralRetries` of the pending entry, with `note` one line cut to 200 code points (empty when absent).

**GIVEN** a neutral rerun **WHEN** the router writes the log **THEN** it **MUST NOT** add a log entry, a result, `ok`, `verified` or `finishedAt`.

**GIVEN** a neutral rerun **WHEN** the router prints the next action **THEN** it **MUST** print `run` with the entry's `n`, `step`, `agent`, `model`, `effort`, `reason` and `resultFile`, the stored prompt and `neutralRetry: { count, cap }`.

**GIVEN** an entry with neutral reruns **WHEN** a reader counts failed attempts, the step budget or the failed-step rigor rise **THEN** the reruns **MUST NOT** count, because they never add an entry or a result.

### Prompt (D3)

**GIVEN** the router logs a new step **WHEN** it writes the entry **THEN** it **MUST** store the rendered prompt as `pendingPrompt`.

**GIVEN** a real result of any status **WHEN** `attachResult` consumes it **THEN** it **MUST** delete `pendingPrompt` from the entry.

**GIVEN** a pending entry without `pendingPrompt` (logged before this change) **WHEN** an `orchestrator-error` result arrives **THEN** the router **MUST** halt with a plain halt that says the step cannot be rerun unchanged and to write a `failed` result, and leave the file in place.

**GIVEN** that plain halt **WHEN** the router ends the call **THEN** it **MUST NOT** write a report or `meta.outcome`, because the run has not ended.

### Start state (D4)

**GIVEN** a neutral rerun **WHEN** the router returns the step again **THEN** it **MUST** keep the entry's `startedAt`, `startSha`, `before`, `tier`, `tierWhy` and `rigor`.

**GIVEN** a neutral rerun in an isolated run **WHEN** the router handles it **THEN** it **MUST NOT** roll back, commit or reset anything.

### Cap (D5)

**GIVEN** an entry whose `neutralRetries` already holds `limits.maxNeutralRetries` items (default 2) **WHEN** another `orchestrator-error` result arrives **THEN** the router **MUST** consume the file and halt through the end of the run (report and `meta.outcome`) with a text that names the two ways forward: a result file with the real status, or a raised cap and a second `orchestrator-error` file.

**GIVEN** `limits.maxNeutralRetries` is `0` **WHEN** an `orchestrator-error` result arrives **THEN** the router **MUST** read it as any status other than `done`, a failed attempt.

**GIVEN** `limits.maxNeutralRetries` is not a non-negative integer **WHEN** the router reads the cap **THEN** it **MUST** use 2.

### Faults that stay failures (D6)

**GIVEN** the router's `agent` does not resolve, or a subagent reply has no parsable `RESULT:` line **WHEN** the orchestrator writes the result file **THEN** it **MUST** write `unknown`, which stays a failed attempt.

**GIVEN** a subagent's `RESULT:` line carries the status `orchestrator-error` **WHEN** the orchestrator writes the result file **THEN** it **MUST** write `unknown` in its place and keep the other keys, because only the orchestrator declares a fault of its own and the router cannot tell who wrote the file.

### Both chains (D7)

**GIVEN** a run of either chain **WHEN** `next` reads an `orchestrator-error` result **THEN** the same code path **MUST** apply, because both skills go through `next` in `route.mjs`.

## What each rule covers

- Policy: `limits.maxNeutralRetries` = `2`.
- Router: `neutralRetry` in `scripts/flow.mjs` runs in `next` after `checkPrompts` and before `attachResult`; every case it does not take falls through to the code before this change. `entry.pendingPrompt` is set in `next` right before the entry is logged; `attachResult` deletes it after it reads the result file. The missing-result halt keeps its first sentence and gains a second that names `{"status":"orchestrator-error","note":"..."}`.
- Visibility: the log entry carries `neutralRetries` (`[{ at, note }]`). `status` shows `neutralRetries` (a count) on a row that had any. `report.md` adds `, <k> neutral rerun(s)` to the `Result` cell (also `-, 1 neutral rerun` on a pending entry) and a `## Neutral reruns` section after `## Rolled-back steps`, one line per step with its notes below it. The notes are orchestrator text and `--pr-comment` posts the report as it is, so each note is one line, without backticks, cut to 200 code points, as a lesson candidate is.
- Skills: both orchestrators write `orchestrator-error` when the Agent call was refused or errored before any subagent started and the cause is not the router's `agent`, when the prompt could not be passed whole, or when the Agent call returned neither a reply nor an error, and only when no subagent of the step is running. `unknown` keeps the unresolved agent and a reply without a parsable `RESULT:` line.
- Unchanged: the `archive` action (no log entry, no result file), `compare` (no count of reruns, no token figure for a lost run), every rigor, tier, budget and rollback rule, the prompt templates and `helpers.mjs`.

## Consequences

- An orchestrator or harness fault costs one more subagent run at the same tier, not a tier bump, an attempt, a rigor rise and a rollback.
- A rerun after a lost report continues over the lost run's edits: `startedAt` stays, so a file the lost run wrote still verifies the step, and a later failure rolls back to the original `startSha`.
- `run.jsonl` holds the prompt of the pending step, a few KB, until its result arrives. The step commit rewrites `run.jsonl` from the log in memory first, so the prompt never lands in a step commit. A rollback snapshot is taken before that rewrite, so the side ref under `refs/agent-smith/` of a failed step holds the on-disk entry with `pendingPrompt`; the prompt is already in the orchestrator's conversation and the ref is local.
- A step subagent that stages `run.jsonl` itself (for example with `git add -A`) commits the pending prompt in its own commit. The next step commit records the file without it, so routing is unaffected, but the prompt stays in the local run branch history. No prompt rule names the router files.
- `limits` is a policy section, so a run in flight at the upgrade records `provenance.drift: ["limits"]` at its next `next` call, and `compare` warns `provenance-drift:<side>:limits`. Routing is unaffected.
- A run in flight has a pending entry without `pendingPrompt`; for it the new status halts with the plain text of D3.
- `AGENTS.md` Hard Rules are unchanged: no new git write, no new network call, no new dependency.

## Risks

- An orchestrator can misuse the status for a model failure. The skill text limits it to faults of its own and the cap of D5 bounds the loop; the router cannot tell the two apart.
- An orchestrator that declares the fault while a background subagent of the step still runs gets two subagents on the same files. D1 makes that the orchestrator's duty; the router cannot see it.
- Nothing has run against a live harness fault yet.

## Rollback

- Per project: `{ "limits": { "maxNeutralRetries": 0 } }` in `context/foundation/agent-smith-policy.json`; the status then reads as a failed attempt, as before this change.
- In the plugin: set `limits.maxNeutralRetries` to `0` in `policy.json`. The stored `pendingPrompt` stays harmless.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Re-emit the pending step when `next` finds no result file (D1) | rejected | A missing file can mean the subagent still runs in the background (the headless note in `docs/REFERENCE.md`); a re-emit would start a second subagent on the same files. |
| Log a new entry for the rerun (D2) | rejected | Every count, streak, budget and rigor reader would need a new exception; the same entry changes none of them. |
| Recompute the prompt at the rerun (D3) | rejected | `decide()` may answer differently once a lost run edited files, so the rerun would not be the same step. |
| Reset `startedAt` and `startSha` at the rerun (D4) | rejected | Edits of the lost run would stop counting as fresh, and a later rollback would keep them. |
| No cap, or a cap per run (D5) | rejected | No cap allows an endless loop; the step budget already bounds the entries, so a cap per entry bounds the run. |
| Make `unknown` neutral too (D6) | rejected | An unresolved agent type is deterministic and a missing `RESULT:` line is a model fault; both should escalate as before. |
| Only the OpenSpec chain, where the fault was found (D7) | rejected | Both skills share `next`, and the 10x orchestrator meets the same faults. |

## Numbering (D8)

The owner named this record ADR-015. ADR-014 is not in this tree; the number is kept as named and no ADR-014 is created here.

## Unverified assumptions

- No live run has declared `orchestrator-error`. The router side is covered by `skills/10x-pipeline/test/neutral.test.mjs` on both chains and in an isolated run; the orchestrator's use of the status is not.
- The cap of 2 is not calibrated.

## Amendment 1: a malformed cap halts (change policy-limits-fail-open, ADR-022)

The line of D5 "**GIVEN** `limits.maxNeutralRetries` is not a non-negative integer **WHEN** the router reads the cap **THEN** it **MUST** use 2." is replaced by:

**GIVEN** `limits.maxNeutralRetries` is not a non-negative safe integer **WHEN** `init`, `next` or `usage` loads the policy **THEN** the router **MUST** halt with a reason that names `policy.limits.maxNeutralRetries` and write nothing.

`0` still turns neutral reruns off. The rest of this ADR stands. See ADR-022.
