<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: No recursive force delete Implementation Plan

- **Plan**: context/changes/no-recursive-delete/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria run during the review (on the code before any fix): `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passed (867 tests, 865 pass, 0 fail, 2 skipped); `node tools/version-check.mjs` printed `version-check: OK (1.1.1)`; `grep -nE "recursive|force" skills/10x-pipeline/scripts/remove-tree.mjs` printed nothing; `grep -rn "recursive" skills tools --include='*.mjs'` printed only `mkdirSync`/`cpSync` lines and the guard test. Every Manual row has an evidence file under `evidence/`.

## Findings

### F1 — removeTree changes the mode of a directory outside its target

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/remove-tree.mjs:36-44 (used at :52 and :85)
- **Detail**: `withWritableParent` retries an `EACCES`/`EPERM` unlink or `rmdir` after `chmod(path.dirname(p), 0o700)`. For the target itself (the final `rmdir` of the root, or the unlink of a target that is a file) that parent lies outside the target, so the helper silently rewrites the mode of a directory it was never asked to touch. A probe in `$TMPDIR` confirmed it: `outer` at `0555` holding `outer/tree/f`, `removeTree("outer/tree")` succeeded and left `outer` at `0700`. The plan's contract is that the helper works only inside the target; the refusals and the prefix check exist for that reason.
- **Fix**: Retry with the parent made writable only when the parent lies inside the target; for the target itself rethrow the error, and add a test that a read-only parent outside the target keeps its mode.
- **Decision**: APPLIED — c913825 (`withWritableParent` rethrows for the target itself; new test "removeTree leaves the mode of a read-only parent outside the target alone").

### F2 — Guard scanner misses a bare (destructured) delete call

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/no-recursive-delete.test.mjs:94
- **Detail**: `DELETE_CALL = /\.(rmSync|rmdirSync|rm|rmdir)\s*\(/g` requires a `.` before the name, so `import { rmSync } from "node:fs"; rmSync(dir, { recursive: true })` passes the guard (probe: 0 hits). The plan's Phase 4 contract asks to "match `rm`/`rmSync`/`rmdir`/`rmdirSync` calls (also `fs.promises` forms)", not only member calls, and ADR-016 "Not covered" names only options passed through a variable.
- **Fix**: Match the name when no identifier character precedes it (`/(?<![\w$])(rmSync|rmdirSync|rm|rmdir)\s*\(/g`), and add a bare-call sample that must hit and an identifier-suffix sample (`perform(x, { recursive: true })`) that must not.
- **Decision**: APPLIED — c913825 (`DELETE_CALL` now `/(?<![\w$])(rmSync|rmdirSync|rm|rmdir)\s*\(/g`, with a bare-call sample and a `perform(...)` sample). Suite after the fix: 868 tests, 866 pass, 0 fail.

### F3 — route.test.mjs changed though the plan does not list it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/test/route.test.mjs:581-592
- **Detail**: The test "the plan prompt carries the four rules" now counts six rules and asserts the two new suffix lines. The plan's Phase 3 did not name this file, but the change follows directly from adding two rules to `prompts.suffix` and keeps the test's intent. Benign.
- **Fix**: None needed; note it if the plan is revised.
- **Decision**: PENDING — no code fix; the owner decides whether the plan gets an addendum naming `route.test.mjs`.

### F4 — The prose guard lets any line with "block" through

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/test/no-recursive-delete.test.mjs:98
- **Detail**: `PROHIBITION` contains `\bblock`, as the plan asked (for the ADR's reason line). A line such as "if the step is blocked, run rm -rf tmp" would pass the guard. No such line exists today.
- **Fix**: Narrow the word to the phrase the docs use (for example "block them" / "may block"), if the owner wants a stricter guard.
- **Decision**: PENDING — the plan explicitly put `block` in the allow list; narrowing it is an owner call, not a clear in-scope fix.

### F5 — cleanupAll drops the remaining scratch dirs when one removal throws

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/test/helpers.mjs:11-13
- **Detail**: `created.splice(0)` empties the list before the loop, so if `removeTree` throws for one directory (a refusal or an `ENOTEMPTY` race) the rest leak in `os.tmpdir()`. The old `fs.rmSync(..., { force: true })` rarely threw, so this is a small behaviour change. The suite run left no leftovers (`evidence/command-suite-fresh-tmpdir.txt`).
- **Fix**: Wrap each call in try/catch and rethrow the first error after the loop.
- **Decision**: PENDING — AGENTS.md allows `helpers.mjs` to change only in its one cleanup line beyond `writeOverride`; a multi-line change needs the owner's consent.
