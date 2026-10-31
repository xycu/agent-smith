---
date: 2026-10-31T01:11:36+0100
researcher: Claude (Sonnet 5.5) for Błażej Ksycki
git_commit: 54f172914faa1f9828700f6b379262b803bb7589
branch: pr-comment-report-research
repository: agent-smith
topic: "PR comment report (roadmap S-05, FR-005): who posts the final report as a pull request comment, how, and how to test it"
tags: [research, router, route.mjs, SKILL.md, report, gh, pull-request, opt-in]
status: complete
last_updated: 2026-10-31
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Post the final run report as a pull request comment

**Date**: 2026-10-31T01:11:36+0100
**Researcher**: Claude (Sonnet 5.5) for Błażej Ksycki
**Git Commit**: 54f1729 (working tree: untracked `context/changes/pr-comment-report/` only)
**Branch**: pr-comment-report-research
**Repository**: agent-smith

## Research Question

Roadmap S-05 and PRD FR-005: "the user can see the same report as a comment on the pull request, skipped when no pull request exists." Questions for `/10x-plan`:

1. Where is the final report written?
2. Who may post: the router, the orchestrator, or a subagent via `gh`?
3. How to find the PR of the current branch, and detect "no PR", "no gh", "not authenticated"?
4. Is posting an outward-facing action that must be opt-in like `--archive`?
5. How does the comment avoid duplicates on resume?
6. What can a test cover hermetically (fake `gh`)?
7. Which exact lines of `route.mjs`, `policy.json`, `SKILL.md`, README and AGENTS.md would an implementation touch, given that S-06 and S-07 edit the same files in parallel?

Autonomous run: no human answered. Each decision below is evidence-backed and listed under "Assumptions".

## Summary

- **The report is a plain file, written by the router at every end of a run.** `finishRun` writes `meta.json` and `report.md` (`route.mjs:250-260`); every end branch goes through it (`endRun`, `route.mjs:264`; `archiveDone`, `route.mjs:938-940`). The output JSON carries the path as `report` (`route.mjs:260`, `:1008`). A halt for a missing result file writes no report (README "Usage report" bullet; nothing to post).
- **Recommendation: the router does not post. A new dependency-free script `skills/10x-pipeline/scripts/pr-comment.mjs` does, and the orchestrator runs it with Bash at the end of the run.** Reasons: `route.mjs` has never made a network call (its only `child_process` use is `git`, `route.mjs:447-459`); ADR-003 already places `gh` outside the router's write rule (`ADR-003:115`); a script is deterministic and needs no subagent, model or tier, so it adds no routing decision; and a separate file keeps the edit away from `route.mjs`, which S-06 and S-07 also edit. `SKILL.md` already lists `Bash` in `allowed-tools` (`SKILL.md:12`).
- **Opt-in, default off: flag `--pr-comment`.** Posting publishes the goal text, outcome and halt reasons under the user's GitHub identity to people who may not be the user. The repo treats every outward write as opt-in (`--archive`, `ADR-003:76-82`; "never pushes").
- **PR detection: `gh pr view --json number,url,state,...` with no argument.** Verified locally with gh 2.103.3: no PR gives exit 1 and `no pull requests found for branch "<branch>"`; not authenticated gives exit 4 and `To get started with GitHub CLI, please run:  gh auth login`; outside a git repository gives exit 1 and `failed to run git: fatal: not a git repository`. A missing `gh` binary is `ENOENT` from `execFileSync`. `gh pr view` also returns merged PRs for their branch (verified: `state: "MERGED"` for `archive-adapter-final`), so the script must require `state == "OPEN"`.
- **Duplicates: a hidden marker in the comment body plus update-in-place, not `gh pr comment --edit-last`.** `--edit-last` edits the last comment of the authenticated user, which is the human's own last comment when the human uses their own token. The marker `<!-- agent-smith:pr-report change=<id> -->` identifies the comment. State must live on GitHub, not in the change folder: nothing may be written under `context/changes/<id>/` after the pre-archive commit (`ADR-003:88`, rule at `ADR-003:125`).
- **Timing.** The report exists when `done`, `archive` or `halt` (with `report`) is printed. For an archive run the comment must be posted before the move, in the `archive` branch of the loop (`SKILL.md:44`), or from the archived copy with an explicit path.
- **Hermetic tests are possible** with a fake `gh` shell script first on `PATH`, the pattern already used for `git` in `archive.test.mjs:1053-1075`. A real PR, token scopes and the real `gh` branch resolution (forks, upstream config) stay manual.

