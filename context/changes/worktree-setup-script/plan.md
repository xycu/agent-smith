# Shared run setup implementation plan

## Overview

Move the ordered run-isolation setup in both pipeline skills into `skills/10x-pipeline/scripts/prepare-run.mjs`. Preserve where runs execute, when files are copied, their timestamps, and every resume path. Verify the behavior by launching the real script against scratch repositories and linked worktrees.

This is a Wave 4 refactor. Planning writes only this plan, its brief and this change's lifecycle metadata. Implementation is not part of this planning step.

## Current State Analysis

Both skills' Start step 3 performs the same setup, with only the change-folder path differing. It checks opt-out, recognizes an already-running linked worktree, then chooses in-flight main-checkout, new branch, existing worktree or unattached existing branch in that order. Only a newly created branch receives a copy of the change folder. The source folder stays in place.

The router owns isolation enforcement, run state, start/step commits and rollback. `isolation.test.mjs` tests those router gates, but builds its worktrees itself; it does not execute the skills' setup. `open-pr.mjs` supplies the standalone-script precedent: bounded argument-array subprocesses, no router imports, one runtime JSON result, and usage errors with exit 2.

The initial working tree contains orchestrator-owned modifications to this change's `agent-smith/meta.json` and `run.jsonl`; leave them untouched. No research or frame artifact exists. `context/foundation/roadmap.md` has no matching Change ID, so it needs no update.

### Key Discoveries

- `skills/10x-pipeline/SKILL.md:40` and `skills/openspec-pipeline/SKILL.md:42` own the duplicated setup and subsequent working-directory/final-message rules. Already running in **any** linked `agent-smith/` branch is a no-copy case; do not tighten this to matching the requested id.
- `skills/10x-pipeline/scripts/state.mjs:39` and `:62` define override merging and reject malformed or non-object project overrides. `skills/10x-pipeline/scripts/isolation.mjs:261` turns isolation on only for an object whose `require` is boolean `true`.
- `skills/10x-pipeline/scripts/open-pr.mjs:35` reads only its relevant policy block without importing the router. `pr-common.mjs:10`, `:17` and its `isEntryPoint` helper supply reusable standalone validation, subprocess and entrypoint behavior.
- `skills/10x-pipeline/test/isolation.test.mjs:23` and `skills/openspec-pipeline/test/openspec-isolation.test.mjs` show real linked-worktree fixtures. `helpers.mjs` already provides `run(..., { script })`, `gitEnv`, `gitInit` and `cleanupAll`.
- `skills/10x-pipeline/test/open-pr.test.mjs:675` guards against router push/gh calls, but that file belongs to `tests-strip-git-env` in this wave. Add equivalent setup-script coverage in the new test file, without editing that sibling-owned file.
- `docs/REFERENCE.md:61` describes the existing preservation contract; ADR-010's Run isolation decision requires timestamps and copying only on branch creation.
- `context/changes/WAVES.md` places stale-main-copy cleanup in Wave 5. Its cleanup requires a successful router start commit, which does not exist during pre-init setup.

## Desired End State

Both skills invoke one shared script from their original project root, retain its absolute `root` and `runRoot`, display its `notInRun` paths, and run subsequent commands from `runRoot`. No skill contains a worktree-creation, copy or exclude-file command. The six successful setup cases remain independently executable and tested for both chains.

### CLI and result contract

`node <absolute-script-path>/prepare-run.mjs <id> [--chain 10x|openspec]`, default chain `10x`. Use the existing standalone `ID_RE` rather than introducing another id rule. Reject missing/invalid ids, unknown flags, extra positional arguments and missing/invalid chain values before filesystem or Git mutation. The supported flag syntax follows `open-pr.mjs` (`--chain openspec`); no other options are added.

Runtime outcomes print exactly one JSON object on stdout and exit 0. Usage errors print a bounded diagnostic and usage on stderr, no stdout JSON, and exit 2. Runtime output has the requested fields plus `reason` to distinguish operational failure from success:

