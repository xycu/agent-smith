# Lesson candidates in the pipeline report — Plan Brief

> Full plan: `context/changes/lesson-candidates/plan.md`
> Research: `context/archive/2026-10-30-rigor-levels/research.md` (lesson-candidate findings and Follow-up 1)
> Plan review: `context/changes/lesson-candidates/reviews/plan-review.md` (REVISE; F1 to F6 resolved in this revision)

## What & Why

The implementation review has no lesson section, so a recurring bug class found in a run is lost when the run ends. The review subagent will report candidates in an optional `RESULT` key, `signals.lessonCandidates`. The router lists them in `report.md`, each as a ready `/10x-lesson <seed>` command for a human to run.

## Starting Point

`cleanSignals` keeps two signal keys (`rigor`, `needsHuman`). `report.md` is written at every end of a run and survives an archive. The `impl-review` prompt is a plain string, and `executors.test.mjs` reads it as a string in two places (`:275`, `:567`). The shared suffix names `lessons.md` only as an evidence source and shows no `lessonCandidates` in its `RESULT` example. `/10x-lesson` is an interview and takes inline text only as a seed.

## Desired End State

A run whose review found a recurring pattern ends with a `## Lesson candidates` section in `report.md`: at most 3 one-line candidates per review, each at most 200 code points, each as `` `/10x-lesson <seed>` (step n) ``. A run with none has the same report as today. Nothing runs `/10x-lesson` unattended.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Carrier | `signals.lessonCandidates`, array of strings | The research proposed `signals`; `cleanSignals` is the existing sanitizer | Research |
| Source step | `impl-review` only | The scope names the review; keeps noise out of other steps | Plan |
| Limits | 3 per review, 200 code points, policy block `lessons` | A small cap bounds the noise of a weak prompt | Plan |
| Limits in the prompt | both numbers (`{lessonMax}`, `{lessonChars}`) and the `RESULT` fragment | The subagent cannot respect a limit it is not told | Review F2 |
| Over-long candidate | cut by code points, back to the last space | Keeps a usable seed and never splits a surrogate pair | Review F2 |
| Reviews counted | every `ok` impl-review, repeats dropped, no run-level cap | A bug class a later fix repaired is still a lesson; at most 9 on the longest path | Plan, review F4 |
| Seed | one line, format characters removed, backticks replaced | It sits in a Markdown code span, where markup is literal | Plan, review F6 |
| Duplicates vs `lessons.md` | the prompt tells the subagent to read the file; the router drops only exact repeats | Reading `lessons.md` in the router needs fuzzy matching | Plan, review F5 |
| Invalid policy value | falls back to the default | Keeps the prompt numbers and the sanitizer in step | Plan |
| Where shown | `report.md` only | The final message already points to the report | Plan |

## Scope

**In scope:** sanitizer and policy limits; report section; new prompt file wired into `impl-review` and `impl-review-warn`; tests, including two lines of `executors.test.mjs`; `SKILL.md`, README, ADR-003, `AGENTS.md` lines.

**Out of scope:** running `/10x-lesson`; changing the toolkit skills; new steps or budget; candidates from other steps; a run-level cap; Markdown escaping of seeds; changes to `compare`, `pr-comment.mjs` or the baseline policy; a zero value that switches the feature off; the roadmap (S-10 is already `planning`).

## Architecture / Approach

Data first, prompt last. The sanitizer stores clean candidates on the `impl-review` log entry; `buildReport` reads them back and renders the section. The prompt (`prompts/impl-review-lessons.md`, rule form) asks for the key, tells the subagent to read `lessons.md` when it exists, and `render` fills both caps from the policy through `{lessonMax}` and `{lessonChars}`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Policy limits and signal sanitizer | `lessons` policy block, `cleanSignals` keeps the key for `impl-review`, word-boundary cut | A signal key leaking from other steps |
| 2. Report section | `## Lesson candidates` in `report.md` | Changing today's report when no candidates exist |
| 3. Prompt wiring | rule file, both review templates, `{lessonMax}` and `{lessonChars}`, two `executors.test.mjs` lines | Module-level `fill` in `executors.test.mjs` breaks the whole file if missed; noisy candidates in live runs |
| 4. Docs | `SKILL.md`, README, ADR-003, `AGENTS.md` | Drift between the three docs |

**Prerequisites:** `rigor-levels` and `phase-executors` are archived; no other change touches `decide()` now.
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- A weak prompt yields noise or empty output; the caps limit the damage. Live behavior is a Manual row, not verified here.
- Decided without a human: the carrier, the caps, the source step, the cut rule, the per-review bound, the accepted untrusted text and the fallback rule. Each is a policy value or one function to change.
- A project that overrides `prompts["impl-review"]` as a string gets no candidates.

## Success Criteria (Summary)

- A fixture run shows the section in `report.md` with a pasteable `/10x-lesson` line.
- A run without candidates has an unchanged report.
- The full suite passes, including the rule-form and ADR checks.
