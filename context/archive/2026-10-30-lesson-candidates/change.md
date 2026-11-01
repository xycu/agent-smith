---
change_id: lesson-candidates
title: Lesson candidates in the 10x pipeline report
status: archived
created: 2026-10-30
updated: 2026-11-01
archived_at: 2026-11-01T22:40:45Z
---

## Notes

Change 4 of 5, split from `rigor-gated-routing` on 2026-10-30 (roadmap S-10). The archive adapter was split off as `archive-adapter` (S-09), because it needs only `rigor-levels`. Depends on `rigor-levels` and `phase-executors`, because it edits `decide()` and the RESULT `signals` parsing in `route.mjs`. Research: `context/changes/rigor-levels/research.md` (section 4, Follow-up 1); after that change is archived, look under `context/archive/*-rigor-levels/`.

Scope:

- Lesson candidates from impl-review, carried in RESULT `signals`, go to `report.md` with a ready `/10x-lesson <seed>` command. `impl-review` has no lesson-candidate section, so the prompt asks the subagent for them. `/10x-lesson` never runs unattended.
- Update `SKILL.md`, the README and ADR-003.
