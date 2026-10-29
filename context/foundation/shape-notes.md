---
project: agent-smith
context_type: brownfield
product_type: other  # Claude Code plugin (skill + Node.js router script); unchanged by this work
target_scale:
  users: medium  # dozens to a hundred (user)
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
created: 2026-10-29
updated: 2026-10-29
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: rubric metrics
      decision: new scored rubric and usage/cost metrics
    - topic: OpenSpec relation to 10x chain
      decision: second pipeline skill sharing the same router and policy
    - topic: primary persona
      decision: repo owner first, other developers later
    - topic: preserve existing 10x-pipeline command
      decision: not protected; may change freely
  frs_drafted: 8
  quality_check_status: accepted
---

# Shape Notes: agent-smith

Seed: "Check @README.md for general description" (user, 2026-10-29). README one-liner: "Agent orchestrating AI SDLC workflows (10xDevs + OpenSpec)."

## Current System

- Purpose: agent-smith is a Claude Code plugin that orchestrates AI SDLC skill chains (README: "10xDevs + OpenSpec"). Each step of a chain runs in its own subagent.
- Shipped skill: `/agent-smith:10x-pipeline <change-id> [goal] [--size s|m|l]` runs plan, plan review, implement, implementation review, fix.
- Router: `skills/10x-pipeline/scripts/route.mjs` (Node.js 18+, ESM, no dependencies) reads `plan.md` `## Progress` and `reviews/*.md` (verdict, finding counts) and returns the next step, model, effort and prompt.
- Policy: `skills/10x-pipeline/policy.json` holds a 7-tier model/effort ladder, a base tier per step, escalation rules, limits and prompt templates. A project can override keys in `context/foundation/agent-smith-policy.json`.
- Run state: `context/changes/<change-id>/agent-smith/` (`run.jsonl`, `meta.json`).
- Distribution: Claude Code plugin and marketplace manifests in `.claude-plugin/`.
- Users today: nobody (user, 2026-10-29).
- OpenSpec: named in the README one-liner, not implemented anywhere in the repo.

## Vision & Problem Statement

Pain: running the chain on expensive models and effort levels consumes too much of the user's Claude usage limit, mostly the weekly limit (user, 2026-10-29).

Change (delta):

1. Add OpenSpec support as a second pipeline skill next to `10x-pipeline`, sharing the same router and policy.
2. Adjust model and effort dynamically from the results of earlier steps. Inputs named by the user: a new scored rubric (review steps produce scores) and usage or cost metrics.

## User & Persona

- Primary: the repository owner, running the plugin daily on their own projects if it works well. No users today.
- Secondary (later): other developers who install the plugin from the marketplace.

## Access Control

No changes planned — current model preserved. The plugin has no auth and no roles; whoever runs Claude Code in the project can run the pipeline (user, 2026-10-29).

## Success Criteria

Primary change flow (user, 2026-10-29):

1. User runs `/agent-smith:10x-pipeline <change-id>`.
2. After a step finishes, the router reads generated artifacts from the project repo (code, intent MD files, etc.).
3. The router picks the next step's model and effort from them. A simple change gets a money-efficient pair, e.g. sonnet-5.5 at medium effort.
4. The user sees a report of which model and effort ran each step, written before the change is archived and also posted as a comment on the GitHub PR.

Blast radius: none. Nothing uses agent-smith yet, so nothing existing can break (user).
Timeline: user can ship this in three weeks of after-hours work and wants it ASAP.

### Primary

- A report of the model and effort used per step exists before archiving and is posted as a PR comment on GitHub.
- The user's weekly Claude usage limit consumption drops significantly (target not yet quantified; see Open Questions).

### Secondary

- OpenSpec support (second pipeline skill). Nice-to-have, not part of the first delivery.

### Guardrails

- None stated. User: "Nothing can break - this is not used yet!"

## Open Questions (running)

1. What usage drop counts as success? Baseline is known (a full run on Sonnet-5.5 at high effort, compared by A/B test), but the target (percentage) is not set. Owner: user.
2. User said the pipeline "is a dep for other models" (meaning unclear: other modules or projects that depend on it?). Which ones, and what must stay stable for them? Owner: user.
3. Which artifacts does the router score (code, intent MD files, others), and who produces the score: a review step, or the router itself? Owner: user.
4. Is usage or cost data available to the router at all, and from where? (User named usage/cost metrics as a rubric input in Phase 1.) Owner: user.
5. Is OpenSpec (FR-006) out of scope for this delivery? User called it nice-to-have but did not list it as a non-goal. Owner: user.
6. The user expects the router to be cheap to run, like Haiku-5.5 (added after the quality check). Today `route.mjs` is a plain script with no LLM. Does the router become an LLM-run step on a cheap model that reads and judges artifacts, or does it stay a script and only read structured rubric output? This affects Open Questions 3 and 4 and the FR-001 note "reading costs tokens". Owner: user.

## Functional Requirements

