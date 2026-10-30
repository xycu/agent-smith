# Archive Adapter Implementation Plan

## Overview

Add an opt-in `--archive` flag to the pipeline. When a run that started with `--archive` reaches `done`, the router commits the whole `context/changes/<id>/` folder in one Conventional Commit, checks that the commit holds only that folder and that the folder is clean, and returns a new `archive` action. The orchestrator then runs `/10x-archive <id>` in one subagent that has its answers to the skill's prompts given as rules, and a read-only `route.mjs verify-archive <id> --path <archivePath>` confirms the move. `/10x-archive` stays unchanged. Nothing writes into the folder after it moves.

This is change 5 of 5 (roadmap S-09). It extends the ADR-003 skeleton that `rigor-levels` writes and uses that change's test harness, `meta.json` persistence and effort floor. Implementation waits for the whole `rigor-levels` change (roadmap S-03) to be merged; see "Dependency on `rigor-levels`".

## Current State Analysis

Line numbers are not used for `route.mjs`: S-03 moves most of it. Code is named by function, as in the merged `rigor-levels` router (checked against branch `rigor-levels-fix`, the implementation with its review fix).

- `decide()` ends at `return { done: true, reason, manualPending }`. `next()` turns it into `endRun(... { action: "done", ... })`. That is the only place the adapter hooks in.
- `endRun` writes the log, `meta.json` and `report.md`, then calls `out()`, which calls `process.exit`. Git work cannot follow `endRun`, so it has to be split into a write step and a print step.
- `next()` and the `init` branch of `main()` call `fs.mkdirSync(p.dir, { recursive: true })` before any check. After the folder moves, a second `next` or `init` would recreate `context/changes/<id>/agent-smith/` and write `run.jsonl`, `meta.json` and `report.md` into it (research section 2, inferred from code, not run).
- After S-03, `init` writes `{ ...prev, id, goal }`, so a stored `archive` flag survives a resume without a second mechanism.
- After S-03, `route.mjs` already uses git for reads: `gitOut(args)` runs `execFileSync("git", ["-c", "core.quotePath=false", ...args])` with no shell and no timeout, discards stderr and returns stdout, or `null` on any failure. `init` calls it for `rev-parse HEAD` (`meta.baseSha`), and `measureRisk` calls it for `log` and `diff` on every `next` that has a plan (the churn code). What is new is git WRITES: the adapter's index and commit writes are the router's first.
- `SKILL.md` knows three actions: `run`, `done`, `halt` (Loop section). `done` runs `status` after the router returned, which reads a log that archive moves away. Start step 2 sends the user to `/10x-new` when `change.md` is missing, which is wrong after an archive.
- The real `/10x-archive` has two hard blocks: any output from `git status --porcelain context/changes/<id>/`, and a non-zero `git diff --cached --quiet` repo-wide (`~/.claude/skills/10x-archive/SKILL.md:64-94`). It asks a warnings prompt (`Continue archiving` / `Resume implementation` / `Cancel`) and, only with a verified squash-merge mapping, a repoint prompt (`Update and archive` / `Archive without repointing` / `Cancel`) (`:100-143`). It collects five warning sources, the fifth being a SHA history check that runs `git ls-remote`, `gh pr view` and `git fetch --no-tags` and may ask the user to identify a remote, branch or commit (`:113`, `references/archive-sha.md`). It reads `created` with `awk '/^created:/ {print $2; exit}'` (`:154`). It commits `chore(archive): close <id>` and never pushes (`:197-206`, `:239`).
- A normal pipeline run leaves `reviews/`, `plan.md`, `research.md` and `change.md` uncommitted, because `10x-plan`, `10x-plan-review` and `10x-impl-review` do not commit. So committing only `agent-smith/` cannot clear hard block 1 (research section 5). The owner decided on option A: commit the whole change folder.
- Before S-03 the `policy.json` suffix told the unattended subagent to choose "the recommended or most conservative option", which for `/10x-archive` is `Cancel`. The S-03 suffix says: decide from researched evidence and cite it, or report `blocked` with `signals.needsHuman`. Neither gives the archive answers, so the archive prompt states its own and says they win.
- `docs/ADR/` holds ADR-001 and ADR-002. ADR-003 and ADR-004 and the test layout under `skills/10x-pipeline/test/` come from `rigor-levels`. ADR-003 has a "Churn risk" section that says the router reads git history, and an intro that counts four changes.

## Desired End State

