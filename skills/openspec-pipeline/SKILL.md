---
name: openspec-pipeline
description: >
  Run an OpenSpec change end to end by explicit /agent-smith:openspec-pipeline
  command. Propose, apply, verify and fix in separate subagents, with a shared
  router selecting each step from the change artifacts and verification results.
disable-model-invocation: true
argument-hint: <change-name> [goal text] [--archive] [--rigor <level>] [--pr-comment]
allowed-tools:
  - Agent
  - AskUserQuestion
  - Bash
  - Read
  - Write
---

# OpenSpec Pipeline

You are the orchestrator. You do not propose, implement or verify yourself. You do not pick models or effort levels. The router script decides every step; you execute what it returns.

This skill drives an OpenSpec change (`openspec/changes/<change-name>/`) through the steps `os-propose`, `os-apply`, `os-verify` and, with `--archive`, the OpenSpec CLI archive. It shares the router, the policy and the report format of `10x-pipeline` (ADR-013).

Router: `ROUTER="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/route.mjs"`. Use `node` from the run root (Start step 3), with the path shell-quoted. Every router call carries `--chain openspec`.
PR comment script: `PR_COMMENT="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/pr-comment.mjs"`. Use only in "PR comment (opt-in)".
Pull request script: `OPEN_PR="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/open-pr.mjs"`. Use only in "Pull request (always)".
Bash timeout: run every `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` call with the Bash tool's `timeout: 600000`, its maximum. The default can kill a slow router commit.

Codex runner: `RUN_CODEX="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/run-codex.mjs"` under Claude. Under Codex, take the absolute SKILL.md path supplied when this skill was loaded, use its directory, then the sibling `../10x-pipeline/` directory, and resolve the same `scripts/route.mjs`, `scripts/run-codex.mjs`, `scripts/pr-comment.mjs`, `scripts/open-pr.mjs` and `policy.json` relative to the loaded absolute SKILL.md path. Keep every script path absolute and quoted.

Claude accounting: `CLAUDE_USAGE="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/claude-usage.mjs"`. Use the same reader for immediate, late and archive measurements.

Set `--host <host>` from the actual session (`claude` or `codex`). Only Claude Code dispatches router-selected `claude` actions through Agent. Both hosts run `openai` actions through the shared runner with existing Codex configuration, or the action's optional profile.

## Start

1. Parse the arguments. Require kebab-case `<change-name>` and optional goal text. Parse `--archive` and `--pr-comment` with optional following `true` or `false`. Remove flags and values from goal text. Forward supplied flags to `init`. Every explicit invocation forwards `--pr-comment true` when requested, otherwise `--pr-comment false` to reset authorization.
   Parse `--rigor` with a following `lean`, `standard` or `thorough` (`--rigor=<level>` too), remove it from goal text and forward only when supplied.
2. Checks, from the project root (the directory this session started in, where `openspec/` lives):
   - If `openspec/config.yaml` is missing, tell the user this is not an OpenSpec project (`openspec init` sets one up) and STOP. If `git rev-parse --is-inside-work-tree` prints `true` and `git ls-files --error-unmatch -- openspec/config.yaml` fails, tell the user to commit `openspec/` first, because a run works in its own worktree and sees only committed files, and STOP.
   - Require the OpenSpec 2.0.0 skills `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`. If one is unavailable, point to the reference's custom-profile setup. Tell the user to retain existing workflow selections, include `propose,apply,verify`, then run `openspec update`, or `openspec init --tools claude,codex --profile custom` when selecting tools, and STOP. The default core profile omits verify. Profile configuration is global. Scripted setup isolates HOME and XDG paths. With `--archive`, if `command -v openspec` fails, tell the user the archive step needs the `openspec` CLI on `PATH` and STOP.
   - OpenSpec 2.0.0 generates canonical `.agents/skills/openspec-*/SKILL.md` files and relative Claude links under `.claude/skills/`. When `git status --porcelain -- .agents/skills .claude/skills` lists untracked targets or links, print one line naming them as "untracked OpenSpec skills: a session started inside the run worktree does not see them until they are committed", and go on. Tell the user to commit the shared targets, `.agents/skills/.openspec-target` and Claude links before creating run worktrees, then confirm discovery in a fresh child from the run root.
