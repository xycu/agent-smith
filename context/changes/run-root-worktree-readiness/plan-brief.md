# Run Root Worktree Readiness — Plan Brief

> [Full plan](plan.md)

## What & Why

A freshly created run can start from a stale commit, lack the dependencies needed by the project's gates, or use a service that another worktree is already changing. Prepare and check the project before either pipeline reaches its first step. [Issue #244](https://github.com/xycu/agent-smith/issues/244)

## Starting Point

Both pipeline skills call `prepare-run.mjs` before `init`. Setup pins the invoking commit, creates the worktree, and copies the change inputs. The existing branch lock and pending record let setup recover an interrupted copy. [Shared setup](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L297-L413)

## Desired End State

Fresh setup reports integration lag and stops before worktree creation when the invoking commit is behind. A current run installs supported locked dependencies inside its own worktree and checks the optional committed project command. If a project gate fails, setup names the failed prerequisite and preserves the worktree and copied inputs for retry.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Integration base | Advertised default branch of `origin`, or the sole remote. Without a remote, report a freshness skip. | The default follows repository conventions and keeps local projects usable. |
| Stale start | Report the exact lag and stop. | The operator chooses how to integrate upstream while setup keeps the original branch intact. |
| Dependencies | Choose npm, pnpm, Yarn or Bun from the lockfile and run its frozen install from the owning worktree package root. | Reproducible installs give later gates their local dependencies. Project ignore rules protect generated dependencies from the final sweep. |
| Project command | Run the optional committed top-level `readiness` string from the selected project root after dependencies. | The project owns service checks and other prerequisites. |
| Retry | Save copy completion in the existing pending record before running gates. | A failed install or hook can be retried while preserving worktree edits. |

## Scope

**In scope** Fresh isolation and pending recovery for both chains, actionable diagnostics, offline verification and operator documentation.

**Out of scope** Automatic rebase, project service provisioning, toolchain bootstrap, changes to router state, and publication.

## Architecture / Approach

The shared executable checks freshness before registering the branch, validates the copied worktree, then installs and runs the project check under the existing lock. Both pipeline skills use the existing setup failure path to stop before `init`. Ordinary resumes bypass preparation gates and a gate-only retry retains the original inputs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Verify integration freshness | An observed integration tip, exact lag and a safe stop before worktree creation | Relying on stale refs or excluding local commits from the new worktree |
| 2. Prepare dependencies and run the project preflight | Worktree-local installation, optional hook, bounded failure and retry | Copying over worktree edits during retry or releasing the lock while a child still writes |

**Prerequisites** Shipped pending-copy recovery from PR #252, Node 24+, Git and the target project's installed JS package manager when required.

**Estimated effort** Two implementation phases with local CLI fixtures and a full test pass.

## Open Risks & Assumptions

- The remote default is the integration branch for this delivery. Ambiguous remote selection or an unreachable remote stops preparation.
- The readiness command comes from trusted committed project policy. The project command owns isolation of services such as a database.
- Finish pending setup with the enabling version before downgrading so a completed copy is preserved.

## Success Criteria (Summary)

- Local Git fixtures prove fresh base selection, precise lag and an unchanged original checkout on failure.
- Offline fixtures prove locked installation, hook order, stop-before-init behavior and retry without recopying inputs.
- The owner exercises a real lockfile and the configured readiness hook against an unavailable or shared service.

## References

- [Change notes](change.md) · [Wave scheduling](../WAVES.md)
- [Run setup reference](../../../docs/REFERENCE.md#L143-L173) · [ADR-010 pending recovery](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#amendment-6--retry-an-interrupted-setup-copy-2026-11-21)
