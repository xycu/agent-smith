<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run provenance, tool-restricted step agents and an opt-in advisor Implementation Plan

- **Plan**: context/changes/managed-agent-patterns/plan.md
- **Mode**: Deep
- **Date**: 2026-11-02
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths and line refs ✓ (`route.mjs` 2323-2381, 2438-2448, 2609-2623, `helpers.mjs` 42-47, `compare.test.mjs` 330 and 753, `baseline-policy.json`, `.claude-plugin/plugin.json`), `agents/` absent as the plan says ✓, symbols (`readSide`, `promptText`, `checkPrompts`, `writeOverride`, `BASELINE_PIN`) ✓, brief↔plan ✓, Progress↔Phase rows 1.1-1.9, 2.1-2.10, 3.1-3.9 ✓. Verified: `baseline-policy.json` changes only `ladder`, `rigor`, `score`; existing `compare.test.mjs` pairs built by `side()` carry no provenance, so legacy-silent holds; no existing test requires `subagent_type: general-purpose` in `SKILL.md`; `prompts.advisor` as a plain `@prompts/` string passes the `policy.json prompts follow the rule form` test.

## Findings

### F1 — Hash-sensitivity tests would edit repository files

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 4 (rows 1.2), Phase 2 item 5 (row 2.5), Testing Strategy
- **Detail**: Rows 1.2 ("editing `prompts/score.md` changes only `prompts`") and 2.5 ("editing `agents/score.md` changes `agentFiles`") need a changed plugin file. `helpers.mjs` `run` spawns the fixed real `ROUTE` (`helpers.mjs:14`, `:79`), and the router derives its plugin root from its own location, so the only way to follow the plan literally is to edit repository files in a test, or the test cannot work. The plan also says `helpers.mjs` stays unchanged.
- **Fix**: Tests that change a plugin file copy `skills/10x-pipeline`, `.claude-plugin` and `agents` to a scratch directory, edit the copy and spawn the copy's `route.mjs` with `spawnSync` inside the test file.
- **Decision**: APPLIED — plan.md Phase 1 item 4 (Tests) and Phase 2 item 5 (Tests) contracts, and Testing Strategy "Unit Tests".

### F2 — Provenance computation could change init and next behavior

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 item 1 (Contract)
- **Detail**: `promptText` throws when an `@prompts/` reference does not resolve. Today `init` writes `meta.json` and `next` halts in `checkPrompts` with the run recoverable. If provenance is computed at `init` before `meta.json` is written and throws, `init` would halt earlier and write nothing. The plan says a missing record never halts but does not say how a computation failure behaves.
- **Fix**: Computing the record never halts: unreadable `plugin.json` gives `plugin: null`, unreadable `agents/` gives `agentFiles: null`, an unresolvable template gives `prompts: null`.
- **Decision**: APPLIED — plan.md Phase 1 item 1 (Provenance record in the router), Contract.

### F3 — Comparison mode for the expected set is not defined

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 3 (Contract)
- **Detail**: The contract picks the expected set by "mode (`pinned` or `unpinned`)". `readSide` computes a `pinned` value from the log, and `--unpinned` is a separate flag; with `--unpinned` and a pinned baseline the two disagree.
- **Fix**: The mode is `unpinned` when `--unpinned` is on, else `pinned`; it never reads `baseline.pinned`.
- **Decision**: APPLIED — plan.md Phase 1 item 3 (compare reads and compares provenance), Contract.

### F4 — Flag values and drift scope are open before Phases 2 and 3 land

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 1 (Contract), item 4 (Tests)
- **Detail**: Phase 1 records `agents.restricted` and `advisor.enabled` in `flags`, but those policy blocks arrive in Phases 2 and 3, and row 1.1 would assert `agentFiles` before `agents/` exists. The values of `archive` and `chrome` (stored in `meta`, not in the policy) and whether `plugin` and `flags` count toward `drift` are not stated.
- **Fix**: A flag the policy lacks or malforms reads `false`; `score.minRigor` reads the merged value or `null`; `archive` and `chrome` read the stored `meta` value or `false`; `drift` covers the keys of `sections` only; row 1.1 accepts `agentFiles` as `null` or 16 hex characters.
- **Decision**: APPLIED — plan.md Phase 1 item 1 (Contract) and Phase 1 item 4 (Tests, Contract).
