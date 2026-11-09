# OpenSpec Chain on the Shared Router Implementation Plan

## Overview

Implement ADR-013: a second pipeline skill, `skills/openspec-pipeline/`, that drives an OpenSpec change (`openspec/changes/<name>/`) through the steps `os-propose`, `os-apply`, `os-verify` and `os-archive` on the existing router. The router gains a `--chain openspec` switch, a chain-aware `paths()`, a decision module of its own, file-based reading of OpenSpec state, a `verify.md` verdict with a bounded fix loop, and an archive through the OpenSpec CLI. The 10x chain keeps its behaviour byte for byte.

The change starts with the four ADR-013 preconditions. Each is checked first, its evidence is saved under `context/changes/openspec-pipeline/evidence/`, and its result goes into ADR-013. A failed check stops the run before any router code is written.

## Current State Analysis

- The router is split into `route.mjs` (`next`, the commands, `main`) and the modules `state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs` and `isolation.mjs`, each importing only from the ones before it (`AGENTS.md`, Project Structure). The research line anchors (`route.mjs:1026`, `:603`, `:244`) predate that split and are stale.
- Every path is fixed to the 10x layout. `paths()` builds `context/changes/<id>` with `plan.md` and `reviews/*.md` (`scripts/state.mjs:228-229`). `archiveDirs` reads `context/archive` (`state.mjs:190-195`), `guardArchived` names it (`state.mjs:212-214`), `ignoredProbePaths` uses `context/changes/${id}` (`state.mjs:425-426`). `startCommit` commits `context/changes/${id}` (`scripts/isolation.mjs:357-367`), `timedFiles` assumes `plan`, `planReview` and `implReview` (`isolation.mjs:401`), `archiveDone` uses `context/changes/${id}` and `context/archive/${created}-${id}` (`isolation.mjs:489-520`). `verifyArchive` (`route.mjs:229-258`), `locateSide` (`route.mjs:295-298`) and `status` (`route.mjs:563`) hard-code the same roots.
- `decide()` (`scripts/flow.mjs:445`) is the 10x state machine. It halts with "No change folder. Run /10x-new" when `change.md` is missing. `attachResult()` (`flow.mjs:329`) verifies each step by the file it writes and treats an unknown step as verified (`default: verified = true`).
- `tierFor(d, log, policy, plan, meta, level, score)` (`scripts/steps.mjs:525-627`) reads `policy.steps[d.step]` and a plan summary (`plan.phases`, `plan.rows`, `plan.hasProgress`). A step not in `policy.complexity.appliesTo` gets no phase bump, and `simpleSignal` (`steps.mjs:501-511`) needs `plan.hasProgress`, so an empty plan summary gives no discount.
- Prompts are rule files under `skills/10x-pipeline/prompts/`, referenced from `policy.json` as `@prompts/<file>.md` and resolved against `SKILL_DIR` (`flow.mjs:623`, `checkPrompts` at `flow.mjs:642`). `rules.test.mjs` checks every `prompts/*.md` except `README.md`, every `policy.json` prompt and every ADR rule line for the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword.
- `helpers.mjs` builds 10x scratch projects (`makeProject`, `writeOverride`, `run`, `writeResult`, `readMetaFile`, `git`, `gitInit`, `commitFiles`) and hard-codes `context/changes/`. It must stay unchanged; new helpers may import from it.
- OpenSpec CLI 1.16.1 is at `/opt/homebrew/bin/openspec`; Node is v24.19.0. The archive folder name is `<local YYYY-MM-DD>-<name>`, or the name unchanged when it already starts with a date; the CLI refuses with `archive_target_exists` when that folder exists. A task is complete only as `- [x]` or `- [X]` (`research.md`, Detailed Findings 2; ADR-013 D2).
- The repository has no `openspec/` folder under version control. The main checkout holds untracked `openspec/` and `.claude/skills/openspec-*`; this worktree has neither.

## Desired End State

- `/agent-smith:openspec-pipeline <name> [goal] [--archive] [--pr-comment]` runs an existing OpenSpec change in its own worktree: `os-propose` until the apply inputs exist, `os-apply` until every task is ticked, `os-verify`, a fix loop of at most `limits.maxFixLoops` on a `FAIL`, then `done` or, with `--archive`, the pre-archive commit and `os-archive` through `openspec archive <name> --yes --json`.
- Run state lives in `openspec/changes/<name>/agent-smith/` and moves with the archive. `report.md` has the same format as a 10x run, so `--pr-comment` works through `--report`.
- Every 10x run, test and output is unchanged: no `chain` key in a 10x `meta.json`, the same paths, prompts, report text and provenance flags.
- ADR-013 records the result of each precondition with its evidence and is Accepted when all four passed.

Verify with the full suite, the new `openspec-*.test.mjs` files, `node tools/version-check.mjs`, a scratch `init`/`status` run with `--chain openspec`, and the optional contract test against the real CLI.

