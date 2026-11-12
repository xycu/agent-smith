# Slim AGENTS.md to rules and pointers Implementation Plan

## Overview

`AGENTS.md` (33,366 bytes, loaded in every agent session) is 60 percent a catalog of tests, prompts, scripts and ADRs, in order of addition, already incomplete, partly duplicated and partly false. Cut it to about 8 KB: the Hard Rules, the commands every change needs, Commits, Coding Style, a grouped layout of pointers and a short Releases section. Move the test bullets to a new `skills/10x-pipeline/test/README.md` and the ADR summaries to a new `docs/ADR/README.md`, drop the prompt bullets (`skills/10x-pipeline/prompts/README.md` is their index), fix the stale statements and re-point the three tests that pin `AGENTS.md` text.

## Current State Analysis

- `AGENTS.md` sections: intro, Hard Rules (lines 5-12), Project Structure (14-60, 20 KB: 45 bullets), Commands (62-75), Coding Style, Testing, Commits, Releases.
- Duplicates: the test command appears in Commands and Testing; the hidden-release-sections rule in Commits (line 98) and Releases ("Release type"); the ADR-019 sentence in Hard Rules, the `usage` command line and the one-line ADR bullet (line 58, about 2.7 KB, one bullet for ADR-001 to ADR-022).
- Stale or false statements:
  - Releases: "The version is `0.x` ... put a `Release-As: 1.0.0` footer" (`.release-please-manifest.json` and `CHANGELOG.md` say 1.6.1).
  - Commits: "That part is not tested here; the first release PR confirms it" (many release PRs have run; `release-please-config.json` has no `changelog-sections`, so the default hidden sections apply).
  - Testing: "run `init` and `status` against a scratch change folder and confirm the JSON output is valid" passes while no routing ran: with the shipped `isolation.require: true`, `init` in a scratch folder without git halts (checked in a scratch dir: `action: "halt"`, "Run isolation (isolation.require) needs a git work tree"), and a halt is valid JSON. With `{ "isolation": { "require": false } }` in `context/foundation/agent-smith-policy.json`, `init` returns `action: "run", step: "plan"` (checked).
  - Commands: `status` listed without `--report` (usage line of `route.mjs:833` and `docs/REFERENCE.md:234` have it); `pr-comment.mjs` listed without `--timeout-ms` (`pr-comment.mjs:12`, default `DEFAULT_TIMEOUT_MS = 20000` in `pr-common.mjs:11`); `docs/REFERENCE.md` has no `--timeout-ms` text.
- Incomplete as an index: `skills/10x-pipeline/test/at-or-above.test.mjs`, `open-pr.test.mjs`, `pr-common.test.mjs` and the five `tools/test/*.test.mjs` files that are not named are missing from the catalog; `prompts/README.md` already covers all prompt files in a Wired table.
- Tests that read `AGENTS.md` (verified by grep):
  - `skills/10x-pipeline/test/advisor.test.mjs:582-596` (test "3.6"): requires `` `skills/10x-pipeline/prompts/advisor.md` ``, `` `skills/10x-pipeline/test/advisor.test.mjs` `` and `(ADR-001 to ADR-011)` in `AGENTS.md`.
  - `skills/10x-pipeline/test/no-recursive-delete.test.mjs:141` (scans `AGENTS.md` for banned delete forms) and `:256` (`AGENTS.md` matches `/removeTree/`). Both stay true if Hard Rules is kept verbatim. The same scan covers `docs/` and `skills/`, so the two new README files are scanned too.
  - `skills/10x-pipeline/test/pr-comment.test.mjs:810-816`: slices `## Hard Rules` to `## Project Structure` and `## Commands` to `## Coding Style`, requires `pr-comment.mjs` in both and `pr-comment.test.mjs` in Commands.
  - `tools/test/agents-md-no-imports.test.mjs:44`: no `@` import in `AGENTS.md`; the new text must not contain an `@path` outside code spans.
  - `skills/10x-pipeline/test/helpers.mjs:141` only mentions `AGENTS.md` in a comment.
- `README.md:85` links `AGENTS.md`; nothing else in `skills/`, `tools/` or `.github/` reads it.

## Desired End State

`AGENTS.md` is at most about 8 KB (hard limit 12 KB by test), in this order: intro, Hard Rules (unchanged), Commands (the test command once, with the smoke check, then one line per command), Commits, Coding Style, Layout (grouped pointers), Releases. `skills/10x-pipeline/test/README.md` indexes every test and helper file by topic with the facts that were in the catalog bullets. `docs/ADR/README.md` lists ADR-001 to ADR-022 with a one-line summary each. No statement in `AGENTS.md` contradicts the repository. The full suite passes, and CI is green on the pull request.

