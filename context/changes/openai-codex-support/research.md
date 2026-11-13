---
date: 2026-11-13T18:38:19+0100
researcher: Claude (claude-opus-5-5, Claude Code)
git_commit: a506d638d72d1c47fd9e25fc8f004faa99953b07
branch: main
repository: agent-smith
topic: "Make the plugin work with the OpenAI model family: Codex CLI as host, and OpenAI steps inside a Claude Code run"
tags: [research, codex, openai, router, policy, skill-md, ladder, usage, plugin-packaging]
status: complete
last_updated: 2026-11-13
last_updated_by: Claude (claude-opus-5-5, Claude Code)
---

# Research: Make the plugin work with the OpenAI model family

**Date**: 2026-11-13T18:38:19+0100
**Researcher**: Claude (claude-opus-5-5, Claude Code)
**Git Commit**: a506d638d72d1c47fd9e25fc8f004faa99953b07
**Branch**: main
**Repository**: agent-smith

## Research Question

`change.md` note: "Refactor the plugin so it will also work OpenAI model family."
The user chose scope **Both** (2026-11-13, in this session):

- **(A) Codex CLI as host.** The pipeline skills run inside OpenAI Codex CLI. Codex is the orchestrator, and steps run on GPT models.
- **(B) Mixed ladder in Claude Code.** Claude Code stays the host, and the router can send some steps to OpenAI models through Codex.

Questions:

1. Where is the plugin coupled to Claude or Claude Code?
2. What does Codex CLI offer today for each coupling?
3. Which recorded decisions constrain the change?

## Summary

- **The router is almost provider-neutral already.**
  - The ladder is data, and validation does not check model names: `state.mjs:136-142` only checks for a non-empty string.
  - Tiers are array indexes, and efforts are ordered only by `rigor.effortOrder` (`steps.mjs:542-621`).
  - The router makes no model or network calls (ADR-006, ADR-007).
  - A grep of `skills/10x-pipeline/scripts/*.mjs` for Claude model names found one hard-coded model, `BASELINE_PIN = { model: "sonnet", effort: "high" }` (`route.mjs:355`). The `compare` command uses it.
- **The coupling sits in the orchestrator skills, the prompt text and the packaging, not in the routing logic.** That means:
  - the two `SKILL.md` files: Agent tool dispatch, `${CLAUDE_SKILL_DIR}`, the Task tools, AskUserQuestion, anti-stall rules built on Claude Code notifications, and usage figures taken from the `<usage>` block;
  - the prompt templates in `policy.json`: `/skill` invocation, Agent/Task tool bans, `mcp__claude-in-chrome__*`;
  - `agents/score.md`, which uses Claude agent frontmatter;
  - `.claude-plugin/`.
- **The effort scales line up.**
  - Claude's scale ships as `["low","medium","high","xhigh","max"]` (`policy.json:72`).
  - Codex's `model_reasoning_effort` accepts `low`, `medium`, `high`, `xhigh`, `max` and `ultra`, and support varies per model (Codex config reference).
  - So all five Claude effort names exist in Codex, and Codex adds `ultra` (and `none` on some models).
- **(B) is the smaller and more reliable path.**
  - A step can run as `codex exec -C <run root> -m <model> -c model_reasoning_effort='"<effort>"' -s workspace-write --json -o <file> "<prompt>"`.
  - That pins the model and effort per step.
  - It needs:
    - a way for a ladder rung to say which provider runs it (today `route.mjs:183` keeps only `model` and `effort` of a rung);
    - prompt text that invokes skills as `$skill` instead of `/skill`;
    - a usage mapping from Codex JSONL to `totalTokens`/`toolUses`/`durationMs`;
    - an answer to the Bash tool's 600000 ms foreground limit.
