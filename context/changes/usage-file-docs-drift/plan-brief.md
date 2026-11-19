# Late Usage Help Plan Brief

[Full implementation plan](plan.md)

## What & Why

The router can attach late usage with `--usage-file`, but its help still leads readers to numeric flags. Steps with a recorded evidence contract require the file form, so the stale help sends readers to a command the router refuses.

## Starting Point

The router header already gives both forms. The command-specific refusal, top-level help, and Commands row in `AGENTS.md` omit `--usage-file`. The reference opens with numeric flags, while OpenSpec's existing procedure already uses the structured call.

## Desired End State

Both help paths give users the structured form and the numeric fallback. The command references explain that numeric flags apply to steps without recorded evidence. OpenSpec identifies why its chain-qualified file command applies to recorded usage.

## Key Decisions Made

| Decision | Choice | Basis |
| --- | --- | --- |
| Synopsis | Use the router header's two-form syntax in both help messages. | The existing header already describes the parser's two modes. |
| OpenSpec | Clarify the evidence requirement beside the existing `--usage-file` call. | The procedure and its content test already specify the correct command. |
| Regression coverage | Exercise both help paths through the existing scratch-project CLI helper. | The regression concerns the reason text users receive. |

## Scope

Two router message strings, the Commands row, both reference passages, OpenSpec late-usage prose, and one test in the late-usage suite. The change preserves the router's current CLI behavior and run state.

## Architecture / Approach

Use the router header for syntax and `usageCommand` for the eligibility rules. Land the help, documentation, and test together.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Align late usage help and documentation | The file form appears consistently, and both CLI messages have regression coverage. | Numeric flags could still read as a valid fallback for a step with recorded evidence. |

**Prerequisites** Node 24+ and local Git.

**Estimated effort** One small implementation phase.

## Open Risks & Assumptions

- The requested text changes and regression test fit one low-complexity phase. The change brief and current code settle the design for this unattended plan. [Change brief](change.md) · [Complexity assessment](complexity.json)

## Success Criteria (Summary)

- The focused CLI regression passes for both help messages.
- The documentation scan finds the structured synopsis in all three requested references and flags zero numeric-only synopses.
- The full Node test suite and whitespace check pass locally.

## References

- [Router late-usage handler](../../../skills/10x-pipeline/scripts/route.mjs#L785)
- [OpenSpec late-usage procedure](../../../skills/openspec-pipeline/SKILL.md#late-usage-before-every-end)
