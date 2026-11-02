---
date: 2026-11-02T02:09:37+0100
researcher: Claude (Sonnet 5.5)
git_commit: 9503c35f6db5870596d749b4fbe4f04552a03c3f
branch: release-packaging
repository: agent-smith
topic: "Which packaging and distribution mechanics of xycu/hegel-skill apply to agent-smith, with Semantic Versioning"
tags: [research, packaging, release-please, semver, ci, plugin-manifest]
status: complete
last_updated: 2026-11-02
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Which packaging and distribution mechanics of xycu/hegel-skill apply to agent-smith, with Semantic Versioning

**Date**: 2026-11-02T02:09:37+0100
**Researcher**: Claude (Sonnet 5.5)
**Git Commit**: 9503c35f6db5870596d749b4fbe4f04552a03c3f
**Branch**: release-packaging
**Repository**: agent-smith

## Research Question

Copy the packaging and distribution mechanics of xycu/hegel-skill into agent-smith, using Semantic Versioning. Which mechanics exist there, which carry over, and what differs here?

## Summary

hegel-skill (latest release `v1.13.0`, `gh release list -R xycu/hegel-skill`) ships through five pieces: a release-please config and manifest, a release workflow, a lockstep guard over the version fields, a Conventional Commits check, and docs. Four carry over to agent-smith with changes. Three facts in this repo force those changes:

1. agent-smith merges by rebase (memory `branch-then-pr-merge`; `gh repo view` shows rebase, squash and merge all allowed), so each commit message, not a squash PR title, lands on `main`. Release-please reads those messages. The check has to validate commit subjects.
2. The repo has no tag and no release (`git tag` printed nothing), `main` has no branch protection and no rulesets (`gh api .../branches/main/protection` returned 404 `Branch not protected`, `.../rulesets` printed nothing), and no repository secrets were listed. hegel's GitHub App token (`RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY`) solves a signed-commits ruleset and required checks that agent-smith does not have. The default `GITHUB_TOKEN` is enough here, but the repo setting `can_approve_pull_request_reviews` is `false` (`gh api repos/xycu/agent-smith/actions/permissions/workflow`), and with it off, `GITHUB_TOKEN` cannot open the release PR. The owner must turn it on once.
3. AGENTS.md forbids npm dependencies and requires Node 24 for new code (`AGENTS.md` Hard Rules, ADR-006). The hegel drift guard is Python (`tools/version_check.py`), so the port is a dependency-free `.mjs`.

agent-smith carries `version` in one place today: `.claude-plugin/plugin.json:4` (`0.1.0`). `.claude-plugin/marketplace.json` has none. hegel keeps three fields in lockstep in these two files (plus `gemini-extension.json`, which agent-smith lacks).

## Detailed Findings

### hegel-skill release pipeline (the source)

- `release-please-config.json`: one package `.`, `release-type: simple`, `include-component-in-tag: false`, `extra-files` for `$.version` in `plugin.json`, `$..version` in `marketplace.json` (matches both `metadata.version` and `plugins[0].version`) and `$.version` in `gemini-extension.json`.
- `.release-please-manifest.json`: `{ ".": "1.13.0" }`, the current version, which release-please rewrites in the release PR.
- `.github/workflows/release.yml`: triggers on push to `main`; `permissions: contents: write, pull-requests: write`; a `concurrency` group with `cancel-in-progress: false`; mints a GitHub App token with `actions/create-github-app-token@v2`, then runs `googleapis/release-please-action@v5` with `config-file` and `manifest-file`.
- Model: every push to `main` updates one standing release PR; merging it bumps the version, tags `vX.Y.Z` and creates a GitHub Release with the generated changelog.
- Bump rule (`AGENTS.md` "Releases" in hegel): `fix:` patch, `feat:` minor, `!` or `BREAKING CHANGE:` major. This is release-please's Conventional Commits mapping and matches semver.org items 6 to 8 (patch, minor, major).
- Baseline: hegel reconciled its stale `0.1.0` to `1.0.0` through a one-time `release-as` bootstrap.

### hegel-skill guards

- `tools/version_check.py` reads the tracked fields and exits 1 with the divergent field named. It is wired into the `skill-ci` lint job. Its docstring says it exists because a manual edit, a bad updater config or a partial revert could desynchronise the fields.
- `.github/workflows/conventional-commits.yml` uses `amannn/action-semantic-pull-request@v5` on the PR title with types feat, fix, docs, chore, ci, refactor, perf, test, build, revert. It works there because the repo squash-merges (workflow comment).
- `signed-commits.yml`, `skill-ci*.yml`, `eval-image.yml`, `infra-plan.yml`, `openspec.yml` and the OpenTofu `infra/` serve hegel's persona evals, signing ruleset and GCP; they have no counterpart here and are out of scope.

