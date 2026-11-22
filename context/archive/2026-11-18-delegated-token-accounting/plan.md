# Delegated Token Accounting Implementation Plan

## Overview

Report one verified **observed host token total** for a completed pipeline step and its attributable descendants, through both the 10x and OpenSpec entry points. When the host cannot prove this scope, omit the total and show a bounded reason; accounting must never change execution settlement, result acceptance, retries or rollback.

Complexity: **HIGH**. This touches two different telemetry contracts, persisted usage, late attachment, reporting and comparison. The unattended instruction replaces the skill's interview and phase approvals. Decisions below follow the supplied research, existing ownership and conservative measurement practice; they are assumptions for review, not claimed human confirmations.

## Current State Analysis

| Surface | Current owner and behavior | Required change |
| --- | --- | --- |
| Codex execution | `skills/10x-pipeline/scripts/run-codex.mjs:133` proves parent/descendant settlement, including archived descendants, but returns only a descendant count. Lines 244 and 394 parse primary-thread usage; lines 408–413 omit totals when delegation occurred. | Retain attributable settled identities and collect their observed usage without weakening closure. |
| Claude execution | Both pipeline `SKILL.md` files own native Agent launch matching, immediate usage, late usage and archive output. Loop step 4 currently maps flat-step `subagent_tokens` directly to `totalTokens`. | Apply whole-invocation evidence to flat and delegated steps; final-request figures are insufficient. |
| Result intake | `flow.mjs:461` cleans three numeric fields. `attachResult` at line 547 stores the result, copies cleaned usage to the entry, and writes before deleting the result file. | Add bounded accounting evidence while preserving the result/verification transaction. |
| Late intake | `route.mjs:768` attaches a figure to an executed, completed step; any existing usage object is immutable. `isolation.mjs` owns the pre-archive commit and recovery. | Add a narrowly scoped, identity-checked way to fill a missing token total after duration/tool figures already exist. |
| Readers | `flow.mjs:105` renders the report; `route.mjs:384` compares runs and its status command exposes step usage; `state.mjs:214` estimates cost using the enclosing routing model. | Show coverage and omission reasons; avoid misleading comparisons or model-specific spend claims. |
| Storage | Router modules exclusively own `run.jsonl`, `meta.json` and report writes. The archive action has no numbered log row. | Keep numeric usage compatible, add optional evidence, and leave historical archives unchanged. |

The supplied research includes a Codex missing-record negative control and Claude telemetry timing controls. In the latter, only five of six request records had arrived when the final result was observed. It explicitly resolves the earlier planning blocker: implement bounded support and truthful unavailable behavior; do not wait for universal telemetry or billing completeness.

### Key Discoveries