- FR-001: The router can read generated project artifacts (plan markdown, rubric results, code, intent MD files) after a step. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "reading costs tokens and can eat the savings." Resolution: kept as written; accept the reading cost for now.
- FR-002: The router can decide from the plan markdown and rubric results whether the next step is plan-review or implement, skipping plan-review only on a clean rubric. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "skipping review can cost more later." Resolution: kept; plan-review is skipped only on a clean rubric, otherwise it always runs.
- FR-003: The router can set the model and effort before a step starts, from the artifacts, taking cost and complexity into account (a simple change gets a money-efficient pair, e.g. sonnet-5.5 at medium effort). Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "a change misjudged as simple fails on a cheap tier and costs more." Resolution: kept; start cheap and rely on per-failure escalation.
- FR-004: The user can see a report of which model and effort ran each step, written before the change is archived. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "run.jsonl and the status command already show it." Resolution: kept; run.jsonl is machine data, the report is the human-readable summary for archive and PR.
- FR-005: The user can see the same report as a comment on the GitHub PR. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "needs GitHub access and a PR." Resolution: kept; skip the comment when no PR exists. The report file is always written.
- FR-006: The user can run an OpenSpec chain through a second pipeline skill. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument considered: "doubles the surface before routing is proven." Resolution: kept as nice-to-have, built after dynamic routing works.
- FR-007: The pipeline runs each step in its own subagent. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: "every subagent reloads context." Resolution: kept; isolation is what enables a model and effort per step.
- FR-008: The pipeline keeps run state in `context/changes/<change-id>/agent-smith/`. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: "committed run logs cause git noise." Resolution: kept; git handling (gitignore or commit policy) is decided downstream.

Note: FR-002 was derived from the user's first Given/When/Then (user, 2026-10-29). Everything else was drafted from Phase 3 answers and confirmed by the user.

## User Stories

### US-01: Router chooses the step after planning

- **Given** a written plan in markdown files (after the plan step) AND the rubric results are generated
- **When** the router analyzes the result
- **Then** it decides whether the next step is plan-review or implement

### US-02: Router sets model and effort before plan-review

- **Given** that the next step is plan-review AND the plan markdown with rubric results is available
- **When** the router starts the plan-review
- **Then** it sets the proper model and effort beforehand, taking cost and complexity into account

## Business Logic

The router chooses model and effort for each step by task effort and complexity so that the agentic pipeline is money efficient (user, 2026-10-29).

Change type: modifies the existing rule (assumed from the user's answer; not stated explicitly).

- Current rule: the router derives the next step, model and effort from review verdicts, finding counts, plan size (phase count), the `--size` flag and failed attempts (observed in `route.mjs` and `policy.json`).
- Change: the decision also uses a new scored rubric and usage or cost metrics (Phase 1), and may choose plan-review or implement as the next step (US-01).

## Constraints & Preserved Behavior

- The 10x toolkit skills cannot be changed. The same applies to OpenSpec. agent-smith is an add-on (user, 2026-10-29).
- Preserved: each step runs in its own subagent (FR-007); run state stays in `context/changes/<change-id>/agent-smith/` (FR-008).
- Backward compatibility: not required. Nobody uses the current command, so it may change freely (Phase 1).
- Data migration: none known. No existing runs to migrate because nothing uses it yet (inferred from the user's statements; confirm).
- Runtime constraint: requires a fairly new Claude Code version (user). The README names `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more, the default since Claude Code v2.1.219, because `10x-goal-implement` spawns its own subagents.
- Existing integrations: the toolkit skills `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`, called as they are today.

## Non-Functional Requirements

- Usage consumption of a full pipeline run drops compared with a full run on Sonnet-5.5 at high effort, measured by A/B test. Target percentage not set (see Open Questions 1).
- The router's own run is cheap: user expects it to run on a Haiku-5.5-class model (user, 2026-10-29, after Phase 6). Its cost counts toward the A/B usage comparison.
- The model and effort used by each step are visible to the user before the change is archived (FR-004).

## Non-Goals

- Changing or forking the 10x toolkit skills, or OpenSpec. agent-smith is an add-on and never edits them (user, 2026-10-29).

## Product framing

- Product type: unchanged, still a Claude Code plugin (user).
- User base: dozens to a hundred users once shipped (user).
- Timing: no hard deadline, after-hours work only, three-week delivery target.

## Forward: tech-stack

- Router language: Node.js or Python; the user will decide later (user, 2026-10-29). Today's router is Node.js 18+ ESM.

## Quality cross-check

All six elements present (Access Control, Business Logic, Project artifacts, Timeline-cost ack, Non-Goals, Preserved behavior). No gaps. Five open questions carry over to `/10x-prd` (see `## Open Questions (running)`).

## Forward: ADR-001 (added after the PRD)

- On 2026-10-29 the user asked for a complexity-routing proposal to be recorded as `docs/ADR/ADR-001-phased-complexity-routing.md` (status: Proposed) and folded into `context/`. After review the user agreed to narrow it to a phased approach.
- Phase 1: measure usage per step, route on deterministic signals the script can read, and add a separate risk axis set by path rules. Scored LLM complexity is deferred to Phase 2, only if the data demands it.
- PRD impact: FR-009 to FR-011, a phasing paragraph under Business Logic Changes, a calibration metric under Success Criteria, and Open Questions 10 and 11. These were added directly to `prd.md` after the shaping session. A Socrates round on 2026-10-30 challenged FR-009 to FR-011 and their resolutions are recorded in the PRD.
