# Late Step Usage Figure Implementation Plan

## Overview

GitHub issue #71: a step's usage figure often reaches the orchestrator in the task notification after it already wrote `last-result.json` without `usage` and ran `next`. Anti-stall rule 3 then drops the figure, so `report.md` shows `-` and `compare` reports `usage-incomplete`. This plan adds a router command, `route.mjs usage <change-id> <n> --tokens N --tool-uses N --duration-ms N`, that attaches a late figure to executed step `<n>` on both chains, and changes rule 3 in both orchestrator skills to call it. The command does not depend on message order, so the figure is kept whenever it arrives before the run's cut-off point.

## Current State Analysis

- Usage is stored only by `attachResult` (`skills/10x-pipeline/scripts/flow.mjs:446-518`): `cleanUsage(result.usage)` (`flow.mjs:364-372`) keeps the non-negative safe integers of `totalTokens`, `toolUses` and `durationMs` and sets `last.usage`. Once the entry has a `result`, nothing can add a figure.
- Both chains share `attachResult`, `writeReport` (`flow.mjs:267-271`), `status` (`route.mjs:616-675`) and `compare` (`route.mjs:374-453`). All three read `e.usage` only, so a figure written onto the entry later is shown like any other with no reader change.
- Anti-stall rules 2 and 3 (`skills/10x-pipeline/SKILL.md:83-84`, the same lines in `skills/openspec-pipeline/SKILL.md:91-92`) write the result file without `usage` and forbid using a later figure. `docs/REFERENCE.md:330` documents the loss.
- Isolated runs (ADR-010): `stepCommit` (`isolation.mjs:385-404`) writes the in-memory log and runs `git add -A` after a successful step. `rollback` (`isolation.mjs:448-490`) snapshots, runs `git reset --hard <startSha>`, then `writeState` writes the in-memory log back (`isolation.mjs:424-428`). `undoRollback` (`route.mjs:46-59`) does the same after its reset. `next` reads `run.jsonl` from disk at its start (`route.mjs:69`), so a figure written to disk before `next` runs is in the log that `writeState` restores.
- `--archive` runs: `archiveDone` (`isolation.mjs:501-650`) writes the final report through `finishRun`, commits the change folder as `archive.commitMessage`, checks the commit and returns the `archive` action. In an isolated run a resume treats the folder as committed only when the HEAD subject is the pre-archive message (`isolation.mjs:514-518`). Otherwise it writes the report again, finds nothing to stage and returns the action with `commit: null`.
- `routerCommit` (`isolation.mjs:322-357`) already holds the folder-only commit with its post-commit checks (index empty, only `<rel>/` paths, folder clean) and unstages its own add on failure. `gitSafety` (`isolation.mjs:212-235`) and `runBranchReason` (`isolation.mjs:295-308`) are the existing prechecks. All three are module-private.
- `guardArchived` (`state.mjs:290-304`) halts and writes nothing for a moved change or a 10x change stamped `status: archived`.
- `meta.outcome` exists only for an ended run: `next` and `neutralRetry` delete it before a new step (`route.mjs:158-161`, `flow.mjs:343-346`).
- `main` (`route.mjs:719-830`) dispatches the commands. `parseFlags` (`state.mjs:14-23`) skips positional arguments, so `<n>` is `rest[0]`.
- Tests: `skill-loop.test.mjs` pins rule 3 with the needles `["**MUST NOT**", "rewrite", "result file"]` (line 39). `openspec-skill.test.mjs:101-107` requires the anti-stall section to equal the 10x one, and `:88-97` requires `--chain openspec` on every `node $ROUTER` line. `rules.test.mjs` allows exactly one bold RFC 2119 keyword per rule line. Isolated runs are tested with real linked worktrees and hermetic git (`rollback.test.mjs:27-80`), the OpenSpec chain with `openspec-helpers.mjs`.

## Desired End State

