<!-- PLAN-REVIEW-REPORT -->
# Plan Review (round 2): PR Comment Report Implementation Plan

- **Plan**: context/changes/pr-comment-report/plan.md (v2, commit 74adb32)
- **Mode**: Deep (claims run by the reviewer against the repo, live `gh` and the sibling plans; no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 5 observations
- **Round 1**: `reviews/plan-review.md` (F1-F9, all accepted). Round-2 findings are numbered F10 onward so IDs stay unique across rounds.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (1 observation) |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Round-1 fixes: did they land and are they sound

| Round 1 | Landed in plan.md | Verified how | Sound? |
|---------|-------------------|--------------|--------|
| F1 jq projection | `COMMENT_JQ`, JS-side `head` match, `(.body // "")`, id cap 100 | Ran the exact filter live: `gh api --paginate repos/cli/cli/issues/14090/comments --jq '.[] | {id: .id, login: .user.login, head: ((.body // "") | .[0:200])}'` returned 183 lines, one JSON object per line over several pages. Marker is 34 + 100 + 4 = 138 characters, inside the 200-character head. | Yes. Two details, see F15 (CRLF heads). Note gojq emits keys alphabetically (`head,id,login`) and escapes `<` as `<`; both parse back fine in JS. |
| F2 merge-base gates | One shared gate in Implementation Approach, used by 1.5, 2.4, 3.4, 4.3 | Ran it against `main` (`54f1729`): clean tree gives empty diff (pass). Appended a line to `route.mjs` uncommitted: gate prints the file (fails). Committed that line: gate still prints the file and `git log main..HEAD` prints the commit (fails). Probe reverted. | Yes for the four route/policy rows. Row 3.5 (SKILL.md words) lacks the `test -n "$BASE"` guard, and every gate is empty when work happens on `main`; see F12. |
| F3 flag memory | Start step 4 task item, `## PR comment (opt-in)` section, pointer lines | Read against `SKILL.md` (`TaskCreate`, `TaskUpdate`, `TaskList` are already in `allowed-tools` and used nowhere in the body today) | Partly; see F11. |
| F4 edit discipline, roadmap | `roadmap.md` identical to `main` in this branch (`git diff main -- roadmap.md` empty); "Edit discipline" section | Compared the anchors with the S-06 plan (`baseline-usage-comparison-plan-v2`) and the S-07 plan (`pre-plan-steps-plan`) | Mostly; two anchors still collide, see F16. |
| F5 Manual to Automated | 1.7, 2.6, 3.7, 4.7, 4.8, 4.10 converted; 2.5 is a mutation test; 4.13/4.14 dropped | Counted Progress rows against Success Criteria bullets in every phase (7/7, 7/7, 7+1, 4+6) | Structure yes. The live rows cannot pass unattended, see F10. Real-`gh` unauthenticated test is sound: with `GH_CONFIG_DIR=<empty>`, `GH_TOKEN=` and `GITHUB_TOKEN=` in a non-git directory, `gh pr view` exits 4 with `gh auth login` text, so auth is checked before the repository. |
| F6 `--report` guard | Usage error unless path ends `agent-smith/report.md`; first line `# Run report: <id>`; PR url in result | `route.mjs:217` writes exactly `# Run report: ${id}` | Yes; see F17 for a string-suffix nit. |
| F7 `--hostname` | Dropped; non-`github.com` is a skip | Plan text | Yes. |
| F8 contract gaps | Catch-all, call count 4, `​` escape, import audit, code-point cut, archive hint | Plan text; regex run mentally: `(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])` also matches after `\n` (a non-word character), so the missing `m` flag does not drop mid-body line starts; running it twice does not double-escape | Yes; unit of the 60000 cap is still undecided, see F17. |
| F9 assumptions | A1, A2, A10, A12 updated; A13-A15 added | Plan text | Yes. |

Progress numbering gaps: allowed. `references/progress-format.md` says indices are never renumbered and "deleted steps leave gaps (acceptable)". The `/10x-goal-implement` parser takes the first `- [ ]` under a `#### Automated` heading in document order (SKILL.md step 6), not an index sequence, so 3.9 before 3.8 and the missing 1.7, 2.6, 3.7 are safe. Kept row titles are unchanged from v1.

## Grounding

Paths 9/9 ✓ (SKILL.md, README.md, AGENTS.md, ADR-003, route.mjs, policy.json, archive.test.mjs, helpers.mjs, rules.test.mjs); `pr-comment.mjs` and `pr-comment.test.mjs` do not exist yet ✓. Symbols ✓ (`route.mjs:217` report first line, ADR-003 `### Archive adapter` at 76 and `## Alternatives considered` at 128, README `Archive (opt-in):` before `Override any policy key` before `Usage report:`, no quoted `gh` in `route.mjs` or `policy.json` so the router-has-no-`gh` guard passes today). Progress↔Phase ✓ (one `## Progress`; no checkbox outside it; phase bodies match Progress by number; Phase 1 body heading was extended to "report checks, PR lookup and skips" while its Progress heading keeps the v1 text, which the number-matching rule allows). Brief↔plan ✓. Baseline suite on this branch: 157/157 pass. AGENTS.md hard rules: no npm deps ✓, `node:` only ✓, Node 18 ✓ (grep list present), router untouched ✓, `pr-comment.mjs` makes no git call ✓, `context/archive/` read-only ✓ (a `--report` into the archive is a read), ADR-004 rule form planned ✓ (see F14).

## Findings

### F10 — Live-test rows 1.8, 2.8 and 4.15 are Automated but cannot pass in an unattended run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 row 1.8, Phase 2 row 2.8, Phase 4 row 4.15; Implementation Approach test list
- **Detail**: All three rows run `GH_LIVE=1 node --test --test-name-pattern "live" ...` and need network plus an authenticated `gh`. `/10x-goal-implement` collects every Automated command at preflight, runs it as a gate and, on failure, allows two self-fix attempts and then prints the STOP block and halts (SKILL.md lines 76, 129-152). It has no "leave the row unchecked, continue" path for an Automated row, and the plan's sentence "the row stays unchecked if `gh` cannot reach GitHub" describes behavior that skill does not have. Outcomes in an unattended run: (a) no network or no `gh` auth, as in a CI or sandboxed headless run: gate red, two pointless "fixes" (risk: the agent weakens the live test), then Phase 1 stops; (b) the run does not set `GH_LIVE=1` (for example it only runs the full suite): the live tests skip, the exit code is 0, and nothing checks the "passing, not skipped" condition, so the row can be ticked with no evidence. The plan hit this class in round 1 (F5) and fixed it for `gh`-free checks only.
- **Fix**: Keep the live tests in the suite (they skip by default and cost nothing), but make the three rows Manual, with the exact `GH_LIVE=1 ...` command and "expected: both live tests report `ok`, none `skipped`". Delete the Automated rows 1.8, 2.8 and 4.15 and add them as new Manual rows with the next free numbers (1.9, 2.9, 4.16; gaps are allowed). Re-point the Success Criteria bullets the same way. Also fail hard inside the live tests when `GH_LIVE=1` is set and `gh` is missing or unauthenticated, so a human run cannot pass by skipping.
  - Strength: unattended runs stay green and finish; the human checklist carries the evidence; the read-side unknown (A12) is still closed by a human before Phase 4.
  - Tradeoff: the pagination check is no longer machine-gated. The default suite still covers marker matching with the fake.
  - Confidence: HIGH — read from `10x-goal-implement` SKILL.md; the 183-comment projection was re-run by this review.
  - Blind spot: whether the implementer's machine has an authenticated `gh` is unknown; the Manual route does not depend on it.
- **Decision**: PENDING

### F11 — The A15 task item still depends on memory at the moment of use, and an open task can outlive the invocation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — SKILL.md contract (Start step 4, `## PR comment (opt-in)`, pointer lines); A15; ADR rule 1
- **Detail**: Is a SKILL.md-only mechanism enough? It is the best available without a `route.mjs` edit, and an orchestrator that follows SKILL.md will create the task (step 4 is an explicit imperative, `TaskCreate` is already allowed, and it is set before the first `init`). Three holes remain.
  1. The pointer lines say "When the PR comment task is open, do the PR comment step." Nothing tells the orchestrator to call `TaskList` there. `TaskList` appears only in step 4, as an idempotency check at creation time. At `done` the model must therefore still remember that a task exists, which is the memory dependency A15 was meant to remove. After context compaction the SKILL.md text survives, but the knowledge that this particular invocation had the flag does not necessarily.
  2. The task is session state, not run state. The subject `PR comment: post the report when the run ends` carries no change id. If an earlier invocation left it open (the user interrupted, the model dropped it, a `halt` ended before the step), a later invocation in the same session, started without `--pr-comment` or for another change, finds an open task at its `done` and posts. That breaks ADR rule 1 ("a run started without `--pr-comment` ... MUST NOT call `pr-comment.mjs`") and posts a different change's goal text under the user's name.
  3. No fallback if the task tools fail or are unavailable (some headless setups). Step 4 would error, and the flag would be lost silently, which is the failure A15 names.
- **Fix**: (a) Put the check into the pointers: "Call TaskList. If a task with subject `PR comment: <change-id>` is open, do the PR comment step." (the phrase `PR comment step` stays once per branch, so the docs test in 3.1 still holds). (b) Put the change id in the subject. (c) In Start step 4, when the flag is absent, call `TaskList` and mark any open `PR comment: <change-id>` task completed, so a stale task cannot post. (d) If `TaskCreate` fails, say so in the output and print `PR comment: skipped, task list unavailable` at the end. Add the subject format to the docs test.
  - Strength: the state is read at the point of use from a store that is not model memory, and it cannot leak across runs. SKILL.md only; no merge cost.
  - Tradeoff: two more lines in the contended file.
  - Confidence: MED — the behavior of task tools across compaction and in `claude -p` is not provable from here; row 4.12 still tests only one short run.
  - Blind spot: whether `TaskList` is available in every host that runs this skill. The `meta.json` fallback in A15 stays the escape hatch.
- **Decision**: PENDING

### F12 — The merge-base gates still fail open in two cases

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 row 3.5; Implementation Approach — branch-base gate; row 4.3
- **Detail**: This is the F2 defect class and the fix is incomplete. (1) Row 3.5 is `BASE=$(git merge-base main HEAD); git diff -U0 "$BASE" -- SKILL.md | grep ... | grep -iwE ...` and "prints nothing" is the pass. With no local `main` (a fresh clone on a feature branch, a worktree created from a tag) `BASE` is empty and `git diff -U0 "" ...` dies with `fatal: bad revision ''`, which this review reproduced; the pipe prints nothing, so the row passes. The route/policy gate has `test -n "$BASE"`; 3.5 does not. (2) If the work is done on `main` itself, `git merge-base main HEAD` is `HEAD`, so after the first phase commit every gate diffs `HEAD` against the tree and prints nothing, and `git log main..HEAD` in 4.3 is empty by construction. The repository's own flow is branch then PR (memory), so (2) is unlikely, but the gate's stated promise is that it holds for any branch.
- **Fix**: Add `test -n "$BASE" &&` to row 3.5, and add `test "$(git rev-parse --abbrev-ref HEAD)" != main &&` (or `git merge-base --is-ancestor main HEAD && test "$(git rev-parse main)" != "$(git rev-parse HEAD)"` for the "at least one commit ahead" form) to the shared gate. One edit in Implementation Approach, one in row 3.5.
- **Decision**: PENDING

### F13 — Opt-in default (A1): defensible, recorded, but only where the owner reads the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: A1; plan-brief "Open Risks"; PRD `prd.md:48`, FR-005
- **Detail**: PRD FR-005 says "the user can see the same report as a comment on the pull request" (a capability, must-have); the success criterion says the report "is posted as a comment" (an outcome). Opt-in meets the first and not the second by default. Opt-in is defensible: `--archive` sets the precedent, the comment is visible to collaborators and carries goal text, mentions are the only outbound text the plugin controls, and the roadmap risk text makes a missing PR a skip, not a failure. The gap is recorded in A1 ("Owner confirmation is still pending") and in plan-brief "Open Risks and Assumptions". It is not recorded in `change.md`, the PRD, the roadmap or the README, which are the files a reviewer or the `/10x-status` reader opens. A later reader who checks the PRD success criterion against the README will see a gap with no explanation.
- **Fix**: Add one line to `change.md` Notes: "PRD success criterion 'posted as a comment' is met only when `--pr-comment` is passed (A1); owner confirmation pending." Keep the README wording as planned.
- **Decision**: PENDING

### F14 — The new ADR rule lines are not counted by any test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — ADR contract; docs tests; row 3.2
- **Detail**: The plan lists the seven rule lines unbolded and says the keywords must be bold. `rules.test.mjs` checks only lines that contain `**GIVEN**` (`line.includes("**GIVEN**") ? ruleProblems(line) : strict ? proseProblems(line) : []`, ADR mode is not strict). An implementer who writes the seven lines without bold passes row 3.2 and the whole suite. S-06's plan counts its ADR rule lines with a grep; this plan does not.
- **Fix**: Add to the docs tests: the `### PR comment` section of ADR-003 holds at least 7 lines with `**GIVEN**`, and each of the 7 sentences above appears once.
- **Decision**: PENDING

### F15 — Marker match must tolerate CRLF heads; say so and test it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Contract "Lookup" and Match; test list "Update"
- **Detail**: The contract says a comment matches when `head` "starts with that exact marker line". The 183-comment listing this review ran contains heads with `\r\n` line endings (comments edited in the GitHub web UI are stored with CRLF). If the human edits our comment in the browser, its head is `<!-- ... -->\r\n...`. A match written as `head.startsWith(marker + "\n")` or a split on `"\n"` would stop matching and the next run would POST a duplicate. The closing ` -->` already separates `a` from `ab`, so the newline is not needed.
- **Fix**: State the match as `head.startsWith(marker)` with no newline, and add one fake-`gh` test with a CRLF head that must be PATCHed.
- **Decision**: PENDING

### F16 — "Edit discipline" anchors collide with S-07 (README) and S-06 (AGENTS.md)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Edit discipline; README, AGENTS.md, ADR-003 bullets
- **Detail**: Checked against the sibling plans:
  - S-06 (README "Baseline comparison:" between "Usage report:" and "Limits:", AGENTS.md bullets, ADR-005): README anchors do not collide, and S-06 says S-05 "adds its block after Archive, a different hunk". AGENTS.md: S-06 edits the `route.mjs` Project Structure bullet (adds `compare` to the command list) and S-05 inserts a new bullet "directly after the `route.mjs` bullet". A modified line and an insertion on the adjacent line is a textual conflict in a three-way merge. S-06's Commands bullet goes after the last bullet (`verify-archive`); S-05 goes after `risk`, so those two do not collide. `SKILL.md` and ADR-003 are untouched by S-06.
  - S-07: its README plan puts a "Pre-plan steps" subsection "before the 'Override any policy key' paragraph", which is the exact anchor S-05 chose. Two insertions at one point always conflict. Its ADR-003 section has no stated anchor; "immediately before `## Alternatives considered`" is the natural spot for both. SKILL.md: S-07 adds "How the tier moves" bullets at the end and leaves the loop alone, so S-05's edits there do not collide.
  - The `10x-goal-implement` entry step also flips the roadmap row to `in-progress` ("mandatory lookup", SKILL.md line 193). The plan calls this a forward-only edit; it is, but it re-opens the adjacent-line risk F4 closed. Declared, so acceptable.
  - Conflicts are small and resolvable (keep both sides) and Manual row 3.8 already covers the merge. This is not a plan defect, but the plan states the anchors avoid collisions and two do not.
- **Fix**: Choose anchors no sibling claims. README: after the `Limits:` group and before `## Layout` (S-06 uses before-`Limits:`, S-07 before-`Override`); update the docs test to "after `Archive (opt-in):`" only. AGENTS.md Project Structure: add the script bullet after the `assets/` bullet (last) or merge it into the Hard Rules and Commands bullets only. ADR-003: after `### Archive adapter`, before `## Alternatives considered`, and say "on a conflict keep both sections".
- **Decision**: PENDING

### F17 — Small contract tightening: cap unit, path suffix, Progress prose

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Body contract; Implementation Approach — report checks; Phase 4 — Findings
- **Detail**:
  - The 60000 cap and the `<n> characters omitted` line do not say the unit. UTF-16 `.length` and code points differ for emoji text. Decide one (code points fits "cut on a code point" and stays under GitHub's 65536-character limit either way) and make the test assert it.
  - "resolved form does not end in `agent-smith/report.md`" read as a string suffix accepts `xagent-smith/report.md`. Require `path.sep + "agent-smith" + path.sep + "report.md"` (or compare `path.basename` and `path.basename(path.dirname(...))`).
  - Phase 4 "Add one dated line under the matching Progress row" puts prose inside `## Progress`, which `progress-format.md` forbids ("No descriptive prose between phases or subsections"); the reference says to add an inline note in the Phase block instead. Carried over from v1.
  - `gh api --paginate` shares one 20 s timeout for all pages; a PR with hundreds of comments could exceed it and skip as `gh timed out`. The skip is safe (no duplicate); say so in the README skip list.
- **Fix**: One edit pass over those four lines.
- **Decision**: PENDING
