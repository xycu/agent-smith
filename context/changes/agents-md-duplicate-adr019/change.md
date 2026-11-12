---
change_id: agents-md-duplicate-adr019
title: Remove the repeated ADR-019 sentence from AGENTS.md
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 6, "Nice to have" (lean).

### Problem

The `docs/ADR/` bullet of `AGENTS.md` (line 57, the "Project Structure" section) states the ADR-019 summary twice: "ADR-019 covers the `usage` command that attaches a usage figure which reached the orchestrator after `next`, its guards, its one commit in the archive state with a restore on failure, and the cut-off points in both skills." The first copy sits in order between ADR-018 and ADR-020. The second copy repeats it word for word at the end of the bullet, after ADR-021.

AGENTS.md is loaded into the context of every agent session in this repository, so the repeat costs tokens on every run. The duplicate also makes the bullet harder to keep in step when an ADR summary changes.

### Fix direction

- Delete the second copy, the one after the ADR-021 sentence, and keep the first, which is in ADR order.
- While editing the bullet, check whether any other ADR summary in it appears twice, and whether the bullet's opening list ("ADR-001 to ADR-011), ADR-012, ... ADR-021") still matches the files in `docs/ADR/`. Fix only real mismatches.
- Docs only: no code, policy or prompt changes. AGENTS.md does not require a test run for this, but run `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` anyway, because `no-recursive-delete.test.mjs` scans `AGENTS.md`.
- The commit type is `docs:`, so this change alone opens no release PR (AGENTS.md "Releases").

### Done when

Every ADR summary in the `docs/ADR/` bullet of AGENTS.md appears exactly once, in ADR order, and the suite passes.