3. Prepare run isolation before init. `<root>` is this session's original project root. Under Claude, define `PREPARE_RUN="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/prepare-run.mjs"`. Under Codex, resolve `../10x-pipeline/scripts/prepare-run.mjs` from the absolute SKILL.md path. Keep `PREPARE_RUN` absolute and quoted.
   - Run `cd "<root>" && node "$PREPARE_RUN" <change-name> --chain openspec` with the Bash tool's `timeout: 600000`.
   - Parse exactly one JSON object and validate `root`, `runRoot`, `worktree`, `branch`, `case`, `copied`, `excludeAdded`, `notInRun`, `left` and `reason`. Require `reason: null`, absolute `root` and `runRoot`, and an array of path strings in `notInRun`. On nonzero exit, missing/malformed JSON, invalid fields or non-null `reason`, show diagnostics and STOP before `init`.

     If setup cannot select a root and `openspec/changes/<change-name>/` under `<root>` is absent, use the missing-change guidance below with `cd "<root>" && node $ROUTER verify-archive <change-name> --chain openspec` before stopping. Validate fresh sources before exclude/branch/worktree creation.
   - Use returned `root` and `runRoot` as `<root>` and `<run root>`. Label nonempty `notInRun` “not in the run (uncommitted in the main checkout)”.
   - After successful setup selects `<run root>`, if `openspec/changes/<change-name>/` under `<run root>` is missing, first run `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec` (no `--path`). For `archived: true`, show its path and STOP. For `ambiguous`, list folders for user selection and STOP. Otherwise tell the user to create the change with `openspec new change <change-name>` (or the `openspec-propose` skill), say that a change hosted in a store (`--store`) is not supported, and STOP. Setup resolves resumes before this check, even after complete source cleanup.
   - A resume never copies older main-checkout state.
   - Run every later router call as `cd "<run root>" && node $ROUTER ... --chain openspec`, including after shell resets and in subagents. Write each result file at `<run root>/<resultFile>`.
   - The router owns step commits/rollback (ADR-010). Never commit, stash, reset or clean the run worktree or touch `refs/agent-smith/`. For rolled-back or kept steps, name their side refs in the final message.
   - Never use recursive or forced directory deletion. List the files, check the list, delete them one by one, then `rmdir` the empty directories deepest first (ADR-016).
   - Save original setup JSON verbatim, independently of cleanup. For saved `case: created`, `copied: true`, `reason: null`, after step 4 returns `action: run`, `done` or `archive`, send saved setup JSON verbatim on stdin to `cd "<root>" && node "$PREPARE_RUN" <change-name> --cleanup --chain openspec` with the Bash tool and `timeout: 600000`. Cleanup runs once before run launch, done reporting/PR handling or archive dispatch. Resumes and halted initialization skip cleanup.
   - Parse exactly one cleanup JSON object with the same field validation and an array of path strings in `left`. Report nonempty `left` as retained original paths. On diagnostics, nonzero exit, missing/malformed JSON or invalid fields, show the error and original change path. Keep the initialized run root and continue the init action even on `runRoot: null`.
   - When isolated, name the branch from saved setup `branch` and run root, retained original paths from `left` and cleanup diagnostics in the final message. For `done` without archive, if publication reports `committed: false`, reported `pushed: false` without `committed: true`, or no JSON object, report `report.md`, `verify.md`, the last `run.jsonl` entry and `meta.json` under `openspec/changes/<change-name>/agent-smith/` are uncommitted in the worktree. Commit them before the merge and before removing the worktree.
   - When the run root is `<root>` (isolation off), the final message of a run that ran `os-apply` says that `os-apply` commits its code itself under a typed subject, while the router makes step commits only in an isolated run and the commits of an `--archive` run hold only `openspec/` paths, so the files of the change folder stay uncommitted and the user commits them.
