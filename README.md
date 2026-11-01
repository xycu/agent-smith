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

### `/agent-smith:10x-pipeline <change-id> [goal] [--archive] [--chrome] [--pr-comment]`

Runs a 10xDevs change end to end: plan, plan review, implement, implementation review, fix. With `--archive` it also commits the change folder and archives the change when the run is done (see "Archive (opt-in)").

Requirements in the target project:

- The 10x toolkit skills: `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`.
- A change folder made with `/10x-new <change-id>`.
- Node.js 24 or later (ADR-006). Claude Code does not guarantee a `node` on PATH (a native install is a single binary), so install it yourself. Churn risk also reads `git` history; without it the router flags no hot path. `--archive` needs a git work tree and the `10x-archive` skill.
- The `10x-research` and `10x-frame` skills are used when a pre-plan gate opens or when a `thorough` run loops (see "Pre-plan steps"). A step whose skill is missing fails three times and halts the run. A run that stays at `standard` or `lean` runs no such step and needs neither skill.

How routing works:

- `skills/10x-pipeline/policy.json` defines a ladder of model/effort tiers, a base tier per step, and escalation rules.
- `skills/10x-pipeline/scripts/route.mjs` reads `plan.md` (`## Progress`) and `reviews/*.md` (verdict, finding counts) after every step and returns the next step, model, effort and prompt.
- The tier goes up for large plans, `RETHINK`/`REVISE`/`REJECTED` verdicts and failed attempts. It goes down after a clean review and for a simple change (a small plan or a short goal). A hard keyword in the goal, such as `refactor` or `security`, keeps the first plan at the plan step's base tier.
- The first plan reads the goal text. A brief goal (at most 25 words, no hard keyword) lowers the plan tier by 1 and earns the simple-change discount. Any other goal lowers it by 1, and a goal with a hard keyword lowers it by nothing. The word limit and the keyword list sit under `complexity.firstPlan` in `policy.json` and can be overridden per project.
- Effort floor: plan, plan review and implementation review ask questions, so they never run below the floor in `rigor.minEffort` for the run's rigor level. The floor beats the simple-change discount, and the report marks a step as simple only when the discount survived.
- A step counts as failed when the subagent does not report `done` or the expected file did not change.
- Both reviews apply their own fixes (`prompts/plan-review-apply.md`, `prompts/impl-review-apply.md`): a finding with a clear fix is applied to `plan.md` (plan review) or to the code, tested and committed (implementation review) before the step ends, and marked `Decision: APPLIED` in the review file. Findings that need an owner decision stay `PENDING`. The verdict and finding counts stay as measured before the edits, so the router's decisions are unchanged.
- The archive step is not moved by any of these rules: the policy pins its tier.
- At rigor `thorough` the router can run `research`, `domain-brief` and `frame` before the first plan, and a plan review `RETHINK` or a repeated `REVISE` can send the run back to `frame` or `research` once before the re-plan. Both are off below `thorough` by default. See "Pre-plan steps".
- From `standard` up the router can swap the plain implement step for a phase executor (`implement-e2e`, `implement-tdd`, `implement-segment`), re-plan after code ran (`plan-replan` after two implement failures in a row, `plan-rejected` after a first `REJECTED` review) and run `manual-verify` before the implementation review. A tdd or e2e step also needs a code commit to count as done, and a step that ends `blocked` falls back with no failure counted. See "Phase executors".
- The run halts for a human after repeated failures, too many plan revisions or fix loops, or when the step budget is spent.

Rigor:

- Every run has a rigor level, `lean`, `standard` or `thorough`, stored in `meta.json` and kept on resume. It starts from the goal class (a short goal is `lean`) or from `init <id> --rigor <level>`, and it only rises: with 3 or more phases (`standard`) or 6 or more (`thorough`), after failed steps, when the plan or the diff touches a hot path, and when a subagent result carries `signals.rigor`.
- Hot paths come from churn: paths that change often in the repository history, counted up to the commit the run started from (`meta.baseSha`). The parameters sit under `risk` in `policy.json` and are uncalibrated. `node skills/10x-pipeline/scripts/route.mjs risk <change-id>` prints the hot paths, the plan hits and the diff hits and writes nothing.
- At `lean` the router skips plan review before implementation starts, if risk was measured (history readable, the plan names at least one path, and every named path can be matched against the hot set: a file, a directory, a glob or an absolute path under the project root) and no named path is hot. The skip is logged in `run.jsonl` with its reason and listed in `report.md`. If risk could not be measured, plan review runs. Implementation review is never skipped.
- The step budget is `limits.maxTotalSteps` plus a delta per level (`rigor.budgetDelta`: -4, +2 and +7, so 10, 16 and 21 steps). Skipped steps use no budget. See "Budget" below for the longest path each level is sized for.
- A subagent can end its `RESULT:` line with an optional `signals` object. The router keeps three keys: `rigor` (raises the level), `needsHuman` (halts the run once with a report) and `lessonCandidates` (an `impl-review` result only; see "Lesson candidates"). It ignores the rest.
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

Pre-plan steps:

- Three optional steps can run before the first `plan` step, in this order, and two loops can send a run back after plan review. Both sit under `preplan` in `policy.json`. Every gate and both loops default to rigor `thorough`. Their word lists and thresholds are uncalibrated: no run data exists yet.
- Pre-plan steps open only for a run that starts at `thorough`, for example `init <id> --rigor thorough`. They are decided once, before the first plan attempt. Every other way to reach `thorough` (a `signals.rigor` in a step result, a plan of 6 or more phases, three failed steps, three hot paths) needs a plan or a finished step first, so a later rise does not open them.
- The loops read the run's current level, so any rise to `thorough` opens them from then on: a standard run that rises to `thorough` mid-run gets the frame round on its next `RETHINK`. An in-flight standard run whose plan already has 6 or more phases starts the frame round on its next `RETHINK`. A run that stays at `standard` or `lean` behaves as before: no new step, no skip entry, and `RETHINK` and `REVISE` re-plan as described above.
- A gate closed by the rigor level is silent. A gate that is open and does not run logs a skip with its reason, in `run.jsonl`, `status` and `report.md`. All three steps can skip in one call.

| Step | Opens at | Runs when | Skipped when | Template |
| --- | --- | --- | --- | --- |
| `research` | `thorough` | always | `research.md` exists | `research`, or `research-with-map` when `context/map/repo-map.md` has `artifact: repo-map` in its frontmatter |
| `domain-brief` | `thorough` | `aggregateGap` or `dependencyLeak` hits | a brief file exists (`refactor-invariant-aggregate.md` or `refactor-anti-corruption-layer.md`), or no signal | `domain-aggregate` when `aggregateGap` hits (it wins), else `domain-acl` |
| `frame` | `thorough` | `framingDoubt` hits | `frame.md` exists, or no signal | `frame` |

`frame` is pinned to one tier by `steps.frame` in the policy. Each step is verified by the file it writes: `research.md` needs `status` frontmatter, `frame.md` needs a `## Reframed` heading (the Confidence label is never read), and a brief needs `type: refactor-plan`. The file must also be newer than the step start. A failed attempt retries at the next tier and halts after three. The plan prompt lists the upstream artifacts that exist, so `/10x-plan` reads them.

| Predicate | What it reads | Default |
| --- | --- | --- |
| `framingDoubt` | the goal, lowercased; a phrase matches where it starts at a word start. Or a `signals.rigor` on an earlier `research` or `domain-brief` result, whatever valid level it names (the key says the change is riskier than the goal suggested) | `root cause`, `should we even`, `is this the right`, `challenge the assumption`, `rethink`, `before i plan`, `caused by`, `because`, `assuming` |
| `dependencyLeak` | the goal, same matching | `vendor`, `sdk`, `third-party`, `third party`, `wrapper`, `adapter`, `leak`, `anti-corruption`, `swap out`, `external api` |
| `aggregateGap` | the first existing of `context/domain/domain-distillation.md` and `context/domain/01-domain-distillation.md`, section `## Invariants and policies` up to the next `## ` line | rows with status `declared`, `ignored` or `contradicted` |
| `repoMapExists`, `researchExists`, `frameExists`, `briefExists` | a file in the project or the change folder | n/a |

