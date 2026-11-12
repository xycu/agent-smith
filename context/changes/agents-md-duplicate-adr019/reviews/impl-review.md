<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Remove the repeated ADR-019 sentence from AGENTS.md

- **Plan**: context/changes/agents-md-duplicate-adr019/plan.md
- **Scope**: Full plan (Phase 1), commit c2d83c0
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warning, 1 observation

## Verification

- Diff `51f8d2f..HEAD` on `AGENTS.md`: one line (57) changed; the trailing second `ADR-019 covers ...` sentence is gone, the first copy (between ADR-018 and ADR-020) is untouched. Nothing else in the file changed.
- `grep -o "ADR-019 covers" AGENTS.md | wc -l` prints `1`.
- Line 57 summaries after the opening list: ADR-009 to ADR-021, once each, ascending; ADR-016 starts `ADR-016 bans`; the bullet ends with the ADR-021 sentence.
- Out of scope respected: no code, policy, prompt, ADR file or other `AGENTS.md` line touched.
- Progress rows 1.1 and 1.2 are `[x]`. Whole suite passes: 1075 tests, 1072 pass, 0 fail, 3 skipped.

## Findings

### F1 — Progress rows carry no commit sha

- **Severity**: OBSERVATION
- **Impact**: LOW — cosmetic
- **Location**: `plan.md` `## Progress`
- **Detail**: The progress convention appends ` — <commit sha>` to a landed row; rows 1.1 and 1.2 have none. The router owns that step and the review may not edit `## Progress`.
- **Decision**: PENDING — outside this review's remit (`## Progress` must not be edited); the owner or the implement step may add the sha if wanted.
