# Repository Guidelines

agent-smith is a Claude Code plugin that runs 10xDevs skill chains. Each step runs in its own subagent, and a dependency-free Node.js ESM router picks the next step, model and effort. See @README.md for install and routing behavior.

## Hard Rules

- Keep routing decisions in `skills/10x-pipeline/scripts/route.mjs` and `skills/10x-pipeline/policy.json`. `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.
- `route.mjs` owns `context/changes/<change-id>/agent-smith/run.jsonl` and `meta.json`. Never edit them by hand or from the skill.
- The router's only git writes are the index and commit writes of the pre-archive commit in the `done` branch of a run started with `--archive`: `git add`, `git commit`, and a `git reset` of its own add after a failure. It never pushes, never passes `--no-verify` and sets no `-c` option except `core.quotePath=false`. Everything else it does with git is a read.
- The router never calls `gh`. `skills/10x-pipeline/scripts/pr-comment.mjs` is the only code that posts to GitHub, and only for a run started with `--pr-comment`. Its only network writes are one issue comment, created or edited, on an open `github.com` pull request of the current branch, found by a hidden marker. It never writes under the project root.
- Add no npm dependencies. The router uses only `node:` built-ins and must run on Node 24+ (ADR-006).
- Never edit `context/archive/`; it is read-only by convention.

## Project Structure

- `.claude-plugin/plugin.json` — plugin manifest. `.claude-plugin/marketplace.json` — marketplace listing this repo as its only plugin. Keep `name` and `description` aligned between the two and with @README.md. `version` is set only by the release PR (see Releases); `tools/version-check.mjs` fails when the fields differ.
- `skills/10x-pipeline/SKILL.md` — orchestrator instructions (the loop over router output).
- `skills/10x-pipeline/policy.json` — model ladder, base tiers, escalation, limits, prompt templates.
- `skills/10x-pipeline/baseline-policy.json` — per-project override that pins the baseline arm of `compare` (all tiers `sonnet`/`high`, `standard` rigor, no plan-review skip). Data the user copies; the router does not read it.
- `skills/10x-pipeline/scripts/route.mjs` — router: `init`, `next`, `status`, `risk`, `verify-archive`, `compare`.
- `skills/10x-pipeline/test/` — `node:test` suite: `route.test.mjs`, `churn.test.mjs`, `archive.test.mjs`, `rules.test.mjs`, `compare.test.mjs`, `lessons.test.mjs` (lesson candidates: sanitizer, report section, prompt wiring) and `helpers.mjs` (scratch projects, `run.jsonl` fixtures, hermetic git).
- `skills/10x-pipeline/prompts/` — rule-form prompt files; `policy.json` references them as `@prompts/<file>.md`.
- `skills/10x-pipeline/test/preplan.test.mjs`, `loops-existing.test.mjs` and `loops.test.mjs` — pre-plan gates and prompt wiring, the characterized RETHINK/REVISE loop (never edit it; the one exception is the two tier literals renumbered by ADR-010's ladder change), and the new loops and budget reference paths.
- `skills/10x-pipeline/test/executors.test.mjs`, `codereplan.test.mjs`, `manualverify.test.mjs`, `budget-executors.test.mjs` and `phase-helpers.mjs` — the phase-executors change: commit check, fallback, executor routing, retry, the report label (`executors.test.mjs`); code re-plans; `manual-verify` and `--chrome`; the budget derived from the longest legal path; and plan builders, log fixtures and `gateCheck` for the plan's Progress rows. `helpers.mjs` stays as it was, except for `writeOverride(project, policy)`: `makeProject` always writes the override file through it, and it adds `score: { minRigor: null }` unless the test gives its own `score` key, so existing tests keep `plan` as the first step.
- `skills/10x-pipeline/test/skill-loop.test.mjs` — content check of the `## Anti-stall rules` section of `SKILL.md`: five rules in order, placement outside the Loop branches, no model, effort or tier word. Its rule form is checked in `rules.test.mjs`.
- `skills/10x-pipeline/test/score.test.mjs` — the complexity score step (ADR-007): policy data, gate, file validation, failure skip, tier shift, report and status. A test turns the scorer on with `policy: { score: { minRigor: "standard" } }`.
- `skills/10x-pipeline/test/provenance.test.mjs` — run provenance: the record in `meta.json`, hash stability, drift, legacy runs and the `compare` warnings. A test that changes a plugin file (a prompt, `plugin.json`, `agents/`) copies the plugin tree to a scratch directory, edits the copy and spawns the copy's `route.mjs`; it never edits a repository file.
- `skills/10x-pipeline/test/agents.test.mjs` — restricted step agents: the `agent` field of the run output, the log entry and `status`, malformed `agents` blocks, the agent definition file, the provenance link and the `SKILL.md` dispatch line. A test turns it on with `policy: { score: { minRigor: "standard" }, agents: { restricted: true } }`; a test that edits `agents/score.md` uses a scratch copy of the plugin tree.
- `skills/10x-pipeline/test/advisor.test.mjs` — the opt-in advisor (ADR-009): no advisor text with the default policy, its place in the prompts of the listed templates, the `advisor` log flag, malformed `advisor` blocks, the prompt file and the provenance link. A test turns it on with `policy: { advisor: { enabled: true } }`.
- `skills/10x-pipeline/prompts/advisor.md` — rules that ask `plan` and `implement` to consult the advisor once before the `RESULT` line; appended only when `advisor.enabled` is `true` (`advisor.templates` in `policy.json`). It names no model; see `prompts/README.md`.
- `agents/score.md` — plugin agent definition of the `score` step (`agent-smith:score`): `tools: Read, Grep, Glob, Write`, no `model` and no `effort`. The router names it only when `agents.restricted` is `true` (`agents.steps` in `policy.json`).
- `skills/10x-pipeline/prompts/score.md` — rules and rubric of the `score` subagent, which writes `complexity.json`; see `prompts/README.md`.
- `skills/10x-pipeline/prompts/executor-e2e.md`, `executor-tdd.md`, `executor-retry.md`, `impl-review-warn.md` and `manual-verify.md` — prompts of the phase executors and `manual-verify`; see `prompts/README.md`.
- `skills/10x-pipeline/prompts/impl-review-lessons.md` — suffix of both implementation review prompts that asks for lesson candidates; see `prompts/README.md`.
- `tools/version-check.mjs` — drift guard: `plugin.json`, both `marketplace.json` version fields and `.release-please-manifest.json` must be equal and valid SemVer. `tools/commit-lint.mjs` — Conventional Commits check for the subjects of a git range. Tests: `tools/test/*.test.mjs`.
- `release-please-config.json`, `.release-please-manifest.json` — release-please configuration and the current version. `.github/workflows/ci.yml` — tests, version check and commit lint; `.github/workflows/release.yml` — the release PR. See ADR-008.
- `docs/ADR/` — architecture decision records (ADR-001 to ADR-009). ADR-009 covers run provenance, restricted step agents and the advisor flag.
- `context/` — 10x workflow docs: `changes/`, `archive/`, `foundation/`. See the README in each.
- `assets/` — README header image only.

