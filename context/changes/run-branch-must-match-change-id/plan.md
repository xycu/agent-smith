# Refuse to run a change on another change's run branch Implementation Plan

## Overview

`validateRunBranch` accepts any branch that starts with `isolation.branchPrefix`, so a run of change `foo` started inside the worktree of run `bar` passes `prepare-run.mjs` and `init`, and its step commits and rollbacks then act on `bar`'s branch. This plan makes the guard require that the branch belongs to the change id: exactly `<prefix><id>`, or `<prefix><id>-baseline`. A branch that belongs to another change refuses with a message that names both ids and says what to do, and nothing is written. A resumed run keeps its recorded branch, and the older-prefix recovery message stays.

## Current State Analysis

- `validateRunBranch(config, id, branch, g)` (`skills/10x-pipeline/scripts/run-identity.mjs:66-81`) rejects default branches, then rejects only `!branch.startsWith(prefix)` (line 77). Nothing ties the branch to `id`.
- Callers:
  - `runBranch` (`run-identity.mjs:60-64`) builds `<prefix><id>` itself, so it always passes. `open-pr.mjs:150-151` uses it for a run without `meta.json` and then requires HEAD to equal that exact name.
  - `validateRunIdentity` (`run-identity.mjs:97`) validates the branch recorded in `meta.json` (after `meta.id === id` is already checked) and appends "Restore isolation.branchPrefix to match the recorded branch ..." to every error of the call (lines 97-99).
  - `isolationCheck` in `skills/10x-pipeline/scripts/isolation.mjs:316-318` calls `validateRunIdentity` when `meta.json` records an isolated run, else `validateRunBranch(c, id, branch, g)` on HEAD. The router halts with the message plus "Nothing was written."
  - `prepare-run.mjs:179-201`: `inRun` is "linked worktree and HEAD starts with the prefix"; `branch` is HEAD, the recorded branch or the generated name, or the branch of a saved-run candidate chosen by `savedRunCandidates` (lines 55-71, 189-198); `validateRunBranch(config, opts.id, branch, git)` at line 201 runs before any lock, worktree or copy, so a throw there writes nothing.
- The branch forms in use: `<prefix><id>` (fresh run), `<prefix><id>-baseline` (the baseline arm of `compare`, `docs/REFERENCE.md:482`: "a branch such as `<effective-prefix><change-id>-baseline`"), and saved runs of the same id on other suffix branches, which the existing fallback discovery tests use (`codex/demo-a`, `demo-b`, `demo-saved`, `demo-other`, `demo-nested` in `skills/10x-pipeline/test/prepare-run.test.mjs:851-890`). Every one of those saved runs carries a `meta.json` whose `id` equals the change id.
- Two tests encode the defect and must change: `prepare-run.test.mjs:69` and `:798` assert that `prepare-run.mjs other` inside the worktree of run `demo` returns `in-run-worktree` on the branch of `demo`.
- Two more tests record a `meta.json` of `demo` on the branch `codex/other` and expect the HEAD-mismatch message ("started on branch codex/other"): `isolation.test.mjs:286-287` and the `{ id: "demo", isolated: true, branch: "codex/other", chain }` case at `open-pr.test.mjs:904` (regex `saved run identity|started on branch|Invalid run branch` a few lines below). The new id check in `validateRunIdentity` runs before the HEAD comparison, so those two fail with the other-change message unless their fixture branch becomes `codex/demo-other`, which the saved tier accepts and which keeps the HEAD-mismatch message.
- Change ids are kebab-case and one id is often a prefix of another in this repository (`step-guard` and `step-guard-heredoc-false-positives`), so a plain `startsWith(prefix + id)` would still let `foo` run on the branch of `foo-bar`.

## Desired End State

- Without a saved identity of this id, the only accepted branches are `<prefix><id>` and `<prefix><id>-baseline`. Any other branch under the prefix refuses with a message that names the change id being started and the id the branch belongs to, and says to leave that run's worktree and run `prepare-run.mjs <id>` from the original project root (or resume the other change there).
- With a saved identity of this id (`meta.json` with `meta.id === id`), the recorded branch is accepted when it starts with `<prefix><id>`, so saved runs on suffix branches resume as today and a recorded branch of another change is refused.
- A branch outside the prefix still refuses with the unchanged "does not start with <prefix>" message, and a resumed run whose recorded branch no longer matches the configured prefix still gets "Restore isolation.branchPrefix ..." guidance.
- `prepare-run.mjs` and `init` refuse before writing anything. `docs/REFERENCE.md` states the rule in the Run isolation section.
- Verified by the new and changed tests below and by the full suite.

