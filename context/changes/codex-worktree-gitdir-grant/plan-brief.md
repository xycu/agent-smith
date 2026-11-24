# Narrow per-run Codex Git grant — Plan Brief

> Full plan: `context/changes/codex-worktree-gitdir-grant/plan.md`
> Research: `context/changes/codex-worktree-gitdir-grant/research.md`

## What & Why

Issue #284 wants Codex worktree runs to stop prompting and stop appending a line to `~/.codex/config.toml` per worktree. PR #285 (merged as `79b6cc36`) already passes a per-run grant for the worktree's own gitdir. This change finishes the job: the shared Git paths a commit needs, advice that no longer hands out a whole-`.git` grant, a read-only list of the dead lines, and the macOS acceptance proof.

## Starting Point

`main` has #285's per-run grant: one gitdir path through an inline-table `-c`. `init` still advises a write grant on the whole common dir, which also opens `hooks` and `config`. The owner's `~/.codex/config.toml` holds 42 `worktrees` lines.

## Desired End State

A fresh isolated macOS run commits with no approval prompt and no new config line, while `<common>/hooks` and `<common>/config` stay denied. `init` advises the narrow entries and lists stale `agent-smith-*` lines, writing nothing.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Base | Build on `main` after #285 (merged) | Same `run-codex.mjs`; extend the one grant, no duplicate code | Plan |
| Grant set | gitdir + `<common>/objects`, `refs`, `logs` | Observed on macOS 0.172.0: commit passes, hooks/config denied | Research |
| `packed-refs` | Add only if the Phase 1 manual check needs it | One run printed a lock error but the commit passed | Plan |
| Stale lines | `init` lists them read-only | The router never edits user config | Plan |
| Codex-host sessions | Out of scope | Unknown size; separate change if needed | Plan |

## Scope

**In scope:** four-path per-run grant, narrow `init` advice, read-only stale-line scan, docs and ADR amendment, live macOS row.

**Out of scope:** any write to user config, #285's name resolution, worktree sessions inside an already-running Codex session.

## Architecture / Approach

One grant list built in `gitdirGrant()` and emitted as one inline-table `-c` for both the sandbox preflight and `exec`. `init-permissions.mjs` reuses the same path names for its remedy and adds a bounded, descriptor-based read of the Codex user config.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Narrow grant | Four-path per-run grant and tests | A Git operation beyond commit may need `packed-refs` |
| 2. `init` | Narrow advice and stale-line listing | Parsing `config.toml` keys without a TOML parser |
| 3. Docs and live row | REFERENCE, ADR amendment, macOS acceptance | Needs a real OpenAI step run by the owner |

**Prerequisites:** none open; #285 is merged.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Codex versions after 0.172.0 may change how filesystem rules merge or how `.git` is protected.
- Only macOS was checked here; the issue's earlier Linux evidence is from another project.
- Re-check #285's function names on `main` before Phase 1.
- The grant is automatic, so write access to shared `refs`, `logs` and `objects` is new default exposure; documented in the ADR amendment.

## Success Criteria (Summary)

- A fresh macOS worktree run commits with no prompt and no new `~/.codex/config.toml` line.
- Writes to `<common>/hooks` and `<common>/config` from inside the sandbox stay denied.
- `init` shows stale per-worktree lines and changes nothing.