- `route.mjs usage <id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]` writes the cleaned figure onto executed entry `<n>`, marks it `usageLate: true` and prints `{ action: "usage", attached: true, n, step, usage, unchanged, report, commit }`. A refusal prints `{ action: "usage", attached: false, n, reason }`, exits 1 and writes nothing.
- A figure attached while a later step runs survives that step's rollback and reaches the run branch with the next step commit, or with the leftover commit of `open-pr.mjs` at the end of the run.
- On an ended run the command rewrites `report.md`, so the Tokens column, the totals line and `Cost (est.)` include the figure. On an `--archive` run whose `archive` action was returned, it also commits the change folder as `archive.usageMessage`, so the folder is clean when the archive subagent starts and the archived `report.md` has the figure.
- Both skills' rule 3 calls the command once per late figure, before the pull request step or the archive subagent, and drops a figure that arrives after that point. The `## Anti-stall rules` sections stay equal.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, including the new `late-usage.test.mjs`.

### Key Discoveries:

- Rollback survival needs no new rollback code. `rollback` and `undoRollback` write back the log `next` read from disk (`isolation.mjs:486-487`, `route.mjs:56`). The only requirement is that `usage` and `next` never run at the same time. The skill rule handles that.
- No commit is needed while a step runs. The next `stepCommit` (`git add -A`) or the `open-pr.mjs` leftover commit carries `run.jsonl` and `report.md` to the branch. Committing during a step would race a subagent that uses git.
- Only the archive state needs a commit of its own. `/10x-archive` refuses an uncommitted change folder, and `archiveDone` returns the action after the folder was committed.
- `routerCommit` with `rel` is exactly the folder-only commit the archive state needs. It only needs a thin export.

## What We're NOT Doing

- No change to `attachResult`, `cleanUsage` semantics, `status`, `buildReport` or `compare`. They already read `e.usage`.
- No overwrite or merge of an existing figure, not even to add a missing key. Equal is a no-op, anything else is refused.
- No figure for a pending step (it belongs in its result file), for a skip entry, or for the `archive` step (no log entry).
- No lock file between router calls. The skill rule keeps `usage` out of any parallel batch with another router call.
- No re-run of the pull request or PR comment step for a late figure. A figure that arrives after the pull request step ran is dropped.
- No suggestion 1 of the issue (waiting for the notification before `next`). It only lowers the odds.
- No change to `rollback`, `stepCommit`, `archiveDone` or `open-pr.mjs` behavior.

## Implementation Approach

1. A new `usageCommand` in `route.mjs` handles both chains through the existing chain resolution. It validates the arguments, loads the log, checks the guards, writes the entry and, for an ended run, rewrites `report.md`. It makes no git call except in the archive state.
2. The archive state (`meta.outcome.action === "done"` and `meta.archive === true`) adds a precheck before anything is written: git safety, the run branch when `meta.isolated`, and a clean change folder. After the write it commits the folder through an exported wrapper of `routerCommit`. A failure before the commit exists restores the bytes the command replaced, so the folder stays committed and clean.
3. Both skills change rule 3, the `done`, `halt` and `archive` branches and the Rules list, with `--chain openspec` on every OpenSpec router line.
4. The docs (`REFERENCE.md`, `AGENTS.md`, the route.mjs header and the usage line) and a new ADR-019 record the command and its one new git write. ADR-018 is taken by the in-flight `no-nested-subagents` change.

## Critical Implementation Details

- **State sequencing (archive state):** run every precheck (git safety, run branch, clean folder, guards) before the first write. Then read the old bytes of `run.jsonl` and `report.md`, write both, and commit. When the commit was not made (`routerCommit` returned `error` without `commit`), write the old bytes back, because `routerCommit` has already unstaged its own add. A post-commit check failure (`error` with `commit`) leaves the commit and reports it.
- **Timing:** the command must never run alongside `next` or another router call. Both read the whole log and write it back, so concurrent calls can lose an entry or the figure. Rule 3 and the branch texts say "as its own call".
- **Rule form:** the new rule 3 line carries exactly one bold keyword (`rules.test.mjs`). The shared section must not contain the ladder words `low`, `medium`, `high`, `xhigh`, `max`, a model alias, `effort`, `tier` or `model` (`skill-loop.test.mjs:73-75`, `openspec-skill.test.mjs` word check), and no `node $ROUTER` text, because each such line in the OpenSpec skill needs `--chain openspec`.

## Phase 1: The `usage` command (running and ended runs)

### Overview

Add the router command, its guards, the ended-run report rewrite and the tests for both chains, including the rollback and the step commit of an isolated run. No git write yet.

### Changes Required:

#### 1. Export the usage cleaner

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Reuse the result-file validation for the command, so a late figure is kept by exactly the same rules as an on-time one.

