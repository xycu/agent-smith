# Repository Guidelines

agent-smith is a Claude Code plugin that runs 10xDevs and OpenSpec skill chains. Each step runs in its own subagent, and a dependency-free Node.js ESM router picks the next step, model and effort. See [README.md](README.md) for install and use, and [docs/REFERENCE.md](docs/REFERENCE.md) for routing behavior (read them only when the task needs them).

## Hard Rules

- Keep routing decisions in `skills/10x-pipeline/scripts/route.mjs` and the modules it imports (under `scripts/`, and `skills/openspec-pipeline/scripts/openspec.mjs`), and in `skills/10x-pipeline/policy.json` and `skills/openspec-pipeline/policy.json`. `SKILL.md` must not name models, effort levels or tiers beyond what it already documents, and `skills/openspec-pipeline/SKILL.md` names none beyond what `skills/10x-pipeline/SKILL.md` documents.
- `route.mjs` and the modules it imports (under `scripts/`, and `skills/openspec-pipeline/scripts/openspec.mjs`) own `context/changes/<change-id>/agent-smith/run.jsonl` and `meta.json`, and for the OpenSpec chain `openspec/changes/<change-id>/agent-smith/run.jsonl` and `meta.json`. Never edit them by hand or from a skill.
- Git and GitHub: only operations that cannot be undone are forbidden. Code, skills and prompts may commit, branch, add worktrees, write refs, push a branch and create, edit or comment on pull requests and issues. They never: force-push or rewrite pushed history; delete a branch, tag, ref or worktree that holds commits reachable from nowhere else; discard uncommitted work that no commit or ref holds (`git reset --hard`, `git checkout -- <path>`, `git clean`, `git stash drop` or `clear`); pass `--no-verify`; delete a repository, release, tag, issue or comment on GitHub, or change repository settings or branch protection. The router's current git writes and their recovery paths are in ADR-010 (the rollback snapshots the worktree under `refs/agent-smith/` before its `git reset --hard`), and the one commit of the `usage` command for a run in the archive state is in ADR-019; `skills/10x-pipeline/scripts/pr-comment.mjs` posts the run report and `skills/10x-pipeline/scripts/open-pr.mjs` pushes the run branch and opens its pull request at every end of a run, never with force and never merging (ADR-017; see Commands). The router never pushes and never calls `gh`.
- Add no npm dependencies. The router uses only `node:` built-ins and must run on Node 24+ (ADR-006).
- Never delete a directory tree with a recursive or forced command (`rm -rf`, `rm -r`, `rimraf`, `find -delete`, `fs.rm`/`fs.rmSync`/`fs.rmdir` with `recursive: true`) in code, tests, skills, prompts or docs. List the files, check the list, delete them one by one, then `rmdir` the empty directories deepest first. Code and tests use `removeTree` from `skills/10x-pipeline/scripts/remove-tree.mjs`; `skills/10x-pipeline/test/no-recursive-delete.test.mjs` guards the ban (ADR-016).
- Never edit `context/archive/`; it is read-only by convention.

## Commands

