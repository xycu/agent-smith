# Release only from a main commit whose CI run passed — Plan Brief

> Full plan: `context/changes/release-after-green-ci/plan.md`

## What & Why

A release is tagged and published with no CI result, and CI on `main` is often cancelled. `v1.5.0` was released from `5160a8a`, whose CI run failed. The plan makes the release job start only from a green CI run of a push to `main`, and makes every push to `main` end with a CI result.

## Starting Point

`release.yml` triggers on `push` to `main`, independent of `ci.yml`. `ci.yml` cancels in-progress runs for every ref (38 of 97 runs on `main` cancelled). `main` has no branch protection. Workflow tests read the YAML as text.

## Desired End State

A red or cancelled CI run on `main` produces no release PR update and no tag. A rerun that passes starts the release job. Every push to `main` has its own, uncancelled CI run.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Release trigger | `workflow_run` of `CI`, `completed`, branch `main`, job `if` conclusion `success` | Ties the release to the CI result; a rerun re-fires it | Plan (from change.md) |
| Push event guard | `workflow_run.event == 'push'` | A fork PR from a branch named `main` matches `branches: [main]` | Plan |
| Stale-commit guard | `workflow_run.head_sha == github.sha` | release-please reads the head of `main`, not the tested commit; skip when `main` moved | Plan |
| CI concurrency | group `github.sha` for non-PR events, `cancel-in-progress` only for `pull_request` | `cancel-in-progress: false` alone still replaces a pending run of the same group, so a per-push group is needed | Plan (extends change.md) |
| Release concurrency | moved to job level | A skipped job should not take the pending slot (checked live) | Plan |
| Tests | new `tools/test/release-gate.test.mjs`, text matching, comments stripped | No YAML parser allowed (ADR-006); `ci-runner.test.mjs` keeps its single purpose | Plan |
| Docs | `AGENTS.md` Releases section, ADR-008 `Amendment 1` | Record stays; amendment form follows ADR-012 | Plan |

## Scope

**In scope:** `ci.yml`, `release.yml` (with header comments), new test, `AGENTS.md`, ADR-008 amendment, live check.

**Out of scope:** branch protection, release-please config and versions, CI jobs and runners, action pins, any dependency.

## Architecture / Approach

Test first: the new test fails on today's workflows, then the two workflow edits make it pass, then the docs. `workflow_run` runs only from the default branch, so the live behaviour is checked by the owner after the merge. The tag now follows the CI run of the release-PR merge commit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tests and workflow changes | `release-gate.test.mjs`, edited `ci.yml` and `release.yml` | Text matching is brittle to reformatting |
| 2. Documentation | `AGENTS.md` and ADR-008 amendment | Drift from the final YAML |
| 3. Live check after merge | Observed runs on `main` | Cannot be tested before merge |

**Prerequisites:** none.
**Estimated effort:** ~1 session for phases 1-2; phase 3 spans the next merges to `main`.

## Open Risks & Assumptions

- Assumed (no human to ask): CI group per push sha extends `change.md`'s fix direction, because `cancel-in-progress: false` alone would still drop a pending run.
- Assumed: a rerun of a failed CI run re-fires `workflow_run` with `success` (Phase 3.5).
- Assumed: job-level concurrency does not let a skipped job take the pending slot (Phase 3.6).
- The release PR lags a push by the CI duration.
- The "create and approve pull requests" setting should still apply to a `workflow_run` job (Phase 3.7).

## Success Criteria (Summary)

- Static tests pin the trigger, the guards and the CI concurrency.
- A failed or cancelled CI run on `main` leads to no release PR update and no tag.
- Two close merges to `main` each end with a CI result.
