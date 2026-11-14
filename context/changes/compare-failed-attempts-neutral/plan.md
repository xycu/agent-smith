# Compare Failed Attempts Implementation Plan

## Overview

Use the router's shared `isFailure` predicate to compute each compare side's `failedAttempts`. Advisory score failures and executor fallbacks become neutral in the JSON count and Markdown row. Cheap first-attempt failures continue to count, following ADR-010's existing measurement semantics.

## Current State Analysis

`compareCommand` builds a pair through `comparePair`, which calls `readSide` for both arms. Each side reads its log, selects executed entries, and calculates failure and usage totals. `compareMarkdown` renders that pair's `failedAttempts` directly. The predicate at `route.mjs:490` omits the advisory guard already present in the exported `isFailure` predicate at `state.mjs:531`.

The scorer fixture at `compare.test.mjs:715` records a failed advisory score attempt and currently expects one failure at line 734. That assertion and its preceding comment encode the behavior this change corrects. The existing per-side failure test at line 546 covers ordinary failures in both output formats. The executor report test at `executors.test.mjs:1083` already verifies fallback neutrality in compare.

Historical locations in `change.md` resolve to `readSide` at `route.mjs:412`, `isFailure` at `state.mjs:531`, `budgetSteps` at `state.mjs:536`, and `rigorInputs` at `state.mjs:592`. Current baseline documentation lives under `Baseline comparison` in `docs/REFERENCE.md:305`. The current README links readers to reference material and describes comparison only in its feature summary.

### Key discoveries

- `executed` at `state.mjs:501` removes skipped entries before compare calculates its fields. Pending entries have no explicit false `ok` value.
- `isFailure` requires `ok === false` and falsy `fallback` and `advisory` fields. Existing callers in `steps.mjs` use it for discounts and score-shift guards, and `isolation.mjs:562` uses it for rollback eligibility.
- `rigorInputs` adds a cheap-attempt exception at `state.mjs:612`. `budgetSteps` also has a dedicated cheap-failure exception. ADR-010, lines 64 and 87, explicitly counts these failures elsewhere, and its A/B decision rule at line 164 measures failed implement attempts.
- ADR-007, line 112, explicitly describes the old compare behavior. Its compare-specific sentence must follow the new behavior while retaining the scorer's token accounting.
- Wave 4 assigns this change compare behavior in `route.mjs`. Its run-state sibling owns `state.mjs` writes and read-log paths and their `init`, `next`, and `usage` call sites. Other siblings own setup, dispatch instructions, test environment helpers, and CI configuration.

### Evidence gathered during planning

A scratch CLI pair inside this worktree reproduced `routed.failedAttempts = 2` for one failed advisory score, one ordinary failed implement, and one failed fallback. The shared predicate returned 1. Markdown printed `| Failed attempts | 1 | 2 |`, the pinned baseline counted one ordinary failure, and the routed token total included all 65 tokens. A separate predicate assertion confirmed that a failed entry carrying `cheap: true` is a failure.

The existing `compare.test.mjs` suite passed all 31 tests with zero skips on Node 26.13.1 before implementation. Its current green result includes the scorer assertion that expects the buggy count. The full repository suite is an implementation-phase acceptance check.

## Desired End State

For each side, `failedAttempts` equals the number of executed entries satisfying the imported `isFailure` predicate. JSON and Markdown expose that same count. The regression pair containing one advisory score failure and one ordinary implement failure reports exactly one failure.

| Executed entry | Contribution to failedAttempts |
| --- | --- |
| Ordinary entry with `ok === false` | 1 |
| Failed cheap first attempt | 1 |
| Failed advisory score | 0 |
| Failed fallback, including a cheap fallback | 0 |
| Successful entry or pending entry | 0 |
| Skipped entry | 0 |

All executed entries participate in usage totals and coverage checks, including advisory failures and fallbacks. A neutral failed score entry with missing usage still produces `usage-incomplete`. Older ordinary log entries with absent `advisory` and `fallback` fields continue to count when `ok === false`.

### Assumptions and decisions

