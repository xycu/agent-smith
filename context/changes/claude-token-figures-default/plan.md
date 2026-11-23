# Opt-in Claude token capture implementation plan

## Overview

The frame records this observation:

> Since 1.14.0 a default install records `usageEvidence.status: "unavailable"` and no `totalTokens` for every Claude step. `claude-usage.mjs` returns `verified` evidence only on host version `CLAUDE_USAGE_VERSION = "2.1.311"` exactly, and only from a hook-capture JSONL file and an OTLP log that the operator supplies. `compare` adds `usage-incomplete:<side>` (`route.mjs:572`) and gives no verdict for a Claude-hosted run.

The owner decided: “**The plugin ships a capture hook that the user opts into.** With the hook on, Claude steps get `verified` figures. With it off, the behavior stays as it is today.” The feature covers pipeline steps dispatched through the native Claude Agent path in both chains, where the existing adapter has a proven invocation contract.

## Current State Analysis

The existing adapter verifies a fresh Agent invocation and its descendants by joining native launch, return and stop records, Claude transcripts and a process-qualified OTLP prefix. Its current CLI needs an operator-supplied descriptor, an authorized source root and an exact tested host version. The shipped Claude lifecycle hook serves the guarded external runner and exits early in a native session. The shared accounting formatter already renders a bounded reason on the report and in Markdown comparisons. The retained 2.1.311 probe demonstrated both full tree reconciliation and OTLP delivery after the enclosing PostToolUse. [Frame](frame.md) · [Collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs) · [Lifecycle hook](../../../skills/10x-pipeline/scripts/claude-hook.mjs) · [Native probe](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md)

### Key Discoveries

