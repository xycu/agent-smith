# PR Comment Report Implementation Plan

## Overview

Add an opt-in `--pr-comment` flag to `/agent-smith:10x-pipeline`. When the user passes it and a run ends with a `report`, the orchestrator runs a new dependency-free script, `skills/10x-pipeline/scripts/pr-comment.mjs`, with Bash. The script finds the open pull request of the current branch through `gh`, and posts the router's `report.md` as one comment, or edits its own earlier comment in place (found by a hidden marker). Any failure (no `gh`, not authenticated, no pull request, closed pull request, network, timeout) is a skip with a reason, never a halt. The router (`route.mjs`) and `policy.json` do not change. This is roadmap S-05, PRD FR-005.

## Current State Analysis

- The report is a plain markdown file, written by the router at every end of a run (`finishRun`/`endRun`, and `archiveDone` for `--archive` runs). The output JSON carries its path as `report`. After an archive move it survives at `context/archive/<created>-<id>/agent-smith/report.md` (research section 1).
- The router has never made a network call. Its only `child_process` use is `git` through `runGit`, which uses no shell, sets a timeout, never throws and maps `ENOENT` to status 127 (research section 2). ADR-003 already places `gh` calls outside the router's write rule.
- `SKILL.md` lists `Bash` in `allowed-tools`, parses `--archive` in Start step 1 and has `done`, `archive` and `halt` branches that point at `report`.
- `archive.test.mjs` has a recording `/bin/sh` shim on `PATH` for `git`; `helpers.mjs` has `makeProject`/`cleanupAll`. There is no `gh` test double yet.
- Roadmap S-05 has an open unknown: can the pipeline reach the pull request when it finishes? Research verified `gh pr view` behavior for no PR, not authenticated, not a repo and merged PR (gh 2.103.3). An open PR and the REST comment calls are unverified; Phase 4 covers them.
- Parallel changes S-06 and S-07 edit `route.mjs`, `policy.json`, `README.md` and `SKILL.md` (tier list). This plan touches none of `route.mjs`, `policy.json` or the "How the tier moves" list.

## Desired End State

- `node skills/10x-pipeline/scripts/pr-comment.mjs <change-id> [--report <path>]` prints exactly one JSON object `{ "posted", "action", "reason", "url", "match" }` and exits 0 for every runtime outcome. Exit 2 is for usage errors only.
- With a fake `gh`, a test run covers each outcome: skip (no gh, not authenticated, no PR, PR not open, bad JSON, unreadable report, timeout, failed comment lookup, failed write), create, update by marker and author, update by marker only when `/user` fails, no update of foreign or unmarked comments, two changes on one PR, mention neutralization, body cap.
- `SKILL.md`, `README.md`, `AGENTS.md` and `docs/ADR/ADR-003-rigor-gated-routing.md` document the flag, the script and its rules. The full suite `node --test skills/10x-pipeline/test/*.test.mjs` passes.
- A human verified the flow once against a real throwaway PR (Phase 4).

### Key Discoveries:

- `gh pr view` with no argument resolves the PR from the branch and handles forks; it also returns merged PRs, so `state` must be `OPEN` (research section 3).
- `gh pr comment --edit-last` edits the human's own last comment when the token is the human's, so update-in-place needs a marker plus author match through the REST API (research section 5).
- Nothing may be written under `context/changes/<id>/` after the pre-archive commit, and `meta.json`/`run.jsonl` are router-owned, so the "already posted" state lives on GitHub (research section 5, 6).
- The shim pattern for a recording fake on `PATH` already exists (`archive.test.mjs`, git shim test).

## What We're NOT Doing

- No change to `route.mjs`, `policy.json`, `plugin.json`, `marketplace.json`. No `meta.json` field for the flag (A2). No new policy key (A6).
- No subagent, model, tier or prompt for posting (A8). No new rule-form prompt.
- No default-on posting (A1). No posting of halts that have no `report` (missing result file, guard halts, usage errors).
- No writing of the post result into `report.md`, `meta.json`, `run.jsonl` or anything under the change folder. The result goes into the orchestrator's final message only.
- No `gh` login or token handling, no `--web`, no review, merge, close or delete calls. No comment history (one comment per change per PR, updated in place).
- No GitHub Enterprise verification beyond passing `--hostname` for a non-`github.com` host (untested, noted as Manual/unverified).
- No `#123` cross-reference neutralization (no notification; out of scope).
- No `git push`, no PR creation. A run with no PR skips; the user opens a PR and re-runs the documented command.