Run the tests after any change to `route.mjs`, a module under `scripts/`, `policy.json`, a prompt or `tools/`: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` (shell glob, Node 24 and later). The suite drives the real router through the CLI in scratch projects.

Smoke check: in a scratch project that has `context/changes/<id>/change.md` (or, for the OpenSpec chain, `openspec/config.yaml` and `openspec/changes/<id>/`), put `{ "isolation": { "require": false } }` in `context/foundation/agent-smith-policy.json`, then run `init <id> --goal "<text>"` (`--chain openspec` for that chain) and `status <id>`. It works when `init` returns `action: "run"` with a step; a halt is valid JSON too and proves nothing.

Router: `node skills/10x-pipeline/scripts/route.mjs <command>`. Every command takes `--chain 10x|openspec` (any other value halts before anything is read); flag details and halt rules are in `docs/REFERENCE.md`.

- `init <id> --goal "<text>" [--rigor lean|standard|thorough] [--archive] [--chrome false] [--pr-comment] [--chain openspec]` — start or resume a run. Every flag also reads `--key=value`. It halts, writing nothing, on words that belong to no flag.
- `next <id>` — consume `agent-smith/last-result.json`, return the next step.
- `status <id> [--report]` — the per-step model and effort log.
- `risk <id>` — churn hot paths, plan hits and diff hits; writes nothing.
- `usage <id> <n> --tokens N [--tool-uses N] [--duration-ms N]` — attach a late usage figure to step `<n>` (ADR-019).
- `verify-archive <id> [--path <p>]` — read-only; prints whether the change is archived.
- `compare <id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]` — read-only; routed run against a baseline run.

Run standalone scripts under `skills/10x-pipeline/scripts/` from the run root, except `prepare-run.mjs`, which runs from the original project root.

- `node <absolute-script-path>/prepare-run.mjs <id> [--chain 10x|openspec]` — prepare isolation before `init`. Runtime JSON has `reason: null` on success and `runRoot: null` on failure. Usage errors exit 2 (ADR-010 Amendment 2).
- `node skills/10x-pipeline/scripts/open-pr.mjs <id> [--chain 10x|openspec] [--report <p>] [--remote <name>] [--base <branch>] [--draft] [--timeout-ms <n>]` — commit leftovers, push the run branch without force, open or keep its pull request (ADR-017).
- `node skills/10x-pipeline/scripts/pr-comment.mjs <id> [--report <p>] [--pr <url>] [--timeout-ms <n>]` — post the run report as a comment on the pull request, or edit its earlier comment. `GH_LIVE=1` enables its read-only live tests, which a human runs.
- `node tools/version-check.mjs` — exit 0 when every version field is equal and valid SemVer. `node tools/commit-lint.mjs <range>` (for example `main..HEAD`) — exit 0 when every subject is a Conventional Commit; `--title "<text>"` lints one pull request title.

## Commits

Every commit subject follows [Conventional Commits](https://www.conventionalcommits.org/): `type(scope)!: description`, with `type` one of `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `perf`, `test`, `build`, `revert`. The owner squash-merges, so the pull request title is the one subject on `main`: `pr-title.yml` lints it and the `commits` job in `ci.yml` lints each branch commit, both advisory. Run PRs get a derived title (ADR-017). Do not put a `BREAKING CHANGE:` line in a commit body unless the change is breaking, because the squash body carries it. The type sets the SemVer bump (ADR-008):

