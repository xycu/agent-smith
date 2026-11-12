# ADR-008: Release packaging with release-please and Semantic Versioning

- **Status:** Accepted (2026-11-02, repository owner); amended 2026-11-12 (Amendment 1)
- **Date:** 2026-11-02
- **Deciders:** repository owner
- **Origin:** the `release-packaging` change. Change folder: `context/changes/release-packaging/change.md`. The mechanics are copied from xycu/hegel-skill, with the differences below.

## Context

- The plugin had a hand-written version (`0.1.0` in `.claude-plugin/plugin.json`), no tag, no release and no CI.
- hegel-skill ships with release-please in the release-PR model: one standing release PR bumps the version, tags `vX.Y.Z` and publishes a GitHub Release with a changelog. A drift guard keeps its version fields equal, and a lint enforces Conventional Commits.
- This repository rebase-merges, so commit subjects land on `main` as written. hegel-skill squash-merges and lints the PR title.
- `main` has no branch protection or ruleset, so the GitHub App token and the signed-commits workflow that hegel-skill needs have no counterpart here.
- `AGENTS.md` forbids npm dependencies and sets the Node 24 floor (ADR-006), so the guard and the lint cannot be Python or use a package.

## Decision

Releases follow Semantic Versioning 2.0.0 and are made by release-please from Conventional Commits. The version lives in `.claude-plugin/plugin.json` (`version`), `.claude-plugin/marketplace.json` (`metadata.version` and `plugins[0].version`) and `.release-please-manifest.json`. Two dependency-free Node scripts guard the inputs: `tools/version-check.mjs` and `tools/commit-lint.mjs`.

Rules, written as scenarios (the form of ADR-004):

**GIVEN** a commit on `main` **WHEN** its type is `feat` **THEN** release-please **MUST** bump the minor number.

**GIVEN** a release with no `feat` and no breaking commit **WHEN** release-please computes the version **THEN** it **MUST** bump the patch number.

**GIVEN** a commit with `!` after its type or a `BREAKING CHANGE:` footer **WHEN** the version is below 1.0.0 **THEN** release-please **MUST** bump the minor number.

**GIVEN** a commit with `!` after its type or a `BREAKING CHANGE:` footer **WHEN** the version is 1.0.0 or above **THEN** release-please **MUST** bump the major number.

**GIVEN** a version field in a manifest **WHEN** a contributor wants to change it **THEN** the contributor **MUST NOT** edit it by hand, because only the release PR changes it.

**GIVEN** a pull request **WHEN** one of its commit subjects is not a Conventional Commit **THEN** the `commits` check **MUST** fail.

**GIVEN** the owner wants version 1.0.0 **WHEN** the line is ready **THEN** the owner **MAY** put a `Release-As: 1.0.0` footer on a commit.

**GIVEN** a new guard script **WHEN** it is written **THEN** it **MUST** use only `node:` built-ins (ADR-006).

## Consequences

- The first release comes from the history after `bootstrap-sha` (`9503c35`). release-please shows `feat`, `fix`, `perf` and `revert` in the changelog and hides `docs`, `chore`, `refactor`, `test`, `build` and `ci` by default; a run of only hidden commits is expected to open no release PR (to be confirmed by the first release PR).
- The plugin stays on a `0.x` version, so semver.org item 4 applies: anything may change. Breaking changes bump minor until the owner cuts 1.0.0.
- The release PR is opened with `GITHUB_TOKEN`, so no other workflow runs on it. This is acceptable because `main` has no required checks.
- The owner must switch on "Allow GitHub Actions to create and approve pull requests" once. Until then `release.yml` fails when it tries to open the PR.
- The commit lint reads subjects only; it does not check the body or the `BREAKING CHANGE:` footer. A breaking change without `!` or a footer is released as the type it was committed with.
- The workflows run only in GitHub Actions, never locally. Since ADR-020 the CI jobs run on self-hosted TrueNAS runners (hosted for fork pull requests), and `release.yml` stays on GitHub-hosted runners. `ci.yml` and `release.yml` were checked with `actionlint` at implementation time; no workflow runs it, so the first pull request and the first release PR are the real proof.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| GitHub App token as in hegel-skill | not adopted | It solves a signed-commits ruleset and required checks on the release PR; this repository has neither. It can be added when they exist. |
| Lint the PR title (`amannn/action-semantic-pull-request`) | rejected | The repository rebase-merges, so the PR title never reaches `main`. |
| Reconcile to 1.0.0 with a one-time `release-as` | not adopted | The router and policy keys are still uncalibrated, so 1.0.0 would promise stability the project does not have. |
| Manual tags and a hand-written changelog | rejected | The version fields would drift, and the bump would depend on memory. |
| Python guard as in hegel-skill | rejected | It would add a second runtime; ADR-006 and `AGENTS.md` set Node 24 and no dependencies. |