## Detailed Findings

### 1. Where the final report is written

- `buildReport(id, meta, fullLog)` renders `# Run report: <id>`, `Goal`, optional `Rigor`, `Outcome`, archive lines, the step table, a `Steps:` totals line and an optional `## Skipped steps` table (`route.mjs:202-239`). It is markdown with pipe tables, so it renders in a PR comment as is.
- `writeReport` writes it to `context/changes/<id>/agent-smith/report.md` (`route.mjs:242-246`; path from `paths()` at `route.mjs:154`) and returns the path relative to the project root.
- `finishRun` writes the log, `meta.outcome` and the report, and returns the result with `report` (and `reportError` if the write failed) (`route.mjs:250-261`). `endRun` prints it (`route.mjs:264-266`). With `--archive`, the `done` branch calls `finishRun` directly and prints the `archive` action with `report: done.report` (`route.mjs:940`, `:1002-1013`).
- `status <id> --report` rewrites it on demand (`route.mjs:1177-1182`) and prints `res.report`. Plain `status` writes nothing.
- After the archive move the file lives at `context/archive/<created>-<id>/agent-smith/report.md`; `archivePath` is in the `archive` action (`route.mjs:1010`) and `verify-archive` returns `report` (`route.mjs:1153`).
- The report is written before the archive commit and is not touched afterwards (`ADR-003:89`). So the same bytes can be read before or after the move.

### 2. Who may post

| Option | For | Against |
| --- | --- | --- |
| Router (`route.mjs`) calls `gh` | one file; `runGit`-style helper exists (`route.mjs:447-459`) | first network call of the router; `next` would wait on the network (a timeout needs to be added); the router's git rules are checked by a grep and a shim test (`archive-adapter/plan.md:317`), and a `gh` call needs the same care; edits the most contended file |
| Subagent via `gh` with a policy prompt | fits "each step in a subagent" | costs a model call for a mechanical task; needs a tier and a `steps` entry in `policy.json`; the prompt text is rule-form checked (`rules.test.mjs:100`); an LLM can improvise the `gh` command |
| Orchestrator runs `node pr-comment.mjs` with Bash | deterministic; no tokens; no routing decision; testable with a fake `gh`; `Bash` already allowed (`SKILL.md:12`) | one more script file; `SKILL.md` gains a step in three loop branches |

Recommended: the third. The orchestrator already runs router commands with Bash (`SKILL.md:26-31`). AGENTS.md keeps routing decisions in `route.mjs` and `policy.json`; posting is not a routing decision. ADR-003 already accepts that `gh` calls made outside the router are outside its write rule (`ADR-003:115`).

Guarantees the script should keep (to be tested): no shell (`execFileSync`/`spawnSync` with an argv array), a timeout on every call, never throws, always exits 0 with one JSON object `{ posted, action, reason, url }` (exit 2 only for a usage error), and any `gh` failure is a skip, not a halt of the run. This follows the roadmap risk text: "a missing pull request only skips the comment" (`roadmap.md:144`) and the PRD resolution "skip the comment when no pull request exists" (`prd.md:97`).

### 3. Finding the PR and classifying the failure

Observed in this session (gh 2.103.3, network reachable, authenticated as `xycu`):

| Situation | Observed | Script verdict |
| --- | --- | --- |
| Branch without PR | `gh pr view --json number` exit 1, stderr `no pull requests found for branch "pr-comment-report-research"` | skip: no pull request |
| Not authenticated (`GH_CONFIG_DIR` on an empty directory, `GH_TOKEN` empty) | exit 4, `To get started with GitHub CLI, please run:  gh auth login` | skip: gh not authenticated |
| Not a git repository | exit 1, `failed to run git: fatal: not a git repository` | skip: no git work tree |
| `gh` not installed | not run here; `execFileSync` reports `e.code === "ENOENT"` (the router already maps this for git to status 127, `route.mjs:455`) | skip: gh not installed |
| Branch whose PR is merged | `gh pr view archive-adapter-final --json state,...` returned `"state":"MERGED"`, exit 0 | skip: pull request is not open |
| Open PR | not available (no open PR in this repo during the session) | continue |

