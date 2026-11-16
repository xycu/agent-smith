<!-- PLAN-REVIEW-REPORT -->
# Plan Review — OpenSpec 2.0.0 Upgrade

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-16
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations
- **Reviewed revision**: `339fe41d651fbe2eeafc5b20879f86d8d97d7241`
- **Plan before fixes**: Git blob `eddf7ce1ea3389ed6a432aa13d8e418da1784bb6`

The verdict and counts describe the plan before edits. Its implementation sequence is sound with one narrowly scoped documentation omission. F1 is applied, and no finding remains pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding checked 10/10 existing modification paths, 5/5 named code symbols and brief-to-plan consistency.

The existing paths were `.github/workflows/ci.yml`, `tools/test/ci-runner.test.mjs`, `skills/openspec-pipeline/test/openspec-contract.test.mjs`, `skills/openspec-pipeline/test/openspec-helpers.mjs`, `skills/openspec-pipeline/test/README.md`, `docs/REFERENCE.md`, `skills/openspec-pipeline/scripts/openspec.mjs`, `README.md`, `skills/openspec-pipeline/SKILL.md` and `skills/openspec-pipeline/prompts/os-archive.md`. Planned shared-skill and evidence outputs are explicitly new paths.

The symbols were `probe`, `cliApply`, `makeOpenspecProject`, `TASK_ROW` and `readOpenspec`. The generated integration inventory contains twelve tracked legacy command files and twelve tracked skill copies, matching the plan.

All three phase headings match their Progress headings. All ten phase Success Criteria bullets match their canonical Progress rows. Publication, PR CI and the report comment already belong to Manual row 3.5. Automated row 3.1 retains valid local fake-client publication checks. The edits preserve the entire Progress section byte-for-byte.

## Findings

### F1 — Include the active OpenSpec ADR in the upgrade

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Changes Required, Contract documentation
- **Detail**: The original documentation scope covers the reference and parser comment. ADR-013 D2 still mandates the 1.16.1 CI tool and local skipping on failed version probes. Implementing the planned 2.0.0 pin and exact-version enforcement would leave those active architectural instructions inconsistent with the new contract. The accepted lesson about searching every document for changed behavior applies. [ADR-013 D2](../../../../docs/ADR/ADR-013-openspec-pipeline.md#reading-openspec-state-d2) [Lessons](../../../foundation/lessons.md)
- **Fix**: Add ADR-013 to Phase 1's file list and require a dated amendment for the 2.0.0 pin and probe outcomes. Preserve historical observations, distinguish unavailable/failed probes from successful incompatible or malformed responses, and search active documentation for conflicting instructions.
- **Decision**: APPLIED — Changed Phase 1, Changes Required, Contract documentation in plan.md and Architecture / Approach in plan-brief.md. The amendment is implementation work assigned by the corrected plan.

## Codebase verification

One read-only native child, `/root/verify_plan_claims`, completed the required combined claim verification, caller sweep and pattern check. It returned F1 and supporting evidence to parent `/root`, with no touched paths. The parent checked the finding against ADR-013 and reconciled the result before editing.

- The selected-binary CI path already owns tool installation, version validation and export ordering. Its fake-client tests cover installation/probe failures and ambient executable exclusion. The plan names both owners and the affected stubs. [Workflow](../../../../.github/workflows/ci.yml) [CI tests](../../../../tools/test/ci-runner.test.mjs)
- Existing availability meta-tests run the entire contract file and expect five original identities. The plan explicitly requires filtering those identities before adding integration fixtures. Existing scratch helpers own cleanup, and the plan adds HOME/XDG isolation, Git discovery isolation and valid scenario-bearing specimens at the appropriate boundary. [CI tests](../../../../tools/test/ci-runner.test.mjs) [Contract fixtures](../../../../skills/openspec-pipeline/test/openspec-contract.test.mjs) [Helpers](../../../../skills/openspec-pipeline/test/openspec-helpers.mjs)
- Existing both-chain regressions support the promised saved inline/file replay, result persistence, child settlement, foreign-event exclusion and recovery ownership. Phase 3 reuses those owners and requires fresh evidence for the upgraded candidate. [Saved dispatches](../../../../skills/10x-pipeline/test/prompt-handoff.test.mjs) [Result persistence](../../../../skills/10x-pipeline/test/result-persist.test.mjs) [Native settlement](../../../../skills/10x-pipeline/test/codex-runner.test.mjs) [Recovery](../../../../skills/10x-pipeline/test/codex-chain.test.mjs)
- The upstream 2.0.0 guide confirms shared skills, committed Claude links, retired command files, retained edited legacy copies, canonical-skill overwrite risk, dry-run preview and idempotent update. The plan covers these migration boundaries, project-input preservation and rollback. [Upstream upgrade guide](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md)

## Assumptions and verification limits

- The unattended instruction authorizes applying the clear documentation-scope fix. Existing ADR-013 D2 and the accepted documentation lesson supply its basis.
- This review uses the existing research as previously recorded execution evidence. It checks local source and upstream 2.0.0 documentation. Runtime tests and live-host acceptance remain implementation work.
- The initial Python HTTPS fetch failed certificate validation. A subsequent curl fetch with normal certificate verification succeeded for the upstream guide and update implementation.
- The required child completed read-only work. Child-inclusive token coverage is unknown, and no aggregate token total is inferred.
- The final checks validate review parsing, preserved counts, unchanged Progress, phase-to-Progress correspondence and whitespace. Fresh native-host discovery, the six OpenSpec acceptance cells and external publication retain their planned evidence requirements.
