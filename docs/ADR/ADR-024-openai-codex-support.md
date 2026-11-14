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
