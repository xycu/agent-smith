# Step guard heredocs and input limits — plan brief

[Full implementation plan](plan.md)

## What & Why

The Claude Code Bash hook can reject ordinary heredoc text and the quoted heredoc pattern used for commit messages. Its current 64 KiB input limit also blocks unrelated sessions. The fix makes the guard recognize literal text and restricts the byte cap to guarded step subagents. [Change request](change.md)

## Starting Point

The standalone hook reads the event from stdin. It caps the full input before reading the agent identity, then splits guarded commands into shell words. Its CLI tests already assert exact separation between neutral output, JSON denial, and exit-2 failure. [Hook implementation](../../../skills/10x-pipeline/scripts/step-guard.mjs) · [CLI tests](../../../skills/10x-pipeline/test/step-guard.test.mjs)

## What Success Looks Like

A step can use a heredoc to write a note or compose a commit message. The hook still blocks heredoc input that could execute code, a missing delimiter, and any existing forbidden command that follows the body. A large valid Bash event from an unrelated session passes through with neutral output.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Heredoc recipient | Allow common literal `cat` and `tee` text routes and the quoted Git message capture. Deny interpreter input and ambiguous routes. | The current guard classifies a bounded set of literal shell forms. The ticket permits an actionable denial for code-bearing and unclear forms. |
| Heredoc expansion | Treat quoted bodies as literal. Deny executable expansions in unquoted bodies. | Bash can run substitutions even when the recipient only copies text. |
| Oversized events | Stream identity from the complete envelope once the buffer reaches its limit. Keep exit 2 for guarded events above 64 KiB and neutral output for valid non-step envelopes. | The current scope depends on both top-level identity fields and the current guarded path already has a bounded failure mode. |

[Change request](change.md) · [Bash redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents) · [Claude Code hook identity](https://code.claude.com/docs/en/hooks#common-input-fields)

## Scope

This plan covers the standalone hook, focused tests, and the runtime behavior reference. General shell wrapper and alias coverage is tracked separately. [Follow-on change](../step-guard-bypass-forms/change.md)

## Architecture / Approach

Track heredoc boundaries and data flow in the existing command scanner, then apply the existing denial rules to executable tokens. Keep ordinary event handling on the existing JSON path. On overflow, stream the top-level identity fields with bounded memory and classify using the same predicate. The hook continues to use stdin and decision output. [Runtime contract](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parse and classify heredocs | Literal body handling with paired allow and deny tests. | Body text can execute through expansions or downstream commands. Delimiter mistakes can hide the next command. |
| 2. Apply the byte cap to guarded steps | Bounded envelope classification, scoped oversize tests and updated documentation. | Identity-like text in a large command or nested object could be mistaken for top-level identity. |

**Prerequisites** Node 24+ for the automated tests and a fresh Claude Code 2.1.295+ session with the updated plugin for the live check.

**Estimated effort** A focused implementation and review pass for each phase.

## Open Risks & Assumptions

- The supported data recipient list starts with the common literal forms above. Commands with ambiguous input routing receive guidance to use the Write tool for text data.
- The oversized reader assumes the standard shallow Bash hook envelope. Payload string length does not consume parser nesting capacity.

## Success Criteria (Summary)

- The focused hook tests pass with paired heredoc and size-limit cases, including every existing direct denial.
- The full repository test suite passes locally.
- Manual verification in a fresh `agent-smith:step` subagent confirms that both `cat` heredocs and the quoted scratch commit work and that the hook denies `gh --version` before it runs.

## References

- [Change request and live reproductions](change.md)
- [Hook registration](../../../hooks/hooks.json) · [Hook behavior reference](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)