- `route.mjs init <id> --goal "..." --archive` stores `archive: true` in `meta.json`. A resume keeps it. `--archive false` turns it off. The flag halts at `init` when the project is not a git work tree or git would ignore any of `agent-smith/run.jsonl`, `agent-smith/meta.json`, `agent-smith/report.md` or `change.md` of the change.
- Without `--archive`, behavior is unchanged: `done` stays `done`, and the router runs no git write.
- With `--archive`, at `done` the router: halts if anything is staged, HEAD is detached, a merge or rebase is in progress, git would ignore one of the four probe files, `change.md` has no valid `created`, the archive destination already exists, or (only when `archive.haltOnManualPending` is `true`, default `false`) Manual rows are pending; writes the final `report.md`, which lists the pending Manual rows; commits `context/changes/<id>/` as `chore(<id>): commit change folder before archive` (skipped when the commit would be empty); checks that nothing is staged, that the commit touched only that folder, and that the folder is clean; returns an `archive` action. A failed git command halts with the git message and no archive. Nothing is left staged by the router after a failed commit.
- The `archive` action carries the done summary, the report path, the expected archive path, the ignored files that were not committed and a prompt for `/10x-archive`. The archive step runs at effort `high` or above through a pinned tier in `policy.json`.
- Every halt of a run with `--archive` says whether the pre-archive commit exists (`committed`) and carries an `archive: "skipped: ..."` field. Which halt writes files and which only prints is fixed per halt kind in a table (Phase 3, change 2).
- `route.mjs verify-archive <id> [--path <archivePath>]` is read-only. It reports `archived: true` only when the archive folder (the one named by `--path`, else the single `context/archive/YYYY-MM-DD-<id>/` match) has `status: archived` in its `change.md` and `context/changes/<id>/` is gone.
- `next`, `init` and `status --report` on an archived change, and on a change whose folder is still in place but whose `change.md` says `status: archived` (half-archived), halt with JSON and write nothing.
- `SKILL.md`, `README.md`, `AGENTS.md`, ADR-003 and PRD FR-008 describe the adapter. ADR-003 records the router's first git write (index and commit writes only). The roadmap S-09 Outcome says "commit the change folder".
- `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new `archive.test.mjs`.

### Key Discoveries:

- The folder to commit includes files the router does not own, so the commit takes the whole `context/changes/<id>/` folder (owner decision A, `research.md` Owner decisions).
- A halt after the commit must not go through the writing `endRun`: it would rewrite `report.md` and `meta.json` and dirty the folder again. Post-commit failures print JSON only. A resumed `next` is idempotent: the log, `meta.json` and `report.md` rewrite to the same bytes, `git diff --cached --quiet` passes after `git add`, and the commit is skipped (`research.md` Open Question 8).
- `attachResult` already deletes `last-result.json` (`fs.rmSync(p.result)`) when it reads the last step's result, and it returns early once that entry has a result, so no stray result file exists at commit time and a repeated `next` does not look for one. The `archive` action has no `resultFile`, so the orchestrator writes nothing into the folder that moves.
- The archive step has no log entry, no usage figure and no report row. This is the one exception to "each step logs a result" and is recorded in ADR-003.
- `git commit -m <msg> -- <path>` does not protect against a hook that stages another file. Checked in a scratch repo (plan review F2, re-run for this revision): with a `pre-commit` hook that ran `git add hooked.txt`, the commit held both `change.md` and `hooked.txt`, `git diff --cached --quiet` then exited 1, and `git status` showed `D  hooked.txt` plus `?? hooked.txt`. So the "nothing staged" pre-check protects only the state before the commit. Two read-only checks follow the commit: the index is empty, and `git show --name-only -z --format= HEAD` lists only paths of the change folder. Re-run for round 3: the same result on an unborn HEAD (the first commit of a repository takes a pathspec commit), and `git diff --cached --quiet` exits 0 after a second `git add` of an unchanged folder (the skip-the-commit test).
- `git check-ignore -q -- <dir>` exits 1 for a directory that does not exist, even with `agent-smith/` in `.gitignore`, and misses file patterns. Checked in a scratch repo (plan review F1, re-run for rounds 2 and 3): `.gitignore` = `agent-smith/` gives exit 1 for the absent directory and exit 0 for `agent-smith/run.jsonl` and `report.md`; `.gitignore` = `*.jsonl` gives exit 1 for the directory, exit 0 for `run.jsonl` and exit 1 for `meta.json`; `context/` ignored gives exit 0 for every file below it. File probes work whether or not the file exists, so the adapter probes `run.jsonl`, `meta.json`, `report.md` and `change.md`. A file that is already tracked reads as not ignored (exit 1 even under `agent-smith/`), which is the right answer: `git add` updates a tracked file whatever `.gitignore` says.
- `git show --name-only`, `git diff --name-only` and `git status --porcelain` quote and escape non-ASCII names by default (plan review round 2, F3). Run for round 3 with git 2.54: a file `zażółć.md` in a project root under a directory `ząb` (the git root one level up) printed as `"proj/z\304\205b/context/changes/demo/za\305\274\303\263\305\202\304\207.md"`, with the quotes; `-z` alone, and `-c core.quotePath=false`, printed `proj/ząb/context/changes/demo/zażółć.md`. `git rev-parse --show-prefix` prints the prefix raw (`proj/ząb/`), and `show --name-only` lists paths relative to the git root, not the current directory, so the prefix is needed. `show --relative` drops paths outside the current directory, which would hide the extra path the check looks for, so it is not used.
- Ignored files outside the four probes (plan review round 2, F6). Run for round 3 with `.gitignore` = `reviews/`, `.DS_Store`, `*.log`: `git add -- context/changes/demo` skipped `reviews/impl-review.md`, `.DS_Store` and `agent-smith/debug.log` without an error, the commit held `change.md`, `plan.md` and `agent-smith/meta.json`, and `git status --porcelain -- <folder>` was empty (the clean check passes). `git status --porcelain --ignored -- <folder>` listed `!! .../.DS_Store`, `!! .../agent-smith/debug.log` and `!! .../reviews/` (a directory is listed once). A `git mv` of the folder carried all of them to the new place. So an ignored file is not lost by the archive, but it stays out of history. The adapter reports such files and does not halt on them (decision 13).
- The router and `/10x-archive` read `created` differently (plan review round 2, F8). The skill takes `awk '/^created:/ {print $2; exit}'`: the first line of `change.md` that starts with `created:`, the second blank-separated field, no quote stripping. The `archivePath` the router computes must equal the skill's `DEST`, so the router reads `created` the same way (decision 14).
- `verify-archive` must anchor the folder name (`^\d{4}-\d{2}-\d{2}-<id>$`). `/10x-archive` itself matches on a name suffix, which would also accept `2026-01-01-x-<id>`. A reused id leaves two anchored folders, so the router passes the exact `archivePath` it computed, and refuses before the commit when that path already exists (`/10x-archive` would stop with "destination already exists" only after the commit).
- Two write paths remain around the commit and the move besides the missing-folder re-entry: a half-archived folder (`status: archived`, folder not moved) on which `next` would run the `done` branch again; and a pre-check halt on a resumed `next` after the folder was already committed, which `endRun` would turn into a rewrite of `meta.json` and `report.md`. Both are closed (Phase 1 and Phase 3).

## What We're NOT Doing

- Lesson candidates (`lesson-candidates`), pre-plan steps (`pre-plan-steps`), phase executors and manual-row automation (`phase-executors`).
- Any edit to `/10x-archive`, `~/.claude/skills` or `context/archive/`. Any write under `context/changes/<id>/` after the archive step starts.
- Pushing, branch switching, `--no-verify`, signing bypass, detection of protected branches (a refused commit is a failed git command and halts).
- Archiving after a `halt`. A halted run commits nothing and offers no archive; the halt output says so.
- Recording the archive step in `run.jsonl`, in the report table or in the token totals. The report's totals cover the steps before archive only.
- A git read in `verify-archive` (no `git log` check for `chore(archive): close <id>`).
- The SHA repoint (`Update and archive`): it edits `plan.md`. The subagent always answers `Archive without repointing`, and never asks the user to identify a remote, a branch, a PR or a commit for the SHA history check.
- Halting on, or committing, files that git ignores outside the four probe files: they are reported, not committed (decision 13).
- Controlling the archive subagent's own git and `gh` calls (the SHA history check runs `git ls-remote`, `git fetch --no-tags` and `gh pr view`; `git fetch` writes `refs/remotes/<remote>/<base>`). The router's write rule covers the router only.
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
| 3 | Git state | Any git failure halts with the git message and no archive. Explicit pre-checks: inside a work tree, no probe file ignored, HEAD attached, no merge, rebase, cherry-pick or revert in progress, nothing staged, archive destination free. A refused or failed commit unstages the router's own `git add` before halting. After the commit: index empty, commit touched only the change folder, folder clean (a hook can stage or rewrite other files; review F2). Paths are compared as NUL-separated raw strings (`-z`), so non-ASCII names do not trip the check (round 2, F3). Which halt writes files and which prints only is fixed in the halt table of Phase 3 (round 2, F5). |
| 4 | Run not `done` | No commit, no archive. A halt with `--archive` set carries `archive: "skipped: run halted"` and `committed: false`, and the report says `Archive: not run (run halted)`. `SKILL.md` tells the user the folder is uncommitted and a later `/10x-archive` needs a commit first. A halt after the pre-archive commit exists says so instead (Phase 3 halt table). |
| 5 | No git, ignored files | `--archive` halts at `init` (before writing anything) when the project is not a git work tree or `git check-ignore -q` exits 0 for any of the probe files `agent-smith/run.jsonl`, `agent-smith/meta.json`, `agent-smith/report.md` and `change.md` (probing the directory is wrong: it exits 1 while absent and misses file patterns; review F1). The same checks run again at `done`. Other ignored files in the folder are decision 13. |
| 6 | `verify-archive` scope | File checks only. No git read. Optional `--path <archivePath>` names the exact folder (review F4, Fix A); the orchestrator reminds the user to check `git status`. |
| 7 | Re-entry | `next`, `init` and `status --report` halt when the change folder is missing and an anchored archive folder exists, and when `change.md` says `status: archived` (half-archived). They write nothing. |
| 8 | Second `done`, same state | Skip the commit when `git diff --cached --quiet` passes after `git add`. The run still returns `archive`. A pre-check halt on such a resume prints JSON only when the folder is already committed and clean (`report.md` tracked, no status output for the folder). |
| 9 | Archive step in the report | Accepted: no usage figure is recorded. The orchestrator copies any usage the Agent result reports into its final message only. |
| 10 | Dirty `roadmap.md` | No router check. The archive prompt asks the subagent to copy any warning or roadmap notice into `assumptions`. |
| 11 | Pending Manual rows at `done` (review F5) | Archiving stays an explicit opt-in. The final `report.md` lists them (`Manual checks pending: N` and the rows), because it is the only router artifact that survives the move; `SKILL.md` repeats them in the final message. `archive.haltOnManualPending` (default `false`) halts before the commit instead. |
| 12 | Archive destination exists (reused id, same day) | Pre-check halt before the commit: `context/archive/<created>-<id>` must not exist. |
| 13 | Ignored files outside the four probes (round 2, F6) | Decided: report, do not halt, do not force-add. The Key Discoveries result shows the archive still moves them and nothing breaks; halting would block every project whose global ignore file lists `.DS_Store`. After `git status --porcelain --ignored -- context/changes/<id>/` the router collects the `!!` lines (project-relative, at most ten) into `ignored` in the `archive` payload; `SKILL.md` prints them as "not committed (ignored by git)". The promise "the whole folder is committed" in docs reads "every file git does not ignore". |
| 14 | `created` parsing (round 2, F8) | The router reads `created` as `/10x-archive` does: the first line of `change.md` that starts with `created:`, the second field split on spaces and tabs, unmodified. It must match `^\d{4}-\d{2}-\d{2}$` exactly, else the pre-check halts before the commit (a quoted value `"2026-10-30"` halts). The frontmatter reader of Phase 1 (first `---` block, quotes stripped) is used for `status` only, because the skill's resolution step reads `status` from the frontmatter. |
| 15 | SHA history check of `/10x-archive` (round 2, F1) | The prompt answers it in advance: no asking about remote, branch, PR or commit; repointing is skipped; the diagnostics are warnings answered by `Continue archiving`. Precedence: a blocking warning wins over every answer rule, including the repoint rule. The first real run (row 4.9) has no remote and an unmerged branch, so it exercises exactly this path. |

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

Git layer: `rigor-levels` Phase 3 adds `gitOut(args)`, which prepends `-c core.quotePath=false`, has no timeout, discards stderr and turns every failure into `null` ("unavailable"). The adapter needs the exit status and stderr. Phase 2 below adds one wrapper `runGit(args, opts)` returning `{ status, stdout, stderr }` that never throws and prepends the same `-c core.quotePath=false`; since `rigor-levels` is merged first, put `runGit` beside `gitOut` and make `gitOut` a thin caller (`status === 0 ? stdout : null`). The only `-c` option in any router git call is `core.quotePath=false`, a display setting; the router sets no `-c` that touches hooks, signing, identity or the index (`core.hooksPath`, `commit.gpgsign`, `user.*`).

Test harness facts (checked against `rigor-levels-fix` `helpers.mjs`): `makeProject({ id, plan, policy, change, nest })` writes a `change.md` without `created`, so every full-path test rewrites it with `created: 2026-10-30` through a local `archiveProject()` helper in `archive.test.mjs`; `gitEnv(project)` takes the project and fixes identity and config; `run(project, args, { env })` already accepts `env`, so the router subprocess gets `gitEnv(project)`; `git(project, args)` and `gitInit(project)` run in `project.base`, which is the git root, while `project.root` (the router's working directory) is `base/<nest>` when `nest` is set; `commitFiles` commits files given relative to `project.base`.

## Phase 1: Re-entry guard and `verify-archive`

### Overview

Make an archived change safe to touch and give the orchestrator a read-only way to confirm an archive. No git, no policy change.

### Changes Required:

#### 1. Archived-folder lookup and re-entry guard

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: One helper finds the archive folder of a change id. `init` and `next` check it before their first `mkdirSync`: when `context/changes/<id>/` is missing and an archive folder exists, print a JSON `halt` that names the archive path and exit 1 without writing. `status --report` already refuses a missing change folder; it gets the same message. A second check covers the half-archived state: when the change folder exists and its `change.md` already says `status: archived` (`/10x-archive` stamped it and did not move it), the same three commands halt without writing.

**Contract**: `archiveDirs(id)` lists `context/archive/` with `fs.readdirSync` (empty list when the directory is missing) and keeps names matching `^\d{4}-\d{2}-\d{2}-<id>$` (the id is already restricted to `[a-z0-9-]` by the id pattern check at the top of `main()`). Halt reason: `Change <id> is archived at <path>. Nothing was written.` Half-archived halt reason: `Change <id> is stamped archived but its folder was not moved. Nothing was written; finish or undo /10x-archive by hand.` It reads `status` with the same frontmatter reader as `verify-archive` (first `---` block, quotes stripped) and runs before the first `mkdirSync` in `init` and `next`. Plain `status` stays read-only and unchanged. The archive-folder guard fires only when the change folder is missing; a live folder with a same-named archive is left to `/10x-archive`.

#### 2. `verify-archive` command

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A read-only command that answers "did the archive succeed" from files alone, including the partial-failure state `/10x-archive` documents (`status: archived` in the old folder, folder not moved), and a reused id that left two archive folders.

**Contract**: `route.mjs verify-archive <id> [--path <archivePath>]` prints JSON and exits 0 when archived, 1 otherwise. With `--path`, only that folder is checked. `parseFlags` gives `true` for a `--path` with no value, so the code checks `typeof flags.path === "string"` first; a valueless `--path` gives `{ "archived": false, "reason": "--path needs a folder" }`. A string value is accepted only in the form `context/archive/<name>`, with an optional leading `./` and an optional trailing `/`; an absolute path, any `..` segment, a backslash, extra segments or another prefix is refused. `<name>` must match the anchored pattern for this id. Any refusal gives `{ "archived": false, "reason": "--path is not an archive folder of <id>" }` and nothing is read outside `context/archive/`. Without `--path`, the folder is the single `archiveDirs(id)` match. Archived means: the folder is found, its `change.md` frontmatter (first `---` block) has `status: archived` (quotes stripped), and `context/changes/<id>/` does not exist. Output when archived: `{ "archived": true, "path": "context/archive/<name>", "archivedAt": "<value or null>", "report": "<path>/agent-smith/report.md" | null }`. Output otherwise: `{ "archived": false, "reason": "..." }` with a distinct reason for: no archive folder, more than one match without `--path` (list them and name `--path`), `change.md` missing or not `archived`, change folder still present. It uses `fs.readdirSync`, `fs.readFileSync`, `fs.existsSync` only, never `paths()` or `mkdirSync`, and never calls git, so a staged-but-uncommitted archive still reads as `archived: true` (the orchestrator reminds the user to check `git status`). Extend the `halt("Usage: ...")` string in `main()` that `rigor-levels` already changed (add `verify-archive <id> [--path <p>]`; do not overwrite its flags) and the `Usage:` block in the header comment of the file.

#### 3. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Black-box tests through the CLI, using `helpers.mjs` from `rigor-levels` (see "Test harness facts" above). Archive folders are made by hand with `fs`; no git is needed in this phase.

**Contract**: Cases: guard halts `next` and `init` when only the archive folder exists, exit 1, JSON, and `context/changes/` stays absent; `init`, `next` and `status --report` halt on a live folder whose `change.md` says `status: archived` and leave the tree byte-identical; with two anchored archive folders (reused id) `verify-archive demo` returns false listing both and `verify-archive demo --path context/archive/<date>-demo` returns true for a correct one, and `--path` with a suffix-collision name, a path outside `context/archive/` (absolute, and with a `..` segment such as `context/archive/../changes/demo`) or a folder of another id returns false without reading it, `--path` with no value returns false with the "needs a folder" reason, and `--path context/archive/<date>-demo/` (trailing slash) and `./context/archive/<date>-demo` are accepted; a suffix-collision folder (`2026-01-01-x-demo`) does not trigger the guard for `demo`; `status demo` without `--report` still prints an empty log; `status demo --report` halts with the archive path; `verify-archive` returns `archived: true` with `path` and `report`; returns false with the specific reason for each of: no archive, two matches, status not `archived`, change folder still present with `status: archived` (partial failure); a suffix-collision folder alone gives false; the command leaves the project tree byte-identical (compare a recursive listing with mtimes before and after) and still answers when `PATH` holds no `git`.

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

**Intent**: Pin the archive step to a tier with effort `high` or above, hold the commit message template, and give the archive subagent its answers as rules, because the generic suffix has no archive answers (before S-03 it picked `Cancel`; after S-03 it says decide from evidence or report `blocked`). A subagent has no `AskUserQuestion`, so `/10x-archive` falls back to a plain-text question and waits; the rules therefore give the answers in advance and forbid asking (review F3). Every question source of the skill is covered: the warnings question, the repoint question, and the questions the SHA history check may ask (round 2, F1; skill text `SKILL.md:113`, `references/archive-sha.md` "Resolve and refresh the integration target" and "Establish the integration commit").

**Contract**: `steps.archive`: `{ "skill": "10x-archive", "baseTier": 3, "minTier": 3, "maxTier": 3, "interactive": true }`. With the shipped ladder tier 3 is `sonnet`/`high`; the `minTier` pin is what guarantees the floor, so a lower `minEffort` at `lean` cannot lower it. New top-level `archive`: `{ "commitMessage": "chore({id}): commit change folder before archive", "gitTimeoutMs": 120000, "haltOnManualPending": false }`. New `prompts.archive`: first line `Run /10x-archive {id}`, then one rule per line, each starting with `- `, each in GIVEN/WHEN/THEN form with exactly one bold keyword (ADR-004). The rules are:

- **GIVEN** `/10x-archive` would ask its warnings question and every warning is pending Manual Progress rows only, Progress rows without a SHA suffix, a status other than `implemented` or `impl_reviewed`, or a SHA history diagnostic **WHEN** you are an unattended subagent **THEN** you **MUST** proceed as if the answer were `Continue archiving` (the label may read `Continue archiving (Recommended)`; match the prefix).
- **GIVEN** `/10x-archive` would ask its repoint question (`Update and archive`, `Archive without repointing`, `Cancel`) and no listed warning is a blocking warning **WHEN** you are an unattended subagent **THEN** you **MUST** proceed as if the answer were `Archive without repointing` (the Polish label `Archiwizuj bez podmiany` is the same answer).
- **GIVEN** the SHA history check finds no remote, integration branch, implementation PR or integrating commit, or its `git fetch` fails, or it reports SHAs outside the target history **WHEN** the skill would ask you to identify, confirm or choose any of them **THEN** you **MUST** skip repointing, treat the diagnostics as warnings and answer the warnings question by the rules here, without asking.
- **GIVEN** `/10x-archive` tells you to ask a question as plain text and wait because no question tool exists **WHEN** the question is the warnings question, the repoint question or a SHA history question **THEN** you **MUST NOT** ask it or end your turn to wait, and you continue in the same turn with the answer given here.
- **GIVEN** the warnings include `Uncertain review coverage`, `Missing review coverage for phases`, `No impl-review found`, `No plan.md found`, a pending Automated row or pending Progress rows with no Automated and Manual breakdown (these are the blocking warnings), or `/10x-archive` stops on a hard block or asks a question not covered here **WHEN** you cannot continue **THEN** you **MUST** finish with status `blocked` and the printed reason in `note`.
- **GIVEN** a blocking warning is listed **WHEN** the skill also shows its repoint question or its warnings question **THEN** the blocking rule above **MUST** win over the answers given here, and you answer neither question.
- **GIVEN** these rules and the generic unattended rules disagree about an archive question **WHEN** you pick an answer **THEN** these rules **MUST** win.
- **GIVEN** `/10x-archive` prints a warning, a SHA diagnostic or a roadmap notice **WHEN** you write the RESULT line **THEN** you **MUST** copy each one into `assumptions`.
- **GIVEN** `/10x-archive` has finished or stopped **WHEN** you have more to do **THEN** you **MUST NOT** write any file under `context/changes/{id}/` or `context/archive/`.

Precedence, in one line: the blocking rule beats the two answer rules; the answer rules beat the generic suffix. Each rule line holds exactly one bold keyword and no unbolded upper-case keyword (`ruleProblems` in `rules.test.mjs`). The suffix (RESULT line, no-commit sentence) is appended by the router as for every prompt. Keys camelCase, step name kebab-case.

#### 2. `--archive` flag, persistence and `init` checks

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Store the opt-in in `meta.json` through the `rigor-levels` spread, validate it before anything is written, and refuse a project where the adapter cannot work. Add the git wrapper both `init` and Phase 3 use.

**Contract**: `init` reads `flags.archive` (`parseFlags` gives `true` for a bare flag and a string otherwise): the bare flag, `true` or the string `"true"` sets `meta.archive = true`; the string `"false"` sets `false`; any other value halts with JSON and writes nothing. The check runs before the first `mkdirSync`, next to the `--rigor` validation. No flag keeps the stored value; absent stays absent. When the result is `true`, `init` runs `git rev-parse --is-inside-work-tree`, then `git check-ignore -q -- <file>` for each of `context/changes/<id>/agent-smith/run.jsonl`, `.../agent-smith/meta.json`, `.../agent-smith/report.md` and `context/changes/<id>/change.md`. Not a work tree, or any probe exiting 0 (ignored), halts with a message naming the cause and the ignored path, and writes nothing. Probe files, never the directory: `git check-ignore` on a directory that does not exist yet exits 1 whatever `.gitignore` says, and a directory probe misses file patterns such as `*.jsonl` (review F1). A probe works for a file that does not exist yet. One helper `ignoredProbePaths(id)` returns the ignored paths and is reused at `done`. `runGit(args, opts)` uses `execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: ROOT, encoding: "utf8", timeout, maxBuffer, stdio: pipe })` with no shell, and returns `{ status, stdout, stderr }` for any outcome including a missing `git` (status 127) or a timeout. It never throws. `timeout` is `policy.archive.gitTimeoutMs` for the adapter's calls and unset for `gitOut`'s. Extend the usage string that `rigor-levels` already changed with `[--archive]`; do not overwrite its flags. Comments in `route.mjs` must not contain the strings `--no-verify`, `--no-gpg-sign` or `git push`: criterion 3.4 greps the file. Follow the Node 18 ban list of `rigor-levels` Phase 2.

#### 3. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Cover the flag, its persistence and the early refusals. Git fixtures use `gitEnv()`.

**Contract**: Cases: `--archive` stores `archive: true`; a second `init` without the flag keeps it; `--archive false` stores false and a later bare resume keeps false; `--archive maybe` halts and `meta.json` is not written; a directory that is not a git repo halts for `--archive` and writes nothing; a `.gitignore` containing `agent-smith/` halts for `--archive` while `context/changes/<id>/agent-smith` does not exist yet and names the ignored path; a `.gitignore` containing `*.jsonl` halts (names `run.jsonl`); a `.gitignore` containing `context/` halts (names `change.md` or the first ignored probe); a `.gitignore` that ignores none of the four files lets `--archive` pass; `init` without `--archive` in a non-git directory still works and `meta.json` has no `archive` key; `policy.prompts.archive` holds the answer strings (`Continue archiving`, `Archive without repointing`, `Archiwizuj bez podmiany`, `Uncertain review coverage`, `Missing review coverage`, `blocked`), the SHA history strings (`SHA history`, `git fetch`, `without asking`), says `MUST NOT` about asking, and names the precedence (a rule line that holds `blocking rule` and `MUST` and `win`); `steps.archive` resolves to a ladder entry whose effort is `high`, `xhigh` or `max`; `commitMessage` matches `^chore\(\{id\}\): `; `archive.haltOnManualPending` is `false`. The rule-form test from `rigor-levels` Phase 1 covers the prompt lines without a new test.

### Success Criteria:

#### Automated Verification:

- Flag, persistence and policy tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Rule-form test passes on the archive prompt: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- `policy.json` carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.steps.archive||!p.archive.commitMessage||p.archive.haltOnManualPending!==false||!p.prompts.archive)process.exit(1)'`

