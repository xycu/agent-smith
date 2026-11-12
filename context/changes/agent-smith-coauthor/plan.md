# Agent Smith Co-Authors Router Commits Implementation Plan

## Overview

Every commit the agent-smith scripts make gets a `Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>` trailer, the way Claude Code adds its own trailer to commits it makes. GitHub then lists the account `agent-smith-exile` (https://github.com/agent-smith-exile, linked by that email) as a co-author. The identity lives in `policy.json`, not in the scripts.

## Current State Analysis

- The router makes git commits in `skills/10x-pipeline/scripts/isolation.mjs`: the start commit (`startCommit`), step commits (`isolation.commit.message`), the pre-archive commit (`archive.commitMessage`) and the late-usage commit (`lateUsageCommit`, `archive.usageMessage`). All go through `routerCommit` (`isolation.mjs:~326-373`, the `g(["commit","-m",message,...])` call at ~342).
- The failed-step rollback writes a snapshot commit with `git commit-tree ... -m "agent-smith: failed step ..."` (`isolation.mjs:~543`).
- `skills/10x-pipeline/scripts/open-pr.mjs` commits leftovers with `git commit -q -m "chore(<id>): final run state"` (`open-pr.mjs:19,233`). It is standalone: built-ins plus `pr-common.mjs`, no router module, so it cannot call `loadPolicy`.
- Commits made inside step subagents (plan, implement) are made by Claude and already carry Claude's trailer. They are not router commits.
- No code, policy key or doc mentions a co-author today (`grep -ri "Co-Authored"` finds nothing in `skills/` and `docs/`).
- Policy is `policy.json` merged with `context/foundation/agent-smith-policy.json` (`state.mjs:~60-71`, `mergedPolicy`/`loadPolicy`). `provenance.ignore` lists keys that do not affect routing (`compare`, `provenance`, `prices`).

## Desired End State

With the default policy, every commit made by the router and by `open-pr.mjs` ends with the trailer `Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>` (verified by `git log --format=%B`). Setting `coAuthor` to `null` in the override file turns it off. A malformed `coAuthor` halts at the first router commit it would apply to (the start commit at `init`, a step commit at `next`, the pre-archive commit, the late-usage commit) with a clear message naming `policy.coAuthor`. A run that makes no router commit (`isolation.require: false` without `--archive`) never reads the key, and read-only commands such as `status` never halt on it. No commit subject changes.

## What We're NOT Doing

- No change to commits made inside step subagents (plan, implement, fix): they keep Claude's trailer only. Adding Agent Smith there would need a `prompts.suffix` rule; it is a separate change if wanted.
- No change to the commit author or committer identity (only a co-author trailer).
- No rewriting of existing commits and no Claude in Chrome tests: nothing here has a UI.
- No new npm dependency; no change to `route.mjs` command surface.

## Implementation Approach

Add one policy key `coAuthor: { name, email }` (`null` = off) and one pure helper that renders `Name <email>`. Router commits pass it with `git commit --trailer "Co-Authored-By: ..."` (git 2.32+; `--trailer` places it correctly after a blank line and works with `-m`). The rollback snapshot appends a second `-m` paragraph (commit-tree has no `--trailer`). `open-pr.mjs` reads the same key from the plugin `policy.json` and the project override with a few lines of built-in code, because it may not import router modules. `coAuthor` is added to `provenance.ignore` since it cannot change routing.

Testing is fully automatic: a new `coauthor.test.mjs` on the existing hermetic-git helpers (throw-away scratch repos and linked worktrees, never the real repo), plus the whole suite, plus one scratch end-to-end run.

## Phase 1: Policy key and router commits

### Overview

Define `coAuthor`, validate it, and apply it to every router-made commit including the rollback snapshot.

### Changes Required:

#### 1. Policy data

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the default identity and exempt the key from provenance hashing.

**Contract**: top-level `"coAuthor": { "name": "Agent Smith", "email": "agent-smith@ksycki.pl" }`; `provenance.ignore` gains `"coAuthor"`, and so does the fallback list `PROVENANCE_DEFAULTS.ignore` in `skills/10x-pipeline/scripts/isolation.mjs:19` (it applies when an override malforms the list). `null` in an override means no trailer (`deepMerge` in `state.mjs` lets `null` replace the default object). Two assertions pin the old default list and change with it: `DEFAULT.provenance` (`deepEqual`, `skills/10x-pipeline/test/provenance.test.mjs:89`) and the `want` filter of the fresh-init test (`provenance.test.mjs:97-99`).

#### 2. Trailer helper and validation

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: One exported function that turns the merged policy into the trailer line, shared by `isolation.mjs`. Follow the style of `priceTable`, but a malformed block halts (a wrong trailer is worse than none).

**Contract**: two exports that do not halt. `coAuthorProblem(policy)` returns `null` when `policy.coAuthor` is `null` or missing or valid, else a message starting `policy.coAuthor ` that names the fault (`name` and `email` must be non-blank strings with no newline, `<` or `>`). `coAuthorTrailer(policy)` returns `null` when `policy.coAuthor` is `null` or missing, else `"Co-Authored-By: <name> <<email>>"`; it is called only after `coAuthorProblem` returned `null`. The caller turns a message into its own stop, as it does for `isolationMessage` and `usageMessage`: `stop(...)` (which is `halt` or `endRun`) in `startCommit`, `stepCommit` and `rollback`, `precheck(...)` in `archiveDone`, and `{ error }` in `lateUsageCommit`. A bare `halt` inside the helper would skip the end-state write and the undo of those callers.

#### 3. Router commits

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Make `routerCommit` add the trailer to its `git commit`, and the rollback snapshot add it as a second `-m`. The trailer is resolved and checked before `git add` (as the archive message already is) in every path, the rollback included (before its `git add -A`), so a bad policy never leaves a staged index.

**Contract**: `routerCommit(g, timeout, { rel, message, trailer })`; commit args gain `"--trailer", trailer` only when `trailer` is non-null, placed right after the message and before the `--` of the pathspec form: `["commit", "-m", message, "--trailer", trailer, "--", rel]`. That order keeps `commit -m` adjacent, which the git shims of `archive.test.mjs` (~778) and `stepcommit.test.mjs` (~137) match with `*" commit -m "*`, and keeps `--`, `rel` as the last two arguments with a single `--`, which the allowed-commands test of `archive.test.mjs` (~1175) asserts. Callers (`startCommit`, step commit, archive path, `lateUsageCommit`) pass `coAuthorTrailer(policy)`. `commit-tree` call gains `"-m", trailer` when set. Hooks and signing stay as they are; never `--no-verify`.

#### 4. Tests

**File**: `skills/10x-pipeline/test/coauthor.test.mjs` (new)

**Intent**: Prove the trailer on each router commit and the off and malformed cases, using `helpers.mjs` scratch projects with `policy: { isolation: { require: true } }` as `stepcommit.test.mjs` and `rollback.test.mjs` do.

**Contract**: cases: start commit, step commit, pre-archive commit, late-usage commit (archive state), rollback snapshot ref all show the trailer in `git log -1 --format=%B <ref>` and keep the original subject as first line; `coAuthor: null` gives no trailer; blank name, email with `>` and a non-object value halt the start commit at `init` (isolation required) and a step commit at `next` with a message naming `policy.coAuthor`, and leave the index unstaged; `status` on the same project still succeeds; provenance hash is equal with and without `coAuthor` changed. No existing test reads a whole commit body (`%B`), so the existing tests that need a change are the two provenance assertions named above; the shim and argument-order tests pass unchanged with the argument order of the Changes section.

### Success Criteria:

#### Automated Verification:

- New tests pass: `node --test skills/10x-pipeline/test/coauthor.test.mjs`
- Commit, rollback, archive, late-usage and provenance suites still pass: `node --test skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/isolation.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/openspec-isolation.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- Policy file stays valid JSON: `node -e "JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'))"`

#### Manual Verification:

- None needed; the tests read real commits from real hermetic repos.

**Implementation Note**: After this phase and its automated checks pass, continue to Phase 2.

---

## Phase 2: `open-pr.mjs` leftovers commit

### Overview

The one commit not made by the router gets the same trailer.

### Changes Required:

#### 1. Standalone policy read

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: Read `coAuthor` from `../policy.json` (relative to the script) and then from `context/foundation/agent-smith-policy.json` under the current directory; an override key (including `null`) wins. Built-ins only, no router import. Any unreadable file, bad JSON or invalid value yields no trailer and never fails the push or PR step.

**Contract**: a local function `coAuthorLine(policy)` mirroring `coAuthorProblem` and `coAuthorTrailer` (invalid or off gives `null`, never a halt), exported by name so tests can import it (the entry point is guarded by `isEntryPoint`); `commitLeftovers` adds `"--trailer", trailer` to its `git commit` after the message when non-null. The duplicated rule is covered by a parity case added to `skills/10x-pipeline/test/coauthor.test.mjs` in this phase: it feeds `coAuthorTrailer`/`coAuthorProblem` (from `state.mjs`) and `coAuthorLine` the same values (default, `null`, missing, blank name, newline, angle brackets, non-object) and asserts the same trailer, with invalid values giving `null` in `open-pr.mjs` where the router reports a problem.

#### 2. Tests

**File**: `skills/10x-pipeline/test/open-pr.test.mjs`

**Intent**: Extend the existing real-bare-remote, real-worktree cases: leftovers commit carries the trailer by default, none with an override `coAuthor: null`, none (and no failure) with a malformed value.

**Contract**: uses the existing `g`/`envFor` helpers and the logging `git` shim; adds no new fixtures beyond an override file in the scratch project.

### Success Criteria:

#### Automated Verification:

- PR script tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-common.test.mjs`
- Parity of the two validators: `node --test skills/10x-pipeline/test/coauthor.test.mjs`

#### Manual Verification:

- None needed.

---

## Phase 3: Docs, ADR and full verification

### Overview

Document the key and run everything, including one scratch end-to-end run.

### Changes Required:

#### 1. Docs

**Files**: `docs/REFERENCE.md`, `AGENTS.md`, `docs/ADR/ADR-020-agent-smith-co-author.md` (new)

**Intent**: Describe the `coAuthor` key, its off switch and the subagent-commit exclusion in REFERENCE.md next to the isolation commit text, and add `coAuthor` to the default `provenance.ignore` list named in the provenance bullet (`docs/REFERENCE.md:296`, now `compare`, `provenance` and `prices`). Add `coauthor.test.mjs` to the test list in AGENTS.md and mention ADR-020 in the `docs/ADR/` entry. ADR-020: decision (policy key, `--trailer`, duplicate read in `open-pr.mjs` because of the no-router-import rule), alternatives (hardcoded constant, git author config) and the not-doing list. Do not edit `context/archive/`.

**Contract**: prose only; no model, effort or tier words in either `SKILL.md`.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields untouched: `node tools/version-check.mjs`
- ADR and docs exist: `test -f docs/ADR/ADR-020-agent-smith-co-author.md && grep -q coAuthor docs/REFERENCE.md`

#### Manual Verification:

- In a throw-away scratch repo (created under the scratchpad directory, branch `scratch/coauthor`), run `route.mjs init scratch --goal "x"` with isolation required, then `git log -1 --format=%B` shows the Agent Smith trailer. The scratch repo is removed file by file afterwards (no recursive delete).

## Testing Strategy

### Unit Tests:

- `coAuthorTrailer` values: default, `null`, missing, blank, newline, angle brackets.

### Integration Tests:

- Each commit path of the router and `open-pr.mjs` in real hermetic repos, as listed in Phase 1 and 2.

### Manual Testing Steps:

1. The scratch run in Phase 3 manual verification. No browser steps: there is no UI, so Claude in Chrome is not used.

## Performance Considerations

None: one extra argument per commit.

## Migration Notes

None. Existing commits and runs are unchanged; resumed runs add the trailer to new commits only. A run that spans the upgrade has mixed history, which is fine.

## References

- Router commit code: `skills/10x-pipeline/scripts/isolation.mjs:326-373,543`
- Leftovers commit: `skills/10x-pipeline/scripts/open-pr.mjs:19,223-239`
- Policy merge: `skills/10x-pipeline/scripts/state.mjs:60-71`
- Hard rules: `AGENTS.md` (no router import in `open-pr.mjs`, no recursive delete, no `--no-verify`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy key and router commits

#### Automated

- [x] 1.1 New tests pass: `node --test skills/10x-pipeline/test/coauthor.test.mjs`
- [x] 1.2 Commit, rollback, archive, late-usage and provenance suites still pass
- [x] 1.3 Policy file stays valid JSON

### Phase 2: `open-pr.mjs` leftovers commit

#### Automated

- [ ] 2.1 PR script tests pass
- [ ] 2.2 Parity of the two validators

### Phase 3: Docs, ADR and full verification

#### Automated

- [ ] 3.1 Whole suite passes
- [ ] 3.2 Version fields untouched
- [ ] 3.3 ADR and docs exist

#### Manual

- [ ] 3.4 Scratch run shows the Agent Smith trailer on the start commit