### Key Discoveries:

- Tests slice `AGENTS.md` by heading, so the heading names `## Hard Rules`, `## Commands` and the next heading after Commands are load-bearing (`pr-comment.test.mjs:812-813`).
- The `no-recursive-delete` scan also reads every `.md` under `skills/` and `docs/`; the new README files must name the ban without writing a banned command form (write "recursive or forced deletes", not the literal commands).
- `prompts/README.md` already lists `advisor.md` and every other prompt file, so the advisor pin moves there.
- The smoke check works as the change describes: the override file is `context/foundation/agent-smith-policy.json`.

## What We're NOT Doing

- No change to router code, `policy.json`, prompts, `SKILL.md` files or ADR texts.
- No move of the export lists of `state.mjs` into `docs/REFERENCE.md`: they are dropped (the code is the index; `docs/REFERENCE.md` is already 134 KB). The import-order rule of the router modules stays as one sentence.
- No new `@` imports.
- No test that checks every path named in `AGENTS.md` exists (a possible follow-up).
- No edit of `context/archive/`.

## Implementation Approach

Three phases, each leaving the suite green. Phase 1 only adds files (indexes), so nothing can break. Phase 2 rewrites `AGENTS.md` and re-points the three pinning tests and adds the size test in one commit, because they must change together. Phase 3 is verification and the pull request.

## Phase 1: Index files

### Overview

Create the two indexes that receive the moved text, and close the `--timeout-ms` gap in the reference.

### Changes Required:

#### 1. Test index

**File**: `skills/10x-pipeline/test/README.md` (new)

**Intent**: Index every file in `skills/10x-pipeline/test/` and `tools/test/` by topic, carrying over the facts from the old catalog bullets (what each file checks, the ADR it belongs to, how a test turns a policy block on). Model it on `skills/10x-pipeline/prompts/README.md` (short intro, then tables or grouped bullets).

**Contract**: Groups, each file named in backticks with a one-line scope: core router (`route`, `churn`, `archive`, `rules`, `compare`, `lessons`, `at-or-above`, `override-json`, `file-guard`, `provenance`); pre-plan and loops (`preplan`, `loops-existing`, `loops`, `score`, `advisor`, `agents`); phase executors (`executors`, `codereplan`, `manualverify`, `budget-executors`, `phase-helpers.mjs`); isolation and git (`ladder`, `isolation`, `stepcommit`, `rollback`, `firstattempt`, `coauthor`, `run-lock`); review and findings (`openfindings`, `cost`, `neutral`, `late-usage`, `policy-validate`); PR scripts (`open-pr`, `pr-comment`, `pr-common`, `no-recursive-delete`, `nested-subagents`, `skill-loop`, `archive-gate`); OpenSpec chain (`openspec-*`); `tools/test/*.test.mjs` (`agents-md-no-imports`, `ci-runner`, `commit-lint`, `release-gate`, `version-check`, `workflow-pins`, plus the size test from Phase 2). A "Helpers" section keeps these facts: `helpers.mjs` (scratch projects, `run.jsonl` fixtures, hermetic git; stays as it was except `writeOverride(project, policy)` with its three defaults `score: { minRigor: null }`, `isolation: { require: false }`, `manualVerify: { minRigor: null }`, and `cleanupAll` calling `removeTree`), `ahead.mjs` (`stampAhead`, mtime a minute ahead), `openspec-helpers.mjs`. Keep the rules that matter to an editor: `loops-existing.test.mjs` is never edited (one exception: the two tier literals renumbered by ADR-010), the contract test `openspec-contract.test.mjs` skips when `OPENSPEC_BIN` does not start, `GH_LIVE=1` enables the live `pr-comment` tests. Name the test command once at the top. Do not write a literal recursive or forced delete command form.

#### 2. ADR index

**File**: `docs/ADR/README.md` (new)

**Intent**: One table, ADR-001 to ADR-022: number linked to the file, title, one-line summary. Take the summaries from the old ADR bullet in `AGENTS.md` (line 58) for ADR-009 to ADR-022, and from each file's title and Context for ADR-001 to ADR-008. Include the amendment notes (ADR-008 Amendment 1, ADR-010 Amendment 1, ADR-012 Amendment 1).

**Contract**: ADR-009 row must name the advisor flag (the advisor test pins it, Phase 2). Each ADR file in the folder has exactly one row.

#### 3. Reference gap

**File**: `docs/REFERENCE.md`