### Key Discoveries:

- Pre-probe evidence gathered while planning (to be confirmed and saved in Phase 1): a subagent whose working directory is this worktree lists `openspec-propose`, `openspec-apply-change` and `openspec-verify-change` among its skills although the worktree has no `.claude/skills/`, so skills resolve from the session's project, not from the worktree files (check 1). The installed plugin `~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/` is a copy of the whole repository tree, so `skills/10x-pipeline/scripts/route.mjs` sits beside any second skill folder (check 2). The `sentry` plugin 1.4.0 has eight skills under `skills/` and no skills list in its `plugin.json`, and all eight appear in the session (check 4).
- `rules.test.mjs` scans `prompts/*.md` by directory listing, so a new guide file is checked from the moment it exists, wired or not.
- The pipeline that runs this plan uses the installed plugin copy (0.7.1) for its router and `policy.json`. Edits in this worktree do not change the run in progress; the tests spawn the worktree's `route.mjs` (`helpers.mjs` `ROUTE`).
- `limits.maxFixLoops` is 2 and `rigor.budgetDelta` gives budgets 12, 19 and 24 (`policy.json`). The longest failure-free OpenSpec path is 7 steps (propose, apply, verify, then two rounds of fix and verify), inside the `lean` budget.
- `flow.mjs` `archiveLines` already names `chore(archive): close ${id}` as the archive commit of the 10x chain.

## What We're NOT Doing

- No change to the 10x chain: `decide()`, its prompts, paths, report text and tests stay as they are; `helpers.mjs` and `loops-existing.test.mjs` are not edited.
- No `openspec` CLI call from the router (ADR-013 D2). Only the `os-archive` subagent and the optional contract test run the CLI.
- No `score`, pre-plan steps, phase executors, `manual-verify`, code re-plans, confirmation round or plan review in the OpenSpec chain (ADR-013 D10), and no cheaper first attempt for `os-apply` (`escalation.firstAttempt.templates` stays as it is).
- No support for store-hosted changes (`--store`): the run halts (D3).
- No `### F<n>`/`Decision` finding format for `verify.md` (ADR-011 does not apply).
- No move of the router to a shared folder; that happens only if check 2 fails, in a separate change.
- No edit of `pr-comment.mjs`: the skill passes `--report`.
- No PRD or roadmap update for FR-006 (still "parked" there) and no refresh of the research line anchors; both stay ADR-013 follow-ups for the owner (`/10x-roadmap`).
- No version bump: the release PR sets it.

## Implementation Approach

Checks first, then code in the order the router needs it. Phase 1 settles the four preconditions and writes the decision guides, because the live check of the unattended skills needs the guides. Phase 2 adds the chain switch, run state, the OpenSpec reader and the routing order, so `init --chain openspec` returns a correct first step. Phase 3 adds step verification, the verdict, the fix loop and the isolation behaviour. Phase 4 adds the archive and the read-only commands. Phase 5 adds the skill, its test and the documentation.

The OpenSpec code lives in a new module `scripts/openspec.mjs`, placed between `steps.mjs` and `flow.mjs` in the import order, so `flow.mjs` (`attachResult`), `isolation.mjs` (`archiveDone`) and `route.mjs` (`next`, commands) can import it. The 10x code paths keep their current branches; each OpenSpec branch is selected by `meta.chain === "openspec"` or the resolved chain of the command.

## Critical Implementation Details

**10x byte-identity.** A 10x `init` writes no `chain` key, and the provenance `flags` of a 10x run keep their current keys: add `chain` to `flags` only when `meta.chain` is set. `provenance.test.mjs` and `compare.test.mjs` compare these objects.

**Archive date.** OpenSpec names the archive folder with the local date at the moment the CLI runs. The router computes `archivePath` with the local date when it returns the `archive` action; the subagent runs after it. A run that crosses midnight between the two gets a different folder name, and `verify-archive --path` then reports `archived: false`. Document it as a limit; the reason text of `verify-archive` lists any other `<date>-<name>` folder it finds.

**Unknown steps are verified by default.** `attachResult` ends in `default: verified = true`, so every `os-` step needs its own `case` before the default.

**Phase 1 gate.** A precondition that fails changes the design. The implementer then stops with status `blocked` and `signals.needsHuman` naming the check and the fallback ADR-013 gives for it. A check that cannot be run is not a failure: record "not run" with the reason, keep ADR-013 Proposed, and go on.

## Phase 1: Preconditions and decision guides

### Overview

Run the four ADR-013 checks, save the evidence, write the four decision guides as rule files, and record the results in ADR-013. No router code is written in this phase.

### Changes Required:

#### 1. Evidence for checks 1, 2 and 4

**File**: `context/changes/openspec-pipeline/evidence/check-1-skill-reach.md`, `check-2-router-path.md`, `check-4-plugin-discovery.md`