- **Cheap failures count.** ADR-010's accepted owner decision makes these failures neutral specifically for rigor and budget. Counting them in compare also preserves the failed-implement measurement in its A/B decision rule. This is the evidence-backed unattended choice.
- **The shared predicate defines failure across executed step types.** The change request names `isFailure`, and existing compare output counts failures across the run. Its flag-based contract also governs legacy entries.
- **Implement-specific measurement reads step details when needed.** Compare's aggregate covers every executed step type. ADR-010's implement-specific A/B measurement can use the recorded step entries when a run also has other ordinary failures.
- **Complexity is low and one phase is sufficient.** Both output formats share one side object, the predicate already exists, and the CLI test helpers already provide the required fixtures. The user's unattended instructions authorize evidence-backed complexity, approach, and phase decisions.
- **Documentation includes the conflicting ADR-007 sentence.** The lessons register requires searching documentation when output changes. This edit concerns exactly the compare count described by this change.

## Scope and Ownership

| File or region | Planned work |
| --- | --- |
| `skills/10x-pipeline/scripts/route.mjs` | Add the shared predicate to the existing state import and use it in `readSide`'s failed-attempt calculation. |
| `skills/10x-pipeline/test/compare.test.mjs` | Cover neutral advisory and fallback failures, cheap failures, both formats, and pinned baseline compatibility. Correct the existing scorer assertion. |
| `skills/10x-pipeline/test/README.md` | Extend the existing compare-test row to mention failure classification. |
| `docs/REFERENCE.md` | Define `failedAttempts` and its Markdown row under `Baseline comparison`, including the cheap-failure decision and usage accounting. |
| `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md` | Amend the compare-specific sentence in the failed-attempt bullet with the new count semantics. |
| `context/changes/compare-failed-attempts-neutral/` | Plan, brief, lifecycle metadata, and subsequent execution evidence. |

Wave 4 ownership bounds implementation to these behavior regions. Shared documentation edits concern this change's semantics. `WAVES.md` belongs to post-wave maintenance. The existing test helpers, exported state predicates, router state persistence, other commands, policies, skills, CI, and OpenSpec modules provide the surrounding contracts for this work.

## Implementation Approach

Extend the existing state import in `route.mjs` and calculate the count by filtering the executed side entries with `isFailure`. Keep the side aggregation as the single source consumed by JSON and Markdown. Preserve the exported predicate's current semantics and the existing entry selection, schema, usage aggregation, comparison checks, and token verdict calculation.

Use the existing `side`, `compare`, `entry`, `skipEntry`, `writeLog`, and `writeMetaFile` helpers to exercise the real CLI. Fixtures should contain hard-coded expected counts so the regressions independently check the public behavior. Complete the router, tests, and documentation together in one phase.

## Phase 1: Share compare failure classification

### Overview

Apply the shared failure definition to compare, characterize the intended exceptions, and publish the metric's meaning with executable compatibility checks.

### Changes Required

#### 1. Compare aggregation

**File** `skills/10x-pipeline/scripts/route.mjs`

**Intent** Reuse `isFailure` in `readSide` so advisory entries and fallbacks follow the router's shared classification on either comparison arm.

**Contract** The existing per-side numeric `failedAttempts` field and Markdown `Failed attempts` row count executed failures, including failed cheap attempts. The existing state export supplies the predicate.

#### 2. CLI regression coverage

**File** `skills/10x-pipeline/test/compare.test.mjs`

**Intent** Add focused regressions beside the current failure-count coverage and correct the existing scorer assertion and comment. Reuse existing fixture helpers within this file.

**Contract** Exercise these observable cases in JSON and Markdown, with explicit expected values.

- An unpinned scorer A/B fixture containing one failed advisory score and one failed implement reports 1 for that side. Include a failed fallback and verify its contribution is zero. Mirror the side placement to exercise the same behavior on the baseline arm.
- A failed advisory score by itself reports 0. Update the existing `tokens.byTier` fixture's expected failure count from 1 to 0 and assert its Markdown row. Its token splits still include the failed scorer's usage.
- A failed cheap implement contributes 1. A cheap fallback contributes 0. Cover success, pending, skipped, and ordinary legacy entries with absent neutral flags using compact fixture cases.
- A pinned baseline containing ordinary failures and successful steps, with every executed entry on `sonnet/high` and no score step, reports its established ordinary-failure count in both formats. Assert `pinned`, comparability, token totals, and the token verdict against explicit expected values.
- A neutral advisory failure with missing usage retains the `usage-incomplete` reason. Existing read-only snapshots cover that compare writes nothing.

**File** `skills/10x-pipeline/test/README.md`

**Intent** Keep the existing compare-test index row descriptive of its added coverage.