### Key Discoveries:

- The branch name alone cannot tell `<id>-baseline` of change `foo` from the run branch of a change named `foo-baseline`; the guard accepts it and the plan records this as a known limit.
- Saved identity already proves which change owns a branch, which is why the saved tier stays looser than the unsaved tier and the existing fallback tests keep their meaning.
- `validateRunIdentity` wraps every `validateRunBranch` error with the prefix-recovery sentence (`run-identity.mjs:97-99`); the new refusal must not get that sentence, because restoring the prefix does not help.
- `prepare-run.mjs:201` validates the branch of an already selected saved run (candidate fallback or recorded invocation), so it must pass the saved tier for those and the strict tier otherwise.

## What We're NOT Doing

- No change to which branch fresh setup creates, to the prefix rules, to default-branch protection or to `isolation.defaultBranches`.
- No attempt to tell the baseline branch of `foo` from the run branch of a change `foo-baseline` by reading change folders or `meta.json`; the name stays the only input of the unsaved tier.
- No new policy key for the baseline suffix; `-baseline` is a constant in `run-identity.mjs`.
- No change to `open-pr.mjs`, `pr-comment.mjs`, `route.mjs` or the rollback code; they reach the guard through `validateRunIdentity` and `runBranch`.
- No repair of a `meta.json` written earlier by the defect (id `foo`, branch `agent-smith/bar`); the saved tier refuses it with the new message, and recovery is by hand (no history is rewritten, no branch is deleted).
- No accepted suffix other than `-baseline` for a run without saved identity. The first `init` of a run has no saved identity yet, so a baseline arm on another suffix refuses at that first `init`; it needs the `-baseline` name. Only a run whose `meta.json` already exists resumes on another suffix.

## Implementation Approach

One guard, two tiers, decided inside `validateRunBranch` through a new optional fifth parameter. `runBranch` and the unsaved `isolationCheck` call keep the strict default. `validateRunIdentity` and `prepare-run.mjs` pass the saved tier when a saved identity of this id selected the branch. A refusal for another change's branch is a separate error from the prefix error, so `validateRunIdentity` can leave it unwrapped. Tests extend the existing prepare-run and isolation suites; no new test file is created. Docs follow the code in a second phase.

## Phase 1: Guard, callers and tests

### Overview

Add the id check to `validateRunBranch`, route the saved tier from `validateRunIdentity` and `prepare-run.mjs`, keep the prefix-recovery message, and prove both setup and `init` refuse and write nothing.

### Changes Required:

#### 1. Guard in `run-identity.mjs`

**File**: `skills/10x-pipeline/scripts/run-identity.mjs`

**Intent**: After the existing prefix check, require the branch to belong to `id`, and make the refusal say which change owns the branch and what to do.

**Contract**: `validateRunBranch(config, id, branch, g, saved = false)`.
- `saved === false`: `branch` must equal `<prefix><id>` or `<prefix><id>-baseline` (a module constant holds `-baseline`, with a comment that the name cannot tell it from a change called `<id>-baseline`).
- `saved === true`: `branch` must start with `<prefix><id>`.
- Failure message names both ids: the id being started and `branch.slice(prefix.length)` as the id the branch belongs to. It says to leave that run's worktree and run `prepare-run.mjs <id>` from the original project root (or resume the other change there), and, for the unsaved tier, it lists the accepted names `<prefix><id>` and `<prefix><id>-baseline`. The error carries a marker property (`error.otherChange = true`) so a caller can tell it from the prefix error.
- The "does not start with <prefix>" message and its position (before the id check) stay as they are.
- `validateRunIdentity` passes `saved = true` and rethrows an error with the marker unchanged; every other error keeps the "Restore isolation.branchPrefix to match the recorded branch" suffix.

#### 2. Saved tier in `prepare-run.mjs`

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent**: The call at line 201 must be strict for a branch taken from HEAD or generated, and saved-tier for a branch selected through a saved identity.

**Contract**: a local `saved` flag, true when `invocation` exists or the `candidates.length === 1` branch (lines 189-198) selected the branch, passed as the fifth argument of `validateRunBranch`. No other flow in the file changes; the refusal throws before the setup lock, so the existing failure JSON (`reason` set, `runRoot: null`) is returned and no worktree, exclude, branch or copy is made.

#### 3. Tests

**Files**: `skills/10x-pipeline/test/prepare-run.test.mjs`, `skills/10x-pipeline/test/isolation.test.mjs`

**Intent**: Replace the two assertions that encode the defect, and add the cases of the change's Done-when list.

