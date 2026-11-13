# Share one fallback for the churn exclude globs Implementation Plan

## Overview

`churnConfig` (state.mjs) and `evidenceExcludes` (steps.mjs) each fall back to the shipped `risk.churn.exclude` list by reading `policy.json` from disk. Export one `churnExcludes(policy)` helper from state.mjs that owns that fallback, and make both callers use it. The commit-evidence check then honours the override's `exclude` whatever the other churn keys hold.

## Current State Analysis

- `churnConfig` (`skills/10x-pipeline/scripts/state.mjs:655-667`) returns `null` when `since`, `maxCommits`, `minCommitsInWindow`, `hotMinCommits` or `hotPercentile` is malformed. Otherwise it uses the override's `exclude` when it is an array, else reads the shipped list from `policy.json` (line 663), else `[]`, filters to strings and maps `globToRegex`.
- `evidenceExcludes` (`skills/10x-pipeline/scripts/steps.mjs:37-42`) calls `churnConfig`; on `null` it reads the same file and key again and builds the regexes itself. So with an invalid `since` and a valid custom `exclude`, the commit-evidence check of `commitEvidence` (steps.mjs:58) uses the shipped list and ignores the override.
- `evidenceExcludes` is the only user of `SKILL_DIR` and `readJson` in steps.mjs besides the import line (verified by grep: lines 4 and 40 only). `path` stays: it is used at lines 84, 158, 325 and others.
- `churnConfig` has one other caller, `hotSet` (state.mjs:689), and no caller outside state.mjs; the risk path stays on `churnConfig`'s `null` rule for the other keys.
- The merged policy (`deepMerge`, state.mjs:36-43) replaces arrays, so an override `exclude` replaces the shipped list.
- Existing commit-evidence test: `strict verify git edge cases` in `skills/10x-pipeline/test/executors.test.mjs:235-282` covers the shipped list (docs, lockfile, change folder).

## Desired End State

One function, `churnExcludes(policy)` in state.mjs, owns the exclude-glob fallback: the override's `exclude` when it is an array, else the shipped list, else `[]`, strings only, as regexes. `churnConfig` uses it for its `exclude`; `commitEvidence` calls it directly. steps.mjs no longer reads `policy.json`. Verified by the new test and the full suite.

### Key Discoveries:

- `skills/10x-pipeline/scripts/state.mjs:655-667` and `skills/10x-pipeline/scripts/steps.mjs:37-42` are the duplicate fallback.
- AGENTS.md import order: `steps.mjs` imports from `state.mjs`, never the reverse; the helper goes in state.mjs, so the rule holds.
- `docs/REFERENCE.md` and `SKILL.md` do not describe the exclude fallback, so no doc change is needed (no tier logic changes, so the "How the tier moves" rule does not apply).

## What We're NOT Doing

- No change to when `churnConfig` returns `null` (the other churn keys keep their validation for the risk path).
- No change to `policy.json`, the shipped exclude list or docs.
- No change to non-string entries behaviour: they are still dropped, as today.
- No new file, dependency or recursive delete.

## Implementation Approach

Extract the three lines of fallback and the string filter into `churnExcludes`, call it from `churnConfig`, replace `evidenceExcludes` by a direct call, trim imports, add one test that fails before the change. Single phase: the edit is small and one suite run verifies it.

## Phase 1: One churnExcludes helper

### Overview

Move the exclude-glob fallback into one exported function and use it from both callers; add the regression test.

### Changes Required:

#### 1. Helper and churnConfig

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Add `churnExcludes(policy)` next to `churnConfig`, holding the only read of the shipped `risk.churn.exclude`. `churnConfig` sets its `exclude` from it instead of its own fallback lines.

**Contract**: `export function churnExcludes(policy): RegExp[]`. Uses `policy.risk?.churn?.exclude` when `Array.isArray`, else `readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude` when an array, else `[]`; keeps string entries; maps `globToRegex`. It does not look at `since` or any other churn key. `churnConfig` returns `{ ...c, exclude: churnExcludes(policy) }` after its existing key checks. Update the comment above `churnConfig` if it no longer fits.

