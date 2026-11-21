# Run Root Worktree Readiness Implementation Plan

## Overview

Make shared run setup check the integration base, install the target project's locked dependencies, and run its optional preflight before either pipeline reaches `init`. A failed prerequisite stops the pipeline with a recovery action and leaves the original change inputs available. [Change brief](change.md) · [Issue #244](https://github.com/xycu/agent-smith/issues/244)

## Current State Analysis

`prepare-run.mjs` creates a linked worktree at the invoking commit and overlays the selected change directory. It takes a branch-specific lock and records pending copy intent before registration. The current retry can reapply the overlay until final worktree validation clears the record. Setup neither consults a fresh integration tip nor prepares dependencies or project gates. [Creation and locking](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L297-L352) · [Copy and validation](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L379-L413)

Both pipeline skills call this executable in Start step 3 and reject failure JSON before Start step 4 calls `init`. The router owns run state and start commits. The setup result is also evidence for post-init cleanup, which applies only to a successful fresh copy. [10x Start](../../../skills/10x-pipeline/SKILL.md#start) · [OpenSpec Start](../../../skills/openspec-pipeline/SKILL.md#start) · [ADR-010](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#amendment-2--shared-executable-run-setup-2026-11-14)

## Desired End State

For a fresh isolated run, report the checked integration branch and how many commits the pinned start is behind. When the count is positive, halt before creating the worktree and tell the operator to integrate the fetched branch into the original checkout and retry. A local-only repository can prepare a run with freshness explicitly reported as skipped.

After creation and copy, a supported JS project installs from its lockfile inside the selected worktree. The optional top-level `readiness` command runs from the selected project root after the dependency check, including for projects with no JS dependencies. Setup succeeds only after all applicable checks succeed. Failures identify the stage, working directory and recovery action. An interrupted or failed gate can be retried without replacing the change files already copied into the run.

### Key Discoveries:

- The worktree add already uses an immutable commit and suppresses automatic upstream tracking. The integration comparison can check that exact commit without moving a branch. [Creation](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L338-L352)
- Original-checkout policy and worktree policy have separate roles. Setup reads original isolation settings for selection. The selected run gets project files such as the gate policy from the branch point. [Policy projection](../../../skills/10x-pipeline/scripts/run-identity.mjs#L9-L34) · [Worktree setup reference](../../../docs/REFERENCE.md#L143-L173)
- Setup has a single-JSON stdout contract and a 600-second caller timeout. Existing synchronous Git commands have individual deadlines. Package managers and readiness scripts can launch descendants, so their deadline needs to cover teardown under the lock. [Setup CLI](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L563-L598) · [Bounded child teardown precedent](../../../skills/10x-pipeline/scripts/run-claude.mjs#L76-L85)

## Scope Boundaries

This change covers fresh isolated run preparation and recovery of its unfinished setup. Project-specific service allocation and health checks belong in the optional project command. Automatic rebase, router state changes, cross-worktree write protection, toolchain bootstrap, PR publication, and setup lock residue and deletion propagation follow-ups are outside this delivery. [Wave sequencing](../WAVES.md#wave-4)

## Implementation Approach

Keep both gates in the shared standalone setup path. Check freshness under the existing branch lock before writing freshness-dependent setup artifacts. Then create the worktree from the same checked commit, copy and validate the change, persist copy completion and run the applicable project gates. A helper under `skills/10x-pipeline/scripts/` may own command selection and execution, with `prepare-run.mjs` retaining ownership of ordering, branch identity, the pending record, and the CLI response.

### Assumptions and rationale

- Use `origin` when configured and the sole configured remote otherwise. Use that remote's advertised default branch as the integration branch for this delivery. Stop with an unambiguous diagnostic when multiple remotes lack an `origin`, a selected remote cannot advertise a branch, or history is too shallow for a reliable comparison. A remote-less repository skips freshness and still runs applicable project gates. The current isolation default-branch lookup and publication default center on `origin`, while ADR-010 preserves the invoking commit. [Branch validation](../../../skills/10x-pipeline/scripts/run-identity.mjs#L56-L66) · [ADR-010](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#amendment-2--shared-executable-run-setup-2026-11-14)
- Stop on lag or divergence. The operator chooses how to integrate upstream work. Both a matching base and a local-ahead base with zero integration-only commits satisfy the freshness gate. This preserves local commits and follows the issue's stop option. [Change brief](change.md)
- Auto-install applies to the supported JS lockfile families. A JS package that declares dependencies needs a usable lockfile. Projects in other ecosystems can use the readiness command for their own prerequisites. Projects without JS dependencies or a lockfile continue to the configured hook. [Change brief](change.md) · [npm CI](https://docs.npmjs.com/cli/commands/npm-ci) · [pnpm install](https://pnpm.io/cli/install) · [Yarn install](https://yarnpkg.com/cli/install) · [Bun install](https://bun.com/docs/pm/cli/install)
- Treat the committed readiness value as trusted executable project configuration, common to both chains. Its absence means the hook is skipped. Use executable scripts only in a trusted checkout. Their working directory is a contract, and isolation of their external services is the project's responsibility. [Change brief](change.md) · [Run isolation reference](../../../docs/REFERENCE.md#L143-L173)

## Phase 1: Verify integration freshness

### Overview

Verify the exact start commit against a freshly fetched integration tip before creating a run.

### Changes Required:

#### 1. Shared fresh-branch setup

**File** `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent** Verify freshness while preserving the branch point and leaving a stale or unreachable remote retryable.

**Contract** After source and path validation, pin `HEAD^{commit}`. For a fresh registration, discover the selected remote's symbolic HEAD and advertised commit, then fetch that commit and verify it locally before comparing the two verified SHAs with `git rev-list --left-right --count`. Use an explicit narrow fetch with tags, submodule recursion, default ref mapping and FETCH_HEAD writes disabled. Validate the advertised branch and SHA, use noninteractive argv calls, and fail on discovery, fetch, or comparison errors without substituting a cached remote ref. Preserve local branch refs, the index, worktree registrations and Git config on a failed freshness check. Put the branch, remote and behind count in an additive `base` result when measured, with an explicit skip for a repository without a remote. The existing bounded `reason` carries the known count for stale starts and tells the user to update the original checkout and rerun. Keep using the checked SHA for `worktree add`.

A registered pending retry retains its checked branch point. A pending attempt that never registered a worktree uses the fresh check before registration. Ordinary reuse, attachment, in-run invocation, opt-out and cleanup retain their existing behavior.

#### 2. Local Git proof

**Files** `skills/10x-pipeline/test/prepare-run.test.mjs`, `skills/10x-pipeline/test/prepare-run-helpers.mjs`

**Intent** Exercise real graph counts and inject controlled discovery and transport errors.

**Contract** Use a local bare remote whose default need not be `main`. Set a stale local remote-tracking tip and advance the remote independently. Verify counts for equal, ahead, behind and diverged histories using real Git. Extend the existing allowlisted wrapper only for new commands. Cover no remote, failing remote, a safe retry after the original branch is updated, and fresh-only network behavior. Check absence of new branch, registration, exclude and pending record on failure before registration, plus original HEAD, index and config preservation.

### Success Criteria:

#### Automated Verification:

- Local Git fixtures prove fresh tip selection, exact lag, pinned worktree HEAD and zero setup mutations on stale or failed fetch via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- The setup CLI keeps one JSON result, reports a local-only freshness skip and performs no freshness fetch on resume, opt-out or cleanup via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.

## Phase 2: Prepare dependencies and run the project preflight

### Overview

Install in the worktree and execute the optional project command under the setup lock, with recoverable failures.

### Changes Required:

#### 1. Worktree gate execution

**Files** `skills/10x-pipeline/scripts/prepare-run.mjs` and its worktree gate helper if needed

**Intent** Prepare a runnable dependency tree and give the project a way to verify its own gate prerequisites.

**Contract** Start only after copy and worktree validation. For a nested package, prefer its own lockfile, otherwise inspect enclosing package roots only up to the registered worktree top when the selected root has a package manifest. Run the installer at the owning package root and run the readiness hook at the selected project root. At the install root, choose one lockfile family and validate any declared `packageManager` against it. Refuse ambiguous/missing required lockfiles with the files to fix. Use `npm ci` for `package-lock.json` or `npm-shrinkwrap.json`, `pnpm install --frozen-lockfile` for pnpm, `yarn install --frozen-lockfile` for Yarn 1, `yarn install --immutable` for Yarn 2+, and `bun install --frozen-lockfile` for Bun. Determine the Yarn generation from the valid package-manager declaration or the installed manager version. Use installed executables on PATH. A missing manager, failed install or unsafe dependency layout returns the package root and the exact install command where one can be selected.

Verify canonical command directories and validate the manifest, lockfile and dependency paths before the installer can follow them. Refuse installations that would replace tracked dependency content or traverse existing external or dangling `node_modules` links. Recheck dependency links after install and before the hook. Accept internal workspace/package-manager links and native layouts such as Yarn Plug'n'Play. Keep the original checkout out of dependency path resolution. Use the native manager's lockfile checks and preserve installer-owned artifacts on failure. Check that generated dependency artifacts are ignored by the project before setup succeeds, since rollback snapshots and publication can sweep unignored files. On failure identify the unignored path and ask the operator to fix the project's ignore rules. Document the same responsibility for generated artifacts from the project hook. [Publication sweep](../../../docs/REFERENCE.md#L186)

Read the optional nonblank top-level `readiness` string from the selected project's regular committed policy file at the pinned branch point. A configured invalid value fails before package execution. Run that string as a project shell command after install or an applicable install skip. Failure identifies the readiness command and the working directory with bounded failure detail. Keep child output off CLI stdout. Use noninteractive input and bound the whole preparation against the skills' 600-second timeout, with time left for termination, lock release and JSON reporting. Reuse the process-group termination pattern for install and hook subprocesses. Retain the lock until those subprocesses have settled, including on timeout. Derive diagnostics from stage and status and keep credential-bearing output out of the result. [Setup output](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L563-L598) · [Termination precedent](../../../skills/10x-pipeline/scripts/run-codex.mjs#L166-L183)

#### 2. Pending setup and recovery

**File** `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent** Preserve copied inputs and worktree edits when a gate must be retried.

**Contract** Under the existing branch lock, atomically mark the existing pending record as copy-complete after validating the copy and before executing gates. An absent marker still means copy pending. Gate failure retains that record, returns `runRoot: null` and names the original invocation root for retry. A copy-complete retry revalidates registration, path, pinned HEAD and router identity, then reruns the gates against that worktree with no copy. Preserve the existing valid initialized-identity recovery path and refuse ambiguous state. Clear the record only after successful preparation or valid initialized recovery. Keep `copied` tied to an overlay in the current invocation. Gate-only retry is `case: "reused"`, with `copied: false`, and original input cleanup remains inapplicable. A fully completed setup uses ordinary resume semantics and does not repeat the gates.

#### 3. Cross-chain proof and operator documentation

**Files** `skills/10x-pipeline/test/prepare-run.test.mjs`, `skills/10x-pipeline/test/prepare-run-helpers.mjs`, `skills/10x-pipeline/test/prepare-run-timeout.test.mjs`, `skills/10x-pipeline/test/skill-loop.test.mjs`, both pipeline `SKILL.md` files, `docs/REFERENCE.md`, and ADR-010

**Intent** Prove before-init gating for both chains and teach the operator how to fix and retry each failure.

**Contract** Use fake package executables and a local hook to record argv, cwd, output and ordering. Include nested roots, conflicting/missing lockfiles, missing executable, external dependency links before/after install, internal links, unignored dependency artifacts, no-lock/non-JS skip, policy provenance, and child timeout. Inject each stage failure and then retry after fixing its prerequisite. Verify the worktree edits and source inputs survive, concurrent retries cannot enter while a gate owns the lock, and legacy pending copies and initialized resumes still work. Use the existing skill-loop tests to pin both skills' diagnostics and stop-before-init wiring. Keep setup output compatibility, add freshness reporting and gate retry guidance, and document the trusted committed `readiness` example, dependency boundary, overall timeout and mixed-version recovery. Search docs for old setup behavior as required by [lessons.md](../../foundation/lessons.md).

### Success Criteria:

#### Automated Verification:

- Offline setup fixtures prove lockfile commands, worktree cwd, dependency boundary and optional committed hook order for both chains via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- Offline failures and timeout prove bounded diagnostics, lock ownership, no gate-only recopy or cleanup authorization, and a successful retry via `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`.
- Both skill wiring tests prove failed setup stops before init, and the required Node 24+ suite passes via `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification:

- On an owner's real project, confirm that a fresh run reaches its first gate with local dependencies and that its configured readiness command rejects an unavailable or shared service with a repairable diagnostic.

## Testing Strategy

### Unit Tests

Use fixture-driven CLI tests for the new policy and command-selection branches. Test malformed, missing and ambiguous inputs as well as all supported lockfile families. Assert the exact returned install command without fetching packages.

### Integration Tests

Run real Git against a local remote and fake managers from fixture PATH. Use a local hook that depends on an installer marker, plus before/after filesystem snapshots and a blocked child for failure paths. Keep all automated proof independent of publication, credentials, package registries and external services.

### Manual Testing Steps

Use a trusted project with a real lockfile and readiness hook. Start from an up-to-date original checkout with a committed hook. Confirm the selected run has usable dependencies and can run its normal gate. Repeat with a fresh change while the service precondition is deliberately unavailable, then fix the service and retry the same setup. Record the diagnostic and successful retry without altering another worktree's service state.

## Performance Considerations

Fresh setup pays one integration-tip observation and fetch plus cold install and preflight time. Ordinary resumes avoid those costs. Use the package manager's normal cache, verify worktree-local dependency paths, and stop within the caller's deadline with a retryable result.

## Migration Notes

No router-state or project data migration. Existing initialized runs and worktrees without a pending intent keep ordinary resume behavior. Older pending records can finish through copy recovery and gates. Finish any copy-complete pending setup using the enabling version before downgrading because older code can repeat the copy. To recover a stale pre-creation start, update the original branch and rerun. For a gate failure, preserve the registered worktree and correct the named prerequisite before retry. If the pinned committed hook itself needs to change, preserve the failed worktree and carry the corrected commit into a fresh setup. Reverting the feature after pending setups settle restores the prior setup behavior without rewriting branches.

## References

- [Change notes and issue](change.md)
- [Shared setup](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L222-L414) and [regression fixtures](../../../skills/10x-pipeline/test/prepare-run.test.mjs)
- [ADR-010 pending copy recovery](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#amendment-6--retry-an-interrupted-setup-copy-2026-11-21)
- [Plan for the shipped retry behavior](../../archive/2026-11-19-prepare-run-retry-after-failed-setup/plan.md)
- [Git fetch](https://git-scm.com/docs/git-fetch) · [Git ls-remote](https://git-scm.com/docs/git-ls-remote) · [Yarn Classic install](https://classic.yarnpkg.com/en/docs/cli/install)

## Progress

### Phase 1: Verify integration freshness

#### Automated

- [ ] 1.1 Local Git fixtures prove fresh tip selection, exact lag, pinned worktree HEAD and zero setup mutations on stale or failed fetch via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- [ ] 1.2 The setup CLI keeps one JSON result, reports a local-only freshness skip and performs no freshness fetch on resume, opt-out or cleanup via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.

### Phase 2: Prepare dependencies and run the project preflight

#### Automated

- [ ] 2.1 Offline setup fixtures prove lockfile commands, worktree cwd, dependency boundary and optional committed hook order for both chains via `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- [ ] 2.2 Offline failures and timeout prove bounded diagnostics, lock ownership, no gate-only recopy or cleanup authorization, and a successful retry via `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`.
- [ ] 2.3 Both skill wiring tests prove failed setup stops before init, and the required Node 24+ suite passes via `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual

- [ ] 2.4 On an owner's real project, confirm that a fresh run reaches its first gate with local dependencies and that its configured readiness command rejects an unavailable or shared service with a repairable diagnostic.
