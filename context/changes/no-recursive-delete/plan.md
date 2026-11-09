# No recursive force delete Implementation Plan

## Overview

Ban `rm -rf` and every other recursive or forced directory delete from everything an agent follows or runs in this repository: prompts, both `SKILL.md` files, router-side scripts, tests and docs. The replacement procedure is fixed: list the files, check the list, delete the files one by one, then `rmdir` the empty directories, deepest first. Reason: reasonable people block `rm -rf` in their harness, and a pipeline run that hits the block stalls. Code and tests get one shared helper, `removeTree`, that implements the procedure in Node. A guard test keeps the banned forms out. The decision is recorded as ADR-016.

## Current State Analysis

Prose first. A grep of `skills/`, `agents/`, `docs/`, `README.md` and `AGENTS.md` finds no `rm -rf`, `rm -r` or `rimraf`. The prose gap is the missing rule, not a present violation:

- `skills/10x-pipeline/prompts/manual-verify.md:9` tells the subagent to make a scratch directory with `mktemp -d`, so the one prompt that creates directories says nothing about removing them. A subagent that cleans up reaches for `rm -rf`.
- `skills/10x-pipeline/policy.json:209` (`prompts.suffix`) is appended to every prompt the router returns and holds the generic unattended rules. It has no delete rule.
- `skills/10x-pipeline/SKILL.md:42` and `skills/openspec-pipeline/SKILL.md:49` tell the user to "remove or stash the main-checkout copy" of the change folder, with no method.
- `AGENTS.md` "Hard Rules" forbids irreversible git and GitHub operations (including `git clean`), but not recursive file deletes.

Code and tests. `fs.rmSync(..., { recursive: true, ... })` appears in:

- `skills/10x-pipeline/scripts/pr-comment.mjs:210` (cleanup of a `mkdtemp` directory that holds one body file).
- `skills/10x-pipeline/test/helpers.mjs:11` (`cleanupAll`) and `openspec-helpers.mjs:40`.
- The test files `archive`, `compare`, `manualverify`, `provenance`, `agents`, `openspec-steps`, `openspec-archive`, `openspec-readers` and `pr-comment` (`*.test.mjs`), and `tools/test/commit-lint.test.mjs:46` and `tools/test/version-check.test.mjs:28`. About 30 call sites in total.
- Single-file calls (`fs.rmSync(file)`, `fs.rmSync(file, { force: true })`) are not recursive and stay. `fs.mkdirSync(..., { recursive: true })` is not a delete and stays.

The router modules (`route.mjs` and the modules under `scripts/`) delete nothing recursively; `flow.mjs:356` removes one file.

### Key Discoveries:

- `prompts.suffix` is the one place that reaches every prompt, including the `os-` templates and the `archive` prompt; `skills/10x-pipeline/test/advisor.test.mjs:48` asserts that every prompt ends with it.
- `rules.test.mjs` ("policy.json prompts follow the rule form", "prompts/*.md follow the rule form") checks every `**GIVEN**` line for exactly one bold RFC 2119 keyword and rejects a bold keyword outside a rule. A new rule must be two single-keyword lines, one for the ban and one for the procedure.
- `helpers.mjs` "stays as it was" except for `writeOverride` (AGENTS.md). Changing the one `cleanupAll` line is a deliberate, narrow exception that this plan adds to AGENTS.md.
- Tests that copy the plugin tree (`provenance.test.mjs:64`, `agents.test.mjs:303`) copy `skills/10x-pipeline` without `test/`, so a new `scripts/remove-tree.mjs` travels with the copy and `pr-comment.mjs` can import it.
- `context/archive/` is read-only and `context/changes/` holds run state; neither is scanned by the guard.

## Desired End State