**Intent**: Record what was observed, with the commands and their output, and state pass, fail or not run for each check.

**Contract**:
- Check 1 passes when a subagent whose working directory is `.claude/worktrees/agent-smith-openspec-pipeline` lists and can invoke `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`. Record the skill list the implementing subagent sees, `ls -a .claude` of the worktree, `git ls-files .claude openspec` of the repository, and where the skills resolve from (the session's project, not the worktree). The live run of check 3 adds the invocation evidence.
- Check 2 passes when `<installed plugin dir>/skills/10x-pipeline/scripts/route.mjs` exists in the installed plugin cache next to the `skills/` folder, so `<openspec-pipeline base dir>/../10x-pipeline/scripts/route.mjs` resolves. Record `ls` of `~/.claude/plugins/cache/agent-smith/agent-smith/<version>/` and `.../skills/` (read only).
- Check 4 passes on evidence that Claude Code discovers every skill folder under a plugin's `skills/` without a manifest list: `.claude-plugin/plugin.json` of this plugin and of the installed `sentry` plugin have no skills key, and every `skills/*/SKILL.md` of `sentry` appears as `sentry:<name>` in the session's skill list. Phase 5 adds a live confirmation for this plugin (row 5.5).

#### 2. CLI facts for check 3

**File**: `context/changes/openspec-pipeline/evidence/check-3-cli.md`

**Intent**: Pin the OpenSpec behaviour the router copies, in a scratch project under `mktemp -d` with `openspec/config.yaml` (`schema: spec-driven`), `openspec/specs/` and `openspec/changes/archive/`.

**Contract**: Record the commands and JSON output for:
- a change made with `openspec new change <n>`: the files it creates (`ls -a`), so Phase 2 knows what "the change exists" looks like;
- `openspec status --change <n> --json` and `openspec instructions apply --change <n> --json` for: proposal only; proposal, one `specs/<cap>/spec.md` and `tasks.md` without `design.md`; all four files;
- `tasks.md` with no checkbox row (apply `state`);
- an extra `agent-smith/` folder with a file inside the change: `openspec validate <n> --json` and `openspec archive <n> --yes --json` succeed and the folder moves with the change;
- the archive folder name and the `archive_target_exists` error when that folder exists.

The planning-complete predicate of Phase 2 follows this evidence. Expected (predicate A): `proposal.md`, at least one `specs/**/*.md` and `tasks.md` exist; `design.md` is optional. If `instructions apply` reports `blocked` without `design.md`, use predicate B (A plus `design.md`) and say so in ADR-013 D4. If OpenSpec's `isPlanningComplete` and apply readiness disagree, the router follows apply readiness, because `os-apply` is the step that needs it, and ADR-013 D4 is reworded to say so.

#### 3. Decision guides

**File**: `skills/10x-pipeline/prompts/os-propose.md`, `os-apply.md`, `os-verify.md`, `os-archive.md`

**Intent**: Give every ask point of the OpenSpec skills a fixed answer, in the style of `frame-unattended.md`: decide from evidence and list the decision as an assumption, and when no evidence-backed answer exists end `blocked` with `signals.needsHuman` (ADR-013 D6). One intro line, then `## Rules`, each rule one line in GIVEN/WHEN/THEN form with one bold keyword.

**Contract**:
- `os-propose.md`: the change `openspec/changes/{id}/` already exists, so continue it and never run `openspec new change` or create a change of another name; take missing input from the goal and the change folder; decide a "material ambiguity" from repository evidence and list it as an assumption, else end `blocked` with `signals.needsHuman`; never pass `--store`; write only inside `openspec/changes/{id}/`, never into `openspec/specs/`; write no code and run no apply; end `done` once the files the apply step needs exist.
- `os-apply.md`: tick each finished task as `- [x]` in `tasks.md` as the skill does and never untick a row; decide an unclear task from `proposal.md`, `design.md` and the delta specs, else `blocked`; when the skill would pause on a design issue, apply a local artifact fix and go on with an assumption, else `blocked`; never archive and never run `openspec archive`; never commit (the router commits each step of an isolated run). Fix mode: when the prompt lists critical findings, fix each one, run the tests the change names and leave the ticks as they are.
- `os-verify.md`: run the verify skill read-only (change no code, `tasks.md` or artifact) and write `openspec/changes/{id}/agent-smith/verify.md`: line 1 `Verdict: PASS`, `Verdict: PASS WITH WARNINGS` or `Verdict: FAIL`, line 2 `Critical: <n>`, line 3 `Warnings: <n>`, then `## Critical` with one `- ` line per critical issue, `## Warnings` with one `- ` line per warning, then the report. Any critical issue gives `FAIL`; else any warning gives `PASS WITH WARNINGS`; else `PASS`. The counts equal the bullets.
- `os-archive.md`: run `openspec archive {id} --yes --json` once, from the run root, with no other flag; never use the archive skill and never move folders by hand; on a CLI error (for example `archive_target_exists` or a validation error) end `blocked` with `signals.needsHuman` quoting the error, without a retry; on success commit `openspec/` as `chore(archive): close {id}` without pushing and report `archive.archivedAs` and `path` in the RESULT line.

#### 4. Live check 3

**File**: `context/changes/openspec-pipeline/evidence/check-3-live.md`

**Intent**: One small live change through the guides, unattended, in a scratch OpenSpec project made as in item 2 plus `git init` and one tiny file to change (for example a shell script that prints a greeting).

**Contract**: Launch one subagent per probe with a prompt composed by hand from what Phase 2 will wire: the template's lead line (see Phase 2, `policy.json` prompts), the guide file, and `policy.json` `prompts.suffix`, with the scratch directory as the working directory. The probe tests the guides, not the tier, so one mid-ladder model is enough for all of them. Probes and their pass criteria:
1. `os-propose` with a one-sentence goal: ends `done`; the planning predicate holds; no plain-text question was printed.
2. `os-apply`: ends `done`; every row of `tasks.md` is ticked.
3. `os-verify`: ends `done`; `verify.md` has the three header lines and the two sections.
4. `os-archive`: ends `done` with `archivedAs`; the change folder moved under `openspec/changes/archive/`; the spec merged into `openspec/specs/`.
5. Negative: `os-propose` on a fresh empty change with an empty goal: ends `blocked` with `signals.needsHuman`.

Record each prompt, the RESULT line, `ls -R` of the change after the step and the observed questions, if any. A guide that misses a criterion may be revised once and its probe run again; a second miss fails check 3. If no subagent can be launched (no Agent tool at this depth), record "not run" with the reason.

#### 5. ADR-013 results

**File**: `docs/ADR/ADR-013-openspec-pipeline.md`

**Intent**: Add the results under `## Preconditions` (pass, fail or not run, with the evidence path), reword D4 if item 2 changed the predicate, and set the status to Accepted only when all four passed.

**Contract**: ADR rule lines keep the rule form (`rules.test.mjs`, "ADR rule lines follow the rule form").

### Success Criteria:

#### Automated Verification:

- Check 1 evidence saved: `evidence/check-1-skill-reach.md` exists with a pass, fail or not run line
- Check 2 evidence saved: `evidence/check-2-router-path.md` exists with a pass, fail or not run line
- Check 3 CLI facts saved: `evidence/check-3-cli.md` records status, apply, archive and extra-folder output and names predicate A or B
- Check 4 evidence saved: `evidence/check-4-plugin-discovery.md` exists with a pass, fail or not run line
- The four guides pass the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Check 3 live run recorded: `evidence/check-3-live.md` lists the five probes with their RESULT lines, or "not run" with the reason
- ADR-013 records all four results and its rule lines pass: `node --test skills/10x-pipeline/test/rules.test.mjs`

#### Manual Verification:

- Check 3 live evidence shows propose, apply, verify and the CLI archive ran unattended and the negative probe ended `blocked` with `signals.needsHuman`

**Implementation Note**: If any check fails, stop here with status `blocked` and `signals.needsHuman` naming the check. Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 2: Chain switch, run state and routing order

### Overview

`init`, `next` and `status` accept `--chain openspec`, keep run state under `openspec/changes/<name>/agent-smith/`, refuse the collisions of D3 and D8, and return the D4 routing order. Step verification still uses the default branch until Phase 3.

### Changes Required:

#### 1. Chain-aware paths

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Let every path come from `paths()` with the chain's root, leaving the 10x object unchanged.

**Contract**: `paths(id, policy = null, chain = "10x")`. For `openspec` it returns `change` = `ROOT/openspec/changes/<id>`, `dir` = `change/agent-smith`, `meta`, `log`, `result` and `report` with the same file names as the 10x chain, plus `tasks`, `proposal`, `design`, `specs` (folder) and `verify` (`dir/verify.md`); `plan`, `planReview`, `implReview` and `complexity` are `null`. `readPlan(null)` returns the same empty shape as for a missing file. `ignoredProbePaths(id, opts)` takes the chain and, for `openspec`, probes `openspec/changes/<id>/agent-smith/{run.jsonl,meta.json,report.md}` and `openspec/changes/<id>/tasks.md`. `archiveDirs` and `guardArchived` take the chain; for `openspec` they read `openspec/changes/archive/` for `<YYYY-MM-DD>-<id>` and `guardArchived` halts only when the live folder is gone and an archive folder exists.

#### 2. OpenSpec reader and decision

**File**: `skills/10x-pipeline/scripts/openspec.mjs` (new)

**Intent**: Read OpenSpec state from files (D2) and pick the next step (D4) without touching `decide()`.

**Contract**:
- `readOpenspec(p)` returns `{ exists, proposal, design, specs, tasksFile, planningComplete, tasks: { total, complete, open } }`. Task rows match `^\s*-\s+\[([ xX])\]\s+`; a row is complete only for `x` or `X`. `specs` counts `specs/**/*.md`. `planningComplete` is predicate A or B as Phase 1 fixed.
- `decideOpenspec(p, log, policy, meta)` returns the same shapes as `decide()` (a step with `template` and `reason`, `done`, or `halt`). Order: change folder missing → halt; planning incomplete → `os-propose`; `tasks.md` with no checkbox row → halt for a human; an open row → `os-apply`; all ticked and no verified `os-verify` after the last verified `os-apply` → `os-verify`. The verdict branches come in Phase 3.

#### 3. Chain switch in the commands

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Resolve the chain once per command and route `openspec` runs through the new module.

**Contract**:
- `--chain 10x|openspec` is accepted by `init`, `next`, `status`, `risk`, `verify-archive` and `compare`; any other value halts before anything is read.
- Without the flag, a command reads `openspec/changes/<id>/agent-smith/meta.json`; `chain: "openspec"` there selects `openspec`, else `10x`. A flag that contradicts the stored chain halts.
- `init --chain openspec` halts and writes nothing when `openspec/changes/<id>/` is missing (the reason names `openspec new change <id>` and says store-hosted changes are not supported) or when `context/changes/<id>/` exists (collision, D8). A 10x `init` halts when `openspec/changes/<id>/agent-smith/meta.json` holds `chain: "openspec"`.
- The first `openspec` `init` stores `meta.chain = "openspec"`; a 10x `init` writes no `chain` key.
- `next()` calls `decideOpenspec` for `openspec`, skips the score, pre-plan, executor and manual-verify paths, passes the empty plan summary to `tierFor`, and records `before: { ticks }` from `readOpenspec` instead of the plan-based `before` fields. Provenance `flags` gain `chain` only when `meta.chain` is set.

#### 4. Isolation paths

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Make the isolation gate, the start commit and the rollback file times chain-aware.

**Contract**: `isolationCheck` probes the chain's paths. `startCommit` commits `openspec/changes/<id>` for `openspec`. `timedFiles(p)` returns only non-null paths and, for `openspec`, `tasks` and `verify`.

#### 5. Policy

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the four steps (D9) and their templates.

**Contract**: `steps`: `os-propose` {skill `openspec-propose`, baseTier 5, minTier 2, maxTier 7, interactive}, `os-apply` {skill `openspec-apply-change`, 3/2/7}, `os-verify` {skill `openspec-verify-change`, 3/2/6, interactive}, `os-archive` {skill null, 3/3/3, interactive}. `prompts`: `os-propose`, `os-apply`, `os-apply-fix`, `os-verify`, `os-archive`, each an array of a lead line (`Run /openspec-propose for the existing OpenSpec change {id} (openspec/changes/{id}/). Goal: {goal}` and the like) and the matching `@prompts/os-*.md`; `os-apply-fix` carries `{findings}` and uses `os-apply.md`.

#### 6. Tests

**File**: `skills/10x-pipeline/test/openspec-helpers.mjs` (new), `skills/10x-pipeline/test/openspec-chain.test.mjs` (new)

**Intent**: Scratch OpenSpec projects without touching `helpers.mjs`, and the chain tests.

**Contract**: The helper builds on `makeProject({ change: false, policy })` and writes `openspec/config.yaml`, a change folder, artifact files, `tasks.md` with a given number of ticked and open rows, `verify.md`, the result file and the run log at the OpenSpec paths. Tests: an unknown `--chain` value halts; missing change folder halts and creates no `agent-smith/`; the `context/changes/<id>/` collision halts; a 10x `init` on an OpenSpec run halts; `meta.chain` is stored and run state is written under `openspec/changes/<id>/agent-smith/` only; `next` and `status` detect the chain without the flag; `--chain 10x` on an OpenSpec run halts; the first step is `os-propose`, `os-apply` or `os-verify` for an empty, a proposed and a fully ticked change; `tasks.md` without checkboxes halts; a 10x `meta.json` has no `chain` key; the `os-propose` prompt holds the guide text and `prompts.suffix`.

### Success Criteria:

#### Automated Verification:

- Chain tests pass: `node --test skills/10x-pipeline/test/openspec-chain.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `helpers.mjs` and `loops-existing.test.mjs` are unchanged: `git diff --exit-code 0e49df5 -- skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/test/loops-existing.test.mjs`

**Implementation Note**: Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 3: Step verification, verdict and fix loop

### Overview

Each `os-` step is verified by the file it writes, the `verify.md` verdict drives `done` or a fix loop of at most `limits.maxFixLoops`, and the isolated run commits and rolls back OpenSpec steps as it does 10x steps.

### Changes Required:

#### 1. Verification and verdict

**File**: `skills/10x-pipeline/scripts/openspec.mjs`, `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Add `case`s for the `os-` steps in `attachResult` that call the OpenSpec helpers, and parse the verdict.

**Contract**:
- `os-propose`: verified when the status is `done`, `planningComplete` holds and at least one artifact file is newer than the step start.
- `os-apply` (template `os-apply`): verified when the status is `done` and `tasks.md` has more ticked rows than `before.ticks`.
- `os-apply` (template `os-apply-fix`): verified by the reported status, as the 10x `fix` step is.
- `os-verify`: verified when `verify.md` is a regular file newer than the step start and `readVerdict` parses it. `readVerdict(file)` reads line 1 `Verdict: (PASS WITH WARNINGS|PASS|FAIL)`, then `Critical: <int>` and `Warnings: <int>`, and the `- ` lines under `## Critical` up to the next `## ` heading (at most 20, each made one line and cut to 300 code points). A `Critical` count above 0 reads as `FAIL` whatever the verdict line says. The log entry stores `review: { verdict, critical, warnings }`, so `status` and the report's `## Review findings` section show it (extend that section's step filter if it lists step names).

