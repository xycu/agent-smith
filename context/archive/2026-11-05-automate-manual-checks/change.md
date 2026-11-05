---
change_id: automate-manual-checks
title: Verify every Manual row automatically in a dedicated subagent, Chrome included
status: archived
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05T01:47:57Z
---

## Notes

Owner request (2026-11-05): "Develop a feature that will allow to handle all manual testing automatically. What is the point of having an automation agent if we are keeping manual tests. The manual tests should be handled via a separate subagent with a clear context starting with Sonnet medium. People aren't particularly engaged when testing. Use every tool at your disposal (especially Claude in Chrome). If something is covered by automated testing (i.e. unit testing) we treat it as manually tested."

Context: the archive holds about 100 unticked rows across 13 changes, nearly all Manual rows. The pipeline ends `done` with a `manualPending` checklist that nobody works through.

What `manual-verify` does today (`skills/10x-pipeline/scripts/route.mjs:1828-1930`, `prompts/manual-verify.md`, `policy.json` `manualVerify`, `steps.manual-verify`):

- `manualEligible` accepts only a row that names a backticked command whose first word is in `manualVerify.commandWords` and that has no word from `manualVerify.humanWords`. With `--chrome`, a row with a `browserWords` word is accepted too. Every other row stays pending.
- `manualVerifyNext` runs it only at `manualVerify.minRigor` (`standard`) and above, only when the extra-step pool can pay for it (`extraSteps.cost.manual-verify: 1`; the `lean` pool is 0), once before the first impl-review, `maxRuns: 1`, `maxAttempts: 2`.
- `steps.manual-verify` starts at `baseTier: 3` (`sonnet/high`).
- Chrome is opt-in: `init --chrome` picks the `manual-verify-chrome` template.
- `verifyManual` accepts a tick only with a non-empty evidence file under `context/changes/<id>/evidence/`, newer than the step start, and no change to Automated rows, row titles or SHA suffixes.

Owner decisions (2026-11-05):

1. Every pending Manual row is in scope, including rows that ask a person to read, judge or confirm, and rows that ask the owner for a decision ("Owner reads ADR-010 and confirms ..."). The subagent judges them all and ticks a row with its written reasoning saved as the evidence.
2. A row the subagent cannot prove (a live pipeline run is needed, a tool is missing, Chrome is not connected, the check fails) gets one retry one tier up (`sonnet/high`). After that the run goes on to `done` and lists each remaining row with the reason it could not be proved. No halt.
3. The step runs in its own subagent with a clear context: the prompt names the plan, the change folder and the rules, and carries nothing from earlier steps beyond the router's list of rejected rows.
4. The first attempt runs on `sonnet/medium` (ladder index 2).
5. A row whose claim is covered by an automated test (a unit, integration or E2E test that runs green) counts as verified. The evidence is the test run output plus the test file and test name that cover the row.
6. The subagent uses every tool it has: Bash, Read/Grep, scratch projects, the test runner, git (read-only), and the Claude in Chrome tools for browser rows.
7. When no existing command or test proves a row, the subagent writes a throw-away test script for it (owner, 2026-11-05: "for manual verification steps it is a good practice to create a throw-away tests scripts if needed"). The script lives in a scratch directory outside the repository tree, or under `context/changes/<id>/evidence/`, never in the source or test tree. Its source and its output are saved as evidence, so the check can be rerun.

Starting points for the plan (proposals, not decisions):

1. Drop the `commandWords`/`humanWords` eligibility gate: every pending Manual row is eligible. Keep `browserWords` only if the plan needs it to pick a prompt branch.
2. Run `manual-verify` at every rigor level, `lean` included, outside the extra-step pool (cost 0 or a separate counter). Re-size `rigor.budgetDelta` so the longest legal path still fits at each level, and keep the budget tests green.
3. `steps.manual-verify.baseTier: 2`, retry one tier up, `maxAttempts: 2`.
4. Chrome on by default: the Chrome rules are part of the default template; `init --chrome false` turns them off. Decide in the plan whether `meta.chrome` keeps its meaning or flips its default, and what a resume of an older run does.
5. Evidence kinds, each a file under `evidence/`: command output, test run output with the covering test named, screenshot or GIF, and a written judgment that quotes the text or behaviour checked and gives the reasoning (for reading, wording and owner rows). The router check stays file-based: it never reads the content.
6. A way for the subagent to report why each unproved row failed (for example `evidence/unproven.md`, or a `signals` key), surfaced in the final message, `meta.outcome` and `report.md` next to `manualUnproven`.
7. Timing: today the step runs once before the first impl-review. Decide whether it also runs after the last `fix`, so the rows are proved against the final code.
8. The report lists ticked rows by evidence kind, so the owner can see which rows were judged rather than run.

Safety constraints for the subagent (now that any row is in scope, not only allow-listed commands):

- Never push, deploy, publish, post to an external service, or write outside the run root and the scratch directory.
- Never delete a branch, worktree or ref, and never run `git reset`, `git commit` or `git checkout` in the run root: the router owns git writes (ADR-010).
- In Chrome, open only local pages or the pages a row names; never sign in, submit a form to an external service or enter credentials.
- Never run a command that does not end by itself or waits for input; start a server only in the background and stop it before the step ends.

Constraints:

- Routing stays in `route.mjs` and `policy.json`; `SKILL.md` names no model, effort or tier beyond what it documents (AGENTS.md hard rules).
- Prompt rules keep the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (ADR-004); `rules.test.mjs` checks it.
- Never edit `skills/10x-pipeline/test/loops-existing.test.mjs`.
- Update `README.md` ("Phase executors", "Budget", "Limits"), `SKILL.md` and `prompts/README.md`; record the decision in a new ADR (ADR-012).
- No npm dependencies; Node 24.
- The policy and prompts change, so runs in flight record `provenance.drift`; that is expected.
- Behaviour change for the release PR: `lean` runs gain a step and Chrome is on by default. `feat` or `feat!` is the owner's call at commit time.

Out of scope: ticking the unticked rows in `context/archive/` (read-only by convention).
