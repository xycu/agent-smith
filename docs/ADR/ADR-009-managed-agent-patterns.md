# ADR-009: Record run provenance, opt in to tool-restricted step agents and to an advisor prompt rule, and keep the router a script

- **Status:** Accepted (the repository owner confirmed the unattended readings on 2026-11-08; the live checks and the A/B result below are still pending)
- **Date:** 2026-11-02
- **Deciders:** unattended pipeline run of change `managed-agent-patterns`; the repository owner confirms or changes the readings below
- **Origin:** change `managed-agent-patterns` (`context/changes/managed-agent-patterns/change.md`, `plan.md` and `research.md`). Three patterns from the Managed Agents docs, adapted to a local Claude Code plugin: run provenance, tool-restricted agents and the advisor.

## Context

- `route.mjs` is a dependency-free Node script that uses only `node:` built-ins and makes no network or model call (ADR-006, `AGENTS.md` Hard Rules). Every routing decision is deterministic and tested through the CLI in scratch projects.
- `compare` measures a routed run against a baseline run (ADR-005, ADR-007). Before this change it could not tell why two arms differ: the merged policy, the prompt files and the plugin version were not recorded anywhere a run keeps.
- The orchestrator dispatched every step as `general-purpose`, so the `score` subagent had every tool of the session, although it only reads the repository and writes `complexity.json` (ADR-007).
- Claude Code has a native advisor: a server-side tool configured by the user's `advisorModel` setting, the `--advisor` flag or `/advisor`. Subagents inherit it and apply the same pairing check against their own model. No setting caps or forces its calls, and a plugin cannot turn it on: the plugin manifest `settings` key honors only `agent` and `subagentStatusLine`, and agent frontmatter has no advisor field (`research.md`, Phase 3).
- The advisor pairing rule: the advisor ranks at or above the model of the session or subagent. Claude Code attaches no advisor that ranks below it, with no error.
- Nothing read during research says whether a subagent's reported `totalTokens` includes the advisor's tokens. `compare` sums those figures, so an advisor arm could look cheaper than it is.
- The run was unattended. Every decision here is evidence-backed and was listed as an assumption of the step that took it; the owner read them and confirmed them on 2026-11-08.

## Decision

Three opt-in or record-only features. Provenance is always on and changes no routing. Restricted agents (`agents.restricted`) and the advisor rule (`advisor.enabled`) ship as `false`, so `compare` can measure each on its own.

Rules, written as scenarios (the form of ADR-004):

### The router stays a script

**GIVEN** any of the three features **WHEN** the router decides a step, records provenance or builds a prompt **THEN** it **MUST NOT** make a network or model call, read a user-level settings file or add an npm dependency.

**GIVEN** `policy.json` as shipped **WHEN** a release is cut **THEN** `agents.restricted` and `advisor.enabled` **MUST** stay `false` until their decision rules below say otherwise.

### Run provenance and the compare warnings

**GIVEN** a run with no executed step and no `meta.provenance` **WHEN** `init` runs **THEN** the router **MUST** record `provenance` once: `schemaVersion`, the plugin version, one hash per merged-policy section (`prompts` by resolved text, `agentFiles` for `agents/*.md`) and the flags.

**GIVEN** a stored provenance record **WHEN** `init` resumes the run or `next` runs **THEN** the router **MUST NOT** rewrite it; each `next` adds every section that differs from the record to `provenance.drift`.

**GIVEN** a run whose log already holds executed steps and no record **WHEN** `init` or `next` runs **THEN** the router **MUST NOT** give it a record.

**GIVEN** an input of the record that cannot be read **WHEN** `init` or `next` computes the record **THEN** the router **MUST NOT** halt for it, and it records `null` for that input.

**GIVEN** two sides of a `compare` call **WHEN** their records differ outside the sections the comparison expects to differ, or exactly one side has no record **THEN** `compare` **MUST** add a warning that leaves `comparable`, `reasons`, `dropPercent` and `verdict` unchanged.

### Restricted step agents

