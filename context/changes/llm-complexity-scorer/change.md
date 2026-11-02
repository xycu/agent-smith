---
change_id: llm-complexity-scorer
title: Score change complexity with an LLM on a cheap model
status: implementing
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Notes

Roadmap slice S-11 (`context/foundation/roadmap.md`), PRD FR-001, FR-003, FR-011. Decision record: `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md` (accepted 2026-10-31): the scorer is a `score` step that the router schedules and a cheap-model subagent runs; the router stays a script. Outcome: the complexity of a change is scored by an LLM, the scores are stored with evidence and unknowns in a machine-readable file, and the router uses them next to the deterministic signals. Open for research: which artifacts the scorer reads and which scale it uses (ADR-001 sketches four factors, each 0 to 3).
