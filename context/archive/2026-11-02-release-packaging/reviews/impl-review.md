<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Release packaging with Semantic Versioning

- **Plan**: context/changes/release-packaging/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-02
- **Verdict**: APPROVED (after the applied fixes)
- **Findings**: 0 critical, 5 warnings, 2 questions

An independent reviewer agent read `git diff main..HEAD` (without `context/`) and was not given the author's conclusions. The main session ran every Automated command: full suite 505 tests, 503 pass, 2 skipped, 0 fail; `node tools/version-check.mjs` OK; `node tools/commit-lint.mjs main..HEAD` OK; `actionlint .github/workflows/*.yml` clean; `claude plugin validate .` passed. Manual rows 1.6, 2.5, 3.7, 3.8 and 3.9 need a human or GitHub and are still pending.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Success Criteria is WARNING only because five Manual rows are pending.

## Findings

### F1 — `Revert "feat: x"` fails the commit lint

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tools/commit-lint.mjs:13
- **Detail**: Git's default revert subject did not match the pattern, so a plain `git revert` would fail the `commits` job.
- **Fix**: Accept `Revert "<valid subject>"` and lint the quoted subject; add tests.
- **Decision**: FIXED

### F2 — Manifest check was optional

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tools/version-check.mjs:43
- **Detail**: Deleting `.release-please-manifest.json` made the guard pass while the release lost its version state.
- **Fix**: Require the file; test the missing case.
- **Decision**: FIXED

### F3 — Nothing ties the config to the guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tools/test/version-check.test.mjs
- **Detail**: A jsonpath typo or a new `version` key could pass CI.
- **Fix**: Add a test that reads `release-please-config.json` and asserts the `extra-files` entries and the count of `version` keys in `marketplace.json`.
- **Decision**: FIXED

### F4 — `$..version` is a recursive descent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: release-please-config.json:10
- **Detail**: A future `version` key at any depth in `marketplace.json` would be rewritten too.
- **Fix A**: Keep `$..version`, as in hegel-skill, and rely on the new F3 test.
  - Strength: Proven by hegel-skill's releases; F3 fails if a third `version` key appears.
  - Tradeoff: Wide matcher.
  - Confidence: HIGH — same config ships there.
  - Blind spot: None significant.
- **Fix B**: Use `$.metadata.version` and `$.plugins[0].version`.
  - Strength: Exact.
  - Tradeoff: Array-index jsonpath is unproven in this setup; a mistake would break the first release.
  - Confidence: MEDIUM
  - Blind spot: Not tested against release-please.
- **Decision**: ACCEPTED (Fix A; the F3 test guards it)

### F5 — ADR claimed actionlint checks the workflows

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-008-release-packaging-and-semver.md:45
- **Detail**: Only an implementation-time run used actionlint; no workflow runs it.
- **Fix**: Reword to say so.
- **Decision**: FIXED

### F6 — Bump table said `perf` and `revert` open no release PR

- **Severity**: ❓ QUESTION, resolved as WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: AGENTS.md (Commits table), ADR-008 Consequences
- **Detail**: release-please's `DefaultVersioningStrategy` (read in googleapis/release-please `src/versioning-strategies/default.ts`) bumps patch for any commit type when no `feat` or breaking commit is present. Which types open a release PR depends on the changelog sections, which was not confirmed from source or a live run.
- **Fix**: Rewrite the table to the bump rule that was read in source, state the section rule as unverified, and let the first release PR confirm it. The plan's Migration Notes keep the earlier wording; the Phase 3 `feat(release)` commit makes row 3.8 reachable either way.
- **Decision**: FIXED

### F7 — Action name and inputs, and `version.txt`

- **Severity**: ❓ QUESTION, resolved
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/release.yml
- **Detail**: `googleapis/release-please-action` has tag `v5`, and its `action.yml` defines `token`, `config-file` and `manifest-file`. The `simple` strategy reads `version.txt` and may add it to the release PR; hegel-skill's tree has none, so this is harmless either way.
- **Fix**: None needed.
- **Decision**: DISMISSED
