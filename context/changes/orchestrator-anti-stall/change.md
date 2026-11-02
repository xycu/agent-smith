---
change_id: orchestrator-anti-stall
title: Anti-stall rules for the 10x-pipeline orchestrator loop
status: implemented
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Notes

Add GIVEN/WHEN/THEN rules to the Loop section of skills/10x-pipeline/SKILL.md so the orchestrator never stalls between steps. (1) When the Agent tool runs a subagent in the background despite run_in_background: false and returns a launch notice, end the turn and continue the loop when the subagent's final report arrives. (2) When the final report holds its RESULT: line and no usage figure has arrived yet, write the result file without usage and run next in the same turn. (3) When a usage figure arrives after next ran for that step, never rewrite the result file or call next again. (4) While a run has not ended in done, archive or halt, never end the turn unless a launched subagent is still running. (5) When the user asks what the run is doing, state only what tool output in this session shows, and say so when nothing is running. Optional, may be split out: a router command such as route.mjs usage <id> <n> to record a late usage figure. Origin: in the managed-agent-patterns run (2026-11-02) the orchestrator ended its turn waiting for a usage notice after the score step had reported back; nothing was running and the run sat idle until the user asked.