- Codex `0.169.0` exec usage is primary-thread scoped. Its pinned rollout response records identify the actual `thread_id`; a child's `session_id` can identify the enclosing session. Sum unique responses, then reconcile against a compatible final cumulative snapshot. See [research, Codex](research.md#codex).
- Claude Code `2.1.311` completion figures describe the final API request, including for multi-request flat steps. Four request buckets are additive: uncached input, cache read, cache creation and output. Whole-query `modelUsage` includes the orchestrator when the query encloses the step. See [research, Claude Code](research.md#claude-code).
- A token error currently thrown before Codex settlement can turn otherwise valid execution into a retained-lock failure. Moving accounting validation behind proven settlement is part of this fix, while malformed execution protocol and incomplete native closure remain fatal (`run-codex.mjs:394–407`).
- `late-usage.test.mjs` already proves exact replay, archive refusal, report regeneration, local commits and rollback behavior. Extend those contracts, rather than add another state writer.
- `context/foundation/lessons.md` requires searching all current documentation for old output behavior. Its historical flat-delegation rule is superseded by the supplied bounded-child contract; no extra research delegation is needed because the upstream investigation already maps the affected surfaces.

## Desired End State

For each accepted numbered invocation, `usage.totalTokens` either represents all verified observed usage within the step tree, counted once, or is absent with an explicit coverage reason. Independently valid duration/tool figures survive unavailable tokens at their documented scope. The outer orchestrator, other steps, superseded retries and archive execution are excluded from the numbered step's total.

The report distinguishes **verified**, **unavailable**, and **legacy/unverified scope**. Missing is never displayed as zero. A measured subtotal is labelled as such whenever coverage is incomplete. Existing legacy scalars remain readable and unchanged; they do not silently become verified measurements.

Acceptance is deterministic local proof of both positive and fail-closed paths for both chains, plus separately tracked Manual host qualification. Unsupported host variants may finish successfully with unavailable tokens. Such a result is not evidence that their positive accounting path is live-qualified.

## What We're NOT Doing

- Replacing Codex exec, resuming threads to obtain usage, switching Claude native Agent execution to the SDK, or changing child permissions, dispatch, settlement or routing policy.
- Enabling telemetry/exporters automatically, sending telemetry to a new destination, adding npm dependencies, or creating a long-running collector service.
- Billing reconciliation, billing-complete claims, detailed per-child pricing, orchestration-wide totals, or savings/scorer experiments.
- Reconstructing old run ledgers, editing `context/archive/`, changing release versions, or adding an archive execution row to numbered totals.
- Broadening host support beyond qualified schemas, accepting model-authored token estimates, or interpreting silence/sleep as exporter completion.
- Publishing this step's work. Pushes, PRs, PR CI and external comments are not Automated acceptance dependencies; publication remains with the enclosing orchestrator.

## Implementation Approach

Extend existing owners, with small dependency-free host readers and a shared accounting contract. Expand router persistence/intake first; then wire Codex and Claude producers; finally update report/comparison readers and migration documentation. All new producers replace step-authored accounting fields with measured data or a measured unavailability reason.

The four phases are development checkpoints within one candidate, not independently deployable releases. Do not activate intermediate phase commits for pipeline runs or mix new producers with older report/comparison readers. Keep the installed execution revision unchanged through settlement and intake. Activate the complete candidate only after all four phases' Automated gates, including producer-to-reader integration, pass; no new runtime switch is needed. Live host qualification remains separately Manual.

### Evidence-backed decisions and assumptions

| Decision | Selected behavior | Evidence and tradeoff |
| --- | --- | --- |
| Measurement meaning | Complete observed host usage for the attributable step tree, not a bill. | Research recovery decision; upstream omissions can affect both records and snapshots. Honest scope is more useful than an apparently exact bill. |
| Initial support | Qualify Codex `0.169.0` and Claude Code `2.1.311` shapes only; unknown versions/shapes return unavailable. | Research's pinned source and retained probes. Exact versions are collector contracts, not routing policy. |
| Claude missing boundary | Native collection is optional. Accept only an exact per-agent source that reconciles with terminal matched records; otherwise omit tokens and continue. | Research recovery decision explicitly permits this fallback. Do not pretend isolated-query evidence establishes shared-session completeness. |
| Late enrichment | Add verified tokens only to the same recorded invocation with no token total; never replace a recorded number. | ADR-019 immutability plus research's duration-only gap. Generic counter merging remains out of scope. |
| Legacy comparison | Preserve legacy-to-legacy behavior with a scope warning; refuse a verified-versus-legacy savings verdict. | Existing compare compatibility and research's requirement to preserve historical scope. This prevents comparing final-request counts with step-tree totals. |
| Prices | Keep the existing blended calculation but label it a routing-rate approximation whenever a verified subtree is involved. | `state.mjs:214` prices by the routed parent; child model breakdown is not available. No extra pricing subsystem is needed. |
| Execution failure | Token collection failure changes accounting evidence only. Existing execution failures still suspend/refuse as before. | Research, ADR-018 settlement ownership and existing runner tests. |

### Accounting contract

Keep `usage` as the current numeric object (`totalTokens`, `toolUses`, `durationMs`, all non-negative safe integers). Add a sibling `usageEvidence`, normalized before persistence, with schema version `1`, `status` (`verified` or `unavailable`), `scope: step-tree`, source identifier, observed host version, and an invocation identity. Identity is host-derived: Codex root thread plus causal root turn; Claude session plus agent plus run/task identity where needed to distinguish a resume. Missing attribution produces unavailable evidence and cannot authorize later enrichment.

Verified evidence also carries bounded session/request counts and the reconciliation method. Unavailable evidence carries a stable reason code and a bounded, sanitized explanation. Examples include unsupported host/schema, missing source, missing identity, incomplete capture, conflicting duplicate, snapshot mismatch, ambiguous history, unsafe path and resource limit. Store no raw transcript, prompt, tool content, local absolute telemetry path or token export payload in run state or reports. Source/identity fields have explicit length limits; counts and sums have overflow checks. Internal read descriptors may contain paths but are not persisted.

Evidence is not a new trust authority: a step cannot certify its own JSON. The runner or native orchestrator collects it from matched host records and overwrites child-authored fields. Router intake validates its shape and consistency. Invalid supplied evidence removes the associated token total and becomes unavailable, without invalidating an otherwise valid result; independent duration/tool counters remain. Absent evidence preserves the legacy numeric contract and is classified as legacy at read time. Sanitize reserved accounting fields in both the stored result and the entry copy so raw evidence cannot leak through `last.result`.

### Critical timing and source constraints

Prove execution settlement first. Failure to obtain additional usage-only metadata or read a telemetry file must not retain an execution lock after closure is already proven. A closure failure still retains ownership and prohibits intake, rollback and relaunch. Retain current single intake and archive boundaries.

Use explicit fixed resource limits for bytes per record, bytes per invocation, number of sessions/requests and read duration, documented beside the readers and exercised at the boundary. Limits are implementation safeguards, not new project configuration. Exhaustion yields unavailable tokens without a partial total. Validate canonical source roots, non-symlink regular files, file identity and bounded reads; reject redirects, identity changes and truncated records. Never recursively scan arbitrary user directories or include raw contents in errors.

## Phase 1: Shared evidence and safe late enrichment

### Overview

Expand persistence and late attachment before changing host producers, keeping legacy clients compatible and immutable counters intact.

### Changes Required:

#### 1. Normalize accounting evidence at result intake

**Files**: `skills/10x-pipeline/scripts/usage.mjs` (new), `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Put shared accounting validation in one small module used by collectors and router intake. Preserve the existing result transaction and independently valid numeric fields.

**Contract**: Implement the accounting contract above. Keep `cleanUsage`'s numeric compatibility; normalize the sibling evidence and its relationship to tokens. The new helper imports only `node:` built-ins, so existing router import ordering stays acyclic. No helper writes router state.

#### 2. Identity-checked late tokens

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/isolation.mjs` (reuse existing precheck/commit/recovery; change only if needed for the evidence transaction)

**Intent**: Allow a complete measurement that arrives after `next` to fill missing tokens without erasing duration/tool figures or attaching a retry's usage to another invocation.

**Contract**: Extend `usage <id> <n>` with a mutually exclusive structured `--usage-file <path>` input containing `change`, `chain`, `n`, `step`, `usage` and `usageEvidence`. Read only a bounded regular file, validate every identity against the completed entry and its recorded invocation, and accept only verified evidence. Require exact host invocation identity already present on the entry; neither a repeated description nor the current step number supplies it. Fill only missing `totalTokens`; supplied existing counters must agree exactly, and other missing counters are not filled by this mode. Transition unavailable evidence to verified for that same invocation. Exact replay is a no-op. Conflicts, missing identities, pending/archived steps, unknown schema, mixed input modes or oversized files refuse before writing. Preserve legacy flag mode and its existing whole-object immutability, but do not let legacy flags bypass a recorded new evidence contract. Reuse the run lock, atomic writes, report refresh, archive-state commit and rollback; never replay `next`.

#### 3. Intake and persistence regressions

**Files**: `skills/10x-pipeline/test/usage-evidence.test.mjs` (new), `skills/10x-pipeline/test/late-usage.test.mjs`, `skills/10x-pipeline/test/result-persist.test.mjs`, `skills/10x-pipeline/test/run-state.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Prove additive compatibility, retry attribution and byte-preserving refusal using existing scratch-project helpers.

**Contract**: Cover malformed/oversized evidence, zero versus missing, overflow, forged child accounting replacement at producer boundaries, duration-only then verified tokens, conflicting figures, identical replay, neutral retries with repeated descriptions, both chains, and pre-archive commit failure recovery. Preserve unrelated result fields and existing failure semantics. Index the new test file.

### Success Criteria:

#### Automated Verification:

- Evidence validation and intake preserve valid results and legacy counters while rejecting unsafe token claims: `node --test skills/10x-pipeline/test/usage-evidence.test.mjs skills/10x-pipeline/test/result-persist.test.mjs`.
- Late enrichment is invocation-bound, idempotent and atomic across both chains and archive preparation: `node --test skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/run-state.test.mjs`.
- The required repository suite passes after Phase 1: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 2: Collect settled Codex step-tree usage

### Overview

Collect version-qualified response records for the exact already-settled invocation. Replace blanket suppression with verified totals or explicit unavailable evidence.

### Changes Required:

#### 1. Preserve settled identity and separate accounting failure

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Return the verified root/descendant identities and completed turn metadata from the existing observer instead of only a count. Keep the current exec command, permission probe, double enumeration and durable-lock behavior.

**Contract**: Collect usage only after final result and native closure checks pass. Usage-only host reads are separately guarded and cannot convert accounting failure into an execution error. Keep primary exec counters as corroboration, never add them to a rollout sum. Replace child-authored usage/evidence even for unsuccessful child results. Flat steps use the same observed-usage contract so default zero without evidence cannot be reported as measured zero. Archive returns measured usage/evidence in its envelope without writing to the moved folder.

#### 2. Bounded pinned rollout reader

**File**: `skills/10x-pipeline/scripts/codex-usage.mjs` (new)

**Intent**: Reuse host-reported session paths and the settled identity set to account for parent and child requests once.

**Contract**: For the qualified `0.169.0` schema, join records to actual thread IDs and causal root session/turn, deduplicate by `(thread_id, response_id)`, and reject conflicting duplicates. Include attributable reported usage from incomplete responses when the host records it. Sum input plus output; cached input and reasoning output are subsets, not extra tokens. Reconcile each fresh attributable thread's response sum with its compatible final cumulative token snapshot, then sum disjoint threads. Archived descendants are included. A stable matching duplicate is harmless; a missing/mismatched source, unknown lineage, unsupported shape/version, conflicting snapshot or unsafe arithmetic yields no total. Resumed/forked histories without a proven invocation-local boundary are unavailable; do not subtract arbitrary cumulative snapshots or resume threads. A collaboration marker without a provably accounted tree cannot be treated as a flat step. No model calls, permissions changes, billing endpoint or state writes.

#### 3. Model-free host fixtures

**Files**: `skills/10x-pipeline/test/codex-usage.test.mjs` (new), `skills/10x-pipeline/test/codex-helpers.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/codex-chain.test.mjs`, `skills/10x-pipeline/test/run-lock.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Exercise the reader through the real runner and existing fake CLI, including both chains and archive envelopes.

**Contract**: Give the fake host version, turn identities, session paths and sanitized pinned records. Prove multi-request children, archived descendants, duplicate enumeration/records, cached subsets, zero with/without evidence, missing first record with final snapshot retained, late/truncated records, foreign records, conflicting IDs, symlink/outside-root paths, changing file identity, overflow and resource limits. Update old malformed-usage expectations: completed execution with bad accounting now returns unavailable tokens and releases its lock; malformed execution JSON or unproved closure still suspends. Assert one exec, one enclosing result and no resume calls or router-state writes.

### Success Criteria:

#### Automated Verification:

- Codex fixture totals reconcile once per settled invocation and all incomplete, unsafe and unsupported sources omit totals: `node --test skills/10x-pipeline/test/codex-usage.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs`.
- Both chains preserve settlement, single intake, permission controls and archive isolation: `node --test skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/run-lock.test.mjs`.
- The required repository suite passes after Phase 2: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 3: Collect Claude usage without trusting final-request counts

### Overview

Apply one shared collector contract to native Agent immediate, late and archive handling. Correct flat-step undercounting as well as delegated usage, with optional telemetry and explicit fallback.

### Changes Required:

#### 1. Read-only native usage collector

**File**: `skills/10x-pipeline/scripts/claude-usage.mjs` (new, importable reader and standalone CLI)

**Intent**: Make host record accounting executable and testable instead of asking the orchestrator to calculate totals from notification text.

**Contract**: The CLI receives a bounded descriptor on stdin containing router invocation identity, observed host version, exact native session/agent/run identities and already-authorized local source locations. It emits one normalized `{usage, usageEvidence}` object and writes no run state. Missing capability is a successful unavailable measurement, not a failed step. Do not install hooks, enable an exporter, change destination/settings, read secrets, or start another query.

For qualified `2.1.311` native records, join documented `claude_code.api_request` events by exact session/agent/request identity and verified parent-child relationships. Count distinct requests once, including all four token buckets. Match the enclosing Agent launch and every discovered child to terminal records. Qualify the version-specific terminal transcript adapter using sanitized records: deduplicate streamed assistant records by message/request identity, distinguish updates from separate requests, establish the full invocation-local request set and reconcile that set and counters with telemetry. Merely summing equal totals is insufficient when request membership is not proved. Reject conflicting snapshots, missing child closure, unexplained auxiliary requests and ambiguous retry/resume boundaries. Never infer a complete request set from a boolean supplied by the step or a quiet export file.

The native positive path is enabled only for a schema/capability combination whose final matched records establish this boundary. If the installed host cannot supply it, return `incomplete-capture` or `missing-source` with no tokens. This is the explicitly selected delivery behavior, not an unresolved design choice. An isolated whole-query `modelUsage` snapshot is a fixture/probe reference only for that exact query boundary, never a substitute for a nested native step total. Do not add an SDK execution path.

#### 2. Wire immediate, late and archive ownership consistently

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: Use the shared reader whenever matched, authorized host evidence is available, and explain unavailable usage without delaying result intake.

**Contract**: Record exact invocation identity independently of repeated descriptions. Replace step-authored accounting with reader output, retaining independently measured tool/duration values at their existing scope. Remove unconditional flat-step `subagent_tokens` mapping. A final-request notification alone never supplies `totalTokens`. With no usable source, immediately attach unavailable evidence and proceed to `next`. Already-arrived late complete evidence uses the new structured `usage` mode once, before the existing publication/archive-launch cutoff; persist no raw source in its transient payload and clean it before terminal handoff. Do not wait or poll for accounting. Archive usage/evidence goes only to the final message. Keep both Anti-stall sections equal and all existing suspension/result matching rules intact; skills still name no literal routing models, effort levels or tiers.

#### 3. Native record and lifecycle tests

**Files**: `skills/10x-pipeline/test/claude-usage.test.mjs` (new), `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/nested-subagents.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Prove the same accounting function is used for immediate, late and archive cases and unsupported environments remain usable.

**Contract**: Use sanitized multi-request flat/step/leaf fixtures with streamed duplicates, cache creation/read, late events, conflicting duplicates, wrong sessions/agents/parent IDs, superseded runs, internal agents, missing terminal records, missing telemetry and unsupported versions. Include the research timing case where final result precedes the final request export; it must stay unavailable until independently reconciled. Assert orchestrator requests are excluded, no raw data is persisted, no exporter settings are changed and no notification triggers a second `next`. Positive fixtures prove only their pinned adapter contract, not untested interactive support. Index the new test.

### Success Criteria:

#### Automated Verification:

- Claude fixtures prove whole-invocation totals, cache accounting, exact attribution and fail-closed immediate/late/archive behavior: `node --test skills/10x-pipeline/test/claude-usage.test.mjs skills/10x-pipeline/test/late-usage.test.mjs`.
- Both skills preserve matching and anti-stall behavior while rejecting flat or delegated final-request totals: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- The required repository suite passes after Phase 3: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 4: Truthful reports, comparisons and migration evidence

### Overview

Expose coverage clearly, preserve legacy data, and document exactly what is measured and qualified.

### Changes Required:

#### 1. Reports, status, comparison and pricing labels

**Files**: `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/state.mjs` (cost output metadata only if needed)

**Intent**: Make missing measurements and scope differences visible without misrepresenting children as parent-model spend.

**Contract**: Keep existing numeric totals and JSON keys compatible; add coverage counts and per-step normalized evidence to status/compare. Report verified observed totals, unavailable reasons and legacy scope separately, using a compact coverage section next to the existing token table. Missing cells remain `-`, measured zero remains `0`; a partial total says subtotal. Aggregate only safe integers, reporting an unavailable aggregate on overflow. Include failed executed attempts as today; skipped and archive-only execution remain excluded.

Require complete verified scope on both sides for a new verified comparison. Keep legacy-to-legacy calculations with an explicit unverified-scope warning. Any mixture of verified and legacy token scopes, within or across sides, makes the savings verdict not comparable with a stable scope reason; missing new totals retain `usage-incomplete`. Preserve existing provenance and baseline requirements. JSON grouping keys remain compatible, but Markdown labels and metadata explain that provider/model/tier groups refer to enclosing dispatch. For verified subtrees label cost as a routing-rate approximation that can price child usage at the parent's blended rate; never call it actual model spend. No new per-child billing breakdown.

#### 2. Contract and support documentation

**Files**: `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`, `README.md` only where current usage claims need correction; `context/changes/delegated-token-accounting/evidence/accounting.md` (new)

**Intent**: Record scope, optional source setup, fallback, compatibility and the narrow immutability amendment, separating implementation proof from host qualification.

**Contract**: Amend existing ADRs rather than rewrite their history. Document the structured usage CLI, version qualification, limits, token/cache semantics, unavailable reasons, pricing labels, late cutoffs and rollback rules. Explain how an operator supplies already-authorized local Claude capture and matched native source paths; do not silently enable telemetry. Search current docs/skills/tests for old flat-token mapping, blanket child suppression and whole-object immutability claims, correcting relevant live contracts and their tests; leave archives untouched. Evidence records sanitized fixture provenance and checks, exact qualified capabilities and outstanding Manual cells. Temporary probe paths in research are provenance, not portable test dependencies; if unavailable, use documented-shape fixtures and explicitly retain live qualification as pending. Do not invent retained record IDs or claim a reconstructed fixture is captured telemetry.

#### 3. Reader compatibility regressions

**Files**: `skills/10x-pipeline/test/route.test.mjs`, `skills/10x-pipeline/test/compare.test.mjs`, `skills/10x-pipeline/test/cost.test.mjs`, relevant existing contract tests and test indexes

**Intent**: Verify numbers and user-facing explanations at the final report boundary with local fixtures.

**Contract**: Cover all-verified, all-legacy, mixed, incomplete and zero-token runs; same totals with different coverage; safe-sum overflow; parent-routed model labels for mixed child models; late token report refresh; archive exclusion and byte-identical legacy data. For both chains, feed the actual Codex runner and Claude collector fixture output through router intake into status/report/compare, including a resumed run with legacy entries, to prove that producer evidence reaches the reader and prevents mixed-scope savings verdicts before activation. Use existing local fake clients if publication rendering is exercised; no GitHub access is required.

### Success Criteria:

#### Automated Verification:

- Status, report, compare and cost fixtures distinguish verified, legacy, missing and mixed scopes without double counting: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/cost.test.mjs`.
- Final local validation passes and evidence records the commands and results: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, `node tools/version-check.mjs`, and `git diff --check`.

#### Manual Verification:

- Qualify the final candidate on fresh multi-request delegated Codex and native Claude runs in both interactive and headless modes, across both pipeline entry points; record exact versions, invocation boundaries, matching totals or explicit unavailable reasons, and unchanged settlement in `evidence/accounting.md`.
- Inspect immediate, late and archive output on the qualified hosts: no final-request count presented as a whole step, no double count, no missing value shown as zero, no archive usage in numbered totals, and clear subtotal and routing-rate labels; retain unsupported positive paths as unqualified.

## Testing Strategy

Unit tests exercise normalization, identity joins, duplicate/conflicting records, cache arithmetic, snapshot reconciliation and bounded I/O. Integration tests run the real router and Codex runner with fake host clients and existing scratch-project helpers. Every negative token case asserts the execution outcome and native lock behavior separately, so an accounting safeguard cannot hide an execution regression.

Add sanitized fixtures in the new test modules or small fixture files indexed by the test README. Capture no secrets, prompt text or raw real-user transcripts. A hand-authored protocol fixture demonstrates deterministic logic only; a captured fixture must identify its source version and sanitization. Expected sums are independently explicit in the fixtures. The research's historical totals are corroboration, not constants that a new live run must match.

Run focused checks while editing and the full required suite after each phase that changes scripts or prompts. On Node 24+, the full suite command above is the repository gate. Unattended implementation may continue after Automated rows pass; it must leave Manual rows unchecked unless their proof is actually obtained. No publication-dependent condition is classified Automated.

Passing an intermediate phase gate permits development to continue, not activation of that revision. Phase 4's existing reader acceptance covers the integrated producer-to-reader cases above; the complete candidate must pass every Automated gate before use by a pipeline run.

## Performance Considerations

Stream bounded JSONL sources and keep only deduplication identities, counters and limited reconciliation metadata. Avoid whole-history directory walks or retained raw output. Reuse the already verified tree; usage-specific reads have their own finite limits and no polling loop. Missing access or exhausted limits omit tokens rather than slow or block completion indefinitely.

## Migration Notes

**Expand:** Build additive persistence and the structured late-input path first, then complete host producers and scope-aware report/comparison readers within the same candidate. Release and activate all four phases together after their Automated gates pass; no intermediate producer revision may run against older readers. Keep existing numeric fields, legacy CLI and log readers working. No stored-ledger migration or deletion is needed.

**Migrate:** New invocations emit versioned evidence. Old entries remain legacy and immutable, including historical final-request totals. A resumed run can contain both; display the distinction and withhold an incompatible savings verdict. New late enrichment requires evidence identity recorded at initial intake; it cannot upgrade an old ambiguous entry merely because `<n>` matches.

**Verify:** Exercise old fixtures with new readers, new fixtures through current intake, and mixed logs. Prove exact replay and refusal do not rewrite logs, reports or metadata, and archive preparation restores both figure and evidence on failed commit. Collectors never own router state or archive writes.

**Rollback:** Keep the same implementation revision for an active invocation through intake and settlement; do not hot-swap skills while descendants can write. If accounting fails, prefer the built-in unavailable state. Reverting the implementation requires a normal follow-up commit with logs preserved, after execution settles; older readers can still consume numeric fields but will not display new coverage semantics. Therefore do not use an older report/compare renderer to assert verified scope or savings for new/mixed records. Do not strip evidence or rewrite history to make a downgrade appear compatible.

**Contract:** No destructive contraction is planned. Raw host records remain host-owned, and archive ledgers are not backfilled. Schema/version expansion needs new evidence and tests before enabling another positive adapter.

## References

- [Change identity](change.md) and [research, including recovery decision](research.md#recovery-evidence-and-delivery-decision).
- `skills/10x-pipeline/scripts/run-codex.mjs:133`, `:244`, `:394` — settlement and present token intake.
- `skills/10x-pipeline/scripts/flow.mjs:105`, `:461`, `:547` — reporting, numeric validation and result persistence.
- `skills/10x-pipeline/scripts/route.mjs:384`, `:768`; `skills/10x-pipeline/scripts/state.mjs:214` — compare, late usage and cost estimation.
- `skills/10x-pipeline/test/codex-helpers.mjs`, `codex-runner.test.mjs`, `late-usage.test.mjs` — reusable fake host and persistence tests.
- `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`, `docs/REFERENCE.md` — execution ownership and public contracts.
- `context/foundation/lessons.md`; `context/foundation/roadmap.md` S-20 — current-document consistency and live qualification boundary. No roadmap item has this change ID; roadmap remains unchanged.
- Authoritative pinned Codex and Anthropic documentation links are retained in [research](research.md); their exact inspected versions bound the planned readers.

## Progress

### Phase 1: Shared evidence and safe late enrichment

#### Automated

- [x] 1.1 Evidence validation and intake preserve valid results and legacy counters while rejecting unsafe token claims: `node --test skills/10x-pipeline/test/usage-evidence.test.mjs skills/10x-pipeline/test/result-persist.test.mjs`. — 08535793
- [x] 1.2 Late enrichment is invocation-bound, idempotent and atomic across both chains and archive preparation: `node --test skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/run-state.test.mjs`. — 08535793
- [x] 1.3 The required repository suite passes after Phase 1: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 08535793

### Phase 2: Collect settled Codex step-tree usage

#### Automated

- [x] 2.1 Codex fixture totals reconcile once per settled invocation and all incomplete, unsafe and unsupported sources omit totals: `node --test skills/10x-pipeline/test/codex-usage.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs`. — 26a524e4
- [x] 2.2 Both chains preserve settlement, single intake, permission controls and archive isolation: `node --test skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/run-lock.test.mjs`. — 26a524e4
- [x] 2.3 The required repository suite passes after Phase 2: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 26a524e4

### Phase 3: Collect Claude usage without trusting final-request counts

#### Automated

- [x] 3.1 Claude fixtures prove whole-invocation totals, cache accounting, exact attribution and fail-closed immediate/late/archive behavior: `node --test skills/10x-pipeline/test/claude-usage.test.mjs skills/10x-pipeline/test/late-usage.test.mjs`. — 9da3accc
- [x] 3.2 Both skills preserve matching and anti-stall behavior while rejecting flat or delegated final-request totals: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`. — 9da3accc
- [x] 3.3 The required repository suite passes after Phase 3: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 9da3accc

### Phase 4: Truthful reports, comparisons and migration evidence

#### Automated

- [x] 4.1 Status, report, compare and cost fixtures distinguish verified, legacy, missing and mixed scopes without double counting: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/cost.test.mjs`. — 74452e1f
- [x] 4.2 Final local validation passes and evidence records the commands and results: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, `node tools/version-check.mjs`, and `git diff --check`. — 74452e1f

#### Manual

- [ ] 4.3 Qualify the final candidate on fresh multi-request delegated Codex and native Claude runs in both interactive and headless modes, across both pipeline entry points; record exact versions, invocation boundaries, matching totals or explicit unavailable reasons, and unchanged settlement in `evidence/accounting.md`.
- [ ] 4.4 Inspect immediate, late and archive output on the qualified hosts: no final-request count presented as a whole step, no double count, no missing value shown as zero, no archive usage in numbered totals, and clear subtotal and routing-rate labels; retain unsupported positive paths as unqualified.
