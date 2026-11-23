<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Claude Run-Root Write Preflight

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-23
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

The verdict and counts describe the implementation at `bc08a131`. The product diff is the Phase 1 commit `f7ee2dbd`, which covers both skill entry points, their contract test and the operator reference. The branch also contains planning artifacts, run records and verification evidence.

## Findings

### F1 — Preflight can miss unresolved run ownership

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/SKILL.md:47`, `skills/openspec-pipeline/SKILL.md:52`, `skills/10x-pipeline/scripts/run-lock.mjs:71`
- **Detail**: The preflight checks only the primary run lock. During a takeover, the guard can remain present while the primary lock is absent. An interactive native Agent invocation also has no standalone runner lock. The plan requires sole ownership before probe writes.
- **Fix**: Check the primary lock and guard in the original temporary directory. Require session evidence for settlement when interactive execution ownership is uncertain.
- **Decision**: APPLIED in `f7dafe41`. Both skills check the takeover guard and require native settlement evidence where applicable.

### F2 — Result verification can follow a redirected parent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/SKILL.md:98`, `skills/openspec-pipeline/SKILL.md:104`, `skills/10x-pipeline/scripts/runner-dispatch.mjs:27`
- **Detail**: An absent leaf or regular-file readback leaves ancestor redirects undetected. The result gate runs after dispatch, when the run directory could have changed. The existing external-dispatch check already requires the state directory to resolve under the selected change.
- **Fix**: Validate the canonical result parent in both intake and recovery. Use `lstat` for the leaf and accept only `ENOENT` as absence.
- **Decision**: APPLIED in `f7dafe41`. Both skills verify the result parent and use symlink-aware leaf checks.

### F3 — Native neutral retries can lack proof of prelaunch refusal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/SKILL.md:76`, `skills/openspec-pipeline/SKILL.md:82`
- **Detail**: The native branch permits a neutral retry when no step child is running after an incomplete or replyless call. A previously launched child can already have stopped and left edits. Phase 1 limits neutral results to eligible prelaunch failures.
- **Fix**: Require affirmative evidence that the child never launched. Suspend on unresolved ownership and send settled launched failures through the `unknown` result path.
- **Decision**: APPLIED in `f7dafe41`. Both skills require confirmed prelaunch evidence before declaring an orchestration fault.

### F4 — Recovery can accept a retry that already reached its cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/SKILL.md:102`, `skills/openspec-pipeline/SKILL.md:108`, `skills/10x-pipeline/scripts/flow.mjs:435`, `skills/10x-pipeline/scripts/route.mjs:779`
- **Detail**: At the retry cap, the router consumes the result and records a terminal outcome without changing the row's retry count or `ok: null`. After an interrupted recovery, matching plain status alone can therefore accept the same payload again.
- **Fix**: After clean plain status, require the saved metadata to show an active run before replaying the retained result. Preserve existing state for owner reconciliation if the run ended.
- **Decision**: APPLIED in `f7dafe41`. Both skills check the saved terminal outcome before replay.

## Verification

### Automated

| Plan row | Check | Before fixes | After fixes |
| --- | --- | --- | --- |
| 1.1 | `node --test skills/10x-pipeline/test/skill-loop.test.mjs` | PASS in the 106-test combined run | PASS. 69 tests |
| 1.1 | Remove the preflight and result gate separately from each chain in temporary copies | All four variants failed as expected | All four variants failed as expected |
| 1.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/result-persist.test.mjs` | PASS. 140 tests | PASS. 140 tests |
| Compatibility | `node --test skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/host-integration.test.mjs` | PASS in the 106-test combined run | PASS. 37 tests |

Two focused cases from `neutral.test.mjs` also passed after the fixes. They verify that a capped retry records a terminal outcome and consumes its input, and that plain status reports the neutral retry count. Both skill files grew by 419 bytes, and each ceiling moved by that amount.

### Manual

Rows 1.3–1.5 remain pending. The prior manual steps recorded that Claude Desktop access was unapproved and Orca reported `runtime_unavailable`. The sibling-worktree denial, linked-session denial, authorized reuse and result-only refusal and recovery still need live Desktop evidence. [Manual verification evidence](../evidence/unproven.md)
