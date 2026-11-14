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

## Phase 2 failed undo regressions

Measured from Phase 1 commit `c24a166`, with the 93-line additive regression block in `rollback.test.mjs` and change-local evidence/Progress edits. The router modules match the baseline revision byte-for-byte.

```sh
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/override-json.test.mjs
```

The focused covered run exited 0 with 23 passes, zero failures and zero skips in `53709.914625 ms`. All 19 pre-existing cases passed alongside the four new cases.

| Caller | Undo reset | Result | Focused duration |
| --- | --- | --- | --- |
| Attempt-cap `end` | Hard | PASS, exit 0, original attempt-cap note, undo diagnostic and kept-under sentence | 3505.854917 ms |
| Attempt-cap `end` | Mixed | PASS, exit 0, same context and snapshot-branch/reset guidance | 3751.507208 ms |
| Outer catch | Hard | PASS, exit 1, parseable router-error halt with undo diagnostic | 4172.793167 ms |
| Outer catch | Mixed | PASS, exit 1, same context and snapshot-branch/reset guidance | 4578.218875 ms |

The shared assertions in `skills/10x-pipeline/test/rollback.test.mjs` cover the full reset diagnostic with the exact ref, the injected stderr text, tracked `change.md` contents, untracked `partial.txt` contents, the failed step commit and snapshot parent. A deliberately created failed-step commit distinguishes the step start from the HEAD left by the failure. The hard failure leaves HEAD at `startSha`, while the mixed failure leaves it at the snapshot.

The local injector at lines 360–390 forwards real Git and records a successful initial rollback with its actual HEAD. Before returning the injected error it resolves the expected snapshot ref. Its marker must contain exactly one rollback event followed by one undo event with their expected hashes. The injector and marker live under the main scratch fixture, outside the linked worktree. `cleanupAll` owns that fixture, including the injector.

The matrix at lines 392–450 exercises `route.mjs` 53, 56–58, 109 and 1066 through both real CLI callers. Focused route coverage rises from the planning probe 45.37% lines / 16.13% branches to 45.65% lines / 16.67% branches, with 36.36% functions. Lines 56–58 disappear from the uncovered ranges. Caller-specific assertions establish the covered-line failure alternatives on 53, 109 and 1066.

### Deliberate-break gate

With the test staged, both occurrences of the production undo-failure prefix were temporarily changed from `The rollback was not undone:` to `Undo failed:`. Running the four cases by name produced four assertion failures, zero passes and zero skips in `19168.828458 ms`. A `finally` block restored the original router bytes, and `git diff --exit-code -- skills/10x-pipeline/scripts/route.mjs` confirmed restoration before the final suite started. The temporary mutation stayed outside commits.

```sh
node --test --test-name-pattern='failed undo:' skills/10x-pipeline/test/rollback.test.mjs
```

## Phase 2 final full-suite coverage

The final covered suite exited 0 with 1,483 tests, 1,480 passes, zero failures/cancellations and three expected skips in `1184208.734042 ms` (19.74 minutes). It used the same Node, Git, pinned OpenSpec CLI, environment, concurrency and three-glob command as the baseline. The measured test source is Git blob `bbde028f39965075cd8cdf45a5daacc18fed5406`, based on commit `c24a166`. Router-module sources still match `f6a635ed03a3e273127b61b123c3e93ba3d8cdda`.

```text
ℹ    flow.mjs          |  99.79 |    90.39 |  100.00 | 629-630
ℹ    isolation.mjs     |  98.54 |    66.67 |  100.00 | 224 279-280 318-319 662-663 694-695 698-699
ℹ    preplan.mjs       | 100.00 |    89.04 |  100.00 |
ℹ    route.mjs         |  98.78 |    88.80 |  100.00 | 78-79 146-147 834-836 896-897 907-908 1051-1052
ℹ    state.mjs         |  99.42 |    93.07 |   99.18 | 84-87 1027-1028
ℹ    steps.mjs         | 100.00 |    88.89 |   99.23 |
ℹ    openspec.mjs      |  99.52 |    83.10 |  100.00 | 152
```

All four real-CLI cases executed in the final full run.

```text
✔ 4.1 failed undo: attempt-cap, hard reset retains recovery text and snapshot (4822.602125ms)
✔ 4.1 failed undo: attempt-cap, mixed reset retains recovery text and snapshot (4695.760375ms)
✔ 4.1 failed undo: router-error, hard reset retains recovery text and snapshot (5063.178084ms)
✔ 4.1 failed undo: router-error, mixed reset retains recovery text and snapshot (5019.401333ms)
```

### Final recovery disposition

The baseline inventory remains applicable to every remaining uncovered range. The sole removed range is `route.mjs` 56–58, now exercised by both mixed-reset failures. Router line coverage moves from 98.50% to 98.78%, branch coverage from 87.40% to 88.80% and function coverage stays 100%. The other six module rows and uncovered ranges match the baseline exactly.

The hard-reset failure and both caller failure-text alternatives are explicitly asserted despite having shared executed lines before this change. All other recovery-gap rows retain their owning follow-up and Wave 6 rationale in the baseline inventory. Additional cases beyond the agreed four remain future changes under those ownership boundaries.

The final covered duration is 47,624.301249 ms below the covered baseline. These sequential local timings provide the recorded performance observations. The controlled ordinary/covered comparison remains the Phase 1 pair at identical test sources. Live TrueNAS timing, coverage output, skip identities and Linux execution remain the pending Manual acceptance.

### Implementation gate summary

- Phase 1 passed command configuration, full coverage, recovery inventory/timings, all 20 workflow guards and the ordinary full suite. Commit `c24a166` records the phase.
- Phase 2 passed the four caller/reset cases, tracked/untracked snapshot and HEAD assertions, focused coverage, deliberate-break check and the final covered full suite.
- The ownership check permits only `.github/workflows/ci.yml`, `skills/10x-pipeline/test/rollback.test.mjs` and this change folder. `git diff --check` passed. The pre-existing orchestrator-owned `agent-smith/run.jsonl` edit remains outside the implementation staging set.
- Pending Manual row 2.6 remains unchecked as required by the implementation skill.

Pending manual verification

- 2.6 A green CI run for this change shows the native router-module coverage table, execution of the four Linux regression cases, expected skip identities and recorded runner timing, with its run URL in the coverage evidence.
