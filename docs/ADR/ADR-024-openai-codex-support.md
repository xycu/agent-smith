# ADR-024 OpenAI Codex support

Status accepted. Approved plan dated 2026-11-13, implementation started on that date.

## Context

The pipeline skills used Claude Code Agent dispatch and Claude-specific paths and task tools. Users need Codex-hosted OpenAI runs and Claude-hosted mixed ladders through the existing deterministic router, file protocols and Git recovery machinery. Native Codex subagents support model overrides. Shared execution and usage handling across both hosts motivated the selected standalone runner.

## Decision

Provider belongs on each policy ladder rung. Host belongs in router metadata and stays fixed for the run. Missing historical values read as Claude. The default Claude policy and the opt-in GPT overlay share tier positions. The overlay is user-merged project data. Optional `codex.profile` selects existing configuration. Null uses default configuration.

Router modules own dispatch, prompts, run logs, metadata and PR-comment intent. The standalone runner validates the supplied action, holds the shared run lock and launches a fresh CLI child. The orchestrator owns writing the normalized result and advancing the router. Both shared skills resolve paths using their host's loaded skill location and retain archive, worktree and PR behavior.

## Rules

- **GIVEN** a policy rung omits provider **WHEN** the router reads it **THEN** it **MUST** interpret that rung as Claude.
- **GIVEN** a run has a stored host **WHEN** it resumes **THEN** the router **MUST NOT** accept a conflicting host.
- **GIVEN** an OpenAI action names no configuration profile **WHEN** the runner launches **THEN** it **MUST** use existing configuration without a profile flag.
- **GIVEN** a model-free permission probe cannot verify required Git capability **WHEN** execution is requested **THEN** the runner **MUST NOT** launch a model.
- **GIVEN** a CLI child is running **WHEN** an observer's foreground wait ends **THEN** the orchestrator **MUST** wait on that same process until it closes before advancing.
- **GIVEN** a final assistant reply carries an invalid last RESULT **WHEN** the runner normalizes completion **THEN** it **MUST NOT** reuse an earlier success.
- **GIVEN** an OpenAI manual row requires a browser **WHEN** no covering test, command or script proves it **THEN** the step **MUST** leave it pending with a truthful browser-unavailable reason.
- **GIVEN** a terminal action carries no strict PR-comment opt-in **WHEN** the orchestrator ends the run **THEN** it **MUST NOT** post a report comment.

## Limits and verification

The verified CLI contract is Codex 0.169.0. Native sandbox can force legacy sandbox settings read-only, so permission parity may remain unverifiable and fail closed. The filesystem/Git proof does not prove model-command hooks or execpolicy approval behavior. Neither a profile name nor the parent skill catalog proves child capabilities. Existing configuration and host restrictions remain authoritative.

Live installation, discovery, both-host execution and hook/approval acceptance remain Manual checks in the plan. The implementation uses no new dependencies or release version fields. Raw cross-provider token counts establish no tokenizer, cost or quality equivalence. [Implementation plan](../../context/archive/2026-11-13-openai-codex-support/plan.md), [Permission evidence](../../context/archive/2026-11-13-openai-codex-support/evidence/phase2-permissions.md)

## Amendment 1 — Provider-specific step safety (2026-11-15)

Both providers receive the shared Git/deletion/publication rules and pre-publication planning boundaries through the existing task carriers. New Claude actions select the dedicated inherited-tool agent unless a supported restricted mapping supplies a type. Claude archive actions use that dedicated identity.

The plugin-level Bash guard enforces its documented direct-command subset for identity-bearing `agent-smith:step` calls. OpenAI children and custom Claude mappings use their existing execution/permission controls plus semantic prompt rules. The Codex permission probe establishes filesystem/Git capability, with live model-command hook behavior requiring its existing acceptance checks.

Exact historical retries preserve stored prompt, provider and optional agent selection. `ruleFiles`, `agentFiles` and the new `hookFiles` hashes expose independent byte drift while stored provenance stays immutable. Claude’s plugin baseline is 2.1.292+, and fail-closed hook handling requires 2.1.295+. Older supported hosts have unverified runtime enforcement. Fresh-host identity/blocking and live planning adherence are pending Manual checks.

