<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step subagent Git and deletion safety

- **Plan**: context/changes/step-subagent-git-guard/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-15
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 0 observations

The verdict and counts describe the implementation before review fixes. F1 was corrected in 19affb2e3c16a2de2508e5c06be09e2d02be28ab and verified. F2 remains outside the plan scope and needs an owner decision. Manual acceptance remains pending as already recorded in Progress.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Scope and evidence

Reviewed all three phases as explicitly requested, including the implemented work in phases whose Manual rows remain open. Progress contains 11 completed Automated rows and three pending Manual rows (2.6, 2.7, 3.4). The Phase 2 contract explicitly corrects the preserved stage-only-restore wording in row 2.2; conservative denial is intentional, not drift.

The implementation commits are e513e93, afdd5cb and f59e3cd. The review also inspected subsequent bookkeeping and verification changes through e195aa7. The only original dirty file was router-owned agent-smith/run.jsonl; it is excluded from edits and staging.

| Plan area | Evidence and assessment |
| --- | --- |
| Shared safety and planning | Fixed top and step rule files cover both chains, all planning variants, prompt overrides, file handoff and both archive assembly paths. The instruction-form and content tests retain their safety assertions. |
| Scoped Claude identity | dispatchAgent is shared by route.mjs and isolation.mjs. Explicit restricted mappings, the archive mapping contract and OpenAI capability rejection remain distinct. The new agent inherits tools and supplies no routing settings. |
| Historical replay | neutralRetry returns the stored optional agent and prompt; legacy absent fields and custom mappings have regression coverage on both chains. |
| Hook boundary | Registration pins Bash, exec-form arguments, synchronous execution, timeout and fail-closed handling. Event identity is checked before classification. The script has no filesystem, network, execution or router dependency. F1 concerns literal Git option parsing within the documented subset. |
| Provenance | Hook JSON and implementation have a deterministic independent hookFiles hash; ruleFiles and agentFiles retain their owners. Tests cover drift, immutable stored provenance and unreadable hook inputs. |
| Documentation and integration | README, reference, ADR amendments and rule/prompt/test indexes agree about ownership, supported hosts and limits. Both skills retain forwarding and publication ownership without edits. No release fields, WAVES.md, archived context or concurrent-change implementations changed in the reviewed range. |

Existing route/preplan/score fixture changes are required adaptations to the new planning tail. The no-gh source check excludes the standalone classifier while its dedicated test independently forbids execution and external dependencies. Coverage in existing archive/provider suites and the new safety tests satisfies planned scenarios without requiring edits to every listed test file.

## Findings

### F1 — Git option parsing permits destructive commands and rejects safe commits

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:69 (before review fixes)
- **Detail**: The guard treated any dry-run-looking token as a real safety flag, even when Git consumes it as an exclusion pattern. Inert payloads for git clean -e --dry-run -fd, git clean --exclude -n -fd and git clean -en -fd all returned neutral. A later --no-dry-run also failed to cancel the exception. The early split at -- hid --no-verify in git commit -m -- --no-verify, where -- is the message. Conversely, attached messages such as git commit -m"fix: retain work" were denied because the parser interpreted the n inside the message as hook bypass. These are ordinary literal commands inside the documented runtime subset, violating both discard denial and safe-commit acceptance.
- **Fix**: Parse option values before flag classification, consume attached short-option values and separate values before interpreting --, and honor the last real dry-run setting. Extend the existing inert-payload regression to prove denial and safe pass-through.
- **Strength**: Fixes the owning classifier without expanding into a general shell parser or adding repository reads or dependencies.
- **Tradeoff**: The bounded parser explicitly recognizes value-taking Git options; dynamic programs and other documented syntax limits remain outside its scope.
- **Confidence**: HIGH — original payload failures were reproduced, the new regression failed before the correction, and the complete guard suite passes afterward.
- **Blind spot**: Fresh-host hook delivery remains Manual acceptance, separate from payload classification.
- **Decision**: APPLIED — commit 19affb2e3c16a2de2508e5c06be09e2d02be28ab (fix: distinguish Git option values in step guard) changes the owning classifier and its inert-payload regression.

### F2 — Bookkeeping committed operating-system metadata into the plugin

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .DS_Store, added by d2b7534
- **Detail**: The implementation excluded this unrelated file, but the subsequent step bookkeeping commit added it to the tracked plugin. Fresh claude plugin validate . --strict reports ARCHIVE_OS_METADATA_FILE and states that the plugin directory cannot scan or list a package containing it. Validation still exits zero because these directory checks are separate. The existing missing-icon warning is unrelated to this change.
- **Fix**: In a separately authorized packaging cleanup, remove .DS_Store from tracked package contents and ignore generated operating-system metadata; preserve any local file the owner wants to keep.
- **Decision**: PENDING — this unrelated packaging file is outside the plan scope and was added by bookkeeping; the owner must decide whether to remove it from the package and add an ignore rule before directory submission.

## Verification

- Node 24.19.0 meets the Node 24+ floor; Claude Code 2.1.311 is available.
- The new Git-option regression failed against the original classifier. The complete guard file now passes 11 tests with zero failures or skips.
- Before/after inert payload evidence: evidence/impl-review-guard-regression.txt. No prohibited Git command was executed to reproduce F1.
- The complete repository command passed: node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs. Result: 1,573 tests, 1,570 passed, zero failed, three expected skips (two opt-in live GitHub checks and the absent CLAUDE.md import check). All scratch files used a worktree-local TMPDIR with the planned parent-Git-discovery barrier. This covers the automated checks for all reviewed phases.
- claude plugin validate . --strict: exit 0, with the F2 directory warning and existing missing-icon warning.
- node tools/version-check.mjs: OK (1.11.0). git diff --check and the fix commit subject lint: passed.
- Final verification record: evidence/impl-review-verification.txt. The final complete run also passed 1,570 of 1,573 tests with zero failures and the same three expected skips.
- plan.md, including its entire Progress section, is unchanged.

## Assumptions and remaining acceptance

- The explicit full-plan request includes all implemented phases despite pending Manual rows. Review and triage were performed in this subagent, following the flat-delegation rule.
- The Phase 2 contract and applied plan-review F1 govern staged-only restore; its immutable row title remains unchanged.
- Manual 2.6 needs fresh supported-host identity and deny transcripts plus fake-executable logs for both chains. Manual 2.7 needs live planning/review adherence evidence. Those probes would require prohibited nested delegation here and remain unclaimed.
- Manual 3.4 requires the orchestrator to publish the current implementation and an owner to accept its PR CI and pending host checks. Prior PR checks recorded in evidence predate this implementation and are not acceptance of it.
- Runtime protection remains limited to the documented direct-command subset. Custom agents, OpenAI children, wrappers, dynamic programs and suppressed hooks retain the documented host-control boundaries.

## Lesson candidate

Always distinguish command option values from safety flags and honor flag overrides before allowing a destructive command.

The same classification mistake affected clean and commit. This candidate is not already in context/foundation/lessons.md; that file was read and left unchanged.
