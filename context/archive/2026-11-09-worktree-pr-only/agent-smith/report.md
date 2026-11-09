# Run report: worktree-pr-only

Goal: All work of a run happens in its worktree and always ends pushed for human review on a pull request, with no exceptions: when a run ends (done, archive or halt with commits), push the run branch agent-smith/<change-id> and open or update its pull request; never merge it. AGENTS.md now allows recoverable git and GitHub operations (commits, pushes, pull requests) and forbids only irreversible ones. New ADR: ADR-017.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close worktree-pr-only"
Manual checks pending: 3
- 1.5 In a throwaway GitHub repository, run the script from a linked worktree on `agent-smith/<id>`: the branch is pushed, a pull request is open and not merged, and a second run changes nothing
- 2.4 An unattended run of `/agent-smith:10x-pipeline` on a scratch change in a throwaway GitHub repository ends with the run branch pushed and a pull request open, not merged, for a `done` end and for a `halt` end
- 3.5 Read ADR-017 and confirm it states the no-push rule of the router is unchanged, names the script as the only pusher, and lists the non-isolated opt-out as the open owner decision
Manual checks not proved: 3
- 1.5 In a throwaway GitHub repository, run the script from a linked worktree on `agent-smith/<id>`: the branch is pushed, a pull request is open and not merged, and a second run changes nothing — not proved: needs a live push and pull request in a throwaway GitHub repository; pushing and posting to an external service is not allowed in this step
- 2.4 An unattended run of `/agent-smith:10x-pipeline` on a scratch change in a throwaway GitHub repository ends with the run branch pushed and a pull request open, not merged, for a `done` end and for a `halt` end — not proved: needs a live unattended pipeline run that pushes and opens a pull request on GitHub; not allowed in this step
- 3.5 Read ADR-017 and confirm it states the no-push rule of the router is unchanged, names the script as the only pusher, and lists the non-isolated opt-out as the open owner decision — not proved: ADR-017 states the router no-push rule is unchanged and names open-pr.mjs as the only pusher, but it records the non-isolated opt-out as decided by the owner ("It is not an open question", review find

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (8b63b5e) | 125231 |
| 2 | plan | sonnet | high | 3 | no | ok (c0fab5a) | - |
| 3 | plan-review | sonnet | high | 3 | no | ok (c14a36e) | - |
| 4 | implement | opus | medium | 4 | no | ok (092c6a6) | - |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (05fd51f) | - |
| 6 | manual-verify | sonnet | high | 3 | no | ok (d4d5421) | - |
| 7 | impl-review | opus | high | 5 | no | ok (d8ba920) | - |

Steps: 7 · Tokens: 125231 (figures for 1 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 1 warnings open
- step 7 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 1

- 2.3 Read both skills and confirm each of `done`, `archive` (including `archived: false`) and `halt` runs the pull request step before the PR comment step and before any STOP — judgment (evidence/judgment-2-3-skills-pr-step-order.md)

Not proved: 3

- 1.5 In a throwaway GitHub repository, run the script from a linked worktree on `agent-smith/<id>`: the branch is pushed, a pull request is open and not merged, and a second run changes nothing — not proved: needs a live push and pull request in a throwaway GitHub repository; pushing and posting to an external service is not allowed in this step
- 2.4 An unattended run of `/agent-smith:10x-pipeline` on a scratch change in a throwaway GitHub repository ends with the run branch pushed and a pull request open, not merged, for a `done` end and for a `halt` end — not proved: needs a live unattended pipeline run that pushes and opens a pull request on GitHub; not allowed in this step
- 3.5 Read ADR-017 and confirm it states the no-push rule of the router is unchanged, names the script as the only pusher, and lists the non-isolated opt-out as the open owner decision — not proved: ADR-017 states the router no-push rule is unchanged and names open-pr.mjs as the only pusher, but it records the non-isolated opt-out as decided by the owner ("It is not an open question", review find

## Complexity score

Scores: cognitive 5, execution 6 (ambiguity 2, novelty 1, coupling 2, discovery 2, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
