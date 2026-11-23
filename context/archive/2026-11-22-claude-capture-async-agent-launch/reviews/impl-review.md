<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Claude capture settles asynchronously launched Agent runs

- **Plan**: context/changes/claude-capture-async-agent-launch/plan.md
- **Scope**: Phases 1 and 2 of 3 (Phase 3, live requalification, is pending and not reviewed)
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Plan drift (sub-agent 1): every planned item of Phases 1 and 2 is MATCH; nothing MISSING. EXTRA items are benign (see F7).
- Safety review (sub-agent 2): no hole in the launch-only gate itself (root-only acceptance, ordering, contiguity, chain walk, duplicate request ids, request cap, other callers all sound). The material issues are scope: three relaxations apply to every agent in every run, not only the launched root. Probes: scratchpad `probe.mjs`, `probe2.mjs`.
- Automated gates run in main: `async launch: verifies` 6/6, usage suite 67/67, `async launch: unavailable` 8/8, capture/runner/late-usage/accounting/compare 133/133, no-recursive-delete 11/11, doc grep none found, ADR-018 Amendment 7 present, `version-check` OK, `commit-lint` OK, working tree clean. PR #274 checks: title, commits and Semgrep pass; the six test shards were pending at review time.
- Manual rows: Phase 3 rows 3.1-3.5 are unchecked (pending, not rubber-stamped).

## Findings

### F1 — Telemetry-only requests are counted for every agent, not only the launched root

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:347-350
- **Detail**: The branch for a request with no transcript entry runs for every agent of every run. Probe: a synchronous root with `telemetryOnly: true` is `verified` (155 tokens, 5 requests); a telemetry-only request on a leaf child is also `verified`. Before this change the request set was a strict equality (`exported.length !== native.size`). The plan and docs describe the rule for the launched root only ("the step agent's api_request events with no transcript entry"), so the code is broader than the documented contract.
- **Fix A ⭐ Recommended**: Gate the telemetry-only branch to the launched root (`launched`); every other agent keeps the strict equality.
  - Strength: Synchronous and nested paths behave exactly as before; matches the plan's "root only" decision and ADR-018 Amendment 7.
  - Tradeoff: A synchronous root that really has side queries stays `snapshot-mismatch`; none were observed live.
  - Confidence: HIGH — the live telemetry-only requests belong to the launched root, and the offline replay of all six steps still passes if the gate follows `rootLaunched`.
  - Blind spot: Headless runs were not captured; if they show side queries they stay unavailable until a separate change.
- **Fix B**: Keep the breadth, correct README/REFERENCE/ADR wording and add sync and child tests.
  - Strength: No code change.
  - Tradeoff: Weakens the pre-change strict set check for every run.
  - Confidence: MEDIUM — depends on whether any sync capture holds side queries.
  - Blind spot: Not verified against a headless capture.
- **Decision**: FIXED-QUEUED (Fix B: keep breadth, correct docs, add sync and child tests)

### F2 — A telemetry-only request adds unchecked tokens (forged count accepted)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:347-357
- **Detail**: A step-agent `api_request` that matches no transcript entry, placed before the agent's `subagent_completed`, is added to the total with no cross-check. Probe: one forged request of 1e9 input tokens gave `verified` at 1,000,000,188; 50 forged requests were accepted. The request-count cap is still enforced and a repeated request id is counted once. Only write access to the private capture can forge such a record, the same trust boundary as the hook records.
- **Fix A ⭐ Recommended**: Document it as an accepted trust assumption in docs/REFERENCE.md and ADR-018 Amendment 7, and add a test that the request cap still fires with telemetry-only requests.
  - Strength: Honest and cheap; a side query has no transcript to check, so no stronger check exists for those without a response event.
  - Tradeoff: The figure is verified against the capture's own integrity, not an independent record.
  - Confidence: HIGH — the same assumption already holds for hooks and telemetry.
  - Blind spot: The live capture had telemetry-only requests both with and without `assistant_response`; the split was not measured.
- **Fix B**: Require an `assistant_response` event for telemetry-only requests.
  - Strength: Ties each counted request to a response record.
  - Tradeoff: Live side queries without a response would turn the step `unavailable`, undoing part of the fix.
  - Confidence: LOW — contradicts the live replay evidence that some have none.
  - Blind spot: Not replayed.
- **Decision**: FIXED-QUEUED (Fix B: require an assistant_response for telemetry-only requests; check against the 2.1.323 replay first, see follow-ups)