- Use `gh pr view --json number,url,state,isDraft,headRefName,isCrossRepository` with no argument: gh resolves the PR from the branch and its upstream config, which also handles forks. `gh pr list --head <branch>` returns `[]` with exit 0 for no PR (observed with `--head main`) and so avoids parsing stderr, but `--head` takes no `owner:branch` form and can match a same-named branch of another fork. Because every failure is a skip, the stderr text only picks the reason shown to the user; a changed message cannot cause a wrong post.
- Exit code 4 is documented by `gh help exit-codes` (observed output: "If a command requires authentication, the exit code will be 4"). Other failures are exit 1.
- Draft PRs: post (a draft is open). Assumption A4.
- Derive `owner/repo/number` and host from `url` (`https://<host>/<owner>/<repo>/pull/<n>`) and call the API for that repo, not for `{owner}/{repo}` of the current directory. The two differ when the branch lives in a fork. For a non-`github.com` host pass `--hostname`. Not tested here.
- The sandbox of the orchestrator may block `api.github.com`. The script treats a network failure as a skip with the `gh` message; the user can re-run it later (section 5).

### 4. Is posting opt-in?

Yes. Evidence and reasoning:

- The PRD success criterion says the report "is posted as a comment on the pull request" (`prd.md:48`) and FR-005 is must-have (`prd.md:96`), but neither says the default. FR-005's own counter-argument is "needs GitHub access and a PR" (`prd.md:97`): the requirement is conditional on access.
- `--archive` is the precedent: an action that leaves the local machine's control or changes history is opt-in, and without the flag "the router writes nothing to git" (`ADR-003:80`, `README.md` "Archive (opt-in)"). A comment is visible to the repository's collaborators, notifies subscribers, and carries the goal text and halt reasons, which can hold private details on a public repository.
- A comment can be edited or deleted by the user afterwards, so the harm is smaller than a push, but it is not reversible for those who were notified.
- Flag shape: `--pr-comment` on the skill, parsed like `--archive` (`SKILL.md:28`). Keeping the flag at skill level means no `route.mjs` change: posting needs no router state, and a resumed run that ends again is posted again by the same flag on the new invocation. The cost is that the user passes the flag on each resume (A2). The alternative, `init --pr-comment` stored in `meta.json`, copies the `--archive` plumbing (`route.mjs:1203-1234`) and would add one more edit on the contended `init` block and usage string (`route.mjs:1195`).

### 5. Duplicates on resume

- A run can end more than once: halt, fix, `init` again, `done`. A resumed `done` rewrites `report.md` (README.md:71, "A run that continues after a halt keeps the old `report.md` until it ends again"). Each end would add a comment unless the script finds its own.
- `gh pr comment --edit-last` is not safe: it edits "the last comment of the current user" (`gh pr comment --help`, observed), which is the human's last comment when the token is the human's. `--create-if-none` only covers the empty case.
- Recommended: the first line of the body is `<!-- agent-smith:pr-report change=<id> -->`. The script reads the PR's comments with `gh api --paginate repos/<o>/<r>/issues/<n>/comments`, picks the one whose `body` starts with the marker and whose `user.login` equals `gh api user --jq .login` (observed: returns `xycu`), then `PATCH repos/<o>/<r>/issues/comments/<id>` with `-F body=@<file>`; otherwise `POST .../issues/<n>/comments`. The marker carries the change id, so one PR can hold reports of several changes.
- Update in place keeps the PR clean and shows the latest outcome. It loses the earlier report text of a halted attempt (GitHub keeps edit history). Alternative: append a new comment per end of run, which keeps history and adds noise. Assumption A3.
- With a token that cannot call `/user` (an integration token), the login is unavailable. Plan decision; proposed default: match by marker only and say so in the result. Not verified here.
- Dedupe state cannot be stored in the change folder: after the pre-archive commit the folder must stay clean (`ADR-003:88`, `:125`), and `meta.json` is router-owned (AGENTS.md "Hard Rules"). GitHub itself is the store.
- Unverified: the exact JSON field set of `gh pr view --json comments` (no PR in this repository has a comment, so it could not be listed). The REST shape above is the one to use; the plan should check it once against a throwaway PR.

