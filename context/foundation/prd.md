---
project: "agent-smith"
version: 2
status: draft
created: 2026-10-29
context_type: brownfield
product_type: other
target_scale:
  users: medium
  qps: 0
  data_volume: "KBs per run, hundreds of runs"
timeline_budget:
  delivery_weeks: null
  hard_deadline: null
  after_hours_only: true
---

# agent-smith — PRD v2

## Current System Overview

agent-smith orchestrates software delivery workflows, selecting the next step, model and effort from project artifacts and earlier results.

This revision reflects the documented delivered baseline as of 2026-11-15 and the owner's chosen future emphasis, "Reliable unattended runs across supported hosts." On 2026-11-15 the owner selected after-hours work with no fixed delivery window or hard deadline. Target scale carries forward from v1 and needs reconfirmation.

### Delivered capabilities

- The plan-based chain runs planning, review, implementation, fixes, evidence-backed manual verification and optional archive. Policy and rigor gate research, framing, scoring and phase-specific executors.
- The OpenSpec chain runs propose, apply, verify, bounded fix loops and optional archive through a second skill sharing the router.
- A dependency-free Node.js 24+ ESM router owns decisions and run state. Project overrides control routing. Rigor rises with risk, and qualifying failures escalate model and effort.
- Each step executes in its own context. The orchestration contract requires flat delegation and associates results and late usage with the launched invocation.
- Default isolation uses Git worktrees, step commits and recoverable rollback snapshots. Terminal handling pushes a run branch and opens or retains a GitHub pull request for human review. Report comments and archive are opt-in.
- Reports expose per-step model, effort, result, available usage, skips and verification evidence. Read-only comparison supports a fixed baseline and scorer-on/off experiments. User-supplied rates optionally provide approximate monetary estimates.
- New runs on either host bind a provider mode at init. Split routes planning and implementation across providers, with headless Claude available on Codex. Mode-less historical runs retain their original host/ladder contract. Authenticated acceptance of the new combinations is pending. Codex CLI 0.169.0 is the documented verified runner contract.
- Policy validation, locking, complete-file state publication, damaged-log diagnostics and provider-specific permission checks support execution and recovery. Persisted step completion now owns stale-result cleanup across both chains and inline/file handoffs, protecting later steps from reuse of a consumed result.
- Orchestrator skills consolidate repeated terminal procedures and keep routing documentation in the behavior reference. Their source sizes are 25,867 bytes for the plan-based chain and 29,230 bytes for the specification-based chain, reductions of 46.08% and 19.81% from the prior baseline. Live token savings remain unmeasured.
- Workflow action-pin checks follow referenced local actions recursively, including metadata outside the workflow directory, and reject missing or unreadable targets. Commit-subject tests also cover invalid subjects beginning with the merge keyword.
- Newly assembled Claude tasks and archive actions use the guarded `agent-smith:step` type by default. A scoped Bash hook rejects common direct unsafe Git, deletion and publication commands. Fail-closed hook handling requires Claude Code 2.1.295+, enabled plugin hooks and supported subagent identity fields. Its literal-command coverage is bounded. Custom agents, OpenAI children and dynamic programs depend on their existing host controls and semantic rules. Fresh-host hook delivery remains pending.
- Planning rules now place publication-dependent acceptance in Manual criteria while retaining locally executable Automated checks. This targets planning/review loops that otherwise require publication before implementation can finish.
- Plugin distribution and automated releases exist. Clean installation, discovery in fresh child execution contexts, permission behavior and complete live execution across hosts still carry documented acceptance gaps.
- The repository owner remains the primary intended user. The last confirmed target was dozens to a hundred potential users. Current active-user count is unknown.
- M-1 closed on 2026-11-02 with its implementation slices recorded complete. The foundation records and scorer ADR still leave the original savings target, routing calibration and scorer experiment unvalidated.

