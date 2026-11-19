# Step guard heredocs and input limits — plan brief

[Full implementation plan](plan.md)

## What & Why

The Claude Code Bash hook rejected ordinary heredoc text and quoted commit messages. Its 64 KiB input limit also blocked unrelated sessions. Phases 1 and 2 added literal heredoc handling and scoped the byte cap to guarded step subagents. [Change request](change.md)

## Starting Point

The review records five heredoc fixes in `462d1d5e`. Two pending phase 1 checks cover those fixes using the stdin-only hook, including a UDP redirect case to add alongside the existing TCP case. The follow-on ticket's byte-cap wording (F7) is for its owner to reconcile with the runtime reference. [Implementation review](reviews/impl-review.md) · [Runtime reference](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

## What Success Looks Like

A step can use a heredoc to write a note or compose a commit message. The hook still blocks heredoc input that could execute code, a missing delimiter, and any existing forbidden command that follows the body. A large valid Bash event from an unrelated session passes through with neutral output when it validates within the overflow nesting bound and host timeout.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Heredoc recipient | Prove the complete literal `cat` or `tee` route, including continued pipeline stages and redirections. Keep the quoted Git capture in one `-m` operand so the flag checker receives the surrounding tokens. | Terminators can precede downstream commands, and the Git checker expects one word for the message. |
| Heredoc expansion | Treat quoted bodies as literal. Apply Bash escape and continuation rules to unquoted bodies and deny active or ambiguous expansion. | Bash expands unquoted bodies even when the recipient only copies text. |
| Oversized events | Stream the full envelope through EOF once input exceeds 64 KiB, keeping the existing UTF-8 semantics and only the effective top-level type match and ID presence. Limit overflow parsing to 64 open containers, including the root. | A bounded projection retains the current scope rules and fails closed when it cannot validate the envelope. |

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
- The 64-container overflow bound leaves room for the documented shallow Bash event and nested metadata. Input exceeding the structural bound or the five-second host timeout fails closed. Long command strings consume no parser nesting capacity.

## Success Criteria (Summary)

- The focused hook tests pass with paired heredoc and size-limit cases, including every existing direct denial.
- Rows 1.2 and 1.3 verify message capture and arithmetic boundaries, delimiters at EOF, compound routes, continued operators, and descriptor and socket redirects with inert CLI inputs.
- The full repository test suite passes locally with `GH_LIVE` unset. The fake-client tests run and the opt-in live GitHub tests stay disabled.
- Manual row 2.3 (F6) remains pending until a fresh Claude Code `agent-smith:step` runs both `cat` heredocs, produces the expected scratch commit message and denies `gh --version` before execution. [Local evidence](evidence/unproven.md)

## References

- [Change request and live reproductions](change.md)
- [Hook registration](../../../hooks/hooks.json) · [Hook behavior reference](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)
