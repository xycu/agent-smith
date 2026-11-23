<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usage Capture Preflight

- **Plan**: [Usage Capture Preflight Implementation Plan](../plan.md)
- **Scope**: Full plan, confirmation at `779184c6`
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS for all seven automated rows. Manual rows 2.4 and 2.5 await owner verification. |

## Findings

No findings on the reviewed revision. The preceding review at `777aa131` retains its original verdict and counts. This confirmation verified its two fixes in `0d898a02`. Removing the Codex collector from a scratch plugin leaves native Claude init and status usable, and Codex init still dispatches with a warning. The headless guidance now tells operators to start a fresh Claude session with the launcher.

## Phase verification

**Phase 1.** Both chains select advisories from assigned transports. A neutral replay checks the saved provider. The tests verify one JSON action on stdout, combined guidance on stderr, private launcher files that can grow during the check, and a bounded Codex version probe. The two named regressions confirm that an unavailable native capture module yields a null hook hash and that a launcher failure during the probe yields a warning. Both cases still dispatch.

**Phase 2.** The report header counts settled steps with applicable evidence. Tests cover missing sources, disabled capture, duration-only headless steps, measured zero, pending rows and legacy data. A verified late figure refreshes the header. The local fake client received the same line in the capped comment payload for both chains.

| Focused verification on Node 24.19.0 | Result |
| --- | --- |
| Plan's named `missing or unreadable hook inputs` and `native probe opens both sources safely` checks | Both executed and passed |
| `init-usage.test.mjs` and `init-permissions.test.mjs` | 22 passed |
| `claude-capture.test.mjs` and `claude-usage.test.mjs` | 78 passed |
| `accounting-readers.test.mjs` and `late-usage.test.mjs` | 62 passed |
| `pr-comment.test.mjs` with `GH_LIVE` unset | 56 passed, two opt-in live cases skipped |
| Full `provenance.test.mjs`, including the missing Codex collector regression | 30 passed |
| README warning and setup link, reference launcher command, Codex pin and deferred rollout assertions, and `git diff --check` | Passed |

In total, 248 distinct tests passed. The two named regressions also ran separately.

## Pending manual acceptance

- **2.4** requires a supported interactive Claude host to observe the warning in an ordinary session and then quiet init and verified figures in a fresh launcher session.
- **2.5** requires the published PR comment and terminal report for a run with capture disabled. The orchestrator owns publication. [Manual verification evidence](../evidence/unproven.md)

The plan-drift and safety review invocations each returned a read-only assessment. Neither supplied a verified token count.
