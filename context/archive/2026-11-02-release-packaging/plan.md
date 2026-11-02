# Release packaging with Semantic Versioning Implementation Plan

## Overview

Ship agent-smith the way xycu/hegel-skill ships: release-please in the release-PR model bumps the version, tags `vX.Y.Z` and publishes a GitHub Release with a changelog, driven by Conventional Commits under Semantic Versioning 2.0.0. A dependency-free Node guard keeps every version field in lockstep, a commit-subject lint replaces hegel's PR-title lint (this repo rebase-merges), and a CI workflow runs the existing test suite.

## Current State Analysis

- `.claude-plugin/plugin.json:4` holds the only version, `0.1.0`. `.claude-plugin/marketplace.json` has none.
- There is no `.github/` directory, no tag, no release, no CI. `main` has no branch protection or ruleset.
- The repo setting "workflow permissions" has `can_approve_pull_request_reviews: false`, so `GITHUB_TOKEN` cannot open a pull request until the owner turns it on.
- The owner rebase-merges PRs (memory `branch-then-pr-merge`), so each commit subject lands on `main`.
- `AGENTS.md` forbids npm dependencies, requires Node 24 for new code (ADR-006) and says history sets no commit convention.

## Desired End State

- Every push to `main` keeps one release PR current. Merging it sets the version in `plugin.json` and both `marketplace.json` fields (and the manifest), tags `vX.Y.Z` and creates the GitHub Release.
- `node tools/version-check.mjs` exits 0 only when all version fields agree and are valid SemVer; `node tools/commit-lint.mjs <range>` exits 0 only when every commit subject is a Conventional Commit.
- A pull request runs the test suite, the version check and the commit lint in CI.
- Verified by: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` is green, and after the owner enables the setting and merges, the first release PR opens (Manual).

### Key Discoveries:

- hegel's config uses `release-type: simple` with `extra-files` JSON paths (`research.md`, "hegel-skill release pipeline").
- hegel's lint validates the squash PR title; here the commit subject is what lands, so the lint reads `git log` (`research.md`, "Differences that change the port").
- `can_approve_pull_request_reviews: false` blocks `GITHUB_TOKEN` PR creation (`research.md`, Summary point 2).
- Prior changes left both manifests untouched by convention (`context/archive/2026-10-31-pr-comment-report/plan.md:73`); this change replaces that convention for `version` only.

## What We're NOT Doing

- No GitHub App token, signed-commits ruleset or `signed-commits` workflow (hegel needs them for its ruleset; agent-smith has none).
- No `gemini-extension.json`, OpenSpec, promptfoo evals, OpenTofu `infra/` or Python tooling.
- No change to `route.mjs`, `policy.json`, `SKILL.md` or any prompt.
- No reconcile to `1.0.0`: the version stays `0.1.0`, and a later `Release-As: 1.0.0` footer can force it.
- No npm package, no `engines` field, no marketplace publishing beyond the existing `/plugin marketplace add xycu/agent-smith`.
- No branch protection or required-checks setup (owner's call).

## Implementation Approach

Three phases, each green on its own. The guard lands first because the release config and its `extra-files` list depend on the field layout. Lint and CI come second so the release phase is already covered by CI. The release config and docs land last, so the first release PR is generated from a repo that already enforces its inputs. Tests for the tools live in `tools/test/` and run through the same `node --test` command as the router tests.

## Phase 1: Version fields and drift guard

### Overview

Give `marketplace.json` the same version fields as hegel and add a guard that fails when the fields differ or are not SemVer.

### Changes Required:

#### 1. Marketplace version fields

**File**: `.claude-plugin/marketplace.json`

**Intent**: Carry the plugin version in the marketplace listing, as hegel does, so release-please has both places to update.

**Contract**: Add a `metadata` object with `description` and `version: "0.1.0"`, and `version: "0.1.0"` on `plugins[0]`. `name`, `owner`, `source` and the plugin `description` are unchanged.

#### 2. Drift guard

**File**: `tools/version-check.mjs`

**Intent**: Port hegel's `tools/version_check.py` to dependency-free Node 24 ESM, and add a SemVer validity check.

**Contract**: Export `collect(root)` returning `[label, version]` pairs for `plugin.json:version`, `marketplace.json:metadata.version` and `marketplace.json:plugins[0].version`, and `check(root)` returning a list of error strings. Run as a CLI, it prints `version-check: OK (<version>)` and exits 0, or prints each divergent or invalid field to stderr and exits 1. A version is valid when it matches the semver.org 2.0.0 regular expression. `root` defaults to the repository root derived from `import.meta.url`.

#### 3. Guard tests

**File**: `tools/test/version-check.test.mjs`

**Intent**: Pin the guard's behavior with `node:test`, using scratch directories.

**Contract**: Cases: all fields equal and valid exits 0; one drifted field exits 1 and names it; a version such as `1.0` or `v1.0.0` exits 1; a missing file or field exits 1 with a message, not a stack trace.

### Success Criteria:

#### Automated Verification:

- Guard tests pass: `node --test tools/test/version-check.test.mjs`
- Guard passes on the repo: `node tools/version-check.mjs`
- Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Both manifests stay valid JSON: `node -e "for (const f of ['plugin','marketplace']) JSON.parse(require('fs').readFileSync('.claude-plugin/'+f+'.json','utf8'))"`
- Claude Code accepts the manifests: `claude plugin validate .` reports `Validation passed`

#### Manual Verification:

- `/plugin marketplace add ./` in a Claude Code session accepts the edited marketplace file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Commit lint and CI

### Overview

Enforce Conventional Commits on the commits of a pull request and run the tests in CI.

### Changes Required:

#### 1. Commit lint

**File**: `tools/commit-lint.mjs`

**Intent**: Validate commit subjects in a range, because the rebase merge puts each subject on `main`, where release-please reads it.

**Contract**: Export `lintSubject(subject)` returning an error string or `null`. A subject is valid when it matches `type(scope)!: description`, where `type` is one of `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `perf`, `test`, `build`, `revert`, `(scope)` and `!` are optional, and the description is non-empty. Subjects starting with `Merge ` are skipped. The CLI takes one git range argument, reads `git log --format=%h%x09%s <range>` (read-only), prints each invalid commit with its reason, and exits 1 on any failure and 0 otherwise. An empty range, or a missing argument, exits 2 with a usage line.

