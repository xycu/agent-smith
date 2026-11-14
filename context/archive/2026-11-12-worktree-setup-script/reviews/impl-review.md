<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Shared run setup implementation plan

- **Plan**: context/changes/worktree-setup-script/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

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

No findings. Both completed phases and all seven automated Progress rows were reviewed. Every acceptance row is automated.

## Scope and evidence

The implementation range is dfbe450..3ff7823, including phase commits 18bb4ab and e55706d. Reviewed all eleven planned implementation, test and documentation paths. The remaining changed paths hold plan/change lifecycle updates and orchestrator-owned run logging. The existing uncommitted run log was preserved.

| Area | Verification |
| --- | --- |
| Six ordered cases | Real-script tests cover opt-out, in-run-worktree, in-flight-main, creation, reuse and attachment for both chains, including other-id run branches, detached HEAD, unrelated branches and chain-specific metadata. |
| Policy ownership | The isolation projection agrees with the real router loader across supported JSON shapes and changed shipped defaults/fragments. Invalid present policy fails before setup writes. Production imports use built-ins and the existing standalone helper. |
| Copy and resume safety | Fresh creation preserves regular-file times, modes, hidden content and symlink targets. Destination symlinks are replaced safely. Reuse and attachment preserve newer destination state. Failed creation/copy retains resources and returns a null runRoot. |
| Paths and source preservation | Tests cover nested and untracked project prefixes, unusual path spelling, anchored excludes, newline boundaries, raw rename/status paths, invoking HEAD, source index preservation and unchanged Git config with automatic tracking enabled. |
| Concurrency and errors | Real competing processes prove shared branch-lock exclusion from source and destination worktrees across chains/prefixes. Tests prove lock release, existing-lock preservation, bounded Git timeout JSON and inaccessible-worktree rejection. |
| Callers and integration | Both skills validate setup output and retain cwd/result handling and safety instructions. Both-chain prepare-then-init tests return action run with isolated metadata. A structural comparison against dfbe450 confirms both skill edits are confined to Start step 3. |
| Documentation and boundaries | AGENTS, REFERENCE, ADR-010 and both folder indexes describe the executable contract and source-folder retention. Searches checked active documentation for the previous setup commands. The implementation preserves the planned router, policy, sibling-file and Wave 5 boundaries. |

## Automated verification

Node v24.19.0 ran every command below from this worktree. TMPDIR pointed to this worktree's .review-tmp directory. The final full-suite invocation also set GIT_CEILING_DIRECTORIES to that directory, matching the shared fixture helper's discovery boundary.

| Command | Result |
| --- | --- |
| node --test skills/10x-pipeline/test/prepare-run.test.mjs | PASS, 30 tests, zero failures or skips |
| node --test skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs | PASS, 62 tests, zero failures or skips |
| node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs | PASS, 1,316 tests, 1,313 passed, zero failed, three skipped |
| git diff --check | PASS |
| Structural skill comparison and Progress inspection | PASS, both Start step 3 boundaries and all seven completed rows confirmed |

The repository's AGENTS command supplies the full suite's concurrency limit. Its three skips cover two opt-in live GitHub comment checks and the conditional CLAUDE.md import check.

An initial full-suite invocation produced 13 failures because non-Git fixtures under the in-worktree TMPDIR discovered the enclosing repository. The focused reproduction observed this worktree's HEAD where a fixture expected no repository. Setting the Git discovery ceiling made all three targeted executor reproductions pass, and the complete corrected invocation passed as recorded above.

## Assumptions and limits

- The supplied unattended instructions authorize direct review and triage. All analysis ran in this subagent, following the supplied delegation restriction and the accepted lesson.
- The in-worktree temporary directory and matching Git discovery ceiling satisfy the filesystem restriction while preserving the fixtures' intended repository isolation.
- Live Claude/Codex permission behavior remains unverified, as scoped in the plan and ADR-010. Interrupted setup can leave a lock requiring inspection before manual removal.

The change lifecycle is stamped impl_reviewed. This review required no code fixes. No recurring implementation finding produced a lesson candidate.