## Implementation Approach

A single new script plus a new test file, then docs and a loop edit. Four phases, each leaving the suite green:

1. Script skeleton: CLI, `gh` runner, PR lookup, skip classification, fake-`gh` test double, tests for every skip.
2. Posting: body (marker, mention neutralization, cap), viewer login, comment lookup, create or update, `--hostname`, argv audit, router-has-no-`gh` guard.
3. Wiring and docs: `SKILL.md` loop, README, AGENTS.md, ADR-003 section, docs consistency test.
4. Real-PR verification: Manual rows for what a fake cannot prove, plus a final automated gate.

Script contract (used by all phases):

- Usage: `node pr-comment.mjs <change-id> [--report <path>] [--timeout-ms <n>]`, run from the project root. `<change-id>` must match `^[a-z0-9][a-z0-9-]*$` (it goes into the marker). `--report` defaults to `context/changes/<id>/agent-smith/report.md`. `--timeout-ms` defaults to 20000 per `gh` call (constant, A6).
- Result JSON: `action` is `created`, `updated` or `skipped`; `posted` is true for the first two; `reason` is a short string for `skipped` and `null` otherwise; `url` is the comment `html_url` or `null`; `match` is `"author"` or `"marker-only"` for `updated`, else `null`.
- `gh` calls: `execFileSync`/`spawnSync` with an argv array (no shell), a timeout, `GH_PROMPT_DISABLED=1`, never throws. `ENOENT` is "gh not installed"; a timeout is "gh timed out".
- Allowed `gh` calls only: `pr view --json number,url,state,isDraft`; `api [--hostname h] user --jq .login`; `api [--hostname h] --paginate repos/<o>/<r>/issues/<n>/comments --jq <filter>`; `api [--hostname h] --method POST repos/<o>/<r>/issues/<n>/comments -F body=@<file> --jq .html_url`; `api [--hostname h] --method PATCH repos/<o>/<r>/issues/comments/<id> -F body=@<file> --jq .html_url`. The body goes in a temp file, never in argv, and the temp directory is removed in a `finally`.
- Marker: first line of the body is `<!-- agent-smith:pr-report change=<id> -->`, then a blank line, then the report.

## Assumptions (decided without a human)

Each can be reversed after the fact; "reversal cost" is the work to change it.