| Commit | Bump |
| --- | --- |
| `feat:` | minor |
| `!` after the type, or a `BREAKING CHANGE:` footer | major |
| any other type | patch (release-please's default when a release has no `feat` or breaking commit) |

`docs`, `chore`, `refactor`, `test`, `build` and `ci` are hidden in the changelog, so a run of only those opens no release PR; `feat`, `fix`, `perf` and `revert` do.
Add a `Co-Authored-By:` trailer for AI-assisted commits.

## Coding Style

- Plain JavaScript ES modules, 2-space indent, double quotes, semicolons, as in `route.mjs`.
- Policy keys are camelCase; step names are kebab-case (`plan-review`, `impl-review`).
- A policy change belongs in `policy.json`. A per-project override belongs in `context/foundation/agent-smith-policy.json`, never in the router scripts under `scripts/`.
- When you change tier logic (`tierFor` in `scripts/steps.mjs`, `decide` in `scripts/flow.mjs`), update the "How the tier moves" list in `SKILL.md` and the routing bullets in `docs/REFERENCE.md`. When you change `decideOpenspec` or the verification in `skills/openspec-pipeline/scripts/openspec.mjs`, update the OpenSpec section of `docs/REFERENCE.md`.
- Router modules: `state.mjs`, `preplan.mjs`, `steps.mjs`, `openspec.mjs` (in `skills/openspec-pipeline/scripts/`), `flow.mjs` and `isolation.mjs` each import only from the ones before it in that list, and none imports `route.mjs`, which runs `main()` on import. `route.mjs` keeps `next`, the undo on halt and the commands.

## Layout

- `.claude-plugin/` — `plugin.json` and `marketplace.json`; keep `name` and `description` aligned between the two and with `README.md`. `version` is set only by the release PR, and the `marketplace.json` plugin entry carries none.
- `skills/10x-pipeline/` — `SKILL.md` (the orchestrator loop), `policy.json` (ladder, tiers, escalation, limits, prompt templates) and `baseline-policy.json` (the baseline arm of `compare`; data the user copies, the router does not read it).
- `skills/openspec-pipeline/` — the OpenSpec chain (ADR-013): `SKILL.md` (the same loop on the shared router; its `## Anti-stall rules` section equals the one of the 10x skill), `policy.json` (the `os-` steps and prompts, merged with the 10x `policy.json` at load), `prompts/` (indexed in its `README.md`), `rules/chain.md` (the always-true rules of the chain, ADR-023), `scripts/openspec.mjs` (the OpenSpec router module) and `test/` (the OpenSpec tests and `openspec-helpers.mjs`, indexed in its `README.md`).
- `skills/10x-pipeline/scripts/` — the router modules and the standalone scripts (`open-pr.mjs`, `pr-comment.mjs`, `pr-common.mjs`, `remove-tree.mjs`); the import order is under Coding Style.
- `skills/10x-pipeline/prompts/` — prompt files, indexed in `skills/10x-pipeline/prompts/README.md`.
- `skills/10x-pipeline/rules/` — the always-true rule files that no override reaches (`top.md`, `steps/<step>.md`; ADR-023), indexed with the OpenSpec one in `skills/10x-pipeline/rules/README.md`.
- `skills/10x-pipeline/test/` — the suite and its helpers, indexed in `skills/10x-pipeline/test/README.md`.
- `tools/` and `tools/test/` — `version-check.mjs`, `commit-lint.mjs` and `workflow-pins.mjs` (every remote action in `.github/` is pinned to a 40-hex SHA with a version comment); tests are in the test index.
- `agents/` — `score.md`, the restricted agent of the `score` step.
- `docs/REFERENCE.md` — routing behavior; read it only when the task needs it.
- `docs/ADR/` — architecture decisions, indexed in `docs/ADR/README.md`.
- `context/` — 10x workflow docs (`changes/`, `archive/`, `foundation/`; a README in each). `openspec/` holds this repository's own OpenSpec specs.
- `.github/workflows/` — `ci.yml`, `pr-title.yml` and `release.yml` (ADR-008, ADR-020).
- `assets/` — README header image only.

A new test, prompt or ADR gets its row in the README of its folder, not in `AGENTS.md`.

## Releases

Releases are made by [release-please](https://github.com/googleapis/release-please) in the release-PR model (`.github/workflows/release.yml`, `release-please-config.json`, `.release-please-manifest.json`; ADR-008). One release PR collects the changes. Merging it sets the version, creates the tag `vX.Y.Z` and publishes a GitHub Release with the changelog (`CHANGELOG.md`).

- **One version, three fields.** `plugin.json` `version`, `marketplace.json` `metadata.version` and the manifest `.` hold the same version; the `plugins[0]` entry carries no `version` (ADR-008 Amendment 3). release-please updates them together; never edit them by hand. `tools/version-check.mjs` fails on drift or an entry `version` in `ci.yml`.
- **Owner setting, once.** Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests". Without it `release.yml` fails when it opens the PR.
- **Release only after a green CI run.** The release job runs from the `workflow_run` of a green CI run of a push to `main`, and only while `main` still points at that commit; ADR-008 Amendment 1 has the rest.
- **No checks on the release PR.** A PR opened with `GITHUB_TOKEN` starts no other workflow. `main` has no required checks, so the owner merges it after reading the diff.
- **Version.** The version is read from `.release-please-manifest.json`. To force a version, put a `Release-As: X.Y.Z` footer on a commit.
