# Codex Run Gitdir Grant Implementation Plan

## Overview

Fix [#281](https://github.com/xycu/agent-smith/issues/281). On Codex 0.171.0 the run worktree's own gitdir (`<repo>/.git/worktrees/agent-smith-<id>`) is read-only inside the sandbox, even with a write grant on `<repo>/.git`. So the runner's permission preflight always refuses an isolated OpenAI step. The runner will pass a per-run write grant for exactly that gitdir to both the sandbox preflight and `codex exec`. When the preflight still fails, the refusal will show a bounded tail of Codex's stderr so the denied path is visible.

## Current State Analysis

- `run-codex.mjs:27-30` `configArgs` builds the shared argv for the sandbox preflight (`:227`, with `-C` sliced off) and `exec` (`:287`): `-C`, optional `-p`, effort, agents. It passes no permission override.
- `run-codex.mjs:198` drains the child's stderr with `child.stderr.resume()` and keeps none of it. The refusal at `:236` is a generic list of possible causes.
- `permission-probe.mjs:12-19` already writes a probe file into the resolved gitdir, common dir, `objects`, `refs` and `refs/heads`, so the preflight detects the denial correctly. Only the grant and the message are missing.
- The profile name flows as `codex.profile` (policy) → `dispatchTarget` (`state.mjs:157-161`) → the pending dispatch entry (`...target` at `route.mjs:269`, `:322` and `isolation.mjs:841` carries every target field, so a new field flows by itself) → exact-match check in `runner-dispatch.mjs:44,54` (run) and `:76-77` (archive key list) → neutral replay (`flow.mjs:500`). `route.mjs:777` only prints the status step list. Policy validation is at `state.mjs:247-251` and is covered by `providers.test.mjs`.
- `init-permissions.mjs` warns at `init` about the profile and the common dir. It does not cover the per-worktree gitdir and is not changed here.
- Today's workaround is a manual `"<repo>/.git/worktrees/agent-smith-<id>" = "write"` line in `~/.codex/config.toml` for each run. The owner's config already holds about six stale ones.

### Reproduction on codex-cli 0.171.0 (2026-11-24)

Scratch repo with a linked worktree `wt`, and a private `CODEX_HOME` with `default_permissions = "probe"`, `[permissions.probe] extends = ":workspace"` and filesystem grants `"<main>/.git" = "write"` and `"<other>" = "write"`. Run from `wt` with `codex sandbox [...] -- sh -c 'touch …'`:

| Override | gitdir `.git/worktrees/wt` | `<other>` | `<main>/.git` |
| --- | --- | --- | --- |
| none | `Operation not permitted` | ok | ok |
| `-c 'permissions.probe.filesystem={"<gitdir>"="write"}'` | ok | ok | ok |
| `-c 'permissions.probe.filesystem."<gitdir>"="write"'` | Error: path "must be absolute" (key split on `.`) | — | — |
| `-c 'permissions.nope.filesystem={…}'` (wrong profile name) | `Operation not permitted`, no error | — | — |

With the inline-table grant, `git add` + `git commit` inside `wt` succeeded. `-c permissions={}` also merges and raises no error, so it cannot be used to find the profile name.

## Desired End State

An isolated OpenAI step on Codex 0.171.0 passes the permission preflight and commits, with no manual entry in `~/.codex/config.toml`. The runner grants write access to one path only: the run root's resolved gitdir. When the preflight fails for any reason, the refusal ends with a sanitized tail of Codex's stderr that names the failing path.

### Key Discoveries:

- `-c` inline tables merge into the existing `[permissions.<name>.filesystem]` table. They do not replace it (reproduction above).
- A dotted `-c` key cannot carry a path, because Codex splits the key on every `.`. Only the inline-table form works, so the profile name itself must be free of dots and quotes.
- A grant on the wrong profile name is silently ignored. The existing preflight then fails, so a wrong name fails loudly. It never grants silently.
- `runner-dispatch.mjs:44-56` compares `profile` against the pending entry, and the archive branch (`:76-77`) compares a fixed key list against `archiveDescriptor`. A new action field needs both checks and must accept legacy entries and actions that lack it.

## What We're NOT Doing

- No writes to `~/.codex/config.toml` or the project's `.codex/config.toml`, and no cleanup of the owner's stale manual entries.
- No following of `-p` overlays (`[profiles.<x>] default_permissions`) or managed config when resolving the name. Set `codex.permissions` for those layouts.
- No grant when the resolved permissions name is a builtin (starting with `:`) or contains characters other than `[A-Za-z0-9_-]`. The preflight then refuses as today, now with stderr.
- No change to the `init` warnings in `init-permissions.mjs` or to `SKILL.md`. The `SKILL.md` sentence that existing controls own Git permissions "without creating profiles or granting trust" stays true: the runner creates no profile and grants no trust, only one path of an existing profile.
- No grant of the common dir, `objects` or `refs`. Those stay with the user's profile (#257).

## Implementation Approach

Resolve two values once in `runCodex`, before the preflight: the gitdir (`git rev-parse --absolute-git-dir` in `ROOT`, realpath) and the permissions profile name. Name order: `action.permissions` (from the new policy key `codex.permissions`), then the top-level `default_permissions` line of `<ROOT>/.codex/config.toml`, then that of `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`). When both values are valid, `configArgs` appends one `-c` grant, so the preflight and `exec` get identical arguments. The existing preflight proves the grant works before any model launches.

