<!-- IMPL-REVIEW-REPORT -->
# Implementation review — Step guard heredocs and input limits

- **Plan**: [Step guard heredocs and input limits](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

The verdict and counts describe `5cbd6d36`, the commit reviewed before triage. The plan refers to earlier findings in the reports saved at `8c924bd7` and `1b00e212`.

## Verdicts

| Dimension | Verdict | Evidence |
| --- | --- | --- |
| Plan Adherence | WARNING | F1 and F2 affect Phase 1 route classification. Phase 2 implements the planned byte and nesting limits. |
| Scope Discipline | PASS | Product changes are confined to the standalone hook, its CLI tests and the runtime reference. F5 belongs to a follow-on change. |
| Safety & Quality | WARNING | F1 concerns the output destination. F3 concerns the cost of validating repeated message operands. |
| Architecture | PASS | The existing Bash hook owns both classifications. It reads stdin and uses no external dependency. |
| Pattern Consistency | PASS | Regression assertions use the existing CLI harness and exercise the shipped hook. |
| Success Criteria | WARNING | Five automated rows have local evidence. Manual row 2.3 remains open. |

## Findings

### F1 — Output descriptor validation misses tee file operands

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the existing descriptor check covers the required paths
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:215` at `5cbd6d36`
- **Detail**: The route classifier checks descriptor paths used in shell redirects. It accepts every literal argument to `tee`, which also opens its output paths. The plan requires ordinary literal destinations throughout the pipeline.
- **Fix**: Share the descriptor-path check between the two output forms. Keep Bash socket-path handling in the shell redirect branch. Pair an ordinary append destination with a descriptor operand in the CLI test.
- **Decision**: APPLIED in `7f2a72f3`.

### F2 — An expanded word can be mistaken for a shell keyword

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the lexer already records whether a word is bare
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:114` at `5cbd6d36`
- **Detail**: When the lexer skips a substitution, the remaining characters can spell a reserved word. The compound tracker then opens a clause and denies a literal heredoc on a subsequent line. The added CLI fixture received this denial before triage.
- **Fix**: Mark the word as non-bare when consuming the substitution. Check the later plain heredoc alongside the existing real-compound denial.
- **Decision**: APPLIED in `7f2a72f3`.

### F3 — Each captured Git message rescans earlier arguments

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — validation can reuse the existing operand indexes
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/step-guard.mjs:270` at `5cbd6d36`
- **Detail**: Each capture searches the list of valid operands, copies its token prefix, then scans that prefix. Repeated message arguments make validation quadratic within the guarded event size limit.
- **Fix**: Index the valid message positions in a set and scan the stage once against the final capture position. Test two literal messages and the denial for a computed argument between captures.
- **Decision**: APPLIED in `7f2a72f3`.

### F4 — Fresh Claude Code acceptance still needs host evidence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — one live acceptance row remains
- **Dimension**: Success Criteria
- **Location**: [Progress row 2.3](../plan.md#progress)
- **Detail**: Local probes observed both literal text outputs and the hook decisions. Bash 3.2 rejected the commit-message syntax, while zsh passed one argument to a stand-in. Evidence for the actual scratch commit and the pre-execution denial in a fresh guarded Claude Code child is still missing. [Recorded evidence](../evidence/unproven.md)
- **Decision**: PENDING because the available host evidence covers local probes. The owner must decide when to run and record row 2.3 in a fresh Claude Code session with the updated plugin.

<a id="f7--the-follow-on-ticket-still-summarizes-the-original-byte-cap"></a>

### F5 — The follow-on ticket describes the original byte cap

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the follow-on owner controls the ticket wording
- **Dimension**: Scope Discipline
- **Location**: [Follow-on change](../../step-guard-bypass-forms/change.md)
- **Detail**: The follow-on ticket describes the original cap as an unconditional exit 2. Phase 2 and the current reference scope that outcome to oversized guarded events when the envelope is valid. [Runtime reference](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)
- **Decision**: PENDING because the plan assigns that ticket to the follow-on change. Its owner must decide whether to label the old behavior as historical or update the baseline.

## Verification

| Progress | Command | Result after triage |
| --- | --- | --- |
| 1.1, 2.1 | `node --test skills/10x-pipeline/test/step-guard.test.mjs` | 19 passed, including direct-command denials, delimiter handling, exact byte boundaries, decoded identity, malformed envelopes and the 64-container limit. |
| 1.2 | `node --test --test-name-pattern='only an entire separate\|heredoc delimiters' skills/10x-pipeline/test/step-guard.test.mjs` | Both the delimiter/body escapes test and the separate message operand test passed. |
| 1.3 | `node --test --test-name-pattern='heredocs distinguish' skills/10x-pipeline/test/step-guard.test.mjs` | The named route test passed, including the descriptor, TCP and UDP fixtures. |
| 2.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 1,927 passed, 0 failed, 3 skipped (two live GitHub checks and the conditional CLAUDE.md check). |

Verification used Node.js 24.19.0 with `GH_LIVE` unset. Before triage, all 19 original focused tests passed. The new expanded-word fixture failed on the original implementation. The repeat-capture finding follows from the loop structure. The regression checks verify its decisions without a machine-dependent time threshold.

The first full-suite attempt was interrupted after three executor fixtures discovered the enclosing worktree's Git HEAD. The three fixtures passed with Git discovery stopped at the scratch parent. The full command then passed under the same isolation.

The explicit full-plan request includes Phase 2 with its manual row open. Native read-only reviews `/root/drift` and `/root/quality` checked plan coverage and safety respectively. The host supplied no verified child-inclusive token total.
