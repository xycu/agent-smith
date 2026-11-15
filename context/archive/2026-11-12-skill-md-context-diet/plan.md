# Orchestrator Context Diet Implementation Plan

## Overview

Reduce the context loaded by both pipeline skills while preserving their operational contracts. Move routing explanations into the existing reference, consolidate repeated terminal procedures within each skill, and retain executable coverage of every relocated obligation.

## Current State Analysis

The checked-out 10x skill is 47,969 bytes and the OpenSpec skill is 36,450 bytes. The ticket's 41,727-byte 10x baseline predates the provider runner, setup cleanup and invocation-identity contracts. The current 10x Tuning section occupies 13,866 bytes. Moving most of that section and deduplicating late usage alone would leave the file above the requested target. Further compression must reach repeated terminal reporting and explanatory prose in Start and Loop. [Sources](../../../skills/10x-pipeline/SKILL.md), [OpenSpec source](../../../skills/openspec-pipeline/SKILL.md), [ticket](change.md)

The operational path is Start argument parsing → shared setup → init → conditional source cleanup → provider dispatch → result/usage normalization → next → terminal handling. The router and policy own decisions and state. The skills own dispatch, process lifetime, result forwarding, reporting and authorized terminal script calls. Existing PR scripts already own publication and are reusable without runtime changes. [Sources](../../../skills/10x-pipeline/SKILL.md), [dispatch reference](../../../docs/REFERENCE.md#codex-and-provider-dispatch)

Both Anti-stall sections currently occupy 3,333 bytes and have SHA-256 `9d262e57b558c87ce54b3a258c9454b3eec2eb35b44cc3539a0d1047077b1d44`. The digest covers the heading through the bytes immediately before the next `## ` heading, including its trailing blank line. Equality tests already compare the chains, while a fixed baseline also detects identical edits to both copies. [10x rules](../../../skills/10x-pipeline/SKILL.md#anti-stall-rules), [OpenSpec rules](../../../skills/openspec-pipeline/SKILL.md#anti-stall-rules)

Wave 7 grants this change both complete skills. Its other changes own `tools/commit-lint.mjs` and `tools/workflow-pins.mjs`. Shared documentation and the skill-content tests permit independent edits, and this ticket also explicitly names AGENTS.md, the reference and supporting tests. [Ownership](../WAVES.md#wave-7-skill-rewrite-3--next)

The router-owned `agent-smith/run.jsonl` was already modified when this planning step began. Record that starting status when checking the implementation's scope. The outer router manages lifecycle changes to that file.

The ticket's test list needs current-path reconciliation. `late-usage.test.mjs` tests runtime persistence and commits. Branch-call and launch-identity text assertions live in `skill-loop.test.mjs` and `skills/openspec-pipeline/test/openspec-skill.test.mjs`. Additional consumers pin PR-comment intent, host dispatch, numbered setup, change status and Agent parameters. [Usage tests](../../../skills/10x-pipeline/test/late-usage.test.mjs), [loop tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs)

## Desired End State

- The complete UTF-8 10x skill is at most 26,000 bytes. The OpenSpec skill is smaller than its 36,450-byte baseline and receives the same applicable consolidation.
- Each skill contains one `## Late usage (before every end)` procedure, explicitly invoked from done, halt and archive step 1. The archive cutoff remains visible before step 3 launches its child.
- Repeated terminal publication instructions have one owner per skill. Every terminal path reaches that owner at its current point in the lifecycle, including archive refusal and failed verification.
- Both full Anti-stall sections retain the baseline bytes, including their introduction, six rule lines and existing step-number references.
- Tuning points to policy, project overrides, immutable rules and docs/REFERENCE.md. Literal ladder models, effort values and tier descriptions appear in the reference and policy. Dispatch continues forwarding generic router-supplied model and effort fields.
- AGENTS.md requires both skills to name no literal models, effort levels or tiers and directs tier-logic documentation updates solely to docs/REFERENCE.md.
- Existing text and runtime guarantees remain covered, with the full repository test command passing and every skip accounted for.

### Key Discoveries

- The long routing material is isolated at `skills/10x-pipeline/SKILL.md:128`. Its destination already has routing bullets and dedicated rigor, review, pre-plan, budget, executor and scoring groups. [Reference](../../../docs/REFERENCE.md)
- Anti-stall rules require run steps 3–5 and archive steps 3–5 to retain their meaning. Launch notices, final reports and late telemetry have different continuation rules. [Loop tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs)
- A missing or malformed result, foreign notification, uncertain runner and orchestrator-owned launch fault have distinct outcomes. Collapsing them would change retries or allow concurrent execution. [Host tests](../../../skills/10x-pipeline/test/host-integration.test.mjs)
- The metadata PR-comment change has already removed task-tool authorization. The remaining duplication concerns strict terminal-action intent and call placement. [PR-comment tests](../../../skills/10x-pipeline/test/pr-comment.test.mjs)

## Scope Boundaries

Implementation edits belong to the two SKILL.md files, AGENTS.md's ownership bullets, relevant groups in docs/REFERENCE.md, affected existing content tests and their two test README indexes. Planning artifacts belong to this change folder. Preserve runtime scripts, policies, prompts, manifests, release fields, Wave 7 sibling changes, WAVES.md, context/archive and router-owned run state. The separately scheduled quoting and Git-guard follow-ups retain their own scope. [Ticket](change.md), [ownership](../WAVES.md)

## Implementation Approach

Use two independently verifiable phases. First establish routing-document ownership and its regression guard. Then consolidate operational prose and move text assertions to its new local owner and explicit call sites. Keep operational procedures in each skill so their execution remains self-contained. Reference links carry routing background without requiring an orchestrator to preload another document.

### Assumptions and Decisions

- Medium complexity and two phases are selected for this unattended run. The change spans coupled prose contracts and many text consumers, with established code and documentation owners. The ticket, Wave 7 and existing tests settle the design choices. [Evidence](change.md), [ownership](../WAVES.md), [complexity evidence](complexity.json)
- Interpret about 26 KB as a 26,000-byte acceptance ceiling measured on the whole UTF-8 file. This is a conservative, reproducible implementation of the ticket's byte-based target. OpenSpec receives a reduction requirement because the ticket gives its hard size target only to 10x. [Evidence](change.md)
- Consolidate PR-comment authorization in the existing opt-in section and invoke it through the existing always-run pull-request procedure. Keep each branch's pull-request call at its current position. This uses the established procedure seam and preserves strict `prComment: true`, archive timing and script-error handling. [Evidence](../../../skills/10x-pipeline/SKILL.md#pull-request-always), [PR-comment tests](../../../skills/10x-pipeline/test/pr-comment.test.mjs)
- Pin the entire Anti-stall baseline in an existing content test using Node built-ins, alongside equality and rule-form checks. The ticket requires unchanged wording, which equality between two editable files alone cannot prove. [Evidence](change.md), [existing equality check](../../../skills/openspec-pipeline/test/openspec-skill.test.mjs)
- Keep live paid-provider runs outside this text-contract change's acceptance gate. Existing host compatibility limits remain documented, and this change's proof uses local contract tests, runtime regressions and semantic review. [Evidence](../../../docs/REFERENCE.md#codex-and-provider-dispatch), [Wave 6 acceptance notes](../WAVES.md)

## Critical Implementation Details

### Timing and Lifecycle

Late usage runs before status and terminal publication for done/halt, and before status and the archive child for archive. A figure arriving after that child starts is dropped. The archive action has no result file or next call. Successful archive verification selects the moved report path for both PR scripts. False verification and manual-gate refusal select the default report path.

### Text-test Boundaries

Existing tests identify Loop branches by their top-level action bullets and sections by `## ` headings. Keep shared procedures outside those branch slices and keep references explicit. Split long paragraphs with indentation that preserves the enclosing numbered step. Update sentence and line-shape matchers only where layout changes, retaining the complete behavioral assertions and ordering checks.

## Phase 1: Establish Routing Documentation Ownership

### Overview

Remove the routing tutorial from the 10x skill after mapping every detail to its existing reference owner. Establish the ownership rules and fixed invariants needed for the later compression.

### Changes Required

#### Routing reference and Tuning

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `docs/REFERENCE.md`

**Intent**

Merge the information under How the tier moves into the corresponding reference groups. Fill genuine gaps and reconcile duplication against current router behavior. Keep a concise Tuning pointer comparable to the OpenSpec pattern.

**Contract**

Retain documentation of rigor increases, measured risk, skip gates, budgets, floors, pinned steps, pre-plan gates and loops, artifact verification, score shifts, executors, commit checks and fallbacks, re-plans, manual verification, Chrome selection, lessons, discounts, review findings and confirmations. Policy and router code remain the behavior owner. Preserve both chains' policy paths, override merge semantics and immutable-rule paths. The orchestrator keeps generic dispatch fields and rigor flag values.

#### Ownership guidance

**File** `AGENTS.md`

**Intent**

Make the documentation destination unambiguous for future routing changes.

**Contract**

The first hard rule says both skills name no literal model, effort level or tier. The Coding Style tier-logic bullet requires reference updates and retains the OpenSpec verification documentation guidance. Preserve the other repository rules and pointers.

#### Existing content tests and indexes

**Files** `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/README.md`, `skills/openspec-pipeline/test/README.md`

**Intent**

Apply the existing OpenSpec ladder-model and effort-value exclusion pattern to 10x, and pin Anti-stall immutability before changing adjacent text.

**Contract**

Check current policy models and effort values, the documented optional fable alias, and tier terminology in both skills. Assert the fixed Anti-stall digest above, cross-chain equality, exactly six rules and the existing rule form. Add an assertion for the AGENTS.md routing-document owner. Keep existing content coverage and describe the additions in the existing index rows.

### Success Criteria

#### Automated Verification

- Both skills pass literal-routing-value, Tuning-path and AGENTS.md ownership checks in the existing content tests.
- Both complete Anti-stall sections match the baseline digest and retain the six existing rules and their ordering.
- Focused phase-1 tests pass using the focused command in Testing Strategy.

#### Manual Verification

- A written source-to-reference inventory accounts for every removed routing bullet and confirms its documented thresholds, exceptions and sequencing.

## Phase 2: Consolidate Terminal Procedures and Preserve Contract Coverage

### Overview

Deduplicate late telemetry and terminal publication, then compress the remaining operational prose sufficiently to meet the measured size target. Adapt content tests to check each procedure and every path that invokes it.

### Changes Required

#### Shared late-usage procedure

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**

Give each skill one `## Late usage (before every end)` section and replace its three copies with explicit calls at the existing lifecycle points.

**Contract**

Preserve one standalone usage command per eligible numbered launch, the chain selector, omitted missing flags, identity matching through rule 6, refusal exit/result handling, printed attachment result and archive-agent usage in the final message only. Preserve earlier-step attribution, conflicts, ambiguous descriptions and superseded invocation handling. Done/halt attach before status and publication. Archive step 1 attaches before status, and its local cutoff sentence still drops figures after step 3 starts. Preserve run step 4's immediate next behavior when current usage is absent.

#### Terminal publication and reporting

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**

Make the existing Pull request section own the once-per-terminal publication sequence and its conditional PR-comment invocation. Consolidate common final-report instructions within each skill where repetition remains, and split mixed paragraphs into short actionable units.

**Contract**

Each terminal branch explicitly reaches the pull-request procedure before STOP. Preserve action intent across intervening status and verify calls. Publication runs after archive verification, also on false, and via archive step 5's first bullet on a gate refusal using the default report. On success both scripts receive the moved report path. Strict opt-in, missing-intent false, PR URL forwarding, OpenSpec's explicit report path, JSON/error diagnostics, skip/no-retry behavior and final-message-only outputs remain enforced.

Retain done's verdict, step count, status and report output. The 10x chain also reports every pending or unproved row and reason, lesson pointers, changeStatus diagnostics and run-root archive guidance. OpenSpec retains task counts and verify.md. Archive keeps the fail-closed question, exact option labels, row-count rules, steps 1–5, subagent assumptions/usage and ignored-path output. Halt retains its reason and archive-commit-specific guidance. Preserve final worktree, retained-source and uncommitted-state diagnostics. References to shared reporting must name which terminal action or summary supplies each field.

#### Setup, dispatch and remaining prose

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**

Reach the byte target by trimming repeated explanations and referring to already-local instructions while retaining every executable obligation. Keep the same structural steps so Anti-stall references stay valid.

**Contract**

Preserve frontmatter and explicit invocation, absolute script resolution for both hosts, Bash timeout, flag parsing and resume behavior, setup-field validation, selected-root change checks and original-root fallback, saved setup JSON and successful-init cleanup ordering, retained-path diagnostics and safety rules. Preserve toolkit/CLI discovery prerequisites, verbatim inline/file handoff, exact Agent parameters, per-invocation records, neutral retry distinctions, runner lifetime and envelope semantics, last-RESULT parsing, usage forwarding and router-owned files. Keep every OpenSpec chain selector and chain-specific archive instruction.

#### Relocated text-contract tests

**Files** `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`, `skills/10x-pipeline/test/pr-comment.test.mjs`, and the two test README indexes

**Intent**

Move content expectations to each new procedure owner and check explicit branch reachability and ordering separately. Add size and single-occurrence regression checks using existing section/branch helpers.

**Contract**

Replace assertions requiring three literal usage commands or three authorization paragraphs with one complete procedure assertion plus all three branch call-site assertions. Verify late usage precedes status, publication and archive launch. Verify the publication procedure invokes comments after PR creation under strict saved terminal intent. Check archive success, false verification and gate refusal. Update layout-dependent dispatch/setup matchers when paragraphs are split while preserving each predicate. Keep existing runtime tests in `late-usage.test.mjs` intact.

The broader consumer set includes `agents.test.mjs`, `change-status.test.mjs`, `host-integration.test.mjs`, `nested-subagents.test.mjs`, `rules.test.mjs`, `no-recursive-delete.test.mjs` and `tools/test/agents-md-size.test.mjs`. Keep their assertions green, adapting only content location/line boundaries that this rewrite actually changes. Reuse the current override paths `SKILL_PATH` and `OPENSPEC_SKILL_PATH` for deliberately broken fixtures. Add no test dependency or new test module.

### Success Criteria

#### Automated Verification

- Size and duplication guards pass with 10x at most 26,000 bytes, OpenSpec below 36,450 bytes, one late-usage command per skill and one PR-comment authorization owner per skill.
- All focused contract tests pass with complete Anti-stall baseline identity, dispatch/setup obligations and branch-to-procedure ordering covered.
- Deliberately broken scratch skill copies fail the intended guards for a missing late-usage call site, reordered archive cutoff/publication, lost opt-in protection, altered Anti-stall text, forbidden routing value and oversized 10x skill.
- The full required repository suite passes on Node 24+, with prerequisite-dependent skips identified and the version check passing.
- Implementation edits stay within owned files and preserve WAVES.md, context/archive, router-owned run state and Wave 7 sibling implementations relative to the step's recorded starting state.

#### Manual Verification

- A written comparison of original and compressed skills accounts for each operational obligation across done, halt, archive success, archive verification failure and manual-gate refusal for both hosts and chains.

## Testing Strategy

### Focused Verification

Run from the run worktree, prefixing each command with its absolute `cd` as required by this run's prompt. Use the existing Node runner and helpers. Set TMPDIR to a scratch directory inside this worktree for this run's path restriction, then remove listed scratch files with the repository's removeTree helper and empty directories safely.

In-worktree scratch needs a Git discovery boundary. A plain nested TMPDIR lets fixtures without their own repository discover the parent run branch, changing routing and invalidating baseline tests. A temporary `.git` file at the scratch root whose `gitdir:` names a nonexistent path stops that discovery, while `git init` in a fixture still creates and discovers its own repository. Verify those two outcomes before using this bounded TMPDIR. This was reproduced during planning, including a previously failing nested-subagent fixture passing with the boundary. Keep this temporary test setup outside the committed implementation.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/change-status.test.mjs skills/10x-pipeline/test/host-integration.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs tools/test/agents-md-size.test.mjs
```

The guard matrix checks the complete owner text and each local reference independently. Deliberate-break checks use scratch copies and the existing skill override variables so production skill bytes retain their intended content. Record the failed assertion that detects each mutation, then rerun the unmodified fixtures successfully. Verify the fixed Anti-stall digest detects a matching edit to both copies as well as one-sided changes.

### Full Regression Verification

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node tools/version-check.mjs
git diff --check
```

The required suite exercises the real router in scratch projects, including late-usage persistence, refusal, rollback, reports and archive-state commits. Record Node version, pass/fail totals and skip identities. CI additionally uses `--experimental-test-coverage`, a non-root Linux runner and the pinned OpenSpec CLI. Resolve environmental prerequisites or report their precise limits before claiming full CI equivalence. [CI](../../../.github/workflows/ci.yml)

### Semantic Review

Compare original text from the run's starting commit with the final skills. Review the preserved contract groups above and trace each terminal exit to reporting and publication. Save brief evidence under this change's evidence directory when completing Manual rows. Existing pending live-host acceptance from earlier waves remains described in its original evidence.

## Performance Considerations

The target removes at least 21,969 bytes from the 10x skill, approximately 45.8% of its current source text. Byte reduction is the reproducible context proxy for this change. Token cost and model behavior require host telemetry for measurement. Both compressed skills remain independently loadable with their operational procedures present locally.

## Migration Notes

Existing commands, result schemas, action fields and stored runs keep their contracts. Deploy through the normal plugin change process. A content regression can be repaired by a forward commit restoring the affected skill, documentation and test expectations together. Preserve historical run artifacts and prior-wave acceptance evidence.

## Planning Verification

Planning used Node v24.19.0. The router's readPlan parser recognizes two phases, eight pending Automated rows and two pending Manual rows, with a one-to-one Success Criteria mapping. Relative document links resolve, `git diff --check` passes and the version guard reports 1.11.0.

The focused baseline command covering skill-loop.test.mjs, openspec-skill.test.mjs and archive-gate.test.mjs passed all 71 tests with zero failures or skips. An initial full-suite attempt used unbounded in-worktree scratch and produced invalid parent-repository-dependent failures. After confirming the Git discovery fix, a corrected full-suite attempt reached 407 passing tests with zero failures before it was stopped at planning completion. Full-suite acceptance remains pending for Phase 2. Planning leaves all implementation Progress rows unchecked.

## References

- [Change definition](change.md)
- [Wave 7 ownership](../WAVES.md)
- [Repository guidelines](../../../AGENTS.md)
- [10x skill](../../../skills/10x-pipeline/SKILL.md)
- [OpenSpec skill](../../../skills/openspec-pipeline/SKILL.md)
- [Routing and lifecycle reference](../../../docs/REFERENCE.md)
- [Loop contract tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs)
- [OpenSpec contract tests](../../../skills/openspec-pipeline/test/openspec-skill.test.mjs)
- [Archive gate tests](../../../skills/10x-pipeline/test/archive-gate.test.mjs)
- [PR-comment contract tests](../../../skills/10x-pipeline/test/pr-comment.test.mjs)
- [Repository lessons](../../foundation/lessons.md)

## Progress

### Phase 1: Establish Routing Documentation Ownership

#### Automated

- [x] 1.1 Both skills pass literal-routing-value, Tuning-path and AGENTS.md ownership checks in the existing content tests. — c9eb670
- [x] 1.2 Both complete Anti-stall sections match the baseline digest and retain the six existing rules and their ordering. — c9eb670
- [x] 1.3 Focused phase-1 tests pass using the focused command in Testing Strategy. — c9eb670

#### Manual

- [x] 1.4 A written source-to-reference inventory accounts for every removed routing bullet and confirms its documented thresholds, exceptions and sequencing. — evidence: evidence/judgment-routing-inventory.md

### Phase 2: Consolidate Terminal Procedures and Preserve Contract Coverage

#### Automated

- [x] 2.1 Size and duplication guards pass with 10x at most 26,000 bytes, OpenSpec below 36,450 bytes, one late-usage command per skill and one PR-comment authorization owner per skill. — 8bbe804
- [x] 2.2 All focused contract tests pass with complete Anti-stall baseline identity, dispatch/setup obligations and branch-to-procedure ordering covered. — 8bbe804
- [x] 2.3 Deliberately broken scratch skill copies fail the intended guards for a missing late-usage call site, reordered archive cutoff/publication, lost opt-in protection, altered Anti-stall text, forbidden routing value and oversized 10x skill. — 8bbe804
- [x] 2.4 The full required repository suite passes on Node 24+, with prerequisite-dependent skips identified and the version check passing. — 8bbe804
- [x] 2.5 Implementation edits stay within owned files and preserve WAVES.md, context/archive, router-owned run state and Wave 7 sibling implementations relative to the step's recorded starting state. — 8bbe804

#### Manual

- [x] 2.6 A written comparison of original and compressed skills accounts for each operational obligation across done, halt, archive success, archive verification failure and manual-gate refusal for both hosts and chains. — evidence: evidence/judgment-terminal-comparison.md
