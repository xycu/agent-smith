# Init Permission Warnings — Plan Brief

[Full plan](plan.md)

## What & Why

Warn during `init` when Codex selects a missing permission profile or a Claude-linked worktree has no explicit write grant for shared Git metadata in the inspected settings. Each warning gives the operator a targeted configuration entry before dispatch.

## Starting Point

Both chains run the same router from the run worktree. Provider runners already prove permissions at dispatch. The router has the effective provider assignment and Git can resolve the real shared metadata path. [Router](../../../skills/10x-pipeline/scripts/route.mjs#L1080) · [Runner reference](../../../docs/REFERENCE.md)

## Desired End State

Codex profile warnings carry a TOML profile extending `:workspace` with a write rule for the resolved Git common directory when available. The Claude advisory carries an absolute `sandbox.filesystem.allowWrite` entry and explains the role of implicit access. Both skill entry points show warnings before dispatch. Stdout remains one action JSON object.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Delivery | Advisory stderr on fresh init and resume | Existing callers consume action JSON on stdout. |
| Provider scope | Use the router's provider assignment | Split mode can dispatch providers other than the current host. |
| Codex | Resolve the ambient default through a bounded model-free native command | Codex already owns config overlays, project trust, and managed precedence. |
| Claude | Inspect explicit settings and resolve the common path through Git | The linked worktree points to shared metadata, and Claude can grant implicit write access. |
| Evidence | Local fixture tests plus live manual host checks | Fixtures establish CLI behavior. Host checks establish the behavior of the actual permission layer. |

## Scope

The router provides advice, operators own settings and trust, and the existing runners retain runtime permission checks. Docker and gateway reachability belong to the separate readiness change. [Change record](change.md) · [Readiness change](../run-root-worktree-readiness/change.md)

## Architecture / Approach

A shared init diagnostic uses the selected providers and run-root Git identity. Codex resolves its own configuration. The Claude check reads standard user, project and local allowlists. Both skill loops surface stderr and use stdout for the existing action.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Warn about provider permissions at init | Both warnings, shared init integration, documentation and local regression coverage | Native Codex diagnostics vary by version, and Claude's effective access depends on session configuration. |

**Prerequisites** Node 24 and Git for automated verification. Real Codex and Claude with disposable trusted worktrees for manual verification.

**Estimated effort** One implementation session plus live host verification.

## Open Risks & Assumptions

- Use conservative wording when the inspected settings cannot establish explicit coverage. Vendors and the outer sandbox control runtime access.
- Confirm native Codex diagnostic behavior on the planned live versions. A failed nested sandbox startup and an undefined-profile diagnostic provide different evidence.

## Success Criteria (Summary)

- Local fixtures prove both remediation messages, provider and chain selection, resume behavior, settings preservation and a single stdout action JSON object.
- The Node 24 router, OpenSpec and tools suite passes. Manual checks record warning clearance and what the live environments allow.

## References

- [Issue #245](https://github.com/xycu/agent-smith/issues/245) · [Wave 3 ownership](../WAVES.md#wave-3)
- [Codex permissions](https://developers.openai.com/codex/permissions/) · [Claude sandboxing](https://code.claude.com/docs/en/sandboxing.md)
