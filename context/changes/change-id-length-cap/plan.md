# Change ID Length Cap Implementation Plan

## Overview

Apply the PR scripts' 100-character change-id limit at the shared router's `init` boundary. Both chains must reject longer ids before project filesystem access, while existing longer-id runs retain access through the other router commands.

## Current State Analysis

`route.mjs` checks the unbounded lowercase-letter, digit and hyphen grammar in `main()`, then parses flags, loads policy and resolves the chain. `loadPolicy()` probes and reads `context/foundation/agent-smith-policy.json`. A guard placed inside the later `init` branch would run after those project reads.

`pr-common.mjs` already exports the bounded `ID_RE` used by `open-pr.mjs`, `pr-comment.mjs` and `prepare-run.mjs`. Router modules and PR helpers have independent dependency boundaries. The requested seam is a bounded router pattern in `state.mjs`, with a test enforcing parity across the two owners.

Planning reproduced the mismatch on Node 24.19.0 using disposable projects inside this worktree. Both 100- and 101-character ids returned `action: "run"`, with `plan` for 10x and `os-propose` for OpenSpec. The PR pattern accepted 100 and rejected 101. With a malformed project policy, the 101-character invocation reached the policy parse error in both chains.

### Key Discoveries

- Argument validation and policy loading meet at `skills/10x-pipeline/scripts/route.mjs:893`. The generic syntax guard is at line 895 and policy loading at line 913.
- Project policy reads occur in `skills/10x-pipeline/scripts/state.mjs:64`. `halt()` prints JSON and exits 1 at line 944.
- The PR pattern is `^[a-z0-9][a-z0-9-]{0,99}$` in `skills/10x-pipeline/scripts/pr-common.mjs:10`. Both PR entry points validate against it before executing their workflows.
- `skills/10x-pipeline/test/coauthor.test.mjs:221` compares independently owned router and PR rules. `helpers.mjs` and `openspec-helpers.mjs` provide both-chain CLI fixtures and router-state fixture writers.
- `skills/10x-pipeline/test/pr-comment.test.mjs:753` requires the obsolete `100 characters` caveat inside the 10x skill. Its reference-content check at line 773 still expects the limit to appear in the PR-comment documentation.
- `context/changes/WAVES.md` assigns this change the init id check and the two PR-comment caveats. Its shared-text exception permits distinct edits to `README.md` and `docs/REFERENCE.md` alongside `docs-drift-fixes`.

## Desired End State

- For both chains, an otherwise valid 100-character id reaches `action: "run"` with the expected first step.
- An otherwise valid id of 101 characters or longer makes every `init` invocation exit 1 with `action: "halt"` and a reason naming the maximum of 100 characters. Rejection precedes project reads, chain discovery, run locking and writes.
- The accepted init-id set equals the shared PR scripts' accepted id set. Existing syntax validation and invalid-chain validation retain their established behavior.
- Existing longer-id runs remain reachable through `next`, `status`, `status --report`, `risk`, `usage`, `verify-archive` and `compare`, subject to each command's existing state requirements.
- Both skills retain their script-error fallback after removal of the obsolete mismatch example. Quick-start and reference documentation describe the same boundary and legacy-command behavior.

## Scope Boundaries

Implementation ownership is confined to these surfaces, plus this change's planning artifacts and lifecycle metadata.

| Files | Owned region |
| --- | --- |
| `skills/10x-pipeline/scripts/state.mjs` | Export of the bounded router init-id pattern |
| `skills/10x-pipeline/scripts/route.mjs` | Import and pre-policy init id check in `main()` |
| `skills/10x-pipeline/test/change-id.test.mjs` | New focused both-chain validation and compatibility tests |
| `skills/10x-pipeline/test/README.md` | Index row for the new test file |
| `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md` | The 100-character parenthesis in each PR-comment script-error fallback |
| `skills/10x-pipeline/test/pr-comment.test.mjs` | Assertions affected by those caveat edits and the corrected documentation contract |
| `README.md` | One shared quick-start change-id requirement |
| `docs/REFERENCE.md` | Init/change-name requirement and replacement of the stale PR-comment limit explanation |

Wave 6's other owners retain their prompt dispatch, flow, policy, workflow, rollback, hook, ADR and document-drift regions. Repository writes use this run worktree and its current branch. `context/changes/WAVES.md` and `context/archive/` remain outside the write set.

## Implementation Approach

Keep the existing generic syntax check for all router commands. Export the bounded `ID_RE` from `state.mjs` and apply it only to `init`, in `main()` after the existing invalid-chain argument check and before `loadPolicy()`. The pattern has the same source and flags as the PR helper's `ID_RE`. This preserves each module boundary and gives tests a direct contract to compare.

Use the current `halt()` response shape and exit code. The length diagnostic should identify the change id, state the maximum of 100 characters and say that nothing was written. A fixed acceptance rule belongs in validation code.

### Assumptions and Resolved Decisions