- **A1 Opt-in `--pr-comment`, default off.** Evidence: `--archive` precedent (ADR-003), the comment is visible to collaborators and carries goal text, FR-005's own wording is conditional on access. Reversal cost: low. Default-on means SKILL.md parses `--no-pr-comment` instead; script unchanged.
- **A2 The flag lives at skill level, not in `meta.json`.** Evidence: posting needs no router state; avoids the `init` block that S-06/S-07 edit. Cost: a resume without the flag does not post. Reversal cost: medium (router plumbing like `--archive`, new tests).
- **A3 Update in place by marker and author (one comment per change per PR).** Evidence: `--edit-last` hazard. Cost: the earlier text of a halted attempt is overwritten (GitHub keeps edit history). Reversal cost: low (drop the lookup, always POST).
- **A4 Draft PRs get the comment; merged and closed PRs are skipped.** Reversal cost: trivial (one condition).
- **A5 Halts that carry a `report` are posted.** Evidence: a halt is when a human most needs the report. Reversal cost: trivial (one sentence in SKILL.md).
- **A6 Cap (60000 characters), timeout (20 s) and the page filter are constants in the script; no `policy.json` block.** Evidence: not a routing decision; keeps `policy.json` out of the S-06/S-07 conflict zone. Reversal cost: low (add a `prComment` block and a small policy loader copy).
- **A7 Every `gh` failure is a skip with a reason; the script exits 0.** Evidence: roadmap risk text and PRD resolution (a missing PR only skips the comment).
- **A8 The orchestrator runs the script with Bash; no subagent.** Evidence: mechanical task, `Bash` already allowed. Reversal cost: high (policy step, tier, prompt, rule-form tests); not expected.
- **A9 (owner question: manual re-run) The README documents the manual re-run command, including `--report` for an archived report.** Evidence: the branch-then-PR workflow of this repository means many runs end before a PR exists. Cost: none beyond docs.
- **A10 (owner question: integration tokens) When `gh api user` fails, match by marker only and report `match: "marker-only"`.** Evidence: research proposal; the worst case is a failed PATCH on a foreign comment, which is a skip. Reversal cost: trivial (return a skip instead).
- **A11 (owner question: mentions) `@name` mentions in the report are neutralized by inserting a zero-width space after `@` when `@` follows a non-word character or starts a line.** Evidence: the goal text is user text and a mention notifies a person. Emails (`a@b.com`) are untouched. Reversal cost: trivial.
- **A12 `--paginate` output is filtered by a `gh api --jq` expression that emits one compact JSON object per matching marker comment (`id`, `login`), so the script never parses concatenated page arrays.** Evidence: avoids splitting `][` in a stream. Unverified against a real PR: Phase 4 row.

## Phase 1: Script skeleton, PR lookup and skips

### Overview

Create the script with the CLI, the `gh` runner and the PR lookup, and a test double for `gh`. Everything up to "an open PR was found" works; the script reports `skipped` with `reason: "posting not implemented"` when it would post. Phase 2 replaces that stub.

### Changes Required:

#### 1. The script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: Parse arguments, read the report, run `gh pr view`, classify the outcome, print one JSON object. Plain ES module, 2-space indent, double quotes, semicolons, `node:` imports only, Node 18.

**Contract**: The CLI and result JSON in "Implementation Approach". Skip reasons (stable strings tests check by substring): `gh is not installed`, `gh is not authenticated`, `no pull request for this branch`, `not a git work tree`, `pull request is <STATE>` (any state other than `OPEN`), `gh timed out`, `gh pr view failed: <first stderr line, at most 200 characters>`, `unexpected gh output`, `report not found: <path>`, `report is empty`. Classification: `ENOENT` is not installed; exit 4 or stderr containing `gh auth login` is not authenticated; stderr containing `no pull requests found` is no PR; stderr containing `not a git repository` is not a work tree. The `url` of the PR is parsed with `^https://([^/]+)/([^/]+)/([^/]+)/pull/(\d+)` into host, owner, repo, number; a mismatch is `unexpected gh output`. Usage errors (missing or invalid id, unknown flag, non-numeric `--timeout-ms`) print the usage line to stderr and exit 2. The script never writes under the project root.

#### 2. The test double and tests

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: A hermetic suite. A `/bin/sh` shim named `gh` in a temp `bin` directory, first on `PATH`. It picks canned answers from a directory named by `FAKE_GH_DIR` by call kind (`pr-view`, `user`, `comments`, `post`, `patch`; each kind has optional `.code`, `.out`, `.err`, `.sleep` files), logs argv with a unit-separator format like the git shim test, and copies the `-F body=@file` file to `body-<n>.txt` while it still exists. Skipped on Windows (`process.platform === "win32"`). Uses `makeProject` and `cleanupAll` from `helpers.mjs`; adds no helper there.

**Contract**: Phase 1 tests: no `gh` on `PATH` (empty bin directory); exit 4; exit 1 with `no pull requests found`; exit 1 with `not a git repository`; invalid JSON on stdout; `state` `MERGED` and `CLOSED` skip; `pr view` sleeps past `--timeout-ms 200`; missing and empty report; usage errors exit 2 with no JSON on stdout; a project with no `gh` call logged when the report is missing (the script reads the report first); output is always one parseable JSON object and exit 0 for every skip.

### Success Criteria:

#### Automated Verification:

