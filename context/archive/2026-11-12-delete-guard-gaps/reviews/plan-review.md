<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Recursive-delete guard gaps implementation plan

- **Plan**: context/changes/delete-guard-gaps/plan.md
- **Mode**: Deep, verified directly in this worker
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict and counts describe the plan before review edits. Both findings have been applied to the plan and brief.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding passed for the sole implementation target and five supporting paths. Verified `skills/10x-pipeline/test/no-recursive-delete.test.mjs`, `skills/10x-pipeline/test/helpers.mjs`, `skills/10x-pipeline/scripts/remove-tree.mjs`, `skills/10x-pipeline/scripts/state.mjs`, `docs/ADR/ADR-016-no-recursive-force-delete.md`, and `context/changes/WAVES.md`. All four referenced scanner functions exist and their callers remain in the guard file. The existing scanner, cleanup, discovery and dispatch mechanisms support one implementation phase. The brief and plan share that scope. The property-policy discrepancy is recorded in F1.

Progress has one terminal section, one matching phase, and five unticked Automated rows matching the five success criteria. The contract-surfaces document is absent.

## Findings

### F1 — Property acceptance rules diverge from the change brief

- **Severity**: WARNING
- **Impact**: LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Implementation Approach, Phase 1 Filesystem-option validation, Testing Strategy
- **Detail**: The original plan repeatedly specified rejection of shorthand recursion alone. The brief explicitly requires every shorthand key to be reported, which includes `{ force }`. The phase contract also said to report quoted or escaped keys without restricting that statement to recursive keys, conflicting with acceptance of transparent literals without recursion. An implementer could pass the listed tests while accepting shorthand or rejecting an explicit `"force"` property. The relevant contract is in `context/changes/delete-guard-gaps/change.md:41`, and the current safe-delete control is in `skills/10x-pipeline/test/no-recursive-delete.test.mjs:212`.
- **Fix**: Explicitly reject every shorthand property and accept quoted or escaped explicit nonrecursive keys. Add paired regression cases for `{ force }`, `{ "force": true }`, and an escaped spelling of `force`.
- **Decision**: APPLIED — changed plan sections Desired End State, Implementation Approach, Assumptions and Decisions, Phase 1 Filesystem-option validation, and Testing Strategy / Scanner regressions. Updated the corresponding plan-brief decision.

### F2 — Lexical delimiters can hide the actual options argument

- **Severity**: WARNING
- **Impact**: LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach, Phase 1 Filesystem-option validation, Testing Strategy
- **Detail**: The plan enumerated nesting, quoting, escaping and comments while promising to identify the actual second argument. Valid JavaScript regular-expression literals can contain commas and closing parentheses. An inert probe of `fs.rmSync(/[,)]/.test(name) ? a : b, opts)` showed the current `callArgs` returning only `/[,`, discarding the real options argument. Extending that mechanism without a lexical rule can misclassify an opaque-options call as an accepted one-argument call. Nested template interpolation presents the same boundary obligation. The responsible argument reader and delete-call loop are in `skills/10x-pipeline/test/no-recursive-delete.test.mjs:155` and `skills/10x-pipeline/test/no-recursive-delete.test.mjs:166`.
- **Fix**: Specify regular-expression and template-interpolation handling, including regex character classes, escaped delimiters and division. Require diagnostics for unresolved lexical boundaries, including apparent one-argument calls, and add paired unsafe and safe argument-parsing regressions.
- **Decision**: APPLIED — changed plan sections Implementation Approach, Phase 1 Filesystem-option validation, and Testing Strategy / Scanner regressions. Updated plan-brief Architecture / Approach and Open Risks & Assumptions.

## Verification

- On Node v26.13.1, `node --test --test-name-pattern="^guard:" skills/10x-pipeline/test/no-recursive-delete.test.mjs` passed three tests with zero failures and zero skips.
- An in-memory evaluation of the existing scanner reproduced all six missed JavaScript examples and both split-flag prose examples. The combined-flag control produced a diagnostic. Source strings were passed as data.
- The same in-memory probe reproduced the regex argument truncation described in F2.
- Repository searches confirmed the scanner's local callers, existing safe deletion forms, Wave 5 ownership, and the shared scratch and cleanup helpers.
- Artifact assertions confirmed the Progress section matches its pre-review Git version byte for byte, all five criteria match their Automated rows, and the router parses two APPLIED warnings with zero open findings. `git diff --check` passed.

## Assumptions and Scope

- Applied all clear fixes under the unattended task instruction. The brief's explicit shorthand rule supplies the property-policy decision. The actual-second-argument and fail-closed contracts supply the lexical-boundary decision.
- Per the no-nested-subagents rule and `context/foundation/lessons.md`, this worker performed the deep verification directly.
- The step's permitted edit set governs artifact updates. The review and plan fixes are saved in the three permitted files. The five Progress rows retain their original indices, titles and ticked state.
- This step verifies the review artifacts and baseline guard behavior. Full implementation and full-suite verification remain assigned to Phase 1. Static detection retains the plan's limits for arbitrary runtime-generated shell commands and aliases.