4. Run `cd "<run root>" && node $ROUTER init <change-name> --chain openspec --goal "<goal text>" --host <host> --pr-comment <true|false>`. Shell-quote the goal safely. An existing log resumes from disk. Forward `--rigor <level>` only from user flags or plain words. Never choose it. Resume only raises it. Add `--archive` only when the user gave it. A resume keeps a stored `--archive`, and `--archive false` turns it off.
5. Before OpenAI launch, check `codex --version` against the documented CLI contract. Prove fresh-child toolkit SKILL.md discovery from the run root via active config and installed user/project/plugin locations. Parent-session listing alone proves no child discovery. Missing CLI, toolkit or discovery evidence stops the launch with a diagnostic. Existing Codex and host controls own authentication, trust and Git permissions. The runner probes Git permissions without creating profiles or granting trust.

## Loop

Read the router JSON and follow `action`.

Suspension STOP: a live or unresolved execution lock suspends the run and archive paths before result writes, `next`, late `usage`, archive verification/dispatch, commit/rollback and terminal publication/comment procedures. Preserve the pending dispatch, saved prompt and existing result bytes. Permit read-only status and execution inspection. Return an actionable blocked report naming the lock path and reconciliation prerequisite with `signals.needsHuman`, then STOP even if the foreground process has closed. Keep the enabling revision and the same TMPDIR; never remove a production lock yourself or change TMPDIR to bypass exclusion. Continue only after established settlement and existing router-owned recovery. This STOP takes precedence over ordinary incomplete-envelope, halt and publication handling.

- **`run`** (dispatch every returned step alike)
  1. Print one line: `Step <n>: <step> on <model>/<effort>. <reason>`. With `neutralRetry`, append `Neutral rerun <count> of <cap>.`
  2. For `provider: "claude"`, require host `claude`. Inspect the exposed Agent schema before calling: when it declares `run_in_background`, set it to `false`; otherwise omit `run_in_background`. Call the Agent tool with `subagent_type` set to the router's `agent` when the output has one, else `general-purpose`, `model: <model>`, `effort: <effort>`, `description: "agent-smith <change-name> step <n> <step>"`, and `prompt` set to the router's `prompt`, copied verbatim.

     For archive step 3, override the description with `agent-smith <change-name> archive`.

     Record each invocation separately with its exact description, router `change`, `n` and `step`, and associate any returned agent id with that launch. Use the action's actual `n` for retries, including neutral retries; preserve prior launch records even when descriptions repeat. Record host `sessionId`, native Agent `tool_use_id` as `runId`, returned `agentId` and observed host version; never derive them from a description.

     Usage ownership in Loop step 4 follows the identity check in rule 6: use only the current invocation's matched records. An earlier numbered step follows the late-usage path. Leave unmatched or ambiguous figures unattached. Without a matched figure, attach unavailable evidence and run `next` in the same turn under rule 2. Never choose an agent type yourself.

     For your own fault with no step subagent running, write `{"status":"orchestrator-error","note":"<what happened>"}` to `<run root>/<resultFile>` using Write, then step 5. The router repeats the same step/prompt without a failed attempt.

     Only these are your faults. A prelaunch refusal/error unrelated to the router's `agent`, an incomplete prompt handoff, or a call returning neither reply nor error.

     Launch notices follow the anti-stall rules.

     For other call failures, including an unresolved router `agent`, do not call it again with another type. Continue at step 3 as `unknown`.


     For either provider, when `promptFile` exists, forward the router's short `prompt` verbatim. Do not read, expand, edit or delete the task file; the child reads it and the router owns cleanup.


     For `provider: "openai"`, run `cd "<run root>" && node "$RUN_CODEX" <change-name> --chain openspec` with the entire router action JSON on stdin. Pass its exact prompt and dispatch unchanged. Wait through the host terminal completion facility, retaining the process handle. A foreground timeout never permits relaunch.

     Before any result handling, check for `Execution suspended:` or any live/unresolved execution-lock diagnostic, including `launched: false` and lock-related router halts. Apply the suspension STOP below before the ordinary incomplete-envelope branch.

     When the envelope has `completed: true`, write only `envelope.result` unchanged to `<run root>/<resultFile>` then step 5, bypassing steps 3–4. Preserve child `failed` or `blocked` results.

     With `completed: false` and `launched: true`, write status `unknown`, its bounded reason as `note` and any measured `usage`, then continue at step 5. Only an envelope with `launched: false` permits an `orchestrator-error` result.

     For absent/uncertain envelopes, inspect and wait on the existing process before result/router mutation. Runner and child must close before `next`, rollback or another launch.

  3. Find the last line of the subagent's reply that starts with `RESULT:`. Accept only the enclosing step report after it has collected every child and reconciled failures; child notifications never complete the step. Parse the JSON after it. If there is none, or it does not parse, use `{"status":"unknown","note":"no RESULT line"}`. Preserve all keys, including `signals`, for router validation. Cut-off replies are also `unknown`. Only step 2 declares `orchestrator-error`. Replace a child-authored `orchestrator-error` with `unknown`, preserving other keys.
  4. For every Agent result, run `cd "<run root>" && node "$CLAUDE_USAGE"` once with the host descriptor on stdin (contract: `docs/REFERENCE.md`). Supply router identity, observed host/session/agent/run and process identities, already-authorized sources, and matched independently measured tool/duration figures at their documented scope (`<tool_uses>N</tool_uses>`, `<duration_ms>N</duration_ms>`). `<subagent_tokens>N</subagent_tokens>` is final-request only; never map it to `totalTokens`, even for a flat step. Delete step-authored `usage` and `usageEvidence` before merging collector output, using exact figures only. Invocation matching proves attribution, not coverage. Missing sources produce unavailable evidence through the same reader. Omit missing usage without waiting; disclose the limitation in bounded assumptions and evidence. Rule 3 of the anti-stall rules covers one that arrives after `next`. Write JSON to `<run root>/<resultFile>` with Write.
  5. Run `cd "<run root>" && node $ROUTER next <change-name> --chain openspec` and repeat the loop with its output.
