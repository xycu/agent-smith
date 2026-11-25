# Native Claude step usage implementation plan

## Overview

Record the native Claude step’s token figure when the router consumes its result. Ten linkedin-prm runs on agent-smith 1.18.2 and Claude 2.1.330 lost every native figure, although replay of one score invocation yielded 325,516 tokens. Half the runs recorded `missing-identity` and half recorded no evidence. All Codex steps had verified evidence. The available data describes one project. [Frame](frame.md)

Claude step accounting depends on an optional, unchecked orchestrator ritual. The model must remember to run it and must hand-build a nested descriptor of facts the router already holds. The router does not take that work over and cannot tell when the ritual was skipped.

## Current State Analysis

| Finding from the frame | Consequence for the design |
| --- | --- |
| Both skills describe a descriptor in prose. A flat object fails the collector’s nested identity check. | Construct the descriptor in JavaScript from the pending entry. |
| The observed orchestrators skipped collection, lost its output or reused earlier evidence. Background launches returned a later hand-back. | Capture the launch ID once. Intake runs even when the ID is absent. |
| The router has the change, chain, number, step and mode. The collector can recover the session and tool-use ID from native records. | Keep the Agent ID as the only host observation the normal loop supplies for accounting. |
| Empty accounting normalizes to an empty object. The report then shows the same dash as an old unmeasured step. | Persist a source-specific unavailable reason that the existing report can display. |

Model choice and the arrival of a direct tool result affected compliance in the observed sessions. More descriptor examples would still leave omitted and reused measurements undetected. [Research](research.md)

## Desired End State

Immediately after a settled numbered native result is consumed, the entry and its stored result contain the same normalized evidence. Default capture produces a transcript subtotal with its undercount disclosure. Opt-in bound telemetry can produce verified usage. A failed measurement produces a visible reason and leaves tokens absent. The step status, artifact verification and retry budget continue to describe the work the agent did.

### Key discoveries

