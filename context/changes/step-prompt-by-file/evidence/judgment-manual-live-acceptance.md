# Manual acceptance inspection

Reviewed on 2026-11-14 within the assigned worktree. Both Manual rows remain pending. This inspection establishes the evidence gaps.

## Row 3.4

The plan requires “Live Claude and OpenAI sessions for both chains demonstrate a full file read, correct task/RESULT behavior, matched usage and inline archives”.

The existing evidence/comparison.md states “Claude/10x, Claude/OpenSpec, OpenAI/10x and OpenAI/OpenSpec live acceptance are all pending” and “Fake Codex's fixed 110-token counter tests usage ownership only”.

The first comment in skills/10x-pipeline/test/prompt-handoff.test.mjs says “providers are fake, never live agents”. The fake child in skills/10x-pipeline/test/codex-helpers.mjs emits a canned RESULT and fixed input_tokens 100 and output_tokens 10. The handoff test checks totalTokens equals 110. The production validator in skills/10x-pipeline/scripts/run-codex.mjs checks exact stored descriptor and task bytes before dispatch. These checks cannot establish live child reading or instruction-following quality across the four requested combinations.

No covering test was identified for the complete live-session claim. No new provider session was launched because this step explicitly forbids nested agents. Row 3.4 remains unchecked.

## Row 3.5

The plan requires “At least five matched inline/file live change pairs are reviewed with compare, task quality and orchestrator telemetry”.

The existing evidence/comparison.md states “Attempted matched live pairs: **0**. Completed pairs: **0**. Halted pairs: **0**” and “orchestrator-session telemetry: unavailable”. The size-measurements.json record labels its measurements “synthetic real CLI fixtures; bytes are UTF-8, not tokens” and records livePairs as 0.

The in-worktree file inventory found this change's comparison.md and synthetic compare tests, with no additional matched-pair comparison reports or transcript/telemetry artifacts. Router logs for unrelated change IDs cannot establish matched inline/file execution of this change. Running compare against synthetic fixtures would leave the live task-quality and orchestrator telemetry requirements unproved. Row 3.5 remains unchecked.

## Result

No Manual row was ticked. The plan and router-owned state were left untouched. The default decision remains the recorded false setting. No production code changed and no tests were rerun because the pending claims require live observations beyond the available synthetic coverage.
