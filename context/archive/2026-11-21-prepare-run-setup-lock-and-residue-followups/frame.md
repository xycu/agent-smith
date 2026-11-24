# Frame Brief: prepare-run follow-ups F1, F2 and F3

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed. It replaces the F1-only brief of 2026-11-21; the F1 findings are kept as section F1.

## Reported Observation

Three observations from the review of PR #252 (`change.md`, "Notes"):

- **F1.** An uncommitted deletion in a change folder (staged `D ` or unstaged ` D`) is undone in the run worktree: the worktree is created from HEAD and the source folder is overlaid, so a deleted stale `plan.md` (or `research.md`) is back and the router sees the old plan. Reproduced on 2026-11-21 in a scratch repo at `main` 0680a16b: source had `change.md` only, with `D  plan.md` and ` D research.md`; the worktree held `change.md plan.md research.md`, setup JSON `case: "opt-out"` not involved, `case: "created"`, `copied: true`, `reason: null`.
- **F2.** `checkCurrentPending` takes the branch setup lock for opt-out calls from a linked worktree, so a stale lock fails a call that used to return `opt-out`.
- **F3.** `writePending` can leave a `.pending.<uuid>.tmp` file after SIGKILL; the leftovers test does not look at the `.tmp` suffix.

## Initial Framing (preserved)

- **User's stated cause or approach**: F1: `copyChange` only adds and overwrites and the worktree comes from HEAD. F2: the check takes a lock it does not need. F3: the temp file is a residue of a killed write.
- **User's proposed direction**: F1: a separate copy contract with deletion safeguards; remove in the destination, one file at a time, each path that `git ls-files --deleted` and `git diff --cached --diff-filter=D` report. F2: read the pending file lock-free for that check. F3: make the temp harmless and documented, or clean it, and extend the leftovers test to `.tmp`.
- **Pre-dispatch narrowing**: the user picked "All of F1, F2 and F3" for scope (2026-11-21) and the main-checkout change folder for location. No finer separation of observations was requested.

## Dimension Map

