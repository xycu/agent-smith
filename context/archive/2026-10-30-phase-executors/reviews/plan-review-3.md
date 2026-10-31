<!-- PLAN-REVIEW-REPORT -->
# Plan Review: phase-executors Implementation Plan (round 3)

- **Plan**: context/changes/phase-executors/plan.md (revision at 283a050)
- **Mode**: Deep (claims verified by the reviewer against `route.mjs`, the tests and the toolkit at the revised plan commit; no sub-agent; two scratch experiments, see F1 check and W1)
- **Date**: 2026-10-31
- **Round**: 3. Rounds 1 and 2 are `reviews/plan-review.md` and `reviews/plan-review-2.md`; they are not edited.
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

Why SOUND: every round 2 finding is fixed in the design and nothing found makes a Progress row or gate impossible to pass, breaks a hard rule, risks data loss or an endless loop, or collides with an existing test that the plan does not list. What remains are two inexact pieces of specification (W1, W2) and five watch items. All can be handled by the implementer without changing the structure of the plan. **No finding blocks.**

## Grounding

Grounding: anchors re-checked against the code (`readPlan` `:65-89`, `attachResult` `:297-344`, `trailingFailures` `:355`, `runGit`/`gitOut` `:464-482`, `decide` `:636-747`, `replanNext` `:942-993`, `tierFor` `:1019`, `next` `:1333-1440`, `archiveDone` `:1259`/`:1325`, `finishRun` `:254`, `archiveLines` `:191-201`, `buildReport` `:203-240`, `status` `:1720`; `route.test.mjs:148`, `loops.test.mjs:30-34`/`:441-497`, `helpers.mjs:58`, `preplan.test.mjs:105-130`, `archive.test.mjs:584`/`:912`) ✓. New files absent as planned. Progress and Phase agree by script: one `## Progress`, six phases, Automated bullets against rows 14/21/11/14/17/20, Manual 1/1/1/1/3/2 (all equal), 106 rows, no checkbox outside Progress, 70 `--test-name-pattern` rows with no duplicate and no regex metacharacter. Brief and plan agree.

## Check of the round 2 findings

| Round 2 | Result | Evidence |
|---|---|---|
| F1 critical: budget breaks `route.test.mjs:148` | **Fixed** | Scratch run 1 (copy of `skills/`, `docs/`, `README.md`, `AGENTS.md`; only `rigor.budgetDelta` set to 2 and 7): 324 tests, 1 failure, `route.test.mjs:148`, `budget 14, 'run' !== 'halt'`. Scratch run 2 (same plus the edit the plan describes: title "10, 16, 21", budgets 16 and 21 in the `cases` array): 324 tests, 0 failures. The edit touches lines 148, 151, 152, inside the 146-166 range of gate 6.14. I walked `decide()`, `replanNext` and the pool: plan loop 6 at standard (`maxPlanRevisions` 2, the halt needs a third replan), 7 at thorough after three pre-plan steps (RETHINK with frame-rethink, or REVISE with research-revise; both 7, a path with both needs a third revision and halts), implement side at most pool + 1 steps, then 5 review steps (`maxFixLoops` 2). Standard 6 + 3 + 5 = 14, thorough 10 + 4 + 5 = 19. After `plan-rejected` a REVISE review with `autoDone > 0` skips `replanNext` (`decide:699`), so the REJECTED path stays 14 and 19. Budgets 16 and 21 leave two spare. ✓ |
| F2 warning: retry can halt a zero-diff phase | **Fixed** | Walked: `retryRows` is empty once one `implement-retry` entry is executed; a retry ending `done` or `blocked` with no commit is `fallback` (ignored by `trailingFailures`, `lastIdx` and the failure re-plan); `autoPending == 0` then leads to `impl-review` (`decide:711-724`, stale because `lcode` ignores non-ok entries). A failed retry counts once; the third-failure halt (`next:1397`) cannot be reached by the retry alone. No loop. |
| F3 warning: notes never reach the output | **Fixed** | The five sites exist at the cited lines. `doneNotes` returns only non-empty keys, so `archive.test.mjs:584` (exact `summary` object) and `:912-922` stay green. |
| F4 warning: budget test not able to fail | **Fixed** | Router-driven saturating fixtures, equality `max(steps) === maxTotalSteps + delta - 2` read from the policy at hand, and the raised-cap run (standard 15 > 14 with segment, e2e, `manual-verify`; thorough 20 > 19). Self-correcting if the router gives another count. |
| F5 warning: vacuous gates | **Partly** | `gateCheck` closes the main hole (a row with no pattern, a missing file or a misspelled title fails). The `git diff` gates are correct for working tree against merge-base: `git diff <base> -- <path>` includes staged and unstaged edits, untracked test files are covered by `ls-files -o`, `$(git merge-base …)` failing leaves `""` and `git diff ""` exits 128. Two small residuals: W2 and O3. |
| F6 warning: `plan-rejected` without `before.done` | **Fixed** | `before.done` is recorded for both re-plan templates; the subset test cannot be satisfied by unticking. |
| F7 observation: evidence checks | **Fixed** | `lstat` of `evidence` (directory, not a link), `isFile()`, size above 0, realpath prefix built from the change folder, `mtimeMs` above the baseline `startedAt`. Same freshness rule as `plan` (`attachResult:311`), so same clock behavior (O4). |
| F8 observation: commit evidence edges | **Partly** | `--is-ancestor` exit 1 / other, `-z`, excluded globs: all in the design. The parse recipe in the text does not match real `git log -z` output (W1). |
| F9 observation: smaller gaps | **Fixed** | Row 1.10 reworded, stale numbers gone, `skill` keys in the policy shape, baseline note, whole-word `browserWords`, gate 6.20. |

