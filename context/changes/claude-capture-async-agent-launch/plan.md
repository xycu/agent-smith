# Claude capture settles asynchronously launched Agent runs Implementation Plan

## Overview

Native Claude capture must settle the step runs of an interactive launcher session. In such a session the orchestrator's Agent call returns at launch (`async_launched`) and the step finishes later, so the collector's synchronous-Agent assumptions made every one of six live steps end `incomplete-capture` (then `snapshot-mismatch` or `ambiguous-history` behind that). This plan changes `collectClaudeUsage` to settle the root step run from `SubagentStop`, `subagent_completed` and the step transcript, keeps every synchronous-shape check for nested children, adds live-shaped fixtures, corrects the "headless evidence" wording, and ends with a live interactive requalification.

## Current State Analysis

The frame brief (`context/changes/claude-capture-async-agent-launch/frame.md`) settled the problem: the collector was built and tested against a hand-authored synchronous Agent shape (`test/claude-helpers.mjs:61`), so it cannot settle any interactive run on 2.1.311 or later. The version is not the cause. Live evidence is the 2.1.323 capture of the `live-capture-probe` run (six steps, all `incomplete-capture`).

Replaying that capture through a scratch copy of the collector showed four synchronous assumptions, plus one telemetry gap, all in `skills/10x-pipeline/scripts/claude-usage.mjs`:

- PostToolUse status must be `completed` (`claude-usage.mjs:178`). Live records carry the launch, never `completed`, and no `totalTokens`.
- The Agent `tool_result` must follow `subagent_completed` and lie within the contiguous event prefix (`:285-295`). For a launch, the result precedes completion.
- `SubagentStop.textHash` must be non-null and equal the final response's text hash (`:183`, `:347`). Two live stops had no `last_assistant_message`, so the hash is null. The final request is chosen by `assistant_response` events (`:341`), which tool-only final turns lack.
- Every transcript entry must lie in the final UUID chain (`:358`). The live transcripts hold branches (attachments, side entries).
- Request-set equality (`:332`) rejects steps 3 to 6 because telemetry holds `api_request` events with no transcript entry (side queries, possibly the auto-mode classifier).

A prototype in the scratchpad with those relaxations verified all six live steps (steps 1 and 2 on the first four fixes; steps 3 to 6 once telemetry-only requests were counted or excluded). The user chose to count them.

## Desired End State

An interactive launcher run on Claude Code 2.1.311 or later whose steps launch in the background settles to `verified` figures when the capture is complete, with the step total equal to the sum of every request of the step agent. A synchronous, fully reconciled capture keeps verifying exactly as before. Any missing or conflicting record still yields an unavailable figure with a bounded reason. README, `docs/REFERENCE.md` and ADR-018 state what the evidence really is, and a live interactive rerun of the probe confirms it.

### Key Discoveries:

- Interactive Agent calls launch in the background by design: the 2.1.311 Agent tool "states that subagents run in the background and notify on completion" (`context/archive/2026-11-12-agent-call-parameters/change.md:18`), and anti-stall rule 1 already treats the launch notice as normal (`docs/REFERENCE.md:594-603`).
- Hook docs: a background `tool_response` is `{status: "async_launched", agentId, description, prompt, outputFile, resolvedModel}` with no usage fields; `SubagentStop.last_assistant_message` is the closing text "if any".
- `subagent_completed.total_tokens` equals the final transcript request's bucket sum, while the step total sums every request; the collector already checks both (`claude-usage.mjs:359-360`).
- `claude-capture-data.mjs:143-147` folds any non-`completed` status to `"other"`, so the projection is already sufficient; `projectNative` needs no change.
- ADR-018 forbids nested subagents, so only the root run can be asynchronous; children launched by a step stay awaited foreground calls.
- The 2.1.311 fixtures were hand-authored, not captured (`context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md:7`), so "headless evidence" in `README.md:162` and `docs/REFERENCE.md:464` overstates the floor's basis.

## What We're NOT Doing

