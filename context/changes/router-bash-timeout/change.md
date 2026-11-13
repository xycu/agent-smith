---
change_id: router-bash-timeout
title: Run router and open-pr calls with a Bash timeout above the git timeouts
status: impl_reviewed
created: 2026-11-12
updated: 2026-11-13
archived_at: null
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 3, "Should fix".

### Problem

Both orchestrator skills (`skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`) call `route.mjs` and `open-pr.mjs` through the Bash tool and set no `timeout`. The Bash tool's default is 120000 ms. The router's own git timeouts are the same value: `isolation.gitTimeoutMs` and `archive.gitTimeoutMs` in `policy.json` are both 120000, and each one applies per git call. One router call makes several git calls: the safety reads, `git add`, `git commit` (which runs the project's hooks), and the post-commit checks. `open-pr.mjs` uses `GIT_TIMEOUT_MS = 120000` for its push.

So the Bash tool always fires first. Take a project whose pre-commit hook runs for about 110 s (lint-staged plus a test suite). The safety reads take a few seconds, then the hook runs, and the Bash tool kills `route.mjs` inside `git commit` before the router's own timeout can unstage its add (`routerCommit`'s `failed` path). Afterwards:

- the index still holds the router's `git add -A` (or `git add -- <change folder>`);
- the hook child may still run and may still finish the commit;
- the run lock stays behind with a dead pid. It is removed on the next call, so that part is harmless;
- the next `next` halts in `gitSafety` with `The index holds staged changes: ... Commit or unstage them first.`, which does not say why.

The same applies to the start commit of `init`, the pre-archive commit in `archiveDone`, the late-usage commit of `usage` in the archive state, and the push of `open-pr.mjs`.

### Fix direction

- Add one line to both SKILL.md files that tells the orchestrator to run every `route.mjs` and `open-pr.mjs` call (and `pr-comment.mjs`) with the Bash tool's `timeout: 600000`, the tool's maximum. Put it in the setup or Loop text, outside the `## Anti-stall rules` section: `skill-loop.test.mjs`, `openspec-skill.test.mjs` and `nested-subagents.test.mjs` pin that section, and the two copies must stay equal.
- The AGENTS.md hard rule allows this: SKILL.md must not name models, effort levels or tiers, and a timeout is none of them.
- Open question for the plan: should the shipped `gitTimeoutMs` values stay at 120000? With a 600000 ms Bash limit, one slow hook still fits, but a call that makes several slow git calls might not. One option is to document in `docs/REFERENCE.md` that the Bash limit must exceed the git timeouts, and to name the override keys a project with slow hooks should set.
- Optional, if cheap: let the staged-index halt of `gitSafety` mention that an interrupted router call can leave the router's own add staged, and how to check it (`git diff --cached --name-only`).

### Tests

- Content tests in `skill-loop.test.mjs` and `openspec-skill.test.mjs`: both skills carry the timeout line, it lies outside the anti-stall section, and the anti-stall sections still match.
- Run the full suite.

### Done when

Both skills tell the orchestrator to run router and PR-script calls with a Bash timeout above the router's git timeouts, a test pins that line, and `docs/REFERENCE.md` states how the Bash limit relates to `gitTimeoutMs`.