## Findings

### W1 — The `git log -z` parse recipe misreads the first path of every commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3, `commitEvidence`
- **Detail**: The plan says to split the output of `git log -z --name-only --relative --format=%x01%H%x01 <head>..HEAD` on `\x01`, "drop one leading newline from a chunk, split it on `\0`". Real output (run in a scratch repo, with a path `@at.js` and a path with a space) is `\x01<sha>\x01\0\n@at.js\0context/changes/x/plan.md\0`, so the chunk after the SHA starts with `\0` and then `\n`, not with `\n`. Following the recipe literally gives the first path of each commit as `"\n@at.js"` or `"\ncontext/changes/x/plan.md"`. The second one does not start with `context/changes/<id>/`, so a commit that touches only `plan.md` (alone, or as the alphabetically first path) is counted as code evidence: the forgery guard fails open. Rows 1.12 and 1.15 would catch it (their fixtures use exactly these cases), so this costs a debugging loop, not a wrong ship.
- **Fix**: Replace the recipe with: strip `^\0?\n?` from each chunk (or split on `\0` and trim a leading `\n` from every item), then drop empty items. Keep the rows 1.12 and 1.15 fixtures as they are, and make sure the forged-evidence fixture has `plan.md` as the first path of the commit.
- **Decision**: PENDING

### W2 — `gateCheck` has no stated return contract, and its meta-test can pass while the gate row does not

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "Implementation Approach" paragraph on gate rows; rows 1.14, 2.20, 3.12, 4.15, 5.19, 6.21
- **Detail**: The rows run `process.exit(m.gateCheck(path, n))`. The plan says `gateCheck` "exits non-zero unless" the phase is covered, but does not say that it returns an integer exit code. `process.exit(undefined)` exits 0, `process.exit(true)` is read as 1 on Node 18 and throws on Node 20 and later. A `gateCheck` that returns `undefined` on failure, or a boolean `true` on success, makes the rows vacuous or inverted, and a meta-test that calls the function in process and inspects its return value cannot see the exit status. The meta-test is the one link in the chain that the plan relies on to prove the gate checks something.
- **Fix**: State in Phase 1: `gateCheck` returns the integer 0 (covered) or 1 (not), prints the first problem to stderr, never returns anything else. The meta-test "gate check fails when nothing is checked" should run the real command line (`node -e 'import(…).then((m) => process.exit(m.gateCheck(…)))'` through `child_process`) against a broken plan fixture and assert a non-zero status, and against the real plan and assert 0.
- **Decision**: PENDING