- **`done`**: first follow "Late usage (before every end)".
  Run `cd "<run root>" && node $ROUTER status <change-name> --chain openspec` and follow "Final report" using the done action and status output.
  Then do the pull request step.
- **`archive`** (only for a run started with `--archive`; the verify verdict passed, every task row is ticked and the router has committed the change folder, or found it already committed):
  1. First follow "Late usage (before every end)". A figure that arrives after step 3 has launched the archive subagent is dropped.
     Run `cd "<run root>" && node $ROUTER status <change-name> --chain openspec` before moving. Follow "Final report" using the archive action's `summary` and status output (`summary.reason` supplies the verdict).
     Manual gate: when `summary.manualPending`, `summary.manualUnproven` and `summary.uncommittedTicks` are all empty, go on to step 2. Otherwise ask one native question (`AskUserQuestion` on Claude, available Codex question tool), header `Archive`, with exactly `No, keep it unarchived` first and `Yes, archive anyway` second. Start the No description with `Recommended.`.

     State the pending Manual count and rows (at most 10, then "and N more"), each `summary.manualUnproven` and `summary.uncommittedTicks` id, and `summary.manualNotProved` lines. Say the folder moves with these checks unverified.

     Only the answer `Yes, archive anyway` continues at step 2. Fail closed. Any other answer, question-tool error or no question tool counts as no.

     On a no, launch no subagent and run no `verify-archive`. Print `Archive: skipped, <n> Manual check(s) pending or unproved.`. Count distinct ids across those three lists for `<n>`.

     Then do the first bullet of step 5 with the default report path, without running `verify-archive`, and STOP with a final message. Say the change was not archived and its folder is committed on the run branch (`commit`, or already committed). Repeat the pending checklist. `openspec archive <change-name> --yes --json`, run by the user, archives it later, and running `/agent-smith:openspec-pipeline <change-name>` again asks the question again; and, when the run root is not `<root>`, the worktree notes of Start step 3. Identify stale `Archive: requested` in the report. In this chain those three lists are always empty, so the gate is dormant.
  2. Print one line: `Archive: openspec archive on <model>/<effort>.`
  3. Call the Agent tool with the same parameters as for `run` only for a `claude` action on the Claude host, with `prompt` set to the router's `prompt`, copied verbatim. For an `openai` action, feed the entire archive action to the shared runner command from `run` step 2 and wait for its process and child to close. Check the suspension STOP before archive verification or publication. For Claude, apply Loop step 4's collector too. Keep the returned `reply`, normalized result and measured usage/evidence only for the final message. Inspect an uncertain process before proceeding and never relaunch it. The subagent runs `openspec archive <change-name> --yes --json` once and commits the move as `chore(archive): close <change-name>`.
  4. Write no result file and do not call `next`. Archive has no `resultFile`. Write nothing into the moving folder.
  5. Run `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec --path <archivePath>` with the saved action's `archivePath`.
     - First, whatever `archived` says, do the pull request step, to publish the archive commit. On `archived: true` both steps get `--report "<archivePath>/agent-smith/report.md"`, for the moved report. on `archived: false` both use the default report path, `openspec/changes/<change-name>/agent-smith/report.md`.
     - On `archived: true`: print the archive path and the report path inside it. Print one line asking the user to confirm that `git status` is clean, because `verify-archive` reads files only and a failed `chore(archive)` commit leaves the move uncommitted. List nonempty `ignored` paths as "not committed (ignored by git)". Copy the subagent's `note` (`archivedAs` and `path`), its `assumptions` and any usage figure it reported into the final message.
     - On `archived: false`: print `reason` and the subagent's note, which quotes the CLI error (for example `archive_target_exists`), say the folder may be unchanged or archived under another date, and STOP.
