---
date: 2026-11-17T00:26:53+01:00
researcher: Codex
git_commit: 22fad2ffc5c720faa66e7325d77d592797fcb943
branch: detached HEAD
repository: agent-smith
topic: "S-12 first unattended Claude-only plan-based delivery"
tags: [research, codebase, claude, 10x-pipeline, acceptance]
status: complete
last_updated: 2026-11-17
last_updated_by: Codex
---

# Research — First unattended delivery

## Research Question

For roadmap slice S-12, how does the existing Claude-only plan-based workflow reach reviewable completed work on a pull request, and which configuration decisions and live evidence remain before that outcome can be accepted? The change identity contains a title and placeholder Notes. The roadmap and execution ledger supply its scope. [roadmap.md:94](../../foundation/roadmap.md), [WAVES.md:103](../WAVES.md)

## Summary

- The implementation already supplies isolation, artifact-driven routing, guarded Claude dispatch, result intake, step commits and terminal PR publication. S-12 owns fresh Claude-only 10x discovery, installed guard delivery, complete-flow evidence and fixes justified by observed failures. Its Wave 3 exit requires one normal run reaching a reviewable PR without steering. [SKILL.md:30](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:165](../../../skills/10x-pipeline/SKILL.md), [WAVES.md:66](../WAVES.md), [WAVES.md:103](../WAVES.md)
- This repository's project override selects an OpenAI-only ladder. Under the inspected policy merge, its ladder replaces the shipped Claude ladder, and choosing the Claude host retains those OpenAI dispatch targets. The acceptance project's effective policy therefore needs to be established during planning. [agent-smith-policy.json:5](../../foundation/agent-smith-policy.json), [state.mjs:40](../../../skills/10x-pipeline/scripts/state.mjs), [state.mjs:65](../../../skills/10x-pipeline/scripts/state.mjs), [state.mjs:93](../../../skills/10x-pipeline/scripts/state.mjs)
- The inspected historical records leave the Claude-only 10x normal-entry proof and fresh-host guard enforcement pending. Successful native primitives, fixture contracts and publication records supply narrower evidence. Candidate configuration, discovery, permissions, parent-result ownership and the final published work need a retained live attempt record. [delegation acceptance:5](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md), [delegation acceptance:9](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md), [REFERENCE.md:45](../../../docs/REFERENCE.md)

## Detailed Findings

### Scope and entry conditions

S-12 is the first full Claude-only plan-based delivery after S-14. The current ledger records Waves 0–2 as merged and declares Wave 3's preceding-wave entry condition satisfied. It retains authenticated Claude access and review-remote access as launch prerequisites. The selected eligible change and exact host configuration remain planning choices. [roadmap.md:45](../../foundation/roadmap.md), [roadmap.md:101](../../foundation/roadmap.md), [WAVES.md:59](../WAVES.md)

The milestone separately requires eighteen normal runs across six host/provider/chain combinations, with interactive and headless launches represented and recovery/owner-decision evidence. That qualification belongs to S-20. S-12 contributes the first complete flow and extends the evidence convention. [prd.md:50](../../foundation/prd.md), [WAVES.md:120](../WAVES.md), [roadmap.md:88](../../foundation/roadmap.md)

### Normal launch and isolated configuration

The documented installation registers the marketplace and installs `agent-smith@agent-smith`. The deliberate entry point is `/agent-smith:10x-pipeline <change-id> "<goal>"`. The skill disables automatic model invocation. Its start procedure requires `10x-plan`, `10x-plan-review`, `10x-goal-implement` and `10x-impl-review`, prepares isolation, then calls router `init` with the actual host and requested options. [README.md:23](../../../README.md), [README.md:89](../../../README.md), [SKILL.md:7](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:32](../../../skills/10x-pipeline/SKILL.md)

Fresh setup creates a linked worktree from current `HEAD` and copies the selected change folder. It records other uncommitted paths in `notInRun`. Consequently, an uncommitted policy or settings adjustment outside the selected folder is absent from that newly created run. Existing run branches follow reuse/resume paths. This makes the committed acceptance configuration part of the launch contract. [prepare-run.mjs:218](../../../skills/10x-pipeline/scripts/prepare-run.mjs), [prepare-run.mjs:230](../../../skills/10x-pipeline/scripts/prepare-run.mjs)

