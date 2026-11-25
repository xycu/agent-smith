<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Native Claude step usage implementation plan

- **Plan**: context/changes/claude-usage-descriptor-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-25
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

- Diff reviewed: `8ceeddab..66d2ce3a` (commits 5bc43a95, ba4158f8, 16c9a593, 8baec0e1), 37 files.
- Phase 1: `route.mjs` records `pendingCapture` at dispatch through `claudeDispatchBinding` (transcript session or telemetry checkpoint). `neutralRetry` refreshes it. `attachResult` builds the descriptor with `claudeAttemptInput` and calls the adapter that `route.mjs` loads with an optional dynamic import. It strips step-authored identity and accounting, and the legacy branch keeps the old contract for pending rows that lack the new record. `flow.mjs` has no static import of the collector modules, so the module order rule in AGENTS.md still holds. The transcript reader rejects a root launch older than the attempt start or the last neutral retry, rejects a resumed root, and keeps the Agent response counters only for a completed return. The telemetry reader refuses an ambiguous agent ID.
- Phase 2: `claude-usage.mjs:main` isolates the JSON parse and returns `invalid-json` with source `unknown`. `--agent-id` is validated with `claudePathId` before any source lookup. `status` emits `collectorInput` only for completed native rows that have unavailable evidence, an attributable invocation and a qualified version. `usageCommand` refuses an unknown version. The archive action carries a bounded `collectorInput`.
- Phase 3: both SKILL loops pass `--agent-id` to `next`, forward the router-supplied input for archive and late recheck, and no longer describe the descriptor. Sizes: 30975 bytes (10x, from 32377) and 35327 bytes (OpenSpec, from 36873). AGENTS.md, README, REFERENCE and ADR-018/019 amendments are updated. A grep of active docs found no leftover numbered-step checkpoint or descriptor instructions.
- Automated criteria: `node --test --test-concurrency=2` on result-persist, claude-usage, accounting-readers, init-usage, route, late-usage, archive (10x), openspec-archive, skill-loop, openspec-skill and agents-md-size: 506 pass, 0 fail, both before and after the fix. Full suite left to CI.
- Manual criterion 3.2 is unchecked and pending. It needs a live background native step on a qualified Claude host, and `evidence/unproven.md` records why the unattended step could not prove it. It is not rubber-stamped.

## Findings

### F1 — Observed agent ID turns a malformed descriptor invocation into an object

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:62
- **Detail**: With `--agent-id`, `collectClaudeUsage` merged the ID with `{ ...descriptor.invocation, agentId }`. A non-object invocation from stdin (`null`, a string, an array) became a valid-looking object. A string spreads into indexed keys, so the transcript check `!object(observed)`, which rejects it without an ID, was bypassed. Router-built inputs always use an object or omit the field, so only hand-written collector input could reach this. Source proofs still applied, so no misattribution was shown. It is still a validation gap at the stdin trust boundary.
- **Fix**: Return `missing-identity` before merging when `descriptor.invocation` is present but not an object, and extend the malformed-observation test.
- **Decision**: APPLIED in e1e10239. The guard now rejects a present non-object invocation. The test `a malformed launch observation never opens a source or becomes accounting identity` covers `null`, a string and an array in both modes, and fails when the guard is removed.
