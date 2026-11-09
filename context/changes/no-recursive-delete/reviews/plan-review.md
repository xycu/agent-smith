<!-- PLAN-REVIEW-REPORT -->
# Plan Review: No recursive force delete Implementation Plan

- **Plan**: context/changes/no-recursive-delete/plan.md
- **Mode**: Deep (codebase claims checked by hand with grep and file reads, no sub-agent)
- **Date**: 2026-11-09
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths and call sites checked (all 13 test and tool files with recursive deletes, `pr-comment.mjs:210`, `flow.mjs:356`, `policy.json` suffix, both `SKILL.md` lines) ✓, symbols ✓ (`prompts.suffix`, `manual-verify-nochrome`, `rules.test.mjs` ADR check, `skill-loop`/`openspec-skill` tests), brief↔plan ✓, Progress↔Phase ✓ (20 rows, one `## Progress`, numbering matches the Success Criteria). One gap: `pr-comment.test.mjs:612` is not covered (F1).

## Findings

### F1 — Mutation test runs `pr-comment.mjs` alone and breaks on the new import

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Router-side script, Test helpers and tests
- **Detail**: Phase 2 makes `pr-comment.mjs` import `./remove-tree.mjs`. `skills/10x-pipeline/test/pr-comment.test.mjs:608-623` ("mutation: without the author comparison ...") writes a modified copy of `pr-comment.mjs` alone into a scratch directory and spawns it. With a relative import the copy fails with `ERR_MODULE_NOT_FOUND`, the mutant never POSTs or PATCHes, and criteria 2.2 and 2.3 fail. The plan lists `pr-comment.test.mjs` only for its `rmSync` line.
- **Fix**: Copy `scripts/remove-tree.mjs` into the mutant's scratch directory before it runs. (Alternative not taken: inline a file unlink plus `rmdir` in `pr-comment.mjs`, since its temp dir holds one file; that avoids the import but gives the script a second delete implementation.)
- **Decision**: APPLIED — Phase 2, "Test helpers and tests" Contract: added the `pr-comment.test.mjs:612` copy step.

### F2 — Guard scanner reads call arguments to the first `)` and misses most real call sites

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — The guard test
- **Detail**: The contract matches `recursive: true` in "the argument text up to the closing parenthesis". Most banned calls here start with `path.join(...)`, for example `archive.test.mjs:36` `fs.rmSync(path.join(project.root, "context/changes"), { recursive: true, force: true })`. The first `)` closes `path.join`, so the options object lies outside the scanned text and the guard would not fire on a returned violation. The sample strings in the plan (`fs.rmSync(d, { recursive: true })`) have no nested call, so the deliberate-break check would pass while the guard stays blind. The pattern also needs to accept `recursive:true` and options on a following line. Options passed through a variable cannot be seen at all.
- **Fix**: Read to the balanced closing parenthesis (spanning lines), match `recursive\s*:\s*true`, add samples with a nested first argument and with options on the next line, and name the variable-options gap under "Not covered" in ADR-016.
- **Decision**: APPLIED — Phase 4, "The guard test" Contract (scanner and samples) and "ADR-016" Contract ("Not covered").

### F3 — Guard prose check would reject the ADR and other lines that quote the ban

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — The guard test, ADR-016
- **Detail**: In `.md` and `.json` files a line naming `rm -rf` passes only if it also holds `MUST NOT`, `never`, `Never`, `not use`, `Do not`, `ban` or `forbid`. ADR-016 must quote the forbidden forms in its Context ("reasonable people block `rm -rf` in their harness"), Alternatives and Assumptions, and many of those lines hold none of the words. The guard would fail on the plan's own ADR, and an implementer would loosen the check ad hoc. The scan also covers only `.md`/`.json` and `.mjs`, so `.github/` is out of scope (it holds no hit today).
- **Fix**: Skip `docs/ADR/ADR-016-no-recursive-force-delete.md` by name, as the guard test file is skipped, add `block` to the word list, and name the `.github/` scope gap under "Not covered".
- **Decision**: APPLIED — Phase 4, "The guard test" Contract (skip list, word list) and "ADR-016" Contract ("Not covered").

### F4 — The helper's "check" step is tautological and the refusals are narrow

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — The helper, Contract
- **Detail**: Every path collected by `readdirSync` under the target starts with the target plus `path.sep`, so the check "every collected path lies inside the target" can never fail. The real protection is the refusal list (empty path, root, home), which does not cover the current working directory, an ancestor of the home directory such as `/Users`, or an ancestor of the working directory. Separately, the greps of 1.2 and 2.1 would hit the word `recursive` in comments of `remove-tree.mjs`; 2.1 names only `mkdirSync`, `cpSync` and the guard test as allowed hits.
- **Fix**: Refuse `process.cwd()` and any ancestor of the home directory or the working directory, keep the prefix check as an assertion, and keep the words `recursive` and `force` out of the helper's comments.
- **Decision**: APPLIED — Phase 1, "The helper" Contract.
