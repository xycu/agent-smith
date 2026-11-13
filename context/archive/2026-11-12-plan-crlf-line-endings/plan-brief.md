# Plan CRLF Line Endings — Plan Brief

> Full plan: `context/changes/plan-crlf-line-endings/plan.md`

## What & Why

Make the router read `plan.md` files with CRLF line endings. Now `readPlan` throws on `### Phase 1: Core\r`, and rows and `**Files**:` lines silently match nothing, so pending work reads as done. Windows users with `core.autocrlf=true` hit it on every checkout of the plan.

## Starting Point

Three readers split plan text on `"\n"` and match lines with `$`-anchored patterns (`readPlan`, `planPaths` in `state.mjs`; `phaseFiles` in `steps.mjs`); `planFileTokens` has the same anchor. Other readers already use `split(/\r?\n/)`.

## Desired End State

A CRLF plan routes, reports risk and picks executors exactly like the same plan with LF. No plan reader throws on `\r`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| How to tolerate `\r` | `split(/\r?\n/)` in the three splitters, plus `\r?$` in `planFileTokens` | Matches the repo's existing readers; stored row text then has no `\r`. |
| `createdValue` | Left unchanged | It must read `created:` as `/10x-archive` does. |
| Other `split("\n")` readers | Left unchanged | Their patterns have no `$` anchor on captured text, or parse JSON/git output. |
| Tests | New `crlf-plan.test.mjs` plus one case in the phase files reader test | `phaseFiles` is not exported and is covered through tdd routing. |

## Scope

**In scope:** `state.mjs`, `steps.mjs` fixes; CRLF tests. AGENTS.md is not edited (owned by agents-md-slim).

**Out of scope:** lone `\r`, write-side normalisation, other readers, `helpers.mjs`.

## Architecture / Approach

Normalise at the line split, not at file read, so each reader keeps its text as written elsewhere.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tolerate CRLF in the plan readers | Four one-line reader fixes | A reader missed; checked by grep and parity tests |
| 2. Tests for CRLF plans | LF vs CRLF parity for readPlan, tokens, init, risk, tdd routing | Test must fail on old code |

**Prerequisites:** none.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumption: no human to ask; decisions follow the fix direction of `change.md` and repo conventions.
- Risk: a plan reader outside the audited list; the full suite and the grep guard it.

## Success Criteria (Summary)

- A CRLF plan routes like its LF copy; suite passes locally and CI is green.
