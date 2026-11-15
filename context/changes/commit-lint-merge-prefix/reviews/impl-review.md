<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Commit-lint Merge-prefix verification

- **Plan**: context/changes/commit-lint-merge-prefix/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-15
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

No findings. The verdict and counts describe the implementation before review edits. All three automated Progress rows are complete, and phase 1 has no manual criteria. The review required no implementation fixes.

## Scope and evidence

Reviewed HEAD `cf122622197859605c46e04547b9ba9df72f74a6`, implementation commit `2a79180306d99819d9023b3a3ca78b2263cbe09f`, and lifecycle epilogue `b9686fd91c7454968f9abb107ae5c818fca515e5`. The implementation diff from `ce07804fa193c9e0f9ea5312e53c85f93838885e` contains the planned regression, change-local completion evidence, and canonical Progress updates. Planning artifacts and router-generated state account for the other run-branch changes.

| Planned deliverable | Result | Evidence |
| --- | --- | --- |
| Ordinary Merge-prefixed rejection through the range CLI | MATCH | The parameterized failure test retains `wip stuff` and adds `Merge the two parsers into one`. Each fixture includes `feat: one`, records the offending short hash, and requires exit 1 plus both hash and full subject in stderr. |
| Genuine merge exclusion and title-mode rejection | MATCH | Existing fixtures create divergent histories with a two-parent merge and retain a valid ordinary commit in the tested range. Title mode rejects the reported subject. Both acceptance checks passed. |
| Dated completion evidence | MATCH | The change notes preserve the original problem and rescope, record baseline `45a7a5087f0298536ee9d74181846a503583bb4a` and integration commit `a506d63`, and disclose the initial suite failures, isolated retry, commands, counts, and skip conditions. |

The inherited `lintRange` asks Git for non-merge commits and sends each subject to `lintSubject`. The caller sweep confirms CI invokes range mode and the title workflow invokes title mode. Git confirms `a506d638d72d1c47fd9e25fc8f004faa99953b07` is an ancestor of the recorded baseline. The linter and both workflows match that baseline byte-for-byte. [Linter](../../../../tools/commit-lint.mjs#L19) · [Range regression](../../../../tools/test/commit-lint.test.mjs#L78) · [CI invocation](../../../../.github/workflows/ci.yml#L86) · [Title invocation](../../../../.github/workflows/pr-title.yml#L39)

The added case uses the existing hermetic Git environment, fixture builder, executable helper, and `removeTree` cleanup. Comparison with the neighboring CLI tests and version-check fixtures found consistent ownership and test structure. The existing test-index row covers the extended file. The runtime and workflow invariants retain their inherited implementation. [Fixture helpers](../../../../tools/test/commit-lint.test.mjs#L15) · [Neighboring CLI tests](../../../../tools/test/version-check.test.mjs) · [Test index](../../../../skills/10x-pipeline/test/README.md#L113)

## Verification

Node v24.19.0 ran both planned test commands during this review.

```sh
TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test tools/test/commit-lint.test.mjs tools/test/pr-title-workflow.test.mjs
```

The focused command exited 0 with 14 tests, 14 passes, zero failures, zero cancellations, and zero skips. It passed before the full suite and again afterward.

```sh
TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

The full command exited 0 with 1,524 tests, 1,521 passes, zero failures, zero cancellations, three skips, and zero todo items in 802,550.442625 ms. A temporary `.git` file at the TMPDIR root contained `gitdir: unavailable-test-parent`, applying the Git-discovery boundary documented in the implementation evidence. This isolates no-Git fixtures from the enclosing worktree while fixture-owned repositories initialize normally. The wrapper removed the boundary after the suite completed.

The expected skips were the two live `pr-comment` checks requiring `GH_LIVE=1`, network access, and authenticated `gh`, and the `CLAUDE.md` import check because that file is absent.

Additional checks passed.

- `git diff --check`.
- `node tools/version-check.mjs`, reporting version 1.11.0.
- `node tools/commit-lint.mjs 45a7a5087f0298536ee9d74181846a503583bb4a..HEAD`.
- Git ancestry and baseline-file comparisons described above.

## Assumptions and limits

- The 2026-11-13 rescope and ADR-008 Amendment 2 supply the direct-push scope decision. The review used the documented repository policy and local Git history. [Change notes](../change.md#L35) · [ADR-008 Amendment 2](../../../../docs/ADR/ADR-008-release-packaging-and-semver.md#L91)
- Worktree-local scratch projects use the documented temporary Git-discovery boundary. The original unisolated failure and corrected retry remain disclosed in the implementation evidence. [Gate evidence](../change.md#L45)
- Live GitHub behavior and current remote repository settings remain unverified. The implementation-stage deliberate-break experiment is recorded evidence, and this review reran the acceptance tests against the submitted implementation.
- The review stamps `change.md` as `impl_reviewed`. No fix commit was needed. The pre-existing run-log modification belongs to the orchestrator.
