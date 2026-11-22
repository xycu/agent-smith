---
project: agent-smith
version: 1
status: draft
created: 2026-10-30
updated: 2026-11-17
prd_version: 2
main_goal: quality
top_blocker: external
milestone_id: reliable-unattended-delivery
milestone_seq: 2
milestone_status: open
---

# Roadmap: agent-smith

> Derived from PRD v2, the owner's child-delegation requirement and the confirmed codebase baseline, with the stack assessment and health check as supporting evidence.
> This successor milestone continues the existing roadmap in place.
> Slice identifiers remain stable. The At a glance table records dependencies; [WAVES.md v3](../changes/WAVES.md) records the current execution batches and file-ownership constraints.

## Milestone

**M-2: Reliable unattended delivery across supported hosts** — Status: open

- **Intent:** The user can start an authorized workflow, return to reviewable work or an actionable owner-decision halt, and inspect the exact tested configurations supporting that result. The specification-based workflow uses the agreed OpenSpec 2.0.0 upgrade. Pipeline steps gain child-subagent delegation with verified completion and recovery.
- **Source materials:** [PRD v2](prd.md), [stack assessment](stack-assessment.md), [health check](health-check.md), the confirmed baseline, the owner's sequencing decisions and the explicit child-delegation request captured in MS-01.
- **Done when:** every current slice S-12 through S-20 is done and the final candidate meets the full acceptance contract below.
- **Scope anchors:** US-03 through US-06, FR-012 through FR-016 and FR-020. FR-001 through FR-011 remain preservation obligations, with FR-006 included as delivered workflow support. FR-017 through FR-019 are deferred follow-ups. MS-01 adds the owner's child-delegation requirement.
  - MS-01 — Owner request on 2026-11-15. “Also in the roadmap include a change that will allow subagents to spawn child subagents. I think that this is one thing that severely decreases the performance of the pipeline.” S-14 delivers the capability and records comparative performance evidence.
  - MS-02 — Owner sequencing decision on 2026-11-15. “Make the change that addresses child subagents run a single change in Wave 0.” S-14 now runs first and alone. Its focused baseline and host proof belong inside that change; S-12 follows it. This supersedes the former S-12 prerequisite of S-14 without reducing the acceptance scope.
- **Acceptance:** all six host/provider/chain combinations complete three out of three normal live runs on the final candidate without manual steering, for 18 normal runs total. Interactive-session and headless top-level launches are both represented within each combination's three runs.
- **Feature coverage:** default execution, archive and requested PR report comments across applicable configurations. Recovery and owner-decision checks accompany each configuration. Covering tests, commands or scripts qualify when browser tools are unavailable. Archive with pending checks requires explicit owner approval.
- **Delegation coverage:** child work returns to the spawning step before completion, effective safety controls remain enforced, and recovery/result attribution cover the added delegation. Performance improvement requires measured evidence. S-14 establishes exact host/mode support before final qualification.
- **Version evidence:** the support record names exact tested versions and configurations while retaining documented prerequisite floors. The prerequisite and version contract in the PRD governs candidate selection.
- **Evidence integrity:** retain every attempted run, outcome, intervention and missing-evidence reason. Earlier proof contributes to final acceptance when it matches the final candidate and its recorded configuration. A behavior change requires fresh qualifying evidence for the final candidate before milestone closure.

## Vision recap

The owner wants to start an authorized workflow and let it finish without repeated steering. Delivered execution support still carries live-acceptance gaps around installation, prerequisite discovery, permissions, unattended invocation, delegation and completion. This milestone establishes supported unattended behavior and resolves failures exposed by the agreed live flows.

## North star

The north star is the first complete user flow that provides direct evidence the milestone's intended behavior works.

