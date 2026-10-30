# Archive Adapter Implementation Plan

## Overview

Add an opt-in `--archive` flag to the pipeline. When a run that started with `--archive` reaches `done`, the router commits the whole `context/changes/<id>/` folder in one Conventional Commit, checks that the commit holds only that folder and that the folder is clean, and returns a new `archive` action. The orchestrator then runs `/10x-archive <id>` in one subagent that has its answers to the skill's prompts given as rules, and a read-only `route.mjs verify-archive <id> --path <archivePath>` confirms the move. `/10x-archive` stays unchanged. Nothing writes into the folder after it moves.

This is change 5 of 5 (roadmap S-09). It extends the ADR-003 skeleton that `rigor-levels` writes and uses that change's test harness, `meta.json` persistence and effort floor. Implementation waits for the whole `rigor-levels` change (roadmap S-03) to be merged; see "Dependency on `rigor-levels`".

## Current State Analysis

- `decide()` ends at `return { done: true, reason, manualPending }` (`skills/10x-pipeline/scripts/route.mjs:352-356`). `next()` turns it into `endRun(... { action: "done", ... })` (`:413-417`). That is the only place the adapter hooks in.
- `endRun` writes the log, `meta.json` and `report.md`, then calls `out()`, which calls `process.exit` (`:19-22`, `:178-186`). Git work cannot follow `endRun`, so it has to be split into a write step and a print step.
- `next()` and `init` call `fs.mkdirSync(p.dir, { recursive: true })` before any check (`:403`, `:493`). After the folder moves, a second `next` or `init` would recreate `context/changes/<id>/agent-smith/` and write `run.jsonl`, `meta.json` and `report.md` into it (research section 2, inferred from code, not run).
- `init` rewrites `meta.json` as `{ id, goal }` (`:497`). `rigor-levels` changes this to `{ ...prev, id, goal }`, so a stored `archive` flag survives a resume without a second mechanism.
- `route.mjs` has no git access and imports only `node:fs`, `node:path`, `node:url` (`:12-14`). `rigor-levels` Phase 3 adds `node:child_process`.
- `SKILL.md` knows three actions: `run`, `done`, `halt` (`SKILL.md:36-43`). `done` runs `status` after the router returned, which reads a log that archive moves away. Start step 2 sends the user to `/10x-new` when `change.md` is missing, which is wrong after an archive (`:29`).
- The real `/10x-archive` has two hard blocks: any output from `git status --porcelain context/changes/<id>/`, and a non-zero `git diff --cached --quiet` repo-wide (`~/.claude/skills/10x-archive/SKILL.md:64-94`). It asks a warnings prompt (`Continue archiving` / `Resume implementation` / `Cancel`) and, only with a verified squash-merge mapping, a repoint prompt (`Update and archive` / `Archive without repointing` / `Cancel`) (`:100-143`). It commits `chore(archive): close <id>` and never pushes (`:197-206`, `:239`).
- A normal pipeline run leaves `reviews/`, `plan.md`, `research.md` and `change.md` uncommitted, because `10x-plan`, `10x-plan-review` and `10x-impl-review` do not commit. So committing only `agent-smith/` cannot clear hard block 1 (research section 5). The owner decided on option A: commit the whole change folder.
- `policy.json` has `suffix` text that tells the unattended subagent to choose "the recommended or most conservative option" (`policy.json:53`). For `/10x-archive` that picks `Cancel`. `rigor-levels` Phase 5 rewrites the suffix as rules; either way the archive prompt must state its own answers.
- `docs/ADR/` holds ADR-001 and ADR-002. ADR-003 and the test layout under `skills/10x-pipeline/test/` come from `rigor-levels`.

## Desired End State

