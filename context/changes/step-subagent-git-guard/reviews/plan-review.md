<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Step subagent Git and deletion safety

- **Plan**: context/changes/step-subagent-git-guard/plan.md
- **Mode**: Deep
- **Date**: 2026-11-15
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warning, 0 observations

The verdict and counts describe the plan before these edits. Both findings have clear fixes and were applied. No finding remains pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding verified 30 existing file paths, with 8 additional paths intentionally introduced by the plan. Source line suffixes resolve to their containing files. The brief and plan agree on phases, ownership, scope and compatibility. Progress has one final heading, 3 matching phases and 14 rows matching the phase Success Criteria.

Verified the riskiest claims directly in this subagent under the flat-delegation rule.

- `ruleTail` reads step rules by routed step name and appends the shared top rules last. Planning variants retain their `plan` or `plan-review` step names. Normal and archive assembly use this carrier. Sources in `skills/10x-pipeline/scripts/flow.mjs` around lines 692 and 891, `route.mjs` around line 219, and `isolation.mjs` around line 739.
- `stepAgent` feeds both normal dispatch and OpenAI capability rejection. A provider-aware default must preserve that restricted-selection contract. Archive dispatch is assembled separately, and historical neutral retries replay stored `agent` fields without reconstructing them. Sources in `flow.mjs` around lines 438 and 981, `route.mjs` around line 240, and `isolation.mjs` around line 622.
- Existing agent and rule provenance sections fit the proposed additional hook section. Plugin copies and exact-key expectations are already included in the planned test scope. Sources in `isolation.mjs` around line 52 and `test/agents.test.mjs`, `test/provenance.test.mjs`, `test/rule-levels.test.mjs`.
- Both orchestrator skills already forward a supplied `agent` into native dispatch, including the archive branch. Their current interface supports the design without a skill rewrite.
- Authoritative Claude documentation confirms plugin-level hooks run inside subagents, plugin agent types are namespaced, omitted tool lists inherit tools, exec-form hooks accept argument vectors, and `onFailure: block` requires 2.1.295+. Plugin agent-frontmatter hooks remain unsupported. Sources appear below.

The blast-radius sweep covered dispatch callers, archive descriptors, neutral replay, provenance consumers, scratch plugin copies, provider rejection, prompt handoff, deletion scanning and active documentation. Existing responsible layers support the proposed changes.

## Findings

### F1 — Stage-only restore can discard unique staged work

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff requiring a deliberate safety choice
- **Dimension**: Blind Spots
- **Location**: Rule semantics, Phase 2 Native hook, Guard matrix, Progress row 2.2
- **Detail**: The original plan says stage-only restore safely unstages work and explicitly permits it. `git restore --staged` restores index contents from HEAD by default. After staging version B and then editing the working copy to version C, this operation replaces the index with version A from HEAD. Version B then has no worktree, index or referenced commit holding it. This violates the plan and repository invariant that unique uncommitted work is preserved. The hook deliberately performs no Git state reads, so it cannot establish a safe index rewrite. The authoritative Git manual defines these restore semantics. [Git restore manual](https://git-scm.com/docs/git-restore)
- **Fix**: Preserve staged-only contents in the shared semantic rule and deny direct stage-only restore in the stateless hook. Add a denial fixture for distinct HEAD, index and worktree versions and ensure the recording executable remains uncalled. Explain the corrected interpretation of retained row 2.2 in its Phase block.
- **Strength**: Enforces preservation through the existing bounded guard and adds no repository inspection or snapshot implementation.
- **Tradeoff**: The direct shell subset also denies a stage-only restore whose safety the hook cannot prove.
- **Confidence**: HIGH, grounded in Git index semantics and the explicit no-state-read hook contract.
- **Blind spot**: Live host delivery remains a planned Manual check.
- **Decision**: APPLIED — changed Rule semantics, Phase 2 Native hook and Guard matrix in plan.md, and Open Risks & Assumptions in plan-brief.md. Progress row 2.2 retains its exact original title, index and tick state, with the required interpretation note in Phase 2.

### F2 — Supported plugin versions exceed the proven hook coverage

- **Severity**: WARNING
- **Impact**: LOW — the compatibility clarification is narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Harness evidence and limits, Phase 2 Provenance and regressions, Phase 3 Reference and decisions
- **Detail**: The plan correctly identifies 2.1.295 as the minimum for `onFailure: block`, while README.md line 30 advertises Claude Code 2.1.292+. The proposed documentation file list omits README.md and leaves that supported-version gap implicit. A supported install on 2.1.292–2.1.294 therefore has no established fail-closed runtime guarantee. Payload tests and plugin schema validation alone also permit a future hook registration to omit `onFailure` while its command classification tests continue passing. The hooks reference explicitly documents fail-open startup and timeout behavior without the blocking setting. [README.md](../../../../README.md) · [Claude hook failure handling](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)
- **Fix**: Preserve the existing overall plugin baseline, add README.md to Phase 3 and document 2.1.295+ as the separate fail-closed guard requirement. State the older-host limitation in the full plan and brief. Pin the synchronous hook registration, argument vector, bounded timeout and `onFailure: block` in the hook tests.
- **Decision**: APPLIED — changed Harness evidence and limits, Phase 2 Provenance and regressions, Phase 3 Reference and decisions and Guard matrix in plan.md, and Phases at a Glance prerequisites in plan-brief.md.

## Applied decisions and assumptions

All actionable findings were applied under the supplied unattended triage instruction. The existing plugin-wide minimum remains 2.1.292+, and the hook-specific fail-closed requirement is documented separately using the upstream version requirement. The stateless hook conservatively denies index restore when preservation cannot be established, following the repository safety invariant. These choices require no owner decision.

The review skill normally updates change.md and delegates deep verification. The supplied file allowlist and flat-delegation rules govern this run, so verification was performed here and edits are confined to plan.md, plan-brief.md and this review.

## Verification and remaining limits

Checked original Progress correspondence with phase Success Criteria before editing. The entire Progress section remains byte-identical after the fixes. Rechecked plan/brief agreement and review parsing through the repository readers. No implementation code changed during this review. The implementation test suites and live Claude probes remain future acceptance work.

## Sources

- [Claude hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude subagent configuration](https://code.claude.com/docs/en/sub-agents)
- [Claude plugin manifest and default hook discovery](https://code.claude.com/docs/en/plugins-reference)
- [Git restore manual](https://git-scm.com/docs/git-restore)
- Repository source references above were inspected in this run worktree. Node 24.19.0 and Claude Code 2.1.311 were verified with their version commands. The local CLI help confirms `claude plugin validate . --strict` is supported.