- Phase 1 tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The script imports only `node:` built-ins: `! grep -nE "^import .* from \"[^n]" skills/10x-pipeline/scripts/pr-comment.mjs && ! grep -nE "^import .* from \"n[^o]" skills/10x-pipeline/scripts/pr-comment.mjs`
- No Node 19+ API in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy untouched: `git diff --stat HEAD -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing
- Usage error exits 2: `node skills/10x-pipeline/scripts/pr-comment.mjs; test $? -eq 2`

#### Manual Verification:

- On this repository's branch with no PR and the real `gh`, `node skills/10x-pipeline/scripts/pr-comment.mjs <existing-change-id>` (with a report present) prints `skipped` with `no pull request for this branch` and exits 0

**Implementation Note**: After this phase and its automated checks pass, pause for the manual confirmation before Phase 2.

---

## Phase 2: Create or update the comment

### Overview

Replace the stub: build the body, find the viewer and any earlier comment, and POST or PATCH. Add the argv audit and the guard that the router stays free of `gh`.

### Changes Required:

#### 1. Posting in the script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: After an open PR is found: build the body, write it to a temp file, resolve the viewer login, list marker comments, then PATCH the first match or POST a new comment. Print `created` or `updated` with the comment `url`.

**Contract**:
- Body = marker line + blank line + report text with mentions neutralized (A11: `/(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])/g` replaced with `$1@​`). If the result exceeds 60000 characters, cut it and append a line `Report truncated: <n> characters omitted.`; the marker line is always kept.
- Viewer: `gh api user --jq .login`. Failure or empty output means `login = null` (A10).
- Lookup: `gh api --paginate repos/<o>/<r>/issues/<n>/comments --jq '.[] | select(.body | startswith("<marker>")) | {id: .id, login: .user.login}'`, parsed line by line (A12). Unparseable lines are ignored. A failed lookup is a skip (`comment lookup failed: ...`) and posts nothing, so a transient error cannot create a duplicate.
- Match: with a known viewer, the first entry (lowest `id`) whose `login` equals the viewer, `match: "author"`; otherwise with `login = null`, the first entry, `match: "marker-only"`. No match means POST.
- Write failure (`POST`/`PATCH` non-zero, empty URL output) is a skip (`comment request failed: <first stderr line>`). `--hostname <host>` is added to every `api` call when the PR host is not `github.com`.
- Temp file lives in `fs.mkdtempSync(path.join(os.tmpdir(), "as-prc-"))` and is removed in a `finally`.

#### 2. Tests

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Cover every posting outcome with the fake, and audit what the script and the router are allowed to do.

**Contract**:
- Create: open PR, no marker comments, `POST` argv path equals `repos/<o>/<r>/issues/<n>/comments` from the PR url (not the cwd's repo); the captured body starts with the marker line and holds the report bytes after one blank line; output `created` with the url.
- Draft PR (`isDraft: true`, `OPEN`) posts.
- Update: marker comment by the viewer yields `PATCH repos/<o>/<r>/issues/comments/<id>` and no `POST`, `match: "author"`; marker comment by another login yields `POST`; two marker entries by the viewer patch the lowest id; a marker for another change id (filtered by the `--jq`, asserted by the filter text in argv containing this change's marker only) is not patched.
- `user` call fails: a marker entry is patched with `match: "marker-only"`.
- Failures: lookup exits non-zero → skipped, no `POST`/`PATCH` in the log; `POST` fails → skipped with `comment request failed`; empty URL output → skipped.
- Body: a report with `@alice`, `(@bob)` and `a@b.com` — captured body has `@​alice` and `@​bob` and keeps `a@b.com`; a 70000-character report is cut to at most 60000 characters plus the truncation line, and still starts with the marker.
- Host: PR url on `ghe.example.com` adds `--hostname ghe.example.com` to every `api` call; `github.com` adds none.
- Argv audit: every logged call is `pr view` or `api`; with `api`, the only methods are the default (GET), `POST` and `PATCH`; no argv contains `merge`, `close`, `review`, `--web`, `--editor`, `--input`, `DELETE`, or the body text; the body is only ever passed as `-F body=@<path>`; each `api` path starts with `repos/` or is `user`; the temp directory is gone after the run.
- Guard: `route.mjs` contains no `gh` invocation (`!/["'`]gh["'`]/.test(source)`) and `policy.json` has no `prComment` key.

### Success Criteria:

#### Automated Verification:

- All script tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- No Node 19+ API in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy untouched: `git diff --stat HEAD -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing
- Deliberate-break check: removing the author comparison in the matcher makes the "another login yields POST" test fail (run once by hand and revert)

#### Manual Verification:

- Reading the final script once: no call outside the allowed list in "Implementation Approach", and no path writes under the project root

**Implementation Note**: Pause after this phase for manual confirmation before Phase 3.

---

## Phase 3: Wire the flag into the loop and document it

### Overview

Add the flag to the orchestrator loop and document the script, its rules and the manual re-run command. Small, local edits only (S-06 and S-07 edit the same files).

### Changes Required:

#### 1. Orchestrator loop

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Parse `--pr-comment`, run the script at the right moment in `done`, `archive` and `halt`, and forbid any other posting. Do not touch "How the tier moves". Name no model, effort or tier.

**Contract**:
- Frontmatter `argument-hint` becomes `<change-id> [goal text] [--archive] [--pr-comment]`.
- Under the Router line add `PR_COMMENT=<this skill's base directory>/scripts/pr-comment.mjs`.
- Start step 1: also parse `--pr-comment`, remove it from the goal text, and do not pass it to `init`. Keep it for the rest of this invocation.
- `done`: when `--pr-comment` was given, after pointing at the report run `node $PR_COMMENT <change-id>` and print the result as one line (`PR comment: <action>, <url or reason>`).
- `archive`: add to the end of step 1 (before the archive subagent, so before the move): when `--pr-comment` was given, run the same command and print the same line. No renumbering.
- `halt`: when `--pr-comment` was given and the output has `report`, run the same command and print the line. A halt without `report` posts nothing.
- Rules: one line that only `$PR_COMMENT` may post a comment; never run `gh` yourself; a skip is not a failure of the run and is never retried; never write the result into the change folder.

#### 2. README

**File**: `README.md`

**Intent**: Document the flag, the requirements and the manual re-run.

**Contract**: skill usage line gains `[--pr-comment]` and one sentence; Requirements gains "`gh`, authenticated, only with `--pr-comment`"; a short "PR comment (opt-in)" bullet group after "Archive (opt-in)" covering: opt-in and why, the marker and update in place, skip reasons, halts with a report are posted, the mention neutralization and 60000-character cap, nothing is written to the change folder so the report cannot say whether it was posted, and the manual command `node <plugin>/skills/10x-pipeline/scripts/pr-comment.mjs <change-id> [--report context/archive/<date>-<change-id>/agent-smith/report.md]` for a run that ended before the PR existed; Layout line for `skills/10x-pipeline/` mentions the PR comment script.

#### 3. Agent guidelines

**File**: `AGENTS.md`

**Intent**: Keep the repository rules true.

**Contract**: Hard Rules gets one bullet: the router never calls `gh`; `pr-comment.mjs` is the only code that posts, its only network writes are one issue comment, created or edited, on an open PR of the current branch, identified by the marker, and it never writes under the project root. Project Structure lists `scripts/pr-comment.mjs` and `test/pr-comment.test.mjs`. Commands gets a bullet for `pr-comment.mjs <id> [--report <p>]`.

#### 4. ADR

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the decision next to the archive adapter, with rule lines in ADR-004 form.

**Contract**: a new `### PR comment` section placed after the "Rules for the adapter" list and before `## Alternatives considered`: the decision (separate script, opt-in, skill-level flag), the allowed `gh` calls, the timing rule (before the archive move), alternatives considered (router posts, subagent posts, `--edit-last`, flag in `meta.json`) in one short list, and rule lines, each one line of the form `**GIVEN** ... **WHEN** ... **THEN** ... **MUST|MUST NOT**`:
- GIVEN a run started without `--pr-comment` WHEN the run ends THEN the orchestrator MUST NOT call `pr-comment.mjs`.
- GIVEN the router runs any command WHEN it handles a step THEN it MUST NOT call `gh`.
- GIVEN `pr-comment.mjs` cannot reach an open pull request WHEN it handles the failure THEN it MUST skip the comment and exit 0.
- GIVEN the script finds a marker comment by the viewer WHEN it posts THEN it MUST edit that comment instead of creating another.
- GIVEN the script posts WHEN it builds the body THEN it MUST NOT pass the body as a command argument. (One bold keyword per line, as ADR-004 requires.)
- GIVEN the script has run WHEN the orchestrator records the result THEN it MUST NOT write under `context/changes/<id>/`.

#### 5. Docs consistency test

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Catch drift between the skill, README and script without a new test file.

**Contract**: tests read the repo files and assert: `SKILL.md` `argument-hint` contains `--pr-comment`; `SKILL.md` names `pr-comment.mjs` and never contains the text `gh pr` or `gh api`; README mentions `--pr-comment`; the existing `rules.test.mjs` ADR check covers the new rule lines (no edit to `rules.test.mjs`).

### Success Criteria:

#### Automated Verification:

- Docs consistency tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Router and policy untouched: `git diff --stat HEAD -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing
- `SKILL.md` names no model, effort or tier added by this change: `git diff HEAD -- skills/10x-pipeline/SKILL.md | grep -E "^\+" | grep -inE "sonnet|opus|haiku|effort|tier"` prints nothing
- `init` and `status` still print valid JSON in a scratch change folder (AGENTS.md Testing): `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` then `... status demo | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` in a scratch project

#### Manual Verification:

- Read `SKILL.md` end to end once: the three loop branches each run the script at most once per end of run, and the archive branch runs it before the archive subagent
- README and AGENTS.md read correctly next to the S-06 and S-07 edits if they have merged (resolve textual conflicts without dropping either side)

**Implementation Note**: Pause after this phase for manual confirmation before Phase 4.

---

## Phase 4: Verify against a real pull request

### Overview

A fake `gh` proves the script's logic, not GitHub's behavior. This phase checks the unverified facts once on a throwaway PR and closes the loop with a real pipeline run.

### Changes Required:

#### 1. Findings

**File**: `context/changes/pr-comment-report/plan.md`

**Intent**: Record what the real PR showed. If a call shape differs (the `--jq` filter output, `-F body=@file`, `--paginate`), fix the script in a follow-up commit within this change and add a test that captures the real shape.

**Contract**: no code change expected. Add one dated line under the matching Progress row when a finding changes the script.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- No Node 19+ API anywhere in the new files: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual|\.intersection\(" skills/10x-pipeline/scripts/pr-comment.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Router and policy untouched: `git diff --stat main -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` shows only changes from other merged changes, none from this branch (`git log main..HEAD --format=%h -- skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing)

