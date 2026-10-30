---
change_id: archive-and-lessons
title: Archive adapter and lesson candidates for the 10x pipeline
status: new
created: 2026-10-30
updated: 2026-10-30
archived_at: null
---

## Notes

Change 4 of 4, split from `rigor-gated-routing` on 2026-10-30. Depends on `rigor-levels`; run after `phase-executors`, because it edits `decide()` in `route.mjs`. Research: `context/changes/rigor-levels/research.md` (section 4, Follow-up 1 "Archive adapter"); after that change is archived, look under `context/archive/*-rigor-levels/`.

Scope:

- Opt-in `--archive`. The adapter around `/10x-archive`, which stays unchanged:
  1. At `done`, `route.mjs` halts if anything is staged.
  2. It writes the final `report.md`.
  3. It commits `context/changes/<id>/agent-smith/`.
  4. It checks that the change folder is clean.
  5. It returns a new `archive` action, so no result file is written into the folder that is about to move.
- The archive subagent runs `/10x-archive <id>` at effort `high` or above. On warnings it answers `Continue archiving`; on a SHA repoint it answers `Archive without repointing`.
- A read-only `route.mjs verify-archive <id>` checks `context/archive/*-<id>/change.md` (`status: archived`) and that the old folder is gone. Nothing writes after the move.
- Lesson candidates from impl-review, carried in RESULT `signals`, go to `report.md` with a ready `/10x-lesson <seed>` command. `/10x-lesson` never runs unattended.
- Record in ADR-003 the router's first git write and the FR-008 git handling of `agent-smith/`. Update `SKILL.md` and the README.
