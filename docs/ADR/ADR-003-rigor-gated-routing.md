# ADR-003: Rigor-gated routing: a per-change rigor level decides optional steps, budget and effort floor

- **Status:** Proposed
- **Date:** 2026-10-30
- **Deciders:** repository owner
- **Origin:** research for `rigor-gated-routing`, split into four changes on 2026-10-30, later split into five (S-09 into `archive-adapter` and `lesson-candidates`); change 5 is written up in "Lesson candidates". Research and owner decisions: `context/archive/2026-10-30-rigor-levels/research.md` (Follow-ups 1 to 3). Builds on ADR-001 (cheap deterministic signals first) and ADR-002 (change lifecycle, optional steps).

## Context

- ADR-002 makes every step except plan, one executor and archive optional. The router needs a rule for when an optional step runs. A fixed pipeline runs plan-review every time, even for a one-line change.
- ADR-001 prefers cheap deterministic signals over an LLM score. The goal text, the phase count, failed attempts and git history are such signals.
- The router has one step budget for every run, and a static effort floor per step. Interactive toolkit skills (plan, plan-review, impl-review) ask questions. Without a human, they need enough effort to decide from evidence.
- `meta.json` was rewritten as `{ id, goal }` on each `init`, so no state survived a resume.
- PRD FR-002 says plan-review is skipped "only on a clean rubric". No definition of a clean rubric exists. FR-010 asks for elevated risk from "configurable path rules".

## Decision

The work is split in five changes. All five changes are written in full below.

| Part | Owning change | Status |
| --- | --- | --- |
| Rigor levels, churn risk, effort floor, skip entries, `signals` | `rigor-levels` (change 1) | implemented |
| Pre-plan steps (research, legacy research, domain brief, frame), RETHINK/REVISE loops, frame authority over `needsHuman` | `pre-plan-steps` (change 2) | implemented |
| Per-phase executors, manual-row automation, tdd/e2e fallback, third-attempt re-plan | `phase-executors` (change 3) | implemented (see "Phase executors and manual verification") |
| Archive adapter, `verify-archive`, git write decision for the change folder | `archive-adapter` (change 4) | described in "Archive adapter" |
| Lesson candidates from the implementation review | `lesson-candidates` (change 5) | implemented (see "Lesson candidates") |

Design of changes 2, 3 and 5 is in `context/archive/2026-10-30-rigor-levels/research.md`. The git write decision of change 4 is in "Archive adapter" below.

### Rigor levels

Every run has one level: `lean`, `standard` or `thorough`. The router stores it in `meta.json` as `{ level, requested, by }` and keeps it on resume (`init` writes `{ ...prev, id, goal }`). The level only rises. It is the highest of:

- the start level: the `--rigor` value if given, else the goal class (`short` is `lean`, `plain` and `hard` are `standard`);
- the phase count: 3 or more phases is `standard`, 6 or more is `thorough` (`rigor.fromPhases`, aligned with `complexity.phaseThresholds`);
- failed steps: 1 is `standard`, 3 is `thorough` (`rigor.fromFailures`);
- churn: the number of hot paths the plan or the diff touches (`risk.raise`);
- a `signals.rigor` value in a step result.

`by` names the inputs behind the current level and changes only when the level rises.

### Churn risk

