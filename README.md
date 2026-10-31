<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

Agent orchestrating AI SDLC workflows (10xDevs + OpenSpec).

A Claude Code plugin. Each step of a skill chain runs in its own subagent. A router script picks the next step and its model and effort level from the results of the earlier steps.

## Install

```
/plugin marketplace add xycu/agent-smith
/plugin install agent-smith@agent-smith
```

## Skills

### `/agent-smith:10x-pipeline <change-id> [goal] [--archive] [--pr-comment]`

Runs a 10xDevs change end to end: plan, plan review, implement, implementation review, fix. With `--archive` it also commits the change folder and archives the change when the run is done (see "Archive (opt-in)").

Requirements in the target project:

- The 10x toolkit skills: `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`.
- A change folder made with `/10x-new <change-id>`.
- Node.js 18 or later. Churn risk also reads `git` history; without it the router flags no hot path. `--archive` needs a git work tree and the `10x-archive` skill.

How routing works:

- `skills/10x-pipeline/policy.json` defines a ladder of model/effort tiers, a base tier per step, and escalation rules.
- `skills/10x-pipeline/scripts/route.mjs` reads `plan.md` (`## Progress`) and `reviews/*.md` (verdict, finding counts) after every step and returns the next step, model, effort and prompt.
- The tier goes up for large plans, `RETHINK`/`REVISE`/`REJECTED` verdicts and failed attempts. It goes down after a clean review and for a simple change (a small plan or a short goal). A hard keyword in the goal, such as `refactor` or `security`, keeps the first plan at the plan step's base tier.
- The first plan reads the goal text. A brief goal (at most 25 words, no hard keyword) lowers the plan tier by 1 and earns the simple-change discount. Any other goal lowers it by 1, and a goal with a hard keyword lowers it by nothing. The word limit and the keyword list sit under `complexity.firstPlan` in `policy.json` and can be overridden per project.
- Effort floor: plan, plan review and implementation review ask questions, so they never run below the floor in `rigor.minEffort` for the run's rigor level. The floor beats the simple-change discount, and the report marks a step as simple only when the discount survived.
- A step counts as failed when the subagent does not report `done` or the expected file did not change.
- The archive step is not moved by any of these rules: the policy pins its tier.
- The run halts for a human after repeated failures, too many plan revisions or fix loops, or when the step budget is spent.

Rigor:

- Every run has a rigor level, `lean`, `standard` or `thorough`, stored in `meta.json` and kept on resume. It starts from the goal class (a short goal is `lean`) or from `init <id> --rigor <level>`, and it only rises: with 3 or more phases (`standard`) or 6 or more (`thorough`), after failed steps, when the plan or the diff touches a hot path, and when a subagent result carries `signals.rigor`.
- Hot paths come from churn: paths that change often in the repository history, counted up to the commit the run started from (`meta.baseSha`). The parameters sit under `risk` in `policy.json` and are uncalibrated. `node skills/10x-pipeline/scripts/route.mjs risk <change-id>` prints the hot paths, the plan hits and the diff hits and writes nothing.
- At `lean` the router skips plan review before implementation starts, if risk was measured (history readable, the plan names at least one path, and every named path can be matched against the hot set: a file, a directory, a glob or an absolute path under the project root) and no named path is hot. The skip is logged in `run.jsonl` with its reason and listed in `report.md`. If risk could not be measured, plan review runs. Implementation review is never skipped.
- The step budget is `limits.maxTotalSteps` plus a delta per level (smaller at `lean`, larger at `thorough`). Skipped steps use no budget.
- A subagent can end its `RESULT:` line with an optional `signals` object. The router keeps two keys: `rigor` (raises the level) and `needsHuman` (halts the run once with a report). It ignores the rest.
- Prompt rules follow the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (ADR-004). `node --test skills/10x-pipeline/test/*.test.mjs` checks the form and the router behavior.

Archive (opt-in):

- `init <id> --archive` stores `archive: true` in `meta.json`; a resume keeps it and `--archive false` turns it off. Without the flag the router writes nothing to git: `done` stays `done`. It only reads history, for churn risk.
- `init --archive` halts, and writes nothing, when the project is not a git work tree or git ignores any of `agent-smith/run.jsonl`, `agent-smith/meta.json`, `agent-smith/report.md` or `change.md` of the change. The same checks run again at `done`.
- At `done`, the router checks the git state first. It halts if anything is staged, HEAD is detached, a merge, rebase, cherry-pick or revert is in progress, `change.md` has no `created: YYYY-MM-DD` line, or the archive folder `context/archive/<created>-<id>` already exists. With `archive.haltOnManualPending` set to `true` it also halts when Manual rows are pending; the default is `false`.
- Then it writes the final `report.md`, commits `context/changes/<id>/` as `chore(<id>): commit change folder before archive` (`archive.commitMessage` in the policy), and returns an `archive` action. The commit is skipped when it would be empty.
- Three checks follow the commit, because a hook can stage or write other files: the index is empty, the commit touched only the change folder, and the folder is clean. A failed `git add` or `git commit` halts with git's message and unstages the router's own add. Hooks and signing apply; the router never skips them and never pushes.
- The commit lands on the current branch. Protected branches such as `main` are not detected.
- Every file in the change folder that git does not ignore is committed, editor junk such as `.DS_Store` included. Ignored files outside the four files above are not committed. The `archive` action lists them (at most ten) and the final message shows them as "not committed (ignored by git)"; they still move with the folder.
- The orchestrator then runs `/10x-archive <id>` in one subagent. Its prompt gives the answers to the skill's questions as rules: continue past warnings, archive without repointing, never ask. A blocking warning, such as missing review coverage, ends the step as `blocked`.
- `route.mjs verify-archive <id> [--path <p>]` confirms the move from files alone: the archive folder has `status: archived` in its `change.md` and `context/changes/<id>/` is gone. It does not call git, so check `git status` afterwards. `--path` names the exact folder (`context/archive/<date>-<id>`); the orchestrator passes the `archivePath` of the `archive` action. When an id was archived more than once and no `--path` is given, the answer is `archived: false` with an `ambiguous` list of the folders. `archivedAt` is a string, or `null` when the field is absent or `null`.
- `init`, `next` and `status --report` halt, and write nothing, for a change that is archived or stamped `status: archived` with its folder still in place.
- `report.md` carries `Archive: requested - runs after this report was written`. Pending Manual rows are listed there as `Manual checks pending: N`, because this report is the only router file that survives the move. The archive step has no log entry, no usage figure and no report row, so the totals cover the steps before it.
- A halt is never archived. A halt printed by the `done` branch or by the end of the run carries `archive: "skipped: ..."` and `committed`. `committed: false` means nothing was committed: the folder is uncommitted and `/10x-archive` needs a commit first. `committed: true` means the pre-archive commit exists locally and the router did not undo it; `next` repeats the checks safely after the cause is fixed, without a second commit. On that repeat the check that the commit touched only the change folder is skipped, because no new commit is made. Halts printed elsewhere carry neither field: a missing result file, a guard halt for an archived change, usage and flag errors, errors at `init` and `Router error:`.

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Run state lives in `context/changes/<change-id>/agent-smith/`.

