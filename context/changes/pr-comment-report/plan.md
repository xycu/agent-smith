# PR Comment Report Implementation Plan

## Overview

Add an opt-in `--pr-comment` flag to `/agent-smith:10x-pipeline`. When the user passes it and a run ends with a `report`, the orchestrator runs a new dependency-free script, `skills/10x-pipeline/scripts/pr-comment.mjs`, with Bash. The script finds the open pull request of the current branch through `gh`, and posts the router's `report.md` as one comment, or edits its own earlier comment in place (found by a hidden marker). Any failure (no `gh`, not authenticated, no pull request, closed pull request, unsupported host, network, timeout) is a skip with a reason, never a halt. The router (`route.mjs`) and `policy.json` do not change. This is roadmap S-05, PRD FR-005.

## Review response

Plan v2, after `reviews/plan-review.md` (verdict REVISE). Each finding is decided in the review file; this is the summary.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 jq filter untested | Accepted | `gh --jq` only projects `id`, `login` and the first 200 characters of the body; the marker is matched in JS, so the fake `gh` tests exercise it (Phase 2) |
| F2 vacuous gates | Accepted | Every "untouched" gate diffs against `git merge-base main HEAD`; the SKILL.md word check is also a git-free docs test |
| F3 flag lives in memory | Accepted, Fix A | An explicit orchestrator task item (SKILL.md only). Fix B (`meta.json`) rejected, see A15 |
| F4 shared-file discipline, roadmap flip | Accepted | `roadmap.md` restored to `main` in this branch; exact placement for every shared-file edit, see "Edit discipline" in Phase 3 |
| F5 Manual rows | Accepted | 2.6, 3.7, 4.7, 4.8, 4.10 and 1.7 become Automated; 2.5 becomes a mutation test; 4.13 and 4.14 leave the done criteria and are listed as unverified by design |
| F6 `--report` and target PR | Accepted, extended | Path must end with `agent-smith/report.md` and the first line must be `# Run report: <id>`; the PR url is in the result; README says to run it from the PR's branch |
| F7 `--hostname` | Accepted | A host other than `github.com` is a skip; plumbing, test and row 4.14 dropped |
| F8 contract gaps | Accepted | Top-level catch, call count, escape instead of a literal zero-width space, import audit, code-point cut, archive hint |
| F9 assumptions | Accepted | A1, A2, A10, A12 updated; feasibility recorded; A13 to A15 added |

Plan v3, after `reviews/plan-review-2.md` (verdict REVISE, F10 to F17). Each finding is decided in that file; this is the summary.

