<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Exclusive stale run-lock takeover

- **Plan**: context/changes/run-lock-stale-takeover-race/plan.md
- **Mode**: Deep (claims verified by the reviewer against the code; no sub-agent, unattended step)
- **Date**: 2026-11-20
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 9/9 paths ✓ (`run-lock.mjs`, `state.mjs:1118`, `pr-common.mjs:108`, `route.mjs:1022/1066`, `run-claude.mjs:93`, `run-codex.mjs:210`, `run-lock.test.mjs`, `prepare-run-helpers.mjs:77`, `docs/REFERENCE.md:454`), 5/5 symbols ✓ (`deadPid`, `leftovers`, `release`, `unlinkQuiet`, `Atomics.wait`), brief↔plan ✓, Progress↔Phase ✓ (P1 1.1–1.5, P2 2.1–2.6, no `- [ ]` outside Progress), no Automated criterion needs a pushed branch, PR or PR CI. Line numbers inside `run-lock.mjs` were stale (F4). No `docs/reference/contract-surfaces.md` in this repository. Lessons rule "grep every doc for the old behavior" is already in plan change #3; a repo grep found `docs/REFERENCE.md:454` as the only statement of the old limit and no other doc quoting the busy message.

The exclusion design itself holds: a stale classification made outside the guard is repeated under the guard, nobody can link while the stale file exists, the owner of a stale lock is dead and cannot rename over it, and the "link fails after unlink" case loops to classify the new owner.

## Findings

### F1 — A vanished guard must retry, not count as a dead holder

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details, "Guard failure modes"; Phase 1 change 1
- **Detail**: The plan halts on a guard whose pid is dead. The existing code reads a vanished lock as empty text, which parses to no pid and falls to "stale". An implementer who copies that pattern for the guard reads a guard that its holder released between the failed `link` and the `read` as "dead holder" and halts with the removal advice. With 6 workers on one stale lock (Phase 2) and with parallel `next`/`usage` calls this is the common case, not a corner. The plan does not say what a vanished or unreadable guard means.
- **Fix**: State that a guard that vanishes or cannot be read is a normal release: retry the guard link at once inside the same budget. Only a readable guard with a dead or non-pid owner is the dead-holder halt.
- **Decision**: APPLIED — Critical Implementation Details, "Guard failure modes" (vanished or unreadable guard retries; dead-holder halt only for a readable dead owner).

### F2 — The overlap check can fail on the fixed module because of cross-process clock noise

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 changes 1 and 2 (worker time base, overlap assertion)
- **Detail**: Intervals use `performance.timeOrigin + performance.now()` from different processes and the plan calls this "comparable". Each process derives `timeOrigin` at its own start; the offsets differ by a fraction of a millisecond or more, and under load a late worker acquires right after the winner released. Back-to-back holds with a true gap of microseconds can then appear to overlap, so the assertion "never overlap" can be flaky on the fixed module, which the "five consecutive runs" criterion would catch only by luck. It also leaves open where in the worker `start` and `end` are taken; taking them outside the real hold shifts intervals into each other.
- **Fix**: Take `start` right after `lockRunDirectory` returns and `end` right before `release()`, and treat an overlap under 2 ms as clock noise. The pre-fix overlap is about the hold time (10 ms), so detection of the race is unaffected.
- **Decision**: APPLIED — Phase 2 change 1 Intent (where `start` and `end` are taken) and change 2 Intent (2 ms tolerance).

### F3 — Mechanics an implementer would have to guess

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 changes 1 and 2; Phase 2 change 1
- **Detail**: (a) `lockRunDirectory` is synchronous, so the 20 ms poll needs a sync sleep; the plan names `Atomics.wait` only as a test helper. (b) It does not say whether the 1 s guard budget and the 10-attempt bound are one budget or two. (c) The message advice `ps -p <pid> -o command=` exists on POSIX only. (d) The worker needs `root` and `TMPDIR` to be disjoint, since the lock code refuses a `TMPDIR` inside the root (`run-lock.mjs:80-84`), both real-pathed; `LOCK_MODULE` must be imported as a file URL; the source of the dead pid per round is not named although `deadPid()` exists in the test file.
- **Fix**: Name these in the contracts: sync sleep by `Atomics.wait`; the two bounds are separate and a guard retry uses no attempt; a Windows alternative in the message advice; the worker's `TMPDIR`/root rule, `pathToFileURL` and `deadPid()`.
- **Decision**: APPLIED — Phase 1 change 1 Intent (sync sleep, separate bounds), Phase 1 change 2 Intent (Windows check command), Phase 2 change 1 Contract (`TMPDIR` outside root, `pathToFileURL`, `deadPid()`).

### F4 — Stale line references and a weak baseline in criterion 1.3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis; Key Discoveries; Phase 1 Success Criteria, 1.3
- **Detail**: The plan corrects the stale `change.md` line numbers but gives its own: the acquire loop is `run-lock.mjs:46-78` (plan: 30-65), `release` is `:38-45` (plan: 38-46), the live-pid message is `:64` (plan: 55) and the `attempt > 0` check is `:75-76` (plan: 60-62). Criterion 1.3 diffs against the tip of `main`, so a commit on `main` that touches `run-lock.mjs` shows as a reversed change, while criterion 2.2 already uses the merge-base; its pattern `slice` would also match an unrelated `.slice(` added in the fix.
- **Fix**: Correct the four line references; diff against `$(git merge-base HEAD main)` and narrow the pattern to `slice\(0, 16\)`.
- **Decision**: APPLIED — Current State Analysis (`:75-76`), Key Discoveries (`:46-78`, `:38-45`, `:64`), Phase 1 Success Criteria row 1.3 command (merge-base, narrowed pattern; row id, title and tick unchanged).
