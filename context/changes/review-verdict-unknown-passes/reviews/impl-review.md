<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Review Verdict Validation Implementation Plan

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 2 critical, 3 warnings, 0 observations

The verdict and counts describe the implementation at `17dd0ea9` before this review's fixes. Each decision records the disposition.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Review coverage

Reviewed all six completed Automated rows and both phase contracts. The plan lists zero Manual rows. Two read-only reviewers checked plan adherence and safety and patterns. The enclosing review reconciled the evidence, applied fixes and ran the local gates. Child-inclusive token accounting was unavailable.

Phase 1 gates result intake and existing artifacts on the step's accepted verdicts. The existing CLI coverage verifies ordinary retries, diagnostic propagation, confirmation halts and the post-start guard on unchecked and reopened rows. The old loop fixture was updated to match that guard. Phase 2 publishes the restored metadata before its checkpoint, resumes timestamp restoration before intake under the run lock and preserves the failed snapshot and Git direction. The local checks cover interrupted rollback and undo, staged and working versions, advances to HEAD, failed review corrections and OpenSpec routing times.

The earlier Phase 1 review's F1–F5 were applied in `49f6c36e`. Those decisions covered confirmation ordering, Setext and fence boundaries, review retry tiers, annotation scanning and routing reference accuracy. Its F6 was scoped into Phase 2 and applied in `29db3c19`.

## Findings

### F1 — Quoted Markdown could supply or conceal a verdict

- **Severity**: CRITICAL
- **Impact**: MEDIUM. The parser must keep the supported header forms and historical tuples.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/state.mjs:332` at `17dd0ea9`
- **Detail**: A bare label inside a multiline code span, a preformatted HTML block or a lazy blockquote continuation read as `APPROVED` and could end a no-log run. An escaped, code-quoted or unclosed inline comment opener could hide a later conflicting verdict, so duplicate headers could also pass.
- **Fix**: Track code spans and real comments separately, skip quoted labels and stop the metadata scan at preformatted blocks. CLI cases exercise the incorrect passes and a valid header following a quoted heading. The archive digest checks historical compatibility.
  - Strength: Keeps the existing header and verdict formats.
  - Tradeoff: The reader indexes the inline delimiters before scanning metadata.
  - Confidence: HIGH. The CLI regressions and archive comparison cover the changed behavior.
  - Blind spot: The review covers the plan's opening metadata syntax.
- **Decision**: APPLIED in `25ca44d0`.

### F2 — Checkout fallback could mistake a restored review for a correction

- **Severity**: CRITICAL
- **Impact**: MEDIUM. The legacy and unresolved paths share the checkout comparison.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/isolation.mjs:581`, `:613` at `17dd0ea9`
- **Detail**: `GIT_LITERAL_PATHSPECS=1` turned the explicit pathspec prefix into part of the filename and a successful lookup returned no entry for a tracked review. Separately, Git conversion used current attributes, so disabling `ident` let previously expanded checkout bytes appear edited. Either case could let an untouched review advance after a failed confirmation.
- **Fix**: Look up the exact Git-root-relative path and compare against the pinned commit's built-in conversion when needed. Preserve the custom-filter guard. Nested CLI cases cover both recovery paths with literal pathspecs. A separate case changes the attributes after checkout.
  - Strength: Both fallback callers use the same exact path and pinned conversion checks.
  - Tradeoff: A fallback can need an extra Git invocation for pinned built-in conversion.
  - Confidence: HIGH. The CLI tests use real linked worktrees and Git conversions.
  - Blind spot: Runtime verification used Git 2.54.0.
- **Decision**: APPLIED in `25ca44d0`.

### F3 — Unreadable review artifacts bypassed failed-attempt recording

- **Severity**: WARNING
- **Impact**: LOW. The existing intake gate owns the diagnostic and retry.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/state.mjs:372`, `skills/10x-pipeline/scripts/flow.mjs:600` at `17dd0ea9`
- **Detail**: A directory at the expected review path threw before the result was persisted. The generic router halt left the attempt pending and bypassed the plan's failure accounting.
- **Fix**: Return a file-read diagnostic through `reviewProblem`. The CLI regression checks that the original result is recorded with `verified: false`, `ok: false`, no review record and a bounded retry.
- **Decision**: APPLIED in `25ca44d0`.

### F4 — Timestamp recovery could modify a hard-linked file outside the run worktree

- **Severity**: WARNING
- **Impact**: LOW. The file descriptor exposes the link count before the timestamp write.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/isolation.mjs:657` at `17dd0ea9`
- **Detail**: A matching file with a hard link passed all regular-file and symlink checks. Restoring its timestamp also changed the outside path's timestamp.
- **Fix**: Refuse a timestamp write to a file with multiple hard links. The CLI regression checks the outside file's time and verifies that the same pending checkpoint completes once the owner removes the redirection.
- **Decision**: APPLIED in `25ca44d0`.

### F5 — The reference omitted routing and Git recovery conditions

- **Severity**: WARNING
- **Impact**: LOW. The reference can state the conditions enforced by the router.
- **Dimension**: Plan Adherence
- **Location**: `docs/REFERENCE.md:111`, `:216`, `:245` and `skills/10x-pipeline/scripts/isolation.mjs:597` at `17dd0ea9`
- **Detail**: The pre-plan loop guidance implied a `RETHINK` could re-plan after implementation had started. The legacy and unresolved checkout fallback also used pinned attribute lookup without documenting its Git version requirement.
- **Fix**: Qualify the loop descriptions and document the Git versions needed for checkout comparison and pinned built-in conversion. The older-Git behavior was reviewed against Git's command documentation. [Git 2.40 attribute lookup](https://github.com/git/git/blob/v2.40.0/Documentation/git-check-attr.txt) · [Git 2.41 attribute source](https://github.com/git/git/blob/v2.41.0/Documentation/git.txt)
- **Decision**: APPLIED in `25ca44d0`.

## Verification after fixes

- `node --test skills/10x-pipeline/test/openfindings.test.mjs` passed all 185 tests.
- `node --test skills/10x-pipeline/test/rollback.test.mjs` passed all 28 tests.
- The archive comparison matched all 190 path, verdict, critical and warning tuples. The digest before and after the fixes matched the plan's baseline, `9b8d0af620d7dd8e4bf6929403e96aac1a2e3661e91b33779e9ee95f5c75b635`.
- `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` passed 1,981 tests with zero failures and three expected skips. The skipped checks were the two opt-in GitHub tests and the test for an absent `CLAUDE.md`.
