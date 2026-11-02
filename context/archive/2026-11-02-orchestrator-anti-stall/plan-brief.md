# Orchestrator Anti-Stall Rules — Plan Brief

> Full plan: `context/changes/orchestrator-anti-stall/plan.md`

## What & Why

Add five GIVEN/WHEN/THEN rules to `skills/10x-pipeline/SKILL.md`, in a section right after the Loop, so the orchestrator never sits idle between steps. In the managed-agent-patterns run (2026-11-02) it ended its turn waiting for a usage notice after the `score` step had reported back; nothing was running until the user asked.

## Starting Point

The Loop tells the orchestrator to run each subagent in the foreground, write the result file and call `next`. It does not cover a background launch notice, a usage figure that arrives late, when a turn may end, or how to answer "what is it doing". The router deletes the result file when `next` runs, so a late figure has nowhere to go, and it logs a step when it returns it, so an interrupted step halts a re-run with `has no result`.

## Desired End State

SKILL.md has a section `## Anti-stall rules` with a short intro and five one-line rules in ADR-004 form. Tests check the form and the content of that section. README documents the rules and the headless limit of rule 1, AGENTS.md lists the new test, ADR-004 lists the section in its checked scope. The suite passes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Optional `route.mjs usage <id> <n>` command | Out of scope | `change.md` marks it optional; it touches router state that AGENTS.md reserves and needs its own tests. |
| Where the rules live | Own `## Anti-stall rules` section after Loop | Existing `pr-comment.test.mjs` counts per Loop branch stay valid (checked on a scratch copy). |
| Rule form | ADR-004 GIVEN/WHEN/THEN, one bold keyword | Same form as prompts; `rules.test.mjs` can check it. |
| Legal turn ends (review F1) | Rule 4 yields to every STOP of Start and Loop; a run has ended when its end branch is finished | Otherwise rule 4 overrides `archived: false` and Start step 2. |
| Archive subagent (review F2) | Rule 1 holds for it; rules 2 and 3 do not | The `archive` action has no result file and no `next`; its usage goes to the final message. |
| Late usage | Dropped; step shows `-` for tokens | The router consumes the result file once; rewriting it would double-count or fail. |
| Headless runs (review F6) | Documented limit in README, no headless branch | Owner decision: a `claude -p` run is expected to exit early, not stall; not verified live. |
| Resume after an interrupted step | README states the real behavior: re-run halts with `has no result` | `route.mjs` logs the step before printing `run` and halts without a result file. |
| Tests | Form check in `rules.test.mjs`, content check in new `skill-loop.test.mjs`, positional needles | A reword that drops or reorders a behavior must fail a test. |
| ADR-004 | Scope list extended, no new ADR | The ADR names exactly what the form check covers. |

## Scope

**In scope:** the SKILL.md section and a Loop pointer, two test additions, README group, AGENTS.md entry, ADR-004 scope bullet.

**Out of scope:** `route.mjs`, `policy.json`, prompts, step budget, a usage command, a headless branch, a new ADR, live reproduction.

## Architecture / Approach

Text-only change to the orchestrator instructions. The rules sit in their own `## ` section so no existing Loop branch changes. Tests slice the section by heading, reuse the rule-form checker and match one needle set per rule line.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Anti-stall rules in SKILL.md | Section with intro and five rules, Loop pointer | A rule contradicts a Loop step |
| 2. Tests for the rules | Form and content tests, deliberate-break check | Needles too brittle or too loose |
| 3. Documentation | README group with the headless limit, AGENTS.md entry, ADR-004 scope | README group placed where `pr-comment.test.mjs` expects another |

**Prerequisites:** Node 24+, branch `feat/orchestrator-anti-stall`.
**Estimated effort:** about one session across 3 small phases, 6 files.

## Open Risks & Assumptions

- Assumption: the usage command is split out (no human to confirm; `change.md` allows it).
- Risk: the rules cannot be tested live; behavior depends on the Claude Code Agent tool.
- Risk: the headless early exit is the owner's expectation, not a tested fact; README says so.
- Risk: dropping a late figure leaves a step at `-`, which makes a `compare` pair not comparable.

## Success Criteria (Summary)

- A run no longer ends a turn with nothing running and no terminal action.
- The five behaviors from `change.md` are each one checked rule line.
- The full suite passes.
