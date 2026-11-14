# Unproven manual verification

- 1.6 — Live Claude Code acceptance remains pending. This Codex-hosted unattended subagent has no callable Claude Agent tool, and the explicit no-nesting instruction prohibits launching a live acceptance agent. Actual Claude parameter acceptance, completion matching and notification usage attribution require observations from an authorized top-level Claude Code session as specified in plan.md.

## Manual verification attempt on 2026-11-14

Read the prior unproven evidence, change request, plan, paired skill dispatch and notification instructions, content tests and automated evidence. Checked the currently available tool inventory for a callable Claude Agent tool. None is available. Considered existing content tests as an alternate proof. `skills/10x-pipeline/test/skill-loop.test.mjs:184` describes its assertions as “Written contracts only; live notification acceptance remains a Manual criterion.” These assertions read skill text. The saved automated evidence likewise records instruction reviews and keeps live acceptance pending. No existing evidence establishes the required live observations.

Manual 1.6 remains unchecked. No test was run during this attempt because the available content tests cannot establish the required live observations. No nested agent was launched. The inspected HEAD is `3209dfb`; the automated recovery commit is `8b2afca`, already recorded beside Automated rows 1.4, 1.5, 1.7 and 1.8 in `../plan.md`.

## Recovery handoff on 2026-11-14

The implementation checkpoint is `43e28f3aaf5f37a7becd05f9933c67da60b9ff93`. The recovery commit is recorded beside Automated rows 1.4, 1.5, 1.7 and 1.8 in `../plan.md` after the implementation gates pass. That commit contains the deterministic fixture correction and automated evidence.

This session runs under Codex with Node v24.19.0. Read-only host discovery found `/opt/homebrew/bin/claude` on PATH. The session exposes no callable Claude Agent tool, and the explicit unattended no-nesting instruction prohibits starting Claude or another agent for acceptance. Schema acceptance, completion delivery and usage attribution require observation in an authorized top-level Claude Code session. Manual 1.6 remains pending.

### Top-level acceptance checklist

- Record the Claude version and actual Agent schema, including whether it declares `run_in_background`.
- Run the edited skills on a disposable project. Capture the exact numbered-step description `agent-smith <change-id> step <n> <step>`, the archive description `agent-smith <change-id> archive`, the supplied parameters and any returned agent id. OpenSpec uses its change name in the same formats. Verify the flag against the exposed schema.
- Capture the awaited invocation and accepted completion identities. Exercise earlier-step and foreign completions, conflicting metadata, a neutral retry sharing a description, ambiguous description-only matching, and a unique launch with no initial id. Record which completion advances the step.
- Capture correctly matched on-time usage and an earlier numbered step’s late notification while a newer step with the same name runs. Include a current report without usage when the earlier notification is already present. Record the standalone `usage` response and numbered status/report attribution. Archive usage belongs in the final message.
- Record observed outcomes and remaining gaps. Keep Manual 1.6 pending until its required launch, completion and usage evidence exists. The automated content assertions and alternate-schema checks establish the written instructions.