- `route.mjs init <id> --goal "..." --archive` stores `archive: true` in `meta.json`. A resume keeps it. `--archive false` turns it off. The flag halts at `init` when the project is not a git work tree or git would ignore any of `agent-smith/run.jsonl`, `agent-smith/meta.json`, `agent-smith/report.md` or `change.md` of the change.
- Without `--archive`, behavior is unchanged: `done` stays `done`, and the router runs no git write.
- With `--archive`, at `done` the router: halts if anything is staged, HEAD is detached, a merge or rebase is in progress, git would ignore one of the four probe files, `change.md` has no valid `created`, the archive destination already exists, or (only when `archive.haltOnManualPending` is `true`, default `false`) Manual rows are pending; writes the final `report.md`, which lists the pending Manual rows; commits `context/changes/<id>/` as `chore(<id>): commit change folder before archive` (skipped when the commit would be empty); checks that nothing is staged, that the commit touched only that folder, and that the folder is clean; returns an `archive` action. A failed git command halts with the git message and no archive. Nothing is left staged by the router after a failed commit.
- The `archive` action carries the done summary, the report path, the expected archive path and a prompt for `/10x-archive`. The archive step runs at effort `high` or above through a pinned tier in `policy.json`.
- `route.mjs verify-archive <id> [--path <archivePath>]` is read-only. It reports `archived: true` only when the archive folder (the one named by `--path`, else the single `context/archive/YYYY-MM-DD-<id>/` match) has `status: archived` in its `change.md` and `context/changes/<id>/` is gone.
- `next`, `init` and `status --report` on an archived change, and on a change whose folder is still in place but whose `change.md` says `status: archived` (half-archived), halt with JSON and write nothing.
- `SKILL.md`, `README.md`, `AGENTS.md`, ADR-003 and PRD FR-008 describe the adapter. ADR-003 records the router's first git write (index and commit writes only). The roadmap S-09 Outcome says "commit the change folder".
- `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new `archive.test.mjs`.

### Key Discoveries:

- The folder to commit includes files the router does not own, so the commit takes the whole `context/changes/<id>/` folder (owner decision A, `research.md` Owner decisions).
- A halt after the commit must not go through the writing `endRun`: it would rewrite `report.md` and `meta.json` and dirty the folder again. Post-commit failures print JSON only. A resumed `next` is idempotent: the log, `meta.json` and `report.md` rewrite to the same bytes, `git diff --cached --quiet` passes after `git add`, and the commit is skipped (`research.md` Open Question 8).
- `attachResult` already deletes `last-result.json` before `done` (`route.mjs:207-209`), so no stray result file exists at commit time. The `archive` action has no `resultFile`, so the orchestrator writes nothing into the folder that moves.
- The archive step has no log entry, no usage figure and no report row. This is the one exception to "each step logs a result" and is recorded in ADR-003.
- `git commit -m <msg> -- <path>` does not protect against a hook that stages another file. Checked in a scratch repo (plan review F2, re-run for this revision): with a `pre-commit` hook that ran `git add hooked.txt`, the commit held both `change.md` and `hooked.txt`, `git diff --cached --quiet` then exited 1, and `git status` showed `D  hooked.txt` plus `?? hooked.txt`. So the "nothing staged" pre-check protects only the state before the commit. Two read-only checks follow the commit: the index is empty, and `git show --name-only --format= HEAD` lists only paths of the change folder.
- `git check-ignore -q -- <dir>` exits 1 for a directory that does not exist, even with `agent-smith/` in `.gitignore`, and misses file patterns. Checked in a scratch repo (plan review F1, re-run for this revision): `.gitignore` = `agent-smith/` gives exit 1 for the absent directory and exit 0 for `agent-smith/run.jsonl`; `.gitignore` = `*.jsonl` gives exit 1 for the directory, exit 0 for `run.jsonl` and exit 1 for `meta.json`; `context/` ignored gives exit 0 for every file below it. File probes work whether or not the file exists, so the adapter probes `run.jsonl`, `meta.json`, `report.md` and `change.md`.
- `verify-archive` must anchor the folder name (`^\d{4}-\d{2}-\d{2}-<id>$`). `/10x-archive` itself matches on a name suffix, which would also accept `2026-01-01-x-<id>`. A reused id leaves two anchored folders, so the router passes the exact `archivePath` it computed, and refuses before the commit when that path already exists (`/10x-archive` would stop with "destination already exists" only after the commit).
- Two write paths remain around the commit and the move besides the missing-folder re-entry: a half-archived folder (`status: archived`, folder not moved) on which `next` would run the `done` branch again; and a pre-check halt on a resumed `next` after the folder was already committed, which `endRun` would turn into a rewrite of `meta.json` and `report.md`. Both are closed (Phase 1 and Phase 3).

## What We're NOT Doing

- Lesson candidates (`lesson-candidates`), pre-plan steps (`pre-plan-steps`), phase executors and manual-row automation (`phase-executors`).
- Any edit to `/10x-archive`, `~/.claude/skills` or `context/archive/`. Any write under `context/changes/<id>/` after the archive step starts.
- Pushing, branch switching, `--no-verify`, signing bypass, detection of protected branches (a refused commit is a failed git command and halts).
- Archiving after a `halt`. A halted run commits nothing and offers no archive; the halt output says so.
- Recording the archive step in `run.jsonl`, in the report table or in the token totals. The report's totals cover the steps before archive only.
- A git read in `verify-archive` (no `git log` check for `chore(archive): close <id>`).
- The SHA repoint (`Update and archive`): it edits `plan.md`. The subagent always answers `Archive without repointing`.
- Warning about a dirty `roadmap.md` in the router. `/10x-archive` already prints that notice; the prompt asks the subagent to copy it into its assumptions.
- Unarchiving, and finishing a change whose folder `/10x-archive` already stamped `archived` but did not move (partial state): `verify-archive` reports it as not archived, `init`, `next` and `status --report` halt without writing, a human fixes it.
- Detecting a staged-but-uncommitted archive (the `chore(archive)` commit failed after the move): `verify-archive` stays file-only, so the orchestrator prints a reminder to check `git status`.
- Staged merging of `rigor-levels`: implementation starts only after the whole change is merged (see "Dependency on `rigor-levels`").
- A human gate on pending Manual rows by default: archiving with pending Manual rows stays the explicit opt-in the owner set. `archive.haltOnManualPending` (default `false`) exists for projects that want the gate.

## Implementation Approach

Build read-only safety first, then data and the flag, then the git work, then docs.

1. Re-entry guard and `verify-archive`: no git, small, and they define what "archived" means for everything after.
2. Policy data (`steps.archive`, `prompts.archive`, `archive` block) and the `--archive` flag with its persistence and `init` checks.
3. The `done` branch: split `endRun`, git layer, pre-checks, commit, clean check, `archive` action, report lines.
4. Orchestrator loop and documentation, then one real end-to-end run on a throwaway repo.

### Decisions on the research's open questions

Question 1 is decided by the owner (option A). The rest are decided here with the research's proposed rules and are listed as assumptions in the brief.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Commit scope | Owner: `git add -- context/changes/<id>` and one commit of that path. |
| 2 | Message, attribution | `chore(<id>): commit change folder before archive`, from `policy.archive.commitMessage` (`{id}` is replaced). No body, no co-author trailer: the user's git identity and hooks apply. Never `--no-verify`. |
| 3 | Git state | Any git failure halts with the git message and no archive. Explicit pre-checks: inside a work tree, no probe file ignored, HEAD attached, no merge, rebase, cherry-pick or revert in progress, nothing staged, archive destination free. A refused or failed commit unstages the router's own `git add` before halting. After the commit: index empty, commit touched only the change folder, folder clean (a hook can stage or rewrite other files; review F2). |
| 4 | Run not `done` | No commit, no archive. A halt with `--archive` set carries `archive: "skipped: run halted"` and the report says `Archive: not run (run halted)`. `SKILL.md` tells the user the folder is uncommitted and a later `/10x-archive` needs a commit first. |
| 5 | No git, ignored files | `--archive` halts at `init` (before writing anything) when the project is not a git work tree or `git check-ignore -q` exits 0 for any of the probe files `agent-smith/run.jsonl`, `agent-smith/meta.json`, `agent-smith/report.md` and `change.md` (probing the directory is wrong: it exits 1 while absent and misses file patterns; review F1). The same checks run again at `done`. Whether `git mv` carries ignored files was not tested, so an ignored file is refused instead of guessed. |
| 6 | `verify-archive` scope | File checks only. No git read. Optional `--path <archivePath>` names the exact folder (review F4, Fix A); the orchestrator reminds the user to check `git status`. |
| 7 | Re-entry | `next`, `init` and `status --report` halt when the change folder is missing and an anchored archive folder exists, and when `change.md` says `status: archived` (half-archived). They write nothing. |
| 8 | Second `done`, same state | Skip the commit when `git diff --cached --quiet` passes after `git add`. The run still returns `archive`. A pre-check halt on such a resume prints JSON only when the folder is already committed and clean (`report.md` tracked, no status output for the folder). |
| 9 | Archive step in the report | Accepted: no usage figure is recorded. The orchestrator copies any usage the Agent result reports into its final message only. |
| 10 | Dirty `roadmap.md` | No router check. The archive prompt asks the subagent to copy any warning or roadmap notice into `assumptions`. |
| 11 | Pending Manual rows at `done` (review F5) | Archiving stays an explicit opt-in. The final `report.md` lists them (`Manual checks pending: N` and the rows), because it is the only router artifact that survives the move; `SKILL.md` repeats them in the final message. `archive.haltOnManualPending` (default `false`) halts before the commit instead. |
| 12 | Archive destination exists (reused id, same day) | Pre-check halt before the commit: `context/archive/<created>-<id>` must not exist. |

### Dependency on `rigor-levels`

This plan builds on the approved `rigor-levels` plan (reviewed SOUND, 2026-10-30). **Implementation of `archive-adapter` starts only after the whole `rigor-levels` change (roadmap S-03) is merged.** `rigor-levels` is one change on one branch, and the roadmap gates S-09 on S-03 as a whole ("waits for S-03 to merge"); nothing in its plan lands phases separately, so staged merging is unsupported. Research and planning do not wait. The phase numbers below name which `rigor-levels` phase delivers each thing this plan reuses; they are not merge checkpoints. It reuses these names and mechanisms and defines none of them again:

- `{ ...prev, id, goal }` in `init`, so `meta.archive` persists with `meta.rigor` and `meta.baseSha`; flag validation before any write; the outer `try/catch` in the dispatch that prints `{ "action": "halt", "reason": "Router error: ..." }`.
- Skip entries in `run.jsonl`, the "executed entries" helper, and the `Skipped steps` report section: the archive adapter reads the log only to write it out, and uses the executed count where it prints `steps`.
- `endRun` and `buildReport` changes (`Rigor:` line, skip section, totals).
- `steps.<name>.interactive` and `rigor.minEffort`, the effort floor in `tierFor`.
- The test layout `skills/10x-pipeline/test/` with `helpers.mjs` (scratch project, `writeLog`, `gitEnv()`), the rule-form test `rules.test.mjs`, and the Node 18 ban list.
- ADR-003 (skeleton with a table of parts owned by later changes) and ADR-004 (rule form).

| This plan | Uses from `rigor-levels` (all merged before this change starts) |
| --- | --- |
| Phase 1: guard and `verify-archive` | Phases 1 and 2 (test harness, `try/catch` dispatch, `init` spread) |
| Phase 2: policy data and `--archive` | Phases 1 and 2 (rule-form test, `interactive` flag, flag-validation pattern) |
| Phase 3: `done` branch | Phases 1 to 5 (rewritten `next()`, `endRun`, `buildReport`, `needsHuman` halt, executed-count helper) |
| Phase 4: orchestrator and docs | Phase 6 (ADR-003 skeleton, `SKILL.md` and `README.md` rigor text, `AGENTS.md` test command) |

Shared edits: both plans edit the usage string in `route.mjs` (`rigor-levels` adds its flags; this plan adds `[--archive]` and `verify-archive`). The later change extends the string `rigor-levels` wrote and does not overwrite it. The same holds for the `lesson-candidates` change, which merges after this one.

Git layer: `rigor-levels` Phase 3 adds an `execFileSync` wrapper that turns every failure into "unavailable". The adapter needs the exit status and stderr. Phase 2 below adds one wrapper `runGit(args, opts)` returning `{ status, stdout, stderr }` that never throws; since `rigor-levels` is merged first, put `runGit` beside its wrapper and let that wrapper call it.

## Phase 1: Re-entry guard and `verify-archive`

### Overview

Make an archived change safe to touch and give the orchestrator a read-only way to confirm an archive. No git, no policy change.

### Changes Required:

#### 1. Archived-folder lookup and re-entry guard

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: One helper finds the archive folder of a change id. `init` and `next` check it before their first `mkdirSync`: when `context/changes/<id>/` is missing and an archive folder exists, print a JSON `halt` that names the archive path and exit 1 without writing. `status --report` already refuses a missing change folder; it gets the same message. A second check covers the half-archived state: when the change folder exists and its `change.md` already says `status: archived` (`/10x-archive` stamped it and did not move it), the same three commands halt without writing.

**Contract**: `archiveDirs(id)` lists `context/archive/` with `fs.readdirSync` (empty list when the directory is missing) and keeps names matching `^\d{4}-\d{2}-\d{2}-<id>$` (the id is already restricted to `[a-z0-9-]` by `:485`). Halt reason: `Change <id> is archived at <path>. Nothing was written.` Half-archived halt reason: `Change <id> is stamped archived but its folder was not moved. Nothing was written; finish or undo /10x-archive by hand.` It reads `status` with the same frontmatter reader as `verify-archive` (first `---` block, quotes stripped) and runs before the first `mkdirSync` in `init` and `next`. Plain `status` stays read-only and unchanged. The archive-folder guard fires only when the change folder is missing; a live folder with a same-named archive is left to `/10x-archive`.

#### 2. `verify-archive` command

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A read-only command that answers "did the archive succeed" from files alone, including the partial-failure state `/10x-archive` documents (`status: archived` in the old folder, folder not moved), and a reused id that left two archive folders.

**Contract**: `route.mjs verify-archive <id> [--path <archivePath>]` prints JSON and exits 0 when archived, 1 otherwise. With `--path`, only that folder is checked: it must be a direct child of `context/archive/` whose name matches the anchored pattern for this id, else `{ "archived": false, "reason": "--path is not an archive folder of <id>" }` and nothing is read outside `context/archive/`. Without `--path`, the folder is the single `archiveDirs(id)` match. Archived means: the folder is found, its `change.md` frontmatter (first `---` block) has `status: archived` (quotes stripped), and `context/changes/<id>/` does not exist. Output when archived: `{ "archived": true, "path": "context/archive/<name>", "archivedAt": "<value or null>", "report": "<path>/agent-smith/report.md" | null }`. Output otherwise: `{ "archived": false, "reason": "..." }` with a distinct reason for: no archive folder, more than one match without `--path` (list them and name `--path`), `change.md` missing or not `archived`, change folder still present. It uses `fs.readdirSync`, `fs.readFileSync`, `fs.existsSync` only, never `paths()` or `mkdirSync`, and never calls git, so a staged-but-uncommitted archive still reads as `archived: true` (the orchestrator reminds the user to check `git status`). Extend the usage string at `:486` that `rigor-levels` already changed (add `verify-archive <id> [--path <p>]`; do not overwrite its flags) and the header comment (`:6-9`).

#### 3. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Black-box tests through the CLI, using `helpers.mjs` from `rigor-levels`.

**Contract**: Cases: guard halts `next` and `init` when only the archive folder exists, exit 1, JSON, and `context/changes/` stays absent; `init`, `next` and `status --report` halt on a live folder whose `change.md` says `status: archived` and leave the tree byte-identical; with two anchored archive folders (reused id) `verify-archive demo` returns false listing both and `verify-archive demo --path context/archive/<date>-demo` returns true for a correct one, and `--path` with a suffix-collision name, a path outside `context/archive/` or a folder of another id returns false without reading it; a suffix-collision folder (`2026-01-01-x-demo`) does not trigger the guard for `demo`; `status demo` without `--report` still prints an empty log; `status demo --report` halts with the archive path; `verify-archive` returns `archived: true` with `path` and `report`; returns false with the specific reason for each of: no archive, two matches, status not `archived`, change folder still present with `status: archived` (partial failure); a suffix-collision folder alone gives false; the command leaves the project tree byte-identical (compare a recursive listing with mtimes before and after) and still answers when `PATH` holds no `git`.

### Success Criteria:

#### Automated Verification:

- Guard and `verify-archive` tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- In a scratch folder with a hand-made `context/archive/2026-10-30-demo/change.md` (`status: archived`), `verify-archive demo` prints `archived: true`, and `init demo` halts without creating `context/changes/`

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Archive policy data and the `--archive` flag

### Overview

Add the data the adapter reads (pinned archive tier, prompt, commit message) and the opt-in flag with its persistence and early checks. No commit and no `archive` action yet.

### Changes Required:

#### 1. Policy keys and the archive prompt

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Pin the archive step to a tier with effort `high` or above, hold the commit message template, and give the archive subagent its answers as rules, because the generic suffix would pick `Cancel`. A subagent has no `AskUserQuestion`, so `/10x-archive` falls back to a plain-text question and waits; the rules therefore give the answers in advance and forbid asking (review F3).

**Contract**: `steps.archive`: `{ "skill": "10x-archive", "baseTier": 3, "minTier": 3, "maxTier": 3, "interactive": true }`. With the shipped ladder tier 3 is `sonnet`/`high`; the `minTier` pin is what guarantees the floor, so a lower `minEffort` at `lean` cannot lower it. New top-level `archive`: `{ "commitMessage": "chore({id}): commit change folder before archive", "gitTimeoutMs": 120000, "haltOnManualPending": false }`. New `prompts.archive`: first line `Run /10x-archive {id}`, then one rule per line, each starting with `- `, each in GIVEN/WHEN/THEN form with exactly one bold keyword (ADR-004). The rules are:

- **GIVEN** `/10x-archive` would ask its warnings question and every warning is pending Manual Progress rows only, Progress rows without a SHA suffix, or a status other than `implemented` or `impl_reviewed` **WHEN** you are an unattended subagent **THEN** you **MUST** proceed as if the answer were `Continue archiving` (the label may read `Continue archiving (Recommended)`; match the prefix).
- **GIVEN** `/10x-archive` would ask its SHA repoint question **WHEN** you are an unattended subagent **THEN** you **MUST** proceed as if the answer were `Archive without repointing` (the Polish label `Archiwizuj bez podmiany` is the same answer).
- **GIVEN** `/10x-archive` tells you to ask a question as plain text and wait because no question tool exists **WHEN** the question is one of the two above **THEN** you **MUST NOT** ask it or end your turn to wait, and continue in the same turn with the answer given above.
- **GIVEN** the warnings include `Uncertain review coverage`, `Missing review coverage for phases`, `No impl-review found`, `No plan.md found` or a pending Automated row, or `/10x-archive` asks any other question or stops on a hard block **WHEN** you cannot continue **THEN** you **MUST** finish with status `blocked` and the printed reason in `note`.
- **GIVEN** these rules and the generic unattended rules disagree about an archive question **WHEN** you pick an answer **THEN** these rules **MUST** win.
- **GIVEN** `/10x-archive` prints a warning or a roadmap notice **WHEN** you write the RESULT line **THEN** you **MUST** copy each one into `assumptions`.
- **GIVEN** `/10x-archive` has finished or stopped **WHEN** you have more to do **THEN** you **MUST NOT** write any file under `context/changes/{id}/` or `context/archive/`.

Each rule line holds exactly one bold keyword. The suffix (RESULT line, no-commit sentence) is appended by the router as for every prompt. Keys camelCase, step name kebab-case.

#### 2. `--archive` flag, persistence and `init` checks

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Store the opt-in in `meta.json` through the `rigor-levels` spread, validate it before anything is written, and refuse a project where the adapter cannot work. Add the git wrapper both `init` and Phase 3 use.

**Contract**: `init` reads `flags.archive`: bare flag or `true` sets `meta.archive = true`; `false` sets `false`; any other value halts with JSON and writes nothing. No flag keeps the stored value; absent stays absent. When the result is `true`, `init` runs `git rev-parse --is-inside-work-tree`, then `git check-ignore -q -- <file>` for each of `context/changes/<id>/agent-smith/run.jsonl`, `.../agent-smith/meta.json`, `.../agent-smith/report.md` and `context/changes/<id>/change.md`. Not a work tree, or any probe exiting 0 (ignored), halts with a message naming the cause and the ignored path, and writes nothing. Probe files, never the directory: `git check-ignore` on a directory that does not exist yet exits 1 whatever `.gitignore` says, and a directory probe misses file patterns such as `*.jsonl` (review F1). A probe works for a file that does not exist yet. One helper `ignoredProbePaths(id)` returns the ignored paths and is reused at `done`. `runGit(args, opts)` uses `execFileSync("git", args, { cwd: ROOT, encoding: "utf8", timeout, maxBuffer, stdio: pipe })` with no shell, and returns `{ status, stdout, stderr }` for any outcome including a missing `git` (status 127) or a timeout. It never throws. Extend the usage string that `rigor-levels` already changed with `[--archive]`; do not overwrite its flags. Follow the Node 18 ban list of `rigor-levels` Phase 2.

#### 3. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Cover the flag, its persistence and the early refusals. Git fixtures use `gitEnv()`.

**Contract**: Cases: `--archive` stores `archive: true`; a second `init` without the flag keeps it; `--archive false` stores false and a later bare resume keeps false; `--archive maybe` halts and `meta.json` is not written; a directory that is not a git repo halts for `--archive` and writes nothing; a `.gitignore` containing `agent-smith/` halts for `--archive` while `context/changes/<id>/agent-smith` does not exist yet and names the ignored path; a `.gitignore` containing `*.jsonl` halts (names `run.jsonl`); a `.gitignore` containing `context/` halts (names `change.md` or the first ignored probe); a `.gitignore` that ignores none of the four files lets `--archive` pass; `init` without `--archive` in a non-git directory still works and `meta.json` has no `archive` key; `policy.prompts.archive` holds the answer strings (`Continue archiving`, `Archive without repointing`, `Archiwizuj bez podmiany`, `Uncertain review coverage`, `Missing review coverage`, `blocked`) and says `MUST NOT` about asking; `steps.archive` resolves to a ladder entry whose effort is `high`, `xhigh` or `max`; `commitMessage` matches `^chore\(\{id\}\): `; `archive.haltOnManualPending` is `false`. The rule-form test from `rigor-levels` Phase 1 covers the prompt lines without a new test.

### Success Criteria:

#### Automated Verification:

- Flag, persistence and policy tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Rule-form test passes on the archive prompt: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- `policy.json` carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.steps.archive||!p.archive.commitMessage||p.archive.haltOnManualPending!==false||!p.prompts.archive)process.exit(1)'`

