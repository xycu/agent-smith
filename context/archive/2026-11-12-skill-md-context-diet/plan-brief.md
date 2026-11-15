# Orchestrator Context Diet — Plan Brief

> [Full plan](plan.md)

## What & Why

Reduce both pipeline skills' loaded context while preserving every operational contract. Keep executable instructions local to each skill and put routing explanations in the existing reference.

## Starting Point

The current 10x skill is 47,969 bytes and OpenSpec is 36,450 bytes. The ticket's earlier 10x baseline predates recent setup, provider and identity safeguards. Tuning alone uses 13,866 bytes in 10x. Late-usage and terminal-publication text repeats across three branches in each skill.

## Desired End State

The 10x skill is at most 26,000 UTF-8 bytes and OpenSpec is smaller than its current baseline. Both retain identical, byte-unchanged Anti-stall sections and complete setup, dispatch, result and terminal behavior. Existing tests cover the relocated procedures and every call site.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Routing ownership | Existing reference groups and policies | The orchestrator forwards router decisions | Ticket, AGENTS.md |
| Size target | 26,000 bytes for 10x | Gives the approximate KB goal a reproducible ceiling | Plan assumption |
| Late usage | One section per skill with three explicit call sites | Preserves timing and launch attribution with one owner | Ticket, content tests |
| Publication | Existing Pull request procedure invokes the opt-in PR-comment procedure | Consolidates strict intent and ordering at an established seam | Plan assumption, current skills |
| Anti-stall | Preserve full baseline bytes and add a fixed digest guard | Cross-chain equality alone permits simultaneous wording drift | Ticket, plan assumption |
| Planning method | Medium complexity, two phases, evidence-backed unattended decisions | Known owners and tests settle the material choices | User instruction, complexity.json |

## Scope

Implementation covers both skills, AGENTS.md ownership guidance, relevant reference groups, affected existing content tests and their indexes. Runtime scripts, policies, prompts, release files, Wave 7 sibling implementations, WAVES.md, archives and router-owned run state retain their current ownership and bytes.

## Architecture / Approach

First relocate routing details and establish invariants. Then consolidate late usage and publication, shorten repetitive explanations, and split mixed paragraphs while keeping numbered lifecycle steps. Every terminal path still reaches its publication procedure at the correct point. Tests check both complete shared instructions and each explicit branch reference.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Establish Routing Documentation Ownership | Reference merge, short Tuning, AGENTS.md guidance, literal-value and Anti-stall guards | A routing exception disappears during deduplication |
| 2. Consolidate Terminal Procedures and Preserve Contract Coverage | Smaller skills, shared local procedures, adapted tests, negative checks and full-suite proof | Reordering telemetry, archive handling or authorized publication |

Prerequisites include Node 24+, the current Wave 7 branch and the full repository test environment. CI also supplies its pinned OpenSpec CLI. Estimated effort is two focused implementation phases with contract review and regression runs.

## Open Risks & Assumptions

- The current 10x file requires a 21,969-byte reduction, approximately 45.8%. Moving Tuning and late usage alone leaves more compression work.
- Exact invocation identity, uncertain runner handling, successful-init cleanup and archive refusal handling remain required during shortening.
- The Anti-stall baseline digest is `9d262e57b558c87ce54b3a258c9454b3eec2eb35b44cc3539a0d1047077b1d44` for both 3,333-byte sections.
- Local test results must identify environment-dependent skips. Existing live-provider acceptance limits remain documented separately.
- Scratch fixtures inside the worktree need the Git discovery boundary documented in the plan so repository-free fixtures retain their expected behavior.

## Success Criteria (Summary)

- Meet the size target, preserve complete Anti-stall bytes and retain every operational obligation.
- Preserve text-contract coverage through shared-owner assertions, branch-order assertions and deliberately broken fixtures.
- Pass the full required suite and version check with changes confined to the owned files.

## References

Planning checks passed for the Progress structure, links, version guard and 71 focused content tests. The corrected full-suite baseline was stopped after 407 passing tests with zero failures. Full-suite acceptance remains in Phase 2.

- [Change definition](change.md) and [Wave 7 ownership](../WAVES.md)
- [10x skill](../../../skills/10x-pipeline/SKILL.md) and [OpenSpec skill](../../../skills/openspec-pipeline/SKILL.md)
- [Routing reference](../../../docs/REFERENCE.md) and [repository guidance](../../../AGENTS.md)
