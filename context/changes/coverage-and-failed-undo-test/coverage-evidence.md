# Router coverage and failed undo evidence

## Measurement environment

Measurements run on 2026-11-14 with Node `v24.19.0`, Git `2.54.0 (Apple Git-157)` and Darwin arm64. A change-local installation supplies the CI-selected OpenSpec `1.16.1` through `OPENSPEC_BIN`. The ambient OpenSpec is `2.0.0`. Telemetry is disabled with `OPENSPEC_TELEMETRY=0` and `DO_NOT_TRACK=1`.

Local commands use `--test-concurrency=2`. CI retains its existing concurrency and 15-minute job limit. Coverage uses the native observational flag. All three test globs remain in the blocking suite command.

Scratch data lives under `.claude/worktrees/coverage-verification/` inside this worktree. `TMPDIR` selects its `tmp/` directory, whose invalid `.git` pointer prevents non-repository fixtures from discovering the containing checkout. Raw local logs live alongside that scratch directory.

## Commands

Each shell command starts with the absolute worktree `cd` required by the task. Both full-suite measurements use the same environment and these test globs.

```sh
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs
```

## Decisions and assumptions

- Keep inline coverage as the starting configuration, following the change description and Phase 1 contract. Local performance measurements and the pending same-runner CI check govern the documented fallback.
- Use the pinned contract CLI for acceptance, following `.github/workflows/ci.yml` and the plan testing strategy.
- Execute both phases directly, following the task instruction and the single-level execution lesson in `context/foundation/lessons.md`.
- Leave router-owned run state to its existing writers. The pre-existing modified `agent-smith/run.jsonl` belongs to the orchestrator.

## Live CI acceptance

Manual Progress row 2.6 remains pending. Its evidence requires a green change-specific CI run, the native module table, all four Linux regression names, expected skip identities and actual runner timing. Local measurements supply the automated acceptance evidence.

## Phase 1 baseline

Source revision `f6a635ed03a3e273127b61b123c3e93ba3d8cdda`, with the coverage flag and change-local lifecycle/evidence edits in the working tree. Router and test sources match that revision.

The full covered suite exited 0 with 1,479 tests, 1,476 passes, zero failures, zero cancellations and three skips. Node reported `1231833.035291 ms` including coverage collection.

The raw native module rows preserve the line, branch, function and uncovered-line columns, in that order.

```text
ℹ    flow.mjs          |  99.79 |    90.39 |  100.00 | 629-630
ℹ    isolation.mjs     |  98.54 |    66.67 |  100.00 | 224 279-280 318-319 662-663 694-695 698-699
ℹ    preplan.mjs       | 100.00 |    89.04 |  100.00 | 
ℹ    route.mjs         |  98.50 |    87.40 |  100.00 | 56-58 78-79 146-147 834-836 896-897 907-908 1051-1052
ℹ    state.mjs         |  99.42 |    93.07 |   99.18 | 84-87 1027-1028
ℹ    steps.mjs         | 100.00 |    88.89 |   99.23 | 
ℹ    openspec.mjs      |  99.52 |    83.10 |  100.00 | 152
```

### Skip identities

- `live: a branch with no pull request is skipped` requires `GH_LIVE=1`.
- `live: the real comment projection is one parseable object per line across pages` requires `GH_LIVE=1`.
- `CLAUDE.md has no @ imports` skips because `CLAUDE.md` is absent.

Git, the selected OpenSpec CLI and gh are available. All five real OpenSpec contract fixtures ran. The POSIX undo tests added in Phase 2 must run on Linux and macOS, and use the existing Windows skip convention.

### Recovery inventory

Every uncovered range reported for the four requested modules was inspected against this source revision. Each row records the executable behavior and disposition. A covered line containing a conditional still needs branch-specific assertions. Percentages alone cannot certify every recovery alternative.

