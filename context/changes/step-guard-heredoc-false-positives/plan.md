# Step guard heredocs and input limits implementation plan

## Overview

Update the Claude Code Bash hook so literal heredoc data reaches its intended destination and large Bash events from unrelated sessions pass through. Keep guarded steps fail-closed when a heredoc might execute code, when parsing fails, or when the event exceeds 64 KiB.

## Current State Analysis

`hooks/hooks.json` invokes `step-guard.mjs` as a synchronous `PreToolUse` hook for Bash with a five-second timeout and `onFailure: "block"`. The hook's word scanner treats heredoc body lines as ordinary shell input, and its stdin reader throws at 64 KiB before the top-level `agent_type` and `agent_id` are known. The standalone hook reads stdin and emits a decision without executing the command or accessing files, the network, or router state. [Hook registration](../../../hooks/hooks.json) · [Word scanner](../../../skills/10x-pipeline/scripts/step-guard.mjs#L8) · [Event reader](../../../skills/10x-pipeline/scripts/step-guard.mjs#L121)

Inert CLI payloads reproduced the three heredoc false positives and the cap failure for a 70 KiB command from the main session. All 12 existing focused tests passed, so the regressions need new cases alongside the current allow and deny fixtures. [Existing CLI tests](../../../skills/10x-pipeline/test/step-guard.test.mjs)

## Desired End State

Common literal text heredocs and Claude Code's quoted commit-message idiom get neutral output. Shell or interpreter input, executable expansions, and ambiguous heredoc routes receive an actionable denial. Unterminated heredocs fail closed, and ordinary commands before or after the body retain their existing checks. Guarded events at or below 64 KiB retain existing validation. A valid larger event exits 2 when scoped to a step and exits 0 with no output otherwise.

### Key Discoveries

