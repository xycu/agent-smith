---
date: 2026-11-16T00:42:08+01:00
researcher: Codex
git_commit: f3835683c421f798c3dce874690f90c61db0d4dc
branch: detached HEAD
repository: agent-smith
topic: "Pipeline steps delegating to child subagents"
tags: [research, codebase, delegation, claude, codex, recovery]
status: partial
last_updated: 2026-11-16
last_updated_by: Codex
last_updated_note: "Mapped current restrictions and preservation contracts. Live nested-host evidence remains outstanding."
---

# Nested step delegation research

## Research question and scope

What currently prevents a pipeline step from delegating to children, which completion and safety contracts must survive enabling delegation, and what host evidence is missing? The change record supplies its identity. S-14 and Wave 0 supply the intended behavior and both-chain coverage. This investigation uses that scope because the change's Notes contain a placeholder. [Change identity](change.md), [S-14](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents), [Wave 0](../../changes/WAVES.md#wave-0-child-subagents-alone)

The owner's instruction in this chat says, “You don't have to benchmark performance, this will be measured later.” Performance benchmarking is deferred for this change's handoff, superseding the comparative measurement work in the cited roadmap and wave records. Functional completion, recovery, attribution and effective safety remain in scope. [Recorded measurement scope](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)

## Summary

- The delivered path deliberately prevents delegation through a shared prompt rule, repeated executor instructions, Claude's project depth cap and Codex runner arguments. Enabling native child work reaches those owners together. [Shared rule, line 14](../../../skills/10x-pipeline/rules/top.md), [policy, lines 222 and 261](../../../skills/10x-pipeline/policy.json), [Claude settings, line 3](../../../.claude/settings.json), [runner, line 127](../../../skills/10x-pipeline/scripts/run-codex.mjs)
- Parent-report attribution already exists in the orchestrator instructions. Router result intake trusts the supplied result file and verifies step artifacts, so the orchestration boundary remains consequential when children are introduced. [10x skill, line 125](../../../skills/10x-pipeline/SKILL.md), [OpenSpec skill, line 130](../../../skills/openspec-pipeline/SKILL.md), [result intake, line 550](../../../skills/10x-pipeline/scripts/flow.mjs)
- Current upstream documentation describes Claude nested execution and Codex agent orchestration and permission inheritance, with mode-specific Claude waiting behavior. This checkout's installed-host nested execution, JSONL behavior and safety inheritance remain unverified. The research is partial on that capability evidence. [Claude nesting](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

## Detailed findings

### Delegation restrictions and instruction delivery

The shared `top.md` rule forbids Agent, Task, `spawn_agent` and other delegation. Its precedence rule places generic always-true rules above chain and step rules. `ruleTail()` appends the shared rules after chain defaults, the suffix and applicable rule files. A project policy override therefore leaves the delivered shared prohibition in the assembled prompt. This path supplies the 10x and OpenSpec chains. [Shared rules, lines 14–16](../../../skills/10x-pipeline/rules/top.md), [rule assembly, line 936](../../../skills/10x-pipeline/scripts/flow.mjs)

The `implement` and `implement-segment` templates separately require self-execution when `/10x-goal-implement` would delegate. Retry, TDD and E2E guides repeat that restriction. The wired mapped-research prompt requests sequential e2e-trace, test-gap and blast-radius analyses. Those instructions are additional owners of the delivered behavior. [Policy, lines 222 and 261](../../../skills/10x-pipeline/policy.json), [retry guide, line 14](../../../skills/10x-pipeline/prompts/executor-retry.md), [TDD guide, line 20](../../../skills/10x-pipeline/prompts/executor-tdd.md), [E2E guide, line 22](../../../skills/10x-pipeline/prompts/executor-e2e.md), [research guide, line 7](../../../skills/10x-pipeline/prompts/research-with-map.md)

