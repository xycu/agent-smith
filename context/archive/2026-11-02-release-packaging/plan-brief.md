# Release packaging with Semantic Versioning — Plan Brief

> Full plan: `context/changes/release-packaging/plan.md`
> Research: `context/changes/release-packaging/research.md`

## What & Why

Ship agent-smith the way xycu/hegel-skill ships. release-please keeps a release PR current; merging it bumps the version under Semantic Versioning 2.0.0, tags `vX.Y.Z` and publishes a GitHub Release with a changelog. Today the plugin has a hand-written `0.1.0`, no tag, no CI and no release path.

## Starting Point

`.claude-plugin/plugin.json` holds the only version (`0.1.0`); `marketplace.json` has none. There is no `.github/` directory. `main` is unprotected. The owner rebase-merges, so each commit subject lands on `main`.

## Desired End State

A push to `main` updates one release PR. A pull request runs the tests, a version-lockstep guard and a Conventional Commits lint. After the owner flips one repo setting, merging the release PR yields tag `v0.2.0` and a GitHub Release, with every version field in step.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Release tool | release-please, release-PR model | Same mechanics as hegel-skill, reviewed bump through a PR. | User / Research |
| Token | `GITHUB_TOKEN`, no GitHub App | No signing ruleset or required checks exist here to justify an App. | Research |
| Commit lint | Lint each commit subject, not the PR title | Rebase merge lands commit subjects, which release-please reads. | Research |
| Drift guard | Dependency-free Node 24 `.mjs` | AGENTS.md bans npm dependencies and sets the Node 24 floor. | Research |
| First version | Stay on `0.1.0` (0.x) | semver.org item 4; `Release-As: 1.0.0` can force 1.0.0 later. | Plan (user) |
| Pre-1.0 bumps | `bump-minor-pre-major: true` | A breaking change must not jump a 0.x project to 1.0.0 by accident. | Research |
| First changelog | `bootstrap-sha` = current `main` HEAD | Keeps 184 old commits out of the changelog. | Research |

## Scope

**In scope:** marketplace version fields, `tools/version-check.mjs`, `tools/commit-lint.mjs` with tests, `ci.yml`, `release.yml`, release-please config and manifest, ADR-008, AGENTS.md and README sections.

**Out of scope:** GitHub App token, signed-commit rules, gemini manifest, OpenSpec, evals, infra-as-code, any change to the router, policy or prompts, a 1.0.0 reconcile, branch protection.

## Architecture / Approach

The guard and lint are small Node scripts run by `node --test` and by CI. release-please owns the version fields through `extra-files`; the guard is the independent check that they never drift. The owner's one-time Actions setting lets `GITHUB_TOKEN` open the release PR.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Version fields and drift guard | `marketplace.json` versions, `tools/version-check.mjs` and tests | Marketplace schema may reject `metadata`. |
| 2. Commit lint and CI | `tools/commit-lint.mjs` and tests, `ci.yml` | Lint too strict for existing habits. |
| 3. Release pipeline and docs | release-please config, manifest, `release.yml`, ADR-008, docs | Workflow cannot be run locally; owner setting needed. |

**Prerequisites:** Node 24, `gh` for the PR, owner access to repo Actions settings.
**Estimated effort:** about 1 session across 3 phases.

## Open Risks & Assumptions

- `release.yml` and `ci.yml` run only on GitHub, so their proof is Manual and comes after the PR merges.
- Under `GITHUB_TOKEN` the release PR triggers no other workflow; acceptable because `main` has no required checks.
- `bump-minor-pre-major` semantics are checked against the release-please schema in Phase 3.

## Success Criteria (Summary)

- The suite, version guard and commit lint pass locally and in CI.
- The first release PR opens on its own after merge and, once merged, tags `v0.2.0`.
