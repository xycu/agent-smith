---
name: openspec-pipeline
description: >
  Run an existing OpenSpec change end to end (propose, apply, verify, fix loop, optional
  CLI archive) with each step in its own subagent. The shared agent-smith router picks
  the next step and its model and effort from the OpenSpec files on disk: the planning
  artifacts, the ticked rows of tasks.md and the verify verdict. Use when the user wants
  an orchestrated or unattended OpenSpec run, "pipeline this OpenSpec change", or
  "run the OpenSpec chain".
argument-hint: <change-name> [goal text] [--archive] [--pr-comment]
allowed-tools:
  - Agent
  - AskUserQuestion
  - Bash
  - Read
  - Write
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# OpenSpec Pipeline

You are the orchestrator. You do not propose, implement or verify yourself. You do not pick models or effort levels. The router script decides every step; you execute what it returns.

This skill drives an OpenSpec change (`openspec/changes/<change-name>/`) through the steps `os-propose`, `os-apply`, `os-verify` and, with `--archive`, the OpenSpec CLI archive. It shares the router, the policy and the report format of `10x-pipeline` (ADR-013).

Router: `ROUTER=<this skill's base directory>/../10x-pipeline/scripts/route.mjs`. Run it with `node` from the run root (see Start step 3). Every router call carries `--chain openspec`.
PR comment script: `PR_COMMENT=<this skill's base directory>/../10x-pipeline/scripts/pr-comment.mjs`. Only the PR comment step runs it (see "PR comment (opt-in)").

## Start

1. Parse the arguments: `<change-name>` (required, kebab-case, the name of a folder under `openspec/changes/`), optional goal text, and the optional flag `--archive`. It may carry the value `true` or `false` right after it, as in `--archive false`. Remove the flag and its value from the goal text. Pass it on to `init`, with its value, only when the user gave it. Parse the optional flag `--pr-comment` the same way, remove it from the goal text, and never pass it to `init`.
2. Checks, from the project root (the directory this session started in, where `openspec/` lives):
   - If `openspec/config.yaml` is missing, tell the user this is not an OpenSpec project (`openspec init` sets one up) and STOP. If `git rev-parse --is-inside-work-tree` prints `true` and `git ls-files --error-unmatch -- openspec/config.yaml` fails, tell the user to commit `openspec/` first, because a run works in its own worktree and sees only committed files, and STOP.
   - If `openspec/changes/<change-name>/` is missing, first run `node $ROUTER verify-archive <change-name> --chain openspec` (no `--path`). When it reports `archived: true`, tell the user where the change was archived and STOP. When it lists `ambiguous` archive folders, show them to the user and STOP: the name was archived more than once and the user picks the folder. Otherwise tell the user to create the change with `openspec new change <change-name>` (or `/opsx:propose`), say that a change hosted in a store (`--store`) is not supported, and STOP.
   - If the OpenSpec skills (`openspec-propose`, `openspec-apply-change`, `openspec-verify-change`) are not available in this project, tell the user to set them up with `openspec init` first and STOP. With `--archive`, if `command -v openspec` fails, tell the user the archive step needs the `openspec` CLI on `PATH` and STOP.
   - When `git status --porcelain -- .claude/skills` lists untracked `.claude/skills/openspec-*` folders, print one line that names them as "untracked OpenSpec skills: a session started inside the run worktree does not see them until they are committed", and go on.
