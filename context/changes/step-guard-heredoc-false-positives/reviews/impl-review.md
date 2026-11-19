<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step guard heredocs and input limits

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 2 critical, 3 warnings, 2 observations

The verdict, counts and finding locations describe the implementation at `2a5fd7a5` before triage. Each decision records the current state of its finding.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Scope and evidence

The implementation commits for phases 1 and 2 are `2c0cecae` and `2e33763f`. Phase 1 provides the planned literal routes, opaque Git message operand and paired CLI fixtures, with the lexical gaps listed below. Phase 2 implements the exact byte handoff, bounded JSON syntax validation, and top-level identity projection with one decoder. Its tests exercise the required boundaries, and a read-only cross-check agreed with `JSON.parse` and the scope predicate on 5,000 deterministic valid and mutated inputs across varied byte splits. The standalone stdin-only entry point and synchronous five-second hook registration match the plan. [Guard](../../../../skills/10x-pipeline/scripts/step-guard.mjs) · [CLI tests](../../../../skills/10x-pipeline/test/step-guard.test.mjs) · [Hook registration](../../../../hooks/hooks.json) · [Reference](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

Both review workers returned read-only findings. The host supplied no verified child-inclusive token total. The full review covers phase 2 even though its live acceptance row remains open, as requested.

## Findings

### F1 — Substitution and arithmetic syntax could hide heredocs

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:88–110`
- **Detail**: The shell lexer compared raw adjacent characters when it classified a substitution opener. An escaped newline can join the opener in Bash, and an inert out-of-position heredoc capture received neutral output. The scanner also treated a double opening parenthesis as arithmetic without checking its closing pair. Bash can parse the unmatched form as nested shell commands, and inert captures in that form received neutral output. These paths conflict with phase 1's restriction to the proved Git message operand and its fail-closed routing contract.
- **Fix**: Recognize substitution openers across escaped newlines, pass the actual opening delimiter into the expansion scanner, and apply the same rule to the allowed message capture. Require an arithmetic closing pair before interpreting a possible heredoc operator as a shift.
- **Decision**: APPLIED in `462d1d5e`.

### F2 — Reserved command prefixes hid compound routing

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — needs careful review of the heredoc route
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:273–306`
- **Detail**: Compound depth missed brace groups after Bash timing or negation prefixes. Inert heredocs inside those groups received neutral output even though the enclosing compound can route the output. The same position check could lose outer depth when a nested compound begins after a clause keyword.
- **Fix**: Track compound command positions through reserved prefixes and clause keywords in one pass. Pin prefixed and nested groups with literal-text payloads.
  - **Strength** — Keeps compound routes fail-closed inside the existing heredoc classifier.
  - **Tradeoff** — The classifier tracks the supported reserved prefixes and leaves general shell coverage to the follow-on change.
  - **Confidence** — HIGH for the covered cases. The previous neutral output reproduced with inert CLI input.
  - **Blind spot** — Fresh-host integration remains pending.
- **Decision**: APPLIED in `462d1d5e`.

### F3 — Continued redirection and control operators split into separate tokens

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:17–25`
- **Detail**: The heredoc operator recognized escaped newlines, while the other operator rules required physical adjacency. A literal append target and a logical OR next to a harmless heredoc each received a route denial when their operators crossed a continued line.
- **Fix**: Match the longest supported operator after folding escaped newlines and add regressions for both legal routes.
- **Decision**: APPLIED in `462d1d5e`.

### F4 — A valid closing delimiter at EOF was treated as unterminated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:59–80`
- **Detail**: When the last physical line ended in an escaped newline, the loop reached EOF before comparing the accumulated logical line to the delimiter. Bash accepted the complete delimiter in a benign text probe, while the hook exited 2.
- **Fix**: Compare the final logical line even when the continuation reaches EOF, and keep rejecting partial delimiters.
- **Decision**: APPLIED in `462d1d5e`.

### F5 — Shell-special redirect destinations passed the file check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:191–195`
- **Detail**: The route classifier accepted any literal redirect target. Bash gives descriptor and socket paths special treatment, outside the plan's ordinary file route. [Bash redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Redirections)
- **Fix**: Reject the Bash-special path families in heredoc redirections, retain ordinary literal targets, and document the boundary.
- **Decision**: APPLIED in `462d1d5e`.

### F6 — Fresh Claude Code acceptance lacks host evidence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the owner needs one live acceptance check
- **Dimension**: Success Criteria
- **Location**: [Progress row 2.3](../plan.md#progress)
- **Detail**: Progress records 3 of 4 criteria complete. The existing evidence verifies the local hook decisions and the two text outputs. It records a zsh stand-in for the message and a Bash 3.2 syntax failure. The live guarded child, actual scratch commit and pre-execution denial remain unverified. [Manual evidence](../evidence/unproven.md)
- **Decision**: PENDING because the available host evidence is limited to local probes. The owner must verify the listed cases in a fresh Claude Code step with the updated plugin before closing row 2.3.

### F7 — The follow-on ticket still summarizes the original byte cap

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the owner can update the follow-on baseline
- **Dimension**: Scope Discipline
- **Location**: [Follow-on change](../../step-guard-bypass-forms/change.md)
- **Detail**: The follow-on ticket's description of exit 2 still lists input over 64 KiB without the session scope. The current runtime reference describes the scoped cap and oversized JSON validation.
- **Decision**: PENDING because the description belongs to the follow-on change. Its owner should decide whether to label it as the original audit baseline or update it before implementation.

## Automated verification

All checks used Node.js 24.19.0.

| Progress | Command | Result |
| --- | --- | --- |
| 1.1, 2.1 | `node --test skills/10x-pipeline/test/step-guard.test.mjs` | 19 passed after the fixes |
| 2.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 1,927 passed, 3 expected skips, 0 failures |

The full suite ran with `GH_LIVE` unset. A near-limit inert compound payload also produced a denial in 58 ms locally after prefix tracking moved to a single pass. The additional regression payloads are inert hook input. The focused suite passed before triage, and the new positive regressions exposed the original parser failures before the fixes.
