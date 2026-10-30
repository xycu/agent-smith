---
change_id: archive-adapter
title: Archive adapter for the 10x pipeline
status: implemented
created: 2026-10-30
updated: 2026-10-31
archived_at: null
---

## Notes

Change 5 of 5, split from `rigor-gated-routing` on 2026-10-30 (roadmap S-09). Depends only on `rigor-levels`, which adds the skip entries in `run.jsonl` and touches `endRun`. Research and plan can run in parallel with `rigor-levels`; implement waits until `rigor-levels` is merged, because both edit `route.mjs`. Research: `context/changes/rigor-levels/research.md` (section 4, Follow-up 1 "Archive adapter"); after that change is archived, look under `context/archive/*-rigor-levels/`.

Scope:

- Opt-in `--archive`. The adapter around `/10x-archive`, which stays unchanged:
  1. At `done`, `route.mjs` halts if anything is staged.
  2. It writes the final `report.md`.
  3. It commits the whole `context/changes/<id>/` folder in one Conventional Commit (owner decision A, 2026-10-30; `research.md` Open Question 1).
  4. It checks that the change folder is clean.
  5. It returns a new `archive` action, so no result file is written into the folder that is about to move.
- The archive subagent runs `/10x-archive <id>` at effort `high` or above. On warnings it answers `Continue archiving`; on a SHA repoint it answers `Archive without repointing`.
- A read-only `route.mjs verify-archive <id>` checks `context/archive/*-<id>/change.md` (`status: archived`) and that the old folder is gone. Nothing writes after the move.
- Record in ADR-003 the router's first git write and the FR-008 git handling of `agent-smith/`. Update `SKILL.md` and the README.