3. Run isolation: each run works in its own git worktree on the branch `agent-smith/<change-name>`. Names: `<root>` is the project root, `<prefix>` is what `git -C "<root>" rev-parse --show-prefix` prints (empty at the repository top level), `<worktree>` is `<root>/.claude/worktrees/agent-smith-<change-name>`, and the run root is `<worktree>/<prefix>`. Keep `<root>` and the run root as absolute paths. The worktree stays under `<root>`, because Claude Code resets a `cd` that leaves the project directory.
   - Opt-out first: when `git -C "<root>" rev-parse --is-inside-work-tree` does not print `true`, or `<root>/context/foundation/agent-smith-policy.json` sets `isolation.require` to a value other than `true`, create nothing and copy nothing. The run root is `<root>`. Without git and with `isolation.require` on, the router's halt at `init` names the override.
   - When the shell already runs in a linked worktree on a branch that starts with `agent-smith/`, its directory is the run root. Create nothing and copy nothing.
   - Otherwise take the first of these cases that holds:
     1. In-flight run in the main checkout: `<root>/openspec/changes/<change-name>/agent-smith/meta.json` exists and no branch `agent-smith/<change-name>` exists (`git -C "<root>" rev-parse --verify -q refs/heads/agent-smith/<change-name>` fails). Create nothing. The run root is `<root>`. The router halts at `init` there unless the project sets `isolation.require` to `false`. Never copy its log into a worktree.
     2. No branch `agent-smith/<change-name>`. When `git -C "<root>" check-ignore -q .claude/worktrees/agent-smith-<change-name>/x` fails, append the line `/<prefix>.claude/worktrees/` to the file that `git -C "<root>" rev-parse --path-format=absolute --git-path info/exclude` prints. This is a local exclude; never edit `.gitignore`. Then print one line that lists the paths `git -C "<root>" status --porcelain` reports outside `openspec/changes/<change-name>/` as "not in the run (uncommitted in the main checkout)", or print nothing when there are none, and go on. Then, from `<root>`, run `git worktree add -b agent-smith/<change-name> "<worktree>"`, `mkdir -p "<run root>/openspec/changes"` and `cp -Rp "<root>/openspec/changes/<change-name>" "<run root>/openspec/changes/"`. `-p` keeps the file times, which the router compares.
     3. A worktree of `agent-smith/<change-name>` exists (`git -C "<root>" worktree list --porcelain` shows `branch refs/heads/agent-smith/<change-name>`): reuse it. Its directory plus `<prefix>` is the run root. Copy nothing.
     4. The branch exists without a worktree: from `<root>`, run `git worktree add "<worktree>" agent-smith/<change-name>`. Copy nothing.
   - A resume never copies: the change folder in the main checkout is older than the run's state on the run branch and would overwrite it.
   - Run every later router call as `cd "<run root>" && node $ROUTER ... --chain openspec`, so it works on the run root also after the shell was reset or when you run inside a subagent, whose `cd` never carries over. Write each result file at `<run root>/<resultFile>`.
   - The router commits each successful step and rolls a failed step back in the run worktree (ADR-010). Never commit, stash, reset or clean the run worktree yourself, and never touch `refs/agent-smith/`. When the final message lists rolled-back or kept steps (`report.md`, `## Rolled-back steps`), name their side refs.
   - When the run root is not `<root>`, the final message names the branch `agent-smith/<change-name>` and the run root. It says that the change folder in the main checkout is a stale copy: the run's copy lives on the run branch, so remove or stash the main-checkout copy before merging the run branch, because git refuses a merge that would overwrite untracked files. For a run that ended `done` without `--archive`, it also says that `report.md`, `verify.md`, the last `run.jsonl` entry and `meta.json` under `openspec/changes/<change-name>/agent-smith/` are uncommitted in the worktree: commit them before the merge and before `git worktree remove`, which refuses a worktree with modified or untracked files.
   - When the run root is `<root>` (isolation off), the final message of a run that ran `os-apply` says that the code the run implemented is not committed: the router makes step commits only in an isolated run, and the commits of an `--archive` run hold only `openspec/` paths, so the user commits the code.