- No change to the launcher, the hook or the projection (`claude-capture.mjs`, `claude-capture-data.mjs`), no change to the version floor value (2.1.311), and no version ceiling.
- No change to routing, policy, SKILL.md or prompts. The router still treats the launch notice as today.
- No committed real transcripts or capture logs. Fixtures stay synthetic, shaped after the live record shapes.
- No async acceptance for nested children, and no relaxation of identity, process, session, version or duplicate/conflict checks.
- No attempt to classify telemetry-only requests (for example by retaining `query_source`); the undocumented attribute is out of scope.
- No change to `claude-token-figures-default` rows 2.4 and 2.5 here; they are closed by the owner after Phase 3.

## Implementation Approach

Settle the root run from what the interactive host really delivers, and keep the collector fail-closed everywhere else. Each relaxation is the narrowest one that the live capture requires, tied to a positive condition rather than to a missing record:

- A launch-only root PostToolUse is accepted only for the invocation's own root run (parent `null`, run id equal to the invocation). Nested runs still require `completed`.
- Ordering for a launched root: the Agent `tool_result` precedes `subagent_completed`, and the contiguous prefix extends to `subagent_completed`.
- A null `SubagentStop.textHash` matches only a final assistant response with empty text.
- The final request is the transcript-matched request with the highest `api_request` sequence, not the one with an `assistant_response`.
- Chain membership: every assistant entry must be in the final chain; other entries (attachments, user side entries) must reach it through parents.
- Telemetry-only `api_request` events of the step agent with a sequence before `subagent_completed` are counted in the step total. A transcript request without telemetry still fails.

Tests come with the code: a live-shaped async fixture plus negative variants, then the synchronous suite unchanged as the regression bar.

## Critical Implementation Details

- **State sequencing** — The synchronous check `ended.sequence >= returned.sequence` and the launched check `returned.sequence >= ended.sequence` are mirror images. Choose by whether the root PostToolUse carries `completed`, never by host version, and never let a launched root skip the `subagent_completed` requirement.
- **Timing & lifecycle** — The contiguity loop (`claude-usage.mjs:287`) runs to `terminalSequence`. For a launched root, `terminalSequence` is the launch result and the run's later events matter, so the bound moves to `ended.sequence` for the root. Moving it for synchronous runs would weaken the check; keep both paths.

## Phase 1: Collector settles async root launches

### Overview

Change `collectClaudeUsage` and add fixtures and tests so the live-shaped async capture verifies, and every synchronous and negative case behaves as before.

### Changes Required:

#### 1. Root-only async settlement

**File**: `skills/10x-pipeline/scripts/claude-usage.mjs`

**Intent**: Accept a launch-only PostToolUse for the invocation's root run and settle that run from `SubagentStop`, `subagent_completed` and its transcript.

**Contract**: In `addAgent` (`:175-186`), the status check allows non-`completed` only when `runId === invocation.runId` and `pre.parent === null`. In the ordering block (`:292-299`), the root launched case requires `returned.sequence < ended.sequence`; the synchronous case keeps `ended.sequence < returned.sequence <= terminalSequence`. The contiguity bound (`:287`) is `ended.sequence` of the root when the root launched, `terminalSequence` otherwise. `terminalSequence` is still the one successful Agent `tool_result` of the root run, and a duplicate still fails `ambiguous-history`. The PostToolUse `totalTokens` equality (`:360`) stays conditional on the field being present.

#### 2. Stop text and final request

**File**: `skills/10x-pipeline/scripts/claude-usage.mjs`

**Intent**: Stop requiring a non-null stop hash and stop depending on `assistant_response` to find the final request.

**Contract**: `addAgent` no longer fails when `stop.textHash` is null (`:183` keeps the `file` checks). The final request is the transcript-matched request with the highest `api_request` sequence for that agent (`:335-345`). The final entry check (`:346-347`) compares `last.textHash` with `agent.stop.textHash ?? hash("")`, so a null stop hash matches only an empty final text. The `ended.total` check (`:359-360`) is unchanged.

#### 3. Chain membership and telemetry-only requests

**File**: `skills/10x-pipeline/scripts/claude-usage.mjs`

**Intent**: Tolerate branches and side queries that the live host writes, without admitting an unaccounted assistant response.

