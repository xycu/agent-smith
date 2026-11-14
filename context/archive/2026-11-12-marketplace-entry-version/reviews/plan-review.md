<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Drop the duplicate version from the marketplace plugin entry

- **Plan**: context/changes/marketplace-entry-version/plan.md
- **Mode**: Deep (claims verified by the reviewer directly, no sub-agent: the run forbids nested subagents)
- **Date**: 2026-11-13
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths exist, 6/6 symbols found (`collect`, `check`, `$..version`, `plugins[0].version` at `tools/version-check.mjs:41`, ADR-008 Decision sentence, `AGENTS.md:79`), brief and plan agree, Progress rows match phase success criteria (1.1-1.5, 2.1-2.5). Not verified: the guide quotes from code.claude.com (no web access in this run). No other file reads `plugins[0].version` (grep over the repository, `context/archive/` excluded).

## Findings

### F1 — The entry rule can throw on a non-object `plugins` entry

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 3 (Version guard) and change 4 (Guard tests)
- **Detail**: The contract says `check` never throws and covers a non-array `plugins`, but not an array holding `null`, a string or an array. A natural implementation, `"version" in entry`, throws a TypeError on `null`, which breaks the no-throw contract the plan itself states. `collect` reads `marketplace.plugins?.[0]` today only because of optional chaining.
- **Fix**: State that non-object entries are skipped by the entry rule and add a `plugins: [null]` / `plugins: "x"` no-throw test.
- **Decision**: APPLIED in plan.md, Phase 1 change 3 Contract and change 4 Contract.

### F2 — Current State misdescribes the AGENTS.md Layout bullet

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, AGENTS.md bullet
- **Detail**: The plan says the `.claude-plugin/` Layout bullet describes the four fields. `AGENTS.md:59` names no version field; it says only "`version` is set only by the release PR". Phase 2 still asks to add a sentence there, which is fine, but the stated starting point is wrong.
- **Fix**: Correct the Current State sentence.
- **Decision**: APPLIED in plan.md, Current State Analysis (AGENTS.md bullet).

### F3 — Why `metadata.version` must equal the plugin version is not recorded

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 2 (ADR-008 Amendment 3, Rules)
- **Detail**: Key Discoveries argue that `metadata.version` is the marketplace manifest version, a different field from the plugin version. The guard and the new ADR rule still force the two to be equal. That is a sound repository choice (release-please writes one number), but a later reader of the amendment could take it for a Claude Code requirement, or drop the equality when the guide changes.
- **Fix**: Say in the Amendment 3 rule and Context that the equality is a repository convention, not a Claude Code requirement.
- **Decision**: APPLIED in plan.md, Phase 2 change 2 Contract (Rules bullet).
