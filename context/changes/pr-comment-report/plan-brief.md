# PR Comment Report — Plan Brief

> Full plan: `context/changes/pr-comment-report/plan.md`
> Research: `context/changes/pr-comment-report/research.md`

## What & Why

Let a pipeline run post its final `report.md` as a comment on the pull request, so reviewers see the model, effort and token use without opening files (roadmap S-05, PRD FR-005). A missing pull request, missing `gh`, missing login or a host other than `github.com` only skips the comment; the report file is always written.

## Starting Point

The router writes `report.md` at every end of a run and prints its path as `report`. It has never made a network call, and the repo treats every outward action as opt-in (`--archive`). No `gh` test double exists yet; a recording `git` shim in `archive.test.mjs` is the pattern.

## Desired End State

`/agent-smith:10x-pipeline <id> --pr-comment` runs `pr-comment.mjs` at `done`, `archive` (before the move) and `halt` (when a `report` exists); the request is kept for the whole loop as an orchestrator task. One comment per change per PR appears and is updated in place on later ends of the run. Without the flag, nothing changes.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Who posts | New script `pr-comment.mjs`, run by the orchestrator with Bash | Mechanical, no tokens, no routing decision, keeps `route.mjs` and `policy.json` untouched (S-06/S-07 edit them) | Research (A8) |
| Default | Opt-in `--pr-comment`, skill level, not stored in `meta.json` | Comment is visible and carries the goal text; matches `--archive` | Research (A1, A2) |
| Duplicates | Hidden marker + author match, edit in place; `gh --jq` only projects `id`, `login` and the first 200 characters, the marker is matched in JS | `gh pr comment --edit-last` would edit the human's own comment; logic inside a jq string is untestable with a fake `gh` | Research (A3), Review F1 |
| Flag durability | Orchestrator task item created at Start, no `meta.json` | Survives context compaction without a `route.mjs` edit that S-06/S-07 also make | Review F3 (A15) |
| Report input | `--report` only for a path ending `agent-smith/report.md` whose first line is `# Run report: <id>`; the result prints the PR url | The script posts under the user's identity | Review F6 (A13) |
| Hosts | Only `github.com`; others are a skip | No host to verify `--hostname` against | Review F7 (A14) |
| Halts | Posted when they carry a `report` | A halt is when people need the report | Research (A5) |
| Failures | Every `gh` failure is a skip, exit 0 | Roadmap risk: missing PR only skips | Research (A7) |
| Integration tokens | Match by marker only when `/user` fails | Worst case is a failed edit, which is a skip | Plan (A10) |
| Mentions | Insert a zero-width space after `@name` | Goal text is user text; a mention notifies people | Plan (A11) |
| Late PR | README documents a manual re-run with `--report` | Repo flow is branch, run, then PR | Plan (A9) |
| Limits | 60000-char cap, 20 s timeout as constants | Not routing policy | Plan (A6) |

## Scope

**In scope:** the script, its fake-`gh` tests, `SKILL.md` loop edits, README, AGENTS.md, an ADR-003 section, real-PR verification.

**Out of scope:** `route.mjs`, `policy.json`, `meta.json`, a subagent step, default-on posting, comment history, writing results into the change folder, PR creation or push, GitHub Enterprise, real-fork verification. `roadmap.md` is not edited by this change's plan commits.

## Architecture / Approach

The orchestrator runs `node pr-comment.mjs <id>` after the router returns an end state. The script reads the report, calls `gh pr view` (open PR only), lists the PR's comments through the REST API with a projecting filter, matches its own marker in JS, then POSTs or PATCHes with the body passed as a file. Dedupe state lives on GitHub because nothing may be written to the change folder after the pre-archive commit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Script skeleton, PR lookup and skips | CLI, report checks, `gh` runner, every skip path, fake `gh`, one live read-only check | Misclassified `gh` errors (harmless: all skip) |
| 2. Create or update the comment | Body, marker lookup, POST/PATCH, argv and no-write audits, mutation test, live projection check | Real write shapes differ from the fake |
| 3. Wire the flag and document it | `SKILL.md` task item and pointers, README, AGENTS.md, ADR-003, docs tests, exact edit placement | Textual conflicts with S-06/S-07 edits |
| 4. Verify against a real PR | Manual rows for the write path on a throwaway PR | Needs a token and a PR |

**Prerequisites:** S-02 done (it is); `gh` authenticated for Phase 4.
**Estimated effort:** about 3 sessions across 4 phases.

## Open Risks & Assumptions

- `-F body=@file`, POST and PATCH are verified only by a fake until Phase 4. The read side (projection over 183 comments and several pages) is verified live and re-checked by opt-in `GH_LIVE=1` tests.
- Token scopes for a fine-grained token are unverified.
- Whether the orchestrator still acts on the task item across a long loop is proven for one short run only (A15); the fallback is `meta.json`.
- Default-off leaves the PRD wording "is posted" unmet unless the flag is passed; owner confirmation of A1 is pending. A3 and A5 can be reversed cheaply; see the plan's assumption list.
- Forked-branch PRs and GitHub Enterprise are not verified by design.

## Success Criteria (Summary)

- With a fake `gh`, the suite proves each skip, create, update and safety property, including marker matching; the router and policy are untouched against the branch base (`git merge-base main HEAD`).
- On a real PR, a second run edits the first comment and leaves the human's comments alone.