- The skill's own triggers `fix`, `bug` and `broken` are left out of `framingDoubt` on purpose: they would open a frame step for `fix typo`. To add them, override `preplan.predicates.framingDoubt.goalWords` in `context/foundation/agent-smith-policy.json`. Arrays are replaced whole, so repeat the defaults:

```json
{ "preplan": { "predicates": { "framingDoubt": { "goalWords": ["root cause", "should we even", "is this the right", "challenge the assumption", "rethink", "before i plan", "caused by", "because", "assuming", "fix", "bug", "broken"] } } } }
```

- `aggregateGap` reads every pipe table in that section whose header has a cell starting with `invariant` or `policy` and a `status` cell. The status of a row is the first alphabetic word of the cell, without `*`, `_` and backticks (`**declared** (soft)` reads as `declared`). A row hits when a status in the list shares a whole word with the goal. The words come from the `candidate` column (when present), the invariant or policy cell and the `gap` cell, as lowercase letter tokens of at least 4 letters that are not in `preplan.predicates.aggregateGap.stopwords`. A `###` heading is not a word source, and lists such as "Code-only rules" are not read. No file, no section or no matching row is no hit.
- `frame` runs unattended under a decision guide (`skills/10x-pipeline/prompts/frame-unattended.md`). A goal that names a task but no separate cause is confirmed as the problem statement and the run goes on. A `signals.needsHuman` in the result halts the run, whatever `frame.md` says.

Loops (`preplan.loops.minRigor`, default `thorough`):

- At or above `loops.minRigor`, a plan review `RETHINK` runs `frame` once (template `frame-rethink`), then re-plans. A second `RETHINK` after that re-plan halts for a human.
- At or above it, a `REVISE` that needs a re-plan, after one earlier `REVISE` re-plan, runs `research` once (template `research-revise`), then re-plans.
- A failed re-plan keeps spending a revision, as before, so `limits.maxPlanRevisions` still ends the run. `loops.rethinkToFrame`, `loops.reviseResearchAfter` and `loops.reviseResearchMax` set the counts; a value that is not a positive integer turns that loop off.
- Below `loops.minRigor`, `RETHINK` and `REVISE` re-plan exactly as without these loops.

Budget:

- The steps count against the step budget; skips do not. The budgets are 10 (`lean`), 16 (`standard`) and 21 (`thorough`). The longest failure-free path with every feature in play is 14 steps at `standard` and 19 at `thorough`, so one failed step and its retry still fit and a second failure can end the run with the budget spent. A test lets the router walk saturating plans and checks this; the same test shows that a pool allowance raised by one without a larger delta breaks it. `lean` keeps its path and its budget of 10 until a failure raises the rigor to `standard`; its pool is empty, and its budget of 10 already could not hold a 12-step path when plan review runs. Once the level has risen, the run has the pool of 2 and the budget of 16 of `standard`.
- Typical worst paths at `standard`: the plan loop (6 steps), a segment, an e2e step and a plain tail (3), then impl-review, fix, impl-review, fix, impl-review (5) is 14. At `thorough`: three pre-plan steps, a `RETHINK` with a frame round and a plan loop (10), segment, e2e, tdd and a plain tail (4), then 5 is 19.
- A project that overrides `rigor.budgetDelta` keeps its values. With a pool allowance above 0 and an old delta, the budget can halt a run that uses extra steps.

Phase executors:

- The step name stays `implement`; the template changes. For the first pending phase of `### Phase N` headings the router returns `implement-e2e` (a valid `/10x-e2e-setup` record in `context/foundation/test-stack.md` and a browser word in the phase), `implement-tdd` (rigor `thorough`, a phase whose files are code and whose rows name a test command) or the plain step. Goal phases in front of a special phase run as `implement-segment`, which stops after its last phase.
- The extra-step pool (`extraSteps.allowance`: `lean` 0, `standard` 2, `thorough` 3) pays for segments, e2e, tdd and `manual-verify` at 1 each and for the `plan-rejected` re-plan at 2. When the pool cannot pay for a segment and the executor after it, plain `implement` runs the whole plan.
- A tdd or e2e step counts as done only with ticked rows and a code commit since it began (read-only `git`; docs, lock files, `assets/**` and `context/**` do not count). The check is per step, not per row: one counted commit covers every row the step ticked. Without git, in a repository with no commit yet or with a head that cannot be resolved, the first check falls back to the count rule, so there is no strict check there. Rows left ticked without a commit get one `implement-retry` step; if they still have none, or the retry cannot check (no git, no commit yet, an unreadable head), the run goes on without a failure and the implementation review prompt carries a warning, with a note when commit evidence was unavailable. The rows are listed as `uncommittedTicks` in the final message, the `archive` summary and `meta.outcome`, and in `report.md` of an `--archive` run.
- A tdd or e2e step that ends `blocked` is a fallback: no failed attempt, no tier bump, no rigor rise, and the executor is not chosen again for that phase. The report shows `fallback`, and `compare` does not count it as a failed attempt. The report shows `implement (<template>)` in the Step cell.
- Code re-plans, at `standard` or above, one per run: `plan-replan` after two implement failures in a row, `plan-rejected` after a first implementation review `REJECTED` before any fix (cost 2 of the pool). A failed `plan-replan` halts the run.
- `manual-verify` runs once before the first implementation review at `standard` or above. A subagent runs the backticked command of each pending Manual row that has one and no human word, saves the output under `context/changes/<id>/evidence/` and ticks the row with ` — evidence: evidence/<name>`. The router checks that the file exists, is regular and non-empty, lies inside the real `evidence` folder and is newer than the step start, and that no Automated row, row title or SHA suffix changed. It never reads the content and never edits `plan.md`. A command that never ends by itself or waits for input is not run, and its row stays pending. A failed attempt is neutral (one retry), and ticks without valid evidence, a mangled evidence suffix included, are listed as `manualUnproven`.
- `--chrome` (an `init` flag, kept in `meta.json`; `--chrome false` clears it) selects the `manual-verify` template that may also check browser rows with the Chrome tools. The orchestrator does not probe for them.
- Word lists and extension lists (`executors`, `manualVerify`) are uncalibrated. Nothing here has run against a live `/10x-e2e`, `/10x-tdd`, `/10x-goal-implement` or Chrome session.

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Run state lives in `context/changes/<change-id>/agent-smith/`.

Usage report:

- When a run ends (`done` or `halt`, including a spent step budget or repeated failures), the router writes `context/changes/<change-id>/agent-smith/report.md` and adds its path to the output as `report`.
- The report has the goal, the rigor level and the outcome, then one table row per executed step: model, effort, tier, simple-change flag, result and tokens. A totals line sums the tokens and gives the number of skipped steps. A `## Skipped steps` section lists each skip with its reason.
- Token figures are optional. The orchestrator passes along the total tokens, tool uses and duration of a step when the Agent result reports them. A step without a figure shows `-`, and the totals line says how many steps it covers.
- `node skills/10x-pipeline/scripts/route.mjs status <change-id> --report` rewrites the report on demand. For a run in progress it prints `Outcome: not ended`. Plain `status` stays read-only.
- A halt for a missing result file writes no report. A run that continues after a halt keeps the old `report.md` until it ends again or you run `status --report`.

Lesson candidates:

- The implementation review subagent can end its `RESULT` `signals` with `lessonCandidates`, an array of rule sentences ("Always ...", "Never ...") for findings that would recur in other changes. The prompt asks for them and states both caps and the `RESULT` shape. Other steps' `lessonCandidates` are dropped.
- The router cleans each candidate (one line, no backticks, no format characters), drops case-insensitive repeats and keeps at most `lessons.maxCandidates` (default 3) per review, each cut to `lessons.maxChars` (default 200) code points, back to the last space when the cut falls inside a word. The caps are per review, not per run: a run with three accepted reviews lists at most 9. An invalid value reads as the default.
- `report.md` gets a `## Lesson candidates` section, one line per candidate: `` - `/10x-lesson <seed>` (step <n>) ``. A repeat across reviews shows once, with its first step number. A run with no candidates has no section.
- The pipeline never runs `/10x-lesson` and never writes `context/foundation/lessons.md`: the skill is an interview, so you run a command from the report yourself. The router does not compare candidates with `lessons.md`; the prompt asks the subagent to read that file and skip rules already in it.
- Override the caps in the `lessons` block of `context/foundation/agent-smith-policy.json`. A project that overrides the `impl-review` prompt with a plain string never asks for candidates.

Baseline comparison:

- The baseline is a full run of the same change with every step on the `sonnet` alias at `high` effort, at `standard` rigor, with plan review never skipped. It needs its own checkout: run state is per checkout, and a second `init` on the same change id resumes the first run.
- Make the baseline: read `meta.baseSha` of the routed run; `git worktree add <path> <baseSha>`; copy into it every input file the routed change folder held when its `init` ran (`change.md`, `research.md`, `frame.md` and similar) and none of the files the run produced (`plan.md`, `plan-brief.md`, `reviews/`, `agent-smith/`); copy `<plugin dir>/skills/10x-pipeline/baseline-policy.json` to `context/foundation/agent-smith-policy.json` there (`<plugin dir>` is the installed plugin directory, not a project path; if the project already has an override, merge by hand: arrays are replaced whole and `rigor` merges key by key); run `/agent-smith:10x-pipeline <change-id> <same goal text>` with no extra flag, because the file fixes `standard` rigor and keeps plan review on.
- Compare: `node skills/10x-pipeline/scripts/route.mjs compare <change-id> --baseline <worktree> [--routed <dir>] [--format md]`. It is read-only and writes nothing; redirect stdout to keep the output. `--routed` defaults to the current project. Each `<dir>` is a project root, or the `agent-smith` folder itself, and is read from `context/changes/<id>/agent-smith/` or, when the change is archived, from `context/archive/<date>-<id>/agent-smith/` (a live folder wins over an archived one and adds a warning; two archive folders for one id halt).
- The output has per-side totals and coverage (`stepsWithFigures` of `steps` for tokens, tool uses and duration), `pinned`, `comparable`, `reasons`, `warnings`, `dropPercent`, `targetDropPercent` and `verdict` (`target not set`, `met`, `not met` or `not comparable`). A pair is comparable only when both runs ended `done`, every executed step of both has a token figure and the baseline has at least one executed step, all on `sonnet` at `high`. A baseline whose token total is 0 is not comparable either (`baseline-total-zero`). A failed step that has no token figure makes its whole side not comparable (`usage-incomplete`), so a pair with a crashed or timed-out step usually is not comparable. A `meta.json` that is missing or unreadable shows only as `outcome-not-done` on that side, plus goal and `baseSha` mismatch warnings; nothing names the file. Skipped steps on the baseline, a different goal or `baseSha`, and differing input file names are warnings.
- `dropPercent` is the exact drop rounded down to 2 decimals; the verdict uses exact tokens. Run `compare` from the project whose override file holds the target: `compare.targetDropPercent` is read from that project's policy, not from `--routed`'s. It ships as `null`, so the verdict is `target not set` until the owner fills it.
- The unit is raw tokens, a proxy for the weekly limit. It understates savings from `haiku` steps and overstates a drop bought by moving work to `opus`. Orchestrator-session tokens are not counted; retries are counted.
- One pair is an anecdote. Compare per-pair drops across several changes, run the two sides close in time and alternate which runs first. A halted or incomplete side makes the pair not comparable instead of being dropped. Read the warnings before trusting the number.
- The baseline file keeps its keys, so the baseline arm runs the same phase executors, segments, `manual-verify` and re-plans as the routed arm. For a routing-only comparison add this to the baseline override by hand: `{"extraSteps": {"allowance": {"lean": 0, "standard": 0, "thorough": 0}}, "codeReplan": {"afterFailures": 0}}`. A pool allowance of 0 turns off segments, executors, `manual-verify` and the `REJECTED` re-plan, all of which draw from the pool; `afterFailures` 0 turns off the failure re-plan, which does not. The commit check, the retry and the fallback act only after an executor step ran, so with the allowance at 0 they never fire. `compare` does not warn when the two arms differ in these features.
- Keep the baseline worktree until `compare` has run, because its `run.jsonl` exists nowhere else; remove it with `git worktree remove <path>` afterwards.

