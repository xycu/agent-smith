---
change_id: compare-failed-attempts-neutral
title: Count failed attempts in compare with the router's isFailure rule
status: implementing
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 4, "Nice to have".

### Problem

`readSide` in `skills/10x-pipeline/scripts/route.mjs:460` counts the `failedAttempts` of each side of `compare` as `steps.filter((e) => e.ok === false && !e.fallback).length`. The rest of the router defines a failure once, in `isFailure` (`skills/10x-pipeline/scripts/state.mjs:442`): `e.ok === false && !e.fallback && !e.advisory`. An advisory entry is a score attempt. ADR-007 and `docs/REFERENCE.md` (score section) say a failed score attempt is neutral: no failed attempt for rigor, no budget use, no withheld discount.

Concrete case: in a scorer A/B pair (`compare --unpinned`), the scorer-on arm logs one failed score attempt. `compare` then shows one more failed attempt for that arm than the router itself counts, in both the JSON (`failedAttempts`) and the Markdown row "Failed attempts". ADR-010 asks a human to record "the failed implement attempts" of both arms from this output, so the number is read as evidence.

A second rule needs a decision: a failed cheap first attempt (`e.cheap`, `escalation.firstAttempt`, ADR-010) is a failure for `isFailure`, but `rigorInputs` and `budgetSteps` (state.mjs:447, 523) treat it as neutral. The plan decides whether compare counts it, and states why.

### Fix direction

- Import `isFailure` into route.mjs and count `steps.filter(isFailure).length`, so compare and the router share one definition.
- If the plan decides that a cheap failure should also be left out, do not change `isFailure`, because its other callers depend on it. Either filter it at the compare call site, or show cheap failures as a separate count. Pick the smaller of the two.
- Update the compare section of `docs/REFERENCE.md` (and the README "Baseline comparison" section if it describes the row) so it says which entries count as failed attempts.

### Tests

- `compare.test.mjs`: a side whose log holds a failed advisory score entry and a failed implement entry reports `failedAttempts: 1`. The Markdown row shows the same number.
- A pinned baseline (no score step) reports the same count as before.
- Run the full suite.

### Done when

`compare` counts failed attempts with the same rule the router uses for rigor, and the docs say which entries it leaves out.
