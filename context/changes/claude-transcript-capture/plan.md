# Native Claude Transcript Capture Implementation Plan

## Overview

Restore ordinary Claude Code sessions as the default way to run either Agent Smith chain. Measure native Agent steps from their local session transcripts and report that measurement as transcript evidence. Keep the launcher available for telemetry verification.

## Current State Analysis

Since v1.17.0, the native Claude preflight requires the launcher by default. The collector uses launcher or explicitly authorized hook and OTLP evidence, so an ordinary session cannot produce a token figure through the existing path. The owner chose a distinct evidence status for transcript figures because requests visible only to telemetry can make the transcript sum incomplete. [Research](research.md)

### Key Discoveries:

- The live sample identifies the session through `CLAUDE_CODE_SESSION_ID`. Claude stores agent JSONL and corresponding metadata beside one another. The metadata supplies the parent Agent tool-use ID, depth, description and completion marker. The enclosing transcript independently contains the Agent call. [Transcript evidence](research.md#transcript-evidence-bounded-sample)
- Streamed assistant records can repeat the same `message.id` with the same counters. The four top-level counters match the existing Claude reader. Foreground return figures cover the final request. [Collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs) · [Research](research.md#transcript-evidence-bounded-sample)
- Result normalization, coverage, late attachment and the human reports currently recognize a single measured status. Reuse the descriptor-based stable file readers and the existing late-attachment and report-rebuild path. [Accounting](../../../skills/10x-pipeline/scripts/usage.mjs) · [Router](../../../skills/10x-pipeline/scripts/route.mjs)

## Desired End State

Ordinary native Claude sessions pass `init` when the current session transcript can be located safely and read. Once an awaited native Agent invocation settles, its attributable transcript tree yields a numeric total with `usageEvidence.status: "transcript"`. Missing or unreliable evidence yields a bounded reason and preserves independent figures. Setting `claudeCapture.mode: "telemetry"` opts into the launcher readiness and verification workflow. Status, compare and the terminal report expose transcript scope and its possible undercount.

## What We're NOT Doing

Scope is local native Agent accounting for fresh invocations, including one nested child layer. Existing Codex and headless Claude runners, historical ledgers, and archived artifacts are outside the implementation scope. Release classification remains an owner decision.

## Implementation Approach

Land the evidence contract and its consumers first, then the bounded transcript reader, then policy and integration for both chains. The router owns capture mode and run state. The host supplies invocation observations, and the collector returns sanitized accounting for the host to attach through the existing result gate.

### Planning assumptions

- **Explicit mode and startup readiness.** Use the issue's two-value mode and keep `require` as a check on the selected source. Treat a unique readable current-session main transcript as ready even before Claude creates `subagents/`. This supports a first dispatch and uses the session ID and configurable root observed in research. Treat a missing, ambiguous or unsafe current-session transcript as unusable, with an opt-out for preflight. [Change notes](change.md) · [Research readiness findings](research.md#open-questions)
- **Evidence and late attachment.** Use `transcript` as the status, `claude-transcript` as the source and `transcript-messages` as the reconciliation value. Permit same-source late attachment with full recorded identity and version. This follows the existing missing-only enrichment contract and keeps telemetry claims distinct. [Owner decision](research.md#follow-up-2026-11-24-evidence-status-decision) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
- **Comparison verdict.** Keep observed transcript figures visible and withhold the existing token-savings verdict when either side includes them. The exact-token target uses whole-run figures, and the amount of usage omitted from transcripts can differ between the two sides. [Comparison contract](../../../docs/REFERENCE.md#observed-token-accounting) · [Observed side queries](research.md#summary)
- **Host qualification and completion.** Reuse the 2.1.311 version floor and fail closed on unsupported record shapes. Derive the version from attributed records when the host descriptor omits it, and reject disagreement. Require `finished: true` throughout the tree. Use the existing once-only terminal recheck for delayed writes. The bounded sample establishes record shapes and the absence of a completion marker on unfinished agents. Resumed history and deeper delegation lack equivalent evidence. [Research](research.md#transcript-evidence-bounded-sample) · [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md)

## Phase 1: Represent transcript evidence across accounting

### Overview

Give transcript totals an explicit schema and preserve that attribution from intake through late attachment and every report.

### Changes Required:

#### 1. Evidence normalization and coverage

**Files** `skills/10x-pipeline/scripts/{usage,claude-capture-data}.mjs`

**Intent** Accept measured transcript totals alongside existing verified, unavailable and legacy shapes.

**Contract** Keep schema version 1 and scope `step-tree`. The measured transcript form requires status `transcript`, source `claude-transcript`, reconciliation `transcript-messages`, exact Claude invocation identity, recognized host version, positive bounded `sessionCount` (agents), positive bounded `requestCount` (distinct counted messages), and a nonnegative safe integer total. Keep the verified tuples strict. Transcript unavailable evidence uses the same source and fixed reasons, retaining only established identity and version. `tokenScope` and `usageCoverage.transcript` expose the new status. Malformed evidence drops only the token figure through existing normalization.

Use the same Claude version qualification predicate at transcript collection and measured-evidence normalization. Make it available without a `usage.mjs` → `claude-capture-data.mjs` dependency since capture data already imports the bounded reader. Preserve the existing capture-data exports and accepted verified evidence.

#### 2. Intake, late attachment and reporting

**Files** `skills/10x-pipeline/scripts/{route,flow}.mjs`

**Intent** Propagate transcript scope anywhere token figures are reported or consumed.

**Contract** Accept a normalized transcript measurement from the existing result intake and structured late `usage` path. Late attachments must match recorded step, source, host version and exact invocation. Existing token values and evidence remain immutable, with the existing identical replay behavior. Preserve numeric-flag refusal, independent counters, report rebuild and archive-state commit/rollback safeguards. Include transcript totals in existing measured subtotals and routing-rate estimates, and label reports and comparisons with any transcript coverage as potentially incomplete. Preserve zero versus missing, overflow handling, failed-attempt inclusion and the existing model/tier/provider grouping. Expose transcript coverage in status and compare JSON and in human-readable reports and comparisons, including transcript-only runs. Preserve all legacy and verified ledger bytes on reads.

In `compare`, keep per-side figures and coverage and withhold the existing savings verdict (`comparable: false`, `dropPercent: null`, `verdict: "not comparable"`) in both formats whenever either side has transcript measurements, including under `--unpinned`. Use `usage-scope-mismatch` when transcript figures mix with verified or legacy figures within or across the sides, and `transcript-usage-scope` when the measured figures are all transcript-sourced. Keep verdict rules for pairs without transcript measurements.

Register `claude-transcript` in the report source labels so unavailable evidence has fixed, source-specific guidance. Put the transcript undercount disclosure near the report title with the existing capture limitations so it survives capped report excerpts. Keep the transcript count in the coverage section as well.

### Success Criteria:

#### Automated Verification:

- Evidence normalization distinguishes transcript, verified, unavailable and legacy records and rejects inconsistent tuples.
- Status, report, compare and cost tests cover a transcript-only run and mixed evidence with zero and missing figures without rewriting historical entries.
- Structured late usage attaches a missing transcript total for the same invocation, refuses mismatched and conflicting evidence without mutation, and preserves existing retry and report behavior.

## Phase 2: Collect a bounded transcript tree

### Overview

Resolve the current Claude session and measure the requested Agent invocation from stable local records.

### Changes Required:

#### 1. Session discovery and scoped reads

**Files** `skills/10x-pipeline/scripts/{claude-usage,claude-capture-data,usage}.mjs` or a transcript-specific module imported by the collector and preflight

**Intent** Give collection and preflight a shared session resolver without relying on the run worktree's path encoding.

**Contract** Use the local `projects` directory under `CLAUDE_CONFIG_DIR` or `~/.claude`, and require a path-safe current `CLAUDE_CODE_SESSION_ID`. Any descriptor session ID must agree. Find exactly one canonical project entry with the exact `<sessionId>.jsonl` file, including when Claude was launched from a different worktree. Bound the one-level directory scan by entry count and deadline, inspect only the requested session, and refuse ambiguity, symlinks or unsafe file types on the selected source path. A startup probe verifies the main file is readable without parsing its whole history or requiring a subagents directory. Collection uses exact session-relative paths and descriptor-based stable bounded reads for the main JSONL, agent JSONL and adjacent metadata JSON, which may lack a trailing newline. Charge all collection reads and traversal to shared elapsed, byte, record, agent and request budgets. Use fixed error codes and keep raw records and source paths out of evidence.

Iterate project and metadata directory entries incrementally with bounded counts. Pass one absolute collection deadline and the remaining byte budget through every read, including metadata JSON through `readBoundedFile`. For readiness, reuse the launcher probe's descriptor pattern: open with no-follow and nonblocking flags, verify the same regular file, and tolerate ordinary appends to the active main file. Keep stability checks for evidence reads.

#### 2. Invocation membership and totals

**Files** `skills/10x-pipeline/scripts/claude-usage.mjs` and its transcript reader

**Intent** Attribute a fresh invocation and its nested agents while avoiding duplicate messages and unrelated transcripts.

**Contract** Anchor the root on the returned Agent ID and validate depth 1, the exact router description, the metadata tool-use ID and the corresponding Agent call in the current session's main transcript. Any observed tool-use ID must match. Where the host omits it, use the metadata ID only after matching that exact parent call. Missing returned Agent ID or ambiguous evidence yields unavailable. For depth 2, cross-check each distinct Agent launch in the parent transcript with the corresponding child metadata, its `parentAgentId`, tool-use ID and returned child identity when present. A missing, unfinished or mismatched launched child makes the tree unavailable. Use a bounded metadata lookup and read usage records only for matched agents. Exclude unrelated agents and reject ambiguous membership, resumed histories and deeper launches in the attributed tree. Match referenced Agent calls by observed IDs or their exact metadata cross-links and never select by description, modification time or file order alone. Reuse the numbered and archive description conventions.

Prove both boundaries for each measured agent. Match the fresh launch prompt to the transcript's launch user record and follow the UUID/parent lineage between that start and the final assistant record corroborated by the matched settled parent Agent return. Use recognized final-request evidence from that return for corroboration only. Identical counters cannot resolve competing terminal records. Deduplicate repeated displays of the same tool-use ID and reject conflicting launches or returns. Reject explicit resume, reuse of an attributed agent ID (including `SendMessage` to it), and usage-bearing records outside the proved lineage or after the matched return. When the available records cannot establish the fresh and settled boundaries, return unavailable with `ambiguous-history` or `incomplete-capture`.

Require `finished: true` for each measured agent and stable matching session, agent and version fields on relevant transcript records. For the attributed tree, count each assistant `message.id` once, require duplicates to agree in owner, counters and request ID where present, and sum the four existing top-level buckets with safe-integer overflow checks. Recognized all-zero Claude synthetic placeholders do not contribute usage. Require at least one countable assistant message. Retain proved invocation/version on unavailable results when known so a recheck after settlement can attach the result. Exercise the transcript path via a host descriptor with `mode: "transcript"`. Its sources come from the current session resolver. The launcher and authorized explicit-source paths continue using the existing verification logic.

Establish the full root identity and qualified version from trusted observations or matching root records before the completeness checks when those records are available. This lets delayed completion or child writes produce useful late-attachment evidence. Leave tokens absent when the exact invocation or version cannot be established on the first pass, which makes that entry ineligible for late attachment.

### Success Criteria:

#### Automated Verification:

- Deterministic Claude fixtures produce exact totals for fresh flat, nested and archive invocations, including repeated messages, synthetic placeholders and unrelated sibling agents.
- Deterministic Claude fixtures refuse ambiguous sessions and invocations, wrong or missing children, unfinished or resumed agents, conflicting counters, unsafe or changing files and exhausted budgets without attaching an incomplete tree total.
- Existing launcher-bound and explicit-source telemetry fixtures still exercise exact request reconciliation.

## Phase 3: Make transcript mode the default in both chains

### Overview

Select the source in router policy, wire it through native execution and document the user-visible behavior.

### Changes Required:

#### 1. Mode selection and init

**Files** `skills/10x-pipeline/{policy.json,scripts/{state,init-usage,route,flow,isolation}.mjs}` as applicable to the native dispatch and archive builders

**Intent** Allow ordinary native Claude runs to start without launcher hooks and keep a deliberate telemetry opt-in.

**Contract** Default `claudeCapture.mode` to `transcript` and accept only `transcript` and `telemetry`. Keep `require:true` as the shipped default and preserve existing policy validation and provenance ownership. Have the router emit `claudeCaptureMode` on native Claude `run` and `archive` actions and persist it on numbered native entries before dispatch. Use current policy for new dispatches. For a neutral replay, use the saved mode for both `init` readiness and the re-emitted action, including after a policy edit. Treat pre-change native actions and pending entries without a mode as telemetry and preserve the untagged collector descriptor behavior for launcher binding and authorized explicit sources. Keep the external runner action contracts unchanged. Use one selected-source readiness result for the `init` gate and advisory. With `require:true`, a conclusively unusable selected source halts before run-state writes. Use mode-specific recovery and opt-out text. With `require:false`, keep advisory behavior. Preserve the Codex-host, headless-Claude, non-Claude-neutral-replay and indeterminate-readiness exemptions. Preflight only establishes source readiness.

#### 2. Collection and late recheck in both skills

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md` and `skills/10x-pipeline/scripts/claude-usage.mjs`

**Intent** Use the same source and invocation for immediate collection and eligible late rechecks.

**Contract** Forward the router action's capture mode and available native IDs in the descriptor after foreground settlement, including archive. Take the pre-dispatch launcher checkpoint for telemetry mode. Reject telemetry inputs on an explicitly transcript descriptor so the mere presence of launcher evidence cannot change the selected mode. Preserve the child-authored-accounting replacement, ownership gates and anti-stall parity. Pass measured transcript figures through the same intake as verified figures. Recheck a settled numbered step with missing tokens once before terminal work. Choose the collector mode from recorded evidence source (`claude-transcript` or `claude-native` with a native invocation) and require the same qualified host version, exact invocation and original source. Skip recheck if the required recorded identity or version is missing. Retain the structured run-root payload cleanup and no-polling behavior. Archive-agent usage is final-message-only and includes its evidence scope.

#### 3. Documentation and local verification

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/{README,ADR-018-no-nested-subagents,ADR-019-late-usage-figure}.md`, and relevant test files under `skills/10x-pipeline/test/`

**Intent** Explain startup, opt-in and coverage for both sources at install, contract and architectural decision points.

**Contract** Document mode examples, the meaning of `require:false`, the evidence tuple, observed transcript limits, comparison verdict eligibility, telemetry verification and same-source late recheck. Search live docs, both skills and tests for launcher-required/default wording and the former coverage shape. Amend ADRs and update the ADR index while retaining historical decisions. Update the test index if adding a new file.

### Success Criteria:

#### Automated Verification:

- Local CLI fixtures show both chains start in an ordinary ready session, halt without writes for an unusable required source, honor opt-out and telemetry mode, and preserve validation and preflight exemptions.
- Native dispatch, neutral retry, archive and skill-loop checks preserve source selection, identity and output ownership across both chains.
- Targeted accounting and policy regressions pass on Node 24 and live docs agree with the shipped default and evidence contract.

#### Manual Verification:

- In an ordinary qualified Claude Code session without the launcher, complete a native Agent step and confirm transcript evidence in status and the rendered report.
- In a fresh launcher session with telemetry mode selected, complete a native Agent step and confirm verified request-record evidence in status and the rendered report.

**Implementation note.** Leave live host checks pending until qualified sessions are available. Publication is owned by the orchestrator and is outside these acceptance checks.

## Testing Strategy

### Unit Tests

- Extend `usage-evidence.test.mjs` and `claude-usage.test.mjs` with sanitized fixtures. Cover duplicate-message counting, identity conflicts, filesystem limits and supported version/schema boundaries. Use temporary fixture homes and controlled environment inputs, with no reads from real session history in Automated gates.

### Integration Tests

- Phase 1 uses `node --test skills/10x-pipeline/test/{usage-evidence,accounting-readers,compare,cost,late-usage,claude-capture}.test.mjs`.
- Phase 1 fixtures assert no savings verdict for transcript-only and mixed-scope pairs, including `--unpinned`, retain observed totals and approximate costs, and cover unavailable transcript labels and a visible disclosure near the start of the report.
- Phase 2 uses `node --test skills/10x-pipeline/test/{claude-usage,claude-capture}.test.mjs`. Cover append or reuse after a stale `finished: true`, ambiguous launch and return lineage, and exhaustion of a shared budget across lookups, JSON metadata and JSONL. Include a delayed tree that retains full identity/version and becomes measurable once, plus one whose first pass cannot prove its identity or version and remains ineligible for late attachment.
- Phase 3 uses `node --test skills/10x-pipeline/test/{init-usage,policy-validate,providers,skill-loop,provenance}.test.mjs` and reruns the affected accounting tests. Use existing scratch projects and local launcher fixtures. Check documentation with a targeted search for the former default and coverage wording and review the changed matches.
- Phase 3 fixtures change the policy between native dispatch and neutral replay, cover pending entries from before the mode field, and check that `init` readiness and the replay action use the same source. Exercise mode-specific archive actions and the once-only late check in both chains with local fixtures.

### Manual Testing Steps

1. From a project with a prepared test change, start ordinary Claude Code and use the pipeline as the first command submitted to the fresh session. Check that native `init` succeeds before any Agent transcript exists. Complete a native step and inspect status and the rendered report for transcript status, a numeric total and the scope disclosure. Record the build and whether Claude supplied the session ID and readable main transcript at startup.
2. Start a fresh session with the documented launcher and a project override selecting telemetry. Run a native step and inspect status and the report for verified evidence. Use a qualified build and record its version with the outcome.

## Performance Considerations

Bound session discovery and file I/O with the existing capture limits, including the shared 2-second local read deadline checked between filesystem calls. Stream transcript records and keep only the identity, counters and relationships required for attribution. Preflight probes file readiness without reading session history.

## Migration Notes

Existing policy overrides without `mode` inherit transcript mode for new dispatches after upgrade. A pre-change pending native replay retains telemetry. Launcher users can select telemetry before starting the next session. Keep the enabling revision through settlement and intake, retain historical evidence as recorded, and use a preserving follow-up if rollback is needed. Older readers cannot interpret the new evidence status.

## References

- [Issue #289](https://github.com/xycu/agent-smith/issues/289)
- [Research and owner decision](research.md)
- [Observed token accounting](../../../docs/REFERENCE.md#observed-token-accounting)
- [Read safety and documentation lessons](../../foundation/lessons.md)

## Progress

> Append the closing commit SHA to completed rows. Keep step titles stable.

### Phase 1: Represent transcript evidence across accounting

#### Automated

- [x] 1.1 Evidence normalization distinguishes transcript, verified, unavailable and legacy records and rejects inconsistent tuples. — 7f4a3d24
- [x] 1.2 Status, report, compare and cost tests cover a transcript-only run and mixed evidence with zero and missing figures without rewriting historical entries. — 7f4a3d24
- [x] 1.3 Structured late usage attaches a missing transcript total for the same invocation, refuses mismatched and conflicting evidence without mutation, and preserves existing retry and report behavior. — 7f4a3d24

### Phase 2: Collect a bounded transcript tree

#### Automated

- [x] 2.1 Deterministic Claude fixtures produce exact totals for fresh flat, nested and archive invocations, including repeated messages, synthetic placeholders and unrelated sibling agents. — 00730a23
- [x] 2.2 Deterministic Claude fixtures refuse ambiguous sessions and invocations, wrong or missing children, unfinished or resumed agents, conflicting counters, unsafe or changing files and exhausted budgets without attaching an incomplete tree total. — 00730a23
- [x] 2.3 Existing launcher-bound and explicit-source telemetry fixtures still exercise exact request reconciliation. — 00730a23

### Phase 3: Make transcript mode the default in both chains

#### Automated

- [x] 3.1 Local CLI fixtures show both chains start in an ordinary ready session, halt without writes for an unusable required source, honor opt-out and telemetry mode, and preserve validation and preflight exemptions. — 55904d3f
- [x] 3.2 Native dispatch, neutral retry, archive and skill-loop checks preserve source selection, identity and output ownership across both chains. — 55904d3f
- [x] 3.3 Targeted accounting and policy regressions pass on Node 24 and live docs agree with the shipped default and evidence contract. — 55904d3f

#### Manual

- [x] 3.4 In an ordinary qualified Claude Code session without the launcher, complete a native Agent step and confirm transcript evidence in status and the rendered report.
- [ ] 3.5 In a fresh launcher session with telemetry mode selected, complete a native Agent step and confirm verified request-record evidence in status and the rendered report.
