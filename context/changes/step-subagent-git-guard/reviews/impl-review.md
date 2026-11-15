<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step subagent Git and deletion safety

- **Plan**: context/changes/step-subagent-git-guard/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

This is a fresh review of HEAD dbdd43aa3a37e50a30d7c6f40671f301e9ee22c2, including the Phase 4 follow-up. No new findings or code fixes were required. Approval covers the implementation and automated acceptance; Manual rows 2.6, 2.7 and 3.4 remain pending.

The earlier REJECTED review, including its original counts and decisions, is preserved byte-for-byte in [the historical review](../evidence/impl-review-before-follow-up.md) and in commit 7155a99. Its original findings have since been addressed: F1 by 19affb2e3c16a2de2508e5c06be09e2d02be28ab and F2 by cf49dd1. Those are prior fixes, not new findings or edits in this review.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

None in the reviewed implementation.

## Scope and evidence

Reviewed every phase as explicitly requested, including phases with pending Manual rows. Progress has 14 completed Automated rows and three pending Manual rows. The Phase 2 contract explicitly supersedes the stage-only-restore permit wording in immutable row 2.2: conservative denial is intentional, and the original row remains unchanged.

The implementation range is e9d1547..dbdd43a: the original three phase commits, the option-value correction, the packaging follow-up and their bookkeeping/evidence. The pre-existing dirty router-owned run.jsonl was excluded from edits. The review does not change plan.md or its Progress section.

| Plan area | Evidence and assessment |
| --- | --- |
| Phase 1: shared safety | Fixed-path top.md contains each Git, staged-only preservation, deletion, protected GitHub data and publication invariant. Existing ruleTail ownership delivers these after overrides to both chains, normal and archive dispatches, and file-handoff bodies. RESULT remains last. step-safety, rule-levels, rules, nested-subagents, no-recursive-delete and prompt-handoff regressions cover the carriers. |
| Phase 1: planning | plan, plan-review and os-propose step files cover all relevant variants. Rules preserve locally executable fake-client checks, assign publication-dependent acceptance to Manual, and require identity-preserving correction with synchronized criteria and brief. Immutable contradictions retain pending-owner handling. Content tests establish delivery; live model adherence remains Manual 2.7. |
| Phase 2: dispatch | dispatchAgent is shared by route.mjs and isolation.mjs. Ordinary Claude actions receive agent-smith:step; supported restricted mappings retain precedence. Archive keeps its historical mapping treatment. OpenAI gets no Claude agent and retains capability rejection through the separate stepAgent lookup. The new agent inherits tools and contains no routing parameters. |
| Phase 2: replay | neutralRetry returns the stored prompt and optional agent instead of recomputing a default. Both-chain tests cover exact old prompts, absent historical agent fields, custom historical types and file handoff. |
| Phase 2: hook | Plugin registration pins synchronous Bash matching, an argument vector, timeout and fail-closed behavior. The standalone classifier bounds input, checks identity before command analysis, emits deny or neutral output, and has no filesystem, subprocess, network or routing dependency. Its documented direct-command matrix covers both rejection and allowed local commits; it is not represented as a general shell parser. |
| Phase 2: option values | The prior F1 fix consumes separate and attached values before classifying flags or a terminator, and uses the last actual dry-run flag. The complete guard file covers exclusion patterns, flag-looking messages/trailers, actual hook bypass and safe attached messages. Tests use inert payloads; recording clients prove denied staged restore preserves distinct HEAD, index and working-copy contents. |
| Phase 2: provenance | hookFiles hashes the fixed shipped hook JSON and implementation using the existing deterministic hash/null conventions. Independent agentFiles and ruleFiles ownership remains intact. Regressions cover drift, immutable stored provenance and missing/unreadable hook inputs. |
| Phase 3: documentation and integration | README, reference, ADR amendments and rule/prompt/test indexes agree on ownership, the guarded default, host/version requirements, provider/custom-agent limits and pending live acceptance. Both skills retain agent forwarding, provider dispatch, equal anti-stall sections and terminal publication ownership. |
| Phase 4: packaging | No .DS_Store is tracked. Both root and nested paths match the root ignore rule; the original worktree ignore entry remains. The retained local file matches its recorded pre-cleanup SHA-256. A fresh export of the reviewed HEAD contains no metadata and passes strict validation without ARCHIVE_OS_METADATA_FILE. |

Existing route/preplan/score fixture changes are required adaptations to the planning tail. Provider tests and shared safety tests supply planned cross-chain scenarios without requiring a change to every test file listed as a possible target. The no-gh source scan excludes the standalone literal classifier, whose own regression separately prohibits execution and external dependencies. No dependency, model/tier change, release field, archived context, WAVES.md or unrelated concurrent implementation changed in the reviewed range.

## Verification

The current [verification record](../evidence/impl-review-current-verification.txt) contains commands, focused results, export identity, metadata digest and validator diagnostics. The previous follow-up record remains unchanged.

- Node v24.19.0 meets the Node 24+ requirement; Claude Code is 2.1.311.
- The full guard test file passed: 11 tests, zero failures, zero skips.
- The full repository command passed: node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs. Result: 1,573 tests, 1,570 passed, zero failures, three expected skips (two opt-in live GitHub checks and the absent CLAUDE.md import check). All scratch fixtures used the worktree-local TMPDIR and parent-discovery barrier.
- Strict validation of clean HEAD tree d9e6fbf3123d566d70f3e2ebd34f9b38d0e415fb passed. ARCHIVE_OS_METADATA_FILE is absent; the pre-existing, explicitly out-of-scope ICON_MISSING warning remains.
- Tracking/ignore checks and local-file digest comparison passed. SHA-256: c4758bd840da2b4de207b551cf870e645460579059ed95b39e6ebfe2a0a6cbb7.
- Shared skill forwarding, anti-stall equality, publication ownership and protected-diff checks passed. Version consistency passed at 1.11.0; git diff --check passed.

## Assumptions and remaining acceptance

- The explicit full-plan instruction takes precedence over limiting coverage to phases with every Manual row complete. All four implemented phases were reviewed in this subagent, without nested delegation.
- The Phase 2 contract governs conservative staged-only restore denial; the preserved Progress wording is not a new defect.
- Manual 2.6 still needs fresh supported-host identity/deny transcripts and recording-client logs for both chains. Payload tests and plugin validation do not establish live hook delivery.
- Manual 2.7 still needs a live planning/review adherence probe. Its content regressions establish instruction delivery only. These live probes were not launched because this step forbids nested delegation.
- Manual 3.4 still requires orchestrator publication followed by owner acceptance of current PR CI and outstanding host checks. No publication or remote mutation was attempted.
- Runtime enforcement remains bounded to documented direct commands. Dynamic programs, wrappers, custom agents, OpenAI children and disabled/suppressed hooks rely on semantic rules and existing host controls.
- No new recurring finding warrants a lesson candidate. lessons.md was read and left unchanged.
