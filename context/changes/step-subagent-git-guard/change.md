---
change_id: step-subagent-git-guard
title: Stop step subagents from running banned git, delete and push commands
status: impl_reviewed
created: 2026-11-13
updated: 2026-11-15
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

## Implementation report

Three phases completed on 2026-11-15.

| Phase | Commit | Gates |
| --- | --- | --- |
| Shared safety and planning rules | `e513e93` | focused rule/carrier/transport checks and complete suite passed, with 1549 passing tests and three skips |
| Scoped Claude guard and dispatch compatibility | `afdd5cb` | hook, provider, replay and provenance checks, strict plugin validation and complete suite passed, with 1569 passing tests and three skips |
| Documentation and integration acceptance | `f59e3cd` | 139 focused contracts, 27 documentation guard checks, ownership/index assertions and complete suite passed, with 1569 passing tests and three skips |

The final complete command was `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, with worktree-local TMPDIR and the Git-discovery barrier described in the plan. It ran 1572 tests, with 1569 passing, zero failures and three skips. The skipped checks were the two opt-in live GitHub tests and the CLAUDE.md import check for an absent file. Node 26.13.1 met the Node 24+ gate. Both `claude plugin validate . --strict` and manifest-specific strict validation passed on Claude Code 2.1.311, with the existing missing-icon directory warning. Version consistency and Conventional Commit checks passed.

Deliberate-break checks detected a removed shared Git prohibition, removed push denial, relaxed hook failure handling and an added hook filesystem dependency. Temporary mutations were restored. Hook mutations used scratch plugin copies. The denied staged-restore fixture preserved distinct HEAD, index and working-copy versions and reached no recording executable. Safe typed/archive commits and orchestrator publication-script calls reached the recording clients.

### Adaptations and decisions

- Updated existing route, pre-plan and score prompt expectations for the planning step tail, including the discovered `plan-revise` variant.
- The legacy no-gh source scan treated the standalone classifier literal as execution. Router assertions still cover their existing scripts, with the standalone hook independently checked for execution, filesystem, network and routing dependencies.
- Diff review caught two temporary ADR writes that reused the preceding record. Original ADR-017 and ADR-024 bytes were restored before their intended amendments. Heading/filename identity and exact original-prefix assertions passed.
- Stage-only restore is conservatively denied under applied plan-review finding F1 and the Phase 2 contract. Progress row 2.2 retains its reviewed title.
- Implemented the plan’s A1–A7 decisions through existing rule, dispatch and provenance owners. Current shared-skill forwarding, provider dispatch, anti-stall equivalence and terminal publication contracts passed. Available quoted-router changes were already in the run history.
- The roadmap lookup found no matching Change ID. Router-owned run.jsonl was pre-existing dirty. That path and the unrelated root .DS_Store were excluded from phase staging.

### Pending Manual verification

- 2.6 A fresh supported Claude host reports the dedicated agent identity in PreToolUse for both chains, blocks inert attempted breach commands before fake executables run, permits typed/archive commits, and allows the orchestrator's recording publication-script calls.
  Requires fresh supported Claude host transcripts and fake executable logs for both chains. The flat-delegation instruction prevents launching that live probe from this step.
- 2.7 A live planning/review probe moves a PR-CI-dependent Automated criterion to Manual while retaining a valid local fake-client test criterion and the original Progress identities.
  Requires a live planning/review adherence probe. Prompt-delivery regressions passed.
- 3.4 On the resulting run PR after orchestrator publication, a human records PR CI acceptance and reviews any live host checks still pending.
  Requires post-publication PR CI acceptance and human review of any pending host checks.

The runtime hook covers the documented direct Bash-command subset. Semantic safety rules and host controls govern helper/interpreter internals, dynamic shell construction, MCP/API actions, custom agents and OpenAI children.
