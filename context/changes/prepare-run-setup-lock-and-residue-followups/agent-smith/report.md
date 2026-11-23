# Run report: prepare-run-setup-lock-and-residue-followups

Goal: Implement the reviewed plan in context/changes/prepare-run-setup-lock-and-residue-followups/plan.md: F2 (opt-out and pre-selection check must not take the setup lock) and F3 (temp-to-pending rename residue), in prepare-run.mjs and its tests
Rigor: standard (goal plain, hot paths skills/10x-pipeline/scripts/prepare-run.mjs, skills/10x-pipeline/test/prepare-run.test.mjs)
Provider mode: codex
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (ae2985d) | 2660321 |
| 2 | implement | openai | gpt-6.2-astra | medium | 4 | no | ok (cbbf15d) | 4323962 |
| 3 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (4ee113b) | 1483095 |
| 4 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (c3d3bd3) | 460517 |
| 5 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (df89daa) | 7516735 |

Steps: 5 · Tokens: 16444630 (figures for 5 of 5 steps)

## Token coverage

Verified observed host usage: 5 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 1 plan-review: REVISE, 0 critical, 5 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: NEEDS ATTENTION, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 5

- 1.3 Frame F2 repro: in a scratch repo, a linked worktree with `isolation.require: false` and a stale `agent-smith-setup-agent-smith%2Fdemo.lock` returns `case: "opt-out"`, the lock file is unchanged — test (evidence/test-f2-stale-lock.txt)
- 1.4 Frame F3 repro: SIGKILL at the temp-to-pending rename, then remove the lock and rerun setup; setup succeeds and no `.tmp` remains in the Git common directory — test (evidence/test-f3-first-publication.txt)
- 2.3 Each new F2/F3 test fails when its matching change in a scratch copy of `prepare-run.mjs` is reverted — script (evidence/script-regression-reverts.txt)
- 2.4 `grep -rniE "setup lock|\.pending" docs README.md skills --include=*.md` shows no remaining text that says the opt-out or pre-selection check takes the lock, or that names the UUID temp as current behavior — command (evidence/command-setup-doc-search.txt)
- 2.5 The ADR-010 Amendment 8 text and the `REFERENCE.md` bullets read correctly against the code — judgment (evidence/judgment-setup-docs.md)

Not proved: 1

- 2.2 The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` — not proved: The plan calls for full-suite CI after publication. The GitHub Actions API returned zero runs for both the run head (4ee113b7) and the Phase 2 verification commit (aeff5382). Publication is prohibited

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always use a no-follow, nonblocking open for lock-free regular-file reads, and validate the opened descriptor before reading it.` (step 5)