### agent-smith today

- `.claude-plugin/plugin.json`: `name`, `displayName`, `version: 0.1.0`, `description`, `author`, `repository`, `license: Unlicense`, `keywords`.
- `.claude-plugin/marketplace.json`: `name`, `owner`, one `plugins[]` entry with `name`, `source`, `description`; no `version` and no `metadata`.
- `AGENTS.md` line 16 says to keep `name`, `description` and `version` aligned between the two manifests and the README. The README has no version text.
- Tests: `node --test skills/10x-pipeline/test/*.test.mjs` (AGENTS.md "Testing"). There is no `.github/` directory, so no CI exists at all. Nothing runs the tests automatically.
- History: 184 commits (`git log --oneline | wc -l`). The 40 newest subjects inspected all follow `type(scope): subject`, with types feat, fix, docs, chore and test. No tag exists. Release-please with no prior release scans the history from the start, so the first release PR would list all 184 commits unless a `bootstrap-sha` is set.
- Prior changes: `context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:153` and `context/archive/2026-10-31-pr-comment-report/plan.md:73` record that earlier changes deliberately left `plugin.json` and `marketplace.json` untouched. That is a convention (no manual bumps) that release-please now replaces.

### Semantic Versioning (semver.org, from the user's link)

- A version is `MAJOR.MINOR.PATCH`. Versions `0.y.z` are initial development, where anything may change. `1.0.0` defines the public API.
- release-please options `bump-minor-pre-major` and `bump-patch-for-minor-pre-major` control how breaking and feature commits bump a `0.x` version. Their exact defaults and behaviour were not read from release-please's source in this research; they come from its published config schema as named in hegel's `$schema` URL and are an open question to verify at implementation time.

### Differences that change the port

| Aspect | hegel-skill | agent-smith |
| --- | --- | --- |
| Merge method | squash, PR title linted | rebase, commit subjects must be linted |
| Release token | GitHub App (signed-commit ruleset) | `GITHUB_TOKEN`; needs the Actions PR-creation setting on |
| Drift guard | Python | dependency-free Node 24 `.mjs` |
| Version fields | 4 | 3 after the port: `plugin.json`, plus `marketplace.json` `metadata.version` and `plugins[0].version` (both new) |
| Required checks on `main` | yes | none, so the release PR needs no skip logic |
| CI | skill lint, evals, infra | the existing `node --test` suite only |

## Code References

- `.claude-plugin/plugin.json:4` - the only current `version` (`0.1.0`).
- `.claude-plugin/marketplace.json` - no version fields yet.
- `AGENTS.md:16` - manifest alignment rule to update.
- `AGENTS.md` "Commits" - says history sets no convention and to use Conventional Commits; update to make it enforced and tied to release bumps.
- `README.md` "Install" - install commands, where a release note belongs.
- hegel: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`, `.github/workflows/conventional-commits.yml`, `tools/version_check.py`, `AGENTS.md` "Releases" (all on `main` of xycu/hegel-skill).

## Architecture Insights

- The router and policy rules in AGENTS.md concern run state only; packaging touches none of `route.mjs`, `policy.json` or `SKILL.md`, so the Hard Rules on routing are not in play.
- A guard that runs in the existing test suite (`node --test`) keeps one command for "everything is green" and adds no workflow. Exposing it as a script also lets CI call it directly.
- Reading commit subjects on a rebase-merged PR means linting each commit in the PR range, not the PR title.

## Historical Context (from prior changes)

- `context/archive/2026-10-31-pr-comment-report/research.md:159` - "`plugin.json` and `marketplace.json`: not needed" (supported: that change touched README text only); the convention is superseded by this change for the version field only.
- ADR-006 (`docs/ADR/ADR-006-node-runtime-floor.md`) - Node 24 floor for new router and test code; applies to the guard.

## Related Research

None on packaging.

## Open Questions

1. **First version.** Stay on `0.x` (semver.org item 4, initial development) or reconcile to `1.0.0` as hegel did. Recommendation: stay on `0.1.0` as the manifest baseline; the owner can force `1.0.0` later with a `Release-As: 1.0.0` commit footer. Blocks nothing.
2. **Pre-1.0 bump behaviour.** Verify at implementation which release-please option keeps a breaking change from jumping a `0.x` project to `1.0.0` unintentionally. Recommendation: `bump-minor-pre-major: true`.
3. **History scope of the first release PR.** Whether to set `bootstrap-sha` to limit the changelog. Recommendation: set it to the commit that adds the config, so the first changelog starts there.
4. **Owner step.** Turn on Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests". Cannot be done from the change; the docs must say so.