#### Manual Verification:

- In a scratch git repo, `init demo --goal "fix typo" --archive` returns a `run` for `plan` and `meta.json` holds `"archive": true`; in a folder without git the same command halts with a clear reason
- The `prompts.archive` text reads as seven rules, each with one bold keyword

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: The `done` branch — commit, clean check, `archive` action

### Overview

When `--archive` is set and the run reaches `done`, check git state, write the final report, commit the change folder, verify the index is empty, the commit holds only the folder and the folder is clean, and return the `archive` action. Add the report lines. Halts on the way never leave the repo half-staged by the router, and a halt after the commit never rewrites the committed folder.

### Changes Required:

#### 1. Split `endRun`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Make the write step reusable without exiting. `endRun` becomes `out(finishRun(...))`, so every existing end branch keeps its behavior, report included.

**Contract**: `finishRun(p, id, meta, log, result)` does what `endRun` does today up to the print (log, `meta.outcome`, `report.md`, `reportError`) and returns the result object plus `report`. `meta.outcome` accepts an optional `archive` field from `result`. After the `rigor-levels` changes it keeps their `executed` count wherever it prints `steps`.

#### 2. Pre-checks, commit, clean check

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `next()`, branch on `d.done && meta.archive === true`. Run the pre-checks first. A pre-check failure ends the run as a normal `halt` through `endRun` (the folder is not committed yet, so writing the report there is correct), except on a resumed `next` whose folder is already committed and clean: there the halt prints JSON through `out()` only, because `endRun` would rewrite `meta.json` and `report.md` with a `halt` outcome and dirty the committed folder (review F7). Then `finishRun` for `done`, then commit, then verify. Every failure after the commit prints JSON through `out()` only.