The delivered baseline now includes the safety and stale-result recovery changes in revision `8a3ba5929b891aa5fac9f79c2c339b43539d44a8` and release 1.11.2, together with the previously reviewed Wave 7 deliveries. Current CI passed 1,621 tests with three skips. Archived acceptance now records verified TrueNAS operation and release failure/rerun/concurrency behavior. A live fork run remains unobserved because the available records contain no fork PRs. The owner selected OpenSpec 2.0.0 for a separate upgrade change within the next reliability milestone. CI currently still pins 1.16.1. [Safety review](../archive/2026-11-13-step-subagent-git-guard/reviews/impl-review.md) · [Recovery review](../archive/2026-11-13-stale-last-result-cleanup/reviews/impl-review.md) · [Runner acceptance](../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) · [Release acceptance](../archive/2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md) · [Current CI](https://github.com/xycu/agent-smith/actions/runs/43708971476)

The historical fixed comparison baseline is Sonnet at high effort, named Sonnet-5.5 in v1. Current comparison behavior pins its provider, model alias and effort. Its continued suitability needs an owner decision.

These sources establish the delivered implementation and its documented limits. Live acceptance establishes the reliability of each supported configuration. [Product documentation](../../README.md) · [Behavior reference](../../docs/REFERENCE.md) · [Host/provider contract](../../docs/ADR/ADR-024-openai-codex-support.md) · [M-1 record](roadmap.md)

### Agreed reliability acceptance scope

On 2026-11-15 the owner selected all three delivered host/provider configurations for live acceptance across both workflow chains.

- Claude Code with a Claude-only ladder, on both chains.
- Claude Code with a mixed Claude/OpenAI ladder, on both chains.
- Codex with an OpenAI-only ladder, on both chains.

This establishes six acceptance combinations. On 2026-11-15 the owner selected three successful unattended normal runs per combination on the final candidate revision, for 18 normal runs total. Both interactive-session and headless-CLI top-level launches are represented within each combination's three normal runs. Each combination also exercises interruption/resume and owner-decision halt behavior.

The owner selected certification of exact tested versions while retaining documented prerequisite floors. Current prerequisites include Node 24+, Claude Code 2.1.295+ for fail-closed hook handling, the verified Codex CLI 0.169.0 runner contract and the planned OpenSpec 2.0.0 upgrade. Acceptance records the exact versions and configuration actually exercised.

Initial live acceptance covers the default workflow, archive and requested PR report comments across applicable configurations. Both launch modes and these features are represented within the agreed run matrix. Further feature-specific opt-in acceptance is deferred.

### Original motivation

> Running the chain on expensive models and effort levels consumes too much of the user's Claude usage limit, mostly the weekly limit.

### Historical shaping rationale

The following counter-arguments and resolutions are retained verbatim from v1 in requirement order. They record the original decisions. The delivered baseline above and v2 scope below establish present requirements. Historical Open Question references belong to v1.

> Socrates: Counter-argument considered: "reading costs tokens and can eat the savings." Resolution: kept as written; accept the reading cost for now.

> Socrates: Counter-argument considered: "skipping review can cost more later." Resolution: kept; plan-review is skipped only on a clean rubric, otherwise it always runs.

> Socrates, 2026-10-30 (rigor-levels): Counter-argument considered: "a clean rubric is not defined, so the skip cannot be built." Resolution: changed. The router skips plan-review when the change's rigor level is `lean`, and logs the skip with its reason in `run.jsonl` and `report.md`. The skip needs a measured risk (git history readable and the plan names at least one path) and happens only before implementation starts. Any other level, an unmeasured risk or a hot path in the plan runs plan-review.

> Socrates: Counter-argument considered: "a change misjudged as simple fails on a cheap tier and costs more." Resolution: kept; start cheap and rely on per-failure escalation.

> Socrates: Counter-argument considered: "run.jsonl and the status command already show it." Resolution: kept; run.jsonl is machine data, the report is the human-readable summary for archive and pull request.

> Socrates: Counter-argument considered: "needs GitHub access and a PR." Resolution: kept; skip the comment when no pull request exists. The report file is always written.

> Socrates: Counter-argument considered: "doubles the surface before routing is proven." Resolution: kept as nice-to-have, built after dynamic routing works.

> Socrates: Counter-argument considered: "every subagent reloads context." Resolution: kept; isolation is what enables a model and effort per step.

> Socrates: Counter-argument considered: "committed run logs cause git noise." Resolution: kept; git handling (gitignore or commit policy) is decided downstream.

> Socrates: Counter-argument considered: "usage figures may not be readable by the script." Resolution: kept; record model and effort now, add token or cost figures once a readable source is found (Open Question 4). Finding that source is the first task.

> Socrates: Counter-argument considered: "path rules misjudge risk, missing risky changes and over-flagging harmless ones." Resolution: kept; start with a small set of path rules and review them after the first runs.

> Socrates: Counter-argument considered: "a deferred FR invites early building." Resolution: kept as nice-to-have and listed as a non-goal for this delivery.

Subsequent decisions implemented measured-risk rigor gating, elevated the scorer to must-have and delivered both workflow chains. The original shaping record predates these changes. [Shaping record](shape-notes.md) · [Scorer decisions](../../docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md)

## Problem Statement & Motivation

The owner wants to start an authorized workflow and let it finish without repeated steering. Delivered execution support still carries live-acceptance gaps around installation, prerequisite discovery, permissions, unattended invocation, delegation and completion.

Why now follows from the expanded delivered surface and the owner's 2026-11-15 priority choice. The next delivery should establish which configurations reliably complete and resolve failures exposed by real use.

The documented operational fallback is inspection of setup, configuration, run state and evidence, followed by resume or an owner decision. Frequency, hands-on time and usage spent on this intervention have yet to be measured. The original motivation also remains relevant.

The original motivation remains reducing the owner's weekly model-usage consumption.

# TODO: quantify present unattended-run failures and owner intervention cost — see Open Questions 2.

## User & Persona

The primary user is the repository owner, running delivery workflows on their own projects. They want to start an authorized change, leave it running, and return to reviewable work or an actionable request for their decision.

### Secondary persona

Other developers installing the plugin need a clear supported configuration and a repeatable first run. The carried-forward target is dozens to a hundred potential users. Current adoption and recurring difficulties need confirmation.

## Success Criteria

The primary direction and live-run acceptance target are owner-selected. The following acceptance properties also retain the existing execution and recovery contracts.

### Primary

- Each of the six agreed configurations completes three out of three normal live runs on the final candidate revision without manual steering, for 18 normal runs total. Both interactive-session and headless-CLI top-level launches are represented within each configuration's three runs. Every run reaches a reviewable completed result with retained evidence identifying configuration, launch mode, revision, exact tested versions and outcome.
- Each configuration also exercises interruption/resume with recoverable work and consistent progress, and an owner-required halt with an explicit reason and next action. Acceptance evidence retains these outcomes alongside the normal-run results.

Acceptance covers the six host/provider/chain combinations agreed in Current System Overview. Specification-based runs use the upgraded tool version selected there. Each applicable configuration demonstrates default execution, successful archive and requested report comments. Feature coverage fits within the agreed run matrix, together with its recovery and owner-decision checks.

Record all attempted runs and interventions with their outcomes. The milestone evidence will establish current completion/intervention rates, hands-on time and the representative changes exercised.

The acceptance record certifies exact tested versions and retains the documented prerequisite floors selected in Current System Overview.

### Secondary

The following validation and reporting outcomes are deferred follow-ups after the selected reliability and upgrade milestone.

- Carry forward the original 30% raw-token reduction target against the agreed fixed-model high-effort baseline, provisional until at least five comparable pairs exist. Baseline suitability and the aggregation rule need resolution.
- Evaluate scorer benefit using its existing decision rule over at least five comparable scorer-on/off pairs and an A/A control. Record the resulting keep-or-disable decision.
- Judge delivery quality through first-pass acceptance, retries, human corrections and cost per completed change. Numeric quality targets and sufficiently complete cost measurement remain open.

### Guardrails

- Existing entry points, project overrides, saved runs, reports and optional archive/report-comment behavior retain compatible semantics.
- Isolation and recovery preserve work. Execution respects effective project trust, credentials and permission restrictions.
- Accepted results and usage figures belong to their launched steps. Active work remains awaited through completion.
- Every verification row marked proved carries qualifying evidence. When browser tools are unavailable, covering tests, commands or scripts can supply that proof. Checks lacking qualifying proof remain pending and visible. Archive with pending checks requires explicit owner approval.
- Reliability evidence separately records successful completion, expected owner-required halts and technical failures.
- Comparisons retain failed-attempt usage, retries and missing-usage diagnostics. Any unmeasured orchestration usage is disclosed alongside measured totals.

## User Stories

US-01 and US-02 from v1 are delivered behavior covered by FR-001 through FR-003. Story identifiers continue from US-03. The following are draft acceptance stories translating the selected reliability direction for owner review.

### US-03: User starts a supported unattended run

- **Given** a trusted project, supported execution configuration and installed workflow prerequisites
- **When** the user starts the workflow through a supported unattended entry point
- **Then** authorized steps continue to a reviewable result, with any required owner decision reported explicitly

#### Current baseline

Both chains and provider dispatch exist. Complete live unattended acceptance remains pending for documented execution configurations and invocation modes.

### US-04: User learns what blocks execution

- **Given** the selected configuration lacks a required capability or permission
- **When** the user attempts to start the workflow
- **Then** a specific diagnostic identifies the missing prerequisite or permission and the action needed to proceed

#### Current baseline

Setup and permission checks exist. Clean installation, discovery in fresh execution contexts and effective permission behavior need live acceptance.

### US-05: User resumes after interruption

- **Given** a run has completed work and its execution or observation was interrupted
- **When** the user resumes the same run
- **Then** work remains recoverable, accepted results belong to the correct invocation, and continuation respects the recorded execution identity

#### Current baseline

Resume, invocation identity, locking and recovery are implemented. Persisted-result cleanup now has crash, ownership, rollback and late-usage regressions across both chains and handoff transports. Combined real-host recovery acceptance remains pending.

### US-06: User trusts the terminal report

- **Given** a run completes or halts
- **When** the user reviews its outcome
- **Then** the report exposes the result, reviewable work, available usage, pending verification and any action required from the user

#### Current baseline

Reports and terminal review handling exist. Acceptance needs to cover normal completion, interruption/resume and expected capability or owner-decision halts.

## Scope of Change

On 2026-11-15 the owner selected reliable unattended execution plus the specification-tool upgrade for the next milestone. Existing requirement identifiers retain traceability. Reliability work addresses observed acceptance gaps, and the upgrade is delivered through its own tracked change within the milestone.

### Delivered requirements to preserve

- [preserved] FR-001: The workflow can use generated project artifacts to determine its next action. Priority: must-have.
- [preserved] FR-002: A lean plan-based run can skip plan review only when measured risk permits the skip, with its reason visible in the run record. Priority: must-have.
- [preserved] FR-003: The workflow can select model and effort from complexity, risk and prior results, with escalation on qualifying failures. Priority: must-have.
- [preserved] FR-004: The user can see a per-step report before optional archive. Priority: must-have.
- [preserved] FR-005: The user can request the run report as a pull-request comment. Priority: must-have.
- [preserved] FR-006: The user can run the specification-based chain through its dedicated entry point. Original priority: nice-to-have. Delivered and included in the v2 reliability baseline.
- [preserved] FR-007: Each step runs in its own execution context with a separately selected model and effort. Priority: must-have.
- [preserved] FR-008: Each chain retains its established per-change run-state location and optional archive lifecycle. Priority: must-have.
- [preserved] FR-009: The user can inspect per-step model, effort and available usage, and compare runs with coverage and comparability diagnostics. Priority: must-have.
- [preserved] FR-010: Elevated measured risk raises plan-based rigor and preserves required reviews, while unresolved owner decisions produce an explicit halt. Priority: must-have.
- [preserved] FR-011: The plan-based workflow can use an optional complexity score with evidence and unknowns to inform eligible routing decisions. Priority: must-have.

### Committed reliability and upgrade scope

FR-012 through FR-016 and FR-020 are must-have for the next milestone by owner decision on 2026-11-15. The six-configuration acceptance target covers the upgraded specification-tool contract.

- [modified] FR-012: The user can start each agreed supported host/chain configuration and obtain a live-verified unattended completion through its documented entry point. Priority: must-have.
- [modified] FR-013: The user can identify missing prerequisites and execution permissions from actionable diagnostics before affected work proceeds. Priority: must-have.
- [modified] FR-014: The user can resume an interrupted run with recoverable work, consistent progress and correct association of execution results. Priority: must-have.
- [modified] FR-015: The user can distinguish active execution, successful completion, a recoverable execution problem and a required owner decision from the recorded outcome and guidance. Priority: must-have.
- [new] FR-016: The user can inspect a versioned support and acceptance record for the agreed hosts, chains, execution configurations and invocation modes. Priority: must-have.

- [modified] FR-020: The user can run the specification-based workflow using the upgraded tool version agreed in Current System Overview and matching integration instructions. Priority: must-have.

### Deferred follow-ups

- [modified] FR-017: The user can judge the original savings claim and scorer benefit from comparable runs with recorded outcomes, usage coverage and the resulting decision. Priority: nice-to-have for this delivery, deferred to follow-up validation. The original savings and scorer decision obligations remain pending.
- [new] FR-018: The user can obtain broader setup and onboarding guidance for recurring obstacles demonstrated by acceptance evidence. Priority: nice-to-have, deferred beyond this milestone. Actionable prerequisite diagnostics remain in FR-013.
- [new] FR-019: The user can evaluate delivery quality and hands-on intervention alongside usage per completed change. Priority: nice-to-have, deferred beyond this milestone. Reliability acceptance still records run outcomes and interventions.

## Constraints & Compatibility

- Existing commands, project override location and run-log/report contracts form the compatibility baseline. Reliability changes need coverage for saved runs, optional features and documented provider defaults they touch.
- Both delivered chains and upstream toolkit integrations belong to the supported product surface. Upstream tools retain their own ownership and release lifecycle.
- Run host identity stays fixed through resume. Effective execution settings and permissions remain authoritative.
- Certification names the exact tested versions and configuration while retaining documented prerequisite floors. Initial coverage includes default execution, archive and requested report comments across applicable configurations.
- Each step retains isolated execution and correct result/usage attribution. Existing review and recovery behavior preserves work.
- Saved-run format changes require an explicit compatibility and recovery decision before implementation. Inventory existing recorded and in-flight runs before assuming there is no data to carry forward.
- Delivery uses after-hours work with no fixed delivery window or hard deadline, confirmed by the owner on 2026-11-15. The delivery-week field is null to record that decision. Target scale remains a carried-forward assumption awaiting confirmation.

# TODO: inventory saved-run compatibility and confirm target scale before dependent design decisions — see Open Questions 4 and 5.

## Business Logic Changes

Model and effort for each step depend on task effort and complexity so that the agentic pipeline is money efficient.

Current routing already incorporates artifact signals, measured risk, prior failures and eligible complexity scores. The v2 priority concerns reliable execution across supported hosts and clear completion, recovery and owner-decision outcomes.

Measured-risk review rules and the scorer's established keep-or-disable experiment remain applicable. Subsequent routing changes need an explicit decision supported by reliability or savings evidence.

## Access Control Changes

No access control changes.

The user who starts a workflow operates within existing project trust, credentials and permission restrictions. Required owner decisions remain explicit halts. Effective permissions form part of acceptance evidence.

## Non-Goals

- Replacing or forking upstream workflow toolkits falls outside the established add-on product boundary.
- Splitting model and effort into independent choices remains parked pending measurement, as recorded in the existing roadmap.
- Broader workflow expansion or a new routing algorithm requires a separate scope decision after reliability and measurement evidence is available.
- Savings/scorer experiments, broader onboarding and delivery-quality reporting are scheduled as follow-ups after this reliability and upgrade milestone.
- Further feature-specific opt-in acceptance follows the selected default-workflow, archive and report-comment coverage.

## Open Questions

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