#### Manual Verification:

- In a scratch git repo, `init demo --goal "fix typo" --archive` returns a `run` for `plan` and `meta.json` holds `"archive": true`; in a folder without git the same command halts with a clear reason
- The `prompts.archive` text reads as one rule per line, each with one bold keyword (nine rules, including the SHA history rule and the blocking-warning precedence rule)

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: The `done` branch — commit, clean check, `archive` action

### Overview

When `--archive` is set and the run reaches `done`, check git state, write the final report, commit the change folder, verify the index is empty, the commit holds only the folder and the folder is clean, and return the `archive` action. Add the report lines. Halts on the way never leave the repo half-staged by the router, and a halt after the commit never rewrites the committed folder. Each halt kind has a fixed output path (the halt table in change 2).

### Changes Required:

#### 1. Split `endRun`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Make the write step reusable without exiting. `endRun` becomes `out(finishRun(...))`, so every existing end branch keeps its behavior, report included.

**Contract**: `finishRun(p, id, meta, log, result)` does what `endRun` does today up to the print (log, `meta.outcome`, `report.md`, `reportError`) and returns the result object plus `report`. `meta.outcome` keeps `{ action, reason }` and, for a `done` result, `manualPending` (the list of pending Manual row strings). It does not store the `archive` output field: `buildReport` derives the Archive line from `meta.archive` and `meta.outcome.action`. When `meta.archive === true` and `result.action === "halt"`, `finishRun` adds `archive: "skipped: run halted"` and `committed: false` to the returned object unless `result` already carries an `archive` field; this is the one place every ordinary halt of an archive run gets them. After the `rigor-levels` changes it keeps their `executed` count wherever it prints `steps`.

