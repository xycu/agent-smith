# Nested subagent hard stop implementation plan

## Overview

Set `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to the string `"1"` in this repository's Claude Code project settings. Document the same setting as optional setup for plugin users and append an amendment to ADR-018. Keep the prompt instructions that tell step agents to perform delegated work themselves.

This document plans implementation. Harness refusal requires a later live acceptance check from a top-level Claude session.

## Current State Analysis

- `.claude/settings.json` currently configures sandbox networking and excluded commands. It has no `env` block.
- Every step receives the delegation ban from `skills/10x-pipeline/rules/top.md`. The shared router appends this required rule file after step and chain rules, including archive prompts. Executor templates add skill-specific instructions, and both orchestrator skills carry the foreign-hand-back rule. See `skills/10x-pipeline/scripts/flow.mjs:840` and `skills/10x-pipeline/test/nested-subagents.test.mjs:39`.
- Restricted agents are optional. The shipped `agents.steps` maps only `score`, whose tool allowlist excludes delegation. `stepAgent()` returns a mapped agent only when `agents.restricted` is exactly true. The archive action also lacks an agent field. See `skills/10x-pipeline/policy.json:103`, `skills/10x-pipeline/scripts/flow.mjs:931`, `agents/score.md` and `skills/10x-pipeline/test/agents.test.mjs`.
- ADR-018 says only prompt text and orchestrator skills can act on nesting, says the depth variable is unnecessary, and records ignored prompts as an enforcement gap. These statements need a dated amendment. The Limits nesting bullet in `docs/REFERENCE.md:434` repeats them.
- Codex execution already disables its delegation paths through `agents.enabled=false` and `--disable multi_agent_v2`. See `skills/10x-pipeline/scripts/run-codex.mjs:119`.
- Wave 6 assigns this change `.claude/settings.json` and ADR-018. Shared README and REFERENCE edits use the dedicated regions listed below. The roadmap has no item with this Change ID.

### Verified upstream capabilities

Anthropic's environment-variable reference documents a positive integer depth limit, default 3, available from Claude Code 2.1.217. A value of 1 disables nesting. The subagent guide counts layers below the main conversation and describes tool removal at the cap. Fork agents retain the Agent tool but its invocation returns an error at the cap. The current project minimum of 2.1.292 already covers the documented introduction. Sources checked on 2026-11-14. [Environment variables](https://code.claude.com/docs/en/env-vars) · [Subagent nesting](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)

Project settings support string values under `env`. Settings precedence is managed settings, command-line settings, project-local settings, shared project settings, then user settings. A fresh session from the project root gives acceptance a clear startup boundary and allows inspection of the loaded setting sources. [Settings](https://code.claude.com/docs/en/settings#settings-precedence) · [Environment settings](https://code.claude.com/docs/en/env-vars#set-variables-in-settings-files)

Plugin agents support `disallowedTools`, and omitting `tools` inherits available tools. The guide explicitly supports excluding Agent through `disallowedTools`. Plugin agent frontmatter ignores `hooks`, `mcpServers` and `permissionMode`. A scoped agent would require mapping and acceptance across the affected dispatch paths. The depth setting directly covers the session's step and archive agents with one project setting. [Subagent configuration](https://code.claude.com/docs/en/sub-agents#frontmatter-reference)

### Planning verification

- `node --version` returned `v24.19.0`. `claude --version` returned `2.1.311 (Claude Code)`.
- `node --test skills/10x-pipeline/test/nested-subagents.test.mjs` passed all 11 tests after isolating scratch Git discovery. This verifies the current prompt and document contracts.
- The initial check failed one routing expectation because the mandated worktree-local `TMPDIR` inherited this repository's history. A temporary `.git` file containing `gitdir: absent-git-boundary` in the scratch parent stopped ancestor discovery. Repeating the command with that boundary passed. The scratch directory and boundary were removed after inspection.
- Live Claude acceptance is **unavailable in this planning run**. The always-true unattended-subagent instruction prohibits Agent, Task, spawn_agent and every other route to starting another subagent. A Claude child that delegates would cross that same boundary. CLI availability establishes the installed version only. Manual acceptance stays pending.

## Desired End State

With the committed project setting loaded in a supported Claude Code session, the top-level orchestrator can launch a step agent. That step agent reaches the depth cap and cannot launch a nested agent, including when its task requests delegation. Both pipeline chains and their archive agents receive this session-level cap.

Plugin users can opt in through their own project settings or startup environment. Documentation states the project-wide effect, version requirement, settings precedence and verification procedure. ADR-018 records the harness control alongside the retained prompt behavior and historical failure observations.

## Scope and ownership

| File or region | Planned edit |
| --- | --- |
| `.claude/settings.json` | Add the single depth variable under `env` |
| `skills/10x-pipeline/test/nested-subagents.test.mjs` | Add configuration and documentation checks to the existing nesting contract suite |
| `skills/10x-pipeline/test/README.md` | Extend only the existing nesting-test row to mention the project setting |
| `README.md` | Add `### Claude Code subagent depth` at the end of Configure, immediately before More |
| `docs/REFERENCE.md` | Revise only the nesting bullet within the 10x Limits region around line 434 |
| `docs/ADR/ADR-018-no-nested-subagents.md` | Append a dated amendment covering the selected control, current upstream semantics and acceptance status |
| `context/changes/nested-subagent-hard-stop/` | Planning artifacts, lifecycle metadata and later acceptance evidence |

