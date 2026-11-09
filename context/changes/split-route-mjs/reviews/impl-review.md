<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Split route.mjs into five modules

- **Plan**: context/changes/split-route-mjs/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6, 7
- **Date**: 2026-11-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Verbatim move: an independent check (scratchpad, not committed) split the original `route.mjs` at `d037d64` and the six new files into top-level chunks (`function`/`const`/`let`/`try`), dropped `import` lines and a leading `export `, stripped comments and compared multisets: 206 chunks on both sides, 0 mismatches.
- Imports: every cross-module name used in code is imported from its owner; no module imports `route.mjs`; imports go only backwards in the order `state` <- `preplan` <- `steps` <- `flow` <- `isolation` <- `route`; no unused import; every export is used by another module. The checker's raw hits (`status`, `halt`, `paths`, `planPaths`, `rowId`, `main`, `next`, `scoreShift`) were all property names, local variables, object keys or comment words, checked by hand.
- `node --check` passes on all seven scripts.
- Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` 762 tests, 760 pass, 0 fail, 2 skipped (the `GH_LIVE` tests). `node tools/version-check.mjs` exits 0 (0.7.1).
- Per-commit scope (outside the change folder): p1 `16412ac` only `pr-comment.test.mjs`; p2-p6 each only `route.mjs` plus the new module; p7 `d0a2f42` only `AGENTS.md` and `SKILL.md`. ADRs and `docs/REFERENCE.md` untouched.
- Sizes: largest file `flow.mjs` 692 lines, `route.mjs` 681; none above about 750.
- `SKILL_DIR` is defined once in `state.mjs` (sibling of `route.mjs`, so the `".."` still resolves to the skill dir); `PLUGIN_ROOT` derives from it in `isolation.mjs`; `let undoOnError` stays in `route.mjs` above `try { main() }`; `COMMIT_EXISTS` moved with `archiveDone`; `halt`, `isObject`, `scoreConfig`, `ARTIFACT_NAME` in `state.mjs`, `e2eSetup` in `preplan.mjs`, as planned.
- gh guard: the test now scans every `scripts/*.mjs` except `pr-comment.mjs` and asserts `route.mjs` is among them. The mutant check was not re-run in this review (the scratch copy command was not permitted); the implementer's record stands.
- Manual rows: 1.4, 2.5, 6.6 and 7.4 each have an evidence file under `evidence/`; see F2 for the 2.5 and 6.6 evidence.

## Findings

### F1 — ADR-003 still names route.mjs as the home of tierFor and decide

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: docs/ADR/ADR-003-rigor-gated-routing.md:181
- **Detail**: The line "Symbols: `resolveRigor`, `measureRisk`, `hotSet`, `tierFor`, `cleanSignals`, `decide` in `skills/10x-pipeline/scripts/route.mjs`" is now stale: `tierFor` is in `steps.mjs`, `decide` and `cleanSignals` in `flow.mjs`, `resolveRigor`/`measureRisk`/`hotSet` in `state.mjs`. The plan says "no edit to ADRs" on purpose, and ADRs record the state at decision time, so this is consistent with the plan. `docs/REFERENCE.md:20` still reads "`route.mjs` reads `plan.md` ... and returns the next step", which stays true for the entry point.
- **Fix**: If the owner wants it, add a dated amendment line to ADR-003 naming the new modules, in a separate docs change.
- **Decision**: PENDING — outside this plan's scope (the plan forbids ADR edits); the owner decides whether ADRs get an amendment line for moved symbols or stay as historical records.

### F2 — init evidence captures only the resume halt, not the first init

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/split-route-mjs/evidence/command-2-5-init-status.txt, command-6-6-init-status.txt
- **Detail**: Both files record valid `status` JSON and a second `init` that halts on the missing step-1 result (valid JSON). The first `init` that returned `action: run` is only asserted in prose, not captured. The full suite drives `init` through the real CLI hundreds of times and is green, so the row's claim holds; the evidence is just thinner than the row text.
- **Fix**: None needed for this change; a future manual-verify could save the first `init` output itself.
- **Decision**: PENDING — no code fix applies; the owner decides whether the thinner evidence is acceptable (the suite covers the claim).