**Contract**: Pre-checks, in order, each a `halt` with the cause: `git rev-parse --is-inside-work-tree`; `ignoredProbePaths(id)` non-empty (the four file probes of `init`, naming the ignored paths); `git symbolic-ref -q HEAD` fails (detached); a `MERGE_HEAD`, `REVERT_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge` or `rebase-apply` entry under `git rev-parse --git-path <name>`; `git diff --cached --quiet` exit 1 (staged; the halt lists `git diff --cached --name-only`); `change.md` `created:` not `YYYY-MM-DD`; `fs.existsSync(archivePath)` (halt: `Archive destination <archivePath> already exists; a reused id on the same date needs a human.`); `policy.archive.haltOnManualPending === true` with a non-empty `manualPending` (halt listing the rows). "Already committed and clean" means `git ls-files --error-unmatch -- context/changes/<id>/agent-smith/report.md` succeeds and `git status --porcelain -- context/changes/<id>/` prints nothing; the pre-check halt is print-only in that state. Commit: `git add -- context/changes/<id>`; if `git diff --cached --quiet` exits 0, skip the commit and set `commit: null`; else `git commit -m <message> -- context/changes/<id>` with the message from `policy.archive.commitMessage` (non-string or blank halts with a clear reason) and `gitTimeoutMs`. On a failed `add` or `commit`, run `git reset -q -- context/changes/<id>` (best effort) and halt with the first lines of git's stderr. Post-commit checks, in order, each a print-only halt that says the commit already exists, is local and is not undone by the router: (1) `git diff --cached --quiet` must exit 0, else list `git diff --cached --name-only` (a hook staged something); (2) when this call made a commit, `git show --name-only --format= HEAD` must list only paths under `<prefix>context/changes/<id>/`, where `<prefix>` is the output of `git rev-parse --show-prefix`, else name the extra paths; (3) `git status --porcelain -- context/changes/<id>/` must be empty, else list up to ten paths. Everything in the folder is committed, including editor junk such as `.DS_Store`. The commit lands on the current branch, protected or not. Git runs with the caller's environment; the router sets no `-c` overrides, so hooks and signing config apply.

