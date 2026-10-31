# ADR-003: Rigor-gated routing: a per-change rigor level decides optional steps, budget and effort floor

- **Status:** Proposed
- **Date:** 2026-10-30
- **Deciders:** repository owner
- **Origin:** research for `rigor-gated-routing`, split into four changes on 2026-10-30, later split into five (S-09 into `archive-adapter` and `lesson-candidates`). Research and owner decisions: `context/archive/2026-10-30-rigor-levels/research.md` (Follow-ups 1 to 3). Builds on ADR-001 (cheap deterministic signals first) and ADR-002 (change lifecycle, optional steps).

## Context

- ADR-002 makes every step except plan, one executor and archive optional. The router needs a rule for when an optional step runs. A fixed pipeline runs plan-review every time, even for a one-line change.
- ADR-001 prefers cheap deterministic signals over an LLM score. The goal text, the phase count, failed attempts and git history are such signals.
- The router has one step budget for every run, and a static effort floor per step. Interactive toolkit skills (plan, plan-review, impl-review) ask questions. Without a human, they need enough effort to decide from evidence.
- `meta.json` was rewritten as `{ id, goal }` on each `init`, so no state survived a resume.
- PRD FR-002 says plan-review is skipped "only on a clean rubric". No definition of a clean rubric exists. FR-010 asks for elevated risk from "configurable path rules".

## Decision

The work is split in five changes. This ADR is a skeleton: changes 1 and 4 are written in full, changes 2, 3 and 5 only listed.

| Part | Owning change | Status |
| --- | --- | --- |
| Rigor levels, churn risk, effort floor, skip entries, `signals` | `rigor-levels` (change 1) | implemented |
| Pre-plan steps (research, legacy research, domain brief, frame), RETHINK/REVISE loops, frame authority over `needsHuman` | `pre-plan-steps` (change 2) | planned |
| Per-phase executors, manual-row automation, tdd/e2e fallback, third-attempt re-plan | `phase-executors` (change 3) | planned |
| Archive adapter, `verify-archive`, git write decision for the change folder | `archive-adapter` (change 4) | described in "Archive adapter" |
| Lesson candidates from the implementation review | `lesson-candidates` (change 5) | planned |

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

The budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` for the level (-4, 0, +4), at least 1. Skip entries use none.

### Effort floor

Interactive steps get a floor that depends on rigor, in effort names (`rigor.minEffort`, `rigor.effortOrder`) so it survives a custom ladder. The router converts the name to the lowest ladder index with at least that effort and applies it last, after the discounts and the `maxTier` clamp.

- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `standard` or `thorough` **THEN** the router **MUST** pick a tier with effort `high` or above.
- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `lean` **THEN** the router **MUST** pick a tier with effort `medium` or above.

The report marks a step as simple only when the simple-change discount survived the floor.

### Signals

A step result may carry an optional `signals` object. The router keeps two keys and drops the rest: `rigor` (a level, raises) and `needsHuman` (a short text, halts the run once with a report; the ack is stored on the log entry). Signals cannot lower rigor, remove a step or add a skip.

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
- `context/foundation/prd.md` FR-002, FR-003, FR-010; `context/foundation/roadmap.md` S-03
- `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Symbols: `resolveRigor`, `measureRisk`, `hotSet`, `tierFor`, `cleanSignals`, `decide` in `skills/10x-pipeline/scripts/route.mjs`
