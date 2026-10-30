---
project: agent-smith
version: 1
status: draft
created: 2026-10-30
updated: 2026-10-30
prd_version: 1
main_goal: speed
top_blocker: decisions
milestone_id: cheaper-pipeline-routing
milestone_seq: 1
milestone_status: open
---

# Roadmap: agent-smith

> Derived from `context/foundation/prd.md` (v1) + a probed codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Cheaper pipeline routing** — Status: open

- **Intent:** Show that the pipeline picks a cheaper model and effort for a simple change than for a complex one, and that a report makes the difference visible and comparable to a full Sonnet-5.5 high-effort run.
- **Source materials:** `context/foundation/prd.md` (v1), with the Phase 1 scope of `docs/ADR/ADR-001-phased-complexity-routing.md`.
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001 to FR-005, FR-007 to FR-010, US-01, US-02. Left out of this milestone: FR-006 (OpenSpec) and FR-011 (LLM-scored complexity), both nice-to-have.

## Vision recap

Running the 10x chain on expensive models and effort levels uses too much of the owner's weekly Claude usage limit. agent-smith should choose a cheaper model and effort when a change is simple, keep reviews strict where a change is risky, and show per step what ran so the saving can be measured against a full Sonnet-5.5 high-effort run. Nobody uses it yet, and the owner plans to use it daily if it works.

## North star

**S-01: User can run the pipeline on a simple change and see it routed to a cheaper model and effort** — this is the claim behind the usage-drop goal, and speed favors proving it before anything else.

> The north star is the smallest end-to-end slice whose successful delivery would prove the core product claim, placed as early as its prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                  | Prerequisites | PRD refs                          | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------- | ------------- | --------------------------------- | -------- |
| S-01 | cheaper-routing-simple-change | run the pipeline on a simple change and see it routed to a cheaper model and effort   | —             | US-02, FR-001, FR-003, FR-007, FR-008 | done |
| S-02 | per-step-usage-report        | see a report of which model and effort ran each step, before the change is archived   | —             | FR-004, FR-009                    | in-progress |
| S-03 | risk-gated-review            | have changes touching risky paths always get both reviews, and a halt at the top level | S-01          | FR-010                            | proposed |
| S-04 | plan-review-skip-on-clean-plan | have a clean plan go straight to implementation, other plans still get plan-review  | S-01, S-03    | US-01, FR-002                     | blocked  |
| S-05 | pr-comment-report            | see the same report as a comment on the pull request                                  | S-02          | FR-005                            | proposed |
| S-06 | baseline-usage-comparison    | compare the usage of a routed run with a baseline run of the same change              | S-01, S-02    | FR-009                            | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme     | Chain                      | Note                                                                       |
| ------ | --------- | -------------------------- | -------------------------------------------------------------------------- |
| A      | Routing   | `S-01` → `S-03` → `S-04`   | Speed: the routing claim and its safety guard come first.                  |
| B      | Reporting | `S-02` → `S-05` → `S-06`   | Joins Stream A at `S-01` (`S-06` needs both); shows what ran and the saving. |

## Baseline

What's already in place in the codebase as of `2026-10-30` (probed and user-confirmed).
No Foundation below re-scaffolds a layer the baseline reports as present.

- **Frontend:** absent — no UI; the product is a plugin.
- **Backend / API:** partial — no server; a command-line router script exists under `skills/10x-pipeline/scripts/`.
- **Data:** partial — no database; run state is kept as files under `context/changes/<change-id>/agent-smith/`.
- **Auth:** absent — the PRD needs none.
- **Deploy / infra:** partial — plugin and marketplace manifests in `.claude-plugin/`; no CI and no container setup.
- **Observability:** absent — no logging or error tracking beyond the step log. No automated tests exist.

## Foundations

None. The baseline gaps (no UI, no auth, no CI, no tests, no usage figures) are not prerequisites for any slice: each slice can be planned and checked by running the router against a scratch change folder, and the policy override file already allows a baseline run configuration. A Foundation is added only if a slice turns out to be unplannable or unverifiable without one.

## Slices

### S-01: Cheaper routing for a simple change

