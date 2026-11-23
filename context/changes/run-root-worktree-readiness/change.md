---
change_id: run-root-worktree-readiness
title: Make a fresh run-root worktree ready for the project's gates before step 1
status: impl_reviewed
created: 2026-11-21
updated: 2026-11-22
archived_at: null
---

## Notes

**Origin.** [Issue #244](https://github.com/xycu/agent-smith/issues/244), seen across seven runs of one project.

**The defect.** A fresh run-root worktree cannot run the project's own gates:

- `node_modules` was empty, or held only symlinks into the main checkout. Vite refused to serve files outside its allow list, and `deliberate-break.mjs` failed its baseline because `vitest` was missing. Step agents improvised temporary symlinks; one paid-eval row stayed unproven because no install was possible.
- The worktree was cut from a stale base, one of them 38 commits behind `origin/main`. Research cited files that did not exist in the worktree, a migration timestamp had to be renamed after merging `origin/main`, and agents read files from the main checkout.
- Several worktrees shared one local database stack. One run reset it to its own migrations and broke another run's tests.

**Expected (from the issue).** Before step 1, `prepare-run` (or a new preparation step):

1. Fetches the base and reports how far it is behind the integration branch; offers to rebase or stops.
2. Installs dependencies inside the worktree from the project's lockfile with the detected package manager, or fails with the exact command to run. Symlinks to another checkout are not accepted.
3. Runs a project-defined readiness command when one is configured (for example `readiness: "npm run wave:preflight"` in `context/foundation/agent-smith-policy.json`) and stops the run, naming the failed check, when it exits non-zero.

The readiness hook keeps project-specific knowledge out of the plugin. The shared database stack is a project concern that the readiness command can check.

**Constraints.** No npm dependencies (ADR-006). The fetch follows the git rules in `AGENTS.md` and ADR-010: no force, no history rewrite, no `.git/config` writes. Network and install failures must leave a retryable state, which `prepare-run-retry-after-failed-setup` establishes first.

**Schedule.** `context/changes/WAVES.md`: Wave 4, Setup lane, after `prepare-run-retry-after-failed-setup`. It feeds S-15 `actionable-run-prerequisites`.
