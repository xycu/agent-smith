# ADR-018: A step subagent starts no subagent; the orchestrator ignores a foreign hand-back

- **Status:** Accepted (implemented by unattended runs), as amended through opt-in native capture. The S-14 closeout carries final host qualification into S-20. [Owner closeout](../../context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) · [Opt-in capture](#amendment-5--opt-in-claude-native-capture)
- **Date:** 2026-11-10
- **Deciders:** the repository owner (the request in `change.md`, 2026-11-09); unattended implementation run of change `no-nested-subagents` for the readings marked A1 to A6 below
- **Origin:** change `no-nested-subagents` (`context/changes/no-nested-subagents/change.md` and `plan.md`); lesson "Never let a subagent spawn its own subagent" in `context/foundation/lessons.md`

## Rule in force

An enclosing step may start one guarded, awaited layer of native children. Leaves inherit the step restrictions and own only their assigned paths. The enclosing step collects every child before verification, Progress updates, commits or reporting. Result intake must match the awaited invocation and wait for descendant settlement. Count a verified total for the step and its descendants once, or report the coverage gap. The flat ban and depth-one setup below record earlier policy. [Shared rules](../../skills/10x-pipeline/rules/top.md) · [Native delegation](#amendment-3--bounded-native-children) · [Observed accounting](../REFERENCE.md#observed-token-accounting)

## Context

- Every pipeline step runs as a subagent of the orchestrator. In Claude Code the hand-back report of a subagent that a subagent started goes to the top session, not to the subagent that started it. The parent ends its turn without the result, and the step fails although the work finished.
- Seen on 2026-11-09 in the `implement` steps of `neutral-orchestrator-retry` and `worktree-pr-only`. `/10x-goal-implement` delegated Phase 1 to a nested subagent and the parent handed back `failed`. The rollback then reset the worktree, and the finished Phase 1 code survived only in the side ref `refs/agent-smith/neutral-orchestrator-retry/82431871c992/failed-4`.
- `/10x-goal-implement` dispatches one subagent per phase and one per gate fix. `/10x-tdd` lists the Agent tool among its tools, and `/10x-e2e` suggests sub-agents for search and analysis. `prompts/research-with-map.md` demanded three parallel subagents.
- The Limits section of `docs/REFERENCE.md` stated that `10x-goal-implement` starts subagents of its own and asked only for a spawn-depth setting, so the plugin relied on nesting.
- The router cannot see what a subagent calls and cannot see who wrote a result file. Only prompt text and the orchestrator skills can act on it.

## Decision

Rules, written as scenarios (the form of ADR-004):

### Subagent side

**GIVEN** a skill, a prompt or its own judgment would have a step subagent delegate work to a subagent, run work in parallel with subagents or use the Agent tool **WHEN** the subagent decides how to do that work **THEN** it **MUST NOT** call the Agent tool or the Task tool or start any other subagent, and does all of that work itself (A1).

**GIVEN** the router returns a prompt **WHEN** it appends `prompts.suffix` **THEN** the prompt **MUST** carry the rule above, so every template, the `os-` templates and the `archive` prompt included, gets it.

Amendment (change `proper-structure-of-rules`): the rule now lives in the always-true file `skills/10x-pipeline/rules/top.md` (ADR-023), which the router appends after `prompts.suffix` to every prompt; the prompt still carries it, and a suffix override no longer removes it.

**GIVEN** a template runs `/10x-goal-implement` (`implement`, `implement-segment`, `implement-retry`) **WHEN** the skill would dispatch a subagent for the code of a phase or for a gate fix **THEN** the template **MUST** tell the subagent to write that code and those fixes itself, for every phase (A1, A3).

**GIVEN** the `implement-tdd` or `implement-e2e` guide runs its skill **WHEN** the skill would hand a search, an analysis, a test or a spec to a subagent **THEN** the guide **MUST** tell the subagent to do that work itself.

**GIVEN** a wired prompt asked for subagents (`research-with-map.md`) **WHEN** the suffix forbids them **THEN** the prompt **MUST** ask for the same work done in the step subagent, one analysis after the other (A4).

### Orchestrator side

Before a Claude call, inspect the exposed Agent schema: set `run_in_background` to `false` only when declared, otherwise omit it. Always supply `description` as `agent-smith <change-id> step <n> <step>` for a numbered step, or `agent-smith <change-id> archive` for archive (OpenSpec uses `<change-name>`). Record the exact description, router change, number and step for each invocation, with any returned agent id.

A known agent id selects its recorded launch and any supplied description must agree. Otherwise the exact description must identify one recorded launch uniquely, with no conflict against its known id; associate a newly supplied id when that unique launch has no recorded id. Keep separate invocation records even when a neutral retry repeats the description. Only the awaited invocation can supply its completion: superseded invocations and ambiguous description-only notifications cannot advance it.

The same identity check governs on-time and late usage. Loop step 4 takes figures only from the current invocation's result or its matched notification. An earlier numbered step's figure follows the late-usage path, even when already present as the current report arrives; unmatched or ambiguous figures remain unattached. Without a matched current figure, omit `usage` and run `next` in the same turn.

**GIVEN** a hand-back arrives that is neither the result of the Agent call the orchestrator made for the current step nor a task notification matched to the awaited invocation's recorded identity **WHEN** the current step or the archive subagent still waits for its own report **THEN** the orchestrator **MUST NOT** treat it as a step result: it writes no result file from it and does not call `next` on it (A2).

**GIVEN** the two orchestrator skills **WHEN** the rule above is added **THEN** it **MUST** be the sixth rule of the `## Anti-stall rules` section, in the same words in both skills, so the sections stay equal.

## Consequences

- A subagent that follows the suffix finishes its own work and hands back its own `RESULT:` line, so a step no longer fails with the work done.
- `/10x-goal-implement` runs every phase in the step's own subagent. Its context grows with the plan; a long plan uses more of the step subagent's context than before.
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` is no longer needed.
- Every prompt changes through the suffix, so a run in flight at upgrade time records `provenance.drift` for `prompts` at its next `next` call. Routing is unchanged.
- Three tests that pinned "exactly five" anti-stall rules now pin six, and `skills/10x-pipeline/test/nested-subagents.test.mjs` pins the new text.

## Alternatives

- Raise `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Rejected: depth is not the fault; the nested report still goes to the top session.
- A router-side check of the result. Rejected: the router cannot see who wrote a result file or what a subagent called.
- Wait for the upstream Claude Code fix. Rejected: runs fail now, and a rollback discards finished work.
- Allow nesting in research steps only. Rejected: the hand-back routing is the same for every step, so no template gets an exception.

## Assumptions (unattended readings, for the owner to confirm)

- A1: the suffix rule is the one that must hold; the implement and executor lines repeat it in the words of the skill that delegates, because a subagent weighs a rule that names its own skill more than a general one.
- A2: the orchestrator rule goes into the anti-stall section as rule 6, because that section already holds the hand-back rules and must stay equal in both skills.
- A3: the `implement` template stays a string, so its rule is a second line of that string.
- A4: `research-with-map.md` is rewritten rather than left to lose against the suffix, because two rules that disagree in one prompt make a subagent guess.
- A5: `refactor-opportunities-research.md` also asks for subagents. It is not wired, so it stays as it is, and `prompts/README.md` says it needs the same rewrite before anyone wires it.
- A6: the commit type of the change is the owner's call; `fix:` fits a change of prompts and docs only.

## Not covered

- What a subagent actually calls: the router cannot read it, so a subagent that ignores the rule can still nest.
- A nested hand-back the orchestrator cannot tell apart from the step's own report.
- The upstream hand-back routing bug in Claude Code, which stays open.
- The skills in `~/.claude/skills/` (`10x-goal-implement`, `10x-tdd`, `10x-e2e`), which are not edited; the prompts override them.

## Amendment 2 — Harness depth cap

**Date** 2026-11-14. Upstream sources reviewed again on 2026-11-14 during implementation.

This amendment supersedes the Context statement that only prompt text and orchestrator skills can act on nesting, the Consequences statement that the depth variable is unnecessary, and the first enforcement-gap item under Not covered. The historical observations and this ADR’s status remain recorded above.

The repository now sets `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to the string `"1"` in `.claude/settings.json`. Claude Code 2.1.217+ supports this positive-integer control. The plugin’s existing minimum of 2.1.292 covers it. Depth counts layers below the main conversation, so the top-level orchestrator can launch a step agent and that agent reaches the cap. Ordinary agents at the cap have Agent withheld. Fork agents retain Agent in the inherited tool list and receive an invocation error at the cap. The same session-level control covers both chains and archive agents. [Environment variables](https://code.claude.com/docs/en/env-vars) · [Subagent nesting](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

This cap applies to all Claude sessions in the configured project, including workflows outside agent-smith. Plugin users choose optional adoption in their own project settings or use `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1 claude` for one session. Merge the entry into existing settings, commit it before creating run worktrees and start a fresh session from the intended project root. Effective settings follow precedence from managed settings through command-line, project-local, shared project and user settings. Inspect `/status` sources and the effective depth value before acceptance. Recovery consists of removing the entry or restoring its prior value and relaunching Claude. [Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)

A scoped agent with `disallowedTools: Agent` is supported. It would also require mapping the remaining dispatch paths and verifying inherited skills, MCP and browser tools. The existing restricted mapping covers score only, and archive has its own dispatch path. The project setting supplies the chosen cap across those paths. An unscoped `PreToolUse` hook on Agent reaches every Agent invocation in the session, including top-level delegation. The depth control preserves that delegation while enforcing the selected layer limit. [Subagent configuration](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)

The always-true prompt rule, executor instructions and orchestrator invocation identity checks remain part of the decision. They tell step agents to finish delegated work themselves and govern which reports advance a run. The older hand-back failures are historical observations. Current upstream documentation says interactive subagents wait for background children. In print mode and the Agent SDK, waiting depends on fork mode. With fork mode disabled, nested background work can outlast its spawning subagent and report to the main conversation. The pipeline continues to require flat delegation. [Subagent execution modes](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

Live acceptance is **unavailable** in this unattended implementation step because its always-true instructions prohibit starting any subagent, including through a child Claude session. The observed CLI version is 2.1.311. Static settings, prompt-delivery and documentation checks are recorded in the change’s acceptance evidence. Manual row 2.4 stays pending until an authorized top-level session records successful top-level delegation, the child’s withheld Agent tool or explicit depth-limit refusal, and an ordinary read with its returned report. A child following the prompt ban alone leaves harness refusal unproved. [Acceptance evidence](../../context/archive/2026-11-12-nested-subagent-hard-stop/evidence/acceptance.md)

## Amendment 3 — Bounded native children

**Date** 2026-11-16. S-14 replaces the flat-delegation decision and depth-one setting above; the historical failures and Amendment 2 evidence remain historical records.

The shared always-true rule permits one awaited child layer below the enclosing step, superseding historical flat-delegation lessons loaded by installed skills. The step forwards identity, run root, bounded write ownership and every applicable restriction. Claude children use `agent-smith:step`; project depth is the string `"2"` in a fresh session. Restricted score tools stay unchanged. Leaves do no further delegation, router/result writes, Progress changes, staging, commits or publication. Parents collect all children, reconcile failures and edits, run gates and make their authorized commits. Invocation matching stays intact; the equal six anti-stall rules recognize the explicit unresolved-execution suspension STOP.

Candidate `c4f7b69` native probes observed Claude Code 2.1.311 headless foreground collection at depth two, Codex CLI 0.169.0 headless collection and desktop native collection. Claude interactive spawning reached a weekly-quota failure. These observations inform activation; they do not qualify the final candidate's twelve normal-entry cells, safety inheritance, usage inclusion or cancellation. [Evidence](../../context/archive/2026-11-16-nested-step-delegation/evidence/capabilities.md)

The Codex runner enables the observed native agent controls. Child-inclusive tokens remain unproved. It omits token totals when collaboration appears; Claude on-time, late and archive usage follows the same verified-inclusion rule. Parent completion, final-file equality, successful process close and lock exclusion remain required for result acceptance.

Saved prompts and dispatch fields remain byte-exact. Before reverting this feature or host settings, settle children and resolve every pending child-enabled dispatch on its enabling revision through completion or router-owned recovery, including neutral retries. If that is unavailable, keep the run pinned and report the recovery prerequisite. Retain logs, evidence and preservation refs. The historical lesson remains for human review; a candidate replacement is “Collect every bounded child before the enclosing step reports, verifies or commits.”

Native ownership is recorded before launch, independently of prompt age or observed collaboration. Settlement requires retained host metadata and process-group closure. A successful enclosing completion or eligible ordinary Codex failure can reach that boundary. Uncertainty suspends result intake, late usage, archive follow-up and publication. Keep unresolved runs pinned to the enabling revision and same TMPDIR. Older readers may ignore additive ownership fields, so downgrade is forbidden until recovery resolves those runs. [ADR-024 ordinary failure settlement](ADR-024-openai-codex-support.md#amendment--ordinary-failures-after-native-settlement)

## Amendment 4 — Observed step-tree token accounting

**Date** 2026-11-18. Change `delegated-token-accounting` supersedes Amendment 3’s blanket omission on collaboration. The earlier probe findings remain historical observations, and settlement/recovery requirements do not change.

The accounting boundary is the enclosing numbered invocation and its attributable descendants. Host collectors replace step-authored usage with a safe observed total plus bounded version-1 evidence, or explicit unavailable evidence. Invocation identity is host-derived. A verified `sessionCount` counts measured contexts (Codex threads or Claude agents), not outer session IDs. Missing does not become zero, and raw source records and paths never enter router state.

Codex 0.169.0 response records are attributed by real thread and causal root session/turn, deduplicated by response, and reconciled against each context’s own final snapshot before summing disjoint contexts. Input plus output is additive; cached input and reasoning are subsets. Only proven invocation-local histories qualify. Claude 2.1.311 optional local native capture requires exact fresh Agent hook identity, transcript/request membership, final assistant UUID and a process-qualified contiguous OTLP event prefix through Agent return. Its uncached input, output, cache-read and cache-creation buckets are additive. Notification totals alone measure the final request and cannot establish complete invocation usage. Incomplete or unsupported provenance remains unavailable without invalidating settled execution. No telemetry configuration, alternate model query or billing endpoint is introduced.

Reports/status expose verified, unavailable and legacy coverage with bounded reasons. Legacy-only comparisons keep their calculation with a warning; any verified/legacy mixture refuses a savings verdict. Model/provider/tier groups describe the enclosing dispatch, and cost is labelled a routing-rate approximation when children may use other models. Archive usage stays outside numbered totals. Structured late enrichment follows ADR-019’s amendment.

All four phases shipped together in v1.14.0 after the Automated producer-to-reader gates passed. Keep one execution revision through settlement and intake. [Release](../../CHANGELOG.md#1140-2026-11-18) There is no ledger migration or backfill. Rollback preserves logs and evidence in normal follow-up commits after settlement; older readers cannot substantiate new/mixed scope. [Capture contract and limits](../REFERENCE.md#observed-token-accounting) · [Fixture and acceptance evidence](../../context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md). Deterministic documented-shape fixtures do not qualify the final interactive/headless host paths; Manual rows 4.3 and 4.4 remain pending.

## Amendment 5 — Opt-in Claude native capture

**Date** 2026-11-22. Change `claude-token-figures-default` keeps ordinary Claude launches off and ships a launcher for one fresh interactive session. It starts a private local receiver and binds projected hooks and accounting events to the Claude process and session. The passive hook has its own registration and joins hook provenance. The safety guards and their mandatory receipts still govern execution and settlement.

Both native Agent loops checkpoint the launcher-bound capture before each dispatch. After settlement the collector uses matched launch evidence, including supported descendants, to prove the whole step tree. It accepts the existing explicit-source descriptor as well. Carry a verified total once. If proof is incomplete, retain the bounded reason and exact observed invocation for eligible late intake under ADR-019. Archive capture remains final-message-only. Default-off native entries carry `capture-disabled` with the launcher command.

The exact 2.1.311 registry entry is supported by the retained headless format and sanitized replay. An authorized native interactive workflow and qualification of a later release remain pending. S-20 still owns the wider host/mode matrix. [Operator setup, cleanup and rollback](../REFERENCE.md#accounting-activation-and-rollback) · [Claude capture acceptance](../../context/changes/claude-token-figures-default/evidence/acceptance.md)

## Amendment 6 — Version floor for Claude capture

**Date** 2026-11-22. Hotfix `claude-capture-version-floor` replaces the exact release list of Amendment 5 with a minimum version, `CLAUDE_CAPTURE_MIN_VERSION` (2.1.311). A public plugin cannot list every Claude Code release, and the exact pin refused every later release. The launcher, the startup binding and the collector now accept a strict `x.y.z` version at or above the floor. Fail-closed handling of unrecognized or conflicting records is unchanged and is what protects the figures from a format change. The live qualification rows of `claude-token-figures-default` stay open.