#### Manual Verification:

- On a throwaway open PR, a first run of the script creates one comment that starts with the marker (hidden in the rendered view), and the tables of the report render
- A second run updates the same comment and creates no new one; the PR shows one agent-smith comment and a comment edit history
- With the human's own comment as the last comment on the PR, the script does not touch it
- With 31 or more comments on the PR (page size 30), the marker comment on a later page is still found and updated
- The `--jq` filter prints one compact JSON object per marker comment on a real PR, and the script parses it
- A body written with `-F body=@file` arrives byte for byte (newlines and pipe tables intact, no trailing change)
- With an empty `GH_CONFIG_DIR` and no `GH_TOKEN`, the script skips with `gh is not authenticated`; on a branch with no PR it skips with `no pull request for this branch`; on a branch whose PR is merged it skips with `pull request is MERGED`
- With a fine-grained token, record the minimal permission that works (pull requests or issues write) in the README; an integration token without `/user` updates with `match: "marker-only"`
- A real pipeline run with `--pr-comment` on a lean change with an open PR posts at `done`; with `--archive --pr-comment` the comment appears before the archive step and the archive folder gets no new file
- A forked-branch PR (`isCrossRepository`) posts to the base repository, not the fork (skip this row and say so if no fork is available)
- A `--pr-comment` run on a GitHub Enterprise host works with `--hostname` (skip and record as untested if no host is available)

