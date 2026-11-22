<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Unattended Delivery

- **Plan**: context/changes/first-unattended-delivery/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

Verdict and counts describe the implementation before review fixes. Both findings are now applied; this does not lower the original counts. Phases 1–2 were checked through executable local evidence. Phase 3 was reviewed against the plan and retained manual inventories; its three live acceptance criteria remain pending and are not certified by this review.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

The original Success Criteria failure concerns the required path-containment assertion accepting an escaping path. The existing focused/full suites were green; the added evidence regressions exposed the gap.

## Findings

### F1 — Path assertions accept paths outside the run root

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Success Criteria / Safety & Quality
- **Location**: context/changes/first-unattended-delivery/evidence/launch.md:147; context/changes/first-unattended-delivery/evidence/script-manual-inventory.mjs:15 (baseline lines).
- **Detail**: Both readers checked the raw textual prefix. Replacing transcriptRoot in memory with runRoot + "/../outside-run-root" still returned exit 0 and PASS from the complete launch assertion, although the resolved path lies outside the permitted worktree. A pending descendant beneath an escaping symlink also needs physical containment validation. Phase 1 explicitly requires validation that acceptance paths stay beneath the run root.
- **Fix**: Require canonical absolute paths, then check the real path of the nearest existing ancestor before accepting pending descendants. Apply the same validation to both evidence readers. The inline regression exercises valid paths, traversal, sibling prefixes, an escaping symlink ancestor and a dangling symlink.
- **Decision**: APPLIED — commit 266e85405d892f16e2900b2ca1b6efc39ed56661 (fix: correct unattended delivery evidence checks).

### F2 — Ref inventory misses normal run branches

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Safety & Quality
- **Location**: context/changes/first-unattended-delivery/evidence/script-manual-retry.mjs:23.
- **Detail**: The Git pattern *<change-id>* does not cross ref-directory components. The original query returned no matches for first-unattended-delivery even though refs/heads/agent-smith/first-unattended-delivery exists. This can incorrectly report absent retained acceptance refs.
- **Fix**: Enumerate ref names with git for-each-ref, then filter complete names in JavaScript. The regression checks the actual known run branch without creating or changing refs. Historical outputs remain intact; a corrected inventory is retained separately.
- **Decision**: APPLIED — commit 266e85405d892f16e2900b2ca1b6efc39ed56661 (fix: correct unattended delivery evidence checks).

## Plan and scope assessment

| Phase | Planned delivery | Review result |
| --- | --- | --- |
| 1 | Launch manifest, normal-entry specification and eight-row acceptance checklist | Matches after F1; observations distinguish measured values from explicitly pending prerequisites. Manifest and coverage commands pass. |
| 2 | Focused/full/version gates, bounded scratch Git discovery, provider fixture and evidence of any production fixes | Matches. Local results are independently rerun. The production first-flow fix set remains empty; F1/F2 repair evidence readers only. |
| 3 | Native Claude discovery/guard enforcement, fresh complete unattended execution and representative PR acceptance | Correctly pending. No attempt, candidate installation or representative publication is claimed. The authorized top-level acceptance session still owns these observations. |

The reviewed range is fca25820008d11270fcb59fc7e1df57165ac3454..82baa6dfa54c12a4713e453ef88ebf64d5145431, with implementation commits 9fdf5cd1 and 7b8850e9 and the later manual-verification artifacts. Production scripts, policy, hooks, prompts and agents did not change. Roadmap status changed from ready to in-progress, consistent with incomplete acceptance. Lifecycle and manual inventory artifacts are justified workflow bookkeeping.

Readers are the launch assertion and manual evidence scripts; writers are the evidence-authoring steps. Router state, recovery, publication ownership, policy loading and saved-run shapes retain their current contracts. Rollback preserves earlier evidence and uses a new commit to revert only evidence-reader changes. No destructive migration or contraction occurred.

## Verification

- [Review verification and reproducible regression command](../evidence/impl-review-verification.md).
- [Corrected manual inventory](../evidence/script-manual-review-output.txt); representative refs and live evidence remain absent.
- Launch manifest, all-eight-row coverage, scratch Git boundary and guarded Claude provider fixture: exit 0 after fixes.
- Regression: two valid readers and nine negative/discovery cases pass.
- Focused suite after fixes: exit 0; 248 tests passed, zero failures or skips.
- Full repository suite after fixes: exit 0; 1798 tests, 1795 passed, zero failures, three explained skips.
- Version alignment: exit 0; version-check: OK (1.13.0).
- The full suite's three skips are the two GH_LIVE opt-in comment tests and the conditional CLAUDE.md import check because no root CLAUDE.md exists.
- Evidence links and git diff --check pass. The plan, including its Progress section, is unchanged by this review.

## Assumptions and limitations

The plan explicitly separates local readiness from top-level live acceptance, so pending Manual rows 3.1–3.3 are residual work, not additional implementation findings. S-12 remains in progress. No live Claude invocation, publication or network comment test was performed.

The implementation-review skill required two parallel review leaves. Native Codex leaves /root/review_drift and /root/review_safety each received read-only ownership, the absolute run root and step safety restrictions. Both results were collected before fixes; neither wrote files. The enclosing /root reconciled their overlapping F1 reports, reproduced F1/F2 and ran verification. Host invocation attribution is limited to these canonical task identities; child-inclusive token coverage is unknown and no totals are claimed.

The existing flat-delegation lesson is superseded by this step's explicit one-layer delegation contract. The lesson file was read and remains unchanged.
