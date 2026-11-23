<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Lock-free pending checks and a bounded setup temp

- **Plan**: `context/changes/prepare-run-setup-lock-and-residue-followups/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

Locations and counts refer to the implementation at `c3d3bd31`.

### F1 — The payload read can open a different type of entry

- **Severity**: WARNING
- **Impact**: LOW — quick decision, narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/prepare-run.mjs:245`
- **Detail**: The lock-free reader checks the path with `lstat`, then opens it by name through `readPolicyObject`. If the entry changes between those operations, setup can follow a symlink or block on a FIFO. The regular-file requirement must apply to the entry actually read.
- **Fix**: Open read-only with `O_NOFOLLOW | O_NONBLOCK`, validate and read the descriptor, and close it on every path. Keep the initial type check and the existing disappearance and validation rules.
- **Decision**: APPLIED in `5c3dd345`. Setup validates the opened descriptor and rejects a symlink or directory substituted after the path check.

### F2 — The ENOENT tests can pass without the second check

- **Severity**: WARNING
- **Impact**: LOW — quick decision, narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/test/prepare-run.test.mjs:391`
- **Detail**: Both fault-injection cases remove the record before the read. A reader that accepts every `ENOENT` would still pass. Phase 1 requires the inspection diagnostic when a canonical entry remains or the second check fails.
- **Fix**: Inject both outcomes at the canonical path and assert that setup reports the original read error and preserves any retained entry. Prove that bypassing the second check fails both tests.
- **Decision**: APPLIED in `5c3dd345`. The retained-entry and failed-recheck cases require the original ENOENT inspection diagnostic.

### F3 — Staging cleanup assumes there is still a lock PID

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision, narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `docs/REFERENCE.md:184` and `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:271`
- **Detail**: A retry that skips publication can release the lock and leave a staging file. Both documents require inspecting the lock PID even in that case. Removing a staging file without excluding a new writer can interrupt a live publication.
- **Fix**: Inspect the recorded PID when a stale lock remains and keep that lock in place through temp removal. Otherwise leave the fixed temp for a later publisher or prevent new setup from starting before manual removal.
- **Decision**: APPLIED in `5c3dd345`. Both documents explain how to exclude new setup during manual removal, whether the stale lock remains or has already been released.

## Verification

The comparison used `bf8a105a` as the replanning base and `f2bbdee3` and `aeff5382` as the implementation commits. Both planned phases were reviewed. The pending schema, canonical path, writer lock, rollback path and copy-complete retry contract are compatible with the preceding implementation. The descriptor fix follows the existing file-opening pattern in `skills/10x-pipeline/scripts/isolation.mjs` and `skills/10x-pipeline/scripts/usage.mjs`.

### Automated criteria

Commands ran from the repository root with Node.js 24.19.0.

| Plan row | Command | Before triage | After triage |
| --- | --- | --- | --- |
| 1.1 | `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs` | 124 passed | 128 passed |
| 1.2 | `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` | 11 passed | 11 passed |
| 2.1 | `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs` | 120 passed | 124 passed |

### Manual criteria

Manual rows 1.3 and 1.4 have recorded CLI evidence. Rows 2.3 through 2.5 have a scratch regression transcript, a documentation search and a code-to-doc comparison. Row 2.2 remains pending for full-suite CI after publication, as recorded in `evidence/unproven.md`.

After triage, the scratch regression script passed all 17 controls against the current code and rejected all seven intentional changes at the asserted test cases. Skipping the absence confirmation failed both new ENOENT cases. Following a replacement symlink or skipping the descriptor's type check each failed the corresponding new test. The documentation search and code-to-doc comparison were repeated after the cleanup wording changed.