### 6. Timing in the loop (`SKILL.md`)

- `done` (no `--archive`): `report` is in the output (`route.mjs:1067-1070`). Run the script after step "Point the user to the report" (`SKILL.md:42`).
- `archive`: step 1 runs `status` before the move (`SKILL.md:44`). Post right there, before the archive subagent, using the action's `report` path. The comment then does not depend on `/10x-archive`.
- `halt`: post when the output has `report` (`SKILL.md:51`). A halt is when a human most needs the report. Assumption A5. Halts with no `report` (missing result file, guard halts, usage errors) post nothing.
- After the move the script can still run by hand with `--report context/archive/<created>-<id>/agent-smith/report.md`, which is idempotent through the marker. This covers the common branch-then-PR workflow of this repository (owner opens the PR after the run), where the run ends with no PR and skips: the user opens the PR and runs the script once.
- Never write the posting result into `report.md`, `meta.json` or `run.jsonl`: it would dirty the committed folder (`ADR-003:88`) and the router owns those files (AGENTS.md). The result goes into the orchestrator's final message only. The report therefore cannot say whether it was posted.

### 7. Body

- Body = marker line + `report.md` verbatim ("the same report", `prd.md:96`).
- GitHub limits a comment to 65536 characters (from GitHub's API behavior; not checked in this session). A report has one row per executed step and is bounded by `limits.maxTotalSteps` 14 plus `rigor.budgetDelta` up to 4 (`policy.json:70` and `:54`) plus skip rows, so it is a few kilobytes. A cap with a clear truncation note is a cheap guard.
- Report text includes the goal (user text), halt reasons and `signals.needsHuman` text (cut to 300 characters, `route.mjs:283`). An `@name` in the goal would notify that person. Plan decision whether to neutralize mentions; opt-in lowers the risk.

### 8. What a test can cover

Pattern to reuse: `archive.test.mjs:1053-1075` writes a `/bin/sh` shim into a temp `bin`, puts it first on `PATH`, logs its argv, and skips on Windows. `helpers.mjs:10-14` creates scratch projects; `run()` takes an `env` (`helpers.mjs:70-78`). For `gh`, the shim reads canned answers from a directory chosen by an env variable (one file per call kind: exit code, stdout, stderr), and logs argv.

Hermetic cases (new `pr-comment.test.mjs`, Node 18, no real network):

- no `gh` on `PATH` (use a bin directory without it; `archive.test.mjs:323-327` does this for git): skip with reason, exit 0;
- exit 4 on `pr view`: skip, "not authenticated";
- exit 1 with "no pull requests found": skip, "no pull request";
- `state: MERGED` and `CLOSED`: skip; `OPEN` and draft: post;
- fresh post: argv shows `POST` to `repos/<o>/<r>/issues/<n>/comments` from the PR url, body file starts with the marker and holds the report bytes; `url` returned;
- resume: comments list holds a marker comment by the viewer: `PATCH` to its id, no `POST`; marker comment by another user, or without marker: `POST`; two changes' markers on one PR: only the matching id is patched;
- pagination: the match is on page 2;
- `pr view` JSON that is invalid, or a comments call that fails: skip, no post;
- body over the cap: truncated or skipped as decided;
- argv audit like the git shim test: only `pr view`, `api user`, `api` on the issue-comment paths; never `pr merge`, `pr close`, `pr review`, `--web`, `--editor`, `-X DELETE`; the body is passed as a file, never as an argument;
- missing report file or unreadable: skip with reason;
- a timeout: shim that sleeps with a short test timeout; skip with reason.

Rule-form: no policy prompt is added by this design, so `rules.test.mjs:100` needs no change. Any new ADR rule lines must be one `**GIVEN** ... **WHEN** ... **THEN** ... **MUST|MUST NOT**` line (`rules.test.mjs:116`).

Not coverable hermetically (manual rows for the plan): a real open PR, a real token's scopes (a fine-grained token needs write access to pull requests or issues; not verified), `gh` branch resolution for forks, rendering of the tables, GitHub Enterprise hosts.

### 9. Touch points for the plan (to keep edits small)

New (no conflict with S-06 and S-07):

- `skills/10x-pipeline/scripts/pr-comment.mjs` - the script, `node:` built-ins only, Node 18.
- `skills/10x-pipeline/test/pr-comment.test.mjs` - the hermetic tests; reuse `makeProject`/`cleanupAll` from `helpers.mjs`. Add no helper to `helpers.mjs` unless needed (S-06 and S-07 add fixtures there too).

Edits (each is small, and a conflict would be textual, not logical):

- `skills/10x-pipeline/SKILL.md`: `argument-hint` (`:9`); Start step 1 flag parsing (`:28`); one sentence in each of `done` (`:42`), `archive` step 1 (`:44`) and `halt` (`:51`); one Rules line that the script is the only thing that may post. Do not touch "How the tier moves" (`:62-87`), which S-06/S-07 edit. No model or effort names.
- `README.md`: usage line of the skill (`:18`), a short "PR comment (opt-in)" bullet group near "Archive (opt-in)" (`:48`) or "Usage report" (`:65`), and the `scripts/` line in Layout (`:78`). Requirements bullet: `gh`, authenticated, only with the flag.
- `AGENTS.md`: Project Structure list gets the script and the test file; a Hard Rules bullet: the router never posts; the script's only network writes are one issue comment, created or edited, on an open PR of the current branch, with a marker. `skills/10x-pipeline/test/` line gets the new file.
- `docs/ADR/ADR-003-rigor-gated-routing.md`: a short section "PR comment" next to "Archive adapter" (`:76-130`) with the GIVEN/WHEN/THEN rules, and a pointer from the `gh` remark at `:115`.
- `skills/10x-pipeline/policy.json`: no change needed if the cap and timeouts are constants in the script. If the plan prefers policy keys (AGENTS.md: "A policy change belongs in `policy.json`"), add one `prComment` block (`maxBodyChars`, `timeoutMs`) and let the script read it; that needs a small copy of `loadPolicy` (`route.mjs:48-53`) because `route.mjs` runs `main()` on import and exports nothing. Assumption A6: constants, no policy block.
- `skills/10x-pipeline/scripts/route.mjs`: no change. If the plan instead stores the flag in `meta.json`, the touch points are `init` flag parsing (`:1203-1212`), meta write (`:1234`), usage string (`:1195`) and, optionally, a `prComment` hint in the `done`/`archive` output (`:1002-1013`, `:1067-1070`).
- `.claude-plugin/plugin.json` and `marketplace.json`: not needed; `argument-hint` and README text change, the manifest `description` does not (S-09 made no version bump either, `archive-adapter/plan.md:353`).

## Code References

- `skills/10x-pipeline/scripts/route.mjs:202-239` - `buildReport`
- `skills/10x-pipeline/scripts/route.mjs:242-246` - `writeReport` (path relative to the root)
- `skills/10x-pipeline/scripts/route.mjs:250-266` - `finishRun`, `endRun`
- `skills/10x-pipeline/scripts/route.mjs:447-459` - `runGit`: no shell, timeout, never throws, ENOENT to status 127
- `skills/10x-pipeline/scripts/route.mjs:869-1013` - `archiveDone`; report written at `:940`; `archive` action with `report`, `archivePath` at `:1002-1013`
- `skills/10x-pipeline/scripts/route.mjs:1065-1070` - `done` and `halt` go through `endRun`
- `skills/10x-pipeline/scripts/route.mjs:1153` - `verify-archive` returns the archived `report`
- `skills/10x-pipeline/scripts/route.mjs:1177-1182` - `status --report`
- `skills/10x-pipeline/scripts/route.mjs:1195`, `:1203-1234` - usage string, `--archive` flag handling
- `skills/10x-pipeline/SKILL.md:9`, `:12`, `:28`, `:42-51` - argument hint, allowed tools, flag parsing, `done`/`archive`/`halt`
- `skills/10x-pipeline/test/archive.test.mjs:1053-1075` - recording shim on `PATH`
- `skills/10x-pipeline/test/helpers.mjs:10-14`, `:70-78` - scratch project, `run()` with `env`
- `docs/ADR/ADR-003-rigor-gated-routing.md:76-89`, `:115`, `:125-130` - archive adapter git rules and the `gh` remark
- `context/foundation/prd.md:48`, `:96-97` - success criterion and FR-005
- `context/foundation/roadmap.md:134-145` - S-05 item

## Architecture Insights

- The disk is the source of truth (ADR-001); for the PR comment, GitHub is the source of truth for "already posted", because the folder must stay clean after the pre-archive commit.
- Routing stays in `route.mjs` and `policy.json`; side effects that leave the machine are separate, opt-in and fail-open. The archive adapter is the git-side precedent (opt-in flag, ADR section, shim test); this change is the `gh`-side counterpart with a separate script instead of router code.
- The report is the one artifact that survives the archive move (`ADR-003:89`), which makes it the right payload and makes "post before the move" a loop-order rule, not a router rule.

## Historical Context (from prior changes)

- `context/archive/2026-10-30-per-step-usage-report/plan.md:5`, `:29` - the report is "the basis for the later PR comment (S-05)"; posting was explicitly out of scope there. Supported by the current code.
- `context/archive/2026-10-30-archive-adapter/research.md` section 2 and Open Question 1 - `endRun` split into write and print, and the commit scope decision; this change reuses the result (the report exists before the commit and is unchanged after).
- `context/archive/2026-10-30-archive-adapter/plan.md:54`, `:60`, `:317` - "pushing" is out of scope; the archive subagent's `gh` calls are outside the router's write rule; grep and shim tests guard the router. A `gh`-posting router would need the same guards, which supports the separate script.
- `context/archive/2026-10-30-archive-adapter/research.md` section 4 item 2 - `/10x-archive` itself uses `gh pr view` for its SHA history check, so `gh` is already an optional tool of this pipeline.
- Caller note: the task brief said "no network" for the router. No document in `docs/ADR/`, AGENTS.md or the archived plans states "no network" in those words (search for `network` in `docs/ADR/*.md` found no match); the written rule is "never pushes" and the git write limits. The recommendation honors the stricter reading anyway.

## Related Research

- `context/archive/2026-10-30-archive-adapter/research.md` - closest precedent (opt-in, git, orchestrator loop changes).
- `context/archive/2026-10-30-per-step-usage-report/` - the report.

## Assumptions (decided without a human)

- **A1** Posting is opt-in, flag `--pr-comment`, default off. Evidence: `--archive` precedent (`ADR-003:80`), outward visibility of the comment, FR-005's conditional wording (`prd.md:97`).
- **A2** The flag lives at skill level and is not stored in `meta.json`; the user passes it on each invocation. Evidence: posting needs no router state; keeps `route.mjs` untouched. Cost: a resume without the flag does not post.
- **A3** Update in place by marker and author; one comment per change per PR. Evidence: `--edit-last` hazard (section 5).
- **A4** Draft PRs get the comment; merged and closed PRs are skipped.
- **A5** Halts that have a `report` are posted too.
- **A6** Cap and timeouts are constants in the script, no `policy.json` block.
- **A7** Every `gh` failure is a skip with a reason, never a halt; the script exits 0.
- **A8** The script is invoked by the orchestrator with Bash, not by a subagent.

## Open Questions

1. **Owner:** opt-in (A1) or on by default when a PR exists? PRD wording "is posted" (`prd.md:48`) could be read as default-on. The research recommends opt-in; the owner confirms.
2. **Owner:** the repository's flow is branch, run, then the owner opens the PR. A run started before the PR exists skips the comment. Is "run the script by hand afterwards" enough, or should the plan add a documented command in the README (the script already supports `--report <path>`)?
3. **Owner:** post halts too (A5)? And update in place (A3) or one comment per run end?
4. Unverified, for the plan to check on a throwaway PR: the REST paths and `-F body=@file` with `gh api`, the field set of `gh pr view --json comments` if it is preferred, and token scopes for a fine-grained token.
5. Should `@mentions` in the goal text be neutralized before posting (section 7)?
6. Integration tokens (no `/user`): match by marker only, or skip? Proposed: marker only.
