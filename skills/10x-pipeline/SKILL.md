---
name: 10x-pipeline
description: >
  Run a change end to end (plan, plan review, implement, implementation review, fix)
  with each step in its own subagent. A bundled router picks the next step and its
  model and effort from the previous results: review verdicts, finding counts,
  plan size, failed attempts. Use when the user wants an orchestrated or adaptive
  10x run, "run the whole chain", "pipeline this change", or dynamic model routing.
argument-hint: <change-id> [goal text] [--archive] [--chrome] [--pr-comment]
allowed-tools:
  - Agent
  - Bash
  - Read
  - Write
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# 10x Pipeline

You are the orchestrator. You do not plan, implement or review yourself. You do not pick models or effort levels. The router script decides every step; you execute what it returns.

Router: `ROUTER=<this skill's base directory>/scripts/route.mjs`. Run it with `node` from the project root.
PR comment script: `PR_COMMENT=<this skill's base directory>/scripts/pr-comment.mjs`. Only the PR comment step runs it (see "PR comment (opt-in)").

## Start

1. Parse the arguments: `<change-id>` (required, kebab-case), optional goal text, and the optional flags `--archive` and `--chrome`. Remove each flag from the goal text. Pass it on to `init` only when the user gave it. Parse the optional flag `--pr-comment` the same way, remove it from the goal text, and never pass it to `init`.
2. If `context/changes/<change-id>/change.md` is missing, first run `node $ROUTER verify-archive <change-id>` (no `--path`). When it reports `archived: true`, tell the user where the change was archived and STOP. When it lists `ambiguous` archive folders, show them to the user and STOP: the id was archived more than once and the user picks the folder. Otherwise tell the user to run `/10x-new <change-id>` and STOP. If the 10x skills (`10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`) are not available in this project, tell the user to install the 10x toolkit first and STOP.
3. Run `node $ROUTER init <change-id> --goal "<goal text>"`. Quote the goal safely for the shell. Re-running `init` on a change with an existing log resumes it: the router reads the disk state and continues from there. Add `--rigor <level>` only when the user named a rigor level (`lean`, `standard` or `thorough`). Never pick one yourself. On a resume the flag can only raise the level. Add `--archive` only when the user gave it. A resume keeps a stored `--archive`, and `--archive false` turns it off. `--chrome` works the same way: a resume keeps it and `--chrome false` turns it off.
4. Call TaskList. A task is the only place the `--pr-comment` request is stored, so do not rely on remembering it.
   - With `--pr-comment`: when no open task has the subject `PR comment: <change-id>` (the real id), call TaskCreate once with that subject. Its description: when the router returns `done`, `archive` or `halt`, call TaskList, and when this task is open do the PR comment step once, then mark the task completed.
   - Without `--pr-comment`: mark any open task with the subject `PR comment: <change-id>` completed, so a task left by an earlier invocation cannot post. Ignore a task whose subject names another change id. Never complete it.
   - If `--pr-comment` was given and TaskList or TaskCreate fails or is not available, print `PR comment: skipped, task list unavailable (run the script by hand after the run, see the README)` once, and do not run the PR comment step in this run. Without the flag a task tool error is silent.

## Loop

The router prints one JSON object. Act on `action`:

- **`run`** (the router may have skipped a step before this answer, for example plan review for a `lean` change. It logs the skip with its reason. You do nothing for a skipped step.)
  1. Print one line: `Step <n>: <step> on <model>/<effort>. <reason>`.
  2. Call the Agent tool with `subagent_type: general-purpose`, `model: <model>`, `effort: <effort>`, `run_in_background: false`, and `prompt` set to the router's `prompt`, copied verbatim.
  3. Find the last line of the subagent's reply that starts with `RESULT:`. Parse the JSON after it. If there is none, or it does not parse, use `{"status":"unknown","note":"no RESULT line"}`. Keep every key of the JSON as it is, including the optional `signals` object. Copy it untouched. The router validates it.
  4. If the Agent result reports usage (total tokens, tool uses and duration), add `"usage":{"totalTokens":N,"toolUses":N,"durationMs":N}` to that JSON, with the figures copied exactly. Omit the key when no figure is reported. Write the JSON to the router's `resultFile` with the Write tool.
  5. Run `node $ROUTER next <change-id>` and repeat the loop with its output.