#### 2. Pre-checks, commit, clean check

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `next()`, branch on `d.done && meta.archive === true`. Run the pre-checks first, then `finishRun` for `done`, then commit, then verify. Each halt kind has one output path, fixed in the halt table below, so nobody has to guess whether a halt rewrites the folder (round 2, F5). The rule behind the table: while the folder is not committed, a halt may write the run's end state; once the commit exists, or once the run has been written as `done`, a halt only prints.

**Contract**:

Sequence in `next()` for an archive run at `done`:

1. `committed` is true when `git ls-files --error-unmatch -- context/changes/<id>/agent-smith/report.md` succeeds and `git status --porcelain -- context/changes/<id>/` prints nothing ("already committed and clean").
2. Pre-checks, in order, each a halt with its cause: `git rev-parse --is-inside-work-tree`; `ignoredProbePaths(id)` non-empty (the four file probes of `init`, naming the ignored paths); `git symbolic-ref -q HEAD` fails (detached); a `MERGE_HEAD`, `REVERT_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge` or `rebase-apply` entry under `git rev-parse --git-path <name>`; `git diff --cached --quiet` exit 1 (staged; the halt lists `git diff --cached --name-only`, paths relative to the git root); `created` invalid (decision 14: the first `^created:` line of `change.md`, second field, must match `^\d{4}-\d{2}-\d{2}$`); `fs.existsSync(archivePath)` (halt: `Archive destination <archivePath> already exists; a reused id on the same date needs a human.`); `policy.archive.haltOnManualPending === true` with a non-empty `manualPending` (halt listing the rows). A failing pre-check is halt kind A, or kind B when `committed` is true.
3. Ignored files (informational, never a halt): `git status --porcelain --ignored -- context/changes/<id>/`; the `!!` lines, with the `git rev-parse --show-prefix` prefix removed, at most ten, become `ignored` in the payload (decision 13). A failing `status` call leaves `ignored` empty; the clean check in step 5 then fails the run anyway.
4. `finishRun` for `done` (nothing is printed yet). Commit: `git add -- context/changes/<id>`; if `git diff --cached --quiet` exits 0, skip the commit and set `commit: null`; else `git commit -m <message> -- context/changes/<id>` with the message from `policy.archive.commitMessage` (non-string or blank halts with a clear reason) and `gitTimeoutMs`. On a failed `add` or `commit`, run `git reset -q -- context/changes/<id>` (best effort) and halt as kind C with the first lines of git's stderr, whether the reset worked, and for a timeout the sentence that a hook child may still run and an `index.lock` may remain.
5. Post-commit checks, in order, each a kind D halt: (1) `git diff --cached --quiet` must exit 0, else list `git diff --cached --name-only` (a hook staged something); (2) when this call made a commit, `git show --name-only -z --format= HEAD` must list only paths under `<prefix>context/changes/<id>/`, where `<prefix>` is the output of `git rev-parse --show-prefix` with its trailing newline removed; the output is split on NUL, empty entries are dropped and the entries are compared as raw strings, so non-ASCII names and a project root in a non-ASCII subdirectory do not trip it (round 2, F3); the halt names the extra paths; (3) `git status --porcelain -- context/changes/<id>/` must be empty, else list up to ten paths. Display listings (steps 2 to 5) come from `runGit`, which sets `core.quotePath=false`, so they show names as written.
6. Print the `archive` action (change 3).

