# Run report: step-guard-bypass-forms

Goal: Make the step guard deny forbidden commands behind common shell shapes: assignment prefixes, subshells and groups, reserved words, $(...) and backticks, xargs and find -exec, glued redirects, abbreviated long options, discarding git verbs it does not know (switch -f/-C/--discard-changes, reset --merge/--keep, branch -f, tag -f, rm -rf, update-ref and similar), git global options with a separate value or -c core.hooksPath, and simple wrappers (env, command, exec, nohup, time, timeout, nice, sudo); stop denying --no-verify used as a search pattern in git log/grep; update the guard scope in docs/REFERENCE.md and README.md.
Rigor: standard (goal plain)
Provider mode: claude
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (d2f5dae) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (39d3dd3) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (c72fcdd) | - |
| 4 | implement | claude | opus | medium | 4 | no | ok (95cbc6e) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (49069ee) | - |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (c4b1d34) | - |
| 7 | impl-review | claude | opus | high | 5 | no | ok (0a44b7d) | - |
| 8 | plan | claude | opus | xhigh | 6 | no | ok (8251a0f) | - |
| 9 | plan-review | claude | sonnet | high | 3 | no | ok (a650087) | - |
| 10 | implement | claude | sonnet | high | 3 | no | ok (97f6db3) | - |
| 11 | impl-review | claude | opus | high | 5 | no | ok (4f073fc) | - |
| 12 | fix | claude | opus | high | 5 | no | ok (5d09472) | - |
| 13 | impl-review | claude | opus | high | 5 | no | ok (59ae88f) | - |

Steps: 13 · Tokens: - (figures for 0 of 13 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 13 · Legacy/unverified scope: 0 · Missing figures: 13
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 4 implement: unsupported-host — The host version is not qualified for accounting.
- Step 5 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 6 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 7 impl-review: unsupported-host — The host version is not qualified for accounting.
- Step 8 plan: missing-identity — The host invocation cannot be attributed exactly.
- Step 9 plan-review: missing-identity — The host invocation cannot be attributed exactly.
- Step 10 implement: missing-identity — The host invocation cannot be attributed exactly.
- Step 11 impl-review: missing-identity — The host invocation cannot be attributed exactly.
- Step 12 fix: missing-identity — The host invocation cannot be attributed exactly.
- Step 13 impl-review: missing-identity — The host invocation cannot be attributed exactly.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: REJECTED, 1 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 9 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 11 impl-review: REJECTED, 1 critical, 0 warnings measured; 0 critical, 0 warnings open
- step 13 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 3

- 1.4 Read the new scanner and `resolve` code once for cases the table-driven tests do not name — judgment (evidence/judgment-review.md)
- 2.4 Compare the deny lists once against the always-true rules and confirm no safe form a step needs is blocked — judgment (evidence/judgment-review.md)
- 3.5 Read the changed paragraphs in `docs/REFERENCE.md` and `README.md` once for accuracy against the tests — judgment (evidence/judgment-review.md)

Not proved: 1

- 3.4 In a live `agent-smith:step` subagent with the plugin installed, `X=1 git push` and `(git push)` are denied and `X=1 git status` runs — not proved: needs a live agent-smith:step subagent running the guard from this branch; the installed plugin copy is not provably this branch, and a live 'git push' probe must not run in an unattended step, so onl

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 2, novelty 1, coupling 1, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always scope abbreviation matching of value-taking options to the options each subcommand really has, so a prefix of one command's value option never hides another command's denied flag.` (step 7)
- `/10x-lesson Always test a new shell-token rule against longer tokens that share its first characters, such as $$ before $', because a mis-split token shifts quote tracking.` (step 11)
- `/10x-lesson Always add a test that reaches each copy of a rule duplicated across parsers or lexers, so deleting either copy fails a test.` (step 13)