**Contract**: all use the existing fixtures (`fixture`, `linked`, `setup`, `originalState`, `savedIdentity` in `prepare-run.test.mjs`; `repo`, `worktree`, `initIn`, `assertHalt`, `writeMetaFile` in `isolation.test.mjs`), both chains where the file already loops over both.
- `prepare-run.test.mjs` line 69 and line 798: `setup` with `args: ["other", "--chain", chain]` inside the run worktree of `demo` (branch `agent-smith/demo`, and `runs-demo` for the configured-prefix test) now returns a `reason` that names `demo` and `other`, a null `runRoot`, and leaves `originalState` and the run worktree files unchanged.
- New prepare-run cases: in the worktree of `agent-smith/demo-extra`, id `demo` refuses (the `foo` / `foo-bar` case); in the worktree of `agent-smith/demo`, id `demo-extra` refuses; in a worktree on `agent-smith/demo-baseline` with no saved identity, id `demo` returns `in-run-worktree` on that branch; a saved identity of `demo` on `codex/demo-saved` still resumes (the existing fallback tests at lines 851-890 pass unchanged).
- New `isolation.test.mjs` cases: `init` for `demo` in a worktree on `agent-smith/other` halts with a reason that names `demo` and `other`, ends with "Nothing was written." and creates no `agent-smith/` folder (`assertHalt` with the project); the same worktree on `agent-smith/demo-baseline` runs `init` and returns `action: "run"` (the unsaved baseline case, next to the executed case at line 241); a `meta.json` with `id: "demo"`, `isolated: true` and `branch: "agent-smith/other"`, HEAD on that branch, halts with the new message and without the "Restore isolation.branchPrefix" sentence.
- Two existing fixtures change their recorded branch from `codex/other` to `codex/demo-other` and keep their assertions: `isolation.test.mjs:286` (still expects "started on branch", now `codex/demo-other`) and `open-pr.test.mjs:904` (a contradictory-identity case that still matches "started on branch").
- Boundary cases for the unsaved tier: `init` for `demo` in a worktree on `agent-smith/demo-baselines` and on `agent-smith/demo-baseline-2` halts with the other-change message.
- The existing prefix tests keep passing unchanged: `isolation.test.mjs:149` ("does not start with agent-smith/"), the recorded-prefix tests at `:241-262` ("isolation.branchPrefix ... recorded branch"), and `open-pr.test.mjs` (`HEAD is on agent-smith/demo, not agent-smith/other`).

### Success Criteria:

#### Automated Verification:

