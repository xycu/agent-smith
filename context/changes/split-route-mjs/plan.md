# Split route.mjs into five modules Implementation Plan

## Overview

Cut `skills/10x-pipeline/scripts/route.mjs` (3582 lines) into `state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs` and `isolation.mjs` plus the entry `route.mjs`, with no behavior change. Code moves verbatim. No new abstraction, no dependency, no signature change. One `refactor:` commit per module, suite green after each.

## Current State Analysis

`route.mjs` is the only source file over 1000 lines. It is already layered in practice, with four declarations out of place for a layered import graph (`isObject`, `halt`, `scoreConfig`, `e2eSetup`, plus `ARTIFACT_NAME`). It has no `export`, runs `main()` on import, and has one mutable binding, `let undoOnError`, shared by `next` and `main`. See `research.md` (Detailed Findings 2, 3).

## Desired End State

Six files in `skills/10x-pipeline/scripts/`, each under about 700 lines, `route.mjs` still the CLI entry at the same path. Import order has no cycles: `state` <- `preplan` <- `steps` <- `flow` <- `isolation` <- `route`. Full suite green, same CLI output, docs name the new homes.

### Key Discoveries:

- `SKILL_DIR` is computed from `import.meta.url` + `".."` (`route.mjs:22`); sibling modules keep it valid, a subfolder would break `loadPolicy`, `churnConfig`, `evidenceExcludes`, `promptText`.
- `undoOnError` (`route.mjs:2794`, written at `:2969`, `:2971`, `:3574-3576`) pins `undoRollback`, `next` and `main` to the entry file.
- Modules must never import `route.mjs` (`main()` runs on import; `route.test.mjs:1`).
- `pr-comment.test.mjs:624-630` reads only `route.mjs` for the `gh` guard; it would silently weaken after the split.
- Provenance hashes policy, prompts, `agents/*.md` and `plugin.json`, not `scripts/`: no drift from a pure move. Plugin-tree copies in `provenance.test.mjs:58-68` and `agents.test.mjs:298-307` copy `scripts/` whole.
- A forgotten import is a `ReferenceError` only when that code runs, and some halt paths have no test (research Detailed Findings 5). Hence the import-completeness check.

## What We're NOT Doing

- Not splitting the four test files over 1000 lines (research recommends leaving them; `helpers.mjs` must stay as it was).
- Not applying the ponytail merges (`section()` helper, flag parser, `findLast`, `archiveDone` into `routerCommit`, unused `scoreNext` `meta` param). Follow-up change.
- Not adding `root` to `paths()`, a chain selector or any export-for-reuse API (belongs to `openspec-pipeline`).
- Not adding a barrel file, setter, subfolder, or npm dependency (ADR-006).
- Not committing the check script; no edit to ADRs.
- No router behavior, output, policy or prompt change.

## Implementation Approach

Move, do not rewrite. For each module: cut the named contiguous line blocks plus the listed moved items out of `route.mjs` into the new file, prefix moved top-level declarations with `export` where another file uses them, add `import { … } from "./<earlier>.mjs"` for everything used from earlier modules, `node:` imports as needed, and add one import line to `route.mjs`. Comments travel with their function. Line ranges refer to the original `route.mjs` at commit `d037d64`; locate blocks by their `// ----` section markers and function names, since ranges shift after each cut.

A throw-away check script lives in the scratchpad, outside the repo, and runs after every extraction:

1. Declaration multiset: split every file into top-level chunks (`/^(?=(?:export )?(?:function|const|let|try) )/m`), strip a leading `export ` and trailing blank lines, drop `import` lines and compare comment-stripped hashes with the baseline captured from the original `route.mjs`. Sorted lists must be equal.
2. Import completeness: every name declared at top level in another module and used as a whole word (comments and string literals stripped) must be in the `import { … }` list; imports only from earlier modules, never from `route.mjs`.
3. `node --check` on each file.

