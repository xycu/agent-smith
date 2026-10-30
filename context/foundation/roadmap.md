---
project: agent-smith
version: 1
status: draft
created: 2026-10-30
updated: 2026-10-31
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
- **Scope extension (2026-10-30):** S-07 to S-10 add the optional lifecycle steps of `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md` (diagrams 5, 6 and 7), gated by the rigor level from S-03 so they run only when worth their cost. Split from change `rigor-gated-routing`; shared research in `context/changes/rigor-levels/research.md`.

## Vision recap

Running the 10x chain on expensive models and effort levels uses too much of the owner's weekly Claude usage limit. agent-smith should choose a cheaper model and effort when a change is simple, keep reviews strict where a change is risky, and show per step what ran so the saving can be measured against a full Sonnet-5.5 high-effort run. Nobody uses it yet, and the owner plans to use it daily if it works.

## North star

**S-01: User can run the pipeline on a simple change and see it routed to a cheaper model and effort** — this is the claim behind the usage-drop goal, and speed favors proving it before anything else.

> The north star is the smallest end-to-end slice whose successful delivery would prove the core product claim, placed as early as its prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                  | Prerequisites | PRD refs                          | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------- | ------------- | --------------------------------- | -------- |
| S-01 | cheaper-routing-simple-change | run the pipeline on a simple change and see it routed to a cheaper model and effort   | —             | US-02, FR-001, FR-003, FR-007, FR-008 | done     |
| S-02 | per-step-usage-report        | see a report of which model and effort ran each step, before the change is archived   | —             | FR-004, FR-009                    | done     |
| S-03 | rigor-levels                 | have each change get a rigor level, with lean changes skipping plan-review and changes on often-changed paths always getting both reviews | S-01          | US-01, FR-002, FR-003, FR-010     | done |
| S-04 | (merged into S-03)           | —                                                                                     | —             | —                                 | merged   |
| S-05 | pr-comment-report            | see the same report as a comment on the pull request                                  | S-02          | FR-005                            | proposed |
| S-06 | baseline-usage-comparison    | compare the usage of a routed run with a baseline run of the same change              | S-01, S-02    | FR-009                            | proposed |
| S-07 | pre-plan-steps               | have research, domain briefs and framing run before the plan only when the rigor level and signals call for them | S-03          | FR-001, FR-003, FR-007            | proposed |
| S-08 | phase-executors              | have each plan phase run on the executor that fits it, with manual checks automated where possible | S-03, S-07    | FR-001, FR-003, FR-007            | proposed |
| S-09 | archive-adapter              | have a finished run commit the change folder and archive the change through `/10x-archive` (opt-in) | S-03          | FR-004, FR-008                    | done |
| S-10 | lesson-candidates            | see lesson candidates from the impl-review in the report, with a ready `/10x-lesson` command | S-03, S-08    | FR-004                            | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme     | Chain                      | Note                                                                       |
| ------ | --------- | -------------------------- | -------------------------------------------------------------------------- |
| A      | Routing   | `S-01` → `S-03` → `S-07` → `S-08` → `S-10` | Speed: the routing claim and its rigor and risk guard come first; the optional steps follow one by one, because all of them edit `decide()` in `route.mjs`. |
| C      | Archive   | `S-03` → `S-09`            | Branches off Stream A at `S-03`. Only the research and plan steps can overlap with `S-03`; implement waits for `S-03` to merge, because both edit `route.mjs`. |
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
- **Parallel with:** S-01, S-03
- **Blockers:** —
- **Unknowns:**
  - Where can token or cost figures be read from (PRD Open Question 4)? Resolved 2026-10-30: the orchestrator copies the Agent result's usage (total tokens, tool uses, duration) into the step result and the router stores it. Cost figures are not available. — Owner: user. Block: no.
  - Which moment counts as "before archive", given the 10x toolkit cannot be changed? Resolved 2026-10-30: the router writes `agent-smith/report.md` when a run ends (done or halt). — Owner: user. Block: no.
