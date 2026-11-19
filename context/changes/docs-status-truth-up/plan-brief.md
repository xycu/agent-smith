# Documentation status and evidence links — plan brief

[Full implementation plan](plan.md)

## What & Why

Six links broke when evidence moved into the archive. Several docs also describe implemented rules as proposals or leave readers to infer which live checks succeeded. The change repairs the links and gives each current claim a source.

## Starting Point

The rendered README and docs have six broken links to four evidence files. The roadmap calls S-12 ready even though the wave ledger records a delivery attempt with three unproved Manual rows. The archive reader found 58 open rows across 35 archived plans. All 58 are Manual.

## Desired End State

A reader can follow every local file link, find the effective rule at the top of heavily amended ADRs, and see who owns each unproved check. The two roadmap slices describe their actual acceptance state.

## Key Decisions Made

| Decision | Choice | Basis |
| --- | --- | --- |
| Link coverage | Run a local rendered-link check with Pandoc and Python. Keep the change docs-only. | The check reproduces all six defects and skips the literal link example. |
| ADR status | State the shipped portion, later supersessions and outstanding evidence separately. | ADR-022 gives a precedent for documenting unattended implementation. |
| Amendment count | Include distinct inline and unnumbered amendments. | ADR-013 carries two dated changes outside its numbered amendment heading. |
| S-12 and S-20 | Mark S-12 blocked on proof or owner deferral. Retain S-20 as proposed. | WAVES v3 records PR #214 and the final 18-run acceptance contract. |
| Archive exceptions | Retain the Automated routing gate and read-only move verification. Track durable affirmative Manual decisions in a new change named `record-archive-manual-decision`. | The existing gate asks for consent. S-13 and S-14 show how to preserve that decision alongside open rows. |

## Scope

Update evidence links, ADR status and index entries, the four README qualifications, the two roadmap slices and the archive decision. WAVES v3, archived plans, runtime behavior and release metadata are outside the edit scope.

## Architecture / Approach

Use archived evidence for observed behavior and the implementation and tests for current contracts. For incomplete host checks, identify the exact scope and its tracking ID. The archive follow-up consists of a change seed only.

## Phases at a Glance

| Phase | Deliverable | Main review point |
| --- | --- | --- |
| 1. Repair links | Correct six destinations in the reference and ADRs 018 and 019. | Resolve each from its source document. |
| 2. Reconcile decisions | Correct status and evidence claims, update the ADR index, add current-rule summaries to ADRs 003, 008, 009, 010, 013, 017, 018 and 024. | Preserve historical rules, observations and test-backed wording. |
| 3. Resolve outstanding work | Update README and roadmap, record archive decisions, open the separate follow-up, then run the full suite. | S-12 has zero of three live rows proved. S-20 still owns qualification across six configurations. |

**Prerequisites.** Local checkout, Node 24+, Python 3 and the installed Pandoc GFM reader.

**Estimated effort.** Three documentation commits plus the full-suite run and evidence review.

## Open Risks & Assumptions

- The S-12 owner decision is still open in the planning snapshot. Recheck the local evidence before editing. A published artifact alone does not prove the missing live rows.
- The Manual deferral examples justify recording future affirmative exceptions. Historical checkboxes stay as recorded.
- Local tests establish documented contracts. The broader Claude, Codex and accounting qualification remains tracked in its own changes.

## Success Criteria (Summary)

- The local link scan finds zero missing files, and each ADR summary and README disposition cites the appropriate evidence or open work.
- Both copies of each roadmap status agree. A dated archive decision names its separate follow-up.
- The full Node suite passes locally and the implementation records its skip counts and reasons. The documentation review checks historical and live-evidence boundaries.