1. **Copy semantics (F1)** — the overlay (`copyChange`, `prepare-run.mjs:120-140`) never removes; the destination is HEAD's tree. ← F1 framing
2. **Deletion source of truth (F1)** — which state defines "deleted": git status lists or the start commit's tree against the source filesystem.
3. **When deletion may run (F1)** — only on a copying setup, never on an ordinary resume or in a worktree with router state.
4. **Why the opt-out check locks (F2)** — `checkCurrentPending` (`prepare-run.mjs:239-246`) reuses `withSetupLock` (`:142-157`) only to read; the lock is a write (creates and unlinks `<marker>.lock`). ← F2 framing
5. **What a lock-free reader must tolerate (F2)** — the marker is published by atomic rename (`writePending`, `:179-189`) and removed by `unlinkSync` at the end of setup (`:350`, `:409`); `readPending` does `lstat` then a read (`:161-176`), so a removal between the two is reported as an error.
6. **Which call sites are in scope (F2)** — `checkCurrentPending` runs at `:248` (isolation off, the reported opt-out) and at `:295` (isolation on, current branch differs from the selected one).
7. **What the `.tmp` residue can do (F3)** — recovery reads only the canonical `.pending` (`readPending`, `:161`); the temp name is `<marker>.<uuid>.tmp` and is never read. ← F3 framing
8. **What else a kill leaves (F3)** — the setup lock (`withSetupLock`'s `finally` does not run on SIGKILL), which already needs manual inspection before removal.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| F1: overlay is add-only, so HEAD's copy of a deleted file survives | Scratch repro; `copyChange` has no removal path | STRONG |
| F1: git-status lists are the right deletion source | `git rm --cached` leaves the file on disk: reports `D ` but the file is a real input the overlay copies. On a pending retry HEAD may have moved past `pending.startCommit`, so a status list is relative to the wrong base | WEAK |
| F1: start-commit tree minus source filesystem is the right source | `pending.startCommit` is recorded before `worktree add` (`:345`); `cleanup` already reads `ls-tree -r` of the start commit (`:520`). Same answer for staged, unstaged, `git rm --cached` plus `rm` | STRONG |
| F1: the router commits the deletion once it exists in the worktree | `routerCommit` runs `git add -- <change folder>`, which stages deletions (`isolation.mjs:376`); `startCommit` records them (`:482`) | STRONG |
| F1: post-init `cleanup` needs a change | It unlinks only source files whose blob equals the start commit's; a deleted file has no source entry | NONE |
| F1: warn-only is enough | Contradicts the need to force a re-plan by deleting `plan.md`; nothing reports tracked deletions today | WEAK |
| F2: the lock is not needed to read the marker | Writer publishes by rename after an exclusive temp (`:179-186`), so a reader sees a whole record or none. The lock is the writer's mutual exclusion, not a reader gate | STRONG |
| F2: the check also writes, beyond failing on a stale lock | `withSetupLock` creates `<marker>.lock` with `wx` and unlinks it (`:147-157`). A concurrent real setup on the same branch can fail with "Setup lock exists" because of an opt-out check, while the test "opt-out ... is read-only" (`prepare-run.test.mjs:196`) names the contract | STRONG |
| F2: a lock-free reader can use `readPending` unchanged | `lstat` then read: a removal in between becomes "Cannot read pending setup" (`:175`), a new failure for a call that used to see a completed setup | STRONG (as a risk to cover) |
| F2: the second call site (`:295`) belongs to the observation | The reported failure is the opt-out; at `:295` isolation is on and the branch is mid-selection, where a held lock may be the signal that setup runs | WEAK |
| F3: the `.tmp` file harms recovery | Nothing reads it; `readPending` takes only the canonical path; setup registers the worktree only after the rename (`:344-348`) | NONE |
| F3: the harm is the leftover itself (clutter in the Git common dir, blind test) | `prepare-run.test.mjs:304` matches `/\.(lock\|pending)$/`, so a leaked `.tmp` passes; a SIGKILL also strands the lock | STRONG |
| F3: a stranded temp matters beyond the lock | The lock forces a manual step after SIGKILL, but the manual step names only the lock; reproduced: after removing the lock the retry succeeds and the `.tmp` stays for good, so the permanent leftover is the temp, not the lock | STRONG |
| F3: the `catch` in `writePending` is exact | `unlinkSync(temp)` in the catch throws `ENOENT` if the rename failed after the temp was already gone, masking the original error | WEAK (not reproduced) |

## Narrowing Signals

- The brief requires per-file deletion with no recursive or forced delete (`AGENTS.md`, ADR-016). `removeTree` fits a whole tree; F1 deletes selected files and `rmdir`s emptied directories.
- Router state under `<change>/agent-smith/` is owned by the router (`AGENTS.md`, ADR-010). A deleted tracked `agent-smith/meta.json` in the source must not be acted on by setup.
- F2 and F3 touch `checkCurrentPending`, `readPending`, `writePending` and `withSetupLock`; F1 touches `copyChange` and the creating and retry branches of `prepare()`. The two groups share no function, but all of them sit in `prepare-run.mjs`, where the P1 change `run-root-worktree-readiness` also works.
- No Step 4 questions: Step 3-style reads gave a conclusive answer for each of F1, F2, F3.

## Cross-System Convention

- F1: overlay tools that mirror deletions work from a manifest of the base tree and remove only entries that are in the base, absent in the source and unmodified in the destination. Git-status lists are the weaker variant.
- F2: a published-by-rename file is read without the writer's lock; the reader handles "absent" and "vanished during read" as the same case.
- F3: temp-then-rename writers either clean their own stale temps on the next write under their lock or leave them as inert, documented residue; a kill cannot run cleanup code.

## Reframed (or Confirmed) Problem Statement

> **The actual problems to plan around are**: (F1) the overlay copy has no rule for paths in the start commit's change folder that are gone from the source; (F2) a read-only opt-out check takes a write lock for a file the writer already publishes atomically; (F3) the stranded temp file is inert for recovery, so the defect is a leftover plus a test that cannot see it.

The initial framings hold on cause and need. Three refinements: F1 defines "deleted" from the start commit's tree against the source filesystem, not from git-status output; F2 is a write on a read-only path as much as a stale-lock failure, and the lock-free reader must treat "vanished during read" as absent; F3 is a hygiene and test-coverage gap, not a recovery hazard, so "harmless" is already true and the open question is cleaned versus documented.

## Confidence

- **F1: HIGH** — reproduced, code path read, and the start-commit rule survives its alternatives.
- **F2: HIGH** — reproduced 2026-11-22 in a scratch repo (linked worktree on `agent-smith/demo`, `isolation.require: false`): with no lock the call returns `case: "opt-out"`; with a stale `agent-smith-setup-agent-smith%2Fdemo.lock` it returns `runRoot: null` and `reason: "Setup lock exists at ... after an interruption inspect it before manual removal"`. The vanish-during-read risk is read from source only.
- **F3: HIGH** — reproduced 2026-11-22: a preload that SIGKILLs at `renameSync(*.tmp, *.pending)` leaves exit 137, the lock and `agent-smith-setup-agent-smith%2Fdemo.pending.<uuid>.tmp` (mode 0600). A retry fails on the stranded lock; after removing only the lock, setup completes (worktree registered) and the `.tmp` is still there, so the residue outlives a successful setup and nothing ever removes it.

## What Changes for /10x-plan

F2 and F3 plan together and directly. Treat the opt-out call (`:248`) as the F2 scope and decide `:295` explicitly rather than by default. F3 chooses between cleanup on the next locked write and documentation, and extends the leftovers test. F1 plans as its own change: it needs one new contract (what counts as deleted, what stays and how it is reported) and edits `copyChange` and `prepare()`.

## Split proposal (no folder opened)

- Keep F2 and F3 in `prepare-run-setup-lock-and-residue-followups`.
- Move F1 to a later change, `prepare-run-deletion-propagation`. Open points for it: how a file left in place is reported without changing the setup JSON contract (`left` belongs to cleanup; ADR-010 Amendment 2), and the docs home (a new ADR-010 amendment plus the setup bullets in `docs/REFERENCE.md:151-157`).

## References

- `skills/10x-pipeline/scripts/prepare-run.mjs:120-140`, `:142-157`, `:161-176`, `:179-189`, `:239-248`, `:295`, `:344-350`, `:486-562`
- `skills/10x-pipeline/scripts/isolation.mjs:367-410`, `:482`
- `skills/10x-pipeline/test/prepare-run.test.mjs:196`, `:302-306`
- `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendment 6), `docs/ADR/ADR-016-no-recursive-force-delete.md`, `docs/REFERENCE.md:151-157`
- `context/archive/2026-11-19-prepare-run-retry-after-failed-setup/change.md:26-31`
- Investigation tasks: none registered; read-only evidence gathered inline (no sub-agents)
