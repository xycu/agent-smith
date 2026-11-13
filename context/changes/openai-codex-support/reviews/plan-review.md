<!-- PLAN-REVIEW-REPORT -->
# Plan Review: OpenAI Codex Support Implementation Plan

- **Plan**: `context/changes/openai-codex-support/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-13
- **Verdict**: SOUND
- **Findings**: 1 critical, 1 warnings, 0 observations

Initial review verdict was REVISE. The owner triaged both findings and authorized the targeted plan fixes below. Both are now FIXED in the plan and brief; no product implementation or live permission validation was performed.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 existing paths verified, 5/5 symbols verified, brief and plan consistent. New runner, preset, test and ADR paths are explicitly planned additions. Four phases have 19 matching unchecked Progress rows after the F1 acceptance check was added. No optional contract-surfaces document exists in this repository.

Deep verification used one independent subagent to check runner permissions, run locking, archive identity, baseline comparisons and PR-comment semantics against code. The primary reviewer verified decisive code paths and the official sandbox documentation. No runtime/model tests were run.

## Findings

### F1 — Runner permissions prevent required commits

- **Severity**: CRITICAL
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Standalone action execution
- **Detail**: The original plan fixed workspace-write sandboxing and `approval_policy="never"`, but Codex protects `.git` and the resolved Git directory of a linked worktree as read-only. The implementation prompts require typed commits before RESULT (`skills/10x-pipeline/policy.json:224`, `:267`, `:286`; `prompts/os-apply.md:25`; `prompts/os-archive.md:11`). Strict executor verification reads commit evidence in `scripts/steps.mjs:77–98`, and `route.mjs:82–84` attaches/verifies the result before the router's own commit sweep. That later sweep cannot satisfy the child's pre-RESULT commit contract. Source: [Codex protected paths](https://learn.chatgpt.com/docs/agent-approvals-security#protected-paths-in-writable-roots).
- **Fix A — Recommended**: Preserve child-owned commits and prove Git capability under the existing effective Codex configuration before model launch. A named configuration profile is optional.
  - Strength: Preserves existing phase commits, Progress SHAs and verification ordering.
  - Tradeoff: Execution depends on actual Git capability under the existing configuration and host restrictions. The runner cannot force the original fixed permission settings.
  - Confidence: MEDIUM — the original incompatibility and profile CLI support are established; an actual selected profile still needs validation.
  - Blind spot: Effective permissions inherited from each host and the actual linked-worktree Git paths.
- **Fix B**: Move required Git operations into an authorized parent orchestration boundary.
  - Strength: Keeps the child restricted while placing Git operations outside its sandbox.
  - Tradeoff: Broader redesign of per-phase commits, SHA recording and verification timing.
  - Confidence: MEDIUM — the router already owns some Git operations, but not the required per-phase timing.
  - Blind spot: Preserving multiple phase commits during one child execution.
- **Decision**: FIXED — Owner selected Fix A. Plan/brief preserve existing Codex configuration by default, support optional user-selected `codex.profile`, preserve its nullable choice in dispatch/retry identity, remove forced workspace-write/never-approve overrides, require model-free permission preflight and real linked-worktree Git checks in Phase 2, and fail closed without automatic permission broadening. During implementation the owner questioned the named-profile prerequisite; that unnecessary requirement was removed while retaining Git-capability checks. Added canonical Progress row 2.5; all earlier row IDs and titles remain unchanged. This fixes the plan contract, not an already implemented runtime.

### F2 — Run lock misses a mutating command

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Lifetime, lock and cancellation
- **Detail**: The plan promised that concurrent mutating router commands would refuse while a child held the shared lock. Current `scripts/route.mjs:854` locks only `init`, `next` and `usage`; `status --report` writes through `writeReport` at `:694–700` without acquiring it.
- **Fix**: Add `status --report` to shared lock coverage before report writes, retain unlocked read-only `status`, and add both-chain contention/release checks to `test/run-lock.test.mjs`.
- **Decision**: FIXED — Owner requested the plan fix. Phase 2 now includes `route.mjs`, explicitly names all four mutating command forms, requires report bytes to remain unchanged on contention, and tests unlocked plain status plus report writes after lock release. Brief records the same decision. Existing Progress criterion 2.3 already covers these process-contention checks; no row was renamed.

## Triage Summary

- Fixed: F1 (Fix A), F2.
- Skipped: none.
- Accepted risks: none added through triage.
- Dismissed: none.
- Verdict after fixes: REVISE → SOUND.

Runtime capability remains unproven until the plan's permission-preflight and live acceptance criteria pass. SOUND means the revised plan addresses the identified blockers; it does not claim Codex compatibility has already shipped or passed testing.
