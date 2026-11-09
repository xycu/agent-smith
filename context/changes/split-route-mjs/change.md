---
change_id: split-route-mjs
title: Split route.mjs and the 1000-line test files into smaller modules
status: implementing
created: 2026-11-09
updated: 2026-11-09
archived_at: null
---

## Notes

Owner request (2026-11-09): "should we refactor our current *.mjs files, aren't they a bit too long now?" then "1k is also fucking long, can we use ponytail to fix this? On opus/high".

Measured 2026-11-09 (`wc -l`): `skills/10x-pipeline/scripts/route.mjs` 3582 lines; test files over 1000 lines: `openfindings.test.mjs` 1211, `preplan.test.mjs` 1130, `executors.test.mjs` 1116, `archive.test.mjs` 1084.

Goal: pure refactor, no behavior change. Reason to do it first: the planned `openspec-pipeline` change needs seams that a module split creates (a `paths()` that takes a root, a decision function per chain, a per-step verification switch). Constraints: ADR-006 (Node 24, `node:` built-ins only), `AGENTS.md` Hard Rules and test rules (`loops-existing.test.mjs` never edited; `helpers.mjs` stays as it was), Conventional Commits (`refactor:`). Lens: ponytail, the laziest split that works; delete or merge before splitting.
