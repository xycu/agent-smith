# ADR-014: The orchestrator asks before it archives a run that has Manual checks pending

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-09
- **Deciders:** the repository owner (goal of change `archive-manual-gate`); unattended implementation run for the readings marked A1 to A5 below
- **Origin:** change `archive-manual-gate` (`context/changes/archive-manual-gate/change.md` and `plan.md`). It builds on ADR-010 (isolated run, pre-archive commit), ADR-011 (halt on open owner decisions), ADR-012 (Manual rows) and ADR-013 (OpenSpec archive).

## Context

- A run started with `--archive` archives on its own, even when Manual rows are still pending. The `archive` prompt tells the unattended `/10x-archive` subagent to continue past a pending-Manual-rows warning, so nothing stops the move.
- The router's only gate is `archive.haltOnManualPending` (default `false`), an all-or-nothing halt before the pre-archive commit.
- The `archive` action already carries `summary.manualPending`, `manualUnproven`, `manualNotProved` and `uncommittedTicks`.
- The router makes no model call and asks nobody; a subagent cannot use `AskUserQuestion`. The orchestrator runs in the user's session and can.

## Decision

The orchestrator of both chains asks one yes/no question in the `archive` branch before it launches the archive subagent. Rules, written as scenarios (the form of ADR-004):

**GIVEN** the router returns the `archive` action **WHEN** `summary.manualPending`, `summary.manualUnproven` and `summary.uncommittedTicks` are all empty **THEN** the orchestrator **MUST** go on to the archive subagent with no question.

**GIVEN** the router returns the `archive` action **WHEN** any of those three lists is not empty (a tick nobody proved counts as a manual task left; owner decision on review finding F5) **THEN** the orchestrator **MUST** ask one `AskUserQuestion` (header `Archive`) with the options `No, keep it unarchived` (first, description starts with `Recommended.`) and `Yes, archive anyway`, listing at most 10 pending rows, each non-empty unproved list and the `manualNotProved` lines, after it has reported the run and posted the PR comment.

**GIVEN** the question was asked **WHEN** the answer is `Yes, archive anyway` **THEN** the orchestrator **MUST** continue as before (archive subagent, `verify-archive`).

**GIVEN** the question was asked or could not be asked **WHEN** the answer is anything else, the question tool errors or does not exist (headless `claude -p`) **THEN** the orchestrator **MUST NOT** launch the archive subagent or run `verify-archive`; it prints `Archive: skipped, <n> Manual check(s) pending or unproved.` and ends with a final message that says the change is committed on the run branch but not archived, repeats the checklist and names the way to archive later (A1: fail closed).

**GIVEN** the run was not archived **WHEN** the user runs the pipeline command again **THEN** the router **MUST** return the `archive` action again (the commit step is skipped) and the question is asked again (A2).

**GIVEN** the OpenSpec chain **WHEN** the `archive` action arrives **THEN** the orchestrator **MUST** apply the same gate; it is dormant, because all three lists are always `[]` there (A3).

**GIVEN** a no **WHEN** the final message is written **THEN** it **MUST** say that the `Archive: requested` line of `report.md` is stale (A4); the report is not rewritten and the pre-archive commit is not undone (A5).

## Alternatives declined

- A router halt only: `archive.haltOnManualPending` already exists and is all-or-nothing; the owner wants a choice per run.
- A router-side question: the router never calls a model or the user (ADR-006).
- A subagent question: subagents cannot ask.
- A policy key to turn the question off: `archive.haltOnManualPending` or running without `--archive` already cover it.

## Consequences

- An unattended `--archive` run with pending Manual rows now stops short of the archive. Whether this ships as `feat` or `feat!` is the owner's call.
- No router, policy or prompt change, so no provenance drift.
- Readings to confirm: A1 fail closed; A2 a rerun asks again; A3 the OpenSpec gate is mirrored and dormant; A4 stale report line is corrected in the message only; A5 no undo of the commit.
