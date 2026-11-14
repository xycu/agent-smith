# Agent Call Parameters Implementation Plan

## Overview

Make both pipeline skills describe Claude Agent calls that fit the host's exposed parameter schema. Give every step and archive agent the fixed description specified in the change request, then use that identity to correlate completion and late usage notifications. OpenAI actions continue through the shared Codex runner.

## Current State Analysis

Both skills' Loop step 2 requires a Claude host for Claude actions, forwards the router's agent type, model, effort and exact prompt, and unconditionally supplies `run_in_background: false`. It supplies no `description`. The change request records a Claude Code 2.1.311 schema that requires `description` and rejects `run_in_background`. That report establishes the compatibility requirement. This planning session has no exposed Claude Agent tool for independently repeating that observation. [10x skill](../../../skills/10x-pipeline/SKILL.md#loop), [OpenSpec skill](../../../skills/openspec-pipeline/SKILL.md#loop), [change request](change.md)

The router's ordinary and neutral-retry actions already provide `change`, `n` and `step`. A neutral retry retains the same step number. Archive actions have their own lifecycle, and the skills' archive step 3 reuses the parameters described in Loop step 2. Archive has no result file or numbered usage entry. These contracts provide all inputs needed to construct descriptions in the orchestrator. [ordinary dispatch](../../../skills/10x-pipeline/scripts/route.mjs#L268), [neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs#L355), [archive lifecycle](../../../skills/10x-pipeline/SKILL.md#loop)

Anti-stall rule 1 currently qualifies launch notices with the background flag. Rule 6 accepts a report through its own Agent call or a notification naming the agent id or an incidental description. The `done`, `archive` and `halt` late-usage paragraphs recover the number through the previously printed `Step <n>` line. The router accepts a wrong existing number when its usage is empty, making correlation an orchestrator responsibility. [anti-stall rules](../../../skills/10x-pipeline/SKILL.md#anti-stall-rules), [usage guards](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)

The existing tests pin six anti-stall rules, equality between the skills, router-selected agent types and the terminal usage cutoffs. Both skill-content test files passed during planning, with 30 tests passing and zero skips on Node v26.13.1. This baseline covers the current content contracts. [10x tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs), [OpenSpec tests](../../../skills/openspec-pipeline/test/openspec-skill.test.mjs)

## Desired End State

- A Claude Agent call always supplies `description`, `prompt`, the router-selected `subagent_type` or its existing fallback, `model` and `effort`. It includes `run_in_background: false` exactly when that parameter exists in the currently exposed Agent schema. The orchestrator inspects the schema before dispatch.
- Every numbered Claude step uses `agent-smith <change-id> step <n> <step>`. OpenSpec substitutes its `<change-name>` for the same change identifier. Archive uses `agent-smith <change-id> archive`, with the same OpenSpec substitution.
- The orchestrator records the launch's exact description, its change and step identity, and the agent id when returned. Direct replies belong to their Agent invocation. Completion notifications match the recorded launch identity, and a recorded agent id resolves which launch a notification names.
- A foreign or earlier-step completion cannot advance the current step or archive agent. A valid late usage notification can still attach to its own earlier numbered step before the existing cutoff.
- Both skills' anti-stall sections remain word-for-word equal, with six scenario-form rules. OpenAI dispatch follows the existing runner process and normalized-result contracts.
- Automated content and regression checks establish the written contract. A separate Manual row records live Claude completion and usage acceptance.

### Key Discoveries

- Loop step 2 is currently at line 57 of the 10x skill and line 65 of the OpenSpec skill. The ownership in Wave 4 is defined by those behavior regions. [Wave 4 ownership](../WAVES.md#wave-4-run-state-and-isolation-setup-6)
- The optional router-generated description would expand the runtime interface. Constructing it from existing action fields satisfies the requested behavior within the assigned skill regions. [action fields](../../../skills/10x-pipeline/scripts/route.mjs#L268), [change direction](change.md#fix-direction)
- The actual OpenSpec content test is `skills/openspec-pipeline/test/openspec-skill.test.mjs`. The rule already resides in chain-local `rules/` files following the structural migration. [test layout](../../../skills/openspec-pipeline/test/README.md), [rule ownership](../../../docs/ADR/ADR-018-no-nested-subagents.md#subagent-side)
- `skill-loop.test.mjs:36` currently requires `run_in_background` in rule 1. That assertion must change with the rule. `agents.test.mjs:359` pins Loop step 2 and the archive parameter reuse. [rule assertions](../../../skills/10x-pipeline/test/skill-loop.test.mjs#L35), [agent assertions](../../../skills/10x-pipeline/test/agents.test.mjs#L359)
- `docs/REFERENCE.md:275–276` and ADR-019's Guards paragraph also explain recovering the usage step number. Their caller guidance needs the same identity correction as the skill paragraphs. [reference](../../../docs/REFERENCE.md#L273), [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)

## Scope Boundaries

The implementation owns the following regions in both skills, plus assertions and documentation directly describing these behaviors.

| Owned region | Intended edit |
| --- | --- |
| Loop step 2 | Required descriptions, schema-dependent background flag, launch identity recording and the archive description override inherited by archive step 3 |
| Anti-stall rule 1 | Launch-notice handling independent of the background flag |
| Anti-stall rule 6 | Completion correlation through the recorded launch identity |
| Late-usage prose in `done`, `archive` and `halt` | Match the notification to its recorded deterministic description or agent id, then recover its numbered step |
| Existing content tests | Assertions for these requirements and existing provider contracts |
| Reference and existing ADR prose | Agent parameters, report identity and usage-number correlation |

Sibling ownership covers isolation setup and Start step 3, CI scratch directories, Git test environments, router state writes and their callers, and comparison accounting. `WAVES.md` belongs to post-wave maintenance. Runtime scripts, policies, runner dispatch, rule files, permissions, version fields and archived change folders are outside this implementation's edit surface. The optional router description field is excluded. The worktree stays on `agent-smith/agent-call-parameters`. [ownership table](../WAVES.md#wave-4-run-state-and-isolation-setup-6)

## Implementation Approach

Use the existing skills as the responsible layer for Agent parameter adaptation and notification matching. Apply the paired content edits as one coherent phase, extend existing assertions, and update the specific documentation paragraphs that describe the old correlation. Keep the archive description exception in Loop step 2 so archive step 3 inherits the correct parameters through its existing reference.

### Assumptions and Decisions

- A1. Treat this as a bounded, low-complexity skill-content correction with one phase. The unattended instruction delegates interview decisions, and the change request specifies the descriptions and conditional flag behavior. Local research supplies the remaining choices. [change request](change.md), [Wave 4](../WAVES.md)
- A2. Build descriptions from the router's existing `change`, `n` and `step` values. This keeps ownership in the assigned region and preserves the current runtime interface. Neutral retries use the same description because they retain those values. [ordinary action](../../../skills/10x-pipeline/scripts/route.mjs#L268), [neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs#L389)
- A3. Apply the archive description override in Loop step 2. The existing archive dispatch already references those parameters, so the exception reaches archive without broadening the edit region. [10x archive dispatch](../../../skills/10x-pipeline/SKILL.md#L73), [OpenSpec archive dispatch](../../../skills/openspec-pipeline/SKILL.md#L80)
- A4. Correlate using the full description and the recorded agent id when supplied. Step names can repeat on retries, and step numbers alone can repeat across changes. A usage notification whose launch cannot be identified remains unattached. [usage guards](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2), [foreign report rule](../../../docs/ADR/ADR-018-no-nested-subagents.md#orchestrator-side)
- A5. Restrict ADR-018 edits to its orchestrator-side identity wording, and ADR-019 edits to the caller's number-correlation guidance. Their historical statuses, evidence statements and other rules retain their existing ownership. [change direction](change.md#fix-direction), [ADR-019 guards](../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)
- A6. Live Claude acceptance requires a top-level Claude Code session. This unattended subagent is forbidden to launch another agent, and its host exposes no Claude Agent tool. Keep the Manual row pending until actual launch, completion and usage evidence exists. [nested-agent lesson](../../foundation/lessons.md#never-let-a-subagent-spawn-its-own-subagent)

## Phase 1: Correct Agent calls and notification correlation

### Overview

Deliver the paired skill correction, targeted regression assertions and aligned documentation as one implementation unit. Run automated verification and record the availability of live acceptance honestly.

### Changes Required

#### 1. Paired skill dispatch and notification rules

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**

Make valid Claude calls under either exposed Agent schema and give every launch an identity that survives asynchronous reporting. Match completion and late usage to that identity while respecting the existing provider and archive lifecycles.

**Contract**

- In Loop step 2's Claude branch, require `description` with the exact numbered-step format from Desired End State. State that the reused archive parameters override it with the exact archive format, with the respective chain's change placeholder.
- Set `run_in_background` to `false` only when the Agent tool declares that parameter. Otherwise omit the property. Describe the schema choice before the call, so a rejected probe never becomes the compatibility mechanism.
- Record the exact description with its router change, number and step, and associate any returned agent id with that launch. Use the action's actual number for retries, including neutral retries.
- Reword rule 1's condition to the Agent tool returning a launch notice instead of a final report. Retain its continuation at run step 3, the intro's archive continuation at step 4, and the existing OpenAI process-handle wait behavior.
- In rule 6, use the direct invocation or a notification matched to the recorded agent id or exact assigned description. Keep its foreign-hand-back rejection, result-file guard, `next` guard and own-report behavior. The same wording serves both chains.
- In each of the three late-usage paragraphs per skill, recover `<n>` from the earlier launch associated with the notification's fixed description or recorded agent id. Confirm its full change/step identity. Keep the printed `Step <n>` line as corroborating context. Ambiguous or unmatched figures stay unattached, and archive usage belongs only in the final message.
- Respect the current usage cutoffs, one standalone `usage` call, missing-figure flags, refusal handling, OpenSpec `--chain openspec`, and archive's result-file prohibition. The OpenAI runner receives its exact action JSON and prompt and returns through its existing completed/launched envelope handling.

#### 2. Focused content regression checks

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/agents.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`

**Intent**

Pin the corrected instructions at their existing test seams. Protect the paired skill sections and existing router-selected dispatch behavior with assertions specific to this change.

**Contract**

- Replace rule 1's obsolete background-flag needle with assertions for flag-independent launch handling, end-of-turn behavior and continuation. Retain the six-rule and identical-section assertions.
- Assert Loop step 2 supplies the exact step description and archive override in both chains, and places background-flag handling behind the exposed-schema condition with explicit omission when absent.
- Assert rule 6 refers to the launch's fixed identity or recorded id and rejects foreign reports. Cover distinct descriptions for an earlier step, another change and the archive agent.
- Assert all six terminal late-usage paragraphs recover the correct earlier step through that launch identity. Preserve cutoff, refusal and chain-flag assertions. Include repeated step names with different numbers and a late notification while a newer step is active in the content review scenarios.
- Retain the existing agent fallback, exact prompt, router model/effort and archive-reuse assertions. Use the existing provider/runner tests as regression coverage for OpenAI execution. These content assertions verify the written instructions, with live behavior covered by the Manual criterion.

#### 3. Matching documentation

**Files**: `docs/REFERENCE.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`

**Intent**

Make the reference and existing decision records explain the exact identity the skills assign and how it determines completion ownership and the usage step number.

**Contract**

Update only the reference's Orchestrator anti-stall and Late usage figure guidance and directly related Agent-call prose. Amend ADR-018's orchestrator-side correlation and ADR-019's Guards caller guidance. Document the conditional flag and both fixed description formats. Maintain the distinction between a current step's completion and an earlier step's valid late usage. Preserve the recorded limits and historical live-verification statements. Existing files and test assertions carry this change, with folder indexes needed only if implementation introduces a new file.

### Success Criteria

#### Automated Verification

- Paired skill content tests pass with required descriptions, schema-dependent background flags, identical six-rule sections and identity-based completion and late usage correlation.
- Existing agent dispatch and OpenAI provider, runner, chain and host-integration regression tests pass.
- Deliberate mutations of scratch skill copies fail the corresponding description, conditional-flag, rule-1, rule-6 and late-usage assertions through the existing skill-path overrides.
- The full repository test suite passes on Node 24 or later.
- The scoped diff passes `git diff --check`, the reference and ADR guidance agrees with both skills, and edits stay within the assigned ownership regions.

#### Manual Verification

- Live Claude Code acceptance records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step.

Proceed through automated work under the authorized implementation workflow. Keep the Manual row pending whenever live Claude access or top-level launch authority is unavailable, recording the exact reason under this change's `evidence/unproven.md` when the verification workflow reaches it.

## Testing Strategy

### Focused Verification

Run `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs` after the paired edits. Run `node --test skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/host-integration.test.mjs` for existing provider and runner contracts. Finish with `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `git diff --check`.

Use existing test patterns and dependency-free assertions. Keep disposable files and scratch directories inside this run worktree under the working-directory rules. Tests that use `os.tmpdir()` can inherit a worktree-local `TMPDIR`. Remove scratch files individually, followed by empty directories, using the repository's `removeTree` helper where appropriate.

For deliberate-break evidence, use disposable skill copies with `SKILL_PATH` and `OPENSPEC_SKILL_PATH`. Independently remove a required description, the archive override, the conditional flag instruction, the fixed-identity match, or the late-usage identity mapping, and restore the old rule-1 condition. Each mutation must fail the relevant assertion. Keep mutations in scratch copies and record the failing test names and exit statuses in the implementation evidence.

### Live Acceptance Procedure

1. From an authorized top-level Claude Code session, record the Claude version and the actual Agent tool schema. Capture whether `run_in_background` is declared. Use the edited skills on a disposable project.
2. Capture a numbered launch's actual parameters and completion. Confirm its exact description and the flag's presence or omission against that schema. Record the agent id if supplied. Capture an archive launch with its archive description and the existing archive result handling.
3. Capture an on-time usage figure and a figure delivered after `next` for an earlier numbered step. Match the latter through its exact description or recorded agent id, including when a newer step has the same step name. Record the standalone `usage` response and the resulting numbered status/report entry.
4. Verify an earlier or unrelated completion cannot supply the waiting step's result. Record the waiting launch identity and accepted completion identity. Archive usage appears in the final message.
5. Record every observed schema and outcome precisely. Static checks cover the alternate-schema instructions when a live session exposes only one schema. Keep the Manual row pending if its required live completion and usage evidence is missing.

Planning availability on 2026-11-14 is limited to static repository checks and read-only code tracing. A Claude executable is on `PATH`, but this session has no callable Claude Agent tool, and the unattended no-nesting rule prohibits starting a live acceptance run here. Live Claude acceptance remains unverified.

## Performance Considerations

Description construction and matching use the action fields and launch information already held by the orchestrator. The proposed change adds no runtime process, storage format or dependency.

## Migration Notes

Existing router state supplies the fields used by the descriptions, including neutral retries. Resume behavior and `usage` validation follow their current contracts. The new correlation instructions apply to launches that carry the assigned identity. When prior launch information cannot establish a notification's owner, leave its figure unattached and report the missing evidence. The implementation rollback is a normal revert of the paired skill, test and documentation commit.

## References

- [Change request](change.md)
- [Wave 4 ownership and structural-migration notes](../WAVES.md)
- [Repository rules](../../../AGENTS.md)
- [Lessons](../../foundation/lessons.md)
- [10x pipeline](../../../skills/10x-pipeline/SKILL.md)
- [OpenSpec pipeline](../../../skills/openspec-pipeline/SKILL.md)
- [Router dispatch fields](../../../skills/10x-pipeline/scripts/route.mjs#L268)
- [Neutral retry fields](../../../skills/10x-pipeline/scripts/flow.mjs#L355)
- [Reference correlation and usage guidance](../../../docs/REFERENCE.md#L273)
- [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
- [Host/provider integration assertions](../../../skills/10x-pipeline/test/host-integration.test.mjs)

## Progress

### Phase 1: Correct Agent calls and notification correlation

#### Automated

- [ ] 1.1 Paired skill content tests pass with required descriptions, schema-dependent background flags, identical six-rule sections and identity-based completion and late usage correlation.
- [ ] 1.2 Existing agent dispatch and OpenAI provider, runner, chain and host-integration regression tests pass.
- [ ] 1.3 Deliberate mutations of scratch skill copies fail the corresponding description, conditional-flag, rule-1, rule-6 and late-usage assertions through the existing skill-path overrides.
- [ ] 1.4 The full repository test suite passes on Node 24 or later.
- [ ] 1.5 The scoped diff passes `git diff --check`, the reference and ADR guidance agrees with both skills, and edits stay within the assigned ownership regions.

#### Manual

- [ ] 1.6 Live Claude Code acceptance records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step.
