# Child capability evidence

## Qualification status

The implementation step's always-true instructions prohibit launching subagents, so native probes run from the authorized top-level session. The observations below inform implementation while the complete final-candidate matrix remains pending. Claude interactive success is quota-blocked. The plan's sequencing correction keeps implementation and local regression gates available while retaining the qualification requirement. [Plan sequencing](../plan.md#critical-implementation-details)

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

The top-level observations below establish bounded spawning and collection behavior. Usage inclusion, cancellation and effective step-safety inheritance still require further proof. Implementation must preserve those limits in its reporting and regression coverage. [Plan assumptions](../plan.md#delivery-scope-and-assumptions)

## Top-level native probes

These probes ran on 2026-11-16 while the candidate was at Phase 1 commit `c4f7b69`. They test native delegation primitives. The normal pipeline-entry matrix in acceptance.md remains pending. The nonce fixture and raw CLI transcripts are retained at `/private/tmp/agent-smith-nested-capability-IIYJa7/`.

### Codex headless

Codex CLI `0.169.0` ran `exec --json --ephemeral` in an isolated Git fixture with the implementation action's `gpt-6.1-sol` model and `high` effort. Session-local arguments were `-c agents.enabled=true --enable multi_agent_v2`. The active feature listing reported `multi_agent_v2` as stable and disabled before that explicit probe setting. No persistent trust setting was added.

The parent was asked to spawn a single read-only leaf, await its completed report and return the nonce without reading the nonce file itself. It exited successfully and returned child id `/root/nonce_reader` and the exact fixture nonce `f34b306e-9292-40bb-9fa2-3d27856b9542`. A separate local assertion matched the returned value to the fixture.

The observed JSONL item types were `agent_message` and `collab_tool_call`. Its completed collaboration item represented `wait`. The inspected stream contained one root `turn.completed`, and its final assistant message matched the last-message file. This probe exposed no child assistant message or child terminal turn in that root stream. Its usage snapshot reported `input_tokens=99996`, `output_tokens=251`, `cached_input_tokens=74496`, `cache_write_input_tokens=0` and `reasoning_output_tokens=21`. These counters do not establish whether native-child usage is included. Avoid adding inferred child totals. The CLI also warned that the ephemeral parent's transcript could not be resolved by a subagent hook, which leaves hook inheritance unproved.

### Codex desktop interactive session

The current desktop session launched acceptance helper `/root/interactive_child_probe` using the implementation action's model and effort. That helper was explicitly assigned a single leaf and a read-only task. It returned the completed leaf `/root/interactive_child_probe/nonce_leaf`, the same fixture nonce and an explicit statement that the leaf completed before its own return. No tool or capability error was reported. The helper's report was handled as acceptance evidence, independently of the pipeline implementation result. This observes the current desktop host's native tools. It does not establish terminal-CLI equivalence or pipeline-entry acceptance.

### Claude headless

Claude Code `2.1.311` ran `-p --output-format stream-json --verbose` with `--tools Agent,Read`, `--permission-prompts none`, the installed `1.11.2` plugin directory and the session-local depth setting `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`. It used the account's configured default model, recorded as `claude-opus-5-5` in its result. The top-level task required an `agent-smith:step` parent to spawn an `agent-smith:step` leaf and collect its nonce before returning.

The command exited successfully. Its final result returned step id `a4695b72d4579405b`, leaf id `a245f6f833105dbce` and the fixture nonce. The CLI's `subagent_stats` recorded two spawned, two completed, zero failed, maximum depth two, one spawned by a subagent and type counts `agent-smith:step=2`. It recorded foreground requests for those calls and no permission denials. The stream contains the top-level Agent call, the nested Agent call and a subagent hand-back. The leaf's individual Read invocation is absent from this forwarded stream, so the nonce match and completed-agent statistics supply the observed result-delivery proof.

The result exposed both a root `usage` object and aggregate `modelUsage` data with differing counters. This probe does not establish the inclusion semantics of the Agent tool's own on-time, late or archive usage figures used by the pipeline. Those token totals remain unproved for delegated steps.

### Claude interactive quota failure

A real interactive terminal was started from the already-trusted main checkout with the same session-local depth setting, installed plugin and restricted `Agent,Read` tool set. It used the existing account default shown as Opus 5.5 with xhigh effort. The terminal displayed the intermediate step, its nested leaf and waiting for background agents.

The leaf and intermediate agent then failed with HTTP 429 and the message `You've hit your weekly limit`, showing reset at November 17, 2026, 06:00 Europe/Warsaw. The record supplies evidence of spawning and surfaced child failure. Successful child-result collection and the complete interactive cell remain unproved. The quota menu was cancelled and `/exit` closed the terminal. No usage credits, plan upgrade or permission change was selected.

### Codex cancellation and forced parent termination

Two additional top-level CLI probes used the same Codex version, model, effort and native-agent flags. Each parent spawned a native child running a bounded Node command in its own scratch directory. The command wrote a readiness marker, waited for a release marker and would then write a late-write marker. The controller waited for readiness, signalled the parent's POSIX process group, awaited the parent's close, published release and checked for the late write after five seconds.

For SIGINT, the parent exited with code 1 and no signal, and no late-write marker appeared. This observes graceful cancellation of the held command in that probe. Raw records are retained in the fixture's `codex-cancel/` directory.

For SIGKILL, the parent closed with signal SIGKILL, its process group no longer existed, and the native child wrote the late-write marker after release. The recorded outcome was `childReachedReady=true`, `signalled=true`, `code=null`, `signal=SIGKILL`, `lateWrite=true`, `processGroupAlive=false`. Raw records are retained in the fixture's `codex-hard-cancel/` directory.

This failure demonstrates that an absent parent process group does not certify native-child shutdown. The current stale-lock recovery predicate accepts a gone group, so native execution needs durable exclusion while child ownership is unresolved. Add a regression for a native-style child outside that group, preserve the existing flat-run behavior and require concrete ownership reconciliation or an actionable retained lock before mutation or relaunch. A same-process-group fixture leaves this failure uncovered. The probe's held command completed after release. The normal-entry candidate recovery checks remain pending.

An attempt to queue this finding to the active implementation CLI failed because its ephemeral parent thread has no persisted rollout. The finding is recorded here and in the plan for the next implementation/review read. The active implementation invocation was left running.

### Remaining qualification

The native successes above do not complete the twelve-cell normal-entry matrix, mixed-provider integration, final-candidate cancellation/resume, negative safety probes or delegated usage attribution. Forced parent termination exposed a concrete native-child recovery defect that the implementation must address. Claude interactive quota is an observed external limitation, while the remaining cells still require their own final-candidate evidence. Performance benchmarking remains deferred by the owner.

## Implementation controls and limits

The enabling candidate uses the observed `agents.enabled=true --enable multi_agent_v2` controls and Claude depth `"2"`. The [current native Codex contract](https://learn.chatgpt.com/docs/agent-configuration/subagents), reviewed 2026-11-16, lists enablement and concurrent-thread controls but no depth control. Assumption: enforce the one-child-layer bound through the shared leaf instructions; do not invent a depth flag or claim a runtime cap. Codex documents inherited sandbox/approval settings, while actual hook inheritance remains a pending live check.

The recorded root stream informs completion parsing: collaboration items never supply parent assistant messages or terminal turns. Defensive explicitly foreign-thread fixtures are synthetic safety checks, not newly observed native events. Inclusive delegated usage remains unproved; collaboration causes token omission and a bounded coverage assumption, while duration covers the enclosing exec. Claude Agent figures require separate coverage evidence for on-time, late and archive paths. Required unavailable safe-child capability reports blocked; the twelve-cell matrix remains pending.
