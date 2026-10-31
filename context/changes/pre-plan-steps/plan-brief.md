# Rigor-gated Pre-plan Steps and Backward Loops — Plan Brief

> Full plan: `context/changes/pre-plan-steps/plan.md`
> Research: `context/changes/pre-plan-steps/research.md`

## What & Why

Let the pipeline router run `/10x-research`, legacy research (when a repo map exists), a domain brief and `/10x-frame` before the first plan, but only when the rigor level and the evidence call for them. Also loop a plan-review `RETHINK` back to frame and a repeated `REVISE` back to research. Today the router has no concept of a step before the plan, the RETHINK/REVISE re-plan has no tests, and the plan prompt never names the upstream documents `/10x-plan` needs to ask fewer questions.

## Starting Point

`decide()` has one exit before a plan exists (step `plan`). The six rule-form prompt files in `skills/10x-pipeline/prompts/` are read by nothing. The skip loop in `next()` halts on the third skip in one call. Rigor before the plan comes only from `--rigor`, the goal class, failed steps and `signals.rigor`.

## Desired End State

At rigor `thorough` the router runs research, a domain brief and frame before the plan, each gated by a named predicate and verified by its artifact; `lean` and `standard` runs are unchanged. Frame is pinned to opus/high with an unattended decision guide. RETHINK runs frame once then re-plans (a second RETHINK halts); a second REVISE re-plan adds research first. The plan prompt lists the artifacts that exist. A test walks the longest legal path at `standard` (13 of 14 steps) and `thorough` (16 of 18).

## Key Decisions Made

No human could answer the research's six open questions; each is an assumption with a reversal cost in the plan.

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gate default | `minRigor: thorough` for research, domain brief and frame; frame also needs `framingDoubt` | Keeps every existing standard and lean first step and test; costly steps stay opt-in | Plan (owner default) |
| Legacy research | A template variant of the `research` step | Both prompts write `research.md`; a second step would write it twice | Research |
| Step budget | Pre-plan and loop steps count; `budgetDelta` unchanged | Longest failure-free path is 13 at standard and 16 at thorough, below 14 and 18 | Plan |
| Failure of a pre-plan step | Existing rule: retry at +1 tier, halt after 3 | The mechanism exists and is tested; no silent continue | Plan (owner default) |
| Frame Confidence LOW | No rigor change; router never reads the label | `needsHuman` already wins; `/10x-plan` surfaces LOW itself | Research |
| Unwired prompts | refactor-opportunities and the two ast-grep prompts stay out | Not in scope; ast-grep ones stop `blocked` when the tool is missing | Research |
| Skip logging | Rigor-closed gate is silent; an open gate that decides not to run logs a skip | Standard and lean reports stay as today | Plan |
| Skip cap | One skip per step per call replaces "three asks" | Three gated-out steps at thorough hit the old cap | Research |
| Prompts | `@prompts/<file>.md` references; arrays joined by newline; shared frame guide file | Reuse the checked prompt files unedited; one guide for frame and frame-rethink | Plan |
| Predicates | Goal-word lists (frame's own triggers; leak words) and the distillation `status` column | No structured leak signal exists; uncalibrated | Research |

## Scope

**In scope:** step gates and predicates; the pre-plan branch; verification by artifact; prompt wiring and the frame guide; the artifact list in the plan prompt; `verdict` on log entries; both loops; the skip-cap fix; tests for the existing and the new loops; the budget proof; SKILL.md, README, AGENTS.md, prompts README, ADR-003.

**Out of scope:** the three unwired prompts; a new `signals` key; reading the Confidence label; calibrating word lists or tiers; budget delta changes; phase executors (S-08); report, archive and `status` code (S-05, S-06).

## Architecture / Approach

Data first: `policy.json` gets `steps` entries, a `preplan` block (order, gates with `minRigor`, `when`, `skipIf`, variants, artifact map, predicate config, loop caps) after `archive`, and new templates. `route.mjs` gains a section below `decide()` with a predicate map, `preplanNext()` for the no-plan branch and `replanNext()` for the re-plan branch, plus three verification cases and a prompt loader. Loops are counted by template name (`frame-rethink`, `research-revise`, `plan-revise`) so existing limits keep their meaning.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lock the current loop; store the verdict | Tests for today's RETHINK/REVISE behaviour; `verdict` on entries | Tests must stay valid after Phase 4 (loops-disabled override) |
| 2. Policy data and prompt wiring | Steps, `preplan` block, templates, loader, frame guide, artifact list | A changed plan prompt must stay byte-identical when no artifact exists |
| 3. Pre-plan gates, verification, skip cap | Predicates, pre-plan branch, artifact checks, cap fix | The word lists and the goal-match rule are uncalibrated |
| 4. Backward loops and the budget proof | `replanNext()`, both loops, longest-path tests | Halt order in the re-plan branch; walker fixtures |
| 5. Docs, ADR-003, unattended checks | SKILL.md, README, AGENTS.md, ADR-003; unattended `/10x-frame` runs | Unattended frame is unproven by any run |

**Prerequisites:** `rigor-levels` and `archive-adapter` merged (both are). S-05 and S-06 run in parallel and edit the same docs and `policy.json`.
**Estimated effort:** about 3-4 sessions across 5 phases.

## Open Risks & Assumptions

- `/10x-frame` unattended is usable by design (every ask point has a defined answer) but no run proves it; the Phase 5 manual rows are the proof, and `needsHuman` is the safety net.
- Lean is not covered by the budget proof: its budget 10 already cannot hold the pre-existing 12-step path when plan review runs. Unchanged by this plan.
- A project that lowers a gate below `thorough` must raise its own `budgetDelta`; the README says so.
- Predicate word lists and the 4-letter goal match are guesses until S-06 gives run data.

## Success Criteria (Summary)

- `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the existing-loop tests, the gate matrix, both loops and the two longest-path walks.
- A `standard` or `lean` run looks exactly as before: same first step, no skip entries.
- An unattended `/10x-frame` run never asks a question, writes a valid `frame.md`, and either ends `done` or halts with `needsHuman`.
