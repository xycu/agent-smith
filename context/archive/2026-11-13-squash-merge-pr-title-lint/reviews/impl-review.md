<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Squash-only merging: lint the PR title, fix run PR titles, update the docs

- **Plan**: context/changes/squash-merge-pr-title-lint/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

Phase 5 (live check on GitHub) has only Manual rows, all pending; it needs the pull request of this change and is not reviewed here.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria of phases 1-4, run on the code before any fix: `commit-lint --title "fix(router): x"` exits 0, `--title "Update stuff"` exits 1; `grep -c` of pinned actions in `pr-title.yml` prints 2; `node tools/commit-lint.mjs main..HEAD` OK; `git grep -i rebase-merges` outside `context/` and `CHANGELOG.md` shows only ADR-008 lines with an Amendment 2 pointer (and the Amendment itself); `AGENTS.md` is 10,681 bytes; the full suite passes. Manual rows 1.4, 2.5, 3.4, 4.5 and 4.6 are backed by the diff (header comments, `ci.yml` comment-only change, ADR-017 step 5 pointer, ADR-008 pointers, AGENTS.md Commits sentence).

## Findings

### F1 — docs/REFERENCE.md still documents the untyped run PR title

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:67
- **Detail**: Phase 3 changed the title of `gh pr create` to `<type>(<change-id>): <title>` (ADR-017, Amendment 1), but the open-pr bullet of `docs/REFERENCE.md` still says "the title is `title:` of `change.md`, else the id". The plan's Gap 3 list missed this file, so a reader of the routing reference gets the old behavior. `AGENTS.md` names `docs/REFERENCE.md` as the routing reference.
- **Fix**: Rewrite that clause to name the derived conventional title, the fallback when `git log` fails, the set-once rule, and point at ADR-017 Amendment 1.
- **Decision**: APPLIED — commit e2dcef6: the open-pr bullet of `docs/REFERENCE.md` names the derived title, the fallback, the cap and the set-once rule (ADR-017, Amendment 1).

### F2 — the type prefix can push a run PR title past the 256-character cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:327
- **Detail**: `TITLE_CAP = 256` matches GitHub's limit for a pull request title, and `titleFor` cut the whole title to it. `prTitleFor` now prepends `<type>(<change-id>)!: ` (up to about 115 characters with a 100-character id) to the already capped description, so a long `title:` in `change.md` gives a title over 256 characters; `gh pr create` would then reject it and the run ends with a pull request skip. The plan kept `TITLE_CAP` on the description only, so this is a plan gap, not drift.
- **Fix**: Cut the whole derived title to `TITLE_CAP` in `prTitleFor` and add a test case with a 300-character `title:`.
- **Decision**: APPLIED — commit e2dcef6: `prTitleFor` cuts the whole title to `TITLE_CAP`; a 300-character `title:` case pins it.
