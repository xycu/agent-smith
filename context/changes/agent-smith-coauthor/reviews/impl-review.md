<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Agent Smith Co-Authors Router Commits

- **Plan**: context/changes/agent-smith-coauthor/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Success criteria (measured before the fixes)

- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 1072 tests, 1069 pass, 0 fail, 3 skipped.
- `node tools/version-check.mjs`: `version-check: OK (1.4.13)`.
- `test -f docs/ADR/ADR-020-agent-smith-co-author.md && grep -q coAuthor docs/REFERENCE.md`: ok.
- `policy.json` parses as JSON: ok.
- Manual 3.4: evidence file `evidence/test-coauthor-start-commit.txt` holds the `coauthor.test.mjs` run (the start-commit case reads the real commit body of a hermetic repo). It is test evidence, not the scratch `init` the plan describes; accepted, since the test does the same thing in a scratch repo.

## Findings

### F1 — `open-pr.mjs` replaces a partial override where the router merges it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:184-192
- **Detail**: The router reads `coAuthor` through `deepMerge` (`state.mjs:37-44`), so an override `{ "coAuthor": { "name": "Someone" } }` gives `Co-Authored-By: Someone <agent-smith@ksycki.pl>`. `readCoAuthor` took the override value whole, so `coAuthorLine({ coAuthor: { name: "Someone" } })` gave `null`: the router commits carried a trailer and the leftover commit of the same run carried none. Checked with node: router `Co-Authored-By: X <agent-smith@ksycki.pl>`, `open-pr.mjs` `null`. The parity test feeds both validators the same merged value, so it cannot see a merge difference.
- **Fix**: Merge an override object into the plugin object (`{ ...base, ...over }`) and let any other override value replace it, as `deepMerge` does; add the partial-override case to the `open-pr.test.mjs` trailer test; state the merge rule in ADR-020 D4.
- **Decision**: APPLIED — commit b06d976 (`fix(agent-smith-coauthor): apply impl-review fixes`); `readCoAuthor` merges, the open-pr test covers `{ name: "Someone" }`, ADR-020 D4 updated.

### F2 — The rollback's halt on a malformed `coAuthor` has no test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:545-547
- **Detail**: `rollback` checks `coAuthorProblem` before its `git add -A` and stops, as the plan asks. `coauthor.test.mjs` covers the start commit, the step commit, the pre-archive and late-usage paths, but not this one, so a later move of the check below `add -A` would leave a staged index unseen.
- **Fix**: Add a test: a malformed override written mid-run, a failed step, `next` halts with `Rollback of step 1 (plan): policy.coAuthor ...`, no reset, no ref under `refs/agent-smith/`, nothing staged, partial edits kept.
- **Decision**: APPLIED — commit b06d976 (`fix(agent-smith-coauthor): apply impl-review fixes`); test "a malformed coAuthor halts the rollback before its snapshot" in `coauthor.test.mjs`.

### F3 — `git commit --trailer` needs git 2.32, not stated anywhere

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: docs/ADR/ADR-020-agent-smith-co-author.md (D3), docs/REFERENCE.md:55
- **Detail**: The plan names the git 2.32 requirement of `--trailer`, but neither ADR-020 nor REFERENCE.md does. With an older git every router commit fails and the run halts with git's message, which a user would not connect to this key. The default policy turns the trailer on, so the requirement applies to every isolated run.
- **Fix**: Name the requirement and the `coAuthor: null` way out in ADR-020 D3 and the co-author bullet of REFERENCE.md.
- **Decision**: APPLIED — commit b06d976 (`fix(agent-smith-coauthor): apply impl-review fixes`); one sentence in each file.

### F4 — ADR-020 sentence placed before ADR-019 in AGENTS.md

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md:57 (`docs/ADR/` entry)
- **Detail**: The ADR summaries run in number order; the ADR-020 sentence was inserted between ADR-018 and ADR-019.
- **Fix**: Move the ADR-020 sentence after the ADR-019 sentence.
- **Decision**: APPLIED — commit b06d976 (`fix(agent-smith-coauthor): apply impl-review fixes`).

## After the fixes

- Whole suite: 1073 tests, 1070 pass, 0 fail, 3 skipped; version check, docs check and `policy.json` parse pass.

## Notes

- Plan review F6 (one shared standalone module instead of the copy in `open-pr.mjs`) and F7 (verified email on `agent-smith-exile`) stay with the owner; this review does not reopen them. F1 above is the kind of drift F6 warned about.
