---
change_id: step-commit-code-under-chore
title: Stop shipping implemented code in chore step commits
status: implemented
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: high.

### Problem

In an isolated run the router commits everything the worktree holds after a verified step (`stepCommit` and `routerCommit` in `skills/10x-pipeline/scripts/isolation.mjs`, `git add -A`) under `isolation.commit.message`, which is `chore({id}): step {n} {step}` (`skills/10x-pipeline/policy.json:125`). When the implement subagent leaves its code uncommitted, the source and test files land in that `chore` commit. A plain `implement` step is verified by its ticked rows and needs no code commit behind them; only the tdd and e2e executors require one.

The owner rebase-merges, so these subjects land on `main`. release-please reads the type: `chore` is a hidden section, so the change gets no changelog line, and a run whose commits are all `chore` or `docs` opens no release PR although it changed router code.

### Evidence (verified on main, 2026-11-12)

- 16 of the 31 step commits of `implement`, `fix` and `os-apply` steps hold paths outside the change folder. Example: `65e5f0f chore(at-or-above-helper): step 3 implement` changes `scripts/preplan.mjs`, `scripts/state.mjs`, `scripts/steps.mjs` and adds `test/at-or-above.test.mjs`.
- Four runs reached `main` with `chore` subjects only: `at-or-above-helper`, `review-verdict-labels`, `archive-manual-gate`, `openspec-project-rules`. Six more have only `chore` and `docs` under their scope (`archive-done-routercommit`, `array-prompt-override`, `budget-halt-after-done`, `init-goal-flag`, `init-needs-change-md`, `override-json-error-halt`).
- The Progress rows of `context/changes/at-or-above-helper/plan.md` are ticked without a commit SHA.
- `prompts.suffix` says "Do not commit unless the skill itself commits." `/10x-goal-implement` is described as committing each phase, yet these runs show no such commit. Why the subagent skipped it is not established (research item).

### Fix direction

1. Prompt side: the `implement`, `implement-segment`, `implement-retry` and `os-apply` templates get one rule: commit the code of each phase before the `RESULT:` line, with a Conventional Commits subject whose type matches the work (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`) and the change id as scope. The `fix` template already asks for this. Reword the suffix sentence so it does not contradict the rule.
2. Router side, as the safety net: when the step commit of an implement-class step would stage paths outside the change folder, do not hide them. Either commit them first under a subject built from a validated `signals.commit` of the `RESULT:` line (`{ "type": "...", "subject": "..." }`, type from the list of `tools/commit-lint.mjs`), or keep today's commit and record the swept paths on the log entry and in a `## Code committed by the router` section of `report.md`. The plan picks one; the second is the smaller change.
3. `open-pr.mjs` commits leftovers as `chore(<id>): final run state` with `git add -A`; apply the same rule there or name the paths in its JSON output.

### Tests

- `stepcommit.test.mjs`: an implement step that leaves a source file uncommitted; assert the commit subject or the recorded paths.
- `rules.test.mjs` covers the new prompt rules; `nested-subagents.test.mjs` pins the implement templates, so update its expected text.
- `node tools/commit-lint.mjs` accepts every subject the router can now write.

### Done when

A run that changes files outside its change folder leaves at least one non-`chore` commit that holds them, or its report names every path the router committed under `chore`.
