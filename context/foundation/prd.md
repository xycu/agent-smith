---
project: "agent-smith"
version: 1
status: draft
created: 2026-10-29
context_type: brownfield
product_type: other  # Claude Code plugin (skill + router script); unchanged by this work
target_scale:
  users: medium  # dozens to a hundred
  qps: # TODO: target_scale.qps — see Open Questions
  data_volume: # TODO: target_scale.data_volume — see Open Questions
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# agent-smith — PRD

## Current System Overview

- **Purpose:** agent-smith is a Claude Code plugin that orchestrates AI SDLC skill chains (README: "10xDevs + OpenSpec"). Each step of a chain runs in its own subagent.
- **Shipped skill:** `/agent-smith:10x-pipeline <change-id> [goal] [--size s|m|l]` runs plan, plan review, implement, implementation review, fix.
- **Router:** `skills/10x-pipeline/scripts/route.mjs` (Node.js 18+, ESM, no dependencies) reads `plan.md` `## Progress` and `reviews/*.md` (verdict, finding counts) and returns the next step, model, effort and prompt.
- **Policy:** `skills/10x-pipeline/policy.json` holds a 7-tier model/effort ladder, a base tier per step, escalation rules, limits and prompt templates. A project can override keys in `context/foundation/agent-smith-policy.json`.
- **Run state:** `context/changes/<change-id>/agent-smith/` (`run.jsonl`, `meta.json`).
- **Distribution:** Claude Code plugin and marketplace manifests in `.claude-plugin/`.
- **User base today:** nobody.
- **OpenSpec:** named in the README one-liner, not implemented anywhere in the repo.

## Problem Statement & Motivation

Running the chain on expensive models and effort levels consumes too much of the user's Claude usage limit, mostly the weekly limit.

The gap: today the router picks model and effort from review verdicts, finding counts, plan size, the size flag and failed attempts. It does not use the content of the generated artifacts (plan markdown, rubric results, code, intent files), so a simple change can run on the same tier as a complex one.

# TODO: why this change is needed now, and the current workaround and its cost — see Open Questions

## User & Persona

- **Primary:** the repository owner, running the plugin daily on their own projects if it works well. No existing users, so no existing experience changes.
- **Secondary (later):** other developers who install the plugin from the marketplace (dozens to a hundred users once shipped).

## Success Criteria

### Primary

- A report of which model and effort ran each step exists before the change is archived, and is posted as a comment on the pull request.
- The user's weekly Claude usage limit consumption drops significantly, measured by A/B test against a full run on Sonnet-5.5 at high effort. # TODO: target percentage — see Open Questions

### Secondary

- OpenSpec support through a second pipeline skill. Nice-to-have, built after dynamic routing works.

### Guardrails

- The router's own run is cheap: the user expects it to run on a Haiku-5.5-class model. Its cost counts toward the A/B usage comparison.
- The 10x toolkit skills and OpenSpec are not changed. agent-smith stays an add-on.
- Each step still runs in its own subagent, and run state stays in `context/changes/<change-id>/agent-smith/`.
- The user stated that nothing existing can break, because nothing uses agent-smith yet.

## User Stories

### US-01: Router chooses the step after planning

- **Given** a written plan in markdown files (after the plan step) AND the rubric results are generated
- **When** the router analyzes the result
- **Then** it decides whether the next step is plan-review or implement

#### Before this change

- Observed in `route.mjs`: plan-review always followed a plan step. The router did not choose between plan-review and implement.

### US-02: Router sets model and effort before plan-review

- **Given** that the next step is plan-review AND the plan markdown with rubric results is available
- **When** the router starts the plan-review
- **Then** it sets the proper model and effort beforehand, taking cost and complexity into account

#### Before this change

- Observed in `policy.json`: plan-review started at a fixed base tier (sonnet, medium), adjusted only by phase count and the size flag.

## Scope of Change

- [new] FR-001: The router can read generated project artifacts (plan markdown, rubric results, code, intent MD files) after a step. Priority: must-have
  > Socrates: Counter-argument considered: "reading costs tokens and can eat the savings." Resolution: kept as written; accept the reading cost for now.
- [modified] FR-002: The router can decide from the plan markdown and rubric results whether the next step is plan-review or implement, skipping plan-review only on a clean rubric. Priority: must-have. Was: plan-review always followed plan.
  > Socrates: Counter-argument considered: "skipping review can cost more later." Resolution: kept; plan-review is skipped only on a clean rubric, otherwise it always runs.
