<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pin GitHub Actions to commit SHAs

- **Plan**: context/changes/pin-action-shas/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-11
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

## What was checked

- `git diff main -- .github tools`: five `uses:` lines changed in `ci.yml` (4) and `release.yml` (1), each `@v5` to `@<40 hex> # vX.Y.Z`; no other workflow line changed.
- Re-ran `git ls-remote` for all three repos today: `actions/checkout` `v5` and `v5.1.0` = `fbc6f399...`, `actions/setup-node` `v5` and `v5.0.0` = `a0853c24...`, `googleapis/release-please-action` `v5^{}` and `v5.0.0` = `45996ed1...` (peeled commit, not the tag object). All match the pins.
- `grep -nE 'uses: [^ ]+@v[0-9]' .github/workflows/*.yml`: no output.
- `node --test tools/test/workflow-pins.test.mjs`: 2 pass. `node tools/version-check.mjs`: OK (1.4.3). Full suite: 986 tests, 984 pass, 0 fail, 2 skipped.
- Out-of-scope check: no new dependency, no Dependabot config, no ADR, no permission or trigger change.
- Open plan row: 1.5 (CI and release-please resolve the actions) needs GitHub after the pull request exists; it is correctly left `[ ]`.

## Findings

### F1 — Unused `export` on `findUses`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tools/test/workflow-pins.test.mjs:12
- **Detail**: `findUses` is exported but no file imports it. Harmless; other test files in `tools/test/` import their subject from `tools/`, not from a test.
- **Fix**: Drop `export`. Not required.
- **Decision**: APPLIED - 2e57f49 — the guard moved to `tools/workflow-pins.mjs`; the test imports `findUses`, `files` and `check` from it, as the other `tools/test/` files import their subject.

### F2 — Guard reads only `*.yml` and line-based `uses:`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tools/test/workflow-pins.test.mjs:17
- **Detail**: A future `.github/workflows/*.yaml` file, or a `uses:` inside a multi-line scalar, would not be read as the test expects. A quoted value (`uses: "a/b@v1"`) is read and fails the pattern, so it fails closed. Both gaps are outside the plan's contract and no such file exists today.
- **Fix**: Filter on `.yml` or `.yaml` if a `.yaml` workflow is ever added.
- **Decision**: APPLIED - 2e57f49 — the guard reads every `*.yml` and `*.yaml` file under `.github/` (composite actions included) and a root `action.yml` or `action.yaml`; a quoted or flow-mapping `uses` key is found, and a quoted value, a value on the next line and a `uses:` inside a multi-line scalar fail closed.