## Amendment 2 — Native step children (2026-11-16)

The retained-metadata native probe supports keeping the existing v2 transport disabled. The runner now supplies `agents.enabled=true` and `--disable multi_agent_v2` in its existing configuration path, including the model-free permission preflight. No profile, trust, sandbox or approval authority changes. Current native documentation exposes no depth cap; the shared instructions bound children to one leaf layer. See [native agent controls](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The recorded 0.169.0 exec stream carries root messages/turns and collaboration items. Child report text inside collaboration items never becomes a root RESULT. Explicitly foreign thread events are ignored. Final-file equality, terminal success and process-group closure remain required. A collaboration item marks unknown inclusive usage: omit tokens, retain enclosing elapsed time and disclose the limitation. No new usage schema or invented inclusion flag is introduced.

Native collection probes at `c4f7b69` inform this boundary; final-candidate both-chain, host/mode, effective child restrictions and cancellation acceptance remain pending. [Evidence](../../context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md) Historical pending dispatches remain exact. Downgrade requires settled children and resolved child-enabled pending prompts on the enabling revision, as in ADR-018 Amendment 3.

Native-capable exec retains CLI history for the observed 0.169.0 metadata contract. The existing lock records native ownership before spawn and root identity from `thread.started`. Release additionally requires a model-free app-server to prove fully paginated recursive descendant lists (all source kinds, archived and unarchived) and completed latest turns with valid completion timestamps. The ordinary-failure amendment below extends the root turn rule. Uncertain closure retains the lock and the orchestrator suspension STOP; a gone process group never proves native settlement. Numeric and legacy flat records keep their established recovery semantics. Retain the enabling revision and TMPDIR until authorized reconciliation and router-owned recovery; an older reader cannot safely interpret an unresolved native lock. [Ordinary-failure amendment](#amendment--ordinary-failures-after-native-settlement)

## Amendment — Observed accounting after native settlement

**Date** 2026-11-18. The collaboration omission described above is superseded by [ADR-018 Amendment 4](ADR-018-no-nested-subagents.md#amendment-4--observed-step-tree-token-accounting). The native runner keeps its execution/settlement boundary and separately collects bounded Codex 0.169.0 observed response usage for the matched tree. It returns verified step-tree evidence or a bounded unavailable reason, including for flat multi-request steps; accounting failure never changes execution correctness. The current schema, qualification limits and migration rules are in [the reference](../REFERENCE.md#observed-token-accounting). Earlier live evidence is historical and does not qualify the final accounting candidate.

## Amendment — Ordinary failures after native settlement

**Date** 2026-11-19. A launched `run` action can release native ownership after rejecting its result. Eligibility begins after process close and complete JSONL intake. It requires a trusted recorded root identity and intact execution JSONL without launch or stream faults, cancellation, an exit signal or an explicit root interruption. An ordinary failure is a numeric nonzero exit, exit zero with a final root `turn.failed`, or exit zero with `turn.completed` and a matching final file and assistant event that lack a valid last RESULT. Archive actions continue to require the successful result protocol to attempt settlement.

For an eligible rejected result, the root's latest turn may be `completed` or `failed`. Successful results and every descendant require `completed` proof. Every latest turn requires a positive safe-integer completion timestamp and a consistent start timestamp when present. Release still requires fully paginated and stable re-enumeration of descendants across archived and unarchived threads, plus closure of the recorded process group. A recorded failure without a completion timestamp can precede turn closure.

Once the lock is released, the runner returns the original bounded failure reason, null result and measured exec duration with CLI exit 1. It skips optional usage metadata reads. Both chain hosts write `unknown` with the reason and duration after runner close. The router records a failed attempt and retries according to its existing policy.

An unresolved attempt retains the lock. `Execution suspended:` identifies the exact lock, the recorded thread or `unknown`, and the closure problem when available. Keep the enabling revision and TMPDIR. Await an active runner through its existing handle. After it exits, the authorized owner must inspect the recorded thread and its descendants, prove settlement and arrange router-owned recovery before mutation, relaunch or publication. Automatic recovery for a retained native lock is unavailable. [Codex runner and lock behavior](../REFERENCE.md#codex-and-provider-dispatch)