**Contract**: `export function cleanUsage(raw)`, unchanged body (`flow.mjs:364-372`).

#### 2. The command

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `usageCommand(id, rest, flags, policy, chain)` and dispatch `cmd === "usage"` in `main`. The command attaches a late figure to executed step `<n>` and, on an ended run, rewrites `report.md`. Extend the header comment and the usage halt string with the new command.

**Contract**:
- Arguments: `<n>` is `rest[0]`, so it must directly follow `<change-id>` (flags after it; `parseFlags` skips positionals, and a flag first makes `rest[0]` a flag, which the next check refuses), and must match `/^[1-9]\d*$/`. Each of `--tokens`, `--tool-uses` and `--duration-ms` maps to `totalTokens`, `toolUses` and `durationMs`. A given flag must hold a decimal string matching `/^\d+$/` that is a safe integer. At least one flag is required. All of this is checked before anything is read. The figure object goes through `cleanUsage`.
- Guards, in order, each writing nothing: `guardArchived(p, id)`; for OpenSpec a missing change folder (`missingChangeReason`); no `run.jsonl` (`No run log for <id>.`); no executed entry with `n` (`Step <n> is not logged.`); the entry has no `result` (`Step <n> (<step>) has no result yet; put the figure in its result file.`); the entry has `usage` that is not deep-equal to the new figure (`Step <n> (<step>) already has the figure <json>; a figure is never overwritten.`). Skip entries have no `n`, so the lookup never matches them.
- Equal figure: print `attached: true, unchanged: true` and write nothing.
- Otherwise set `entry.usage` and `entry.usageLate = true` and write the log with `writeLog`. Only `run.jsonl` is written while the run has no `meta.outcome`.
- Ended run (`meta.outcome` is an object): also `writeReport(p, id, meta, log)`. Print its path as `report`, else `report: null`.
- Interim guard until Phase 2: an ended run in the archive state (`meta.outcome.action === "done"` and `meta.archive === true`) is refused before anything is written (`The run is in the archive state; a late figure there needs the folder commit of the archive branch.`), because a rewritten `report.md` would leave the change folder dirty for `/10x-archive`. Phase 2 replaces this refusal with the archive branch. One test in this phase pins the refusal and leaves the folder byte-identical.
- Output: `out({ action: "usage", attached: true, n, step, usage, unchanged, report, commit: null })`. A refusal is `out({ action: "usage", attached: false, n, reason }, 1)`. `guardArchived` and chain halts keep their `action: "halt"` form.

#### 3. Tests

**File**: `skills/10x-pipeline/test/late-usage.test.mjs` (new)

**Intent**: Drive the command through the CLI in scratch projects (`helpers.mjs`, `openspec-helpers.mjs`), with real linked worktrees and hermetic git for the isolated cases, as in `rollback.test.mjs`. `helpers.mjs` stays as it is.

**Contract**: one `test()` per behavior:
- Argument errors: a bad `<n>`, no flag, a flag without a value, a negative, fractional or unsafe value. Each exits 1 and leaves the folder byte-identical.
- Refusals: a step not logged, a pending step, a different figure over an existing one (also a subset). Each writes nothing.
- Attach to step 1 while step 2 is pending: the entry gets `usage` and `usageLate`, the pending entry keeps `pendingPrompt`, `status` shows the figure and no `report.md` is written.
- The same figure again prints `unchanged: true` and leaves `run.jsonl` byte-identical.
- An ended 10x run (`done`, and `halt`): `report.md` shows the token figure, the totals line counts it, and with `prices` set the `Cost (est.)` cell and the `Cost (estimate)` line include it.
- `compare`: a routed side that misses one figure has `usage-incomplete:routed` before the command and not after it.
- OpenSpec chain: attach with `--chain openspec` and without the flag (stored chain), on a running run and on an ended run with `report.md`. A moved change (`moveToArchive`) halts as archived and writes nothing.
- 10x archived or stamped `status: archived`: halts and writes nothing.
- Isolated run, rollback: attach the figure of step 1 while step 2 is pending, fail step 2. After the rollback the entry still has the figure, and the next successful step commit holds it (`git show HEAD:<run.jsonl>`).
- Isolated run, undo on halt: the same with a failed step that hits `maxAttemptsPerStep`. The kept state still has the figure.

