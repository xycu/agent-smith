# Child capability evidence

## Activation prerequisite

Phase 2 is blocked pending native capability evidence for all twelve cells. The current step's always-true instructions prohibit launching any subagent, including through another host session. The plan assigns these probes to an authorized top-level acceptance session. Every live cell remains pending. [Plan prerequisite](../plan.md#critical-implementation-details)

## Recorded environment

- The implementation started from revision `a77187fed0e2255d379014186705de393ec4b8c7` on branch `agent-smith/nested-step-delegation` on 2026-11-16.
- Local verification uses Node `v24.19.0` on macOS and plugin metadata version `1.11.2`.
- Research recorded Claude Code `2.1.311` and Codex CLI `0.169.0`. These historical version observations carry pending native capability verification. Toolkit and OpenSpec versions, effective launch settings and fresh-child discovery await the top-level probes. [Research observations](../research.md#host-controls-and-documented-execution-modes)
- Delivered Claude configuration sets `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`. Codex preflight and execution supply `agents.enabled=false` and `--disable multi_agent_v2`. The Phase 1 fixture expansion preserves the delivered runtime configuration. [Claude settings](../../../../.claude/settings.json) [Runner configuration](../../../../skills/10x-pipeline/scripts/run-codex.mjs)

## Deterministic process evidence

The existing fake CLI accepts a `descendant` mode that starts a model-free Node process in its process group. Its readiness file is published after signal handlers are registered. Separate parent and descendant release files control closure. The fake parent awaits the descendant's `close` event and records collection before publishing its reply.

Both-chain runner cases assert a live held descendant, absence of a premature final file, collection with exit code zero, descendant termination, byte-identical run state and raw-file cleanup. Both-chain POSIX lock cases signal the execution group, observe parent and descendant termination handlers, release the parent's hold, and verify mutation/relaunch exclusion while the descendant remains held. Releasing the descendant permits collection, cancelled-run completion, cleanup and subsequent report writing. The POSIX process-group cancellation cases are skipped on Windows. [Runner tests](../../../../skills/10x-pipeline/test/codex-runner.test.mjs) [Lock tests](../../../../skills/10x-pipeline/test/run-lock.test.mjs)

Existing fragmented JSONL and configurable event fixtures continue to cover flat completion, final-file equality and usage validation. Native child event shapes, thread identity, token inclusion and inherited permissions remain evidence gaps. Native replay fixtures depend on the shapes captured by the top-level probes. [Fixture](../../../../skills/10x-pipeline/test/codex-helpers.mjs)

## Required native record

For each cell in acceptance.md, retain the candidate revision, host/toolkit/OpenSpec versions, launch command and mode, effective depth/fork controls, discovered skills, parent/child identities, unique child return value and evidence of receipt before parent RESULT. Record sanitized event shapes, token coverage, cancellation and descendant closure, inherited permissions and harmless negative permission probes. Mixed ladders exercise both providers. Preserve failed attempts and interventions. [Acceptance matrix](acceptance.md)

The selected awaited form, exact enabling controls, root event boundary and usage coverage remain unresolved. Phase 2 requires those observations before choosing runtime changes. [Plan assumptions](../plan.md#delivery-scope-and-assumptions)
