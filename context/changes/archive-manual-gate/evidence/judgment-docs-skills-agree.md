# Row 2.6 judgment: REFERENCE.md and both SKILL.md agree on labels, 10-row cap, fail-closed

Quoted text:
- REFERENCE.md line 90: "header `Archive`; options `No, keep it unarchived`, recommended, and `Yes, archive anyway`) that lists at most 10 pending rows ... Only a yes continues. Any other answer, an error or no question tool (headless `claude -p`) fails closed: no archive subagent, no `verify-archive`, the line `Archive: skipped, <n> Manual check(s) pending or unproved.`"
- skills/10x-pipeline/SKILL.md line 65 and skills/openspec-pipeline/SKILL.md line 73 both: labels `No, keep it unarchived` first and `Yes, archive anyway` second; "at most 10, then "and N more""; "Fail closed: any other answer, an error from the question tool, or no question tool ... is a no"; same skipped line.
- REFERENCE.md line 383 (OpenSpec) says gate mirrored and dormant; openspec SKILL.md line 73 ends "those three lists are always empty, so the gate is dormant."
- Automated cross-check: test-archive-gate.txt (archive-gate.test.mjs pins labels, fail-closed text, placement in both skills) passes.
Verdict: all three points identical in all three files.