- No prompt, skill, doc, script or test in the repository uses a recursive or forced directory delete, and every place an agent is told to delete a directory names the list, check, delete one by one, `rmdir` procedure.
- `skills/10x-pipeline/scripts/remove-tree.mjs` exports `removeTree(dir)`; `pr-comment.mjs`, `helpers.mjs` and every test use it.
- `prompts.suffix`, `manual-verify.md` and both `SKILL.md` files carry the rule, in the rule form.
- `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` fails when a banned form returns or a rule disappears.
- `AGENTS.md`, `docs/REFERENCE.md` and `docs/ADR/ADR-016-no-recursive-force-delete.md` state the rule. The whole suite passes.

Verify: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` is green, and `grep -rnE "rm +-[a-zA-Z]*[rR]|recursive: *true" skills tools agents docs` returns only `mkdirSync`/`cpSync` lines, the guard test and the lines that state the ban.

## What We're NOT Doing

- Not editing `context/archive/` (read-only) or `context/changes/*` run state, and not scanning them.
- Not changing router behavior: no policy key, no new routing, no change to the git-write rule of ADR-010. `git worktree remove` stays as documented (it refuses a dirty worktree and is not a recursive file delete).
- Not banning `fs.mkdirSync(..., { recursive: true })` or `fs.cpSync(..., { recursive: true })`; they create, they do not delete.
- Not banning single-file `fs.rmSync(file)` or `fs.rmSync(file, { force: true })`; `force` without `recursive` removes one path.
- Not adding an npm dependency (Node built-ins only, Node 24).
- Not enforcing the ban in the harness or with a hook: the router cannot read what a subagent runs, so the prompt rule and the guard test are the whole enforcement. Said plainly in ADR-016.
- Not touching the `git clean` and `git reset --hard` rules: AGENTS.md already covers them.

## Implementation Approach

Four phases. First the helper, because the code and test changes depend on it. Then replace every recursive delete in code and tests with it. Then add the rule to the text agents follow. Then add the guard test and the documents, so the guard sees the final state.

Assumptions (no human was available; each is evidence-backed):

- `fs.rmSync` with `recursive: true` in test cleanup counts as a recursive force delete. Evidence: the goal names "tests" and "router code" explicitly, and the score step listed this as its open unknown. Reading it narrowly would leave about 30 call sites and make the ban untestable.
- The banned forms are `rm` with a recursive flag (`-r`, `-R`, `-rf`, `-fr`, `--recursive`), `rimraf`, `shutil.rmtree`, `find ... -delete`, and `fs.rm`, `fs.rmSync`, `fs.rmdir`, `fs.rmdirSync`, `fsp.rm`, `fsp.rmdir` called with `recursive: true`. `find -delete` is included because it deletes a tree without a list to check; the goal's procedure forbids exactly that.
- The rule goes in `prompts.suffix` (all steps, isolated or not) rather than in `worktree.md` (isolated runs only). Evidence: `worktree.md` is prepended only when `meta.isolated` is `true`, and a non-isolated run can hit the same harness block.
- A new ADR is needed: the rule adds a repository-wide hard rule and a shared helper in `scripts/`, and the user reserved ADR-016. The `docs/ADR/` folder of this branch ends at ADR-013; ADR-014 and ADR-015 exist on other branches, so the file name is `ADR-016-no-recursive-force-delete.md` and its text does not refer to them.
- The helper does not follow symlinks (it unlinks the link itself), ignores a path that does not exist, and refuses an empty path, the filesystem root and the home directory. It is the Node form of the procedure, not a way around it: it lists, then unlinks file by file, then `rmdir`s deepest first.
- Guard scope: `skills/`, `agents/`, `docs/`, `tools/`, `README.md` and `AGENTS.md`. `context/` and `openspec/` hold run state and archives, and `.claude/worktrees/` holds other checkouts.

## Phase 1: The removeTree helper

### Overview

Add the shared helper and its own tests.

### Changes Required:

#### 1. The helper

**File**: `skills/10x-pipeline/scripts/remove-tree.mjs`

**Intent**: Delete a directory tree the way the rule says: list every entry, check that the list lies inside the target, unlink the files one by one, then `rmdir` the directories from the deepest up. Plain node, built-ins only, standalone like `pr-comment.mjs` (no router module imports it).

**Contract**: `export function removeTree(target)` returns `{ files, dirs }` (counts). A missing path returns zeros. A file or symlink is unlinked. A directory is walked with `lstat` and `readdirSync`, never following a symlink. Every collected path must start with the resolved target plus `path.sep`, or the call throws before it deletes anything. It throws on an empty path, `path.parse(p).root`, `os.homedir()`, `process.cwd()` and any ancestor of the home directory or the current working directory. The prefix check above only asserts what the walk already guarantees; these refusals are the real safety net. No `recursive` option and no `force` option appears in the file, and its comments do not use the words `recursive` or `force` either, so the greps of 1.2 and 2.1 stay clean.

#### 2. Tests of the helper

**File**: `skills/10x-pipeline/test/no-recursive-delete.test.mjs` (new; the guard of Phase 4 goes in the same file)

**Intent**: Prove the helper on a nested tree, a tree with a symlink to a directory outside it (the outside target survives), a missing path, a plain file, a read-only file, and the refusal cases.

**Contract**: `node:test` with scratch directories under `os.tmpdir()`. Cleanup of the test's own scratch uses `removeTree` after its own check.

### Success Criteria:

#### Automated Verification:

- Helper tests pass: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`
- The helper holds no recursive or forced option: `grep -nE "recursive|force" skills/10x-pipeline/scripts/remove-tree.mjs` prints only comment lines or nothing

#### Manual Verification:

- Read `remove-tree.mjs` once and confirm the order is list, check, unlink files, rmdir deepest first

---

## Phase 2: Replace every recursive delete in code and tests

### Overview

Swap each recursive `rm`/`rmdir` call for `removeTree`, without changing what a test checks.

### Changes Required:

#### 1. Router-side script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: Replace the `fs.rmSync(dir, { recursive: true, force: true })` in the `finally` of `post` with `removeTree(dir)`.

**Contract**: Add `import { removeTree } from "./remove-tree.mjs";`. The script still prints exactly one JSON object and writes nothing under the project root. A failure inside the helper must not change the printed result: wrap the call so a cleanup error is ignored, as `force` did.

#### 2. Test helpers and tests

**Files**: `skills/10x-pipeline/test/helpers.mjs`, `openspec-helpers.mjs`, `archive.test.mjs`, `compare.test.mjs`, `manualverify.test.mjs`, `provenance.test.mjs`, `agents.test.mjs`, `openspec-steps.test.mjs`, `openspec-archive.test.mjs`, `openspec-readers.test.mjs`, `pr-comment.test.mjs`, `tools/test/commit-lint.test.mjs`, `tools/test/version-check.test.mjs`

**Intent**: Each `fs.rmSync(x, { recursive: true[, force: true] })` becomes `removeTree(x)`. Single-file `fs.rmSync(file)` calls stay.

**Contract**: Import from the helper by relative path (`../scripts/remove-tree.mjs` in the skill tests, `../../skills/10x-pipeline/scripts/remove-tree.mjs` in `tools/test`). `helpers.mjs` re-exports nothing new. `pr-comment.test.mjs:612` (the mutation test) writes a copy of `pr-comment.mjs` alone into a scratch directory and runs it; with the new relative import that copy fails to load, so the test must also copy `scripts/remove-tree.mjs` into the same directory (`fs.copyFileSync`) before the mutant runs. Where a call relied on `force` for a path that may not exist, `removeTree` already no-ops on a missing path. `archive.test.mjs:420` removes a `.git` directory: the helper must handle read-only git object files. `openspec-readers.test.mjs:69` removes a directory without `force`; it keeps meaning because the directory exists.

### Success Criteria:

#### Automated Verification:

- No recursive delete is left in code: `grep -rn "recursive" skills tools --include=*.mjs` lists only `mkdirSync` and `cpSync` lines and the guard test
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `pr-comment` tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`

#### Manual Verification:

- Run the suite once and confirm `os.tmpdir()` holds no leftover `as-*` directory from it (cleanup still works)

---

## Phase 3: Put the rule in the text agents follow

### Overview

State the ban and the procedure where subagents and the orchestrator read them.

### Changes Required:

#### 1. The generic suffix

**File**: `skills/10x-pipeline/policy.json` (`prompts.suffix`)

**Intent**: Add two rule lines before the `RESULT` instructions: the ban, then the procedure.

**Contract**: Line 1: **GIVEN** you delete a directory and its contents **WHEN** you pick the command **THEN** you **MUST NOT** use `rm -rf`, `rm -r`, `rm -R`, `rm --recursive`, `rimraf`, `find ... -delete`, or `fs.rm`/`fs.rmSync` with `recursive: true`, because the harness may block them. Line 2: **GIVEN** you must remove a directory **WHEN** you delete it **THEN** you **MUST** list its files, check the list holds only what you meant to remove, delete the files one by one, and then `rmdir` the empty directories deepest first. Each line has exactly one bold keyword (`rules.test.mjs`). Every prompt ends with the suffix, so the `os-` templates and the `archive` prompt get the rule without an edit.

#### 2. The manual-verify prompt

**File**: `skills/10x-pipeline/prompts/manual-verify.md`

**Intent**: The scratch directory made with `mktemp -d` is the one place that prompt creates a tree. Add one rule on how to remove it.

**Contract**: One rule line after the scratch-directory rule: **GIVEN** you made a scratch directory with `mktemp -d` **WHEN** you remove it before the step ends **THEN** you **MUST** list its files, delete them one by one and `rmdir` the empty directories deepest first. Leave the existing safety rules as they are.

#### 3. The two orchestrator skills

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: Where the final message tells the user to remove the stale main-checkout copy, name the method. Add one bullet in the run-isolation list that forbids a recursive or forced delete by the orchestrator and points to the procedure.

**Contract**: Edit the "remove or stash the main-checkout copy" sentence in both files, and add one bullet next to "Never commit, stash, reset or clean the run worktree yourself". Do not touch `## Anti-stall rules` (its text must stay equal in both skills) and name no model, effort or tier word (`skill-loop.test.mjs`, `openspec-skill.test.mjs`). The bullet is prose, not a `**GIVEN**` rule, so it carries no bold keyword.

#### 4. The prompts README

**File**: `skills/10x-pipeline/prompts/README.md`

**Intent**: One sentence in the intro: the shared suffix and `manual-verify.md` carry the deletion rule (ADR-016).

**Contract**: Prose only.

### Success Criteria:

#### Automated Verification:

- Rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Both skills still match their content tests: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`
- Advisor suffix test passes: `node --test skills/10x-pipeline/test/advisor.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the two suffix lines and the `manual-verify.md` line once and confirm a subagent can follow them without asking
- Run `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` and `status demo` in a scratch change folder and confirm the output is valid JSON and a returned prompt ends with the new rules before the `RESULT` instructions

---

## Phase 4: Guard test and documents

### Overview

Lock the ban with a test and record the rule and the decision.

### Changes Required:

#### 1. The guard test

**File**: `skills/10x-pipeline/test/no-recursive-delete.test.mjs`

**Intent**: Fail when a banned form appears in scanned files, and when a place that must carry the rule loses it.

**Contract**: Walk `skills/`, `agents/`, `docs/`, `tools/`, `README.md` and `AGENTS.md`, skipping `node_modules`. Code files (`.mjs`): match `rm`/`rmSync`/`rmdir`/`rmdirSync` calls (also `fs.promises` forms) whose argument text, read to the balanced closing parenthesis and possibly across lines, matches `recursive\s*:\s*true`, plus `rimraf` and `shutil.rmtree`. Reading to the first `)` is not enough: most call sites here start with `path.join(...)`, which would end the argument text before the options object. Prose and data files (`.md`, `.json`): match `rm` with a recursive flag, `rimraf`, `find ... -delete`; a matching line is allowed only when it also holds a prohibition word (`MUST NOT`, `never`, `Never`, `not use`, `Do not`, `ban`, `forbid`) so the rule can name what it bans (`block` and `blocked` join the list, for the reason line of the ADR). This test file and `docs/ADR/ADR-016-no-recursive-force-delete.md` are skipped by name: the test holds the ban's patterns and the ADR quotes the forms in its Context, Alternatives and Assumptions, so the ADR's content is covered by the presence check and by `rules.test.mjs` instead. Presence checks: `prompts.suffix` has both rule lines, `manual-verify.md` has its rule line, both `SKILL.md` files name `rmdir`, `AGENTS.md` and `docs/ADR/ADR-016-no-recursive-force-delete.md` exist and mention the helper. A deliberate-break check, as in `skill-loop.test.mjs`: feed the scanner a sample string with `rm -rf x` and one with `fs.rmSync(d, { recursive: true })` and expect a hit for each, plus samples with a nested first argument (`fs.rmSync(path.join(a, "b"), { recursive:true, force: true })`) and with the options on a following line, which must also hit, and a sample with `fs.mkdirSync(d, { recursive: true })` that must not. The scanner does not see options passed through a variable; ADR-016 lists that under "Not covered".

#### 2. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Add the hard rule and list the new files.

**Contract**: In "Hard Rules", one bullet: never delete a directory tree with a recursive or forced command (`rm -rf`, `rm -r`, `rimraf`, `find -delete`, `fs.rm`/`fs.rmSync`/`fs.rmdir` with `recursive: true`) in code, tests, skills, prompts or docs; list, check, delete one by one, then `rmdir` deepest first; code and tests use `removeTree` from `skills/10x-pipeline/scripts/remove-tree.mjs` (ADR-016). In "Project Structure": the helper, the guard test, and the note that `helpers.mjs` changes beyond `writeOverride` only in its cleanup line. In the ADR line: ADR-016.

#### 3. REFERENCE.md

**File**: `docs/REFERENCE.md`

**Intent**: Document the rule for users and agents.

**Contract**: A short "File deletion" list under "Limits": the ban, the procedure, where the rule lives (suffix, `manual-verify.md`, both skills), the helper, the guard test, and that it is a prompt rule only (the router cannot see what a subagent runs). In the "Run isolation" bullets that say "Remove or stash the main-checkout copy", add "(file by file, see File deletion)". The "Baseline comparison" `git worktree remove` line stays.

#### 4. ADR-016

**File**: `docs/ADR/ADR-016-no-recursive-force-delete.md`

**Intent**: Record why, the scenarios, what is enforced and what is not.

**Contract**: Same shape as ADR-012: Status (Proposed, unattended reading, owner confirmation pending), Date (2026-11-09), Deciders, Origin (change `no-recursive-delete`), Context, Decision (scenario rules in the ADR-004 form; ADR rule lines are checked by `rules.test.mjs`, so each has one bold keyword), Consequences, Alternatives (exempt tests; harness hook; leave it as a convention), Assumptions A1 to A5 (the ones in "Implementation Approach"), and "Not covered" (the router cannot see subagent commands; shell scripts outside the repo; options passed to a delete call through a variable; files outside the guard's scope and extensions, such as `.github/`).

### Success Criteria:

#### Automated Verification:

- Guard test passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`
- ADR rule lines follow the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields still agree: `node tools/version-check.mjs`
- Deliberate break: add `fs.rmSync(x, { recursive: true })` to a scratch copy of a scanned file and the guard reports it (covered by the sample strings in the guard test)

#### Manual Verification:

- Read ADR-016 once and confirm the assumptions are marked for the owner and no claim is stronger than the evidence
- Confirm `AGENTS.md` and `REFERENCE.md` say the same thing about the ban and the helper

---

## Testing Strategy

### Unit Tests:

- `removeTree`: nested tree, symlink to an outside directory (outside survives), missing path, plain file, read-only file, refusal of empty path, root and home.
- Guard scanner: one banned sample per form, one allowed sample per allowed form.

### Integration Tests:

- The existing suite, now cleaning up through `removeTree`, proves the helper on real scratch projects with git repositories and linked worktrees.

### Manual Testing Steps:

1. Run the whole suite and check `os.tmpdir()` for leftovers.
2. Run `init` and `status` in a scratch change folder and read the tail of one returned prompt.

## Performance Considerations

`removeTree` walks and unlinks entry by entry. The scratch trees are small (a few hundred git objects at most), so suite time should not move noticeably; compare the suite time before and after in Phase 2.

## Migration Notes

None for users. A run in flight at upgrade time records `provenance.drift` for `prompts` at its next `next` call (the suffix changes); routing is unaffected. Add this note to the "Upgrade note" style list in `docs/REFERENCE.md` under "File deletion".

## References

- Change identity and owner request: `context/changes/no-recursive-delete/change.md`
- Score: `context/changes/no-recursive-delete/complexity.json`
- Rule form: `skills/10x-pipeline/test/rules.test.mjs:12`, ADR-004
- Suffix: `skills/10x-pipeline/policy.json:209`; suffix assertion `skills/10x-pipeline/test/advisor.test.mjs:48`
- Existing recursive delete in a script: `skills/10x-pipeline/scripts/pr-comment.mjs:210`
- ADR style: `docs/ADR/ADR-012-automate-manual-checks.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The removeTree helper

#### Automated

- [x] 1.1 Helper tests pass: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — d85b6ff
- [x] 1.2 The helper holds no recursive or forced option: `grep -nE "recursive|force" skills/10x-pipeline/scripts/remove-tree.mjs` prints only comment lines or nothing — d85b6ff

#### Manual

- [x] 1.3 Read `remove-tree.mjs` once and confirm the order is list, check, unlink files, rmdir deepest first — evidence: evidence/judgment-remove-tree-order.txt

### Phase 2: Replace every recursive delete in code and tests

#### Automated

- [x] 2.1 No recursive delete is left in code: `grep -rn "recursive" skills tools --include=*.mjs` lists only `mkdirSync` and `cpSync` lines and the guard test — 686e3b8
- [x] 2.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 686e3b8
- [x] 2.3 `pr-comment` tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs` — 686e3b8

#### Manual

- [x] 2.4 Run the suite once and confirm `os.tmpdir()` holds no leftover `as-*` directory from it (cleanup still works) — evidence: evidence/command-suite-fresh-tmpdir.txt

### Phase 3: Put the rule in the text agents follow

#### Automated

- [x] 3.1 Rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs` — 31f81b9
- [x] 3.2 Both skills still match their content tests: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` — 31f81b9
- [x] 3.3 Advisor suffix test passes: `node --test skills/10x-pipeline/test/advisor.test.mjs` — 31f81b9
- [x] 3.4 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 31f81b9

#### Manual

- [x] 3.5 Read the two suffix lines and the `manual-verify.md` line once and confirm a subagent can follow them without asking — evidence: evidence/judgment-suffix-and-manual-verify-lines.txt
- [x] 3.6 Run `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` and `status demo` in a scratch change folder and confirm the output is valid JSON and a returned prompt ends with the new rules before the `RESULT` instructions — evidence: evidence/command-init-status-scratch.txt

### Phase 4: Guard test and documents

#### Automated

- [x] 4.1 Guard test passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — 9634b03
- [x] 4.2 ADR rule lines follow the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs` — 9634b03
- [x] 4.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 9634b03
- [x] 4.4 Version fields still agree: `node tools/version-check.mjs` — 9634b03
- [x] 4.5 Deliberate break: add `fs.rmSync(x, { recursive: true })` to a scratch copy of a scanned file and the guard reports it (covered by the sample strings in the guard test) — 9634b03

#### Manual

- [x] 4.6 Read ADR-016 once and confirm the assumptions are marked for the owner and no claim is stronger than the evidence — evidence: evidence/judgment-adr016-assumptions.txt
- [x] 4.7 Confirm `AGENTS.md` and `REFERENCE.md` say the same thing about the ban and the helper — evidence: evidence/judgment-agents-reference-agree.txt
