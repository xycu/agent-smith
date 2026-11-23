# Claude Run-Root Write Preflight — Plan Brief

> [Full implementation plan](plan.md) · [Frame brief](frame.md)

## What & Why

The run root that `prepare-run` places at `<root>/.claude/worktrees/agent-smith-<id>` is not writable from a Claude desktop session that does not own it. The desktop app's own `PreToolUse:Write` hook refuses the write, and nothing before step 1 detects this, so the run stalls with no named error. Both pipeline skills will check access before calling `init`. [Frame brief](frame.md)

## Starting Point

Shell setup can prepare a worktree even when Claude Desktop refuses native Write into it. The frame identifies two cases, an isolated session writing into a sibling worktree and a linked session writing under a shared worktree's protected `.claude/` directory. [Frame brief](frame.md)

## Desired End State

A refused Write names the path and the host's reason, tells the operator which session can resume, and stops before `init`. With Write access, the skill removes the probe and starts normally. If a later result write fails, the skill reports the affected step and keeps the pending result available for recovery.

## Key Decisions Made

| Decision | Choice | Rationale | Source |
| --- | --- | --- | --- |
| Host rule | Honor the host denial | Desktop applies the worktree rules to the actual Write call. | Frame |
| Placement | Use the run root selected by existing setup | The setup contract already preserves worktree and branch identity on resume. | Plan |
| Capability check | Native Write in the live change directory before `init` | This uses the operation the host refused and works before the router creates its runtime directory. | Plan |
| Refusal recovery | Preserve the prepared run and resume in an authorized session | The frame records successful recovery in the owner session. | Frame and plan |
| Verification | Local contract and CLI checks plus live Desktop checks | Tool-level behavior can be established only in the relevant Desktop sessions. | Plan |

## Scope

- Both pipeline skills, their startup and result-write STOP behavior, and operator recovery documentation.
- Setup continues to own worktree selection and readiness. The router continues to own persistent state and result intake. The manual-verify prompt and Git directory permissions retain their existing scope.

## Architecture / Approach

Each Claude orchestrator checks Write after validating setup output and live inputs. It writes an inert marker to an owned transient path under the selected chain's change directory and removes it before calling `init`. A refusal ends the invocation before source cleanup or dispatch. A later result-write refusal stops before `next`, retaining the pending step and its validated outcome for normal result intake from an authorized session.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Gate Claude writes and preserve recovery | Both skills implement the same preflight and result-write handling, with local regression checks and Desktop acceptance steps. | The probe proves only the operation and path it tests in the current session. |

**Prerequisites** Node.js 24 and Git for local tests. Claude Desktop with access to isolated, linked and authorized sessions for Manual verification.

**Estimated effort** One implementation session plus one Desktop verification session.

## Open Risks & Assumptions

- The chosen preflight covers Claude orchestrators regardless of provider, fresh or resumed startup, and the selected isolation mode. The current Write requirement and both observed host denial modes ground this decision. [Frame brief](frame.md) · [10x skill](../../../skills/10x-pipeline/SKILL.md#start)
- A successful probe does not guarantee that a different path or later call will succeed. The result-write STOP covers a denial after launch.
- After a blocked fresh invocation, ordinary reuse can retain the original inputs. The prepared checkout and run records stay available to the authorized session. [Setup cleanup contract](../../../skills/10x-pipeline/SKILL.md#start)

## Success Criteria Summary

- Local tests verify both skill contracts and the existing setup, reuse and result-intake behavior.
- Manual Desktop checks reproduce both denial types and confirm an actionable stop before initialization.
- Manual Desktop recovery reuses the refused run's worktree, removes the probe and completes the first step and result intake.

## References

- [Issue #243](https://github.com/xycu/agent-smith/issues/243) · [Frame and host errors](frame.md)
- [10x startup](../../../skills/10x-pipeline/SKILL.md#start) · [OpenSpec startup](../../../skills/openspec-pipeline/SKILL.md#start) · [Worktree isolation ADR](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