4. Run `cd "<run root>" && node $ROUTER init <change-name> --chain openspec --goal "<goal text>"`. Quote the goal safely for the shell. Re-running `init` on a change with an existing log resumes it: the router reads the disk state and continues from there. Add `--rigor <level>` only when the user named a rigor level (`lean`, `standard` or `thorough`). Never pick one yourself. On a resume the flag can only raise the level. Add `--archive` only when the user gave it. A resume keeps a stored `--archive`, and `--archive false` turns it off.
5. Call TaskList. A task is the only place the `--pr-comment` request is stored, so do not rely on remembering it.
   - With `--pr-comment`: when no open task has the subject `PR comment: <change-name>` (the real name), call TaskCreate once with that subject. Its description: when the router returns `done`, `archive` or `halt`, call TaskList, and when this task is open do the PR comment step once, then mark the task completed.
   - Without `--pr-comment`: mark any open task with the subject `PR comment: <change-name>` completed, so a task left by an earlier invocation cannot post. Ignore a task whose subject names another change. Never complete it.
   - If `--pr-comment` was given and TaskList or TaskCreate fails or is not available, print `PR comment: skipped, task list unavailable (run the script by hand after the run, see the README)` once, and do not run the PR comment step in this run. Without the flag a task tool error is silent.

## Loop

The router prints one JSON object. Act on `action`:

- **`run`** (the step is `os-propose`, `os-apply` or `os-verify`; a fix after a failed verify is `os-apply` with a fix prompt. You treat them all alike.)
  1. Print one line: `Step <n>: <step> on <model>/<effort>. <reason>`.
  2. Call the Agent tool with `subagent_type` set to the router's `agent` when the output has one, else `general-purpose`, `model: <model>`, `effort: <effort>`, `run_in_background: false`, and `prompt` set to the router's `prompt`, copied verbatim. Never choose an agent type yourself. When the call fails, for example because the router's `agent` does not resolve, do not call it again with another type: go on with step 3, which records the step as `unknown`.
  3. Find the last line of the subagent's reply that starts with `RESULT:`. Parse the JSON after it. If there is none, or it does not parse, use `{"status":"unknown","note":"no RESULT line"}`. Keep every key of the JSON as it is, including the optional `signals` object. Copy it untouched. The router validates it.
  4. If the Agent result reports usage (total tokens, tool uses and duration), add `"usage":{"totalTokens":N,"toolUses":N,"durationMs":N}` to that JSON, with the figures copied exactly. Usage reaches you in one of two places: in the Agent result, or, when the subagent ran in the background and handed its report back as a message, in the `<usage>` block of the task notification that says the subagent finished, as `<subagent_tokens>N</subagent_tokens><tool_uses>N</tool_uses><duration_ms>N</duration_ms>`, usually within a second of the report. Take the figures from whichever of the two is already in this conversation, `subagent_tokens` as `totalTokens`. Omit the key when no figure is reported. Do not wait for a figure that has not arrived; see the anti-stall rules. Write the JSON to `<run root>/<resultFile>` (the router's `resultFile` under the run root) with the Write tool.
  5. Run `cd "<run root>" && node $ROUTER next <change-name> --chain openspec` and repeat the loop with its output.
- **`done`**: report the final verdict from `reason` (the verdict of `openspec/changes/<change-name>/agent-smith/verify.md`) and the number of steps. Then run `cd "<run root>" && node $ROUTER status <change-name> --chain openspec` and show the model/effort used per step as a short list, and the `openspec` task counts it prints. Point the user to the router's `report` path (`report.md`) and to `verify.md`, which holds the verify report with its warnings.
  Call TaskList. When a task with the subject `PR comment: <change-name>` for this run is open, do the PR comment step. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.
- **`archive`** (only for a run started with `--archive`; the verify verdict passed, every task row is ticked and the router has committed the change folder, or found it already committed):
  1. Run `cd "<run root>" && node $ROUTER status <change-name> --chain openspec` now, before the move, because the archive moves the log. Report what `done` reports: the final verdict from `summary.reason`, the number of steps, the model/effort used per step as a short list, and the router's `report` path.
     Then call TaskList. When a task with the subject `PR comment: <change-name>` for this run is open, do the PR comment step now, before step 2, so the comment is posted before the move. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.
     Manual gate: when `summary.manualPending`, `summary.manualUnproven` and `summary.uncommittedTicks` are all empty, go on to step 2. Otherwise ask one yes/no question with `AskUserQuestion`: one question, header `Archive`, two options with exactly these labels, `No, keep it unarchived` first and `Yes, archive anyway` second. The `No, keep it unarchived` description starts with `Recommended.`. The question text states how many Manual rows are pending, lists them (at most 10, then "and N more"), lists each non-empty `summary.manualUnproven` and `summary.uncommittedTicks` row id and adds the `summary.manualNotProved` lines when present, and says the archive moves the change folder and these checks stay unverified. Only the answer `Yes, archive anyway` continues at step 2. Fail closed: any other answer, an error from the question tool, or no question tool (for example a headless `claude -p` session) is a no. On a no, launch no subagent and run no `verify-archive`. Print `Archive: skipped, <n> Manual check(s) pending or unproved.` and STOP with a final message that says: the change was not archived; the change folder is committed on the run branch (the `commit` of the action, or already committed); the pending checklist again; `openspec archive <change-name> --yes --json`, run by the user, archives it later, and running `/agent-smith:openspec-pipeline <change-name>` again asks the question again; and, when the run root is not `<root>`, the worktree notes of Start step 3. The report line `Archive: requested` is then stale; say so. In this chain those three lists are always empty, so the gate is dormant.
  2. Print one line: `Archive: openspec archive on <model>/<effort>.`
  3. Call the Agent tool with the same parameters as for `run` and `prompt` set to the router's `prompt`, copied verbatim. The subagent runs `openspec archive <change-name> --yes --json` once and commits the move as `chore(archive): close <change-name>`.
  4. Write no result file and do not call `next`. The `archive` action has no `resultFile`, and nothing may be written into the folder that moves.
  5. Run `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec --path <archivePath>` with the `archivePath` of the `archive` action.
     - On `archived: true`: print the archive path and the report path inside it. Print one line asking the user to confirm that `git status` is clean, because `verify-archive` reads files only and a failed `chore(archive)` commit leaves the move uncommitted. When the action's `ignored` list is not empty, list its paths as "not committed (ignored by git)". Copy the subagent's `note` (`archivedAs` and `path`), its `assumptions` and any usage figure it reported into the final message.
     - On `archived: false`: print `reason` and the subagent's note, which quotes the CLI error (for example `archive_target_exists`), say the folder may be unchanged or archived under another date, and STOP.
- **`halt`**: report `reason` and the status output. A reason that says `needs a human` comes from the subagent, which found no evidence-backed answer, or from the router (a `tasks.md` without task rows, an unreadable `verify.md`, or a verify `FAIL` after the last fix loop). Show the quoted text. Point the user to the router's `report` path (`report.md`) when present. When the output has an `archive` field, say the change was not archived, then read `committed`: if `false`, say the folder is not committed and the archive needs it committed first; if `true`, say the pre-archive commit exists locally, the router did not undo it, and `cd "<run root>" && node $ROUTER next <change-name> --chain openspec` repeats the checks once the cause is fixed (the check of what the commit holds is not repeated, so the user should look at the commit with `git show --stat HEAD`). When the output has no `archive` field, say nothing about a commit or an archive. STOP. Do not try to recover on your own.
  Before you STOP, call TaskList. When a task with the subject `PR comment: <change-name>` for this run is open, do the PR comment step. If the call errors, post nothing, and when `--pr-comment` was given print `PR comment: skipped, task list unavailable`.

## Anti-stall rules

Rules 1 to 3 hold for every `run` step. Rules 4 and 5 hold for the whole run, also while its `done`, `archive` or `halt` branch is being worked through. Rule 1 also holds for the archive subagent: when its final report arrives, continue at step 4 of the `archive` branch. Rules 2 and 3 do not apply to it, because the `archive` action has no result file and no `next` call; a usage figure it reports goes only into the final message. A run has ended when the orchestrator has finished every step of its `done`, `archive` or `halt` branch.

- **GIVEN** a `run` step **WHEN** the Agent tool returns a launch notice instead of a final report although `run_in_background` is `false` **THEN** the orchestrator **MUST** end its turn and continue the Loop at step 3 when the subagent's final report arrives, without starting another step or polling.
- **GIVEN** the final report of a `run` step holds its `RESULT:` line **WHEN** no usage figure has arrived **THEN** the orchestrator **MUST** write the result file without `usage` and run `next` in the same turn.
- **GIVEN** `next` ran for a `run` step **WHEN** a usage figure for that step arrives later **THEN** the orchestrator **MUST NOT** rewrite the result file or call `next` again, so the step keeps `-` for tokens in the report.
- **GIVEN** the run has not ended in `done`, `archive` or `halt` and no STOP instruction of the Start or Loop sections applies (for example `archived: false` in the `archive` branch) **WHEN** the orchestrator would end its turn **THEN** it **MUST NOT** end it unless a launched subagent is still running.
- **GIVEN** a run in this session **WHEN** the user asks what the run is doing **THEN** the orchestrator **MUST** state only what tool output in this session shows, and say so when nothing is running.

## PR comment (opt-in)

The PR comment step runs only when TaskList shows an open task with the subject `PR comment: <change-name>` for this run's change. A task for another change does not count. Do these in order, once:

1. Run `cd "<root>" && node $PR_COMMENT <change-name> --report "<run root>/openspec/changes/<change-name>/agent-smith/report.md"` from `<root>`, the main checkout, also when the run root is a worktree: the pull request belongs to the branch of the main checkout, not to the local run branch. Always pass `--report`, because the script looks under `context/changes/` without it. Quote the script path, the change name and the report path for the shell. It prints one JSON object and posts the router's `report.md` as a comment on the open pull request of the current branch, or edits its own earlier comment.
2. Print one line: `PR comment: <action>, <url or reason> (PR <pr url or none>)`, from the `action`, `url`, `reason` and `pr` of that object.
3. Mark the task completed.

- In `archive` the step runs at the end of step 1, before the archive step, so before the move.
- A `halt` without a `report` posts nothing: print `PR comment: skipped, no report` and mark the task completed.
- If the script exits non-zero or prints no JSON object (for example a change name longer than 100 characters, which the script refuses and the router does not), print `PR comment: skipped, script error` and mark the task completed.
- A skip is not a failure of the run and is never retried. Do not write the result into the change folder. It goes into your final message only.

## Rules

- Never choose or change `model` or `effort`. Never edit the prompt the router returns.
- Never skip the router, call two steps without it, or run a step it did not return.
- Never call the router without `--chain openspec`.
- Never edit `openspec/changes/<change-name>/agent-smith/run.jsonl`, `meta.json` or `verify.md` next to them. The router and the verify step own them; after a halt the human may edit `verify.md`.
- Never run `openspec archive`, `/opsx:archive` or the `openspec-archive-change` skill yourself. Only the subagent of the `archive` action archives, with the CLI.
- After an `archive` action, never run `init`, `next` or `status --report` for that change. Its folder has moved.
- Do not read the subagent's work in detail. The router reads the artifacts on disk and verifies them.
- If the user interrupts and asks to change routing, point them to the policy (below). Do not hand-tune a single run.
- Only `$PR_COMMENT` may post a comment. Never run `gh` yourself and never write the result of the PR comment step into the change folder.

## Tuning

Routing lives in data, not in this file:

- `<this skill's base directory>/../10x-pipeline/policy.json` holds the defaults for both chains. The steps of this chain are `os-propose`, `os-apply`, `os-verify` and `os-archive` under `steps`, and their prompts under `prompts`.
- A project can override any key in `context/foundation/agent-smith-policy.json`. The router deep-merges it over the defaults. Arrays such as `ladder` are replaced whole.
- The routing rules of this chain (step order, verdict, fix loop, archive, limits) are in the plugin's `docs/REFERENCE.md`, section `/agent-smith:openspec-pipeline`.