**Intent**: The `--timeout-ms` flag of `pr-comment.mjs` and `open-pr.mjs` is documented nowhere but the usage strings. Add one sentence next to the existing `pr-comment.mjs` and `open-pr.mjs` text (lines near the matches of `pr-comment.mjs`): the flag, a positive integer in milliseconds, default 20000.

**Contract**: No other change to the file.

### Success Criteria:

#### Automated Verification:

- Every `*.test.mjs` and helper file in `skills/10x-pipeline/test/` and `tools/test/` is named in the test index: `for f in skills/10x-pipeline/test/*.mjs tools/test/*.mjs; do grep -q "$(basename $f)" skills/10x-pipeline/test/README.md || echo MISSING $f; done` prints nothing
- Every ADR file has a row: `for f in docs/ADR/ADR-*.md; do grep -q "$(basename $f)" docs/ADR/README.md || echo MISSING $f; done` prints nothing
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- The test index groups files by topic and a reader can find the test for a given feature without opening a file
- The ADR summaries match the ADR texts

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Rewrite AGENTS.md and re-point the tests

### Overview

Replace the catalog with pointers, fix the stale statements, and move each test pin to the file that now owns the text. One commit, because the tests and the text change together.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Slim to about 8 KB in the section order Hard Rules, Commands, Commits, Coding Style, Layout, Releases. Delete `## Project Structure` and `## Testing`.

