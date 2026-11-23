# Measure the first-attempt tier drop — Plan Brief

[Full plan](plan.md) · [Owner's frame](frame.md)

## What & Why

The owner chose to measure whether starting an eligible 10x implementation step one tier lower saves tokens after retries and redone work. The plugin currently ships `drop: 1` without a qualifying pair. ADR-010 requires `0` when evidence is insufficient.

## Starting Point

The router supports both settings through existing policy and can compare two isolated runs. Claude Code 2.1.323 has recorded verified coverage for the native interactive opt-in launcher. Codex must qualify on the actual host before it supplies figures for this experiment.

## Desired End State

The live comparison and its limitations are recorded in ADR-010. The shipped policy and user-facing docs agree on the default and evidence. The scorer's separate experiment retains its own result in ADR-007.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Measure the feature | Five comparable A/B pairs and a 0/0 A/A control with a designated baseline arm | ADR-010 uses the control to screen out savings within run-to-run spread. The comparator uses the baseline as its denominator. | Frame and ADR-010 |
| Default during measurement | Ship `0` (owner confirmed 2026-11-23) | ADR-010 covers insufficient evidence. | [Frame](frame.md#open-for-the-owner) and ADR-010 |
| Arm setup | Use the same 10x change, starting inputs, host, mode and policy with only drop `0` versus `1` | The pinned general baseline also changes the ladder and scorer. | Plan, following ADR-010 |
| Usage source | Require verified step-tree accounting on one qualified native host and provider mode | Missing or differently scoped attempts would skew the token comparison. | Frame and Plan |
| Decision | Enable `1` only if savings exceed A/A spread, the failure, rigor and halt guards pass, and routed noncompletion against a done baseline has been resolved | The ADR protects completion and retry behavior alongside token savings. | ADR-010 |

## Scope

**In scope** The shipped policy, existing test assumptions, paired protocol, live evidence and the resulting policy and documentation decision.

**Out of scope** Changes to the router algorithm, comparison or accounting interfaces, scorer settings, and historical run ledgers.

## Architecture / Approach

The operator precreates both isolated run worktrees at the same base in a disposable repository without a publication remote. Each arm gets identical starting inputs, including a trackable `change.md`, and an ignored local override. The operator verifies identical readiness before native launch. This preserves the intended drop setting through rollback. The operator reads both arms with `compare --unpinned` and checks host, inputs and effective policy independently, including scorer settings and any drift. The operator checks native invocation records for execution missing from the ledger, preserves terminal outcomes before recovery and records exclusions. ADR-010 holds verified coverage, token splits, excluded pairs, implement failures and terminal outcomes. Failed or redone work contributes to total tokens.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Set the evidence-backed default and document the protocol | Interim drop `0`, documented pending result and local regression coverage for both settings | Some existing tests rely on the shipped `1`. |
| 2. Measure live and record the default decision | Operator-run qualification, paired results and synchronized policy and docs | The chosen host, model quota, or usage coverage may leave a cohort incomplete. |

**Prerequisites** Owner confirmed the interim policy (`0`) on 2026-11-23. Phase 2 requires Wave 5 ordering, Node 24+, a complete capture qualification run on the exact experiment setup and an authorized operator with a paid run limit. Native interactive Claude has prior coverage with the opt-in launcher and records `claude-native` evidence. Native Codex is an earlier option after checking CLI 0.169.0 and verifying actual complete figures.

**Estimated effort** One local change and review, followed by at least 12 full runs plus any host qualification and approved replacements.

## Open Risks & Assumptions

- A configured drop can be absorbed by other routing effects. Record realized routing and keep otherwise comparable pairs in the sample.
- Keep one host/provider mode per decision cohort. The result applies to that configuration.
- If the cohort remains insufficient, the evidence stays inconclusive and the default stays `0`.

## Success Criteria (Summary)

- Local routing, comparator and collector tests pass, and the policy and docs agree on the interim default.
- An authorized operator records verified live runs and exclusions, applies ADR-010 and reconciles the final policy and docs with passing local closeout tests.

## References

- [ADR-010 decision rule](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#decision-rule) · [ADR-007 scorer experiment](../../../docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md#ab-decision-rule)
- [Comparison and accounting](../../../docs/REFERENCE.md#baseline-comparison) · [Claude acceptance record](../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md#resolution-2026-11-23)