- **Risk:** The usage figures may not be readable, leaving the report with model and effort only. It is still useful for the baseline comparison, so it goes early.
- **Status:** done

### S-03: Rigor levels and risk-gated review

- **Outcome:** user can have each change get a rigor level (`lean`, `standard`, `thorough`) that only rises during a run. A `lean` change skips plan-review. A change that touches often-changed paths always gets plan-review and implementation review. The report shows every skipped step with its reason.
- **Change ID:** rigor-levels
- **PRD refs:** US-01, FR-002, FR-003, FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which path rules define elevated risk (PRD Open Question 11)? Resolved 2026-10-30: paths that change often, measured from git history; the proposed parameters are in the change's research (Follow-up 2) and live in `policy.json`. — Owner: user. Block: no.
  - What counts as a clean plan (Roadmap Question 12)? Resolved 2026-10-30: the owner decided that `lean` skips plan-review; elevated risk never runs at `lean`. — Owner: user. Block: no.
  - What does a halt look like in an unattended run? Resolved 2026-10-30: a subagent that cannot make an evidence-backed call reports `blocked` with `signals.needsHuman`, and the router halts. — Owner: user. Block: no.
  - Are the churn thresholds right? Uncalibrated until real runs exist (S-06). — Owner: user. Block: no.
- **Risk:** Churn can miss a risky file that rarely changes and flag a harmless busy one. Absorbs former S-04 (plan-review skip on a clean plan), which is why FR-002 moves here.
- **Status:** done

### S-04: Skip plan-review on a clean plan (merged into S-03)

- **Outcome:** merged into S-03 on 2026-10-30. The owner decided that a `lean` change skips plan-review, which replaces the "clean plan" definition this slice was blocked on.
- **Change ID:** — (covered by `rigor-levels`)
- **Status:** merged

### S-05: PR comment report

- **Outcome:** user can see the same report as a comment on the pull request, skipped when no pull request exists.
- **Change ID:** pr-comment-report
- **PRD refs:** FR-005
- **Prerequisites:** S-02
- **Parallel with:** S-01, S-03, S-06, S-07, S-08, S-09, S-10
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
- **Parallel with:** S-03, S-05, S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:**
  - What usage drop counts as success (PRD Open Question 1)? — Owner: user. Block: no.
  - How are two runs of the same change made comparable? — Owner: user. Block: no.
- **Risk:** With at most dozens of runs the comparison is noisy and may not show a real saving. It goes last because it needs both routing and the report.
- **Status:** proposed

### S-07: Rigor-gated pre-plan steps

- **Outcome:** user can have `/10x-research`, legacy research (when a repo map exists), a domain brief and `/10x-frame` run before the plan only when the rigor level and the subagent signals call for them, and have a plan-review RETHINK or a repeated REVISE loop back to frame or research.
- **Change ID:** pre-plan-steps
- **PRD refs:** FR-001, FR-003, FR-007
- **Prerequisites:** S-03
- **Parallel with:** S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which predicate decides that a domain rule is scattered or a dependency leaks? The research found a status column for invariants but no structured signal for leaking dependencies. — Owner: user. Block: no.
  - Does `/10x-frame` stay usable unattended with only a prompt-level decision guide, given its four ask points? — Owner: user. Block: no.
- **Risk:** Frame and the legacy prompts were built for a human. A weak decision guide makes them guess, so the needs-human halt is the safety net.
- **Status:** proposed

### S-08: Per-phase executors

- **Outcome:** user can have each plan phase run on `/10x-e2e`, `/10x-tdd` or `/10x-goal-implement` as it fits, with a blocked tdd or e2e run falling back to goal-implement, repeated failures and a REJECTED review re-planning, and manual checks automated (with Claude-in-Chrome where it helps) and backed by evidence.
- **Change ID:** phase-executors
- **PRD refs:** FR-001, FR-003, FR-007
- **Prerequisites:** S-03, S-07
- **Parallel with:** S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - How does the router tell real work from a tdd or e2e "Skip" that ticks rows with no commit? The research proposes a commit or SHA check. — Owner: user. Block: no.
  - Can a subagent reliably load the Claude-in-Chrome tools? Not tested. — Owner: user. Block: no.