**Contract**: Replace `visited.size !== entries.size` (`:358`) with: every `assistant` entry is in `visited`, and every other entry reaches `visited` through its parent links with no cycle; otherwise `ambiguous-history`. Replace `exported.length !== native.size` (`:332`) with: every transcript request of the agent has telemetry (`snapshot-mismatch` otherwise); telemetry requests without a transcript entry, with `observed.sequence < ended.sequence`, add their counts to the step total and to `requestCount`; one at or after `ended.sequence` still fails `ambiguous-history`. Existing `snapshot-mismatch` for differing counts, request identity or message identity stays.

#### 4. Live-shaped fixtures

**File**: `skills/10x-pipeline/test/claude-helpers.mjs`

**Intent**: Let `claudeUsageFixture` emit the interactive wire shape in addition to the synchronous one, and say so in the header.

**Contract**: A new option (for example `async: true`) emits a PostToolUse whose `tool_response` is `{status: "async_launched", agentId}` without `totalTokens`, places the Agent `tool_result` before `subagent_completed`, can omit `last_assistant_message` (null stop hash) with an empty-text final request, adds a transcript branch (an attachment off the chain), and can add a telemetry-only `api_request` for the step agent. Default output stays byte-for-byte the synchronous shape. The header comment states which shapes are hand-authored and which follow the live 2.1.323 capture. The helper file registers no tests.

#### 5. Collector tests

**File**: `skills/10x-pipeline/test/claude-usage.test.mjs`

**Intent**: Cover the async settlement and the boundaries that must still fail.

**Contract**: New test titles start with `async launch: verifies` for positive cases and `async launch: unavailable` for negative ones, so the Success Criteria select them by name. Add tests for: async root verifies with the expected total (all requests, including a telemetry-only one); null stop hash with empty final text verifies and with non-empty final text is `incomplete-capture`; tool-only final request settles by sequence; a branch attachment verifies and an assistant entry off the chain is `ambiguous-history`; a transcript request without telemetry is `snapshot-mismatch`; a telemetry-only request at or after `subagent_completed` is `ambiguous-history`; a launch-only status on a nested child run is `incomplete-capture`; a launch without `subagent_completed` or without `SubagentStop` is `incomplete-capture`; a launch whose result follows completion is `incomplete-capture`. Rework the second half of "tool-only requests still require complete membership and a terminal assistant response" (`:173`), which asserts `incomplete-capture` for a missing terminal assistant response, to the new rule while keeping the missing-telemetry half. Existing synchronous tests, including "an extra assistant response cannot hide an unaccounted request" (`:122`) and "equal sums with different request membership are unavailable" (`:115`), stay and still pass.

#### 6. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Keep the index row for `claude-usage.test.mjs` accurate.

**Contract**: The row at line 69 mentions "native 2.1.311 capture"; extend it to name the interactive async-launch settlement. `claude-helpers.mjs` row (line 70) notes both fixture shapes.

### Success Criteria:

#### Automated Verification:

- The live-shaped async fixture settles to `verified`: `node --test --test-name-pattern="async launch: verifies" skills/10x-pipeline/test/claude-usage.test.mjs`
- The synchronous fixtures still verify and keep their failure reasons: `node --test skills/10x-pipeline/test/claude-usage.test.mjs`
- Negative async cases stay unavailable with bounded reasons (nested child launch-only, missing stop, missing completion, off-chain assistant, uncovered transcript request, late telemetry-only request): `node --test --test-name-pattern="async launch: unavailable" skills/10x-pipeline/test/claude-usage.test.mjs`
- Producer-to-reader, launcher, late-usage, intake and comparison paths pass: `node --test skills/10x-pipeline/test/claude-capture.test.mjs skills/10x-pipeline/test/claude-runner.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/accounting-readers.test.mjs skills/10x-pipeline/test/compare.test.mjs`
- No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- Replaying the live 2.1.323 capture through the changed collector reports `verified` for all six steps, with step totals above the `subagent_completed` figures only by the counted telemetry-only requests. Before implementing, copy the three capture files (`hooks.jsonl`, `otel.jsonl`, `binding.json`) from the session scratchpad to a durable folder outside the repository (for example `$HOME/agent-smith-captures/2.1.323/`, mode 700) and replay from there; they stay uncommitted.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