The installed implementation skill already has a parent/child division. It delegates phase coding and focused gate fixes. Its invoking agent collects the returned touched paths and uncertainties, runs gates, reconciles Git status, commits and updates Progress. Coding-child instructions forbid staging, commits and Progress changes. In a pipeline invocation, that invoking agent is the implementation step. These existing ownership boundaries can inform the new delegation contract. This is machine-local toolkit evidence outside this repository's revision. [Installed implementation skill, lines 84–115](/Users/blazej/.agents/skills/10x-goal-implement/SKILL.md:84), [gate fixes, line 138](/Users/blazej/.agents/skills/10x-goal-implement/SKILL.md:138)

That installed skill also loads and forwards foundation lessons. The current lesson requires flat delegation. A revised pipeline contract must resolve this conflicting instruction explicitly when enabling children. [Installed lesson handling, line 58](/Users/blazej/.agents/skills/10x-goal-implement/SKILL.md:58), [historical lesson, line 19](../../foundation/lessons.md)

### Host controls and documented execution modes

This checkout sets Claude's maximum subagent depth to the string `"1"`. The runner supplies `agents.enabled=false` and `--disable multi_agent_v2` to Codex execution and its permission preflight. The argument tests pin those flags for the inspected 10x/OpenSpec cases. [.claude/settings.json, line 3](../../../.claude/settings.json), [configArgs, line 127](../../../skills/10x-pipeline/scripts/run-codex.mjs), [argument assertions, line 53](../../../skills/10x-pipeline/test/codex-runner.test.mjs)

Claude's current nesting documentation describes the spawning subagent waiting in interactive sessions. For `claude -p` and Agent SDK execution, waiting depends on fork mode. With fork mode disabled, a background child can outlast its parent and report to the main conversation. The documented depth control can permit another child layer. These statements support a mode-specific capability investigation. Effective settings and waiting behavior require evidence from the selected installed configuration. [Claude nesting](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

Current Codex documentation lists `agents.enabled`, orchestration/waiting tools and inheritance of parent sandbox and approval settings. It says approval-dependent actions fail back to the parent workflow when a non-interactive run cannot obtain approval. The inspected documentation does not settle this runner's native-child JSONL schema, usage aggregation or process-exit behavior for the installed CLI. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

Local version commands returned Node `v24.19.0`, Codex CLI `0.169.0` and Claude Code `2.1.311`. Codex printed a PATH-alias creation warning and returned its version successfully. These are executable-version observations from this research session. The runner ADR records Codex `0.169.0` as its verified CLI contract. Effective account access, fresh-session discovery and delegation support have no new live acceptance evidence here. [Recorded CLI contract, line 28](../../../docs/ADR/ADR-024-openai-codex-support.md)

### Completion, result identity and usage

The Claude dispatch instructions record each invocation's change, step number, step name, description and returned agent ID. The shared sixth anti-stall rule rejects child, foreign, earlier, archive, superseded and ambiguous notifications as the awaited step's result. Usage uses the same identity matching, with a separate late-usage path for an earlier numbered step. These instructions are compatible with a spawning step collecting its children and returning its own final report. [10x dispatch, lines 58–64](../../../skills/10x-pipeline/SKILL.md), [10x anti-stall, line 125](../../../skills/10x-pipeline/SKILL.md), [OpenSpec anti-stall, line 130](../../../skills/openspec-pipeline/SKILL.md)

`attachResult()` reads `last-result.json` into the last executed pending entry, checks step-specific artifacts, records verification/usage and persists the log before removing the input file. This inspected intake path has no child-sender authentication. The orchestrator's choice of the enclosing result remains part of the trust boundary. [Result intake, line 550](../../../skills/10x-pipeline/scripts/flow.mjs), [persistence, line 620](../../../skills/10x-pipeline/scripts/flow.mjs)

The OpenAI runner validates the pending dispatch and prompt bytes before launch and rechecks after permission preflight. Its JSONL parser takes the latest terminal turn event, latest completed-turn usage and last completed `agent_message`, without a thread-ID filter in this inspected parser. Acceptance also requires process close, a successful exit, a final completed turn and equality between the final-message file and the parsed assistant message. Enabled-delegation event evidence is needed to decide whether child events require additional filtering. [Dispatch validation, line 25](../../../skills/10x-pipeline/scripts/run-codex.mjs), [revalidation, line 244](../../../skills/10x-pipeline/scripts/run-codex.mjs), [event parser, line 254](../../../skills/10x-pipeline/scripts/run-codex.mjs), [completion checks, line 278](../../../skills/10x-pipeline/scripts/run-codex.mjs)