- **Risk:** tdd and e2e have many interactive pauses and cannot be limited to one phase except by prompt. An agent ticking manual rows certifies its own work, so every ticked row needs evidence.
- **Status:** proposed

### S-09: Archive adapter

- **Outcome:** user can have a finished run commit the change folder and archive the change through `/10x-archive` (opt-in), with a read-only check that the archive succeeded. Split from the former S-09 on 2026-10-30: it needs only S-03, so it can start before S-07 and S-08.
- **Change ID:** archive-adapter
- **PRD refs:** FR-004, FR-008
- **Prerequisites:** S-03
- **Parallel with:** S-05, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:**
  - None blocking. The adapter design is accepted in the research (Follow-up 1). — Owner: user. Block: no.
- **Risk:** It is the router's first git write, and archive moves the run state out of reach, so nothing may write after the move. Its implement step edits `endRun` in `route.mjs`, so it waits for S-03 to merge.
- **Status:** done

### S-10: Lesson candidates in the report

- **Outcome:** user can see lesson candidates from the impl-review in `report.md`, each with a ready `/10x-lesson <seed>` command.
- **Change ID:** lesson-candidates
- **PRD refs:** FR-004
- **Prerequisites:** S-03, S-08
- **Parallel with:** S-05, S-06, S-09
- **Blockers:** —
- **Unknowns:**
  - Which lesson candidates does the impl-review report, given that it has no lesson-candidate section? The research proposes carrying them in RESULT `signals`. — Owner: user. Block: no.
- **Risk:** The signal rides on the subagent's reply, so a weak prompt yields noise. `/10x-lesson` is interactive and is never run unattended.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------------ | ------------------------------------------------------- | --------------------- | --------------------------------------- |
| S-01       | cheaper-routing-simple-change  | Route simple changes to a cheaper model and effort      | done                  | Archived 2026-10-30                     |
| S-02       | per-step-usage-report          | Report model and effort per pipeline step               | done                  | Archived 2026-10-30                     |
| S-03       | rigor-levels                   | Rigor levels, churn risk and plan-review skip at lean   | yes                   | Research done; run `/10x-plan rigor-levels` |
| S-04       | —                              | (merged into S-03)                                      | —                     | Merged 2026-10-30                       |
| S-05       | pr-comment-report              | Post the usage report as a pull request comment         | yes                   | Run `/10x-plan pr-comment-report`       |
| S-06       | baseline-usage-comparison      | Compare a routed run with a baseline run                | yes                   | Run `/10x-plan baseline-usage-comparison`; Open Question 1 (success target) is still open |
| S-07       | pre-plan-steps                 | Gate research, domain briefs and framing by rigor       | no                    | Needs S-03; research in `context/changes/rigor-levels/research.md` |
| S-08       | phase-executors                | Route each plan phase to its executor                   | no                    | Needs S-03, S-07                        |
| S-09       | archive-adapter                | Archive a finished run through the 10x-archive adapter  | no                    | Needs S-03 merged to implement; research and plan can start now |
| S-10       | lesson-candidates              | Lesson candidates in the report                         | no                    | Needs S-03, S-08                        |

## Open Roadmap Questions

