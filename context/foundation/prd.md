---
project: "agent-smith"
version: 1
status: draft
created: 2026-10-29
context_type: brownfield
product_type: other  # Claude Code plugin (skill + router script); unchanged by this work
target_scale:
  users: medium  # dozens to a hundred
  qps: 0  # one sequential run at a time; no server (decided 2026-10-31)
  data_volume: "KBs per run (run.jsonl, report.md); hundreds of runs"  # decided 2026-10-31
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# agent-smith — PRD

## Current System Overview

- **Purpose:** agent-smith is a Claude Code plugin that orchestrates AI SDLC skill chains (README: "10xDevs + OpenSpec"). Each step of a chain runs in its own subagent.
- **Shipped skill:** `/agent-smith:10x-pipeline <change-id> [goal]` runs plan, plan review, implement, implementation review, fix.
- **Router:** `skills/10x-pipeline/scripts/route.mjs` (Node.js 24+, ESM, no dependencies) reads `plan.md` `## Progress` and `reviews/*.md` (verdict, finding counts) and returns the next step, model, effort and prompt.
- **Policy:** `skills/10x-pipeline/policy.json` holds a 7-tier model/effort ladder, a base tier per step, escalation rules, limits and prompt templates. A project can override keys in `context/foundation/agent-smith-policy.json`.
- **Run state:** `context/changes/<change-id>/agent-smith/` (`run.jsonl`, `meta.json`).
- **Distribution:** Claude Code plugin and marketplace manifests in `.claude-plugin/`.
- **User base today:** nobody.
- **OpenSpec:** named in the README one-liner, not implemented anywhere in the repo.

## Problem Statement & Motivation

Running the chain on expensive models and effort levels consumes too much of the user's Claude usage limit, mostly the weekly limit.

The gap: today the router picks model and effort from review verdicts, finding counts, plan size, the goal text and failed attempts. It does not use the content of the generated artifacts (plan markdown, rubric results, code, intent files), so a simple change can run on the same tier as a complex one.

Why now (decided 2026-10-31): the weekly Claude usage limit runs out before the week ends. The current workaround is to run every 10x step by hand on a fixed, expensive model and effort level. The cost is the weekly limit itself.

## User & Persona

- **Primary:** the repository owner, running the plugin daily on their own projects if it works well. No existing users, so no existing experience changes.
- **Secondary (later):** other developers who install the plugin from the marketplace (dozens to a hundred users once shipped).

## Success Criteria

### Primary

- A report of which model and effort ran each step exists before the change is archived, and is posted as a comment on the pull request.
- The user's weekly Claude usage limit consumption drops significantly, measured by A/B test against a full run on Sonnet-5.5 at high effort. Target (decided 2026-10-31): a drop of 30% in raw tokens, provisional until at least 5 comparable pairs exist.

### Secondary

- OpenSpec support through a second pipeline skill. Nice-to-have, built after dynamic routing works.
- Routing quality is judged by the cost of successfully delivered changes, not token price alone: first-pass acceptance rate, retry count, human correction rate and cost per completed change (ADR-001, `docs/ADR/ADR-001-phased-complexity-routing.md`).

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

- Observed in `policy.json`: plan-review started at a fixed base tier (sonnet, medium), adjusted only by phase count.

## Scope of Change

- [new] FR-001: The router can read generated project artifacts (plan markdown, rubric results, code, intent MD files) after a step. Priority: must-have
  > Socrates: Counter-argument considered: "reading costs tokens and can eat the savings." Resolution: kept as written; accept the reading cost for now.
- [modified] FR-002: The router can decide from the plan markdown and rubric results whether the next step is plan-review or implement, skipping plan-review only on a clean rubric. Priority: must-have. Was: plan-review always followed plan.
  > Socrates: Counter-argument considered: "skipping review can cost more later." Resolution: kept; plan-review is skipped only on a clean rubric, otherwise it always runs.
  > Socrates, 2026-10-30 (rigor-levels): Counter-argument considered: "a clean rubric is not defined, so the skip cannot be built." Resolution: changed. The router skips plan-review when the change's rigor level is `lean`, and logs the skip with its reason in `run.jsonl` and `report.md`. The skip needs a measured risk (git history readable and the plan names at least one path) and happens only before implementation starts. Any other level, an unmeasured risk or a hot path in the plan runs plan-review.