Halt table (round 2, F5). `committed` and `archive` are fields of the printed JSON; exit code 0, like every halt that `endRun` prints.

| Kind | Cause | Files written by the halt | Printed by | `committed` | `archive` |
| --- | --- | --- | --- | --- | --- |
| A | Pre-check fails and the folder is not committed and clean (includes `haltOnManualPending`, destination exists, invalid `created`); any other halt of the run (budget spent, failed steps, plan or fix loop limits, `needsHuman`) | log, `meta.outcome` halt, `report.md` with `Archive: not run (run halted)` (through `finishRun`) | `endRun` | `false` | `skipped: run halted` |
| B | Pre-check fails on a resume and the folder is already committed and clean | none | `out()` | `true` | `skipped: pre-archive commit exists; run not archived` |
| C | `git add` or `git commit` fails (after the best-effort `git reset`) | none after step 4; `meta.outcome` stays `done`, so the failed hook does not rewrite the run's final state | `out()` | `false` | `skipped: pre-archive commit failed` |
| D | A post-commit check fails | none | `out()` | `true` | `skipped: pre-archive commit exists; run not archived` |

Kind B and D messages say that the commit exists, is local and is not undone by the router, and that `next` repeats safely after the cause is fixed. Kind A and C messages say nothing was committed. "Resumed" means a `next` after an earlier call already committed.

Everything in the folder that git does not ignore is committed, including editor junk such as `.DS_Store` when it is not ignored. The commit lands on the current branch, protected or not. Git runs with the caller's environment: the only `-c` option is the display setting `core.quotePath=false`, so hooks and signing config apply.

#### 3. `archive` action payload and report lines

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Hand the orchestrator everything it needs before the folder moves, and keep `resultFile` out of the payload. Mark the report so a reader of the archived copy knows the archive ran after it was written.

