# File guards and the plan Files parser Implementation Plan

## Overview

GitHub issue #98. Two rules live in several copies under `skills/10x-pipeline/scripts/`. This plan keeps one guarded reader and one plan path parser in `state.mjs` and calls them from the other places. No new behavior except one deliberate tightening: `evidenceOk` gets the same lstat plus real-path check as the other copies. `readComplexity` is gated by the same helper, with no change in what it accepts.

## Current State Analysis

- Guard copies: `readGuarded` (`openspec.mjs:23`, text, lstat, size cap, real path inside `dir`), `readUnprovenReasons` (`steps.mjs:~395`, lstat, size cap, mtime, real path inside `<change>/evidence`), `evidenceOk` (`steps.mjs:~329`, `statSync` so it follows a symlink, size > 0, mtime, real path inside `<change>/evidence`), `readComplexity` (`preplan.mjs:~197`, lstat, size cap, no real-path check).
- Parser copies: `planPaths` (`state.mjs:~618`) and `phaseFiles` (`steps.mjs:~133`) both match `^\*\*Files?\*\*:(.*)$`, take backtick tokens else comma-split text, and pass each through `normalizePlanPath`. They differ only in what lines they scan (all lines vs. lines inside a `## Phase N` block).
- Import order (AGENTS.md): `state.mjs` < `preplan.mjs` < `steps.mjs` < `openspec.mjs`; each imports only earlier ones. So the shared helpers go in `state.mjs`, next to `normalizePlanPath`.
- Tests exercising these: `score.test.mjs` (symlink complexity.json fails with a message), `manualverify.test.mjs` (evidence and `unproven.md` rules), `openspec-readers.test.mjs`, `preplan.test.mjs` and `executors.test.mjs` (plan paths, tdd phase files).

## Desired End State