- Complexity is LOW, with two phases and zero unresolved product questions. The ticket specifies the threshold, ordering, compatibility and documentation targets. Under the unattended-run instructions, these sources settle the interview and structure decisions.
- The cap applies to every `init`, including one targeting an existing longer-id run. Compatibility is provided by the other commands, matching the ticket's explicit distinction between `init` and inspection of in-flight runs.
- The existing unrestricted syntax guard continues to govern legacy commands. Only the new init guard uses the bounded router pattern, matching the acceptance difference required by `change.md`.
- The state export, focused test file and test-index row support the init behavior owned by this change. The neighboring Wave 6 tickets assign those regions to this change's dependency surface or leave them uncontested. README and reference edits use the explicit shared-text exception.
- All acceptance criteria are verifiable through CLI tests or document assertions. The plan uses automated Progress rows throughout.

## Critical Implementation Details

### Validation Ordering

`loadPolicy()` is already a project-read boundary. Place the init cap above that call, with the existing syntax and chain-flag checks preceding it. `resolveChain()` also probes live and archived folders, so an over-limit init must terminate before reaching it.

### Legacy Run Access

The `init` cap cannot become a guard in `paths()`, `storedChain()`, `resolveChain()` or the common all-command syntax check. Those functions serve existing longer-id runs. Fixture writers in `helpers.mjs` can represent these pre-change runs directly, including stored OpenSpec chain metadata.

## Phase 1: Enforce the Init Boundary and Prove Compatibility

### Overview

Introduce the shared router rule and test its agreement with PR acceptance, early refusal and legacy-command behavior.

### Changes Required

#### 1. Router Validation