| Field | Contract |
| --- | --- |
| `root` | Absolute original invocation directory, the project root, not automatically the repository top level. |
| `runRoot` | Absolute usable project directory after setup; `null` on setup failure. |
| `worktree` | Absolute selected linked-worktree top, or `null` when none is selected; never append the project prefix twice. |
| `branch` | Selected run branch; for `in-run-worktree`, the actual current branch. Requested branch when creating/reusing/attaching; `null` when no run branch is selected. |
| `case` | One of the six cases below; `null` if failure precedes case selection. A selected case is not proof its work succeeded. |
| `copied` | Boolean, true only after the complete fresh-branch copy succeeds. |
| `excludeAdded` | Boolean reflecting an actual local-exclude append, even if a later operation fails. |
| `notInRun` | Array of uncommitted paths outside the selected change folder, collected for fresh creation, otherwise empty. Paths use Git's repository-top-relative spelling. |
| `left` | Empty array in Wave 4. Retained in the requested result shape; it does not mean the source folder was removed. Cleanup and its retained-file reporting belong to Wave 5. |
| `reason` | `null` on successful setup, otherwise a bounded actionable diagnostic; skills stop before `init` when non-null. |

The two intentional no-setup cases (`opt-out`, `in-flight-main`) are successful setup results with `runRoot === root`; the router retains its existing authority to halt at `init`. A missing/malformed JSON result or nonzero process exit also stops the skill; exit 0 alone is never sufficient.

### Ordered behavior boundary

Evaluate top to bottom; later cases never override an earlier match. Change paths are `context/changes/<id>` for 10x and `openspec/changes/<id>` for OpenSpec. Both read the project override from `context/foundation/agent-smith-policy.json`.

| Order / case | Predicate | Required behavior |
| --- | --- | --- |
| 1. `opt-out` | Not inside a Git worktree, Git unavailable, or effective isolation is not strictly on. | Return `root`; create/copy/append nothing. With required isolation and no Git, leave the explanatory halt to router `init`. |
| 2. `in-run-worktree` | Invocation is in a linked worktree on a branch starting `agent-smith/`. | Return the current project directory, including any subdirectory prefix; no new worktree, exclusion or copy. The branch need not match `<id>`. |
| 3. `in-flight-main` | Selected chain's `agent-smith/meta.json` exists and the requested branch does not. | Stay at `root`, do not create or copy; router `init` keeps its existing isolation halt. |
| 4. `created` | Requested branch does not exist and there is no in-flight metadata. | Check ignore status; if needed append the anchored local exclude. Collect `notInRun`. Create a branch and worktree from current HEAD, then copy the selected change folder with timestamps. |
| 5. `reused` | Requested branch exists and Git lists its worktree. | Use that registered worktree plus the original project prefix, even at a non-default path. Copy and append nothing. |
| 6. `attached` | Requested branch exists without a worktree. | Add the default worktree for the existing branch and return it plus the prefix. Copy and append nothing. |

Detached HEAD or a linked worktree on an unrelated branch does not satisfy case 2; apply the remaining existing cases without switching the invoking worktree. A branch checked out in the main checkout is also an existing registered worktree for case 5; the router decides whether it can run there. Unavailable registered paths are failures, not permission to create elsewhere or copy stale files.

## What We're NOT Doing

- Wave 5 stale-copy deletion, archive/live-id collision guards, post-init cleanup or a cleanup CLI mode. Keep the source folder and the existing stale-copy warning.
- Editing `WAVES.md`, router modules, either policy, run state, shared test helpers, CI or sibling-owned tests (`open-pr.test.mjs`, `pr-comment.test.mjs`, `openspec-contract.test.mjs`, `tools/test/commit-lint.test.mjs`).
- Editing either skill outside Start step 3, especially dispatch, anti-stall rules, late usage, other Start steps or existing script-path declarations. Define the new setup path and its timeout inside step 3.
- Fixing unrelated shell quoting, changing routing, branch-prefix policy, commit/rollback behavior, releases or adding npm dependencies.
- A general policy loader, copy framework, configurable setup timeout, cleanup/recovery state file or a new concurrency service.
- Claiming a live Claude/Codex permission smoke test was performed. Host permission behavior remains the pre-existing limitation documented in REFERENCE.

## Implementation Approach

Add one standalone ESM executable in the existing shared scripts directory. Reuse suitable exports from `pr-common.mjs` unchanged; import no router module in production. Read the relevant isolation policy projection using the shipped 10x policy, any isolation fragment in the current OpenSpec policy, then the project override, with parity tests against `loadPolicy` and `isolationOn`. Do not duplicate the entire policy-merging implementation.