### Success Criteria:

#### Automated Verification:

- New command tests pass: `node --test skills/10x-pipeline/test/late-usage.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- A refused call leaves the change folder byte-identical (snapshot assertion in `late-usage.test.mjs`)

**Implementation Note**: After this phase and its automated checks, pause for confirmation before Phase 2.

---

## Phase 2: Late figure in the archive state

### Overview

On an `--archive` run whose `archive` action was returned, attach the figure, rewrite `report.md` and commit the change folder before the archive subagent starts. On failure, leave the folder as committed.

### Changes Required:

#### 1. Policy key

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Give the late-usage commit its own subject, next to `archive.commitMessage`, so it reads as what it is in the history.

**Contract**: `archive.usageMessage: "chore({id}): add late usage figure of step {n}"`. A value that is not a non-blank string refuses the command in the archive state before anything is written. In-flight runs record `provenance.drift` for `archive`.

#### 2. Commit helper

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Export the precheck and the folder-only commit for the command, built from the existing private helpers. No change to their behavior.

**Contract**:
- `export function lateUsagePrecheck(p, id, meta, policy)` returns `null` or a reason. It applies `gitSafety(g, timeout, { id, chain })` (work tree, router files not ignored, symbolic HEAD, nothing in progress, empty index), `runBranchReason` when `meta.isolated === true`, and an empty `statusEntries(["--", "<rel>/"])`. A dirty folder gives `The change folder <rel> is not clean; the archive may have started, or the pre-archive commit failed.` (the archive state is also true after a failed pre-archive commit, when no `archive` action was returned, so the text names both causes). `timeout` is `policy.archive?.gitTimeoutMs`, as in `archiveDone`.
- `export function lateUsageCommit(p, id, policy, n)` returns `routerCommit(g, timeout, { rel, message })` with the rendered `archive.usageMessage`. `rel` is `context/changes/<id>` or `openspec/changes/<id>`.

#### 3. Archive branch of the command

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the archive state, check before writing, write, commit, and restore the old bytes when no commit was made.

**Contract**:
- Archive state: `meta.outcome?.action === "done" && meta.archive === true`. Any other ended run keeps Phase 1 behavior.
- Order: Phase 1 guards → `lateUsagePrecheck` and the message check (refusal on failure) → keep the old bytes of `run.jsonl` and `report.md` (or their absence) → write log and report → `lateUsageCommit`.
- `{ commit }` prints `attached: true` with `commit` as a 7-character hash, or `null` when nothing was staged.
- `{ error }` without `commit`: restore the old bytes (unlink a file that did not exist before) and print `attached: false` with the git reason and `The figure was not kept; the change folder is as committed.`, exit 1.
- `{ error, commit }`: print `attached: true`, `commit` and `reason` (the post-commit check). Exit 0.

#### 4. Tests

**File**: `skills/10x-pipeline/test/late-usage.test.mjs`

**Intent**: Cover the archive path on both chains and in an isolated run.

**Contract**:
- 10x `--archive` in a plain git repo (isolation off): after the `archive` action, `usage` for the last step commits the folder with the rendered `archive.usageMessage`. The commit holds only `context/changes/demo/` paths, the folder is clean, and the committed `report.md` shows the figure.
- The same with a failing `pre-commit` hook: `attached: false`, exit 1, the folder is clean, `run.jsonl` and `report.md` equal their committed versions and the index is empty.
- A dirty change folder (an extra file) refuses before writing.
- An `archive.usageMessage` that is not a non-blank string refuses before writing.
- Isolated `--archive` run in a linked worktree: the commit lands on the run branch. A following `next` returns the `archive` action again with `commit: null` and a clean folder (the resume path of `archiveDone`).
- OpenSpec `--archive` run: the commit holds only `openspec/changes/demo/` paths and the committed `report.md` shows the figure.

### Success Criteria:

#### Automated Verification:

- Archive-path tests pass: `node --test skills/10x-pipeline/test/late-usage.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Provenance and baseline tests still pass with the new policy key: `node --test skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/compare.test.mjs`

**Implementation Note**: After this phase and its automated checks, pause for confirmation before Phase 3.

---

## Phase 3: Orchestrator skills

### Overview

Rule 3 of both skills calls the command instead of dropping the figure, and the branches say when.