**S-12: First unattended plan-based delivery** requires a fresh Claude-only run reaching a reviewable pull request. S-14 delivered the delegation implementation. The first S-12 attempt left all three Manual delivery checks open. The owner decision on PR #214 blocks delivery. [Wave decision](../changes/WAVES.md#decision-track)

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| S-14 | nested-step-delegation | user can have a pipeline step delegate work to child subagents and receive their completed results before the step finishes. | —; alone in Wave 0 | MS-01, MS-02, US-03, US-05, FR-007, FR-014 | done |
| S-12 | first-unattended-delivery | user can start a Claude-only plan-based change once and receive reviewable completed work on a pull request. | S-14 | US-03, FR-001, FR-003, FR-007, FR-011, FR-012 | done |
| S-13 | openspec-2-upgrade | user can run the specification-based workflow with OpenSpec 2.0.0 and matching integration instructions. | — | US-03, FR-006, FR-008, FR-020 | done |
| S-15 | actionable-run-prerequisites | user can identify a missing prerequisite or execution permission and the action needed to start the selected workflow configuration. | S-12, S-13, S-14 | US-04, FR-013 | proposed |
| S-16 | resumable-unattended-runs | user can resume an interrupted run with preserved work, consistent progress and results matched to the correct invocation. | S-15 | US-05, FR-008, FR-014 | proposed |
| S-17 | reviewable-run-handoff | user can locate completed work, its optional archive and its requested pull-request report with an accurate shared outcome. | S-16 | US-06, FR-004, FR-005, FR-008, FR-009, FR-015 | proposed |
| S-18 | verified-step-protection | user can run steps with observed host-mediated safety checks and understand the effective protection of the selected configuration. | S-15 | US-04, FR-007, FR-013 | proposed |
| S-19 | truthful-owner-decision-halts | user can see why a workflow needs their decision, inspect pending proof and explicitly approve archive when checks remain pending. | S-18 | US-06, FR-002, FR-010, FR-015 | proposed |
| S-20 | supported-host-acceptance | user can inspect exact tested-version support backed by all 18 normal runs across the six agreed configurations and their recovery and owner-decision evidence. | S-17, S-19 | US-03, FR-012, FR-016 | proposed |

## Streams

These chains show logical dependencies. The prerequisites in the item records and the execution batches in [WAVES.md v3](../changes/WAVES.md) govern sequencing. Potential parallel work still needs disjoint ownership in the approved plans; Wave 0 always runs alone.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Child delegation, first delivery, recovery and handoff | S-14 → S-12 → S-15 → S-16 → S-17 → S-20 | S-14 runs alone first. S-15 joins the upgrade stream, and S-20 joins the protection/decision stream. |
| B | Specification workflow upgrade | S-13 | Scheduled after Wave 0 and the audit fixes, before the first full delivery. Joins Stream A at S-15. |
| C | Effective protection and owner decisions | S-18 → S-19 | Starts after S-15 and can proceed alongside recovery/handoff, then joins Stream A at S-20. |

## Baseline

The owner confirmed this baseline after parallel source probes on 2026-11-15. Source inspection used revision `8a3ba5929b891aa5fac9f79c2c339b43539d44a8`. Existing capability supplies the starting point for the slices below.

- **Frontend:** absent. Host-provided commands and skill selection supply interaction for the product. [Entry points](../../README.md)
- **Backend / API:** present as CLI execution. The deterministic router, both chains and provider dispatch are implemented. Complete live host acceptance is partial. [Router](../../skills/10x-pipeline/scripts/route.mjs) · [Host runner](../../skills/10x-pipeline/scripts/run-codex.mjs)
- **Data:** present as file-based run state, reports, locking and recoverable result intake. Both-chain and both-transport crash regressions exist. Real-host recovery evidence is partial. [State](../../skills/10x-pipeline/scripts/state.mjs) · [Result recovery](../../skills/10x-pipeline/scripts/flow.mjs) · [Recovery tests](../../skills/10x-pipeline/test/result-persist.test.mjs)
- **Auth:** partial as host-provided credentials, trust and permission controls. Application authentication is absent and outside the source scope. Selected real-host permission behavior and guarded-step delivery need live evidence. [Host requirements](../../docs/REFERENCE.md) · [Shipped hook](../../hooks/hooks.json)
- **Deploy / infra:** present for plugin packaging, CI and releases, including recorded runner/release acceptance. Fresh installation/discovery is partial. CI and generated integration instructions still use the earlier specification-tool version. [Manifest](../../.claude-plugin/plugin.json) · [CI](../../.github/workflows/ci.yml) · [Runner acceptance](../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) · [Release acceptance](../archive/2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md)
- **Observability:** present as per-step logs, status, reports, usage coverage, diagnostics and automated contract tests. The six-configuration live support record remains incomplete. [Reports](../../skills/10x-pipeline/scripts/flow.mjs) · [Test index](../../skills/10x-pipeline/test/README.md) · [Current health evidence](health-check.md)

