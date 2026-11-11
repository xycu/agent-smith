# Shared helpers for open-pr.mjs and pr-comment.mjs Implementation Plan

## Overview

`open-pr.mjs` and `pr-comment.mjs` each hold a copy of the same helpers, and the copies have drifted (GitHub issue #95). Move them into one small standalone module, `skills/10x-pipeline/scripts/pr-common.mjs`, that both scripts import, fixing the two known drifts on the way.

## Current State Analysis

Duplicated today (line numbers at `be0ab00`):

- `firstLine`: `open-pr.mjs:74`, `pr-comment.mjs:76`. Identical.
- `gh` runner and `spawn`: `open-pr.mjs:79-103` (generic `spawn` plus `runGh`/`runGit`), `pr-comment.mjs:81-100` (`runGh` only). Same result shape and error mapping.
- `ID_RE`, `DEFAULT_TIMEOUT_MS`, `GH_HOST`, `BODY_CAP`, `MENTION_RE`: `open-pr.mjs:15,18,20,22,24`, `pr-comment.mjs:14-16,18,19`.
- `--report` path check (`report.md` inside a directory `agent-smith`): `open-pr.mjs:65-70`, `pr-comment.mjs:47-52`.
- Mention rule plus 60000 cap with surrogate-safe cut and the "Report truncated" tail: `open-pr.mjs:325-331`, `pr-comment.mjs:150-156`.
- `gh` failure mapping (missing, timed out, exit 4 or `gh auth login` is not authenticated): `open-pr.mjs:334-339` (`ghFailure`), `pr-comment.mjs:123-130` (inline, plus two extra regexes).
- Entry-point check: `open-pr.mjs:445-451`, `pr-comment.mjs:252-258`.
- Temp-folder create and cleanup: `open-pr.mjs:357-370` (no `try` around `removeTree`), `pr-comment.mjs:196-222` (cleanup wrapped in `try`).

Known drift to fix:

- `open-pr.mjs:368-370` lets a cleanup error escape, so after a good push and a created pull request `run()` throws and `main()` prints `internal error` with `pushed: false`. `pr-comment.mjs:217-221` swallows it.
- `open-pr.mjs:325` holds a literal zero-width space; `pr-comment.mjs:150` writes `​`.

Constraints (AGENTS.md, ADR-006, ADR-017):

- Built-ins only, Node 24, no router module imported by or importing the new module. `open-pr.mjs` already imports `remove-tree.mjs`, so a sibling import is allowed.
- Tests that touch the scripts: `skills/10x-pipeline/test/open-pr.test.mjs` imports `buildBody`, `markerFor`, `parseRepo`, `pathsToStage`, `titleFor` from `open-pr.mjs` (they must stay exported there); `pr-comment.test.mjs` imports `COMMENT_JQ` from `pr-comment.mjs` and has a mutation test (`pr-comment.test.mjs:641-647`) that copies `pr-comment.mjs` and `remove-tree.mjs` into a temp dir, so it must also copy the new module; its guard at `pr-comment.test.mjs:660` scans every other script for the `gh` literal and must skip the new module.

### Key Discoveries:

- The marker text differs on purpose (`agent-smith:pr` vs `agent-smith:pr-report`), and `open-pr.mjs` keeps only the report lines before the first table row; both stay per script. Only the mention rule and the cap move.
- `open-pr.mjs`'s `buildBody` appends `\n` before the cap; `pr-comment.mjs`'s does not. The shared function takes the finished text, so each caller keeps its own framing and output stays byte-identical.
- `open-pr.test.mjs:591` guard (router modules spawn no `gh`) lists router files explicitly, so a new `pr-common.mjs` is not scanned there; `pr-comment.test.mjs:660` scans by directory listing and needs the new file excluded.

## Desired End State

One module `pr-common.mjs` owns the shared helpers; both scripts import them and hold no copy. A cleanup error never changes the printed result of either script. Observable output of both scripts is unchanged except that cleanup errors in `open-pr.mjs` are swallowed and a `gh pr view` failure with empty stderr now reads `gh pr view failed: gh exited <n>` (the shared mapping). Verified by the full test suite and new unit tests for the module.

## What We're NOT Doing

- No change to `git` helpers (`runGit`, `gitOut`, `gitError`) in `open-pr.mjs`: only `open-pr.mjs` uses them. `spawn` moves because `runGh` needs it.
- No shared marker, no shared `parseArgs` (flag sets differ), no shared `result` shape.
- No change to router modules, `policy.json`, prompts, skills or the JSON output contract.
- No ADR: a refactor with no new decision (change.md: add one only when needed).
- No import of `pr-common.mjs` from router modules; it stays standalone like the two scripts.

## Implementation Approach

Create the module first with unit tests (extracting the code unchanged), then switch each script to import it, then fix the tests that depend on the file layout and update docs. The module exports small functions, no state. Zero-width space is written `​` once.

## Phase 1: Shared module with unit tests

### Overview

Add `pr-common.mjs` and its test, touching neither script yet.

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/pr-common.mjs`

**Intent**: Hold every helper the two scripts duplicate, extracted verbatim, in one standalone built-ins-only module with the header comment style of the scripts.

**Contract**: Exports: constants `ID_RE`, `DEFAULT_TIMEOUT_MS`, `GH_HOST`; `firstLine(text, max = 200)`; `spawn(cmd, args, timeoutMs, env, input)` (never throws, returns `{ status, stdout, stderr, missing, timedOut }`); `runGh(args, timeoutMs)`; `ghFailure(res, what)` (missing, timed out, exit 4 or `gh auth login` is "gh is not authenticated", else `<what> failed: <first stderr line or gh exited N>`); `checkReportArg(report)` (throws `Error` with the existing message `--report must name a file report.md inside a directory agent-smith` when the basename check fails; callers wrap into their `UsageError`); `capBody(text)` (neutralize mentions with `MENTION_RE` and `​`, then the 60000 UTF-16 cap that never splits a surrogate pair and appends `\n\nReport truncated: <n> characters omitted.`); `withTempDir(prefix, fn)` (`mkdtempSync` under `os.tmpdir()`, run `fn(dir)`, then `removeTree(dir)` in a `try` whose error is ignored, return `fn`'s value); `isEntryPoint(metaUrl)`. `capBody` must apply the mention rule to the text it is given, so each caller passes its framed text (marker included); marker lines contain no `@`, so output stays identical.

#### 2. Unit tests

**File**: `skills/10x-pipeline/test/pr-common.test.mjs`

**Intent**: Cover the extracted behavior directly, since no test covered the drift.

**Contract**: `node:test` cases for: `firstLine` (blank lines, cut at max); `capBody` (mentions neutralized, email untouched, under cap unchanged, over cap truncated with the exact tail count, a surrogate pair at the cut kept whole); `ghFailure` mapping of missing, timed out, status 4, `gh auth login` text, empty stderr; `checkReportArg` accept and reject; `withTempDir` removes the directory after `fn` returns and after `fn` throws, returns `fn`'s value, and does not throw when removal fails (make the directory un-removable by replacing it with a file via `fn`, or by passing a stubbed condition that `removeTree` refuses); `spawn` on a missing binary reports `missing: true`, status 127.

### Success Criteria:

#### Automated Verification:

- New module tests pass: `node --test skills/10x-pipeline/test/pr-common.test.mjs`
- Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read `pr-common.mjs` beside the two scripts and confirm every extracted function matches its original line for line.

---

## Phase 2: Rewire both scripts and fix dependent tests

### Overview

Delete the copies from `open-pr.mjs` and `pr-comment.mjs`, import from `pr-common.mjs`, and keep the suite green.

### Changes Required:

#### 1. open-pr.mjs

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: Import the shared names, drop the local copies, build the body through `capBody`, create the body file through `withTempDir` so a cleanup error is swallowed, and use `isEntryPoint(import.meta.url)`.

**Contract**: Still exports `buildBody`, `markerFor`, `parseRepo`, `pathsToStage`, `titleFor` with unchanged behavior. `runGit` calls the shared `spawn`. The `removeTree` import and `os`/`fileURLToPath` imports go away if unused. Header comment updated to name `pr-common.mjs`. `UsageError` for `--report` is built from `checkReportArg`'s error.

#### 2. pr-comment.mjs

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: Same swap: shared constants, `firstLine`, `runGh`, `checkReportArg`, `capBody`, `withTempDir`, `isEntryPoint`; map `gh pr view` failures through `ghFailure` after its two extra regexes (`no pull requests found`, `not a git repository`).

**Contract**: Keeps `COMMENT_JQ` export, `PR_URL_RE`, its own marker and `pickTarget` with the single `c.login === viewer` occurrence (the mutation test depends on that text). JSON output unchanged.

#### 3. Tests that depend on the layout

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Keep the mutation test and the gh-literal guard working with the new module, and add the missing regression test for the open-pr drift.

**Contract**: At line 647 also copy `pr-common.mjs` to the mutant directory; at line 660 exclude `pr-common.mjs` from the scanned list. Add to `open-pr.test.mjs` a case where the pull request is created and `removeTree` of the body directory fails (for example the fake `gh` replaces the body directory with a file during `pr create`), asserting `pushed: true`, `pr.action: "created"` and no `internal error`; if the fake `gh` cannot do this cleanly, test it at the `withTempDir` level in `pr-common.test.mjs` and say so.

### Success Criteria:

#### Automated Verification:

- Script tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/pr-common.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No copy remains: `grep -c "function firstLine\|MENTION_RE =\|BODY_CAP =" skills/10x-pipeline/scripts/open-pr.mjs skills/10x-pipeline/scripts/pr-comment.mjs` prints `0` for both
- Version and commit checks unaffected: `node tools/version-check.mjs`

#### Manual Verification:

- Run `node skills/10x-pipeline/scripts/open-pr.mjs pr-scripts-shared` in this worktree against the real remote state is NOT needed; instead run both scripts with a bad argument and confirm the usage text and exit code 2 are unchanged.
- Line count of the two scripts together drops by about 60 lines.

---

## Phase 3: Docs

### Overview

Update the places that say the scripts are standalone.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Describe `pr-common.mjs` and fix the claims that no module is imported.

**Contract**: In the Project Structure bullets, add a bullet for `pr-common.mjs` (shared helpers of `open-pr.mjs` and `pr-comment.mjs`, built-ins plus `remove-tree.mjs`, no router module imports it, tests in `pr-common.test.mjs`); in the `remove-tree.mjs` bullet change "`open-pr.mjs` does, for its temporary body file" to name `pr-common.mjs`; in the `open-pr.mjs` bullet say it imports `pr-common.mjs` and no router module.

#### 2. docs/REFERENCE.md

**File**: `docs/REFERENCE.md`

**Intent**: Record the one observable change.

**Contract**: In "Pull request (always)", add a bullet that a cleanup error of the temporary body folder never changes the printed result. No other section changes.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the two doc edits and confirm they match the code.

---

## Testing Strategy

### Unit Tests:

- `pr-common.test.mjs` as in Phase 1: mention rule, cap boundary, surrogate pair, `ghFailure` mapping, `withTempDir` cleanup on success, throw and removal failure.

### Integration Tests:

- Existing `open-pr.test.mjs` and `pr-comment.test.mjs` (real bare remote, fake `gh`) prove output is unchanged; the mutation test proves the author check survives.

### Manual Testing Steps:

1. Run each script with a missing argument and an unknown flag; compare stderr and exit code with `main`.

## Migration Notes

None. Plugin users get the new file with the next release; the orchestrator calls the same script paths.

## References

- GitHub issue #95; `context/changes/pr-scripts-shared/change.md`
- ADR-017 (`docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`), ADR-016 (`removeTree`)
- `skills/10x-pipeline/scripts/open-pr.mjs:74-99,316-332,357-370,445-451`; `skills/10x-pipeline/scripts/pr-comment.mjs:76-100,149-157,196-222,252-258`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared module with unit tests

#### Automated

- [ ] 1.1 New module tests pass: `node --test skills/10x-pipeline/test/pr-common.test.mjs`
- [ ] 1.2 Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 1.3 Read `pr-common.mjs` beside the two scripts and confirm every extracted function matches its original line for line

### Phase 2: Rewire both scripts and fix dependent tests

#### Automated

- [ ] 2.1 Script tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/pr-common.test.mjs`
- [ ] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.3 No copy remains: `grep -c "function firstLine\|MENTION_RE =\|BODY_CAP =" skills/10x-pipeline/scripts/open-pr.mjs skills/10x-pipeline/scripts/pr-comment.mjs` prints `0` for both
- [ ] 2.4 Version and commit checks unaffected: `node tools/version-check.mjs`

#### Manual

- [ ] 2.5 Run both scripts with a bad argument and confirm the usage text and exit code 2 are unchanged
- [ ] 2.6 Line count of the two scripts together drops by about 60 lines

### Phase 3: Docs

#### Automated

- [ ] 3.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 3.2 Read the two doc edits and confirm they match the code
