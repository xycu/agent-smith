# Delegated Token Accounting — Plan Brief

> Full plan: [plan.md](plan.md)
> Research: [research.md](research.md)

## What & Why

Report observed token usage for a pipeline step and its children once, through both 10x and OpenSpec. If the host cannot establish complete attribution and coverage, show why tokens are unavailable and continue execution normally.

## Starting Point

The Codex runner already settles descendants but suppresses their totals. Claude completion figures can describe only the final request, so even a multi-request flat step can undercount. Existing router intake stores numeric usage; late attachment refuses any entry that already has a usage object, including duration alone.

## Desired End State

Reports distinguish verified observed totals, unavailable measurements and legacy figures whose scope was not verified. A late verified measurement can fill missing tokens for the exact same invocation without replacing existing counters. Execution, permissions, result intake and archive ownership retain their current guarantees.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Meaning | Observed whole-step-tree usage, not billing completeness | Hosts may omit usage upstream. | Research recovery decision |
| Codex | Version-qualified response records reconciled with final snapshots | Primary exec counters exclude children. | Research; runner |
| Claude | Exact native request/agent evidence or explicit unavailable state | Completion notifications and exporter silence cannot prove coverage. | Research recovery decision |
| Flat Claude steps | Remove final-request-to-whole-step mapping | The same undercount occurs without children. | Research probe |
| Late usage | Structured, invocation-checked token enrichment only | Duration must not prevent a later complete total; existing numbers stay immutable. | Plan; ADR-019 |
| Legacy | Preserve stored figures, label scope, reject mixed-scope savings verdicts | New totals must not be compared silently with final-request counts. | Plan; research |
| Costs | Label subtree prices as routing-rate approximations | Current pricing uses the parent routing model. | Plan; state estimator |
| Delivery | Local deterministic gates; separate live Manual qualification | Missing host telemetry must not block execution or manufacture support evidence. | User; research |

## Scope

**In scope:** Shared evidence validation, safe late enrichment, bounded Codex/Claude readers, both pipeline loops, report/status/compare coverage, compatibility tests and documentation.

**Out of scope:** Executor replacement, automatic telemetry configuration, new dependencies, billing reconciliation, historical backfills, archive ledger edits, routing changes and publication by the step agent.

## Architecture / Approach

Host-owned records flow through read-only collectors into numeric `usage` plus bounded `usageEvidence`. Existing router intake and late-usage commands remain the only state writers. Execution settlement is proved independently before accounting; unusable telemetry yields an omission reason. Reports use the evidence to explain scope without retaining raw transcripts or prompts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared evidence and safe late enrichment | Additive schema and identity-bound missing-token attachment | Misattributing retries or overwriting recorded figures |
| 2. Collect settled Codex step-tree usage | Pinned rollout reader through the existing runner | Inherited history, missing records or unsafe paths |
| 3. Collect Claude usage without trusting final-request counts | Shared native collector and immediate/late/archive wiring | Shared-session boundaries and delayed exports |
| 4. Truthful reports, comparisons and migration evidence | Coverage labels, comparison guards, documentation and qualification checklist | Overstating cost or host support |

**Prerequisites:** Node 24+, existing local fake-host/test helpers and documented pinned record shapes. Positive live qualification additionally needs authorized host access and attributable records; telemetry is optional for execution.
**Estimated effort:** Four implementation phases plus separate host qualification; HIGH complexity because accounting spans execution and persistent reporting.

## Open Risks & Assumptions

- Decisions are evidence-backed unattended assumptions, not human approvals. Initial readers target Codex `0.169.0` and Claude Code `2.1.311`; other schemas fail closed until qualified.
- A native Claude variant without a provable final per-agent request boundary remains unavailable. Isolated-query reference totals do not certify a nested step inside a shared session.
- Legacy records remain unchanged and unverified. New/legacy mixtures display their scopes and receive no savings verdict; legacy-only behavior retains an explicit warning.
- No ledger migration is required. Keep one revision through an active invocation; rollback preserves logs, and older report renderers cannot substantiate new coverage claims.

## Success Criteria (Summary)

- Automated local fixtures prove correct sums, deduplication, omissions, retry identity, safe late enrichment, archive exclusion and unchanged settlement across both chains; the required repository suite passes.
- Reports show missing values as unavailable, partial values as subtotals and subtree pricing as a routing-rate approximation; compatible old data stays readable.
- Manual checks qualify fresh delegated runs and immediate/late/archive output on exact host versions in both launch modes and chains. Unsupported positive paths remain unqualified; no live result is implied by passing fixtures.

## References

- [Research and recovery decision](research.md#recovery-evidence-and-delivery-decision), [change scope](change.md), and the full plan's source anchors.
- `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`, `docs/REFERENCE.md`.