The sequencing goal is quality, grounded in the PRD's three-out-of-three unattended-completion target. Host access and environment readiness are the owner-selected main constraint. Execution and live verification receive the deepest attention. Presentation and file-state work use the established product patterns. Recorded lessons guide cross-chain ownership, truthful verdicts, invocation attribution and synchronized behavior documentation. S-14 revisits the delivered flat-delegation restriction with new live evidence. [Lessons](lessons.md)

The delivered contract forbids nested subagents and applies a project-level depth cap. Historical runs lost child hand-backs and rolled back completed work. Current documented host behavior differs across interactive and headless modes. The owner now requests child delegation in S-14, and its performance effect remains unmeasured. This scope addition supersedes flat delegation as the target for that change. The PRD's current-system description still records the delivered baseline. [Delegation decision](../../docs/ADR/ADR-018-no-nested-subagents.md)

## Foundations

None. Existing execution, state, tests and reporting support the first change. S-14 records the minimum evidence convention and a bounded flat/delegated comparison within Wave 0; S-12 extends that evidence to the complete delivery flow. No separate foundation change precedes child delegation.

## Slices

Slice numbering continues after M-1's S-11 so prior Done entries retain their meaning. Each new Change ID has been checked against existing live and archived change names. Preservation anchors identify behavior exercised by that flow. MS-01 records the owner's explicit addition to the PRD-derived scope.

### S-12: First unattended plan-based delivery