## Amendment 1: release only after a green CI run (change release-after-green-ci)

### Context

- `release.yml` ran release-please on every push to `main` with no link to CI, and `ci.yml` cancelled its own runs on `main` when a later push arrived. Version 1.5.0 was tagged on `5160a8a`, whose CI run failed (`coauthor.test.mjs:158`). Of 97 CI runs on `main`, 38 were cancelled.
- `main` has no branch protection (Context above), so nothing else blocks a release from a red or cancelled commit.

### Rules

- **GIVEN** a release job **WHEN** it starts **THEN** it **MUST** start only from a successful CI run of a push to `main` (`workflow_run` with `conclusion == 'success'` and `event == 'push'`) whose commit is still the head of `main` (`workflow_run.head_sha == github.sha`).
- **GIVEN** a push to `main` **WHEN** a later push arrives **THEN** the CI run of the first push **MUST NOT** be cancelled or replaced while pending, so each such push has its own concurrency group (`github.sha`); only superseded pull request runs are cancelled.
- **GIVEN** a CI run of `main` that failed or was cancelled **WHEN** the release workflow follows it **THEN** the job **MUST** be skipped, so no release PR update and no tag follow from it.

### Consequences

- The tag sits on the merge commit of the release PR, while the gate checks the head of `main`. If a later push lands before the CI run of that merge commit ends, the job skips that run (stale `head_sha`) and the next green run of the newer head tags the merge commit, whose own CI run may have failed. The gate guarantees a green head, not a green tagged commit. This gap is accepted; closing it needs a job step that reads the CI conclusion of the tagged commit.
- A flake delays a release and does not lose it: rerunning the failed CI run until it passes starts the job again while `main` still points at that commit. If `main` moved on, the CI run of the newer head decides.
- The release PR no longer updates on a red `main`, and it lags a push by the CI duration.
- The tag and GitHub Release follow the CI run of the release-PR merge commit.
- GitHub-hosted minutes are unchanged (`release.yml` stays hosted); the TrueNAS runner serialises more CI runs because pushes to `main` are no longer cancelled.
- The `concurrency` block of `release.yml` moved from the workflow to the job, so a run whose job the `if` skips does not take the pending slot of the group. This and the rerun behaviour are unverified until the live check (rows 3.5 and 3.6 of the plan).
- `release-please-action` runs no checked-out code, so the write token never meets code from a pull request. The `event == 'push'` condition keeps a pull request from a fork branch named `main` out.

### Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Branch protection with required checks | not adopted | This record runs the repository without branch protection or required checks (Context above); a workflow gate gives the same guard for releases without changing repository settings. |
| A `needs:` job that runs CI inside `release.yml` | rejected | It would run the suite twice or move CI out of `ci.yml`, and pull request runs would lose their shared workflow. |
| Change only `cancel-in-progress` on `ci.yml` | rejected | GitHub still replaces a pending run of the same group with a newer one, so three pushes together lose results; a group key unique per push does not. |
