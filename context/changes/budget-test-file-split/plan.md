# Split the budget executors test file Implementation Plan

## Overview

`skills/10x-pipeline/test/budget-executors.test.mjs` holds eight tests that take about 200 s in series, 97% of the suite's CI wall time (205.9 s, run 43134692634). `node --test` runs files in parallel and tests of one file in series. Move the shared walkers and fixtures into `skills/10x-pipeline/test/budget-helpers.mjs` and spread the eight tests, bodies unchanged, over four test files so the longest file takes about 62 s.

## Current State Analysis

- One file, 468 lines. Module-level code shared by all tests: `policy`, fixtures (`GOAL`, `FIXTURES`, `KINDS`, `SCORE`, ...), the plan renderer, the walker (`walkFixture`, `answer`, `longest`, `longScript`), the aware-review walker (`walkAware`, `answerAware`, `confirmScript`, `confirmOverride`, `confirmCount`) and `TABLE`.
- Per-test times from CI (change.md): longest legal path 25.0 s, failure path fits 2.1, lean runs manual-verify 1.8, raised cap 27.9, scorer failures skip 26.5, confirm rounds ship off 25.2, each confirm round adds 62.5, confirm round with shipped budgetDelta 28.9.
- `helpers.mjs` and `phase-helpers.mjs` are the pattern: plain `.mjs` modules beside the tests, imported by several `*.test.mjs` files. CI and the documented command glob `*.test.mjs` only, so a helper not named `*.test.mjs` is not run as a test.
- `after(cleanupAll)` is registered per test file; `makeProject` scratch folders are per process, so splitting needs the hook in every new file.
- Only `skills/10x-pipeline/test/README.md:40` indexes the file (`AGENTS.md` no longer lists test files; `agents-md-slim` landed). ADR-011:97, ADR-012:74,165 and archived plans name `budget-executors.test.mjs`; that file keeps its name and its first three tests, so those references stay true. `ladder-fable-rung/change.md:34` (a live change) expects `budget-executors.test.mjs` and the tier literals of the characterized loop tests to stay unchanged. After the split five of the eight tests live in the three new files, so that check reads the four `budget-*.test.mjs` files (glob `skills/10x-pipeline/test/budget-*.test.mjs`) and their unedited test bodies; the file named there keeps three tests. Mention this in the PR so the ladder-fable-rung owner reads the glob.

## Desired End State

Four test files, one helper module, the same eight test names, the same total test count, full suite green locally, and the CI `duration_ms` under 90 s. Verify: the suite's `# tests` count equals the pre-change count, and the eight names appear once each in the spec output.

### Key Discoveries:

