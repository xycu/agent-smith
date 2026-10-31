<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PR Comment Report Implementation Plan

- **Plan**: context/changes/pr-comment-report/plan.md
- **Scope**: Full plan (all 4 phases; the automated rows of each phase were verified, the Manual rows are still pending by design)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 7 observations

Reviewed range: `f5c4517..41d5bc4` (5 implementation commits) on top of the plan commits, against merge-base `54f1729` with `main`.

## Verification evidence

| Check | Result |
|-------|--------|
| `node --test skills/10x-pipeline/test/*.test.mjs` | 204 tests, 202 pass, 0 fail, 2 skipped (the two `live:` tests) |
| `node --test skills/10x-pipeline/test/pr-comment.test.mjs` | 45 pass (incl. the real-`gh` "not authenticated" test, which ran because `gh` is installed) |
| `route.mjs` and `policy.json` untouched | `git diff --stat 54f1729 -- route.mjs policy.json` empty; `git log main..HEAD -- ...` empty |
| Imports only `node:` built-ins, no dynamic import or `require` | pass |
| No Node 19+ API (`toSorted`, `groupBy`, `import.meta.dirname`, `mock.timers`, `partialDeepStrictEqual`, `.intersection(`, also `findLast`, `.at(`, `structuredClone`, `replaceAll`) in script and test | none found; the regexes use lookahead and lookbehind only (Node 18 ok), no `v` flag |
| SKILL.md added lines name no model, effort or tier | pass |
| `node pr-comment.mjs` with no args | exit 2, usage on stderr, no stdout |
| ADR-003 `### PR comment`: seven GIVEN/WHEN/THEN lines, one bold keyword each | pass (`rules.test.mjs` and the docs test) |
| Manual rows | 10 open in Progress: 1.9, 2.9, 3.8, 4.4, 4.5, 4.6, 4.9, 4.11, 4.12, 4.16 (see F7) |

Adversarial probes run in scratch dirs only (`/tmp/claude-501/x.k7in5r`, nothing in the repository):

- A fake `gh` fed a report with `@alice`, `@@bob`, `@org/team`, an emoji and a copy of the marker: the posted body started with the marker, every mention carried the zero-width space, and the argv was exactly `pr view`, `api user`, `api --paginate ... --jq`, `api --method POST ... -F body=@<file>`. The body never appeared in argv.
- A fake `gh` that returns the comment list pretty-printed (as a forced-TTY `gh` does): the script posted a second comment (F1).
- Mutants of a scratch copy of the script: dropping `--paginate`, and dropping `--jq COMMENT_JQ`, both left all 45 tests green (F2).

What held up under attack: the change id is limited to `^[a-z0-9][a-z0-9-]{0,99}$` and cannot reach `gh` as a flag or break the marker; `spawnSync` runs with an argv array and no shell; owner, repo and number come from the PR url and are used only inside a `repos/...` path; `--report` is checked by basename and parent-directory name and the first line must be the router's own header, so a symlinked `report.md` cannot leak another file; the body travels in a mkdtemp directory removed in `finally`; the script writes nothing under the project root (snapshot test); no token or env value is printed (the only stderr text echoed is the first line of `gh` stderr, 200 characters); the surrogate back-off at the 60000 cap is correct (`charCodeAt(end-1)` is a high surrogate, so the cut moves back one unit) and the appended line keeps the body under 65536; a stranger's marker comment is never edited when `/user` works, and a CRLF head still matches.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — An unparseable comment list is read as "no comments", so a duplicate comment is posted

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/pr-comment.mjs:163-170 (`listComments`)
- **Detail**: `listComments` skips every line that is not a JSON object with a numeric `id`, then returns `{ comments: [] }`. When `gh` exits 0 but the output has a different shape, the script concludes that no marker comment exists and POSTs. Reproduced with a fake `gh` that prints the comment objects pretty-printed (multi-line JSON, which is what `gh --jq` produces when `GH_FORCE_TTY` is set or the output format changes): the run made a POST although the marker comment by the viewer was in the output. Plan A12 and the contract promise that "a transient error cannot create a duplicate" and that the lookup failing is a skip; this path is not covered by that promise, and the next run does the same, so every run adds a comment. The existing test "garbage lines ... are ignored" always includes one valid line, so it cannot see this.
- **Fix**: Fail closed. When stdout has any non-blank line and no line parses to a valid entry, return `{ skip: "comment lookup failed: unexpected gh output" }`. Optionally also set `NO_COLOR=1` and drop `GH_FORCE_TTY` in the `runGh` env. Add a test with an all-garbage and a pretty-printed list that expects no POST.
- **Decision**: Fix (b464f60): an output with non-blank lines and no valid entry is the skip `comment lookup failed: unexpected gh output`; empty or blank output is still an empty list. Tests with pretty-printed and garbage lists post nothing. The `gh` env is not changed.