| Module and source lines | Behavior | Disposition and owning follow-up |
| --- | --- | --- |
| `route.mjs` 56–58 | Undo mixed reset fails after the hard reset, leaving HEAD at the snapshot with an explicit recovery command. | Phase 2 covers both ordinary `end` and outer catch through the CLI. |
| `route.mjs` 78–79 | Broken always-true rule install becomes a halt before writes. | Future `route.mjs` rule-preflight CLI coverage, coordinated with the rule-file tests. Existing `checkRules` tests exercise the underlying reader. Wave 6 scope permits recording the gap. |
| `route.mjs` 146–147 | A repeated skip within one decision loop halts. | Future router invariant-injection test if skip semantics change. Current decisions log a skip and consume it, making this a defensive guard. |
| `route.mjs` 834–836 | Archive-state late usage restores original bytes after report writing fails, then refuses the figure. | Future `route.mjs` late-usage report-write failure injection. Commit-failure restoration at 838–840 is already reached. This separate failure surface needs its own assertion. |
| `route.mjs` 896–897 | Missing command/id or malformed id produces usage JSON. | Future CLI argument coverage under `route.mjs`, coordinated with the Wave 6 `change-id-length-cap` owner. |
| `route.mjs` 907–908 | A non-init command carrying `--pr-comment` halts before writes. | Future `route.mjs` flag-validation test, coordinated with the init/flag region owner. |
| `route.mjs` 1051–1052 | An unknown command halts as JSON. | Future `route.mjs` CLI argument coverage alongside the usage guard. |
| `flow.mjs` 629–630 | `decide` refuses a missing `change.md`. | Defensive duplicate reached only if the change disappears after `next` calls `haltNoChangeMd`. Future direct `decide` or race-injection coverage owned by `flow.mjs`. Existing CLI missing-change tests stop at the earlier guard. |
| `isolation.mjs` 224 | Git exits 0 but reports a non-worktree value. | Future malformed-Git-output injection owned by `isolation.mjs`. Real Git normally supplies a nonzero exit for a missing repository. |
| `isolation.mjs` 279–280 | Init cannot determine linked-worktree identity because a Git directory query fails. | Future isolation-init Git-read failure injection owned by `isolation.mjs`. It protects the pre-write boundary. |
| `isolation.mjs` 318–319 | A start/step/rollback write cannot determine linked-worktree identity. | Future shared write-guard failure injection owned by `isolation.mjs`, retaining halt-before-write assertions at callers. |
| `isolation.mjs` 662–663 | Archive refuses open OpenSpec tasks. | Defensive archive guard because `decideOpenspec` routes open tasks back to apply. Future direct archive/race coverage owned by the OpenSpec archive tests and `isolation.mjs`. |
| `isolation.mjs` 694–695 | Archive descriptor failure becomes a precheck halt. | Future archive descriptor exception injection owned by `isolation.mjs`, preserving committed/uncommitted halt semantics. |
| `isolation.mjs` 698–699 | Archive tier lacks a valid ladder target. | Defensive guard behind policy validation. Future direct archive invalid-policy coverage owned by `isolation.mjs`. |
| `steps.mjs` all lines covered | No uncovered source range intersects halt or recovery behavior. | Retain the existing executor/manual-evidence tests. Branch coverage remains observational at 88.89%. |

The failed hard-reset alternative on `route.mjs` 53 and the failure-text alternatives on 109 and 1066 are covered-line gaps assigned to Phase 2. Before the new cases, successful undo executes those lines while the failed alternatives have no explicit regression assertion. The outer catch also has a thrown-undo alternative on 1065, separate from the two Git-status failures covered here. A future router-state write/file-time failure injection belongs to `route.mjs` and `isolation.mjs` after Wave 6 ownership is scheduled.

The preliminary focused inventory in the plan is superseded by these full-suite ranges. The broader suite reaches the previously listed needs-human/budget halts, report/neutral-retry recovery, open-findings/re-plan/fix-loop halts, commit evidence and manual/browser evidence validation, Git safety and commit/archive recovery. Their remaining branch alternatives require targeted assertions in future changes when behavior changes.

### Controlled timing comparison

The ordinary baseline exited 0 with the same 1,479 tests, 1,476 passes, zero failures/cancellations and the same three skip identities. Its duration was `1137149.409375 ms` (18.95 minutes). The covered baseline took `1231833.035291 ms` (20.53 minutes), an increase of `94683.625916 ms`, or 8.33%. The runs were sequential with matching sources, concurrency, environment and tool versions. No other suite ran concurrently in this implementation session.

Retain the single blocking inline-coverage step. The fallback would add a second complete suite, while these local runs already total 39.48 minutes at concurrency 2. CI uses its existing default concurrency on a different Linux runner. Local measurements do not establish the TrueNAS duration or its 15-minute acceptance. Manual row 2.6 retains the same-runner check and potential job-budget decision. The inline configuration keeps test failures blocking and avoids doubling the suite workload.

Workflow guards passed all 20 tests with zero skips in `9079.13975 ms`. The exact three-glob inline coverage command and observational settings passed an assert-based configuration check. `node tools/version-check.mjs` passed. Phase 1 adds no tests, so its deliberate-break gate is inapplicable.