- [modified] FR-003: The router can set the model and effort before a step starts, from the artifacts, taking cost and complexity into account (a simple change gets a money-efficient pair, e.g. sonnet-5.5 at medium effort). Priority: must-have. Was: tier set from review verdicts, finding counts, plan size, goal text and failed attempts.
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
  > Note (2026-10-30, from `archive-adapter`): git handling is resolved: with `--archive` the router commits the change folder, including `agent-smith/`, before archive; without the flag it writes nothing to git (it only reads history, for churn risk).

Added from ADR-001 (challenged in a Socrates round on 2026-10-30):

- [new] FR-009: The pipeline can record usage per step (model, effort, and token or cost figures where available) in run state, so runs can be compared against a full run on Sonnet-5.5 at high effort. Priority: must-have
  > Socrates: Counter-argument considered: "usage figures may not be readable by the script." Resolution: kept; record model and effort now, add token or cost figures once a readable source is found (Open Question 4). Finding that source is the first task.
- [new] FR-010: The router can mark a change as elevated risk from configurable path rules, and for elevated risk always runs plan-review and implementation review and halts for a human at the highest level. Priority: must-have. Constrains FR-002: plan-review is skipped only when the change is not elevated risk.
  > Socrates: Counter-argument considered: "path rules misjudge risk, missing risky changes and over-flagging harmless ones." Resolution: kept; start with a small set of path rules and review them after the first runs.
  > Decision, 2026-10-30 (rigor-levels): elevated risk means paths that change often in git history (churn), measured with the parameters under `risk` in `policy.json`. A plan or diff that touches such a path raises the rigor level to at least `standard`, so a change on a hot path never runs at `lean` and always gets plan-review. The numbers are uncalibrated until real runs exist.
  > Deferred, 2026-10-30: "halts for a human at the highest level" is out of scope for `rigor-levels`. Only the generic stop exists: a subagent that cannot decide from evidence reports `blocked` with `signals.needsHuman`, and the router halts once with a report.
- [new] FR-011: The pipeline can score change complexity with an LLM on a cheap model and store the scores with evidence and unknowns in a machine-readable file. Priority: must-have.
  > Socrates: Counter-argument considered: "a deferred FR invites early building." Resolution: kept as nice-to-have and listed as a non-goal for this delivery.
  > Decision, 2026-10-31 (owner): changed from nice-to-have to must-have and pulled into milestone M-1 as slice S-11. This supersedes the Phase 2 deferral in ADR-001 and the non-goal below. The Phase 1 measurements are not a precondition any more. Where the LLM call runs is settled by ADR-007 (accepted 2026-10-31): an orchestrator-run subagent step that the router schedules, so `route.mjs` stays free of LLM and network calls as `AGENTS.md` and ADR-006 require.

## Constraints & Compatibility

- **Backward compatibility:** not required. Nobody uses the current command, so it may change freely.
- **Existing data:** none to carry over, because nothing uses agent-smith yet (confirmed 2026-10-31).
- **Stable surface for installers (decided 2026-10-31):** other projects install the plugin, so the `/agent-smith:10x-pipeline` command, the policy override file `context/foundation/agent-smith-policy.json`, and the formats of `run.jsonl` and `report.md` are kept stable. Everything else may change.
- **Existing integrations:** the toolkit skills `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`, called as they are today. The 10x toolkit cannot be changed, and the same applies to OpenSpec.
- **Runtime:** requires a fairly new Claude Code version. The README names a subagent spawn depth of 3 or more, the default since Claude Code v2.1.219, because `10x-goal-implement` spawns its own subagents.
- **Preserved behavior:** one subagent per step (FR-007); run state in `context/changes/<change-id>/agent-smith/` (FR-008).

## Business Logic Changes

