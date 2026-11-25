<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Native Claude step usage implementation plan

- **Plan**: context/changes/claude-usage-descriptor-contract/plan.md
- **Mode**: Deep (claims verified directly against the code, no sub-agent)
- **Date**: 2026-11-25
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 22/22 paths ✓ (every script, test, ADR and skill the plan names exists), symbols ✓ (`collectClaudeUsage`, `claudeCaptureCheckpoint`, `claudeCaptureMode`, `attachResult`, `REASONS` in `usage.mjs`, `INIT_FLAGS`), Progress↔Phase ✓ (rows 1.1–3.2 match the Success Criteria, one `## Progress`, no checkboxes in phase blocks), skill sizes 32,377 and 36,873 bytes ✓, no Automated row needs a pushed branch, PR or CI, brief↔plan ✓.

## Findings

### F1 — Automated criteria carry no runnable command or file mapping

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy, Phase 1–3 Success Criteria
- **Detail**: The Automated rows (1.1–1.3, 2.1–2.3, 3.1) describe behavior only. Testing Strategy says "with the files named in each phase", but Phases 1 and 2 name them inside the Proof paragraphs, and Phase 2 adds `late-usage.test.mjs` and the two archive tests without a command. An implementer cannot tell which files tick which row, and the repository rule runs only the covering files.
- **Fix**: Name the covering files and the `node --test --test-concurrency=2` command per phase in Testing Strategy.
- **Decision**: APPLIED — Testing Strategy now lists the covering test files for each phase and states when an Automated row is ticked. Progress rows untouched.

### F2 — Collector adapter reaches `flow.mjs` against the router module order

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details; Phase 1 — Intake
- **Detail**: Phase 1 puts the measurement in `flow.mjs:attachResult`, which imports only `state`, `preplan`, `steps`, `openspec` and `usage` (AGENTS.md import order). The collector lives in `claude-usage.mjs`, `claude-transcript.mjs` and `claude-capture-data.mjs`, none of them in that order. `init-usage.mjs` loads them by dynamic `import()` inside async code, which cannot run inside the synchronous `attachResult`. The plan says to keep intake synchronous and resolve the adapter in "the async CLI entry points" but never says who passes it in. An implementer would add a static import to `flow.mjs`, which breaks the ordering rule and makes a missing optional module fatal. `--agent-id` also needs its place in the `route.mjs` usage text.
- **Fix**: `route.mjs` resolves the optional adapter once and passes it into `attachResult` as an argument. `flow.mjs` gets no static import of the capture modules, a test covers the absent adapter, and the usage text lists `--agent-id` for `next`.
- **Decision**: APPLIED — Critical Implementation Details, optional collector-loading paragraph.

### F3 — Phase 2 widens scope past the frame's stated priority

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Late and archive callers
- **Detail**: The frame fixes the priority as the figure missing at step time and calls later recovery secondary. Phase 1 already removes the cause (the router builds the descriptor). Phase 2 adds a router-built recheck descriptor in plain `status`, a new read-only collector input on each chain's archive action with session or checkpoint binding, a competing-launch rule and a bound on the collector input, plus tests for both archive chains. That is a second feature in the archive and late paths, with its own attribution rules, and it enlarges the blast radius in `isolation.mjs` and `route.mjs:status`. Only the `invalid-json` diagnostic (defect 3) is clearly inside the stated defects.
- **Fix A ⭐ Recommended**: Keep the `invalid-json` diagnostic in Phase 2 and move the status-built recheck descriptor and archive collector input to a follow-up change. Strength: matches the frame priority and shrinks the largest-risk phase. Tradeoff: the late and archive paths still depend on the orchestrator building a descriptor until the follow-up lands. Confidence: MED — the frame supports it, but the owner may count the late path (defect 4) as in scope. Blind spot: how often the late and archive paths ran without evidence in the observed runs.
- **Fix B**: Keep Phase 2 as written. Strength: closes every defect of `change.md` in one change. Tradeoff: larger diff in the archive output and `status`. Confidence: MED. Blind spot: the cost of the archive input bound against a large action prompt.
- **Decision**: PENDING — owner must choose between narrowing Phase 2 to the `invalid-json` diagnostic and keeping the archive and late builders. Narrowing would change phase rows or success criteria, which this review may not edit.

### F4 — Phase 1 breaks the old loop contract until Phase 3 lands

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Result ownership; Performance and migration
- **Detail**: Phase 1 strips orchestrator-merged native `usage` and `usageEvidence` at intake. The loop text that tells the orchestrator to merge collector output is only replaced in Phase 3. A run on a revision with Phase 1 and without Phase 3 loses evidence the old loop did collect. The plan covers rows pending before the upgrade but not this intermediate state.
- **Fix**: State that the three phases land together in one run.
- **Decision**: APPLIED — Performance and migration, sentence before "Finish in-flight work on its enabling revision".
