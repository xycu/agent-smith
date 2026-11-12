---
change_id: step-subagent-git-guard
title: Stop step subagents from running banned git, delete and push commands
status: new
created: 2026-11-13
updated: 2026-11-13
archived_at: null
---

## Notes

**Origin.** Three Hard Rule breaches by step subagents in the Wave 2 runs, found while reporting each run. None damaged the repository, but each used a command or action that AGENTS.md bans for code, skills and prompts. The question is how to stop a step subagent from doing it again.

**The three breaches.**
1. Run `plan-crlf-line-endings`, step `manual-verify`: the subagent used `find ... -delete` to clean a scratch directory outside the repository. That is a recursive delete, banned by Hard Rules and by the `prompts.suffix` text in `policy.json`. The suffix already forbids it, so the rule was in the prompt and was not followed.
2. Run `finished-changes-left-open`, step `plan-review`: the subagent ran `git checkout -- change.md` to throw away its own edit. That is on the banned list ("discard uncommitted work that no commit or ref holds"). Here it was the subagent's own edit, so nothing was lost, but the same command on another file could lose the only copy of someone's work.
3. Run `skill-dir-variable`, step 6 `implement`: the subagent pushed `agent-smith/skill-dir-variable` and opened PR #140 itself, to satisfy plan row 3.4 ("CI is green on the PR"). Only `skills/10x-pipeline/scripts/open-pr.mjs` may push the run branch and open its pull request (ADR-017). The end-of-run script kept the PR, so there was no damage, but the row could not be met before the PR step and it cost two extra implement attempts.

**What the prompts say today.** From `skills/10x-pipeline/policy.json` (`prompts.suffix`) and the files under `skills/10x-pipeline/prompts/`:
- The shared suffix, appended to every step prompt, bans recursive deletes (including `find ... -delete`) and nested subagents. It has no git rule.
- `manual-verify.md` allows only read-only git commands.
- `os-archive.md` bans `--no-verify`, amend, push and git settings changes.
- No other step prompt (`plan`, `plan-review`, `implement`, `impl-review` and their fix and confirm variants) forbids `git checkout -- <path>`, `git reset --hard`, `git clean`, `git stash drop` or `clear`, `--no-verify`, a force push, a plain `git push` or `gh pr create`. The Hard Rules live in AGENTS.md, and the prompt the router builds does not repeat them.

**Two causes, so two parts.**
- Part A, the prompt gap: breaches 2 and 3 happened where no prompt said no. Breach 1 happened where a prompt did say no, so adding text will not stop every case.
- Part B, a plan that cannot be met: row 3.4 asked for a result that exists only after `open-pr.mjs` has run. The planning side should not write an Automated row that needs a pushed branch or an open PR. Such a check belongs in the Manual rows, which the human ticks after the run.

**Options to weigh in the plan (nothing is decided).**
1. Add rules in the existing GIVEN/WHEN/THEN form to `prompts.suffix` (or to a new prompt file that `policy.json` wires in): the banned git commands of the Hard Rules, no push, no `gh`, and the pull request is opened only by the orchestrator through `open-pr.mjs`. Trade-off: the suffix goes into every step prompt, so every step pays the tokens.
2. Add a planning rule and a plan-review check: no Automated row may depend on a pushed branch, an open PR or a CI run of the PR.
3. Research a guard that does not rely on the model reading a rule, for example a plugin hook that blocks these commands for step subagents. Check first whether a hook can tell a step subagent from the orchestrator. If it cannot, drop this option.
4. A router-side check after each step that the remote refs did not move. The router never pushes and never calls `gh` (AGENTS.md), so this would be read-only. Probably too heavy; say so in the plan if you drop it.

**Constraints.**
- Every prompt keeps the rule form that `skills/10x-pipeline/test/rules.test.mjs` checks.
- `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.
- A prompt or `policy.json` change moves the run provenance hash, so the provenance tests and the `compare` warnings apply (`skills/10x-pipeline/test/provenance.test.mjs`).
- Add a content test in the style of `no-recursive-delete.test.mjs` and `nested-subagents.test.mjs` that pins the new rules to the place they live, so a later edit cannot drop them.
- Update `skills/10x-pipeline/prompts/README.md` and `docs/REFERENCE.md`. An ADR amendment is likely, because ADR-016 (deletes) and ADR-017 (the PR) are the decisions being enforced.
- Never edit `context/archive/`.

**Done when.**
- Every step prompt the router builds carries a rule against each banned git command and against pushing or opening a PR, or the plan records why a prompt is exempt.
- A test fails if one of those rules is removed from its prompt.
- The planning prompt or the plan review rejects an Automated row that needs a pushed branch or an open PR.
- The plan states which of the options above it took and which it dropped, with the reason.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.