#### 3. `archive` action payload and report lines

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Hand the orchestrator everything it needs before the folder moves, and keep `resultFile` out of the payload. Mark the report so a reader of the archived copy knows the archive ran after it was written.

**Contract**: Tier comes from `tierFor` for step `archive` with the same arguments as any step (no log entry is appended, `log` and `meta.rigor` are passed as for other steps). Payload, which `SKILL.md` and the tests depend on:

```json
{
  "action": "archive",
  "model": "<ladder model>",
  "effort": "<ladder effort>",
  "reason": "run done; <committed <short sha> | folder already committed>; tier N (<tierWhy>)",
  "prompt": "<prompts.archive rendered with id> + suffix",
  "summary": { "reason": "...", "manualPending": ["..."], "steps": 0 },
  "report": "context/changes/<id>/agent-smith/report.md",
  "archivePath": "context/archive/<created>-<id>",
  "commit": "<short sha> | null"
}
```

No `resultFile`, no `n`, no log entry. `archivePath` is the exact folder `SKILL.md` passes to `verify-archive --path`. `buildReport` adds one line after `Outcome:` when `meta.archive === true`: `Archive: requested - runs after this report was written; see the commit "chore(archive): close <id>"` when the outcome is `done`; `Archive: not run (run halted)` for any other end. When `meta.archive === true` and the outcome is `done`, it also writes `Manual checks pending: N` followed by one bullet per pending Manual row (from the `done` result's `manualPending`, kept in `meta.outcome` next to `archive`); with none pending it writes nothing. This is the only place the skipped checks survive the move (review F5). Table, totals and `Steps:` stay as they are. A halt with `meta.archive === true` carries `archive: "skipped: run halted"` in its output. `next` on a run whose last end was `archive` simply repeats the sequence (idempotent: no second commit).

#### 4. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Real git in scratch repos, a `writeLog` fixture for a finished run, `next` through the CLI. `helpers.mjs` `run` gets an optional `env` argument (if `rigor-levels` did not add one) so the router process receives `gitEnv()`, an identity and no global config.

**Contract**: Cases: full path returns `archive` with the payload fields, no `resultFile`, `run.jsonl` has the same entry count, effort is `high` or above, `git log -1 --format=%s` equals the default message, `git status --porcelain -- context/changes/demo` is empty, `git diff --cached --quiet` passes, and the commit contains `reviews/impl-review.md`, `plan.md`, `change.md` and `agent-smith/report.md`; `report.md` holds the `Archive: requested` line and `meta.json` outcome is `done`; second `next` with no changes returns `archive` with `commit: null` and the commit count is unchanged; a run without `--archive` returns `done` and makes no commit; staged file halts with the path listed and no commit; detached HEAD halts; a `MERGE_HEAD` file halts; failing `pre-commit` hook halts with the hook's output and leaves nothing staged; a `post-commit` hook that creates `stray.txt` in the folder halts with the path listed, writes nothing (`report.md` and `meta.json` unchanged by the halt) and a repeat after removing the file returns `archive`; `change.md` without `created` halts before any commit; budget-spent halt with `--archive` carries `archive: "skipped: run halted"`, makes no commit and the report says `Archive: not run`; the Archive line does not change the `Steps:` count; commit message override (`policy.archive.commitMessage`) is used; `verify-archive` after a simulated `git mv` plus stamp returns `archived: true`. Added for the review: a `pre-commit` hook that stages an unrelated file makes `next` halt after the commit, the halt names the extra path and says the commit exists, `report.md` and `meta.json` are byte-identical before and after the halt; a `.gitignore` entry added after `init` (`agent-smith/`, then `*.jsonl`) halts at `done` before any commit; an existing `context/archive/<created>-demo` halts before any commit; after a first `next` returned `archive`, a staged unrelated file makes the second `next` halt with JSON only and `meta.json`, `report.md` and `git status --porcelain -- context/changes/demo` stay unchanged; a stray file in the folder (for example `.DS_Store`) is part of the commit; `report.md` lists `Manual checks pending: 2` and both rows when two Manual rows are pending and has no such line when none are; with `archive.haltOnManualPending: true` in `context/foundation/agent-smith-policy.json` a pending Manual row halts before the commit and the default continues; a recording `git` shim first on `PATH` (logs argv, then runs the real `git`) during the full path shows only the allowed subcommands (`rev-parse`, `check-ignore`, `symbolic-ref`, `diff`, `status`, `add`, `commit`, `reset`, `show`, `ls-files`) and no `push` and no `--no-verify` (test name contains `git subcommands`).

### Success Criteria:

#### Automated Verification:

- Adapter tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Existing routing and report tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The router never pushes or skips hooks: `! grep -nE "[\"']push[\"']|git push|--no-verify|--no-gpg-sign" skills/10x-pipeline/scripts/route.mjs && node --test --test-name-pattern="git subcommands" skills/10x-pipeline/test/archive.test.mjs`

#### Manual Verification:

- In a scratch git repo, a finished run with `--archive` leaves one new commit `chore(demo): commit change folder before archive` and `git status` clean for the change folder
- `route.mjs next demo` prints an `archive` action whose prompt lists the seven rules and whose `archivePath` matches `change.md` `created`
- In a scratch repo with a `pre-commit` hook that stages an unrelated file, `next demo` halts after the commit, names the extra path, and leaves `meta.json` and `report.md` unchanged by the halt

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Orchestrator loop, documentation and end-to-end run

### Overview

Teach the orchestrator the `archive` action and document the adapter and its git write, and fix the roadmap wording. Finish with one real run.

### Changes Required:

#### 1. `SKILL.md`

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add `--archive` to the arguments, the `archive` action to the loop, and the guard against touching the router after the move. Fix Start step 2 for an archived change. Keep relative wording; no model, effort or tier names. Add a bullet to "How the tier moves" (`AGENTS.md` asks for it when tier data changes).

**Contract**: `argument-hint` gains `[--archive]`; Start parses it and passes `--archive` to `init` only when the user gave it, removing it from the goal text. Start step 2: when `change.md` is missing, first run `node $ROUTER verify-archive <change-id>` (no `--path`); if archived, tell the user where and STOP; otherwise the existing `/10x-new` message. "How the tier moves" gains one bullet in relative wording: the archive step is not moved by any rule above, its tier is pinned by the policy. Loop gets **`archive`**: (1) run `node $ROUTER status <change-id>` now, before the move, and report what `done` reports (final verdict from `summary.reason`, steps, every `summary.manualPending` item as a checklist, the per-step list, the `report` path); (2) print one line `Archive: /10x-archive on <model>/<effort>.`; (3) call the Agent tool with the router's `prompt` verbatim and the same parameters as for `run`; (4) do not write a result file and do not call `next`; (5) run `node $ROUTER verify-archive <change-id> --path <archivePath>` with the `archivePath` of the `archive` action; on `archived: true` print the archive path and the report path inside it, print one line telling the user to confirm `git status` is clean (`verify-archive` reads files only; if the `chore(archive)` commit failed, the rename is staged and uncommitted), repeat every `manualPending` item as the checklist of checks nobody verified, and copy the subagent's `assumptions` and any usage figure it reported into the final message; on `archived: false` print `reason` and the subagent's note, say the folder may be unchanged or half-archived, and STOP. `halt` gains: when the output has `archive`, say the run was not committed or archived and that `/10x-archive` needs the change folder committed first. Rules gain: after `archive` never run `init`, `next` or `status --report` for that change.

#### 2. `README.md`

**File**: `README.md`

**Intent**: Document usage and behavior for readers.

**Contract**: Skill usage line `/agent-smith:10x-pipeline <change-id> [goal] [--archive]`. New "Archive (opt-in)" bullet group: what `--archive` does at `done`, the commit message, the staged-files, post-commit and clean-folder checks, that the router never pushes, that the commit lands on the current branch (protected branches such as `main` are not detected), that everything in the change folder is committed (editor junk such as `.DS_Store` too), that a halted run is not archived, the `verify-archive <id> [--path <p>]` command (file checks only; check `git status` afterwards), the report's totals not covering the archive step, the ignored-file refusal (any of `run.jsonl`, `meta.json`, `report.md`, `change.md`), the pending Manual rows listed in `report.md`, and the `archive.haltOnManualPending` key (default `false`). Layout block unchanged beyond what `rigor-levels` added. Same facts as `SKILL.md` and ADR-003. No version bump.

#### 3. `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Keep the contributor guide true now that the router can write to git.

**Contract**: Commands list gains `verify-archive <id>` and the `--archive` flag on `init`. The Hard Rules bullet about `route.mjs` ownership adds: the router's only git writes are the index and commit writes of the pre-archive commit in the `done` branch (`git add`, `git commit`, and a `git reset` of its own add after a failure); it never pushes. Testing section already names `node --test ...` (from `rigor-levels`). Keep every other rule.

#### 4. ADR-003 section

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the router's first git write and the FR-008 outcome, in the skeleton `rigor-levels` wrote. Flip the part owned by this change from `planned` to described.

**Contract**: One section "Archive adapter" under Decision. In the table of parts, rename the skeleton row `archive-and-lessons` to `archive-adapter` and add a separate `lesson-candidates` row (owned by the next change). It states: with `--archive` the router commits the change folder including `agent-smith/`, which settles the FR-008 deferral ("git handling is decided downstream"); without the flag the router never touches git, and with it the router's git writes are limited to `git add`, `git commit` and a `git reset` of its own add; the commit lands on the current branch (protected branches are not detected) and is never pushed; it includes every file in the folder, editor junk too; the commit is checked after the fact (index empty, only the folder touched) because a hook can stage other files; the archive step has no log entry, no usage figure and no report row; the report line `Archive: requested` stays in the archived copy; alternatives considered (commit only `agent-smith/` and halt on other dirty paths, which cannot succeed on a normal run; gitignore `agent-smith/`; require a human commit first; change `/10x-archive`). Consequences: a halted run is not archived; Manual rows pending at `done` raise the warnings prompt that the subagent has `Continue archiving` given as its answer, and are listed in `report.md` (or halt the run when `archive.haltOnManualPending` is `true`); an ignored probe file (`run.jsonl`, `meta.json`, `report.md`, `change.md`) is refused; a post-commit failure leaves the commit in place and a resume repeats safely, printing JSON only; `verify-archive` is file-only, so a staged-but-uncommitted archive reads as archived and the orchestrator reminds the user to check `git status`; a git timeout kills git but may leave a hung hook child and a stale `index.lock`. The rules below appear as GIVEN/WHEN/THEN lines outside fenced blocks, checked by the `rigor-levels` rule-form test:

- **GIVEN** a run started without `--archive` **WHEN** the router reaches `done` **THEN** it **MUST NOT** run a git command that writes the index or history.
- **GIVEN** `--archive` is set **WHEN** anything is staged, HEAD is detached or a merge or rebase is in progress **THEN** the router **MUST** halt before it commits.
- **GIVEN** a git command fails during the pre-archive commit **WHEN** the router handles the failure **THEN** it **MUST** halt with the git message and skip the archive.
- **GIVEN** the router commits the change folder **WHEN** a commit hook fails **THEN** the router **MUST NOT** pass `--no-verify`.
- **GIVEN** the change folder is committed **WHEN** the archive action has been returned **THEN** the router **MUST NOT** write under `context/changes/<id>/`.
- **GIVEN** the pre-archive commit succeeded **WHEN** the run ends **THEN** the router **MUST NOT** push.

#### 5. PRD FR-008 note

**File**: `context/foundation/prd.md`

**Intent**: Close the deferral recorded in FR-008's Socrates note.

**Contract**: Edit the FR-008 entry only: a dated note (2026-10-30, from `archive-adapter`) that git handling is resolved: with `--archive` the change folder, including `agent-smith/`, is committed before archive; otherwise the router does not use git. Keep the note to one line so the criterion below does not depend on line counts.

#### 6. Roadmap S-09 Outcome wording

**File**: `context/foundation/roadmap.md`

**Intent**: The Outcome still says "commit its run state", but the plan commits the whole change folder (owner decision A). `/10x-archive` closes S-09 and copies that Outcome text into the `## Done` entry, so it must be true. The `planning` status flip done by `/10x-plan` stays as it is.

**Contract**: In the S-09 row of the "At a glance" table and in the S-09 item body, replace "commit its run state" with "commit the change folder". Touch nothing else in the file.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The adapter is documented in all places: `for f in skills/10x-pipeline/SKILL.md README.md AGENTS.md docs/ADR/ADR-003-rigor-gated-routing.md; do grep -q "verify-archive" "$f" || exit 1; done`
- `SKILL.md` names no model, effort level or absolute tier: `! grep -Eiq "haiku|sonnet|opus|xhigh|tier [0-9]|effort[^.]{0,40}\b(low|medium|high|max)\b|\b(low|medium|high|max)\b[^.]{0,20}effort" skills/10x-pipeline/SKILL.md`
- `SKILL.md` documents the flag and the action: `grep -q -- "--archive" skills/10x-pipeline/SKILL.md && grep -q '`archive`' skills/10x-pipeline/SKILL.md`
- PRD FR-008 carries the note: `sed -n '/FR-008:/,/^- \[/p' context/foundation/prd.md | grep -q "archive-adapter"`
- Nothing under `context/archive/` changed: `test "$(git diff --name-only main -- context/archive | wc -l)" -eq 0`
- Manifests untouched: `test "$(git diff --name-only main -- .claude-plugin | wc -l)" -eq 0`

#### Manual Verification:

- End to end on a throwaway git repo with a trivial change: `/agent-smith:10x-pipeline demo "fix typo" --archive` ends with commits `chore(demo): commit change folder before archive` and `chore(archive): close demo`, `verify-archive demo` prints `archived: true`, and `context/archive/<date>-demo/agent-smith/report.md` exists
- In that run the archive subagent, which has no question tool and so takes the skill's plain-text path, answered the warnings prompt with `Continue archiving` (pending Manual rows trigger it), did not stop with `blocked` and ended with a `RESULT:` line; its `assumptions` and the pending Manual rows appear in the final message and the Manual rows in the archived `report.md`
- A second run with a deliberately staged file halts before any commit and the output says the run was not archived
- `SKILL.md`, `README.md`, ADR-003 and `route.mjs` describe the same sequence (pre-checks, commit, clean check, action, verify)
- PRD FR-008 and ADR-003 agree on the git decision
- The S-09 row and item in `context/foundation/roadmap.md` say "commit the change folder" and nothing else in that file changed except the `planning` status

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation. The change then goes to plan review and implementation review.

---

## Testing Strategy

### Unit Tests:

- No function-level tests of `route.mjs`: it exports nothing and runs on import. The CLI is the unit (as in `rigor-levels`).
- `rules.test.mjs` from `rigor-levels` checks the archive prompt lines and the ADR-003 rule lines.

### Integration Tests:

- `archive.test.mjs`: scratch project per test; real `route.mjs` through `spawnSync`; hermetic git (`gitEnv()` for the test and for the router subprocess). Guard, `verify-archive` (including a tree-unchanged check), flag and persistence, pre-checks, commit, hook failures, idempotent repeat, report lines, no-`--archive` regression. Git-dependent cases skip with a clear message when `git` is missing.
- Log fixtures come from `writeLog` in `helpers.mjs`; AGENTS.md forbids hand edits only for real runs.
- Node 18 is the supported floor: follow the Node 18 ban list of `rigor-levels` Phase 2. Run `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` once before the PR; if Node 18 cannot be run, the PR says so.

### Manual Testing Steps:

1. Phase 4 end-to-end run on a throwaway repo with real `/10x-archive` (the only check that exercises the prompt answers against the real skill).
2. In that repo, try `--archive` with `agent-smith/` in `.gitignore` and expect the refusal at `init`.
3. Interrupt the orchestrator after the `archive` action but before the Agent call, re-run `init`, and expect the same `archive` action with `commit: null`.

## Performance Considerations

About ten local git calls once per run, at `done`. The commit may run the project's hooks; `policy.archive.gitTimeoutMs` (120 s) bounds git and a timeout halts with the git message. A timeout kills git but not a hook child it started: the child may keep running, and the best-effort `git reset` after the failure can meet a stale `.git/index.lock`. The halt message says so. A hook that rewrites files in the folder is caught by the clean check; a resume re-adds and re-commits, and a hook that never converges needs a human.

## Migration Notes

Existing `meta.json` files have no `archive` key and behave as before. The re-entry guard changes one existing behavior: `init` or `next` on a change that was archived by hand now halts instead of recreating `context/changes/<id>/agent-smith/`. A run in flight when the router is upgraded can opt in at its next `init --archive`. A change already stamped `status: archived` but not moved (partial `/10x-archive` failure) is reported as not archived by `verify-archive`, makes `init`, `next` and `status --report` halt without writing, and needs a human.

## References

- Related research: `context/changes/archive-adapter/research.md` (including Owner decisions), `context/changes/rigor-levels/research.md` (section 4, Follow-up 1 "Archive adapter")
- Contract plan: `context/changes/rigor-levels/plan.md` and its plan review, both approved SOUND on branch `rigor-levels-plan-review-2`
- Plan review of this change: `context/changes/archive-adapter/reviews/plan-review.md` (verdict REVISE; findings F1 to F9 are resolved in this revision)
- Router: `skills/10x-pipeline/scripts/route.mjs:178-186` (`endRun`), `:352-356` (`done`), `:401-417` (`next`), `:484-505` (dispatch, `init`)
- Orchestrator: `skills/10x-pipeline/SKILL.md:26-43`
- Policy: `skills/10x-pipeline/policy.json:11-17`, `:52-60`
- `/10x-archive`: `~/.claude/skills/10x-archive/SKILL.md:64-143` (blocks, prompts), `:154-206` (move, commit), `references/archive-sha.md`
- Prior design: `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`
- Requirements: `context/foundation/prd.md` FR-004, FR-008

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Re-entry guard and `verify-archive`

#### Automated

- [ ] 1.1 Guard and `verify-archive` tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- [ ] 1.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 1.3 In a scratch folder with a hand-made `context/archive/2026-10-30-demo/change.md` (`status: archived`), `verify-archive demo` prints `archived: true`, and `init demo` halts without creating `context/changes/`

### Phase 2: Archive policy data and the `--archive` flag

#### Automated

- [ ] 2.1 Flag, persistence and policy tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- [ ] 2.2 Rule-form test passes on the archive prompt: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 2.4 `policy.json` carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.steps.archive||!p.archive.commitMessage||p.archive.haltOnManualPending!==false||!p.prompts.archive)process.exit(1)'`

