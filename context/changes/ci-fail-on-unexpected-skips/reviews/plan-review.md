<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Required CI tool checks implementation plan

- **Plan**: `context/changes/ci-fail-on-unexpected-skips/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

Verdict and counts describe the plan before review edits. Both findings have been applied. No owner decisions remain pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding checked 6/6 implementation paths, 5/5 symbols, and brief-to-plan consistency. The paths were the shared helper, OpenSpec contract test, CI workflow, CI regression test, contract-test README, and reference document. The symbols were `gitAvailable()`, `probe()`, `OPENSPEC_BIN`, `testJob()`, and `GH_LIVE`.

The plan has one final Progress section, two matching phases, and ten pending rows matching the phase success criteria. The review preserves the complete Progress section.

## Codebase verification

The deep verification was performed within this worker under the supplied unattended-worker rule and the repository lesson on nested subagents.

| Risky claim | Evidence and result |
| --- | --- |
| A shared Git probe owns the affected availability skips | `gitAvailable()` returns the version-command status. Caller searches across both chains confirm that the shared helper is the enforcement boundary. `skills/10x-pipeline/test/helpers.mjs:215` |
| OpenSpec availability is evaluated during discovery | `const skip = probe()` executes before the five fixtures are registered. A CI exception can fail the file at that boundary. `skills/openspec-pipeline/test/openspec-contract.test.mjs:14-22` |
| The pinned executable reaches every fixture | The same `BIN` drives the version probe and `cliApply()`. Explicit `OPENSPEC_BIN` publication selects the installed executable. `skills/openspec-pipeline/test/openspec-contract.test.mjs:14-31` |
| Installation and workflow tests fit existing ownership | Node setup immediately precedes Test suite, and `testJob()` already inspects that region. WAVES pairs the workflow with its existing regression file. `.github/workflows/ci.yml:35`, `tools/test/ci-runner.test.mjs:37`, `context/changes/WAVES.md:20` |
| Remaining skips have explicit gates | Both live tests use `GH_LIVE`, the real-gh check probes PATH, the import check uses file existence, and permission checks gate on uid. The Linux inventory matches those gates. `skills/10x-pipeline/test/pr-comment.test.mjs:677`, `skills/10x-pipeline/test/pr-comment.test.mjs:820`, `tools/test/agents-md-no-imports.test.mjs:44`, `skills/10x-pipeline/test/no-recursive-delete.test.mjs:77` |

The caller sweep found the existing shared-helper users in both chains and the existing contract documentation. Probe enforcement fits the current ownership. The existing child-test pattern supplies the isolation required by F1.

## Findings

### F1 — Isolate nested Node test runners explicitly

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details, Phase 1 probe regression coverage, Testing Strategy
- **Detail**: The plan specifies isolated CI, PATH, and OPENSPEC_BIN environments but omits Node's inherited test-worker marker. Under Node 24.19.0, launching the actual contract file with `NODE_TEST_CONTEXT=child-v8` and `--test` exits 0, emits a recursive-runner warning, and executes zero tests. With the marker removed, the same missing-binary command discovers all five skipped fixtures. The repository already handles this boundary and asserts executed test identities. `skills/10x-pipeline/test/helpers-env.test.mjs:159-172`
- **Fix**: Remove `NODE_TEST_CONTEXT` from copied environments for nested `node --test` calls, select TAP explicitly, and assert all five contract fixture identities and their expected executed or skipped state. Assert the selected-command diagnostic and nonzero exit for CI discovery failures.
- **Decision**: APPLIED — updated Critical Implementation Details, Phase 1 Changes Required item 3, Testing Strategy, and References. Updated the brief's Architecture / Approach section. Progress rows remain identical.

### F2 — Reconcile the accepted optional-contract decision

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Scope and ownership, Phase 2 expected skips and contract documentation
- **Detail**: The documentation phase covers the README and reference paragraph, while ADR-013 D2 still describes the contract check as optional and directs a skip when the binary is missing. The accepted lesson requires searching every document for the changed behavior. A focused amendment records the approved CI requirement at its existing decision source. `docs/ADR/ADR-013-openspec-pipeline.md:43`, `context/foundation/lessons.md`
- **Fix**: Add a focused ADR-013 D2 amendment to the documentation phase describing the pinned CI tool, the nonempty-CI failure boundary, and local skip behavior. WAVES lists no competing Wave 5 owner for this ADR.
- **Decision**: APPLIED — updated Scope and ownership, Evidence-backed assumption A6, Phase 2 Changes Required item 3, and References. Updated the brief's Scope section. Progress rows remain identical.

## Verification and assumptions

- Review probes used Node 24.19.0. With CI=1, missing Git still returned false, and the missing selected OpenSpec binary produced exit 0 with five skips. Both reproduce the reported pre-change behavior.
- The nested-runner reproduction used the actual contract test file, a missing binary path inside this worktree, and copied environments. It created no fixture files.
- The existing CI regression file passed all nine tests with zero skips under Node 24.19.0 using `node --test tools/test/ci-runner.test.mjs`.
- Post-edit validation confirmed identical Progress content against HEAD, both matching phases, all ten matching success-criteria rows, two APPLIED finding blocks, and the preserved pre-edit verdict and counts. `git diff --check` passed.
- Assumption A1 remains supported by the stored run goal, which explicitly approves the pinned CI-only OpenSpec tool exception. Assumption A6 now includes the focused ADR correction supported by the accepted documentation lesson and Wave 5 ownership.
- Pinned CLI installation, real pinned fixture execution, the full implementation suite, and live TrueNAS acceptance remain implementation verification. The review covers the plan and its supporting brief.
