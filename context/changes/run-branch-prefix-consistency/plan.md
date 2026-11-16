# Configured Run-Branch Prefix Implementation Plan

## Overview

Honor `isolation.branchPrefix` through setup, initialization, cleanup, reuse, attachment, resume and publication for both chains. A committed `codex/` override must produce a usable `codex/demo` run and pass the existing publisher through deterministic local clients.

Planning baseline is `9f13a08717c010f67ba6a071cc39365025ee3b63`, on `agent-smith/run-branch-prefix-consistency`. Node is `v24.19.0`. Wave 0 implementation is present through `d7e08ba6` (`nested-step-delegation`, PR #199). This plan is the planning-step deliverable. Plan review precedes implementation, implementation review follows it, and terminal publication belongs to the enclosing orchestrator.

## Current State Analysis

| Owner | Current behavior | Required reach |
| --- | --- | --- |
| `prepare-run.mjs` | Projects the merged isolation requirement, then hardcodes `agent-smith/` for run recognition, creation and cleanup | Effective prefix, branch-scoped lock, registration, fresh copy, resume and cleanup identity |
| `state.mjs` | Merges the 10x policy, OpenSpec fragment and project override | Reference contract for policy parity, with existing readers and saved format retained |
| `isolation.mjs` | Uses configured prefix membership at init and exact recorded `meta.branch` for saved runs and Git writes | Shared prefix validation, immutable saved identity and actionable conflict diagnostics |
| `open-pr.mjs` | Accepts exactly `agent-smith/<id>` and excludes that namespace from automatic bases | Configured fresh identity, recorded saved identity, base exclusions and actual-branch diagnostics |
| Both pipeline skills | Consume setup and publication JSON but report a fixed branch | Carry actual returned branch through normal and failure messages |

The setup JSON already carries `branch`. Router metadata already carries `id`, `isolated`, `branch`, optional `chain`, `baseSha` and `startCommit`. No persisted field is needed. Setup and publication are standalone executables, and their source guards forbid importing router modules. Policy parsing failures must remain observable before mutation.

### Key Discoveries

- The existing projection is the seam to extend. It merges the base policy, OpenSpec fragment and project override in that order. Router `loadPolicy` provides the parity oracle. `skills/10x-pipeline/scripts/prepare-run.mjs:31`, `skills/10x-pipeline/scripts/state.mjs:56`.
- Setup lock and registered-worktree lookup already take the full branch as an argument. The fixed names enter at run recognition/creation and cleanup. `skills/10x-pipeline/scripts/prepare-run.mjs:69`, `skills/10x-pipeline/scripts/prepare-run.mjs:133`, `skills/10x-pipeline/scripts/prepare-run.mjs:170`, `skills/10x-pipeline/scripts/prepare-run.mjs:297`.
- Prefix membership is an established fresh-init contract. Calling setup for another id while inside a run currently returns the actual current branch. Baseline arms also use suffixes. Preserve those supported entry points while retaining exact saved-identity checks. `skills/10x-pipeline/test/prepare-run.test.mjs:147`, `skills/10x-pipeline/scripts/isolation.mjs:305`, `docs/REFERENCE.md:414`.
- Saved branch mismatch is checked even before any executed entry, and every isolated router Git write checks linked-worktree identity and `meta.branch`. Reuse these safeguards. `skills/10x-pipeline/scripts/isolation.mjs:309`, `skills/10x-pipeline/scripts/isolation.mjs:326`, `skills/10x-pipeline/scripts/route.mjs:1005`.
- Publication already threads the actual guarded branch into its refspec, GitHub head and manual commands. Extend its guard and base-selection inputs. Archive publication selects the change directory through `--report`. `skills/10x-pipeline/scripts/open-pr.mjs:129`, `skills/10x-pipeline/scripts/open-pr.mjs:184`, `skills/10x-pipeline/scripts/open-pr.mjs:280`, `skills/10x-pipeline/scripts/open-pr.mjs:384`.

### Wave 1 ownership confirmation

Both change records and `context/changes/WAVES.md` were inspected before implementation. The sibling has `change.md` and no plan in this checkout. Its declared production changes are confined to comparison eligibility/rendering in `route.mjs`. It explicitly preserves tolerant `state.mjs` log reading.

| Region | This change | Sibling `compare-damaged-logs-not-comparable` |
| --- | --- | --- |
| Production | Setup, isolation identity, publisher and a narrow standalone shared helper if needed | `route.mjs` comparison functions |
| Existing tests | `prepare-run`, `isolation`, `open-pr`, `skill-loop`, `openspec-skill` | `compare`, `run-state` |
| Policy/state | Consume effective policy and existing saved identity | Preserve log-reader behavior |
| Reference | Run isolation, publication, OpenSpec isolation and the baseline branch-creation sentence | Damaged-log and comparison-eligibility paragraphs |
| Other docs | Both skills, README branch wording, ADR-010/017 amendments and their index rows | Comparison documentation |

Production, policy, prompt and workflow write ownership is disjoint. Keep `state.mjs`, policy defaults, log readers and `route.mjs` read-only for this implementation. Shared Reference edits are paragraph-bounded, including the branch example adjacent to the sibling's comparison paragraphs. Recheck the sibling plan when available before parallel implementation. Any newly overlapping runtime region requires serialized work under the Wave ledger rules. Individual runs leave `WAVES.md` alone.

## Desired End State

Fresh setup with `{ "isolation": { "require": true, "branchPrefix": "codex/" } }` creates `codex/demo` for either chain. Real initialization returns `action: "run"` with a step. Cleanup validates that identity, and repeated setup reuses the run without overwriting its contents or creating a default-prefix branch.

Publication accepts the selected run's validated identity, uses the same branch for push and PR head, excludes run namespaces from automatic bases, and reports that branch. Defaults and saved runs retain their identity. A policy conflict produces actionable refusal before creation, cleanup, staging or publication can redirect the work.

| Transition | Acceptance contract |
| --- | --- |
| Fresh setup | Effective prefix plus id determines the new branch |
| Existing branch | Registration and attachment use that exact configured branch |
| Already inside a run | Preserve the actual current branch and project root under the established prefix-membership contract |
| Saved isolated run | Recorded branch stays authoritative for that run, including zero-executed-entry runs |
| Saved policy conflict | Refuse and name the recorded branch and policy restoration/resume prerequisite |
| Nested project | Apply the Git filesystem project prefix once, independently of the branch prefix |
| Fresh cleanup | Original setup branch, registered worktree, metadata and retained start commit must agree |
| Publication without recorded identity | Preserve existing default-prefix and valid configured-prefix fixtures by requiring the exact generated branch |
| Publication with recorded identity | Require matching id/chain/isolation, HEAD and valid recorded branch |
| Isolation opt-out | Preserve setup/router opt-out behavior and publication's documented skip |

## Scope Boundaries

Scope follows `change.md`. The worktree directory convention, `refs/agent-smith/` recovery namespace, router-state schema and release versions retain their existing contracts. Branch migration, history rewriting, the parked script-path quoting change, savings experiments and roadmap-wide host qualification belong to their existing changes. `context/archive/` is read-only.

## Implementation Approach

Extend the existing isolation-policy projection and share the narrow policy/prefix behavior required by setup and publication through a dependency-free standalone helper under `skills/10x-pipeline/scripts/`. Reuse that helper's pure prefix contract in isolation checks where needed. Keep policy data in its existing files, use Node built-ins, and retain the router import order and standalone source guards.

Read effective isolation fields using the router merge semantics. The advertised prefix remains a literal prefix. A trailing slash is optional. Use Git's native ref validation for generated and recorded branch names, reject option-like names, and validate before a name can select a mutation target. Missing prefix data inherits the shipped default. An explicitly supplied non-string or blank prefix is invalid when isolation is active. Preserve the strict boolean opt-out before prefix-specific validation.

Use saved identity when present without changing metadata. Missing metadata and legacy empty metadata retain the exact generated-branch publication fallback. A malformed or contradictory identity-bearing record must produce a diagnostic rather than enter that fallback. Default-branch protection includes configured defaults and the remote default. Recovery instructions identify the recorded branch and the policy key that must agree with it.

### Assumptions resolved for unattended planning

- Complexity is HIGH because the invariant crosses pre-init setup, destructive cleanup authorization, saved state and publication. The explicit unattended instruction delegates interview and structure decisions. Three ordered phases follow the existing component boundaries.
- Keep literal-prefix semantics, including prefixes such as `runs-`, because the existing gate uses `startsWith` and the Reference imposes no slash requirement. Reject invalid explicit values before mutation to satisfy the change's input-safety acceptance.
- Preserve legacy publication fixtures without a saved identity, including `{}` metadata. Existing `open-pr.test.mjs` fixtures exercise this path. Once isolated identity is recorded, require its exact branch, id and chain.
- Automatic base discovery excludes both the effective prefix and the legacy `agent-smith/` namespace. This extends configured behavior while retaining the existing exclusion for older run branches.
- Live PR and report-comment acceptance is Manual under ADR-017 Amendment 2. The orchestrator owns publication with the existing comment authorization.

## Critical Implementation Details

### Identity resolution precedes mutation

Detect saved identity conflicts in the invocation root and selected registered run root before treating a changed prefix as a fresh run. An invocation-root saved isolated identity is authoritative and any conflict refuses before another candidate is considered. Preserve the already-in-run case and actual current branch. Otherwise prefer the exact configured branch and its registered worktree, validating any identity recorded there. Only when those paths supply no selected run, inspect relevant registered worktrees for the requested change at the same nested-project prefix and Git common directory. Match metadata id and chain, normalizing an absent chain to `10x` as existing cleanup does. A unique remaining saved identity may select the run, subject to effective-policy validation. Multiple remaining identities refuse with candidate branches and roots before mutation, including when they are same-id baseline arms. Registration enumeration order never chooses a run, and unrelated fallback candidates do not override an exact valid selection.

Consult registration even when the original source folder has already been cleaned. An existing run at a custom registered location must survive prefix drift without a replacement branch being created. Preserve setup case precedence and branch-scoped locking. Revalidate any selected saved identity under the resolved branch lock before creation or attachment, then revalidate the selected root before returning success.

### Cleanup trusts verified preservation evidence

The original setup JSON supplies the created branch. It must agree with effective policy, current registration, repository, project prefix and router metadata. A forged branch or policy drift refuses cleanup before the first unlink. All existing tracked-file, staged-file, symlink, immutable-commit, byte and race rechecks remain part of authorization. Cleanup stays repeatable and reports surviving paths after partial failure.

### Publication and recovery identity

Resolve metadata from the requested chain and the `--report` change directory for archived publication. Validate policy and saved identity before committing leftovers or pushing. Carry the validated branch through base selection, explicit refspecs, GitHub arguments, JSON and manual guidance. If validation fails, recovery output may name the observed and expected branches with their provenance.

Git-valid names can contain shell metacharacters. Render every dynamic argument in executable recovery commands with shell-safe literal quoting, including the complete refspec, branch, base, remote, repository and worktree path. Keep runtime Git/GitHub execution on argument arrays. Cover the missing-remote, failed-push and failed-PR recovery paths in `open-pr.mjs`.

## Phase 1: Consistent setup and saved-run identity

### Overview

Expand policy handling and identity validation, then wire setup and cleanup to the same branch contract for both chains.

### Changes Required

#### 1. Effective policy and validation

**Files** `skills/10x-pipeline/scripts/prepare-run.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`, a narrow shared standalone helper under `skills/10x-pipeline/scripts/`.

**Intent** Extend and reuse the existing isolation projection so setup and the publisher can consume the same effective prefix. Validate branch inputs at the shared boundary with caller-owned bounded Git execution.

**Contract** Base policy, OpenSpec fragment and project override retain router merge parity. Active isolation requires a valid literal prefix and rendered branch. Standalone callers import no router module, helper imports have no entrypoint side effects, and fixed Git deadlines remain effective.

#### 2. Setup, cleanup and resume

**Files** `skills/10x-pipeline/scripts/prepare-run.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`.

**Intent** Replace default-prefix assumptions at creation, run recognition, reuse, attachment and cleanup. Detect saved-run policy conflicts before fresh creation and retain original run identity through resume.

**Contract** Existing setup JSON fields and ordered cases remain supported. Apply the deterministic identity-selection and ambiguity-refusal rules above, including legacy absent-chain normalization. Locks and registration use the resolved full branch. Only creation copies inputs. Cleanup cross-checks the saved setup branch against router-owned metadata and immutable preservation evidence. Saved `meta.branch` is never reassigned by these standalone tools. Existing router Git-write checks remain exact.

#### 3. Focused lifecycle regressions

**Files** `skills/10x-pipeline/test/prepare-run.test.mjs`, `skills/10x-pipeline/test/isolation.test.mjs`.

**Intent** Extend existing scratch fixtures for both chains, committed overrides and nested projects. Update the Git-wrapper allowlist only for required read-only validation commands and extend projection parity assertions to branch fields.

**Contract** Cover creation followed by actionable real init, fresh and repeated cleanup, source-absent reuse, custom registered locations, unattached branches, setup inside the selected run, custom-prefix lock contention, and saved default/custom runs with zero or executed entries. Conflict and tampering cases assert unchanged refs, index, metadata and preserved source/destination bytes. Include blank/non-string prefixes, invalid refs, option-like names, default-branch collisions, main checkout, detached HEAD, wrong saved branch/chain and opt-out. Include a valid non-slash prefix.

Include multiple registered default/custom same-id baseline runs with the source absent, shuffled registration order, a valid exact configured selection alongside other candidates, and ambiguous fallback candidates. Assert exact selection remains stable, ambiguity refuses before mutation, nested-project and chain identities stay separate, and saved 10x metadata without `chain` still resumes.

### Success Criteria

#### Automated Verification

- Both-chain configured-prefix lifecycle and safety regressions pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/isolation.test.mjs`.
- The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 2: Configured publication and base selection

### Overview

Use effective configuration and saved identity throughout the standalone publisher, proving the workflow with local remotes and fake GitHub responses.

### Changes Required

#### 1. Publisher identity and diagnostics

**File** `skills/10x-pipeline/scripts/open-pr.mjs`.

**Intent** Consume the shared isolation projection and guard the selected run before any leftover commit or push. Render actual branch identity in output and recovery instructions.

**Contract** Linked-worktree, attached HEAD, default-branch, opt-out, exact legacy fallback and saved-identity protections all apply. Saved metadata under the live or `--report` change folder must agree with the selected chain/id and HEAD, treating an absent saved chain as `10x`. Invalid identity or policy skips before writes and remote calls. Executable manual guidance quotes dynamic arguments literally through the existing recovery-message functions. Existing JSON shape and runtime/usage exit codes remain supported.

#### 2. Base discovery and existing publication flow

**File** `skills/10x-pipeline/scripts/open-pr.mjs`.

**Intent** Exclude configured run branches from nearest-ancestor discovery, retaining legacy run exclusions and existing tie behavior. Feed the actual guarded branch through publication.

**Contract** Preserve explicit base precedence, nearest remote ancestor with remote-HEAD tie preference, older-Git counting fallback, fallback base discovery, no-commits skip, safe explicit refspec, failed-hook/staged-content behavior, existing/closed/merged PR handling and bounded errors. Automatic fallback candidates also pass branch validation and run-namespace exclusions.

#### 3. Publisher regressions

**File** `skills/10x-pipeline/test/open-pr.test.mjs`.

**Intent** Parameterize existing real-Git/local-bare-remote/fake-GitHub fixtures for custom prefixes and both chains. Exercise identity from archived report locations in scratch projects.

**Contract** Assert the remote ref, `--head`, selected base, JSON and manual commands contain the configured branch. Include repeated publication, a nearer `codex/other-run` ancestor, legacy run ancestors, feature branches, tie/fallback paths, nested project roots, valid saved noncanonical suffix branches, absent/empty legacy metadata and contradictory/malformed saved identity. Refusals preserve working and staged contents and invoke neither push nor GitHub. Preserve existing forbidden-operation guards.

Include Git-valid prefixes containing command-substitution characters, a semicolon and a single quote. Exercise emitted recovery commands only against inert scratch Git/GitHub clients and assert their received argv preserves the exact branch, complete refspec and other dynamic values without shell expansion or additional commands.

### Success Criteria

#### Automated Verification

- Configured publication, base selection and compatibility regressions pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs` using local remotes and fake clients.
- The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 3: Workflow guidance, amendments and delivery gates

### Overview

Make both skills and current guidance describe the implemented branch contract, then complete local verification before orchestrator publication.

### Changes Required

#### 1. Both orchestrator skills and content tests

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`.

**Intent** Carry setup's branch into final reporting and publication's branch into its outcome messages. Use saved setup identity for script-error reporting, with an explicit unavailable identity when neither result supplies one.

**Contract** Replace fixed default-branch assertions in Start and Pull request sections. Preserve shared Anti-stall section equality, terminal ordering, script-path conventions, strict comment authorization and provider-neutral wording. Keep routing literals in the policy/router owners.

#### 2. Reference and decision records

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`, `docs/ADR/README.md`.

**Intent** Describe the configured branch, default value, saved identity, validation, policy conflict guidance and both-chain behavior. Amend ADR-010 with Amendment 4 and ADR-017 with Amendment 3, updating the existing index rows.

**Contract** Reference changes cover Run isolation, Pull request, the baseline branch-creation example and OpenSpec isolation. The baseline example preserves allowed suffix branches under the effective prefix. README identifies default naming and links configured behavior. ADR amendments reconcile earlier fixed-prefix decisions and retain their historical context. Coordinate shared Reference hunks with the sibling's separate eligibility paragraphs. Add a folder README row only if a new test or ADR file is actually introduced.

#### 3. Review and local gates

**Intent** Obtain plan review before implementation and implementation review after the local gates. Resolve actionable findings through the enclosing pipeline. Recheck that the sibling's actual diff preserves the ownership boundary before integration.

**Contract** Implementation commits follow the implementation skill's scoped rules and include a Conventional Commit subject and AI co-author trailer. The plan step leaves artifacts uncommitted. Run-report generation, PR publication and the requested comment remain router/orchestrator-owned. Keep the current branch and worktree throughout.

### Success Criteria

#### Automated Verification

- Both skills' actual-branch reporting and shared-rule content checks pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- Focused regressions detect the original hardcoded setup and publisher behavior when each fault is reintroduced separately in an isolated scratch copy, followed by a green focused rerun on the implementation.
- The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- Local delivery hygiene passes with `git diff --check`, `node tools/version-check.mjs` and `node tools/commit-lint.mjs adff64f7..HEAD`.

#### Manual Verification

- The orchestrator publishes this run branch without force and returns an open reviewable pull request containing the reviewed implementation and full-suite evidence.
- The orchestrator posts or updates the requested run-report comment on that pull request and reports its URL with the actual branch identity.
- PR CI is green and the owner can inspect the branch, plan, implementation review and report comment before deciding whether to merge.

## Testing Strategy

Extend the existing tests and their hermetic environments. Use committed `codex/` overrides for the real setup-to-init proof, and test both default and custom saved runs. A parseable halt does not satisfy initialization acceptance. Snapshot source/run contents, metadata, refs and the index around conflict/refusal cases.

Use existing fake Git/GitHub clients and local bare remotes for publication. Exercise both chains and scratch archive layouts through normal CLI entry points. Real remote publication and comment evidence remain in the Manual rows. The deterministic suite must run before terminal publication.

For fault detection, create scratch copies inside the run worktree, use the existing script/skill override seams where available, and restore only the scratch variant between probes. Scratch cleanup uses `removeTree`. Preserve every production edit and staged version. Record commands and concise outcomes as verification evidence with the implementation.

## Performance Considerations

Reuse existing branch-scoped locking and bounded Git calls. Saved identity discovery is limited to relevant registered worktrees/project roots. Add no network calls to the router and no unbounded repository or filesystem scan.

## Migration Notes

This expands existing policy support without a data migration. The router remains the only writer of `meta.json` and `run.jsonl`. Saved default-prefix and configured-prefix branches remain usable under compatible effective policy. Prefix changes affecting a saved run refuse with restoration guidance and preserve its branch, registration and bytes. Repeated setup, cleanup and publication retain existing idempotency behavior.

Deploy the scripts and skills together. Existing default runs need no conversion. A custom run created by the fixed version may be refused by an older publisher after rollback, so retain the compatible installed version for that run or restore the fixed version. Roll back code with a new revert commit through the normal review process. Keep existing worktrees, branches and recovery refs available. No destructive contraction is part of this change.

## References

- Task and acceptance in `context/changes/run-branch-prefix-consistency/change.md`.
- Sibling ownership in `context/changes/compare-damaged-logs-not-comparable/change.md` and Wave 1 of `context/changes/WAVES.md`.
- Existing setup, cleanup and publication contracts in `docs/REFERENCE.md`, ADR-010 and ADR-017.
- Shared safety and publication ownership in `skills/10x-pipeline/rules/top.md` and `skills/10x-pipeline/rules/steps/plan.md`.
- Scope and source anchors in Current State Analysis. Read-only research children `prefix_lifecycle` and `prefix_publication` inspected the same baseline and returned findings to the enclosing plan step. Child-inclusive token coverage is unavailable.

## Progress

### Phase 1: Consistent setup and saved-run identity

#### Automated

- [x] 1.1 Both-chain configured-prefix lifecycle and safety regressions pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/isolation.test.mjs`. — fbebbe53
- [x] 1.2 The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — fbebbe53

### Phase 2: Configured publication and base selection

#### Automated

- [x] 2.1 Configured publication, base selection and compatibility regressions pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs` using local remotes and fake clients. — 4c645b95
- [x] 2.2 The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 4c645b95

### Phase 3: Workflow guidance, amendments and delivery gates

#### Automated

- [x] 3.1 Both skills' actual-branch reporting and shared-rule content checks pass with `node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`. — a80fc55b
- [x] 3.2 Focused regressions detect the original hardcoded setup and publisher behavior when each fault is reintroduced separately in an isolated scratch copy, followed by a green focused rerun on the implementation. — a80fc55b
- [x] 3.3 The required full suite passes on Node 24+ with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — a80fc55b
- [x] 3.4 Local delivery hygiene passes with `git diff --check`, `node tools/version-check.mjs` and `node tools/commit-lint.mjs adff64f7..HEAD`. — a80fc55b

#### Manual

- [x] 3.5 The orchestrator publishes this run branch without force and returns an open reviewable pull request containing the reviewed implementation and full-suite evidence. — [Publication acceptance](verification.md#post-publication-acceptance)
- [x] 3.6 The orchestrator posts or updates the requested run-report comment on that pull request and reports its URL with the actual branch identity. — [Publication acceptance](verification.md#post-publication-acceptance)
- [x] 3.7 PR CI is green and the owner can inspect the branch, plan, implementation review and report comment before deciding whether to merge. — [Publication acceptance](verification.md#post-publication-acceptance)