| Finding | Decision | What changed |
| --- | --- | --- |
| F10 live rows cannot pass unattended | Accepted | Automated rows 1.8, 2.8 and 4.15 deleted; Manual rows 1.9, 2.9 and 4.16 carry the `GH_LIVE=1` commands and an "ok, none skipped" expectation. The live tests stay in the suite (skipped by default) and now fail when `GH_LIVE=1` is set and `gh` is missing or unauthenticated |
| F11 A15 task depends on memory | Accepted | The task subject carries the change id (`PR comment: <change-id>`); every pointer says to call `TaskList` first; a run started without the flag completes a stale task of its own change and ignores any other; if the task tools fail the run prints `PR comment: skipped, task list unavailable` at Start and posts nothing; docs tests pin the wording |
| F12 merge-base gates fail open | Accepted | One shared preamble (empty `BASE`, run on `main` or no local `main` all fail, with a message); row 3.5 and row 4.3 use it. Checked in a scratch repo (five cases) |
| F13 PRD "is posted" vs default-off | Accepted | One line in `change.md` Notes |
| F14 ADR rule lines uncounted | Accepted | Docs test: the ADR section has exactly seven `**GIVEN**` lines and each of the seven appears once |
| F15 CRLF head | Accepted | Match is `head.startsWith(marker)`, no newline needed; a CRLF-head fake test must PATCH |
| F16 anchor collisions | Accepted, extended | README group moves to after `Limits:` and before `## Layout`; the README Layout line and the AGENTS.md Project Structure bullet are dropped; ADR-003 anchor kept with an explicit "keep both sections" rule. The sibling plans were read for their anchors |
| F17 contract tightening | Accepted, one change | Cap counted in UTF-16 code units, not code points (a code-point cap can exceed GitHub's limit for emoji text); `--report` checked by file and directory name, not by string suffix; prose moved out of Progress; the timeout skip is documented as safe |

Progress rows keep their titles and numbers (the plan was reviewed, so titles are immutable). Rows whose check moved between Automated and Manual were deleted and a new row took the next free number, so some numbers have gaps (`references/progress-format.md` allows this). Where a row's command changed, the Phase text says so.

## Current State Analysis

- The report is a plain markdown file, written by the router at every end of a run (`finishRun`/`endRun`, and `archiveDone` for `--archive` runs). The output JSON carries its path as `report`. After an archive move it survives at `context/archive/<created>-<id>/agent-smith/report.md` (research section 1). Its first line is `# Run report: <id>` (`route.mjs:217`).
- The router has never made a network call. Its only `child_process` use is `git`, through `runGit`, which uses no shell, sets a timeout, never throws and maps `ENOENT` to status 127 (research section 2). ADR-003 already places `gh` calls outside the router's write rule.
- `SKILL.md` lists `Bash`, `TaskCreate`, `TaskUpdate` and `TaskList` in `allowed-tools`, parses `--archive` in Start step 1 and has `done`, `archive` and `halt` branches that point at `report`.
- `archive.test.mjs` has a recording `/bin/sh` shim on `PATH` for `git`; `helpers.mjs` has `makeProject`/`cleanupAll`. There is no `gh` test double yet.
- Roadmap S-05 has one open unknown: can the pipeline reach the pull request when it finishes? Feasibility is now evidenced: from the Bash tool in this harness (sandboxed, `gh` 2.103.3) `gh pr view` reaches GitHub, and `gh api --paginate repos/cli/cli/issues/14090/comments` returned 183 comments across several pages, one compact JSON object per line (plan review, repeated while revising this plan with the final projection). `gh pr view` behavior for no PR, not authenticated, not a repo and merged PR was verified by research. Writes (POST, PATCH, `-F body=@file`) are still verified only by the fake until Phase 4.
- Parallel changes S-06 (`compare` command) and S-07 (pre-plan steps in `decide()`) edit `route.mjs`, `policy.json`, `README.md`, `SKILL.md`, `AGENTS.md` and ADR-003. This plan touches none of `route.mjs`, `policy.json` or the "How the tier moves" list, and puts every edit to a shared file in a new, separate bullet, group or section (see "Edit discipline").

## Desired End State

- `node skills/10x-pipeline/scripts/pr-comment.mjs <change-id> [--report <path>]` prints exactly one JSON object `{ "posted", "action", "reason", "url", "pr", "match" }` and exits 0 for every runtime outcome. Exit 2 is for usage errors only.
- With a fake `gh`, a test run covers each outcome: skip (no gh, not authenticated, no PR, PR not open, unsupported host, bad JSON, unreadable or foreign report, timeout, failed comment lookup, failed write, internal error), create, update by marker and author, update by marker only when `/user` fails, no update of foreign, unmarked or other-change comments, two changes on one PR, mention neutralization, body cap.
- `SKILL.md`, `README.md`, `AGENTS.md` and `docs/ADR/ADR-003-rigor-gated-routing.md` document the flag, the script and its rules. The full suite `node --test skills/10x-pipeline/test/*.test.mjs` passes.
- Opt-in read-only live tests (`GH_LIVE=1`) check the real `gh` projection against a public issue and the real no-PR skip. They are skipped in the default suite, so they are Manual rows: a human runs them (rows 1.9, 2.9, 4.16). A human also verified the write path once against a real throwaway PR (Phase 4).

### Key Discoveries:

- `gh pr view` with no argument resolves the PR from the branch and handles forks; it also returns merged PRs, so `state` must be `OPEN` (research section 3).
- `gh pr comment --edit-last` edits the human's own last comment when the token is the human's, so update-in-place needs a marker plus author match through the REST API (research section 5).
- Nothing may be written under `context/changes/<id>/` after the pre-archive commit, and `meta.json`/`run.jsonl` are router-owned, so the "already posted" state lives on GitHub (research sections 5, 6).
- A fake `gh` returns canned output whatever the `--jq` filter is, so any logic inside the filter is untested. The filter therefore only projects and bounds; every decision is made in JS (F1).
- The shim pattern for a recording fake on `PATH` already exists (`archive.test.mjs`, git shim test).

## What We're NOT Doing

- No change to `route.mjs`, `policy.json`, `plugin.json`, `marketplace.json`. No `meta.json` field for the flag (A2, A15). No new policy key (A6).
- No subagent, model, tier or prompt for posting (A8). No new rule-form prompt.
- No default-on posting (A1). No posting of halts that have no `report` (missing result file, guard halts, usage errors).
- No writing of the post result into `report.md`, `meta.json`, `run.jsonl` or anything under the change folder. The result goes into the orchestrator's final message only.
- No `gh` login or token handling, no `--web`, no review, merge, close or delete calls. No comment history (one comment per change per PR, updated in place).
- No GitHub Enterprise support: a PR host other than `github.com` is a skip (`unsupported host`). There is no evidence a host is available to test against, so no `--hostname` plumbing (A14).
- No verification of forked-branch PRs against a real fork. The script derives the repository from the PR url, not from the working directory, and a fake test proves that derivation; the real fork behavior of `gh pr view` is recorded as unverified (Phase 4).
- No `#123` cross-reference neutralization (no notification; out of scope).
- No `git push`, no PR creation. A run with no PR skips; the user opens a PR and re-runs the documented command.

## Implementation Approach

A single new script plus a new test file, then docs and a loop edit. Four phases, each leaving the suite green:

1. Script skeleton: CLI, `gh` runner, report checks, PR lookup, skip classification, fake-`gh` test double, tests for every skip, one live read-only test (a human runs it).
2. Posting: body (marker, mention neutralization, cap), viewer login, comment lookup with a projecting filter and JS marker matching, create or update, argv audit, no-write audit, mutation test, router-has-no-`gh` guard, live projection test (a human runs it).
3. Wiring and docs: `SKILL.md` task item and loop pointers, README, AGENTS.md, ADR-003 section, docs consistency tests.
4. Real-PR verification: Manual rows for the write path that only a real PR can prove, plus a final automated gate.

Branch-base gate (used by every "untouched" row; written once here). It has a fixed preamble `PRE`:

`BASE=$(git merge-base main HEAD) && test -n "$BASE" && test "$(git rev-parse --abbrev-ref HEAD)" != main || { echo "branch-base gate: needs a local main and a feature branch" >&2; false; }`

and a check after it, joined with `&&`. `PRE` fails, with that message on stderr, when there is no local `main` (git also prints `fatal: Not a valid object name main`), when `BASE` is empty, and when the work is on `main` itself, where every diff against the merge-base would be empty by construction. The route and policy check is `PRE && test -z "$(git diff --name-only "$BASE" -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json)"`. The gate compares the merge-base with the working tree, so it sees earlier phase commits and uncommitted edits alike. `git diff HEAD` is not used: `/10x-goal-implement` commits each phase, so after the first phase `HEAD` equals the working tree and the diff is empty by construction. `HEAD` equal to `main` is allowed (a fresh feature branch before its first commit), which is why `PRE` tests the branch name and not the commit. Checked in a scratch repository: on `main` it fails; on a clean feature branch it passes; with `route.mjs` edited it fails; with the local `main` renamed it fails; the SKILL.md word check (row 3.5) passes on a clean diff and fails on an added `tier`.

Script contract (used by all phases):

- Usage: `node pr-comment.mjs <change-id> [--report <path>] [--timeout-ms <n>]`, run from the project root. `<change-id>` must match `^[a-z0-9][a-z0-9-]{0,99}$` (it goes into the marker, which must fit the 200-character comment head). `--report` defaults to `context/changes/<id>/agent-smith/report.md`. `--timeout-ms` defaults to 20000 per `gh` call (constant, A6).
- Report checks, before any `gh` call: a `--report` path is resolved with `path.resolve`; unless `path.basename(p) === "report.md"` and `path.basename(path.dirname(p)) === "agent-smith"`, it is a usage error (exit 2; the script posts only router reports, A13; `xagent-smith/report.md` is refused, a string-suffix test would accept it). The file must exist and be non-empty, and its first line must be `# Run report: <id>`, else skip.
- Result JSON: `action` is `created`, `updated` or `skipped`; `posted` is true for the first two; `reason` is a short string for `skipped` and `null` otherwise; `url` is the comment `html_url` or `null`; `pr` is the pull request url once known, else `null`; `match` is `"author"` or `"marker-only"` for `updated`, else `null`.
- `gh` calls: `spawnSync` with an argv array (no shell), a timeout, `GH_PROMPT_DISABLED=1`, never throws. `ENOENT` is "gh not installed"; a timeout is "gh timed out".
- Allowed `gh` calls only: `pr view --json number,url,state,isDraft`; `api user --jq .login`; `api --paginate repos/<o>/<r>/issues/<n>/comments --jq <COMMENT_JQ>`; `api --method POST repos/<o>/<r>/issues/<n>/comments -F body=@<file> --jq .html_url`; `api --method PATCH repos/<o>/<r>/issues/comments/<id> -F body=@<file> --jq .html_url`. At most four calls per run. The body goes in a temp file, never in argv, and the temp directory is removed in a `finally`.
- `COMMENT_JQ` is the exported constant `.[] | {id: .id, login: .user.login, head: ((.body // "") | .[0:200])}`: it projects and bounds, nothing else. The script exports `COMMENT_JQ` and runs `main()` only when it is the entry point (`fs.realpathSync(process.argv[1])` equals the file path of `import.meta.url`, which also holds when a test copies the script into a temp directory). This lets the live test run the real filter without a second copy.
- Marker: first line of the body is `<!-- agent-smith:pr-report change=<id> -->`, then a blank line, then the report. A comment matches when `head.startsWith(marker)`, where `marker` is that line without any line ending. No newline is part of the match: a comment edited in the GitHub web UI is stored with CRLF line endings, so its head is `<marker>\r\n...` and a match on `marker + "\n"` would miss it and the next run would post a duplicate. The closing ` -->` makes `change=a` and `change=ab` distinct.
- Top level: all work runs inside one `try/catch`; an unexpected exception is a skip `internal error: <first line of message>` and exit 0.

## Assumptions (decided without a human)

Each can be reversed after the fact; "reversal cost" is the work to change it.

- **A1 Opt-in `--pr-comment`, default off.** Evidence: `--archive` precedent (ADR-003), the comment is visible to collaborators and carries goal text, FR-005's own wording is conditional on access. Cost of the default: the PRD success criterion says the report "is posted as a comment" (`prd.md:48`), so with default-off that criterion is not met unless the user passes the flag. Owner confirmation is still pending, and the gap is also recorded in `change.md` Notes (F13). Reversal cost: low-to-medium. Default-on means SKILL.md parses `--no-pr-comment` instead and the script is unchanged, but the README text, ADR rule 1 and the docs tests flip with it.
- **A2 The flag lives at skill level, not in `meta.json`.** Evidence: posting needs no router state; avoids the `init` block and usage string that S-06/S-07 edit. Cost: a resume without the flag does not post. Durability across a long loop is handled by A15. Reversal cost: medium-to-high (router plumbing like `--archive`, echo in end actions, new tests, and a conflict with S-06/S-07 on the `init` block).
- **A3 Update in place by marker and author (one comment per change per PR).** Evidence: `--edit-last` hazard. Cost: the earlier text of a halted attempt is overwritten (GitHub keeps edit history). Reversal cost: low (drop the lookup, always POST).
- **A4 Draft PRs get the comment; merged and closed PRs are skipped.** Reversal cost: trivial (one condition).
- **A5 Halts that carry a `report` are posted.** Evidence: a halt is when a human most needs the report. Reversal cost: trivial (one sentence in SKILL.md).
- **A6 Cap (60000 UTF-16 code units, the unit of JavaScript `.length`), timeout (20 s) and the head length (200) are constants in the script; no `policy.json` block.** Evidence: not a routing decision; keeps `policy.json` out of the S-06/S-07 conflict zone. Code units, not code points: a cap of 60000 code points can reach 120000 code units for emoji text, and a code-unit cap is never larger than the code-point count, so it stays under GitHub's 65536-character limit however GitHub counts. The cut backs off one unit rather than split a surrogate pair. The 20 s timeout is per call and `--paginate` shares it across all pages, so a PR with hundreds of comments can end as `gh timed out`; that skip posts nothing and cannot duplicate. Reversal cost: low (add a `prComment` block and a small policy loader copy).
- **A7 Every `gh` failure is a skip with a reason; the script exits 0.** Evidence: roadmap risk text and PRD resolution (a missing PR only skips the comment).
- **A8 The orchestrator runs the script with Bash; no subagent.** Evidence: mechanical task, `Bash` already allowed. Reversal cost: high (policy step, tier, prompt, rule-form tests); not expected.
- **A9 (owner question: manual re-run) The README documents the manual re-run command, including `--report` for an archived report, and says to run it from the branch of the pull request.** Evidence: the branch-then-PR workflow of this repository means many runs end before a PR exists; the PR is whatever branch is checked out (F6), and the result prints the PR url so a wrong target is visible. Cost: none beyond docs.
- **A10 (owner question: integration tokens) When `gh api user` fails, match by marker only and report `match: "marker-only"`.** Evidence: research proposal. Known permanent effect: a marker comment planted by another user, with `/user` unavailable, makes every later run PATCH that foreign comment, fail and skip, with no POST fallback. Harmless, but it stays. The skip reason for a failed PATCH under `marker-only` says so: `comment request failed: <line> (a comment with this marker by another user may block updates)`. Reversal cost: trivial (return a skip instead).
- **A11 (owner question: mentions) `@name` mentions in the report are neutralized by inserting a zero-width space (`\u200b`) after `@` when `@` follows a non-word character or starts a line.** Evidence: the goal text is user text and a mention notifies a person. Emails (`a@b.com`) are untouched. In code and tests the character is always written as the escape `\u200b`, never as a literal invisible character. Reversal cost: trivial.
- **A12 `--paginate` output is filtered by `gh api --jq` into one compact JSON object per comment (`id`, `login`, `head`), so the script never parses concatenated page arrays.** Status: verified against a real comment listing (183 comments over several pages, 183 parseable lines, null-safe `(.body // "")`). The live test, run by a human as row 2.9, repeats it.
- **A13 `--report` is accepted only for a file named `report.md` inside a directory named `agent-smith`, and only when the file's first line is `# Run report: <id>`.** Evidence: the argument is a text-built command line and the script publishes under the user's identity (F6). Reversal cost: trivial.
- **A14 No GitHub Enterprise support; a host other than `github.com` is a skip.** Evidence: the plan has no host to verify against, and untested host plumbing can only be wrong in production (F7). Reversal cost: low (add `--hostname` to the five calls and a test when someone has a host).
- **A15 The flag survives the loop as an explicit orchestrator task, not as `meta.json` state.** Cheapest option that needs no `route.mjs` edit. The other candidate, persisting `prComment` in `meta.json` and echoing it in the end actions, would edit the `init` flag parsing, the meta write, the usage string and the end-action output of `route.mjs`, which S-06 and S-07 also edit, and would reverse this plan's main merge-safety argument. The mechanism, hardened after review round 2 (F11):
  - The task subject is `PR comment: <change-id>` with the real id, so a task belongs to one change.
  - The state is read where it is used: each end branch (`done`, `archive`, `halt`) says to call `TaskList` and to do the PR comment step only when a task with that subject for this run's change id is open. The orchestrator no longer has to remember the flag, only to follow the branch text.
  - A task is session state, not run state, so a stale task must not post. A run started without `--pr-comment` calls `TaskList` at Start and marks any open `PR comment: <change-id>` task of the same change completed. A task of another change id is ignored and never completed. The step marks its own task completed after it runs, in every branch, including a halt without a report.
  - If `TaskCreate` or `TaskList` fails or is not available, the run prints `PR comment: skipped, task list unavailable` at Start, names the manual command, and posts nothing. This fails closed: ADR rule 1 (no flag, no post) holds even when the flag cannot be stored.
  - Residual risk, unchanged: whether the model follows the branch text across a 14-step loop with context compaction, and whether the task tools exist in every host, is not provable from here. The docs tests (3.1, 3.9) pin the wording; Phase 4 row 4.12 checks one short run only. Mitigation: the final message always prints a `PR comment:` line when the flag was given, so a silent skip is visible as a missing line, and the README documents the manual command. If a silent skip is ever observed, switch to the `meta.json` option.

## Phase 1: Script skeleton, report checks, PR lookup and skips

### Overview

Create the script with the CLI, the `gh` runner, the report checks and the PR lookup, and a test double for `gh`. Everything up to "an open PR was found" works; the script reports `skipped` with `reason: "posting not implemented"` when it would post. Phase 2 replaces that stub.

### Changes Required:

#### 1. The script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: Parse arguments, check and read the report, run `gh pr view`, classify the outcome, print one JSON object. Plain ES module, 2-space indent, double quotes, semicolons, `node:` imports only, Node 18.

**Contract**: The CLI, report checks and result JSON in "Implementation Approach". Skip reasons (stable strings tests check by substring): `gh is not installed`, `gh is not authenticated`, `no pull request for this branch`, `not a git work tree`, `pull request is <STATE>` (any state other than `OPEN`), `unsupported host <host>`, `gh timed out`, `gh pr view failed: <first stderr line, at most 200 characters>`, `unexpected gh output`, `report not found: <path>`, `report is empty`, `report is not a run report for <id>`, `internal error: <first line>`. When `report not found` names the default path, the reason ends with a hint: `after an archive pass --report context/archive/<date>-<id>/agent-smith/report.md`. Classification: `ENOENT` is not installed; exit 4 or stderr containing `gh auth login` is not authenticated; stderr containing `no pull requests found` is no PR; stderr containing `not a git repository` is not a work tree. The `url` of the PR is parsed with `^https://([^/]+)/([^/]+)/([^/]+)/pull/(\d+)` into host, owner, repo, number; a mismatch is `unexpected gh output`; a host other than `github.com` is `unsupported host <host>`. Usage errors (missing or invalid id, unknown flag, non-numeric `--timeout-ms`, `--report` path that is not a file named `report.md` inside a directory named `agent-smith`) print the usage line to stderr and exit 2. The script never writes under the project root.

#### 2. The test double and tests

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: A hermetic suite. A `/bin/sh` shim named `gh` in a temp `bin` directory, first on `PATH`. It picks canned answers from a directory named by `FAKE_GH_DIR` by call kind (`pr-view`, `user`, `comments`, `post`, `patch`; each kind has optional `.code`, `.out`, `.err`, `.sleep` files), logs argv with a unit-separator format like the git shim test, and copies the `-F body=@file` file to `body-<n>.txt` while it still exists. Skipped on Windows (`process.platform === "win32"`). Uses `makeProject` and `cleanupAll` from `helpers.mjs`; adds no helper there. Report fixtures start with `# Run report: <id>`.

**Contract**: Phase 1 tests:
- Skips: no `gh` on `PATH` (empty bin directory); exit 4; exit 1 with `no pull requests found`; exit 1 with `not a git repository`; invalid JSON on stdout; `state` `MERGED` and `CLOSED`; PR url on `ghe.example.com` is `unsupported host`; `pr view` sleeps past `--timeout-ms 200`; missing report (default path carries the archive hint) and empty report; a report whose first line names another change id.
- Usage errors exit 2 with no JSON on stdout: missing id, bad id, an id of 101 characters, unknown flag, non-numeric `--timeout-ms`, `--report /tmp/x/notes.md`, `--report` with a directory named `other` containing `report.md`, and `--report` with a directory named `xagent-smith` containing `report.md` (a string-suffix check would accept it).
- No `gh` call is logged when the report check fails (the script reads the report first).
- Output is always one parseable JSON object and exit 0 for every skip.
- Live, opt-in, run by a human (row 1.9): the test name starts with `live:`. Without `GH_LIVE=1` it is skipped. With `GH_LIVE=1` it first asserts that `gh` is on `PATH` and that `gh auth status` exits 0, and fails with a message if not, so a human run cannot pass by skipping. Then: scratch git repo with `origin` set to `https://github.com/cli/cli.git` and a fresh branch `agent-smith-live-<random>`, a report fixture; the script prints `skipped` with `no pull request for this branch` and exits 0 (read-only, one GET).
- Real `gh`, no network needed, skipped when `gh` is missing (its name does not contain `live`, so the `GH_LIVE=1` pattern run does not select it): run with `GH_CONFIG_DIR=<empty dir>`, `GH_TOKEN=` and `GITHUB_TOKEN=` in a scratch git repo with a `github.com` origin; expect `gh is not authenticated`. If `gh` checks the repository before authentication, the test records the observed reason and the plan row is fixed in the same commit.

### Success Criteria:

#### Automated Verification:

- Phase 1 tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The script imports only `node:` built-ins, in any import form: `! grep -hoE 'from "[^"]+"' skills/10x-pipeline/scripts/pr-comment.mjs | grep -v '^from "node:'` and `! grep -nE '^import "|\bimport\(|\brequire\(' skills/10x-pipeline/scripts/pr-comment.mjs`
- No Node 19+ API in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy untouched since the branch base: the branch-base gate in "Implementation Approach" exits 0
- Usage error exits 2: `node skills/10x-pipeline/scripts/pr-comment.mjs; test $? -eq 2`

Row 1.5 and the matching rows in later phases use the branch-base gate (with its `PRE` preamble), not `git diff HEAD`.

#### Manual Verification:

- Live read-only check, run by a human with network and an authenticated `gh` (an unattended `/10x-goal-implement` run cannot do this, and a skipped live test exits 0, so it cannot be an Automated gate): `GH_LIVE=1 node --test --test-name-pattern "live" skills/10x-pipeline/test/pr-comment.test.mjs`. Expected: the no-PR skip test reports `ok`, none `skipped`. (The former Automated row 1.8 is now this row, 1.9.)

---

## Phase 2: Create or update the comment

### Overview

Replace the stub: build the body, find the viewer and any earlier comment, and POST or PATCH. Add the argv audit, the no-write audit, the mutation test, the live projection check and the guard that the router stays free of `gh`.

### Changes Required:

#### 1. Posting in the script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: After an open PR is found: build the body, write it to a temp file, resolve the viewer login, list comments through the projecting filter, match the marker in JS, then PATCH the first match or POST a new comment. Print `created` or `updated` with the comment `url` and the `pr` url.

**Contract**:
- Body = marker line + blank line + report text with mentions neutralized (A11: `/(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])/g` replaced with `"$1@\u200b"`). If the result is longer than 60000 UTF-16 code units (`.length`, A6), keep the first 60000, backing off one unit when the cut would split a surrogate pair, and append a blank line and `Report truncated: <n> characters omitted.`, where `<n>` is the number of code units removed (`result.length - kept.length`); the marker line is always kept.
- Viewer: `gh api user --jq .login`. Failure or empty output means `login = null` (A10).
- Lookup: `gh api --paginate repos/<o>/<r>/issues/<n>/comments --jq <COMMENT_JQ>`, parsed line by line (A12). Unparseable lines and lines without a numeric `id` are ignored. An entry matches when `head.startsWith(marker)` for this change's marker (no newline in the match, so a CRLF head from a web edit still matches). A failed lookup is a skip (`comment lookup failed: ...`) and posts nothing, so a transient error cannot create a duplicate.
- Match: with a known viewer, the first matching entry (lowest `id`) whose `login` equals the viewer, `match: "author"`; otherwise with `login = null`, the first matching entry, `match: "marker-only"`. No match means POST. The author comparison is one line, `c.login === viewer`, so the mutation test can target it.
- Write failure (`POST`/`PATCH` non-zero, empty URL output) is a skip (`comment request failed: <first stderr line>`, with the A10 suffix for a failed marker-only PATCH).
- Temp file lives in `fs.mkdtempSync(path.join(os.tmpdir(), "as-prc-"))` and is removed in a `finally`.

#### 2. Tests

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Cover every posting outcome with the fake, and audit what the script and the router are allowed to do.

**Contract**: the fake `comments` output holds projected lines `{"id":..,"login":..,"head":..}`, so marker selection is the script's own behavior.
- Create: open PR, no marker comments, `POST` argv path equals `repos/<o>/<r>/issues/<n>/comments` from the PR url (not the cwd's repo); the captured body starts with the marker line and holds the report bytes after one blank line; output `created` with the comment url and the `pr` url.
- Draft PR (`isDraft: true`, `OPEN`) posts.
- Update: marker comment by the viewer yields `PATCH repos/<o>/<r>/issues/comments/<id>` and no `POST`, `match: "author"`; marker comment by another login yields `POST`; an unmarked comment by the viewer yields `POST`; two marker entries by the viewer patch the lowest id; with change ids `a` and `ab`, a head carrying the `ab` marker is not patched by a run for `a` and the reverse; a marker for a different change id by the viewer is not patched; a head with the marker not at the start (quoted inside text) is not patched; a head that is the marker followed by `\r\n` and report text, by the viewer, is patched (a comment edited in the web UI), with no `POST`.
- `user` call fails: a marker entry is patched with `match: "marker-only"`; if that PATCH then fails, the reason carries the A10 suffix.
- Internal error: `TMPDIR` points at a nonexistent directory with a valid open PR fixture, so `mkdtempSync` throws; expect `skipped` with `internal error`, exit 0, one JSON object.
- Lookup output with a garbage line and a line missing `id`: ignored, the rest is used.
- Failures: lookup exits non-zero → skipped, no `POST`/`PATCH` in the log; `POST` fails → skipped with `comment request failed`; empty URL output → skipped.
- Body: a report with `@alice`, `(@bob)` and `a@b.com` — the captured body has `"@\u200balice"` and `"@\u200bbob"` and keeps `a@b.com`; a report of 70000 ASCII characters is cut so the captured body, without its truncation line, is exactly 60000 code units, still starts with the marker, and the `<n>` in the line equals the code units removed; a report of repeated `"\u{1F600}"` cut at the cap leaves no lone surrogate in the captured body and the captured body's `.length` stays below 65536 (the GitHub limit).
- Argv audit: every logged call is `pr view` or `api`; with `api`, the only methods are the default (GET), `POST` and `PATCH`; no argv contains `merge`, `close`, `review`, `--web`, `--editor`, `--input`, `--hostname`, `DELETE`, or the body text; the body is only ever passed as `-F body=@<path>`; each `api` path starts with `repos/` or is `user`; no run logs more than four calls; the temp directory is gone after the run.
- No write under the project root: a content hash snapshot of the scratch project tree (all files, recursive) before and after a create run, an update run and a skipped run is identical.
- Mutation test (replaces "run once by hand and revert"): the test copies `pr-comment.mjs` to a temp directory, replaces the single occurrence of `c.login === viewer` with `true` (failing loudly if the pattern is not found exactly once), runs the "marker comment by another login" scenario against the copy, and expects the original script to `POST` and the mutant to `PATCH`. This is the deliberate-break gate for the author check, repeatable and independent of the implement skill.
- Guard: `route.mjs` contains no `gh` invocation (`!/["'`]gh["'`]/.test(source)`) and `policy.json` has no `prComment` key.
- Live, opt-in, run by a human (row 2.9); the test name starts with `live:`; skipped without `GH_LIVE=1`; with `GH_LIVE=1` it first asserts `gh` is on `PATH` and `gh auth status` exits 0, and fails otherwise: import `COMMENT_JQ` and run the real `gh api --paginate repos/cli/cli/issues/14090/comments --jq <COMMENT_JQ>`; assert more than 30 output lines (so more than one page was concatenated), every line parses as JSON with a numeric `id`, a string-or-null `login` and a `head` of at most 200 characters, and no line is split across lines.

### Success Criteria:

#### Automated Verification:

- All script tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- No Node 19+ API in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy untouched since the branch base: the branch-base gate in "Implementation Approach" exits 0
- Deliberate-break check, automated: the mutation test above passes (the mutant behaves differently from the script)
- No write under the project root and no call outside the allowed list: the tree-snapshot and argv-audit tests pass (run as part of `node --test skills/10x-pipeline/test/pr-comment.test.mjs`)

Row 2.4 uses the branch-base gate (with `PRE`). Row 2.5 is now the mutation test. The former row 2.8 (live projection) is now the Manual row 2.9.

#### Manual Verification:

- Live projection check, run by a human with network and an authenticated `gh`: `GH_LIVE=1 node --test --test-name-pattern "live" skills/10x-pipeline/test/pr-comment.test.mjs`. Expected: the projection test reports `ok` (so more than one page was read), none `skipped`. This closes A12 for the record; the default suite still covers marker matching with the fake.

---

## Phase 3: Wire the flag into the loop and document it

### Overview

Add the flag to the orchestrator and document the script, its rules and the manual re-run command. Small, separate edits only (S-06 and S-07 edit the same files).

### Edit discipline

Every edit to a shared file is a new line, bullet, group or section at the anchor below, never a change inside a line another change is likely to edit. Where a line could have been extended, a new line is added instead. The anchors were checked against the plans of the two parallel changes (S-06 `baseline-usage-comparison`, S-07 `pre-plan-steps`) after review round 2 (F16) and chosen so that none sits at an anchor a sibling claims:

- S-06 claims: README between "Usage report:" and "Limits:"; AGENTS.md `route.mjs` Project Structure bullet (adds `compare`), a `baseline-policy.json` bullet after the `policy.json` bullet, the test list, the ADR range token, and a Commands bullet after the last bullet; `docs/ADR/ADR-005`. It leaves `SKILL.md` and ADR-003 alone.
- S-07 claims: README "Pre-plan steps" subsection before the "Override any policy key" paragraph and bullets at the end of "How routing works"; two new AGENTS.md Project Structure bullets; ADR-003 table row and a new section (no stated anchor); `SKILL.md` "How the tier moves" bullets after the archive bullet.

This change therefore uses:

- `SKILL.md`: `argument-hint` gains `[--pr-comment]` at its end; a new line `PR_COMMENT=...` directly after the `Router:` line; Start step 1 gains one sentence at its end (flag parsing); a new Start step 4 after step 3; a new section `## PR comment (opt-in)` placed immediately before `## Rules`; one new continuation line under each of `done`, `archive` step 1 and `halt` (new lines, not edits of the existing long lines); one new bullet in `## Rules`. "How the tier moves" is untouched.
- `README.md`: the skill heading line gains `[--pr-comment]` at its end; a new group `PR comment (opt-in):` after the last bullet of the `Limits:` group and before `## Layout`. That spot is claimed by neither sibling (S-06 is before `Limits:`, S-07 before "Override"). Its first bullet states the `gh` requirement, so the Requirements list stays unedited. There is no Layout line: the Layout block lists directories and `skills/10x-pipeline/` already covers `scripts/`.
- `AGENTS.md`: one new Hard Rules bullet directly after the router git-writes bullet (neither sibling edits Hard Rules); one new Commands bullet directly after the `risk` bullet (S-06 appends after the last bullet, `verify-archive`, one line further down). No Project Structure bullet and no edit of its `route.mjs`, `test/` or `ADR` lines: both siblings edit that list, so the Hard Rules and Commands bullets name `scripts/pr-comment.mjs` and `test/pr-comment.test.mjs` instead.
- `docs/ADR/ADR-003-rigor-gated-routing.md`: one new `### PR comment` section placed after `### Archive adapter` and immediately before `## Alternatives considered`, with no edit of the Context table. S-07's section may land at the same spot; on a merge conflict there keep both sections (they are independent).
- `context/foundation/roadmap.md`: not edited by this change's plan commits. It is identical to `main` in this branch. Status tracking belongs to the commit that closes or merges the change; the implement skill's best-effort status sync, if it runs, is the only edit, and it is forward-only.

### Changes Required:

#### 1. Orchestrator loop

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Parse `--pr-comment`, keep the request alive for the whole loop as a task that names the change, run the script at the right moment in `done`, `archive` and `halt`, make sure a stale task cannot post, and forbid any other posting. Do not touch "How the tier moves". Name no model, effort or tier in any line this change adds, and do not use those three words either (a grep for them must not match the added lines).

**Contract**:
- Frontmatter `argument-hint` becomes `<change-id> [goal text] [--archive] [--pr-comment]`.
- Under the Router line add `PR_COMMENT=<this skill's base directory>/scripts/pr-comment.mjs`.
- Start step 1, one added sentence: also parse `--pr-comment` the same way, remove it from the goal text, and never pass it to `init`.
- New Start step 4 (after `init`, before the first loop action): call TaskList.
  - With `--pr-comment`: if no open task has the subject `PR comment: <change-id>` (the real id), call TaskCreate once with that subject and a description that restates the rule: when the router returns `done`, `archive`, or `halt`, call TaskList, and when this task is open do the PR comment step once, then mark this task completed. This is the only place the request is stored; do not rely on remembering it.
  - Without `--pr-comment`: mark any open task with the subject `PR comment: <change-id>` completed, so a task left by an earlier invocation cannot post. Ignore a task whose subject names another change id; never complete it.
  - If TaskList or TaskCreate fails or is not available: print `PR comment: skipped, task list unavailable (run the script by hand after the run, see the README)` once, and do not run the PR comment step in this run.
- New section `## PR comment (opt-in)` before `## Rules`: the PR comment step runs only when TaskList shows an open task with the subject `PR comment: <change-id>` for this run's change id. Run `node $PR_COMMENT <change-id>` from the project root once, print one line `PR comment: <action>, <url or reason> (PR <pr url or none>)`, then mark the task completed. In `archive` it runs at the end of step 1, before the archive subagent and so before the move. A halt without `report` posts nothing: print `PR comment: skipped, no report` and complete the task. A skip is not a failure of the run and is never retried. This is the only place `node $PR_COMMENT` appears.
- One new continuation line under each branch: under `done`, `archive` step 1 and `halt`: "Call TaskList. When a task with the subject `PR comment: <change-id>` for this run is open, do the PR comment step." (for `halt`, add "before you STOP"). Each pointer holds the phrase `PR comment step` once.
- One new Rules bullet: only `$PR_COMMENT` may post a comment; never run `gh` yourself; never write the result into the change folder.

#### 2. README

**File**: `README.md`

**Intent**: Document the flag, the requirement and the manual re-run.

**Contract**: placement as in "Edit discipline". Heading line gains `[--pr-comment]`. The `PR comment (opt-in):` group covers: `gh`, authenticated, needed only with the flag; opt-in and why; the marker and update in place (a web edit of the comment is still found); the skip reasons, including unsupported hosts (no GitHub Enterprise), `gh timed out` (a PR with hundreds of comments can exceed the 20 s call limit while the comment list is read; the skip posts nothing and cannot duplicate) and `task list unavailable`; halts with a report are posted; the mention neutralization and the 60000-code-unit cap; nothing is written to the change folder, so the report cannot say whether it was posted; `--report` accepts only a router `report.md` (a file of that name inside a directory named `agent-smith`); the manual command `node <plugin>/skills/10x-pipeline/scripts/pr-comment.mjs <change-id> [--report context/archive/<date>-<change-id>/agent-smith/report.md]` for a run that ended before the PR existed, which posts to the pull request of the branch currently checked out, so run it from the branch of that pull request (the result prints the PR url); that the orchestrator prints a `PR comment:` line when the flag was given and that a missing line means the step was dropped; the minimal fine-grained token permission once Phase 4 records it.

#### 3. Agent guidelines

**File**: `AGENTS.md`

**Intent**: Keep the repository rules true.

**Contract**: placement as in "Edit discipline". Hard Rules bullet: the router never calls `gh`; `skills/10x-pipeline/scripts/pr-comment.mjs` is the only code that posts, its only network writes are one issue comment, created or edited, on an open `github.com` PR of the current branch, identified by the marker, and it never writes under the project root. Commands bullet for `pr-comment.mjs <id> [--report <p>]`, naming its test file `test/pr-comment.test.mjs` and noting that `GH_LIVE=1` enables the read-only live tests (a human runs them).

#### 4. ADR

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the decision next to the archive adapter, with rule lines in ADR-004 form.

**Contract**: a new `### PR comment` section after `### Archive adapter` and immediately before `## Alternatives considered`: the decision (separate script, opt-in, skill-level flag kept as a task that names the change), the allowed `gh` calls, the timing rule (before the archive move), alternatives considered (router posts, subagent posts, `--edit-last`, flag in `meta.json`) in one short list, and exactly seven rule lines, each one line of the form `- **GIVEN** ... **WHEN** ... **THEN** ... **MUST|MUST NOT** ...` (one bold keyword, ADR-004). The seven lines, verbatim:

- **GIVEN** a run started without `--pr-comment` **WHEN** the run ends **THEN** the orchestrator **MUST NOT** call `pr-comment.mjs`.
- **GIVEN** the router runs any command **WHEN** it handles a step **THEN** it **MUST NOT** call `gh`.
- **GIVEN** `pr-comment.mjs` cannot reach an open pull request **WHEN** it handles the failure **THEN** it **MUST** skip the comment and exit 0.
- **GIVEN** the script finds a marker comment by the viewer **WHEN** it posts **THEN** it **MUST** edit that comment instead of creating another.
- **GIVEN** the script posts **WHEN** it builds the body **THEN** it **MUST NOT** pass the body as a command argument.
- **GIVEN** `--report` does not name a file `report.md` inside a directory `agent-smith` **WHEN** the script starts **THEN** it **MUST** refuse it as a usage error.
- **GIVEN** the script has run **WHEN** the orchestrator records the result **THEN** it **MUST NOT** write under `context/changes/<id>/`.

#### 5. Docs consistency tests

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Catch drift between the skill, README, ADR and script without a new test file, and replace the manual reading of `SKILL.md`. Branches of `SKILL.md` are sliced from the line starting `- **\`done\`**` (and `archive`, `halt`) to the next line that starts with `- **` or `## `.

**Contract**: tests read the repo files and assert:
- `SKILL.md` `argument-hint` contains `--pr-comment`; it defines `PR_COMMENT=`; it never contains the text `gh pr` or `gh api`.
- `SKILL.md` contains `node $PR_COMMENT` exactly once, and that occurrence lies inside the `## PR comment (opt-in)` section, which precedes `## Rules`.
- The Start section (up to `## Loop`) contains `TaskList`, `TaskCreate`, `--pr-comment`, the subject format `PR comment: <change-id>`, the fallback text `task list unavailable`, the word `completed` and the words `another change`.
- Each of the `done`, `archive` and `halt` branches contains the phrase `PR comment step` exactly once, `TaskList` exactly once and the subject format `PR comment: <change-id>` exactly once; in the `archive` branch the phrase appears before the text `Call the Agent tool` (before the archive subagent runs).
- The `## PR comment (opt-in)` section contains `TaskList` and the subject format.
- Every `SKILL.md` line that contains `PR_COMMENT`, `--pr-comment` or `PR comment` has none of the words `sonnet`, `opus`, `haiku`, `fable`, `effort`, `tier` (case-insensitive, whole word).
- README mentions `--pr-comment`; its `PR comment (opt-in):` group lies after `Limits:` and before `## Layout`.
- The ADR has `### PR comment` after `### Archive adapter` and before `## Alternatives considered`. In that section exactly seven lines contain `**GIVEN**`, and each of the seven lines of the ADR contract above (held as constants in the test) appears once. `rules.test.mjs` checks the form of each of them; this test checks that they exist and are counted, since `rules.test.mjs` skips a line without `**GIVEN**` (F14).
- `AGENTS.md` names `pr-comment.mjs` in Hard Rules and in Commands, and `pr-comment.test.mjs` in Commands.
- The existing `rules.test.mjs` ADR check covers the new rule lines (no edit to `rules.test.mjs`).

### Success Criteria:

#### Automated Verification:

- Docs consistency tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Router and policy untouched since the branch base: the branch-base gate in "Implementation Approach" exits 0
- `SKILL.md` lines added by this branch name no model, effort or tier: `PRE && ! git diff -U0 "$BASE" -- skills/10x-pipeline/SKILL.md | grep -E '^\+[^+]' | grep -iwE "sonnet|opus|haiku|fable|effort|tier"` exits 0, with `PRE` the preamble of the branch-base gate (an empty `BASE`, a missing local `main` or work on `main` fails loudly instead of passing; the added lines avoid those words, so the check cannot fail on an innocent sentence)
- `init` and `status` still print valid JSON in a scratch change folder (AGENTS.md Testing): `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` then `... status demo | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` in a scratch project
- SKILL.md loop structure (former Manual 3.7): the docs test in 3.1 passes for the single `node $PR_COMMENT`, the three `PR comment step` pointers with `TaskList` and the subject format, the Start step 4 wording and the archive order; run on its own: `node --test --test-name-pattern "SKILL.md" skills/10x-pipeline/test/pr-comment.test.mjs`

#### Manual Verification:

- README and AGENTS.md read correctly next to the S-06 and S-07 edits if they have merged (resolve textual conflicts without dropping either side)

**Implementation Note**: After this phase and its automated checks pass, pause for the manual confirmation before Phase 4. Before Phase 4 a human also runs the two live rows, 1.9 and 2.9, so the read-side shapes (A12) are confirmed against the real `gh` before the write path is tried.

---

## Phase 4: Verify against a real pull request

### Overview

A fake `gh` proves the script's logic and the live read-only tests (run by a human, rows 1.9 and 2.9) prove the read shapes. This phase checks the write path, which only a real PR and token can prove, and closes the loop with a real pipeline run.

### Changes Required:

#### 1. Findings

**File**: `context/changes/pr-comment-report/plan.md`

**Intent**: Record what the real PR showed. If a call shape differs (`-F body=@file`, POST or PATCH output), fix the script in a follow-up commit within this change and add a test that captures the real shape.

**Contract**: no code change expected. When a finding changes the script, add one dated line to this Findings block, under this heading. Nothing is added inside `## Progress`: `references/progress-format.md` allows only headings and bullets there and says a changed intent gets an inline note in the Phase block (F17).

Not verified by design (listed here, not in Progress; recorded in the final message of the change): a forked-branch PR (`isCrossRepository`) posting to the base repository, and a GitHub Enterprise host. The first is covered by the fake test that the API path comes from the PR url, not the working directory; the second is a skip (A14).

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- No Node 19+ API anywhere in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy have no change from this branch: `PRE && test -z "$(git log main..HEAD --format=%h -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json)"` exits 0, with `PRE` the preamble of the branch-base gate in "Implementation Approach" (it fails loudly on `main` or without a local `main`, where `main..HEAD` is empty by construction)

#### Manual Verification:

- Live read-only checks pass again at the end, run by a human with network and an authenticated `gh`: `GH_LIVE=1 node --test --test-name-pattern "live" skills/10x-pipeline/test/pr-comment.test.mjs`. Expected: both live tests report `ok`, none `skipped` (the former Automated row 4.15 is now this row, 4.16)
- On a throwaway open PR, a first run of the script creates one comment that starts with the marker (hidden in the rendered view), and the tables of the report render
- A second run updates the same comment and creates no new one; the PR shows one agent-smith comment and a comment edit history
- With the human's own comment as the last comment on the PR, the script does not touch it
- A body written with `-F body=@file` arrives byte for byte (newlines and pipe tables intact, no trailing change)
- With a fine-grained token, record the minimal permission that works (pull requests or issues write) in the README; an integration token without `/user` updates with `match: "marker-only"`
- A real pipeline run with `--pr-comment` on a lean change with an open PR posts at `done`; with `--archive --pr-comment` the comment appears before the archive step and the archive folder gets no new file; the final message has the `PR comment:` line. Also check the task wording once: a second invocation of the same change without `--pr-comment` posts nothing, and one for a different change id does not use the first change's task (F11)

**Implementation Note**: This phase needs a real token and PR; `/10x-goal-implement` leaves these rows for the human.

---

## Testing Strategy

### Unit Tests:

- `pr-comment.test.mjs` drives the real script through the CLI against a fake `gh` on `PATH`, in scratch projects from `helpers.mjs`. Windows is skipped, as the git shim test is.
- Every skip reason, create, update, no-update of foreign, unmarked and other-change comments (marker matching runs in the script), update of a CRLF-head comment, marker-only match, mention neutralization, body cap in UTF-16 code units without a lone surrogate, argv audit, no-write audit, mutation test of the author check, router has no `gh`, docs consistency.

### Integration Tests:

- The existing suite plus the docs consistency tests (which pin the `SKILL.md` task wording, the ADR rule-line count and the README anchor). Opt-in live read-only tests (`GH_LIVE=1`, run by a human as Manual rows 1.9, 2.9 and 4.16, and failing when `gh` is missing or unauthenticated) run the real `gh` for the no-PR skip and the comment projection over a 183-comment public issue. The not-authenticated skip runs in the default suite against a real `gh` with an empty config directory, when `gh` is installed.
- The full orchestrator loop is a subagent flow and has no automated test; Phase 4 Manual rows cover it, and the `SKILL.md` structure is checked by the docs tests.

### Manual Testing Steps:

1. Phase 4 rows on a throwaway PR.
2. After merge, run one real change with `--pr-comment` to confirm the flow end to end.

## Performance Considerations

At most four `gh` calls per post (`pr view`, `user`, comment lookup, one write), each with a 20 s timeout, so the worst case is about 80 s on a dead network. The orchestrator runs it once per end of run.

## Migration Notes

None. The flag is opt-in and nothing is stored. A project without `gh` is unaffected.

## References

- Related research: `context/changes/pr-comment-report/research.md`
- Plan review: `context/changes/pr-comment-report/reviews/plan-review.md`
- Roadmap item: `context/foundation/roadmap.md` (S-05); PRD FR-005: `context/foundation/prd.md`
- Shim pattern: `skills/10x-pipeline/test/archive.test.mjs` (git shim test); scratch projects: `skills/10x-pipeline/test/helpers.mjs`
- `runGit` model for a no-shell, timeout-bound, never-throwing runner: `skills/10x-pipeline/scripts/route.mjs`
- Archive precedent for opt-in outward actions: `docs/ADR/ADR-003-rigor-gated-routing.md` ("Archive adapter")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Script skeleton, PR lookup and skips

#### Automated

- [x] 1.1 Phase 1 tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs` — f5c4517
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — f5c4517
- [x] 1.3 The script imports only `node:` built-ins — f5c4517
- [x] 1.4 No Node 19+ API in the new files — f5c4517
- [x] 1.5 Router and policy untouched — f5c4517
- [x] 1.6 Usage error exits 2 — f5c4517

#### Manual

- [ ] 1.9 Live read-only check, run by a human: a branch with no PR skips with `no pull request for this branch` (`GH_LIVE=1`, test reports `ok`, not `skipped`)

### Phase 2: Create or update the comment

#### Automated

- [x] 2.1 All script tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [x] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [x] 2.3 No Node 19+ API in the new files
- [x] 2.4 Router and policy untouched
- [x] 2.5 Deliberate-break check: removing the author comparison makes the "another login yields POST" test fail
- [x] 2.7 No write under the project root and no call outside the allowed list: tree-snapshot and argv-audit tests pass

#### Manual

- [ ] 2.9 Live projection check, run by a human: the real `gh --jq` output over a 183-comment issue is one parseable object per line (`GH_LIVE=1`, test reports `ok`, not `skipped`)

### Phase 3: Wire the flag into the loop and document it

#### Automated

- [ ] 3.1 Docs consistency tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 3.2 ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 3.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.4 Router and policy untouched
- [ ] 3.5 `SKILL.md` names no model, effort or tier added by this change
- [ ] 3.6 `init` and `status` still print valid JSON in a scratch change folder
- [ ] 3.9 SKILL.md loop structure: one `node $PR_COMMENT`, three `PR comment step` pointers, archive pointer before the archive subagent

#### Manual

- [ ] 3.8 README and AGENTS.md read correctly next to the S-06 and S-07 edits if they have merged

### Phase 4: Verify against a real pull request

#### Automated

- [ ] 4.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 4.2 No Node 19+ API anywhere in the new files
- [ ] 4.3 Router and policy have no commit from this branch

#### Manual

- [ ] 4.4 First run on a throwaway open PR creates one marker comment and the tables render
- [ ] 4.5 Second run updates the same comment and creates no new one
- [ ] 4.6 The human's own last comment is not touched
- [ ] 4.9 A body written with `-F body=@file` arrives byte for byte
- [ ] 4.11 Fine-grained token permission recorded in the README; integration token without `/user` updates with `match: "marker-only"`
- [ ] 4.12 A real pipeline run with `--pr-comment`, and with `--archive --pr-comment`, posts before the archive step and adds no file to the archived folder
- [ ] 4.16 Live read-only checks pass again at the end of the change, run by a human (`GH_LIVE=1`, both live tests report `ok`, none `skipped`)
