# Waves v2

Updated 2026-11-16. The initial planning snapshot was `main` at `dee383af2ecd1080bb5f0f254cb6bcf01ca1b8e6`, after [PR #197](https://github.com/xycu/agent-smith/pull/197). Waves 1 and 2 are accepted, archived and merged. Wave 2 carries the owner's explicit deferral of six live-host qualification cells to S-20. The current release is [v1.13.0](https://github.com/xycu/agent-smith/releases/tag/v1.13.0), at `f126287f`. Wave 3 is next, subject to its recorded host/account prerequisites.

**Wave 0 contains exactly one change: `nested-step-delegation` (S-14).** The owner selected child-subagent support as the first delivery on 2026-11-15. No other change runs alongside it. The former prerequisite S-12 → S-14 is reversed: S-14 establishes its own focused baseline and proof; the first complete unattended delivery follows it.

This version replaces the completed seven-wave schedule. Its full history, merged PRs and outstanding archived acceptance rows remain in the [version 1 ledger](https://github.com/xycu/agent-smith/blob/dee383af2ecd1080bb5f0f254cb6bcf01ca1b8e6/context/changes/WAVES.md). No archived artifact is changed or implicitly marked complete.

## Wave 1 acceptance

Both audit fixes completed seven pipeline steps, received implementation-review approval with zero findings, passed their local full suites and PR CI, and received the owner’s review approval on 2026-11-16. Every Automated and Manual Progress row is complete in both archived plans.

| Change | Accepted implementation | Archive and verification |
| --- | --- | --- |
| Comparison integrity | PR #201 merged as `a48269ce`, with 1,736 local full-suite passes with three expected skips. | [Archive](../archive/2026-11-15-compare-damaged-logs-not-comparable/change.md), [verification and publication acceptance](../archive/2026-11-15-compare-damaged-logs-not-comparable/evidence/verification.md), [PR #201](https://github.com/xycu/agent-smith/pull/201) |
| Configured branch prefix | PR #203 merged as `bd669ada`, with 1,727 local full-suite passes with three expected skips. | [Archive](../archive/2026-11-15-run-branch-prefix-consistency/change.md), [verification and publication acceptance](../archive/2026-11-15-run-branch-prefix-consistency/verification.md), [PR #203](https://github.com/xycu/agent-smith/pull/203) |

The owner directed Wave 1 kickoff after the Wave 0 implementation merged, while S-14’s live-host qualification remained pending. That instruction supplied the scheduling exception for Wave 1. The subsequent context closeout archives S-14 with its recorded host-acceptance obligations carried into S-20. [Wave 0 acceptance evidence](../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)

## Wave 2 acceptance

S-13 completed seven pipeline steps, received implementation-review approval with zero findings, and passed the independent local full suite with 1,790 passes, zero failures and three expected skips. The OpenSpec CLI contracts execute against exactly 2.0.0, and all twelve generated workflows have migrated integration instructions. All eight Automated Progress rows and publication row 3.5 are complete. [Implementation review](../archive/2026-11-16-openspec-2-upgrade/reviews/impl-review.md), [verification](../archive/2026-11-16-openspec-2-upgrade/evidence/verification.md), [Progress](../archive/2026-11-16-openspec-2-upgrade/plan.md#progress)

| Change | Accepted implementation | Archive and publication |
| --- | --- | --- |
| S-13 `openspec-2-upgrade` | PR #208 merged as `fed1cfb2`. Release PR #209 merged as `f126287f`, publishing v1.13.0. | [Archive](../archive/2026-11-16-openspec-2-upgrade/change.md), [publication acceptance](../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#publication-acceptance), [PR #208](https://github.com/xycu/agent-smith/pull/208), [release PR #209](https://github.com/xycu/agent-smith/pull/209) |

The owner selected “Archive with qualification deferred to S-20” on 2026-11-16. Manual row 3.4 preserves six unverified OpenSpec host/provider/launch cells, covering Claude-only, mixed-provider and OpenAI-only configurations across interactive and headless launches. S-20 retains their normal-entry, child ownership, recovery, restriction and usage proof obligations on the final combined candidate. S-13 is closed under that explicit decision. [Owner archive decision](../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision), [pending matrix](../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#openspec-normal-entry-matrix)

Main-branch CI passed for both the implementation merge and the release merge, and the release workflow published v1.13.0 successfully. The requested PR report comment is present. [Implementation CI](https://github.com/xycu/agent-smith/actions/runs/43962649787), [release CI](https://github.com/xycu/agent-smith/actions/runs/43964089841), [release workflow](https://github.com/xycu/agent-smith/actions/runs/43965222889), [report comment](https://github.com/xycu/agent-smith/pull/208#issuecomment-6929295241)

## Initial planning snapshot

| Area | State at this snapshot | Source |
| --- | --- | --- |
| Released product | Latest release is v1.11.2. Both workflow chains, provider dispatch, isolation, recovery, reports and terminal PR publication are implemented. | [Release](https://github.com/xycu/agent-smith/releases/tag/v1.11.2), [PRD](../foundation/prd.md) |
| Reliability milestone | M-2 is open. All nine slices S-12–S-20 remain undelivered. Child delegation and OpenSpec 2.0.0 are committed additions; installed-host qualification is still pending. | [Roadmap](../foundation/roadmap.md) |
| Audit fixes | Two descriptive change records merged in PR #197. Both have `status: new`; neither has a plan or implementation. | [Comparison integrity](../archive/2026-11-15-compare-damaged-logs-not-comparable/change.md), [branch prefix](../archive/2026-11-15-run-branch-prefix-consistency/change.md) |
| Child delegation | Current rules forbid nested agents and the project applies a depth cap. S-14 is now first and ready for planning; its change folder and plan do not exist yet. | [Roadmap S-14](../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents), [ADR-018](../../docs/ADR/ADR-018-no-nested-subagents.md) |
| Parked implementation | `quote-router-in-skill-loops` is the only open implementation PR, draft #186. It stays parked until the owner resumes it. | [Change](quote-router-in-skill-loops/change.md), [PR #186](https://github.com/xycu/agent-smith/pull/186) |
| Readiness assessment | Research is complete and merged. Its identity file remains `preparing`; it is evidence for this schedule, not an implementation to run. Its original first-run ordering predates the Wave 0 decision. | [Assessment](../archive/2026-11-15-production-readiness-assessment/research.md) |
| Existing verification | The recorded full suite has 1,621 passes, zero failures and three expected skips. Runner/release acceptance exists; this does not establish the complete live product matrix. No runtime suite was rerun for this scheduling document. | [Health evidence](../foundation/health-check.md), [assessment](../archive/2026-11-15-production-readiness-assessment/research.md) |

The initial schedule contained **11 changes**, comprising nine roadmap slices and two audit fixes. At that planning baseline, only the two audit fixes had change folders on `main`; the roadmap-only IDs below described proposed work identities.

## Execution rules

- Waves run in order. Start a wave from the combined `main` after every scheduled implementation PR in the preceding wave is merged and that wave's acceptance is recorded. Opening a PR or merging a change description does not complete its implementation.
- Wave 0 is a single-change wave even if another task has no technical dependency on it. Do not start another implementation beside S-14.
- Initialize a roadmap-only change with `/10x-new <change-id>` before planning it. Existing audit records go through planning in their current folders. This schedule does not create plans or launch runs.
- Each implementation uses its own run worktree. A multi-change wave is eligible for parallel execution only after its plans confirm disjoint production-code, policy, prompt and workflow regions. If ownership overlaps, move the conflicting change to a later wave before launch.
- The ownership entries below are planning boundaries, not pre-approved file lists. Shared documentation and test indexes may be merged sequentially when their sections are independent. Shared runtime logic, runner settings or the same skill section requires serialization.
- Preserve the shared rules and result-ownership protections while changing delegation. Merely removing the nesting ban or increasing the depth cap does not complete Wave 0.
- Keep live host/account prerequisites explicit. Missing credentials, unsupported execution modes or a required owner decision remain actionable blockers; passing local fixtures cannot substitute for the promised live proof.
- Update this ledger after each wave in one maintenance PR. Individual parallel changes leave it alone. Resolve branch conflicts with a merge of current `main` and a new commit; never force-push or rewrite pushed history.

## Wave map

Waves 0–2 have merged implementations and archived change records. Wave 0's native qualification and Wave 2's six-cell upgrade qualification are carried into S-20 with pending evidence preserved. Waves 3–8 retain their planned outcomes. Wave 3's preceding-wave entry condition is satisfied, and its authenticated Claude and review-remote prerequisites apply. Roadmap readiness continues to mean ready for planning.

| Wave | Changes | Entry condition | Exit outcome |
| --- | --- | --- | --- |
| **0 — child delegation (1), archived** | **S-14 `nested-step-delegation`** | Owner-selected first change; establish focused host prerequisites and baseline within this change. | Merged through PR #199 and archived during owner-directed context closeout. Publication acceptance is complete; native qualification rows 1.3 and 3.4 carry into S-20 as pending. |
| **1 — audit correctness (2), complete** | `compare-damaged-logs-not-comparable`; `run-branch-prefix-consistency` | Owner-directed kickoff after Wave 0 implementation merged, with disjoint runtime ownership confirmed in the plans. | Accepted, archived and merged through PRs #201 and #203. Damaged logs are ineligible for comparison; configured run branches work through setup and publication. |
| **2 — specification compatibility (1), complete** | S-13 `openspec-2-upgrade` | Wave 1 merged. | Accepted, archived and merged through PR #208, released as v1.13.0. OpenSpec 2.0.0 CLI contracts and migrated integration instructions pass; six live-host qualification cells are explicitly deferred to S-20. |
| **3 — first complete delivery (1)** | S-12 `first-unattended-delivery` | Wave 2 merged; authenticated Claude and review-remote access available. | One normal Claude-only plan-based run reaches a reviewable PR without steering. |
| **4 — actionable setup (1)** | S-15 `actionable-run-prerequisites` | S-12, S-13 and S-14 delivered; first-run evidence available. | Missing tools, discovery, trust and permissions identify the required action before affected execution. |
| **5 — recovery and protection (2)** | S-16 `resumable-unattended-runs`; S-18 `verified-step-protection` | Wave 4 merged; plans prove recovery and guard changes do not edit the same runner/settings/skill regions. | Interrupted work is recoverable and supported-host protection is observed. |
| **6 — truthful decisions (1)** | S-19 `truthful-owner-decision-halts` | Wave 5 merged, including S-18. | Review/verification truth, pending proof and explicit archive decisions survive terminal handling. |
| **7 — final handoff (1)** | S-17 `reviewable-run-handoff` | Wave 6 merged, with S-16 recovery and S-19 decision behavior available. | Completion, archive, usage and requested PR reports identify the same actual outcome and location. |
| **8 — supported-host qualification (1)** | S-20 `supported-host-acceptance` | Waves 0–7 merged into the candidate; required environments available. | The agreed 18 normal runs and accompanying recovery/decision evidence qualify the final candidate. |

S-13 and S-12 are deliberately sequential here: the first delivery can expose fixes in shared entry points. S-19 precedes S-17 because both can change archive and terminal skill sections. These are execution choices, not additional product features.

<a id="wave-0-child-subagents-alone"></a>
<a id="wave-0-contract-and-remaining-acceptance"></a>

## Wave 0 contract and deferred acceptance

**Only change:** `nested-step-delegation` / [S-14](../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents). Its implementation merged through PR #199 as `d7e08ba6` and shipped in v1.12.0. The single-change execution scope and acceptance contract below retain their original obligations. The owner's later-wave scheduling decisions are recorded in the acceptance sections above. [PR #199](https://github.com/xycu/agent-smith/pull/199), [release](https://github.com/xycu/agent-smith/releases/tag/v1.12.0), [current evidence](../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md)

The change must reconcile the current restrictions as one coherent delivery: shared step rules, executor instructions, both orchestrator skills, host depth/delegation settings, effective step protection, result/usage attribution and interruption recovery. Likely ownership includes `skills/10x-pipeline/rules/top.md`, affected prompts, both `SKILL.md` files, `.claude/settings.json`, relevant Codex/agent/hook configuration, and the existing runner/state paths where evidence shows a change is needed. The plan must identify the exact callers and tests; this list does not require rewriting every listed area.

Before enabling delegation, record a bounded representative run with today's flat behavior. Repeat the same work with child delegation after the change, recording exact host versions and launch modes, elapsed time, available usage, failures and interventions. This local-to-the-change baseline replaces the old dependency on a completed S-12; S-12 remains the later full delivery outcome.

The carried qualification contract requires evidence that:

1. A step can spawn children, receive their completed results and finish through the normal entry points of both chains in the declared supported host/mode combinations.
2. Child, foreign, late and superseded notifications cannot complete the parent step or advance the router prematurely. Available child usage remains attributable to the correct enclosing invocation.
3. Child failure, interruption/resume and late completion preserve recoverable work and consistent progress. Effective child permissions retain the applicable step restrictions.
4. Interactive and headless behavior is recorded. Any capability gap affecting the six agreed configurations is resolved explicitly before making that support claim; a fixture alone does not prove host behavior.
5. The existing delegation decision and tests are updated with the new supported contract. Performance is reported from measurements, including coordination and retries, without assuming an improvement.

The initial planning action was `/10x-new nested-step-delegation` with S-14 and this Wave 0 record as its intent. S-14 is now archived and marked done for implementation delivery. Publication row 3.5 is complete, while Manual rows 1.3 and 3.4 preserve their unverified status for S-20. Performance measurement retains its earlier owner-approved deferral. [Progress](../archive/2026-11-16-nested-step-delegation/plan.md#progress), [closeout decision](../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)

## Ownership and acceptance anchors for later waves

| Wave / change | Initial ownership to confirm in its plan | Evidence that matters |
| --- | --- | --- |
| 1 / [comparison integrity](../archive/2026-11-15-compare-damaged-logs-not-comparable/change.md) | `route.mjs` comparison eligibility/rendering; comparison and partial-log tests; reference comparison section. | The 1,000-token baseline versus 1,100-token routed example becomes non-comparable when the 600-token record is damaged. Cover either side, both chains and `--unpinned`. |
| 1 / [branch prefix](../archive/2026-11-15-run-branch-prefix-consistency/change.md) | `prepare-run.mjs`, isolation policy/identity, `open-pr.mjs`, setup/publication skill sections and their tests. | A `codex/` override works from creation through cleanup, resume and publication while wrong-run protections remain. Shared policy changes require checking the comparison plan before parallel launch. |
| 2 / S-13 | OpenSpec policy, prompts, module and tests; CLI version pin and matching integration instructions. | OpenSpec 2.0.0 workflow, saved-run compatibility and validation/archive behavior. Revalidate Wave 0's OpenSpec delegation contract after upgrade. |
| 3 / S-12 | Fresh Claude-only 10x entry-point discovery, installed guard delivery and end-to-end evidence; observed fixes only. | Authorized change → completed work → reviewable PR, with exact versions and no steering. |
| 4 / S-15 | Prerequisite discovery and prelaunch diagnostics across the selected hosts/chains. | Missing tool, skill, trust or permission produces an actionable refusal before dependent work. |
| 5 / S-16 | Result intake, saved state, execution locks and rollback/recovery; runner changes only where required. | Include the audit's partially staged file: staged-only contents must survive rollback as well as the differing working copy. Preserve invocation ownership after child interruption. |
| 5 / S-18 | Effective guard delivery, hooks/agent metadata, host policy evidence and inherited child restrictions. | Fresh host proof that the intended identity reaches and obeys the guard. If its plan needs runner/config regions owned by S-16, serialize this change before Wave 6. |
| 6 / S-19 | Review/verification decisions, manual-proof rules and archive-decision gate. | Include the audit's `BLOCKED` review with a critical finding: it must not become `action: done`. Pending proof and owner decisions remain explicit. |
| 7 / S-17 | Terminal report/archive locations, publication intent, available usage and final skill handoff. | Resumed and archived runs retain the correct report/PR location and honest publication result. Reuse S-19's decision contract. |
| 8 / S-20 | Versioned acceptance/support record and final-candidate evidence. | Qualify the combined candidate; fixes found here return to their owning changes and require fresh affected evidence. |

The two audit cases attached to S-16 and S-19 are acceptance inputs to those existing slices, not extra changes or claims that their fixes have shipped.

## Parked work and deferred scope

- **`quote-router-in-skill-loops` / [draft PR #186](https://github.com/xycu/agent-smith/pull/186):** remains parked. The skill rewrite prerequisite has merged, but installed-plugin substitution evidence and the owner's resume instruction are still needed. If resumed, update it against the post-Wave-0 skills and place it in its own slot before first-delivery or final qualification evidence that depends on paths with spaces. Do not run it beside another skill edit or silently count affected setup as supported. A blocked dependent flow stays blocked until the fix or an explicit scope decision is available.
- **Completed context records:** `production-readiness-assessment` closes as research-only. `license-and-security-policy` closes with all seven criteria complete. The existing approved `community-standards` archive is integrated with all thirteen criteria complete. These records join S-14 in the archive during owner-directed context closeout. `quote-router-in-skill-loops` is the sole remaining unarchived change folder.
- **FR-017–FR-019:** savings/scorer experiments, broader onboarding and delivery-quality reporting stay deferred. The comparison-integrity bug fix belongs to Wave 1; it does not launch the deferred experiment program.
- **Historical Manual rows:** retain their recorded state in the read-only archives. Relevant live-host and recovery obligations feed S-12–S-20; feature-specific opt-in acceptance remains deferred unless needed by the selected scope. No historical checkbox is closed by this ledger.

## Milestone completion

S-20 must retain three successful normal runs for each of the six agreed combinations: Claude-only on Claude Code, mixed Claude/OpenAI on Claude Code, and OpenAI-only on Codex, each on 10x and OpenSpec. Both interactive-session and headless top-level launches are represented within each combination's three runs: **18 normal runs total**.

Each combination also carries interruption/resume and owner-decision evidence. Cover default execution, successful archive and requested PR comments across applicable configurations, plus the child-delegation contract. Preserve all attempts, failures, interventions, missing-proof reasons and exact tested versions. Earlier evidence counts only where it still matches the final candidate and configuration; changed behavior needs fresh qualifying evidence.

A green unit suite, a merged PR, or the successful first run does not replace this acceptance contract. M-2 closes when its nine roadmap slices are delivered and the combined candidate meets the [PRD acceptance scope](../foundation/prd.md#agreed-reliability-acceptance-scope).
