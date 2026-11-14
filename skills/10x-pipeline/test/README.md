# Tests

Index of `skills/10x-pipeline/test/` and `tools/test/`, by topic. Run everything with `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` (shell glob, Node 24 and later). The suite drives the real router through the CLI in scratch projects and checks the rule form of every prompt. A new test file gets its row here, not in `AGENTS.md`.

A test turns an opt-in policy block on with `policy: { ... }` in `makeProject`; the block each file uses is named in its row.

## Core router

| File | Scope |
| --- | --- |
| `route.test.mjs` | `init`, `next`, `status` and the main routing paths |
| `churn.test.mjs` | `risk` command: churn hot paths, plan hits and diff hits |
| `archive.test.mjs` | archive adapter, `verify-archive`, the `--archive` run |
| `rules.test.mjs` | rule form of every prompt and rule file (GIVEN/WHEN/THEN, one RFC 2119 keyword; ADR-004) |
| `rule-levels.test.mjs` | rule levels (ADR-023): the order after the template (chain defaults, suffix, step file, chain file, `rules/top.md`), a suffix override keeps `top.md`, `ruleTail` on a scratch rule tree, the halts on a missing or unreadable rule file, the archive prompts of both chains, the placeholder limits, the `ruleFiles` provenance section and the precedence rules. A test that changes a rule file uses a scratch copy of the plugin tree |
| `compare.test.mjs` | `compare`: totals, coverage, tokens by model and tier, verdict, `--unpinned`, failure classification in JSON and Markdown |
| `lessons.test.mjs` | lesson candidates: sanitizer, report section, prompt wiring |
| `at-or-above.test.mjs` | `atOrAbove` rigor comparison; an unknown level fails closed |
| `override-json.test.mjs` | a project override that does not parse, or is not an object, halts every command with the file name; a missing file is no override |
| `file-guard.test.mjs` | `guardedStat`, `readGuarded` and `planFileTokens` of `state.mjs`, and two symlink cases of their callers (a symlinked score file, a symlinked evidence file); calls the modules directly |
| `provenance.test.mjs` | run provenance: the record in `meta.json`, hash stability, drift, legacy runs, `compare` warnings. A test that changes a plugin file copies the plugin tree to a scratch directory and spawns the copy's `route.mjs`; it never edits a repository file |
| `helpers-timeout.test.mjs` | the `run` and `git` helpers of `helpers.mjs` time out or die on a signal and throw a clear error naming the command; the fast path keeps its return shape |

## Pre-plan steps and loops

| File | Scope |
| --- | --- |
| `preplan.test.mjs` | pre-plan gates and prompt wiring |
| `loops-existing.test.mjs` | the characterized RETHINK/REVISE loop. Never edit it; the one exception is the two tier literals renumbered by ADR-010's ladder change |
| `loops.test.mjs` | the new loops and the budget reference paths |
| `score.test.mjs` | complexity score step (ADR-007): policy data, gate, file validation, failure skip, tier shift, report and status. Turn on with `score: { minRigor: "standard" }` |
| `advisor.test.mjs` | opt-in advisor (ADR-009): no advisor text by default, its place in the listed prompts, the `advisor` log flag, malformed `advisor` blocks, the prompt file, the provenance link, and the pin that the indexes describe the advisor flag. Turn on with `advisor: { enabled: true }` |
| `agents.test.mjs` | restricted step agents (ADR-009): the `agent` field of the run output, log entry and `status`, malformed `agents` blocks, the agent definition file, the provenance link, the `SKILL.md` dispatch line. Turn on with `score: { minRigor: "standard" }, agents: { restricted: true }`; a test that edits `agents/score.md` uses a scratch copy of the plugin tree |

## Phase executors

| File | Scope |
| --- | --- |
| `executors.test.mjs` | commit check, fallback, executor routing, retry, the report label |
| `codereplan.test.mjs` | code re-plans |
| `manualverify.test.mjs` | `manual-verify` and `--chrome` (ADR-012): every row in scope at every level, outside the pool, browser rows and their proof kinds, the reason in the outputs, report marks, tier and retry, evidence kinds, `evidence/unproven.md` reasons, the prompt and the Chrome default. Turn the step on with `manualVerify: { minRigor: "lean" }` |
| `budget-executors.test.mjs` | the budget derived from the longest legal path, `manual-verify` and its retry included, at `lean`, `standard` and `thorough`: longest legal path, failure path, lean without a pool step |
| `budget-pool-score.test.mjs` | the budget with a raised pool allowance and with scorer failures skipped |
| `budget-confirm-shipped.test.mjs` | the confirmation round at the shipped policy (off) and at the shipped `budgetDelta` |
| `budget-confirm-rounds.test.mjs` | each confirmation round adds a `plan-review` and an `impl-review` step, which a `budgetDelta` raised by 2 per round holds |
| `budget-helpers.mjs` | helper: fixtures, plan renderer, `walkFixture` and `walkAware`; registers no tests |
| `phase-helpers.mjs` | helper: plan builders, log fixtures and `gateCheck` for the plan's Progress rows |

