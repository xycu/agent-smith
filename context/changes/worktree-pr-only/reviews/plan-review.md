<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Worktree Pull-Request-Only Runs Implementation Plan

- **Plan**: context/changes/worktree-pr-only/plan.md
- **Mode**: Deep (sub-agent step skipped; claims checked directly against the code, skills and tests)
- **Date**: 2026-11-09
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths and line claims checked (pr-comment.mjs runGh/findPullRequest, both SKILL.md files, skill-loop, openspec-skill and agents tests, ADR-002/003/010 lines, prompts/manual-verify.md:23, prompts/os-archive.md:14) ✓, Progress↔Phase consistency ✓ (3 phases, 14 rows, titles match, no checkboxes in phase bodies), brief↔plan ✓. Lesson priors applied (check live and archived folders of both chains: the script reads no router file). The ADR number gap (014 to 016) is F9.

## Findings

### F1 — Plan keeps an exception to "no exceptions"

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: What We're NOT Doing (third bullet); Desired End State; Phase 3 ADR-017
- **Detail**: change.md says all work happens in worktrees and is pushed for human review on PRs, "no exceptions". The plan keeps `isolation.require: false`: a project that opts out gets a loud `NOT pushed` line and no PR. That is a documented, reasoned deviation, but it is a deviation from the owner's goal, and the plan only lists the decision as an open item in ADR-017.
- **Fix A**: Keep the opt-out for now and record it as an open owner decision in ADR-017 (already planned).
  - Strength: no breaking change for projects without git.
  - Tradeoff: the goal is met only for isolated runs.
  - Confidence: HIGH — consistent with ADR-010 and the plan's own scope.
  - Blind spot: whether the owner reads "no exceptions" as covering the opt-out.
- **Fix B**: Remove the opt-out in this change (init halts without a worktree, no git means no pipeline).
  - Strength: literal reading of the goal.
  - Tradeoff: breaking change (`feat!`) for projects without git; touches router and policy, which the plan keeps out of scope.
  - Confidence: MED — blast radius not surveyed.
  - Blind spot: tests that rely on `isolation: { require: false }`.
- **Decision**: ACCEPTED — owner: keep opt-out (Fix A); ADR-017 records it as the only exception.

### F2 — Base branch is the default branch even when the run was branched from a feature branch

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1, step 2 (Base)
- **Detail**: The skill creates the worktree with `git worktree add -b agent-smith/<id>` from whatever HEAD the main checkout has. When that is an unmerged feature branch, a base of `origin/HEAD` counts the feature branch's commits as "ahead", pushes them, and puts them in the PR. The plan's own assumption ("default branch as the base") hides this.
- **Fix**: Choose the nearest remote branch the run descends from (excluding `<remote>/HEAD`, the run branch's own remote ref and `agent-smith/*` refs; fewest commits ahead; tie to the default branch), then default branch, then `gh repo view`; add tests for feature-branch, `main` and second-run cases.
  - Strength: read-only, deterministic, no state to persist across resumes.
  - Tradeoff: a heuristic; `--base` overrides it.
  - Confidence: MED — not run against a repo with many remote branches.
  - Blind spot: a feature branch that exists only locally is not a remote ref and falls back to the default branch.
- **Decision**: APPLIED — Phase 1, change 1, step 2 (Base) rewritten; Tests contract and plan-brief "Assumed" line updated.

### F3 — Archive branch: report path, step numbering and comment order are unspecified

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 1 (the 10x skill) and change 3 (skill tests)
- **Detail**: The plan moves the PR comment behind the PR step in `archive` but does not say which report path each script gets after the move, what happens on `archived: false`, or how the new text avoids renumbering `archive` step 4, which `openspec-skill.test.mjs` pins with `\n {2}4\. Write no result file and do not call \`next\``. An implementer would have to guess, and the pinned test would fail on a renumbering.
- **Fix**: Make the PR step a sub-bullet of step 5, remove the old comment text from step 1 and the "before the archive step" bullet, pass `--report "<archivePath>/agent-smith/report.md"` on `archived: true` and the default path on `archived: false`, and add the numbering to the skill-test contract.
- **Decision**: APPLIED — Phase 2, change 1 (Contract) and change 3 (Contract) edited.

### F4 — "Uncommitted report" note is dropped for every case

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 1 (final-message text of Start step 3)
- **Detail**: The note that `report.md`, `run.jsonl` and `meta.json` are uncommitted is still true when the script reports `committed: false`, skips, or prints no JSON.
- **Fix**: Keep the note for those cases only.
- **Decision**: APPLIED — Phase 2, change 1 (Contract), Start step 3 sentence.

### F5 — ADR-017 contract refers to assumptions that the plan never lists

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, change 1 (ADR-017 Contract)
- **Detail**: "Records the assumptions below" points at nothing. Real assumptions exist: one `github.com` remote, unverified live `gh` behavior, the PR carrying the goal text to a possibly public repo with no opt-in, and `git add -A` pushing every non-ignored file including `evidence/` (the step commits stayed local before; the push makes a leaked secret hard to undo).
- **Fix**: List them in the contract.
- **Decision**: APPLIED — Phase 3, change 1 (ADR-017 Contract) now lists the assumptions.

### F6 — Leftover commit changes what a later rollback does

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details, Timing; Phase 1 tests
- **Detail**: Partial edits kept after a halt were uncommitted, so a rollback of a later retry (`reset --hard <startSha>`) discarded them. Once committed and pushed they stay. The rollback still never rewrites pushed history, because `startSha` is at or after the pushed head.
- **Fix**: State both consequences in the plan and ADR-017, and add `--amend` and `rebase` to the forbidden-argument guard.
- **Decision**: APPLIED — Critical Implementation Details (Timing), Phase 1 Tests contract and ADR-017 assumptions.

### F7 — `gh` may have to pick a repository among several remotes

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1, step 5 (PR)
- **Detail**: `gh pr list` and `gh pr create` resolve the base repository from the remotes and can ask for a choice, which fails without a terminal. The push uses `--remote`, so the PR calls should address the same repository.
- **Fix**: Pass `--repo <owner>/<repo>` parsed from `git remote get-url <remote>`; a non-`github.com` or unparseable url is a PR skip.
- **Decision**: APPLIED — Phase 1, change 1, step 5; Tests contract.

### F8 — The way git calls are recorded is not stated

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 3 (Tests Intent)
- **Detail**: The forbidden-flag guard needs a log of real git calls, but the plan uses real git with a bare remote and says nothing about how arguments are captured.
- **Fix**: A `git` shim first on `PATH` that logs argv and runs the real git.
- **Decision**: APPLIED — Phase 1, change 3 (Intent).

### F9 — ADR-017 skips ADR-014 to ADR-016

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, change 1; Progress titles
- **Detail**: `docs/ADR/` ends at ADR-013 and no document in the repository reserves 014 to 016. The number appears in Progress row titles, which the review must not change.
- **Fix**: Either renumber to the next free number or state why 014 to 016 are skipped.
- **Decision**: ACCEPTED — owner: ADR-014 to ADR-016 reserved by parallel changes.