**Implementation Note**: This phase needs a real token and PR; `/10x-goal-implement` leaves these rows for the human.

---

## Testing Strategy

### Unit Tests:

- `pr-comment.test.mjs` drives the real script through the CLI against a fake `gh` on `PATH`, in scratch projects from `helpers.mjs`. Windows is skipped, as the git shim test is.
- Every skip reason, create, update, no-update of foreign comments, marker-only match, mention neutralization, body cap, host flag, argv audit, router has no `gh`.

### Integration Tests:

- The existing suite plus the docs consistency tests. The full orchestrator loop is a subagent flow and has no automated test; Phase 4 Manual rows cover it.

### Manual Testing Steps:

1. Phase 4 rows on a throwaway PR.
2. After merge, run one real change with `--pr-comment` to confirm the flow end to end.

## Performance Considerations

At most five `gh` calls per post (`pr view`, `user`, comment lookup, one write), each with a 20 s timeout, so the worst case is about 100 s on a dead network. The orchestrator runs it once per end of run.

## Migration Notes

None. The flag is opt-in and nothing is stored. A project without `gh` is unaffected.

## References

- Related research: `context/changes/pr-comment-report/research.md`
- Roadmap item: `context/foundation/roadmap.md` (S-05); PRD FR-005: `context/foundation/prd.md`
- Shim pattern: `skills/10x-pipeline/test/archive.test.mjs` (git shim test); scratch projects: `skills/10x-pipeline/test/helpers.mjs`
- `runGit` model for a no-shell, timeout-bound, never-throwing runner: `skills/10x-pipeline/scripts/route.mjs`
- Archive precedent for opt-in outward actions: `docs/ADR/ADR-003-rigor-gated-routing.md` ("Archive adapter")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Script skeleton, PR lookup and skips