- `collectClaudeUsage` already constructs both success and failure evidence. Its transcript reader validates the parent launch, depth, description, tool-use ID, completion, version and tree membership. It accepts only a fresh root and counts each distinct message once. [Collector](../../../skills/10x-pipeline/scripts/claude-usage.mjs#L60) · [Reader](../../../skills/10x-pipeline/scripts/claude-transcript.mjs#L101)
- Both chains share result intake. A neutral replay reuses the original entry and description. The archive action has neither a numbered row nor a subsequent `next`. [Intake](../../../skills/10x-pipeline/scripts/flow.mjs#L616) · [Neutral replay](../../../skills/10x-pipeline/scripts/flow.mjs#L444) · [Archive](../../../skills/10x-pipeline/scripts/isolation.mjs#L937)
- Late enrichment already requires a completed row, full invocation, exact source and qualified version. Prior measurement and evidence are immutable. [Late usage](../../../skills/10x-pipeline/scripts/route.mjs#L889)

## Scope boundaries

Historical backfill of linkedin-prm, ledger migration, a new capture mode, changes to routing policy and recalibration of the token algorithm are separate work. Explicitly authorized source descriptors remain available to the standalone collector. Archive figures belong only in the final message.

## Implementation Approach

### Six planning decisions and assumptions

| Research question | Decision and basis |
| --- | --- |
| 1. Who measures? | Choose design (a). Inside the existing locked intake, assemble the descriptor and call the shared bounded collector once. The Codex runner already measures its own dispatch. Selection by description or time cannot distinguish retries. A collector the model must remember would retain the observed omission. |
| 2. How does the ID arrive? | Use optional `next <id> --agent-id <id>` (also `--agent-id=<id>`). Take it from the direct launch response or an unambiguously matched host notification under rule 6, outside child RESULT JSON. Retain it with the existing attempt record for result-write recovery. An absent ID is ordinary missing evidence. Validate as a bounded, path-safe host ID before any lookup. Ignore reserved identity, source and accounting claims in newly dispatched native results. A launch ID selects a candidate. The existing source proofs establish attribution. |
| 3. Which session owns the attempt? | At each new native transcript dispatch record the path-safe `CLAUDE_CODE_SESSION_ID` or an explicit null as pending state. On intake require equality with the actual native session, including the existing headless exclusion. Missing or different session yields unavailable. Never synthesize an environment to open session A from B. Refresh on a genuine neutral redispatch and discard on consumption. This honors the documented current-session boundary without assuming anything about `/resume`. Telemetry uses the existing launcher binding and its session-scoped checkpoint. |
| 4. What if completion lags? | Assume no host ordering guarantee. After settlement, do one bounded read. A missing finished marker or return yields `incomplete-capture`. Retain proven invocation and any qualified observed version. Use the existing single eligible late recheck before terminal publication or archive launch. No waiting, relaunching or re-running `next`. |
| 5. What if evidence is absent? | Continue routing and persist normalized `unavailable` on every consumed numbered native result lacking a measurement. Use existing reasons, e.g. `missing-identity` for an absent transcript agent ID and `missing-source` for an absent file. Surface it through status, report and compare. Keep a missing total absent, including when other counters exist. Startup readiness and execution suspension keep their own gates. |
| 6. How is an unknown version handled? | Retain a consistent, qualified version from attributed source records on failure when available. Otherwise keep `unknown` and refuse structured enrichment. Never infer it from the CLI, dispatch, an unrelated record or the late payload. The existing version-conflict behavior clears the disputed version. This preserves the exact-match contract of ADR-019. |

The design assumes the launch observation belongs to the enclosing orchestrator. The guard against a stale ID also needs an attempt boundary where descriptions can repeat. Use the validated root launch timestamp as a **rejection check** against the current dispatch start (latest neutral retry time if present), never as a search key. For bound telemetry use the fresh checkpoint offset. Mismatches leave no attachable invocation. [Transcript launch](../../../skills/10x-pipeline/scripts/claude-transcript.mjs#L175) · [Replay timestamp](../../../skills/10x-pipeline/scripts/flow.mjs#L484)

## Critical Implementation Details

`init` can resume through the same `next` function. Measure only a pending, consumed result after the neutral-retry decision and before the existing log write and result removal. An intake retry after that write must preserve the first measurement, even if source files subsequently change. Preserve the current suspension, result-write and commit/rollback ordering. [Router](../../../skills/10x-pipeline/scripts/route.mjs#L80)

Use the optional collector-loading pattern already used by init. A missing optional capture module can yield bounded unavailable evidence without making `status`, non-native runs or intake unstartable. Keep result intake synchronous if the optional adapter is resolved in the async CLI entry points. `flow.mjs` may import only earlier router modules, so `route.mjs` resolves the optional collector adapter once, before `next`, and passes it into `attachResult` as an argument. `flow.mjs` gains no static import of `claude-usage.mjs`, `claude-transcript.mjs` or `claude-capture-data.mjs`, and a test with the adapter absent proves the unavailable path. Add `--agent-id` to the usage text of `route.mjs` and read it only for `next`. [Preflight](../../../skills/10x-pipeline/scripts/init-usage.mjs#L42)

## Phase 1: Measure a numbered native dispatch at intake

### Changes required

**Dispatch and replay — `state.mjs`, `route.mjs`, `flow.mjs`.** **Intent** Bind each native dispatch to its actual source and give recovery a durable, bounded attempt boundary. **Contract** Use the saved host, provider and dispatch mode, including split runs. Add one pending native capture record, present even if observation failed. For transcript save the validated session ID. For bound telemetry take `claudeCaptureCheckpoint` at dispatch and retain its session and offset or null. Refresh these fields immediately before returning an actual redispatch. Keep paths, capture settings, raw host output and secrets out of state. Readiness still belongs to init.

**Intake — `route.mjs`, `flow.mjs:attachResult`, `claude-usage.mjs`, `claude-transcript.mjs`.** **Intent** Normal intake should work with the observed Agent ID alone. **Contract** Thread change, chain, saved host and optional CLI observation into the single pending-result path. Build `router: {change,chain,n,step}` and use the recorded mode. Keep one description builder and one measurement implementation. A bare, unsafe or malformed ID never triggers a path read or becomes stored identity. On a transcript read, use the selected root’s validated native launch and session, reject a superseded launch before retaining its identity for recovery, and keep the current completion and child checks. On telemetry, retain only an unambiguous top-level launch after the matching saved checkpoint, cross-check any supplied ID and keep the collector’s verified-source rules. A missing checkpoint or unusable binding fails closed. Never silently fall back between modes.

**Result ownership — `flow.mjs`, `usage.mjs`.** **Intent** Persist exactly what intake can substantiate. **Contract** Strip native step-authored usage, evidence and handoff identity before storing the result. Normalize collector output once for both row locations. Keep independently attributable tool and duration counters at their documented scope when present in matched host records. Omit counters available only as an unverified claim. Never convert final-request notification tokens into a step total. Preserve unrelated result fields and signal sanitization. Already-completed rows stay byte-identical. On an old pending row lacking the new capture record, consume the previous version’s sanitized orchestrator evidence under its existing contract, flag missing evidence, and use the legacy telemetry default for a modeless redispatch. External Codex envelopes and headless Claude duration-only results keep their existing intake.

**Proof — `result-persist.test.mjs`, `claude-usage.test.mjs`, `claude-helpers.mjs`, `accounting-readers.test.mjs`, `init-usage.test.mjs`.** Use sanitized fixtures and the real router in a scratch project. Give the fixture’s launch the actual dispatched description and a time within the attempt. Exercise 10x and OpenSpec, foreground and async returns, a child tree, missing ID, path-like ID, ID from another step or child, and replay of an older root with the same description. Test valid and conflicting versions, session change A→B, and incomplete metadata with an already observed version. Inject a plausible child-authored figure/ID and prove it cannot change the measured total or supply identity. Cover telemetry checkpoint success/ambiguity, ineligible provider pairs, old pending rows and already-persisted recovery. Keep existing generic normalization tests on their actual producer path.

### Success Criteria

#### Automated Verification

- Both chains record the fixture’s child-inclusive subtotal once through real `init` and `next`.
- Missing, forged, stale and unfinished observations produce the expected unavailable reason and preserve the step verdict.
- Replay, recovery, opt-in telemetry, legacy intake and external transports pass their compatibility cases.

## Phase 2: Keep diagnostics and late recovery attributable

### Changes required

**CLI diagnostic — `claude-usage.mjs:main`.** **Intent** Distinguish invalid command input from an unsupported host record. **Contract** Isolate the stdin JSON parse. Add `invalid-json` to the fixed reasons in `usage.mjs`, with an explanation identifying malformed collector input. Empty or malformed JSON yields that reason with source `unknown`, no invocation or usage and no input echo. Preserve the one-JSON-line convention, descriptor byte/time limits and `resource-limit`. Well-formed descriptors retain mode-specific validation, including `unsupported-schema` for a genuine incompatible record.

**Late and archive callers — `route.mjs:status/usageCommand`, `isolation.mjs` archive output, `claude-usage.mjs`.** **Intent** The two paths outside numbered intake still need measurement. Supply ready-to-forward collector input so neither requires the model to reconstruct identity. **Contract** For an eligible completed native row missing tokens, plain status can expose the bounded recheck descriptor built from the actual chain, row, recorded source and exact invocation. For transcript omit version from collector input and verify it on attachment. For telemetry use the original binding and observed version, with no checkpoint on recheck. Skip unknown versions and incomplete identities. A sequential `usage --usage-file` remains the sole structured late write, with its existing exclusivity, immutable figures, report refresh and cleanup. Keep the explicit local-sources operator interface.

For native archive, emit the corresponding small read-only collector input with the archive action (archive step per chain, `n: null`, saved capture mode, current session binding or telemetry checkpoint). After the matched archive report, forward that input verbatim to the collector with only its observed `--agent-id` argument. The CLI adds this single validated observation internally. Respect the recorded source/session and the archive attempt’s starting boundary. Competing launches after a telemetry checkpoint yield unavailable. A repeated archive description is never an ID. Keep collector input bounded independently of the potentially large action prompt. Archive collection must work even when the live change folder has already moved.

**Proof — `claude-usage.test.mjs`, `late-usage.test.mjs`, `accounting-readers.test.mjs`, `archive.test.mjs` and `openspec-archive.test.mjs`.** Exercise malformed and oversized stdin, unsupported on-disk schema, and an initially unfinished root which becomes finished. Attach only the matching total, retain existing independent counters, refuse source/version/identity mismatch, unknown version, and any overwrite. Confirm identical replays are no-ops. Exercise each chain’s real archive output and collector with synthetic source files. Guard the no-write archive invariant and retain the transcript undercount label.

### Success Criteria

#### Automated Verification

- Malformed descriptor JSON produces a sanitized input error and genuine host-schema failures retain their reason.
- A settled late figure fills only the matching missing total and exact replay leaves the ledger unchanged.
- An archive measurement returns final-message evidence on both chains without a numbered entry or archive write.

## Phase 3: Switch both orchestrator loops

### Changes required

**Both `SKILL.md` loops.** **Intent** Make step-time capture part of the normal result transition. **Contract** Record the ID from the correct fresh native launch, retain it through async settlement, and strip step-authored accounting at intake. After the confirmed result write call quoted `"$ROUTER" next <change-id> [--agent-id <observed-id>]`, retaining `--chain openspec` for that chain. Missing ID still advances. Resume from the confirmed write using the same saved attempt and optional ID. Remove native numbered collector/checkpoint instructions and their descriptor field lists. Preserve direct/notification matching, the suspension STOP, external runner bypass and result-write STOP. Update archive and late instructions to forward the router’s supplied input. Keep both Anti-stall sections identical.

**Contract documentation and tests.** **Intent** Make the routine interface and exceptional paths easy to distinguish. **Contract** Update the command synopsis in `AGENTS.md`, the usage sections of `README.md` and `docs/REFERENCE.md`, and append the ownership clarification to ADR-018/019 as applicable. Search active docs for old descriptor, checkpoint, malformed-input and late instructions, leaving historical records intact. Update the phrase guards in `skill-loop.test.mjs` and `openspec-skill.test.mjs` to check behavior, actual reduction from 32,377 bytes (10x) and 36,873 bytes (OpenSpec), and the existing ceilings. Keep ground truth in code and retain any accounting provenance hashes for changed producer inputs. Index any new test in its test README.

### Success Criteria

#### Automated Verification

- Both loop contract tests pass, Anti-stall sections match and each skill is smaller than its starting size.

#### Manual Verification

- Observe one background native step on a qualified Claude host and compare its immediate report with the same invocation’s collector result.

## Testing Strategy

Run the covering files from the repository root on Node 24+, using `node --test --test-concurrency=2` with the files named in each phase. Phase 1: `skills/10x-pipeline/test/result-persist.test.mjs`, `claude-usage.test.mjs`, `accounting-readers.test.mjs` and `init-usage.test.mjs` in the same folder, plus `route.test.mjs` when `next` argument handling changes. Phase 2: the same files without `result-persist.test.mjs`, plus `late-usage.test.mjs`, `archive.test.mjs` and `skills/openspec-pipeline/test/openspec-archive.test.mjs`. Phase 3: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs` and `tools/test/agents-md-size.test.mjs`. An Automated row is ticked when its covering files pass; the full suite is left to CI. The core fixture calls the router twice across a known source transition and inspects the log, the stored result, status and report. Phase 3 also runs `tools/test/agents-md-size.test.mjs`. Use regular scratch files, controlled host environments and existing fake tools. Automated criteria require no live provider, remote branch, PR or CI result.

For manual acceptance, run a native step on a qualified interactive host, retain the launch ID through its background hand-back, and inspect status immediately after intake. Compare the attributed total and version against the standalone collector for that ID. If the host has not flushed completion, verify the recorded limitation and the single eligible late recheck instead. Retain only sanitized counts, versions and reasons in acceptance notes.

## Performance and migration

At most one synchronous measurement per consumed native row under the existing read budget (2 s, 32 MiB combined, 1 MiB per record and the existing event, request, agent and directory limits). Status may build a descriptor from existing evidence but never scans transcripts. No poller, new dependency or listener. The three phases land together in one run: Phase 1 makes intake discard orchestrator-merged native accounting, so the loops of Phase 3 must ship with it, and only a row pending before the upgrade keeps the previous contract. Finish in-flight work on its enabling revision where possible. On rollback retain all historical evidence and refs. The first dispatch on the new revision starts the new contract. Counters unavailable in attributable host records and early failures lacking a qualified version can leave figures unavailable.

## References

- [Frame](frame.md) and [research, including the six open questions](research.md)
- [Observed token accounting](../../../docs/REFERENCE.md#observed-token-accounting), [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md) and [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
- [Team lessons on bounded reads and documentation](../../foundation/lessons.md)

## Progress

### Phase 1: Measure a numbered native dispatch at intake

#### Automated

- [x] 1.1 Both chains record the fixture’s child-inclusive subtotal once through real `init` and `next`. — 5bc43a95
- [x] 1.2 Missing, forged, stale and unfinished observations produce the expected unavailable reason and preserve the step verdict. — 5bc43a95
- [x] 1.3 Replay, recovery, opt-in telemetry, legacy intake and external transports pass their compatibility cases. — 5bc43a95

### Phase 2: Keep diagnostics and late recovery attributable

#### Automated

- [x] 2.1 Malformed descriptor JSON produces a sanitized input error and genuine host-schema failures retain their reason.
- [x] 2.2 A settled late figure fills only the matching missing total and exact replay leaves the ledger unchanged.
- [x] 2.3 An archive measurement returns final-message evidence on both chains without a numbered entry or archive write.

### Phase 3: Switch both orchestrator loops

#### Automated

- [ ] 3.1 Both loop contract tests pass, Anti-stall sections match and each skill is smaller than its starting size.

#### Manual

- [ ] 3.2 Observe one background native step on a qualified Claude host and compare its immediate report with the same invocation’s collector result.
