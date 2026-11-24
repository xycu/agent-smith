# ADR-014: The orchestrator asks before it archives a run that has Manual checks pending

- **Status:** Accepted, amended by Amendment 1. Both orchestrators carry the approval gate implemented by the unattended `archive-manual-gate` run. The OpenSpec archive summary returns `manualPending: []` and omits the other two lists. [Archive fixture](../../skills/openspec-pipeline/test/openspec-archive.test.mjs) [10x loop](../../skills/10x-pipeline/SKILL.md) · [OpenSpec loop](../../skills/openspec-pipeline/SKILL.md)
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

**GIVEN** the OpenSpec chain **WHEN** the `archive` action arrives **THEN** the orchestrator **MUST** apply the same gate; it is dormant, because there are no unresolved Manual entries (A3).

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

## Amendment 1: archive exception record (2026-11-24)

The 10x orchestrator reports the run, asks the archive question when needed, then moves and verifies the folder on approval. A requested PR comment follows the move on that path. The original Decision above preserves the earlier ordering as history. The current orchestrator launches the archive subagent after `Yes, archive anyway` without a step to write the record. This procedure applies to a hand-run `/10x-archive <change-id>` closeout, including a later closeout after `No, keep it unarchived`. S-19 owns wiring the record into the orchestrator. [10x reference](../REFERENCE.md) · [ADR-017](ADR-017-run-branch-always-pushed-for-review.md) · [S-19](../../context/foundation/roadmap.md#s-19-truthful-verification-and-owner-decision-halts)

| Gate outcome | Closeout |
| --- | --- |
| All three lists are empty or omitted | Proceed normally without an exception note. |
| The owner explicitly approves archiving with unresolved checks | Write the record in the live change folder before moving it. Approval authorizes deferral of proof. |
| The owner refuses, the answer is missing, or the question tool fails or is unavailable | Keep the change unarchived, report the unresolved checks and create no approval record for the attempt. |

1. After explicit owner approval in chat or in the standalone skill's warnings answer, the owner or authorized closeout operator writes `context/changes/<change-id>/evidence/archive-manual-decision.md` while the folder is live. In its header record the exact approval, date, owner identity or role and a stable reference to the decision when available.
2. Use the full saved archive summary for a pipeline handoff. The native question previews at most ten `manualPending` entries. Take the union of `manualPending` (IDs at the start of the row text), `manualUnproven` and `uncommittedTicks`. For a standalone closeout without a saved summary, review all of Progress and the available proof and commit diagnostics for those gaps. Write one entry per distinct Progress ID, tied to its original row, with all applicable categories, the concrete reason for deferral and a traceable follow-up destination with an owner, such as a roadmap slice, change ID or issue. Retain relevant context from every list and any reported proof or commit gaps. Use `manualNotProved` and `manualUnprovenWhy` where available, then consult closeout evidence or the owner's decision for missing reasons. Identify unavailable proof or commit information as such. Preserve the original checkbox, title, evidence and SHA suffixes, including absent references, and keep existing evidence files with the plan.
3. For a Git-backed closeout, make a scoped commit of the note in the run worktree before handing off to the mover. If approval came from the standalone warnings answer, pause before the move to commit the note and confirm the same clean handoff. The live folder must be clean and the index empty. With the preserved Progress rows, use the archive path without SHA repointing. After the move, confirm the archived note, plan and evidence are tracked in the archive commit or its history. The file-only `verify-archive` checks the move and status stamp. Check Git history separately for the retained record and the archive commit.

The S-13 and S-14 closeouts show deferral reasons and follow-up in S-20. [S-13 owner decision](../../context/archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) · [S-14 archive closeout](../../context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)

### Worked example

The approval header records `Yes, archive anyway`, given by the project owner on 2026-11-24. Include the decision link if the approval has a stable permalink.

| Progress ID | Unresolved category | Reason | Follow-up destination |
| --- | --- | --- | --- |
| 1.1 | `uncommittedTicks` | No code commit was verified for the tick, and the closeout checkout lacks the commit object for the recorded SHA. | Release maintainer, `verify-release-commit` change, to locate and verify the commit. |
| 1.2 | `manualPending` | The staging account is unavailable for the live smoke test. | QA owner, `staging-smoke-test` change, to run the check when access returns. |
| 1.3 | `manualUnproven` | The browser check has only written judgment evidence, which the verifier rejected as insufficient. | QA owner, `browser-test-qualification` change, to capture a browser trace. |

Retain these original illustrative `plan.md` rows and the existing judgment file with the note.

```markdown
#### Automated
- [x] 1.1 Verify the release commit — abc1234

#### Manual
- [ ] 1.2 Run the live smoke test
- [x] 1.3 Verify the browser flow — evidence: evidence/judgment-browser-flow.md
```

### Synthetic overlap and preview example

For a synthetic `manualPending` list with IDs `2.1` through `2.11`, the question shows `2.1` through `2.10` followed by “and 1 more”. Suppose `manualUnproven` also lists `2.11`. The full union still has all 11 IDs, with a single entry for `2.11` carrying both categories and reasons. The synthetic overlap illustrates how to handle repeated IDs. A normal summary draws the two categories from different Progress states.

| Progress ID | Unresolved category | Reason | Follow-up destination |
| --- | --- | --- | --- |
| 2.11 | `manualPending`, `manualUnproven` | Staging access is unavailable and the existing screenshots lack run provenance. | QA owner, `browser-test-qualification` change, to recapture the browser proof. |
