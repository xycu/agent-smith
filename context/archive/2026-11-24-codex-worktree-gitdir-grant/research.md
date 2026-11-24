---
date: 2026-11-24T16:40:05+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 4eaed18854ea08b49d93bf69aaf66058a77b5ffd
branch: main
repository: agent-smith
topic: "Does Agent Smith still need a per-run Codex gitdir grant (issue #284), or does an open PR already cover it?"
tags: [research, codex, worktree, gitdir, sandbox, run-codex]
status: complete
last_updated: 2026-11-24
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Pass the worktree gitdir write grant to Codex at launch (issue #284)

**Date**: 2026-11-24T16:40:05+01:00
**Branch**: main at `4eaed188` (PR #285 is a separate branch, read through `git diff main...agent-smith/codex-run-gitdir-grant`)

## Research Question

Where does Agent Smith launch Codex for a worktree, does a per-run `-c` gitdir grant merge with the profile, does it work on macOS, and do the issue's acceptance lines hold?

## Summary

- **Issue #284 duplicates open PR #285.** PR [#285](https://github.com/xycu/agent-smith/pull/285) (branch `agent-smith/codex-run-gitdir-grant`, change `codex-run-gitdir-grant`, origin issue #281) already passes `-c permissions.<profile>.filesystem={"<gitdir>"="write"}` to the Codex preflight and to `codex exec`. On the inspected head it is `MERGEABLE`, with every listed check `SUCCESS` and no review decision. It is not on `main`.
- **The inline-table grant merges and works on macOS.** Observed on this machine (Darwin, codex-cli 0.172.0, `codex sandbox`, private `CODEX_HOME`, scratch repo outside `/tmp`): with no override the linked worktree's gitdir write fails with `Operation not permitted`; with the inline table it succeeds. The profile's other rules stayed in force in the same run (the `<repo>/.git/hooks` and `<repo>/.git/config` writes were still refused).
- **Acceptance line 2 conflicts with what a commit needs.** In the same macOS run, with only the gitdir grant and no `<repo>/.git` grant, `git add` succeeded but `git commit` failed (`unable to create temporary file: Operation not permitted`, `failed to write commit object`), so the shared object store needs write access. The `init` warning recommends a `<repo>/.git` write grant, which would cover the object store; whether it also opens `hooks` and `config` was not proven here (see the live-check note). A finer common-dir grant (objects, refs, logs) was not tried.
- **Open question of the issue stays open for the Codex host.** PR #285 patches `run-codex.mjs` only, which spawns `codex` as a separate process per step. Whether any worktree session runs inside an already-started Codex session was not inspected.
- **The 42-line cleanup is out of #285's scope.** Its plan says "no cleanup of the owner's stale manual entries". The inspected `~/.codex/config.toml` still holds 42 lines containing `worktrees` (`grep -n worktrees | wc -l`, 2026-11-24).

## Detailed Findings

### Where Codex is launched (main)

- `run-codex.mjs:27-30` builds `configArgs(action)`: `-C ROOT`, `-p <profile>` when set, `-c model_reasoning_effort=…`, `-c agents.enabled=true`, `--disable multi_agent_v2`. No filesystem grant. This path covers `sandbox` preflight (`:223`) and `exec` (later in the same function), both spawned with `spawn("codex", …)` at `:179`.
- `codex-startup.mjs:7-9` is the only helper of profile flags; `init-permissions.mjs:34-35` and `runner-toolkit.mjs:13` spawn Codex for probes and the toolkit check, not for step work.
- `init-permissions.mjs:46-63` prints the manual remedy: a `[permissions.<name>.filesystem]` entry `"<common dir>" = "write"` in the trusted project's `.codex/config.toml`. It targets the shared common dir, not the per-worktree gitdir.
- The repo's own `.codex/config.toml` defines `[permissions.agent-smith] extends = ":workspace"` with network only, no filesystem table.

### What PR #285 already does (head `875e98ba`)

- `run-codex.mjs` `configArgs(action, grant)` appends the inline-table `-c` last, so the preflight (which slices off only the `-C` pair) and `exec` carry the same grant.
- `gitdirGrant()` resolves the profile name from `codex.permissions`, then the project `.codex/config.toml`, then `CODEX_HOME/config.toml`; resolves `rev-parse --absolute-git-dir` and `--git-common-dir` and realpaths both; returns no grant when they are equal (not a linked worktree) or the name is builtin or invalid.
- It adds `codex.permissions` as an optional policy key (`state.mjs`, `runner-dispatch.mjs`), a 512-byte sanitized stderr tail in refusals, and docs.
- Its plan records the same merge reproduction on codex-cli 0.171.0 (inline table merges; dotted key fails; wrong profile name is ignored silently).
- Its Manual rows 1.4, 2.2 and 3.3 are unchecked: they need 0.171.0 live runs, and only 0.172.0 is installed here (`context/changes/codex-run-gitdir-grant/evidence/unproven.md`). It does not claim macOS or seatbelt evidence; the plan's reproduction does not name an OS.

### Live check on this machine (macOS, 0.172.0)

Scratch repo plus linked worktree under `$HOME` (not `/tmp`, which the workspace profile appears to make writable; a first run under `/tmp` could not show denials and is not used). Profile `probe` extends `:workspace` and had no `.git` grant:

| Override | worktree gitdir write | `<repo>/.git/hooks` | `<repo>/.git/config` | `git commit` |
| --- | --- | --- | --- | --- |
| none | denied | denied | denied | fails (index.lock) |
| `-c permissions.probe.filesystem={"<gitdir>"="write"}` | ok | denied | denied | fails (object store) |

An earlier run under `/tmp` (profile with `"<repo>/.git" = "write"`) showed `hooks`, `config` and `commit` all succeeding, but `/tmp` may be writable by itself, so that run does not prove a `.git` grant opens `hooks` and `config`. Not re-run under `$HOME`.

### Consequence for the issue's acceptance lines

- "A fresh worktree run … commits with no approval prompt": needs the inline gitdir grant (PR #285) and a profile that can write the shared object store; this inspection did not test a run through Agent Smith itself.
- "Writes to `<common>/.git/hooks` and `<common>/.git/config` … stay denied": holds with the inline grant alone (observed), but then commit fails. Whether it holds with the `<common>/.git` write grant that the current `init` advice recommends was not proven; it likely does not, since that grant covers the directory. Treat the line as unverified for the real run configuration.

## Code References

- `skills/10x-pipeline/scripts/run-codex.mjs:27-30` - `configArgs`, no grant on main
- `skills/10x-pipeline/scripts/run-codex.mjs:179` - `spawn("codex", args, …)` for sandbox and exec
- `skills/10x-pipeline/scripts/init-permissions.mjs:46-63` - manual common-dir remedy text
- `skills/10x-pipeline/scripts/codex-startup.mjs:7-9` - `codexProfileArgs`
- `.codex/config.toml` - project profile, no filesystem table
- PR #285 `run-codex.mjs` `configArgs`, `gitdirGrant` - the per-run grant
- `.claude/worktrees/agent-smith-codex-run-gitdir-grant/context/changes/codex-run-gitdir-grant/plan.md:16-35` - reproduction and discoveries

## Architecture Insights

- The grant belongs in `run-codex.mjs` (the only spawn site for step work); policy lives in `codex.permissions`.
- A wrong profile name fails closed: the grant is silently ignored and the preflight then refuses.
- The router otherwise never writes Codex config (PR #285 plan, "What We're NOT Doing").

## Historical Context (from prior changes)

- `context/archive/2026-11-21-codex-profile-and-gitdir-access/` (#257) - added the `init` warning for profile and common-dir grant; did not grant per-worktree gitdirs.
- `context/changes/WAVES.md` - lists `codex-profile-and-gitdir-access` as merged in Wave 4; does not list `codex-run-gitdir-grant`.
- Memory note "Codex worktree gitdir write": the manual config.toml line before the first OpenAI step is today's workaround.

## Related Research

None under `context/changes/**/research.md` for this question.

## Open Questions

1. Close #284 as a duplicate of #281/#285, or keep this change for the residue (cleanup of stale lines, the hooks/config line, macOS proof)?
2. Can the common dir be granted more narrowly than `<repo>/.git` (objects, refs, logs, packed-refs, per-worktree dirs only) so hooks and config stay denied while commits work? Not tested.
3. Does any worktree session run inside an already-started Codex session (the issue's open question)? Not inspected.
4. PR #285's live Manual rows name 0.171.0; installed is 0.172.0. Decide whether 0.172.0 evidence is enough.
