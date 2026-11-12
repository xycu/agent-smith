<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Stop Shipping Implemented Code in Chore Step Commits

- **Plan**: context/changes/step-commit-code-under-chore/plan.md
- **Mode**: Quick (no nested subagent; claims checked by hand against the code)
- **Date**: 2026-11-12
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

Grounding: 8/8 paths and line anchors checked (isolation.mjs routerCommit/stepCommit, policy.json suffix/templates, os-apply.md:25, open-pr.mjs commitLeftovers/buildBody, route.mjs status map, flow.mjs buildReport, REFERENCE.md lines 52/364/413, openspec SKILL.md lines 53/122), 6/6 symbols found, brief and plan agree, Progress rows 1.1-3.3 match the Success Criteria bullets. The rollback snapshot is a commit-tree with parent HEAD, so a commit made by a failed step stays reachable from the side ref.

## Findings

### F1 — New commit rule also commits to the user's own branch when isolation is off

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3, items 1, 3 and 5
- **Detail**: The `implement`, `implement-segment`, `implement-retry` and `os-apply` rules apply in every run. With `isolation.require: false` (ADR-017's only exception) the run root is the main checkout, so the subagent now commits on whatever branch the user has checked out, possibly `main`. Until now `os-apply` never committed and `openspec-pipeline/SKILL.md` lines 53 and 122 tell the user to commit the code themselves; the plan rewrites those lines to say `os-apply` commits. The `worktree.md` prompt that names the branch only opens isolated runs. The plan does not say whether this is wanted.
- **Fix**: Either keep the rule for all runs and document it (REFERENCE, SKILL.md lines 53/122), or condition the rule on an isolated run. Which one is an owner decision about commits on the user's branch.
- **Decision**: PENDING — owner must decide whether a non-isolated run may have its subagents commit on the checked-out branch; no evidence in the repo settles it.

### F2 — `names` is lost on the post-commit error path of routerCommit

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, item 1 (Contract) and Critical Implementation Details (State sequencing)
- **Detail**: `stepCommit` records `last.commit` when `res.made || !res.error`, and then halts on `res.error`. A commit that was made but failed the post-commit checks returns through `after()`, which carries `{ error, reason, commit, made }` and no `names`. The plan sets `last.swept` "under the same condition (`res.made`)" but only `{ commit, made, names }` on success is specified, so the swept paths of such a commit would be dropped while its `commit` is kept.
- **Fix**: State that `after()` also carries `names`, and that `stepCommit` records `swept` before it halts.
- **Decision**: APPLIED — Phase 1, item 1 "Contract" now says the post-commit error return carries `names` and `stepCommit` records `swept` with `commit` before halting.

### F3 — The grep in 3.3 catches only the two exact old sentences

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, item 5 and criterion 3.3
- **Detail**: Other wordings of the old rule survive the listed edits unless found by hand: `prompts/README.md:31` ("never archive or commit"), REFERENCE line 364 ("forbid staging at all"), line 413 ("forbids commits"). Criterion 3.3 cannot find them, and its row title may not change.
- **Fix**: Add an explicit grep step for those wordings to item 5.
- **Decision**: APPLIED — Phase 3, item 5 "Intent" now asks for a grep of the other wordings before the phase ends.
