<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: OpenAI Codex Support

- **Plan**: context/changes/openai-codex-support/plan.md
- **Scope**: Full plan review of completed phases 1–3 of 4
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations
- **Revision**: cd2fec9
- **Git range**: a506d63..cd2fec9

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

The warning affects execution exclusivity and needs resolution before approval.

## Findings

### F1 — Runner death permits duplicate live children

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/run-codex.mjs:171
- **Related location**: skills/10x-pipeline/scripts/state.mjs:866 and :891
- **Detail**: The runner starts Codex in a detached process group, while the shared lock records only the runner PID. If the runner is killed with SIGKILL or crashes, its child can remain alive. A subsequent runner sees the dead lock owner, removes the lock, and launches the same pending action while the original child still runs. Router mutations use the same lock and can likewise proceed during orphaned execution. Concurrent children can edit and commit the same worktree, and router recovery can race those edits. Handled cancellation tests cover SIGTERM, leaving this crash path uncovered.
- **Fix**: Extend the shared execution lock to retain child/process-group ownership and refuse recovery while a child is alive or its termination is uncertain. Cover runner death and concurrent runner/router refusal with a regression test.
  - Strength: Preserves execution exclusivity across both chains and all mutating router commands.
  - Tradeoff: Requires crash-aware lifetime bookkeeping in the existing shared lock and compatibility with ordinary router locks.
  - Confidence: HIGH — reproduced with the existing model-free fake CLI, then independently rerun by the main reviewer.
  - Blind spot: Windows process-tree behavior and installed-host crash behavior remain unverified.
- **Decision**: FIXED — user selected Fix now on 2026-11-14. Shared lock now retains child/process-group ownership across supervisor death, with both-chain crash regression coverage and a passing full suite.

### Reproduction evidence

Command run during review, using the existing test helpers and a temporary script.

```sh
node /tmp/agent-smith-review-orphan-child.mjs
```

```json
{"runnerKilled":true,"originalChildStillAlive":true,"secondLaunched":true,"secondCompleted":true,"modelLaunchCount":2}
```

The script creates `codexFixture("10x", { mode: { hold: true } })`, starts the real runner with its pending action, waits for the fake child PID, and sends SIGKILL only to the runner. It verifies the child is still alive, changes the fixture mode to complete immediately, and calls `execute(w)` with the same action. Two `exec` launches appear in the fixture call log while the first child remains alive. The script terminates the orphan process group and removes scratch fixtures in `finally`. No live model or external service was called.

## Coverage and plan comparison

Progress contains 16 completed rows out of 19. Phases 1, 2 and 3 have all rows checked. Phase 4 has three pending Manual rows, so it is excluded from completed-phase review coverage under the review skill. Its existing evidence and automated integration tests were inspected as supplementary verification.

The five feature commits define the range because the plan filename contains no date. The range changes 49 files. Provider propagation, fixed host identity, legacy Claude defaults, optional nullable profile selection, exact neutral retries, archive dispatch, provider-aware reports/comparison, durable PR-comment intent, prompt portability and packaging match the planned contracts. New test files consolidate checks originally listed against existing test files. Unchanged planned test filenames and `baseline-policy.json` do not imply missing behavior. Connected fixture updates reflect the intended output changes.

The runner remains a standalone execution boundary. Routing and durable run state remain owned by router modules. Existing module dependency direction is preserved. No new npm dependency or version-field change was found. The archived tree and protected `loops-existing.test.mjs` have no diff in the reviewed range. The change retains existing Codex configuration by default, with a named profile optional.

## Verification

Commands were run against cd2fec9 with Node v24.19.0.

| Command | Result |
|---------|--------|
| `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` | PASS — 1,242 tests, 1,239 passed, 3 skipped, zero failures, 361,151 ms |
| `node tools/version-check.mjs` | PASS — 1.7.0 |
| `node tools/commit-lint.mjs a506d63..HEAD` | PASS |
| `node /tmp/agent-smith-codex-smoke.mjs` | PASS — both chains returned `action: "run"` with readable provider-bearing status |
| Orphan-child reproduction above | Confirmed F1 — two model-process launches for one pending action |

The full suite covers the automated commands shared by phases 1–3. Its output is in `/tmp/agent-smith-impl-review-tests.log`. The smoke used the GPT overlay with `isolation.require: false` and `profile: null`. The 10x action selected `plan` on `gpt-6.1-sol/medium`, and OpenSpec selected `os-propose` on `gpt-6-astra/high`. The installed CLI reports 0.169.0. No paid model calls were made.

## Acceptance limits

Manual rows 4.4–4.6 remain unchecked. Real Codex-hosted installation and skill discovery, live model execution, native Claude mixed-provider dispatch, and real host interruption/resume, trust, hooks, approvals and archive/browser behavior remain pending. No completed Manual row was found without evidence.

The earlier native sandbox Git proof in `evidence/phase2-permissions.md` was inspected and was not rerun during this review. It establishes filesystem/Git capability in its isolated fixtures. Model-command execpolicy and hook approval behavior remain outside that proof. Full installed-host acceptance is still required.

## Triage resolution

F1 is fixed in the working tree based on cd2fec9. All findings are triaged, with one fixed and zero pending.

The runner records an uncertain launch in the shared lock before spawning and atomically records the child PID on spawn. A dead supervisor's lock remains held while the recorded POSIX process group lives. A missing child PID, malformed execution record, or Windows execution record requires process-tree inspection before manual lock removal. Once a known POSIX group exits, normal stale-lock recovery works. Normal completion and handled cancellation clear execution ownership after child close. Refused router calls remove their own temporary lock files.

The regression kills the supervisor while its fake Codex child stays alive on each chain. It proves that another runner and all mutating router commands refuse, plain status remains available, the report stays byte-identical, no temporary lock files leak, and execution resumes after the orphaned group exits. Separate assertions preserve locks with unknown child termination and retain legacy numeric-lock recovery.

| Verification | Result |
|--------------|--------|
| New regressions before production fix | Expected failure — unknown-child refusal and both-chain supervisor-crash tests failed |
| Temporary-lock cleanup assertion before correction | Expected failure — refused router call left its `.tmp` lock file |
| Runner and lock tests after final correction | PASS — 52 passed, zero failures |
| Required full suite after final correction | PASS — 1,245 tests, 1,242 passed, 3 skipped, zero failures, 374,026 ms |
| Version check | PASS — 1.7.0 |
| Diff whitespace check | PASS |

Final logs are `/tmp/agent-smith-f1-focused-final.log` and `/tmp/agent-smith-f1-full-final.log`. The native Windows process tree and live installed-host recovery remain unverified. Manual rows 4.4–4.6 remain pending.