- Claude initializes OTLP from the starting environment. Project settings cannot configure the exporter and hook subprocesses cannot rely on inherited `OTEL_*` variables. Native tool hooks supply invocation IDs and transcript paths, and transcripts can lag the hook. [Monitoring](https://code.claude.com/docs/en/monitoring-usage) · [Hooks](https://code.claude.com/docs/en/hooks)
- The collector needs event sequence from process start through the enclosing Agent return. Discarding unrelated event sequence markers or starting the receiver at first Agent dispatch breaks the proof. Child and ancestor counts share the enclosing dispatch total. [Collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs)
- The router matches late usage against the recorded invocation and tested host version. An unavailable result with observed identity can be upgraded via `usage --usage-file`. The two chains already share this path. [Router](../../../skills/10x-pipeline/scripts/route.mjs) · [Reference](../../../docs/REFERENCE.md#observed-token-accounting)

## Desired End State

Users opt in for one fresh Claude session by invoking the shipped capture launcher; the normal `claude` command leaves capture off. Before that opt-in, the plugin writes no accounting capture and starts no exporter or listener. A complete capture yields verified `step-tree` tokens on both native pipeline entry points. Incomplete captures remain unavailable and default-off runs give a one-line explanation and invocation to enable capture in `status --report`, the run report and `compare`.

## Scope

The verified scope is the native Agent step tree, including supported foreground descendants and the existing final-message-only treatment of the archive action. The external Claude runner launched from a Codex host uses a different root identity and retains its current accounting. Final-request footprints, billing integration, automatic telemetry setup in project settings and the future capture preflight change are outside this delivery.

## Implementation Approach

Use a session-local launcher and a separate passive capture hook, with independent process binding and the existing collector as the proof gate. Phases deliver the opt-in capture and verified fixture replay first, then wire the pipeline and user-facing readers. The capture itself stays outside the repository and the router remains the sole owner of ledger and report state.

### Decisions and assumptions

- **Session opt-in.** Store consent in the fresh Claude process environment set by an explicit launcher command. Restart with normal Claude to opt out. The retained loopback launcher probe and Claude startup settings support a session-scoped choice without persistent settings edits. [Native probe](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md) · [Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- **Separate passive hook.** Keep capture failures isolated from the headless guard's blocking receipts and from the Bash guard. Hash capture paths used through the checked hook configuration in the applicable guard and provenance sets. [Hook config](../../../hooks/hooks.json) · [Guard revision](../../../skills/10x-pipeline/scripts/claude-hook.mjs)
- **Version qualification per release.** Replace the single hardcoded equality with an exact tested-release registry tied to reviewed fixtures and maintained by the agent-smith maintainer. Seed with the existing 2.1.311 baseline, distinguish fixture compatibility from live qualification, and qualify a subsequent Claude release before advertising support for it. An unqualified version fails closed and the launcher points to supported versions or normal launch. The Claude Code build on the maintainer's machine when this plan was reviewed is 2.1.323, not the 2.1.311 seed, so the build used for the human run (row 2.4) must be either 2.1.311 or a release qualified first through the release check in Manual Testing Step 2. “Subsequent release” there means any release other than the seeded baseline. This gives upgrades a repeatable path without assuming semver preserves native event shapes. [Retained format review](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md) · [Qualification roadmap](../../foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)
- **Comparison.** Keep the frame's proposed gate when the new capture is unavailable and preserve established legacy-only behavior for historical pairs. Verified comparisons still depend on the existing pairing and outcome gates. [Frame](frame.md) · [Router](../../../skills/10x-pipeline/scripts/route.mjs)
- **Native host scope.** Apply the frame to both Claude-hosted Agent loops. The guarded external process started from Codex has no enclosing Agent return for this collector to prove. [Provider matrix](../../../docs/REFERENCE.md#codex-and-provider-dispatch) · [Collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs)

## Critical Implementation Details

The exporter and transcripts can lag the tool return even after synchronous hook capture. Collect once immediately, then revisit eligible incomplete invocations in the existing late-usage pass before publication or archive launch. A normal run advances through `next` in the same turn. Carry the exact observed identity for late intake and serialize router calls. Archive usage remains a single best-effort read for the final message. [Anti-stall rules](../../../skills/10x-pipeline/SKILL.md#anti-stall-rules) · [Timing proof](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md)

## Phase 1: Ship session-local capture and prove reconciliation

### Overview

Capture the smallest usable accounting record set for one opted-in Claude process and feed it to the current proof logic.

### Changes Required

#### 1. Launcher, local receiver and hook

**Files** `skills/10x-pipeline/scripts/claude-capture.mjs`, `skills/10x-pipeline/scripts/claude-capture-hook.mjs`, `hooks/hooks.json`, `skills/10x-pipeline/scripts/claude-hook.mjs` and the hook provenance consumers: the fixed file list in `hookFilesHash` in `skills/10x-pipeline/scripts/isolation.mjs` (the capture hook script joins it), the `guardRevision` use in `skills/10x-pipeline/scripts/run-claude.mjs`, the `hookFiles` description in `docs/REFERENCE.md`, and the tests that pin those hashes.

**Intent** Give the operator a single explicit entry point that starts the private receiver before Claude startup and carries consent through that fresh launch. Keep the capture hook independent of mandatory safety receipts.

**Contract** `node <absolute-plugin-scripts>/claude-capture.mjs` starts an interactive Claude session in the operator's project with the intended plugin and a fresh reserved session ID. The startup binding ties a unique private capture directory and loopback endpoint to the actual Claude PID and creation time, independently of incoming OTLP. The collector requires `process.pid` and `process.creation.time` in the OTLP resource attributes, and Claude does not emit them itself, so the launcher delivers them the way the retained probe launcher did: it sets them in `OTEL_RESOURCE_ATTRIBUTES` for the exact process it then execs, and the receiver rejects any batch whose resource attributes differ from the binding. Inherit the terminal and settle the child and receiver on exit or interruption. Require a fresh session. Detect conflicting export settings or managed policy without overriding an existing destination or bypassing managed restrictions. Set only process-local accounting logs on the local endpoint, with prompt, assistant text, raw body and tool content logging disabled. Use only the event fields needed by reconciliation and keep all sequence markers. Bound body, file, record and session retention, use private permissions and require the bound receiver endpoint. Capture or storage failure yields bounded unavailable evidence. Preserve capture through a run's late intake and use launcher-owned cleanup after settlement, with a documented path for interrupted sessions.

Register passive `PreToolUse` and `PostToolUse` for Agent and `SubagentStop` on the separate capture hook. With the session binding absent, it exits before reading stdin, paths or creating files. With it present, it validates and records native session, tool and agent identities, parent linkage, completion state, transcript references and comparison hashes of prompt, description and final text. It stores no raw prompt, final reply or tool body. Its failures cannot veto Agent execution or emit guard receipts. Preserve the existing lifecycle checks and Bash guard. Update the computed hook revision and provenance coverage for capture registration and script bytes through existing mechanisms.

#### 2. Collector and qualified versions

**Files** `skills/10x-pipeline/scripts/claude-usage.mjs`, `skills/10x-pipeline/scripts/usage.mjs`, `skills/10x-pipeline/test/claude-helpers.mjs`, `skills/10x-pipeline/test/claude-usage.test.mjs`, capture and guard tests, and `skills/10x-pipeline/test/README.md`.

**Intent** Resolve the launcher-owned capture and exact native identity with the current whole-tree checks. Continue to accept the existing independently authorized source descriptor.

**Contract** Give the collector a bound shipped-capture mode that resolves session, process and evidence paths from the launcher and selects the enclosing native Agent using observed IDs, with router description as corroboration. Where the Agent return omits a tool ID, take a capture checkpoint before dispatch and require one matching top-level launch after that checkpoint, paired by the hook-observed tool ID and corroborated by any host-provided agent ID. A competing launch fails attribution. Never choose among retries by description, most recent record or assumed IDs. Validate capture artifacts under the private session root and transcript reads under the explicitly authorized Claude project transcript root, reusing regular-file and realpath bounds. Feed the projected data and legacy hook envelopes to the same identity, exact request-set, counter, transcript UUID, process sequence and descendant closure checks. Add a canonical `capture-disabled` reason for default native launches. Keep unsupported host, opt-in source failure and incomplete proof distinct. Preserve valid independent metrics and observed identity even when the prefix has yet to arrive. Expose two modes through the existing `$CLAUDE_USAGE` entry point, `checkpoint` (records the pre-dispatch position) and the current collect mode (reading the launcher-bound location from the session environment when the descriptor gives no sources), so the skills gain no new variable. Keep schema version 1 and the existing verified evidence shape. Maintain a shared exact-version registry, updated with sanitized replay fixtures and qualification notes per supported release.

### Success Criteria

#### Automated Verification

- Launcher and hook fixtures prove consent gating, private bounded local capture, process and session isolation, content minimization, failure handling and unchanged guard behavior.
- Collector fixtures verify flat and descendant totals, preserve the authorized descriptor, and reject unsupported versions, incomplete or conflicting provenance, symlink escape and ambiguous retries.

## Phase 2: Integrate both pipelines and qualify the user workflow

### Overview

Deliver capture support through the normal skills, reuse the shared report and comparison behavior, and document activation and qualification.

### Changes Required

#### 1. Both native Agent loops

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`.

**Intent** Read shipped capture after each settled Agent call and attach a late proof when it is ready by the existing cutoff.

**Contract** Take the bound native capture checkpoint with the `checkpoint` mode of `$CLAUDE_USAGE` immediately before Agent dispatch when the launcher's session binding is present in the environment. Apply the shared collector for native run and archive results, strip step-authored accounting and pass only bounded evidence and independent measurements. When sufficient identity is available but export closure is pending, recheck eligible captures at the existing pre-end late pass without waiting or polling. Use one sequential `usage --usage-file` per settled step with a newly verified measurement. Maintain equal Anti-stall sections, no literal routing models, effort levels or tiers, and adjust the size ceiling in the same commit if the text grows.

#### 2. Report, status and comparison

**Files** `skills/10x-pipeline/scripts/usage.mjs`, report and comparison consumers in `flow.mjs` and `route.mjs` only where shared formatting needs adjustment, `skills/10x-pipeline/test/accounting-readers.test.mjs`, `skills/10x-pipeline/test/compare.test.mjs` and `skills/10x-pipeline/test/late-usage.test.mjs`.

**Intent** Let the default-off explanation and verified measurements flow from the producer through every reader.

**Contract** Reuse the normalized reason and explanation, including the launcher command in one line for each default-off entry. Missing is `-`, measured zero is `0`, and partial sums identify subtotal coverage. Preserve verified, unavailable and historical scopes, comparison reasons, the verified/legacy mixing gate and archive-only exclusion. Test report generation at normal run end separately from rebuilding it via `status --report`. Use deterministic local fixtures and local fake clients if publication boundaries enter the test.

#### 3. Operator documentation and qualification evidence

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, ADR-019, and a sanitized acceptance note under this live change.

**Intent** Document the working entry point and the supported-release qualification process.

**Contract** Cover enable and disable commands, per-session scope, retained data and cleanup, conflicting settings, supported version lookup, default-off output, late cutoff and rollback. Amend both ADRs and scan current operational docs for stale capture claims. Keep README coverage accurately pending until the human run has passed and then link its evidence. Keep the remaining S-20 matrix distinct from this one workflow qualification.

### Success Criteria

#### Automated Verification

- Both pipeline skill checks prove immediate and late attachment use the existing cutoffs and preserve equal anti-stall rules and guard provenance.
- Router fixtures prove verified figures and default-off guidance in status --report, the run report and compare, including late evidence and historical comparison behavior.
- The required Node test suite passes and operator docs agree with the launcher, supported-release registry and pending live qualification.

#### Manual Verification

- An authorized human runs one complete native Claude-hosted pipeline on Claude models with capture enabled and records exact host version, whole-step token evidence and README qualification.
- The maintainer qualifies a subsequent Claude Code release with a live multi-request Agent capture and sanitized replay before listing that release as supported.

## Testing Strategy

### Unit Tests

Use bounded payload and filesystem fixtures for disabled and enabled hooks, raw field projection, deduplication, resource caps and unsupported or missing evidence. Exercise zero, process and session mismatch, malformed rows, mismatched counters, missing descendants, out-of-order batches with eventual closure, unsafe reads and fresh-path uniqueness.

### Integration Tests

Drive the fake Claude lifecycle through startup, Agent return and delayed OTLP, then ingest through the normal router and inspect the initial report, regenerated report and JSON and Markdown compare. Verify repeated late collection does not double count. Use the existing scratch harness, with no remote dependency. Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Manual Testing Steps

1. Before finalizing the registry fixtures in Phase 1, run one real interactive launcher session against a disposable project, because the retained evidence covers headless captures only and an interactive trust prompt or hook payload difference would otherwise surface after all code exists. Then, in an authorized disposable project on an exact qualified Claude Code build, start the launcher and run a normal pipeline end to end in Claude provider mode. Record the chain, launch mode, plugin revision, exact host version, successful settlement and verified figures in status and report. Include a multi-request step and an allowed foreground descendant when proving tree coverage. Record redacted totals and coverage only. Start Claude with the ordinary command for a negative control for capture and the instructional reason. Close the README's single-run pending claim with the evidence and retain separately tracked mode/chain acceptance.
2. Before adding a subsequent Claude Code release to the registry, the maintainer repeats a fresh local Agent probe and compares the captured request tree with directly observed request membership, counters and terminal events, records immediate or late availability, and adds sanitized fixtures that pass the same proof. If the schema diverges, qualify an adapter change first. This release check and the full pipeline run can share evidence if both criteria are met.

## Performance Considerations

Default capture hooks exit before reading their payload. Bound the receiver and reader and use a single pass at immediate and late intake opportunities. Disk or export delays follow the existing unavailable path without extending the run.

## Migration Notes

Existing accounting records and explicit-source descriptors remain readable without a migration. Keep launcher, hook, collector and skill revision together until the opted-in session settles. To roll back, finish or stop the session, start Claude normally, and retain existing ledger entries. Capture cleanup is confined to launcher-owned data and does not alter native transcripts or run state.

## References

- [Owner decision](frame.md)
- [Retained native capture and delayed export evidence](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md)
- [Usage evidence contract](../../../docs/REFERENCE.md#observed-token-accounting)
- [Claude Code hook reference](https://code.claude.com/docs/en/hooks)
- [Claude Code monitoring reference](https://code.claude.com/docs/en/monitoring-usage)

## Progress

### Phase 1: Ship session-local capture and prove reconciliation

#### Automated

- [x] 1.1 Launcher and hook fixtures prove consent gating, private bounded local capture, process and session isolation, content minimization, failure handling and unchanged guard behavior. — f87f9aec
- [x] 1.2 Collector fixtures verify flat and descendant totals, preserve the authorized descriptor, and reject unsupported versions, incomplete or conflicting provenance, symlink escape and ambiguous retries. — f87f9aec

### Phase 2: Integrate both pipelines and qualify the user workflow

#### Automated

- [x] 2.1 Both pipeline skill checks prove immediate and late attachment use the existing cutoffs and preserve equal anti-stall rules and guard provenance. — 0835a9d0
- [x] 2.2 Router fixtures prove verified figures and default-off guidance in status --report, the run report and compare, including late evidence and historical comparison behavior. — 0835a9d0
- [x] 2.3 The required Node test suite passes and operator docs agree with the launcher, supported-release registry and pending live qualification. — 0835a9d0

#### Manual

- [x] 2.4 An authorized human runs one complete native Claude-hosted pipeline on Claude models with capture enabled and records exact host version, whole-step token evidence and README qualification.
- [x] 2.5 The maintainer qualifies a subsequent Claude Code release with a live multi-request Agent capture and sanitized replay before listing that release as supported.
