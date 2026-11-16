# Reject Damaged Comparison Evidence Implementation Plan

## Overview

Make every nonempty `logProblems` collection disqualify a comparison. Preserve the surviving usage figures and sanitized diagnostics so both JSON and Markdown explain the incomplete evidence. Apply the same eligibility rule to 10x, OpenSpec and `--unpinned` comparisons.

## Current State Analysis

`readLog` accepts usable object records and reports invalid JSON, non-object values and read failures. `readSide` retains those diagnostics, but `comparePair` checks completeness against surviving executed entries alone. `compareMarkdown` renders the resulting pair. The eligibility owner already serves both chains and formats. [Reader](../../../skills/10x-pipeline/scripts/state.mjs#L493) · [Side reader](../../../skills/10x-pipeline/scripts/route.mjs#L426) · [Eligibility](../../../skills/10x-pipeline/scripts/route.mjs#L531)

Planning reproduced the defect through the real CLI on Node v24.19.0 at `8c847b02`, with no implementation edits. For each chain, a completed pinned 1,000-token baseline and completed routed steps of 500 and 600 tokens give `not met` at a 30% target. Truncating the second routed record yields 500 surviving tokens, `comparable: true` and `met`, despite `Invalid JSON` at physical line 2. Markdown repeats `met`, and `--unpinned` still reports a comparable pair. Log and metadata Buffers stayed identical across the comparison reads. Disposable fixtures used the existing helpers and `cleanupAll` inside this worktree.

The existing both-chain partial-log test proves attribution and read-only behavior, but its seeded entries lack completed outcomes and token figures. Extending its verdict assertions alone would allow unrelated eligibility failures to mask this defect. New integrity cases must start from demonstrably eligible completed pairs. [Partial-log test](../../../skills/10x-pipeline/test/run-state.test.mjs#L395) · [Comparison fixtures](../../../skills/10x-pipeline/test/compare.test.mjs#L145)

### Ownership confirmation

Wave 0 is present through merged commit `d7e08ba6` and release commit `adff64f7`. The Wave 1 ledger and both change briefs assign disjoint runtime ownership. At planning inspection, the sibling branch `agent-smith/run-branch-prefix-consistency` at `9f13a087` contains only its run artifacts beyond `main`, with no committed implementation or plan. The confirmation below uses the declared ownership, and implementation must recheck any subsequently committed sibling plan/diff before editing. [Wave boundaries](../WAVES.md) · [Sibling brief](../run-branch-prefix-consistency/change.md)

| Area | This change owns | Sibling owns |
| --- | --- | --- |
| Runtime | `route.mjs` comparison eligibility in `comparePair` | Setup, isolation policy/identity and publication in `prepare-run.mjs`, `isolation.mjs`, `state.mjs` and `open-pr.mjs` |
| Tests | Comparison cases in `compare.test.mjs` and partial-log cases in `run-state.test.mjs` | Setup, isolation, publisher and skill-loop tests named by its brief |
| Shared reference | Damaged-log inspection paragraph and comparison eligibility/diagnostic bullets | Branch naming, setup/publication guidance and baseline branch-creation paragraph |
| Other artifacts | This change's plan, brief and implementation evidence | Its skills, ADR amendments and change artifacts |

Shared reference edits remain section-scoped and must be merged sequentially if branches meet. Any new shared runtime or policy ownership requires serialization under the Wave 1 ledger before implementation. The current fix needs only the existing comparison owner. Leave the ledger and sibling artifacts to their owners.

## Desired End State

Any side with diagnostics adds exactly one side-attributed reason, `log-problems:baseline` or `log-problems:routed`. Either reason forces `comparable: false`, `dropPercent: null` and `verdict: "not comparable"`. All other applicable reasons and warnings remain observable. `--unpinned` continues to waive baseline pinning while this integrity requirement applies.

Usable entries retain their partial token totals, model/tier splits, coverage and other existing evidence. Diagnostics retain their absolute file, physical line or null line, and sanitized reason. Clean pairs retain existing results, rounding, target handling and warnings. Comparison remains a read-only inspection.

### Key Discoveries

- The existing `sides` loop owns side-specific eligibility reasons and precedes the shared verdict computation. This is the single extension point for the invariant. [Eligibility loop](../../../skills/10x-pipeline/scripts/route.mjs#L568)
- `compareMarkdown` consumes the pair object and already prints reasons and partial-log warnings. The eligibility correction reaches Markdown through that object. [Renderer](../../../skills/10x-pipeline/scripts/route.mjs#L618)
- Existing `projectFor`, `runIn`, Buffer-based `snapshot` and `faultScript` helpers in `run-state.test.mjs` support both-chain fixtures, physical-byte verification and deterministic read-error injection. Its `seed` helper serves other tests, so comparison eligibility belongs in the relevant fixtures. [Helpers](../../../skills/10x-pipeline/test/run-state.test.mjs#L23) · [Fault wrapper](../../../skills/10x-pipeline/test/run-state.test.mjs#L510)

## Scope Boundaries

The implementation reaches `route.mjs`, the two existing test files and the indicated reference sections. Existing fixture helpers supply setup and cleanup. The log reader, saved-run format, policy, exports, routing, cost accounting and baseline configuration retain their existing contracts. Log repair, new benchmark runs and FR-017 experiments belong to their separately recorded work.

## Implementation Approach

Use one implementation phase. Have the pipeline review this plan before implementation, then run its implementation review against the completed diff and evidence. The unattended planning assumption is low complexity with zero substantive questions because the change brief settles the behavior and the source identifies its owner. The single-phase structure follows that bounded scope.

Extend the per-side eligibility checks to consume the already-exposed `logProblems`. Retain tolerant reading for partial evidence and use the existing verdict calculation to suppress the savings result. Add regression coverage through the real router CLI, including an eligible clean control for each corruption case. Complete local gates before the terminal orchestrator publishes the branch and requested report comment.

## Phase 1: Enforce comparison integrity and verify the delivery

### Overview

Correct the comparison invariant, demonstrate it across the supported input paths, document the result and deliver local evidence for orchestrator publication.

### Changes Required

#### 1. Comparison eligibility

**File** `skills/10x-pipeline/scripts/route.mjs`

**Intent** Prevent known incomplete log evidence from yielding a savings verdict while preserving the available inspection data.

**Contract** In `comparePair`, a nonempty `logProblems` array contributes `log-problems:<side>` in the existing side-specific eligibility path, independently of pinning, outcome and usage checks. Both affected sides contribute their own reason. JSON and Markdown use the resulting pair through their normal entry points.

#### 2. Focused regression coverage

**Files** `skills/10x-pipeline/test/compare.test.mjs` and `skills/10x-pipeline/test/run-state.test.mjs`

**Intent** Catch the reproduced false success and prove that every currently reported damage category disqualifies a pair without losing partial evidence or modifying inspected files.

**Contract** Reuse `side`, `compare`, `targetPolicy`, both-chain project helpers and the existing observational test. Establish completed runs with full valid usage before adding damage. Keep shared fixture defaults stable for other callers. Cover the following through the real router CLI.

- For both chains, compare a 1,000-token pinned baseline with routed steps of 500 and 600 tokens at a 30% target. The clean control returns 1,100 routed tokens, `comparable: true`, `dropPercent: -10` and `not met`. Truncating the 600-token record returns 500 surviving routed tokens and the exact ineligible outcome, in JSON and Markdown.
- Exercise baseline-only, routed-only and both-side damage in both chains, with default pinning and `--unpinned`. Assert the specific integrity reason for each affected side, including when other reasons also apply. Keep `baseline-unpinned` warning behavior visible. A damaged skipped record also disqualifies a pair because the rule covers any diagnostic.
- Cover invalid JSON, valid JSON non-object records and read failures. Include primitive, null and array records using the existing reader categories. For filesystem failures, use the existing disposable CLI wrapper to inject an error only for the selected existing log path. Assert a null diagnostic line and side attribution even though no entries survive. Permission-dependent fixtures cannot reliably prove this on every host.
- Assert partial totals, surviving step/coverage counts and existing splits where usable entries survive. Verify absolute file paths, exact physical lines and sanitized diagnostic reasons. Both output streams and both formats must keep private damaged content and injected private error messages out of the output.
- Snapshot both change directories as physical bytes and entry types before and after JSON, Markdown and `--unpinned` reads. Include metadata, reports and stale state-temp sentinels, proving comparison performs no cleanup or writes.
- Use clean controls with CRLF and empty physical lines to prove continued eligibility. Retain whitespace-only corruption behavior. Keep existing zero-byte/no-step results and missing-log lookup halt coverage, which differ from a successfully located log with read diagnostics. Retain the existing clean target, rounding, warning and unpinned-verdict assertions.

Use the existing `removeTree`/`cleanupAll` path for disposable fixtures. Extend the existing test files so their indexed ownership stays current.

#### 3. Reference documentation and verification evidence

**Files** `docs/REFERENCE.md` and, when recording implementation results, `context/changes/compare-damaged-logs-not-comparable/evidence/verification.md`

**Intent** Make the damaged-log and comparison descriptions match the new eligibility rule and retain reviewable local proof.

**Contract** Update the damaged-log inspection paragraph and baseline comparison's damage, eligibility and `--unpinned` descriptions. State the two reason codes, null drop, ineligible verdict, retained partial evidence and both-chain applicability. Keep branch setup/publication prose within the sibling's ownership. Search other live documentation for eligibility claims and reconcile any actual contradictions within this scope. Record the candidate revision/diff, commands, Node version, focused/full-suite exit statuses and final pass/fail/cancel/skip counts in verification evidence. Identify expected existing skips explicitly.

### Success Criteria

#### Automated Verification

- Focused CLI regressions prove the 1,000-versus-1,100 example, either/both sides, both chains, default/`--unpinned`, all damage categories, JSON/Markdown agreement, retained partial evidence, privacy, byte-identical reads and clean-input compatibility with `node --test --test-concurrency=2 skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/run-state.test.mjs`.
- Reference text documents `log-problems:<side>` and the integrity requirement across both chains and `--unpinned`, verified with `rg -n 'log-problems|logProblems|unpinned' docs/REFERENCE.md` and the scoped output of `git diff --name-only` and `git diff -- docs/REFERENCE.md`, and `git diff --check` passes.
- On Node 24+, `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` finishes with exit zero, zero failures/cancellations and only explained existing skips, with the command and final counts recorded in verification evidence.

#### Manual Verification

- After local verification and pipeline reviews, the authorized orchestrator pushes the run branch, opens or retains a reviewable pull request and records its URL and successful PR CI result.
- The authorized orchestrator posts or updates the requested run-report comment on that pull request and records its URL with the actual local test results and any remaining acceptance items.

## Testing Strategy

The focused tests drive the normal CLI and reuse existing scratch projects for both chains. The eligibility assertion must specifically name the integrity reason so an outcome or usage failure cannot accidentally satisfy it. Clean controls prove the damaged state is the deciding difference. Deterministic per-file read-error injection exercises the actual tolerant-reader boundary without relying on operating-system permissions. Retain existing broad comparison tests for pinning, target arithmetic, warnings, archive lookup and read-only behavior.

Run focused checks before the required full suite and retain each failure until resolved. Run the full suite after runtime edits as required by AGENTS.md. In this run, keep scratch roots inside the absolute worktree using an ignored `.claude/worktrees/` scratch directory via `TMPDIR`, with `GIT_CEILING_DIRECTORIES` set to that scratch root so non-Git fixtures cannot discover the enclosing repository. Runner temporary directories remain outside each individual scratch project root. Await the same suite process to completion and record its actual summary.

External publication, PR CI and the requested comment remain Manual acceptance. Step subagents finish their authorized local work and commits through the implementation skill. The enclosing orchestrator alone performs publication through its existing terminal flow.

## Performance Considerations

Eligibility reuses the diagnostic arrays already produced while reading each side. The change adds no log read or additional traversal of log records.

## Migration Notes

| Boundary | Current owner and data | Transition |
| --- | --- | --- |
| Saved state writer | Router-owned `run.jsonl` object records and `meta.json` | Existing records and files remain usable without conversion |
| Diagnostic reader | `state.mjs` `readLog`, returning `entries` and `{ file, line, reason }` problems | Existing tolerant/strict contracts continue |
| Eligibility reader | `route.mjs` `readSide` and `comparePair` | Existing diagnostic evidence now contributes side-specific disqualification reasons |
| Output readers | CLI JSON consumers and `compareMarkdown` | Existing fields carry the stricter verdict and reason codes for damaged inputs |

The forward path is focused failing regressions, the eligibility correction, reference alignment and the completed full-suite gate. Saved runs can be inspected immediately with the corrected reader. Old and new installations read the same saved format, so overlapping installations require no dual write or data migration. Use the corrected plugin revision for integrity-qualified comparison evidence because an older comparator still has the reproduced defect. Repeated comparisons are idempotent reads and read failures remain visible diagnostics.

Rollback uses an ordinary preserving revert of the implementation commit. Existing logs, metadata and partial evidence survive because comparison writes none of them. Rolling back restores the known false-success behavior, so affected savings claims remain ineligible pending a corrected comparator. No destructive migration or contraction is part of this delivery.

## Assumptions

- The unattended instruction replaces interactive complexity and phase confirmations with evidence-backed decisions. Low complexity, zero substantive questions and one implementation phase follow the complete change brief and single eligibility owner.
- `log-problems:<side>` follows the existing `usage-incomplete:<side>` reason convention and names the diagnostic source. This is a plan-selected spelling because the brief specifies side attribution without an exact code.
- The sibling's declared scope is the ownership contract at planning time. Its committed branch currently has only run artifacts. Recheck its plan/diff before implementation and serialize any expanded runtime/policy overlap under the Wave 1 rule.
- Publication and the requested comment belong to the orchestrator under the always-true step rules. Their acceptance stays pending in Manual rows until the actual external evidence exists.

## References

- [Change brief](change.md)
- [Wave 1 ownership and sequencing](../WAVES.md)
- [Sibling branch-prefix scope](../run-branch-prefix-consistency/change.md)
- [Repository commands and safety rules](../../../AGENTS.md)
- [Comparison implementation](../../../skills/10x-pipeline/scripts/route.mjs#L382)
- [Tolerant log reader](../../../skills/10x-pipeline/scripts/state.mjs#L493)
- [Comparison regressions](../../../skills/10x-pipeline/test/compare.test.mjs)
- [Both-chain partial-log regressions](../../../skills/10x-pipeline/test/run-state.test.mjs#L395)
- [Reference eligibility contract](../../../docs/REFERENCE.md)
- [Original read-only comparison decision](../../../docs/ADR/ADR-005-baseline-usage-comparison.md)
- [Lessons on verdict integrity and documentation searches](../../foundation/lessons.md)

## Progress

### Phase 1: Enforce comparison integrity and verify the delivery

#### Automated

- [ ] 1.1 Focused CLI regressions prove the 1,000-versus-1,100 example, either/both sides, both chains, default/`--unpinned`, all damage categories, JSON/Markdown agreement, retained partial evidence, privacy, byte-identical reads and clean-input compatibility with `node --test --test-concurrency=2 skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/run-state.test.mjs`.
- [ ] 1.2 Reference text documents `log-problems:<side>` and the integrity requirement across both chains and `--unpinned`, verified with `rg -n 'log-problems|logProblems|unpinned' docs/REFERENCE.md` and the scoped output of `git diff --name-only` and `git diff -- docs/REFERENCE.md`, and `git diff --check` passes.
- [ ] 1.3 On Node 24+, `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` finishes with exit zero, zero failures/cancellations and only explained existing skips, with the command and final counts recorded in verification evidence.

#### Manual

- [ ] 1.4 After local verification and pipeline reviews, the authorized orchestrator pushes the run branch, opens or retains a reviewable pull request and records its URL and successful PR CI result.
- [ ] 1.5 The authorized orchestrator posts or updates the requested run-report comment on that pull request and records its URL with the actual local test results and any remaining acceptance items.
