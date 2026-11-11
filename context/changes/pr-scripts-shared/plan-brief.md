# Shared helpers for open-pr.mjs and pr-comment.mjs — Plan Brief

> Full plan: `context/changes/pr-scripts-shared/plan.md`

## What & Why

`open-pr.mjs` and `pr-comment.mjs` carry copied helpers (`firstLine`, the `gh` runner, id pattern, `--report` check, mention rule, 60000 cap, entry-point check, temp-folder cleanup). The copies drifted: `open-pr.mjs` lets a cleanup error end in `internal error` with `pushed: false` after a good push, and it holds a literal zero-width space where the other writes `​`. Move them to one module (GitHub issue #95).

## Starting Point

Two standalone scripts under `skills/10x-pipeline/scripts/`; `open-pr.mjs` already imports `remove-tree.mjs`. Tests drive both through a fake `gh`; none covers the drift.

## Desired End State

`pr-common.mjs` owns the shared helpers, both scripts import it, and a cleanup error never changes either script's printed result. Output is otherwise byte-identical.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Module name and place | `scripts/pr-common.mjs`, standalone | Same folder as the scripts and `remove-tree.mjs`; no router module touches it | Plan |
| What moves | Constants, `firstLine`, `spawn`/`runGh`, `ghFailure`, report-arg check, `capBody`, `withTempDir`, `isEntryPoint` | These are the duplicated pieces named in the issue | Plan |
| What stays | Markers, `parseArgs`, `runGit`, result shapes, body framing | They differ on purpose or have one user | Plan |
| Cleanup errors | Swallowed in `withTempDir` for both scripts | Matches `pr-comment.mjs`; a cleanup error must not undo a pushed run | Plan |
| `gh pr view` failure text | Shared `ghFailure` mapping | Removes the third copy; only empty-stderr text changes | Plan |
| ADR | None | Refactor, no new decision | Plan |

## Scope

**In scope:** new module and its tests, both scripts, two test-file adjustments, `AGENTS.md` and `docs/REFERENCE.md` lines.

**Out of scope:** git helpers, marker text, argument parsing, router modules, policy, skills.

## Architecture / Approach

Extract the helpers verbatim into `pr-common.mjs`, cover them with unit tests, switch each script to the imports, then repair the two tests that depend on file layout (the mutation test copy list and the `gh` literal guard) and update docs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared module | `pr-common.mjs` plus unit tests | Extraction differs from the original |
| 2. Rewire | Both scripts import it; tests green | Mutation test and guard break on the new file |
| 3. Docs | `AGENTS.md`, `docs/REFERENCE.md` | Stale "standalone" claims |

**Prerequisites:** none.
**Estimated effort:** ~1 session, 3 small phases.

## Open Risks & Assumptions

- Assumes `capBody` over the framed text equals today's output (marker lines hold no `@`).
- A regression test for the open-pr cleanup error may need a fake-`gh` trick; fallback is a `withTempDir` unit test.

## Success Criteria (Summary)

- Full suite passes; no copy of the helpers remains in either script.
- A cleanup error after a created pull request no longer prints `internal error`.
