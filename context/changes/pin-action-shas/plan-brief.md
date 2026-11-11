# Pin GitHub Actions to commit SHAs — Plan Brief

> Full plan: `context/changes/pin-action-shas/plan.md`

## What & Why

Pin the three actions used by `ci.yml` and `release.yml` to full commit SHAs, version in a comment. A moved tag would otherwise run foreign code in `release.yml`, which has `contents: write` and `pull-requests: write` (issue #99).

## Starting Point

Five `uses:` lines reference `@v5` tags. No test or doc covers them.

## Desired End State

All remote `uses:` lines are `@<40-hex> # vX.Y.Z`, equal to what `v5` resolves to today, and a test fails if one reverts to a tag.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Which commit | Commit behind today's `v5` tag (checkout v5.1.0, setup-node v5.0.0, release-please v5.0.0) | Behavior stays the same | Plan |
| Annotated tag | Use peeled commit for release-please | Tag object SHA is not a commit | Plan |
| Guard | New `tools/test/workflow-pins.test.mjs` | Issue says no test covers this; CI already runs `tools/test` | Plan |
| Dependabot | Not added | New file and decision, out of scope | Plan |
| ADR | None | Not an architecture decision | Plan |

## Scope

**In scope:** five `uses:` edits, one guard test.

**Out of scope:** Dependabot/Renovate, version bumps, workflow logic, ADR.

## Architecture / Approach

Edit the workflow files; the test reads `.github/workflows/*.yml` and checks the `uses:` pattern. SHAs re-verified with `git ls-remote` at implementation time.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pin the actions | Five pinned lines | Wrong SHA (tag object vs commit) |
| 2. Guard test | Test that rejects tag refs | Over-strict pattern on local or docker actions |

**Prerequisites:** network access for `git ls-remote`.
**Estimated effort:** ~1 session, 2 small phases.

## Open Risks & Assumptions

- Pins go stale until bumped by hand (no Dependabot).
- Assumes the `v5` tags are unmoved since 2026-11-11.
- Workflows only prove themselves on GitHub; local checks cover syntax and SHAs only.

## Success Criteria (Summary)

- No `@v<n>` reference left in the workflows.
- Guard test and full suite pass; CI and the next release run resolve the actions.