#### Automated

- [ ] 1.1 Phase 1 tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 1.3 The script imports only `node:` built-ins
- [ ] 1.4 No Node 19+ API in the new files
- [ ] 1.5 Router and policy untouched
- [ ] 1.6 Usage error exits 2

#### Manual

- [ ] 1.7 On a branch with no PR and the real `gh`, the script prints `skipped` with `no pull request for this branch` and exits 0

### Phase 2: Create or update the comment

#### Automated

- [ ] 2.1 All script tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 2.3 No Node 19+ API in the new files
- [ ] 2.4 Router and policy untouched
- [ ] 2.5 Deliberate-break check: removing the author comparison makes the "another login yields POST" test fail

#### Manual

- [ ] 2.6 Reading the final script once: no call outside the allowed list and no write under the project root

### Phase 3: Wire the flag into the loop and document it

#### Automated

- [ ] 3.1 Docs consistency tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 3.2 ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 3.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.4 Router and policy untouched
- [ ] 3.5 `SKILL.md` names no model, effort or tier added by this change
- [ ] 3.6 `init` and `status` still print valid JSON in a scratch change folder

#### Manual

- [ ] 3.7 Read `SKILL.md` end to end: each loop branch runs the script at most once, and the archive branch runs it before the archive subagent
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
- [ ] 4.7 A marker comment past page one (31 or more comments) is found and updated
- [ ] 4.8 The `--jq` filter prints one compact JSON object per marker comment on a real PR
- [ ] 4.9 A body written with `-F body=@file` arrives byte for byte
- [ ] 4.10 Not authenticated, no PR and merged PR each skip with the expected reason
- [ ] 4.11 Fine-grained token permission recorded in the README; integration token without `/user` updates with `match: "marker-only"`
- [ ] 4.12 A real pipeline run with `--pr-comment`, and with `--archive --pr-comment`, posts before the archive step and adds no file to the archived folder
- [ ] 4.13 A forked-branch PR posts to the base repository (or the row is recorded as untested)
- [ ] 4.14 A GitHub Enterprise host works with `--hostname` (or the row is recorded as untested)
