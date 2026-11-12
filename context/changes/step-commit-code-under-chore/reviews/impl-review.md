<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stop Shipping Implemented Code in Chore Step Commits

- **Plan**: context/changes/step-commit-code-under-chore/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Mode: no nested subagent (the step prompt bans them); drift and safety checks done by hand against the diff `8818e34..fae2d59`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Plan adherence (summary)

- Phase 1: `routerCommit` reads `git diff --cached --name-only --no-renames -z` after `git add -A` and before `git commit`, only without `rel`; a failed read goes through `failed()`; `names` rides on both the success return and `after()`. `stepCommit` sets `last.swept` (sorted, non-empty only) next to `last.commit` under `res.made || !res.error`, filtered by `<show-prefix><changeRel>/`. `status` spreads `swept`; `flow.mjs` adds `sweptHeader` (header line before the table) and `sweptLines` (after skipped steps, before `## Rolled-back steps`). Tests cover both chains, the rename, the self-committed file, the absent case and the failed name read with resume. ADR-010 Amendment 1 and the REFERENCE bullet are in. MATCH.
- Phase 2: `open-pr.mjs` `swept` (null / [] / list), `result()` default, both SKILL.md print lines, REFERENCE "Leftover commit" and "Output". MATCH.
- Phase 3: the exact commit rule line in `implement` (still a string), `implement-segment` and `implement-retry`; suffix reworded; `os-apply.md` rule replaced plus a separate stash ban; `rules.test.mjs` pins all of it, the router prompt included; prompts/README, REFERENCE, openspec SKILL.md and AGENTS.md updated. The extra edit in `executors.test.mjs` follows from the third `implement-retry` part. MATCH.

## Success criteria

- 1.1, 2.1, 3.1 targeted suites: pass.
- 1.2, 2.3, 3.2 full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: pass.
- 1.3 `init` and `status` on a scratch change folder (10x and `--chain openspec`): valid JSON.
- 3.3 grep for the old rule wordings: prints nothing.
- No Manual rows in the plan.

## Findings

### F1 — Leftover commit of a staged archive move lists change-folder paths as swept

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:268 (`sweptOf`)
- **Detail**: With `--report <archivePath>/agent-smith/report.md`, `changeDir(opts)` is the archive folder only. When the `chore(archive)` commit failed and left the rename staged (the case `skills/10x-pipeline/SKILL.md` step 5 warns about), the leftover commit holds the deletions under `context/changes/<id>/` (or `openspec/changes/<id>/`), and `sweptOf` returns them, so the orchestrator prints change-folder files as "code under chore".
- **Fix**: Exclude both the live change folder of the chain and the `--report` folder in `sweptOf`; add an open-pr test with a staged `git mv` of the change folder into the archive.
- **Decision**: APPLIED in 595e6d3 — `sweptOf` excludes the live change folder and the `--report` folder; new open-pr test with a staged `git mv` into the archive (fails without the fix, passes with it); full suite green.
