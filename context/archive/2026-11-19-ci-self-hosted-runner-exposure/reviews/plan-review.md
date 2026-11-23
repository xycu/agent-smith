<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Harden the OpenSpec install on TrueNAS CI

- **Plan**: context/changes/ci-self-hosted-runner-exposure/plan.md
- **Mode**: Deep (claims verified inline against the code and the npm registry; no sub-agent)
- **Date**: 2026-11-22
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

6/6 paths checked (`ci.yml`, `pr-title.yml`, `release.yml`, `tools/test/ci-runner.test.mjs`, ADR-020, ADR index), 3/3 symbols checked (install line at `ci.yml:63`, test lines 60 and 116, ADR-020 status line and index row), brief↔plan ✓. Progress↔Phase ✓: one `## Progress` block, 1.1, 2.1 to 2.3 match the Success Criteria, and no ticked rows. No Automated row depends on a pushed branch, PR or PR CI; 2.3 is already Manual. `docs/reference/contract-surfaces.md` does not exist (skipped). The inserted flag keeps `$3` as the prefix, so the npm stub contract holds.

## Findings

### F1 — Automated row 2.1 passes on a bare heading

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria (row 2.1), Testing Strategy
- **Detail**: Row 2.1 runs two `rg` checks for the `## Amendment 3` heading and an `ADR-020.*Amendment 3` index row. An empty or placeholder amendment passes both. The status line change ("Accepted, amended (Amendments 1 and 2)") that Phase 2 requires is not checked at all. The row title cannot change, because Progress rows are fixed.
- **Fix**: Add a read-through of the amendment content and the status line to the Testing Strategy, without touching the Progress rows.
- **Decision**: APPLIED — Testing Strategy: added the Phase 2 read-through (status line names Amendments 1 to 3; amendment states install protection and limits, dated settings, reach evidence or named unknowns, accepted same-repository risk).

### F2 — No evidence before publication that OpenSpec 2.0.0 works with scripts disabled

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1; Migration and fallback
- **Detail**: Phase 1's only automated proof is a stubbed npm, which cannot show that the real package works without lifecycle hooks. The first real evidence is the published PR run (row 2.3). A hook dependency found there needs the `npm ci` fallback, which changes the argv and probably the npm stub, outside the two approved test assertions (the plan says to return to the owner). `npm view @fission-ai/openspec@2.0.0 scripts` (2026-11-22) shows no `preinstall`, `install` or `postinstall` hook on the top package, so the risk is in the transitive tree, which a local install can check cheaply before publication. A local install attempt in this review's sandbox failed with a registry 404 on one transitive tarball (`@inquirer/expand`), so it proved nothing either way.
- **Fix**: Add a local pre-check to Phase 1: install with `--ignore-scripts` in a scratch prefix, run `--version`, and list installed `package.json` files that declare an install-time hook.
- **Decision**: APPLIED — Phase 1 "Changes required": added the "Local pre-check" paragraph; plan-brief Phases table row 1 updated to match. Progress rows unchanged.

### F3 — Fallback allows scripts with no stated limit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Migration and fallback
- **Detail**: "If needed, permit only the reviewed, locked install behavior" leaves the implementer to decide how scripts run on the NAS. A lockfile fixes the tree, but running every hook of that tree is a wider grant than the one confirmed hook.
- **Fix**: State `npm ci --ignore-scripts`, then `npm rebuild <package>` for the one named package, and never enable scripts for the whole tree.
- **Decision**: APPLIED — Migration and fallback: replaced the vague sentence with the `npm ci --ignore-scripts` plus single-package `npm rebuild` rule.