#### 2. Lint tests

**File**: `tools/test/commit-lint.test.mjs`

**Intent**: Pin the accepted and rejected subject shapes and the CLI exit codes in a scratch git repository.

**Contract**: Accept `feat: x`, `fix(router): x`, `feat!: x`, `chore(llm-complexity-scorer): x`; reject `Update stuff`, `feat:x`, `feat(): x`, `FEAT: x`, `feat: `. A scratch repo with one good and one bad commit exits 1 and names the bad hash; with only good commits it exits 0. Git runs with an isolated config so the user's global settings do not leak in.

#### 3. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Run the checks that already exist, plus the two new guards, on every pull request and push to `main`.

**Contract**: Triggers `pull_request` and `push` to `main`. Permissions `contents: read`. Job `test` runs on `ubuntu-latest` with `actions/checkout@v5` and `actions/setup-node@v5` at Node 24, then `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `node tools/version-check.mjs`. Job `commits` runs on `pull_request` only, checks out with `fetch-depth: 0` and runs `node tools/commit-lint.mjs <base sha>..<head sha>` from `github.event.pull_request`.

### Success Criteria:

#### Automated Verification:

- Lint tests pass: `node --test tools/test/commit-lint.test.mjs`
- The branch's own commits pass the lint: `node tools/commit-lint.mjs main..HEAD`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Workflow is valid: `actionlint .github/workflows/ci.yml`
- Workflow names the Node 24 floor and both commands: `grep -c "node-version: 24" .github/workflows/ci.yml` prints 2 (one per job) and `grep -c "commit-lint.mjs" .github/workflows/ci.yml` prints 1 or more

#### Manual Verification:

- The CI run on the opened pull request shows `test` and `commits` green

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Release pipeline and docs

### Overview

Add release-please, record the decision, and document the flow, including the one setting only the owner can change.

### Changes Required:

#### 1. release-please config and manifest

**File**: `release-please-config.json`, `.release-please-manifest.json`

**Intent**: Configure one package at the repo root that bumps by Conventional Commits and rewrites every version field.

**Contract**: Config has `$schema`, `packages["."]` with `release-type: simple`, `package-name: agent-smith`, `include-component-in-tag: false`, `bump-minor-pre-major: true`, and `bootstrap-sha` set to `9503c35f6db5870596d749b4fbe4f04552a03c3f`, the `main` HEAD before this change, so the first changelog starts there. `extra-files` has JSON entries for `.claude-plugin/plugin.json` `$.version` and `.claude-plugin/marketplace.json` `$..version`. The manifest is `{ ".": "0.1.0" }`. Verify the exact meaning of `bump-minor-pre-major` against release-please's published schema before committing.

#### 2. Release workflow

**File**: `.github/workflows/release.yml`

**Intent**: On every push to `main`, run release-please to maintain the standing release PR and publish the release when it merges.

**Contract**: Trigger `push` to `main`; permissions `contents: write`, `pull-requests: write`; `concurrency` group `release-please` with `cancel-in-progress: false`; one job running `googleapis/release-please-action@v5` with `token: ${{ secrets.GITHUB_TOKEN }}`, `config-file` and `manifest-file`. A header comment states the owner setting needed and that the release PR does not trigger other workflows under `GITHUB_TOKEN`.

#### 3. Guard covers the manifest

**File**: `tools/version-check.mjs`, `tools/test/version-check.test.mjs`

**Intent**: The manifest is a fourth place that release-please rewrites, so the guard checks it too.

**Contract**: `collect` adds `.release-please-manifest.json:.` when the file exists; a test pins a drifted manifest to exit 1.

#### 4. ADR

**File**: `docs/ADR/ADR-008-release-packaging-and-semver.md`

**Intent**: Record the decision, in the scenario form of ADR-004, with the hegel differences as alternatives.

**Contract**: Status Accepted; rules in GIVEN/WHEN/THEN with one bold RFC 2119 keyword each: commit types drive the SemVer bump; every version field changes only through the release PR; the `0.x` line treats a breaking change as a minor bump; the guard and the lint stay dependency-free. Alternatives: GitHub App token, squash-merge title lint, reconcile to `1.0.0`, manual tagging.

#### 5. Contributor and user docs

**File**: `AGENTS.md`, `README.md`

**Intent**: Document the release flow where contributors and users look for it.

**Contract**: `AGENTS.md` Project Structure lists `tools/`, `.github/workflows/`, the config files and `ADR-001 to ADR-008`; Commands adds the test glob with `tools/test`, `version-check.mjs` and `commit-lint.mjs`; Commits replaces "sets no convention" with the enforced rule and the bump table; a new Releases section carries the flow, the owner setting and the `Release-As:` footer. The line that says to keep `name`, `description` and `version` aligned is rewritten to say `version` changes only through the release PR. `README.md` gets a short "Versions and releases" section (SemVer, tags, where the changelog is) and the layout block gains the new paths.

### Success Criteria:

#### Automated Verification:

- Config files are valid JSON: `node -e "for (const f of ['release-please-config.json','.release-please-manifest.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"`
- Release workflow is valid: `actionlint .github/workflows/release.yml`
- Guard and its tests pass with the manifest: `node --test tools/test/version-check.test.mjs && node tools/version-check.mjs`
- ADR rule lines pass the rule-form check: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Docs name the new files: `grep -c "release-please-config.json" AGENTS.md README.md` prints 1 or more per file
- Manifest version equals plugin version: `node tools/version-check.mjs`

#### Manual Verification:

- The owner enables Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"
- After the PR merges, the `Release` workflow run on `main` succeeds and opens a release PR titled `chore(main): release 0.2.0`
- Merging the release PR creates tag `v0.2.0` and a GitHub Release, and the three version fields read `0.2.0`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `lintSubject` accepts and rejects the shapes named in Phase 2.
- `check` reports drift, invalid SemVer and missing fields without throwing.

### Integration Tests:

- The CLI of each tool runs against a scratch directory or scratch git repo and its exit code and stderr are asserted.

### Manual Testing Steps:

1. Open the pull request and confirm the `test` and `commits` jobs are green.
2. Enable the Actions setting, merge the PR and watch the `Release` run.
3. Merge the release PR and check the tag, the release and the version fields.

## Performance Considerations

None. The tools read two or three small files or one `git log`.

## Migration Notes

The first release follows `0.1.0` with `bump-minor-pre-major: true`: a `feat:` commit gives `0.2.0`, and a breaking change also bumps minor until the owner cuts `1.0.0` with a `Release-As: 1.0.0` footer. `bootstrap-sha` keeps the 184 earlier commits out of the first changelog. Only `feat`, `fix` and breaking commits make release-please open a release PR; `docs`, `chore`, `ci`, `test` and `build` do not. The Phase 3 pipeline commit therefore uses the type `feat(release)` (tagged, installable releases are user-visible distribution), so the first release PR can open.

## References

- Related research: `context/changes/release-packaging/research.md`
- Source of the mechanics: xycu/hegel-skill `release-please-config.json`, `.github/workflows/release.yml`, `tools/version_check.py`
- Node floor: `docs/ADR/ADR-006-node-runtime-floor.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Version fields and drift guard