1. **What usage drop counts as success?** — Baseline is known (a full run on Sonnet-5.5 at high effort, compared by A/B test), but the target percentage is not set. Owner: user. Block: S-06.
2. **What does "a dep for other models" mean?** — The user said the pipeline is a dependency for other models (meaning unclear: other modules or projects that depend on it?). Which ones, and what must stay stable for them? Owner: user. Block: roadmap-wide.
3. **Which artifacts does the router score, and who produces the score?** — Code, intent MD files, others; a review step, or the router itself? ADR-001 Phase 1 needs no scorer: the script reads artifacts and diff stats. An LLM scorer is deferred to Phase 2; confirm. Owner: user. Block: S-01, S-03.
4. **Is usage or cost data available to the router, and from where?** — Answered by S-02 (2026-10-30): the orchestrator copies the Agent result's usage (total tokens, tool uses, duration) into the step result and the router stores it. Cost figures are not available. Not yet confirmed on a foreground Agent result: the real-run evidence for S-02 row 3.6 was archived unfilled. Owner: user. Block: S-06.
5. **Is OpenSpec (FR-006) out of scope for this delivery?** — The user called it nice-to-have but did not list it as a non-goal. This roadmap parks it. Owner: user. Block: roadmap-wide.
6. **Does the router become an LLM-run step on a cheap model, or stay a script?** — The user expects the router to be cheap to run, like Haiku-5.5. Today the router is a plain script with no LLM. ADR-001 Phase 1 keeps it a script; a cheap-model scorer only appears in Phase 2. Owner: user. Block: S-01, S-03.
7. **What are the expected target_scale.qps and target_scale.data_volume?** — Not captured during shaping. Owner: user. Block: roadmap-wide.
8. **Why now, and what is the current workaround and its cost?** — Not captured during shaping. Owner: user. Block: roadmap-wide.
9. **Confirm two assumptions.** — (a) The change modifies the existing routing rule rather than replacing it. (b) There are no existing runs or data to carry over. Owner: user. Block: S-01.
10. **Confirm the priorities of FR-009 to FR-011.** — They come from a proposed ADR. The Socrates round on 2026-10-30 challenged them, but the priorities themselves were set from the ADR, not by you. Owner: user. Block: S-02, S-03, S-06.
11. **Which path rules and levels define elevated risk, and what does the pipeline do at the highest level?** — ADR-001 says the pipeline halts for a human, because subagents cannot ask questions. Resolved 2026-10-30: elevated risk = paths that change often in git history; the halt is a `needsHuman` signal from the subagent. Owner: user. Block: none.
12. **What counts as a "clean" plan in Phase 1?** — FR-002 skips plan-review only on a clean result, but Phase 1 has no scorer. Resolved 2026-10-30: the owner decided that a `lean` change skips plan-review; S-04 merged into S-03. Owner: user. Block: none.

## Parked

- **Changing or forking the 10x toolkit skills, or OpenSpec** — Why parked: PRD Non-Goals; agent-smith is an add-on and never edits them.
- **LLM-scored change complexity (FR-011)** — Why parked: PRD Non-Goals and ADR-001 Phase 2; built only if the Phase 1 measurements show deterministic signals are not enough.
- **OpenSpec chain through a second pipeline skill (FR-006)** — Why parked: nice-to-have, built after dynamic routing works; speed favors the must-have path.
- **Splitting model and effort into separate choices** — Why parked: ADR-001 keeps the single ladder until measurements show their effects separately.

## Milestone History

(Append-only. Empty on the first milestone.)

## Done

- **S-01: user can run the pipeline on a simple change and see its steps routed to a cheaper model and effort than a complex change gets.** — Archived 2026-10-30 → `context/archive/2026-10-30-cheaper-routing-simple-change/`. Lesson: —.
- **S-02: user can see, for a finished run, a report of which model and effort ran each step, with usage figures where readable, written before the change is archived.** — Archived 2026-10-30 → `context/archive/2026-10-30-per-step-usage-report/`. Lesson: —.
- **S-03: user can have each change get a rigor level (`lean`, `standard`, `thorough`) that only rises during a run. A `lean` change skips plan-review. A change that touches often-changed paths always gets plan-review and implementation review. The report shows every skipped step with its reason.** — Archived 2026-10-30 → `context/archive/2026-10-30-rigor-levels/`. Lesson: —.
- **S-09: user can have a finished run commit the change folder and archive the change through `/10x-archive` (opt-in), with a read-only check that the archive succeeded. Split from the former S-09 on 2026-10-30: it needs only S-03, so it can start before S-07 and S-08.** — Archived 2026-10-30 → `context/archive/2026-10-30-archive-adapter/`. Lesson: —.