Use built-in filesystem copying with timestamp preservation and non-dereferencing symlink behavior, and argument-array Git calls with bounded waits, following the standalone scripts' 120000 ms Git convention. Use NUL-delimited Git records to avoid corrupting paths containing whitespace, quoting or newlines. Keep the shell, GitHub CLI and external copy tools out of the executable.

The new test file owns setup fixtures and setup-only command guards. Reuse existing test helpers unchanged. Test wrappers may record/delegate real Git commands and inject failures, but successful setup cases must create real repositories/worktrees and invoke the real `prepare-run.mjs` process.

### Assumptions and decisions taken unattended

| Decision | Evidence and rationale |
| --- | --- |
| Medium complexity; two implementation phases, no interview or nested research agents. | The user explicitly requires unattended decisions and prohibits delegation; two callers share six stateful setup paths. `lessons.md` also prohibits nested subagents. |
| Add `reason` and make failed `runRoot` null. | `change.md` requires runtime exit 0; `open-pr.mjs` already uses a reason-bearing JSON envelope. The caller needs an explicit failure discriminator to avoid continuing into the wrong directory. |
| Reject invalid/unreadable present policy before mutation when Git setup is applicable. | Current `state.mjs:62` rejects malformed/non-object project JSON. Copy the small isolation-block projection pattern from `open-pr`, not its permissive handling of unreadable overrides. Missing project override still means defaults. |
| Preserve any existing `agent-smith/` linked branch as case 2, fixed default setup naming and source-folder retention. | Both current Start step 3 sections explicitly specify these behaviors; this refactor does not change their policy. |
| Keep `left: []` without cleanup. | Requested result shape plus the explicit Wave 4/5 boundary in `WAVES.md` and `stale-main-change-copy/change.md`. |
| Put the added no-push/no-gh protection in the new test file. | The user's sibling ownership restriction outranks the older suggestion to extend `open-pr.test.mjs`; the protection still covers the new executable. |
| All acceptance criteria are automated. | Real local CLI fixtures can prove the requested cases; no UI or human-only deployment action is introduced. Existing live permission uncertainty is not made into a new blocking gate. |

## Critical Implementation Details

### State sequencing and failure safety

Finish policy/argument checks and nonmutating Git discovery before writes. A negative branch lookup or ignore match is distinct from a command error or timeout. Only case 4 may copy. Never retry a failed creation by attaching and copying onto an existing branch. On partial failure keep all created run resources and report the failure. Never delete, reset or automatically repair them.

Keep the ordered opt-out and in-flight-main no-setup returns read-only. Serialize the remaining setup for the selected run branch with an exclusive filesystem lock opened with `wx` in the absolute Git common directory. Key the lock by an encoded full branch name, shared across chains and project prefixes. For an already-running linked `agent-smith/` branch, use its actual branch name. For other cases, use the requested branch name. Acquire the lock before returning `in-run-worktree` or selecting creation/reuse/attachment, then refresh the branch/worktree reads under the lock. Hold it through exclude handling, worktree creation, the complete copy and usable-root validation. Git publishes a registered worktree before the copy finishes, so branch creation alone cannot serialize setup. A competing call returns runtime failure with `runRoot: null` and an actionable reason. Release only the lock acquired by this invocation in `finally`. An interrupted process may leave a lock, which requires inspection before manual removal. This lock contains no router or recovery state, and setup never steals an existing lock. Existing non-forced Git creation remains the guard against competing external Git operations.

### Paths, excludes and copying

The worktree path is under the project root, while the checkout contains the full repository: for root `/repo/apps/widget`, the default worktree is `/repo/apps/widget/.claude/worktrees/agent-smith-<id>` and `runRoot` appends `apps/widget`. Only fresh creation may add the local exclude `/<prefix>.claude/worktrees/`; preserve existing bytes/newline boundaries and literal gitignore escaping for special characters in the prefix. Never change `.gitignore`. Copy the change directory into its matching destination, merging its contents as before, not nesting another `<id>` level; preserve file mode, hidden files, regular-file times and symlink targets without following links outside the selected tree.

