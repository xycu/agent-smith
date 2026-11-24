# Claude capture default-on gate — Plan Brief

> Full plan: `context/changes/claude-capture-default-on/plan.md`
> Frame brief: `context/changes/claude-capture-default-on/frame.md`
> Research: `context/changes/claude-capture-default-on/research.md`

## What & Why

> An unbound Claude session is detected but never acted on — `init` warns on stderr and starts a run that is guaranteed to have no token figures.

`init` becomes a gate: on a native Claude host whose capture is not ready it halts before writing anything, with the launcher command, how to resume and the opt-out. The owner decided on 2026-11-24 that capture is expected by default, which overturns the 2026-11-21 opt-in decision.

## Starting Point

`claudeCaptureReadiness` already returns `disabled`, `unusable` or `ready`, and `initUsageWarning` turns the first two into one stderr line at `route.mjs:1134`. `isolation.require` is the existing halting gate with a policy opt-out. The version check is already a floor.

## Desired End State

An ordinary `claude` session that starts or resumes a Claude-hosted run stops at `init` with a pasteable launcher command and the resume step. A launcher session proceeds with verified figures. A project can opt out with `claudeCapture.require: false`. Codex, headless children and replays of non-Claude steps never halt.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gate surface | Policy block `claudeCapture.require`, default true, no flag | Mirrors `isolation.require`; the task asks for a policy block | Frame / Plan |
| Block name | `claudeCapture` (not `usageCapture`) | The gate covers Claude only; Codex stays a warning | Plan |
| Scope of halt | Native Claude host, Claude-assigned step, no `AGENT_SMITH_CLAUDE_SESSION`, readiness `disabled` or `unusable` | Other cases cannot be fixed by a launcher | Research |
| Unknown readiness | Warning, no halt | A failed import does not prove figures are lost | Plan |
| Check position | After `isolationCheck`, before permission and usage warnings | Nothing is written yet; main-checkout halt needs no relaunch | Research |
| Validation | `policyProblems` checks the block and a boolean `require` | A default-on gate must not misread a typo | Plan |
| Provenance | Section hashed, `provenance.ignore` unchanged | Same as `isolation`; avoids touching five docs and tests | Plan |
| Tests | Opt-out injected in `writeOverride`; direct override writers fixed; new halt/ready/exempt cases in `init-usage.test.mjs` | Keeps the suite green and covers both states | Research / Plan |
| Version range | Dropped | `claudeCaptureSupported` is already a floor | Frame |

## Scope

**In scope:** policy default, validation, gate function, `route.mjs` wiring, test helper and tests, `docs/REFERENCE.md`, README coverage paragraph, ADR-018 Amendment 8, ADR-019 Amendment 3, ADR and test indexes.

**Out of scope:** a per-run flag, Codex halt, version-range work, relaunching the host, a halt at `next`, `SKILL.md` changes, `usage.mjs` reason texts, ADR-022 amendment.

## Architecture / Approach

`init-usage.mjs` gains `claudeCaptureStop(...)`, built on a shared readiness helper that `claudeWarning` also uses. It returns the halt reason or `null`. `route.mjs` calls it right after `isolationCheck` and halts. `state.mjs` validates the new block at load. The halt writes nothing, so relaunch plus a repeated `init` with the same flags is the resume path (a run that already has steps keeps its saved host and provider mode).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Policy block, gate and tests | Default-on halt, validation, opt-out injection, tests for both states | Tests that write the override file directly halt at `init` |
| 2. Docs and ADR amendments | REFERENCE, README, ADR-018/019 amendments, indexes | Stale "off by default" wording left behind |

**Prerequisites:** Node 24+, the current change worktree.
**Estimated effort:** about 2 sessions across 2 phases, 8 to 10 files.

## Open Risks & Assumptions

- Not-yet-found test files may write the override without the opt-out; the full-suite run finds them.
- Release type (`feat!` like `isolation.require`) is left to the owner when the run PR title is derived.
- Live relaunch and resume is a Manual check; no automated test starts a real Claude session.

## Success Criteria (Summary)

- A Claude-hosted run from plain `claude` halts at `init` with the launcher command, resume step and opt-out, and writes nothing.
- A launcher session records verified figures as today; Codex and exempt cases never halt.
- Docs, README and ADR amendments match, and the full suite passes.
