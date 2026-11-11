---
change_id: review-verdict-labels
title: "readReview reads the Verdict line more strictly than the finding lines"
status: planned
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #91.

## What this is

`readReview` reads the verdict and the finding counts of a review file (`skills/10x-pipeline/scripts/state.mjs:200-205`).

## Problem

`readFindings` in the same file accepts both label forms, `**Severity**:` and `**Severity:**`, and ignores emoji. The verdict pattern accepts only `**Verdict**:` and nothing after the verdict word:

```js
/\*\*Verdict\*\*:\s*\[?([A-Za-z ]+?)\]?\s*$/m
```

So `**Verdict:** APPROVED`, `**Verdict**: APPROVED.` and `**Verdict**: ✅ APPROVED` all read as no verdict. `**Findings:**` is not read either, so its counts read as 0.

## Fix

Use the label pattern of `readFindings` for both lines and allow text after the verdict word.

## If we skip it

A valid review counts as a failed step (`read.verdict !== null` fails), the review runs again one tier up, and after three attempts the run halts. All 62 archived reviews of this repository use `**Verdict**:`, so it has not happened here yet.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