#### Addendum (2026-11-23, implementation review)

- Implemented beyond the plan text: the fixture option `telemetryOnly: "response"` (a telemetry-only request with its own response event), tests for a flat async root, a synchronous root and a child with a telemetry-only request, and an unknown-parent failure in the chain walk.
- The existing "disconnected attachment history" test now mutates `parentUuid: null`, because a cloned branch that reaches the chain is accepted by design.
- Decided in review: a telemetry-only request must carry its own response event from the same agent (verified against all six 2.1.323 steps); the null stop-hash fallback applies to the launched root only; the launch gate is any status other than `completed`, because the projection folds `async_launched` and the rest into one value.
- `evidence/live-requalification.md` was created early with the offline replay; Phase 3 rows stay open until the interactive rerun.

## Phase 2: Docs match the evidence

### Overview

State what the collector now accepts and what the floor actually rests on, and record the amendment.

### Changes Required:

#### 1. README accounting paragraph

**File**: `README.md`

**Intent**: Replace "backed by headless evidence" at line 162 with the true basis and name the interactive async path.

**Contract**: The paragraph says the 2.1.311 format rests on documented shapes and sanitized replay fixtures, that interactive launcher steps launch in the background and are settled from the stop and completion records, and that live interactive qualification is still pending (no link to evidence that does not exist yet; Phase 3 updates the sentence). It still says a record shape the collector does not recognize yields an unavailable figure.

#### 2. Routing reference

**File**: `docs/REFERENCE.md`

**Intent**: Describe the settlement rules where the capture is documented (around lines 455-470) and correct the floor wording at line 464.

**Contract**: Add the root-only async rule, the ordering, the null-stop-hash rule, the final-request rule, the branch tolerance and the telemetry-only request counting, in the existing prose style. Remove "retained headless evidence" as the floor's sole basis. Leave the anti-stall section (`:594-612`) unchanged unless a statement there conflicts; it describes orchestrator behavior, not capture.

#### 3. ADR-018 amendment

**File**: `docs/ADR/ADR-018-no-nested-subagents.md`

**Intent**: Record Amendment 7 after Amendment 6 (`:131`).

**Contract**: Date 2026-11-22. States that interactive Agent calls launch in the background, that the collector settles the root run from stop and completion records, that nested children remain synchronous per Amendment 3, and that Amendment 6's floor stays 2.1.311 with its evidence wording corrected.

### Success Criteria:

#### Automated Verification:

- No claim of headless evidence as the floor's basis remains: `grep -nE "backed by headless evidence|retained headless evidence" README.md docs/REFERENCE.md` prints nothing
- Amendment 7 exists after Amendment 6: `grep -n "^## Amendment 7" docs/ADR/ADR-018-no-nested-subagents.md`
- Version fields stay equal: `node tools/version-check.mjs`
- Commit subjects lint: `node tools/commit-lint.mjs main..HEAD`

#### Manual Verification:

- The three documents read consistently with each other and with the shipped collector rules, and name no routing literals in the SKILL files.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Live requalification

### Overview

Prove the change on the host that failed: rerun the probe through the interactive launcher and record the result. Manual only.

### Changes Required:

#### 1. Interactive rerun and evidence note

**File**: `context/changes/claude-capture-async-agent-launch/evidence/live-requalification.md`

**Intent**: Record a sanitized account of one complete interactive launcher run of the probe project with the fixed collector.

**Contract**: Names the Claude Code version, the six step descriptors' outcomes (verified or the bounded reason), each step's total against the notification's `subagent_tokens`, and the count of telemetry-only requests per step. No transcript text, prompts or capture logs.

#### 2. Late-recheck result

**File**: `context/changes/claude-capture-async-agent-launch/evidence/live-requalification.md`

**Intent**: Close the open question of why the earlier live recheck returned `unsupported-schema` while an offline replay returned `incomplete-capture`.

**Contract**: After the run, repeat the late `usage` recheck the earlier run did and record the outcome. If it again returns `unsupported-schema`, record the descriptor and the raising line so a separate change can fix it.

#### 3. Docs state the recorded qualification

**File**: `README.md` and `docs/REFERENCE.md`