The shared-document regions are distinct from `docs-drift-fixes`' report location, duplicated Run lock paragraph, OpenSpec live-run wording and six other ADR amendments. Implementation follows the Wave 6 ownership contract recorded in `context/changes/WAVES.md`.

## Implementation Approach

Use the supported depth cap at the harness layer that owns subagent creation. Add the project setting directly to the existing JSON object. Its value is the string `"1"`. The setting applies to all Claude sessions in this repository, including sessions outside a pipeline.

Keep plugin-user adoption optional because the same project-wide effect can affect their other workflows. Include a mergeable JSON example and the one-session shell form `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1 claude`. Tell users to merge the `env` entry into their existing settings, commit it before creating run worktrees, and launch a fresh session from the intended project root. Explain that higher-precedence settings can override the shared value.

The existing test file owns static configuration assertions and documentation checks. Its router-driven tests continue to verify delivery of the prompt ban. A single Manual row owns live harness refusal and top-level delegation acceptance.

### Decisions and assumptions

- A1. Select the depth variable from option 1 of `change.md`. Anthropic documents its intended behavior and this repository already has project settings. This is the smallest supported mechanism covering ordinary, restricted-score and archive agents.
- A2. Accept project-wide depth 1 in this repository and optional adoption in consumers. `change.md` explicitly proposes that scope.
- A3. Use two phases, first configuration and regression checks, then documentation and acceptance. The work has medium complexity because upstream configuration, tool exposure and host precedence intersect. The unattended instruction supplies the decision rule for the skill's interview and approval points.
- A4. Record live acceptance as unavailable and leave its Manual row pending until a top-level session supplies observed evidence. This follows the explicit task allowance and the current delegation prohibition.
- A5. Treat the upstream hand-back behavior in ADR-018 as historical observations. Current upstream documentation describes waiting behavior that varies with fork mode and execution mode. The amendment cites that description while retaining the pipeline's flat-delegation policy.

## Critical Implementation Details

### Timing and lifecycle

Shared project settings are read from the session's primary working directory. A worktree branches from committed files. Commit the setting before a fresh isolated pipeline run, restart Claude from the relevant root for acceptance, and record `/status` setting sources. Resolve any effective-value override before interpreting a nesting attempt.

### Acceptance evidence

A static JSON assertion proves the committed setting and catches accidental removal or a changed value. Actual enforcement evidence requires a supported live Claude session that reaches a depth-1 step agent and observes tool withholding or an explicit depth-limit refusal. The transcript must also show a successful top-level Agent call.

## Phase 1: Configure the repository depth cap

### Overview

Add the documented cap and guard its committed value in the existing nesting tests.

### Changes Required

#### Project configuration

**File**: `.claude/settings.json`

**Intent** Add `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` with value `"1"` to the existing settings object.

**Contract** Claude Code settings JSON accepts an `env` map with string values. Review the additive settings diff against the current sandbox configuration.

#### Configuration regression coverage

**File**: `skills/10x-pipeline/test/nested-subagents.test.mjs`

