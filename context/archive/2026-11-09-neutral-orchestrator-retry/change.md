---
change_id: neutral-orchestrator-retry
title: Rerun a step after an orchestrator fault without a failed attempt
status: archived
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09T21:15:01Z
---

## Notes

Found in the `openspec-project-rules` run (OpenSpec chain, 0.8.0). The orchestrator truncated the prompt of step 2 (`os-apply`) before launch, so no subagent ran. The router has no way to rerun a logged step:

- `next` without a result file halts with `Step <n> (<step>) has no result. Write <resultFile> first.`
- `init` on resume halts with the same text.
- The only way out is a result file with a status other than `done`, which the router counts as a failed attempt.

Effect of that failed attempt: the retry ran one tier up (`sonnet/high` to `opus/medium`, `+1 for 1 failed attempt(s)`), the attempt counts toward `limits.maxAttemptsPerStep`, the failed-step rigor rise applies, and the step is rolled back to a side ref. An orchestrator or harness fault is not a model failure, so none of these should apply.

Expected: a neutral way to rerun the same step with the same tier, for a fault that is not the subagent's. It adds no failed attempt, no tier bump, no rigor rise and no step-budget use, and it keeps the prompt reproducible (a rerun returns the same prompt for the logged step). Open questions for research: whether the router should re-emit the pending step on `next` when no result file exists, or accept an explicit status such as `orchestrator-error`; whether it applies to both chains; how the log, `status` and `report.md` show the neutral retry; whether it needs a cap to stop an endless loop.

Both chains share the router (`skills/10x-pipeline/scripts/route.mjs` and its modules under `scripts/`), so the change belongs in the router and `policy.json`, with the rules in `docs/REFERENCE.md` and an ADR.