### Config and resume safety

New-branch creation must suppress automatic upstream tracking (Git supports `worktree add --no-track`) so a user's `branch.autoSetupMerge` cannot introduce a config write. Resume results preserve destination bytes and timestamps, including newer run state, and must not inspect or copy stale main-checkout contents as a repair strategy. A fresh copy failure may leave an incomplete new worktree: report it for inspection; subsequent setup must still never overwrite an existing branch's files.

## Phase 1: Implement and prove standalone setup

### Overview

Introduce the real executable and its black-box acceptance tests while keeping both existing skill callers operational until phase 2.

### Changes Required

#### 1. Setup executable

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent**: Give the duplicated setup one deterministic owner without moving router responsibilities or adding dependencies.

**Contract**: Implement the CLI/result schema, ordered six-case table, policy projection, bounded Git calls, shared exclusive setup lock, prefix-aware paths, local excludes, uncommitted-path reporting and fresh-only timestamp-preserving copy described above. Catch runtime failures into JSON; leave resources intact and return no usable `runRoot` on failure. Production imports are built-ins and existing standalone helpers only.

#### 2. Real-script acceptance suite

**File**: `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent**: Replace confidence in prose with reproducible evidence for every setup decision and unsafe edge.

**Contract**: Execute the real script for each row of the testing matrix below, parameterized over both chains where behavior varies. Compare policy outcomes against the real router loader in a separate process rooted at the fixture. Add command tracing/allowlisting and forbidden-command source checks here, leaving sibling files unchanged. Use existing fixture helpers and safe `removeTree` cleanup.

#### 3. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Make the new tests discoverable without enlarging AGENTS' test inventory.

**Contract**: Add one row describing both-chain setup, policy parity, copy/resume protection and command restrictions.

### Success Criteria

#### Automated Verification

- The real-script suite proves all six setup cases for both chains and the ordered precedence cases: `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- The same suite proves policy parity, prefix-aware paths, timestamp/copy fidelity, unchanged resumes, honest failure JSON and the no-config/no-destructive-command boundary.
- The mandatory repository suite passes after the new script is added: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 2: Wire skills and document the contract

### Overview

Make both skills use the verified executable and document its ownership without changing sibling-owned skill regions.

### Changes Required

#### 1. Both Start step 3 sections

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: Replace the duplicated conditional command recipe with one script call and explicit result handling.

**Contract**: Within Start step 3 only, resolve `PREPARE_RUN` absolutely from the loaded skill directory (10x: `scripts/prepare-run.mjs`; OpenSpec: `../10x-pipeline/scripts/prepare-run.mjs`), using the established host-specific directory convention. Run `cd "<root>" && node "$PREPARE_RUN" <id>` with `--chain openspec` for OpenSpec and Bash `timeout: 600000`. Validate the JSON result, stop on errors, retain `root`/`runRoot`, and print nonempty `notInRun` as “not in the run (uncommitted in the main checkout)”. Preserve later-call cwd instructions, result-file placement, no manual commit/stash/reset/clean rule, side-ref reporting, safe deletion rule, stale-copy warning and OpenSpec's isolation-off final message. Rephrase the final-message mention of the worktree-removal command in plain words so neither skill contains a `git worktree` command; do not drop the warning's meaning.

#### 2. Skill content assertions

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`

**Intent**: Keep the skills as thin, reliable consumers of setup results and prevent prose duplication returning.

**Contract**: Add setup-specific assertions for absolute shared paths, quoted invocation, OpenSpec chain argument, timeout, error stopping, root/result handling and retained safety instructions. Assert absence of the former worktree/copy/exclude commands. Leave dispatch, anti-stall and late-usage assertions alone.

#### 3. Setup documentation

**Files**: `AGENTS.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/README.md`

**Intent**: Record that setup is executable and tested, including its runtime failure signal and preservation guarantees.

**Contract**: Add the standalone command to AGENTS with the exception that it runs from the original project root; keep the size budget. Update only run-setup bullets in REFERENCE, replacing the external-copy reference and naming JSON/error behavior. Append Amendment 2 to ADR-010 and update its existing index row; leave historical decisions intact. Explicitly retain the stale-copy limitation until Wave 5. Search active docs for old setup instructions and change only references to this behavior; README's general worktree description already remains true and needs no edit.

### Success Criteria

#### Automated Verification

- Setup and both skill contracts pass together: `node --test skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- Both-chain prepare-then-init integration tests return `action: "run"` from the reported run root, and setup no-op cases retain the router's existing opt-out/in-flight behavior.
- The mandatory repository suite passes after integration: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- `git diff --check` passes and the scoped diff confirms only the owned setup regions/supporting files changed, with no WAVES, sibling implementation or run-state edits by this change.