Scope of the `git diff --stat` and "touches only" criteria: this run is isolated, so the router keeps `context/changes/split-route-mjs/agent-smith/run.jsonl` and `meta.json` modified in the worktree and commits the change folder (with the Progress ticks in `plan.md`) after each step. Read every such criterion as the diff of the phase's own work outside the change folder: `git diff --stat <phase start>..HEAD -- . ':(exclude)context/changes/split-route-mjs'` (plus the uncommitted part, `git diff --stat HEAD -- . ':(exclude)context/changes/split-route-mjs'`, before the phase commit). Files under the change folder never count against it.

## Phase 1: Widen the gh guard and capture the baseline

### Overview

Strengthen the oracle before any code moves; write the check script and its baseline.

### Changes Required:

#### 1. gh source guard

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: The guard test at `:624-630` must check every router source file, not only the entry, so the `gh` ban survives the split.

**Contract**: `policy.json` assertion kept. The test title drops the stale file name, for example `guard: router scripts never call gh and policy.json has no prComment key` (no other file refers to the title). Source scan covers every `scripts/*.mjs` except `pr-comment.mjs`. No other test edited.

**Mutant check (criterion 1.2)**: `SCRIPT` resolves from the test file's own location (`pr-comment.test.mjs:15`), so copy `skills/10x-pipeline/` whole to a scratch directory, add `scripts/x.mjs` holding `const c = "gh";` to the copy, and run `node --test --test-name-pattern guard <copy>/test/pr-comment.test.mjs`: it must fail. Never add the mutant file in the worktree.

#### 2. Check script (not committed)

**File**: `$TMPDIR` / scratchpad `check-split.mjs`

**Intent**: Implement the three checks in "Implementation Approach"; capture the baseline declaration list from the unsplit `route.mjs` once.

**Contract**: Node built-ins only; takes the scripts dir; exits non-zero with the offending names. Must not live under `scripts/` or `test/`. Proves itself by failing on a deliberately dropped import in a scratch copy.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Guard fails against a scratch `scripts/x.mjs` containing a `"gh"` literal (mutant check, scratch copy only)
- Check script passes on the unsplit file and fails on a scratch copy with a missing import

#### Manual Verification:

- Commit is `test:` or `refactor:` with a Conventional Commit subject and touches only `pr-comment.test.mjs`

---

## Phase 2: Extract state.mjs

### Overview

The leaf module (~600 lines): everything the rest imports.

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Move header utilities (`SKILL_DIR`, `ROOT`, `out`, `parseFlags`, `loadPolicy` etc., orig. 22-63), readers (65-202), archive lookup (204-239), run log incl. `paths()` (241-286), decision helpers (667-712), rigor (714-786), churn (788-972), plus `isObject` (716), `halt` (3469), `scoreConfig` (1388), `ARTIFACT_NAME` (1198).

**Contract**: `SKILL_DIR` defined here once and exported; `ROOT = process.cwd()` stays an import-time const. Every declaration used by another file gets `export`. Imports only `node:` built-ins. `halt` must be removed from the bottom of `route.mjs` and imported.

#### 2. Entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Remove the moved blocks; add `import { … } from "./state.mjs"` for every name still used. Shebang, usage comment and `try { main() }` unchanged.

**Contract**: Entry path and CLI unchanged.

### Success Criteria:

#### Automated Verification:

- Check script passes (multiset equal, imports complete, no import from `route.mjs`)
- `node --check` passes for both files
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `git diff --stat` touches only `route.mjs` and `state.mjs`

#### Manual Verification:

- `init` and `status` against a scratch change folder print valid JSON

---

## Phase 3: Extract preplan.mjs

### Overview