- **`halt`**: first follow "Late usage (before every end)".
  Run `cd "<run root>" && node $ROUTER status <change-name> --chain openspec`, then report the halt action's `reason` and status output. A reason that says `needs a human` comes from the subagent, which found no evidence-backed answer, or from the router (a `tasks.md` without task rows, an unreadable `verify.md`, or a verify `FAIL` after the last fix loop). Show the quoted text. Point the user to the router's `report` path (`report.md`) when present. With an `archive` field, say the change was not archived, if `committed: false`, say the archive needs a folder commit first. If `committed: true`, the pre-archive commit remains local. After fixing the cause, `cd "<run root>" && node $ROUTER next <change-name> --chain openspec` repeats checks, except commit-content checking. Ask the user to inspect `git show --stat HEAD`. Without `archive`, omit commit/archive claims. Do not recover autonomously.
  Before you STOP, do the pull request step.

## Anti-stall rules

Rules 1, 2, 3 and 6 hold for every `run` step. Rules 4 and 5 hold for the whole run, also while its `done`, `archive` or `halt` branch is being worked through. Rules 1 and 6 also hold for the archive subagent: when its own final report arrives, continue at step 4 of the `archive` branch. Rules 2 and 3 do not apply to it, because the `archive` action has no result file and no `next` call. A usage figure it reports goes only into the final message. OpenAI execution waits for its existing runner process through the host terminal completion facility, and uses the returned normalized result and measured usage. A run has ended when the orchestrator has finished every step of its `done`, `archive` or `halt` branch.