### F2 — No test pins the lookup argv: removing `--paginate` or `--jq COMMENT_JQ` leaves the suite green

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/pr-comment.test.mjs (argv audit, line 485; `COMMENT_JQ` test, line 552); skills/10x-pipeline/scripts/pr-comment.mjs:160
- **Detail**: The fake `gh` ignores `--paginate` and `--jq`, and no assertion checks that the comment-lookup call carries them. In a scratch copy, deleting `"--paginate"` from the lookup argv and, separately, deleting `"--jq", COMMENT_JQ` both left 45 of 45 pr-comment tests passing. The first means a PR with more than 30 comments (one page) never shows the marker comment and each run POSTs a new one; the second makes every line unparseable, which F1 turns into a POST as well. The live test (Manual row 2.9) runs its own copy of the `gh` command, so it does not cover the script's argv either. The plan's own premise (F1 of review 1) was that the projection is tested; the fake covers matching, not the call that produces the input. The audit loop already collects all argv, so the gap is one assertion.
- **Fix**: In the audit or the create test, assert the lookup call equals `["api", "--paginate", "repos/acme/widgets/issues/7/comments", "--jq", COMMENT_JQ]`. Add a fake that returns the list in two chunks only when `--paginate` is present to prove the multi-page path end to end.
- **Decision**: Fix (b464f60): tests pin the argv of all five calls and prove the page-2 and raw-list paths through the fake. Scratch-copy mutants (no `--paginate`, no `--jq COMMENT_JQ`, no `user --jq`, other pr view fields, no F1 check, no viewer skip, no PATCH `-F`) each turned the suite red.

### F3 — The test source holds a literal zero-width space, which the plan forbids

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/pr-comment.test.mjs:416
- **Detail**: A11 says "In code and tests the character is always written as the escape `\u200b`, never as a literal invisible character." The mention test builds its expected string with a raw U+200B (`@\u200b${name}`), which `grep -P '\x{200b}'` finds. In a diff or editor the line looks like `@${name}`, so a reviewer cannot tell whether the assertion checks the neutralization or its absence. The script itself uses the escape correctly.
- **Fix**: Replace the literal with `\u200b` in the template string.
- **Decision**: Fix (b464f60): the expectation uses the escape; no invisible character remains in the repository (the same character in the review files was replaced by the escape text).

### F4 — The roadmap S-05 flip to `in-progress` rides on this branch

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:49 (commit f5c4517)
- **Detail**: The plan (Edit discipline, last bullet) allows exactly this: the implement skill's best-effort status sync is "the only edit" and "forward-only". So it is not drift. It still does not belong on the branch that will be merged: plan review 1 (F4) said status tracking belongs to the commit that closes or merges the change, the row sits next to the S-06 and S-07 rows that the parallel changes also flip (adjacent-line edits conflict in a 3-way merge), and the roadmap now says `in-progress` while `change.md` says `implemented` and the roadmap will never say `done` from this branch.
- **Fix**: Drop the roadmap hunk from the PR (restore the row to `proposed`/`in-progress` in the merge commit, or flip it to `done` when the Manual rows close).
- **Decision**: Fix (d2d5433): the S-05 row is restored to the content of main; /10x-archive makes the only roadmap edit.

### F5 — Any `/user` failure switches to marker-only matching, not only the integration-token case

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/pr-comment.mjs:152-156, 174-181
- **Detail**: `viewerLogin` returns `null` for a timeout, a 5xx, a rate limit and a 403 alike. With `null`, `pickTarget` accepts the first marker comment of any author. A user with write access can edit other people's comments, so a transient `/user` failure plus a marker comment planted by a collaborator makes the script overwrite that comment (GitHub keeps the edit history; the plan accepted the 403 case as A10). A10 documents the integration-token case, not the transient one.
- **Fix**: Use marker-only only when `gh api user` fails with a 403 or "Resource not accessible by integration"; for a timeout or other failure return a skip `viewer lookup failed`.
- **Decision**: Fix (b464f60, 18c2749): any `gh api user` failure, timeout included, is the skip `viewer lookup failed`; marker-only matching is removed, so A10 is superseded and the integration-token case now skips. README updated; the 403 exception from the review is not taken (see plan.md Fix pass).

### F6 — The end-branch fallback prints a `PR comment:` line even for a run without the flag

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md `done`, `archive` and `halt` branches (the "If the call errors, post nothing and print `PR comment: skipped, task list unavailable`" sentences); skills/10x-pipeline/SKILL.md Start step 4
- **Detail**: Start step 4 says a task tool error without the flag is silent, and the README says a `PR comment:` line appears when the flag was given, so a missing line means a dropped step. Each end branch prints the "task list unavailable" line unconditionally. In a host without task tools, every run without `--pr-comment` ends with a `PR comment: skipped` line, and the "missing line = dropped step" signal is diluted. The tests pin the sentence in all three branches (F18), so this is what the plan asked for, but it contradicts step 4. Everything else in the wording is sound: one `node $PR_COMMENT`, three pointers each with `TaskList`, the subject and `post nothing`, the archive pointer before the archive subagent, a fail-closed Start.
- **Fix**: In each branch add "when `--pr-comment` was given" before "print", and pin it in the docs test.
- **Decision**: Fix (15681b5): the three end branches print the line only when `--pr-comment` was given; the docs test pins it.

