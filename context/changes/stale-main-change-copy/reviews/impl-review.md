<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Archived-change guards and retained-input cleanup

- **Plan**: context/changes/stale-main-change-copy/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING — automated verification passed; live host acceptance remains pending |

## Findings

### F1 — Live host cleanup ordering and reporting remain unobserved

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; the remaining acceptance action is explicit.
- **Dimension**: Success Criteria
- **Location**: context/changes/stale-main-change-copy/plan.md:256, Progress row 3.5
- **Detail**: Row 3.5 correctly remains unchecked. The real CLI tests exercise preparation, initialization and cleanup for both chains; the skill content tests pin ordering and retained-path reporting. Neither observes a host executing the skill through its final message. The existing evidence/judgment-3.5-host-verification.md explicitly records this limit, so there is no unsupported completion claim.
- **Fix**: Observe one live invocation of each chain through cleanup and its final retained-path message, or explicitly defer that acceptance requirement before archival. No code change is justified by the evidence.
- **Decision**: PENDING — live host execution is unavailable in this unattended review, which prohibits child-agent launches; the owner must arrange both observations or explicitly decide to defer row 3.5.

## Plan coverage and evidence

Reviewed the implementation range `1d032e4..5f43e35`, including phase commits `e92775b`, `ceb49af` and `f0846b4`. Progress has 12 completed automated rows and one pending manual row. The requested full-plan review includes phase 3 despite that pending manual row.

| Phase | Result | Evidence |
|-------|--------|----------|
| 1 | MATCH | The init-specific check in route.mjs reuses archiveDirs/archiveRoot after chain and argument validation, before acquiring the run lock. Both-chain regressions cover prior state, multiple archives, dated names, suffix collisions and other-chain archives, with byte snapshots including Git state and router temps. Other commands retain their existing guard. |
| 2 | MATCH | prepare-run.mjs owns cleanup and shares the setup lock. It validates saved setup identity, project prefix, registered branch/common directory, isolated metadata and start-commit reachability. Literal Git pathspecs and raw Buffer hashing avoid prefix and binary-content corruption. HEAD/index protection, symlink rejection, complete candidate validation and final identity/tracking/content rechecks precede individual unlinks and empty-directory pruning. Failure paths report surviving inputs. |
| 3 | MATCH | Both skills preserve the original setup result and invoke cleanup only after fresh successful run/done/archive initialization, before dispatch. Source existence checks follow run-root selection, preserving source-absent resumes. Cleanup failures retain the initialized run root. Reference text describes this lifecycle and its residual race; terminal commit guidance and anti-stall contracts remain intact. |

The new cases in prepare-run.test.mjs cover both chains, root/nested/Unicode/metacharacter prefixes, recoverable binary/hidden inputs, tracked and staged paths, source edits, unsupported entries, repeated cleanup, all resume cases, invalid metadata/identity, symlink ancestors, concurrent edits, partial failures, locks, missing fresh inputs and immediate terminal initialization. Both findings from the plan review are implemented: source-absent resume selection and cleanup after immediate done/archive responses.

The product diff stays within the plan's Wave 5 files and regions. Plan progress, lifecycle metadata and manual-verification evidence account for the remaining implementation-range files. No routing policy, dependencies, shared state schema, archive content or parallel owner's region changed. The setup executable retains its standalone ownership and reads router metadata without writing it. Existing tests were extended, so no new test-index row is needed.

## Verification

Node v24.19.0. Test scratch projects are confined to this worktree. The focused command used `TMPDIR="$PWD/.review-tmp"`; the final full-suite run uses `TMPDIR="$PWD/.review-isolated-tmp"`, whose `.git` file points at a nonexistent local directory to stop parent-repository discovery for fixtures that intentionally have no Git repository. Git-backed fixtures initialize their own repositories as usual.

- Focused plan command: `node --test --test-concurrency=2 skills/10x-pipeline/test/archive.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs` — passed: 239 tests, 0 failures, 0 skips (383.5 seconds).
- Required complete suite: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` — passed: 1,465 tests, 1,462 passes, 0 failures, 0 cancellations, 3 expected skips (828.8 seconds). The skips are the two human-run `GH_LIVE=1` checks and the no-import check for absent `CLAUDE.md`.
- `git diff --check` — passed.
- Manual row 3.5 — pending, as documented in F1; no Progress checkbox changed.

The first full-suite attempt was stopped after three executor assertions exposed parent-repository discovery in the review's scratch setup: a non-Git fixture read this worktree's HEAD instead of null, and two others incorrectly required commit evidence. All three reproduced with the original scratch root and passed unchanged with the Git discovery barrier (3 passes, 0 failures). That interrupted run is not counted as a successful suite and prompted the complete isolated rerun; it does not justify a product-code finding.

## Triage and assumptions

No CRITICAL or WARNING finding and no clear code fix was identified. No implementation edit or fix commit was needed. This report and the change's impl_reviewed status are the review outputs; the pre-existing router-owned run.jsonl modification is left untouched.

The supplied unattended/full-plan instructions take precedence over the skill's interactive triage and delegation defaults. Review work was performed directly, and all three phases were inspected. Scope follows the amended plan and Wave 5 ownership. ADR-010's explicit Wave 4 history is historical; the updated reference and skills describe current behavior.

The documented filesystem race between final revalidation and unlink remains: external editors do not share the setup lock. This is the plan's stated limitation, not an undisclosed deviation. No recurring new lesson was identified; lessons.md remains unchanged.
