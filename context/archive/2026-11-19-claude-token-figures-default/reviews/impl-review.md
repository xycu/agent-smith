<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Opt-in Claude token capture implementation plan

- **Plan**: context/changes/claude-token-figures-default/plan.md
- **Scope**: Full plan (phases 1 and 2 of 2; Manual rows 2.4 and 2.5 still open)
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

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

- **Diff scope**: `b7457048..HEAD` outside `context/` touches 24 files. All are named by the plan (launcher, capture hook, capture data module, `hooks/hooks.json`, `claude-hook.mjs`, `isolation.mjs`, `claude-usage.mjs`, `usage.mjs`, both `SKILL.md`, README, REFERENCE, ADR-018 and ADR-019, and the tests). No unplanned file. `route.mjs` and `flow.mjs` needed no change because the shared formatter in `usage.mjs` carries the new `capture-disabled` reason.
- **Plan vs code**: session-local launcher with a loopback receiver bound to PID, creation time and a reserved session ID; separate passive hook that exits before reading stdin when the env binding is absent; hook paths added to `hookFilesHash` and `guardRevision`; collector `checkpoint` mode and bound mode behind the existing `$CLAUDE_USAGE` entry; exact-version registry `CLAUDE_CAPTURE_RELEASES` seeded with 2.1.311; `capture-disabled` reason; both skills updated with equal Anti-stall sections; README, REFERENCE and both ADR amendments written. All match.
- **Safety**: receiver checks method, secret route, Host header, remote address, content type, body size and projects every record to content-free fields; files are private, regular, single-link and realpath-checked; transcript reads are confined to `<claude config>/projects/<project>/<session>/subagents/agent-<id>.jsonl`; cleanup uses `removeTree`; no recursive delete; no new dependency.
- **Docs**: grep of README, `docs/`, both skills, rules and agents finds no stale claim such as "plugin installs no hooks", "enables no telemetry" or a single hardcoded host version (lesson: grep every doc for the old behavior).
- **Automated criteria** (`node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`): 2231 tests, 2228 pass, 0 fail, 3 skipped. `tools/version-check.mjs` OK (1.15.4). `tools/commit-lint.mjs main..HEAD` OK. `claude-capture.mjs --versions` prints `2.1.311`; the idle hook exits in about 50 ms.
- **Manual rows**: 2.4 and 2.5 are unchecked, README and `evidence/acceptance.md` keep qualification pending, and the plan notes that the maintainer's installed 2.1.323 is outside the registry. Nothing is rubber-stamped.

## Findings

### F1 — One malformed Agent record disables capture for the rest of the session

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-capture-hook.mjs:27, skills/10x-pipeline/scripts/claude-capture-data.mjs:118
- **Detail**: Any exception in the passive hook after the binding is read calls `markCaptureFailure`, which creates a `failed` file. `assertCaptureAvailable` then makes every later hook, `checkpoint` and collection fail with `missing-source` for the whole session. Triggers include a `PostToolUse` Agent response with no `agentId` (`projectNative` fails with `unsupported-schema`, line 118), a stale `hooks.lock` left by a hook killed at its 3 s timeout, or a 100 ms lock wait that expires. A single odd Agent call outside the pipeline in the same opted-in session therefore removes figures from all later pipeline steps. This is fail-closed and matches the plan's "capture failure yields bounded unavailable evidence", so nothing is wrong against the plan. Whether failure should be sticky per session or scoped to the offending invocation is a design choice.
- **Fix**: Record the failure per `tool_use_id` (or skip unrecognized Agent shapes) instead of one session-wide marker, and give `hooks.lock` stale-owner detection. Decide after the live run (row 2.4) shows which Agent shapes the interactive host actually emits.
- **Decision**: PENDING — owner decides whether session-wide fail-closed is the intended product behavior or should be narrowed; no clear in-scope fix without live evidence from rows 2.4 and 2.5.