### O1 — Watch the loop-test hunk rule in gates 4.10, 5.10 and 6.14

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: rows 4.10, 5.10, 6.14
- **Detail**: The awk rule requires exactly one `-U0` hunk in `loops.test.mjs` with an old-file start in lines 28-36. The edit changes two assertions (lines 33-34) and adds a second project to the same block. If any unchanged line sits between two changed groups the diff has two hunks and the gate fails for a correct edit. Keep the new lines contiguous with the changed ones, or relax `h != 1` to `h < 1`. `route.test.mjs` already accepts several hunks.
- **Decision**: PENDING

### O2 — `report.md` carries the two notes only in `--archive` runs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State bullets on `uncommittedTicks` and `manualUnproven`; Phase 2 §2
- **Detail**: `archiveLines` returns `[]` unless `meta.archive === true` (`route.mjs:192`), and `buildReport` calls nothing else for the outcome. So for a run without `--archive` the notes reach the `done` output and `meta.outcome` but not `report.md` (today `Manual checks pending` behaves the same way). The rows (2.22, 5.18) correctly say "in an `--archive` run". The sentences in Desired End State do not. The `SKILL.md` final message must therefore print both lists in the non-archive `done` branch; say so in the Phase 5/6 SKILL edit, and keep the `TaskList`, subject and `PR comment step` counts of the SKILL.md branch tests of `pr-comment.test.mjs` at one per branch when editing the done and archive branches.
- **Decision**: PENDING

### O3 — Gate smoke checks can trip on harmless strings

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: rows 1.11, 6.15, 6.16
- **Detail**: Rows 1.11 and 6.15 reject any added line of `route.mjs` that holds a quoted `"add"`, `"commit"`, `"clean"`, `"fetch"`, `"reset"` and so on, even when it is not a git argument (a label, a reason text, a key). Reword such a line instead of weakening the gate. Row 6.16 allows only the `const result = ` line and the row-template line of `buildReport` to differ; a helper `const` for the Step cell would fail it, so inline both. The gates are named smoke checks and the manual row 1.10 reads the real diff, so this is a nuisance, not a hole.
- **Decision**: PENDING

### O4 — Evidence freshness uses millisecond `mtime` against `startedAt`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 §2, `case "manual-verify"`
- **Detail**: Same rule and same weakness as the `plan` check: a file system with coarse timestamps (1-2 s) or a network mount can place a file written right after `startedAt` at or below it. The cost is a neutral `manual-verify` failure and a listed `manualUnproven` row, never a wrong tick. A retry may reuse the first attempt's file, so a false failure can heal itself. No change needed; do not tighten it.
- **Decision**: PENDING

### O5 — Residual trust points to keep in view while implementing

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Assumptions 3, 4, 5, 15; Phase 1 §3; Phase 5
- **Detail**: Already accepted in the plan, listed so the implementer and the impl-review keep them in mind. (a) The commit check is per step, not per row: one real commit lets a Skip-flipped sibling row pass, and the retry passes on any commit, related or not. (b) After one retry a no-commit tick goes to `impl-review` with a warning that only the first review pass sees. (c) Rigor can rise from `lean` to `standard` after one failed step (`fromFailures`), which gives the run a pool of 2 and a budget of 16 from then on; "lean keeps today's paths" holds for runs that stay lean. (d) `manual-verify` runs backticked text from `plan.md` with `sh`, `bash`, `python` and `curl` allowed, in an unattended subagent; the plan names this as the plan author's trust domain.
- **Decision**: PENDING

## Hard rules and research

No hard-rule conflict found. Git use is read-only (`rev-parse`, `merge-base --is-ancestor`, `log`), `runGit` maps git's exit status 1 to `1`, so the `--is-ancestor` split works; no `gh`, no npm dependency, no `-c` option, Node 18 APIs only (`fs.realpathSync`, `fs.lstatSync`; the ban-list grep passes on today's tree), `context/archive/` and `run.jsonl`/`meta.json` untouched by hand, `SKILL.md` stays free of model names (gate 6.7), prompts follow the GIVEN/WHEN/THEN form and are listed under "Wired" for `preplan.test.mjs:105-130`. The design matches research sections 1-6 and the owner defaults in the brief.