### Changes Required:

#### 1. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Attach every late figure that arrives before the run's cut-off point, as its own router call.

**Contract**:
- `## Anti-stall rules`, rule 3, one rule line with one bold keyword, for example: `- **GIVEN** \`next\` ran for a \`run\` step **WHEN** a usage figure for that step arrives later **THEN** the orchestrator **MUST** attach it with one call of the router's \`usage\` command of its own, never alongside another router call, before the pull request step or the archive subagent starts, instead of rewriting the result file or calling \`next\` again, and drop a figure that arrives after that point.` The intro paragraph keeps "Rules 2 and 3 do not apply to it" for the archive subagent. The section names no ladder word.
- Loop `run` step 4: the last sentence points at rule 3 for a figure that arrives after `next`.
- `done` and `halt` branches: before the pull request step, run `cd "<run root>" && node $ROUTER usage <change-id> <n> --tokens N --tool-uses N --duration-ms N` once for each step whose figure arrived after `next` ran and is not attached yet, omitting a flag whose figure is missing. `<n>` is the `n` of the `Step <n>` line printed when the subagent whose notification carried the figure was launched, never a guess: a wrong `<n>` is accepted silently when that entry has no figure. Print `Usage: step <n> <attached|not attached>, <reason or commit>`. A refusal exits 1 with `attached: false`; that is no orchestrator fault (no `orchestrator-error` result) and never changes the run.
- `archive` branch, step 1: the same call first, before `status`, so `status` and the committed `report.md` show the figure. A figure that arrives after step 3 has launched the archive subagent is dropped.
- `## Rules`: the router-owned files line adds that the `usage` command is the only way to add a figure to a logged step.

#### 2. OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: The same, with `--chain openspec` on every router line.

**Contract**: the `## Anti-stall rules` section is byte-equal to the 10x one. The `done`, `halt` and `archive` branches carry `cd "<run root>" && node $ROUTER usage <change-name> <n> ... --chain openspec`.

#### 3. Skill tests

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Pin the new rule and the call places.

**Contract**:
- `NEEDLES[2]` becomes `["**MUST**", "`usage`", "result file", "drop"]`.
- New test: the `done` and `halt` branches name `node $ROUTER usage` before `do the pull request step`, and the `archive` branch names it in step 1, before `\n  3. Call the Agent tool`.
- `openspec-skill.test.mjs`: the command list check (`:95`) adds `usage`. The existing equality and `--chain openspec` checks then cover the rest.

### Success Criteria:

#### Automated Verification:

- Skill tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- A read of both `archive` branches shows the `usage` call before the archive subagent launch and states that a later figure is dropped

**Implementation Note**: After this phase and its automated checks, pause for confirmation before Phase 4.

---

## Phase 4: Docs and ADR

### Overview

Record the command, its guards, its one git write and the changed rule.

### Changes Required:

#### 1. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Describe the command where readers look for usage figures, anti-stall behavior, archive commits and the OpenSpec chain.

**Contract**:
- "Usage report": the token bullet (line 223) says a late figure is attached with `usage`. A new "Late usage figure" block after "Usage report" covers the syntax, the guards, `usageLate`, the output, the report rewrite of an ended run, the archive-state commit with `archive.usageMessage` and its restore on failure, the cut-off points, rollback survival and the upgrade note (provenance drift for `archive` and `prompts`).
- "Orchestrator anti-stall": replace the "dropped" bullet (line 330) with the new rule 3.
- "Archive (opt-in)": one bullet on the late-usage commit and the `next` resume with `commit: null` in an isolated run.
- OpenSpec "Read-only commands" area: one line that `usage --chain openspec` works the same way.

#### 2. Contributor guide

**File**: `AGENTS.md`

**Intent**: List the command, the new test file, the new ADR and the new git write.

**Contract**: a `## Commands` bullet for `route.mjs usage <id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]`. A Project Structure bullet for `late-usage.test.mjs`. The `route.mjs` bullet lists `usage`. The `docs/ADR/` bullet adds ADR-019. The git hard rule names ADR-019 next to ADR-010 for the late-usage commit.

#### 3. ADR

**File**: `docs/ADR/ADR-019-late-usage-figure.md` (new)

