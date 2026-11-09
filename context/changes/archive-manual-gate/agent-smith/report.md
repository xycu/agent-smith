# Run report: archive-manual-gate

Goal: Archive only when no Manual rows are pending. When the router returns the archive action with Manual rows pending, the orchestrator of both chains (skills/10x-pipeline/SKILL.md, skills/openspec-pipeline/SKILL.md) asks the user a yes/no question with AskUserQuestion between subagent calls, and launches the archive subagent only on yes; on no the run ends like done, unarchived. Subagents cannot ask; the orchestrator can. New ADR, if one is needed: ADR-014.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close archive-manual-gate"
Manual checks pending: 3
- 1.5 In a live interactive session, a `--archive` run that ends with a Manual row pending shows the question with the row listed; answering yes archives (`verify-archive` prints `archived: true`), and answering no runs no archive subagent and leaves the change folder in `context/changes/` with the pre-archive commit
- 1.6 In a headless `claude -p` run with a pending Manual row the orchestrator does not archive and prints the skipped line
- 1.7 A run with no pending Manual row archives without a question
Manual checks not proved: 3
- 1.5 In a live interactive session, a `--archive` run that ends with a Manual row pending shows the question with the row listed; answering yes archives (`verify-archive` prints `archived: true`), and answering no runs no archive subagent and leaves the change folder in `context/changes/` with the pre-archive commit — not proved: needs a live interactive pipeline run: AskUserQuestion is a host tool and the yes path really archives; archive-gate.test.mjs pins only the skill text, not the behavior; an unattended subagent cannot
- 1.6 In a headless `claude -p` run with a pending Manual row the orchestrator does not archive and prints the skipped line — not proved: needs a live headless 'claude -p' pipeline run; not runnable from here (would start a nested pipeline and a real archive)
- 1.7 A run with no pending Manual row archives without a question — not proved: needs a live '--archive' pipeline run with no pending Manual row; tests cover only the router data ('manualPending: []') and the skill text, not the orchestrator behavior

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (ef8e7f4) | 127009 |
| 2 | plan | sonnet | high | 3 | no | ok (6f2a353) | - |
| 3 | plan-review | sonnet | high | 3 | no | ok (534523b) | - |
| 4 | implement | sonnet | medium | 2 | no | ok (f9fd853) | - |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (c8156a9) | - |
| 6 | manual-verify | sonnet | high | 3 | no | ok (e289456) | - |
| 7 | impl-review | sonnet | high | 3 | no | ok (3543487) | - |

Steps: 7 · Tokens: 127009 (figures for 1 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 2

- 2.5 ADR-014 reads as a decision the owner can confirm or change, and its scenarios match the skill text — judgment (evidence/judgment-adr014-reads-as-decision.md)
- 2.6 `docs/REFERENCE.md` and the two SKILL.md files agree on the labels, the 10-row cap and the fail-closed rule — judgment (evidence/judgment-docs-skills-agree.md)

Not proved: 3

- 1.5 In a live interactive session, a `--archive` run that ends with a Manual row pending shows the question with the row listed; answering yes archives (`verify-archive` prints `archived: true`), and answering no runs no archive subagent and leaves the change folder in `context/changes/` with the pre-archive commit — not proved: needs a live interactive pipeline run: AskUserQuestion is a host tool and the yes path really archives; archive-gate.test.mjs pins only the skill text, not the behavior; an unattended subagent cannot
- 1.6 In a headless `claude -p` run with a pending Manual row the orchestrator does not archive and prints the skipped line — not proved: needs a live headless 'claude -p' pipeline run; not runnable from here (would start a nested pipeline and a real archive)
- 1.7 A run with no pending Manual row archives without a question — not proved: needs a live '--archive' pipeline run with no pending Manual row; tests cover only the router data ('manualPending: []') and the skill text, not the orchestrator behavior

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
