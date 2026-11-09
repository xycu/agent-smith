---
change_id: openspec-pipeline
title: OpenSpec chain as a second pipeline skill on the shared router
status: preparing
created: 2026-11-09
updated: 2026-11-09
archived_at: null
---

## Notes

Owner request (2026-11-09): "Can we add OpenSpec support?" and "we are trying to keep general OpenSpec way of work". Scope source: FR-006 in context/foundation/prd.md ("The user can run an OpenSpec chain through a second pipeline skill", nice-to-have, parked 2026-10-31, built after dynamic routing works; shape-notes.md: "second pipeline skill sharing the same router and policy"). Constraint: agent-smith never edits OpenSpec or the 10x skills. Agreed order: research, then ADR-013 (chain design), then implement on a branch and open a PR.
