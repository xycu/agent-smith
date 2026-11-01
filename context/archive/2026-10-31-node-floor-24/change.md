---
change_id: node-floor-24
title: Raise the Node.js floor from 18 to 24
status: archived
created: 2026-10-31
updated: 2026-11-01
archived_at: 2026-11-01T22:56:57Z
---

## Notes

Node 18 reached end of life on 2025-04-30 and Node 20 on 2026-04-30 (endoflife.date/nodejs, read 2026-10-29). Node 22 leaves security support on 2027-04-30. The router has no dependencies, so the floor is a promise about which versions the repository tests and supports, not a technical need. Decision record: `docs/ADR/ADR-006-node-runtime-floor.md`.

Scope:

- Floor becomes Node 24 in `AGENTS.md` (Hard Rules, Testing), `README.md` (requirements) and the current-state lines of `context/foundation/prd.md` and `context/foundation/shape-notes.md`.
- The Node 18 ban list in `AGENTS.md` is removed, because every API on it exists in Node 24.
- The "Node 18 safe" comments in `pr-comment.mjs`, `test/helpers.mjs`, `test/phase-helpers.mjs` and `test/pr-comment.test.mjs` are shortened to match.
- No change to `route.mjs`, `policy.json`, the prompts or the router's behavior. No `engines` field: the repository has no `package.json`.

Left as is on purpose: `context/archive/` (read-only), and the dated owner decision at `shape-notes.md:167`, which records what was true on 2026-10-29.

Verification: `node --test skills/10x-pipeline/test/*.test.mjs` on Node 24 (395 pass, 2 skipped, after rebasing onto `phase-executors`).
