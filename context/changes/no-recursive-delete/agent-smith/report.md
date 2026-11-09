# Run report: no-recursive-delete

Goal: Never use rm -rf or any recursive force delete in skills, prompts, router code, tests or docs that agents follow: list the files, check the list, delete them one by one, then rmdir the empty directories. Harnesses block rm -rf. New ADR, if one is needed: ADR-016.
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/test/compare.test.mjs, skills/10x-pipeline/test/manualverify.test.mjs +2)
Outcome: done - impl review NEEDS ATTENTION
Archive: requested - runs after this report was written; see the commit "chore(archive): close no-recursive-delete"

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (d153dad) | 117157 |
| 2 | plan | sonnet | high | 3 | no | ok (aabf5cb) | 197647 |
| 3 | plan-review | sonnet | high | 3 | no | ok (6fe051b) | - |
| 4 | implement | opus | medium | 4 | no | ok (c19c925) | 211402 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (feb671f) | - |
| 6 | manual-verify | sonnet | high | 3 | no | ok (2fea9ae) | 120720 |
| 7 | impl-review | opus | high | 5 | no | ok (a7e941d) | 226565 |

Steps: 7 · Tokens: 873491 (figures for 5 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: NEEDS ATTENTION, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 6

- 1.3 Read `remove-tree.mjs` once and confirm the order is list, check, unlink files, rmdir deepest first — judgment (evidence/judgment-remove-tree-order.txt)
- 3.5 Read the two suffix lines and the `manual-verify.md` line once and confirm a subagent can follow them without asking — judgment (evidence/judgment-suffix-and-manual-verify-lines.txt)
- 4.6 Read ADR-016 once and confirm the assumptions are marked for the owner and no claim is stronger than the evidence — judgment (evidence/judgment-adr016-assumptions.txt)
- 4.7 Confirm `AGENTS.md` and `REFERENCE.md` say the same thing about the ban and the helper — judgment (evidence/judgment-agents-reference-agree.txt)
- 2.4 Run the suite once and confirm `os.tmpdir()` holds no leftover `as-*` directory from it (cleanup still works) — command (evidence/command-suite-fresh-tmpdir.txt)
- 3.6 Run `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` and `status demo` in a scratch change folder and confirm the output is valid JSON and a returned prompt ends with the new rules before the `RESULT` instructions — command (evidence/command-init-status-scratch.txt)

Not proved: 0

## Complexity score

Scores: cognitive 4, execution 6 (ambiguity 1, novelty 1, coupling 2, discovery 2, volume 3, verification 1)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Never let a cleanup helper change the permissions or contents of anything outside the path it was asked to delete.` (step 7)
