<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run Root Worktree Readiness Implementation Plan

- **Plan**: context/changes/run-root-worktree-readiness/plan.md
- **Scope**: Full plan (Phases 1 and 2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

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

- Mode: single-agent review (the step runs as a subagent, so no child agents were started). Read `prepare-run.mjs`, `prepare-run-gates.mjs`, the `run-identity.mjs` validator, `policy.json`, the REFERENCE.md and ADR-010 diffs, the `skill-loop.test.mjs` and `isolation.test.mjs` diffs, and the test list of `prepare-run.test.mjs`.
- Plan vs diff: every planned file is in the diff (`prepare-run.mjs`, `run-identity.mjs`, `policy.json`, new `prepare-run-gates.mjs`, the five test files, `docs/REFERENCE.md`, ADR-010). The two `SKILL.md` files stay unchanged as planned. No unplanned production file changed. `isolation.test.mjs` gained one line for the new policy default, a needed follow-on.
- Phase 1: freshness runs only on fresh registration (including an unregistered pending retry), uses explicit narrow `ls-remote` and `fetch` flags, compares verified SHAs with `rev-list --left-right --count`, reports `base`, stops on lag before the exclude, pending record and worktree, and keeps `worktree add` on the checked start commit. The `integrationBranch` validator sits next to `branchPrefix` and runs only when isolation is required.
- Phase 2: the gate helper chooses one lockfile family, validates `packageManager`, picks the documented install command per manager and Yarn generation, checks canonical directories, tracked and unignored dependency content and external or dangling links before and after install, reads `readiness` from `HEAD` with `ls-tree` plus `show`, and runs install and hook through an awaited detached `spawn` with SIGTERM then SIGKILL on the process group. `withSetupLock`, `prepare` and `main` are async; `cleanup` stays synchronous. `copyComplete: true` is written atomically before the gates, a copy-complete retry checks the pinned start is an ancestor of HEAD, and the record clears only on success or initialized recovery.
- Lessons check (`context/foundation/lessons.md`): the "grep every doc for old behavior" rule is met. REFERENCE.md bullets that described the old retry (`copied: true` on retry, lock scope) were rewritten and ADR-010 got Amendment 7. No other doc or skill mentions the setup output.
- Success criteria run on the reviewed code (tests listed under the orchestrator's scope rule: only files covering the changed code, not the full suite):
  `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs skills/10x-pipeline/test/isolation.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs` — 205 tests, 205 pass, 0 fail. The full suite was not run, per the orchestrator note (CI runs it).
- Manual row 2.4 (owner's real project) is unchecked, as it must be. `evidence/unproven.md` records why no unattended run can stand in for it. This is pending by design, not a finding.

## Findings

### F1 — A readiness hook that leaves a background process behind fails setup, and the docs do not say so

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/prepare-run-gates.mjs:158
- **Detail**: After the direct child closes, `runCommand` signals the process group with signal 0. If anything is still alive it terminates the group and rejects with "left running processes in its group". A hook such as `npm run dev &` or a script that starts a local service in its own group member therefore fails setup. This follows the plan's intent to retain the lock until descendants settle, but REFERENCE.md and ADR-010 Amendment 7 only describe termination on timeout or interruption.
- **Fix**: Add one sentence to the readiness bullet in `docs/REFERENCE.md` saying the command must exit without leaving processes in its group, and that a service it starts must detach into its own session or be managed by the project.
- **Decision**: PENDING — documentation wording and whether detached services should be allowed is the owner's call; the review-run rule says leave observations open.

### F2 — SIGINT or SIGTERM during the synchronous pre-gate phase is only honoured at the first gate

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/prepare-run.mjs:687
- **Detail**: The plan says a setup signal terminates the active group, releases the lock and prints failure JSON. The handlers are installed before `prepare`, but freshness (`ls-remote`, `fetch`, up to 120 s each), worktree creation and the copy run through `spawnSync` and block the event loop. A signal in that window is queued, so setup continues to create the worktree and copy the change, then aborts in `timeLeft` at the first gate with "interrupted by SIGINT". The result is retryable (pending record, registered worktree, copy-complete marker) and no data is lost, but the operator sees a fresh worktree after pressing Ctrl-C.
- **Fix A ⭐ Recommended**: Yield to the event loop (`await new Promise(setImmediate)`) and check `signal.aborted` after the freshness check and before `writePending` and `worktree add`, throwing the interruption there.
  - Strength: A signal that arrived during the fetch stops setup before it registers anything; a few lines.
  - Tradeoff: Cannot interrupt a blocked `spawnSync` call itself, so the fetch still runs to completion or its 120 s cap.
  - Confidence: MED — the yield delivers a queued signal to the handler, but no test drives a signal in this window yet.
  - Blind spot: Whether the freshness stage should itself be abortable.
- **Fix B**: Leave as is and document that an interrupt before the gates leaves a retryable worktree.
  - Strength: No code change; behaviour is already safe and retryable.
  - Tradeoff: Surprising worktree after Ctrl-C.
  - Confidence: HIGH — covered by the pending-record recovery tests.
  - Blind spot: None significant.
- **Decision**: PENDING — a real tradeoff (cannot cheaply deliver the signal while `spawnSync` blocks); the owner decides between A and B.