## Critical Implementation Details

The `-c` value must be a TOML inline table with `=`, not JSON (`:`). Use the JSON-quoted path as the key, after rejecting paths with control characters: `` `permissions.${name}.filesystem={${JSON.stringify(gitDir)}="write"}` ``. The preflight argv is `configArgs(action).slice(2)` (drops `-C`), so append the grant at the end of `configArgs`, never at the front.

## Phase 1: Per-run gitdir grant

### Overview

Add the policy key, carry it through dispatch, resolve the name and gitdir in the runner, and pass the grant to both Codex invocations.

### Changes Required:

#### 1. Policy key and dispatch target

**File**: `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/policy.json`

**Intent**: Add `codex.permissions`, the permissions profile name the grant targets, next to `codex.profile`. Copy it into OpenAI dispatch targets the way `profile` is copied.

**Contract**: `codex.permissions` is `null` (default; resolve from config) or a string matching `^[A-Za-z0-9_-]{1,128}$`. Anything else is rejected at load with a `bad("codex.permissions", …)` problem (ADR-022). `dispatchTarget` adds `permissions: policy.codex?.permissions ?? null` for OpenAI. `policy.json` `codex` gains `"permissions": null`. Check `codex-policy.json` and add the key there too if it carries a `codex` object.

#### 2. Dispatch validation and neutral replay

**File**: `skills/10x-pipeline/scripts/runner-dispatch.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Validate `action.permissions` and require it to equal the pending entry's value, in the run branch and in the archive branch. Replay the stored value on a neutral retry. Runs saved before this change still match.

**Contract**: An absent `permissions` on the entry, the expected archive descriptor or the action counts as `null` (compare `?? null` on both sides). Add `"permissions"` to the archive key list at `runner-dispatch.mjs:76`. The replay at `flow.mjs:500` copies `permissions: last.permissions ?? null` for OpenAI entries. `route.mjs:777` (status step list) may print `permissions: e.permissions ?? null` next to `profile`; it takes no part in dispatch. Tests cover a legacy run entry, a neutral retry and an archive action with and without the field.

#### 3. Runner grant

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Resolve the gitdir and the profile name once, before the preflight, and append the grant to `configArgs`. Then the preflight proves exactly what `exec` will get.

**Contract**: The name comes from `action.permissions`, else the first top-level `default_permissions` line, before any `[table]` header, in `<ROOT>/.codex/config.toml`, else in `${CODEX_HOME || ~/.codex}/config.toml`. A line matches only `^\s*default_permissions\s*=\s*"([^"\\]*)"\s*(#.*)?$` (a basic double-quoted string, optional trailing comment). Single-quoted, escaped, dotted-key and inline-table forms give no name from that source. Reading is bounded to 64 KiB and never blocks: open with `O_RDONLY | O_NONBLOCK`, `fstat` the descriptor and require a regular file (lesson: open a lock-free read target by descriptor). The project file, which the repository controls, is also opened with `O_NOFOLLOW`; the `CODEX_HOME` file is resolved with `realpath` first, so a dotfile-manager symlink works. Reuse `readGuarded` (`state.mjs:1103`) where its guard fits. A missing, unreadable, oversized, non-regular or non-matching file means no name from that source. No grant when: there is no name, the name fails the policy pattern, the name starts with `:`, the gitdir cannot be resolved, or the gitdir path matches `[\x00-\x1f\x7f]`. On success `envelope.preflight` is `{ ...proof, grant: { profile, gitDir } }` (the current `envelope.preflight = proof` assignment must not drop it), and `grant: null` when none was passed.