- [modified] FR-003: The router can set the model and effort before a step starts, from the artifacts, taking cost and complexity into account (a simple change gets a money-efficient pair, e.g. sonnet-5.5 at medium effort). Priority: must-have. Was: tier set from review verdicts, finding counts, plan size, size flag and failed attempts.
  > Socrates: Counter-argument considered: "a change misjudged as simple fails on a cheap tier and costs more." Resolution: kept; start cheap and rely on per-failure escalation.
- [new] FR-004: The user can see a report of which model and effort ran each step, written before the change is archived. Priority: must-have
  > Socrates: Counter-argument considered: "run.jsonl and the status command already show it." Resolution: kept; run.jsonl is machine data, the report is the human-readable summary for archive and pull request.
- [new] FR-005: The user can see the same report as a comment on the pull request. Priority: must-have
  > Socrates: Counter-argument considered: "needs GitHub access and a PR." Resolution: kept; skip the comment when no pull request exists. The report file is always written.
- [new] FR-006: The user can run an OpenSpec chain through a second pipeline skill. Priority: nice-to-have
  > Socrates: Counter-argument considered: "doubles the surface before routing is proven." Resolution: kept as nice-to-have, built after dynamic routing works.
- [preserved] FR-007: The pipeline runs each step in its own subagent. Priority: must-have
  > Socrates: Counter-argument considered: "every subagent reloads context." Resolution: kept; isolation is what enables a model and effort per step.
- [preserved] FR-008: The pipeline keeps run state in `context/changes/<change-id>/agent-smith/`. Priority: must-have
  > Socrates: Counter-argument considered: "committed run logs cause git noise." Resolution: kept; git handling (gitignore or commit policy) is decided downstream.

## Constraints & Compatibility

- **Backward compatibility:** not required. Nobody uses the current command, so it may change freely.
- **Existing data:** none known to carry over, because nothing uses agent-smith yet. # TODO: confirm — see Open Questions
- **Existing integrations:** the toolkit skills `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`, called as they are today. The 10x toolkit cannot be changed, and the same applies to OpenSpec.
- **Runtime:** requires a fairly new Claude Code version. The README names a subagent spawn depth of 3 or more, the default since Claude Code v2.1.219, because `10x-goal-implement` spawns its own subagents.
- **Preserved behavior:** one subagent per step (FR-007); run state in `context/changes/<change-id>/agent-smith/` (FR-008).

## Business Logic Changes

The router chooses model and effort for each step by task effort and complexity so that the agentic pipeline is money efficient.

- **Current rule:** the router derives the next step, model and effort from review verdicts, finding counts, plan size (phase count), the size flag and failed attempts.
- **Change:** the decision also uses a new scored rubric and usage or cost metrics, and may choose plan-review or implement as the next step (US-01). Whether this modifies or replaces the existing rule was assumed, not stated; see Open Questions.

## Access Control Changes

No access control changes — current model preserved. There is no auth and no roles; whoever runs Claude Code in the project can run the pipeline.

## Non-Goals

- Changing or forking the 10x toolkit skills, or OpenSpec. agent-smith is an add-on and never edits them.

## Open Questions

1. **What usage drop counts as success?** — Baseline is known (a full run on Sonnet-5.5 at high effort, compared by A/B test), but the target percentage is not set. Owner: user.
2. **What does "a dep for other models" mean?** — The user said the pipeline is a dependency for other models (meaning unclear: other modules or projects that depend on it?). Which ones, and what must stay stable for them? Owner: user.
3. **Which artifacts does the router score, and who produces the score?** — Code, intent MD files, others; a review step, or the router itself? Owner: user.
4. **Is usage or cost data available to the router, and from where?** — The user named usage and cost metrics as a rubric input. Owner: user.
5. **Is OpenSpec (FR-006) out of scope for this delivery?** — The user called it nice-to-have but did not list it as a non-goal. Owner: user.
6. **Does the router become an LLM-run step on a cheap model, or stay a script?** — The user expects the router to be cheap to run, like Haiku-5.5. Today `route.mjs` is a plain script with no LLM. Does the router read and judge artifacts on a cheap model, or only read structured rubric output? This affects questions 3 and 4 and the FR-001 note "reading costs tokens". Owner: user.
7. **What are the expected target_scale.qps and target_scale.data_volume?** — Not captured during shaping. Owner: user.
8. **Why now, and what is the current workaround and its cost?** — Not captured during shaping. Owner: user.
9. **Confirm two assumptions.** — (a) The change modifies the existing routing rule rather than replacing it. (b) There are no existing runs or data to carry over. Owner: user.