For a valid completed-turn usage snapshot with both counters present, the runner stores `input_tokens + output_tokens` as `totalTokens` and replaces model-authored usage with measured usage. Whether that snapshot includes native children remains unresolved. Child usage should be classified from observed host semantics before aggregation is chosen. [Token calculation, line 143](../../../skills/10x-pipeline/scripts/run-codex.mjs), [normalized result, line 294](../../../skills/10x-pipeline/scripts/run-codex.mjs)

### Recovery and inherited restrictions

On POSIX the runner launches Codex in a detached process group, records child ownership in the run lock and signals the group on cancellation. Its launch promise resolves on `close`. The shared lock refuses mutations while a recorded process group remains alive or its termination is uncertain. This already protects descendants that remain within that group. Native agent lifetime outside that group remains an evidence gap. [Process handling, line 163](../../../skills/10x-pipeline/scripts/run-codex.mjs), [run lock, line 978](../../../skills/10x-pipeline/scripts/state.mjs)

The router consumes results before step commit/rollback and preserves a neutral retry's stored prompt and dispatch. The existing flat-run fixtures cover post-publication result recovery, failed-step preservation in side refs, exact retry and runner-crash exclusion for the inspected 10x/OpenSpec cases. These are preservation gates for child-enabled execution. Their fake Codex process does not establish native-child waiting or interruption behavior. [Router ordering, line 96](../../../skills/10x-pipeline/scripts/route.mjs), [neutral retry, line 404](../../../skills/10x-pipeline/scripts/flow.mjs), [result recovery cases, line 143](../../../skills/10x-pipeline/test/result-persist.test.mjs), [rollback cases, line 92](../../../skills/10x-pipeline/test/codex-chain.test.mjs), [crash cases, line 143](../../../skills/10x-pipeline/test/run-lock.test.mjs), [fake CLI, line 36](../../../skills/10x-pipeline/test/codex-helpers.mjs)

Shared prompt restrictions cover preservation of working-copy and staged-only content, router-owned state/recovery, protected Git history and orchestrator-owned publication. The Claude Bash guard selects events with `agent_type === "agent-smith:step"` and an `agent_id`. Its tests deliberately permit unrelated agent types, including `general-purpose`. A generic child's effective restriction inheritance therefore needs explicit proof. Broadening this guard requires preserving its orchestrator boundary. [Safety rules, lines 7–12](../../../skills/10x-pipeline/rules/top.md), [guard selector, line 121](../../../skills/10x-pipeline/scripts/step-guard.mjs), [pass-through cases, line 117](../../../skills/10x-pipeline/test/step-guard.test.mjs)

The score agent declares `Read, Grep, Glob, Write`. Its current tool list supplies no Agent capability. Child delegation must preserve this restricted scoring contract and applicable manual-verification/archive restrictions. When its sandbox probe succeeds, permission preflight verifies filesystem/Git capability in its fixture. Model-command enforcement and native-child permission inheritance remain separate live questions. [Score tools, line 4](../../../agents/score.md), [commit restriction inheritance, line 12](../../../skills/10x-pipeline/rules/top.md), [preflight implementation, line 90](../../../skills/10x-pipeline/scripts/run-codex.mjs), [preflight limitations, line 28](../../../docs/ADR/ADR-024-openai-codex-support.md)

## Historical context and contradictions

