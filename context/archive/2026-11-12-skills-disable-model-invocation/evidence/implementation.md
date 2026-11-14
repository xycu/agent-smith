# Implementation verification

Verified on 2026-11-14 in the change worktree. Node.js checks reported v24.19.0 at preflight and v26.13.1 during full-suite verification. Both meet the repository's Node 24+ requirement.

## Automated proof

- Existing focused baseline passed all 49 tests with zero skips.
- New contract assertions produced five expected failures before the invocation controls and guidance were changed.
- Focused content tests passed all 53 tests with zero skips using `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- All 16 deliberate breaks failed specifically at the invocation assertion through `SKILL_PATH` or `OPENSPEC_SKILL_PATH`. Copies were removed individually after each run. The shipped skills retained their staged bytes throughout verification.
- `node tools/version-check.mjs` passed at 1.10.1.
- Full suite passed with 1,425 tests, 1,422 passes, zero failures and three skips using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. TAP reporting was enabled to capture the results.
- Binary comparisons against the pre-implementation Git versions confirmed identical skill bodies and other frontmatter fields. JSON comparisons confirmed identical manifest fields outside the two plugin descriptions. The diff stays within the seven owned files and change-local artifacts. Protected paths have no edits. `git diff --check` passed.

## Deliberate-break results

- 10x-pipeline missing rejected by invocation assertion.
- 10x-pipeline false rejected by invocation assertion.
- 10x-pipeline quoted rejected by invocation assertion.
- 10x-pipeline body-only rejected by invocation assertion.
- 10x-pipeline duplicate-true rejected by invocation assertion.
- 10x-pipeline true-false rejected by invocation assertion.
- 10x-pipeline false-true rejected by invocation assertion.
- 10x-pipeline user-invocable-false rejected by invocation assertion.
- openspec-pipeline missing rejected by invocation assertion.
- openspec-pipeline false rejected by invocation assertion.
- openspec-pipeline quoted rejected by invocation assertion.
- openspec-pipeline body-only rejected by invocation assertion.
- openspec-pipeline duplicate-true rejected by invocation assertion.
- openspec-pipeline true-false rejected by invocation assertion.
- openspec-pipeline false-true rejected by invocation assertion.
- openspec-pipeline user-invocable-false rejected by invocation assertion.

## Full-suite skips

- `live: a branch with no pull request is skipped` requires opt-in `GH_LIVE=1`, network access and authenticated `gh`. Repository instructions reserve these live tests for a human.
- `live: the real comment projection is one parseable object per line across pages` has the same opt-in and authenticated-network requirement.
- `CLAUDE.md has no @ imports` is skipped because the optional CLAUDE.md file is absent. The corresponding AGENTS.md check passed.

## Execution corrections

The first full run finished with 1,418 passes, four failures and three skips. Worktree-local scratch fixtures discovered the parent Git repository, causing failures in `entry records before state`, `mixed plan segments` and `extra steps pool`. A temporary invalid Git-directory pointer at the scratch root stopped parent discovery while allowing fixture-owned repositories. All three affected cases passed directly, followed by the clean full-suite retry. The temporary pointer and empty scratch directory were removed after verification.

The first run also timed out waiting for the fake child's termination marker in `10x: handled cancellation waits for child close and removes raw files`. Both chains' cancellation cases passed in a scoped rerun and in the full-suite retry.

## Decisions and assumptions

- Native Claude Code frontmatter owns invocation gating, as established by the approved plan's official sources. Compatibility guidance uses that documented contract. [Invocation control](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- Implementation and fixes ran directly under the task's nested-delegation restriction.
- The roadmap has no matching Change ID.
- The pre-existing router-owned `agent-smith/run.jsonl` modification is excluded from the implementation commits.
- The epilogue uses a docs subject under the task's permitted commit types.

## Pending manual verification

- [ ] 1.6 In fresh Claude Code sessions using the updated plugin, both explicit slash commands reach their first router-selected run step, and a fresh plain-language request such as `pipeline this change` leaves both pipeline skills uninvoked, with the Claude Code version and observed transcript recorded.

Minimum-version live behavior and full headless pipeline completion remain unverified, as recorded in the README guidance.