- Bash queues heredoc bodies at the command-line newline, matches the whole delimiter line, strips only leading tabs for `<<-`, and expands unquoted bodies. Command and arithmetic substitutions can execute even if the recipient only copies text. [Bash redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents) · [POSIX shell redirections](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_07_04)
- The current scope predicate requires the exact plugin type and the presence of an agent ID. Claude Code can emit `agent_type` for a main session selected with `--agent`; a present but invalid step ID still requires fail-closed handling. [Identity check](../../../skills/10x-pipeline/scripts/step-guard.mjs#L121) · [Claude Code hook input fields](https://code.claude.com/docs/en/hooks#common-input-fields)
- The router reads only the canonical Progress section for completion. The local CLI tests feed inert JSON to the hook and already pin the hook registration, exit status, stdout and side-effect boundary. [Progress reader](../../../skills/10x-pipeline/scripts/state.mjs#L260) · [Hook test harness](../../../skills/10x-pipeline/test/step-guard.test.mjs#L14)

## Scope Boundary

This change covers heredoc-aware Bash classification and the hook's input budget. General shell wrapper and alias coverage belongs to the follow-on change. Hook wiring, agent mapping, routing and persisted run state continue to use their existing contracts. [Follow-on change](../step-guard-bypass-forms/change.md) · [Current runtime scope](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

## Implementation Approach

Treat heredoc parsing and envelope sizing as two independently verifiable phases in the existing standalone script. For heredocs, identify the recipient and shell context before treating the body as data. Deny code-bearing and ambiguous forms without interpreting the body. For oversized events, classify the complete top-level envelope with bounded memory after the ordinary buffer hits its cap. Use the same identity predicate on both paths.

The unattended planning assumptions are that the existing direct-command subset should stay bounded, that literal `cat` and `tee` text routes and the specified Git message capture form the supported starting set, and that a scoped event beyond 64 KiB should retain the existing exit-2 behavior. These follow the ticket's documented fail-closed choices, the current parser boundary, and the shipped limit tests. The two-phase split follows the independent command scanner and stdin reader. [Change request](change.md) · [Current scope](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance) · [Existing limit tests](../../../skills/10x-pipeline/test/step-guard.test.mjs#L128)

## Phase 1: Parse and classify heredocs

### Overview

Consume heredoc text at the correct delimiter and retain guarded checks on the executable parts of the command.

### Changes Required:

#### 1. Heredoc recognition and data routing

**File** `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent** Teach the existing shell scanner to identify where each body starts and ends, and skip it as data only when the shell context supports that decision.

**Contract** Support `<<WORD`, `<<'WORD'`, `<<"WORD"` and `<<-WORD`, including ordinary spacing and input redirection adjacent to words. Preserve `<<<` as a here-string and leave escaped, quoted and commented operator text literal. Associate each heredoc with its command and consume multiple bodies in declaration order at the applicable shell newline. Match the entire closing line after delimiter quote removal and, for `<<-`, strip leading tabs only. For unquoted bodies, observe Bash's backslash-newline rules before matching a delimiter or checking expansions. An unsupported delimiter syntax or a missing terminator fails closed with a diagnostic naming the form and a safe alternative.

Allow simple literal `cat` and `tee` text processing, including ordinary file output and pipelines composed solely of recognized data consumers. Recognize `git commit -m "$(cat <<'EOF'` with a body, a standalone `EOF` line and a closing `)"` as a literal message argument when the substitution contains only that data capture. Resume tokenization in the correct quote context after the substitution. Before skipping any body, deny heredocs consumed directly or through a pipe by a shell, interpreter or unclassified command. Apply the same conservative decision to uncertain routing such as a dynamic executable, compound pipeline or a substitution whose result may be executed. Quoted body text is literal. For an unquoted body, deny executable expansion syntax, including command substitution, backticks and arithmetic expansion, with guidance to quote the delimiter for literal text or use the Write tool. Use the existing JSON denial channel for recognized unsafe forms and the existing exit-2 path for parse failures. Preserve the direct command and flag checks on the surrounding tokens, including on the opener and immediately after the terminator. Keep the original non-heredoc behavior and execute no shell from the hook.

#### 2. Paired heredoc regression tests

**File** `skills/10x-pipeline/test/step-guard.test.mjs`

**Intent** Make the false positives and the matching fail-closed boundaries observable through the shipped hook entry point.

**Contract** Put allow and deny cases together and assert actual status and output. Pair literal apostrophes, quotes and command-shaped prose with a directly invoked shell, interpreter and shell downstream of one or more text consumers. Pair inert quoted substitution text with the same text under an unquoted delimiter. Pair the requested Git message capture with versions carrying a real denied flag or an additional executable command inside the substitution. Pair harmless text with a real denied command after the delimiter. Cover all four opener forms, FIFO bodies, exact delimiter matching including trailing spaces and tab indentation, a supported here-string, Bash continuation behavior, and an unterminated body whose diagnostic mentions heredocs. Submit denied strings as inert hook input.

### Success Criteria:

#### Automated Verification:

- The focused hook suite passes with paired heredoc cases and all legacy direct denials using `node --test skills/10x-pipeline/test/step-guard.test.mjs`.

## Phase 2: Apply the byte cap to guarded steps

### Overview

Classify oversized envelopes without buffering their commands so the guard's size limit affects only the intended step sessions.

### Changes Required:

#### 1. Bounded event identity reader

**File** `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent** Preserve the ordinary JSON path while making identity discovery independent of the total byte size of an unrelated event.

**Contract** Keep at most 64 KiB of full event data for the existing UTF-8 JSON path. When the byte limit is crossed, use a bounded streaming JSON projection of the full envelope to determine the effective top-level `agent_type` and whether `agent_id` is present. Discard irrelevant values as they are read, including strings longer than the cap. Carry syntactic state across chunk boundaries and validate through EOF. Bound structural nesting independently of string size, with room for the documented Bash envelope. Match the existing `JSON.parse` identity semantics for property order, escaped strings and duplicate properties, including that absent ID differs from a present invalid ID. Embedded strings and nested keys carry no identity authority. Pass a valid non-step Bash envelope through with exit 0 and empty stdout and stderr. Report a scoped oversized event on stderr with exit 2 and no stdout. Keep malformed JSON, non-object events and unclassifiable envelopes fail-closed. Preserve the import-free, stdin-only hook and five-second host timeout.

#### 2. Byte cap regression tests

**File** `skills/10x-pipeline/test/step-guard.test.mjs`

**Intent** Prove that a hook payload's authoritative session identity determines the large-input result.

**Contract** Compare the same oversized command in ordinary main, main with step type only, unrelated subagent, and guarded step sessions. Exercise the exact byte boundary and a multibyte case, authoritative fields after a large command, nested or string-spelled identity decoys, escaped keys or values, and effective duplicate properties. Pair valid oversized passthrough with malformed or truncated envelopes and a scoped event above the boundary. Keep guarded events below the cap on the existing validation and denial path. Use deterministic data and the existing per-process timeout.

#### 3. Hook behavior reference

**File** `docs/REFERENCE.md`

**Intent** Describe the updated budget and the heredoc handling users observe when the hook runs.

**Contract** In “Step safety and pre-publication acceptance,” document the scoped 64 KiB limit, neutral oversized non-step behavior, the supported data heredocs and the actionable fail-closed cases. Preserve the stated runtime coverage boundary for other shell forms. [Current reference](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance) · [Documentation lesson](../../foundation/lessons.md#grep-every-doc-for-the-old-behavior-when-a-scripts-output-changes)

### Success Criteria:

#### Automated Verification:

- The focused hook suite passes the paired byte-cap, identity and malformed-envelope cases using `node --test skills/10x-pipeline/test/step-guard.test.mjs`.
- The full repository suite passes using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification:

- In a fresh Claude Code `agent-smith:step` subagent with the updated plugin installed, both reported `cat` heredocs run, the reported quoted heredoc commit message works in a scratch Git repository, and the hook denies `gh --version` before it runs.

## Testing Strategy

Use the existing CLI harness for both phases so the tests exercise registration assumptions, process status, decision output and the absence of permission grants. Use inert payloads for denied commands and run the full Node 24+ suite after both changes. For the live check, start a fresh Claude Code 2.1.295+ session that has loaded the updated plugin and launch the step agent. Run the apostrophe and recursive-delete-as-text examples from the ticket. Check the resulting scratch commit message for the intended quote characters and confirm the hook blocks `gh --version`. [Ticket examples](change.md) · [Hook harness](../../../skills/10x-pipeline/test/step-guard.test.mjs#L14)

## Performance Considerations

Keep a single bounded pass over each heredoc body and avoid work proportional to the size of the same text more than a constant number of times. For large envelopes, retain only the bounded prefix, incremental JSON syntax state and identity facts. The existing hook timeout and CLI test timeout give the same five-second constraint. [Hook registration](../../../hooks/hooks.json) · [CLI timeout](../../../skills/10x-pipeline/test/step-guard.test.mjs#L18)

## Migration Notes

The hook consumes the same Claude Code JSON and emits the same decision formats. A fresh session loads the updated hook. Reverting the implementation and reloading the previous plugin restores the old behavior without a data migration. [Hook registration and upgrade behavior](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

## References

- [Change request](change.md)
- [Step guard source](../../../skills/10x-pipeline/scripts/step-guard.mjs) · [Step guard tests](../../../skills/10x-pipeline/test/step-guard.test.mjs) · [Hook registration](../../../hooks/hooks.json)
- [Bash redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents) · [Claude Code hook input fields](https://code.claude.com/docs/en/hooks#common-input-fields)

## Progress

> Use `- [ ]` for pending and `- [x]` for done. Append ` — <commit sha>` when a step lands. Keep row titles stable.

### Phase 1: Parse and classify heredocs

#### Automated

- [ ] 1.1 The focused hook suite passes with paired heredoc cases and all legacy direct denials using `node --test skills/10x-pipeline/test/step-guard.test.mjs`.

### Phase 2: Apply the byte cap to guarded steps

#### Automated

- [ ] 2.1 The focused hook suite passes the paired byte-cap, identity and malformed-envelope cases using `node --test skills/10x-pipeline/test/step-guard.test.mjs`.
- [ ] 2.2 The full repository suite passes using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual

- [ ] 2.3 In a fresh Claude Code `agent-smith:step` subagent with the updated plugin installed, both reported `cat` heredocs run, the reported quoted heredoc commit message works in a scratch Git repository, and the hook denies `gh --version` before it runs.
