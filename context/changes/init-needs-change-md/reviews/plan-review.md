# Plan review: init-needs-change-md

**Plan**: context/changes/init-needs-change-md/plan.md
**Verdict**: APPROVED WITH CHANGES
**Findings**: 0 critical, 2 warnings, 2 observations

Checked against the code at `route.mjs` (`next` :63-69, `init` :845-870), `flow.mjs:589`, `helpers.mjs` and the tests. Plan facts are accurate. The fix point is right: `guardArchived` first, then the check, before `readMeta`, the isolation gate and `mkdirSync`.

### F1: Isolated test placed in a file that cannot build a worktree
**Severity**: WARNING
The plan puts the isolated variant in `route.test.mjs`, but the `worktree()` helper is local to `isolation.test.mjs` and `helpers.mjs` must stay as it was.
**Suggested fix**: put the isolated test in `isolation.test.mjs`.
**Decision**: APPLIED - Phase 1, "2. Tests" contract, and success criterion 1.2 now name `isolation.test.mjs`.

### F2: Docs placement vague, stale D8 pointer
**Severity**: WARNING
Phase 2 said "the 10x routing/`init` description" without naming a place, and the `:462` bullet also ends on the D8 collision caused by the junk folder, which no longer arises.
**Suggested fix**: name the "How routing works" list and say to drop the D8 pointer.
**Decision**: APPLIED - Phase 2 "1. REFERENCE.md" changes.

### F3: Other tests may rely on state without change.md
**Severity**: OBSERVATION
Grep shows only `archive.test.mjs:141` uses `change: false` on the 10x chain, but the full suite is the proof.
**Suggested fix**: tell the implementer to fix any such test the same way.
**Decision**: APPLIED - Phase 1 "2. Tests" contract.

### F4: Late check in `decide` becomes unreachable at run start
**Severity**: OBSERVATION
The plan keeps it as defence for a `change.md` removed mid-run. Fine; no action.
**Suggested fix**: none.
**Decision**: ACCEPTED - the plan already states it in "What We're NOT Doing".
