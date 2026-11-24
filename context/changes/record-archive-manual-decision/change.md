---
change_id: record-archive-manual-decision
title: Record explicit approval to archive with unresolved Manual checks
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-24
archived_at: null
---

Document a durable record for an affirmative exception at the existing 10x Manual archive gate. The decision travels with the change so a later reader can identify the open checks and who owns follow-up. S-19 (`truthful-owner-decision-halts`) owns the wider decision flow. [Archive decision](../docs-status-truth-up/change.md#archive-decision-2026-11-19) · [S-19](../../foundation/roadmap.md#s-19-truthful-verification-and-owner-decision-halts)

## Acceptance

- With all three Manual lists empty, the normal archive path proceeds without an exception record.
- When the owner explicitly chooses `Yes, archive anyway`, record that approval and each distinct unresolved row ID across `manualPending`, `manualUnproven` and `uncommittedTicks` before moving the folder. Record the reason and follow-up destination for deferred proof. Preserve each row’s checkbox, evidence and commit references.
- When the owner refuses or an answer is unavailable, keep the change unarchived and report the unresolved checks. Only an affirmative answer creates an approval record.

The S-13 and S-14 closeouts show how to retain open rows and name their destination. This seed concerns documentation for future 10x approvals. Runtime gate changes and historical backfill are outside its scope. [S-13 decision](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) · [S-14 closeout](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)
