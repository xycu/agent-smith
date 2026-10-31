# Rigor-gated Pre-plan Steps and Backward Loops — Plan Brief

> Full plan: `context/changes/pre-plan-steps/plan.md`
> Research: `context/changes/pre-plan-steps/research.md`
> Revised after the plan review (REVISE); see "Review response" in the plan.

## What & Why

Let the pipeline router run `/10x-research`, legacy research (when a repo map exists), a domain brief and `/10x-frame` before the first plan, but only when the rigor level and the evidence call for them. Also loop a plan-review `RETHINK` back to frame and a repeated `REVISE` back to research, again only at the higher rigor level. Today the router has no concept of a step before the plan, the RETHINK/REVISE re-plan has no tests, and the plan prompt never names the upstream documents `/10x-plan` needs to ask fewer questions.

## Starting Point

`decide()` has one exit before a plan exists (step `plan`). The six rule-form prompt files in `skills/10x-pipeline/prompts/` are read by nothing. The skip loop in `next()` halts on the third skip in one call. Rigor before the plan comes only from `--rigor`, the goal class, failed steps and `signals.rigor`.

## Desired End State

At rigor `thorough` the router runs research, a domain brief and frame before the plan, each gated by a named predicate and verified by its artifact, and a RETHINK runs frame once then re-plans (a second RETHINK halts) while a second REVISE re-plan adds research first. At `lean` and `standard` nothing changes: same first step, no skip entries, and RETHINK/REVISE re-plan exactly as on main (a test proves it against an untouched characterization file). Frame is pinned to opus/high with an unattended decision guide. The plan prompt lists the artifacts that exist, and the re-plan prompt treats `frame.md` as authoritative. Tests walk the reference paths at `standard` (12 of 14, today's) and `thorough` (16 of 18) with one failed step to spare.

## Key Decisions Made

No human could answer the research's six open questions; each is an assumption with a reversal cost in the plan.

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gate default | `minRigor: thorough` for research, domain brief and frame; frame also needs `framingDoubt` | Keeps every existing standard and lean first step and test; costly steps stay opt-in | Plan (owner default) |
| Loop gate | `preplan.loops.minRigor`, default `thorough`; below it RETHINK/REVISE keep today's `plan-revise` behaviour | A standard RETHINK must not start sending runs through an unproven opus/high step | Plan review F1 |
| Legacy research | A template variant of the `research` step | Both prompts write `research.md`; a second step would write it twice | Research |
| Step budget | Pre-plan and loop steps count; `budgetDelta` unchanged; thorough reference path 16 of 18 tolerates one failed step | Standard worst path stays 12; raising the thorough delta is data a project can do | Plan, review F7 |
| Failure of a pre-plan step | Existing rule: retry at +1 tier, halt after 3; a failed re-plan after the frame round is retried too | The mechanism exists and is tested; no silent continue | Plan (owner default), review F2 |
| Frame Confidence LOW | No rigor change; router never reads the label; a plain goal ends `done` at LOW | `needsHuman` already wins; `/10x-plan` surfaces LOW itself | Research, review F6 |
| Framing doubt words | Cause- and design-shaped phrases only; bare `fix`, `bug`, `broken` are left out | `fix typo` must not open an opus/high step | Review F6 |
| Re-plan after frame | One rule line tells `/10x-plan` to treat `frame.md` as authoritative, only when it exists | Refine mode of `/10x-plan` would otherwise patch the old plan | Review F3 |
| Research check | The three research templates ask for `status:` frontmatter; the shipped prompt stays unedited | Verification must match what the prompt produces | Review F4 |
| Domain gap parser | Written against the real distillation format (`###` sections, bold qualified status) | A parser tested only on its author's fixture never fires | Review F5 |
| Unwired prompts | refactor-opportunities and the two ast-grep prompts stay out | Not in scope; ast-grep ones stop `blocked` when the tool is missing | Research |
| Skip logging | Rigor-closed gate is silent; an open gate that decides not to run logs a skip | Standard and lean reports stay as today | Plan |
| Skip cap | One skip per step per call replaces "three asks" | Three gated-out steps at thorough hit the old cap | Research |
| Prompts | `@prompts/<file>.md` references; arrays joined by newline; shared frame guide file | Reuse the checked prompt files unedited; one guide for frame and frame-rethink | Plan |

## Scope

**In scope:** step gates and predicates; the pre-plan branch; verification by artifact; prompt wiring and the frame guide; the artifact list and the frame authority rule in the plan prompts; `verdict` on log entries; both loops behind a rigor gate; the skip-cap fix; tests for the existing and the new loops; the budget reference paths; SKILL.md, README, AGENTS.md, prompts README, ADR-003.

**Out of scope:** the three unwired prompts; a new `signals` key; reading the Confidence label; calibrating word lists or tiers; budget delta changes; opening the loops below `thorough`; the roadmap status flip (done on the implementing branch); phase executors (S-08); report, archive and `status` code (S-05, S-06).

## Architecture / Approach

Data first: `policy.json` gets `steps` entries, a `preplan` block (order, gates with `minRigor`, `when`, `skipIf`, variants, artifact map, predicate config, loop caps and `loops.minRigor`) after `archive`, and new templates. `route.mjs` gains a section below `decide()` with a predicate map, `preplanNext()` for the no-plan branch and `replanNext()` for the re-plan branch, plus three verification cases and a prompt loader. Loops are counted by template name (`frame-rethink`, `research-revise`, `plan-revise`) so existing limits keep their meaning. Every `route.mjs` region the change edits is listed by phase in the plan, so S-05 and S-06 can merge around it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lock the current loop; store the verdict | Characterization tests for today's RETHINK/REVISE behaviour in their own file; `verdict` on entries | The baseline file must stay byte-identical (a `git diff` check in Phase 4) |
| 2. Policy data and prompt wiring | Steps, `preplan` block, templates, loader, frame guide, artifact list, authority rule; unattended `/10x-frame` runs | A changed plan prompt must stay byte-identical when no artifact exists |
| 3. Pre-plan gates, verification, skip cap | Predicates, pre-plan branch, artifact checks, cap fix | The word lists and the goal-match rule are uncalibrated |
| 4. Backward loops and the budget reference paths | `replanNext()` behind `loops.minRigor`, both loops, reference-path tests | Halt order in the re-plan branch; walker fixtures |
| 5. Docs, ADR-003, checks with a real pipeline | SKILL.md, README, AGENTS.md, ADR-003; a real thorough run and a real RETHINK run | Whether `/10x-plan` really reworks the plan after a frame brief |

**Prerequisites:** `rigor-levels` and `archive-adapter` merged (both are). S-05 and S-06 run in parallel and edit the same docs, `route.mjs` and `policy.json`; Phase 5 runs last and rebases onto whichever lands first.
**Estimated effort:** about 3-4 sessions across 5 phases.

## Open Risks & Assumptions

- `/10x-frame` unattended is usable by design (every ask point has a defined answer) but no run proves it; the Phase 2 manual rows prove it before the router relies on it, and `needsHuman` is the safety net.
- Lean is not covered by the budget proof: its budget 10 already cannot hold the pre-existing 12-step path when plan review runs. Unchanged by this plan.
- At `thorough` the worst path leaves room for one failed step only; a project that lowers a gate or `loops.minRigor` to `standard` should raise its own `budgetDelta.standard` to 1; the README says so.
- The RETHINK and research loops reach only `thorough` runs until run data justifies lowering the gate; that is a product call the plan took on the owner's behalf.
- Predicate word lists and the 4-letter goal match are guesses until S-06 gives run data.

## Success Criteria (Summary)

- `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the untouched existing-loop file, the gate matrix, both loops and the three reference-path walks.
- A `standard` or `lean` run looks exactly as before: same first step, no skip entries, a RETHINK still goes to `plan-revise`.
- An unattended `/10x-frame` run never asks a question, writes a valid `frame.md`, and either ends `done` or halts with `needsHuman` (only for an empty goal with nothing to frame).
