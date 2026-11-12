<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Agent Smith Co-Authors Router Commits Implementation Plan

- **Plan**: context/changes/agent-smith-coauthor/plan.md
- **Mode**: Deep (done in this subagent, no sub-agent launched per orchestrator note)
- **Date**: 2026-11-12
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths and symbols checked ✓ (`routerCommit` isolation.mjs:325, `commit-tree` :543, `startCommit`, `stepCommit`, `rollback`, `archiveDone`, `PROVENANCE_DEFAULTS` :19, `mergedPolicy`/`deepMerge` state.mjs, `commitLeftovers` open-pr.mjs:225, `halt` state.mjs:754), brief↔plan ✓, Progress↔Phase rows ✓ (8 rows, one heading, no checkboxes in phase bodies). `git commit -m ... --trailer ... -- <path>` and `commit-tree -m subject -m trailer` were run in a throw-away repo: both give a blank line then one well-formed trailer (git 2.54). `deepMerge` lets an override `null` replace the default object, so `coAuthor: null` works.

## Findings

### F1 — Default provenance ignore list is pinned in more places than the plan names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 1. Policy data; Phase 3 — 1. Docs
- **Detail**: The plan adds `coAuthor` to `provenance.ignore` in `policy.json` only. The same default list is also `PROVENANCE_DEFAULTS.ignore` (isolation.mjs:19, the fallback when an override malforms the list), asserted by `provenance.test.mjs:89` (`deepEqual` on the whole block) and by the `want` filter at `provenance.test.mjs:97-99`, and written in `docs/REFERENCE.md:296`. Left alone, `provenance.test.mjs` fails in step 1.2 and the docs name a stale list.
- **Fix**: Name `PROVENANCE_DEFAULTS`, the two test assertions and the REFERENCE.md line in the plan.
- **Decision**: APPLIED — Phase 1, 1. Policy data (Contract) and Phase 3, 1. Docs (Intent).

### F2 — Argument position of `--trailer` is unspecified and two shims and one test depend on it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 3. Router commits; Phase 1 — 4. Tests
- **Detail**: `archive.test.mjs` (~778) and `stepcommit.test.mjs` (~137) install a `git` shim that matches `*" commit -m "*`; a `--trailer` placed between `commit` and `-m` would silently disable it. `archive.test.mjs` (~1175) asserts that every `commit` call ends with `--`, `<rel>` and holds one `--`, so the trailer must come before the `--`. The plan also says existing tests "that compare whole commit bodies are updated", but no test reads `%B`; the claim points at the wrong tests.
- **Fix**: State the order `commit -m <message> --trailer <trailer> -- <rel>` in the contract, and replace the whole-body sentence with the real list of tests affected.
- **Decision**: APPLIED — Phase 1, 3. Router commits (Contract) and 4. Tests (Contract, last sentence).

### F3 — A halting helper skips the end-state write and the undo in `stepCommit` and `rollback`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 2. Trailer helper and validation
- **Detail**: The plan makes `coAuthorTrailer` call `halt(...)`, which exits at once. The callers do not use bare `halt`: `startCommit` and `stepCommit` use a local `stop` (`endRun` in `stepCommit`, which records the end state), `archiveDone` uses `precheck`, `lateUsageCommit` returns `{ error }`, and `rollback` uses `stop` with the undo hint. A bare `halt` there would leave the log without the end state. The existing pattern is a helper that returns null or a message (`isolationMessage`, `usageMessage`) and a caller that stops. The rollback path also needs the check before `git add -A`, which the plan does not say.
- **Fix**: Split into `coAuthorProblem(policy)` (message or null) and `coAuthorTrailer(policy)`; each caller maps the message to its own stop, before `git add`, the rollback included.
  - Strength: Matches `isolationMessage`/`usageMessage`; no caller loses its end-state write.
  - Tradeoff: Two exports instead of one.
  - Confidence: HIGH — `stop` in `startCommit`/`stepCommit` and `precheck` in `archiveDone` already follow this shape (isolation.mjs:432-433, 461-462, 616-621).
  - Blind spot: None significant.
- **Decision**: APPLIED — Phase 1, 2. Trailer helper and validation (Contract) and 3. Router commits (Intent).

### F4 — "Halts `init` and `next`" is wider than where the key is read

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phase 1 — 4. Tests
- **Detail**: The key is checked only where a router commit is made. A run with `isolation.require: false` and no `--archive` makes none, so a malformed `coAuthor` never halts it; a resumed isolated `init` makes no start commit, so only `next` halts, at the first step commit. A test of "halt `init`" works only with isolation required. Validating at load time would instead halt `status` and the other read-only commands for a cosmetic key.
- **Fix**: Word the end state as a halt at the first router commit that would carry the trailer, and make the test cases match (start commit at `init`, step commit at `next`, index left unstaged, `status` unaffected).
- **Decision**: APPLIED — Desired End State and Phase 1, 4. Tests (Contract).

### F5 — The parity test of the two validators has no home

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — 1. Standalone policy read; success criterion 2.2
- **Detail**: Criterion 2.2 runs `coauthor.test.mjs` as the parity check, but Phase 1 lists no parity case for that file and Phase 2's Tests section names only `open-pr.test.mjs`. `open-pr.mjs` also exports no validator a test could call.
- **Fix**: Add the parity case to `coauthor.test.mjs` in Phase 2 and have `open-pr.mjs` export its function by name.
- **Decision**: APPLIED — Phase 2, 1. Standalone policy read (Contract).

### F6 — Validation and policy merge are written twice

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — 1. Standalone policy read
- **Detail**: `open-pr.mjs` re-implements the `coAuthor` rule and a small policy merge because it may not import router modules. The plan guards the drift with a parity test (as fixed in F5). A standalone `scripts/co-author.mjs` (built-ins only, like `remove-tree.mjs`) imported by both `isolation.mjs` and `open-pr.mjs` would hold the rule once, but it changes the import rule that AGENTS.md and ADR-017 state for `open-pr.mjs` and for the router modules.
- **Fix A ⭐ Recommended**: Keep the duplicate and the parity test.
  - Strength: Respects the AGENTS.md import rule as written; no doc change.
  - Tradeoff: Two copies of about ten lines.
  - Confidence: HIGH — the parity test catches drift.
  - Blind spot: None significant.
- **Fix B**: Standalone `co-author.mjs` imported by both.
  - Strength: One rule.
  - Tradeoff: Rewrites the "no router module" statement and the module import-order text in AGENTS.md.
  - Confidence: MEDIUM — the `open-pr.test.mjs` guard on router modules would need a read.
  - Blind spot: Whether the owner wants the import rule loosened.
- **Decision**: PENDING — owner chooses between keeping the duplicate (the plan as written) and a shared standalone module; changing the import rule in AGENTS.md is not mine to guess.

### F7 — "GitHub then lists the account" depends on a verified email nobody checks

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Overview
- **Detail**: GitHub attributes a `Co-Authored-By` trailer to an account only when the email is on that account. The plan's tests prove the trailer text only, and no row checks the attribution on a pushed commit. If `agent-smith@ksycki.pl` is not a verified email of `agent-smith-exile`, the trailer appears but no avatar does.
- **Fix**: The owner confirms the email on the account, or looks at the first pull request of a run after release.
- **Decision**: PENDING — only the owner can see the GitHub account settings; no plan edit can settle it.
