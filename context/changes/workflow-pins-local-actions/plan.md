# Workflow Pin Guard: Referenced Local Actions Implementation Plan

## Overview

Extend the existing pin guard to follow local action references recursively, including action metadata outside `.github/`. Validate remote references in every reached file and report missing local metadata at the referring file and line. Keep traversal finite, diagnostics actionable, and the current strict pin format intact.

This is one implementation phase in Wave 7. The implementation owns `tools/workflow-pins.mjs`, its existing `tools/test/workflow-pins.test.mjs`, and only the workflow-pins description in the `AGENTS.md` Layout entry. Planning artifacts stay in this change folder. Do not edit `WAVES.md`, `context/archive/`, either pipeline skill, CI workflows, router state, or the parallel commit-lint change.

## Current State Analysis

- `tools/workflow-pins.mjs:21` exports `findUses(text)`, returning one-based line numbers and raw values, including comments. Line 28 discards every value starting with `./` or `docker://`, so `check` cannot discover local dependencies.
- `tools/workflow-pins.mjs:34` exports `files(root)`: sorted YAML seeds under `.github/` plus both root metadata names when present. Other action directories are not discovered.
- `tools/workflow-pins.mjs:49` exports `check(root)`: checks each seed with the existing full-SHA/version-comment expression, accumulates diagnostic strings, and fails with `no uses: line found` when no non-exempt reference was checked.
- `tools/test/workflow-pins.test.mjs:59` explicitly expects local references to disappear. Its local-action target does not exist, so this fixture must change with the scanner contract.
- Repository search found `findUses` and `files` callers only in this module and its test file. CI already includes `tools/test/*.test.mjs`; no new entry point or workflow is needed.
- The existing test index at `skills/10x-pipeline/test/README.md:117` already describes the guard generically. Extend the indexed test file rather than adding a test module or editing shared index text.

Planning evidence, collected on Node v24.19.0 on 2026-11-14:

- All seven current workflow-pin tests pass, with zero skips.
- A scratch workflow containing a pinned checkout and `./actions/setup`, whose metadata references `./actions/nested`, incorrectly returns `[]` even though `actions/nested/action.yaml:1` uses `actions/setup-node@v5`.
- Replacing the first local reference with `./actions/missing` also incorrectly returns `[]`.
- Probe files were created inside this worktree and removed with the repository's `removeTree` helper. No implementation files changed during planning.

## Desired End State

The same `check(root)` call covers its current seeds and the transitive closure of their local action references. An unpinned remote in `actions/nested/action.yaml` produces that file's relative path and its actual line number. A missing target produces the referring file's relative path, line number, local reference, and the expected metadata names.

Valid pinned nested actions pass. Repeated references, normalized path aliases, and cycles scan each physical metadata file once. Existing remote diagnostics, Docker exemption, unusual-YAML rejection, and the requirement to encounter at least one non-exempt remote candidate remain intact.

### Key Discoveries

- The owner of discovery is `check`, and the existing `findUses` scanner can expose local edges without introducing a second parser (`tools/workflow-pins.mjs:18-58`).
- Root resolution is explicit in the change's fix direction: nested `./actions/b` refers to the repository root, not the directory of action A (`change.md:25-26`).
- Local reusable workflow files already belong to the `.github/` seed scan; treating every local reference as an action directory would introduce a compatibility regression.
- Wave 7 separates this guard from the whole-skill rewrite and commit-lint work (`context/changes/WAVES.md`, Wave 7 table). The user's instruction permits only the workflow-pins Layout text in `AGENTS.md`.

## What We're NOT Doing

- No repository-wide search for unreferenced action directories, remote repository downloads, new dependencies, YAML parser, or action-runtime validation.
- No change to accepted remote SHA/comment syntax, Docker pin policy, or acceptance of quoted/multiline/flow values.
- No execution of actions, validation of whether an action cycle is runnable, or changes to release/version handling.
- No new test file, shared test helper, ADR, CLI, configuration option, or CI job.
- No implementation or commit in this planning step. No manual acceptance gate is needed for this deterministic filesystem guard.

## Implementation Approach

Keep `files(root)` as the seed inventory. Let `findUses(text)` retain local references with the existing `{ line, value }` shape, while still skipping comments and Docker references. Extend `check(root)` to classify local edges and remote candidates, using one worklist and a visited set shared across seeds and discovered targets. Reuse the existing remote validator for every scanned text.

Evidence-backed assumptions for this unattended plan:

1. **Low complexity; one phase.** The change description, `complexity.json`, and caller search identify one responsible module, one existing test module, and one documentation region. The user's unattended instructions replace interactive approvals and delegation.
2. **Keep the current non-empty guard.** Local and Docker references do not satisfy the remote-candidate count. This preserves `check`'s existing contract and prevents a local-only cycle or empty metadata from making the guard pass (`tools/workflow-pins.mjs:48-58`).
3. **Inspect both metadata spellings if both exist.** This follows the conservative behavior of `files`, which already scans both root names; neither file may hide an unpinned reference (`tools/workflow-pins.mjs:42-44`).
4. **Preserve local reusable workflows.** A plain `./.github/workflows/<file>.yml` or `.yaml` reference resolves to that file, not to an `action.yml` directory. Existing files are already seeds; missing ones fail with a source diagnostic. This preserves the scope of the `.github/` inventory without turning arbitrary YAML paths into a new supported action form.
5. **Keep traversal inside the checked root.** Reject lexical path escapes and symlink targets outside the canonical root before reading their contents. Use canonical file identity for the visited set so aliases cannot defeat the once-only guarantee. This implements the requested cycle safety and the root-relative repository boundary without broad filesystem discovery.

No unresolved product decisions remain. `context/foundation/roadmap.md` has no item for this change ID and stays unchanged.

## Phase 1: Follow Local References and Prove the Guard

### Overview

Expose local edges, traverse their metadata once, add targeted regression coverage, and align the two scoped guidance surfaces.

### Changes Required

#### 1. Guard traversal and diagnostics

**File**: `tools/workflow-pins.mjs`

**Intent**: Close the discovery gap in the module that already owns pin checking. Keep unrelated references subject to exactly the same remote validator.

**Contract**:

- `files(root = ROOT)` remains a sorted seed inventory. `findUses(text)` keeps its return shape and source line numbering but now includes plain local references; Docker references and comment-only lines remain exempt. Update its function comment accordingly.
- `check(root = ROOT)` still returns an array of errors and does not write anything. Process seeds and discovered files through the same visited set, recording file identity before following its outgoing references.
- Resolve local paths against the checked root. Accept a plain static local path with an optional whitespace-delimited YAML comment; parse only that local value. Keep raw remote values, including their version comments, unchanged. Unsupported or malformed local syntax must produce an error rather than be truncated into a valid path or ignored.
- For an action directory, inspect each existing regular `action.yml` and `action.yaml`. If neither exists, return a diagnostic at the referring `file:line` naming the local value and both expected names. A directory or other non-file at a metadata path is an error, not successful discovery. Missing files, dangling links, and read failures must fail closed with a useful source/target diagnostic rather than silently skipping them.
- Handle conventional local reusable workflow paths as files, preserving seed validation and reporting missing referenced workflow files without demanding action metadata.
- Normalize lexical paths and canonicalize existing targets for root containment and deduplication. Do not read a target escaping the root. Contained aliases and links may resolve to the same visited file; cycles terminate without suppressing that file's remote validation.
- Keep remote failure text as `${file}:${line}: unpinned action "uses: ${value}"`. Use root-relative paths for both seed and discovered-file diagnostics. Preserve the `no uses: line found` check and Docker exemption; local edges do not increment its counter.
- Traverse deterministically from the existing sorted seeds and stable metadata-name order. Report a bad remote in a repeated target once; missing-target errors belong to each distinct referring source line.

#### 2. Regression fixtures and compatibility assertions

**File**: `tools/test/workflow-pins.test.mjs`

**Intent**: Turn the reproduced false passes into failures before changing the guard, then prove recursive discovery, termination, and compatibility.

**Contract**: Reuse `makeRoot`, `GOOD`, `SHA`, and `removeTree`. Adjust the old local-skip test to expect the local scanner result and supply real metadata. Extend the existing test module with the cases in Testing Strategy. Keep exact error assertions for nested bad remotes and source-location assertions for missing targets. Cycle checks must run with a bounded subprocess timeout, because an in-process timeout cannot interrupt a synchronous infinite traversal.

#### 3. Scoped guidance

**Files**: `tools/workflow-pins.mjs` module header; `AGENTS.md` Layout entry for `tools/` and `tools/test/`

**Intent**: Explain that the guard covers seeds plus referenced local metadata, including files outside `.github/`, and rejects missing targets.

**Contract**: Replace the module's local-reference exemption description with recursive once-only traversal and fail-closed metadata behavior. Update only the workflow-pins parenthetical in the existing AGENTS Layout bullet, including root metadata and recursively referenced local actions. Preserve adjacent tool descriptions and every other AGENTS region.

### Success Criteria

#### Automated Verification