The shipped ladder uses Claude aliases and omitted providers resolve to `claude`. The project override in this checkout supplies OpenAI providers throughout its ladder. `deepMerge` replaces arrays, and `hostProblem` permits a Claude host with OpenAI targets. Host identity alone cannot establish a Claude-only run. [policy.json:2](../../../skills/10x-pipeline/policy.json), [agent-smith-policy.json:5](../../foundation/agent-smith-policy.json), [state.mjs:40](../../../skills/10x-pipeline/scripts/state.mjs), [state.mjs:93](../../../skills/10x-pipeline/scripts/state.mjs)

Print-mode invocation is documented as `claude -p "/agent-smith:10x-pipeline <change-id>"`. The README explicitly retains version-specific invocation and full headless completion as pending live acceptance. Its note treats the reference's early-exit prediction as historical and unverified. The current loop requests foreground Agent execution when the exposed schema offers `run_in_background`. [README.md:97](../../../README.md), [README.md:103](../../../README.md), [SKILL.md:60](../../../skills/10x-pipeline/SKILL.md)

### Routing, results and ownership

The router reads plan Progress, review verdicts, verification and prior results to select planning, reviews, implementation or fixes. The orchestrator forwards the returned agent, model, effort and prompt. Its result handling accepts the enclosing step report after child collection, preserves returned fields, and calls `next`. Artifact verification contributes to step success before the router commits accepted work. [flow.mjs:679](../../../skills/10x-pipeline/scripts/flow.mjs), [flow.mjs:547](../../../skills/10x-pipeline/scripts/flow.mjs), [SKILL.md:60](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:90](../../../skills/10x-pipeline/SKILL.md), [route.mjs:97](../../../skills/10x-pipeline/scripts/route.mjs)

The current shared rule permits an awaited child layer beneath the enclosing step and explicitly supersedes flat-delegation lessons for these pipeline tasks. It requires guarded Claude children, inherited restrictions, bounded ownership and parent reconciliation before completion. ADR-018 Amendment 3 replaces its historical flat-delegation decision. The historical lesson still explains the failure class and remains a human-maintained record. [top.md:14](../../../skills/10x-pipeline/rules/top.md), [ADR-018:93](../../../docs/ADR/ADR-018-no-nested-subagents.md), [lessons.md:19](../../foundation/lessons.md)

An unresolved execution lock suspends result intake, router advancement, rollback and terminal publication. The skill requires preserving pending dispatch and saved prompt bytes, the enabling revision and the same TMPDIR until established settlement and router-owned recovery. This existing ownership contract applies when observing an unattended attempt. [SKILL.md:56](../../../skills/10x-pipeline/SKILL.md)

### Installed guard delivery and effective permissions

New Claude dispatch uses `agent-smith:step` unless an enabled usable restricted mapping supplies a different type. Archive dispatch uses the guarded default. The agent inherits session tools and receives the router's safety rules. The plugin hook invokes `step-guard.mjs` synchronously for Bash with fail-closed handling. [flow.mjs:991](../../../skills/10x-pipeline/scripts/flow.mjs), [flow.mjs:999](../../../skills/10x-pipeline/scripts/flow.mjs), [agents/step.md:1](../../../agents/step.md), [hooks.json:3](../../../hooks/hooks.json)

In the inspected classifier, an event is in scope when `agent_type` equals `agent-smith:step` and a subagent `agent_id` is supplied. Its recognized direct shell forms cover unsafe Git, publication and recursive deletion. Dynamic wrappers, interpreter programs, filesystem tools and APIs depend on semantic rules and host controls. Native hook identity, discovery and denial therefore remain consequential evidence requirements. [step-guard.mjs:93](../../../skills/10x-pipeline/scripts/step-guard.mjs), [step-guard.mjs:109](../../../skills/10x-pipeline/scripts/step-guard.mjs), [step-guard.mjs:121](../../../skills/10x-pipeline/scripts/step-guard.mjs), [REFERENCE.md:45](../../../docs/REFERENCE.md)

The payload tests construct the guarded identity and invoke Node directly. Their path-with-spaces case substitutes the plugin-root placeholder itself. Those fixtures inspect classifier and argument-vector behavior. The reference preserves fresh-host identity and blocking as pending Manual acceptance. [step-guard.test.mjs:14](../../../skills/10x-pipeline/test/step-guard.test.mjs), [step-guard.test.mjs:144](../../../skills/10x-pipeline/test/step-guard.test.mjs), [REFERENCE.md:45](../../../docs/REFERENCE.md)