## Commands

There is no build or lint setup. Run the tests with `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (shell glob, Node 24 and later). Exercise the router from a project root that has `context/changes/<id>/change.md`:

- `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "<text>" [--rigor lean|standard|thorough] [--archive] [--chrome]` — start or resume a run. `--archive` makes `done` commit the change folder and return an `archive` action (`--archive false` turns it off). `--chrome` picks the `manual-verify` template that may use the Chrome tools (`--chrome false` turns it off).
- `node tools/version-check.mjs` — exit 0 when every version field is equal and valid SemVer. `node tools/commit-lint.mjs <range>` (for example `main..HEAD`) — exit 0 when every commit subject in the range is a Conventional Commit.
- `node skills/10x-pipeline/scripts/route.mjs next <id>` — consume `agent-smith/last-result.json`, return the next step.
- `node skills/10x-pipeline/scripts/route.mjs status <id>` — print the per-step model and effort log.
- `node skills/10x-pipeline/scripts/route.mjs risk <id>` — print churn hot paths, plan hits and diff hits; writes nothing.
- `node skills/10x-pipeline/scripts/pr-comment.mjs <id> [--report <p>]` — post the run report as a comment on the open pull request of the current branch, or edit its earlier comment. Prints one JSON object and exits 0 on a skip. Its tests are in `skills/10x-pipeline/test/pr-comment.test.mjs`; `GH_LIVE=1` enables the read-only live tests, which a human runs.
- `node skills/10x-pipeline/scripts/route.mjs verify-archive <id> [--path <p>]` — read-only; prints `archived: true` only when the archive folder has `status: archived` and `context/changes/<id>/` is gone. Files only, no git.
- `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]` — read-only; writes nothing. Compares the usage of a routed run with a baseline run (a second checkout with `baseline-policy.json` as its override) and prints totals, coverage, tokens by model and by tier, `comparable`, `reasons`, `warnings`, `dropPercent` and `verdict`. `--unpinned` is for the scorer A/B check: it accepts a baseline that is not pinned (a routed run with the scorer off), warns `baseline-unpinned` and gives the verdict `unpinned`; a value other than `true` or `false` halts.

## Coding Style

- Plain JavaScript ES modules, 2-space indent, double quotes, semicolons, as in `route.mjs`.
- Policy keys are camelCase; step names are kebab-case (`plan-review`, `impl-review`).
- A policy change belongs in `policy.json`. A per-project override belongs in `context/foundation/agent-smith-policy.json`, never in `route.mjs`.
- When you change tier logic in `route.mjs` (`tierFor`, `decide`), update the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md`.