## Testing Strategy

### Real-script acceptance matrix

Every behavior below belongs in `prepare-run.test.mjs`; mocks alone do not prove a setup case. Parameterize the six normal cases over `10x` and `openspec`, and run nested-root coverage for fresh creation, reuse, attach and already-in-run cases. Use committed OpenSpec config and scratch change content without needing the external OpenSpec CLI.

| Coverage | Required evidence |
| --- | --- |
| Opt-out | Non-Git directory, unavailable Git, explicit false, nonboolean require and malformed isolation block create no resources; explicit opt-out wins even inside a run worktree. |
| Policy parity | Missing override/block/require, empty object, true, false, null, strings, numbers and arrays agree with the real loader's effective isolation. Malformed JSON, unreadable present file and non-object top level fail without writes. Include changed defaults/fragment in a scratch plugin copy, never edits to shipped policies. |
| Already in run | Same-id and other-id linked `agent-smith/` branches return current root; no nested worktree, exclude or copy. An unrelated linked branch and detached HEAD do not match this case. |
| In-flight main | Metadata plus absent branch leaves bytes/mtimes/refs unchanged; metadata plus existing branch reaches reuse/attach instead. Test chain-specific metadata, without inferring ownership from the other chain. |
| Fresh creation | Branch starts at invoking HEAD, default worktree is under project root, change contents are copied once, unrelated tracked edits/untracked files remain only in source, source index/HEAD and source contents are unchanged. |
| Excludes and reporting | Missing ignore adds one anchored line; existing ignore adds none; preexisting exclude text without a final newline stays intact; repeated invocation does not append. Report staged/unstaged/untracked and renamed paths outside the selected change folder without prefix or quoting mistakes. |
| Copy fidelity | Exercise untracked and already-committed change folders, modified files, nested/hidden files, executable mode and symlinks. Set known whole-second atime/mtime values before copying; inspect timestamps before reading bytes so verification does not change atime. Compare plan/review mtime ordering, not “now”. |
| Reuse | Registered worktree may be at a different path and hold newer modified run files; stale source changes never overwrite it. Already-checked-out main branch registration follows the existing selection rule. |
| Attach | Existing branch without a checkout is attached with its committed content, while stale source content is not copied; no exclude append is added in this case. |
| Prefix and unusual paths | Project below repository root, nested prefix, spaces/non-ASCII and gitignore-special characters; correct worktree/root/exclude paths, raw Git path handling and no duplicated prefix. A fresh clone with an untracked project directory still receives the copied change folder at its prefix. |
| Usage/runtime failures | Bad argv exits 2 before commands. Occupied target, failed exclude write, Git read/add failure, timeout, missing fresh source, copy failure and inaccessible registered worktree produce one runtime JSON result with null runRoot and a reason; no fallback destructive operation. A repeat after partial creation copies nothing. |
| Concurrent setup | Pause the first real invocation after successful worktree registration and before copying, then launch a second invocation from both the source and the new worktree. The second returns runtime failure with null runRoot while the first holds the shared lock. After release, the first finishes copying and a later invocation reuses the complete files unchanged. Prove lock release on success and handled failure, and that an existing lock is preserved with an actionable diagnostic. |
| Command boundary | A logging Git wrapper delegates real operations and rejects anything outside the expected read commands and non-forced `worktree add`. Assert no push/gh, config write, commit, reset, cleanup, ref deletion, force or verification bypass; byte-compare config, including a fixture with automatic tracking enabled. |
| Caller integration | From each successful created run root, run real router `init` with a meaningful goal and deterministic score override, asserting `action: "run"`, selected root and isolated metadata; a halt alone is not success. Check reuse leaves newer run state unchanged. |