- ADR-018 records lost nested hand-backs in the named historical implementation runs and a recovery side ref. This research supports that the ADR records those failures. Current-host reproduction remains unverified. [Historical observations, lines 10–11](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- The original claim that prompt/orchestrator text supplies the enforcement mechanism is superseded by Amendment 2's depth-cap decision. The old statement that the depth variable is unnecessary is also superseded. The amendment's documented interactive/headless distinction is consistent with the upstream page refreshed during this research. [Amendment 2, lines 81–89](../../../docs/ADR/ADR-018-no-nested-subagents.md), [upstream nesting](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)
- The existing no-nesting lesson describes the delivered policy. S-14 supplies the owner's changed target and asks for capability evidence. The lesson's broad historical explanation should not become an assumption that the current mode-specific host behavior has been reproduced. [Lesson, line 19](../../foundation/lessons.md), [S-14 scope](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)

## Planning handoff

The mapped ownership spans shared rules, implement/executor/research prompts, Claude depth settings, Codex `configArgs()`, both orchestrator skills and relevant identity/safety behavior. The result and recovery machinery supplies existing preservation contracts. New runtime changes depend on observed child-enabled event and lifetime behavior. [Wave 0 ownership](../../changes/WAVES.md#wave-0-child-subagents-alone), [runner parser, line 254](../../../skills/10x-pipeline/scripts/run-codex.mjs), [result intake, line 550](../../../skills/10x-pipeline/scripts/flow.mjs)

The affected regression contracts include `nested-subagents.test.mjs` for the current ban/depth assertions and parent-notification protection, `skill-loop.test.mjs` for shared loop identity, `codex-runner.test.mjs` for flags and result parsing, `step-guard.test.mjs` for identity-scoped safety, and the recovery/chain cases cited above. Existing test text requires revision where it pins the replaced restriction. Parent identity, archive handling and recovery remain preservation obligations. [Nesting assertions, line 40](../../../skills/10x-pipeline/test/nested-subagents.test.mjs), [identity assertions, line 126](../../../skills/10x-pipeline/test/nested-subagents.test.mjs), [depth assertions, line 155](../../../skills/10x-pipeline/test/nested-subagents.test.mjs), [loop tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs), [runner assertions, line 33](../../../skills/10x-pipeline/test/codex-runner.test.mjs)

The current behavior is also described in README's depth setup, the reference Limits section, ADR-018 and the prompt/rule/test indexes. A changed delegation contract reaches those descriptions. The unwired refactor-research prompt remains outside the wired mapped-research path. [README, line 119](../../../README.md), [reference, line 476](../../../docs/REFERENCE.md), [prompt index, lines 3 and 40](../../../skills/10x-pipeline/prompts/README.md), [rule index, line 22](../../../skills/10x-pipeline/rules/README.md), [test index, line 91](../../../skills/10x-pipeline/test/README.md)

### Open questions requiring evidence

- Which effective Claude fork/depth settings and Codex agent settings allow a spawning step to collect children before returning through each applicable host/provider/chain configuration, in interactive and headless launches?
- Does child-enabled Codex JSONL include child messages or terminal events in the enclosing stream? Does completed-turn usage include children? How does cancellation terminate native children?
- Do child tool permissions and semantic task restrictions preserve the step's guard identity, publication boundary, restricted scorer and read-only verification contracts?
- Do child failure, interrupted parent execution, resume, late completion and superseded reports preserve pending-step identity and recoverable edits through normal chain entry points?

These questions follow S-14's functional acceptance. Planning can use this map, with capability evidence preceding the dependent implementation choices. Performance benchmarking remains deferred by the owner's instruction. [S-14 acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)

## Investigation coverage and validation

Codex synthesized parallel read-only Claude-contract and OpenAI-runner investigations, inspected decisive intake/guard/toolkit paths, and refreshed the linked upstream documentation. The source map uses the recorded checkout revision and local file/line references. The working checkout was detached at that revision. The installed toolkit references describe this machine's observed files.

Runtime tests and live nested-host acceptance were not run during this source investigation. Existing tests were read for their contracts. No performance comparison was performed. The unresolved host evidence above is the reason for `status: partial`.

## Related research

The production-readiness assessment supplies broader acceptance context. Its ordering discussion predates Wave 0, whose current sequencing is recorded separately. [Assessment](../2026-11-15-production-readiness-assessment/research.md), [current Wave 0](../../changes/WAVES.md#wave-0-child-subagents-alone)