- **GIVEN** a `run` step **WHEN** the Agent tool returns a launch notice instead of a final report **THEN** the orchestrator **MUST** end its turn and continue the Loop at step 3 when the subagent's final report arrives, without starting another step or polling, while a running OpenAI runner is waited on through its existing process handle until it closes, without relaunching it.
- **GIVEN** the final report of a `run` step holds its `RESULT:` line **WHEN** no usage figure has arrived **THEN** the orchestrator **MUST** write the result file without `usage` and run `next` in the same turn.
- **GIVEN** `next` ran for a `run` step **WHEN** a usage figure for that step arrives later **THEN** the orchestrator **MUST** attach it with one call of the router's `usage` command of its own, never alongside another router call, before the pull request step or the archive subagent starts, instead of rewriting the result file or calling `next` again, and drop a figure that arrives after that point.
- **GIVEN** the run has not ended in `done`, `archive` or `halt` and no STOP instruction of the Start or Loop sections applies (for example the suspension STOP for unresolved native ownership or `archived: false` in the `archive` branch) **WHEN** the orchestrator would end its turn **THEN** it **MUST NOT** end it unless a launched subagent or runner process is still running.
- **GIVEN** a run in this session **WHEN** the user asks what the run is doing **THEN** the orchestrator **MUST** state only what tool output in this session shows, and say so when nothing is running.
- **GIVEN** a hand-back arrives from a subagent the orchestrator did not launch for the current step, that is neither the direct result of the awaited Agent invocation nor a notification matched to that invocation's recorded identity (a known agent id selects its launch and any supplied description must agree; otherwise the exact description must identify one recorded launch uniquely, with no conflict against its known id; associate a newly supplied id when that unique launch has no recorded id), for example one a step subagent started, one from another change, an earlier numbered step or the archive agent, or a superseded invocation even when a neutral retry reuses its description; an ambiguous description-only notification matches no invocation **WHEN** the current step or the archive subagent still waits for its own report **THEN** the orchestrator **MUST NOT** treat that hand-back as a step result: it writes no result file from it, does not call `next` on it, and keeps the step's own report as the only result, which it handles under rules 1 and 4.

## Final report

Use done action fields or archive `summary` for `reason` (the verify verdict) and `steps`. Show model/effort per step and `openspec` task counts from status. Link `report` from the saved terminal action and `verify.md` for the verify report and warnings.

Include Start step 3's branch, worktree, retained-path, cleanup and uncommitted-state diagnostics in every terminal final message. Name side refs for rolled-back or kept steps.

## Late usage (before every end)

A step with recorded usage evidence requires `--usage-file` so the router can verify that the measurement matches the recorded invocation.

Before terminal status and publication, and before archive step 3, collect an already-arrived complete measurement under Loop step 4 once. Only for the same recorded native invocation with missing tokens, create an exclusively owned unique transient run-root file outside the change folder containing `{change,chain,n,step,usage:{totalTokens},usageEvidence}`, then run `cd "<run root>" && node $ROUTER usage <change-name> <n> --usage-file <usage-file> --chain openspec` once, as a call of its own. Include no raw source paths or records in that payload. Unlink the owned payload in a finally step before terminal handoff, including on refusal. Never wait or poll.

Recover `<n>` from the earlier launch matched by rule 6. Confirm its full router `change`, `n` and `step` identity against the recorded description; the printed `Step <n>` line is corroborating context, never a guess from the latest step or a repeated step name. Leave unmatched or ambiguous figures unattached. No verified total or no recorded invocation: omit the call. Recorded numbers remain immutable; only missing tokens can be enriched with identical source/version/invocation evidence. Archive-agent usage belongs only in the final message, including its coverage limitation.

Print `Usage: step <n> <attached|not attached>, <reason or commit>`.

A refusal exits 1 with `attached: false`; it is no fault of yours, so write no `orchestrator-error` result for it, and it never changes the run.

## PR comment (opt-in)

Run only when the terminal router action has `prComment: true`. Keep that action's intent across status and archive verification calls. Legacy or missing intent reads false. A missing field or any other value authorizes no comment. Execute once, in order.

1. Run `cd "<run root>" && node $PR_COMMENT <change-name> --report "openspec/changes/<change-name>/agent-smith/report.md"` from the run root, after the pull request step. In `archive` on `archived: true`, pass `--report "<archivePath>/agent-smith/report.md"` instead. Always pass `--report`, because the script looks under `context/changes/` without it. When the pull request step printed a pull request url (`pr.url`), append `--pr <url>`: the run branch has no upstream config, so the script may not find its pull request by the current branch. Quote the script path, the change name, the url and the report path for the shell. Parse its one JSON object. It posts `report.md` on the selected PR (current branch by default), or edits its earlier comment.
2. Print one line: `PR comment: <action>, <url or reason> (PR <pr url or none>)`, from the `action`, `url`, `reason` and `pr` of that object.