The router chooses model and effort for each step by task effort and complexity so that the agentic pipeline is money efficient.

- **Current rule:** the router derives the next step, model and effort from review verdicts, finding counts, plan size (phase count), the goal text and failed attempts.
- **Change:** the decision also uses a new scored rubric and usage or cost metrics, and may choose plan-review or implement as the next step (US-01).
- **Phasing (ADR-001, proposed):** Phase 1 routes on deterministic signals the script can read without an LLM (phase count, goal text, files changed, review verdicts, finding counts, failed attempts) and adds a separate risk axis set by path rules. Scored complexity (cognitive and execution complexity, risk and confidence, each factor 0 to 3) was deferred to Phase 2. Details: `docs/ADR/ADR-001-phased-complexity-routing.md`.
- **Update, 2026-10-31 (owner):** the Phase 2 scorer is pulled into this delivery (FR-011, slice S-11), and the scorer runs as an LLM step on a cheap model. The deterministic Phase 1 signals stay as inputs. ADR-007 settles where the call runs and supersedes the Phase 2 deferral in ADR-001.

## Access Control Changes

No access control changes — current model preserved. There is no auth and no roles; whoever runs Claude Code in the project can run the pipeline.

## Non-Goals

- Changing or forking the 10x toolkit skills, or OpenSpec. agent-smith is an add-on and never edits them.
- OpenSpec support (FR-006) in this delivery (confirmed 2026-10-31).

## Open Questions

1. **What usage drop counts as success?** — Resolved 2026-10-31: 30% in raw tokens against the Sonnet-5.5 high-effort baseline, provisional until at least 5 comparable pairs exist. Owner: user.
2. **What does "a dep for other models" mean?** — Resolved 2026-10-31: other projects install the plugin. The command, the policy override file and the `run.jsonl` and `report.md` formats stay stable (see Constraints). Owner: user.
3. **Which artifacts does the router score, and who produces the score?** — Resolved 2026-10-31: an LLM scorer is built in this delivery (FR-011, slice S-11), not deferred to Phase 2. ADR-007 (accepted 2026-10-31) has a `score` subagent step produce the score from `change.md`, the goal and the upstream artifacts; the router only validates and applies it. Owner: user.
4. **Is usage or cost data available to the router, and from where?** — Answered by S-02 (the orchestrator copies the Agent result's usage into the step result). Not yet confirmed on a foreground Agent result; to be verified on the next real run (S-10), then closed. Owner: user.
5. **Is OpenSpec (FR-006) out of scope for this delivery?** — Resolved 2026-10-31: yes, it stays parked (see Non-Goals). Owner: user.
6. **Does the router become an LLM-run step on a cheap model, or stay a script?** — Resolved 2026-10-31: the owner chose a cheap-model LLM step. ADR-007 (accepted 2026-10-31) settles it as a scorer step that the router schedules; the router stays a script, so `AGENTS.md` and ADR-006 need no change. Owner: user.
7. **What are the expected target_scale.qps and target_scale.data_volume?** — Resolved 2026-10-31: qps 0 (one sequential run at a time); a few KB per run; hundreds of runs across a small team. Owner: user.
8. **Why now, and what is the current workaround and its cost?** — Resolved 2026-10-31: see Problem Statement. Owner: user.
9. **Confirm two assumptions.** — Resolved 2026-10-31: (a) the change modifies the existing routing rule, (b) there is no existing run data to carry over. Both confirmed. Owner: user.
10. **Confirm the priorities of FR-009 to FR-011.** — Resolved 2026-10-31: FR-009 and FR-010 stay must-have (both built). FR-011 moves to must-have and into milestone M-1. Owner: user.
11. **Which path rules and levels define elevated risk, and what does the pipeline do at the highest level?** — ADR-001 says the pipeline halts for a human, because subagents cannot ask questions. Owner: user. Resolved 2026-10-30: elevated risk is churn (paths that change often in git history), configured under `risk` in `policy.json`. The three levels are `lean`, `standard` and `thorough`. The generic halt is `signals.needsHuman`; a halt by level alone is deferred (see FR-010).