**Contract** The row names failure classification and JSON/Markdown coverage alongside its existing topics.

#### 3. Metric documentation

**File** `docs/REFERENCE.md`

**Intent** Document the per-side failure metric under `Baseline comparison`, where current users find the command and output contract.

**Contract** Explain that explicit failed executed entries count when `isFailure` accepts them, that advisory failures and fallbacks are neutral, and that cheap failures count because their exceptions apply to rigor and budget. Name both `failedAttempts` and the Markdown row, and explain that neutral entries' usage still participates in totals and completeness checks.

**File** `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`

**Intent** Amend the compare-specific sentence in the existing failed-attempt bullet so its current behavior agrees with the reference documentation.

**Contract** Record the compare count correction and continued inclusion of failed scoring usage, preserving the surrounding scorer decision and historical evidence.

### Success Criteria

#### Automated Verification

- Advisory and fallback regressions pass with exact JSON counts and matching Markdown rows on both comparison arms.
- Cheap failures, cheap fallbacks, legacy ordinary failures, and the pinned baseline compatibility case pass with explicit expected counts.
- The complete compare test file passes, including corrected scorer token-split assertions, usage completeness, and read-only checks.
- The required router, OpenSpec, and tools suite passes with any environment-dependent skips recorded.
- `git diff --check` passes and the compare documentation checks agree on advisory neutrality, fallback neutrality, cheap-failure inclusion, and usage accounting.

## Testing Strategy

Use the real CLI through `compare.test.mjs` as the primary regression boundary. Confirm the new advisory regression fails against the original count, then apply the shared predicate and rerun it. The existing executor fallback assertion, first-attempt tests, scorer tests, and OpenSpec compare tests provide broader checks when the full suite runs.

Run shell commands from this worktree using the required prefix. Set `TMPDIR` to the worktree for test runs so scratch fixtures and their cleanup stay within the allowed directory. Existing helpers own scratch-log fixtures and per-file cleanup.

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-compare-failed-attempts-neutral" && TMPDIR="$PWD" node --test skills/10x-pipeline/test/compare.test.mjs
```

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-compare-failed-attempts-neutral" && TMPDIR="$PWD" node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-compare-failed-attempts-neutral" && git diff --check
```

Search current documentation for `failedAttempts`, `Failed attempts`, and failed score counting, then inspect the changed paragraphs against the regression expectations. The CLI tests cover the acceptance conditions through automation.

## Performance Considerations

Failure counting remains a linear pass over the already selected executed entries. The reused predicate adds one flag check per entry and uses the existing Node built-ins-only architecture.

## Migration Notes

Compare reads existing run logs using their recorded flags. Previously recorded ordinary entries with absent neutral flags retain their established classification. Re-running compare recalculates the corrected advisory count from those logs. Captured historical output remains evidence of the implementation that produced it.

## References

- Change requirements in [change.md](change.md).
- Wave 4 ownership in [WAVES.md](../WAVES.md).
- Documentation-search rule in [lessons.md](../../foundation/lessons.md).
- Compare aggregation at `skills/10x-pipeline/scripts/route.mjs:412` and Markdown rendering at `route.mjs:603`.
- Shared entry classification at `skills/10x-pipeline/scripts/state.mjs:501`, `:531`, `:536`, and `:612`.
- Existing failure-count fixture at `skills/10x-pipeline/test/compare.test.mjs:546` and scorer fixture at `:715`.
- Fallback comparison regression at `skills/10x-pipeline/test/executors.test.mjs:1083`.
- Current command documentation at `docs/REFERENCE.md:305`.
- Conflicting scorer comparison sentence at `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md:112`.
- Cheap-failure semantics at `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:64`, `:87`, and `:164`.

## Progress

### Phase 1: Share compare failure classification

#### Automated

- [x] 1.1 Advisory and fallback regressions pass with exact JSON counts and matching Markdown rows on both comparison arms.
- [x] 1.2 Cheap failures, cheap fallbacks, legacy ordinary failures, and the pinned baseline compatibility case pass with explicit expected counts.
- [x] 1.3 The complete compare test file passes, including corrected scorer token-split assertions, usage completeness, and read-only checks.
- [x] 1.4 The required router, OpenSpec, and tools suite passes with any environment-dependent skips recorded.
- [x] 1.5 `git diff --check` passes and the compare documentation checks agree on advisory neutrality, fallback neutrality, cheap-failure inclusion, and usage accounting.
