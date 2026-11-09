# Row 2.5 judgment: ADR-014 is a confirmable decision and matches the skill text

Checked docs/ADR/ADR-014-archive-manual-gate.md against skills/10x-pipeline/SKILL.md line 65.

- Status line: "Proposed (unattended reading, owner confirmation pending)" and Deciders names the owner: decision is open to confirm.
- Consequences: "Readings to confirm: A1 fail closed; A2 a rerun asks again; A3 the OpenSpec gate is mirrored and dormant; A4 stale report line is corrected in the message only; A5 no undo of the commit." Each is listed so the owner can change one.
- Alternatives declined are named with reasons (router halt only, router question, subagent question, policy key).
- Scenarios in GIVEN/WHEN/THEN form (ADR-004).

Scenario vs SKILL.md match:
- ADR: header `Archive`, options `No, keep it unarchived` (first, description starts `Recommended.`) and `Yes, archive anyway`. SKILL: "header `Archive`, two options ... `No, keep it unarchived` first and `Yes, archive anyway` second. The `No, keep it unarchived` description starts with `Recommended.`" Same.
- ADR: at most 10 rows; SKILL: "at most 10, then "and N more"". Same.
- ADR: three lists empty -> no question; SKILL: "when `summary.manualPending`, `summary.manualUnproven` and `summary.uncommittedTicks` are all empty, go on to step 2". Same.
- ADR: fail closed, no subagent, no verify-archive, line `Archive: skipped, <n> Manual check(s) pending or unproved.`; SKILL: identical string and "launch no subagent and run no `verify-archive`". Same.
- ADR A2 rerun asks again; SKILL: "running `/agent-smith:10x-pipeline <change-id>` again asks the question again". Same.
- ADR A4 stale report line; SKILL: "The report line `Archive: requested` is then stale; say so." Same.
Verdict: supported.