#### 4. Tests

**File**: `skills/10x-pipeline/test/providers.test.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Prove validation, name resolution order and identical argv for the sandbox and `exec`, using the existing fake Codex that records argv.

**Contract**: Cases: policy rejects `codex.permissions` values `"a.b"`, `":workspace"`, `""` and `42`, and accepts `null` and `"agent-smith"`. The runner reads the name from the project config, and from `CODEX_HOME` when the project has none. The policy value beats both config files. A `config.toml` that is a FIFO, a directory or (project file) a symlink gives no name and does not hang. Single-quoted, commented-out and `[table]`-scoped `default_permissions` lines give no name; a double-quoted line with a trailing comment does. A symlinked `CODEX_HOME/config.toml` is read. No name means no `-c permissions…` argument in either argv. The sandbox and `exec` argv carry the same grant string, with the fixture worktree's realpath gitdir. A legacy pending entry without `permissions` still matches. Update the `codex-runner.test.mjs` row in the test README.

### Success Criteria:

#### Automated Verification:

- Policy and runner tests pass: `node --test skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs`
- Codex chain and dispatch tests still pass: `node --test skills/10x-pipeline/test/codex-chain.test.mjs`
- No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- On codex-cli 0.171.0, in an isolated run worktree with no `.git/worktrees/agent-smith-<id>` entry in `~/.codex/config.toml`, `run-codex.mjs` passes the preflight (`envelope.preflight.grant` names the profile and gitdir)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Refusal detail

### Overview

Keep a bounded, sanitized tail of the preflight's stderr and add it to the refusal messages.

### Changes Required:

#### 1. Bounded stderr capture

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Let `launch` take an optional stderr sink, used only by the preflight, that keeps the last 512 bytes. `exec` keeps draining stderr as now.

**Contract**: The sink keeps the last 512 bytes of the raw stderr stream (`Buffer`, not string characters) and decodes them as UTF-8, so a cut multibyte character becomes U+FFFD. The tail replaces characters matching `[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}�]` with a space, collapses whitespace and trims, so its length is at most 512 bytes. The Git-capability refusal (`:236`) and the timeout refusal (`:230`) keep their text and append, after "No model launched.", first a grant status and then, when the tail is non-empty, ` Codex output: <tail>`. The grant status is ` Gitdir grant: <profile> on <gitDir>.` when a grant was passed, else ` No gitdir grant (<reason: no permissions profile name, builtin name, invalid name or no gitdir>); set codex.permissions to a custom profile name.` The final `envelope.reason` stays within the existing 2048-character `failureReason` cap, which today's refusal text plus the 512-byte tail leaves room for.

#### 2. Tests

**File**: `skills/10x-pipeline/test/codex-runner.test.mjs`

**Intent**: Prove that the denied path reaches the reason, and that the tail is bounded and sanitized.

**Contract**: The fake sandbox exits 1 after writing `EPERM: operation not permitted, open '<gitdir>/x'` to stderr. The reason contains that path and `launched` is `false`. A 10 KiB stderr with control characters and multibyte characters yields at most 512 bytes of tail, with no control characters. A refusal with no resolvable name states the no-grant reason and names `codex.permissions`; a refusal with a grant names the profile and gitdir.

### Success Criteria:

#### Automated Verification:

- Runner tests pass: `node --test skills/10x-pipeline/test/codex-runner.test.mjs`

#### Manual Verification:

- With the grant removed (`codex.permissions` set to a profile name that does not exist), a live preflight refusal names the denied `.git/worktrees/agent-smith-<id>` path

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Docs and live check

### Overview

Record that the runner now grants one bounded permission, and document the policy key and the refusal output.

### Changes Required:

#### 1. ADR-024 amendment

**File**: `docs/ADR/ADR-024-openai-codex-support.md`

**Intent**: Add `## Amendment — Per-run gitdir grant (2026-11-24)`. It covers the 0.171.0 denial, the decision that the runner grants write only to the run root's resolved gitdir through `-c` on the resolved permissions profile, and the rejected options: provisioning writes to user config, and a policy-key-only name.

**Contract**: It states the bound (one path, never the common dir or other paths), the name resolution order, the no-grant cases and that the preflight proves the grant.

#### 2. Reference and README

**File**: `docs/REFERENCE.md`, `README.md` (only if it describes Codex permissions setup)

