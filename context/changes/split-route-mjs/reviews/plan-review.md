<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Split route.mjs into five modules Implementation Plan

- **Plan**: context/changes/split-route-mjs/plan.md
- **Mode**: Deep
- **Date**: 2026-11-09
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓ (`route.mjs`, `pr-comment.test.mjs`, `AGENTS.md`, `SKILL.md`, `provenance.test.mjs`, `agents.test.mjs`), 16/16 symbols ✓ at the cited lines (`SKILL_DIR:22`, `ROOT:23`, `paths:244`, `attachResult:603`, `decide:1026`, `ARTIFACT_NAME:1198`, `PREDICATES:1286`, `scoreConfig:1388`, `e2eSetup:1670`, `tierFor:2120`, `PLUGIN_ROOT:2323`, `undoOnError:2794`, `archiveDone:2818`, `next:2955`, `halt:3469`, `main:3473`), `route.mjs` unchanged since `d037d64`, brief↔plan ✓. Progress↔Phase consistency ✓ (7 phases, 30 rows).

Layering check (instead of a sub-agent): a scratch script chunked `route.mjs` at column-0 `function|const|let|try`, assigned every chunk to a module by the plan's line ranges and moved items, and listed every whole-word reference from a module to a later one. Chunk line totals: state 597, preplan 391, steps 635, flow 682, isolation 608, route 649 (all under 750). The only real back-edge is `archiveDone` → `COMMIT_EXISTS` (F1); the other hits were the words `status`, `next` and `main` inside strings and object keys.

## Findings

### F1 — `COMMIT_EXISTS` is assigned to no module

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6 — Extract isolation.mjs
- **Detail**: `const COMMIT_EXISTS` sits at `route.mjs:2811-2813`, between `undoRollback` (ends `:2809`) and the `archiveDone` range (2815-2953). The plan's ranges leave it in `route.mjs`, but its only uses are in `archiveDone` (`:2839`, `:2917`), which moves to `isolation.mjs`. Followed literally, `isolation.mjs` would need to import the entry, which the plan forbids; the check script would stop the phase, but the implementer would have to find the fix.
- **Fix**: Name `COMMIT_EXISTS` (orig. 2811-2813) in Phase 6's move list, next to `archiveDone`.
- **Decision**: APPLIED — Phase 6 "Changes Required" Intent and Contract name `COMMIT_EXISTS`; the "Moved items" row of `plan-brief.md` lists it too.

### F2 — `git diff --stat` / "touches only" criteria fail in this isolated run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Criteria 1.4, 2.4, 3.4, 4.4, 5.4, 6.5
- **Detail**: The run is isolated: the router keeps `context/changes/split-route-mjs/agent-smith/run.jsonl` and `meta.json` modified in the worktree (as `git status` shows now) and commits the change folder, Progress ticks in `plan.md` included, after each step. A plain `git diff --stat` therefore never "touches only `route.mjs` and `state.mjs`", and the criterion reads as failed or gets waved through. The plan never says which diff it means.
- **Fix**: Define the diff once: the phase's own work outside the change folder, `git diff --stat <phase start>..HEAD -- . ':(exclude)context/changes/split-route-mjs'` (plus the uncommitted part before the phase commit).
- **Decision**: APPLIED — new paragraph "Scope of the `git diff --stat` and 'touches only' criteria" at the end of "Implementation Approach". Progress rows unchanged.

### F3 — Change title and owner request include the 1000-line test files; the plan leaves them out

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: "What We're NOT Doing" bullet 1; `change.md` title
- **Detail**: `change.md` is titled "Split route.mjs and the 1000-line test files into smaller modules" and quotes the owner: "1k is also fucking long". The plan, following the research, leaves `openfindings.test.mjs` (1211), `preplan.test.mjs` (1130), `executors.test.mjs` (1116) and `archive.test.mjs` (1084) as they are. The brief marks this "assumed, owner undecided" and research Open Question 1 leaves it to the owner. The plan's reasoning is sound (a split saves no lines, edits the oracle of the refactor, and two of the files need a new shared helper module because `helpers.mjs` must stay as it was), but as written the change closes with its own title unmet.
- **Fix A ⭐ Recommended**: Keep the plan as it is; the owner retitles `change.md` to the `route.mjs` split and opens a follow-up change for the test files.
  - Strength: The oracle stays untouched while the source moves; this matches the research's ponytail verdict.
  - Tradeoff: Four files stay over 1000 lines for now.
  - Confidence: MED — backed by research Detailed Findings 4, but the owner's quote leans the other way.
  - Blind spot: Whether "1k is also long" meant the test files or the proposed module size.
- **Fix B**: Add a Phase 8 that splits only the two clean seams, `archive.test.mjs` at line 335 and `preplan.test.mjs` at line 339, after the source split is green.
  - Strength: Two of the four files drop under 1000 lines with no new shared module.
  - Tradeoff: Edits the oracle in the same change and needs `AGENTS.md` Project Structure edits; openfindings and executors stay over 1000.
  - Confidence: MED — seams named by research, not tried.
  - Blind spot: Cross-seam helpers (`archivedOnly`, `snapshot`, helpers 24-42, `thorough`) would be copied or exported.
- **Decision**: PENDING — scope decision for the owner: leave the four test files over 1000 lines (Fix A, and retitle `change.md`) or add a test-split phase (Fix B). The research and brief both mark it "owner undecided", and this review may not edit `change.md`.

### F4 — Mutant check for the widened guard has no procedure

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, criterion 1.2
- **Detail**: "Guard fails against a scratch `scripts/x.mjs` … (scratch copy only)" does not say how the repository's test can see a file in a scratch copy. `SCRIPT` resolves from the test file's own location (`pr-comment.test.mjs:15`), so the mutant only works if the whole `skills/10x-pipeline/` tree, `test/` included, is copied and the copy's test is run.
- **Fix**: Spell out the procedure: copy `skills/10x-pipeline/`, add `scripts/x.mjs` with a `"gh"` literal to the copy, run `node --test --test-name-pattern guard <copy>/test/pr-comment.test.mjs` and expect a failure.
- **Decision**: APPLIED — Phase 1 "Changes Required" §1 gains a "Mutant check (criterion 1.2)" paragraph.

### F5 — Guard test title would keep naming only `route.mjs`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, "gh source guard" Contract
- **Detail**: The Contract keeps the title `guard: route.mjs never calls gh and policy.json has no prComment key` while the scan widens to every router script. A failure would then name the wrong file. A grep of `skills`, `tools`, `docs`, `AGENTS.md`, `README.md` and `context/changes` finds no other reference to the title, so renaming it is free.
- **Fix**: Reword the title to name the router scripts, for example `guard: router scripts never call gh and policy.json has no prComment key`.
- **Decision**: APPLIED — Phase 1 "Changes Required" §1 Contract.

### F6 — Manual `init`/`status` check stops at the isolation gate

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Criteria 2.5, 6.6; Testing Strategy, Manual Testing Steps 1
- **Detail**: `isolation.require` ships `true`, so `init` in a plain scratch change folder halts at the isolation gate. The halt is valid JSON, so the criterion passes while exercising none of the moved code past the gate (policy loading, provenance, `meta.json` writing).
- **Fix**: Say the scratch project carries `{ "isolation": { "require": false } }` in `context/foundation/agent-smith-policy.json`, as the test helpers do, and give the commands.
- **Decision**: APPLIED — Testing Strategy, "Manual Testing Steps" item 1.