- **`done`**: report the final verdict, the number of steps, and every entry in `manualPending` as a checklist for the human. When the output has `manualUnproven` or `uncommittedTicks`, list those row ids too, as ticks nobody proved. Then run `node $ROUTER status <change-id>` and show the model/effort used per step as a short list. Point the user to the router's `report` path (`report.md`).
  Call TaskList. When a task with the subject `PR comment: <change-id>` for this run is open, do the PR comment step. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.
- **`archive`** (only for a run started with `--archive`; the run is done and the router has committed the change folder, or found it already committed):
  1. Run `node $ROUTER status <change-id>` now, before the move, because the archive moves the log. Report what `done` reports: the final verdict from `summary.reason`, the number of steps, every `summary.manualPending` item as a checklist, every `summary.manualUnproven` and `summary.uncommittedTicks` row id when present, the model/effort used per step as a short list, and the router's `report` path.
     Then call TaskList. When a task with the subject `PR comment: <change-id>` for this run is open, do the PR comment step now, before step 2, so the comment is posted before the move. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.
  2. Print one line: `Archive: /10x-archive on <model>/<effort>.`
  3. Call the Agent tool with the same parameters as for `run` and `prompt` set to the router's `prompt`, copied verbatim.
  4. Write no result file and do not call `next`. The `archive` action has no `resultFile`, and nothing may be written into the folder that moves.
  5. Run `node $ROUTER verify-archive <change-id> --path <archivePath>` with the `archivePath` of the `archive` action.
     - On `archived: true`: print the archive path and the report path inside it. Print one line asking the user to confirm that `git status` is clean, because `verify-archive` reads files only and a failed `chore(archive)` commit leaves the rename staged. Repeat every `manualPending` item as the checklist of checks nobody verified, and repeat the `manualUnproven` and `uncommittedTicks` lists when the action had them. When the action's `ignored` list is not empty, list its paths as "not committed (ignored by git)". Copy the subagent's `assumptions` and any usage figure it reported into the final message.
     - On `archived: false`: print `reason` and the subagent's note, say the folder may be unchanged or half-archived, and STOP.
- **`halt`**: report `reason` and the status output. A reason that says `needs a human` comes from the subagent, which found no evidence-backed answer. Show the quoted text. Point the user to the router's `report` path (`report.md`) when present. When the output has an `archive` field, say the change was not archived, then read `committed`: if `false`, say the folder is not committed and `/10x-archive` needs it committed first; if `true`, say the pre-archive commit exists locally, the router did not undo it, and `node $ROUTER next <change-id>` repeats the checks once the cause is fixed (the check of what the commit holds is not repeated, so the user should look at the commit with `git show --stat HEAD`). When the output has no `archive` field, say nothing about a commit or an archive. STOP. Do not try to recover on your own.
  Before you STOP, call TaskList. When a task with the subject `PR comment: <change-id>` for this run is open, do the PR comment step. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.

## PR comment (opt-in)

The PR comment step runs only when TaskList shows an open task with the subject `PR comment: <change-id>` for this run's change id. A task for another change id does not count. Do these in order, once:

1. Run `node $PR_COMMENT <change-id>` from the project root. Quote the script path and the change id for the shell. It prints one JSON object and posts the router's `report.md` as a comment on the open pull request of the current branch, or edits its own earlier comment.
2. Print one line: `PR comment: <action>, <url or reason> (PR <pr url or none>)`, from the `action`, `url`, `reason` and `pr` of that object.
3. Mark the task completed.