**Intent**: Replace "The runner grants no trust or permissions" (Codex dispatch section, line ~42) with the bounded exception. Describe the preflight grant and stderr tail in the preflight paragraph (~44), and document `codex.permissions` next to `codex.profile` (~30). Link the amendment.

**Contract**: Text only. Name `codex-cli 0.171.0` as the observed version. Before finishing, grep `README.md`, `docs/` and both `SKILL.md` files for "grants no trust or permissions" and for the old preflight wording, and update any other hit.

### Success Criteria:

#### Automated Verification:

- Version fields still agree: `node tools/version-check.mjs`
- The changed text is present: `grep -n "codex.permissions" docs/REFERENCE.md docs/ADR/ADR-024-openai-codex-support.md`

#### Manual Verification:

- A live `--provider-mode split` run in an isolated worktree on codex-cli 0.171.0 completes its first OpenAI step with no manual `~/.codex/config.toml` grant for that worktree

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Policy validation of `codex.permissions` (valid and invalid values).
- Name resolution order: policy, then project config, then `CODEX_HOME`. Covers missing files, a `default_permissions` line inside a table (ignored) and builtin `:` names (no grant).
- Identical grant in sandbox and `exec` argv. A legacy pending entry without `permissions`.
- Bounded, sanitized stderr tail in the refusal.

### Integration Tests:

- `codex-chain.test.mjs` both-chain matrix still passes with the new action field, including neutral retry.

### Manual Testing Steps:

1. Remove (or skip adding) the `.git/worktrees/agent-smith-<id>` line from `~/.codex/config.toml` for a new run.
2. Run `prepare-run.mjs`, `init --provider-mode split`, then dispatch the first OpenAI step through `run-codex.mjs`.
3. Confirm the preflight passes, `envelope.preflight.grant` is set and the step commits.
4. Set `codex.permissions` to an unknown name in `context/foundation/agent-smith-policy.json` and confirm the refusal names the denied gitdir path.

## Performance Considerations

Two small bounded file reads and one `git rev-parse` per runner call, run once before the preflight.

## Migration Notes

Pending dispatch entries and neutral replays saved before this change lack `permissions` and are read as `null`, so they resolve the name from config. Users can delete their manual `.git/worktrees/agent-smith-*` grants from `~/.codex/config.toml` once this ships. The plugin does not do it for them.

## References

- Issue: [#281](https://github.com/xycu/agent-smith/issues/281)
- Prior change: `context/archive/2026-11-21-codex-profile-and-gitdir-access/plan.md`
- Runner: `skills/10x-pipeline/scripts/run-codex.mjs:27`, `:198`, `:227`, `:236`, `:287`
- Probe: `skills/10x-pipeline/scripts/permission-probe.mjs:12`
- Dispatch: `skills/10x-pipeline/scripts/state.mjs:157`, `:247`; `runner-dispatch.mjs:44`, `:76`; `flow.mjs:500`; `route.mjs:269`, `:322`, `:777`; `isolation.mjs:841`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-run gitdir grant

#### Automated

- [x] 1.1 Policy and runner tests pass: `node --test skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs` — 54bb5ae0
- [x] 1.2 Codex chain and dispatch tests still pass: `node --test skills/10x-pipeline/test/codex-chain.test.mjs` — 54bb5ae0
- [x] 1.3 No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — 54bb5ae0

#### Manual

- [ ] 1.4 On codex-cli 0.171.0, in an isolated run worktree with no `.git/worktrees/agent-smith-<id>` entry in `~/.codex/config.toml`, `run-codex.mjs` passes the preflight (`envelope.preflight.grant` names the profile and gitdir)

### Phase 2: Refusal detail

#### Automated

- [x] 2.1 Runner tests pass: `node --test skills/10x-pipeline/test/codex-runner.test.mjs` — 6b7d804a

#### Manual

- [ ] 2.2 With the grant removed (`codex.permissions` set to a profile name that does not exist), a live preflight refusal names the denied `.git/worktrees/agent-smith-<id>` path

### Phase 3: Docs and live check

#### Automated

- [x] 3.1 Version fields still agree: `node tools/version-check.mjs` — 3a157c21
- [x] 3.2 The changed text is present: `grep -n "codex.permissions" docs/REFERENCE.md docs/ADR/ADR-024-openai-codex-support.md` — 3a157c21

#### Manual

- [ ] 3.3 A live `--provider-mode split` run in an isolated worktree on codex-cli 0.171.0 completes its first OpenAI step with no manual `~/.codex/config.toml` grant for that worktree