- **(A) is feasible, with gaps.**
  - Codex loads `SKILL.md` skills from `.agents/skills` (repo) and `~/.agents/skills` (user). It has plugins, a marketplace that reads `.claude-plugin/marketplace.json` as "legacy-compatible", hooks, and subagents (`spawn_agent`/`wait_agent`).
  - Reported problems with in-session subagents:
    - since about 0.144 (`multi_agent_v2`), per-spawn `model` and `reasoning_effort` can be hidden, so a child inherits the parent's model and effort;
    - there is no tool allow-list for custom agents;
    - there is no documented per-subagent token usage;
    - `request_user_input` works only in Plan mode.
  - OpenAI staff point to separate `codex exec` runs for a pinned model and effort. On that advice, (A) also works best when the Codex-hosted orchestrator shells out to `codex exec` per step. That would make (A) and (B) share one step runner.
- **No inspected ADR, PRD entry or change note plans OpenAI, Codex or multi-provider support.** The two near-mentions are ADR-001:6 (a ChatGPT conversation was the source of the idea) and an excluded `gemini-extension.json` (see Historical Context).
  - The ADRs assume Claude Code as the host, and several build on Claude Code specifics (ADR-005, 009, 010, 012, 015, 018, 019).
  - No ADR forbids a second host.
  - ADR-006/007 require every model call to stay outside the router. Both (A) and (B) meet that rule when the orchestrator, not `route.mjs`, runs `codex exec`.

## Detailed Findings

### 1. Router and policy: what is already neutral

- **Ladder.** `skills/10x-pipeline/policy.json:2-11` has 8 rungs: `haiku/low`, then `sonnet` at low, medium and high, then `opus` at medium, high, xhigh and max.
  - A project override replaces the ladder array whole (deep merge with array replace, `state.mjs:37-66`; SKILL.md:134).
- **Validation (ADR-022).** `state.mjs:133-143` requires `model` and `effort` to be non-empty strings, and `effort` to be in `rigor.effortOrder` when that list is usable.
  - There is no model allow-list, so a GPT model id passes validation today.
  - The loop checks only the `model` and `effort` fields. The inspected code (`state.mjs:136-142`) does not reject an extra rung key such as `provider`.
- **Rung to action.** In the `run` action, `route.mjs:183` destructures `{ model, effort }` from `policy.ladder[tier]`, and `route.mjs:250-260` prints `step`, `agent`, `model`, `effort`, `reason`, `prompt` and `resultFile`. An extra rung key does not reach the orchestrator on this path.
  - The same model/effort pair is built at two more places: the neutral rerun (`flow.mjs:387-398`) and the archive action (`isolation.mjs:657-663`, `:697-700`).
- **Effort ordering.** `effortFloorTier` (`steps.mjs:542-550`) and `tierFor` (`steps.mjs:554-633`) compare effort names only by their index in `rigor.effortOrder` (`policy.json:72`), and compare rungs only by index. No model name is compared.
- **Hard-coded Claude names in router code.** In the inspected scripts there is one: `BASELINE_PIN` (`route.mjs:355`). It is used for the `pinned` check (`route.mjs:471`) and printed as "Baseline pinned to sonnet at high effort" (`route.mjs:617`).
  - `baseline-policy.json:2-11` pins all 8 rungs to `sonnet/high` (ADR-005).
- **Prices.** The `prices` table (`policy.json:100`, `null` by default) is keyed by model alias, and `priceTable` (`state.mjs:79-89`) accepts any key.
  - The cost line has no input/output split (`flow.mjs:102`).
- **Restricted agents.** `stepAgent` (`flow.mjs:861-871`) returns a name only when `agents.restricted === true`, and the default is `false` (`policy.json:106-109`).
  - The one mapping is `score` to `"agent-smith:score"`, which is Claude Code's `<plugin>:<agent>` naming.
- **Usage intake.** `cleanUsage` (`flow.mjs:404-412`) keeps `totalTokens`, `toolUses` and `durationMs` when each is a non-negative safe integer. A missing figure is allowed: SKILL.md:60 says "Omit the key when no figure is reported".
- **Co-author.** `policy.json:101` sets the trailer to `Agent Smith <agent-smith@ksycki.pl>`, which is not a Claude name (ADR-021).
  - ADR-021:44 and REFERENCE.md:55 note that commits made inside step subagents carry only the trailer the harness adds. Claude Code adds `Co-Authored-By: Claude`; whether Codex adds a trailer is not known (Open Questions).

