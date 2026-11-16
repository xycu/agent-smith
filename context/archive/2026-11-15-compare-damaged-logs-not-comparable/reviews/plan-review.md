<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Reject Damaged Comparison Evidence

- **Plan**: [Implementation plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-16
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warning, 0 observations

The verdict, dimension assessments and finding counts describe the original plan. The clear fix has been applied. No findings remain pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | FAIL |

## Grounding

Grounding verified 8/8 existing paths, 7/7 named functions and brief–plan agreement. Existing paths cover `route.mjs`, `state.mjs`, both test files, `docs/REFERENCE.md`, `WAVES.md`, the sibling change brief and ADR-005. Named functions cover `readLog`, `readSide`, `comparePair`, `compareMarkdown`, `projectFor`, `snapshot` and `faultScript`. `evidence/verification.md` is explicitly an implementation output. The optional contract-surfaces document is absent.

A read-only Node assertion check verified one terminal Progress block, the matching phase heading, three Automated criteria and two Manual criteria with identical Progress titles, and absence of checkboxes in the phase body. Publication, PR CI and the report comment already reside in Manual acceptance.

The shared comparison owner retains diagnostics and partial figures, adds eligibility reasons before computing the verdict, and supplies both output formats for both chains. `--unpinned` only bypasses baseline pinning. The existing fixtures support eligible controls, physical-byte snapshots and targeted read-failure injection. Source inspection supports the proposed reason codes and continued tolerant reading. [Comparison owner](../../../../skills/10x-pipeline/scripts/route.mjs#L426) · [Eligibility and verdict](../../../../skills/10x-pipeline/scripts/route.mjs#L531) · [Shared output entry point](../../../../skills/10x-pipeline/scripts/route.mjs#L676) · [Reader contract](../../../../skills/10x-pipeline/scripts/state.mjs#L493)

The documentation search found the eligibility and damaged-log descriptions in `docs/REFERENCE.md` already assigned to this phase. ADR-005 requires read-only inspection and null drops for incomplete inputs. Its contract remains compatible with the stricter eligibility rule. The ownership ledger and sibling brief support the declared split. Their future implementation overlap check remains in the plan. [Reference](../../../../docs/REFERENCE.md#L411) · [ADR-005](../../../../docs/ADR/ADR-005-baseline-usage-comparison.md) · [Ownership ledger](../../WAVES.md)

## Findings

### F1 — Scratch Git isolation is stripped before test children start

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is narrowly scoped verification setup
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy, in-worktree scratch setup
- **Detail**: The original plan places fixture roots beneath the run worktree and relies on an exported `GIT_CEILING_DIRECTORIES` to prevent repository discovery. `cleanEnv` removes all inherited `GIT_*` variables, and plain `run` uses the filtered environment. The comparison helper uses plain `run`. The full suite also includes a plain-run archive assertion requiring a nonrepository fixture. Those children can discover the enclosing worktree, so the prescribed environment does not establish the isolation required by the local gates. Callers explicitly re-adding `gitEnv` already have their own ceiling. [Environment filtering](../../../../skills/10x-pipeline/test/helpers.mjs#L129) · [Comparison caller](../../../../skills/10x-pipeline/test/compare.test.mjs#L167) · [Archive assertion](../../../../skills/10x-pipeline/test/archive.test.mjs#L410)
- **Fix**: Use a disposable PATH Git launcher that supplies the scratch ceiling after environment filtering, preserves fixture-owned ceilings and executes an already-resolved real Git. Require child-level nonrepository and initialized-repository checks before running either gate, and retain their evidence.
- **Decision**: APPLIED — changed plan.md’s Testing Strategy to specify the launcher, executable resolution, environment preservation and child-level proof. Synchronized plan-brief.md’s Prerequisites and Open Risks & Assumptions. All Progress indices, titles and tick states remain identical.

## Triage and verification

Applied F1 under the unattended instruction to apply every clear fix. The launcher is a review-selected local verification mechanism grounded in the existing `cleanEnv` and `gitEnv` contracts. It keeps the production implementation and shared-helper scope intact. Runtime suitability of the launcher must be demonstrated by the child checks during implementation.

One native read-only leaf, `/root/verify_plan_claims`, verified the riskiest source claims, callers and fixture support. Its completed result was reconciled with direct source inspection. No other children were launched. Token coverage is unknown.

The mechanical plan check and `git diff --check` pass. The repository’s `readReview` and `openCounts` functions read the original warning count, F1 as APPLIED and zero open findings. Runtime tests and launcher execution belong to implementation and were not run during this document review. This review changes only the plan, plan brief and this report. The original router-owned run log was already modified on entry. No review commit is required by the skill.