**GIVEN** an `agents` block whose `restricted` is not the boolean `true` **WHEN** the router returns a step **THEN** the run output **MUST NOT** carry `agent`.

**GIVEN** `agents.restricted` is `true` and `agents.steps` maps the step to a non-blank string **WHEN** the router returns that step **THEN** it **MUST** add `agent` with that type to the run output and to the log entry.

**GIVEN** a plugin agent definition under `agents/` **WHEN** it is written or changed **THEN** it **MUST NOT** set `model` or `effort`, so the router's model and effort for each call stay in control.

**GIVEN** an agent type that does not resolve **WHEN** the orchestrator dispatches the step **THEN** it **MUST NOT** retry the step as `general-purpose`, and the failure counts as a failed attempt of that step.

### The advisor flag only adds prompt text

**GIVEN** `advisor.enabled` is the boolean `true` and `advisor.templates` names the template of the step **WHEN** the router builds the prompt **THEN** it **MUST** put the advisor rules after the rendered template and before `prompts.suffix`, and log `advisor: true` for that step.

**GIVEN** any other `advisor` block, or a template that the list does not name **WHEN** the router builds the prompt **THEN** it **MUST NOT** add advisor text.

**GIVEN** a step whose prompt carried the advisor rules **WHEN** the step ends **THEN** the router **MUST NOT** check whether a consult happened or cap the consults.

**GIVEN** the advisor prompt file `skills/10x-pipeline/prompts/advisor.md` **WHEN** it is written or changed **THEN** it **MUST NOT** name a model.

### What each feature covers

- Provenance: `meta.provenance` holds `schemaVersion` 1, `plugin`, `sections` and `flags` (`archive`, `chrome`, `score.minRigor`, `agents.restricted`, `advisor.enabled`). `provenance.ignore` (default `compare` and `provenance`) names the sections that are not hashed, so the compare target in the project override changes no hash. `provenance.expected` names the sections a pinned pair (`ladder`, `rigor`, `score`) and an `--unpinned` pair (`score`) are expected to differ in.
- Restricted agents: the shipped map names only `score` (`agent-smith:score`, `agents/score.md`, tools `Read`, `Grep`, `Glob` and `Write`). `Write` cannot be scoped to one path and plugin agents ignore `hooks`, so the prompt rule and the router's check of `complexity.json` are what keep the scorer to that file.
- Advisor: `advisor.templates` ships as `plan`, `implement` and `implement-segment`. Re-plans, `implement-retry`, the tdd and e2e executors, reviews, `fix`, `score` and the pre-plan steps get no advisor text. The flag asks for a consult; the user's `advisorModel` decides whether an advisor exists and which model it is.

## Consequences