Usage report:

- When a run ends (`done` or `halt`, including a spent step budget or repeated failures), the router writes `context/changes/<change-id>/agent-smith/report.md` and adds its path to the output as `report`.
- The report has the goal, the rigor level and the outcome, then one table row per executed step: model, effort, tier, simple-change flag, result and tokens. A totals line sums the tokens and gives the number of skipped steps. A `## Skipped steps` section lists each skip with its reason.
- Token figures are optional. The orchestrator passes along the total tokens, tool uses and duration of a step when the Agent result reports them. A step without a figure shows `-`, and the totals line says how many steps it covers.
- `node skills/10x-pipeline/scripts/route.mjs status <change-id> --report` rewrites the report on demand. For a run in progress it prints `Outcome: not ended`. Plain `status` stays read-only.
- A halt for a missing result file writes no report. A run that continues after a halt keeps the old `report.md` until it ends again or you run `status --report`.

Limits:

- Subagents cannot use `AskUserQuestion`. Where a skill would ask, the subagent decides from researched best practice, cites the evidence and lists the decision as an assumption. With no evidence-backed answer it reports `blocked` with `signals.needsHuman`, and the router halts.
- `10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more (the default since Claude Code v2.1.219).

PR comment (opt-in):

- Needs the GitHub CLI `gh`, authenticated, and only with `--pr-comment`. Without the flag nothing is posted and `gh` is not needed. The permission a fine-grained token needs is not verified yet (pull requests or issues write is the expected one).
- Opt-in because the comment is visible to collaborators and carries the goal text. The PRD wording "is posted" is therefore met only when the flag is given.
- When the run ends (`done`, `archive` or `halt` with a `report`), the orchestrator runs `skills/10x-pipeline/scripts/pr-comment.mjs <change-id>`. It posts `report.md` as one comment on the open pull request of the current branch. In an `archive` run it posts before the move. The flag is kept as an orchestrator task named `PR comment: <change-id>` and read at each end of the run; `route.mjs` and `policy.json` are not involved.
- One comment per change per pull request. The first line is a hidden marker, `<!-- agent-smith:pr-report change=<change-id> -->`. A later run edits the comment of the same author that holds the marker, even after you edited it in the GitHub web UI. It never edits another comment. When `gh api user` fails (some integration tokens), it matches by marker only and reports `match: "marker-only"`. The edit replaces the earlier text; GitHub keeps the edit history.
- Skip reasons, each with exit code 0 and no effect on the run: `gh is not installed`, `gh is not authenticated`, `no pull request for this branch`, `not a git work tree`, `pull request is MERGED` or `CLOSED`, `unsupported host <host>` (no GitHub Enterprise), `gh timed out` (each call has 20 seconds; a pull request with hundreds of comments can exceed that while the comment list is read, and the skip posts nothing and cannot duplicate), `comment lookup failed`, `comment request failed`, a missing, empty or foreign report, and `task list unavailable` (the task tools are missing, so the flag cannot be stored and nothing is posted). A draft pull request gets the comment.
- The orchestrator prints a `PR comment:` line when the flag was given. A missing line means the step was dropped.
- Mentions such as `@name` in the report get a zero-width space after the `@`, so nobody is notified. A body over 60000 UTF-16 code units is cut and says how many characters were omitted.
- Nothing is written to the change folder, so `report.md` cannot say whether it was posted. The result is in the final message only.
- A change id is at most 100 characters for the script (the marker must fit in the comment head). The router has no such limit, so a longer id ends in `PR comment: skipped, script error`.
- A run that ended before the pull request existed: open the pull request, check out its branch and run `node <plugin>/skills/10x-pipeline/scripts/pr-comment.mjs <change-id> [--report context/archive/<date>-<change-id>/agent-smith/report.md]` from the project root. The comment goes to the pull request of the branch checked out now, so run it from the branch of that pull request. The result prints the pull request url. `--report` accepts only a file named `report.md` inside a directory named `agent-smith`, whose first line is `# Run report: <change-id>`.

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   marketplace with this repo as its only plugin
skills/10x-pipeline/              orchestrator skill, policy, router
skills/10x-pipeline/test/         node:test suite for the router and the prompt rule form
docs/ADR/                         architecture decision records
assets/                           README header image
```