## Isolation, commits and recovery

| File | Scope |
| --- | --- |
| `ladder.test.mjs` | the 8-rung ladder and the effort floor on the rung's effort (ADR-010) |
| `isolation.test.mjs` | the isolation gate of `init`. Builds real linked worktrees with hermetic git; turn on with `isolation: { require: true }` |
| `stepcommit.test.mjs` | the start and step commits (ADR-010) |
| `rollback.test.mjs` | the failed-step rollback and its undo on halt (ADR-010) |
| `firstattempt.test.mjs` | the cheaper first implement attempt (ADR-010) |
| `coauthor.test.mjs` | the `coAuthor` trailer (ADR-021): start commit, step commit, rollback snapshot, pre-archive and late-usage commits carry it; `coAuthor: null` gives none; a malformed value halts; parity of `coAuthorProblem`/`coAuthorTrailer` in `state.mjs` with `coAuthorLine` in `open-pr.mjs` |
| `codex-runner.test.mjs` | fake Codex CLI execution, exact dispatch validation, optional profiles, permission preflight refusal, RESULT/completion/usage boundaries, cancellation, cleanup and archive moves on both chains |
| `codex-helpers.mjs` | external-command fixture shared by Codex runner and process-contention tests, with fragmented JSONL, recorded argv/stdin/cwd and a controllable child lifetime |
| `run-lock.test.mjs` | the per-run lock of execution, `status --report`, `init`, `next` and `usage`: live-owner refusal, legacy stale-lock recovery, crash exclusion until the child process group exits, uncertain-child refusal, release on success and halt, read-only commands, both chains. `TMPDIR` points the lock into a scratch directory |

## Reviews, cost, retries and policy

| File | Scope |
| --- | --- |
| `openfindings.test.mjs` | routing of reviews on open findings (ADR-011): the `### F<n>` and `Decision` parser, policy keys, the `review` field of the log and `status`, the review gates and halt texts, the confirmation round, the `## Review findings` report section. It writes its own Decision-bearing reviews |
| `cost.test.mjs` | the run cost estimate: the `prices` block and its validation, `estimateCost`, the `Cost (est.)` column and `Cost (estimate)` line of `report.md`, the `cost` object of `status` for both chains, and `compare` cost rows and the `cost-incomplete` warning. Turn on with `prices: { usdPerMillionTokens: { ... } }` |
| `neutral.test.mjs` | the `orchestrator-error` rerun (ADR-015): same prompt and tier on both chains and in an isolated run, with no failed attempt, rigor rise, budget use or rollback; the `limits.maxNeutralRetries` cap; the `neutralRetries` field of `status`; the `## Neutral reruns` report section |
| `late-usage.test.mjs` | the `usage` command (ADR-019): arguments and refusals that leave the change folder byte-identical, attaching on both chains, an unchanged and a refused second figure, the rewritten report and cost of an ended run, `compare`, survival of an isolated rollback, and the archive state (folder commit of `archive.usageMessage`, restore after a hook failure, `next` resume with `commit: null`) |
| `policy-validate.test.mjs` | the policy check at load (ADR-022): `init`, `next` and `usage` halt with the key name and write nothing on a malformed limit, ladder, step tier or prompt placeholder; `status` reports `policyProblem`; the shipped `policy.json` and `baseline-policy.json` pass |
| `providers.test.mjs` | per-rung provider and fixed run host: legacy Claude defaults, GPT overlay/profile validation, exact neutral retry, capability refusals, both archive actions, provenance and provider-aware report/comparison aggregates |
| `host-integration.test.mjs` | Shared host instruction and packaging contracts, OpenAI manual template selection and truthful browser evidence kinds |
| `codex-chain.test.mjs` | Both-chain runner/result/router matrix, completion/report/comparison, typed child commits, guarded archive and isolated mixed-provider rollback/neutral retry |
| `pr-comment-intent.test.mjs` | Router-owned boolean opt-in/reset/resume intent and terminal done/halt/archive propagation on both chains |

## Orchestrator skills and pull-request scripts

