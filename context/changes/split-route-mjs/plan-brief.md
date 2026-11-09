# Split route.mjs — Plan Brief

> Full plan: `context/changes/split-route-mjs/plan.md`
> Research: `context/changes/split-route-mjs/research.md`

## What & Why

Split `skills/10x-pipeline/scripts/route.mjs` (3582 lines) into five sibling modules plus the entry, with no behavior change. The file is too long to work in, and the later `openspec-pipeline` change needs importable seams (`paths()`, `decide()`, `attachResult()`, `loadPolicy`).

## Starting Point

One file, no exports, `main()` runs on import, one mutable binding (`undoOnError`) shared by `next` and `main`. The suite drives the router as a CLI. Only one test reads router source (the `gh` guard).

## Desired End State

`state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs`, `isolation.mjs` and a ~685-line `route.mjs` entry in the same folder, acyclic imports, suite green, docs updated. CLI, state files and provenance unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Layout | 5 modules + entry, siblings of `route.mjs` | Keeps `SKILL_DIR` valid and plugin-tree copies working | Research |
| Entry content | `undoOnError`, `next`, commands, `main` stay in `route.mjs` | ES modules cannot assign imported bindings; avoids a setter | Research |
| Moved items | `isObject`, `halt`, `scoreConfig`, `ARTIFACT_NAME`, `e2eSetup` relocate | Removes back-edges so the graph is acyclic | Research |
| Tests over 1000 lines | Left alone | Saves no lines, edits the oracle | Research (assumed, owner undecided) |
| Ponytail merges | Deferred to a follow-up | ~2% of file, each risks output change | Research |
| Verification | Suite per step plus out-of-repo check script; widen `gh` guard first | Catches forgotten imports on untested paths | Research |
| Docs | Reword AGENTS.md and SKILL.md only; ADRs untouched | ADRs are historical | Research (assumed) |

## Scope

**In scope:** the five extractions, `gh` guard widening, AGENTS.md and SKILL.md wording.

**Out of scope:** test-file splits, merges/deletions, `paths()` root parameter, ADR edits, any behavior change.

## Architecture / Approach

Verbatim moves, one commit per module in dependency order (state, preplan, steps, flow, isolation). Each new module imports only earlier ones; none imports `route.mjs`. A throw-away script compares declaration multisets and checks import completeness after each step.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard + baseline | Wider `gh` guard, check script | Script false negatives |
| 2. state.mjs | Leaf module | Missed export |
| 3. preplan.mjs | Pre-plan, score, replan | `e2eSetup` back-edge |
| 4. steps.mjs | Executors, manual, tier | Cross-module imports |
| 5. flow.mjs | Report, intake, decide | Largest import list |
| 6. isolation.mjs | Provenance, git, archive | `undoOnError` TDZ and untested halt paths |
| 7. Docs | AGENTS.md, SKILL.md | Stale references |

**Prerequisites:** Node 24; clean worktree on the run branch.
**Estimated effort:** ~7 small sessions, one commit each.

## Open Risks & Assumptions

- Forgotten import on an untested halt path; mitigated by the check script.
- Module line counts are estimates (±15).
- Assumes the owner wants the 1000-line test files left for now.

## Success Criteria (Summary)

- Suite passes after every commit.
- `route.mjs` and every new module under about 750 lines.
- No CLI or output change; docs point to the right modules.