- Focused regressions pass: `node --test tools/test/workflow-pins.test.mjs`, including exact nested-unpinned diagnostics, pinned recursion, and missing-target source locations.
- Traversal compatibility tests pass for repeated targets, cycles, both metadata spellings, local reusable workflows, malformed values, root containment, and the existing no-remote and Docker rules.
- Module guidance describes recursive local traversal and missing-target failure; the only AGENTS edit is the workflow-pins Layout description.
- Required repository suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`; record actual skips and environment prerequisites rather than claiming skipped cases passed.
- `git diff --check` passes and the implementation diff stays within the three owned files and this change's artifacts, leaving WAVES, archives, skills, CI, unrelated work, and router-owned run state untouched.

All criteria are agent-verifiable. There are no Manual rows or human checkpoints for this phase.

## Testing Strategy

### Unit and filesystem regression tests

| Case | Required result |
| --- | --- |
| Workflow -> `actions/setup/action.yml` -> unpinned remote | Error names metadata path and exact one-based line. |
| Workflow -> setup -> nested `action.yaml` -> unpinned remote | Error names the nested file, proving root-relative transitive resolution. |
| Same nested graph with full SHA and version comment | Empty error list, including when the only remote candidate lives in nested metadata. |
| Missing action directory; existing directory without metadata; nested missing reference | Failure names the referring file, line, local path, and expected metadata. Use a pinned seed remote to isolate missing-target diagnostics. |
| Both metadata filenames exist; one contains an unpinned remote | Both are inspected; the bad one is reported. |
| Repeated target, diamond graph, normalized alias, and metadata already in `.github/` seeds | Exactly one diagnostic for the same bad remote file. |
| Self-cycle and two-action cycle with a reachable remote | Bounded completion; pinned graph passes and an unpinned remote is still reported once. |
| Local reference with a trailing comment | Resolves the action directory without treating the comment as part of its path. |
| Quoted, flow, multiline, expression, or malformed local value | Fails closed; does not bypass remote validation or resolve a partial path. |
| Local reusable workflow, present and missing | Existing workflow's remotes remain checked once; missing workflow has a source diagnostic. |
| Local-only/empty action graph or Docker-only graph | Retains `no uses: line found`; adding a pinned nested remote makes it pass. |
| Metadata path is a directory; dangling link; contained symlink alias; escaping path/link | Invalid targets fail with diagnostics; contained aliases scan once; escapes are not read. |
| Unreferenced action outside `.github/` | Remains outside discovery; the change does not become a whole-repository YAML scan. |

Retain all existing tests for remote reusable workflows, SHA length, version comments, branch/tag rejection, comments, unusual YAML, seed inventory, and the actual repository. For symlink-boundary fixtures, use sibling directories within a scratch parent inside the worktree; do not read outside the authorized workspace.

### Integration verification

Run the focused suite after regression and implementation edits, then the required full suite once the phase is complete. Execute commands from this run worktree, prefixing each shell command with the absolute `cd` required by the task. Set `TMPDIR` to a scratch directory inside the worktree so test fixtures respect its filesystem boundary; inspect and remove scratch files through `removeTree`. No live GitHub call is needed: CI already executes this test module.

### Manual Testing Steps

None required. Source diagnostics and termination are asserted in tests. Live CI observation is optional follow-up, not a substitute for the required suite.

## Performance Considerations

Scan each reachable physical file once. Work grows with seed/reachable file content and local edges; memory grows with the worklist and visited files. An iterative worklist avoids call-stack growth for long local chains. No global directory scan beyond the existing `.github/` inventory is added.

## Migration Notes

No data migration or configuration change. The intended compatibility change is that missing local action metadata and previously invisible unpinned nested remotes fail the guard. The line-oriented scanner retains its documented strict YAML limits. Reverting the eventual implementation commit restores the old guard without touching run data.

## References

- `context/changes/workflow-pins-local-actions/change.md` — problem, root-relative fix direction, required tests and documentation.
- `context/changes/workflow-pins-local-actions/complexity.json` — bounded scope and no outstanding unknowns.
- `context/changes/WAVES.md`, Wave 7 — independent guard ownership and shared-text restrictions; read only.
- `tools/workflow-pins.mjs:13-58` — pin syntax, scanner, seeds, diagnostics, and non-empty guard.
- `tools/test/workflow-pins.test.mjs:15-89` — scratch fixtures and compatibility contracts.
- `AGENTS.md:16` — full suite requirement; `AGENTS.md:67` — sole permitted guidance edit.
- `skills/10x-pipeline/test/README.md:117` — existing workflow-pin test index entry.
- `skills/10x-pipeline/scripts/remove-tree.mjs` — permitted fixture cleanup.
- `context/foundation/lessons.md` — no nested delegation and documentation search discipline.

## Progress

### Phase 1: Follow Local References and Prove the Guard

#### Automated

- [x] 1.1 Focused regressions pass: `node --test tools/test/workflow-pins.test.mjs`, including exact nested-unpinned diagnostics, pinned recursion, and missing-target source locations. — c314218
- [x] 1.2 Traversal compatibility tests pass for repeated targets, cycles, both metadata spellings, local reusable workflows, malformed values, root containment, and the existing no-remote and Docker rules. — c314218
- [x] 1.3 Module guidance describes recursive local traversal and missing-target failure; the only AGENTS edit is the workflow-pins Layout description. — c314218
- [x] 1.4 Required repository suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`; record actual skips and environment prerequisites rather than claiming skipped cases passed. — c314218
- [x] 1.5 `git diff --check` passes and the implementation diff stays within the three owned files and this change's artifacts, leaving WAVES, archives, skills, CI, unrelated work, and router-owned run state untouched. — c314218
