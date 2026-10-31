# ADR-005: Baseline usage comparison as data plus a read-only command

- **Status:** Proposed
- **Date:** 2026-10-31
- **Deciders:** repository owner
- **Origin:** roadmap S-06 (FR-009) and the `baseline-usage-comparison` change. Research: `context/changes/baseline-usage-comparison/research.md`. Plan and review rounds: `context/changes/baseline-usage-comparison/plan.md`.

## Context

- The product claim is that routing cuts weekly-limit usage against a full run on one model at high effort. Nothing measured it: per-step `usage` lands in `run.jsonl`, but no command reads two runs.
- Run state is one folder per change id and a second `init` on the same id resumes the first run. A baseline run therefore needs its own checkout.
- The first draft of the baseline would have needed an `init --baseline` flag and a `meta.baseline` field. Both touch `init`, which the parallel changes S-05 and S-07 also edit.
- No success threshold and no token-to-limit conversion exist in the repository. Inventing either would present a guess as a result.

## Decision

The baseline arm is data in a second checkout, and the comparison is one new command that reads two run folders.

- `skills/10x-pipeline/baseline-policy.json` is a per-project override. The user copies it to `context/foundation/agent-smith-policy.json` in the baseline checkout. It pins all seven ladder tiers to `sonnet` at `high`, sets every `rigor.fromGoal` class to `standard` and sets `rigor.skipPlanReviewAt` to `[]`. No flag is needed at `init`, and no routing code changes.
- `route.mjs compare <change-id> --baseline <dir> [--routed <dir>] [--format md]` is read-only. It prints per-side totals and coverage, whether the baseline is pinned, `comparable`, `reasons`, `warnings`, `dropPercent`, `targetDropPercent` and a verdict.
- The unit is raw `totalTokens`. It is a proxy for the weekly limit: it understates savings from `haiku` steps and overstates a drop bought by moving work to `opus`.
- `compare.targetDropPercent` in `policy.json` ships as `null`. The verdict reads `target not set` until the owner fills it.
- The verdict is decided on exact integer tokens. `dropPercent` is the exact drop rounded down to 2 decimals, so the printed value never reads at or above a target the verdict missed.

Rules for the command, written as scenarios (the form of ADR-004):

**GIVEN** a baseline arm **WHEN** a user makes it **THEN** the baseline **MUST** run in a second checkout of the routed run's `meta.baseSha` with `baseline-policy.json` as its override, never as a second slot in one change folder.

**GIVEN** the `compare` command **WHEN** it reads two run folders **THEN** it **MUST NOT** write any file, run any git write or change `run.jsonl` or `meta.json`.

**GIVEN** a pair of runs **WHEN** either side did not end `done`, has an executed step without a valid `usage.totalTokens`, or has no executed step **THEN** the command **MUST** report the pair as not comparable with `dropPercent` set to `null` and the partial sums shown with their coverage counts.

**GIVEN** a baseline log **WHEN** the command checks the pin **THEN** it **MUST** judge executed entries only, where every one is `sonnet` at `high`; a skip entry raises a warning, not a reason.

**GIVEN** a mismatch in goal, `baseSha` or input file names between the two sides **WHEN** the command builds its output **THEN** it **SHOULD** list a warning and keep the computed numbers.

**GIVEN** a policy without a target **WHEN** the command computes a verdict **THEN** it **MUST** answer `target not set`, with no invented threshold.

## Consequences

- No change to `init`, `next`, `decide` or the log schema. S-05 and S-07 do not conflict with this change in code; the shared lines are README and AGENTS.md.
- One pair is an anecdote. There is no significance test and no aggregate mode. A reader compares per-pair drops across several changes.
- Orchestrator-session tokens are on neither side. Retries and failed steps are counted, because a run that halted is not comparable instead of being dropped.
- The result is only as good as the usage figures the orchestrator passes. The first live check saw them in the Agent completion notice (`subagent_tokens`, `tool_uses`, `duration_ms`); the foreground orchestrator path is still to be re-checked in a live session (plan row 1.8).
- The baseline checkout holds the only copy of its `run.jsonl`. The user keeps the worktree until `compare` has run.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| `init --baseline` flag with `meta.baseline` | rejected | Edits `init` and the meta schema, which parallel changes also touch, for something a policy file already does. |
| A second change id in the same checkout | rejected | The plan and the code on disk would be shared between the arms, so the second run would build on the first. |
| Compare the `report.md` totals | rejected | A text report is not a parse target. `run.jsonl` carries the figures and survives the archive move. |
| Weighted tokens by model | not adopted | No weights exist in the repository. Raw tokens are printed per model, so a reader can weigh them. |
| Ship a threshold such as 30 percent | rejected | The repository has no basis for the number. It is the owner's call. |