**Intent** Read `.claude/settings.json` using the existing repository-path convention and assert the parsed depth value is exactly the string `"1"`. This rejects a missing entry, a numeric value and any alternative depth.

**Contract** The existing prompt delivery, executor rules and equal sixth anti-stall rule remain covered by their current assertions. The new assertion owns the repository configuration contract.

**File**: `skills/10x-pipeline/test/README.md`

**Intent** Extend the existing `nested-subagents.test.mjs` scope cell with the settings assertion.

**Contract** Maintain the single existing row for that test file.

### Success Criteria

#### Automated Verification

- Project settings parse and the committed depth value is exactly the string `"1"`.
- The focused nested-subagent suite passes, including the new setting assertion and existing prompt-delivery checks.

## Phase 2: Document optional setup and record acceptance

### Overview

Document how the harness setting is adopted, amend the historical ADR and distinguish observed enforcement from pending acceptance.

### Changes Required

#### User-facing setup

**File**: `README.md`

Add `### Claude Code subagent depth` immediately before More.

**Intent** Provide a short optional setup entry and link to the reference. Include the exact string-valued JSON entry, the all-project-session effect and a fresh-session instruction.

**Contract** Locate this addition after the existing Configure material so the sibling documentation edits retain separate regions.

**File**: `docs/REFERENCE.md`

Edit the nesting bullet under 10x Limits.

**Intent** Explain project configuration and optional consumer adoption, the startup shell alternative, effective-setting precedence, depth counting, top-level delegation and normal/fork behavior at the cap. Link the upstream references and ADR amendment. Describe prompt rules as instructions for completing work in the step itself.

**Contract** Replace the current claim that the variable is unnecessary with the selected setting and its scope. State that this repository enables it and plugin consumers configure their own projects. Qualify historical hand-back failures using current upstream execution-mode semantics.

#### ADR amendment

**File**: `docs/ADR/ADR-018-no-nested-subagents.md`

Append `## Amendment 2 — Harness depth cap` with implementation date.

**Intent** Record the supported control, alternatives considered, project-wide tradeoff, source review date and live acceptance result. Name the earlier Context, Consequences and enforcement-gap statements that the amendment supersedes. Preserve the historical decision record and its existing status.

**Contract** Retain the always-true prompt rule and orchestrator identity checks as part of the decision. If the amendment adds scenario rules, use the existing GIVEN/WHEN/THEN form with one bold RFC keyword per rule. Describe `disallowedTools` as supported and record why project configuration was selected. Explain the session-wide reach of an unscoped Agent hook as the reason for choosing the depth control.

#### Documentation regression checks

**File**: `skills/10x-pipeline/test/nested-subagents.test.mjs`

Extend the document checks near its final two tests.

**Intent** Extend the existing reference check to verify the chosen setting and optional plugin-user setup, and add focused checks for the README entry and ADR amendment. Retain the guard against a requirement to raise the depth.

**Contract** Scope assertions to the new documentation regions. Verify the string-valued setting example and the upstream source links without pinning surrounding sibling-owned prose. Keep historical ADR claims distinguishable through its amendment.

### Success Criteria

#### Automated Verification

- Documentation checks pass for optional setup, the exact depth setting and the ADR amendment.
- The complete repository test command passes, with any environment-dependent skips identified in the acceptance record.
- Diff review confirms that shared-document edits occupy the named regions and the implementation file set matches this plan.

#### Manual Verification

- Live Claude depth-1 acceptance records successful top-level delegation and a blocked nested Agent attempt, or explicitly records unavailable acceptance with this row pending.

## Testing Strategy

### Focused checks

Run `node --test skills/10x-pipeline/test/nested-subagents.test.mjs` after phase 1 and after the documentation edits. Parse project settings through the new assertion. Existing real-router prompt coverage verifies the delivery of the retained nesting ban.

Use Node 24+. For this run's worktree-only path constraint, put scratch under the change folder and set `TMPDIR` to its absolute path. Give the scratch parent the Git discovery boundary described in Planning verification, so fixture repositories inherit their own Git state. Let existing `cleanupAll` and `removeTree` clean fixture contents, then inspect and remove the boundary file and empty scratch parent.