- In `archive` the step runs in step 5, after the pull request step, so after the move.
- A `halt` without a `report` posts nothing: print `PR comment: skipped, no report`.
- If the script exits non-zero or prints no JSON object, print `PR comment: skipped, script error`.
- A skip leaves the run outcome intact. Never retry or write this result into the change folder. Include it only in the final message.

## Pull request (always)

For `done`, `archive` and `halt`, execute once before any STOP, with or without `--pr-comment` (ADR-017). Publication precedes comments. Follow these steps.

1. Run `cd "<run root>" && node $OPEN_PR <change-name> --chain openspec`. In `archive` on `archived: true`, append `--report "<archivePath>/agent-smith/report.md"`. Shell-quote script, change name and report path. It prints one JSON object. With commits beyond base, it commits leftovers as `chore(<change-name>): final run state`, pushes its validated branch without force and opens or updates its PR. It never merges.
2. Use publication `branch`, else saved setup `branch`, else `unavailable` as `<branch>`. Print `Pull request: <action>, <url or reason> (branch <branch>, pushed <true|false>)` from `pr` and `pushed`. For nonempty `swept`, print `Pull request: the final run state commit holds code under chore: <paths>`, using comma-joined paths.
3. For `pushed: false`, print `Pull request: NOT pushed, <reason>. Branch <branch> is local only: <manual>`. On nonzero exit or no JSON object, print `Pull request: NOT pushed, script error. Branch <branch> is local only: run the script by hand from the run root` instead of both lines.
4. Keep `pr.url` and do the PR comment step under "PR comment (opt-in)". Its saved terminal intent applies even when publication skips or fails.

- With `isolation.require: false` and run root `<root>`, the script skips with `run is not isolated`. Include `NOT pushed` in the final message. `os-apply` commits its code itself, but the files of the change folder then stay uncommitted, as the Start section says.
- Never retry or change the run outcome. Put results only in the final message, never in the change folder.

## Rules

- Never choose or change `model` or `effort`. Never edit the prompt the router returns.
- Never skip the router, call two steps without it, or run a step it did not return.
- Never call the router without `--chain openspec`.
- Never edit `openspec/changes/<change-name>/agent-smith/run.jsonl`, `meta.json` or `verify.md` next to them. The router and the verify step own them; after a halt the human may edit `verify.md`. The router's `usage` command is the only way to add a usage figure to a logged step.
- Never run `openspec archive`, `/opsx:archive` or the `openspec-archive-change` skill yourself. Only the subagent of the `archive` action archives, with the CLI.
- After an `archive` action, never run `init`, `next` or `status --report` for that change. Its folder has moved.
- Leave detailed artifact reading and verification to the router.
- Refer routing-change requests to policy. Never hand-tune a run.
- Only `$OPEN_PR` pushes/opens PRs and `$PR_COMMENT` posts comments. Only these scripts call `gh`. Never run `gh` or `git push`, commit, reset or merge yourself. Both scripts' results belong only in the final message.

## Tuning

Routing lives in data, not in this file:

- `${CLAUDE_SKILL_DIR}/../10x-pipeline/policy.json` holds the defaults for both chains. The steps of this chain, `os-propose`, `os-apply`, `os-verify` and `os-archive` under `steps`, and their prompts under `prompts` live in `${CLAUDE_SKILL_DIR}/policy.json`; the router merges the two files into one plugin policy.
- A project can override any key in `context/foundation/agent-smith-policy.json`. The router deep-merges it over the defaults. Arrays such as `ladder` are replaced whole.
- The always-true step rules live in `${CLAUDE_SKILL_DIR}/rules/chain.md` for this chain and in `${CLAUDE_SKILL_DIR}/../10x-pipeline/rules/top.md` for every step (ADR-023); the router reads them by fixed path, and no override reaches them.
- The routing rules of this chain (step order, verdict, fix loop, archive, limits) are in the plugin's `docs/REFERENCE.md`, section `/agent-smith:openspec-pipeline`.
