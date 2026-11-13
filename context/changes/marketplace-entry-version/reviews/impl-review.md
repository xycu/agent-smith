<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Drop the duplicate version from the marketplace plugin entry

- **Plan**: context/changes/marketplace-entry-version/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-13
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

Method: reviewed directly (no sub-agents: the run forbids nested subagents). Diff `main..HEAD` outside `context/` touches exactly the plan's files: `marketplace.json`, `release-please-config.json`, `tools/version-check.mjs`, its test, `AGENTS.md`, ADR-008, `docs/ADR/README.md`, `skills/10x-pipeline/test/README.md`. `plugin.json`, manifest, `ci.yml`, `release.yml`, `CHANGELOG.md`, `docs/REFERENCE.md` untouched. Guard rule skips non-object entries and non-array `plugins` (the plan-review F1 case), `collect` keeps its throw messages, CLI output unchanged. ADR-008 keeps the Decision sentence and older amendments, adds the Status text, one Superseded parenthetical and Amendment 3 with Context, Rules, Consequences and Alternatives. Automated criteria 1.1-1.4 and 2.1-2.3 re-run: version-check prints `version-check: OK (1.7.0)`, no entry has `version`, the grep returns no line describing `plugins[0].version` as a version field except the intentional ADR-008 history line. Manual 1.5 and 2.4 have evidence files in `evidence/`.

## Findings

### F1 — AGENTS.md Layout bullet does not say the plugin entry carries no version

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: AGENTS.md:59
- **Detail**: Phase 2 Intent says to also state in the `.claude-plugin/` Layout bullet that the plugin entry carries no `version`. The bullet still said only "`version` is set only by the release PR". The Contract and the Releases bullet were met, so this is a small omission.
- **Fix**: Append "and the `marketplace.json` plugin entry carries none" to the bullet (AGENTS.md stays far below 12288 bytes).
- **Decision**: APPLIED — fix commit on this branch (`fix: state in the AGENTS.md layout bullet that the plugin entry carries no version`)

### F2 — Progress row 2.5 is open

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/marketplace-entry-version/plan.md (Progress 2.5)
- **Detail**: Row 2.5 (the next release PR diff changes only the four files and fields) is correctly left `[ ]`; the release PR does not exist yet (`evidence/unproven.md`). Not a defect, recorded so the open row stays visible.
- **Fix**: None in code; the owner reads the release PR diff after the next release.
- **Decision**: PENDING — needs the next release PR to exist; the owner has to confirm its diff touches only `plugin.json` `version`, `marketplace.json` `metadata.version`, `.release-please-manifest.json` `.` and `CHANGELOG.md`.
