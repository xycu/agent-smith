---
date: 2026-11-15T18:53:07+01:00
researcher: Codex
git_commit: 72e379435739b621b63e0d9e74663050dfdb07fb
branch: main
repository: agent-smith
topic: Production readiness and minimum remaining delivery
tags: [research, reliability, releases]
status: complete
last_updated: 2026-11-15
last_updated_by: Codex
---

# Research: Production readiness

## Research question

Considering implementation, releases, the current PRD and roadmap, is agent-smith production grade, and what is the minimum remaining delivery?

## Summary

Assessment: a released product with substantial automated assurance, suitable for supervised use, but not yet qualified for unattended production use across its promised configurations. The decisive gap is installed-host acceptance, including recovery, effective permissions and reviewable completion. Missing evidence does not establish that those paths are broken.

The minimum under the existing scope is a qualified release candidate: deliver the committed compatibility/delegation additions, exercise existing capabilities, fix observed failures and publish the support evidence. No broad architectural rewrite is indicated by this bounded inspection.

## Released and implemented

- GitHub's latest-release endpoint returned [v1.11.2](https://github.com/xycu/agent-smith/releases/tag/v1.11.2), published 2026-11-15 at 10:16:08 UTC, targeting `8dcb0679e979aaea87d785964a9b3af6c28d97d9`. It includes guarded step execution and stale-result recovery fixes.
- The live main-branch endpoint matched local `72e379435739b621b63e0d9e74663050dfdb07fb`. `git diff v1.11.2..HEAD` showed documentation, evidence and archive moves; the diff restricted to skills, hooks, agents, tools, workflows and plugin metadata was empty.
- Current [main CI](https://github.com/xycu/agent-smith/actions/runs/43742930932) succeeded. Its Tests and version check job passed. The prior recorded full suite reported 1,621 passes, zero failures and three expected skips ([health-check.md:94](../../foundation/health-check.md#latest-safety-recovery-and-infrastructure-verification)); those counts were not extracted anew from current CI logs.
- Both chains, model/provider routing, isolated worktrees, rollback snapshots, invocation attribution, reports, optional archive/comments and PR publication are implemented. See [PRD delivered baseline](../../foundation/prd.md#delivered-capabilities).
- Recovery evidence covers crash, rollback, result cleanup and late usage across both chains and inline/file handoffs. The review reports no findings: [recovery review](../2026-11-13-stale-last-result-cleanup/reviews/impl-review.md).
- Runner and release infrastructure have live acceptance records: [runner acceptance](../2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) and [release acceptance](../2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md). These do not establish product-run completion.

## Remaining gaps

- **Installed execution and recovery:** the OpenAI integration evidence explicitly leaves clean import, fresh-child toolkit discovery, actual host dispatch, interruption/resume and archive approval pending. Its automated matrix uses deterministic child/native-result fixtures: [verification.md:18–44](../2026-11-13-openai-codex-support/evidence/verification.md#adaptations-and-acceptance-limits).
- **Effective safety:** fresh-host identity/blocking transcripts and live planning adherence remain pending. The Bash guard deliberately covers direct command forms; dynamic programs, custom agents and OpenAI execution rely on existing host controls and semantic rules. This is a documented boundary, not a new confirmed bypass: [guard review:65–68](../2026-11-13-step-subagent-git-guard/reviews/impl-review.md#assumptions-and-remaining-acceptance), [reference:43](../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance).
- **Headless execution:** README:92 explicitly treats immediate-exit predictions as historical and unverified. Actual completion on tested host versions remains an acceptance requirement, not a proven defect: [invocation documentation](../../../README.md#claude-code-invocation).
- **Reviewable handoff:** test the complete flow through remote PR and requested report publication. The skills report publication failures separately from the saved workflow outcome, so a successful local run record alone is insufficient proof: [10x skill Final report](../../../skills/10x-pipeline/SKILL.md#final-report).
- **Known installation edge case:** both skills still contain unquoted script invocations. Literal execution can fail when the resolved plugin path contains spaces. [Change definition:20](../../changes/quote-router-in-skill-loops/change.md) records the condition; [draft PR #186](https://github.com/xycu/agent-smith/pull/186) is parked and remains unmerged. Verify installed-path substitution and include the quoting correction in fresh-install qualification; this assessment does not resume the parked work.
- **Committed new scope:** CI still installs/asserts OpenSpec 1.16.1 (`.github/workflows/ci.yml:57–60`); OpenSpec 2.0.0 and nested delegation remain roadmap work. Nested delegation currently has deliberate restrictions following historical lost hand-backs, so permitting it requires completion, attribution, recovery and permission evidence, not merely removing a ban.

## Minimum delivery and roadmap mapping

The roadmap records S-12 and S-13 as ready and S-14 through S-20 as proposed ([roadmap:50–58](../../foundation/roadmap.md#at-a-glance)). Reuse delivered state, recovery and reporting code; a proposed acceptance slice does not imply its whole capability needs rebuilding.

1. Establish the first clean installed Claude-only 10x run through a reviewable PR (S-12). Resolve fresh installation/discovery and the known quoting case.
2. Deliver the selected OpenSpec 2.0.0 integration and safe child delegation (S-13/S-14), preserving existing run compatibility. Record delegation performance without assuming improvement.
3. Prove actionable prerequisite failures, interruption/resume, final PR/archive/comment handoff, effective protection and truthful owner-decision halts; repair observed gaps (S-15–S-19).
4. Qualify and release the resulting candidate with exact versions, configuration, outcomes and recovery guidance (S-20).

The agreed qualification matrix is Claude-only on Claude Code, mixed Claude/OpenAI on Claude Code, and OpenAI-only on Codex, each on both chains. It requires three normal unattended successes per combination, 18 total, with interactive and headless launches represented within each combination. Also exercise recovery and owner-decision behavior in each combination and cover default execution, archive and requested PR comments. Preserve failed attempts and interventions; refresh qualifying evidence after behavior changes. Source: [roadmap:27–34](../../foundation/roadmap.md#milestone), [PRD acceptance scope](../../foundation/prd.md#agreed-reliability-acceptance-scope).

OpenSpec 2.0.0 and nested delegation are current product commitments, not universal prerequisites for calling an existing flat-delegation tool production-ready. A narrower first production scope is possible only through an explicit scope decision; this assessment does not remove those commitments. Start with S-12 for useful evidence, but do not treat it alone as qualification of the whole product.

Savings/scorer experiments, broader onboarding and delivery-quality reporting remain deferred under FR-017–FR-019. They need not block operational qualification, but the original 30% savings and scorer-benefit claims remain unproven. Source: [PRD deferred follow-ups](../../foundation/prd.md#deferred-follow-ups).

## Evidence limits and open questions

This assessment combined current source/document inspection, two bounded read-only investigations and live GitHub release/main/CI/open-PR reads. No runtime changes, paid model runs, fresh installation or full-suite rerun were performed. No new runtime defect was confirmed beyond the already recorded quoting issue.

The required live matrix remains missing; this is an assessment of readiness, not a certification. Three successful runs per configuration are the agreed release acceptance threshold, not a statistical uptime guarantee. Production support should be stated for the tested configurations and versions, with human review retained before merge.

Related sources: [health check](../../foundation/health-check.md), [host/provider ADR](../../../docs/ADR/ADR-024-openai-codex-support.md), [delegation ADR](../../../docs/ADR/ADR-018-no-nested-subagents.md).
