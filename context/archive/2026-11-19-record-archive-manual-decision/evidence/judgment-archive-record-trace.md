# Judgment: row 1.4, trace of ADR-014 Amendment 1

Checked text: docs/ADR/ADR-014-archive-manual-gate.md, "Amendment 1: archive exception record" and its worked example.

Approval: step 1 says "the owner or authorized closeout operator writes `context/changes/<change-id>/evidence/archive-manual-decision.md` ... record the exact approval, date, owner identity or role". The example header: "records `Yes, archive anyway`, given by the project owner on 2026-11-24".

Deferred checks: the example table lists IDs 1.1, 1.2 and 1.3. Each row has a category (`uncommittedTicks`, `manualPending`, `manualUnproven`), a concrete reason and a follow-up destination. Example 1.3 reads "judgment evidence, which the verifier rejected as insufficient", so it is not treated as proved. The 2.11 overlap example keeps both categories and reasons in one entry.

Follow-up owners: each row names an owner and a change ID ("Release maintainer, `verify-release-commit` change", "QA owner, `staging-smoke-test` change"). Step 2 requires "a traceable follow-up destination with an owner".

Empty-list path: table row 1: "All three lists are empty or omitted | Proceed normally without an exception note."

Refusal path: table row 3: "The owner refuses, the answer is missing, or the question tool fails or is unavailable | Keep the change unarchived, report the unresolved checks and create no approval record for the attempt." Step 2 also says "Preserve the original checkbox, title, evidence and SHA suffixes", so no check is ticked as proved by the deferral. Table row 2 says "Approval authorizes deferral of proof."

docs/REFERENCE.md links the section and says S-19 owns wiring it into the orchestrator.

Reasoning: a reader can trace approval, each deferred row, its reason and owner. The empty-list and refusal paths are explicit. Nothing treats an unresolved check as proved. Row 1.4 holds.
