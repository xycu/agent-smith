---
change_id: review-verdict-unknown-passes
title: Halt on an unknown or missing review verdict instead of ending the run as done
status: archived
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19T17:02:39Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 1 (must fix). Reproduced through the router CLI in a scratch project. Related earlier work: `context/archive/2026-11-11-review-verdict-labels` (the two label forms `**Verdict**:` and `**Verdict:**`).

**The defect.** The router routes on the verdict word of `reviews/plan-review.md` and `reviews/impl-review.md`. Three places together let a word it does not know count as a pass:

- `readReview` in `skills/10x-pipeline/scripts/state.mjs:340` matches `[A-Za-z]+(?: [A-Za-z]+)*` after the label, so the verdict stops at the first character that is not a letter or a single space.
- The step check in `skills/10x-pipeline/scripts/flow.mjs:577` verifies a review step when `read.verdict !== null`, whatever the word is.
- `decide` tests only the words it knows: `RETHINK` and `REVISE` for the plan review (`flow.mjs:748-752`), `REJECTED` and `NEEDS ATTENTION` for the implementation review (`flow.mjs:814-816`). Anything else falls through to `done`, and `flow.mjs:841` prints `impl review ${ir.verdict ?? "APPROVED"}`.

**Reproduced cases.**
- `impl-review.md` with `**Verdict**: NEEDS_ATTENTION` and `**Findings**: 2 critical, 1 warnings`: the verdict reads as `NEEDS`, the step is recorded `ok: true, verified: true`, and `next` returns `{"action":"done","reason":"impl review NEEDS"}`. The same happens for `NEEDS-ATTENTION`, `NOT APPROVED` and `CHANGES REQUESTED`.
- An existing `impl-review.md` with `## Verdict: REJECTED` (no bold label), a finished plan and no log: the verdict is `null` and `init` returns `{"action":"done","reason":"impl review APPROVED"}`.
- Plan side: an unknown word such as `NEEDS REVISION` goes straight to `implement`.

A grep of both test folders for `NEEDS_ATTENTION`, `NOT APPROVED` and `CHANGES REQUESTED` finds nothing.

**Why it matters.** Runs are unattended. A review that rejected the change ends with a pull request whose report says the review passed.

**Direction (for the plan to confirm).**
- Define the known verdict sets once: `SOUND`, `REVISE`, `RETHINK` for the plan review; `APPROVED`, `NEEDS ATTENTION`, `REJECTED` for the implementation review.
- `flow.mjs:577`: a review step verifies only when the verdict is in the known set. An unknown word makes the step fail, so the normal retry and escalation apply.
- `decide`: continue to `implement` only on `SOUND` (or a tolerated `REVISE`), and end `done` only on `APPROVED` or the handled `NEEDS ATTENTION` branch. Any other value, including `null` for an existing review file, halts and names the word and the file.
- The plan decides whether `readReview` should also normalize `_` and `-` to a space, so `NEEDS_ATTENTION` reads as the known verdict instead of failing the step.

**Constraints.**
- Routing decisions stay in `route.mjs` and the modules it imports; the tier logic is not touched, so `docs/REFERENCE.md` changes only where it describes verdict handling.
- The OpenSpec chain reads `verify.md` with its own reader (`skills/openspec-pipeline/scripts/openspec.mjs`); check that it has no equivalent fall-through and say so in the plan.
- Existing archived reviews must still read the same: run the reader over `context/archive/*/reviews/*.md` (read-only) and confirm no verdict changes meaning.

**Done when.**
- A test for each reproduced case: `NEEDS_ATTENTION` with criticals does not end `done`; an existing review file without a readable verdict halts instead of printing `APPROVED`; an unknown plan verdict does not reach `implement`.
- No code path returns `done` for an implementation verdict outside the known set.
- `docs/REFERENCE.md` names the accepted verdict words and what happens to any other.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