### F7 — The Manual rows are not the complete list of unverified behavior

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/pr-comment-report/plan.md (`## Progress`, Manual rows)
- **Detail**: Progress holds 10 open Manual rows (1.9, 2.9, 3.8, 4.4, 4.5, 4.6, 4.9, 4.11, 4.12, 4.16), and Phase 4 names two more as unverified by design (forked-branch PR, GitHub Enterprise). That is 12, not 13, and the list misses: (a) the lookup argv (F2); (b) the timeout of a POST or PATCH, which the script handles (`gh timed out` in the skip) but no test exercises: the fake's `.sleep` is used only for `pr view` and the lookup; after such a timeout the comment may exist, and only the next run's marker lookup prevents a duplicate; (c) the real shape of `gh pr view --json` for an open PR, which only row 4.4 hits implicitly (live 1.9 covers the no-PR case); (d) the `GH_FORCE_TTY` and non-TTY output assumption behind A12 (F1); (e) the live projection test hard-codes public issue `cli/cli#14090`, which can be deleted or locked and then fail row 2.9 and 4.16 for a reason unrelated to the code. Row 4.12 (the orchestrator following the task wording across a 14-step loop) is the weakest evidence and cannot be automated; it is rightly Manual.
- **Fix**: Add a POST-timeout fake test, and record (c), (d) and (e) as unverified in the Phase 4 Findings block.
- **Decision**: Fix (b464f60, plan.md Fix pass): POST and PATCH timeout test added; the count is 10 Manual rows plus 2 unverified by design (12), and the shape of `gh pr view` for an open PR, the non-TTY output assumption and the dependency on public issue cli/cli#14090 are recorded.

### F8 — The report is published as-is to a pull request that may be public or upstream

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/pr-comment.mjs:142-150 (`buildBody`)
- **Detail**: Only `@mentions` are neutralized. The report carries goal text and, on a halt, quoted subagent text ("needs a human" reasons). Markdown links, images (a tracking or exfiltration pixel through GitHub's image proxy) and raw HTML in that text are posted unchanged. For a fork PR the comment goes to the base repository, which can be a public upstream, because the target comes from the PR url. The flag is opt-in and the plan lists forks as unverified; the README says the comment is "visible to collaborators" but not that it can be public.
- **Fix**: Document in the README that the comment goes to the base repository of the PR and may be public. Optionally wrap or escape `![`/raw HTML in the quoted halt text.
- **Decision**: Deferred (18c2749, plan.md Fix pass): neutralizing more than mentions would alter every report and has no small safe rule; the README now says the comment goes to the base repository and may be public.

### F9 — The orchestrator interpolates the change id into a shell command before the script validates it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/SKILL.md `## PR comment (opt-in)` step 1 (`node $PR_COMMENT <change-id>`)
- **Detail**: The script's id check (`^[a-z0-9][a-z0-9-]{0,99}$`) runs after the Bash tool's shell has parsed the line, so it cannot stop `x; cmd`. The same pattern already exists for `node $ROUTER ... <change-id>`, and the id comes from the user's own invocation, so this adds no new class of risk. `$PR_COMMENT` is also unquoted (a plugin path with a space breaks the call).
- **Fix**: Say "quote the path and the id" in step 1, as Start step 3 does for the goal.
- **Decision**: Fix (15681b5): step 1 says to quote the script path and the change id for the shell; the docs test pins it. The router call has the same exposure and is out of scope.

### F10 — Anchor claims against S-06 and S-07 cannot be checked from this tree

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md (`PR comment (opt-in):` group), AGENTS.md (Hard Rules and Commands bullets), docs/ADR/ADR-003-rigor-gated-routing.md:128
- **Detail**: The placements match the plan's Edit discipline exactly: README group after `Limits:` and before `## Layout`; AGENTS.md Hard Rules bullet after the git-writes bullet and Commands bullet after `risk`; ADR section after `### Archive adapter` and before `## Alternatives considered`; three existing lines extended; "How the tier moves" untouched. The sibling plans are not here to compare: `context/changes/pre-plan-steps/` has only `change.md`, and `baseline-usage-comparison` (S-06) has no folder. Manual row 3.8 is the right place for that check, and the S-06 change adds its Commands bullet "one line further down", which stays an adjacent-hunk risk. ADR-003's Context table, Consequences and Sources were not updated, as the plan said.
- **Fix**: None now; do row 3.8 when the first sibling merges.
- **Decision**: Record only: row 3.8 stays Manual until the first sibling change merges.