**Contract**:
- Intro: keep the two sentences; keep the README and REFERENCE pointers.
- `## Hard Rules`: keep every rule as is (the five Hard Rules bullets plus the `context/archive/` rule). They hold `pr-comment.mjs`, `open-pr.mjs`, `removeTree`, ADR-010, ADR-017, ADR-019. Do not add the ADR-019 text anywhere else.
- `## Commands` (heading name unchanged): first the test command once, `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (shell glob, Node 24 and later, "after any change to `route.mjs`, a module under `scripts/`, `policy.json`, a prompt or `tools/`"). Then the smoke check: put `{ "isolation": { "require": false } }` in `context/foundation/agent-smith-policy.json` of a scratch project that has `context/changes/<id>/change.md` (or `openspec/config.yaml` and `openspec/changes/<id>/` for the OpenSpec chain), run `init <id> --goal "<text>"` (`--chain openspec` for that chain) and `status <id>`; success means `init` returns an `action: "run"` step, not a halt. Then one line per command, each a synopsis with its flags and at most one clause: `init` (flags: `--rigor`, `--archive`, `--chrome false`, `--chain`, `--goal`, `--key=value` form), `next`, `status <id> [--report]`, `risk`, `usage <id> <n> --tokens N [--tool-uses N] [--duration-ms N]` (ADR-019), `verify-archive`, `compare` (`--baseline`, `--routed`, `--format md`, `--unpinned`), `open-pr.mjs` (flags incl. `--timeout-ms`; ADR-017), `pr-comment.mjs` (`--report`, `--pr`, `--timeout-ms`), `tools/version-check.mjs`, `tools/commit-lint.mjs <range>`. One sentence that every router command takes `--chain 10x|openspec` and that flag details and halt rules are in `docs/REFERENCE.md`.
- `## Commits`: keep the Conventional Commits rule, the type list, the bump table and the `Co-Authored-By:` line. State the hidden-sections rule once here ("`docs`, `chore`, `refactor`, `test`, `build` and `ci` are hidden in the changelog, so a run of only those opens no release PR; `feat`, `fix`, `perf` and `revert` do"), and delete "That part is not tested here; the first release PR confirms it".
- `## Coding Style`: unchanged (four bullets). Fold in the one-sentence note on the router module import order: `state.mjs`, `preplan.mjs`, `steps.mjs`, `openspec.mjs`, `flow.mjs`, `isolation.mjs` each import only from the ones before it in that list, none imports `route.mjs` (it runs `main()` on import), and `route.mjs` keeps `next`, the undo on halt and the commands.
- `## Layout`: ten to twelve lines, one per directory or file group, each pointing at its index: `.claude-plugin/` (manifests, keep `name` and `description` aligned with README, `version` set only by the release PR); `skills/10x-pipeline/` (`SKILL.md`, `policy.json`, `baseline-policy.json`); `skills/openspec-pipeline/SKILL.md` (OpenSpec chain, ADR-013, shares the router, its Anti-stall section equals the 10x one); `skills/10x-pipeline/scripts/` (router and standalone scripts; import-order note above); `skills/10x-pipeline/prompts/` -> `prompts/README.md`; `skills/10x-pipeline/test/` -> `test/README.md`; `tools/` and `tools/test/` (version-check, commit-lint, workflow-pins: every remote action pinned to a 40-hex SHA with a version comment); `agents/` (`score.md`); `docs/` -> `docs/REFERENCE.md`; `docs/ADR/` -> `docs/ADR/README.md`; `context/` (10x workflow docs, README in each folder; `openspec/` holds this repository's own OpenSpec specs); `.github/workflows/` (`ci.yml`, `release.yml`; ADR-008, ADR-020); `assets/` (README image only).
- `## Releases`: keep the release-please model sentence, "One version, four fields" (never edit by hand; `tools/version-check.mjs` fails on drift), "Owner setting, once", "Release only after a green CI run" cut to two sentences (the `workflow_run` of a green CI run of `main`, only while `main` still points at that commit; ADR-008 Amendment 1 has the rest), "No checks on the release PR". Delete "Version line" and "Release type". Replace with one sentence: the version is read from `.release-please-manifest.json`; to force a version use a `Release-As: X.Y.Z` footer.
- Do not use any `@path` text outside code spans.

#### 2. Advisor pin

**File**: `skills/10x-pipeline/test/advisor.test.mjs` (test "3.6", lines 592-595)

**Intent**: The three required parts moved with their text. Replace the `AGENTS.md` loop with checks against the indexes that now hold them.

**Contract**: `prompts/README.md` includes `` `advisor.md` ``; `skills/10x-pipeline/test/README.md` includes `advisor.test.mjs`; `docs/ADR/README.md` includes `ADR-009` and `advisor`; `AGENTS.md` includes `skills/10x-pipeline/test/README.md` and `docs/ADR/README.md`. Rename the test title to say "the reference and the indexes describe the advisor flag".

#### 3. pr-comment pin

**File**: `skills/10x-pipeline/test/pr-comment.test.mjs` (test at line 810)

**Intent**: Slice Hard Rules up to `## Commands` and Commands up to the next `\n## ` heading, instead of fixed heading names that are going away. The test file name now lives in the test index.

**Contract**: `rules` (from `## Hard Rules` to `## Commands`) includes `pr-comment.mjs`; the Commands section (to the next `\n## `) includes `pr-comment.mjs`; `skills/10x-pipeline/test/README.md` includes `pr-comment.test.mjs`. Update the test title.

#### 4. no-recursive-delete pin

**File**: `skills/10x-pipeline/test/no-recursive-delete.test.mjs`

**Intent**: No change needed while Hard Rules keeps `removeTree` and the ban text; confirm by running the file. Only touch it if the run fails, and then keep the assertion on `AGENTS.md` (`/removeTree/`) and the scan list.

**Contract**: unchanged unless a failure shows a banned form in a new README.

#### 5. Size guard

**File**: `tools/test/agents-md-size.test.mjs` (new)

**Intent**: Keep `AGENTS.md` from growing back into a catalog. Follow the style of `tools/test/agents-md-no-imports.test.mjs`.

**Contract**: One test: `statSync("AGENTS.md").size <= 12288`, with a failure message that names the limit and says the index files take new detail (`skills/10x-pipeline/test/README.md`, `docs/ADR/README.md`, `skills/10x-pipeline/prompts/README.md`). Add the file to the `tools/test` group of the test index from Phase 1.

### Success Criteria:

#### Automated Verification:

- `AGENTS.md` is at most 12288 bytes (target about 8000): `test $(wc -c < AGENTS.md) -le 12288`
- The three pinning tests pass: `node --test skills/10x-pipeline/test/advisor.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- The import and size guards pass: `node --test tools/test/agents-md-no-imports.test.mjs tools/test/agents-md-size.test.mjs`
- No stale text remains: `grep -n "0\.x\|first release PR confirms\|Project Structure" AGENTS.md` prints nothing, and `grep -c "node --test" AGENTS.md` prints 1
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `node tools/version-check.mjs` exits 0

#### Manual Verification:

- Every rule that was in Hard Rules is still there word for word (diff the section against `main`)
- The smoke check, run as written in `AGENTS.md` in a fresh scratch project, returns `action: "run"` from `init`
- Every path named in `AGENTS.md` exists in the repository
- A reader who needs a prompt, a test or an ADR can find its index from the Layout section

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Verify and open the pull request

### Overview

Run the whole check once more from a clean state and let CI confirm.

### Changes Required:

#### 1. Final check and pull request

**File**: none (git and CI only)

**Intent**: Prove the done-when statement: suite green locally, `AGENTS.md` has no statement that contradicts the repository, CI green on the pull request.

**Contract**: Run the full suite and `tools/commit-lint.mjs main..HEAD`. The run branch is pushed and its pull request opened by `open-pr.mjs` at the end of the run (ADR-017); this phase does not push by hand. Commit subjects follow Conventional Commits; per the run-branch memory, check the branch for `feat` or `fix` commits before the PR (this change is `docs`/`test`/`chore` only, so it opens no release PR on its own).

### Success Criteria:

#### Automated Verification:

- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Commit subjects pass: `node tools/commit-lint.mjs main..HEAD`
- The smoke check from `AGENTS.md` returns an `init` step in a scratch project

#### Manual Verification:

- CI is green on the pull request (self-hosted runner, ADR-020; cannot be confirmed from the repository)
- The owner reads the new `AGENTS.md` and finds no statement that contradicts the repository

---

## Testing Strategy

### Unit Tests:

- `tools/test/agents-md-size.test.mjs`: size limit of 12 KB.
- Re-pointed pins in `advisor.test.mjs` and `pr-comment.test.mjs`.

### Integration Tests:

- The whole suite, which includes the `no-recursive-delete` scan over the two new README files and `agents-md-no-imports` over the new `AGENTS.md`.

### Manual Testing Steps:

1. Follow the smoke check in `AGENTS.md` in a scratch directory and confirm a plan step comes back.
2. Open each pointer in the Layout section and confirm the target exists and is the index it claims.

## Performance Considerations

Every agent session now loads about 8 KB instead of 32 KB of `AGENTS.md`; no runtime change.

## Migration Notes

None. Text that left `AGENTS.md` lives in the two new indexes (tests, ADRs), is dropped (export lists of `state.mjs`), or already exists (`prompts/README.md`, `docs/REFERENCE.md`).

## References

- Change: `context/changes/agents-md-slim/change.md`
- Pins: `skills/10x-pipeline/test/advisor.test.mjs:582`, `skills/10x-pipeline/test/pr-comment.test.mjs:810`, `skills/10x-pipeline/test/no-recursive-delete.test.mjs:141,256`, `tools/test/agents-md-no-imports.test.mjs:44`
- Model for the indexes: `skills/10x-pipeline/prompts/README.md`
- Release facts: `release-please-config.json`, `.release-please-manifest.json`, ADR-008

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Index files

#### Automated

- [ ] 1.1 Every `*.test.mjs` and helper file in `skills/10x-pipeline/test/` and `tools/test/` is named in the test index: `for f in skills/10x-pipeline/test/*.mjs tools/test/*.mjs; do grep -q "$(basename $f)" skills/10x-pipeline/test/README.md || echo MISSING $f; done` prints nothing
- [ ] 1.2 Every ADR file has a row: `for f in docs/ADR/ADR-*.md; do grep -q "$(basename $f)" docs/ADR/README.md || echo MISSING $f; done` prints nothing
- [ ] 1.3 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 1.4 The test index groups files by topic and a reader can find the test for a given feature without opening a file
- [ ] 1.5 The ADR summaries match the ADR texts

### Phase 2: Rewrite AGENTS.md and re-point the tests

#### Automated

- [ ] 2.1 `AGENTS.md` is at most 12288 bytes (target about 8000): `test $(wc -c < AGENTS.md) -le 12288`
- [ ] 2.2 The three pinning tests pass: `node --test skills/10x-pipeline/test/advisor.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 2.3 The import and size guards pass: `node --test tools/test/agents-md-no-imports.test.mjs tools/test/agents-md-size.test.mjs`
- [ ] 2.4 No stale text remains: `grep -n "0\.x\|first release PR confirms\|Project Structure" AGENTS.md` prints nothing, and `grep -c "node --test" AGENTS.md` prints 1
- [ ] 2.5 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.6 `node tools/version-check.mjs` exits 0

#### Manual

- [ ] 2.7 Every rule that was in Hard Rules is still there word for word (diff the section against `main`)
- [ ] 2.8 The smoke check, run as written in `AGENTS.md` in a fresh scratch project, returns `action: "run"` from `init`
- [ ] 2.9 Every path named in `AGENTS.md` exists in the repository
- [ ] 2.10 A reader who needs a prompt, a test or an ADR can find its index from the Layout section

### Phase 3: Verify and open the pull request

#### Automated

- [ ] 3.1 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.2 Commit subjects pass: `node tools/commit-lint.mjs main..HEAD`
- [ ] 3.3 The smoke check from `AGENTS.md` returns an `init` step in a scratch project

#### Manual

- [ ] 3.4 CI is green on the pull request (self-hosted runner, ADR-020; cannot be confirmed from the repository)
- [ ] 3.5 The owner reads the new `AGENTS.md` and finds no statement that contradicts the repository