#### 2. Verdict routing

**File**: `skills/10x-pipeline/scripts/openspec.mjs`

**Intent**: Finish `decideOpenspec` with the D4 verdict branches.

**Contract**: The last verified `os-verify`, read from its log entry, decides: `PASS` or `PASS WITH WARNINGS` → `done` (route's archive branch applies when `meta.archive`); `FAIL` with fewer verified `os-apply-fix` entries than `limits.maxFixLoops` → `os-apply` with template `os-apply-fix` and `{findings}` rendered from the stored critical lines (or "see verify.md" when none); `FAIL` at the cap → halt `OpenSpec verify FAIL after <n> fix loops. Needs a human.` with the path of `verify.md`. A verified `os-apply-fix` routes to `os-verify`.

#### 3. Tests

**File**: `skills/10x-pipeline/test/openspec-steps.test.mjs` (new), `skills/10x-pipeline/test/openspec-isolation.test.mjs` (new)

**Intent**: Cover verification, verdict, loop, tiers, dropped features, budget and isolation.

**Contract**:
- Steps: `os-propose` done without new files fails; `os-apply` with no new tick fails, three failures halt; missing, stale or malformed `verify.md` fails the step; `PASS` and `PASS WITH WARNINGS` end `done`; a `PASS` line with `Critical: 1` routes as `FAIL`; `FAIL` returns `os-apply-fix` with the critical lines in the prompt; a third `FAIL` after two fix loops halts; the `review` field shows in `status` and `report.md`; `signals.needsHuman` halts and `signals.rigor` raises the level.
- Tiers and features: the four `steps` entries equal the base, min and max tiers of `plan`, `implement`, `impl-review` and `archive`; `tierWhy` of the first `os-propose` starts with `base 5`; with `score.minRigor` `standard`, `manualVerify.minRigor` `lean` and `--rigor thorough`, an OpenSpec run never returns `score`, `research`, `domain-brief`, `frame`, `manual-verify` or an executor template.
- Budget: the 7-step path with two `FAIL` verdicts halts on the fix-loop cap, not on the `lean` budget of 12.
- Isolation (linked worktree, hermetic git, `isolation: { require: true }`): the start commit holds `openspec/changes/<id>/`; a verified `os-apply` gets a step commit; a failed `os-apply` resets code and `tasks.md` to `startSha` and writes the side ref; an OpenSpec `init` in a worktree that holds `context/changes/<id>/` halts.

### Success Criteria:

#### Automated Verification:

- Step tests pass: `node --test skills/10x-pipeline/test/openspec-steps.test.mjs`
- Isolation tests pass: `node --test skills/10x-pipeline/test/openspec-isolation.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

**Implementation Note**: Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 4: Archive and read-only commands

### Overview

`--archive` ends an OpenSpec run with the router's pre-archive commit and an `os-archive` action; `verify-archive`, `compare`, `status` and `risk` read OpenSpec runs, live or archived. A contract test compares the router's reading with the real CLI when it is on `PATH`.

### Changes Required:

#### 1. Archive branch

**File**: `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Make `archiveDone` chain-aware (D5).

**Contract**: For `openspec`: the same git safety checks except the `created:` line; halt when `tasks.md` has an open row; `archivePath` = `openspec/changes/archive/<local YYYY-MM-DD>-<id>`, or `openspec/changes/archive/<id>` when the id already starts with a date; halt when that folder exists; write `report.md`, commit `openspec/changes/<id>/` with `archive.commitMessage`, and return `action: "archive"` with the `os-archive` template, the tier of `steps["os-archive"]`, `archivePath`, `commit` and `ignored`. A halt carries `archive: "skipped: ..."` and `committed` as in the 10x chain. `archiveLines` in the report names the CLI archive for this chain.

#### 2. Read-only commands

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `verify-archive`, `compare`, `status` and `risk` follow the chain.

**Contract**: `verify-archive <id> --chain openspec [--path <p>]` prints `archived: true` when the archive folder exists and `openspec/changes/<id>/` is gone; OpenSpec has no `status` stamp, so none is read; without `--path`, several matching folders give `archived: false` with an `ambiguous` list; the reason lists other `<date>-<id>` folders when `--path` misses. `compare --chain openspec` reads each side from `openspec/changes/<id>/agent-smith/` or `openspec/changes/archive/<date>-<id>/agent-smith/` (a live folder wins, with the same warning). `status --chain openspec` adds `openspec: { planningComplete, tasks: { total, complete } }`. `risk --chain openspec` reports no plan hits.

#### 3. Tests

**File**: `skills/10x-pipeline/test/openspec-archive.test.mjs` (new), `skills/10x-pipeline/test/openspec-contract.test.mjs` (new)

**Intent**: Cover the archive branch and the read-only commands, and bound the drift from the OpenSpec parser.

**Contract**:
- Archive: `PASS` with `--archive` returns the `archive` action with the local-date `archivePath`, and the commit holds only `openspec/changes/<id>/`; an open row halts; an existing target halts with `committed: false`; without `--archive` the run ends `done` with no commit; a date-prefixed id keeps its name; `verify-archive` true, false, `--path` and ambiguous cases; `next` after the move halts as archived; `compare --chain openspec` reads a live and an archived side.
- Contract: the binary is `process.env.OPENSPEC_BIN ?? "openspec"`; every test skips when it does not start. Fixtures: an empty change, proposal only, proposal with specs and tasks (no `design.md`), all four files with mixed ticks. For each, `status --chain openspec` matches `openspec instructions apply --change <id> --json` (`state` not `blocked` equals `planningComplete`, and `progress.total` and `progress.complete` equal the task counts).

### Success Criteria:

#### Automated Verification:

- Archive tests pass: `node --test skills/10x-pipeline/test/openspec-archive.test.mjs`
- Contract test passes against the CLI: `node --test skills/10x-pipeline/test/openspec-contract.test.mjs`
- Contract test skips without the CLI: `OPENSPEC_BIN=/nonexistent node --test skills/10x-pipeline/test/openspec-contract.test.mjs` exits 0 with skipped tests
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

**Implementation Note**: Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 5: Skill and documentation

### Overview

The orchestrator skill for the OpenSpec chain, a content test for it, and the documentation and manifest updates of D12.

### Changes Required:

#### 1. Orchestrator skill

**File**: `skills/openspec-pipeline/SKILL.md` (new)

**Intent**: The loop of `skills/10x-pipeline/SKILL.md` for the OpenSpec chain, calling the shared router.

**Contract**: Frontmatter `name: openspec-pipeline`, a description for OpenSpec runs, `argument-hint: <change-name> [goal text] [--archive] [--pr-comment]`. `ROUTER=<this skill's base directory>/../10x-pipeline/scripts/route.mjs`. Start: stop with a message when `openspec/config.yaml` is not tracked by git or `openspec/changes/<name>/` is missing; print one line naming untracked `.claude/skills/openspec-*` folders; make or reuse the worktree as the 10x skill does and copy `openspec/changes/<name>/` with `cp -Rp` only when it creates the run branch; then `init <name> --chain openspec`. Every router call carries `--chain openspec`. Loop: `run` dispatches the prompt with the router's model and effort, `done` and `halt` print, `archive` runs the `os-archive` prompt in one subagent and then `verify-archive <name> --chain openspec --path <archivePath>`. The `## Anti-stall rules` section equals the one of the 10x skill. `--pr-comment` posts with `--report "<run root>/openspec/changes/<name>/agent-smith/report.md"`. No model, effort or tier word beyond what the 10x skill documents.

#### 2. Skill test

**File**: `skills/10x-pipeline/test/openspec-skill.test.mjs` (new)

**Intent**: Content checks of the new skill.

**Contract**: The frontmatter name; the router path `../10x-pipeline/scripts/route.mjs` and its existence relative to the skill folder; `--chain openspec` on every router command line; the anti-stall section equal to the 10x one and in rule form; no model, effort or tier word; every `os-` template in `policy.json` resolves to an existing prompt file.

#### 3. Documentation and manifests

**File**: `AGENTS.md`, `README.md`, `docs/REFERENCE.md`, `skills/10x-pipeline/prompts/README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `docs/ADR/ADR-013-openspec-pipeline.md`

**Intent**: Describe the second chain where a reader looks for it (D12).

**Contract**: `AGENTS.md`: `openspec.mjs` in the module list between `steps.mjs` and `flow.mjs`, run-state ownership of `openspec/changes/<id>/agent-smith/`, the new skill, prompts and test files, `--chain` on the commands. `README.md`: an OpenSpec quick start and the `skills/openspec-pipeline/` layout line. `docs/REFERENCE.md`: a section for `/agent-smith:openspec-pipeline` with requirements, routing, verdict, fix loop, archive, collisions, dropped features and limits (archive date at midnight, file-based reading bounded by the contract test). `prompts/README.md`: the four guides in the Wired table and `{findings}` in the variable list. `plugin.json` and `marketplace.json` descriptions name both chains; `version` stays untouched. ADR-013: a pointer to the REFERENCE section.

### Success Criteria:

#### Automated Verification:

- Skill test passes: `node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields agree: `node tools/version-check.mjs`
- Scratch smoke run: `init <name> --chain openspec --goal "<text>"` and `status <name> --chain openspec` in a scratch OpenSpec project print valid JSON

#### Manual Verification:

- Claude Code lists `agent-smith:openspec-pipeline` when the plugin is loaded from this worktree (for example `claude --plugin-dir <worktree>`)
- One `/agent-smith:openspec-pipeline` run of a small change in a scratch OpenSpec project ends `done` and writes `report.md`

**Implementation Note**: Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Testing Strategy

### Unit Tests:

- Rule form of the four guides and of ADR-013 (`rules.test.mjs`, unchanged).
- Content of the new skill (`openspec-skill.test.mjs`).

### Integration Tests:

- The suite drives the real router through the CLI in scratch projects (`openspec-chain`, `openspec-steps`, `openspec-isolation`, `openspec-archive`), with hermetic git and linked worktrees where isolation is under test.
- The contract test compares the router's file reading with `openspec instructions apply` and skips without the binary, like `GH_LIVE`.
- The existing suite stays green and unedited, which shows the 10x chain is unchanged.

### Manual Testing Steps:

1. Read `evidence/check-3-live.md` and confirm each probe met its criterion.
2. Load the plugin from the worktree and confirm the new skill is listed.
3. Run `/agent-smith:openspec-pipeline` on a small scratch change and read `report.md`.

## Migration Notes

The policy gains `steps` and `prompts` keys, so a 10x run in flight records `provenance.drift` for `steps` and `prompts` at its next `next` call. That changes no routing. A 10x run never gets a `chain` key.

## References

- ADR: `docs/ADR/ADR-013-openspec-pipeline.md`
- Research: `context/changes/openspec-pipeline/research.md`
- Complexity score: `context/changes/openspec-pipeline/complexity.json`
- Guide style: `skills/10x-pipeline/prompts/frame-unattended.md`
- Router seams: `scripts/state.mjs:228`, `scripts/flow.mjs:329`, `:445`, `scripts/steps.mjs:525`, `scripts/isolation.mjs:357`, `:401`, `:489`, `route.mjs:58`, `:229`, `:295`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Preconditions and decision guides

#### Automated

- [ ] 1.1 Check 1 evidence saved in evidence/check-1-skill-reach.md
- [ ] 1.2 Check 2 evidence saved in evidence/check-2-router-path.md
- [ ] 1.3 Check 3 CLI facts saved in evidence/check-3-cli.md with predicate A or B named
- [ ] 1.4 Check 4 evidence saved in evidence/check-4-plugin-discovery.md
- [ ] 1.5 The four decision guides pass rules.test.mjs
- [ ] 1.6 Check 3 live run recorded in evidence/check-3-live.md
- [ ] 1.7 ADR-013 records all four results and passes rules.test.mjs

#### Manual

- [ ] 1.8 Check 3 live evidence shows the unattended steps and the blocked negative probe

### Phase 2: Chain switch, run state and routing order

#### Automated

- [ ] 2.1 openspec-chain.test.mjs passes
- [ ] 2.2 Full suite passes
- [ ] 2.3 helpers.mjs and loops-existing.test.mjs unchanged since 0e49df5

### Phase 3: Step verification, verdict and fix loop

#### Automated

- [ ] 3.1 openspec-steps.test.mjs passes
- [ ] 3.2 openspec-isolation.test.mjs passes
- [ ] 3.3 Full suite passes

### Phase 4: Archive and read-only commands

#### Automated

- [ ] 4.1 openspec-archive.test.mjs passes
- [ ] 4.2 openspec-contract.test.mjs passes against the CLI
- [ ] 4.3 openspec-contract.test.mjs skips without the CLI
- [ ] 4.4 Full suite passes

### Phase 5: Skill and documentation

#### Automated

- [ ] 5.1 openspec-skill.test.mjs passes
- [ ] 5.2 Full suite passes
- [ ] 5.3 version-check.mjs exits 0
- [ ] 5.4 Scratch init and status with --chain openspec print valid JSON

#### Manual

- [ ] 5.5 Claude Code lists agent-smith:openspec-pipeline from the worktree plugin
- [ ] 5.6 One live openspec-pipeline run of a small change ends done with report.md