Limits:

- Subagents cannot use `AskUserQuestion`. Where a skill would ask, the subagent decides from researched best practice, cites the evidence and lists the decision as an assumption. With no evidence-backed answer it reports `blocked` with `signals.needsHuman`, and the router halts.
- `10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more (the default since Claude Code v2.1.219).
- `--chrome` hands a subagent the Chrome browser tools through ToolSearch. Whether a subagent can load and call them was not tested; when they are missing the `manual-verify` subagent leaves its rows unticked and the run goes on. `/10x-e2e` and `/10x-tdd` also run in a subagent and answer their own questions from the decision guides in `skills/10x-pipeline/prompts/`; no live run has been done.

PR comment (opt-in):

- Needs the GitHub CLI `gh`, authenticated, and only with `--pr-comment`. Without the flag nothing is posted and `gh` is not needed. The permission a fine-grained token needs is not verified yet (pull requests or issues write is the expected one).
- Opt-in because the comment is visible to collaborators and carries the goal text. The comment goes to the repository named in the pull request url, which for a pull request from a fork is the base repository and can be public. Besides `@mentions`, the report text is posted as it is (links, images and HTML included); a halt can quote subagent text, and the lesson candidates are subagent text too. The PRD wording "is posted" is therefore met only when the flag is given.
- When the run ends (`done`, `archive` or `halt` with a `report`), the orchestrator runs `skills/10x-pipeline/scripts/pr-comment.mjs <change-id>`. It posts `report.md` as one comment on the open pull request of the current branch. In an `archive` run it posts before the move. The flag is kept as an orchestrator task named `PR comment: <change-id>` and read at each end of the run; `route.mjs` and `policy.json` are not involved.
- One comment per change per pull request. The first line is a hidden marker, `<!-- agent-smith:pr-report change=<change-id> -->`. A later run edits the comment of the same author that holds the marker, even after you edited it in the GitHub web UI. It never edits another comment. The author is the login from `gh api user`. When that call fails (a timeout, a 5xx or a token without access to `/user`, such as some integration tokens), the script posts nothing and skips with `viewer lookup failed`, because it cannot tell its own comment from one planted by another user. The edit replaces the earlier text; GitHub keeps the edit history.
- Skip reasons, each with exit code 0 and no effect on the run: `gh is not installed`, `gh is not authenticated`, `no pull request for this branch`, `not a git work tree`, `pull request is MERGED` or `CLOSED`, `unsupported host <host>` (no GitHub Enterprise), `viewer lookup failed`, `gh timed out` (each call has 20 seconds; a pull request with hundreds of comments can exceed that while the comment list is read, and the skip posts nothing and cannot duplicate), `comment lookup failed` (also when `gh` prints a list the script cannot read, so an unexpected format cannot create a duplicate), `comment request failed`, a missing, empty or foreign report, and `task list unavailable` (the task tools are missing, so the flag cannot be stored and nothing is posted). A draft pull request gets the comment.
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