**Contract**: Tier comes from `tierFor({ step: "archive" }, executed(log), policy, readPlan(p.plan), meta, level)`: its real signature is `tierFor(d, log, policy, plan, meta, level)`, `level` is the value `resolveRigor` returned in `next()`, and `d` has no `bump`, `floorTier` or `template`. No log entry is appended. The `steps.archive` pin (`minTier` = `maxTier` = 3) decides the tier; the `appliesTo` and `discount` tables have no `archive` entry, so no discount applies. Payload, which `SKILL.md` and the tests depend on:

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
  "commit": "<short sha> | null",
  "ignored": ["<project-relative path git ignores, at most ten>"]
}
```

No `resultFile`, no `n`, no log entry. `archivePath` is the exact folder `SKILL.md` passes to `verify-archive --path`; `<created>` is the value read by the rule of decision 14, so it equals the skill's `DEST` date. `ignored` is empty when nothing is ignored. `buildReport` adds one line after `Outcome:` when `meta.archive === true`: `Archive: requested - runs after this report was written; see the commit "chore(archive): close <id>"` when the outcome is `done`; `Archive: not run (run halted)` for any other end. When `meta.archive === true` and the outcome is `done`, it also writes `Manual checks pending: N` followed by one bullet per pending Manual row (from `meta.outcome.manualPending`); with none pending it writes nothing. This is the only place the skipped checks survive the move (review F5). Table, totals and `Steps:` stay as they are. The `archive` and `committed` fields of a halt follow the halt table above. `next` on a run whose last end was `archive` simply repeats the sequence (idempotent: no second commit).

#### 4. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Real git in scratch repos, a `writeLog` fixture for a finished run, `next` through the CLI. The router subprocess gets `gitEnv(project)` through `run(project, args, { env })` (`run` already accepts `env`), so it has an identity and no global config. A local `archiveProject()` in the test file builds the project: `makeProject`, then `change.md` rewritten with `created: 2026-10-30`, `gitInit`, one `commitFiles` commit, a finished log fixture and an impl-review file.

**Contract**: Cases: full path returns `archive` with the payload fields, no `resultFile`, `run.jsonl` has the same entry count, effort is `high` or above, `git log -1 --format=%s` equals the default message, `git status --porcelain -- context/changes/demo` is empty, `git diff --cached --quiet` passes, and the commit contains `reviews/impl-review.md`, `plan.md`, `change.md` and `agent-smith/report.md`; `report.md` holds the `Archive: requested` line and `meta.json` outcome is `done`; second `next` with no changes returns `archive` with `commit: null` and the commit count is unchanged; a run without `--archive` returns `done` and makes no commit; staged file halts with the path listed and no commit; detached HEAD halts; a `MERGE_HEAD` file halts; failing `pre-commit` hook halts (kind C) with the hook's output, `committed: false` and the `archive` field, leaves nothing staged, and leaves `meta.json` with outcome `done` and `report.md` unchanged by the halt; a `post-commit` hook that creates `stray.txt` in the folder halts with the path listed, writes nothing (`report.md` and `meta.json` unchanged by the halt) and a repeat after removing the file returns `archive`; `change.md` without `created` halts before any commit, and so do `created: "2026-10-30"` (quoted; the skill's `awk` would keep the quotes) and `created:2026-10-30` (no space), each as kind A (outcome `halt` in `meta.json`, `archive` and `committed: false` in the output); budget-spent halt with `--archive` carries `archive: "skipped: run halted"` and `committed: false`, makes no commit and the report says `Archive: not run`; the Archive line does not change the `Steps:` count; commit message override (`policy.archive.commitMessage`) is used; `verify-archive` after a simulated `git mv` plus stamp returns `archived: true`. Added for the review: a `pre-commit` hook that stages an unrelated file makes `next` halt after the commit, the halt names the extra path and says the commit exists, `report.md` and `meta.json` are byte-identical before and after the halt; a `.gitignore` entry added after `init` (`agent-smith/`, then `*.jsonl`) halts at `done` before any commit; an existing `context/archive/<created>-demo` halts before any commit; after a first `next` returned `archive`, a staged unrelated file makes the second `next` halt with JSON only and `meta.json`, `report.md` and `git status --porcelain -- context/changes/demo` stay unchanged; a stray file in the folder (for example `.DS_Store`, not ignored) is part of the commit; the halt table is covered case by case: kind A (staged file before the first commit: `meta.json` outcome `halt`, `committed: false`), kind B (the staged-file resume above: `committed: true`, nothing written), kind C (the `pre-commit` hook above), kind D (the `post-commit` and the staging hook above: `committed: true`, nothing written); a non-ASCII file name (`zażółć.md`) in the folder: `next` returns `archive`, no halt, and the commit holds the file (test name contains `non-ASCII`); a nested root (`makeProject({ nest: "app" })`, git root one level up; test name contains `nested root`): `next` returns `archive`, `git show --name-only HEAD` lists paths starting with `app/context/changes/demo/`, and with a hook that stages an unrelated file the halt names that file by its git-root-relative path; the same two cases combined, with the nested directory named `ząb`; ignored files outside the probes: with `.gitignore` = `reviews/` (and `.DS_Store`) `next` returns `archive`, `ignored` lists `context/changes/demo/reviews/`, the commit does not hold `reviews/impl-review.md`, `git status --porcelain -- context/changes/demo` is empty, and nothing halts; `report.md` lists `Manual checks pending: 2` and both rows when two Manual rows are pending and has no such line when none are; with `archive.haltOnManualPending: true` in `context/foundation/agent-smith-policy.json` a pending Manual row halts before the commit and the default continues; a recording `git` shim first on `PATH` (a `/bin/sh` script that appends its argv to a log file, then runs the real `git`; the test is skipped on Windows) during `init --archive` and the full path (test name contains `git subcommands`) asserts, over every logged call: the subcommand is the first argument after leading `-c <key=value>` pairs (the router's own churn calls and every `runGit` call start with `-c core.quotePath=false`) and is one of the allowed list `rev-parse`, `check-ignore`, `symbolic-ref`, `diff`, `status`, `add`, `commit`, `reset`, `show`, `ls-files` and `log` (`log` is the churn code from `rigor-levels`, which reads on every `next` that has a plan); the only `-c` value is `core.quotePath=false`; no call is `push`; no argument is `--no-verify` or `--no-gpg-sign`; every `add`, `commit` and `reset` call ends with `-- context/changes/demo` and has no other pathspec. The allowed list and the "only writes on the change folder" rule bind the adapter; the churn reads (`log`, `diff`, `rev-parse HEAD`) keep their own behavior.

### Success Criteria:

#### Automated Verification:

- Adapter tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Existing routing and report tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The router never pushes or skips hooks: `! grep -nE "[\"']push[\"']|git push|--no-verify|--no-gpg-sign" skills/10x-pipeline/scripts/route.mjs && node --test --test-name-pattern="git subcommands" skills/10x-pipeline/test/archive.test.mjs`
- Non-ASCII names and a nested project root pass: `node --test --test-name-pattern="non-ASCII|nested root" skills/10x-pipeline/test/archive.test.mjs`

#### Manual Verification:

- In a scratch git repo, a finished run with `--archive` leaves one new commit `chore(demo): commit change folder before archive` and `git status` clean for the change folder
- `route.mjs next demo` prints an `archive` action whose prompt lists the archive rules and whose `archivePath` matches `change.md` `created`
- In a scratch repo with a `pre-commit` hook that stages an unrelated file, `next demo` halts after the commit, names the extra path, and leaves `meta.json` and `report.md` unchanged by the halt
- In a scratch repo with `reviews/` in `.gitignore` and a non-ASCII file name in the change folder, `next demo` returns `archive` with `ignored` naming `reviews/` and does not halt

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Orchestrator loop, documentation and end-to-end run

### Overview

Teach the orchestrator the `archive` action and document the adapter and its git write, and fix the roadmap wording. Finish with one real run.

### Changes Required:

#### 1. `SKILL.md`

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add `--archive` to the arguments, the `archive` action to the loop, and the guard against touching the router after the move. Fix Start step 2 for an archived change. Keep relative wording; no model, effort or tier names. Add a bullet to "How the tier moves" (`AGENTS.md` asks for it when tier data changes).

**Contract**: `argument-hint` gains `[--archive]`; Start parses it and passes `--archive` to `init` only when the user gave it, removing it from the goal text. Start step 2: when `change.md` is missing, first run `node $ROUTER verify-archive <change-id>` (no `--path`); if archived, tell the user where and STOP; otherwise the existing `/10x-new` message. "How the tier moves" gains one bullet in relative wording: the archive step is not moved by any rule above, its tier is pinned by the policy. Loop gets **`archive`**: (1) run `node $ROUTER status <change-id>` now, before the move, and report what `done` reports (final verdict from `summary.reason`, steps, every `summary.manualPending` item as a checklist, the per-step list, the `report` path); (2) print one line `Archive: /10x-archive on <model>/<effort>.`; (3) call the Agent tool with the router's `prompt` verbatim and the same parameters as for `run`; (4) do not write a result file and do not call `next`; (5) run `node $ROUTER verify-archive <change-id> --path <archivePath>` with the `archivePath` of the `archive` action; on `archived: true` print the archive path and the report path inside it, print one line telling the user to confirm `git status` is clean (`verify-archive` reads files only; if the `chore(archive)` commit failed, the rename is staged and uncommitted), repeat every `manualPending` item as the checklist of checks nobody verified, list the action's `ignored` paths as "not committed (ignored by git)" when there are any, and copy the subagent's `assumptions` and any usage figure it reported into the final message; on `archived: false` print `reason` and the subagent's note, say the folder may be unchanged or half-archived, and STOP. `halt` gains: when the output has `archive`, say the change was not archived; then, when `committed` is `false`, say the folder is not committed and `/10x-archive` needs it committed first, and when `committed` is `true`, say the pre-archive commit exists locally, the router did not undo it, and `route.mjs next <change-id>` repeats the checks safely once the cause is fixed. Rules gain: after `archive` never run `init`, `next` or `status --report` for that change.

#### 2. `README.md`

**File**: `README.md`

**Intent**: Document usage and behavior for readers.

**Contract**: Skill usage line `/agent-smith:10x-pipeline <change-id> [goal] [--archive]`. New "Archive (opt-in)" bullet group: what `--archive` does at `done`, the commit message, the staged-files, post-commit and clean-folder checks, that the router never pushes, that the commit lands on the current branch (protected branches such as `main` are not detected), that every file in the change folder that git does not ignore is committed (editor junk such as `.DS_Store` too, unless ignored), that ignored files outside the four probes are listed in the `archive` action and the final message, are not committed and still move with the folder, that a halted run is not archived and what `committed` in a halt means, the `verify-archive <id> [--path <p>]` command (file checks only; check `git status` afterwards), the report's totals not covering the archive step, the ignored-file refusal (any of `run.jsonl`, `meta.json`, `report.md`, `change.md`), the pending Manual rows listed in `report.md`, and the `archive.haltOnManualPending` key (default `false`). Layout block unchanged beyond what `rigor-levels` added. Same facts as `SKILL.md` and ADR-003. No version bump.

#### 3. `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Keep the contributor guide true now that the router can write to git.