#### 2. evidenceExcludes removed

**File**: `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: Delete `evidenceExcludes` and its comment; `commitEvidence` calls `churnExcludes(policy)`. Drop `SKILL_DIR`, `readJson` and `churnConfig` from the imports (keep `path` and `globToRegex`, which other code in steps.mjs uses); add `churnExcludes`.

**Contract**: `const exclude = churnExcludes(policy);` at the former `evidenceExcludes` call site (steps.mjs:58). Confirm with grep that `SKILL_DIR`, `readJson`, `churnConfig` and `globToRegex` have no other use in steps.mjs before removing each (`globToRegex` only if unused).

#### 3. Regression test

**File**: `skills/10x-pipeline/test/executors.test.mjs`

**Intent**: Prove the commit-evidence check honours a custom `exclude` when another churn key is invalid. Add it as a new `test(...)` after `strict verify git edge cases`.

**Contract**: Project from `strictProject({ policy: { risk: { churn: { since: "bogus", exclude: ["src/gen/**"] } } } })`; `tickAll`; `commitFiles(project, ["src/gen/out.mjs"])`; `finish(project).e.ok === false` (a commit touching only an excluded path is not code-commit evidence). `finish` consumes the pending `implement` entry, so it runs once per project: for the path-specific half, build a second `strictProject` with the same policy, `tickAll`, `commitFiles(project2, ["src/real.mjs"])` and assert `finish(project2).e.ok === true` (the pattern of the `docs`, `odd` and `side` blocks in `strict verify git edge cases`), so the exclusion is shown to be path specific. Skip with `{ skip: noGit }` like its neighbours. Before the change the first assertion fails (shipped list does not cover `src/gen/`). Write this test first and run it red against the unchanged scripts before the edits to state.mjs and steps.mjs; row 1.1's command only shows green.

### Success Criteria:

#### Automated Verification:

- New test passes and fails on the pre-change code: `node --test skills/10x-pipeline/test/executors.test.mjs`
- Churn tests pass unchanged: `node --test skills/10x-pipeline/test/churn.test.mjs`
- No-recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `steps.mjs` no longer reads policy.json: `! grep -n "policy.json\|readJson\|SKILL_DIR" skills/10x-pipeline/scripts/steps.mjs`

#### Manual Verification:

- Diff shows one fallback of the shipped exclude list, in state.mjs only, and about 5 fewer lines net in the scripts.

## Testing Strategy

### Unit Tests:

- New test above (invalid `since`, custom `exclude`, excluded-only commit is not evidence; a non-excluded commit is).
- Existing `strict verify git edge cases` keeps covering the shipped list; existing churn tests keep covering `churnConfig` null rules and the override `exclude`.

### Manual Testing Steps:

1. Read the final diff of state.mjs and steps.mjs for a second copy of the fallback.

## Performance Considerations

One fewer read and parse of `policy.json` per implement verification when the churn block is malformed.

## References

- Change: `context/changes/shared-churn-excludes/change.md`
- `skills/10x-pipeline/scripts/state.mjs:655`, `skills/10x-pipeline/scripts/steps.mjs:37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: One churnExcludes helper

#### Automated

- [x] 1.1 New test passes and fails on the pre-change code: `node --test skills/10x-pipeline/test/executors.test.mjs` — da214ab
- [x] 1.2 Churn tests pass unchanged: `node --test skills/10x-pipeline/test/churn.test.mjs` — da214ab
- [x] 1.3 No-recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — da214ab
- [x] 1.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — da214ab
- [x] 1.5 `steps.mjs` no longer reads policy.json: `! grep -n "policy.json\|readJson\|SKILL_DIR" skills/10x-pipeline/scripts/steps.mjs` — da214ab

#### Manual

- [x] 1.6 Diff shows one fallback of the shipped exclude list, in state.mjs only, and about 5 fewer lines net in the scripts — evidence: evidence/judgment-diff-one-fallback.md
