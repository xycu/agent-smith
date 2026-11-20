<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Provider Mode

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-20
- **Verdict**: REJECTED
- **Findings**: 1 critical, 2 warnings, 0 observations

The verdict and counts describe `ce4737da9338` with the owner's 1,536-byte ceiling already in the working copy. All three findings were applied in `cd20da6d5589`. There are zero open critical findings and zero open warnings. The fix commit includes the ceiling confirmed by the owner in the plan. Phase 4 refers to the earlier findings fixed in `84205bf0` and verified in `07221f54`.

## Verdicts

| Dimension | Verdict | Evidence on the reviewed candidate |
| --- | --- | --- |
| Plan Adherence | WARNING | The Claude transport could accept an idle receipt that preceded later enclosing output. |
| Scope Discipline | PASS | Provider assignment, external execution, publication locking and migration documentation follow the four planned phases. |
| Safety & Quality | FAIL | Claude could release ownership using stale settlement evidence. The archive path could also move the physical lock. |
| Architecture | PASS | The router owns assignment and saved dispatch. Runners validate it under the lock shared with publication. |
| Pattern Consistency | WARNING | Only the Codex runner enforced external temporary storage. |
| Success Criteria | FAIL | Local fixtures exposed the settlement and lock defects. The size fixture also measured Claude under two OpenAI labels. |

## Findings

### F1 — Later assistant output could reuse an earlier idle Stop

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — the decision determines when another writer can enter the run.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:272` on the reviewed candidate.
- **Detail**: A matching enclosing assistant event received after Stop left the old receipt valid. With identical reply text, the fake CLI started work after a stale preflight Stop and completed work after a stale work Stop. A recognized CLI failure also relied on that receipt to release ownership.
- **Fix**: Invalidate the receipt on enclosing assistant activity in either turn and on tool callbacks, including denied requests. A new idle Stop can settle the turn. The fixtures cover preflight refusal and retry, successful and failed work terminals, and retained-lock refusal on relaunch.
  - **Strength**: Preflight and both work terminal types use the same freshness rule.
  - **Tradeoff**: Out-of-order activity can require a retry or ownership reconciliation.
  - **Confidence**: HIGH. The targeted fixtures failed on the candidate and passed after the fix.
  - **Blind spot**: Live event ordering awaits row 3.2.
- **Decision**: APPLIED in `cd20da6d5589`.

### F2 — A headless archive could move its own lock

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — every lock holder relies on the same physical location throughout the run.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:93` and `skills/10x-pipeline/scripts/run-codex.mjs:212` on the reviewed candidate.
- **Detail**: With TMPDIR inside the live change, the Claude runner launched the fake archive. Moving the change would move the lock from the location used to settle it. Codex already rejected that configuration.
- **Fix**: Enforce the existing external-temp requirement when acquiring the shared run lock. Check for an existing owner first. The archive fixture now checks refusal before CLI startup and compares the directory contents before and after. Historical lock names and ownership records retain their existing format.
  - **Strength**: Runners, router writers and publication share the placement check.
  - **Tradeoff**: Writers reject a TMPDIR inside the run root. Existing owners must settle before TMPDIR changes.
  - **Confidence**: HIGH. The same local archive fixture demonstrated both the original launch and the corrected prelaunch refusal.
  - **Blind spot**: Fresh-host archive qualification awaits row 3.2.
- **Decision**: APPLIED in `cd20da6d5589`.

### F3 — The size fixture missed OpenAI actions and skipped the ceiling on long checkouts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the plan specifies both provider selection and the byte ceiling.
- **Dimension**: Success Criteria
- **Location**: `skills/10x-pipeline/test/prompt-handoff.test.mjs:421` and line 442 of the same file on the reviewed candidate.
- **Detail**: The two fresh OpenAI cases supplied a ladder preset, so the host-native default routed them to Claude. An assertion against the first OpenAI label returned `claude`. The size check only ran when the checkout fixture's absolute root fit in 100 bytes.
- **Fix**: Select the intended mode and check the provider on initial, retry and next actions. The test measures the actual stdout and checks each of the 19 ordinary envelopes at a 100-byte root, substituting only the root and its quoted task path. The owner-approved 1,536-byte ceiling is also the value recorded in measurement evidence.
- **Decision**: APPLIED in `cd20da6d5589`.

## Coverage and verification

The review compared the implementation with run base `6834d2b4`. It covered both chains' six host/mode assignments, default and legacy routing, mixed and homogeneous ladders, retries, metadata recovery, archive descriptors and provenance. The transport review covered exact handoffs, skill and tool discovery, cancellation, leaf collection, settlement and usage evidence. Both skill loops and their terminal publication protocols were checked against the reference.

Post-fix commands used Node 24.19.0, OpenSpec CLI 2.0.0 and local provider and publication fixtures. Scratch projects stayed inside the review worktree. The full suite used a Git discovery boundary so fixtures without a repository could not inherit the enclosing checkout's history.

| Criteria | Command | Result |
| --- | --- | --- |
| 1.1–1.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs` | 316 passed |
| 2.1–2.2 | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs` | 169 passed |
| 4.1–4.5 | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,providers,provenance,host-integration,route,openfindings,manualverify,step-guard}.test.mjs` | 531 passed |
| 3.1 | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 2,109 passed, 3 expected skips, 0 failures |

The first full run had 2,108 passes, three expected skips and one failure. The OpenSpec crash fixture received `EPERM` on its process-group liveness check after termination. Both chains passed in nine focused reruns. The final full gate used the approved process permissions. Its three skips were the optional root CLAUDE.md import and the two live GitHub checks.

Manual row **3.2** awaits fresh authenticated host qualification across all six combinations per chain. Row **3.3** awaits orchestrator publication and verification of the final PR head, CI and any elected report comment. The plan records ten completed automated rows and these two pending manual rows. [Manual evidence](../evidence/unproven.md)

The read-only reviewers `/root/quality` and `/root/drift` returned F1–F2 and F3 respectively under enclosing invocation `01a1f853-b4a6-70d3-a42f-f04280230fb9`. The enclosing review confirmed all three with local fixtures. Child-inclusive token coverage was unavailable.
