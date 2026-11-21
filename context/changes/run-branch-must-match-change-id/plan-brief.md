# Refuse to run a change on another change's run branch — Plan Brief

> Full plan: `context/changes/run-branch-must-match-change-id/plan.md`

## What & Why

`validateRunBranch` accepts any branch under `isolation.branchPrefix`. A run of change `foo` started in the worktree of run `bar` therefore passes `prepare-run.mjs` and `init`, and its step commits sweep up and its rollback resets `bar`'s branch. The guard must tie the branch to the change id and refuse otherwise, before anything is written.

## Starting Point

The prefix check is `branch.startsWith(prefix)` (`run-identity.mjs:77`). `runBranch`, `validateRunIdentity`, `isolationCheck` and `prepare-run.mjs:201` all reach it. Two tests (`prepare-run.test.mjs:69`, `:798`) assert the defect: `prepare-run other` inside the worktree of `demo` succeeds.

## Desired End State

Starting `foo` on `agent-smith/bar` refuses in both `prepare-run.mjs` and `init`, naming `foo` and `bar` and saying to leave that worktree and run `prepare-run.mjs foo` from the original project root. Nothing is written. `agent-smith/foo` and `agent-smith/foo-baseline` still work, saved runs still resume, and `docs/REFERENCE.md` states the rule.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Next character after the id | Exact `<prefix><id>` or `<prefix><id>-baseline` when no saved identity | `foo` and `foo-bar` are both real change ids here, so a plain `startsWith(prefix+id)` would keep the defect for them | Plan |
| Saved identity | Recorded branch accepted when it starts with `<prefix><id>` | `meta.id` already proves ownership; existing fallback tests use suffixes such as `demo-a`, `demo-saved` | Plan |
| Prefix-recovery message | Unchanged, but not appended to the other-change refusal | Restoring the prefix cannot fix a wrong-change branch | Plan |
| Baseline suffix | Constant `-baseline`, no policy key | Only suffix the reference documents; saved identity covers any other | Plan |
| Known limit | Branch `foo-baseline` of change `foo` cannot be told from the run of a change `foo-baseline` | The name is the only input of the unsaved tier | Plan |

## Scope

**In scope:** the guard and its saved tier, `prepare-run.mjs:201`, the two defect-encoding tests, new refusal and baseline tests, `docs/REFERENCE.md` isolation section, ADR-010 Amendment 5.

**Out of scope:** `open-pr.mjs`, `pr-comment.mjs`, rollback code, branch creation, prefix rules, repair of state the defect already wrote.

## Architecture / Approach

One guard with a `saved` flag: strict by default, loose when a saved identity of the id selected the branch. `validateRunIdentity` and the saved branch of `prepare-run.mjs` pass the flag; the new error carries a marker so `validateRunIdentity` does not add the prefix-recovery sentence. Tests extend the existing setup and init suites on real linked worktrees.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard, callers and tests | Refusal in `prepare-run` and `init`, baseline kept, saved runs kept | Existing fallback tests relying on suffix branches |
| 2. Document the rule | `docs/REFERENCE.md` bullets and baseline name, ADR-010 Amendment 5 | A doc line still describing the prefix-only check |

**Prerequisites:** none. **Estimated effort:** about 1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `-baseline` is the only baseline suffix users rely on without a saved identity (REFERENCE.md says "such as"; the plan tightens it).
- A `meta.json` already written by the defect now refuses on resume; recovery is manual. A defect-written `meta.json` of `foo` on `agent-smith/foo-bar` still resumes, because the saved tier only requires `<prefix><id>` as a start.
- Two existing fixtures (`isolation.test.mjs:286`, `open-pr.test.mjs:904`) move their recorded branch from `codex/other` to `codex/demo-other`, so they keep asserting the HEAD-mismatch message.

## Success Criteria (Summary)

- `prepare-run.mjs foo` and `init foo` refuse inside the worktree of run `bar`, name both ids and write nothing.
- `<id>-baseline` and saved suffix runs still work; the full suite passes.
- `docs/REFERENCE.md` states the rule in the isolation section.
