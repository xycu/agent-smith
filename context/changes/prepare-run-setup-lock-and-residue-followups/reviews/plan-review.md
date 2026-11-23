<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Lock-free pending checks and a bounded setup temp (F2, F3)

- **Plan**: context/changes/prepare-run-setup-lock-and-residue-followups/plan.md
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

7/7 claimed implementation, verification and reference paths exist. Verified seven symbols: `checkCurrentPending`, `readPending`, `readPolicyObject`, `acquireSetupLock`, `withSetupLockSync`, `withSetupLock` and `writePending`. Both phases matched their original Progress rows. The original brief had Wave 4 drift (F6). The original Automated rows contained no explicit push, PR, PR CI or external-comment requirement.

One read-only Codex child checked the failure paths, callers and test harness against the pinned code. Both publishers run under the same branch lock (`prepare-run.mjs:378`, `:429`, `:508`). Cleanup retains its separate acquisition of that lock (`:607`). The executable is used through its CLI, and no other module consumes its pending helpers. On the existing injected worktree-add failure the staging file has already been renamed, and the unregistered failure unlinks the canonical record (`:429–435`).

The verdict and counts measure the replanned document before triage. The Decisions below record the applied fixes. The earlier review's UUID import and duplicate-test fixes were already present in the replanned document.

## Findings

### F1 — Concurrent removal can hide a real pending-record error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: Blind Spots
- **Location**: Phase 1, Lock-free `checkCurrentPending`
- **Detail**: The original fallback treats any wrapped `readPending` failure as absence when the path later disappears. A malformed, non-regular or unreadable record can therefore lose the required inspect diagnostic. The wrapper at `prepare-run.mjs:240–256` discards the underlying errno, and the raw payload read is in `run-identity.mjs:9–12`.
- **Fix**: Handle only payload-read `ENOENT` under a lock-free option, with a second `lstat` to confirm absence. Keep the default locked read and existing diagnostics. Exercise both disappearance and an unrelated read failure followed by disappearance.
- **Decision**: APPLIED in Current State Analysis, Implementation Approach, Phase 1 change 2, Phase 2 change 1 and the plan brief.

### F2 — The cited valid-record test runs through the main lock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: End-State Alignment
- **Location**: Phase 2, change 1
- **Detail**: The fixture feeding `prepare-run.test.mjs:855` keeps isolation enabled (`prepare-run-helpers.mjs:66–78`). The actual opt-out fixture starts at `prepare-run.test.mjs:994`. A before-and-after directory listing also passes if a lock is created and removed during the call.
- **Fix**: Extend the actual opt-out test with a stale lock and record-preservation assertions. Exercise malformed and non-regular entries under a stale lock. Guard the lock open in the no-lock case and keep the final-state comparison.
- **Decision**: APPLIED in Phase 2 change 1 and Testing Strategy.

### F3 — The interruption proof misses the second publication and the signal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 2 and Manual row 2.3
- **Detail**: The initial intent and the copy-complete update have different recovery states (`prepare-run.mjs:429`, `:508`). The standard setup helper requires JSON and exit 0, while the shared synchronous runner drops the signal (`prepare-run-helpers.mjs:100–108`, `test/helpers.mjs:134–145`). Checking only the symlink target's bytes also passes with UUID staging. A standalone copied script cannot load its relative imports and policies.
- **Fix**: Use direct `spawnSync` with a destination-scoped preload and exact signal and retry assertions for both publications. Assert symlink removal and directory preservation. Run deliberate breaks from a throwaway copy with the expected plugin layout and confirm failures at the intended assertions.
- **Decision**: APPLIED in Phase 1 Implementation Note, Phase 2 change 2 and Verification Notes, and Testing Strategy.

### F4 — Verification gates conflict with unattended implementation and CI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Implementation Note, Phase 2 Success Criteria and Progress row 2.2
- **Detail**: The plan requires a human pause before Phase 2 even though the unattended implementation step takes all Automated rows (`policy.json:224`). It also requires a local full suite in Automated row 2.2. `AGENTS.md:16` reserves local full-suite runs for owner requests and CI failure reproduction, and repository CI runs the full suite.
- **Fix**: Defer Phase 1 Manual checks to manual verification. Move row 2.2 intact to Manual for post-publication CI confirmation, with the original command retained for an authorized local run. Keep the existing focused checks Automated.
- **Decision**: APPLIED in Phase 1 Implementation Note, Phase 2 Success Criteria and Verification Notes, Progress and the plan brief.

### F5 — The cleanup promise overlooks retries that skip publication

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: Blind Spots
- **Location**: Desired End State, Phase 2 Docs and Migration Notes
- **Detail**: Replacing debris inside `writePending` guarantees cleanup on the next updated write. Ordinary and initialized recovery paths can succeed without that write (`prepare-run.mjs:503–515`), and an older writer uses a UUID path. The original plan and brief promise a clean temp directory after a successful retry and give only an abbreviated operator inspection instruction.
- **Fix**: Tie replacement to the next updated branch writer. Document retained fixed and legacy temps, the existing stopped-writer check before manual removal, and canonical-record preservation. Retain Amendment 7's compatible-version requirement during copy-complete recovery.
- **Decision**: APPLIED in Desired End State, Phase 1 change 3, Phase 2 Docs, Migration Notes and the plan brief.

### F6 — The brief still describes the pre-Wave 4 plan

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision, narrow fix)
- **Dimension**: Plan Completeness
- **Location**: Plan Overview and plan brief scope, architecture and prerequisites
- **Detail**: The brief names old call sites, assigns the work to Amendment 7 and treats the readiness change as an outstanding prerequisite. Amendment 7 already documents project gates, and the Wave 4 merge is recorded in `context/changes/WAVES.md:114`. The replanned body targets Amendment 8.
- **Fix**: Align the brief with the pinned base, current call sites and Amendment 8. Replace the plan's self-reference to the earlier version with the wave record.
- **Decision**: APPLIED in Plan References and the plan brief's decisions, scope, phase summary, prerequisites and references.
