# AGENTS.md without @ imports — Plan Brief

> Full plan: `context/changes/agents-md-no-imports/plan.md`

## What & Why

`AGENTS.md` imports `README.md` and `docs/REFERENCE.md` with `@` at lines 3 and 16, so every session and subagent loads about 158 KB before work starts. Drop the imports, keep the pointers.

## Starting Point

The `@` tokens are only in `AGENTS.md`; the issue names README and REFERENCE as the files to edit, but they hold no import. No `CLAUDE.md` exists and no test covers this.

## Desired End State

`AGENTS.md` links to both files as plain markdown links, so an agent reads them only when the task needs them. A test fails if an import comes back.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where to edit | `AGENTS.md` lines 3 and 16 | The imports live there, not in README or REFERENCE. |
| Replacement | Markdown links, no `@` | A link is not an import and still names the file. |
| Guard | `tools/test/agents-md-no-imports.test.mjs` | Keeps the load from returning; runs in the existing suite. |
| ADR | None | Docs-only fix. |

## Scope

**In scope:** two lines of `AGENTS.md`, one guard test.

**Out of scope:** README/REFERENCE content, shrinking AGENTS.md, `shape-notes.md`.

## Architecture / Approach

Edit text, add a test that strips code spans and rejects `@<file>.md|json|mjs` tokens in `AGENTS.md`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Remove imports and guard | Clean AGENTS.md plus guard test | Merge conflict with parallel changes editing AGENTS.md |

**Prerequisites:** none.
**Estimated effort:** one short session, one phase.

## Open Risks & Assumptions

- Assumes Claude Code treats only `@path` outside code spans as an import; markdown links are not imports.
- Parallel issue changes touch `AGENTS.md`; the later merge rebases.

## Success Criteria (Summary)

- A fresh session does not load README.md or docs/REFERENCE.md.
- Full test suite and the new guard test pass.