- Setup tests pass, including the refusal and baseline cases: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs`
- Init gate tests pass, including the refusal and baseline cases: `node --test --test-concurrency=2 skills/10x-pipeline/test/isolation.test.mjs`
- Publication tests pass unchanged in meaning: `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs`
- Full suite passes with the new and changed tests: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The guard names the branch owner: `grep -n "otherChange\|-baseline" skills/10x-pipeline/scripts/run-identity.mjs` lists the marker and the baseline constant

#### Manual Verification:

(None; the refusal is exercised end to end by the real-git tests above.)

**Implementation Note**: After this phase and its automated checks pass, continue to Phase 2.

---

## Phase 2: Document the rule

### Overview

State the rule in the Run isolation section of `docs/REFERENCE.md` and in ADR-010, and fix every doc line that describes the old prefix-only check.

### Changes Required:

#### 1. Run isolation section

**File**: `docs/REFERENCE.md`

**Intent**: Say that a run branch must belong to the change id, which forms are accepted, and what the refusal says. Grep the whole file for the old wording, as `lessons.md` requires.

**Contract**:
- Line 141 (the `init` halt list): "on a branch that does not start with `isolation.branchPrefix`" gains "or is the run branch of another change".
- A new bullet in the Run isolation list: the rule of the two tiers (exact `<prefix><id>` or `<prefix><id>-baseline` without saved identity; a saved identity of the id accepts its recorded branch when it starts with `<prefix><id>`), that `prepare-run.mjs` and `init` refuse before any write when HEAD is on another change's run branch, that the message names both ids and says to leave that worktree and run `prepare-run.mjs <id>` from the original project root, the known limit (`foo-baseline` the change and `foo` baseline arm are indistinguishable by name), and that the recorded-prefix recovery message is unchanged.
- Lines 145-146 (already-in-run case, saved identity precedence) and line 173 (publication guards) get a half sentence only if they still read as prefix-only.
- Line 482 (baseline branch): "a branch such as" becomes the exact `<effective-prefix><change-id>-baseline`, with the saved identity noted as the way other suffixes resume.
- Search `docs/REFERENCE.md`, `skills/*/SKILL.md`, `README.md` and `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` for `in-run-worktree`, `does not start with`, `startsWith(prefix)`-style wording and "under the effective prefix"; fix any line that still states the prefix-only rule.

#### 2. ADR-010 amendment

**File**: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` and its row in `docs/ADR/README.md`

**Intent**: Record the decision (change id bound into the branch check, two tiers, `-baseline` only) next to Amendment 4, which owns the configured-branch identity.

**Contract**: a short "Amendment 5" section after Amendment 4 with the rule, the reason (step commits and rollback of one change reaching another change's branch) and the known limit; the Status line of the ADR says "amended through Amendment 5"; the README row is changed only if its summary would otherwise contradict the rule.

### Success Criteria:

#### Automated Verification:

- The rule is in the isolation section: `grep -n "run branch of another change\|<id>-baseline\|<change-id>-baseline" docs/REFERENCE.md` shows the new bullet and the exact baseline name
- The ADR records it: `grep -n "Amendment 5" docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`
- No doc still says the check is prefix-only: `grep -n "does not start with" docs/REFERENCE.md | grep -v "another change"` prints nothing
- Version and commit-lint tools stay green: `node tools/version-check.mjs`
- Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

(None.)

---

## Testing Strategy

### Unit Tests:

- No unit test of `validateRunBranch` alone exists today; the guard is exercised through the CLI, as the suite does everywhere. The cases are the two tiers, the prefix error order, the marker on the error, and the `-baseline` boundary (`demo-baselines` and `demo-baseline-2` refuse without saved identity).

### Integration Tests:

- `prepare-run.mjs` in the worktree of another run: refuses, names both ids, `originalState` and the run worktree unchanged, for both chains.
- `init` in the worktree of another run: halts with "Nothing was written.", no `agent-smith/` folder, no start commit.
- The `-baseline` branch: accepted by `prepare-run.mjs` (`in-run-worktree`) and by `init`.
- Saved suffix runs (`demo-a`, `demo-b`, `demo-saved`) keep resuming and keep the "Ambiguous saved runs" refusal.

### Manual Testing Steps:

1. None required; the tests build real linked worktrees with hermetic git.

## Migration Notes

A run already started by the defect (`meta.json` id `foo`, branch `agent-smith/bar`) now refuses on resume with the new message. Its recovery is the user's: leave the worktree and start `foo` from the original project root. No branch is deleted and no history is rewritten. Known limit: a defect-written `meta.json` whose recorded branch starts with `<prefix><id>` (id `foo` on `agent-smith/foo-bar`, the very case the exact check exists for) still resumes, because the saved tier cannot tell it from a saved suffix run of `foo`.

## References

- Change identity: `context/changes/run-branch-must-match-change-id/change.md`
- Guard: `skills/10x-pipeline/scripts/run-identity.mjs:66-104`
- Callers: `skills/10x-pipeline/scripts/prepare-run.mjs:179-201`, `skills/10x-pipeline/scripts/isolation.mjs:316-318`, `skills/10x-pipeline/scripts/open-pr.mjs:150-151`
- Tests that change: `skills/10x-pipeline/test/prepare-run.test.mjs:69`, `:798`
- Docs: `docs/REFERENCE.md:139-146`, `:173`, `:482`; `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendment 4)
- Lesson applied: `context/foundation/lessons.md` ("Grep every doc for the old behavior when a script's output changes")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guard, callers and tests

#### Automated

- [x] 1.1 Setup tests pass, including the refusal and baseline cases: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs` — 65a69f75
- [x] 1.2 Init gate tests pass, including the refusal and baseline cases: `node --test --test-concurrency=2 skills/10x-pipeline/test/isolation.test.mjs` — 65a69f75
- [x] 1.3 Publication tests pass unchanged in meaning: `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs` — 65a69f75
- [x] 1.4 Full suite passes with the new and changed tests: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 65a69f75
- [x] 1.5 The guard names the branch owner: `grep -n "otherChange\|-baseline" skills/10x-pipeline/scripts/run-identity.mjs` lists the marker and the baseline constant — 65a69f75

### Phase 2: Document the rule

#### Automated

- [x] 2.1 The rule is in the isolation section: `grep -n "run branch of another change\|<id>-baseline\|<change-id>-baseline" docs/REFERENCE.md` shows the new bullet and the exact baseline name
- [x] 2.2 The ADR records it: `grep -n "Amendment 5" docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`
- [x] 2.3 No doc still says the check is prefix-only: `grep -n "does not start with" docs/REFERENCE.md | grep -v "another change"` prints nothing
- [x] 2.4 Version and commit-lint tools stay green: `node tools/version-check.mjs`
- [x] 2.5 Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