#### Automated

- [x] 1.1 Guard tests pass: `node --test tools/test/version-check.test.mjs` — c667e37
- [x] 1.2 Guard passes on the repo: `node tools/version-check.mjs` — c667e37
- [x] 1.3 Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs` — c667e37
- [x] 1.4 Both manifests stay valid JSON — c667e37
- [x] 1.5 Claude Code accepts the manifests: `claude plugin validate .` reports `Validation passed` — c667e37

#### Manual

- [ ] 1.6 `/plugin marketplace add ./` in a Claude Code session accepts the edited marketplace file

### Phase 2: Commit lint and CI

#### Automated

- [x] 2.1 Lint tests pass: `node --test tools/test/commit-lint.test.mjs` — dbde326
- [x] 2.2 The branch's own commits pass the lint: `node tools/commit-lint.mjs main..HEAD` — dbde326
- [x] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — dbde326
- [x] 2.4 Workflow names the Node 24 floor and both commands — dbde326
- [x] 2.6 Workflow is valid: `actionlint .github/workflows/ci.yml` — dbde326

#### Manual

- [ ] 2.5 The CI run on the opened pull request shows `test` and `commits` green

### Phase 3: Release pipeline and docs

#### Automated

- [x] 3.1 Config files are valid JSON — 8cdbe4a
- [x] 3.2 Guard and its tests pass with the manifest — 8cdbe4a
- [x] 3.3 ADR rule lines pass the rule-form check: `node --test skills/10x-pipeline/test/rules.test.mjs` — 8cdbe4a
- [x] 3.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 8cdbe4a
- [x] 3.5 Docs name the new files — 8cdbe4a
- [x] 3.6 Manifest version equals plugin version: `node tools/version-check.mjs` — 8cdbe4a
- [x] 3.10 Release workflow is valid: `actionlint .github/workflows/release.yml` — 8cdbe4a

#### Manual

- [ ] 3.7 The owner enables the Actions setting "Allow GitHub Actions to create and approve pull requests"
- [ ] 3.8 After the PR merges, the `Release` run on `main` succeeds and opens a release PR titled `chore(main): release 0.2.0`
- [ ] 3.9 Merging the release PR creates tag `v0.2.0` and a GitHub Release, and the three version fields read `0.2.0`