- **Outcome:** user can run the pipeline on a simple change and see its steps routed to a cheaper model and effort than a complex change gets.
- **Change ID:** cheaper-routing-simple-change
- **PRD refs:** US-02, FR-001, FR-003, FR-007, FR-008
- **Prerequisites:** —
- **Parallel with:** S-02, S-05
- **Blockers:** —
- **Unknowns:**
  - Which signals and thresholds count as "simple" (phase count, files changed, review verdicts, failures)? ADR-001 Phase 1 lists the signals; the thresholds are open. — Owner: user. Block: no.
  - Does Phase 1 really need no scorer (PRD Open Question 3 and 6)? — Owner: user. Block: no.
- **Risk:** This is the claim behind the whole goal, so it goes first. A change misjudged as simple fails on a cheap tier and costs more; per-failure escalation, which already exists, is the safety net.
- **Status:** done

### S-02: Per-step usage report

- **Outcome:** user can see, for a finished run, a report of which model and effort ran each step, with usage figures where readable, written before the change is archived.
- **Change ID:** per-step-usage-report
- **PRD refs:** FR-004, FR-009
- **Prerequisites:** —
- **Parallel with:** S-01, S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Where can token or cost figures be read from (PRD Open Question 4)? Record model and effort now and add figures once a source is found; finding the source is the first task. — Owner: user. Block: no.
  - Which moment counts as "before archive", given the 10x toolkit cannot be changed? — Owner: user. Block: no.
- **Risk:** The usage figures may not be readable, leaving the report with model and effort only. It is still useful for the baseline comparison, so it goes early.
- **Status:** in-progress

### S-03: Risk-gated review

- **Outcome:** user can have changes that touch configured risky paths always get plan-review and implementation review, with a halt for a human at the highest risk level.
- **Change ID:** risk-gated-review
- **PRD refs:** FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which path rules and levels define elevated risk (PRD Open Question 11)? The plan can propose a small starter set for you to confirm. — Owner: user. Block: no.
  - What does a halt look like in an unattended run? — Owner: user. Block: no.
- **Risk:** Path rules can miss risky changes in unexpected files and flag harmless ones. It sits right after S-01 because it must exist before any review is skipped (S-04).
- **Status:** proposed

### S-04: Skip plan-review on a clean plan

- **Outcome:** user can have a plan with a clean result go straight to implementation, while any other plan still gets plan-review.
- **Change ID:** plan-review-skip-on-clean-plan
- **PRD refs:** US-01, FR-002
- **Prerequisites:** S-01, S-03
- **Parallel with:** S-02, S-05, S-06
- **Blockers:** Open Roadmap Question 12 (definition of a clean plan)
- **Unknowns:**
  - What counts as a clean result in Phase 1, where no LLM scorer exists (PRD Open Question 3 and 6)? Is it a review output or derived from the deterministic signals? — Owner: user. Block: yes.
- **Risk:** Skipping review can cost more later. It comes after S-03 so risky changes never skip, and it stays blocked until "clean" has a definition.
- **Status:** blocked

### S-05: PR comment report

- **Outcome:** user can see the same report as a comment on the pull request, skipped when no pull request exists.
- **Change ID:** pr-comment-report
- **PRD refs:** FR-005
- **Prerequisites:** S-02
- **Parallel with:** S-01, S-03, S-04, S-06
- **Blockers:** —
- **Unknowns:**
  - Can the pipeline reach the pull request when it finishes (access and tooling)? — Owner: user. Block: no.
- **Risk:** It depends on tooling outside the plugin. The report file is always written, so a missing pull request only skips the comment.
- **Status:** proposed

### S-06: Baseline usage comparison

- **Outcome:** user can compare the total usage of a routed run against a baseline run of the same change (a full run on Sonnet-5.5 at high effort).
- **Change ID:** baseline-usage-comparison
- **PRD refs:** FR-009
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - What usage drop counts as success (PRD Open Question 1)? — Owner: user. Block: no.
  - How are two runs of the same change made comparable? — Owner: user. Block: no.