#### Manual

- [ ] 2.5 In a scratch git repo, `init demo --goal "fix typo" --archive` returns a `run` for `plan` and `meta.json` holds `"archive": true`; in a folder without git the same command halts with a clear reason
- [ ] 2.6 The `prompts.archive` text reads as seven rules, each with one bold keyword

### Phase 3: The `done` branch — commit, clean check, `archive` action

#### Automated

- [ ] 3.1 Adapter tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- [ ] 3.2 Existing routing and report tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [ ] 3.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.4 The router never pushes or skips hooks: `! grep -nE "[\"']push[\"']|git push|--no-verify|--no-gpg-sign" skills/10x-pipeline/scripts/route.mjs && node --test --test-name-pattern="git subcommands" skills/10x-pipeline/test/archive.test.mjs`

#### Manual

- [ ] 3.5 In a scratch git repo, a finished run with `--archive` leaves one new commit `chore(demo): commit change folder before archive` and `git status` clean for the change folder
- [ ] 3.6 `route.mjs next demo` prints an `archive` action whose prompt lists the seven rules and whose `archivePath` matches `change.md` `created`
- [ ] 3.7 In a scratch repo with a `pre-commit` hook that stages an unrelated file, `next demo` halts after the commit, names the extra path, and leaves `meta.json` and `report.md` unchanged by the halt

