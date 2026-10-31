<!-- PLAN-REVIEW-REPORT -->
# Plan Review (round 3): PR Comment Report Implementation Plan

- **Plan**: context/changes/pr-comment-report/plan.md (v3, commit b51eae7)
- **Mode**: Deep (claims run by the reviewer in scratch repositories, against the real `gh` 2.103.3, `rules.test.mjs` and the sibling plans; no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 4 observations
- **Round 1 / 2**: `reviews/plan-review.md` (F1-F9), `reviews/plan-review-2.md` (F10-F17), all accepted. Round-3 findings are numbered F18 onward.
- **Triage**: none needed. No critical or warning finding. The four observations may be taken or left at implementation time; none blocks `/10x-goal-implement`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS (2 observations) |
| Plan Completeness | PASS (2 observations) |

## Round-2 fixes: did they land and are they sound

| Round 2 | Landed in plan.md | Verified how | Sound? |
|---------|-------------------|--------------|--------|
| F10 live rows to Manual | Rows 1.9, 2.9, 4.16 are Manual with the `GH_LIVE=1` command; Automated 1.8, 2.8, 4.15 are gone; live tests fail when `GH_LIVE=1` and `gh` is missing or unauthenticated | Walked every Automated row for network or auth need. Rows 1.1/2.1/3.1 run the whole test file, where `live:` tests skip without `GH_LIVE=1`. The one real-`gh` test (not named `live`) needs no network: ran `gh pr view --json number,url,state,isDraft` and `gh api user` with an empty `GH_CONFIG_DIR`, `GH_TOKEN=`, `GITHUB_TOKEN=` in a scratch git repo with a `github.com` origin on this machine (where a real login exists). Both exit 4 with `gh auth login` text. Row 3.6 (`init`/`status`) is hermetic. | Yes. No Automated row needs network or auth. |
| F11 task hardening | Subject `PR comment: <change-id>`; `TaskList` in Start step 4 and in each end branch; stale task completed without the flag; other-change tasks ignored; fail-closed on missing task tools; docs tests pin the wording | Read against `SKILL.md`: `TaskCreate`, `TaskUpdate`, `TaskList` are in `allowed-tools` (no `TaskGet`, none needed). `10x-goal-implement` documents the same three tools for `claude -p`, so a headless run has them. The state is read at the point of use from a store outside model memory, so a 14-step loop and a context compaction no longer matter beyond "the model follows the branch text". See F18 for two wording gaps. | Yes, as far as a SKILL.md-only mechanism can go. Fail-closed is coherent with a flag the user typed: the user is told, with the manual command; ADR rule 1 forbids posting without the flag but does not forbid posting with it, so fail-open would also have been legal and fail-closed is the safer pick. |
| F12 `PRE` gate | One shared preamble used by the route/policy gate, row 3.5 and row 4.3 | Ran the exact `PRE` text in a scratch repository (`mktemp`-style directory under the scratchpad, `GIT_CONFIG_*` neutralised) for nine cases and for all three gate bodies. On `main` (clean): all three fail with the message. Feature branch, no commits: all pass. `route.mjs` edited uncommitted: ROUTE fails, LOG passes. `route.mjs` committed: ROUTE and LOG fail. SKILL.md adds the word `tier`: WORDS fails. No local `main`: all fail, with `fatal: Not a valid object name main` and the message. Orphan branch (empty merge-base): all fail. Detached HEAD on a feature commit: gates run normally. `sh -c` (dash form) runs the same. Precedence `a && b && c || {...; false} && check` behaves as intended. | Yes. |
| F14 seven `**GIVEN**` lines | The seven lines are verbatim in the plan; a docs test counts exactly seven and checks each once | Ran `ruleProblems` from `rules.test.mjs` on each of the seven lines: all return `[]`. | Yes. The count test cannot be satisfied by prose that mentions `**GIVEN**`, since the section slice is bounded by `### PR comment` and `## Alternatives considered` (ADR-003 lines 76 and 128 today). |
| F15 CRLF head | `head.startsWith(marker)`, no newline; CRLF fake test must PATCH | Marker is at most 34 + 100 + 4 = 138 characters (id cap 100), head is 200. `a`/`ab` stay distinct because of the closing ` -->`. | Yes. |
| F16 anchors | README group after `Limits:` before `## Layout`; AGENTS.md Hard Rules and Commands bullets, no Project Structure edit; ADR-003 section before `## Alternatives considered` | Read S-06 v3 (`baseline-usage-comparison-plan-v3`) and S-07 v2 (`pre-plan-steps-plan-v2`) with `git show`. S-06: README before `Limits:`, AGENTS.md route.mjs/test/ADR-range/baseline-policy Project Structure edits and a Commands bullet after `verify-archive`, ADR-005, a one-line `rules.test.mjs` regex widening, leaves `SKILL.md` and ADR-003 alone. S-07: README subsection before "Override", bullets after the archive bullet in "How routing works", `SKILL.md` "How the tier moves" bullets, two Project Structure bullets after the `test/` bullet, ADR-003 table row and a section "at the end". No sibling edits README `Limits:`/`## Layout`, AGENTS.md Hard Rules, or the gap between the `risk` and `verify-archive` Commands bullets (an unchanged line sits between S-05 and S-06 insertions, so git sees no adjacency). | Yes, no real collision left. See F21 for two wording inaccuracies. |
| F17 cap, `--report`, Progress prose | UTF-16 code-unit cap with surrogate back-off; `--report` by `basename` and parent `basename`; Phase 4 prose moved out of Progress; timeout skip documented | Ran the mention regex `(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])` on `@alice (@bob) a@b.com\n@carol x.@dave @@eve \`@frank\` @org/team`: all mentions neutralised, the email untouched, mid-body line starts covered without the `m` flag. Ran the cut: 60000 units kept, back-off logic correct. A cap in code units never exceeds the code-point count, so the 65536 limit holds either way. `xagent-smith` is refused by the basename test. | Yes. See F19 for a test-fixture gap. |

Items checked and found fine:

- Progress numbering. Counted criteria against rows: Phase 1 automated 6 and manual 1, Phase 2 6 and 1, Phase 3 7 and 1, Phase 4 3 and 7. Rows 1.7/1.8, 2.6/2.8, 3.7, 4.7/4.8/4.10/4.13-4.15 are gaps, which `references/progress-format.md` allows. One `## Progress` heading, no checkbox outside it. The Phase 1 body heading is longer than its Progress heading; matching is by phase number.
- Success Criteria text agrees with Progress titles in every phase; the Phase 4 Manual list has seven bullets and seven rows.
- Brief vs plan: phases, decisions (opt-in, task flag, hosts, cap unit, live rows Manual) and scope agree.
- `route.mjs` contains no quoted `gh`, `policy.json` has no `prComment`, so the guard test passes today. `SKILL.md` contains no `gh pr`/`gh api` today.

## Grounding

Paths 10/10 ✓ (`SKILL.md`, `README.md`, `AGENTS.md`, ADR-003, `route.mjs`, `policy.json`, `archive.test.mjs`, `helpers.mjs`, `rules.test.mjs`, `change.md`); `pr-comment.mjs` and `pr-comment.test.mjs` do not exist yet ✓. Symbols ✓ (`# Run report: ${id}` at `route.mjs:217`; the `archive` action carries `report: done.report` at `route.mjs:1008`; ADR-003 `### Archive adapter` at 76, `## Alternatives considered` at 128; README `Limits:` then `## Layout`; AGENTS.md git-writes Hard Rule and the `risk` then `verify-archive` Commands order). Brief↔plan ✓. Baseline suite on this branch: 157/157 pass. AGENTS.md hard rules: no npm deps ✓, `node:` only ✓ (import audit rows present), Node 18 ✓ (grep row present), router untouched ✓, router never calls `gh` ✓, no router git write added ✓, `context/archive/` read-only ✓ (`--report` into the archive is a read), ADR-004 form ✓.

## Findings

### F18 — Start step 4 fallback is unconditional, and a `TaskList` failure at an end branch is unspecified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — SKILL.md contract, Start step 4 and the three pointer lines
- **Detail**: Step 4 calls `TaskList` on every run and says "If TaskList or TaskCreate fails or is not available: print `PR comment: skipped, task list unavailable ...`". Read literally, a run started without `--pr-comment` in a host with no task tools prints a `PR comment: skipped` line the user never asked for. That also muddies the README promise "a `PR comment:` line is printed when the flag was given, so a missing line means the step was dropped". Second, the pointers say what to do when the task is open, not what to do when `TaskList` itself errors at `done`, `archive` or `halt`; the model will improvise, most likely by saying nothing, which is the silent drop the `PR comment:` line exists to expose.
- **Fix**: In step 4, limit the printed fallback to a run that has `--pr-comment`; without the flag a task-tool failure is silent. In the three pointers add one clause: "if TaskList fails, print `PR comment: skipped, task list unavailable`". The docs tests already pin that phrase for the Start section; extend the pin to the pointers or leave it.
- **Decision**: PENDING

### F19 — The surrogate back-off test can pass without exercising the back-off

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Tests, "Body" bullet
- **Detail**: The test cuts a report of repeated `"\u{1F600}"` at the cap and asserts no lone surrogate. The body is marker line + `"\n\n"` + report, so the report starts at offset `38 + len(id) + 2`. For an even-length id the offset is even, `60000 - offset` is even, and the cut falls on a pair boundary: no pair is split, the assertion holds, and a script with no back-off passes. I ran the cut with a 138-character prefix (even) and got exactly 60000 kept with nothing to back off. The 70000-ASCII case cannot cover it either.
- **Fix**: State in the test contract that the fixture puts one ASCII character before the emoji run (or uses an odd-length id), so the cap lands between the two units of a pair, and assert the kept length is 59999 in that case. A mutation by deleting the back-off then fails the test.
- **Decision**: PENDING

### F20 — No orchestrator wording for a script that prints no JSON

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — `## PR comment (opt-in)` section; Phase 1 usage errors
- **Detail**: The script exits 2 with no JSON for a usage error. The router accepts any `^[a-z0-9][a-z0-9-]*$` id with no length cap (`route.mjs:1194`), but the script rejects an id over 100 characters, so a long id reaches the end of a full run and then gets exit 2 from the script. The SKILL step says to print `PR comment: <action>, <url or reason> (PR ...)`, which presumes a JSON object. The model will improvise; the effect is harmless (nothing is posted) but it is the only script outcome the step text does not cover.
- **Fix**: One clause in the section: "if the script exits non-zero or prints no JSON object, print `PR comment: skipped, script error` and complete the task". Optionally note in the README that the id limit is 100 characters.
- **Decision**: PENDING

### F21 — "Edit discipline" slightly misdescribes the siblings and itself

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Edit discipline
- **Detail**: (1) The plan says S-07's ADR-003 section "may land at the same spot" (before `## Alternatives considered`). S-07 v2 says its section goes "at the end", and its other ADR-003 edit is a table row, so there is no collision; the "keep both sections" rule is harmless but unneeded. (2) The section says every edit is a new line and none changes "a line another change is likely to edit", yet three existing lines are extended: the `argument-hint` frontmatter, the end of Start step 1 and the README heading line. No sibling touches those lines (S-06 leaves `SKILL.md` alone; S-07 leaves the Start section alone), so no conflict follows. The claim is only inexact.
- **Fix**: None required. If the text is touched anyway, say "three existing lines are extended; no sibling edits them" and drop the S-07 ADR-003 collision remark.
- **Decision**: PENDING

## Process note

Fixing nothing in `plan.md`, per the task. Scratch work (gate cases, unauthenticated `gh`, rule-form and regex checks) ran under the session scratchpad directory only. One scratch script run started in this review's own worktree because its temp directory could not be created; it made a stray commit and rewrote three tracked files on the review branch, which were reset to `b51eae7` before any review work was committed. No shared ref, config or branch name changed.
