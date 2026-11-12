---
change_id: worktree-setup-script
title: Move run isolation setup from skill prose into a script
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium (refactor).

### Problem

Start step 3 of both orchestrator skills describes the worktree setup in prose: an opt-out check, a check for an existing run worktree, four cases in a fixed order, `git check-ignore`, an append to `info/exclude`, a listing of uncommitted paths, `git worktree add -b`, `mkdir -p` and `cp -Rp`. The orchestrator, a language model, reads this and runs about ten conditional git commands.

- A slip is destructive. The text itself warns: "A resume never copies: the change folder in the main checkout is older than the run's state on the run branch and would overwrite it." Taking case 2 instead of case 3 does exactly that.
- The logic exists twice, in `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`, and differs only in the folder (`context/changes` or `openspec/changes`).
- No test can run it. The suite only checks that the words are present.
- It costs about 5 KB of context in each skill.

The repository already moved the other end of a run into code for the same reasons: `open-pr.mjs` (ADR-017) replaced prose about committing, pushing and opening the pull request.

### Fix direction

- A standalone `skills/10x-pipeline/scripts/prepare-run.mjs <id> [--chain 10x|openspec]`. Built-ins only, no router module, like `open-pr.mjs`. It prints one JSON object and exits 0 for every runtime outcome, 2 for a usage error:
  `{ root, runRoot, worktree, branch, case, copied, excludeAdded, notInRun, left }`, with `case` one of `opt-out`, `in-run-worktree`, `in-flight-main`, `created`, `reused`, `attached`.
- It keeps today's behavior case by case, including the local exclude line and the list of paths that are not in the run. It never deletes a branch, a worktree or a ref, never forces, and never writes git config.
- It reads `isolation.require` from the project override the way `open-pr.mjs` reads `coAuthor`, with a parity test against the router's merge.
- It is the place for the cleanup of `stale-main-change-copy`.
- Skills: step 3 becomes "run the script, keep `root` and `runRoot`, print `notInRun`". The rules about never committing or resetting the worktree stay in the skill.
- Record the decision as an amendment of ADR-010 or a new ADR, and list the script in `AGENTS.md`.

### Tests

A new test file with real linked worktrees and hermetic git, as `isolation.test.mjs` builds them: each case; a resume never copies; a project in a subdirectory (`--show-prefix`); file times kept by the copy; no git config write; the guard test that no router module pushes or calls `gh` extended to this script's allowed commands.

### Done when

Neither skill contains a `git worktree`, `cp` or `info/exclude` command, and every setup case is covered by a test that runs the real script.