The documented pipeline floor is Claude Code 2.1.292+, while fail-closed hooks require 2.1.295+. Node 24+, Git and separately installed toolkit skills are prerequisites. Consumers enable the documented child depth with project settings and start a fresh session after committing that setting. Effective trust, managed settings and permissions need observation in the selected acceptance project. Write/Edit behavior inside Git-created `.claude/worktrees/` remains an explicit unanswered live question in the reference. [README.md:30](../../../README.md), [README.md:32](../../../README.md), [README.md:85](../../../README.md), [README.md:132](../../../README.md), [REFERENCE.md:129](../../../docs/REFERENCE.md)

### Terminal publication and acceptance

For terminal `done`, `archive` and ordinary `halt`, the skill calls `open-pr.mjs` before optional report comments. That script validates isolation and remote/base state, checks for commits ahead, attempts to commit leftovers, pushes without force and creates or retains a PR. A non-isolated run skips publication. Requested comments use the separate opt-in procedure. [SKILL.md:153](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:165](../../../skills/10x-pipeline/SKILL.md), [open-pr.mjs:418](../../../skills/10x-pipeline/scripts/open-pr.mjs)

Router completion carries pending/unproved Manual evidence. Publication also runs after ordinary halts, and the script can push existing commits after its leftover commit fails. Acceptance therefore needs the actual terminal verdict, review and verification state, published head and remaining worktree state alongside the PR URL. The skill already requires reporting uncommitted final state when publication could not commit it. [flow.mjs:837](../../../skills/10x-pipeline/scripts/flow.mjs), [open-pr.mjs:445](../../../skills/10x-pipeline/scripts/open-pr.mjs), [SKILL.md:48](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:167](../../../skills/10x-pipeline/SKILL.md)

Publication-dependent PR, CI and comment acceptance belongs in Manual criteria under the current planning rules. Pending archive evidence uses an explicit owner-decision gate. The selected normal run's goal and evidence must retain those distinctions when it finishes. [REFERENCE.md:37](../../../docs/REFERENCE.md), [SKILL.md:100](../../../skills/10x-pipeline/SKILL.md)

## Historical Context

- S-14 recorded successful Claude Code 2.1.311 headless child collection with installed plugin 1.11.2 and session depth two. The probe exercised Agent/Read primitives and retained child identities and a nonce. It left pipeline Agent usage-inclusion semantics unproved. The interactive probe encountered HTTP 429 weekly quota exhaustion and recorded a November 17, 2026, 06:00 Europe/Warsaw reset. That historical message leaves present quota readiness unresolved. [capabilities.md:44](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md)
- S-14 also recorded bounded Codex normal-entry smoke transitions on the 10x and OpenSpec chains. Its acceptance record preserves pending Claude-only 10x interactive/headless cells and carries native qualification to S-20. Its PR publication criterion has later successful evidence. These observations retain their respective provider, candidate and operation scope. [capabilities.md:115](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md), [acceptance.md:9](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md), [acceptance.md:58](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md)
- S-13 records fresh Codex-child discovery of upgraded OpenSpec skills, local contract verification and publication. Its owner-approved archive carries normal-entry qualification to S-20. The current ledger records its release as v1.13.0. The PRD's earlier OpenSpec 1.16.1 CI statement describes its dated baseline, while the current CI installation pin is 2.0.0. [S-13 acceptance:20](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md), [S-13 acceptance:77](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md), [WAVES.md:26](../WAVES.md), [prd.md:44](../../foundation/prd.md), [ci.yml:63](../../../.github/workflows/ci.yml)
- Earlier guard and publication records explicitly retain missing native guard transcripts and missing live unattended pipeline-to-PR proof. Later publication success in S-14/S-13 supplies publication evidence for those changes. The inspected records still leave S-12's complete Claude-only flow pending. [guard unproven.md:1](../../archive/2026-11-13-step-subagent-git-guard/evidence/unproven.md), [publication unproven.md:2](../../archive/2026-11-09-worktree-pr-only/evidence/unproven.md), [delegation acceptance:9](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md)
- `quote-router-in-skill-loops` remains parked. The current skill contains unquoted variable calls despite its shell-quoting instruction. Its change record requires installed substitution evidence before quoting work, and the ledger requires owner-directed resumption before affected path-with-spaces qualification. S-12's selected installation path needs explicit recording. [SKILL.md:21](../../../skills/10x-pipeline/SKILL.md), [SKILL.md:49](../../../skills/10x-pipeline/SKILL.md), [quoting change:34](../quote-router-in-skill-loops/change.md), [WAVES.md:115](../WAVES.md)

## Architecture Insights and Planning Handoff

