<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Store the --pr-comment request in meta.json

- **Plan**: context/changes/pr-comment-flag-in-meta/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Evidence: commits aa228af (p1), f5d787f (p2), 6d9f426 (p3) against base a506d63. Router code matches the plan: `prCommentField` in `state.mjs`, spread in `finishRun`, the five direct `out()` calls of `archiveDone` and `status`; `INIT_FLAGS`, validation and `meta.prComment` mirror `--archive`. Both skills drop the three task tools, Start step 5 and the task paragraphs. Module import order holds (`flow.mjs` and `isolation.mjs` import from `state.mjs`). No `gh` call and no `policy.json` key were added. Automated criteria 1.1 to 3.4 re-run on the code before the fixes: the full suite passes, both greps print 0 / nothing, `.claude/settings.json` holds only `sandbox`. Manual rows 1.4, 2.4 and 3.5 are ticked with evidence files in `evidence/`.

## Findings

### F1 — REFERENCE still prints the old `init reads:` list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:35
- **Detail**: The router's unknown-flag halt now reads `init reads: --goal, --rigor, --archive, --chrome, --pr-comment, --chain.` (`route.mjs` `INIT_FLAGS`, pinned by `route.test.mjs:697`), but the quoted halt text in REFERENCE still lists `--goal, --rigor, --archive, --chrome, --chain`. Phase 3 aims to bring the docs in line with the router; this quote was missed.
- **Fix**: Add `--pr-comment, ` before `--chain` in the quoted halt text.
- **Decision**: APPLIED in commit 89bf691.

### F2 — ADR index row of ADR-003 does not name Amendment 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/ADR/README.md:9
- **Detail**: Every amended ADR names its amendment in the index row (ADR-008, ADR-010, ADR-012, ADR-017: "Amendment 1: ..."). ADR-003 got Amendment 1 in this change, but its row was not updated.
- **Fix**: Append "Amendment 1: the `--pr-comment` request is stored in `meta.json`" to the ADR-003 row.
- **Decision**: APPLIED in commit 89bf691.

### F3 — 10x Start step 4 splits the `--chrome` sentences

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/SKILL.md:43
- **Detail**: The three `--pr-comment` sentences were inserted between "`--chrome` works the same way: ... `--chrome false` turns it off." and "The Chrome tools are on by default, so pass `--chrome false` only when the user gave it.", so the second Chrome sentence now follows the PR comment text and reads detached.
- **Fix**: Move the three `--pr-comment` sentences to the end of step 4, after the Chrome default sentence.
- **Decision**: APPLIED in commit 89bf691.

### F4 — Direct `archiveDone` halts carry `prComment: true` but no `report`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:618,677-690
- **Detail**: The kind B pre-check halt, the report-error halt and the two commit halts print with `out()` and carry `prComment: true` as planned, but no `report` key. The skill's PR comment section says "A `halt` without a `report` posts nothing: print `PR comment: skipped, no report`", so for the commit halts the comment is skipped although `report.md` was written (and, with `committed: true`, committed). This matches the behaviour before the change (the task path hit the same `no report` line), so it is not a regression, and the plan states that `report.md` and the outputs change only by the new field.
- **Fix A**: Add the `report` path to the direct `out()` halts that follow a successful `finishRun`.
  - Strength: The comment posts for a halt that has a report on disk.
  - Tradeoff: Changes the shape of `archiveDone` halts, which archive tests pin; outside this plan's scope.
  - Confidence: MED — the report exists for the commit halts, not for kind B before `finishRun`.
  - Blind spot: Whether the owner wants a comment for a run that halted after its pre-archive commit.
- **Fix B**: Keep as is and document that these halts skip with `no report`.
  - Strength: No router change.
  - Tradeoff: The `prComment` field on these halts has no effect.
  - Confidence: HIGH — current behaviour.
  - Blind spot: None significant.
- **Decision**: APPLIED (Fix A) — commit db974ae: the two commit-step halts of `archiveDone` (the failed commit and the held commit) carry `report: done.report`; the pre-check halts and the halt for a `report.md` that could not be written carry none, because they halt before this call writes a report; a later `next` that reaches the commit step writes it. `archive.test.mjs` pins the key in the kind C and kind D halt tests, and `docs/REFERENCE.md` says which halts carry it. Full suite: 1161 tests, 1158 pass, 0 fail, 3 skipped.