**Intent**: Replace the "live qualification pending" sentence of Phase 2 with the recorded result.

**Contract**: Same sentences as Phase 2 (README accounting paragraph; REFERENCE capture section), now stating the outcome and the Claude Code version qualified. Link the evidence note only if the link will still resolve after the change is archived (use the archive path the owner confirms); otherwise state the result without a link.

### Success Criteria:

#### Manual Verification:

- An interactive launcher run on current Claude Code ends every step with `verified` evidence and no `incomplete-capture`.
- Each step's verified total is explained by its `subagent_completed` figure plus counted telemetry-only requests.
- The late recheck returns `verified`, or its `unsupported-schema` is recorded with a raising line for a follow-up change.
- README and `docs/REFERENCE.md` state the recorded live qualification, with no link that archive would break.
- The owner has the evidence note to decide rows 2.4 and 2.5 of `claude-token-figures-default` and the archive of that change.

**Implementation Note**: After completing this phase, pause for the human to review the evidence note before the change is reviewed or archived. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Async root settlement, null stop hash with empty text, tool-only final request, branch attachment, telemetry-only counting.
- Every fail-closed boundary listed in Phase 1 item 5, each with its bounded reason.
- The unchanged synchronous suite as the regression bar.

### Integration Tests:

- `claude-capture.test.mjs` and `claude-runner.test.mjs` keep the producer-to-reader path green.

### Manual Testing Steps:

1. Replay the saved 2.1.323 capture through the changed collector (Phase 1).
2. Run the probe through the interactive launcher on current Claude Code and inspect `status <id> --report` figures (Phase 3).
3. Repeat the late `usage` recheck and compare with the notification figures.

## Performance Considerations

None. The collector reads the same bounded files; the chain walk stays linear and limits are unchanged.

## Migration Notes

No stored data changes. A figure already recorded unavailable stays unavailable; the late `usage` command can attach a verified figure to a step whose capture is still present.

## References

- Frame brief: `context/changes/claude-capture-async-agent-launch/frame.md`
- Collector: `skills/10x-pipeline/scripts/claude-usage.mjs:175-186`, `:285-299`, `:331-360`
- Projection: `skills/10x-pipeline/scripts/claude-capture-data.mjs:125-147`
- Fixtures and tests: `skills/10x-pipeline/test/claude-helpers.mjs:17-96`, `skills/10x-pipeline/test/claude-usage.test.mjs:115-185`
- Prior evidence: `context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md`, `context/archive/2026-11-12-agent-call-parameters/change.md`
- Hotfix: `docs/ADR/ADR-018-no-nested-subagents.md` Amendment 6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Collector settles async root launches

#### Automated

- [x] 1.1 The live-shaped async fixture settles to verified — 5c4efda5
- [x] 1.2 The synchronous fixtures still verify and keep their failure reasons — 5c4efda5
- [x] 1.3 Negative async cases stay unavailable with bounded reasons — 5c4efda5
- [x] 1.4 Producer-to-reader, launcher, late-usage, intake and comparison paths pass — 5c4efda5
- [x] 1.5 No recursive delete was introduced — 5c4efda5

#### Manual

- [x] 1.6 Replaying the saved live 2.1.323 capture verifies all six steps — 5c4efda5

### Phase 2: Docs match the evidence

#### Automated

- [x] 2.1 No claim of headless evidence as the floor's basis remains — 971f29eb
- [x] 2.2 Amendment 7 exists after Amendment 6 — 971f29eb
- [x] 2.3 Version fields stay equal — 971f29eb
- [x] 2.4 Commit subjects lint — 971f29eb

#### Manual

- [x] 2.5 The three documents read consistently with each other and with the collector rules — 971f29eb

### Phase 3: Live requalification

#### Manual

- [x] 3.1 An interactive launcher run ends every step with verified evidence
- [x] 3.2 Each step's verified total is explained by its completion figure plus counted telemetry-only requests
- [x] 3.3 The late recheck returns verified, or its unsupported-schema is recorded with a raising line
- [x] 3.4 README and REFERENCE state the recorded live qualification
- [x] 3.5 The owner has the evidence note to decide rows 2.4 and 2.5 and the archive of claude-token-figures-default