The responsible layers are already defined. Policy owns provider/model routing, `prepare-run.mjs` owns setup and selected-folder transfer, the router owns run state and step commits, the host loads skills/agents/hooks, and standalone publication scripts own push/PR/comment work. The inspected sources establish an implemented execution path and outstanding live proof. They leave the need for any production-code fix to observed acceptance failures. [state.mjs:65](../../../skills/10x-pipeline/scripts/state.mjs), [prepare-run.mjs:230](../../../skills/10x-pipeline/scripts/prepare-run.mjs), [SKILL.md:181](../../../skills/10x-pipeline/SKILL.md), [REFERENCE.md:47](../../../docs/REFERENCE.md), [WAVES.md:103](../WAVES.md)

The established evidence convention records candidate revision, exact plugin/toolkit/host versions, configuration, launch command/mode, discovery, effective permissions/depth, identities and completion order. It retains attempts, failures, interventions and measured usage scope. S-12 extends that record through implementation review, actual committed work, push and the reviewable PR. Evidence can contribute to later qualification when its revision/configuration remains applicable. [capabilities.md:22](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md), [WAVES.md:103](../WAVES.md), [WAVES.md:124](../WAVES.md)

Existing regression entry points include setup-to-init, step commits, provider/host validation, skill-loop contracts, guard payloads and PR publication using a real bare remote with fake GitHub clients. These are available for observed fixes within their scope. [prepare-run.test.mjs:141](../../../skills/10x-pipeline/test/prepare-run.test.mjs), [stepcommit.test.mjs:74](../../../skills/10x-pipeline/test/stepcommit.test.mjs), [providers.test.mjs:34](../../../skills/10x-pipeline/test/providers.test.mjs), [skill-loop.test.mjs:16](../../../skills/10x-pipeline/test/skill-loop.test.mjs), [step-guard.test.mjs:14](../../../skills/10x-pipeline/test/step-guard.test.mjs), [open-pr.test.mjs:214](../../../skills/10x-pipeline/test/open-pr.test.mjs)

## Open Questions

- Which representative eligible change, trusted project and review remote will supply the first complete attempt? The roadmap assigns that selection to planning. [roadmap.md:101](../../foundation/roadmap.md)
- Which exact plugin/toolkit revision, Claude version, launch mode and committed effective Claude-only policy will be exercised? This checkout currently carries an OpenAI override. [roadmap.md:103](../../foundation/roadmap.md), [agent-smith-policy.json:5](../../foundation/agent-smith-policy.json)
- Do the chosen fresh session and run worktree discover the installed toolkit and guarded agent, emit native hook identity and permit authorized edits/commits/publication without steering? Those effective-host facts need a live observation. [REFERENCE.md:45](../../../docs/REFERENCE.md), [REFERENCE.md:129](../../../docs/REFERENCE.md)
- Are account quota, project trust, model access and GitHub push/PR credentials ready at launch time? Historical quota evidence cannot establish current access. [roadmap.md:101](../../foundation/roadmap.md), [capabilities.md:56](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md)

## Related Research

- [S-14 research](../../archive/2026-11-16-nested-step-delegation/research.md) and [capability evidence](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md) cover child delegation, ownership and native-probe limits.
- [S-13 research](../../archive/2026-11-16-openspec-2-upgrade/research.md) and [acceptance](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md) cover the preceding upgrade and deferred qualification.

## Inspection and Validation Scope

Read-only research covered the current PRD, roadmap, ledger, lessons, effective policy, launch/isolation/result/publication paths, guard/configuration contracts, relevant regression sources and the historical evidence cited above. Parallel workers investigated delivery flow, guard delivery and prior evidence. Research completeness here describes the source investigation and planning handoff. Live delivery acceptance remains pending.

Local command observations during this research returned Node `v24.19.0`, Claude Code `2.1.311` and GitHub CLI `2.104.0`. Commands were `node --version`, `claude --version` and `gh --version`. `git rev-parse HEAD` returned the metadata commit, `git branch --show-current` was empty for detached HEAD, and `git remote -v` identified `git@github.com:xycu/agent-smith.git`. These observations describe this research environment. Authentication, quota, installed Claude plugin activation and the eventual acceptance environment were unverified.

No live model sessions, account probes, external publication or runtime test suite ran during this research. Historical temporary transcript files were referenced through their archived records and their continued availability was unverified. The persisted research artifact was reviewed for bounded assertions and source anchors. Local checks confirmed source-link targets, citation line bounds and document whitespace. No structured facts companion was requested.