Pre-plan, score and `replanNext` (~395 lines).

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/preplan.mjs`

**Intent**: Move pre-plan (orig. 1196-1383), score (1385-1513 minus `scoreConfig`, already in state), `replanNext` (1515-1573), and `e2eSetup` (1670) so `PREDICATES` no longer reaches forward. `ARTIFACT_NAME` stays in state.

**Contract**: Imports only from `./state.mjs` and `node:`. Exports what steps, flow, isolation and the entry use.

#### 2. Entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Remove the block, add the import line, fix remaining references.

**Contract**: No behavior change.

### Success Criteria:

#### Automated Verification:

- Check script passes
- `node --check` passes for all files
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `git diff --stat` touches only `route.mjs` and `preplan.mjs`

---

## Phase 4: Extract steps.mjs

### Overview

Executors, manual verify, code re-plans and tier (~635 lines).

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: Move executors (orig. 1575-1863, minus `e2eSetup`), manual verify (1865-2041), code re-plans (2043-2092), tier incl. `tierFor` (2094-2237).

**Contract**: Imports from `./state.mjs` and `./preplan.mjs` only.

#### 2. Entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Remove the block, add the import line.

**Contract**: No behavior change.

### Success Criteria:

#### Automated Verification:

- Check script passes
- `node --check` passes for all files
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `git diff --stat` touches only `route.mjs` and `steps.mjs`

---

## Phase 5: Extract flow.mjs

### Overview

Report, result intake, open findings with `decide`, prompts and agents/advisor (~690 lines).

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Move report (orig. 288-516), result intake incl. `attachResult` (518-665), open findings and `decide` (974-1194), prompts and agents/advisor (2239-2316).

**Contract**: Imports from `state`, `preplan`, `steps`. `decide` and `attachResult` keep their signatures. `halt`, `isObject` come from state.

#### 2. Entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Remove the block, add the import line.

**Contract**: No behavior change.

### Success Criteria:

#### Automated Verification:

- Check script passes
- `node --check` passes for all files
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `git diff --stat` touches only `route.mjs` and `flow.mjs`

---

## Phase 6: Extract isolation.mjs

### Overview

Provenance, archive adapter, isolation/commits/rollback and `archiveDone` (~615 lines).

### Changes Required:

#### 1. New module

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Move provenance incl. `PLUGIN_ROOT` (orig. 2318-2458), archive adapter (2460-2537), isolation, commits and rollback (2539-2786), `COMMIT_EXISTS` (2811-2813, used only by `archiveDone` at `:2839` and `:2917`), `archiveDone` with its leading comment (2815-2953).

**Contract**: Imports from earlier modules only. `COMMIT_EXISTS` moves with `archiveDone`; left in `route.mjs` it would force `isolation.mjs` to import the entry. `let undoOnError`, `undoRollback`, `next`, `verifyArchive`, `riskCommand`, compare, `status`, `main` stay in `route.mjs`; the `let` stays above `try { main() }` (TDZ). Remaining `route.mjs` is about 685 lines.

### Success Criteria:

#### Automated Verification:

- Check script passes, including: no module imports `route.mjs`, imports acyclic in the fixed order
- `node --check` passes for all files
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `wc -l skills/10x-pipeline/scripts/*.mjs`: no file above about 750 lines
- `git diff --stat` touches only `route.mjs` and `isolation.mjs`

#### Manual Verification:

- `init` then `status` in a scratch change folder print valid JSON; `rollback.test.mjs` undo case passes

---

## Phase 7: Update docs

### Overview

Make the docs name where routing now lives.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Lines 7, 8, 20, 62, 63, 67 name `route.mjs` as the home of routing. Reword to "`route.mjs` and the modules it imports under `scripts/`"; add one Project Structure bullet listing the five modules and what each holds; say `tierFor` is in `steps.mjs` and `decide` in `flow.mjs`.

**Contract**: CLI command lines (49-56) unchanged. Hard rules keep their meaning.

#### 2. SKILL.md

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Line 114 pointer becomes `scripts/steps.mjs` (`tierFor`) and `scripts/flow.mjs` (`decide`). No model, effort or tier words added.

**Contract**: `skill-loop.test.mjs` and `rules.test.mjs` still pass.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `node tools/version-check.mjs` exits 0
- `grep -n "route.mjs" AGENTS.md skills/10x-pipeline/SKILL.md` shows no stale claim about where `tierFor`, `decide` or policy loading live

#### Manual Verification:

- Read the AGENTS.md diff: wording accurate, ADRs and `docs/REFERENCE.md` untouched

---

## Testing Strategy

### Unit Tests:

- None added. The existing suite drives the real router through the CLI and is the oracle; Phase 1 strengthens the `gh` guard.

### Integration Tests:

- Full suite after every extraction; plugin-tree copy tests (`provenance.test.mjs`, `agents.test.mjs`) cover the modules being copied with `scripts/`.

### Manual Testing Steps:

1. `init` and `status` in a scratch change folder: valid JSON. Use a scratch project outside the repository (`mktemp -d`) with `context/changes/<id>/change.md` and `context/foundation/agent-smith-policy.json` set to `{ "isolation": { "require": false } }`, as the test helpers do; without the override `init` halts at the isolation gate, which is valid JSON but exercises nothing past the gate. Run `node <worktree>/skills/10x-pipeline/scripts/route.mjs init <id> --goal "x"` then `status <id>` from that project root and pipe each through `node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'`.
2. Confirm `git diff --stat` per commit touches only the expected files.

## Performance Considerations

Six module loads instead of one at CLI start; negligible.

## Migration Notes

None. Entry path, CLI, state files, policy and prompts unchanged; no `provenance.drift`.

## References

- Related research: `context/changes/split-route-mjs/research.md`
- Gh guard: `skills/10x-pipeline/test/pr-comment.test.mjs:624`
- Mutable binding: `skills/10x-pipeline/scripts/route.mjs:2794`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Widen the gh guard and capture the baseline

#### Automated

- [x] 1.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.2 Guard fails against a scratch `scripts/x.mjs` containing a `"gh"` literal (mutant check, scratch copy only)
- [x] 1.3 Check script passes on the unsplit file and fails on a scratch copy with a missing import

#### Manual

- [ ] 1.4 Commit is `test:` or `refactor:` with a Conventional Commit subject and touches only `pr-comment.test.mjs`

### Phase 2: Extract state.mjs

#### Automated

- [ ] 2.1 Check script passes (multiset equal, imports complete, no import from `route.mjs`)
- [ ] 2.2 `node --check` passes for both files
- [ ] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.4 `git diff --stat` touches only `route.mjs` and `state.mjs`

#### Manual

- [ ] 2.5 `init` and `status` against a scratch change folder print valid JSON

### Phase 3: Extract preplan.mjs

#### Automated

- [ ] 3.1 Check script passes
- [ ] 3.2 `node --check` passes for all files
- [ ] 3.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.4 `git diff --stat` touches only `route.mjs` and `preplan.mjs`

### Phase 4: Extract steps.mjs

#### Automated

- [ ] 4.1 Check script passes
- [ ] 4.2 `node --check` passes for all files
- [ ] 4.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 4.4 `git diff --stat` touches only `route.mjs` and `steps.mjs`

### Phase 5: Extract flow.mjs

#### Automated

- [ ] 5.1 Check script passes
- [ ] 5.2 `node --check` passes for all files
- [ ] 5.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 5.4 `git diff --stat` touches only `route.mjs` and `flow.mjs`

### Phase 6: Extract isolation.mjs

#### Automated

- [ ] 6.1 Check script passes, including: no module imports `route.mjs`, imports acyclic in the fixed order
- [ ] 6.2 `node --check` passes for all files
- [ ] 6.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 6.4 `wc -l skills/10x-pipeline/scripts/*.mjs`: no file above about 750 lines
- [ ] 6.5 `git diff --stat` touches only `route.mjs` and `isolation.mjs`

#### Manual

- [ ] 6.6 `init` then `status` in a scratch change folder print valid JSON; `rollback.test.mjs` undo case passes

### Phase 7: Update docs

#### Automated

- [ ] 7.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 7.2 `node tools/version-check.mjs` exits 0
- [ ] 7.3 `grep -n "route.mjs" AGENTS.md skills/10x-pipeline/SKILL.md` shows no stale claim about where `tierFor`, `decide` or policy loading live

#### Manual

- [ ] 7.4 Read the AGENTS.md diff: wording accurate, ADRs and `docs/REFERENCE.md` untouched