### 2. Orchestrator skills: Claude Code coupling

Lines are from `skills/10x-pipeline/SKILL.md`. Per the coupling worker's anchors, `skills/openspec-pipeline/SKILL.md` mirrors them at :10-20, :28-30, :55-58, :66, :68, :77 and :91-98.

- **Frontmatter `allowed-tools`** (:10-18): Agent, AskUserQuestion, Bash, Read, Write, TaskCreate, TaskUpdate, TaskList.
- **`${CLAUDE_SKILL_DIR}`** (:25-27, :133) locates `route.mjs`, `pr-comment.mjs` and `open-pr.mjs`. README.md:30 says it needs Claude Code 2.1.69, and the Agent `effort` parameter needs 2.1.292.
  - The router scripts themselves find the plugin root from their own file location (`isolation.mjs:18`, `state.mjs:8`), not from an environment variable.
- **Agent dispatch** (:58): `subagent_type` (the router's `agent`, else `general-purpose`), `model`, `effort`, `run_in_background: false`, and `prompt` copied verbatim. The archive action uses the same call (:72).
- **RESULT protocol** (:59): the orchestrator reads the last `RESULT:` line of the reply. This is plain text, so a host can produce it from any final message, for example from a `codex exec -o` file.
- **Usage** (:60): figures come from the Agent result or from the task notification's `<usage>` block (`subagent_tokens`, `tool_uses`, `duration_ms`). Late figures go through `route.mjs usage` (ADR-019; :62, :68, :78).
- **Task tools** (:47-50, :66, :75, :80): the `--pr-comment` request is stored only as a task named `PR comment: <change-id>`.
- **AskUserQuestion** (:70): the archive manual gate. With no question tool, the answer counts as no, which is a fail-closed path that already exists ("for example a headless `claude -p` session").
- **Anti-stall rules** (:84-91): launch notices, task notifications and hand-backs from subagents the orchestrator did not launch. All of these are Claude Code behaviours (ADR-015, ADR-018, ADR-019).
- **Worktree path** (:33, :38): `<root>/.claude/worktrees/agent-smith-<change-id>`. Per :33, the path stays under `<root>` because Claude Code resets a `cd` that leaves the project.
  - In the scripts the path appears only in a halt message (`isolation.mjs:264`).

### 3. Prompt templates: Claude Code coupling

- **Skill invocation.** The step prompts in `policy.json:213-345` invoke skills as `/10x-…` or `/openspec-…` (per the coupling worker's read; verified for implement at :224, "Run /10x-goal-implement {id}"). The prompt files also name `/10x-lesson`, `/opsx:continue` and `/opsx:archive` (`prompts/impl-review-lessons.md:8`, `os-apply.md:8`, `os-archive.md:7`). Codex invokes a skill as `$skill-name`, through `/skills`, or implicitly by a match on its description. It does not use `/skill-name` (https://learn.chatgpt.com/docs/build-skills).
- **Common suffix** (`policy.json:212`): "AskUserQuestion is unavailable", the RESULT contract, and delete rules.
  - The bans on the Agent and Task tools (ADR-018) are in the implement templates (`policy.json:224`, `:266`) and in `prompts/executor-retry.md:12`, `executor-tdd.md:18` and `executor-e2e.md:20`.
  - The Codex counterparts would be `request_user_input` and `spawn_agent`.
- **Chrome.** The `manual-verify` template loads `mcp__claude-in-chrome__*` with one ToolSearch `select` and passes `createIfEmpty: true` to `tabs_context_mcp` (`policy.json:315-316`).
  - `--chrome false` picks `manual-verify-nochrome` instead (`steps.mjs:310-311`, `policy.json:323-327`).
- **Advisor.** `prompts/advisor.md`, wired at `policy.json:110-113`, refers to Claude Code's native advisor (REFERENCE.md:328-331). It ships with `enabled: false`.

### 4. The 10x and OpenSpec skills the steps run

- The 10x toolkit skills live in `~/.claude/skills/` on this machine (36 `10x-*` folders). `~/.agents/skills/` holds other skills (caveman, orca-cli, …) and no `10x-*` skill. So a Codex host here does not see the 10x skills until they are installed or symlinked into `~/.agents/skills` or the repo's `.agents/skills`. Codex follows symlinked skill folders.
- **Host-aware skills.** `10x-plan` (`~/.claude/skills/10x-plan/SKILL.md:28-36`) and `10x-research` already map AskUserQuestion to Codex `request_user_input` and say that `codex exec` "is not an interactive question entrypoint".
  - `10x-plan-review`, `10x-impl-review`, `10x-archive`, `10x-frame`, `10x-tdd` and `10x-e2e` contain no "codex" text (grep count 0 each).
- **`10x-goal-implement`** (the `implement` step's skill, `policy.json:15`) is written for Claude Code: `/goal`, `claude -p`, and `--allowedTools "...Agent,Task..."` (`~/.claude/skills/10x-goal-implement/SKILL.md:6-7`, `:37-40`).
  - The pipeline prompt already tells the step to write the code itself and to call no Agent or Task tool (`policy.json:224`).
  - Codex has a `goals` feature (`codex features list`: `goals stable true`). Whether `10x-goal-implement` behaves the same under it was not checked.

### 5. Codex CLI capabilities (as of 2026-11-13)

Versions:

- Installed locally: `codex-cli 0.167.2` (`codex --version`).
- Newest stable: 0.169.0, released 2026-11-13 (https://github.com/openai/codex/releases).

Docs at `developers.openai.com/codex/*` now redirect to `learn.chatgpt.com/docs/*`.

- **Models** (https://learn.chatgpt.com/docs/models): the recommended ids are `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra` (CLI ≥ 0.159.0) and `gpt-6-luna`.
  - The subagents page suggests `gpt-6.1-sol` for demanding work and `gpt-6-luna` for fast, narrow tasks.
  - `gpt-5.4`, `gpt-5.4-mini` and `gpt-5.5` are retired for ChatGPT sign-in (API-key sessions are not affected).
  - Model availability depends on the auth mode.
- **Effort** (https://learn.chatgpt.com/docs/config-file/config-reference): `model_reasoning_effort` takes `low`, `medium`, `high`, `xhigh`, `max` or `ultra`.
  - `ultra` is Codex-only: max effort plus proactive fan-out to subagents. `gpt-6-luna` goes up to `max`.
  - `none` works on Terra and Luna. `minimal` is legacy.
  - Set the effort with `-c model_reasoning_effort='"high"'`; set the model with `-m`.
- **`codex exec`** (local `codex exec --help`, 0.167.2): `-m`, `-c`, `-p` (a profile file `$CODEX_HOME/<name>.config.toml`), `-s read-only|workspace-write|danger-full-access`, `--approve-for-me`, `-C/--cd`, `--add-dir`, `--worktree`, `--skip-git-repo-check`, `--ephemeral`, `--ignore-user-config`, `--output-schema`, `--json` and `-o/--output-last-message`. Its subcommands include `resume`, `fork` and `review`.
  - The local 0.167.2 `exec --help` has no `--full-auto`, `--yolo`, `-a` or `--trust` flag.
  - The web worker reports that 0.169.0 adds `--trust`, and that exec in 0.169.0 turns off project config and MCP servers in untrusted directories (https://learn.chatgpt.com/docs/changelog). That was not checked locally.
- **JSONL events** (https://raw.githubusercontent.com/openai/codex/main/codex-rs/exec/src/exec_events.rs): `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*` and `error`.
  - `turn.completed.usage` has `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens` and `reasoning_output_tokens`.
  - There is no tool-use count or duration field. A runner would count the `item.completed` events and time the run itself.
  - Whether usage is per turn or cumulative was not confirmed: the source and a third-party cheatsheet disagree.
- **Skills** (https://learn.chatgpt.com/docs/build-skills): skills are `SKILL.md` folders in `.agents/skills` (from the cwd up to the repo root), `~/.agents/skills` or `/etc/codex/skills`.
  - The documented frontmatter is `name` and `description`; `allowed-tools` and `argument-hint` are not documented.
  - A skill may bundle `scripts/`, `references/` and `assets/`.
  - No `${CLAUDE_SKILL_DIR}` counterpart for skill content was found.
- **Plugins** (https://developers.openai.com/plugins/build/plugins; `codex plugin --help` locally: `add`, `list`, `marketplace`, `remove`):
  - The manifest is a root `plugin.json` (with `extensions.com.openai`) or `.codex-plugin/plugin.json`. Skills are discovered from `skills/`, hooks from `hooks/hooks.json`, MCP from `mcp.json`.
  - Marketplace files: `.agents/plugins/marketplace.json`; `.claude-plugin/marketplace.json` is read as "legacy-compatible".
  - **No `agents` plugin component is documented.** OpenAI's Claude-plugin conversion guide says Claude `agents/` and `commands/` must become skills (https://developers.openai.com/plugins/guides/submit-claude-plugin.md).
  - Third-party repos ship `.claude-plugin/` and `.codex-plugin/` side by side (https://dev.classmethod.jp/articles/publish-claude-code-plugin-to-codex/).
- **Subagents** (https://learn.chatgpt.com/docs/agent-configuration/subagents): the tools are `spawn_agent`, `send_input`, `resume_agent`, `wait_agent` and `close_agent`. Locally `multi_agent` is stable and on, and `multi_agent_v2` is stable and off.
  - Custom agents are TOML files in `.codex/agents/` or `~/.codex/agents/`, with `name`, `description`, `developer_instructions` and optional `model` and `model_reasoning_effort`.
  - There is no tool allow-list, only feature toggles. Sandbox and approval settings are inherited from the parent.
  - Community reports since about 0.144 (`multi_agent_v2`) say the spawn schema hides `model` and `reasoning_effort`, so children inherit the parent's. OpenAI staff (2026-10-11) suggested separate `codex exec` runs instead (https://community.openai.com/t/codex-cli-can-no-longer-spawn-subagents-with-specific-models-or-reasoning/1386290).
  - No per-subagent token usage is documented.
- **Questions to the user:** `request_user_input` works in Plan mode only. The under-development flag `default_mode_request_user_input` is off locally, and the tool is not usable in `codex exec`. This matches the existing fail-closed manual gate (SKILL.md:70).
- **AGENTS.md** is native. Codex does not read `CLAUDE.md` without `project_doc_fallback_filenames` (https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- **Hooks** are close to Claude Code's (PreToolUse, Stop, SubagentStart/Stop, …) and must be trusted before they run. This plugin ships no hooks.
- **Browser:** the Chrome extension is documented for the Codex app, not for the CLI (https://developers.openai.com/codex/app/chrome-extension). On a Codex host, `--chrome false` (the `manual-verify-nochrome` template) is the existing safe path.
- **Prior art for (B):** `openai/codex-plugin-cc`, a Claude Code plugin that wraps `codex app-server`, with `/codex:rescue --model --effort --background` and a `codex:codex-rescue` subagent (https://github.com/openai/codex-plugin-cc).

### 6. Running a Codex step from Claude Code (path B): host limits

- **Time limit.** In this session's harness, the Bash tool's foreground timeout is at most 600000 ms (Bash tool description). `run_in_background: true` runs a command detached and notifies on exit.
  - A step longer than 10 minutes therefore needs either a background Bash run or a Claude subagent that runs and waits on `codex exec`. The second option adds Claude tokens per step and is a design choice.
  - There is a related open change: `context/changes/router-bash-timeout`.
- **Usage.** With `--json`, usage comes from `turn.completed` events, not from a Claude `<usage>` block. `totalTokens` needs a stated formula (for example input plus output, with or without cached input), and `toolUses` and `durationMs` have to be measured by the runner.
- **Unverified on this machine:**
  - the Claude Code sandbox's effect on `codex exec`: network access to the OpenAI API, and writes to `~/.codex` unless `--ephemeral` is used;
  - nesting Codex's own sandbox inside it.

## Code References

- `skills/10x-pipeline/policy.json:2-11`: the 8-rung Claude ladder.
- `skills/10x-pipeline/policy.json:72`: `rigor.effortOrder` `["low","medium","high","xhigh","max"]`.
- `skills/10x-pipeline/policy.json:100-109`: `prices`, `coAuthor`, `provenance`, `agents` (`"agent-smith:score"`).
- `skills/10x-pipeline/policy.json:212`: the common prompt suffix ("AskUserQuestion is unavailable").
- `skills/10x-pipeline/policy.json:224`: the implement template ("Run /10x-goal-implement {id}", "call no Agent or Task tool").
- `skills/10x-pipeline/policy.json:315-316`: `mcp__claude-in-chrome__*` and the ToolSearch rules in `manual-verify`.
- `skills/10x-pipeline/scripts/state.mjs:133-143`: ladder validation (strings, effort in `effortOrder`).
- `skills/10x-pipeline/scripts/route.mjs:183`: `const { model, effort } = policy.ladder[tier];`
- `skills/10x-pipeline/scripts/route.mjs:250-260`: the fields of the `run` action.
- `skills/10x-pipeline/scripts/route.mjs:355`: `BASELINE_PIN = { model: "sonnet", effort: "high" }`.
- `skills/10x-pipeline/scripts/flow.mjs:404-412`: `cleanUsage`.
- `skills/10x-pipeline/scripts/flow.mjs:861-871`: `stepAgent`.
- `skills/10x-pipeline/scripts/steps.mjs:542-633`: `effortFloorTier` and `tierFor`, which order by index only.
- `skills/10x-pipeline/SKILL.md:10-18`: the `allowed-tools` frontmatter.
- `skills/10x-pipeline/SKILL.md:25-27`: `${CLAUDE_SKILL_DIR}`.
- `skills/10x-pipeline/SKILL.md:58-60`: Agent dispatch, RESULT parsing, usage intake.
- `skills/10x-pipeline/SKILL.md:84-91`: the anti-stall rules.
- `agents/score.md:1-7`: Claude agent frontmatter (`tools: Read, Grep, Glob, Write`).
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: packaging. Their versions are read by `isolation.mjs:65` and `tools/version-check.mjs:3-4`.
- Tests with model names (grep line counts, not assertions):
  - 193 lines in 20 files under `skills/10x-pipeline/test/`. The largest are `ladder.test.mjs` (71), `cost.test.mjs` (48) and `compare.test.mjs` (38).
  - Claude Code strings: 73 lines in 21 files, for example `agents.test.mjs:28` (`SCORE_AGENT = "agent-smith:score"`) and `:263-276` (the score.md key set).
  - `agents.test.mjs:350-366` derives the banned model names from the ladder rather than hard-coding them.

## Architecture Insights

- The JSON contract between the router and the orchestrator (an action out, `last-result.json` in) is the seam between them. A second host means a second orchestrator, or a host-neutral one, around the same router.
- The router is already a pure function of disk state plus policy. Host-specific behaviour enters at only two places:
  - which fields of a rung reach the action (today `model` and `effort`);
  - the prompt text the router renders.
- Two existing degradation paths already fit a Codex host:
  - the manual gate's "no question tool" means no (SKILL.md:70);
  - `--chrome false` picks the `manual-verify-nochrome` template.
- Ordering by index means a mixed ladder (Claude and GPT rungs in one array) works without router logic changes. Mixing providers on one ladder does make the tier math compare costs across providers, which no ADR has assessed.

## Historical Context (from prior changes)

- ADR-001:10 and :39-40: the goal is to cut the Claude weekly usage limit, with a Sonnet/high baseline and one ladder. This is Claude-only.
- ADR-005:19-46 and `route.mjs:355`: the baseline pin is sonnet/high, and usage comes from the Agent completion notice. This is Claude-only.
- ADR-006 and ADR-007:21, :51, :98-100: the router never calls a model. A model call in the router "MUST be rejected under ADR-006 unless a later ADR supersedes". This holds for both A and B only if the orchestrator runs `codex exec`, not `route.mjs`.
- ADR-009:13-14 and :44-50: a restricted agent is a Claude Code `subagent_type`, and a type that does not resolve gets no fallback.
- ADR-010:13-15 and :70: tiers are positions, so inserting a rung renumbers the ladder. `isolation: "worktree"` was rejected, and the worktree lives under `.claude/worktrees/`.
- ADR-012: `manual-verify` uses Claude in Chrome through ToolSearch.
- ADR-015:66-79: a model alias the host rejects becomes `unknown`, then retries and escalates. `ladder-fable-rung/change.md:24` makes the same point. The same failure mode would apply to an unknown GPT id.
- ADR-018: no nested subagents, justified by a Claude Code hand-back bug.
- ADR-019: late usage figures come from Claude Code task notifications.
- ADR-021:44: commits inside a step keep only the harness's own trailer.
- ADR-022:24 and :61: no model allow-list; effort must be in `rigor.effortOrder`.
- `context/foundation/prd.md:7`, `:22` and `:27` call the product a Claude Code plugin. The "a dep for other models" item (`prd.md:148`, `roadmap.md:252`) was resolved 2026-10-31 as "other projects install the plugin", not as other model families.
- The archived release-packaging change considered and excluded a `gemini-extension.json` (`context/archive/2026-11-02-release-packaging/research.md:34`, `:40`).
- Open changes this one interacts with. Each has only a `change.md`:
  - `ladder-fable-rung`: append rungs, keep them behind an off-by-default key, and later address rungs by name.
  - `agent-call-parameters`: the actual Agent tool parameters; `run_in_background` does not exist on it.
  - `pr-comment-flag-in-meta`: would move `--pr-comment` out of the Task tools.
  - `router-bash-timeout`.
  - `skill-dir-variable`.
  - `nested-subagent-hard-stop`.
  - `step-prompt-by-file`.

## Related Research

- Not applicable. No earlier research artifact covers non-Claude models or Codex.

## Open Questions

1. **Product: the shape of the mixed ladder.** Options:
   - one ladder with a per-rung provider key (index ordering then mixes providers);
   - a ladder per provider chosen per run or per project;
   - provider choice per step.

   ADR-001's goal (cut the Claude weekly limit) suggests GPT rungs could offload cheap or expensive steps, but no ADR assesses this.
2. **Product: is (A) a separate Codex skill or one host-neutral `SKILL.md`?** `SKILL.md` must not name models beyond what it documents (AGENTS.md hard rule). Codex ignores `allowed-tools` and has no `${CLAUDE_SKILL_DIR}`.
3. **Unverified Codex facts (verify against 0.169.0 before designing):**
   - `--json` usage: per turn or cumulative;
   - exit codes;
   - `--trust` and project config in a new worktree;
   - whether `request_user_input` stays Plan-only;
   - whether `spawn_agent` honours `model`/`reasoning_effort` with `multi_agent_v2` off (it is off locally);
   - `agents.max_depth`;
   - whether Codex installs this plugin from `.claude-plugin/` alone;
   - whether Codex adds a co-author trailer to commits.
4. **Unverified host interaction:** `codex exec` inside the Claude Code sandbox (network, `~/.codex` writes), and a step that runs longer than the 600000 ms Bash limit.
5. **10x toolkit on Codex:** `10x-goal-implement` targets Claude's `/goal` and `claude -p`, and six other step skills name no Codex behaviour. A live Codex run of each step skill is needed before claiming support.
6. **Tests:** 193 model-name lines and 73 Claude Code string lines in the suite. A plan must decide which stay Claude-specific fixtures and which become provider-parametrised.
