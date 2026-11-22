<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Finish the change-folder copy on setup retry

- **Plan**: context/changes/prepare-run-retry-after-failed-setup/plan.md
- **Scope**: Full plan (Phase 1 of 1)
- **Reviewed phases**: 1
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Changed files (main...HEAD, excluding `context/`): `skills/10x-pipeline/scripts/prepare-run.mjs`, `skills/10x-pipeline/test/prepare-run.test.mjs`, `skills/10x-pipeline/test/README.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`. Every file is in the plan or is a test or doc the plan's grep rule (docs, both `SKILL.md` setup steps) reaches. No unplanned production file.
- Plan vs code: pending record is a JSON file `agent-smith-setup-<encodeURIComponent(branch)>.pending` written to a temp name and renamed, holding root, worktree, prefix, chain and start commit, written before `git worktree add` (MATCH). Retry verifies invocation, expected path, Git common dir, branch and start commit under the lock, validates the worktree top before the nested root (MATCH). Missing worktree top gives the path and `git worktree prune --dry-run` (MATCH). Copy only while the destination has no `meta.json` or `run.jsonl`, checked with `lstat` so a dangling symlink counts as present (MATCH). Success after recovery is `reused` with `copied: true`, so cleanup (`case === "created"`) stays off (MATCH). Plain add failure with no branch or registration retires the intent (MATCH). Deletion propagation stays out of scope as the plan states (MATCH).
- Automated criteria 1.1-1.4, run on Node v24.19.0:
  - `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 2169 tests, 2166 pass, 0 fail, 3 skipped.
  - `node --test skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`: 172 pass, 0 fail.
- Manual criteria: none in the plan.
- Old-behavior grep (`never copies`, `copies nothing`, `only when it creates`, `resume paths preserve`) over docs, skills and README after the change: no stale statement left outside archived changes. `docs/REFERENCE.md` line 155 and both `SKILL.md` cleanup steps keep `created` + `copied: true` as the cleanup gate, which matches the code.

## Findings

### F1 — Deletion case from change.md is not carried into the worktree

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/changes/prepare-run-retry-after-failed-setup/change.md (Related case); plan.md "Scope boundaries"
- **Detail**: The change notes describe an uncommitted deletion in the change folder that the worktree (checked out from HEAD) undoes. The plan puts it out of scope and names a separate copy contract with deletion safeguards. The implementation follows the plan, so the stale-`plan.md` case still reproduces. Not a defect of this change.
- **Fix**: Track the deletion case as its own change when the owner wants it.
- **Decision**: PENDING — out of the plan's scope; the owner decides whether to open a follow-up change for deletion propagation.

### F2 — Opt-out calls inside a linked worktree now take the branch setup lock

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/prepare-run.mjs:238-251 (`checkCurrentPending`)
- **Detail**: To send a user in an incomplete worktree back to the original root, `prepare` calls `withSetupLock` for the current branch on every call from a linked worktree, also when isolation is off. A stale lock for that branch makes such an opt-out call fail with the lock message where it used to return `opt-out`. The window is narrow (the branch must be a run branch with a leftover lock) and the message tells the user to inspect the lock, so the behavior is acceptable.
- **Fix**: If it matters, read the pending file without the lock for this check only, since it only decides whether to refuse.
- **Decision**: PENDING — no defect shown and the plan does not cover this path; the owner decides whether the lock-free read is worth the added code.

### F3 — A killed setup can leave a `.pending.<uuid>.tmp` file behind

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/prepare-run.mjs:182-192 (`writePending`)
- **Detail**: `writePending` removes its temp file on a thrown error, but a SIGKILL between create and rename leaves `agent-smith-setup-<branch>.pending.<uuid>.tmp` in the Git common directory. It is inert (setup reads only the `.pending` name) and the write window is microseconds. The test that asserts no leftovers matches only `.lock` and `.pending` suffixes, so it would not see it.
- **Fix**: None needed now; if tidiness matters, document the file as safe to remove with the lock inspection steps.
- **Decision**: PENDING — harmless residue with no clear fix inside the plan; the owner decides whether to document or ignore it.
