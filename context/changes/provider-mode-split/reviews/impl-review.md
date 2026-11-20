<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Provider Mode

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-20
- **Verdict**: REJECTED
- **Findings**: 1 critical, 3 warnings, 0 observations

The verdict applies to `cf984fc2`, where the Claude runner could release execution ownership using a Stop that predated tool completion. All four findings have fixes in `45c949972bbc`. The preceding review and its applied decisions are preserved in `ee417f89`.

## Verdicts

| Dimension | Verdict | Basis on the reviewed candidate |
| --- | --- | --- |
| Plan Adherence | WARNING | Both chains implement host defaults, split roles, exact dispatch and legacy recovery. Claude preflight missed two required capability checks. |
| Scope Discipline | PASS | The branch changes provider selection, execution, reporting, publication exclusion and their supporting fixtures and documentation. |
| Safety & Quality | FAIL | A late tool completion could leave stale evidence eligible to release the run lock. |
| Architecture | PASS | The router owns selection and persisted state. Each external runner checks its own execution capabilities under the shared lock. |
| Pattern Consistency | PASS | Dispatch validation, CLI envelopes, fixtures and reporting follow the existing transport conventions. |
| Success Criteria | FAIL | Three model-free regressions exposed the runner defects. The original crash fixture also made a timing-dependent assertion about a killed writer. |

## Findings

### F1 — Tool completion could invalidate an accepted Stop

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — the runner uses this evidence to release the shared lock.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:151` on `cf984fc2`
- **Detail**: A fixture authorized a Read, delivered the enclosing Stop, then reported the Read completion and the matching terminal reply. The runner marked the step complete and released ownership even though the last evidence of tool activity followed Stop. The same callback handles preflight and work.
- **Fix**: Invalidate Stop when accepting either tool callback. Reject a completion after the terminal event. The regression checks the retained Claude session lock and refusal of a second launch.
- **Decision**: APPLIED in `45c949972bbc`.

### F2 — A missing or unknown permission mode passed preflight

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the runner can validate the permission mode while handling session initialization.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:130` and `:252` on `cf984fc2`
- **Detail**: A fake session omitted its effective permission mode and received the work prompt. The runner rejected only the explicit bypass value. Both initialization and tool callbacks could accept an unfamiliar value.
- **Fix**: Require a supported mode at initialization and validate the mode when a callback supplies one. The fixtures cover missing, unknown and bypass modes and verify that preflight refusal releases the lock.
- **Decision**: APPLIED in `45c949972bbc`.

### F3 — Review and framing skills could launch without a delegation tool

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the saved skill identifies the required tool for the shipped invocations.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:255` on `cf984fc2`
- **Detail**: The runner checked for Agent or Task only on implementation steps. The installed implementation review requires two reviewers, the shipped deep plan review requires one, and framing delegates its hypothesis checks. A session advertising the selected skill and Skill tool could receive the task with neither delegation tool.
- **Fix**: Check for Agent or Task when the saved skill is one of those three. A fake tool catalog exercises each selection and verifies refusal before dispatch.
- **Decision**: APPLIED in `45c949972bbc`.

### F4 — The crash fixture expected the killed writer to clean its temporary file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the ownership checks already distinguish a crashed runner from later callers.
- **Dimension**: Success Criteria
- **Location**: `skills/10x-pipeline/test/run-lock.test.mjs:184` on `cf984fc2`
- **Detail**: The first full-suite run reached the expected lock refusals, then failed because the killed runner had left its private temporary lock file. A SIGKILL can land between writing the updated owner record and renaming it over the lock. The assertion could therefore fail with execution still correctly suspended.
- **Fix**: Allow only the temporary file with that run’s exact lock name and the killed runner’s PID. Continue requiring every refused caller to clean up and verifying that the shared lock survives process-group exit on both chains.
- **Decision**: APPLIED in `45c949972bbc`.

## Verification

The plan records all ten automated rows complete and leaves two manual rows open. Node 24.19.0 and OpenSpec CLI 2.0.0 were available. The review ran the plan's commands in the worktree with local provider and publication fixtures.

| Plan criteria | Command | Post-fix result |
| --- | --- | --- |
| 1.1–1.2 · roles, ladders, both chains, resume, archive and provenance | `node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs` | 316 passed |
| 2.1–2.2 · external dispatch, guards, accounting, closure and cancellation | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs` | 167 passed |
| 4.1–4.5 · settlement, recovery, capabilities, dispatch drift, CLI help and evidence | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,providers,provenance,host-integration,route,openfindings,manualverify,step-guard}.test.mjs` | 529 passed |
| 3.1 · both orchestrator loops and the full repository suite | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 2,107 passed, 3 expected skips, 0 failures |

The first full suite had one failure in the original crash-fixture assertion (F4). Both chain cases passed on an isolated rerun. After the fixture correction, all three focused gates and the complete 2,110-test suite passed with their expected skips. The two live GitHub cases were disabled by `GH_LIVE=0`. The root `CLAUDE.md` import check skipped because this checkout has no such file.

Manual row **3.2** remains open for fresh authenticated sessions across six host/mode combinations per chain. Row **3.3** remains open until the orchestrator publishes the final head and its CI and elected report comment can be inspected. [Manual evidence](../evidence/unproven.md)

The read-only plan reviewer (`/root/drift`) traced both chains and identified F3. The safety reviewer (`/root/quality`) identified F1 and F2. The enclosing step reproduced F1–F3 with the fake CLI and identified F4 in the complete suite. Child-inclusive token coverage was unavailable.