**Contract**: Commands list gains `verify-archive <id>` and the `--archive` flag on `init`. The Hard Rules bullet about `route.mjs` ownership adds: the router's only git writes are the index and commit writes of the pre-archive commit in the `done` branch (`git add`, `git commit`, and a `git reset` of its own add after a failure); it never pushes. Testing section already names `node --test ...` (from `rigor-levels`). Keep every other rule.

#### 4. ADR-003 section

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the router's first git write and the FR-008 outcome, in the skeleton `rigor-levels` wrote. Flip the part owned by this change from `planned` to described.

**Contract**: One section "Archive adapter" under Decision. In the table of parts, rename the skeleton row `archive-and-lessons` to `archive-adapter` and add a separate `lesson-candidates` row (owned by the next change). Make the intro agree with the table (plan review round 2, F4): "The work is split in four changes" becomes five, "changes 2 to 4 only listed" and "Design of changes 2 to 4" become "changes 2 to 5", the Origin line gains "later split into five (S-09 into archive-adapter and lesson-candidates)", and the sentence "The git write decision of change 4 ... is future work, not decided here" is replaced by a pointer to the new section. The section states the git facts as they are: the router already READS git (`rev-parse HEAD` for `baseSha`, `log` and `diff` for churn risk, see "Churn risk"); with `--archive` it also WRITES, which is its first git write: it commits the change folder including `agent-smith/`, which settles the FR-008 deferral ("git handling is decided downstream"); without the flag the router writes nothing to git; with it the router's git writes are limited to `git add`, `git commit` and a `git reset` of its own add; the commit lands on the current branch (protected branches are not detected) and is never pushed; it includes every file in the folder that git does not ignore (ignored files outside the four probes are reported in the `archive` action and stay out of history, though `git mv` carries them); the commit is checked after the fact (index empty, only the folder touched, compared as raw NUL-separated paths) because a hook can stage other files; the archive step has no log entry, no usage figure and no report row; the report line `Archive: requested` stays in the archived copy; alternatives considered (commit only `agent-smith/` and halt on other dirty paths, which cannot succeed on a normal run; gitignore `agent-smith/`; require a human commit first; change `/10x-archive`). Consequences: a halted run is not archived; Manual rows pending at `done` raise the warnings prompt that the subagent has `Continue archiving` given as its answer, and are listed in `report.md` (or halt the run when `archive.haltOnManualPending` is `true`); an ignored probe file (`run.jsonl`, `meta.json`, `report.md`, `change.md`) is refused; a post-commit failure leaves the commit in place and a resume repeats safely, printing JSON only (the halt table of the plan: only a halt before the commit writes the run's end state); the archive subagent's own SHA history check may run `git fetch` and `gh`, outside the router's write rule; `verify-archive` is file-only, so a staged-but-uncommitted archive reads as archived and the orchestrator reminds the user to check `git status`; a git timeout kills git but may leave a hung hook child and a stale `index.lock`. The rules below appear as GIVEN/WHEN/THEN lines outside fenced blocks, checked by the `rigor-levels` rule-form test:

- **GIVEN** a run started without `--archive` **WHEN** the router reaches `done` **THEN** it **MUST NOT** run a git command that writes the index or history.
- **GIVEN** `--archive` is set **WHEN** anything is staged, HEAD is detached or a merge or rebase is in progress **THEN** the router **MUST** halt before it commits.
- **GIVEN** a git command fails during the pre-archive commit **WHEN** the router handles the failure **THEN** it **MUST** halt with the git message and skip the archive.
- **GIVEN** the router commits the change folder **WHEN** a commit hook fails **THEN** the router **MUST NOT** pass `--no-verify`.
- **GIVEN** the change folder is committed **WHEN** the archive action has been returned **THEN** the router **MUST NOT** write under `context/changes/<id>/`.
- **GIVEN** the pre-archive commit succeeded **WHEN** the run ends **THEN** the router **MUST NOT** push.

#### 5. PRD FR-008 note

**File**: `context/foundation/prd.md`

**Intent**: Close the deferral recorded in FR-008's Socrates note.

**Contract**: Edit the FR-008 entry only: a dated note (2026-10-30, from `archive-adapter`) that git handling is resolved: with `--archive` the change folder, including `agent-smith/`, is committed before archive; without the flag the router writes nothing to git (it only reads history, for churn risk). Do not write that the router "does not use git": it reads history since `rigor-levels` (plan review round 2, F4). Keep the note to one line so the criterion below does not depend on line counts.

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
- No document says the router never uses git: `! grep -nE "never touches git|does not use git|no git access|never uses git" docs/ADR/ADR-003-rigor-gated-routing.md context/foundation/prd.md README.md AGENTS.md skills/10x-pipeline/SKILL.md`

#### Manual Verification:

- End to end on a throwaway git repo with a trivial change: `/agent-smith:10x-pipeline demo "fix typo" --archive` ends with commits `chore(demo): commit change folder before archive` and `chore(archive): close demo`, `verify-archive demo` prints `archived: true`, and `context/archive/<date>-demo/agent-smith/report.md` exists
- In that run the archive subagent, which has no question tool and so takes the skill's plain-text path, answered the warnings prompt with `Continue archiving` (pending Manual rows trigger it), did not stop with `blocked` and ended with a `RESULT:` line; its `assumptions` and the pending Manual rows appear in the final message and the Manual rows in the archived `report.md`. The throwaway repo has no remote and an unmerged branch, and the Progress rows carry SHA suffixes from the implement step (if they do not, add one by hand before the run), so the run also exercises the SHA history check: the subagent did not ask the user to identify a remote, branch or commit, and its `assumptions` carry the SHA diagnostics
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

- `archive.test.mjs`: scratch project per test; real `route.mjs` through `spawnSync`; hermetic git (`gitEnv(project)` for the test and, through `run(..., { env })`, for the router subprocess). Guard, `verify-archive` (including a tree-unchanged check and the `--path` forms), flag and persistence, pre-checks, commit, the four halt kinds, hook failures, idempotent repeat, report lines, non-ASCII names, nested project root, ignored files, `created` forms, the git-subcommand shim, no-`--archive` regression. Git-dependent cases skip with a clear message when `git` is missing; the shim case also skips on Windows.
- Log fixtures come from `writeLog` in `helpers.mjs`; AGENTS.md forbids hand edits only for real runs.
- Node 18 is the supported floor: follow the Node 18 ban list of `rigor-levels` Phase 2. Run `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` once before the PR; if Node 18 cannot be run, the PR says so.

### Manual Testing Steps:

1. Phase 4 end-to-end run on a throwaway repo with real `/10x-archive` (the only check that exercises the prompt answers against the real skill).
2. In that repo, try `--archive` with `agent-smith/` in `.gitignore` and expect the refusal at `init`.
3. Interrupt the orchestrator after the `archive` action but before the Agent call, re-run `init`, and expect the same `archive` action with `commit: null`.

## Performance Considerations

About a dozen local git calls once per run, at `done` (plus the churn reads that `rigor-levels` already makes on every `next`). The commit may run the project's hooks; `policy.archive.gitTimeoutMs` (120 s) bounds git and a timeout halts with the git message. A timeout kills git but not a hook child it started: the child may keep running, and the best-effort `git reset` after the failure can meet a stale `.git/index.lock`. The halt message says so. A hook that rewrites files in the folder is caught by the clean check; a resume re-adds and re-commits, and a hook that never converges needs a human.

