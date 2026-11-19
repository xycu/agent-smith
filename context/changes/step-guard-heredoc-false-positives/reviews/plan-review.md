<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Step guard heredocs and input limits

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 1 observation

The verdict and counts describe the submitted plan. The decisions record the edits applied during triage.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Verified all three implementation paths, four supporting paths, and five guard symbols (`commands`, `commandProblem`, `gitProblem`, `eventProblem`, and `MAX_INPUT_BYTES`). The brief matched the submitted phases and scope. Both phase headings and all four Success Criteria matched canonical Progress. Automated acceptance required local tests. The manual scratch-repository check required no publication. [Guard](../../../../skills/10x-pipeline/scripts/step-guard.mjs) · [Guard tests](../../../../skills/10x-pipeline/test/step-guard.test.mjs) · [Reference](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

The hook registration and provenance hash both name the standalone script. Keeping the parser there preserves the existing entry point and provenance coverage. The documentation sweep found the active byte-cap contract in the implementation plan's named reference section. [Hook registration](../../../../hooks/hooks.json) · [Provenance reader](../../../../skills/10x-pipeline/scripts/isolation.mjs#L82) · [Provenance tests](../../../../skills/10x-pipeline/test/provenance.test.mjs#L501) · [Follow-on change](../../step-guard-bypass-forms/change.md) · [Project lesson](../../../foundation/lessons.md#grep-every-doc-for-the-old-behavior-when-a-scripts-output-changes)

The read-only codebase verification included a Bash syntax check and a Node decoding check. Verified token usage for that pass is unknown.

## Findings

### F1 — Prove the complete heredoc route before allowing it

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff that needs a design decision
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Heredoc recognition and data routing
- **Detail**: The plan asked for the recipient to be classified before the body was skipped. Bash can resume a pipeline after the body terminator, so the opener alone may omit a downstream consumer. The existing scanner flattens separators and consumes the newline following a comment. Reusing that behavior at the opener could hide a pipeline stage or place the body at the wrong boundary. A syntax-only Bash check confirmed the continuation using a harmless text pipeline. [Existing scanner](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L19) · [POSIX heredoc processing](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_07_04)
- **Fix**: Preserve local pipe, redirection and newline context, then classify the whole route before deciding. Add paired continued-pipeline cases and cover trailing comments and unresolved redirections.
  - **Strength**: Keeps body recognition and permission decisions separate while preserving the bounded literal-command scope.
  - **Tradeoff**: The scanner must retain context until the pipeline ends.
  - **Confidence**: HIGH. The Bash syntax check and scanner structure show where the decision needs to move.
  - **Blind spot**: Host-specific behavior still has its planned manual check.
- **Decision**: APPLIED in Implementation Approach and Phase 1, Heredoc recognition and data routing and Paired heredoc regression tests, with matching plan brief updates.

### F2 — Preserve the Git message operand and surrounding flags

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, Git message capture
- **Detail**: The plan restored quote context but left the scanner's output contract implicit. The current Git checker advances by one word for a separate `-m` operand. Dropping the capture's word could cause it to consume the following flag. Feeding the captured prose back to the scanner would also lose the distinction between one quoted operand and executable tokens. [Git option scanner](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L61)
- **Fix**: Allow the exact capture in the proved `git commit -m` operand, emit one opaque word, and test empty and flag-shaped messages alongside genuine denied flags before and after it.
- **Decision**: APPLIED in Phase 1, Heredoc recognition and data routing and Paired heredoc regression tests, with a matching Key Decisions entry in the brief.

### F3 — Define how unquoted expansion is classified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 1, Unquoted heredoc handling
- **Detail**: Detecting the listed command, backtick and arithmetic forms alone leaves parameter expansion and uncertain interpolation underspecified. Bash applies heredoc-specific escapes and folds backslash-newline before matching the closing line, so isolated physical-line checks can miss an active expansion or reject a literal marker. [Bash heredoc rules](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents) · [Bash parameter expansion](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html)
- **Fix**: Apply the heredoc escape and continuation rules before checking for active expansions. Deny ambiguous interpolation with the existing literal-text guidance and pin escaped, quoted and joined markers in the regressions.
- **Decision**: APPLIED in Phase 1, Heredoc recognition and data routing and Paired heredoc regression tests, with a matching Key Decisions entry in the brief.

### F4 — Define the overflow reader's compatibility boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff that needs a design decision
- **Dimension**: Blind Spots
- **Location**: Desired End State and Phase 2, Bounded event identity reader
- **Detail**: The original contract promised passthrough for valid larger events while leaving the depth cutoff, UTF-8 behavior and allocation for unusually long keys and type values unspecified. The existing path decodes bytes before `JSON.parse`; a local Node check showed that a default streaming `TextDecoder` drops the leading BOM rejected by the current path. The existing scope check returns before guarded-field validation for unrelated objects. [Current scope and decoder](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L121) · [Host timeout](../../../../hooks/hooks.json#L13)
- **Fix**: Preserve byte and decoding semantics at the overflow transition, keep identity comparisons bounded, and validate the grammar through EOF. Document the 64-open-container limit and timeout, and verify both sides of those boundaries where local fixtures can give deterministic results.
  - **Strength**: Preserves classification for the normal Bash envelope and prevents retained data from growing with irrelevant strings or excessive nesting.
  - **Tradeoff**: A syntactically valid oversized object outside those resource limits fails closed.
  - **Confidence**: HIGH for decoding and scope compatibility. The depth of 64 is a review assumption sized for the documented shallow envelope with room for nested metadata.
  - **Blind spot**: The implementation's throughput within the five-second budget remains to be verified. [Claude Code hook input](https://code.claude.com/docs/en/hooks#common-input-fields)
- **Decision**: APPLIED in Desired End State and Phase 2, Bounded event identity reader, Byte cap regression tests and Hook behavior reference, with matching plan brief updates.

### F5 — Keep the full-suite command local under inherited environments

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy and Phase 2, full-suite criterion
- **Detail**: The repository command works locally with its default environment. An inherited `GH_LIVE=1` opts into real GitHub calls, even though the phase only requires pre-publication evidence. [Opt-in live tests](../../../../skills/10x-pipeline/test/pr-comment.test.mjs#L844) · [Pre-publication acceptance](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)
- **Fix**: Specify `GH_LIVE` unset in the testing procedure and brief. Retain the existing full-suite criterion and local fake-client tests.
- **Decision**: APPLIED in Testing Strategy and the plan brief's Success Criteria summary.