- In `archive` the step runs at the end of step 1, before the archive step, so before the move.
- A `halt` without a `report` posts nothing: print `PR comment: skipped, no report` and mark the task completed.
- If the script exits non-zero or prints no JSON object (for example a change id longer than 100 characters, which the script refuses and the router does not), print `PR comment: skipped, script error` and mark the task completed.
- A skip is not a failure of the run and is never retried. Do not write the result into the change folder. It goes into your final message only.

## Rules

- Never choose or change `model` or `effort`. Never edit the prompt the router returns.
- Never skip the router, call two steps without it, or run a step it did not return.
- Never edit `context/changes/<change-id>/agent-smith/run.jsonl` or `meta.json` next to it. The router owns them.
- After an `archive` action, never run `init`, `next` or `status --report` for that change. Its folder has moved.
- Do not read the subagent's work in detail. The router reads the artifacts on disk and verifies them.
- If the user interrupts and asks to change routing, point them to the policy (below). Do not hand-tune a single run.
- Only `$PR_COMMENT` may post a comment. Never run `gh` yourself and never write the result of the PR comment step into the change folder.

## Tuning

Routing lives in data, not in this file:

- `<this skill's base directory>/policy.json` holds the defaults: the model/effort ladder, the base tier per step, escalation and de-escalation rules, retry caps, and prompt templates.
- A project can override any key in `context/foundation/agent-smith-policy.json`. The router deep-merges it over the defaults. Arrays such as `ladder` are replaced whole.

How the tier moves (see `scripts/route.mjs`, `tierFor` and `decide`):

- Rigor level: every run has one level (`lean`, `standard` or `thorough`), stored in `meta.json` and kept on resume. It starts from the goal class (or `--rigor`) and only rises: with the phase count (`rigor.fromPhases`), with failed steps (`rigor.fromFailures`), when the plan or the diff touches a hot path (`risk`), and when a result carries `signals.rigor`.
- Hot paths are paths that change often in the repository history, measured up to the commit the run started from. A change that touches one never stays at the lowest level. When the history is missing, too short or unreadable, the router flags nothing and records that risk was not measured. The `risk` command prints the numbers.
- The lowest level skips plan review before implementation starts, but only when risk was measured and the plan names at least one path. The router writes a skip entry to `run.jsonl` with the reason, and `report.md` lists it. A skip uses no step budget. Implementation review is never skipped.
- The step budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` for the level. The deltas leave room for the longest legal path of each level plus one failed step and its retry; extra steps (see "Phase executors" below) are metered by a pool per level, `extraSteps.allowance`, that the lowest level does not have.
- Effort floor: plan, plan review and implementation review ask questions, so the router never runs them below the floor in `rigor.minEffort` for the level. The floor is applied last, so it wins over the simple-change discount. The report marks a step as simple only when the discount survived the floor.
- The lowest level also moves implementation review one tier down (`rigor.tierOffset`), never below the floor.
- The archive step is not moved by any rule above. The policy pins its tier.
- Pre-plan steps (`preplan` in the policy): before the first `plan` step of a run, the router can return `research`, `domain-brief` and `frame`, in that order. Each gate opens at `thorough` by default (`preplan.gates.<step>.minRigor`). `domain-brief` and `frame` also need a signal in the goal text or in an earlier result (`when` predicates). A gate closed by the rigor level is silent. An open gate that does not run, because its artifact exists or its signal is missing, logs a skip with its reason. Nothing runs once a plan attempt exists. The policy pins the tier of `frame`.
- Verification by artifact: a pre-plan step counts as done only when its artifact changed after the step started and has the shape the next step needs (`research.md` with `status` frontmatter, `frame.md` with a `## Reframed` heading, the brief file with `type: refactor-plan`). A failed attempt follows the failure rule above.
- Loops (`preplan.loops.minRigor`, default `thorough`): at that level plan review `RETHINK` runs one `frame` round and then re-plans, and a second `RETHINK` after that re-plan halts. A second `REVISE` re-plan is preceded by one `research` round. Below that level `RETHINK` and `REVISE` re-plan as described below. The level read is the run's current level, so a run that rises to `thorough` mid-run opens the loops from then on.
- The `description` and the Start section stay valid: the orchestrator treats `research`, `domain-brief` and `frame` like any other `run` action and never names them.
- Phase executors (`executors` in the policy): the step name stays `implement`, the template changes. For the first pending phase the router can return `implement-e2e` (a valid `/10x-e2e-setup` record and a browser word in the phase), `implement-tdd` (at `thorough`, a pure-logic phase), or `implement-segment` (goal-implement stopped after a phase, so that a special phase after it gets its own executor). The orchestrator runs the prompt the router returns and names none of them.
- Extra-step pool (`extraSteps`): segments, e2e and tdd steps, `manual-verify` and the `plan-rejected` re-plan each draw from one pool per level, whatever their outcome. A segment is started only when the pool can also pay for the executor after it; otherwise plain `implement` runs the whole plan.
- Commit check: a tdd or e2e step that reports `done` counts only when the plan shows ticked rows and a commit since the step began touched a code path (a read-only `git` check; without git the count rule applies). Plain `implement` and segments keep the count rule.
- Retry: rows a strict step left ticked without a commit get one `implement-retry` step. If they are still without a commit afterwards, the run goes on and the implementation review prompt carries a warning that names the rows.
- Fallback: a tdd or e2e step that ends `blocked` is recorded as a fallback. It counts as no failed attempt, bumps no tier and raises no rigor, and that executor is not chosen again for the phase.
- Code re-plans (`codeReplan`, rigor `standard` or higher, one per run): `plan-replan` after two implement failures in a row, `plan-rejected` after a first implementation review `REJECTED` before any fix. A failed `plan-replan` halts the run.
- `manual-verify` (`manualVerify`, rigor `standard` or higher): once, before the first implementation review, a subagent proves the pending Manual rows that a backticked command can check and ticks each with an evidence file. The router checks the evidence file and that no Automated row or title changed. A failed attempt is neutral. Unproven ticks are listed in the final message as `manualUnproven`.
- `--chrome` (`init` flag, kept in `meta.json`): picks the `manual-verify` template that may also check browser rows with the Chrome tools. The orchestrator does not probe for them.