## Migration Notes

Existing `meta.json` files have no `archive` key and behave as before. The re-entry guard changes one existing behavior: `init` or `next` on a change that was archived by hand now halts instead of recreating `context/changes/<id>/agent-smith/`. A run in flight when the router is upgraded can opt in at its next `init --archive`. A change already stamped `status: archived` but not moved (partial `/10x-archive` failure) is reported as not archived by `verify-archive`, makes `init`, `next` and `status --report` halt without writing, and needs a human.

## References

- Related research: `context/changes/archive-adapter/research.md` (including Owner decisions), `context/changes/rigor-levels/research.md` (section 4, Follow-up 1 "Archive adapter")
- Contract plan: `context/changes/rigor-levels/plan.md` and its plan review, both approved SOUND on branch `rigor-levels-plan-review-2`
- Plan review of this change: `context/changes/archive-adapter/reviews/plan-review.md` (round 2, verdict REVISE; its findings F1 to F8 are resolved in this revision, round 1 F1 to F9 in the one before)
- Router (by function, in the merged `rigor-levels` version, branch `rigor-levels-fix`): `endRun`, `decide` (the `done` return), `next`, `main` (dispatch and `init`), `gitOut`, `tierFor`, `resolveRigor`, `buildReport`, `attachResult`
- Orchestrator: `skills/10x-pipeline/SKILL.md` (Start, Loop, Rules, "How the tier moves")
- Policy: `skills/10x-pipeline/policy.json` (`steps`, `prompts`, `rigor`)
- `/10x-archive`: `~/.claude/skills/10x-archive/SKILL.md:64-143` (blocks, prompts), `:113` (SHA history check), `:154-206` (move, commit), `references/archive-sha.md`
- Test helpers: `skills/10x-pipeline/test/helpers.mjs` and `rules.test.mjs` in `rigor-levels-fix`
- Prior design: `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`
- Requirements: `context/foundation/prd.md` FR-004, FR-008

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Re-entry guard and `verify-archive`

#### Automated

- [x] 1.1 Guard and `verify-archive` tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs` — 7f586e7
- [x] 1.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 7f586e7

#### Manual

- [ ] 1.3 In a scratch folder with a hand-made `context/archive/2026-10-30-demo/change.md` (`status: archived`), `verify-archive demo` prints `archived: true`, and `init demo` halts without creating `context/changes/`

### Phase 2: Archive policy data and the `--archive` flag

#### Automated

- [x] 2.1 Flag, persistence and policy tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs` — f11536b
- [x] 2.2 Rule-form test passes on the archive prompt: `node --test skills/10x-pipeline/test/rules.test.mjs` — f11536b
- [x] 2.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — f11536b
- [x] 2.4 `policy.json` carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.steps.archive||!p.archive.commitMessage||p.archive.haltOnManualPending!==false||!p.prompts.archive)process.exit(1)'` — f11536b

#### Manual

- [ ] 2.5 In a scratch git repo, `init demo --goal "fix typo" --archive` returns a `run` for `plan` and `meta.json` holds `"archive": true`; in a folder without git the same command halts with a clear reason
- [ ] 2.6 The `prompts.archive` text reads as one rule per line, each with one bold keyword (nine rules, including the SHA history rule and the blocking-warning precedence rule)

### Phase 3: The `done` branch — commit, clean check, `archive` action

#### Automated

- [x] 3.1 Adapter tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs` — 03025de
- [x] 3.2 Existing routing and report tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs` — 03025de
- [x] 3.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 03025de
- [x] 3.4 The router never pushes or skips hooks: `! grep -nE "[\"']push[\"']|git push|--no-verify|--no-gpg-sign" skills/10x-pipeline/scripts/route.mjs && node --test --test-name-pattern="git subcommands" skills/10x-pipeline/test/archive.test.mjs` — 03025de
- [x] 3.9 Non-ASCII names and a nested project root pass: `node --test --test-name-pattern="non-ASCII|nested root" skills/10x-pipeline/test/archive.test.mjs` — 03025de

#### Manual

- [ ] 3.5 In a scratch git repo, a finished run with `--archive` leaves one new commit `chore(demo): commit change folder before archive` and `git status` clean for the change folder
- [ ] 3.6 `route.mjs next demo` prints an `archive` action whose prompt lists the archive rules and whose `archivePath` matches `change.md` `created`
- [ ] 3.7 In a scratch repo with a `pre-commit` hook that stages an unrelated file, `next demo` halts after the commit, names the extra path, and leaves `meta.json` and `report.md` unchanged by the halt
- [ ] 3.8 In a scratch repo with `reviews/` in `.gitignore` and a non-ASCII file name in the change folder, `next demo` returns `archive` with `ignored` naming `reviews/` and does not halt

### Phase 4: Orchestrator loop, documentation and end-to-end run

#### Automated

- [x] 4.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 35f085e
- [x] 4.2 The adapter is documented in all places: `for f in skills/10x-pipeline/SKILL.md README.md AGENTS.md docs/ADR/ADR-003-rigor-gated-routing.md; do grep -q "verify-archive" "$f" || exit 1; done` — 35f085e
- [x] 4.3 `SKILL.md` names no model, effort level or absolute tier: `! grep -Eiq "haiku|sonnet|opus|xhigh|tier [0-9]|effort[^.]{0,40}\b(low|medium|high|max)\b|\b(low|medium|high|max)\b[^.]{0,20}effort" skills/10x-pipeline/SKILL.md` — 35f085e
- [x] 4.4 `SKILL.md` documents the flag and the action: `grep -q -- "--archive" skills/10x-pipeline/SKILL.md && grep -q '`archive`' skills/10x-pipeline/SKILL.md` — 35f085e
- [x] 4.5 PRD FR-008 carries the note: `sed -n '/FR-008:/,/^- \[/p' context/foundation/prd.md | grep -q "archive-adapter"` — 35f085e
- [x] 4.6 Nothing under `context/archive/` changed: `test "$(git diff --name-only main -- context/archive | wc -l)" -eq 0` — 35f085e
- [x] 4.7 Manifests untouched: `test "$(git diff --name-only main -- .claude-plugin | wc -l)" -eq 0` — 35f085e
- [x] 4.14 No document says the router never uses git: `! grep -nE "never touches git|does not use git|no git access|never uses git" docs/ADR/ADR-003-rigor-gated-routing.md context/foundation/prd.md README.md AGENTS.md skills/10x-pipeline/SKILL.md` — 35f085e

#### Manual

- [ ] 4.8 End to end on a throwaway git repo with a trivial change: `/agent-smith:10x-pipeline demo "fix typo" --archive` ends with commits `chore(demo): commit change folder before archive` and `chore(archive): close demo`, `verify-archive demo` prints `archived: true`, and `context/archive/<date>-demo/agent-smith/report.md` exists
- [ ] 4.9 In that run the archive subagent, which has no question tool and so takes the skill's plain-text path, answered the warnings prompt with `Continue archiving` (pending Manual rows trigger it), did not stop with `blocked` and ended with a `RESULT:` line; its `assumptions` and the pending Manual rows appear in the final message and the Manual rows in the archived `report.md`. The throwaway repo has no remote and an unmerged branch, and the Progress rows carry SHA suffixes from the implement step (if they do not, add one by hand before the run), so the run also exercises the SHA history check: the subagent did not ask the user to identify a remote, branch or commit, and its `assumptions` carry the SHA diagnostics
- [ ] 4.10 A second run with a deliberately staged file halts before any commit and the output says the run was not archived
- [ ] 4.11 `SKILL.md`, `README.md`, ADR-003 and `route.mjs` describe the same sequence (pre-checks, commit, clean check, action, verify)
- [ ] 4.12 PRD FR-008 and ADR-003 agree on the git decision
- [ ] 4.13 The S-09 row and item in `context/foundation/roadmap.md` say "commit the change folder" and nothing else in that file changed except the `planning` status