### Repository gate

Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` with the same scratch setup. Record versions, exit status, pass/fail/skip counts and reasons for unavailable external probes in `context/changes/nested-subagent-hard-stop/evidence/acceptance.md` during implementation. Use `git diff --check` and inspect changed paths and document hunks.

### Live acceptance procedure

Perform these steps from an authorized top-level Claude session after implementation. The current unattended step can record the procedure and its unavailable status.

1. Start from the committed repository or run-worktree root on a supported Claude version. Record `claude --version`, project root and `/status` setting sources. Confirm effective `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` without exposing unrelated environment values.
2. Launch a small top-level Agent task through the normal general-purpose dispatch. Its task requests one nested Agent call and a report of the outcome. Record the exposed step tools. Successful depth-1 launch establishes that the top-level orchestrator can delegate.
3. Capture the child's unavailable Agent tool or the harness's depth-limit error. For a fork at the limit, capture the tool error if that path is exposed. Confirm no depth-2 agent starts. A child merely choosing to follow the prompt ban leaves the enforcement observation unproved.
4. Check the step still performs an ordinary permitted read and hands its own result back. Record any exposed-path limitation and retain the transcript or tool-event excerpts as evidence.
5. Record an equivalent optional consumer configuration check when available. Configuration documentation and the common harness depth semantics apply to both chains and archive dispatch.
6. If host access, precedence, model access or this run's delegation rules prevent observation, record **unavailable**, its concrete reason and the version observed. Leave Manual row 2.4 pending. Static tests and documentation support remain recorded separately.

## Migration and recovery

Consumer adoption consists of merging the single environment entry into existing settings and starting a fresh session. The cap affects future delegation in that session. To restore a project's previous depth behavior, remove this entry or restore its prior value and relaunch Claude. Existing run files continue to use the router's normal lifecycle.

## Open Risks and Assumptions

- Shared project settings can be overridden at a higher precedence. Acceptance applies to the effective configuration observed in its recorded session.
- The cap affects every Claude workflow in the configured project. Plugin users choose adoption for their own workflow requirements.
- The documented control governs Claude Code subagent creation. The prompt rule also names other delegation tools and external runtimes, whose enforcement follows their own harness configuration.
- Live acceptance is pending. The installed CLI and upstream documentation support the mechanism selection, and the current 11-test pass establishes the starting prompt contract.

## References

- Change requirements in `context/changes/nested-subagent-hard-stop/change.md`.
- Wave 6 ownership in `context/changes/WAVES.md`.
- Delegation lesson in `context/foundation/lessons.md`, “Never let a subagent spawn its own subagent”.
- Historical decision in `docs/ADR/ADR-018-no-nested-subagents.md`.
- Shared prompt delivery in `skills/10x-pipeline/scripts/flow.mjs:840` and agent mapping in `skills/10x-pipeline/scripts/flow.mjs:931`.
- Existing enforcement-contract tests in `skills/10x-pipeline/test/nested-subagents.test.mjs:39` and document checks at line 155.
- Official variable support and project `env` configuration, checked 2026-11-14. [Environment variables](https://code.claude.com/docs/en/env-vars)
- Official depth semantics and plugin tool restrictions, checked 2026-11-14. [Subagents](https://code.claude.com/docs/en/sub-agents)
- Official settings scope and precedence, checked 2026-11-14. [Settings](https://code.claude.com/docs/en/settings)

## Progress

### Phase 1: Configure the repository depth cap

#### Automated

- [x] 1.1 Project settings parse and the committed depth value is exactly the string `"1"`.
- [x] 1.2 The focused nested-subagent suite passes, including the new setting assertion and existing prompt-delivery checks.

### Phase 2: Document optional setup and record acceptance

#### Automated

- [ ] 2.1 Documentation checks pass for optional setup, the exact depth setting and the ADR amendment.
- [ ] 2.2 The complete repository test command passes, with any environment-dependent skips identified in the acceptance record.
- [ ] 2.3 Diff review confirms that shared-document edits occupy the named regions and the implementation file set matches this plan.

#### Manual

- [ ] 2.4 Live Claude depth-1 acceptance records successful top-level delegation and a blocked nested Agent attempt, or explicitly records unavailable acceptance with this row pending.
