<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Step guard heredocs and input limits

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 1 critical, 4 warnings, 2 observations

The verdict, counts, and finding locations describe the implementation at `305dad43` before this review's fixes. The plan's references to the earlier F1–F5 refer to the review saved in `8c924bd7`. Its fixes are in `462d1d5e`, and `6d87094c` added the UDP assertion.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Scope and evidence

Phase 1 added scoped heredoc classification and the opaque Git message operand. The phase commits and earlier triage cover the requested delimiter forms, FIFO consumption, lexical context, continued pipeline routing, expansion checks, denied redirects and preservation of direct-command checks. This review found additional gaps in the same scanner and verified the earlier named regression cases, including the UDP assertion. [Guard](../../../../skills/10x-pipeline/scripts/step-guard.mjs) · [CLI tests](../../../../skills/10x-pipeline/test/step-guard.test.mjs)

Phase 2 matches the planned exact byte handoff, incremental UTF-8 decoding, 64-container cap, full JSON validation and top-level identity matching. The tests cover duplicate type keys, decoys, long values, invalid ID presence, byte-boundary splits and malformed envelopes. The standalone stdin-only entry point, five-second hook and user reference match the plan. [Hook registration](../../../../hooks/hooks.json) · [Runtime reference](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

Two native read-only reviewers checked plan drift and safety. The host supplied no verified child-inclusive token total. Both implementation phases were reviewed because the plan has five completed automated rows and the full review was requested. Manual row 2.3 remains open.

## Findings

### F1 — Compound syntax loses the enclosing heredoc route

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff that needs review of the enclosing route
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:314`, `:332`, `:343` at `305dad43`
- **Detail**: The hook returned neutral for benign heredocs inside a function with an `if` body, a brace group after a nested brace group, and a subshell after a `case` arm. Bash syntax checks accepted the fixtures. The scanner missed compound openings after a function signature or a brace, and a case pattern's parenthesis could close the tracked enclosing subshell. Phase 1 requires a denial for compound routes.
- **Fix**: Track the matching closer per compound and keep command position after group boundaries so each opener is classified. Cover the three forms and a simple heredoc after a completed compound.
  - **Strength** — Keeps the change in the existing heredoc scanner and preserves the enclosing route through nested constructs.
  - **Tradeoff** — The guard tracks the existing supported compound forms using one stack.
  - **Confidence** — HIGH for the covered forms. The guard decisions and Bash syntax were checked independently.
  - **Blind spot** — The live Claude Code case remains pending.
- **Decision**: APPLIED in `b609ef88`.

### F2 — A quoted heredoc marker causes a parse failure in a case condition

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:135`, `:173` at `305dad43`
- **Detail**: Inside a command substitution, an `if case` condition lost command position after `if`. The case pattern's closing parenthesis then appeared to close the substitution. A quoted `<<EOF` was subsequently treated as an unsupported delimiter. That Bash-valid non-heredoc input had neutral output before the change.
- **Fix**: Share command-prefix tracking with the substitution scanner and keep the enclosing parenthesis depth while recognizing case patterns.
- **Decision**: APPLIED in `b609ef88`.

### F3 — An unsupported Git message capture reports an internal error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:257` at `305dad43`
- **Detail**: With a redirect before the Git subcommand, an operator token had no word value and reached the Git options parser. The hook exited 2 with a JavaScript TypeError. Phase 1 requires an actionable JSON denial for recognized unsupported capture forms.
- **Fix**: Validate the capture's command and word shape before parsing Git options.
- **Decision**: APPLIED in `b609ef88`.

### F4 — A literal dollar in a destination is treated as a computed filename

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:118` at `305dad43`
- **Detail**: The guard denied a text heredoc redirected to the double-quoted filename `"notes$"` because it classified every unescaped dollar as expansion syntax. Bash treats the terminal dollar as literal.
- **Fix**: Check for an expansion introducer after folding escaped newlines. Pair the literal filename with the existing computed-destination denial.
- **Decision**: APPLIED in `b609ef88`.

### F5 — Escaped newlines split the recognized Git message capture

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:185`, `:200` at `305dad43`
- **Detail**: An escaped newline inside the literal `cat` word or before the outer closing quote caused a denial. Bash removes those continuations, leaving the same separate message operand.
- **Fix**: Recognize continuations in the capture's fixed command word and closing syntax, then keep checking the complete operand boundary.
- **Decision**: APPLIED in `b609ef88`.

### F6 — Fresh Claude Code acceptance lacks host evidence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the owner needs one live acceptance check
- **Dimension**: Success Criteria
- **Location**: [Progress row 2.3](../plan.md#progress)
- **Detail**: Local evidence covers the hook decisions and both text outputs. It records the message passed to a zsh stand-in and the reported message syntax failing under Bash 3.2. The live guarded child, actual scratch commit and pre-execution hook denial lack evidence. [Manual evidence](../evidence/unproven.md)
- **Decision**: PENDING because this full review had local CLI and Bash evidence only. The owner must decide when to run fresh Claude Code acceptance with the updated plugin and record all four outcomes before closing row 2.3.

### F7 — The follow-on ticket still summarizes the original byte cap

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the owner can update the follow-on baseline
- **Dimension**: Scope Discipline
- **Location**: [Follow-on change](../../step-guard-bypass-forms/change.md)
- **Detail**: The follow-on ticket lists input over 64 KiB as an exit-2 condition. The runtime reference records the scoped cap and oversized JSON validation.
- **Decision**: PENDING because the description belongs to the follow-on change. Its owner must decide whether to label it as the original audit baseline or update it before implementation.

## Automated verification

The focused suites passed on the original fixtures. With the added fixtures and before the fixes, all three selected heredoc tests failed. Separate inert probes reproduced the compound-route acceptance and the internal Git diagnostic. Five benign syntax fixtures also passed `/bin/bash -n`.

| Progress | Command | Result after fixes |
| --- | --- | --- |
| 1.1, 2.1 | `node --test skills/10x-pipeline/test/step-guard.test.mjs` | 19 passed |
| 1.2 | `node --test --test-name-pattern='only an entire separate\|heredoc delimiters' skills/10x-pipeline/test/step-guard.test.mjs` | Both the message operand and delimiter/body escape tests passed |
| 1.3 | `node --test --test-name-pattern='heredocs distinguish' skills/10x-pipeline/test/step-guard.test.mjs` | The named route test passed, including the descriptor, TCP and UDP assertions |
| 2.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 1,927 passed, 3 expected skips, 0 failures |

The full suite ran with Node.js 24.19.0 and `GH_LIVE` unset. The review read the existing manual evidence and preserved the plan's Progress section.
