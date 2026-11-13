<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Slim AGENTS.md to rules and pointers

- **Plan**: context/changes/agents-md-slim/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-12
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

- Hard Rules: the section of `AGENTS.md` is byte-identical to `main` (diff of `## Hard Rules` up to the next heading).
- Size: `AGENTS.md` is 10409 bytes (limit 12288).
- Stale text: `grep -n "0\.x\|first release PR confirms\|Project Structure" AGENTS.md` prints nothing; `grep -c "node --test" AGENTS.md` prints 1.
- Indexes: the loops of criteria 1.1 and 1.2 print nothing.
- Smoke check: run as written in `AGENTS.md` in a fresh scratch project, `init demo --goal "add a flag"` returned `action: "run"`, `step: "plan"`; `status demo` returned the log.
- Claims checked against the code: `status --report` (`route.mjs:10`, `:833`), `--timeout-ms` positive integer for `gh` calls only, default 20000 (`open-pr.mjs:67-70`, `:94`, `pr-comment.mjs:29-30`), version 1.6.1 (`.release-please-manifest.json`), `bump-minor-pre-major` acts only below 1.0.0 (`release-please-config.json:9`). The dropped command details (`--chrome false` template, `--key=value`, `--archive false`, stored chain, `compare --unpinned`) are in `docs/REFERENCE.md`.
- ADR index: titles and summaries of ADR-001 to ADR-008 checked against each file's title, status and Context; ADR-001 supersession by ADR-007 matches ADR-007's "Supersedes in part" line.
- Re-pointed pins: `advisor.test.mjs` test 3.6 and `pr-comment.test.mjs:810` match the plan's contracts; `no-recursive-delete.test.mjs` unchanged.
- `version-check.mjs` (OK, 1.6.1), `commit-lint.mjs main..HEAD` (OK) and the full suite (1117 tests, 1114 pass, 0 fail, 3 skipped) pass before and after the fixes.
- Manual row 3.4 (CI green on the pull request) stays pending: the pull request does not exist yet (`evidence/unproven.md`).

## Findings

### F1 — Test index row of agents-md-no-imports omits CLAUDE.md

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/README.md:100
- **Detail**: The row says the test checks `AGENTS.md`; `tools/test/agents-md-no-imports.test.mjs:44` checks `AGENTS.md` and `CLAUDE.md` (skipped when absent). The index is meant to describe each file's scope.
- **Fix**: Name both files in the row.
- **Decision**: APPLIED in commit 53259cc.

### F2 — Two facts of the old catalog did not reach the test index

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/README.md:88, :106
- **Detail**: The Phase 1 contract carries the catalog facts into the index. Two were lost: the old `tools/workflow-pins.mjs` bullet said a tag reference fails the suite and "To bump an action, replace the SHA and the version comment together" (now in no file); the old `late-usage` bullet said `skill-loop.test.mjs` and `openspec-skill.test.mjs` both pin the `usage` call places, but the new index records it only for `skill-loop.test.mjs`, and the `openspec-skill.test.mjs` row does not name the anti-stall equality it checks.
- **Fix**: Add the bump rule to the `workflow-pins.test.mjs` row and the anti-stall equality and `usage` call places to the `openspec-skill.test.mjs` row.
- **Decision**: APPLIED in commit 53259cc.
