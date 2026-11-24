<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Native Claude Transcript Capture

- **Plan**: [Native Claude Transcript Capture Implementation Plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-24
- **Verdict**: REVISE
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 28/28 existing paths ✓, 9/9 symbols ✓, brief↔plan ✓. The original plan has one canonical Progress section with 11 rows that match the phase criteria. All Automated criteria can run locally. The two live host checks are Manual, and publication is outside both.

## Findings

### F1 — A finished marker can outlive the invocation it describes

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, Invocation membership and totals
- **Detail**: The original plan excludes resumed histories but spells out only launch matching and `finished: true`. A previously finished agent can be resumed or have later records appended with the same session, agent and version. Stable reads and distinct message IDs would then allow extra requests into the total. The verified reader binds the start prompt and follows UUID ancestry from a separately established terminal record. The research sample did not qualify appended histories. [Verified reader](../../../../skills/10x-pipeline/scripts/claude-usage.mjs#L361-L386) · [Transcript sample](../research.md#transcript-evidence-bounded-sample)
- **Fix**: Require proved fresh launch and settled return boundaries per agent, deduplicate repeated tool-use IDs, and fail closed on reuse, ambiguous boundaries or usage outside the proved lineage.
  - **Strength** Reuses the existing launch prompt and ancestry pattern. Fixture cases can distinguish an incomplete tree from a stale completed marker.
  - **Tradeoff** A transcript with an unrecognized or missing return boundary yields no total.
  - **Confidence** HIGH for the boundary requirement, which follows from the fresh-only scope and the existing verified reader.
  - **Blind spot** The live sample does not establish which Claude versions write sufficient return evidence for every flat and nested invocation.
- **Decision**: APPLIED in Phase 2, Invocation membership and totals, and Testing Strategy.

### F2 — Transcript figures can trigger an exact-token savings verdict

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, Intake, late attachment and reporting
- **Detail**: The original plan calls for a scope label while keeping transcript totals in `compare`. Its verdict checks every step for a number and blocks only a verified/legacy mixture. A pair with transcript figures and full numeric coverage can therefore report an exact drop even when the amount omitted by each side differs. [Verdict calculation](../../../../skills/10x-pipeline/scripts/route.mjs#L612-L650) · [Comparison contract](../../../../docs/REFERENCE.md#L552-L565)
- **Fix**: Preserve observed totals, coverage and approximate costs. Suppress the existing savings verdict for transcript-only and mixed transcript comparisons in both formats, including under `--unpinned`.
  - **Strength** Keeps the existing meaning of the exact-token target and preserves the figures for inspection.
  - **Tradeoff** Two transcript-only runs yield observed totals without a `dropPercent`.
  - **Confidence** HIGH because the contract uses exact raw-token totals and the recorded research establishes possible undercounting.
  - **Blind spot** The amount of omitted usage varies by invocation and is unmeasured in transcript mode.
- **Decision**: APPLIED in Planning assumptions, Phase 1, Testing Strategy and the plan brief.

### F3 — Metadata reads can restart the collection deadline

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2, Session discovery and scoped reads
- **Detail**: An unmodified `readBoundedFile` starts a fresh deadline on each metadata read. A directory scan can also allocate the full listing before applying its entry cap. The existing launcher probe already checks descriptor identity while allowing ordinary appends to a live file. That is the appropriate pattern for readiness. [Bounded readers](../../../../skills/10x-pipeline/scripts/usage.mjs#L121-L187) · [Readiness probe](../../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L86-L99)
- **Fix**: Thread one absolute deadline and remaining byte budget through all collection reads. Iterate directories incrementally and use the descriptor-based readiness probe pattern on the active main file.
- **Decision**: APPLIED in Phase 2, Session discovery and scoped reads, Testing Strategy and Performance Considerations.

### F4 — Neutral replay has no saved capture mode

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3, Mode selection and init, and Collection and late recheck
- **Detail**: Initial dispatch, neutral replay and archive assemble action fields separately. The current replay record preserves provider and prompt but carries no capture mode. Reading current policy on a replay could select a different source from the original action. The archive descriptor also serves external runners, which do not use native capture mode. [Initial dispatch](../../../../skills/10x-pipeline/scripts/route.mjs#L293-L326) · [Neutral replay](../../../../skills/10x-pipeline/scripts/flow.mjs#L452-L508) · [Archive descriptor](../../../../skills/10x-pipeline/scripts/isolation.mjs#L828-L842) · [External validation](../../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L75-L89)
- **Fix**: Store the selected mode on the numbered native dispatch and emit it on native run and archive actions. Use the saved mode for neutral readiness and replay, treat pre-field actions as telemetry, and choose the late collector from recorded evidence source.
- **Decision**: APPLIED in Phase 3, Testing Strategy, Migration Notes and the plan brief.

### F5 — Delayed completion can discard the keys required for late attachment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2, Invocation membership and totals, and Phase 3, Collection and late recheck
- **Detail**: The original plan allows the descriptor to omit version and wants a terminal recheck of delayed records. If the collector stops at `finished` or a missing child before deriving identity and version, a later usable total cannot attach. The router requires exact equality with the first evidence record, including host version. [Late attachment gate](../../../../skills/10x-pipeline/scripts/route.mjs#L883-L908) · [Late usage contract](../../../../docs/ADR/ADR-019-late-usage-figure.md)
- **Fix**: Preserve proved root identity and qualified version ahead of tree-completeness checks when available. Specify that entries lacking those facts at intake are ineligible for late attachment and exercise both cases locally.
- **Decision**: APPLIED in Phase 2, Invocation membership and totals, Phase 3, Collection and late recheck, Testing Strategy and the plan brief.

### F6 — The new scope can disappear from report excerpts and summary docs

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Intake, late attachment and reporting, and Phase 3, Documentation and local verification
- **Detail**: The report uses a closed source-label map for unavailable guidance. Its near-title line survives capped excerpts, unlike the coverage section below the table. The ADR index also repeats the launcher-required default. [Report source labels](../../../../skills/10x-pipeline/scripts/flow.mjs#L109-L133) · [Excerpt contract](../../../../docs/REFERENCE.md#L460-L466) · [ADR index](../../../../docs/ADR/README.md#L24-L25)
- **Fix**: Label `claude-transcript` explicitly, disclose possible undercount near the report title, and include the ADR index in the documentation sweep.
- **Decision**: APPLIED in Phase 1, Intake, late attachment and reporting, Phase 3, Documentation and local verification, Testing Strategy and the plan brief.

### F7 — The version check crosses the current dependency direction

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, Evidence normalization and coverage
- **Detail**: The plan requires both collection and evidence normalization to recognize qualified Claude versions. The existing qualification predicate lives in a module that imports `usage.mjs`. Importing it back from `usage.mjs` creates a cycle, while reimplementing the predicate can make the two paths disagree. [Existing import and predicate](../../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L1-L28)
- **Fix**: Share the existing qualification predicate without introducing a cycle, retain the capture-data exports, and include launcher version regression coverage.
- **Decision**: APPLIED in Phase 1, Evidence normalization and coverage, and Testing Strategy.

## Assumptions

- Pre-change native actions and untagged descriptors use telemetry semantics because the existing collector accepts launcher binding or authorized explicit sources. This preserves neutral replay behavior on a policy change. [Existing collector](../../../../skills/10x-pipeline/scripts/claude-usage.mjs#L76-L111)
- The existing comparison target requires exact accounted tokens. Transcript observations remain visible while the whole-run savings verdict stays unavailable. [Comparison contract](../../../../docs/REFERENCE.md#L558-L564)
- Fresh ordinary session startup and settled transcript record qualification remain Manual checks. The recorded sample demonstrates the session identifier in one active session. The planned smoke test checks it during the first pipeline invocation in a fresh session. [Transcript sample](../research.md#transcript-evidence-bounded-sample)
