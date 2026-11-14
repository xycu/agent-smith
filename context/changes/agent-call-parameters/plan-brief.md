# Agent Call Parameters — Plan Brief

> [Full implementation plan](plan.md)

## What & Why

Both skills currently require `run_in_background: false` and leave Agent descriptions unspecified. The change request records an Agent schema that rejects that flag and requires a description. The plan corrects the call instructions and gives asynchronous completion and usage notifications a deterministic identity.

## Starting Point

The router already returns the change identifier, step number and step name, including on neutral retries. Both skills share six anti-stall rules and reuse Loop step 2's parameters for archive. Late usage currently recovers the number from a printed step line.

## Desired End State

Every Claude step has description `agent-smith <change-id> step <n> <step>`, and archive has `agent-smith <change-id> archive`. OpenSpec uses its change name as the identifier. Agent calls include the background flag only when the exposed schema declares it. Per-invocation records establish ownership for completion and both on-time and late usage. Known agent ids take precedence and require consistent descriptions. Description fallback requires one unique compatible launch, including across neutral retries, and can associate an id first received in a notification when the launch returned none.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Description ownership | Construct from existing router action fields in Loop step 2 | Fits the assigned skill region and existing interface | Plan, router dispatch |
| Background flag | Set false when exposed, otherwise omit | Fits both schemas described by the request | Change request |
| Archive description | Define its override in Loop step 2 | Archive step 3 already reuses these parameters | Plan, current skills |
| Completion and usage | Match known agent ids first, require consistent descriptions, and allow a unique exact-description fallback compatible with recorded ids | Neutral retries reuse descriptions and earlier usage can arrive during a newer step | Change request, ADR-018, ADR-019, plan review F1–F2 |
| Provider behavior | OpenAI actions use the shared runner and its current envelope handling | Preserves the explicit provider-dispatch requirement | User instruction, current skills |
| Verification | Existing content assertions, regression suite and a live Manual row | Live Claude evidence requires an authorized top-level session | Change request, no-nesting rule |

## Scope

The implementation owns Loop step 2, anti-stall rules 1 and 6, and all terminal late-usage paragraphs in both skills. It also covers related assertions in `skill-loop.test.mjs`, `agents.test.mjs` and the current OpenSpec test path, `skills/openspec-pipeline/test/openspec-skill.test.mjs`. Documentation edits cover the relevant reference paragraphs, ADR-018's orchestrator identity and ADR-019's usage-number guidance.

Sibling changes own isolation setup, CI scratch, test Git environments, router state writes and comparison accounting. `WAVES.md` belongs to post-wave maintenance. Router-generated description fields, policies, permissions, versions and archived content are outside the planned edit surface.

## Architecture / Approach

The existing Claude dispatch branch adapts the call to the tool schema and records each invocation separately. Its usage ownership guard governs Loop step 4, so only the current invocation's matched figure enters the current result. An earlier step's figure follows its late-usage path. Shared anti-stall rules reject conflicting metadata, ambiguous description-only notifications and completions from superseded invocations. A unique description still matches when the launch returned no id. Each terminal late-usage paragraph uses the same launch records to recover the earlier numbered step before the current cutoff. OpenAI actions continue through their runner process and normalized-result path.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Correct Agent calls and notification correlation | Paired skill edits, focused assertions, matching docs and verification | Live completion and usage acceptance needs top-level Claude access |

The prerequisite is the current post-migration layout and Wave 4 ownership. Estimated implementation effort is one small phase with a separate live acceptance check. Planning has already confirmed 30 existing skill-content tests pass on Node v26.13.1.

## Open Risks & Assumptions

- The unattended instruction delegates design choices. One phase uses the exact description formats and current action fields established by the request and repository.
- A Claude executable exists on `PATH`, but this session exposes no Claude Agent tool and prohibits nested agents. Manual row 1.6 stays pending until its required live evidence exists.
- A wrong existing number can receive usage silently. Unmatched or ambiguous notifications remain unattached.
- Scratch checks must follow the worktree-only path and safe-deletion rules.

## Success Criteria (Summary)

- Written calls handle either Agent schema and assign the required step and archive descriptions.
- Completion and late usage use the recorded launch identity, with existing OpenAI dispatch protected by regression tests.
- All five Automated rows are proved, and the separate Manual row records live acceptance honestly.

## References

- [Change request](change.md)
- [Wave 4 ownership](../WAVES.md#wave-4-run-state-and-isolation-setup-6)
- [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
