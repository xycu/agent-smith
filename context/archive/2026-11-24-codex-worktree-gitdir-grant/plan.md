# Narrow per-run Codex Git grant, stale-line listing and macOS acceptance Implementation Plan

## Overview

Issue [#284](https://github.com/xycu/agent-smith/issues/284) asks for a per-run Codex gitdir write grant instead of one persisted `~/.codex/config.toml` line per worktree. PR [#285](https://github.com/xycu/agent-smith/pull/285) (change `codex-run-gitdir-grant`, origin issue #281), merged to `main` as `79b6cc36`, already delivers that grant for the worktree's own gitdir. This change covers what #285 leaves: the shared common-dir paths a commit needs (so a whole-`.git` grant is no longer advised and hooks and config stay denied), a read-only listing of the stale per-worktree lines, and the live macOS acceptance row.

**Sequencing:** #285 is merged, so Phase 1 builds directly on `main` (`79b6cc36` or later). The function and file names below are those of `main` after #285; re-check them before Phase 1.

## Current State Analysis

- `main` before #285 (`4eaed188`): `configArgs` carried no filesystem grant.
- `main` after #285 (`79b6cc36`): `configArgs(action, grant)` (`run-codex.mjs:27-33`) appends `-c permissions.<profile>.filesystem={"<gitdir>"="write"}` last; `gitdirGrant()` resolves the profile name (`codex.permissions`, project `.codex/config.toml`, then `CODEX_HOME/config.toml`), realpaths `--absolute-git-dir` and `--git-common-dir`, and returns no grant when they are equal (`gitdirGrant` at `run-codex.mjs:58-77`, grant shape `{ profile, gitDir }`). Existing assertions on that shape to update: `codex-runner.test.mjs:797-799` and `:883-886`, `init-permissions.test.mjs:204`.
- `init-permissions.mjs:46-63` (`codexWarning`, called only when an OpenAI provider is selected) prints a remedy with `"<common>" = "write"` for the whole common dir. A whole-`.git` write grant also makes `<common>/hooks` and `<common>/config` writable.
- `~/.codex/config.toml` holds 42 lines containing `worktrees` (2026-11-24). #285's plan declines any cleanup.
- Research: [research.md](research.md).

## Desired End State

On macOS with Codex, a fresh isolated OpenAI step stages and commits with no approval prompt and no new line in `~/.codex/config.toml`, while writes to `<common>/hooks` and `<common>/config` stay denied. `init` advises the narrow entries and, when it finds stale per-worktree lines in the Codex user config, lists them and says they are no longer needed; it writes nothing.

### Key Discoveries:

- Observed on macOS, codex-cli 0.172.0, `codex sandbox`, scratch repo under `$HOME`: gitdir + `<common>/objects` + `refs` + `logs` as one inline table lets `git commit` succeed with `hooks` and `config` writes still `Operation not permitted`. The same table with the whole `<common>` makes both writable. A gitdir-only grant lets `git add` pass but `git commit` fails on the object store. (research.md, Live check)
- That run printed `error: Unable to create '<common>/packed-refs.lock'` while the commit still succeeded; whether `packed-refs` needs a grant for other Git operations (branch deletion, `gc`, `pack-refs`) is not proven.
- An inline table merges into the profile's filesystem table (#285 plan reproduction on 0.171.0; this run on 0.172.0). A dotted `-c` key fails because Codex splits the key on `.`.
- A wrong profile name is ignored silently, so the preflight then fails loudly; a grant never applies by accident.

## What We're NOT Doing

- No write to `~/.codex/config.toml`, the project `.codex/config.toml` or any user config; the stale-line step only reads and prints.
- No change to #285's profile-name resolution, `codex.permissions` key or stderr tail.
- No investigation of worktree sessions that run inside an already-started Codex session (the issue's open question); a separate change if it turns out to matter.
- No grant when `--absolute-git-dir` equals `--git-common-dir` (not a linked worktree), as in #285.
- No grant for `<common>/hooks`, `<common>/config`, `<common>/info` or any path outside objects, refs, logs (and `packed-refs` only if Phase 1's check shows it is needed).

## Implementation Approach

Extend #285's grant from one path to a small fixed set, built in one place and passed through the same inline-table `-c` to both the preflight and `exec`. Then change the `init` advice to the same set and add a bounded read-only scan for dead per-worktree lines. Finish with docs and a live acceptance row, since the suite cannot start a real Codex.

## Phase 1: Per-run narrow common-dir grant

### Overview

For a linked worktree, the runner grants write to the run root's gitdir plus the shared object store, refs and logs, nothing else.

### Changes Required:

#### 1. Grant set in the runner

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Replace #285's single `gitDir` with a list: the gitdir, then `<common>/objects`, `<common>/refs`, `<common>/logs`. Build the list in `gitdirGrant()` from the already realpathed common dir and emit all entries in the same inline table in `configArgs`.

**Contract**: `grant` becomes `{ profile, paths: [..] }` (or `null` with `why`). `configArgs` emits `permissions.<profile>.filesystem={"<p1>"="write",…}` with `JSON.stringify` per path, last in argv, identical for sandbox and `exec`. A path containing a control character, or a missing `objects` or `refs`, drops the whole grant with `why` ("no gitdir", or a distinct "no common subdirectory" for a missing one). `logs` is optional: it is added only when the directory exists (a repository with `core.logAllRefUpdates=false` or no reflog yet has none), and its absence never drops the grant. Each subdirectory is realpathed with the common dir. `envelope.preflight.grant` and the refusal text (`Gitdir grant: <profile> on <paths>.`) list every path.

#### 2. Tests

**File**: `skills/10x-pipeline/test/codex-runner.test.mjs`

**Intent**: Extend #285's grant cases to the set: identical argv for sandbox and `exec`, exactly the four paths for a linked worktree, none for a main checkout, none when `objects` or `refs` is missing, three paths (no `logs`) when `logs` is missing, path with a control character refused.

**Contract**: Fake-Codex assertions on argv only; no real Codex.

### Success Criteria:

#### Automated Verification:

- Runner tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/providers.test.mjs`
- Grant argv holds exactly gitdir, objects, refs and logs for a linked worktree and nothing for a main checkout.
- No test or script uses a recursive delete: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- On macOS with Codex, `codex sandbox -c '<generated table>'` in a linked worktree lets `git add` and `git commit` succeed and leaves `<common>/hooks` and `<common>/config` writes denied.
- Branch creation, `git branch -d` and `git gc --auto` inside the same sandbox either pass or the failing path is recorded; add `<common>/packed-refs` to the set only if one of them needs it.

**Implementation Note**: Pause for the manual check before Phase 2.

---

## Phase 2: `init` advice and stale-line listing

### Overview

`init` recommends the same narrow set and reports dead per-worktree grants without touching user config.

### Changes Required:

#### 1. Narrow remedy text

**File**: `skills/10x-pipeline/scripts/init-permissions.mjs`

**Intent**: In `codexWarning`, print the objects, refs and logs entries under `[permissions.<profile>.filesystem]` instead of the single `"<common>" = "write"` line, keeping the same path-safety guards.

**Contract**: The remedy keeps the filesystem entries because it also serves runs without a per-run grant (a main checkout, or a non-isolated run), where Phase 1 passes nothing. Each entry is `JSON.stringify(path.join(common, name)) = "write"` for `objects`, `refs`, `logs`; the existing `safeText` and glob-character check on `common` still gates all three.

#### 2. Read-only stale-line scan

**File**: `skills/10x-pipeline/scripts/init-permissions.mjs`

**Intent**: Inside the existing `providers.has("openai")` branch of `initPermissionWarnings` (no scan when no OpenAI step is selected), read `CODEX_HOME/config.toml` (default `~/.codex/config.toml`) with the existing `readBoundedFile` from `usage.mjs` if it opens by descriptor with `O_NOFOLLOW | O_NONBLOCK` and requires a regular file, otherwise the same pattern as `configPermissions` in `run-codex.mjs` (repo lesson). Collect the keys of lines of the form `"<path>" = "write"` under a `[permissions.<name>.filesystem]` table header, where `<path>` is `<common>/worktrees/agent-smith-<name>` (compared against the common dir as Git prints it and as realpathed, since macOS `/var` and `/private/var` differ) and the directory no longer exists. Print up to a bounded number of them with one sentence: per-run grants make these lines unnecessary and they can be deleted by hand. Print nothing when none are found or the file is unreadable.

**Contract**: Output is a warning on stderr like the existing ones; no file is written; the scan never changes `init`'s result or exit code. Only keys under the repo's own `<common>` are listed.

#### 3. Tests

**File**: `skills/10x-pipeline/test/init-permissions.test.mjs`

**Intent**: Update the remedy assertions (`:204`) to the three entries; add cases for a stale line (listed), a live worktree line (not listed), an unreadable or oversized file (silent), and a FIFO at the config path (does not hang).

**Contract**: Scratch `CODEX_HOME`; no real Codex.

### Success Criteria:

#### Automated Verification:

- Init tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/init-permissions.test.mjs`
- A stale agent-smith gitdir line is listed and a live one is not; the scan writes no file.
- A FIFO or symlink at the config path leaves `init` unchanged and fast.

#### Manual Verification:

- Running `init` in a repo whose `~/.codex/config.toml` has dead `agent-smith-*` lines prints them once and does not change the file (compare checksums).

---

## Phase 3: Docs and live acceptance

### Overview

Record the decision and the macOS proof the suite cannot make.

### Changes Required:

#### 1. REFERENCE and ADR

**File**: `docs/REFERENCE.md`, `docs/ADR/ADR-024-openai-codex-support.md`

**Intent**: Update the "Per-run gitdir grant" paragraph (added by #285) to the four-path set and its reason (hooks and config stay denied), mention the `init` listing, and add an amendment next to #285's. Grep every doc for the old single-path and whole-`.git` wording before finishing (lesson: grep every doc for the old behavior).

**Contract**: Text only; name codex-cli 0.172.0 and macOS as the observed platform. State the residual risk: the grant is passed automatically on every isolated OpenAI step, and write access to the shared `refs`, `logs` and `objects` lets a sandboxed step rewrite or delete other branches and the router's `refs/agent-smith/` rollback snapshots (previously this needed the user's own opt-in grant); `hooks` and `config` stay denied. The #285 amendment text stays as history and gets a line marking it superseded; reword the "one path" and "never the common dir, `objects`, `refs`" sentences in `docs/REFERENCE.md` and change the documented `preflight.grant` shape from `{ profile, gitDir }` to `{ profile, paths }`. The old amendment line in `docs/ADR/ADR-024-openai-codex-support.md` is the one expected hit of the grep in row 3.1; any other hit is a defect.

#### 2. Acceptance row

**File**: this plan's Progress (Manual row)

**Intent**: One live row for the issue's acceptance, run by the owner on a real project.

**Contract**: A fresh worktree run on macOS stages and commits with no approval prompt and no new line in `~/.codex/config.toml`; a write to `<common>/hooks` and `<common>/config` from inside the sandbox stays denied.

### Success Criteria:

#### Automated Verification:

- Docs name the four-path set and no doc still says the runner grants only the gitdir or advises a whole-`.git` grant: `grep -rn "grants write access to one path\|\"<common>\" = \"write\"" docs README.md skills`
- Version check still passes: `node tools/version-check.mjs`

#### Manual Verification:

- Fresh isolated run on macOS (Codex 0.172.0 or newer): a step commits with no approval prompt and no new `~/.codex/config.toml` line.
- From inside that run's sandbox, a write to `<common>/hooks` and to `<common>/config` is denied.

---

## Testing Strategy

### Unit Tests:

- Grant set shape, argv identity for sandbox and `exec`, main-checkout and missing-subdirectory cases.
- Stale-line scan: listed, not listed, bounded read, FIFO, symlink.

### Integration Tests:

- Existing fake-Codex runner and init suites; no real Codex in CI.

### Manual Testing Steps:

1. `codex sandbox` with the generated inline table in a linked worktree (copy the table from a run's `preflight.grant`, or from the refusal text): `git commit` passes; `touch <common>/hooks/x` and a write to the existing `<common>/config` are denied.
2. Branch delete and `gc --auto` in the same sandbox: record any denied path.
3. One real isolated run with `--provider-mode split` or `codex`.

## Performance Considerations

None: one extra `git rev-parse` output already used by #285, and one bounded file read at `init`.

## Migration Notes

Existing manual `~/.codex/config.toml` lines keep working and become redundant; they are only listed, never removed. Policy, `meta.json` and run state are unchanged.

## References

- Related research: `context/changes/codex-worktree-gitdir-grant/research.md`
- Prerequisite (merged, `79b6cc36`): PR [#285](https://github.com/xycu/agent-smith/pull/285), `context/changes/codex-run-gitdir-grant/plan.md`
- Grant code today: `skills/10x-pipeline/scripts/run-codex.mjs:27-33` and `:58-77`; remedy text: `skills/10x-pipeline/scripts/init-permissions.mjs:46-63`
- Issue: [#284](https://github.com/xycu/agent-smith/issues/284)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-run narrow common-dir grant

#### Automated

- [x] 1.1 Runner tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/providers.test.mjs` — 78d88f64
- [x] 1.2 Grant argv holds exactly gitdir, objects, refs and logs for a linked worktree and nothing for a main checkout — 78d88f64
- [x] 1.3 No test or script uses a recursive delete: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — 78d88f64

#### Manual

- [x] 1.4 On macOS with Codex, `codex sandbox -c '<generated table>'` in a linked worktree lets `git add` and `git commit` succeed and leaves `<common>/hooks` and `<common>/config` writes denied — evidence: evidence/command-codex-sandbox-grant-output.txt
- [x] 1.5 Branch creation, `git branch -d` and `git gc --auto` inside the same sandbox pass or the failing path is recorded; `packed-refs` added only if needed — evidence: evidence/command-codex-sandbox-grant-output.txt

### Phase 2: `init` advice and stale-line listing

#### Automated

- [x] 2.1 Init tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/init-permissions.test.mjs` — c404803d
- [x] 2.2 A stale agent-smith gitdir line is listed and a live one is not; the scan writes no file — c404803d
- [x] 2.3 A FIFO or symlink at the config path leaves `init` unchanged and fast — c404803d

#### Manual

- [x] 2.4 Running `init` in a repo whose `~/.codex/config.toml` has dead `agent-smith-*` lines prints them once and does not change the file (compare checksums) — evidence: evidence/test-init-stale-listing.txt

### Phase 3: Docs and live acceptance

#### Automated

- [x] 3.1 Docs name the four-path set and no doc still says the runner grants only the gitdir or advises a whole-`.git` grant: `grep -rn "grants write access to one path\|\"<common>\" = \"write\"" docs README.md skills` — b81ab2b0
- [x] 3.2 Version check still passes: `node tools/version-check.mjs` — b81ab2b0

#### Manual

- [ ] 3.3 Fresh isolated run on macOS (Codex 0.172.0 or newer): a step commits with no approval prompt and no new `~/.codex/config.toml` line
- [ ] 3.4 From inside that run's sandbox, a write to `<common>/hooks` and to `<common>/config` is denied
