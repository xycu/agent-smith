# Manual 1.6 verification attempt on 2026-11-14

## Required observation

The pending row in plan.md reads

> 1.6 An authorized top-level Claude Code session records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step; this row stays pending in unattended recovery.

## Fresh inspection

Inspected revision `1ff3028b87160ab63b7140679bb5e8d3ee6554a7` on branch `agent-smith/agent-call-parameters`. Read the previous unproven.md first, then the plan, change request, paired skills, relevant content tests and automated evidence. Read-only Git checks confirmed the revision and branch. `git diff --check` exited 0.

The current tool inventory contains no callable Claude Agent tool. Read-only shell discovery found `/opt/homebrew/bin/claude`. This attempt runs as an unattended Codex subagent. The user explicitly prohibits starting another agent. These conditions prevent the required top-level Claude launches and observed notifications.

The paired skills instruct

> Inspect the exposed Agent schema before calling

> Record each invocation separately with its exact description, router `change`, `n` and `step`

> Usage ownership in Loop step 4 follows the identity check in rule 6

Considered the existing content tests as an alternate proof. `skills/10x-pipeline/test/skill-loop.test.mjs` states

> Written contracts only; live notification acceptance remains a Manual criterion.

The corresponding tests read skill text and assert its contents. The automated evidence states

> These are reviews of instructions, not live Agent observations. The paired content tests assert the clauses cited below.

Those checks establish the written dispatch and correlation contract. Row 1.6 additionally requires observed schema acceptance, actual step and archive completions, and correct on-time and late usage attribution. No inspected evidence supplies those live observations. No covering test or permitted command was found. No tests were run during this attempt because the available assertions cannot establish that live acceptance claim.

## Outcome and retained handoff

Row 1.6 stays pending. No Manual rows were ticked. Plan content and all Automated rows retain their prior values. The implementation checkpoint is `43e28f3aaf5f37a7becd05f9933c67da60b9ff93`, and the recovery commit recorded in the plan is `8b2afca`.

An authorized top-level Claude Code session can complete the remaining acceptance procedure from plan.md.

- Record the Claude version and actual Agent schema, including whether it declares `run_in_background`.
- Use the edited skills on a disposable project. Capture supplied parameters, the accepted numbered-step description `agent-smith <change-id> step <n> <step>`, the archive description `agent-smith <change-id> archive`, and returned agent ids. OpenSpec substitutes its change name. Check flag presence against the exposed schema.
- Capture awaited and accepted completion identities. Exercise earlier-step and foreign completions, conflicting metadata, superseded neutral retries sharing a description, ambiguous description-only matching, and a unique launch whose initial response contains no id.
- Capture correctly matched on-time usage and earlier-step late usage while a newer step with the same name runs. Include a current report without usage when earlier usage is already available. Record the standalone usage response and numbered status/report attribution. Record archive usage in the final message.
- Keep row 1.6 pending until its required live observations are recorded.

Assumptions are empty. The live-observation requirement and launch restriction are explicit in the supplied plan and task.