### F3 — Null stop-hash fallback applies to every agent and accepts a tool-only final turn

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:185, 362
- **Detail**: `agent.stop.textHash ?? hash("")` is not scoped to the launched root. Probes: a synchronous root and a leaf child with no `last_assistant_message` and empty final text are `verified`. A launched step whose final assistant entry is only a `tool_use` block (an agent cut off mid-tool) is also `verified`, because the text hash drops non-text blocks; the stop-to-final-response link collapses to "the final entry has no text".
- **Fix A ⭐ Recommended**: Apply the null-hash fallback only to the launched root, and add a synchronous regression test (null stop on a sync root and on a child stays `incomplete-capture`).
  - Strength: Restores the old contract everywhere except the shape seen live.
  - Tradeoff: A sync run with a null stop hash is unavailable, as before.
  - Confidence: HIGH — the null hash was observed only on launched steps (2 of 6).
  - Blind spot: A launched step that ends on a tool call still verifies; `ended.total` and the transcript match are the remaining guards.
- **Fix B**: Also require the final entry to have no `tool_use` block when the stop hash is null.
  - Strength: Rejects the cut-off-mid-tool shape.
  - Tradeoff: Unverified whether the live null-stop steps end on a tool call; may reject a real run.
  - Confidence: LOW — the live final entries were not inspected for this.
  - Blind spot: Needs a check on the retained 2.1.323 capture.
- **Decision**: FIXED-QUEUED (Fix A: scope the null stop-hash fallback to the launched root, add sync regression tests)

### F4 — "Launch-only" is any non-completed status, not `async_launched`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:288; skills/10x-pipeline/scripts/claude-capture-data.mjs:146
- **Detail**: The projector folds every non-`completed` status to `"other"`, and the gate accepts any such root. Probe: a root with status `"error"` and a `totalTokens` value, ordered before completion, is `verified`. It is bounded (stop record, `subagent_completed`, transcript and total match must all agree), so no wrong figure results, but code comments, ADR-018 Amendment 7 and the docs all say `async_launched`.
- **Fix A ⭐ Recommended**: Keep the projection, reword the docs and comment to "any status other than completed", and add one test with a non-`async_launched` status.
  - Strength: Stays inside the plan's "no hook or projection changes" boundary and keeps bound captures readable.
  - Tradeoff: The gate is looser than its name; correctness rests on the other cross-checks.
  - Confidence: HIGH — those cross-checks were exercised by the negative tests.
  - Blind spot: The exact live status string is not retained in the capture (only inferred from the transcript).
- **Fix B**: Project `async_launched` explicitly and accept it in `validateProjectedNative`.
  - Strength: The gate matches the documented rule.
  - Tradeoff: Changes the capture schema and projection (out of scope); captures written by the old projector read differently.
  - Confidence: MEDIUM — needs a schema-version and migration decision.
  - Blind spot: Bound-capture compatibility not checked.
- **Decision**: FIXED-QUEUED (Fix A: keep the projection, reword comment/docs/ADR to 'any status other than completed', add a non-async_launched status test)

### F5 — Side queries not attributed to the step agent are ignored (undercount)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:296-300
- **Detail**: An `api_request` with no `agent_id` is skipped, so the figure undercounts rather than overcounts. This predates the change.
- **Fix**: State it as a known limit in docs/REFERENCE.md.
- **Decision**: FIXED-QUEUED (add known-limit sentence to docs/REFERENCE.md)

### F6 — A telemetry-only response uuid is not tied to a transcript entry

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:352
- **Detail**: A side query whose response `message.uuid` equals another transcript uuid still verifies. The response check requires only the same agent and a sequence before `ended`.
- **Fix**: Accept; no change.
- **Decision**: ACCEPTED (no change)

### F7 — Unplanned additions and a Phase 3 file created early

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/test/claude-helpers.mjs (`telemetryOnly: "response"`); skills/10x-pipeline/test/claude-usage.test.mjs (response test, flat-root test, "disconnected" test change); context/changes/claude-capture-async-agent-launch/evidence/live-requalification.md
- **Detail**: All benign: an extra fixture option and two extra tests; the "disconnected" mutation changed to `parentUuid: null` (needed by branch tolerance); a stricter unknown-parent check; and the evidence note exists although Phase 3 rows are open (it states the live rerun is not done and is not linked from the README).
- **Fix**: Record these in a plan addendum under Phase 1 so later reviews read the plan as ground truth.
- **Decision**: FIXED-QUEUED (plan addendum under Phase 1)

### F8 — Test gaps for the relaxed paths

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/claude-usage.test.mjs
- **Detail**: No test for: a synchronous root with telemetry-only requests; a child or sync root with a null stop hash; a non-`async_launched` non-completed status; the request cap with telemetry-only requests; a final assistant entry that is only `tool_use` with a null stop.
- **Fix**: Add the tests that match the decisions on F1-F4 (positive or negative, whichever the chosen fix makes true).
- **Decision**: FIXED-QUEUED (add tests matching F1-F4 decisions)
