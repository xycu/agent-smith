# Codex Run Gitdir Grant — Plan Brief

> Full plan: `context/changes/codex-run-gitdir-grant/plan.md`

## What & Why

On Codex CLI 0.171.0 an isolated OpenAI step never starts. The sandbox treats the run worktree's own gitdir (`<repo>/.git/worktrees/agent-smith-<id>`) as read-only, even with a write grant on `<repo>/.git`. The runner's permission preflight then refuses with a generic message ([#281](https://github.com/xycu/agent-smith/issues/281)). Today the only fix is a manual line in `~/.codex/config.toml` for every run.

## Starting Point

`run-codex.mjs` passes the same `configArgs` to the sandbox preflight and to `exec`, with no permission override, and it throws away stderr. Reproduced on 2026-11-24: an inline-table `-c 'permissions.<name>.filesystem={"<gitdir>"="write"}'` fixes the write and keeps the profile's other grants. A dotted key breaks on the `.` in `.git`. A wrong profile name is silently ignored.

## Desired End State

An isolated OpenAI step passes the preflight and commits with no manual Codex config edit. The runner grants write to exactly one path, the run root's resolved gitdir. A failed preflight shows the tail of Codex's stderr, which names the denied path.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| How the grant reaches Codex | Per-run `-c` inline table on both sandbox and `exec` | Proven to merge with existing grants, and it writes no user config |
| Profile name source | Policy `codex.permissions`, else `default_permissions` from the project `.codex/config.toml`, else `$CODEX_HOME/config.toml` | No setup for the usual layout; the preflight turns a wrong name into a loud refusal |
| Recording the rule change | ADR-024 amendment plus REFERENCE.md | The runner previously granted no permissions; the exception and its bound belong with the decisions |
| Refusal detail | Last 512 bytes of the preflight's stderr, sanitized, appended | Shows the exact denied path with no parser to maintain |
| Provisioning writes to config | Rejected | Leaves stale entries that build up in user config |

## Scope

**In scope:**
- `codex.permissions` policy key, carried in the dispatch like `codex.profile`
- Name and gitdir resolution and the `-c` grant in `run-codex.mjs`
- Bounded stderr tail in the preflight and timeout refusals
- Tests, ADR-024 amendment, REFERENCE.md

**Out of scope:**
- Writing or cleaning any Codex config file
- Following `-p` overlays or managed config for the name
- Builtin (`:`-prefixed) profiles and names with dots or quotes (no grant; the refusal explains)
- `init` warning and `SKILL.md` changes

## Architecture / Approach

Before the preflight, `runCodex` resolves the gitdir (`git rev-parse --absolute-git-dir`, realpath) and the profile name. When both are valid, `configArgs` appends one `-c permissions.<name>.filesystem={"<gitdir>"="write"}`. The sandbox preflight and `exec` share `configArgs`, so the preflight proves exactly what `exec` gets. `envelope.preflight.grant` records what was passed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Per-run gitdir grant | Policy key, dispatch field, name and gitdir resolution, grant on both invocations | Legacy pending entries without the field must still match |
| 2. Refusal detail | Bounded, sanitized stderr tail in refusals | Codex or node message wording may change between versions |
| 3. Docs and live check | ADR-024 amendment, REFERENCE.md, live split-mode row | Live check needs a paid OpenAI step |

**Prerequisites:** codex-cli 0.171.0 for the Manual rows; a profile with `extends = ":workspace"` and the common-dir grant (#257).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- The sandbox and `exec` apply `-c` permission overrides the same way. The preflight design already assumes this, and live row 3.3 checks it.
- Codex may later accept dotted path keys or change merge semantics. Tests pin the inline-table form only.

## Success Criteria (Summary)

- A split-mode isolated run on Codex 0.171.0 runs its first OpenAI step without a manual config edit.
- A refused preflight names the denied path.
