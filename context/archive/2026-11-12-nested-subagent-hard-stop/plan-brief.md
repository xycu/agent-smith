# Nested subagent hard stop — Plan Brief

Full plan in `context/changes/nested-subagent-hard-stop/plan.md`.

## What & Why

A pipeline step must complete its own work even when an upstream skill asks it to delegate. Add the supported Claude Code depth cap so the harness enforces a single subagent layer below the orchestrator.

## Starting Point

The always-true prompt ban and both orchestrator hand-back rules already exist. Project settings currently contain sandbox configuration, and the optional restricted-agent mapping covers only score.

The existing nesting suite passes 11/11 after scratch Git discovery is isolated. Node is 24.19.0 and the installed Claude Code CLI is 2.1.311.

## Desired End State

A configured top-level Claude session can launch step agents. A step agent reaches the depth cap and cannot launch another agent, including when its prompt requests delegation.

Plugin users can adopt the same project-wide setting deliberately. Documentation and ADR-018 explain setup, precedence and the observed acceptance status.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Harness control | Project `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` equals string `"1"` | Anthropic documents this value as disabling nesting | Change option 1 and upstream research |
| Consumer adoption | Optional project setup or startup environment | The cap affects every Claude session in the project | Change and settings reference |
| Agent behavior | Retain the prompt instructions for doing work inside the step | They explain how to handle skills that delegate | Change and lessons |
| Documentation ownership | New README Configure subsection and existing REFERENCE nesting bullet | These regions are distinct from Wave 6 sibling edits | Wave 6 and plan |
| ADR form | Append dated Amendment 2 | Preserves the historical decision and records current harness support | Change and repository convention |
| Acceptance | Separate static checks and live refusal evidence | A JSON assertion and a live tool refusal establish different facts | Plan |

## Scope

Implementation reaches the project settings, the existing nesting tests and their index row, the dedicated README and REFERENCE regions, and ADR-018. The change folder carries the planning artifacts and later acceptance evidence.

The implementation file set and shared-document anchors are enumerated in the full plan under Scope and ownership.

## Architecture / Approach

Claude Code reads the depth value from project settings and enforces the cap when a child tries to delegate. Ordinary depth-limit agents have Agent withheld. A fork at the cap retains the tool and receives an error on invocation. The router continues to supply the instructions for finishing work in the step.

The documented variable requires Claude Code 2.1.217+. The plugin's current 2.1.292 minimum already covers that introduction. Effective values follow Claude's settings precedence.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Configure the repository depth cap | One project environment entry and a static regression assertion | A higher-precedence setting can change the effective value |
| 2. Document optional setup and record acceptance | Dedicated documentation, ADR amendment, full tests and one live Manual row | Live Claude refusal requires an authorized top-level session |

Prerequisites include Node 24+, a supported Claude Code host for live acceptance and launch from the intended project root.

Estimated effort is one implementation session plus one top-level host acceptance check.

## Open Risks & Assumptions

- Selecting the documented depth variable and accepting its project-wide effect are unattended, evidence-backed decisions from change option 1.
- Live acceptance is unavailable in this planning run because its always-true rules prohibit starting any subagent. Manual row 2.4 stays pending until observed evidence exists.
- The depth cap governs Claude's subagent harness. Other delegation runtimes follow their own controls.
- Current upstream hand-back behavior varies with fork and execution mode. The ADR amendment qualifies the historical observations accordingly.

## Success Criteria (Summary)

- The repository setting and optional consumer instructions agree on string-valued depth 1.
- Focused and complete repository tests pass, with external-probe skips recorded.
- Live evidence shows top-level delegation and a blocked nested attempt, or records a concrete unavailable reason with the Manual row pending.

## References

- Requirements and ownership in `context/changes/nested-subagent-hard-stop/change.md` and `context/changes/WAVES.md`.
- Current variable support, reviewed 2026-11-14. [Environment variables](https://code.claude.com/docs/en/env-vars)
- Depth counting, fork behavior and agent restrictions. [Subagents](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)
- Project configuration and precedence. [Settings](https://code.claude.com/docs/en/settings#settings-precedence)