- `skills/10x-pipeline/test/budget-executors.test.mjs:3` says test titles are string literals checked by earlier plan gate rows; titles must not change.
- `RAISED_EXTRA` (`:304`) is used only by "raised cap exceeds budget"; it moves with that test, not into the helper.
- `after(cleanupAll)` at `:12` and `noGit` at `:15` are needed in every new file; `noGit` can be exported from the helper, `after(cleanupAll)` cannot (it must be registered by the test file).
- Greedy balance from the CI times: {25.0+2.1+1.8 = 28.9}, {27.9+26.5 = 54.4}, {25.2+28.9 = 54.1}, {62.5}. The 62.5 s test cannot be split without changing its body, so about 62 s is the floor (change.md's "near 65 s").

## What We're NOT Doing

- No test body changes, no assertion or title edits, no reordering inside a body.
- No second step from change.md (splitting "each confirm round adds ..." by rigor level, reusing walks): optional there and it needs body edits.
- No change to `helpers.mjs`, `phase-helpers.mjs`, `policy.json`, the router or CI config.
- No edits to ADRs or archived plans: the references to `budget-executors.test.mjs` stay valid.
- No CI runner or `--test-concurrency` change.

## Implementation Approach

Phase 1 moves code only and proves the single file still passes. Phase 2 moves the tests into four files and updates the index. Moving the walkers first keeps the two risks (shared-code export mistakes, test placement mistakes) apart, and Phase 1 leaves a working suite at the end.

## Phase 1: Extract the helper module

### Overview

Create `budget-helpers.mjs` with everything above the test bodies, and make `budget-executors.test.mjs` import it.

### Changes Required:

#### 1. Baseline

**Intent**: Record the pre-change test names and counts so the end state can be compared mechanically.

**Contract**: Run the full suite once on the unmodified tree with the spec reporter; save the list of the eight budget test names and the `# tests` / `# pass` / `# skip` totals in the scratchpad (not in the repository). Also record `BASE=$(git rev-parse HEAD)` and save `git show $BASE:skills/10x-pipeline/test/budget-executors.test.mjs` as a scratchpad copy, which the body comparison of Phase 2 uses instead of a relative `HEAD~1`.

#### 2. Helper module

**File**: `skills/10x-pipeline/test/budget-helpers.mjs` (new)

**Intent**: Hold the fixtures, the plan renderer, both walkers and the shared derivations, moved verbatim from `budget-executors.test.mjs` lines 16-228 and 346-410 (everything except `test(...)` calls, `after(cleanupAll)` and `RAISED_EXTRA`).

**Contract**: Plain ES module, header comment in the style of `phase-helpers.mjs`, no `test()` or `after()` calls (so importing it registers nothing). The comment blocks inside lines 346-410 (the section header at 346-349 and the `confirmOverride` comment) move into the helper with that code and are not repeated in a test file. Exports: `policy`, `noGit`, `CRITICAL`, `CLEAN`, `SOUND`, `TABLE`, `FIXTURES`, `pairs`, `budgetOf`, `ranOf`, `statusOf`, `longScript`, `walkFixture`, `longest`, `walkAware`, `confirmScript`, `confirmOverride`, `confirmCount`. Everything else stays module-private. `SKILL_DIR` resolves from the helper's own `import.meta.url`, which is the same directory, so `policy.json` loads unchanged. Imports from `./helpers.mjs` and `./phase-helpers.mjs` only what the moved code uses.

#### 3. Original test file

**File**: `skills/10x-pipeline/test/budget-executors.test.mjs`

**Intent**: Delete the moved code and import the exports above; keep `after(cleanupAll)`, the header comment and all eight tests untouched.

**Contract**: Test bodies are byte-identical to before. `RAISED_EXTRA` and its comment stay above "raised cap exceeds budget".

### Success Criteria:

#### Automated Verification:

- Baseline recorded: full suite on the unmodified tree, eight budget test names and totals saved: `node --test --test-reporter=spec skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The helper registers no tests and exports the listed names: `node -e 'import("./skills/10x-pipeline/test/budget-helpers.mjs").then((m)=>console.log(Object.keys(m).sort().join(" ")))'`
- The test bodies are unchanged: `git diff -U0 skills/10x-pipeline/test/budget-executors.test.mjs` shows only removed module-level code and import lines, no hunk inside a `test(` body
- The single file still passes with all eight tests: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`

#### Manual Verification:

- None.

**Implementation Note**: Commit this phase as `test(budget-test-file-split): move budget walkers to a helper module`.

---

## Phase 2: Split into four test files and update the index

### Overview

Move the tests into four files by their measured times, add `after(cleanupAll)` and imports to each, and update the test README.

### Changes Required:

#### 1. Test files

**Files**: `skills/10x-pipeline/test/budget-executors.test.mjs` (keeps 3 tests), `skills/10x-pipeline/test/budget-pool-score.test.mjs`, `skills/10x-pipeline/test/budget-confirm-shipped.test.mjs`, `skills/10x-pipeline/test/budget-confirm-rounds.test.mjs` (all new except the first)

**Intent**: Distribute the eight tests so the longest file is the single 62.5 s test; move each test body verbatim.

**Contract**:

| File | Tests | CI seconds |
| --- | --- | --- |
| `budget-executors.test.mjs` | "longest legal path", "failure path fits", "lean runs manual-verify and no pool step" | about 29 |
| `budget-pool-score.test.mjs` | "raised cap exceeds budget" (with `RAISED_EXTRA` and its comment), "scorer failures skip" | about 54 |
| `budget-confirm-shipped.test.mjs` | "confirm rounds ship off and the aware saturating shape keeps the longest legal path", "a confirm round with the shipped budgetDelta passes the point that leaves a failed step and its retry to spare" | about 54 |
| `budget-confirm-rounds.test.mjs` | "each confirm round adds one plan-review and one impl-review step, which a budgetDelta raised by 2 per round holds" | about 62 |

Each file: a first-line comment saying which part of the budget it covers, the "titles are string literals" note, `import test, { after } from "node:test"`, `assert` and any `node:` module its bodies use, `after(cleanupAll)` (from `./helpers.mjs`), and imports from `./budget-helpers.mjs` limited to the names its bodies use. `readLogEntries` and `cleanupAll` come from `./helpers.mjs`. Unused imports are removed. No file edits a test body; the confirm-section comment block moves with its tests or into the helper next to `walkAware`.

#### 2. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Replace the single `budget-executors.test.mjs` row (line 40) with four rows, one per test file, each stating its scope, add a `budget-helpers.mjs` row beside the `phase-helpers.mjs` row (line 41), and extend the `phase-helpers.mjs` bullet of the `## Helpers` list (line 94).

**Contract**: Rows go in the `## Phase executors` table; keep the file names in backticks as the other rows do. Follow the `phase-helpers.mjs` pattern: a `budget-helpers.mjs` table row after the four test rows (`helper: fixtures, plan renderer, walkFixture and walkAware; registers no tests`), and change the `## Helpers` bullet at line 94 to "`phase-helpers.mjs`, `budget-helpers.mjs` and `openspec-helpers.mjs`: see their groups above." instead of a separate description.

### Success Criteria:

#### Automated Verification:

- Each new file runs alone and passes: `node --test skills/10x-pipeline/test/budget-executors.test.mjs skills/10x-pipeline/test/budget-pool-score.test.mjs skills/10x-pipeline/test/budget-confirm-shipped.test.mjs skills/10x-pipeline/test/budget-confirm-rounds.test.mjs`
- The same eight test names appear once each, compared with the saved baseline: `node --test --test-reporter=spec skills/10x-pipeline/test/budget-*.test.mjs`
- Test bodies are unchanged: every non-blank line of the original from line 230 on appears in the four test files or the helper, and no line is added to a body: `diff <(sed -n '230,$p' <saved-copy-of-BASE-file> | grep -v '^$' | sort -u) <(cat skills/10x-pipeline/test/budget-*.mjs | grep -v '^$' | sort -u) | grep '^<'` prints nothing (`<saved-copy-of-BASE-file>` is the scratchpad copy from step 1.1; the `HEAD~1` of a run branch with step commits is not the baseline)
- The full suite passes with the same total number of tests as the baseline: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The index names every new file: `grep -c "budget-" skills/10x-pipeline/test/README.md` and each of the four test files plus `budget-helpers.mjs` appears in it
- No recursive deletes or other rules broken: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- After the PR runs in CI, the `duration_ms` of the suite step is under 90 s (the baseline is 205.9 s, run 43134692634); note both figures in the PR. If the runner has fewer cores than four test files plus the other files need, the figure can stay higher; report it and the runner's core count.

**Implementation Note**: Commit as `test(budget-test-file-split): split the budget executors tests into four files`. Row 2.7 needs the PR's CI run, which exists only after the run ends and opens its pull request, so in an unattended run it stays pending (the `manual-verify` step lists it as not proved and the run goes on); the owner ticks it after reading the CI log and notes both figures in the PR.

---

## Testing Strategy

### Unit Tests:

- No new tests. The change is the eight existing tests, moved.

### Integration Tests:

- The full suite is the check: same names, same total count, all green.

### Manual Testing Steps:

1. Read the CI log of the PR run and compare the suite `duration_ms` with 205,939 ms.
2. Check that no budget test file takes much more than 62 s in that log.

## Performance Considerations

Wall time is bounded below by the 62.5 s test, so the 90 s target leaves about 28 s for scheduling and the other files. `node --test` runs files with a concurrency of available parallelism minus one; a runner with few cores can still serialize the four budget files and miss the target without any fault in the split.

## Migration Notes

None. No policy, router or data change.

## References

- Change: `context/changes/budget-test-file-split/change.md`
- Pattern: `skills/10x-pipeline/test/phase-helpers.mjs`, imported by `executors.test.mjs`
- Test index: `skills/10x-pipeline/test/README.md:40`, `:41`, `:94`
- CI command: `.github/workflows/ci.yml:37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract the helper module

#### Automated

- [ ] 1.1 Baseline recorded: full suite on the unmodified tree, eight budget test names and totals saved
- [ ] 1.2 The helper registers no tests and exports the listed names
- [ ] 1.3 The test bodies are unchanged: the diff shows only removed module-level code and import lines
- [ ] 1.4 The single file still passes with all eight tests

### Phase 2: Split into four test files and update the index

#### Automated

- [ ] 2.1 Each new file runs alone and passes
- [ ] 2.2 The same eight test names appear once each, compared with the saved baseline
- [ ] 2.3 Test bodies are unchanged across the four files
- [ ] 2.4 The full suite passes with the same total number of tests as the baseline
- [ ] 2.5 The index names every new file
- [ ] 2.6 No recursive deletes or other rules broken

#### Manual

- [ ] 2.7 After the PR runs in CI, the suite `duration_ms` is under 90 s, with both figures noted in the PR