| File | Scope |
| --- | --- |
| `skill-loop.test.mjs` | the `## Anti-stall rules` section of `SKILL.md`: six rules in order, placement outside the Loop branches, no model, effort or tier word; pins rule 3 and the call places of `usage` in the `done`, `halt` and `archive` branches; pins the `Bash timeout:` line (presence, content, placement after the `Pull request script:` line) |
| `archive-gate.test.mjs` | the Manual gate in the `archive` branch of both `SKILL.md` files (ADR-014): `AskUserQuestion` in `allowed-tools`, placement, labels, fail-closed text, six `**GIVEN**` lines, no `AskUserQuestion` in the router scripts |
| `nested-subagents.test.mjs` | no nested subagents (ADR-018): the `rules/top.md` rule and its place before the `RESULT:` line, the same-subagent lines of the executor prompts, the sixth anti-stall rule of both skills, the `docs/REFERENCE.md` and ADR-018 checks |
| `no-recursive-delete.test.mjs` | `removeTree` (ADR-016) and the guard that keeps recursive or forced deletes out of `skills/`, `agents/`, `docs/`, `tools/`, `README.md` and `AGENTS.md`; checks the rule stays in `rules/top.md` and out of `prompts.suffix`, in `manual-verify.md` and both `SKILL.md` files, and the test of `cleanupAll`. The scan reads every `.md` there, this file's folder included: name the ban in words, never write a banned command form |
| `open-pr.test.mjs` | `open-pr.mjs` (ADR-017): a real bare remote, a real linked worktree, a logging `git` shim and a fake `gh`; also checks that no router module pushes or calls `gh` |
| `pr-comment.test.mjs` | `pr-comment.mjs`; `GH_LIVE=1` enables the read-only live tests, which a human runs. Also pins that `AGENTS.md` names the script in Hard Rules and Commands |
| `pr-comment-flag.test.mjs` | `init --pr-comment` stores, keeps and clears `prComment` in `meta.json` on both chains; the `done`, `archive` and `halt` outputs and `status` carry `prComment: true` only when it is set |
| `pr-common.test.mjs` | `pr-common.mjs`, the helpers shared by both PR scripts |

## OpenSpec chain (ADR-013)

The OpenSpec tests and `openspec-helpers.mjs` live in `skills/openspec-pipeline/test/`, indexed in its `README.md`.

## Helpers

- `helpers.mjs`: scratch projects, `run.jsonl` fixtures, hermetic git. `run` and `git` time out after `SPAWN_TIMEOUT_MS` (120000 ms) and throw when the spawn fails. It stays as it was except `writeOverride(project, policy)`, which `makeProject` always calls and which adds `score: { minRigor: null }`, `isolation: { require: false }` and `manualVerify: { minRigor: null }` unless the test gives its own key (so existing tests keep `plan` as the first step and run in a plain scratch project), and `cleanupAll`, which calls `removeTree` for every scratch folder, goes on past one it cannot remove and then throws one `AggregateError` naming each folder left behind.
- `ahead.mjs`: wraps `writePlan` and `writeReview` and exports `stampAhead`. A file a test writes as a step's output gets an mtime a minute ahead, because the router needs an mtime later than the step's `startedAt` and Linux stamps files from a coarse clock. A test that writes such a file right after `next` uses it.
- `phase-helpers.mjs` and `budget-helpers.mjs`: see their groups above. `openspec-helpers.mjs` is in `skills/openspec-pipeline/test/`.

## tools/test

| File | Scope |
| --- | --- |
| `agents-md-no-imports.test.mjs` | `AGENTS.md`, and `CLAUDE.md` when present, has no `@path` import outside a code span |
| `agents-md-size.test.mjs` | `AGENTS.md` stays at or under 12288 bytes; new detail goes into the index files |
| `ci-runner.test.mjs` | `runs-on` lines of `ci.yml` and `pr-title.yml` (self-hosted with the fork fallback; ADR-020), the uid guard as the first step of the `test` job and of `pr-title.yml`, that each job of `ci.yml` and the job of `pr-title.yml` has `timeout-minutes: 15`, and that `release.yml` stays hosted |
| `commit-lint.test.mjs` | `tools/commit-lint.mjs`: accepted and rejected subjects (no `Merge ` exemption), range mode with a real merge commit, title mode, CLI exit codes |
| `pr-title-workflow.test.mjs` | `.github/workflows/pr-title.yml` as text: the four `types`, no `pull_request_target`, concurrency group by PR number, title passed through `env:`, name not `CI`; `ci.yml` has no `edited` (ADR-008, Amendment 2) |
| `release-gate.test.mjs` | a release needs a green CI run of `main`; the CI concurrency rule (ADR-008, Amendment 1) |
| `version-check.test.mjs` | `tools/version-check.mjs`: three version fields equal and valid SemVer, no `version` in a marketplace plugin entry |
| `workflow-pins.test.mjs` | `tools/workflow-pins.mjs` and its run on this repository: every remote action is pinned to a 40-hex SHA with a version comment, so a tag reference fails the suite. To bump an action, replace the SHA and the version comment together |