## Testing

Run `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` after any change to `route.mjs`, `policy.json`, a prompt or `tools/`. The suite drives the real router through the CLI in scratch projects and checks the rule form of every prompt. New router and test code must run on Node 24 (ADR-006). Then run `init` and `status` against a scratch change folder and confirm the JSON output is valid.

## Commits

Every commit subject follows [Conventional Commits](https://www.conventionalcommits.org/): `type(scope)!: description`, with `type` one of `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `perf`, `test`, `build`, `revert`. The `commits` job in `ci.yml` checks each commit of a pull request, because the owner rebase-merges and the subjects land on `main`. The type sets the SemVer bump (ADR-008):

| Commit | Bump |
| --- | --- |
| `feat:` | minor |
| `!` after the type, or a `BREAKING CHANGE:` footer | minor while the version is below 1.0.0, major from 1.0.0 |
| any other type | patch (release-please's default when a release has no `feat` or breaking commit) |

Whether a commit opens a release PR on its own depends on release-please's changelog sections: by default `docs`, `chore`, `refactor`, `test`, `build` and `ci` are hidden, `feat`, `fix`, `perf` and `revert` are shown. That part is not tested here; the first release PR confirms it.
Add a `Co-Authored-By:` trailer for AI-assisted commits.

## Releases

Releases are made by [release-please](https://github.com/googleapis/release-please) in the release-PR model (`.github/workflows/release.yml`, `release-please-config.json`, `.release-please-manifest.json`; ADR-008). Every push to `main` updates one release PR. Merging it sets the version, creates the tag `vX.Y.Z` and publishes a GitHub Release with the changelog (`CHANGELOG.md`).

- **One version, four fields.** `plugin.json` `version`, `marketplace.json` `metadata.version` and `plugins[0].version`, and the manifest `.` hold the same version. release-please updates them together; never edit them by hand. `tools/version-check.mjs` runs in `ci.yml` and fails on drift.
- **Owner setting, once.** Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests". Without it `release.yml` fails when it opens the PR.
- **No checks on the release PR.** A PR opened with `GITHUB_TOKEN` starts no other workflow. `main` has no required checks, so the owner merges it after reading the diff.
- **Version line.** The version is `0.x` (SemVer initial development). To release `1.0.0`, put a `Release-As: 1.0.0` footer on a commit.
- **Release type.** A run of only hidden-section commits (`docs`, `chore`, `ci`, `test`, `build`, `refactor`) is expected to open no release PR; the next `feat` or `fix` does.