**Intent**: Record why a router command (suggestion 2 of #71) beats ordering the calls (suggestion 1), why the command commits only in the archive state, the cut-off points, and the restore on failure.

**Contract**: the usual ADR shape of `docs/ADR/` (Status, Context, Decision, Consequences). Rule lines, if any, follow ADR-004. No recursive or forced delete command appears in it (`no-recursive-delete.test.mjs`).

### Success Criteria:

#### Automated Verification:

- Delete guard and rule form pass over the new docs: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `init` and `status` print valid JSON in a scratch project, and `usage` on a scratch run prints `attached: true` (AGENTS.md Testing)

#### Manual Verification:

- `REFERENCE.md`, `AGENTS.md` and ADR-019 describe the same syntax, guards and output as `route.mjs`

---

## Testing Strategy

### Unit Tests:

- None separate. The suite drives the real router through the CLI, as every other router test does.

### Integration Tests:

- `late-usage.test.mjs`: arguments, guards, both chains, ended run with report and cost, `compare`, isolated rollback and undo on halt, step commit, archive commit on both chains, hook failure restore, isolated archive resume.
- `skill-loop.test.mjs` and `openspec-skill.test.mjs`: rule 3 and the call places.

### Manual Testing Steps:

1. Read both `archive` branches and the new rule 3 side by side.
2. Read the REFERENCE block next to `usageCommand` and compare the guard texts.

## Performance Considerations

None. One log read and write per call. In the archive state the git calls are those of the existing folder commit.

## Migration Notes

- Entries without `usageLate` read as before. Runs that lost figures before this change keep `-`. The command can still attach those figures by hand when the figures are known and the run is not archived.
- In-flight runs record `provenance.drift` for `archive` (the new key) at their next `next` call. `compare` then warns `provenance-drift:<side>:archive`. Routing does not change.
- Release type: `fix` (issue #71). Conflicts with `no-nested-subagents` in both `## Anti-stall rules` sections and the rule-count tests. Whichever change merges second rebases and resolves.

## References

- Issue: GitHub #71. Change notes: `context/changes/late-step-usage/change.md`
- Usage intake: `skills/10x-pipeline/scripts/flow.mjs:364-372`, `:446-518`
- Rollback and state write-back: `skills/10x-pipeline/scripts/isolation.mjs:424-490`, `skills/10x-pipeline/scripts/route.mjs:46-89`
- Folder commit and prechecks: `skills/10x-pipeline/scripts/isolation.mjs:212-235`, `:295-357`, archive resume `:508-518`
- Anti-stall rules: `skills/10x-pipeline/SKILL.md:78-86`, `skills/openspec-pipeline/SKILL.md:86-94`
- Test patterns: `skills/10x-pipeline/test/rollback.test.mjs`, `neutral.test.mjs`, `skill-loop.test.mjs:35-41`
- ADRs: ADR-010 (git writes), ADR-015 (neutral rerun), ADR-017 (pull request step)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The `usage` command (running and ended runs)

#### Automated

- [x] 1.1 New command tests pass: `node --test skills/10x-pipeline/test/late-usage.test.mjs` — ddc694f
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — ddc694f
- [x] 1.3 A refused call leaves the change folder byte-identical (snapshot assertion in `late-usage.test.mjs`) — ddc694f

### Phase 2: Late figure in the archive state

#### Automated

- [x] 2.1 Archive-path tests pass: `node --test skills/10x-pipeline/test/late-usage.test.mjs` — 3dbaff5
- [x] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 3dbaff5
- [x] 2.3 Provenance and baseline tests still pass with the new policy key: `node --test skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/compare.test.mjs` — 3dbaff5

### Phase 3: Orchestrator skills

#### Automated

- [x] 3.1 Skill tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs` — 800768f
- [x] 3.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 800768f

#### Manual

- [ ] 3.3 A read of both `archive` branches shows the `usage` call before the archive subagent launch and states that a later figure is dropped

### Phase 4: Docs and ADR

#### Automated

- [x] 4.1 Delete guard and rule form pass over the new docs: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- [x] 4.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 4.3 `init` and `status` print valid JSON in a scratch project, and `usage` on a scratch run prints `attached: true` (AGENTS.md Testing)

#### Manual

- [ ] 4.4 `REFERENCE.md`, `AGENTS.md` and ADR-019 describe the same syntax, guards and output as `route.mjs`