- **Risk:** With at most dozens of runs the comparison is noisy and may not show a real saving. It goes last because it needs both routing and the report.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------------ | ------------------------------------------------------- | --------------------- | --------------------------------------- |
| S-01       | cheaper-routing-simple-change  | Route simple changes to a cheaper model and effort      | yes                   | Run `/10x-plan cheaper-routing-simple-change` |
| S-02       | per-step-usage-report          | Report model and effort per pipeline step               | yes                   | Run `/10x-plan per-step-usage-report`   |
| S-03       | risk-gated-review              | Force reviews and a halt for risky paths                | no                    | Needs S-01 done                         |
| S-04       | plan-review-skip-on-clean-plan | Skip plan-review when the plan is clean                 | no                    | Blocked: define "clean"; needs S-01, S-03 |
| S-05       | pr-comment-report              | Post the usage report as a pull request comment         | no                    | Needs S-02 done                         |
| S-06       | baseline-usage-comparison      | Compare a routed run with a baseline run                | no                    | Needs S-01 and S-02 done                |

## Open Roadmap Questions

1. **What usage drop counts as success?** — Baseline is known (a full run on Sonnet-5.5 at high effort, compared by A/B test), but the target percentage is not set. Owner: user. Block: S-06.
2. **What does "a dep for other models" mean?** — The user said the pipeline is a dependency for other models (meaning unclear: other modules or projects that depend on it?). Which ones, and what must stay stable for them? Owner: user. Block: roadmap-wide.
3. **Which artifacts does the router score, and who produces the score?** — Code, intent MD files, others; a review step, or the router itself? ADR-001 Phase 1 needs no scorer: the script reads artifacts and diff stats. An LLM scorer is deferred to Phase 2; confirm. Owner: user. Block: S-01, S-04.
4. **Is usage or cost data available to the router, and from where?** — The user named usage and cost metrics as a rubric input. Owner: user. Block: S-02, S-06.
5. **Is OpenSpec (FR-006) out of scope for this delivery?** — The user called it nice-to-have but did not list it as a non-goal. This roadmap parks it. Owner: user. Block: roadmap-wide.
6. **Does the router become an LLM-run step on a cheap model, or stay a script?** — The user expects the router to be cheap to run, like Haiku-5.5. Today the router is a plain script with no LLM. ADR-001 Phase 1 keeps it a script; a cheap-model scorer only appears in Phase 2. Owner: user. Block: S-01, S-04.
7. **What are the expected target_scale.qps and target_scale.data_volume?** — Not captured during shaping. Owner: user. Block: roadmap-wide.
8. **Why now, and what is the current workaround and its cost?** — Not captured during shaping. Owner: user. Block: roadmap-wide.
9. **Confirm two assumptions.** — (a) The change modifies the existing routing rule rather than replacing it. (b) There are no existing runs or data to carry over. Owner: user. Block: S-01.
10. **Confirm the priorities of FR-009 to FR-011.** — They come from a proposed ADR. The Socrates round on 2026-10-30 challenged them, but the priorities themselves were set from the ADR, not by you. Owner: user. Block: S-02, S-03, S-06.
11. **Which path rules and levels define elevated risk, and what does the pipeline do at the highest level?** — ADR-001 says the pipeline halts for a human, because subagents cannot ask questions. Owner: user. Block: S-03.
12. **What counts as a "clean" plan in Phase 1?** — FR-002 skips plan-review only on a clean result, but Phase 1 has no scorer. Owner: user. Block: S-04.

## Parked

- **Changing or forking the 10x toolkit skills, or OpenSpec** — Why parked: PRD Non-Goals; agent-smith is an add-on and never edits them.
- **LLM-scored change complexity (FR-011)** — Why parked: PRD Non-Goals and ADR-001 Phase 2; built only if the Phase 1 measurements show deterministic signals are not enough.
- **OpenSpec chain through a second pipeline skill (FR-006)** — Why parked: nice-to-have, built after dynamic routing works; speed favors the must-have path.
- **Splitting model and effort into separate choices** — Why parked: ADR-001 keeps the single ladder until measurements show their effects separately.

## Milestone History

(Append-only. Empty on the first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends an entry here when a change whose `Change ID` matches an item is archived.)

- **S-01: user can run the pipeline on a simple change and see its steps routed to a cheaper model and effort than a complex change gets.** — Archived 2026-10-30 → `context/archive/2026-10-30-cheaper-routing-simple-change/`. Lesson: —.
