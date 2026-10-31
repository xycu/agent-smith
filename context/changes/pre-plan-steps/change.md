---
change_id: pre-plan-steps
title: Rigor-gated pre-plan steps and backward loops in the 10x pipeline
status: planned
created: 2026-10-30
updated: 2026-10-31
archived_at: null
---

## Notes

Change 2 of 4, split from `rigor-gated-routing` on 2026-10-30. Depends on `rigor-levels` (rigor level, RESULT `signals`, skip logging, effort floor, ADR-003). Research: `context/changes/rigor-levels/research.md` (sections 1-2, Follow-ups 1-2); after that change is archived, look under `context/archive/*-rigor-levels/`.

Scope:

- Step gates in `policy.json`: a rigor threshold plus named `when`/`skipIf` predicates implemented in `route.mjs`, for `/10x-research`, legacy research (when `context/map/repo-map.md` exists), the domain brief and `/10x-frame`.
- Wire the prompt files in `skills/10x-pipeline/prompts/` (already written: translated, rewritten as GIVEN/WHEN/THEN rules) into the router. Verify each step by its artifact.
- Frame runs pinned to opus/high through `policy.json`. Its prompt carries a decision guide: wherever `/10x-frame` would ask, the subagent decides from researched best practice, cites the evidence and states confidence. With no evidence-backed call, it reports `blocked` with `signals.needsHuman` and the router halts. `signals.needsHuman` wins over the `frame.md` Confidence value.
- Backward loops: RETHINK goes to frame once, then re-plan; a second RETHINK halts. REVISE twice adds research, then re-plans.
- Update ADR-003, `SKILL.md` "How the tier moves" and the README routing bullets.