- **Outcome:** user can start a Claude-only plan-based change once and receive reviewable completed work on a pull request.
- **Change ID:** first-unattended-delivery
- **PRD refs:** US-03, FR-001, FR-003, FR-007, FR-011, FR-012
- **Prerequisites:** S-14
- **Schedule:** Wave 3 of WAVES v3 reserves a fresh headless Claude-only run on the Wave 2 release, alongside state and setup fixes. [Wave 3](../changes/WAVES.md#wave-3)
- **Blockers:** The run on PR #214 archived the change with zero of Manual rows 3.1–3.3 proved. The owner must choose proof on the Wave 2 release or explicitly defer those rows to S-20. The proof requires authenticated host/model access, project trust and review-remote credentials. [PR #214](https://github.com/xycu/agent-smith/pull/214) · [Owner decision track](../changes/WAVES.md#decision-track)
- **Unknowns:**
  - Which eligible change and exact host configuration provide the first representative run? — Owner: maintainer with the user. Block: no, select during planning.
  - Which fresh-session discovery or guard-delivery problems appear on the normal path? — Owner: maintainer. Block: no, establish through the first live proof.
- **Risk:** Fresh-host setup can invalidate a normal workflow despite passing automated contracts, so this flow exposes that dependency first.
- **Status:** done

### S-13: Complete the specification-based workflow on OpenSpec 2.0.0

- **Outcome:** user can run the specification-based workflow with OpenSpec 2.0.0 and matching integration instructions.
- **Change ID:** openspec-2-upgrade
- **PRD refs:** US-03, FR-006, FR-008, FR-020
- **Prerequisites:** —
- **Parallel with:** — in WAVES v2; scheduled alone in Wave 2.
- **Blockers:** Live execution needs the selected host/model access and trusted acceptance project.
- **Unknowns:**
  - Which upstream changes and project-specific integration adaptations affect compatibility? — Owner: maintainer. Block: no, investigate before upgrade edits.
  - Which existing project inputs or saved runs require compatibility evidence? — Owner: maintainer. Block: no while preserving existing contracts. An incompatible contract change requires the owner's decision.
- **Risk:** Upgrading the tool while retaining mismatched integration instructions can make the workflow fail after setup.
- **Status:** done

### S-14: Pipeline steps can delegate to child subagents

- **Outcome:** user can have a pipeline step delegate work to child subagents and receive their completed results before the step finishes.
- **Change ID:** nested-step-delegation
- **PRD refs:** MS-01, MS-02, US-03, US-05, FR-007, FR-014
- **Prerequisites:** —; owner-selected first change under MS-02.
- **Parallel with:** —; the only change in Wave 0.
- **Baseline:** Record a bounded representative run with current flat delegation inside this change, then repeat it with child delegation. S-12 is not a prerequisite; the first complete delivery follows Wave 0.
- **Blockers:** Live proof needs host capabilities, effective permissions and account access that permit child delegation.
- **Unknowns:**
  - Which supported host and launch modes can reliably await children and return their results to the spawning step? — Owner: maintainer. Block: no for planning, establish capability evidence before selecting the implementation. A capability gap affecting the agreed configurations requires an owner scope decision.
  - Which effective delegation controls and inherited step restrictions must change together to permit safe child work? — Owner: maintainer. Block: no, investigate the delivered restriction and preserve its recovery and attribution protections.
  - Does child delegation improve representative pipeline performance after accounting for child usage, coordination and retries? — Owner: maintainer. Block: no for enabling the capability, measure against this change's recorded flat-delegation baseline before making a performance claim.
- **Acceptance:**
  - Demonstrate a step spawning children, collecting their results and completing through the normal entry points of both chains. Record exact host versions and interactive/headless behavior for each applicable host/provider configuration.
  - Demonstrate that child, late and foreign notifications cannot complete the enclosing step or advance the router prematurely. Keep child work and available usage attributable to the enclosing invocation.
  - Exercise child failure, interruption/resume and late completion with recoverable work and consistent progress. Verify effective child permissions and applicable step safety controls.
  - Record representative elapsed time, completion quality, interventions and available usage before and after enabling delegation, retaining overhead and failures. Performance improvement is an outcome to evaluate.
- **Risk:** A host can deliver a child's completion to the top session while its spawning step finishes early, recreating the historical result-loss and rollback failure.
- **Status:** done

### S-15: Actionable prerequisite and permission failures

- **Outcome:** user can identify a missing prerequisite or execution permission and the action needed to start the selected workflow configuration.
- **Change ID:** actionable-run-prerequisites
- **PRD refs:** US-04, FR-013
- **Prerequisites:** S-12, S-13, S-14
- **Parallel with:** —
- **Blockers:** Owner-controlled account access, project trust or environment policy may need correction when a probe identifies an unavailable prerequisite.
- **Unknowns:**
  - Which missing-tool, discovery, trust and permission cases remain unclear across the agreed configurations? — Owner: maintainer. Block: no, derive from the delivered entry points and first-run evidence.
- **Risk:** A generic diagnostic can hide the actual setup dependency and cause repeated manual intervention.
- **Status:** proposed

### S-16: Resume an interrupted unattended run

- **Outcome:** user can resume an interrupted run with preserved work, consistent progress and results matched to the correct invocation.
- **Change ID:** resumable-unattended-runs
- **PRD refs:** US-05, FR-008, FR-014
- **Prerequisites:** S-15
- **Parallel with:** S-18, S-19
- **Blockers:** The selected live execution environments must be available for interruption and recovery checks.
- **Unknowns:**
  - Which saved-run variants need coverage for the selected environments? — Owner: maintainer. Block: no, inventory before any dependent change.
  - Which interruption points expose a remaining gap beyond the delivered recovery regressions? — Owner: maintainer. Block: no, verify the real flow and fix observed failures.
- **Risk:** An interruption can leave accepted work and pending execution out of agreement, so recovery precedes terminal handoff acceptance.
- **Status:** proposed

### S-17: Reviewable completion, archive and report handoff

- **Outcome:** user can locate completed work, its optional archive and its requested pull-request report with an accurate shared outcome.
- **Change ID:** reviewable-run-handoff
- **PRD refs:** US-06, FR-004, FR-005, FR-008, FR-009, FR-015
- **Prerequisites:** S-16
- **Parallel with:** S-18, S-19
- **Blockers:** A usable review remote and authenticated report-publication access are needed for live evidence.
- **Unknowns:**
  - Which terminal or resumed paths still lose the correct report location, publication intent or available usage? — Owner: maintainer. Block: no, verify against the existing terminal contracts.
- **Risk:** Archiving moves run artifacts and can break the final report handoff unless the complete terminal flow is exercised.
- **Status:** proposed

### S-18: Effective step protection in the supported environment

- **Outcome:** user can run steps with observed host-mediated safety checks and understand the effective protection of the selected configuration.
- **Change ID:** verified-step-protection
- **PRD refs:** US-04, FR-007, FR-013
- **Prerequisites:** S-15
- **Parallel with:** S-16, S-17
- **Blockers:** Fresh host sessions with the required capabilities and effective permission settings are needed for live protection evidence.
- **Unknowns:**
  - Does the selected host deliver the expected step identity and enforce the documented checks? — Owner: maintainer with the user. Block: no, this is the slice's verification work.
  - Which host-policy restrictions need owner action to make an agreed configuration usable? — Owner: user, informed by maintainer evidence. Block: no for planning.
- **Risk:** Installed guard configuration can appear usable while effective host settings prevent its intended delivery.
- **Status:** proposed

### S-19: Truthful verification and owner-decision halts

- **Outcome:** user can see why a workflow needs their decision, inspect pending proof and explicitly approve archive when checks remain pending.
- **Change ID:** truthful-owner-decision-halts
- **PRD refs:** US-06, FR-002, FR-010, FR-015
- **Prerequisites:** S-18
- **Parallel with:** S-16, S-17
- **Blockers:** An available owner decision is needed to demonstrate the explicit archive-approval path.
- **Unknowns:**
  - Which live planning, review and verification paths fail to preserve an unresolved owner decision or truthful proof state? — Owner: maintainer. Block: no, exercise the delivered decision paths.
- **Risk:** An inaccurate verification state can allow a terminal action before the owner has made the required decision.
- **Status:** proposed

### S-20: Recorded support across all agreed configurations

- **Outcome:** user can inspect exact tested-version support backed by all 18 normal runs across the six agreed configurations and their recovery and owner-decision evidence.
- **Change ID:** supported-host-acceptance
- **PRD refs:** US-03, FR-012, FR-016
- **Prerequisites:** S-17, S-19. WAVES v3 schedules S-20 in Wave 11 on the combined candidate. Each of six host/provider and chain configurations needs three successful normal runs covering both interactive and headless launches, plus interruption/resume and owner-decision evidence. [Wave map](../changes/WAVES.md#wave-map) · [Acceptance scope](prd.md#agreed-reliability-acceptance-scope)
- **Parallel with:** —
- **Blockers:** All agreed host/model accounts, trusted acceptance projects, review remotes and owner-required decisions must be available for live execution.
- **Unknowns:**
  - Which exact candidate versions and representative run assignment cover both launch modes and selected features in each configuration? — Owner: maintainer with the user. Block: no, fix the assignment before qualification runs.
  - Does every retained qualifying result match the final candidate and the agreed acceptance conditions? — Owner: maintainer. Block: no, verification is this slice's outcome.
- **Risk:** Evidence from an earlier candidate can overstate current support after later behavior changes.
- **Carried acceptance:** S-14 Manual rows 1.3 and 3.4 retain twelve unverified configuration/mode cells, and S-13 Manual row 3.4 retains six unverified OpenSpec cells. S-20 qualifies these obligations against the final combined candidate within its existing eighteen-normal-run contract. [S-14 closeout](../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout), [S-13 decision](../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision)
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| S-14 | nested-step-delegation | Pipeline steps can delegate to child subagents | yes | MS-01/MS-02: the only Wave 0 change. Establish its focused flat/delegated baseline and host proof inside the change. |
| S-12 | first-unattended-delivery | First unattended plan-based delivery | yes | Planning can proceed. Delivery awaits the owner’s decision on the three open proof rows on PR #214. [Decision track](../changes/WAVES.md#decision-track) |
| S-13 | openspec-2-upgrade | Complete the specification-based workflow on OpenSpec 2.0.0 | yes | Separate agreed upgrade, scheduled after Wave 0 and the audit fixes, before S-12. |
| S-15 | actionable-run-prerequisites | Actionable prerequisite and permission failures | no | Uses the upgraded specification workflow and child-delegation capability as concrete setup cases. |
| S-16 | resumable-unattended-runs | Resume an interrupted unattended run | no | Reuses the delivered recovery implementation and existing regression evidence. |
| S-17 | reviewable-run-handoff | Reviewable completion, archive and report handoff | no | Covers the owner's default-workflow, archive and requested-comment acceptance scope. |
| S-18 | verified-step-protection | Effective step protection in the supported environment | no | Verifies effective provider-specific protection, including child delegation. |
| S-19 | truthful-owner-decision-halts | Truthful verification and owner-decision halts | no | Includes accepted alternative proof when browser tools are unavailable and clear headless halt guidance. |
| S-20 | supported-host-acceptance | Recorded support across all agreed configurations | no | Qualify the combined candidate after S-17 and S-19. Carry the deferred S-13/S-14 checks into the 18 normal runs, with recovery and owner decisions for each configuration. [Milestone completion](../changes/WAVES.md#milestone-completion) |

Readiness here means per-change planning can proceed. The owner-controlled access listed under Blockers must be available for the corresponding live execution. S-12 remains ready for planning while its delivery evidence awaits the owner’s decision. Existing implementations and contract evidence are reused while each slice resolves its observed live gaps.

## Open Roadmap Questions

Entries 1–11 reproduce the PRD decision and evidence register verbatim. Their recorded resolution and deferral states apply. Entry 12 captures the owner-selected execution constraint. MS-01 supersedes entry 6's flat-delegation acceptance target for S-14. Entry 13 records the added capability evidence.

1. **Which configurations carry a v2 support commitment?** Planning decisions resolved by the owner on 2026-11-15. All three delivered configurations receive live acceptance across both chains, establishing six combinations as listed in Current System Overview. Both interactive-session and headless-CLI top-level launches are represented within each combination's three normal runs, retaining the 18-run total. Certify exact tested versions while retaining documented prerequisite floors. Initial coverage includes the default workflow, archive and requested report comments across applicable configurations. Further feature-specific opt-in acceptance is deferred. Owner: user for scope, maintainer for the certification record. Block: scope resolved, certification evidence due at milestone acceptance.
2. **What measurable reliability outcome proves the goal?** Target resolved by the owner on 2026-11-15. Require three out of three normal live runs to complete without manual steering in each of six configurations on the final candidate revision, for 18 normal runs total, with both agreed launch modes represented within each configuration's three runs. Each configuration also exercises interruption/resume and owner-decision halt behavior. Collect current completion/intervention rates, hands-on time and representative-change evidence during the milestone, retaining attempted runs and their outcomes. Owner: maintainer for evidence, user for acceptance. By: milestone acceptance. Block: evidence required before declaring the target achieved.
3. **Which proposed requirements are must-have next?** Resolved by the owner on 2026-11-15. The milestone includes reliability across all six combinations and the specification-tool upgrade, making FR-012 through FR-016 and FR-020 must-have. FR-017 savings/scorer experiments, FR-018 broader onboarding and FR-019 delivery-quality reporting are deferred follow-ups. Owner: user. Block: resolved.
4. **Does the original timeline and scale still apply?** Delivery budget resolved by the owner on 2026-11-15. Work is after-hours with no fixed delivery window or hard deadline, replacing the original three-week assumption. The prior target of dozens to a hundred potential users and hundreds of runs still needs reconfirmation, and current active-user count is unknown. Owner: user for target scale, maintainer for observed usage. By: before a scale-dependent design decision. Block: conditional on such a decision.
5. **Which existing runs must reliability changes support?** Inventory saved/in-flight runs and establish compatibility and recovery behavior before changing their contracts. Owner: maintainer with user confirmation. By: before a state-contract change. Block: conditional on such changes.
6. **Which unattended paths are live-accepted?** Retain evidence for clean installation, discovery in fresh execution contexts, normal completion, interruption/resume, effective permissions, flat delegation and terminal review handling. Existing documentation records outstanding checks. Owner: maintainer, with user authorization where required. By: before each corresponding support claim. Block: yes for that claim.
7. **Which manual-verification capabilities must each configuration provide?** Resolved by the owner on 2026-11-15. Covering tests, commands or scripts are accepted when browser tools are unavailable. Checks lacking qualifying proof remain pending, and archive with pending checks requires explicit owner approval. Owner: user. Block: resolved.
8. **What baseline and aggregation prove the original 30% target?** Decide whether the historical baseline named in Current System Overview remains suitable, how changes are selected and how at least five comparable pairs are summarized. Retain the original target until an explicit replacement decision. Owner: user. By: before savings experiments. Block: yes for a product-wide savings verdict.
9. **What is the scorer experiment's final result?** Its established rule requires at least five comparable pairs and an A/A control. Record results and the keep-or-disable decision, including inconclusive outcomes. Owner: user, with maintainer measurement. By: before claiming the scorer earns its cost. Block: yes for that claim.
10. **How complete is end-to-end usage accounting?** Confirm foreground and late usage on supported hosts, coverage of orchestration and optional advisory work, and limits of monetary estimates and raw-token comparisons across providers. Owner: maintainer. By: before usage/cost claims. Block: yes for claims requiring complete coverage.
11. **What delivery-quality guardrail is acceptable?** Confirm first-pass acceptance, retry and human-correction definitions and thresholds before using savings to change routing policy. Owner: user. By: before such changes. Block: conditional on those changes.

12. **Which acceptance environments and accounts are ready for live execution?** Establish authenticated host/model access, trusted projects and review-remote access for the agreed combinations, then record the exact exercised versions and capability state. Owner: user with maintainer verification. Block: live execution of S-12 through S-20 where the corresponding external prerequisite is unavailable. Per-change planning can proceed.

13. **Which configurations support reliable child delegation?** Establish exact tested host versions, launch modes, effective child permissions, completion delivery and recovery before broadening support claims. The owner selected the capability through MS-01. Any limitation affecting the six agreed configurations needs an explicit scope resolution before qualification. Owner: maintainer for evidence, user for any scope decision. Block: affected implementation and support claims in S-14 and S-20 until the host behavior is established. Planning can proceed.

## Parked

- **Savings and scorer experiments, FR-017.** Deferred by the owner's selected milestone scope. The original savings obligation and scorer decision rule remain pending for follow-up validation.
- **Broader onboarding, FR-018.** Deferred beyond this milestone. Actionable prerequisite diagnostics remain in S-15.
- **Delivery-quality reporting, FR-019.** Deferred beyond this milestone. Current acceptance still records run outcomes and interventions.
- **Further feature-specific opt-in acceptance.** The owner selected default execution, archive and requested report comments for initial coverage.
- **Splitting model and effort into independent choices.** The PRD retains the measurement-dependent deferral.
- **Broader workflow expansion and a new routing algorithm.** The PRD requires a separate scope decision supported by evidence.
- **Replacing or forking upstream toolkits.** The product retains its established add-on boundary.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap.)

- **M-1: Cheaper pipeline routing** (`cheaper-pipeline-routing`) — closed 2026-11-02. Simple changes route to a cheaper model and effort, a report and `compare` show the difference against a Sonnet-5.5 high-effort baseline, and the optional lifecycle steps and the LLM scorer are built. Thresholds, the 30% target and the scorer A/B check are still uncalibrated: no real run data exists yet.

## Done

- **S-01: user can run the pipeline on a simple change and see its steps routed to a cheaper model and effort than a complex change gets.** — Archived 2026-10-30 → `context/archive/2026-10-30-cheaper-routing-simple-change/`. Lesson: —.
- **S-02: user can see, for a finished run, a report of which model and effort ran each step, with usage figures where readable, written before the change is archived.** — Archived 2026-10-30 → `context/archive/2026-10-30-per-step-usage-report/`. Lesson: —.
- **S-03: user can have each change get a rigor level (`lean`, `standard`, `thorough`) that only rises during a run. A `lean` change skips plan-review. A change that touches often-changed paths always gets plan-review and implementation review. The report shows every skipped step with its reason.** — Archived 2026-10-30 → `context/archive/2026-10-30-rigor-levels/`. Lesson: —.
- **S-09: user can have a finished run commit the change folder and archive the change through `/10x-archive` (opt-in), with a read-only check that the archive succeeded. Split from the former S-09 on 2026-10-30: it needs only S-03, so it can start before S-07 and S-08.** — Archived 2026-10-30 → `context/archive/2026-10-30-archive-adapter/`. Lesson: —.
- **S-05: user can see the same report as a comment on the pull request, skipped when no pull request exists.** — Archived 2026-10-31 → `context/archive/2026-10-31-pr-comment-report/`. Lesson: —.
- **S-07: user can have `/10x-research`, legacy research (when a repo map exists), a domain brief and `/10x-frame` run before the plan only when the rigor level and the subagent signals call for them, and have a plan-review RETHINK or a repeated REVISE loop back to frame or research.** — Archived 2026-10-31 → `context/archive/2026-10-30-pre-plan-steps/`. Lesson: —.
- **S-06: user can compare the total usage of a routed run against a baseline run of the same change (a full run on Sonnet-5.5 at high effort).** — Archived 2026-10-31 → `context/archive/2026-10-31-baseline-usage-comparison/`. Lesson: —.
- **S-08: user can have each plan phase run on `/10x-e2e`, `/10x-tdd` or `/10x-goal-implement` as it fits, with a blocked tdd or e2e run falling back to goal-implement, repeated failures and a REJECTED review re-planning, and manual checks automated (with Claude-in-Chrome where it helps) and backed by evidence.** — Archived 2026-10-31 → `context/archive/2026-10-30-phase-executors/`. Lesson: —.
- **S-10: user can see lesson candidates from the impl-review in `report.md`, each with a ready `/10x-lesson <seed>` command.** — Archived 2026-11-01 → `context/archive/2026-10-30-lesson-candidates/`. Lesson: —.
- **S-11: user can have the complexity of a change scored by an LLM on a cheap model, with the scores stored with evidence and unknowns in a machine-readable file, and have the router use them next to the deterministic signals.** — Archived 2026-11-02 → `context/archive/2026-11-02-llm-complexity-scorer/`. Lesson: —.
- **S-13: user can run the specification-based workflow with OpenSpec 2.0.0 and matching integration instructions.** — Archived 2026-11-16 → `context/archive/2026-11-16-openspec-2-upgrade/`. Lesson: —. Owner-approved deferral of six live-host cells to S-20 is recorded in [archive acceptance](../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision).
- **S-14: user can have a pipeline step delegate work to child subagents and receive their completed results before the step finishes.** — Archived 2026-11-16 → `context/archive/2026-11-16-nested-step-delegation/`. Lesson: —. Owner-directed context closeout carries native qualification rows 1.3 and 3.4 into S-20.
- **S-12: user can start a Claude-only plan-based change once and receive reviewable completed work on a pull request.** — Archived 2026-11-17 → `context/archive/2026-11-17-first-unattended-delivery/`. Lesson: —.
