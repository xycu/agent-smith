<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Worktree Pull-Request-Only Runs

- **Plan**: context/changes/worktree-pr-only/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria run during the review: 1.1 and 1.2 (`node --test` of `open-pr.test.mjs` and `pr-comment.test.mjs`) pass; 1.3 prints the usage error with exit 2 and one JSON skip with exit 0; 1.4, 2.2 and 3.1 (whole suite) pass; 3.2 finds `ADR-017` in `AGENTS.md`, `README.md` and `docs/REFERENCE.md`; 3.3 `commit-lint: OK (main..HEAD)`; 3.4 `version-check: OK (1.1.1)`. Manual 2.3 is ticked with `evidence/judgment-2-3-skills-pr-step-order.md`; 1.5, 2.4 and 3.5 are pending, with reasons in `evidence/unproven.md` (1.5 and 2.4 need a live GitHub push, 3.5 asks for wording the ADR no longer has, see F4).

Drift check: every planned file is in the diff (`open-pr.mjs`, `pr-comment.mjs --pr`, both test files, both skills and their tests, ADR-017, `AGENTS.md`, `README.md`, `docs/REFERENCE.md`); no router module, `policy.json` or prompt changed; the only unplanned files are the change folder's own artifacts. The script never runs a merge, review, delete or force operation, and the guard tests pin that.

## Findings

### F1 — `manual` is null on two `pushed: false` outcomes, so the loud line prints "null"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:362-365, 396-397
- **Detail**: Both skills print `Pull request: NOT pushed, <reason>. Branch agent-smith/<id> is local only: <manual>` whenever `pushed` is `false`. Every skip of the script sets `manual` except two: "no commits on the run branch" (`ahead.count === 0`, the halt-at-init case) and the internal-error catch in `main()`. Both returned `manual: null`, so the orchestrator would print the literal `local only: null` in the one line meant to tell the human what to do.
- **Fix**: Set `manual` on both outcomes (`nothing to push: no commit beyond <base>`, and `run the script by hand from the run root`, the same text the skills use for a script error) and pin it in the no-commits test.
- **Decision**: APPLIED — commit 8efbfc1

### F2 — The base search spawns two git processes per remote branch

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:177-191
- **Detail**: `nearestBase` runs `merge-base --is-ancestor` and `rev-list --count` for every `refs/remotes/<remote>/*` ref. A repository with thousands of remote branches pays thousands of spawns at every run end (seconds, not a hang, each bounded by the 120 s git timeout). `git for-each-ref --merged HEAD refs/remotes/<remote>/` would filter the ancestors in one call.
- **Fix**: Filter candidates with `for-each-ref --merged HEAD` and count only those.
- **Decision**: PENDING — performance only, no wrong result; the owner decides whether it is worth changing before a repository with many remote branches uses it.

### F3 — After a failed archive the leftover commit records a half-archived tree

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/open-pr.mjs:217-232; skills/10x-pipeline/SKILL.md (archive step 5), skills/openspec-pipeline/SKILL.md (archive step 5)
- **Detail**: As the plan requires, the pull request step runs in `archive` "whatever `archived` says". On `archived: false` the folder "may be unchanged or half-archived" and a failed `chore(archive)` commit leaves the rename staged; `git add -A` then commits that state as `chore(<id>): final run state` and pushes it. Nothing is lost (it is a commit on the run branch the human reviews), but the human is told to inspect a tree that is already committed and pushed. On the failure path, `git reset -q` also unstages entries staged before the script ran, not only its own add (the working tree is unchanged). The "confirm that `git status` is clean" line of `archived: true` is now mostly answered by the leftover commit.
- **Fix**: Either keep it (the run branch is a review branch, a commit is reversible), or skip the leftover commit on `archived: false` with a flag such as `--no-leftover-commit`.
  - Strength: keeping it matches the plan and ADR-017 ("push what exists"); skipping keeps the half state for a human.
  - Tradeoff: a flag adds a second mode to a script whose point is "no exceptions".
  - Confidence: MED — depends on how often an archive half-fails.
  - Blind spot: no live archive failure has been observed.
- **Decision**: PENDING — the plan specified this behavior; the owner decides whether a half-archived tree should be committed and pushed or left uncommitted.

### F4 — Plan text and manual row 3.5 still call the opt-out an open owner decision

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/worktree-pr-only/plan.md:32, plan.md:261
- **Detail**: "What We're NOT Doing" says removing the opt-out is "a separate owner decision, listed in ADR-017", and row 3.5 asks to confirm ADR-017 "lists the non-isolated opt-out as the open owner decision". ADR-017 records it as decided by the owner (plan review F1, "It is not an open question"), which is the later and correct state. The row cannot be ticked as written.
- **Fix**: Reword row 3.5 to "records the non-isolated opt-out as the owner-decided single exception" and tick it after reading ADR-017.
- **Decision**: PENDING — the review may not edit `## Progress`; the owner rewords or ticks row 3.5.