**Files**: `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent** Reject ids that the end-of-run scripts would refuse while the CLI still has only argument data. Preserve access to pre-change longer-id runs through the other commands.

**Contract** `state.mjs` exports the bounded `ID_RE`. `main()` uses it for `init` before policy loading and project access, with the existing halt JSON and exit 1. The all-command grammar remains length-unbounded. Router imports follow the repository's existing dependency order.

#### 2. Focused Validation Tests

**File**: `skills/10x-pipeline/test/change-id.test.mjs`

**Intent** Exercise the public CLI for both chains and detect future divergence between router and PR validation.

**Contract** Reuse `makeProject`, `makeOpenspecProject`, `run`, state fixture writers and `cleanupAll`. Keep any inspection instrumentation local to the test file and disposable fixtures. Register cleanup through the existing helper.

- Compare router `ID_RE` and PR-helper `ID_RE` source and flags, then compare results for empty ids, one-character letters and digits, internal/trailing hyphens, lengths 99/100/101/150, uppercase, leading hyphens, underscores, whitespace, separators and non-ASCII characters.
- For each chain, verify lengths 1, 99 and 100 return exit 0 and `action: "run"`, with `plan` or `os-propose` as appropriate. Include a 100-character id containing digits and hyphens.
- For each chain, reject lengths 101 and 150 with exit 1, halt JSON and a reason naming 100 characters. Compare the entire fixture tree, including directory entries and exact file bytes, before and after refusal.
- Repeat an over-limit init with malformed policy and existing legacy state. The length reason must win over policy, chain-discovery and run-state handling. Exercise explicit chain flags in both supported forms and the default 10x invocation.
- Prove absence of project reads with a fixture-local launcher or preload that traps synchronous filesystem reads and existence/directory/stat probes under the fixture root before importing the real router. A project-access attempt must fail the test independently of its final JSON. Keep module-loading access to the installed router source available. Byte snapshots provide the write-side proof.
- Build valid 101-character legacy fixtures using the existing fixture writers. Verify `status` returns their id and steps with explicit and inferred chains, and that `status --report` creates its normal report. Exercise `next` and `usage` against suitable pending/completed-step fixtures and require their normal command outcomes.
- Cover `risk`, `verify-archive` and `compare` with legacy ids as well. Assert their existing response schema and command-specific outcome, including a valid archived fixture for archive verification and a suitable baseline for comparison. Check read-only calls leave their fixture trees byte-identical.
- Retain rejection of malformed ids and invalid chain flags through the existing validation tests.

#### 3. Test Index

**File**: `skills/10x-pipeline/test/README.md`

**Intent** Make the new test file discoverable in the established index.

**Contract** Add one row describing the init boundaries, pre-read refusal, pattern parity and both-chain legacy compatibility.

### Success Criteria

#### Automated Verification

- Router and PR id patterns agree across grammar and boundary cases.
- Both chains start runs for valid ids through 100 characters with the expected first step.
- Over-limit init exits 1 with the 100-character reason, performs zero project reads and leaves the full fixture tree byte-identical.
- Legacy longer-id fixtures retain normal outcomes for next, status, status --report, risk, usage, verify-archive and compare on both chains.
- Focused validation and existing entry-point tests pass on Node 24+ using `node --test --test-concurrency=2 skills/10x-pipeline/test/change-id.test.mjs skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/openspec-pipeline/test/openspec-chain.test.mjs`.

## Phase 2: Align User Guidance and Run Regression Verification

### Overview

Document the init limit, remove both obsolete skill examples and update the assertion that currently requires one of them.

### Changes Required

#### 1. Skill Caveats

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent** Correct the PR-comment script-error explanation after early validation closes the mismatch.

**Contract** Remove only the parenthetical 100-character mismatch example from each PR-comment fallback. Preserve the fallback action and all surrounding authorization and terminal-branch instructions.

#### 2. Public Limit Documentation

**Files**: `README.md`, `docs/REFERENCE.md`

**Intent** Let users choose an acceptable name before starting either chain, and explain how existing longer-id runs remain accessible.

**Contract** Add a shared quick-start requirement covering 1–100 characters and the existing lowercase-letter/digit/hyphen grammar with an alphanumeric first character. Reference documentation specifies pre-project-access halt at `init`, applies it to both chains and describes continued access through other commands. Replace the PR-comment bullet that currently says the router has no limit, retaining the scripts' 100-character contract and the consequence for legacy longer ids. Keep the edit confined to these id-related passages under Wave 6's shared-text exception.

#### 3. Content Assertions and Regression Checks

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent** Make content tests enforce the corrected guidance and retain script-error handling coverage.

**Contract** Replace the obsolete requirement for `100 characters` inside the 10x skill section with checks for both skills that the mismatch example is removed and the script-error fallback remains. Keep the reference's PR-script limit assertion meaningful. Verify the documented init limit covers both chains. Search current source documentation for the old mismatch wording and resolve applicable hits within this change's owned passages.

### Success Criteria

#### Automated Verification

- Both skill caveats, public init-limit guidance and their updated content assertions agree with the router contract.
- The complete required suite passes on Node 24+ using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- `git diff --check` passes and the changed-file list matches this plan's ownership, including zero edits under context/archive or to WAVES.md.

## Testing Strategy

The focused file tests the exact accepted-id contract and drives the real router for both chains. Root-wide byte snapshots cover refused writes, while read traps cover filesystem access before refusal. A malformed-policy fixture supplies a second observable ordering check. Legacy fixtures come from existing helper-owned state writers, allowing compatibility checks without first initializing a now-forbidden id.

The existing PR entry-point tests establish script acceptance independently. Their shared `ID_RE` is the parity target, so tests require neither network access nor a live GitHub write. Content tests cover both skill edits and the retained reference limit. Run the full repository command after script changes and again after the completed documentation/assertion changes as required by `AGENTS.md`.

## Performance Considerations

The new argument-only check executes before policy and filesystem work. Its runtime is bounded by the supplied id, and its fixed 100-character ceiling adds no project configuration.

## Migration Notes

Existing state stays addressable through the legacy commands. Every subsequent `init` applies the cap. The PR scripts' existing bound still applies when ending a legacy longer-id run, so this change preserves inspection and command access without resolving that historical end-of-run limitation. Reverting the validation code restores the former init acceptance behavior.

## References

- `context/changes/change-id-length-cap/change.md`
- `context/changes/change-id-length-cap/complexity.json`
- `context/changes/WAVES.md`, Wave 6 and shared-text rules
- `context/foundation/lessons.md`, chain ownership and documentation search rules
- `skills/10x-pipeline/scripts/route.mjs:893`
- `skills/10x-pipeline/scripts/state.mjs:64`
- `skills/10x-pipeline/scripts/pr-common.mjs:10`
- `skills/10x-pipeline/test/coauthor.test.mjs:221`
- `skills/10x-pipeline/test/pr-comment.test.mjs:748`
- `docs/REFERENCE.md:495`

## Progress

### Phase 1: Enforce the Init Boundary and Prove Compatibility

#### Automated

- [ ] 1.1 Router and PR id patterns agree across grammar and boundary cases.
- [ ] 1.2 Both chains start runs for valid ids through 100 characters with the expected first step.
- [ ] 1.3 Over-limit init exits 1 with the 100-character reason, performs zero project reads and leaves the full fixture tree byte-identical.
- [ ] 1.4 Legacy longer-id fixtures retain normal outcomes for next, status, status --report, risk, usage, verify-archive and compare on both chains.
- [ ] 1.5 Focused validation and existing entry-point tests pass on Node 24+ using `node --test --test-concurrency=2 skills/10x-pipeline/test/change-id.test.mjs skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/openspec-pipeline/test/openspec-chain.test.mjs`.

### Phase 2: Align User Guidance and Run Regression Verification

#### Automated

- [ ] 2.1 Both skill caveats, public init-limit guidance and their updated content assertions agree with the router contract.
- [ ] 2.2 The complete required suite passes on Node 24+ using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- [ ] 2.3 `git diff --check` passes and the changed-file list matches this plan's ownership, including zero edits under context/archive or to WAVES.md.