For deterministic failure tests, use a fixture Git wrapper that fails the selected operation and delegates the rest. For the real Git-timeout regression, let one wrapper process block beyond the script's 120000 ms Git deadline and call the existing `run` helper with `{ script: PREPARE_RUN, env, timeout: 150000 }`. Its default 120000 ms outer deadline would kill setup before it could print failure JSON. Bound the wrapper itself and await its termination before cleanup. Keep ordinary tests on their existing timeout. The concurrency and timeout proofs belong to the Phase 1 acceptance suite and its existing Progress row 1.2.

Filesystem failure fixtures must work when tests run privileged, rather than depending only on chmod. Keep Git environment and temporary directories scoped to fixtures, using the shared helper interface without editing it. During an agent run restricted to this worktree, put the fixture temp root inside the worktree and run the test process with that `TMPDIR`; clean via `removeTree`.

The setup test may import router readers **in test code only**, preferably through a child rooted at the scratch project, to prove parity and read results. Never hand-edit this run's metadata/log or mutate the actual repository to arrange a test. Use no new dependencies and no real network/GitHub operations.

### Verification sequence

Before structural edits, capture the six-case table from both current skill sections and run the existing relevant baseline: `node --test skills/10x-pipeline/test/isolation.test.mjs skills/openspec-pipeline/test/openspec-isolation.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`. After each phase use its focused proof and the repository-required full suite. Report known optional skips accurately; do not claim unrun setup cases passed. No manual-only acceptance row is needed for this refactor.

## Performance Considerations

Setup runs once before initialization and copies only the selected change directory on branch creation. Resume paths perform Git reads and no directory copy. Preserve bounded Git subprocess waits; no caching, background processes or new configuration is warranted.

## Migration Notes

Existing branch/worktree names, project layout and router state formats do not change. Existing worktrees are reused and unattached branches are attached without copying. There is no cleanup migration. Reverting the script and both caller edits together restores the previous setup instructions; never delete worktrees or run branches as rollback. Partial setup failures retain resources for inspection and safe manual recovery.

## References

- Scope and output shape: `context/changes/worktree-setup-script/change.md`.
- Ownership and deferred cleanup: `context/changes/WAVES.md`, `context/changes/stale-main-change-copy/change.md`.
- Sibling test ownership: `context/changes/tests-strip-git-env/change.md`.
- Current callers: `skills/10x-pipeline/SKILL.md:40`, `skills/openspec-pipeline/SKILL.md:42`.
- Policy parity: `skills/10x-pipeline/scripts/state.mjs:39`, `skills/10x-pipeline/scripts/isolation.mjs:261`.
- Standalone conventions: `skills/10x-pipeline/scripts/open-pr.mjs`, `skills/10x-pipeline/scripts/pr-common.mjs`.
- Real-worktree fixtures and safety precedent: `skills/10x-pipeline/test/isolation.test.mjs`, `skills/10x-pipeline/test/helpers.mjs`, `skills/10x-pipeline/test/open-pr.test.mjs:675`.
- Existing contract: `docs/REFERENCE.md:61`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`.
- Applied lessons: `context/foundation/lessons.md` (no nested agents; search docs when output changes).

## Progress

### Phase 1: Implement and prove standalone setup

#### Automated

- [ ] 1.1 The real-script suite proves all six setup cases for both chains and the ordered precedence cases: `node --test skills/10x-pipeline/test/prepare-run.test.mjs`.
- [ ] 1.2 The same suite proves policy parity, prefix-aware paths, timestamp/copy fidelity, unchanged resumes, honest failure JSON and the no-config/no-destructive-command boundary.
- [ ] 1.3 The mandatory repository suite passes after the new script is added: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Phase 2: Wire skills and document the contract

#### Automated

- [ ] 2.1 Setup and both skill contracts pass together: `node --test skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- [ ] 2.2 Both-chain prepare-then-init integration tests return `action: "run"` from the reported run root, and setup no-op cases retain the router's existing opt-out/in-flight behavior.
- [ ] 2.3 The mandatory repository suite passes after integration: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- [ ] 2.4 `git diff --check` passes and the scoped diff confirms only the owned setup regions/supporting files changed, with no WAVES, sibling implementation or run-state edits by this change.