- `state.mjs` exports `guardedStat(file, dir, max)` (returns the `lstat` result when `file` is a regular file, at most `max` bytes, whose real path lies inside the real path of `dir`; else `null`; never throws) and `readGuarded(file, dir, max)` (its text or `null`). `openspec.mjs` imports `readGuarded` instead of defining it.
- `evidenceOk` and `readUnprovenReasons` call `guardedStat` with `dir = <change>/evidence`; `readComplexity` reads the file only when `guardedStat` accepts it and keeps its specific error messages: a second `lstat` after a refusal only words the error. Its real-path check cannot fail by itself, because the score file sits directly in the change folder (impl-review F1).
- `state.mjs` exports `planFileTokens(line)` (the tokens of one `**File**:`/`**Files**:` line, normalized, or `null` when the line is no such line). `planPaths` and `phaseFiles` loop over lines and call it.
- Verified by: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` green, plus new tests for the two helpers.

### Key Discoveries:

- `evidenceOk` today accepts a symlinked evidence file whose target is inside `evidence/`. `docs/REFERENCE.md` ("Manual verification") says the file "exists, is regular and non-empty, lies inside the real `evidence` folder". Switching to `lstat` makes the code match the doc; a symlink now reads as invalid evidence, so the tick is unproven.
- `readGuarded` and the `unproven.md` reader use the prefix test `realpath(file).startsWith(realpath(dir) + path.sep)`; keep exactly that test in the one copy.
- `readComplexity` returns distinct messages (`a symlink, not a regular file`, `larger than N bytes`); `score.test.mjs` may assert them, so the messages stay; `guardedStat` decides and the messages are derived after a refusal.

## What We're NOT Doing

- No change to policy keys, size caps, prompts, ADRs or router output shape.
- `isFile` in `openspec.mjs` (stat based existence check) stays: it is a different rule (artifact exists), not the guard.
- No change to the mtime and size > 0 rules; those stay at the call sites.
- No ADR: a refactor with one doc-consistent tightening, noted in `docs/REFERENCE.md`.

## Implementation Approach

State first (helpers plus tests), then switch callers, so each phase leaves the suite green.

## Phase 1: Shared guard

### Overview

Add `guardedStat` and `readGuarded` to `state.mjs` and switch the four copies.

### Changes Required:

#### 1. Helpers

**File**: `skills/10x-pipeline/scripts/state.mjs`
**Intent**: One place for "regular file, real path inside the real folder, under a size cap".
**Contract**: `guardedStat(file, dir, max = Infinity)` returns the `lstat` result or `null`; `readGuarded(file, dir, max)` returns UTF-8 text or `null`. Any fs error gives `null`.

#### 2. Callers

**Files**: `skills/10x-pipeline/scripts/openspec.mjs` (delete local `readGuarded`, import it), `skills/10x-pipeline/scripts/steps.mjs` (`evidenceOk`, `readUnprovenReasons`), `skills/10x-pipeline/scripts/preplan.mjs` (`readComplexity`).
**Intent**: Replace the inline lstat/realpath blocks with `guardedStat`; keep the segment regex, the evidence-folder-is-a-real-directory check, the mtime and size > 0 checks, and the `readComplexity` messages. Update the `readGuarded` comment in `openspec.mjs` that cites the copies.

#### 3. Tests

**File**: `skills/10x-pipeline/test/file-guard.test.mjs` (new)
**Intent**: Cover `guardedStat`/`readGuarded` (regular file ok, symlink file refused, file in a symlinked folder refused, oversize refused, missing refused), a symlinked `complexity.json` pointing outside the change folder is refused, and a symlinked evidence file is not valid evidence.

### Success Criteria:

#### Automated Verification:

- Helper tests pass: `node --test skills/10x-pipeline/test/file-guard.test.mjs`
- Existing readers and steps pass: `node --test skills/10x-pipeline/test/score.test.mjs skills/10x-pipeline/test/manualverify.test.mjs skills/10x-pipeline/test/openspec-readers.test.mjs`

#### Manual Verification:

(none for this phase)

---

## Phase 2: One plan Files parser and docs

### Overview

Add `planFileTokens` to `state.mjs`, use it in `planPaths` and `phaseFiles`, and align the docs.

### Changes Required:

#### 1. Parser

**Files**: `skills/10x-pipeline/scripts/state.mjs` (`planFileTokens`, `planPaths`), `skills/10x-pipeline/scripts/steps.mjs` (`phaseFiles`).
**Intent**: The match, the backtick-else-comma split and `normalizePlanPath` live once. `planPaths` keeps all lines and the sorted unique result; `phaseFiles` keeps its phase tracking and per-phase sets.

#### 2. Tests

**File**: `skills/10x-pipeline/test/file-guard.test.mjs`
**Intent**: `planFileTokens` on a backtick line, a comma line, a `./` and `:12` token, a non-Files line (`null`), and a line with only blank tokens.

#### 3. Docs

**Files**: `docs/REFERENCE.md` ("Manual verification", evidence file rule: say a symlinked evidence file is refused; the shared-guard sentence is not needed), `AGENTS.md` (`state.mjs` bullet: add the guarded reader and the plan path parser).

### Success Criteria:

#### Automated Verification:

- Parser tests pass: `node --test skills/10x-pipeline/test/file-guard.test.mjs`
- Plan path and tdd phase tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/executors.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes

#### Manual Verification:

(none for this phase)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared guard

#### Automated

- [x] 1.1 Helper tests pass: `node --test skills/10x-pipeline/test/file-guard.test.mjs`
- [x] 1.2 Existing readers and steps pass: `node --test skills/10x-pipeline/test/score.test.mjs skills/10x-pipeline/test/manualverify.test.mjs skills/10x-pipeline/test/openspec-readers.test.mjs`

### Phase 2: One plan Files parser and docs

#### Automated

- [x] 2.1 Parser tests pass: `node --test skills/10x-pipeline/test/file-guard.test.mjs`
- [x] 2.2 Plan path and tdd phase tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/executors.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- [x] 2.3 Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes
