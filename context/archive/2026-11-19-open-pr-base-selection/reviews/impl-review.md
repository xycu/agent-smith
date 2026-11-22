<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Prefer the default PR base at equal or shorter distance

- **Plan**: context/changes/open-pr-base-selection/plan.md
- **Scope**: Full plan (Phase 1 of 1)
- **Reviewed phases**: 1
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

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

Reviewed directly, with no sub-agents, because the step runs as a subagent. Diff scope is `d1f10ba2..HEAD` outside `context/`: `skills/10x-pipeline/scripts/open-pr.mjs`, `skills/10x-pipeline/test/open-pr.test.mjs`, `docs/REFERENCE.md` and `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`, which are the four files the plan names. No router module, policy file or prompt changed.

- **Ranking** (`open-pr.mjs` `ancestorCounts`, `nearestBase`, `resolveBase`): matches Desired End State 1 to 4. `--base` returns first. Ancestors rank by the `rev-list --count <ref>..HEAD` measure (the `%(ahead-behind)` count is the same number). An eligible symbolic HEAD target is compared on that measure, using the enumerated count for an ancestor and a literal `show-ref --verify` plus `rev-list` for a diverged tip. It wins at equal or shorter distance. With an unknown HEAD target, ties follow `isolation.defaultBranches` order, then alphabetical order. A failed, empty or non-integer count becomes `null` through `parseComparisonCount`, which drops the candidate on both the modern and older-Git paths. The GitHub lookup stays last, and `automaticBase` still filters every source.
- **Edge cases traced**: head eligible and tied with an alphabetically earlier ancestor returns head. Head ancestor with a null count falls to the nearest ancestor. Head absent from the fetched refs falls to the nearest ancestor. No ranked ancestor keeps the old symbolic-HEAD then GitHub fallback. A configured default only gets priority when it is an eligible ancestor.
- **Tests**: the new `base:` tests assert both JSON `base` and the fake `gh pr create --base`, and that no `fetch` and no `repo view` ran. They cover tied, closer, older Git, failed default comparison, shipped, custom and alphabetical tie order, a closer feature ancestor against a diverged default, and an older-Git per-ancestor failure. I ran the new test file against the pre-change `open-pr.mjs` in a scratch copy: 8 of the 14 `base:` tests fail there (both reported scenarios among them) and the 6 existing ones pass. The remaining new test, alphabetical fallback, passes on the old selector by design because the old rule was already alphabetical.
- **Docs**: the `docs/REFERENCE.md` base bullet, ADR-017 step 2, the Assumptions line and the closing sentence of Amendment 3 state the new rule. A grep of README, docs, both `SKILL.md` files, prompts and rules found no remaining description of the old nearest-ancestor-only rule (lesson: grep every doc for the old behavior).

## Success criteria

- `node --test --test-name-pattern='base:' skills/10x-pipeline/test/open-pr.test.mjs`: 14 of 14 pass.
- `node --test skills/10x-pipeline/test/open-pr.test.mjs`: 79 of 79 pass.
- Full suite: the coordinator told this step not to run it (CI is the gate). Two local attempts before that instruction were not conclusive: the machine ran several other suites at once, and many test files, `open-pr.test.mjs` included, aborted at file level with `Promise resolution is still pending but the event loop has already resolved`, an abort the isolated run of the same file does not show. The diff touches no file those tests cover other than `open-pr.mjs`, so this review treats the full suite as owed to CI.
- `git diff --check`: clean.
- Progress rows 1.1 to 1.3 are `[x]` with commit `c90d5d55`. The plan has no Manual rows.

## Findings

None.