- `compare` now says when two arms ran with different policy sections, prompt texts, agent files, plugin versions or flags. It still cannot see a user setting such as `advisorModel`, so both arms of an advisor pair record that setting by hand.
- With both flags at their defaults, every prompt and every run output is byte-identical to the router before this change; only `meta.json` gains `provenance`.
- A restricted `score` step that cannot resolve its agent type fails like any failed scorer: neutral, retried one tier up, skipped after three attempts. The run goes on.
- The advisor arm can only add tokens at an unchanged tier, so its decision rule weighs quality proxies (`steps`, `failedAttempts`) against a token allowance, not a token drop.
- With `advisorModel` set, every subagent of the session that passes the pairing check may consult the advisor, not only `plan` and `implement`. The flag changes what the prompt asks, not what the session allows.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| A nested `Agent` call on a stronger tier as the advisor | rejected | The consultant sees a summary instead of the transcript, every consult adds a subagent start-up, and a consult from inside a `/10x-goal-implement` worker hits the spawn depth limit. It measures "a stronger reviewer with a summary", not the advisor. |
| The router reads `advisorModel` from the settings files and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` from the environment | rejected | It would be the router's first read of a user-level file, and it still could not tell whether a consult happened. Provenance records only what the policy and `meta.json` hold. |
| Restricted agent definitions for `research` and `frame` | not adopted | They need `Write`, `Bash`, `Skill` and `Agent`, so the restriction would remove only `Edit`, `NotebookEdit` and web tools, while a type that does not resolve costs them retries and a halt (they are not advisory like `score`). The policy map makes adding them later a data change. |
| A router-side fallback to `general-purpose` when an agent type does not resolve | rejected | A silent fallback makes a run labelled restricted run unrestricted, and `compare` could not tell. |
| A hook that guards the paths a restricted agent writes | rejected | Plugin agents ignore `hooks`, so a write guard for `complexity.json` cannot be set from the plugin. |
| The Managed Agents advisor (`multiagent.advisor`) | rejected | It needs the Managed Agents API and a `multiagent` agent config, which a local Claude Code plugin does not use. It is the source of the idea only. |

## Live checks

Checks 1 and 2 are done; check P0 is pending. A human runs each check with the plugin installed from the branch and records the result here.

| Check | What it settles | Result |
| --- | --- | --- |
| Live check 1 | With `agents.restricted: true` in a scratch project override, a `standard` run starts the `score` step as `agent-smith:score` and it writes a valid `complexity.json`. If the type does not resolve, record the Agent error text and correct `agents.steps.score`. | Done 2026-11-08 with plugin 0.7.0 from the plugin cache, scratch project, `standard` rigor: the router returned `agent: "agent-smith:score"` for step 1 and logged it; the Agent call resolved the type and the subagent wrote a `complexity.json` the router verified (`ok`, `verified`), then returned `plan`. The Agent tool returned a launch notice, so the call ran in the background. |
| Live check 2 | In that restricted run the subagent cannot call `Bash`, `Edit` or an MCP tool. Record the observed behavior for MCP tools in a foreground subagent; the docs describe only the background case. | Done 2026-11-08, by a probe call of the same agent type: the subagent reported the tools Read, Write, Grep, Glob and the hand-back tool, and no Bash, Edit, ToolSearch or `mcp__*` tool, so it could call none. This is the subagent's own report. The call returned a launch notice, so this is the background case; the foreground case was not observed. |
| Live check P0 | With `advisorModel` set, one `plan` step with `advisor.enabled: true`: did the step consult, and does the Agent result's `totalTokens` include the advisor's tokens? | Pending |

## Decision rules

Fixed before any run. A pair that is not comparable is recorded with its reasons and does not count. Five pairs is a screen, not a significance test. The thresholds are uncalibrated.

### Advisor precondition P0

One live run with `advisorModel` set shows whether the step's reported `totalTokens` includes the advisor's tokens. If it does not, no advisor pair can be read and `advisor.enabled` stays `false`.

### Advisor A/B

Each pair is one change run twice, `advisor.enabled` `false` as the baseline and `true` as the routed side, with the same `advisorModel` and the same Claude Code version on both arms, compared with `compare --unpinned`. The arms alternate which runs first. The default becomes `true` only when all four hold over at least 5 comparable pairs:

1. The sum of `steps` of the advisor arm is below the baseline's.
2. The sum of `failedAttempts` of the advisor arm is at most the baseline's.
3. The median `dropPercent` is -10 or higher, so the advisor arm costs at most 10% more tokens.
4. One A/A pair (`advisor.enabled` `false` on both arms) has an absolute `dropPercent` below 10.

Anything else, including fewer than 5 comparable pairs, leaves the default `false`.

### Restricted agents A/B

The same pairs with `agents.restricted` `false` and `true`, the scorer on in both arms. The default becomes `true` only when, over at least 5 comparable pairs, the restricted arm has no more failed `score` attempts than the baseline in total and no halt, and live checks 1 and 2 passed. No token claim is made: both arms run the same model and effort.

### A/B result

Pending. A human runs the pairs and records here, per pair, `dropPercent`, `steps`, `failedAttempts`, `byModel` and `byTier` of both arms, the failed `score` attempts of the restricted pairs, and the reasons of every pair that is not comparable, then the decision for each flag.
