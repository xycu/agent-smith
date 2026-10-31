# PR Comment Report — Plan Brief

> Full plan: `context/changes/pr-comment-report/plan.md`
> Research: `context/changes/pr-comment-report/research.md`

## What & Why

Let a pipeline run post its final `report.md` as a comment on the pull request, so reviewers see the model, effort and token use without opening files (roadmap S-05, PRD FR-005). A missing pull request, missing `gh` or missing login only skips the comment; the report file is always written.

## Starting Point

The router writes `report.md` at every end of a run and prints its path as `report`. It has never made a network call, and the repo treats every outward action as opt-in (`--archive`). No `gh` test double exists yet; a recording `git` shim in `archive.test.mjs` is the pattern.

## Desired End State

`/agent-smith:10x-pipeline <id> --pr-comment` runs `pr-comment.mjs` at `done`, `archive` (before the move) and `halt` (when a `report` exists). One comment per change per PR appears and is updated in place on later ends of the run. Without the flag, nothing changes.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Who posts | New script `pr-comment.mjs`, run by the orchestrator with Bash | Mechanical, no tokens, no routing decision, keeps `route.mjs` and `policy.json` untouched (S-06/S-07 edit them) | Research (A8) |
| Default | Opt-in `--pr-comment`, skill level, not stored in `meta.json` | Comment is visible and carries the goal text; matches `--archive` | Research (A1, A2) |
| Duplicates | Hidden marker + author match, edit in place | `gh pr comment --edit-last` would edit the human's own comment | Research (A3) |
| Halts | Posted when they carry a `report` | A halt is when people need the report | Research (A5) |
| Failures | Every `gh` failure is a skip, exit 0 | Roadmap risk: missing PR only skips | Research (A7) |
| Integration tokens | Match by marker only when `/user` fails | Worst case is a failed edit, which is a skip | Plan (A10) |
| Mentions | Insert a zero-width space after `@name` | Goal text is user text; a mention notifies people | Plan (A11) |
| Late PR | README documents a manual re-run with `--report` | Repo flow is branch, run, then PR | Plan (A9) |
| Limits | 60000-char cap, 20 s timeout as constants | Not routing policy | Plan (A6) |

## Scope

**In scope:** the script, its fake-`gh` tests, `SKILL.md` loop edits, README, AGENTS.md, an ADR-003 section, real-PR verification.

**Out of scope:** `route.mjs`, `policy.json`, `meta.json`, a subagent step, default-on posting, comment history, writing results into the change folder, PR creation or push.

## Architecture / Approach

The orchestrator runs `node pr-comment.mjs <id>` after the router returns an end state. The script reads the report, calls `gh pr view` (open PR only), looks up its own marker comment through the REST API, then POSTs or PATCHes with the body passed as a file. Dedupe state lives on GitHub because nothing may be written to the change folder after the pre-archive commit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Script skeleton, PR lookup and skips | CLI, `gh` runner, every skip path, fake `gh` | Misclassified `gh` errors (harmless: all skip) |
| 2. Create or update the comment | Body, marker lookup, POST/PATCH, argv audit | Real REST shapes differ from the fake |
| 3. Wire the flag and document it | `SKILL.md`, README, AGENTS.md, ADR-003, docs tests | Textual conflicts with S-06/S-07 edits |
| 4. Verify against a real PR | Manual rows on a throwaway PR | Needs a token and a PR |

**Prerequisites:** S-02 done (it is); `gh` authenticated for Phase 4.
**Estimated effort:** about 3 sessions across 4 phases.

## Open Risks & Assumptions

- The `--jq` filter output, `-F body=@file` and pagination are verified only by a fake until Phase 4.
- Token scopes for a fine-grained token are unverified.
- Owner can still reverse A1 (default-on), A3 (one comment per run end) and A5 (skip halts) cheaply; see the plan's assumption list.

## Success Criteria (Summary)

- With a fake `gh`, the suite proves each skip, create, update and safety property; the router and policy are untouched.
- On a real PR, a second run edits the first comment and leaves the human's comments alone.
