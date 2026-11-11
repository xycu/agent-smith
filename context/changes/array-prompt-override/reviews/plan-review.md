<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Array-form archive prompt and suffix override Implementation Plan

- **Plan**: context/changes/array-prompt-override/plan.md
- **Mode**: Deep (done in this subagent, no sub-agent launched per orchestrator note)
- **Date**: 2026-11-11
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: all cited sites checked. `isolation.mjs:680-681` and `route.mjs:180` are the only raw reads of `policy.prompts.archive` and `policy.prompts.suffix` in `scripts/` (grep of `prompts\.`). `promptText` (`flow.mjs:759`) joins parts with `\n` and resolves `@prompts/` refs; `checkPrompts` (`flow.mjs:778`) runs in `next` at `route.mjs:72` before the result file is consumed, so a bad part halts before the pre-archive commit. `promptText` is imported in both `isolation.mjs` (line 11) and `route.mjs` (line 31). Shipped `suffix` and `archive` are plain strings that do not start with `@prompts/`, so `promptText` returns them unchanged (byte-identical). `deepMerge` replaces an array override whole, so the issue's overrides reach the router as arrays. Test helpers `archiveProject`, `runNext` (`archive.test.mjs:534,552`), `makeProject`, `init` exist. The grep in row 1.4 matches nothing today besides the two edited lines (error messages in `flow.mjs` use `${template}`). Progress rows match Phase 1 criteria (5 rows, no checkboxes in phase bodies).

## Findings

### F1 — `@prompts/` part of an array override is not covered by a test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 3. Tests
- **Detail**: The end state says an array override "including `@prompts/` parts" works, but the test only uses literal strings. A regression that joined parts without resolving references would pass.
- **Fix**: Add one `@prompts/impl-review-warn.md` part to the `archive` array of the archive test and assert the file's trimmed text appears in the prompt.
- **Decision**: APPLIED — Phase 1, 3. Tests, Intent, and Testing Strategy, Unit Tests.

### F2 — A suffix or archive string starting with `@prompts/` now resolves as a file

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — 1 and 2
- **Detail**: Through `promptText`, a plain-string override that starts with `@prompts/` is read as a file reference instead of literal text. That is the documented template behaviour and `checkPrompts` already validates the key, so no halt appears after the commit. No change needed.
- **Fix**: None.
- **Decision**: PENDING — no fix needed; owner may confirm the behaviour is intended (it matches every other template).

### F3 — Existing string-default coverage is real but implicit

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy
- **Detail**: "Existing tests stay green" is backed by `openspec-archive.test.mjs:70` (`endsWith("\n\n" + POLICY.prompts.suffix)`) and the archive tests that match the prompt start; the plan did not name them.
- **Fix**: Name that check in Testing Strategy.
- **Decision**: APPLIED — Testing Strategy, Unit Tests, second bullet.