### Phase 4: Orchestrator loop, documentation and end-to-end run

#### Automated

- [ ] 4.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 4.2 The adapter is documented in all places: `for f in skills/10x-pipeline/SKILL.md README.md AGENTS.md docs/ADR/ADR-003-rigor-gated-routing.md; do grep -q "verify-archive" "$f" || exit 1; done`
- [ ] 4.3 `SKILL.md` names no model, effort level or absolute tier: `! grep -Eiq "haiku|sonnet|opus|xhigh|tier [0-9]|effort[^.]{0,40}\b(low|medium|high|max)\b|\b(low|medium|high|max)\b[^.]{0,20}effort" skills/10x-pipeline/SKILL.md`
- [ ] 4.4 `SKILL.md` documents the flag and the action: `grep -q -- "--archive" skills/10x-pipeline/SKILL.md && grep -q '`archive`' skills/10x-pipeline/SKILL.md`
- [ ] 4.5 PRD FR-008 carries the note: `sed -n '/FR-008:/,/^- \[/p' context/foundation/prd.md | grep -q "archive-adapter"`
- [ ] 4.6 Nothing under `context/archive/` changed: `test "$(git diff --name-only main -- context/archive | wc -l)" -eq 0`
- [ ] 4.7 Manifests untouched: `test "$(git diff --name-only main -- .claude-plugin | wc -l)" -eq 0`

#### Manual

- [ ] 4.8 End to end on a throwaway git repo with a trivial change: `/agent-smith:10x-pipeline demo "fix typo" --archive` ends with commits `chore(demo): commit change folder before archive` and `chore(archive): close demo`, `verify-archive demo` prints `archived: true`, and `context/archive/<date>-demo/agent-smith/report.md` exists
- [ ] 4.9 In that run the archive subagent, which has no question tool and so takes the skill's plain-text path, answered the warnings prompt with `Continue archiving` (pending Manual rows trigger it), did not stop with `blocked` and ended with a `RESULT:` line; its `assumptions` and the pending Manual rows appear in the final message and the Manual rows in the archived `report.md`
- [ ] 4.10 A second run with a deliberately staged file halts before any commit and the output says the run was not archived
- [ ] 4.11 `SKILL.md`, `README.md`, ADR-003 and `route.mjs` describe the same sequence (pre-checks, commit, clean check, action, verify)
- [ ] 4.12 PRD FR-008 and ADR-003 agree on the git decision
- [ ] 4.13 The S-09 row and item in `context/foundation/roadmap.md` say "commit the change folder" and nothing else in that file changed except the `planning` status
