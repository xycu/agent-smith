<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Provider Mode

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-20
- **Verdict**: REJECTED
- **Findings**: 1 critical, 2 warnings, 0 observations

The verdict and counts describe candidate `3b4f5aa6` before this review's fixes. The earlier review of `ff22d32f` is preserved in commit `00142313`. Phase 4's regression cases for that review were included in this run.

## Verdicts

| Dimension | Verdict | Basis |
| --- | --- | --- |
| Plan Adherence | FAIL | The enclosing Stop could precede leaf collection, contrary to phase 4. |
| Scope Discipline | PASS | Changes trace to provider selection, execution, accounting, publication exclusion or their verification. |
| Safety & Quality | FAIL | The Claude runner could release native ownership on an out-of-order Stop. A valid Unicode reply could also leave a run suspended. |
| Architecture | PASS | Policy owns role assignment, the router records dispatch and the runners own settlement under the shared run lock. |
| Pattern Consistency | WARNING | The external runners applied different validity checks to archive replies. |
| Success Criteria | FAIL | New local fixtures reproduced the ownership and reply-validation defects on the reviewed code. Manual rows 3.2 and 3.3 remain open as planned. |

## Findings

### F1 — Claude accepted a Stop issued before leaf collection

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — the Stop is the evidence that permits releasing native execution ownership.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:242` on the reviewed candidate
- **Detail**: The fake CLI sent an enclosing Stop while a foreground leaf was active, completed and collected the leaf, then sent the matching terminal result. The runner reported completion and released the lock. Its idle evidence predated the leaf's completion.
- **Fix**: Check outstanding calls, active leaves and missing collections at Stop receipt. Invalidate an earlier Stop when the runner authorizes another tool call. The regression checks that an early Stop leaves native ownership in place and prevents relaunch.
- **Decision**: APPLIED in `1668013b12a2`.

### F2 — Codex accepted malformed archive replies

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the shared result parser can enforce the archive contract for both transports.
- **Dimension**: Pattern Consistency
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:329` and `skills/10x-pipeline/scripts/runner-dispatch.mjs:93` on the reviewed candidate
- **Detail**: On both chains, a Codex archive returned a completed envelope and released ownership for a reply containing a done RESULT followed by more output. The same parser accepted arbitrary nonempty statuses. Headless Claude required a final RESULT with status `done`, `failed` or `blocked`.
- **Fix**: Enforce that archive rule in the shared parser before either runner releases ownership. Exercise trailing output and unsupported status on both Codex archive paths. Ordinary Codex dispatch keeps its established last-RESULT behavior.
- **Decision**: APPLIED in `1668013b12a2`.

### F3 — A multibyte Claude reply could spuriously suspend a run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the lifecycle hook owns decoding and byte limits.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/claude-hook.mjs:21` on the reviewed candidate
- **Detail**: The hook decoded each stdin chunk independently. A character split across chunks changed the Stop digest, so the runner rejected a valid matching terminal reply and retained the lock. A model-free fixture reproduced the mismatch with a 384 KiB UTF-8 prefix.
- **Fix**: Bound input by raw bytes and decode the complete event once. The regression passes a multibyte reply through the hook and runner and checks successful settlement.
- **Decision**: APPLIED in `1668013b12a2`.

## Verification

Node 24.19.0, Git and OpenSpec CLI 2.0.0 were available. The three focused commands and the complete suite below are the gates from the plan. Provider and publication fixtures used local fake clients.

| Coverage | Command | Result |
| --- | --- | --- |
| 1.1–1.2 — provider roles and ladders on both chains, resume, replay, archive and provenance | `node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs` | 316 passed, zero failed or skipped |
| 2.1–2.2 — exact dispatch, guards, leaf collection, settlement, accounting and cancellation | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs` | 164 passed, zero failed or skipped |
| 4.1–4.5 — both chains' recovery and intake, capabilities, dispatch drift, CLI help and evidence rules | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,providers,provenance,host-integration,route,openfindings,manualverify,step-guard}.test.mjs` | 526 passed, zero failed or skipped |
| 3.1 — both skill loops, publication exclusion and repository suite | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 2,104 passed, zero failed, three expected skips |

The full suite ran 2,107 tests. The two live GitHub checks were disabled with `GH_LIVE=0`. The third skip checks imports in the optional root `CLAUDE.md`, which this checkout does not contain. The OpenSpec contract fixtures ran.

The provider matrix exercised real router init in scratch projects for both hosts and both chains, with each explicit mode and the implicit host default. Recovery fixtures verified read-only status and byte-for-byte preservation for missing or damaged metadata. The original run's state and plan Progress remain under their existing owners.

Two read-only reviews contributed evidence under this step. `/root/drift` traced policy selection, replay and recovery and identified F1. `/root/quality` independently identified F1 and the archive discrepancy in F2. The enclosing review reproduced both and F3 locally. Child-inclusive token coverage was unavailable.

Manual row **3.2** requires fresh authenticated host sessions across all six host/mode combinations per chain on the final candidate. Row **3.3** requires orchestrator publication and inspection of that head's CI and the elected report comment. Both remain pending. [Manual evidence](../evidence/unproven.md)