- Plan size: +1 tier per `phaseThresholds` entry reached by the phase count in `## Progress`.
- First plan, from the goal text (changes relative to the plan step's base): a short goal (at most `firstPlan.maxWords` words, no hard keyword) = -1 plus the simple-change discount. A goal with a hard keyword from `firstPlan.hardKeywords` = no reduction, whatever its length. Any other goal, including an empty one = -1.
- A simple change (at most 1 phase and 6 `## Progress` rows) = -1 on plan review, implement and implementation review. The step's `minTier` can absorb the discount, for example implement after a clean `SOUND` review. The discount is withheld after any failed step, so the first retry of a discounted step moves up 2 tiers (the lost discount plus the failure).
- Plan review `RETHINK` = re-plan at +2. `REVISE` with criticals or too many warnings = re-plan at +1.
- A noisy plan review (3+ warnings) = implement at +1. A clean `SOUND` = implement at -1.
- Each failed or unverified attempt of the same step = +1, capped by `maxAttemptsPerStep`.
- Impl review after retries or fixes = reviewer at +1.
- Impl review `REJECTED` before any `fix` = one re-plan per run at the plan tier +1, at rigor `standard` or higher and when the extra-step pool allows; otherwise, and for every later `REJECTED`, = fix at the last code tier +1. `NEEDS ATTENTION` = fix at the last code tier.
- A step counts as failed when its reported status is not `done`, or the expected artifact did not change: `plan.md` with `## Progress`, a review file with a verdict, or new checked Automated rows (for a tdd or e2e step also a code commit, see the commit check above).
