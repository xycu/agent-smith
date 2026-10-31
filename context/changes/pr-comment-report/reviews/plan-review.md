<!-- PLAN-REVIEW-REPORT -->
# Plan Review: PR Comment Report Implementation Plan

- **Plan**: context/changes/pr-comment-report/plan.md
- **Mode**: Deep (claims checked by the reviewer against the code and live `gh`; no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 4 observations
- **Triage**: all nine findings decided in plan v2 (2026-10-31); every one accepted, with parts of F3 (Fix B) and F5 (break gate left to the implement skill) rejected as noted

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Paths 9/9 ✓ (SKILL.md, README.md, AGENTS.md, ADR-003, route.mjs, policy.json, archive.test.mjs, helpers.mjs, rules.test.mjs); the two new files do not exist yet ✓. Symbols ✓ (`runGit` 449, `buildReport` 202, `writeReport` 242, `finishRun` 250, `endRun` 264, `archiveDone` 869, shim at `archive.test.mjs:1053`); one off-by-one cite in research (`policy.json:70` is `:71`). Progress↔Phase ✓ (4 phases; rows 6+1, 5+1, 6+2, 3+11 match the Success Criteria bullets; no checkbox outside `## Progress`). Brief↔plan ✓. Baseline suite on this branch: 157/157 pass. No `contract-surfaces.md`, no `lessons.md`. `AGENTS.md` hard rules: no npm deps ✓, `node:` only ✓, Node 18 ✓, router git-write limit untouched ✓, `context/archive/` only read ✓, ADR-004 rule form planned ✓.

Checked live (read-only, `gh` 2.103.3, inside this harness sandbox): `gh pr view` reaches GitHub and reports `no pull requests found` (so `gh` auth and network work from the Bash tool here); `gh api --paginate repos/cli/cli/issues/14090/comments --jq '.[] | {id: .id, login: .user.login}'` returned 183 lines, one compact JSON object per line, across several pages. A12 holds. The `@` regex in A11 behaves as the plan says (line start, after `(`, emails untouched). A `spawnSync` timeout kills a `sleep` shim in about 200 ms, so the timeout test will not hang.

## Findings

### F1 — The dedupe logic lives in a jq string that no automated test runs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Contract "Lookup" and Tests "Update"
- **Detail**: Marker selection (`select(.body | startswith("<marker>"))`) runs inside real `gh --jq`. The fake `gh` returns canned output whatever the filter is, so "a marker for another change id is not patched" passes by construction. The plan admits this: the test asserts "the filter text in argv", which tests a string, not behavior. The only protection against a wrong filter (quoting, `startswith` on a null body, another change's marker) is Phase 4 row 4.8, after all code exists. A bad filter either duplicates comments on every run or patches another change's comment.
- **Fix**: Let jq only project and bound: `--jq '.[] | {id: .id, login: .user.login, head: (.body | .[0:200])}'`, and match `head.startsWith(marker)` in JS. The fake then feeds marker, foreign-marker, unmarked and other-change comments and the tests assert real behavior; the compact-line shape stays (verified above).
  - Strength: The core safety property (never edit a foreign or other-change comment) becomes a unit test, not a manual row.
  - Tradeoff: Slightly more output per comment (200 chars, bounded).
  - Confidence: HIGH — the projection shape was run live; `.[0:200]` is standard jq slicing.
  - Blind spot: A null `.body` (not seen on issue comments) needs `(.body // "")`.
- **Decision**: FIXED (accepted) via the recommended fix, plan v2. `gh --jq` now only projects `id`, `login` and `head` (first 200 characters, null-safe `(.body // "")`, verified live on a 183-comment issue); the marker is matched in JS with `startsWith`, so the fake-`gh` tests feed marker, foreign-marker, unmarked and other-change (`a` vs `ab`) comments and assert behavior. The change id is capped at 100 characters so the marker fits the head.

### F2 — "Router and policy untouched" gates are vacuous after the first phase commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (1.5), Phase 2 (2.4), Phase 3 (3.4, 3.5)
- **Detail**: These rows use `git diff --stat HEAD -- route.mjs policy.json` and `git diff HEAD -- SKILL.md | grep '^+' | grep -iE "sonnet|..."`. `/10x-goal-implement` commits each phase on green, so at the next gate the working tree equals `HEAD` and the diff prints nothing even if an earlier phase changed `route.mjs`. Rows 1.5, 2.4, 3.4 and 3.5 pass without checking anything. Only 4.3 (`git log main..HEAD`) is real. Row 3.5 also breaks if the SKILL.md text says "no model, effort or tier": the grep matches the word `effort`/`tier` in an innocent sentence.
- **Fix**: Use the branch base in every gate: `test -z "$(git diff --name-only $(git merge-base main HEAD) HEAD -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json)"` and the same base for the SKILL.md grep. Keep the rule line in SKILL.md free of those three words.
- **Decision**: FIXED (accepted) via the recommended fix, plan v2. All "untouched" rows diff the working tree against `git merge-base main HEAD` (one shared gate defined in Implementation Approach). The SKILL.md word check also became a git-free docs test limited to the lines this change adds, and those lines avoid the words effort, tier and model names; added content goes on new lines so existing lines that contain "effort" are not re-added.

### F3 — The `--pr-comment` flag lives only in the orchestrator's memory for a 14+ step loop

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Assumption A2; Phase 3 — SKILL.md Start step 1
- **Detail**: `--archive` is stored in `meta.json` and echoed by the router's `archive` action precisely so the orchestrator does not have to remember it. `--pr-comment` is "kept for the rest of this invocation" in the model's context across many subagent calls (budget 14 plus delta), where context compaction can drop it. A silent skip looks identical to "not requested". The plan states the cost of A2 only as "a resume without the flag does not post" and rates reversal "medium" while saying nothing about this durability risk. No test or Manual row covers it except 4.12 (one short run).
- **Fix A ⭐ Recommended**: In Start step 1, when the flag is given, create one task (`TaskCreate`, already in `allowed-tools`): "At the end of the run: post PR comment". The loop's `done`/`archive`/`halt` branches say "when that task exists". Strength: survives compaction, SKILL.md only, no router change. Tradeoff: one more instruction in the contended file. Confidence: MED — task lists are visible to the model, but this is not proven for 14-step runs. Blind spot: None significant.
- **Fix B**: Persist the flag like `--archive` (`meta.json`, router echoes `prComment: true` in end actions). Strength: deterministic. Tradeoff: edits the `init` block and usage string S-06/S-07 also edit; reverses the plan's main merge-safety argument. Confidence: HIGH on behavior, LOW on merge cost. Blind spot: Parallel branch conflicts unmeasured.
- **Decision**: FIXED (accepted) via Fix A, plan v2. Start step 4 creates one orchestrator task when `--pr-comment` is given; a `## PR comment (opt-in)` section and one pointer line per end branch use it. Fix B (`meta.json`) REJECTED: it edits `init` parsing, the meta write, the usage string and the end-action output of `route.mjs`, all contended with S-06/S-07, and reverses the plan's merge-safety argument. Recorded as A15 with the residual risk (not proven across a 14-step loop with compaction), a visible `PR comment:` line as mitigation, and `meta.json` as the fallback if a silent skip is ever seen.

### F4 — No edit discipline for the three parallel changes; the roadmap flip in the plan commit is undeclared and conflict-prone

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Current State bullet 14; Phase 3 (README, AGENTS.md, ADR-003, SKILL.md); commit `6ea2652`
- **Detail**: The plan says it avoids `route.mjs`, `policy.json` and the tier list, but Phase 3 edits README, AGENTS.md, SKILL.md and ADR-003, which S-06 and S-07 also edit, and gives no placement. Concrete collisions: the `skills/10x-pipeline/test/` line in AGENTS.md (S-06 adds `compare.test.mjs` to the same list; this plan adds `pr-comment.test.mjs`); the README Layout and Usage lines; the new ADR-003 section at the same spot as S-07's ("short section" next to the status table); SKILL.md `done`/`halt` lines. S-06's plan lists exact placements ("README between Usage report and Limits", "one Commands bullet") and says why it does not touch the roadmap: "no roadmap status flip ... to avoid a textual conflict with the parallel plans for S-05 and S-07 on adjacent roadmap lines". This plan did the opposite: commit `6ea2652` flips S-05 `proposed`→`planning` in the table row and in the S-05 section (`roadmap.md` lines 49 and 145). The plan does not mention that edit. The rows of S-05, S-06 and S-07 are adjacent lines, so the first of the other two to flip its status conflicts. Precedent exists (`79e613f` flipped the roadmap in the archive-adapter plan commit), but that change had no parallel siblings.
- **Fix**: (1) Revert the roadmap hunk from the plan commit and flip status when the change is closed or merged (the roadmap skill owns the table). If the owner wants to keep it, list it under "Changes Required" so it is a declared edit. (2) Add an "Edit discipline" paragraph to Phase 3 as S-06 did: README block as its own "PR comment (opt-in)" group directly after "Archive (opt-in)" and not inside "Usage report"; the AGENTS.md test-list entry appended last on its line; the ADR-003 section placed immediately before `## Alternatives considered`; the SKILL.md rule appended as the last bullet under Rules. The roadmap judgment: status tracking belongs in the commit that closes or merges the change, not in a plan commit, because it is a shared file and not part of the deliverable.
- **Decision**: FIXED (accepted), plan v2. (1) `roadmap.md` restored to `main` in this branch; the status flip belongs to the close/merge commit, and the plan states it. (2) New "Edit discipline" paragraph in Phase 3 with exact anchors for SKILL.md, README, AGENTS.md and ADR-003. Two deviations from the suggestion, both to collide less: the AGENTS.md `test/` line is not edited at all (the new test file is named in a separate Project Structure bullet), and README Requirements is not edited (the `gh` requirement is the first bullet of the new group). The README Layout line is inserted, not appended.

### F5 — Manual rows hide checks that can be automated or run read-only now

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4 rows 4.7, 4.8, 4.10, 4.13, 4.14; Phase 2 rows 2.5, 2.6; Phase 3 row 3.7
- **Detail**:
  - 4.7 (pagination past page one) and 4.8 (one compact JSON object per line) need no throwaway PR and no write scope: they are GET calls. I ran the exact projection against a public issue with 183 comments and got one object per line across pages (see Grounding). Make it an opt-in live smoke test (`GH_LIVE=1`, skipped by default and when `gh` is missing) or a recorded Phase 1 check, so the unknown is closed before Phase 2 builds on it.
  - 4.10 "not authenticated": `GH_CONFIG_DIR=<empty dir> GH_TOKEN=` with the real `gh` gives exit 4 without network. A hermetic test can run it when `gh` exists.
  - 2.6 "no path writes under the project root": a before/after snapshot of the scratch project tree in the tests covers it; the argv audit covers "no call outside the list". Only the temp directory removal is asserted today.
  - 3.7 "archive branch runs it before the archive subagent": a docs test can assert that `$PR_COMMENT` appears three times in SKILL.md and that, in the `archive` branch, its index is below the `/10x-archive` step.
  - 2.5 deliberate break is described as "run once by hand and revert": a repeatable mutation test (copy the script to a temp dir, replace the author comparison, expect the test to fail) is cheap, or state that the `/10x-goal-implement` break gate covers it.
  - 4.13 and 4.14 may be ticked as "recorded untested", so the rows can be checked with no evidence. Mark them `n/a - recorded` explicitly or drop them from the done criteria.
- **Fix**: Move 4.7/4.8/4.10 and the 2.6/3.7 checks into automated rows (live ones gated and skipped by default). Keep only the write path (4.4-4.6, 4.9, 4.11, 4.12) as Manual.
- **Decision**: FIXED (accepted), plan v2. 1.7, 2.6, 3.7, 4.7, 4.8, 4.10 converted: live read-only tests gated by `GH_LIVE=1` (no-PR skip as 1.8, projection over 183 comments as 2.8, re-run as 4.15), a real-`gh` not-authenticated test with an empty `GH_CONFIG_DIR`, a project-tree snapshot plus argv audit (2.7), and a docs test of the SKILL.md loop structure (3.9). 2.5 became a repeatable mutation test (the "state that the implement gate covers it" alternative REJECTED: it ties the proof to a tool outside the repo). 4.13 and 4.14 left Progress and are listed as unverified by design. "Merged PR" stays fake-covered with the message text verified by research. Manual rows left: 4.4-4.6, 4.9, 4.11, 4.12, plus 3.8.

### F6 — `--report <path>` can post any readable file, and the target PR is whatever branch is checked out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach — Script contract; Phase 1 script
- **Detail**: The script publishes the file named by `--report` under the user's identity. The orchestrator is told to pass only the id, but the argument is a text-built command line; a path outside the report location should be refused. The manual re-run (A9) also posts to the PR of the branch checked out at that moment: a run for change A, re-run from a branch whose PR belongs to change B, puts A's goal text on B's PR. The result prints only the comment URL.
- **Fix**: Accept `--report` only when the resolved path ends with `agent-smith/report.md`; print the PR `url` in the result; README line: "run it from the branch of the pull request".
- **Decision**: FIXED (accepted, extended), plan v2. `--report` is a usage error unless the resolved path ends in `agent-smith/report.md`; additionally the file's first line must be `# Run report: <id>` (cheap, stops posting another change's report). The result carries the PR url as `pr`; the README says to run the manual command from the branch of the pull request (A9, A13).

### F7 — Speculative surface: GitHub Enterprise `--hostname`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Contract "Write failure" and Tests "Host"; row 4.14
- **Detail**: The plan states "No GitHub Enterprise verification" yet builds `--hostname` plumbing, a test and a manual row it expects to skip. Untested host handling is code that can only be wrong in production.
- **Fix**: For a host other than `github.com` return `skipped: unsupported host <host>` and drop the plumbing and row 4.14; add GHE when someone needs it.
- **Decision**: FIXED (accepted), plan v2. Hosts other than `github.com` are a skip (`unsupported host <host>`); `--hostname` plumbing, its test and row 4.14 are dropped. No evidence a host is available (A14).

### F8 — Small inconsistencies and gaps in the script contract

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 and 2 contracts; Performance Considerations; plan lines 133 and 152
- **Detail**:
  - "Every runtime outcome exits 0 with one JSON object" has no top-level `try/catch` in the contract. A `mkdtempSync` or `writeFileSync` failure (read-only temp dir) would exit 1 with a stack trace. Add the catch and one test.
  - Performance says "at most five `gh` calls" and lists four.
  - The zero-width space in the A11 regex replacement and in the test expectation is a literal invisible character (two occurrences in `plan.md`). An implementer or editor can lose it. Write `\u200b`.
  - The import audit grep (1.3) misses multi-line `import {` statements, `import("x")` and `require`. Grep for `from "` lines, `import(` and `require(` separately.
  - Truncation by `.length` counts UTF-16 units and can cut a surrogate pair; say "cut on a code point".
  - A skipped `report not found` after an archive should hint at `--report context/archive/...`.
- **Fix**: One edit pass over the contract text.
- **Decision**: FIXED (accepted), plan v2. Top-level try/catch with a test (`TMPDIR` pointing nowhere); call count corrected to four; zero-width space written as the escape `\u200b` in plan and tests; import audit split into `from "`, `import(`, `require(` and bare `import "` greps; truncation on a code point with a surrogate test; the archive hint added to `report not found` when the default path is missing.

### F9 — Assumption review (A1-A12): reversal costs and evidence status

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Assumptions A1, A2, A6, A10, A12
- **Detail**:
  - A1 (opt-in): the PRD success criterion says the report "is posted as a comment" (`prd.md:48`), so default-off leaves that criterion unmet by default. The reversal cost "low" omits the README text, ADR rule 1 and the docs tests that flip with it. Owner confirmation stays pending; say so in the plan.
  - A2: reversal is medium-to-high once F3 is counted; see F3.
  - A6: constants stay; fine. A8: reversal "high" is honest.
  - A10 (marker-only): a spoofed marker comment by another user, with `/user` unavailable, makes every later run PATCH a foreign comment, fail and skip, with no POST fallback. Harmless but permanent; the skip reason should say so.
  - A12 is now verified against a real PR comment listing (183 comments); update the status from "unverified".
  - Feasibility, the roadmap's only unknown: `gh` reaches GitHub from the Bash tool in this sandboxed harness. Record this in the plan; the remaining risk is writes, covered by 4.4-4.5.
- **Fix**: Edit the assumption list as above.
- **Decision**: FIXED (accepted), plan v2. A1 states the PRD wording (`prd.md:48`) is unmet by default, lists the full reversal cost and keeps owner confirmation pending; A2 reversal is medium-to-high; A10 records the permanent spoofed-marker effect and the skip reason names it; A12 is marked verified (183 comments) and re-checked by the live test; feasibility recorded in Current State; A13-A15 added.