Elevated risk (FR-010) is a path that changes often in git history. The router counts commits per path with `git log --no-merges --relative --since=<since> -n <maxCommits>`, up to `meta.baseSha` (the commit the run started from, so the run's own commits do not make its files look hot). Excluded globs (`context/**`, `**/*.md`, lock files) are dropped. A path is hot when its count reaches the `hotPercentile` value (nearest rank) and `hotMinCommits`. With fewer than `minCommitsInWindow` commits in the window, the router repeats over all history. The parameters sit under `risk.churn` in `policy.json` and are uncalibrated: no run data exists yet.

The router reads the paths on the `**File**:` and `**Files**:` lines of `plan.md`, and after an implement or fix step the output of `git diff --name-only`. `risk.raise` maps the number of distinct hot paths touched to a level. Any git failure, a missing history or an unreachable `baseSha` gives source `unavailable` and flags nothing. The read-only command `route.mjs risk <change-id>` prints the numbers.

### Skip entries

A step the router decides not to run is a skip entry in `run.jsonl`: `{ skipped, step, reason, rigor, afterN, risk, at }`. It has no `n`, `template`, `ok` or `result`. Budget, numbering, failure streaks, freshness and report totals read executed entries only. `report.md` lists skips in a `## Skipped steps` section.

At `lean`, a fresh plan skips plan-review, but only when risk was measured (source `window` or `all-history`, and the plan names at least one path). Otherwise plan-review runs, so a risk that could not be measured is never read as "not hot". The skip is frozen once an implement or fix entry exists: a later rigor rise does not bring plan-review back over a half-built change. Implementation review is never skipped; at `lean` it only gets a lower tier.

### Step budget

The budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` for the level (-4, +2, +7; change 3 raised the last two from 0 and +4, see "Phase executors and manual verification"), at least 1. Skip entries use none.

### Effort floor

Interactive steps get a floor that depends on rigor, in effort names (`rigor.minEffort`, `rigor.effortOrder`) so it survives a custom ladder. The router converts the name to the lowest ladder index with at least that effort and applies it last, after the discounts and the `maxTier` clamp.

- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `standard` or `thorough` **THEN** the router **MUST** pick a tier with effort `high` or above.
- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `lean` **THEN** the router **MUST** pick a tier with effort `medium` or above.

The report marks a step as simple only when the simple-change discount survived the floor.

### Signals

A step result may carry an optional `signals` object. The router keeps three keys and drops the rest: `rigor` (a level, raises), `needsHuman` (a short text, halts the run once with a report; the ack is stored on the log entry) and `lessonCandidates` (a few rule sentences, `impl-review` entries only; see "Lesson candidates"). Signals cannot lower rigor, remove a step or add a skip.

- **GIVEN** a skill question the subagent cannot ask **WHEN** the skill would ask it **THEN** the subagent **MUST** decide from researched best practice (codebase conventions, project docs, `lessons.md`, authoritative sources) and cite the evidence.
- **GIVEN** no evidence-backed call is possible **WHEN** the subagent would have to guess **THEN** it **MUST** report status `blocked` with `signals.needsHuman`.

Prompt rules follow ADR-004.

### Archive adapter

Change 4 (`archive-adapter`, roadmap S-09) lets a finished run commit its change folder and archive the change through `/10x-archive`. `/10x-archive` stays unchanged. The adapter is opt-in: `init <id> --archive` stores `archive: true` in `meta.json`, a resume keeps it and `--archive false` turns it off.

Git facts. The router already reads git: `rev-parse HEAD` for `baseSha`, and `log` and `diff` for churn risk (see "Churn risk"). With `--archive` it also writes, which is its first git write. At `done` it commits the whole `context/changes/<id>/` folder, including `agent-smith/`, as `chore(<id>): commit change folder before archive`. This settles the FR-008 deferral ("git handling is decided downstream"). Without the flag the router writes nothing to git.

- The router's git writes are limited to `git add` and `git commit` on the change folder and a `git reset` of its own add after a failure. The only `-c` option is the display setting `core.quotePath=false`, so hooks, signing and identity are the caller's. It never passes `--no-verify` and never pushes.
- The commit lands on the current branch. Protected branches are not detected; a refused commit is a failed git command and halts.
- The commit holds every file in the folder that git does not ignore. Ignored files outside the four probe files (`agent-smith/run.jsonl`, `meta.json`, `report.md` and `change.md`) are reported in the `archive` action, stay out of history, and still move with the folder. A probe file that git ignores is refused, at `init` and again at `done`.
- Before the commit the router halts if anything is staged, HEAD is detached, a merge, rebase, cherry-pick or revert is in progress, `change.md` has no valid `created` (read as `/10x-archive` reads it, so the archive path matches the skill's destination), or the archive destination exists. `archive.haltOnManualPending` (default `false`) adds a halt for pending Manual rows.
- After the commit it checks, because a hook can stage or write other files: the index is empty, the commit holds only paths of the change folder (compared as raw NUL-separated strings, so non-ASCII names pass), and the folder is clean.
- The `archive` action carries the done summary, the report path, the expected `archivePath`, the commit, the ignored files and the prompt for `/10x-archive`. The step's tier is pinned in `policy.json`, so no rule of this ADR moves it. The prompt gives the answers to the skill's questions as rules (continue past warnings, archive without repointing, never ask), and a blocking warning wins over them.
- The archive step has no log entry, no usage figure and no report row. This is the one step that logs no result. Nothing may be written under the change folder after the commit, because the folder moves.
- `report.md` is written before the commit and holds the line `Archive: requested - runs after this report was written`, which stays in the archived copy. It lists pending Manual rows as `Manual checks pending: N`, because it is the only router artifact that survives the move.
- `route.mjs verify-archive <id> [--path <p>]` is read-only and file-only: the archive folder has `status: archived` and the change folder is gone. `init`, `next` and `status --report` halt without writing for an archived change and for a change stamped `status: archived` whose folder did not move.

Halts. A halt carries `archive: "skipped: ..."` and `committed` when the `done` branch prints it or when the end of the run (`endRun`) prints it. Both are halts of an archive run only. Four kinds exist:

| Kind | Cause | Files written by the halt | `committed` | `archive` |
| --- | --- | --- | --- | --- |
| A | Pre-check fails and the folder is not committed and clean; any other halt of the run (budget, failed steps, loop limits, `needsHuman`) | log, `meta.json` outcome, `report.md` | `false` | `skipped: run halted` |
| B | Pre-check fails on a resume and the folder is already committed and clean | none | `true` | `skipped: pre-archive commit exists; run not archived` |
| C | `report.md` could not be written (checked before `git add`), or `git add` or `git commit` fails (the router unstages its own add) | none (the outcome `done` and the final report were written before the commit; a failed report write leaves no report) | `false` | `skipped: pre-archive commit failed` |
| D | A post-commit check fails | none | `true` | `skipped: pre-archive commit exists; run not archived` |

Halts printed elsewhere carry neither field: a missing result file (`Step N has no result`), the guard halts for an archived or half-archived change, usage and flag errors, halts at `init` (not a work tree, an ignored probe file), an unknown command and `Router error:`. The rule behind the table: while the folder is not committed, a halt may write the run's end state; once the commit exists, a halt only prints, because a rewrite would dirty the committed folder.

Alternatives considered:

- Commit only `agent-smith/` and halt on other dirty paths: rejected, because a normal run leaves `reviews/`, `plan.md` and `research.md` uncommitted (the toolkit skills do not commit), so it cannot succeed.
- Gitignore `agent-smith/`: rejected, because the pre-archive commit is the only copy of the run state in history and `report.md` is the only router artifact the archived folder keeps. A run with ignored `agent-smith/` files would archive without them committed, so the FR-008 decision would hold only on paper. This is why the router refuses an ignored probe file at `init` and at `done`, while it tolerates other ignored files: those carry no run state, are reported, and still move with the folder.
- Require a human commit first: rejected, because it defeats an unattended run.
- Change `/10x-archive`: rejected, because it is a toolkit skill the pipeline does not own.

Consequences of the adapter:

- A halted run is never archived.
- Manual rows pending at `done` raise the warnings question of `/10x-archive`. The subagent has `Continue archiving` as its answer, and the rows are listed in `report.md`. With `archive.haltOnManualPending` set to `true` the run halts before the commit instead.
- A post-commit failure leaves the commit in place. `next` repeats safely and prints JSON only. On that repeat (kinds B and D) no new commit is made, so post-commit check 2, that the commit touched only the change folder, is skipped. A kind D halt caused by check 2 on the first call is therefore not detected again by a repeated `next`.
- The archive subagent's own SHA history check may run `git fetch` and `gh`. That is outside the router's write rule.
- `verify-archive` reads files only, so a staged-but-uncommitted archive (the `chore(archive)` commit failed after the move) reads as archived. The orchestrator asks the user to check `git status`.
- A git timeout kills git but may leave a hung hook child and a stale `index.lock`.

Rules for the adapter:

- **GIVEN** a run started without `--archive` **WHEN** the router reaches `done` **THEN** it **MUST NOT** run a git command that writes the index or history.
- **GIVEN** `--archive` is set **WHEN** anything is staged, HEAD is detached or a merge or rebase is in progress **THEN** the router **MUST** halt before it commits.
- **GIVEN** a git command fails during the pre-archive commit **WHEN** the router handles the failure **THEN** it **MUST** halt with the git message and skip the archive.
- **GIVEN** the router commits the change folder **WHEN** a commit hook fails **THEN** the router **MUST NOT** pass `--no-verify`.
- **GIVEN** the change folder is committed **WHEN** the archive action has been returned **THEN** the router **MUST NOT** write under `context/changes/<id>/`.
- **GIVEN** the pre-archive commit succeeded **WHEN** the run ends **THEN** the router **MUST NOT** push.

### PR comment

Change 5 (`pr-comment-report`, roadmap S-05, PRD FR-005) lets a finished run post its `report.md` as a comment on the pull request. It is opt-in: the skill takes `--pr-comment`, and without it nothing is posted.

Decision. A separate script, `skills/10x-pipeline/scripts/pr-comment.mjs`, does the work. The orchestrator runs it with Bash at the end of a run (`done`, `archive` before the move, `halt` with a `report`). The router stays free of network calls, and `policy.json` has no new key. The flag is not stored in `meta.json`: the orchestrator keeps it as a task named `PR comment: <change-id>` and reads it at each end of the run, so it cannot leak to another run or change, and a missing task tool means no post.

- The only `gh` calls are `pr view --json number,url,state,isDraft`, `api user --jq .login`, `api --paginate repos/<o>/<r>/issues/<n>/comments` with a filter that only projects `id`, `login` and the first 200 characters of the body, and one `api --method POST` or `--method PATCH` on an issue comment. The body goes in a temporary file as `-F body=@<file>`, never in argv.
- The comment starts with the hidden marker `<!-- agent-smith:pr-report change=<id> -->`. The script matches the marker and the author in JavaScript, edits the comment in place, and creates one only when none matches. State lives on GitHub because nothing may be written under the change folder after the pre-archive commit.
- Only an open pull request on `github.com` is posted to. Any other outcome (no `gh`, no login, no pull request, a closed one, a timeout, a failed request) is a skip with a reason, and the script exits 0.
- The script writes nothing under the project root. The result goes into the orchestrator's final message only.

Alternatives considered:

- The router posts: rejected, because it has never made a network call and `route.mjs` is the most contended file.
- A subagent posts: rejected, because the task is mechanical and a model could improvise the `gh` command.
- `gh pr comment --edit-last`: rejected, because it edits the last comment of the token's user, which is the human's own comment when the token is the human's.
- The flag in `meta.json`: kept as the fallback if a silent skip is ever observed. It would edit the `init` block of the router.

Rules for the PR comment:

- **GIVEN** a run started without `--pr-comment` **WHEN** the run ends **THEN** the orchestrator **MUST NOT** call `pr-comment.mjs`.
- **GIVEN** the router runs any command **WHEN** it handles a step **THEN** it **MUST NOT** call `gh`.
- **GIVEN** `pr-comment.mjs` cannot reach an open pull request **WHEN** it handles the failure **THEN** it **MUST** skip the comment and exit 0.
- **GIVEN** the script finds a marker comment by the viewer **WHEN** it posts **THEN** it **MUST** edit that comment instead of creating another.
- **GIVEN** the script posts **WHEN** it builds the body **THEN** it **MUST NOT** pass the body as a command argument.
- **GIVEN** `--report` does not name a file `report.md` inside a directory `agent-smith` **WHEN** the script starts **THEN** it **MUST** refuse it as a usage error.
- **GIVEN** the script has run **WHEN** the orchestrator records the result **THEN** it **MUST NOT** write under `context/changes/<id>/`.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Keep plan-review always on and let `lean` only lower its tier | rejected | The owner decided that `lean` skips it. Plan-review is the largest cost for a small change. |
| Derive rigor from `run.jsonl` on every call, store nothing | rejected | `init` would not need to keep state, but a requested level (`--rigor`) and the starting commit would be lost. |
| Score complexity with an LLM (FR-011) | deferred | ADR-001: only if deterministic signals prove too weak. No run data exists to say. |
| A halt for a human at the highest level (FR-010 tail) | deferred | The generic `signals.needsHuman` stop exists. A halt by level alone is not built. |

## Consequences

- **Bad**: plan-review at `standard` now runs at the high effort floor instead of a discounted medium tier. That is a deliberate cost increase (owner decision).
- **Bad**: the churn numbers are uncalibrated. Churn can miss a risky file that rarely changes and flag a harmless busy one. S-06 (baseline comparison) is where real runs can tune them.
- **Bad**: churn needs usable git history. A shallow clone or a brand-new repository reads as `unavailable`, and `lean` then still runs plan-review.
- **Bad**: a run in flight when the router is upgraded gets `baseSha` at the first `init` after the upgrade, so it is only partly measured.
- **Good**: a skip is visible in the log and the report with its reason, so a saving can be checked.
- **Good**: every rule in the prompts has one checked form (ADR-004).

## Sources

- `context/archive/2026-10-30-rigor-levels/research.md` (Follow-ups 1 to 3), `context/archive/2026-10-30-rigor-levels/plan.md`
- `context/changes/archive-adapter/research.md`, `context/changes/archive-adapter/plan.md`
- `context/changes/lesson-candidates/plan.md` (change 5)
- `context/foundation/prd.md` FR-002, FR-003, FR-010; `context/foundation/roadmap.md` S-03
- `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Symbols: `resolveRigor`, `measureRisk`, `hotSet`, `tierFor`, `cleanSignals`, `decide` in `skills/10x-pipeline/scripts/route.mjs`

## Pre-plan steps and loops

Change 2 (`pre-plan-steps`, roadmap S-07) adds four optional steps before the first plan and two backward loops after plan review. Plan: `context/changes/pre-plan-steps/plan.md`; research: `context/changes/pre-plan-steps/research.md`. The code is in the section `pre-plan steps` of `route.mjs` (`preplanNext`, `replanNext`, `PREDICATES`, `aggregateGap`) and the data under `preplan` in `policy.json`. The word lists and thresholds are uncalibrated: no run data exists, and S-06 is where it can come from.

### Gates

Three step names carry the gates: `research`, `domain-brief` and `frame`. The legacy research prompt is a template variant of `research`, chosen when `context/map/repo-map.md` has `artifact: repo-map`. The domain brief has two templates, `domain-aggregate` and `domain-acl`. A gate is data: `minRigor`, an optional `when` list (any predicate hit opens it), a `skipIf` list (any hit skips), a default `template` and `variants` (first hit wins). Every gate defaults to `thorough`, so a `standard` or `lean` run keeps its first step. `frame` and `domain-brief` also need a predicate hit, so a plain `thorough` run does not pay for a frame step it does not need.

- **GIVEN** the run level is below the `minRigor` of a pre-plan gate **WHEN** the router decides the first step **THEN** it **MUST** write no entry for that gate.
- **GIVEN** a pre-plan gate is open **WHEN** its artifact already exists or its `when` predicates all miss **THEN** the router **MUST** log a skip entry with the step, the level and the cause.
- **GIVEN** a plan attempt, failed or not, is in the log **WHEN** the router decides a step **THEN** it **MUST NOT** start a pre-plan step.

A gate closed by rigor is silent because the step was never in that run's path. A skip entry exists to make a saving visible, and a closed gate saves nothing. Silent closing also keeps every skip count of a `standard` or `lean` run as it was. An open gate that does not run logs a skip, which `status` and `report.md` print like the plan review skip (no `risk` key). The pre-plan phase is decided once: a rise of the level after the first plan attempt does not open it, because the plan attempt is when the goal is read.

### Predicates

Predicates are pure and read-only. An unknown name, a malformed config or a read error is no hit and never a throw.

- `framingDoubt`: a phrase of `goalWords` starts at a word start of the lowercased goal, or a `research` or `domain-brief` result of this run carries `signals.rigor`. Defaults: `root cause`, `should we even`, `is this the right`, `challenge the assumption`, `rethink`, `before i plan`, `caused by`, `because`, `assuming`.
- `dependencyLeak`: the same match against `vendor`, `sdk`, `third-party`, `third party`, `wrapper`, `adapter`, `leak`, `anti-corruption`, `swap out`, `external api`.
- `aggregateGap`: reads the real report format of `/10x-domain-distillation` (see below).
- `repoMapExists`, `researchExists`, `frameExists`, `briefExists`: file checks.

The skill description of `/10x-frame` lists `fix`, `bug` and `broken` as triggers, but its own text says to skip mechanical changes. A router that opened the frame step on the bare words would fire on `fix typo`. They are not in the default list. A project that wants them sets `preplan.predicates.framingDoubt.goalWords`; arrays are replaced whole.

- **GIVEN** a goal whose only cause-shaped word is `fix`, `bug` or `broken` **WHEN** the router evaluates `framingDoubt` **THEN** the predicate **MUST NOT** hit with the default list.

`aggregateGap` parser rule. The section runs from the line `## Invariants and policies` to the next line that starts with `## `, so `###` subsections are inside it. Every pipe table in it counts when a header cell starts with `invariant` or `policy` and another cell is `status`. The status of a row is the first alphabetic word of the status cell after removing `*`, `_` and backticks, lowercased, so `**enforced** (new worlds)` reads as `enforced`. A row hits when its status is in `statuses` (`declared`, `ignored`, `contradicted`) and a word of the row also occurs in the goal. The words are whole lowercase letter tokens of the `candidate` column (when the header has one), the invariant or policy cell and the `gap` cell, at least `minWordLength` letters long and not in `stopwords`. Bulleted lists such as "Code-only rules" are not tables and are ignored. A `###` heading is not a word source, because one heading word would then hit every row under it.

- **GIVEN** a distillation table sits under a `###` heading **WHEN** `aggregateGap` collects the words of a row **THEN** it **MUST NOT** take a word from the heading.
- **GIVEN** a row has a status outside the configured list **WHEN** `aggregateGap` reads the table **THEN** the row **MUST NOT** hit, whatever words it shares with the goal.

### Verification by artifact

A pre-plan step that reports `done` counts only when its file changed after the step started and has the shape the next step relies on. `research` needs `status` in the frontmatter (the three research prompts ask for it). `frame` needs a line that starts with `## Reframed`. A domain brief is checked against the file of its own template and needs `type: refactor-plan`. A failed attempt follows the existing failure rule: retry one tier higher, halt after `maxAttemptsPerStep`. A failed optional step does not silently continue.

- **GIVEN** a pre-plan step reports `done` **WHEN** its artifact is missing, not newer than the step start or without the required shape **THEN** the router **MUST** count the step as failed.

### Frame authority

`frame` is pinned to one tier in `policy.json` and runs under a decision guide (`prompts/frame-unattended.md`) with one rule per ask point of the skill. The authority order is fixed.

- **GIVEN** a step result carries `signals.needsHuman` **WHEN** `frame.md` exists and states any Confidence label **THEN** the router **MUST** halt the run.
- **GIVEN** `frame.md` states a Confidence label **WHEN** the router verifies the step or picks the next one **THEN** it **MUST NOT** read the label.
- **GIVEN** the goal names a task but no separate cause **WHEN** the frame step runs unattended **THEN** the subagent **MUST** confirm the goal as the problem statement, set Confidence to LOW and finish with status `done`.
- **GIVEN** `frame.md` exists **WHEN** the router renders the `plan-revise` prompt **THEN** the frame authority line **MUST** win over the line that keeps step indices and titles.

`needsHuman` is read in `next()` before `decide()`, so it wins over anything in `frame.md`. Only an empty goal with nothing in `change.md` to frame ends `blocked`. A LOW brief lists its verification step and does not raise rigor. `/10x-plan` refines an existing `plan.md` and its rule to treat the frame as authoritative is written for a fresh plan, so the re-plan prompt carries the rule itself, rendered with the real change id. It tells the planner that the Progress contract (format, numbering and checkbox syntax) applies to the result, and that phases and rows may change to match the reframed problem.

### Loops

The loop gate is `preplan.loops.minRigor`, default `thorough`. The level read is the run's current level. Without this gate every `RETHINK` at `standard` would run an unproven frame step at the pinned tier and "a standard run looks as before" would be false. Below the gate, `RETHINK` and `REVISE` re-plan with `plan-revise` exactly as before, with the same counting. A run that rises to `thorough` mid-run (a plan of 6 or more phases, three failed steps, three hot paths or `signals.rigor`) opens the loops from then on, and a `RETHINK` in a standard run that rises gets the frame round. A run that stays at `standard` or `lean` is unchanged.

At the gate or above:

- A plan review `RETHINK` runs `frame` once with the template `frame-rethink` (no bump, no revision consumed), then re-plans. A second `RETHINK` after a good re-plan halts for a human.
- A `REVISE` that needs a re-plan, after one earlier `REVISE` re-plan, runs `research` once with the template `research-revise`, then re-plans. The earlier round is told from the `verdict` stored on `plan-revise` entries (the `frame-rethink` and `research-revise` entries carry it too), so an old log without the key never gets this round.
- `loops.rethinkToFrame`, `loops.reviseResearchAfter` and `loops.reviseResearchMax` hold the counts. A value that is not a positive integer turns that loop off.

Counters. `revisions` counts every `plan-revise` entry, failed ones included, as on main: a failed re-plan leaves the review fresh and spends one revision. After a good `frame-rethink`, a failed re-plan is therefore retried once at the next tier and the second failure halts at `limits.maxPlanRevisions`. The halt for a second `RETHINK` counts only good re-plans after the last good `frame-rethink`. A failed `frame-rethink` has no `ok`, so it is retried by the same branch and halts after the attempt cap.

- **GIVEN** a `plan-revise` step fails **WHEN** the router counts revisions **THEN** it **MUST** count the failed entry as a revision.
- **GIVEN** the run level is below `preplan.loops.minRigor` **WHEN** plan review returns `RETHINK` or a `REVISE` that needs a re-plan **THEN** the router **MUST** return `plan-revise` and no `frame-rethink` or `research-revise` step.

### Skip rule

The skip loop in `next()` used to allow two skips in one call, so three gated-out pre-plan steps hit it. The invariant is one skip per step per call. A logged skip marks the step as handled, so no policy data can make `decide()` repeat one; the guard is defensive.

- **GIVEN** `decide()` returns a skip for a step already skipped in this call **WHEN** `next()` handles it **THEN** the router **MUST** end the run with a router error instead of looping.

### Step budget

Pre-plan and loop steps count against the budget; skips do not. The reference paths below are failure-free walks and the tests assert one step to spare.

| Level | Reference worst path | Executed steps | Budget | Failed steps tolerated |
| --- | --- | --- | --- | --- |
| `standard` | plan, review, two re-plans each with a review, implement, impl review, two fix rounds each with an impl review | 12 | 14 | 1 |
| `thorough` | research, domain brief, frame, plan, review `RETHINK`, frame-rethink, plan-revise, review `REVISE`, plan-revise, review `SOUND`, implement, impl review, two fix rounds each with an impl review | 16 | 18 | 1 |

At the time of this change `rigor.budgetDelta` and `limits` did not change (change 3 later raised the deltas, so the budgets are now 16 and 21; the section "Phase executors and manual verification" has the current table). The thorough path with `research-revise` in place of the frame round is also 16. The standard path is today's, because the loops are gated at `thorough`. A project that lowers a gate or `loops.minRigor` to `standard` has a standard worst path of 13 and, at the old delta of 0, no failure tolerance; the delta of 2 from change 3 covers it. `lean` is not covered: its budget of 10 already could not hold the 12-step path when plan review runs, and this change leaves that as it was.

### Assumptions that carry a cost

No human could answer the six open owner questions of the research. Each was decided from research evidence or the owner defaults of that run. The cost is what it takes to reverse the decision.

| Decision | Assumption | Cost to reverse |
| --- | --- | --- |
| 1 | The gates of `research`, `domain-brief` and `frame` open at `thorough`; `frame` also needs `framingDoubt`. | Low: one `minRigor` per gate, plus the budget (decision 3). Each lowered gate adds a costly step to every run at that level. |
| 2 | Legacy research is a template variant of `research`, not a second step. | Medium: a second step, its gate, a verification case and a skip rule for plain research. |
| 3 | Pre-plan and loop steps count against the budget; `budgetDelta` stays at -4, 0, 4 (raised to -4, 2, 7 by change 3). | Low: data. A project can raise `rigor.budgetDelta.thorough`. |
| 4 | A failed optional pre-plan step is retried and halts; it does not continue silently. | Medium: an `optional` flag, a skip after one failure, care for `rigor.fromFailures`. |
| 5 | A LOW Confidence without `needsHuman` does not raise rigor, and the label is never read. | Low: one rigor input that reads `frame.md`. |
| 6 | The three prompts that work on an existing `research.md` stay unwired (two stop as `blocked` without `ast-grep`). | Low: a template, a gate and a verification case each. |
| 7 | A gate closed by rigor is silent; an open gate that does not run logs a skip. | Low: log closed gates too, which adds up to three rows to every `standard` and `lean` report. |
| 8 | Pre-plan steps run only before the first plan attempt. | Low: drop the guard. |
| 9 | The word lists are uncalibrated and `fix`, `bug`, `broken` are left out. | Low: data. |
| 10 | The loops open at `thorough` only. | Low: set `loops.minRigor`; see the budget for the consequence. |
| 11 | `research` and `domain-brief` start at tier 3; `frame` is pinned. Tiers are uncalibrated. | Low: data. |
| 12 | The plan and re-plan prompts list the upstream artifacts that exist, including a `research.md` made by hand. | Low: remove the `{artifacts}` and `{authority}` variables. |
| 13 | A failed re-plan after a good frame round spends a revision, as on main. | Low: the counting rule in `replanNext`. |
| 14 | A goal with no separate cause is confirmed at LOW and the run goes on. | Low: guide text. |

Three things are still open, and none of them has been verified against the real skills. Whether `/10x-plan` changes its approach to match `frame.md` on a re-plan, or patches the old plan, needs a manual run with a real `RETHINK` (plan row 5.7); if it patches, the authority line gets stronger before merge. Whether the guide holds for every ask point of `/10x-frame` needs unattended runs with a clear, a thin and an empty goal (plan rows 2.9 to 2.11). Neither the word lists nor the tiers have run data behind them. The router side of these paths is covered by tests; the behavior that depends on a real skill or model is not. The plan's Fix pass lists the other unverified behavior: a real `research-revise` round, the second domain brief template, `frame-rethink` when no `frame.md` exists, and a missing `10x-research` or `10x-frame` skill. These manual rows are open and are verified by the owner before merge. The table row above says `implemented` for the code and the tests only.

## Phase executors and manual verification

Change 3 (`phase-executors`) lets the router pick a different executor per phase of the plan, checks that an executor really committed code, re-plans after code ran and proves Manual rows with commands. Plan: `context/changes/phase-executors/plan.md`; research: `context/changes/phase-executors/research.md`. The code is in the sections `extra steps and executor choice`, `manual verification` and `code re-plans` of `route.mjs`; the data is under `executors`, `extraSteps`, `codeReplan` and `manualVerify` in `policy.json`. The word lists, extension lists and thresholds are uncalibrated: no run data exists. Nothing here was run against a live `/10x-e2e`, `/10x-tdd`, `/10x-goal-implement` or Chrome session; the tests drive the router only.

### Executor choice and segments

The step name stays `implement`. The template varies: `implement` (goal-implement for the whole plan), `implement-segment` (goal-implement stopped after one phase), `implement-e2e`, `implement-tdd` and `implement-retry`. The router reads the `### Phase N` headings of the Progress section and picks an executor for the first pending phase:

- e2e: the setup record `context/foundation/test-stack.md` has an `## E2E` section whose `config` and `seed` paths exist inside the project, and the phase name or a pending row names a word of `executors.e2e.rowWords`. No rigor gate (`minRigor` is `lean`), but `lean` has no pool, so it never runs there.
- tdd: rigor `thorough`, no row of the phase ticked yet, every file on the `**File**:` lines is code outside the exclude globs, and every pending row names a test command in backticks and no UI word.
- goal: everything else.

Goal phases in front of the first special phase run as a segment that stops after its last phase; consecutive phases of one executor form one step. Both interactive executors run under a decision guide (`prompts/executor-e2e.md`, `prompts/executor-tdd.md`) that answers the skill's questions without a human and ends `blocked` when the skill would redirect elsewhere.

- **GIVEN** a pending phase names a browser word and the e2e setup record is valid **WHEN** the extra-step pool can pay for the step **THEN** the router **MUST** run `implement-e2e` for that phase.
- **GIVEN** the pool cannot pay for a goal segment and the special executor after it **WHEN** the router picks an implement step **THEN** the router **MUST** run plain `implement` for the whole plan.

### Extra-step pool

One pool per level replaces a cap per feature. Every executed entry spends its cost, whatever its outcome.

| Level | Allowance | Cost 1 each | Cost 2 |
| --- | --- | --- | --- |
| `lean` | 0 | | |
| `standard` | 2 | `implement-segment`, `implement-e2e`, `implement-tdd`, `manual-verify` | `plan-rejected` |
| `thorough` | 3 | the same | the same |

With a pool of 2 at `standard`, two segments, a segment and `manual-verify`, or the `REJECTED` re-plan each use all of it, so the three cannot add up. Without the pool the same features would sum to 17 steps at `standard` and 21 at `thorough`.

### Strict verification and fallback

`implement-e2e` and `implement-tdd` are strict. A step that reports `done` counts only when the plan shows ticked rows and a commit exists in `before.head..HEAD` that touched at least one path outside `context/changes/<id>/` (docs, lock files, `assets/**` and `context/**` do not count; they reuse the churn exclude globs). The router reads git with `rev-parse`, `merge-base --is-ancestor` and `log -z` only. When git is missing, the repository has no commit yet or the recorded head is unknown, the count rule applies to the first check. The check is per step, not per row: one counted commit covers every row the step ticked, so a commit made for one row passes a flip of another. A SHA suffix on a row must be a prefix of such a commit. Plain `implement` and `implement-segment` keep the count rule: `/10x-goal-implement` legitimately ends a phase with no diff to commit, so a commit check would make that a false failure. The residual risk is a goal-implement phase that ticks rows with no work: it passes until the implementation review.

- **GIVEN** a strict step reports `done` **WHEN** no commit of `before.head..HEAD` touched a code path **THEN** the router **MUST** count the step as failed.
- **GIVEN** an e2e or tdd step ends `blocked` **WHEN** the router records the entry **THEN** the router **MUST** mark it `fallback`.
- **GIVEN** an entry is a `fallback` **WHEN** the router counts failed attempts, bumps the tier or raises the rigor **THEN** the router **MUST NOT** treat it as a failure.

A fallback entry is transparent to the failure streak: it neither counts nor ends one. The executor is not chosen again for a phase it failed or handed back, so the phase goes to goal-implement. `report.md` shows the result `fallback` and a Step cell `implement (<template>)`; `compare` does not count a fallback as a failed attempt. After the archive move the report is the only router file left, and it names the executor only in the Step cell.

### Retry of uncommitted rows

A strict step that leaves rows ticked with no code commit records them as `uncommitted`.

- **GIVEN** a strict step left rows ticked without a code commit **WHEN** the router picks the next step **THEN** the router **MUST** run `implement-retry` once for those rows.
- **GIVEN** the retry ends `done` or `blocked` with its rows ticked and still no commit **WHEN** the router goes on **THEN** the router **MUST** run the implementation review with the `impl-review-warn` prompt, which names the rows.

The retry costs nothing from the pool and runs at most once per run (`executors.retry.max`; 0 turns it off). A retry that ends `failed` is a failure. A retry whose commit check cannot run (no git, no commit yet, an unresolvable recorded head) does not pass on ticked rows: it is a neutral fallback with the rows recorded as uncommitted, and the review prompt adds a note that commit evidence was unavailable. A project without git therefore gets a warning, never a failure. The `done` output, the `archive` summary, `meta.outcome` and, in an `--archive` run, `report.md` list the rows as `uncommittedTicks`. A legitimate zero-diff phase therefore never halts the run. The residual risk is a Skip flip that survives the single retry and a reviewer who misses the warning.

### Code re-plans

Two triggers run the `plan` step with a new template, at rigor `standard` or above, under a shared cap of one per run (`codeReplan.max`).

- **GIVEN** the last two implement entries failed in a row **WHEN** the router picks the next step **THEN** the router **MUST** run `plan` with the template `plan-replan`, with the failure note in the prompt.
- **GIVEN** the first implementation review returns `REJECTED` before any fix step and the pool holds 2 **WHEN** the router picks the next step **THEN** the router **MUST** run `plan` with the template `plan-rejected`.
- **GIVEN** a `plan-replan` step fails **WHEN** the router handles the result **THEN** the router **MUST** halt the run.

A re-plan counts against the step budget and uses one of the `maxFixLoops`. A `REJECTED` review after a fix keeps today's path, which is another fix. Plan review follows a re-plan like any other plan. Order: the failure re-plan fires at exactly two trailing implement failures and costs nothing from the pool, so when those failures left rows ticked without a commit it takes the turn of the one `implement-retry`, and a failed re-plan then halts the run in a case where the retry would have fitted. This follows the plan and is recorded, not changed.

### Manual verification

`manual-verify` is a step of its own (`policy.steps["manual-verify"]`, no skill) that runs once before the first implementation review at `standard` or above, when no Automated row is pending and a pending Manual row is eligible. A row is eligible when it has a backticked command whose first word is in `manualVerify.commandWords` and no word that starts with one of `humanWords`; with `--chrome` a row with a whole-word `browserWords` hit is eligible too. The subagent runs the command, saves the output under `context/changes/<id>/evidence/<name>` and ticks the row with the suffix ` — evidence: evidence/<name>`.

- **GIVEN** a Manual row is ticked after the step **WHEN** its suffix does not name a non-empty regular file inside the real `evidence` folder written after the step started **THEN** the router **MUST** record the tick as unproven.
- **GIVEN** an Automated row, a row title or a SHA suffix changed during the step **WHEN** the router verifies it **THEN** the router **MUST** count the step as unverified.
- **GIVEN** a `manual-verify` attempt is unverified **WHEN** the router picks the next step **THEN** the router **MUST NOT** count it as a failed attempt.

An attempt with zero ticks is `done`. A failed attempt is a neutral fallback entry: no tier bump, no rigor rise, and the run goes on. One retry is allowed (`maxAttempts` 2) and is judged against the baseline of the first attempt, so a bad tick left by the first attempt fails again unless it gets valid evidence. Unproven ticks are listed as `manualUnproven` in the `done` output, the `archive` summary, `meta.outcome` and, in an `--archive` run, `report.md`. The router never edits `plan.md`, so it cannot undo a tick. The content of an evidence file is not read: a file with junk text passes. The command list includes `sh`, `bash`, `python` and `curl`; the subagent runs the text of `plan.md`, which is the same trust domain as the plan author.

### `--chrome`

`init <id> --chrome` stores `chrome: true` in `meta.json`; a resume keeps it and `--chrome false` clears it. It selects the template `manual-verify-chrome`, whose prompt tells the subagent to load the `mcp__claude-in-chrome__*` tools through ToolSearch and to leave the row unticked and finish `done` when they are unavailable. The orchestrator does not probe for the tools. A subagent saw the tools as deferred; no call was tested.

### Budget

`rigor.budgetDelta` becomes -4 (`lean`, the same value as before), +2 and +7, so the budgets are 10, 16 and 21. The delta is the smallest at which the longest legal path of each level completes with one failed step and its retry to spare. A test lets the router walk saturating fixtures at each level and asserts `longest path === maxTotalSteps + delta - 2`; a second walk with every pool allowance raised by one must exceed it, so a policy that raises a pool without raising the delta fails the first test.

| Level | Longest legal path (executed steps) | Steps | Budget |
| --- | --- | --- | --- |
| `standard` | plan loop of 6 (plan, review, two re-plans each with a review), `implement-segment`, `implement-e2e`, plain tail, then impl-review, fix, impl-review, fix, impl-review | 14 | 16 |
| `standard` | plan loop of 6, `implement-e2e`, plain tail, `manual-verify`, then 5 | 14 | 16 |
| `standard` | plan loop of 6, implement, impl-review (`REJECTED`), `plan-rejected`, plan-review, implement, impl-review, fix, impl-review | 14 | 16 |
| `thorough` | research, domain brief, frame, plan, review `RETHINK`, frame-rethink, plan-revise, review, plan-revise, review (10), `implement-segment`, `implement-e2e`, `implement-tdd`, plain tail (4), then 5 | 19 | 21 |
| `thorough` | the same 10, implement, `manual-verify`, impl-review (`REJECTED`), `plan-rejected`, plan-review, implement, impl-review, fix, impl-review | 19 | 21 |
| `lean` | keeps its path and budget until a failure raises the rigor to `standard`: while the level is `lean` the pool is empty, so no extra step exists; after the rise the `standard` rows apply | as before | 10 |

Failure paths are not part of the reference set. A path with a failed plan loop, two failed implement steps and a re-plan still ends in `Step budget spent` by design, as it did before. One failure path is proved to fit at `standard`: plan, plan-review, implement failed twice, `plan-replan`, plan-review, implement, `manual-verify`, impl-review, fix, impl-review (11 steps of 16).

A project that overrides `rigor.budgetDelta` keeps its values. With a pool allowance above 0 and an old delta, the budget can halt a run that uses extras.

### Baseline comparison gap

`baseline-policy.json` is not changed, because `compare.test.mjs` pins its keys. The baseline arm therefore runs the same defaults, including segments, `manual-verify` and the re-plans, unless the user adds an override by hand (the README has the text). `compare` does not warn when the two arms differ in these features.

### Assumptions that carry a cost (change 3)

Decided without a human. Each is overridable in `context/foundation/agent-smith-policy.json` unless the cost says otherwise.

| Decision | Assumption | Cost to reverse |
| --- | --- | --- |
| 1 | `--chrome` is an `init` flag stored in `meta.json`; the orchestrator does not probe tools; Chrome use in a subagent is untested. | Low: remove the flag and the chrome template. |
| 2 | `manual-verify` runs from `standard`, once (`maxRuns` 1), at most two attempts, zero ticks is `done`, a failed attempt is neutral. | Low: data. |
| 3 | A ticked Manual row needs a valid evidence file; the content is not read; unproven ticks are listed, not undone. | Medium: reading evidence or undoing ticks needs the router to edit `plan.md`, which it never does. |
| 4 | The strict commit check covers `implement-tdd`, `implement-e2e` and the retry; plain `implement` and `implement-segment` keep the count rule. | Medium: a commit check on goal-implement plus a policy escape. |
| 5 | Commit evidence is a commit in `before.head..HEAD` that touched a path outside the change folder and the exclude globs; an amend or a rewriting hook reads as a failure and goes through the retry. | Low: one function. |
| 6 | The re-plan triggers at two trailing implement failures or at a first `REJECTED` review, shares one cap, costs a fix loop and a halt follows a failed `plan-replan`. | Low: data (`codeReplan`). |
| 7 | E2E has no rigor gate but needs pool allowance, so a run that stays at `lean` runs no executor (one that rises to `standard` gets the pool from then on); tdd is gated at `thorough`. | Low: data. |
| 8 | One pool replaces a cap per feature; a segment the pool cannot follow with its special executor is not started. | Low: data; a larger pool needs a larger delta, which the test derives. |
| 9 | The deltas are +2 and +7. | Low: data. |
| 10 | A fallback entry neither counts nor ends a failure streak. | Low: one helper. |
| 11 | Row words, extension lists, test words, command words and human words are uncalibrated. | Low: data. |
| 12 | A live tdd, e2e or goal-implement run, a real E2E project, any Chrome call and a segment that stops after its last phase are not verified. | n/a: Manual rows cover them. |
| 13 | A plan whose Progress headings are not `### Phase N` gets no phase list and plain routing; `--chrome` at `lean` is stored and ignored. | Low. |
| 14 | `baseline-policy.json` stays as it is, so the baseline arm runs the new defaults unless the user overrides them. | Medium: edit `compare.test.mjs` and the baseline file together, or add a `compare` warning. |
| 15 | The retry runs once; a retry that ends without a commit is a neutral fallback and the review prompt warns. | Low: data (`retry.max`). |

## Lesson candidates

Change 5 (`lesson-candidates`) lets the implementation review report lessons and lists them in `report.md`. `/10x-impl-review` has no lesson section of its own, so the router prompt asks for them. Plan: `context/changes/lesson-candidates/plan.md`. The code is `lessonLimits`, `cleanLessonCandidates` and `cleanSignals` (sanitizer) and `buildReport` (section) in `route.mjs`; the limits are under `lessons` in `policy.json`; the prompt is `prompts/impl-review-lessons.md`.

### Carrier and sanitizer

The carrier is `signals.lessonCandidates`, an array of strings in the `RESULT` line of an `impl-review` step. `cleanSignals` keeps it for that step only; a `plan`, `fix` or other step drops it. Each item is cleaned in this order: format characters (`\p{Cf}`, such as bidi overrides) removed; control characters and runs of whitespace replaced by one space; backticks replaced by `'`; trim. An item longer than `lessons.maxChars` (default 200) code points is cut to that length and, when the cut falls inside a word, back to the last space. Empty items and case-insensitive repeats are dropped, and the first `lessons.maxCandidates` (default 3) stay. A value that is not a positive safe integer reads as the default. `run.jsonl` holds only the cleaned list.

### Prompt

Both review templates (`impl-review` and `impl-review-warn`) end with `prompts/impl-review-lessons.md`. It states both caps (`{lessonMax}`, `{lessonChars}`, filled by `render`) and shows the `RESULT` fragment, so a cut is the exception. It tells the subagent to read `context/foundation/lessons.md` first, to skip rules already there, to report only a class of bug or pitfall that would recur in other changes and to leave the key out when nothing recurs.

### Report section

`report.md` gets `## Lesson candidates` after the skipped-steps section when at least one executed `impl-review` entry with `ok` true carries candidates. One line per candidate across those entries in log order, repeats dropped with the first step number kept: ``- `/10x-lesson <seed>` (step <n>)``. With no candidates the report is as before. The report is the only router file that survives an archive, so the candidates survive it too.

- **GIVEN** a pipeline subagent or the router holds a lesson candidate **WHEN** the run is unattended **THEN** the router and every pipeline subagent **MUST NOT** run `/10x-lesson` or write `context/foundation/lessons.md`.

`/10x-lesson` is an interview with four questions of its own, so a human runs the command from the report.

### Assumptions that carry a cost (change 5)

Decided without a human. The caps are overridable in `context/foundation/agent-smith-policy.json`.

| Decision | Assumption | Cost to reverse |
| --- | --- | --- |
| 1 | The carrier is `signals.lessonCandidates` (research follow-up 1), `impl-review` only. | Low: one condition in `cleanSignals`. |
| 2 | At most 3 candidates per review, 200 code points each, policy keys `lessons.maxCandidates` and `lessons.maxChars`. | Low: data. |
| 3 | The prompt states both limits and the fragment; an over-long candidate is cut on a word boundary, not dropped. | Low: one function. |
| 4 | Every accepted `impl-review` counts, so a bug class a later `fix` repaired is still a lesson. | Low: one filter in `buildReport`. |
| 5 | The bound is per review. A run lists at most 9 on the longest `standard` or `thorough` path (three reviews). There is no run-level cap. | Low: one `slice` in `buildReport`. |
| 6 | The seed is untrusted subagent text, accepted: no Markdown or HTML escaping and no strip of a leading `/`. It sits in a code span, a human pastes it, and `/10x-lesson` writes nothing without a confirm. | Low: one function. |
| 7 | An invalid limit falls back to the default; a project turns the feature off by overriding the `impl-review` prompts with plain strings. | Low: data. |
| 8 | The router does not read `lessons.md` to drop duplicates; the prompt asks the subagent to. | Medium: the router would parse a file it does not own. |
| 9 | Nothing is printed in the `done`, `archive` or `halt` JSON or in `status`; the report is the carrier. | Low. |

Sources: `context/archive/2026-10-30-rigor-levels/research.md` (Follow-up 1), `context/changes/lesson-candidates/plan.md`.
