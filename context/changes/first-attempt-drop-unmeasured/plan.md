# Measure the first-attempt tier drop

## Overview

The frame records an owner decision to measure the 10x first-attempt tier drop. The shipped policy sets the drop to `1` without any qualifying pairs, while ADR-010 requires `0` when evidence is insufficient. This plan brings the default into line with that rule before the live experiment. The owner confirmed on 2026-11-23 that the plugin should ship `0` during measurement. [Frame](frame.md#open-for-the-owner) · [ADR-010 decision rule](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#decision-rule)

## Current State Analysis

- `escalation.firstAttempt.drop` is read at dispatch. The drop can be absorbed by the clamp, effort floor, simple-change discount, or score interaction. A failed attempt marked `cheap` is exempt from the rigor and step-budget failure counts, and still affects retries. OpenSpec has no eligible templates. [Router](../../../skills/10x-pipeline/scripts/steps.mjs#L619) · [OpenSpec routing](../../../docs/REFERENCE.md#openspec)
- `compare --unpinned` preserves integrity, terminal-outcome and token checks while waiving the baseline model pin. Goal, base SHA, input filenames and provenance differences can be warnings. The experiment must check input bytes, effective settings, host and mode independently. Two legacy-only runs can satisfy the comparator, so require verified step-tree evidence explicitly. [Comparator](../../../skills/10x-pipeline/scripts/route.mjs#L574)
- The archived Claude acceptance records verified figures on all five steps of a live interactive launcher run on Claude Code 2.1.323. The Codex collector pins CLI 0.169.0 and the deterministic fixtures do not qualify a live host. [Claude acceptance](../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md#resolution-2026-11-23) · [Codex collector](../../../skills/10x-pipeline/scripts/codex-usage.mjs#L8)

## Desired End State

ADR-010 records the measured cohort, exclusions, A/A spread, retry and rigor outcomes and final default. The policy, ADR-007, ADR-010, reference and README report the same first-attempt result, with the scorer's independent experiment identified separately. Before the live decision, the default is `0` and the docs show measurement pending.

## Scope boundaries

The change covers the shipped policy default, existing regression tests that depend on it, the experiment protocol and the result. Routing algorithms, comparison and accounting interfaces, scorer settings, and historical run ledgers are outside scope.

## Implementation Approach

Land the locally testable default and experiment protocol first. An authorized operator then qualifies the chosen host, runs the live experiment and applies the result. Live runs use the Wave 5 ordering from the frame. Wave 4 recorded interactive Claude qualification on Claude Code 2.1.323. Use that evidence to select the launch path and qualify the exact experiment setup in Phase 2.

### Decisions taken without a human

| Decision | Assumption and evidence |
| --- | --- |
| Interim policy | Ship `0` now, as the owner confirmed on 2026-11-23. ADR-010 covers fewer than five comparable pairs. |
| Experiment cohort | Use the 10x chain and one qualified native host/provider-mode combination for the decision cohort. Prefer interactive Claude with explicit `claude` mode on the qualified launcher path. Native Codex with explicit `codex` mode can start earlier once current-host qualification passes. Single-provider cohorts keep tokenizer and accounting scopes consistent. [Capture evidence](../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md) · [Compare semantics](../../../docs/REFERENCE.md#baseline-comparison) |
| Sampling | Preselect an ordered set of distinct representative changes likely to reach eligible implement routes, plus a 0/0 control and an ordered reserve before seeing outcomes. Use the first five eligible A/B pairs and one eligible A/A pair. Keep attempts with an absorbed drop in the eligible sample and record the effective route. This preserves ADR-010's policy-level comparison and avoids selection by realized routing or savings. |
| Decision boundaries | Use the recorded `compare.dropPercent` for both the median and the A/A spread, respecting its documented rounding. Read the failure limit as the sum across qualified pairs with an allowance of one per pair. Apply the rigor and routed-halt guards to otherwise controlled A/B attempts even if they lack a comparable token result. ADR-010 names both guards, and `compare` excludes halted sides from the token result. A routed noncompletion against a done baseline keeps the decision inconclusive while its cause is unresolved. |

## Phase 1: Set the evidence-backed default and document the protocol

### Overview

Make `0` the shipped default and preserve coverage of explicit opt-in. Leave the live measurement ready to run from written instructions.

### Changes Required:

#### 1. Shipped policy and routing regression

**Files** `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/test/firstattempt.test.mjs` and any directly affected fixture.

**Intent** Make the default follow ADR-010 while preserving the existing cheap-attempt contract behind an explicit override.

**Contract** Set only `escalation.firstAttempt.drop` to `0` in shipped policy. In tests that exercise the feature, pass `1` explicitly, including the score interaction fixtures and negative cases for isolation, the simple-change discount, prior failures, clamp and floor. Separately exercise a plain isolated run with the shipped value and assert no first-attempt discount marker or tier reduction from this policy. Keep existing explicit `0` and failure semantics covered. The comparison fixtures that inject `cheap` ledger entries already set up their own input.

#### 2. Operator instructions and pending result

**Files** `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`, `docs/REFERENCE.md`, `README.md`.

**Intent** Show the current default and pending result consistently and make the paired experiment reproducible.

**Contract** In ADR-010 retain the decision rule, update the shipped-value description under “What each rule covers,” specify the Phase 2 controls and recording fields, and label the live result pending. In the routing reference state that default `0` leaves the discount off and `1` explicitly enables it. Check “How routing works,” “Run isolation” and the pinned baseline walkthrough for current-tense behavior claims, and link the first-attempt protocol. The pinned baseline override inherits the shipped drop unless a project supplies its own value. In ADR-007 keep its scorer A/B result separate and link ADR-010. The README describes comparison as a measurement tool and links the pending first-attempt result. For the local audit, run `rg -n -i 'first.?attempt|firstAttempt|tier lower|savings' README.md docs` and reconcile any current behavior or result claims with the policy leaf and ADR-010. Preserve dated historical statements.

### Success Criteria:

#### Automated Verification:

- First-attempt routing tests pass on Node 24+, covering shipped drop 0 and explicit drop 1: `node --test skills/10x-pipeline/test/firstattempt.test.mjs`
- Comparison and usage-accounting checks pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/{compare,codex-usage}.test.mjs`
- Local policy and documentation audit confirms interim drop 0, pending evidence, and separate scorer and first-attempt experiments

## Phase 2: Measure live and record the default decision

### Overview

Finish the live experiment after the local changes land. The authorized operator owns provider access, the paid run budget, and evidence collection. Leave these rows pending for the operator. During an unattended manual-verification dispatch, record the missing live evidence and leave the rows open. Local fixtures cover router and collector behavior.

### Changes Required:

#### 1. Qualify the host and run the cohort

**Files** Read `skills/10x-pipeline/scripts/codex-usage.mjs`, the accounting section of `docs/REFERENCE.md`, and the Claude acceptance record. Keep raw runs in the experiment checkouts and place the redacted results in ADR-010.

**Intent** Isolate the effect of the drop and measure end-to-end dispatch usage, including the cost of failed and redone work.

**Contract** Apply the following controls:

1. Qualify the exact plugin revision, host build, launch path and explicit provider mode before starting the cohort. Run a fresh 10x pipeline to completion on the chosen setup. Require verified `step-tree` figures on every executed step, including a multi-request step and descendants if used. For Claude use the opt-in interactive launcher and require `claude-native` evidence. For Codex confirm CLI `0.169.0` and require `codex-rollout` evidence. Inspect plain `status` and the corresponding router-owned evidence via read-only access. A version match or fixture alone is insufficient. If qualification fails, stop that host and use the qualified native path if available. Keep any alternate cohort separate.
2. Record the ordered candidate and reserve list, the A/A control with its designated baseline arm and start order, initial rigor and flags, an approved run limit, and the independently verifiable interruption causes eligible for replacement before measurement. The A/A baseline supplies the denominator for `dropPercent`. Each A/B pair uses two fresh isolated worktrees of the same change and explicit `10x` chain at the same `baseSha`, with equal goal, input bytes, machine/host/version, launch mode, provider mode, plugin and tool/skill revisions, ladder and effective policy except the drop leaf. Use a fresh native session per arm, identical initial options and like-for-like environment and cache startup conditions. Both use normal routing, with `drop: 0` on the baseline and `drop: 1` on the routed side. Use per-worktree project overrides and preserve existing override keys. The pinned `baseline-policy.json` changes ladder and scorer and belongs to a different comparison.
3. Use a disposable experiment repository with no configured publication remote. Run the native pipeline with archive and PR comments disabled. Prepare both linked worktrees directly from the common base with `git worktree add -b <branch> <path> <baseSha>`. Use `<effective-prefix><id>-baseline` and `<effective-prefix><id>` and launch from each respective arm root. Verify effective isolation is enabled, and check fresh state, branch and HEAD before launch. Seed identical starting inputs in each root, including `context/changes/<id>/change.md`. Confirm Git can track the change folder and the chosen ID has no corresponding 10x archive. Verify the base and inputs are clear of generated artifacts and saved run state. Let each arm produce its own plan and review. Use a common base that does not track `context/foundation/agent-smith-policy.json`. If the source tracks it, preserve its contents and prepare one documented disposable base commit before pinning both arms. Install each merged override as an untracked file excluded through the disposable repository’s local Git exclude, and verify it is ignored and absent from the index before launch. Retain both overrides and their hashes in the private experiment record. This keeps the override available through step commits and rollback without changing the common `baseSha`. For precreated worktrees, run the same trusted dependency and project readiness checks in each root before launch. Run the arms close in time, alternating which arm starts first across A/B pairs. Run the independent A/A control the same way with explicit `0` on both arms. Record the expected missing-remote diagnostic separately from the router outcome. Preserve the local run roots, including terminal state files the publication script leaves uncommitted.
4. From an experiment checkout, run `node <pinned-plugin>/skills/10x-pipeline/scripts/route.mjs compare <id> --chain 10x --baseline <baseline-root> --routed <routed-root> --unpinned` and preserve JSON and terminal outcomes. Require `comparable: true`, both recorded isolated identities on the intended branches and shared pinned base, complete verified `step-tree` figures, the same source and host version, and matching experiment controls. Expect `baseline-unpinned` for both designs and the `escalation` section mismatch only for A/B under the shipped provenance configuration. Check the full effective settings independently, including `score`, which the default unpinned comparison exempts. Review each remaining warning against the experiment controls. Treat mismatched SHA, goals, bytes, settings beyond the intended drop, policy drift, host/mode, unverified scope or unreadable evidence as exclusions even if the comparator emits a number. Check native invocation records against the ledger so every executed invocation is represented. A neutral rerun reuses its numbered entry, so a prior invocation that consumed tokens or whose usage cannot be ruled out makes the pair ineligible if it is missing from the verified totals. An independently verified pre-launch failure with no model request can be retried without invalidating the pair. Use `route usage --usage-file` only for matching eligible late observed evidence under the existing contract.
5. Retain each attempted pair's terminal outcome and rigor when available, including before any recovery that could replace the saved outcome. For an otherwise controlled A/B pair, a routed halt against a done baseline or a higher routed terminal rigor fails the guard even if the pair is excluded from the median. If the routed side has no terminal outcome against a done baseline, settle the original run or require independent evidence of an external interruption before clearing the decision to enable `1`. An unresolved cause leaves the result inconclusive. Resume an interrupted nonterminal arm in its original isolated root after prior invocations have settled, with identical controls and complete accounting for work already executed. Record every exclusion and its evidence, including any verified external interruption independent of the tested policy. Use reserves in order within the approved limit. If a replacement needs the same change ID, use a separate disposable repository to retain the original branches. Keep refs and evidence through closeout.

#### 2. Record the decision and align policy and docs

**Files** `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/test/firstattempt.test.mjs`, `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`, `docs/REFERENCE.md`, `README.md`.

**Intent** Make the decision reproducible and communicate its scope.

**Contract** In ADR-010 record each pair's change and base SHA, arm IDs and evidence pointers, versions and configuration, provider mode, run order and timestamps, eligibility and warnings, outcome and rigor on each arm, verified counts and totals, `tokens.byModel`, `tokens.byTier`, `dropPercent`, and applied-drop and rollback observations. Count failed implement attempts from executed ledger entries with `step === "implement"` and the shared `isFailure` predicate (`ok === false && !fallback && !advisory`), including actual cheap failures and retries. The comparator's aggregate `failedAttempts` includes other roles. Retain redacted evidence pointers and figures only in the ADR.

Restore shipped `1` only with five eligible A/B pairs, an eligible 0/0 A/A pair, median drop strictly above zero and above the absolute A/A drop, total routed failed implement attempts at most baseline failures plus the number of eligible A/B pairs, both terminal guards satisfied, and no unresolved routed noncompletion against a done baseline on an otherwise controlled pair. Otherwise keep `0` and record an adverse or inconclusive result, including an exhausted sample, missing A/A or unresolved routed noncompletion. If restoring `1`, update the shipped-default regression expectation while keeping explicit `0` and `1` tests. Align the four docs with the final outcome and the actual host/mode and scope tested. Rerun Phase 1's focused tests and the closeout suite recorded in [change.md](change.md) before completing the decision row.

### Success Criteria:

#### Manual Verification:

- Qualify the exact live host and provider mode with verified step-tree figures
- Record the five eligible A/B pairs and A/A control in ADR-010, or document exclusions and an exhausted or stopped measurement
- Apply the ADR-010 decision rule, reconcile policy and docs, and record passing local closeout tests

## Testing Strategy

### Unit Tests

Use the existing first-attempt cases for clamp, floor, score interaction, retry and budget; change only assumptions tied to the shipped drop. Use the existing comparator and collector cases for comparison and scope integrity.

### Integration Tests

Use the existing CLI scratch projects and the repo's Node 24+ commands. The final operator runs the recorded change closeout command locally after applying the evidence-backed default.

### Manual Testing Steps

1. Qualify the chosen host and record the ordered cohort, control, and stop conditions.
2. Run and inspect both arms of each pair and the A/A control. Independently recompute the median, A/A bound, implement failures and terminal guards from recorded comparisons and run evidence.
3. Review the reported scope against the actual cohort, run the local closeout checks and record the policy decision.

## Performance Considerations

The minimum live experiment is 12 full runs (five A/B pairs and one A/A pair), plus host qualification and any reserved replacements. Approve an attempt limit before running, and retain retries and rolled-back execution in measured totals. Raw dispatch tokens are the ADR's measure. Orchestrator-session usage and billed cost are outside it.

## Migration Notes

Deploy the interim policy and its docs together. Existing project overrides keep their explicit values. The router loads effective policy at each command, so an in-flight run can route future dispatches using a new default even though its prior entries are preserved. Finish in-flight runs on their starting revision or keep an explicit matching override until settlement. Pin each experiment arm through all dispatches and late evidence intake. There is no ledger migration. A later positive decision can restore the default through the normal reviewed policy change. In case of a regression after enabling it, explicitly set `0` in the project override or land a reviewed default change, retaining evidence and recovery refs.

## References

- [Owner's frame](frame.md) · [Change record and closeout command](change.md)
- [ADR-010 experiment](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#decision-rule) · [ADR-007 scorer experiment](../../../docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md#ab-decision-rule)
- [Comparison and accounting](../../../docs/REFERENCE.md#baseline-comparison) · [Claude qualification](../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md#resolution-2026-11-23)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append the closing commit SHA when a step lands.

### Phase 1: Set the evidence-backed default and document the protocol

#### Automated

- [x] 1.1 First-attempt routing tests pass on Node 24+, covering shipped drop 0 and explicit drop 1: `node --test skills/10x-pipeline/test/firstattempt.test.mjs`
- [x] 1.2 Comparison and usage-accounting checks pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/{compare,codex-usage}.test.mjs`
- [x] 1.3 Local policy and documentation audit confirms interim drop 0, pending evidence, and separate scorer and first-attempt experiments

### Phase 2: Measure live and record the default decision

#### Manual

- [ ] 2.1 Qualify the exact live host and provider mode with verified step-tree figures
- [ ] 2.2 Record the five eligible A/B pairs and A/A control in ADR-010, or document exclusions and an exhausted or stopped measurement
- [ ] 2.3 Apply the ADR-010 decision rule, reconcile policy and docs, and record passing local closeout tests
