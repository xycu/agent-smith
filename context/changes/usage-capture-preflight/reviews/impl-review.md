<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usage Capture Preflight Implementation Plan

- **Plan**: [Usage Capture Preflight Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

The verdict and counts describe `40a89426` before triage. The review scoped the implementation to `2a5fc3df`, `80bf6f92`, `18adca92` and `22616037` and checked their callers at that revision. Phase 1 uses the effective providers and separates usage advice from permission diagnostics. Phase 2 derives header clauses from settled usage evidence and retains them in capped local comments for both chains. Report rebuilds and verified late usage use the same ledger and preserve legacy accounting.

The plan's Phase 1 regression rows 1.3 and 1.4 refer to F1 and F2 in the earlier report at `94b10c56`. That review covered a missing native Claude capture module and a failure marker created during source probes. Both were fixed in `18adca92` and both regression checks passed on the current revision.

## Findings

### F1 — The Codex usage collector can prevent router startup

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — the fix is local to the advisory's module load.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/init-usage.mjs:5` at `40a89426`
- **Detail**: The advisory imports the entire collector at module initialization for its version pin. If the collector cannot load, Node exits before argument handling or transport selection. A Claude-only init or a status command then fails before emitting JSON. The OpenAI advisory cannot report an indeterminate check either.
- **Fix**: Import the pin inside the OpenAI advisory and turn import failure into fixed setup guidance. Verify Claude init, Codex init and status through a scratch plugin missing the collector.
- **Decision**: APPLIED in `0d898a02`. Only the OpenAI advisory loads the collector, and an unavailable collector produces a fixed warning.

### F2 — The headless advisory directs users to launch from inside Claude

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix aligns the advisory with the launcher's existing entry point.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/init-usage.mjs:37` at `40a89426`
- **Detail**: The warning tells users to use the launcher “in a fresh Claude session.” Running it from inside that session triggers the launcher's `CLAUDECODE` guard. The launcher itself starts the interactive session. [Launcher guard](../../../../skills/10x-pipeline/scripts/claude-capture.mjs#L27)
- **Fix**: Tell users to start the fresh session with the launcher, then start or resume a compatible Claude-hosted run from that session. Assert the instruction in the startup fixture.
- **Decision**: APPLIED in `0d898a02`. Both chains tell users to start the session with the launcher and then start or resume the run.

## Verification before triage

| Planned command or assertion | Result |
| --- | --- |
| `node --test --test-name-pattern='missing or unreadable hook inputs\|native probe opens both sources safely' skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/init-usage.test.mjs` | Both named tests passed |
| `node --test skills/10x-pipeline/test/init-usage.test.mjs skills/10x-pipeline/test/init-permissions.test.mjs` | 22 passed |
| `node --test skills/10x-pipeline/test/claude-capture.test.mjs skills/10x-pipeline/test/claude-usage.test.mjs` | 78 passed |
| `node --test skills/10x-pipeline/test/accounting-readers.test.mjs skills/10x-pipeline/test/late-usage.test.mjs` | 62 passed |
| `env -u GH_LIVE node --test skills/10x-pipeline/test/pr-comment.test.mjs` | 56 passed, 2 opt-in live cases skipped |
| README warning and setup-link assertions, reference launcher, pin and deferred rollout assertions, and `git diff --check` | Passed |

- Manual row 2.4 is pending for the owner to verify the warning, quiet startup and verified figures in interactive Claude sessions.
- Manual row 2.5 is pending for the owner to verify the live comment after orchestrator publication. The local fake client verified the report header for both chains. [Manual verification evidence](../evidence/unproven.md)

## Verification after triage

The new missing-collector case and the updated headless guidance checks for both chains failed against the original code and passed with the fixes. All seven automated plan rows passed. The planned suites and the full provenance test file passed 248 distinct tests, with two opt-in GitHub cases skipped. The two named Phase 1 regression checks also passed in the plan's filtered command. Documentation assertions and `git diff --check` passed.

The plan's unchecked manual rows remain pending. Token coverage for the two delegated review passes was unavailable.
