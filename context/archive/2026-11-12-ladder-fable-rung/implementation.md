# Implementation verification

## Delivered scope

- Phase 1 committed as `4132c20`, publishing the canonical opt-in policy, resolved-model compatibility guidance and illustrative blended pricing.
- Phase 2 extends `skills/10x-pipeline/test/ladder.test.mjs` with six regression cases that consume the published JSON. The existing ladder assertions are byte-identical.
- The path audit permits only README.md, docs/REFERENCE.md, ladder.test.mjs and this change's tracking artifacts. The router-owned run log had pre-existing changes and is outside the implementation commits.

## Automated evidence

- Exact JSON assertions passed for the original eight rungs, two appended rungs and four selected ceiling overrides. README/reference consistency assertions passed.
- All six new cases passed, covering effective policy merge, Claude dispatch, Codex refusal before state creation, RETHINK revision limits, selected and unselected clamps, effort floors, baseline identity and fable cost coverage.
- The focused ladder, providers, cost, budget-executors and loops-existing command passed 77 tests with zero failures or skips on Node v26.13.1.
- The deliberate-break check replaced fable dispatch with opus in `dispatchTarget`. The pure routing regression failed on that broken behavior. A saved byte snapshot restored state.mjs unconditionally, and its Git diff is empty.
- The repository-required full command passed 1,427 tests in total, with 1,424 passing, zero failures and three expected skips. Both chains and tools/test were included, with concurrency 2 and scratch-local TMPDIR. All six new fable cases passed in this run. The skips were the two GH_LIVE opt-in GitHub checks and the CLAUDE.md import check, whose file is absent.
- Final whitespace and path/region audits passed. No roadmap item has this Change ID.

## Environment correction and adaptations

The first full invocation used a TMPDIR inside this worktree whose fixtures could discover the parent repository. It completed 1,421 tests with 13 failures and three skips. A direct Git probe confirmed parent discovery. A scratch-local `.git` file pointing to an absent scratch-local directory stops discovery, while fixtures that initialize their own repositories still work. Three representative executor failures passed after this correction. The corrected full rerun also includes the six new regressions.

The CLI action exposes provider, model and effort. The run log additionally exposes tier. Assertions follow those existing boundaries. A revision-limit halt uses exit status zero, as the existing CLI implementation specifies. Both adaptations preserve the plan's routing outcomes.

Compatibility statements reuse the reviewed evidence dated 2026-11-14 in plan.md and reviews/plan-review.md. The example's rate 12 remains illustrative. [Model configuration](https://code.claude.com/docs/en/model-config) · [Subagents](https://code.claude.com/docs/en/sub-agents)

## Pending manual verification

- 2.4 On a compatible Claude host, record version, exposed Agent model/effort support and successful foreground fable high/xhigh invocations; verify an older host without the opt-in continues to use the default ladder.

Live model execution requires the host evidence specified by the plan. The Manual row remains pending.
