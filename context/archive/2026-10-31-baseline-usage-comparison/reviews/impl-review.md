<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Baseline Usage Comparison

- **Plan**: context/changes/baseline-usage-comparison/plan.md
- **Scope**: Full plan (Phases 1, 2, 3 of 3). Manual rows 1.8 and 3.7 are still open, so the plan is not archive-ready.
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

Reviewed commits: Phase 1 `c903874`, `d1a65d1`; gate evidence `d58793f`; Phase 2 `23d9d53`, `e96c789`; Phase 3 `0793234`, `2ea8f7c` (on top of `61acef2`). Method: read the plan, the three plan reviews and their binding amendments, the full router diff, `compare.test.mjs`, the docs and the evidence file; ran every Automated row; ran adversarial CLI probes and a mutation check in scratch copies under `$TMPDIR` (the repository was not touched). The two sub-agent passes of the skill were done directly, because the task needed the evidence-first adversarial probing described below.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (2 warnings, 4 observations) |

## Verification evidence

- `node --test skills/10x-pipeline/test/*.test.mjs` on Node 24.19.0: 176 tests, 176 pass, 0 fail, 0 skipped.
- Every pattern row (1.1 to 1.4, 2.1 to 2.11, 3.1) run with the plan's convention command (exit 0, a `✔ <row> ` line, no `# SKIP`): all pass. The `^ADR rule lines` row passes through the widened `rules.test.mjs` filter. `ls docs/ADR/ADR-005-* | wc -l` prints 1; README order `Usage report:` (65), `Baseline comparison:` (73), `Limits:` (84); `grep -c compare AGENTS.md` is 4; `cmd === "compare"` count 1; `compare <change-id> --baseline` count 3; ADR-005 has 6 rule lines and none lacks a keyword; the banned-API grep prints nothing.
- Router diff against the merge base `54f1729`: `route.mjs` has 227 added lines and exactly 1 removed line (the `Usage:` string). Additive claim is true. No change to `init`, `next`, `decide`, `tierFor`, `buildReport`, `finishRun`, `attachResult`, `readLog`, `paths` or `archiveDirs`. `SKILL.md` and ADR-003 untouched. `git diff main` shows more only because `main` has moved on (the S-05 archive and roadmap); ignore it. No npm dependency, only `node:` built-ins, no git call inside `compare`.
- Hard rules: `compare` reads `run.jsonl`, `meta.json`, `plan.md` and a directory listing and writes nothing (`process.stdout.write` only). A mutation that wrote a file, and one that touched an mtime, are both caught by test 2.9. No banned Node 18 API (BigInt literals and `Number.isSafeInteger` are fine on Node 18). ADR-005 rule lines pass the ADR-004 form test. No tier logic changed, so the SKILL.md and README routing lists need no update.
- Probes through the real CLI (scratch checkouts): missing `--baseline` dir halts exit 1 and names the three paths tried; valueless flag halts; missing routed `run.jsonl` halts; JSON-array, `null`, number and string lines in `run.jsonl` are dropped or counted as a step without usage (`usage-incomplete`); a `usage` that is a string counts as missing; a baseline with no usage gives `usage-incomplete:baseline`; mixed coverage (`[50, null]` against two full steps) gives `usage-incomplete:routed` and `dropPercent: null`, so a drop is never computed over unequal figure sets; a malformed or array `meta.json` falls back through `readMeta`. `dropPercent` floors to 2 decimals (28.99 for 100000/71004, 33.33 for 3/2), `Number.MAX_SAFE_INTEGER` baselines do not throw, and an `undefined` or `null` compare block gives `target not set`. The Markdown is built from the same pair object and agrees with the JSON on every field it prints.
- `baseline-policy.json`: 7 x `sonnet`/`high`, `rigor.fromGoal` all `standard`, `skipPlanReviewAt: []`. A baseline run cannot leave `sonnet`/`high`: every ladder slot is identical, the highest `maxTier` is 6, `minEffort` tops out at `high`, and `route.mjs` names no model outside the ladder. Tests 1.2 and 1.3 prove the first step and the plan-review skip against the default policy. Later steps (implement, impl-review, fix, archive) rest on that static argument plus the manual row 3.7.
- Gate order: `d58793f` (USAGE line set, owner-directed, stated in the commit and in the plan notes) precedes the Phase 2 commit `23d9d53`, and `c903874` shipped `USAGE: pending`. No unattended self-answer is visible.

### Mutation check (scratch copy, `compare.test.mjs` only)

Killed (the suite fails): exact `>=` changed to `>`; drop rounded instead of floored; plain float drop; effort dropped from the pin; `undefined` target no longer treated as null; array lines no longer filtered; skip entries counted as steps; outcome check, `usage-incomplete`, `baseline-not-pinned`, `baseline-total-zero`, `no-steps` reasons removed; ambiguous-archive halt removed; live-over-archive order swapped; archive `$` anchor removed; `validFigure` accepting negatives, floats or unsafe integers; `byModel.unknown` removed; goal, `baseSha`, skip and archive-also-present warnings removed; `plan.md` or `plan-brief.md` counted as input; target range unchecked; `--format` and `--routed` value checks removed; a file write and an mtime touch inside `compare`; comparable forced true.

Survived (no test fails): `dropMet` float branch forced to `false`, with no slack, or with a 1e-9 relative slack (F1); `every` changed to `some` in the pin (F2); `floorDivBig` returning the truncated quotient (F2); archive `^` anchor removed (F2); `input-files-differ` computed one way only (F2); `failedAttempts` forced to 0, the `plan` field and the Markdown `Source` row (F2). `Number.isFinite(target)` removal is an equivalent mutant (the range test still rejects `NaN` and `Infinity`).

## Findings

### F1 — The non-2-decimal target branch of `dropMet` has no test, so the 4 * Number.EPSILON slack is unguarded

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/route.mjs:1269-1275 (`dropMet`), skills/10x-pipeline/test/compare.test.mjs:206-222 (test "2.2 boundary sweep")
- **Detail**: Round-3 amendment F1 replaced the `1e-9` slack with `4 * Number.EPSILON * max(1, right)` for targets that are not exact 2-decimal values, and exact integer math for the rest. The implementation does both, but every target in tests 2.2 has at most 2 decimals (29, 29.5, 29.01, 0.07, 33.33, 99.99, 0, 100), so the float branch never runs under test. Three mutations of it survive: always `false`, no slack, and the old wide slack. By hand it is correct: 3/2 against 33.333 is `met`, against 33.34 is `not met`, and 100/70 against `30.000000000000004` is `met` (it would be `not met` without the slack). The amendment's concern is the slack width, and nothing would now notice if it widened again.
- **Fix**: Add a short case to test 2.2 with at least one target of 3 or more decimals on each side of the boundary (baseline 3, routed 2: 33.333 `met`, 33.34 `not met`; baseline 100, routed 70, target `30.000000000000004`: `met`) and a wide-slack guard (a baseline of about 1e6 where `1e-9 * right` exceeds the gap).
- **Decision**: Fix (350b260): test 2.2 covers 3/2 against 33.333 (met) and 33.34 (not met), 100/70 against 30.000000000000004 (met, 71 not met) and a 1e9 baseline with a target of 29.00000000001 (a 0.01 gap that a 1e-9 slack would call met). Mutants always false, no slack and 1e-9 slack turn the suite red in a scratch copy under $TMPDIR. No production change.

### F2 — Several stated rules have no test that fails when the rule is broken

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/compare.test.mjs (tests 2.4, 2.2, 2.8, 2.6, and no test for `failedAttempts` or `plan`)
- **Detail**: Mutants that survive, each against a rule the plan states: (1) the pin is `every` executed entry, but test 2.4 only uses single-entry baselines or all-haiku logs, so `some` passes; a baseline with one `sonnet`/`high` step and one `haiku` step is the case the rule exists for, and `pinned` is the check that makes the baseline arm trustworthy. (2) A negative drop that does not divide evenly (baseline 3, routed 4: exact -33.33..., floored -33.34): only the exact -30 is tested, so truncation instead of floor passes. (3) An archive folder with a prefix (`old-2026-10-30-demo`) is not tested, so the `^` anchor can go. (4) `input-files-differ` is only tested for a file present on the baseline side; a file only on the routed side is not. (5) `failedAttempts` and the per-side `plan` object are never asserted. The code is right in each case (probed by hand); only the guard is missing.
- **Fix**: Extend test 2.4 with a mixed-model baseline (one pinned and one `haiku` entry gives `pinned: false`), test 2.2 with 3/4 giving `dropPercent` -33.34, test 2.8 with a prefixed archive name, test 2.6 with a routed-only file, and assert `failedAttempts` and `plan` on one fixture.
- **Decision**: Fix (350b260): tests added for a mixed-model and mixed-effort baseline (`every` against `some`), 3/4 giving -33.34 (floor against truncation), a prefixed archive name (`^` anchor), a routed-only input file (both directions of `input-files-differ`), and `failedAttempts`, `plan` and the Markdown `Source` row on one fixture. Each mutant is killed in a scratch copy. The production code was right in every case; no behavior changed.

### F3 — `USAGE: present` is supported for background notices only; row 1.7 is ticked on a weaker reading than its text, and the disclosure is honest but sits next to an unqualified gate line

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/baseline-usage-comparison/real-run-evidence.md:11 and 15-31; plan.md Progress rows 1.6, 1.7, 1.8
- **Detail**: What the evidence shows: a bare `Agent` probe returned `<usage><subagent_tokens>49828</subagent_tokens><tool_uses>1</tool_uses><duration_ms>3863</duration_ms></usage>` in a background completion notice, and the probing agent then fed those numbers by hand into `last-result.json` of a scratch router run, so `status` shows them. That proves two things: the harness exposes token, tool-use and duration figures for a subagent, and the router stores a figure it is given (already covered by test 1.4). It does not show that the orchestrator path of SKILL.md Loop step 2 (foreground `Agent`, `run_in_background: false`) yields a result with those figures, nor that the orchestrator maps `subagent_tokens` to `totalTokens` correctly; the "status line" is not one a pipeline run produced. Row 1.7 as written ("run `/agent-smith:10x-pipeline` for one step, then `status`") was not done, yet it is `[x]`. Disclosure is good: the limit is written in the evidence file ("could not be observed here"), the plan's Implementation notes, the row 1.7 suffix, the new open row 1.8, the ADR-005 Consequences and the `d58793f` message. The owner accepted the caveat, and the F4 amendment's exception ("as the owner directed") applies. Verdict: faithfully supported as "figures exist in background notices", overstated if a reader takes the bare `USAGE: present` line (or the `[x]` on 1.7) as "the foreground orchestrator path delivers usage". Nothing in the code depends on the difference, since Phases 2 and 3 use fabricated `usage` (plan "If usage is absent", option b).
- **Fix**: No code change. Do row 1.8 and row 3.7 before the change is archived or the saving claim is quoted, and treat 1.7 as satisfied only for the background path. (The `USAGE:` line itself must stay as the owner set it, per amendment F4.)
- **Decision**: Fix (c8c8143): the `USAGE: present` line and the gate line are unchanged. real-run-evidence.md and the plan Implementation notes now state the narrower truth: figures exist in background completion notices; the foreground orchestrator path (row 1.8) is unverified. No new claims. Rows 1.8 and 3.7 stay unticked and must be done before archive or before the saving is quoted.

### F4 — "Manual rows 1.8 and 3.7 are the only unverified behavior" is true for harness behavior, not for everything

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Implementation notes; real-run-evidence.md
- **Detail**: Beyond 1.8 and 3.7, these are unverified: (a) the code-level coverage gaps in F1 and F2; (b) Node 18 was never run (the suite ran on Node 24.19.0 only); the banned-API grep is clean, and BigInt literals and `Number.isSafeInteger` exist on Node 18, but the tap-reporter path of the plan's pattern command and `--test-name-pattern` (18.11 and later) are unexercised; (c) row 1.6 rests on a subagent's self-report from its system prompt, which shows the `model: sonnet` argument was honored in that harness, not that the effort level was; (d) the README worktree recipe (`git worktree add`, copying input files, copying the override) has never been executed, which row 3.7 will cover, and the pin for steps after plan review has only the static argument given above until 3.7 runs.
- **Fix**: Reword the claim in the closing summary ("harness behavior: rows 1.8 and 3.7; Node 18: not run") and run the suite once on Node 18 if one is at hand.
- **Decision**: Fix (c8c8143): the plan Fix pass section says the "only 1.8 and 3.7 unverified" claim holds for harness behavior only, and lists Node 18 never run, row 1.6 as a model self-report and the README worktree recipe never executed. Unticked Manual rows 3.9 (execute the recipe once) and 3.10 (run the suite on Node 18) were added. Deferred to a human: no Node 18 was available here, so the Node 18 run is not done.

### F5 — Totals above the safe-integer range lose the exactness the verdict math promises

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:1231-1237 (`figure`), 1271 (`BigInt(diff)`)
- **Detail**: Each figure must be a safe integer, but the sum of several is a Number and may pass 2^53 (about 9e15 tokens, far beyond any real run). Past that point `diff` is an inexact float and `BigInt(diff)` is exact only for that float, so "decided on exact integer tokens" no longer holds. Probe: two baseline entries of `Number.MAX_SAFE_INTEGER` against 1 returns a plausible 99.99 with no warning. Unreachable in practice; hand-edited logs are the only route.
- **Fix**: In `readSide`, treat a running total that is not a safe integer as a missing figure (so `usage-incomplete`), or sum in BigInt.
- **Decision**: Fix (d95742e): one additive line in `readSide`; a running figure total that is not a safe integer counts as a missing figure, so the side is `usage-incomplete` and `dropPercent` is `null`. Test added (two `MAX_SAFE_INTEGER` entries against 1); removing the guard turns it red. The router diff still removes only the `Usage:` line (row 3.5).

### F6 — Two diagnostics are less specific than the data allows

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:1245-1247 (`readSide` meta fields), 1297-1300 (reasons); README.md "Baseline comparison:" bullet 4
- **Detail**: (1) A missing, malformed or non-object `meta.json` falls back to `{}`, so the only visible effects are `outcome-not-done:<side>` plus `goal-mismatch` and `baseSha-mismatch` warnings; nothing says the meta file was unreadable. (2) An executed entry that failed without a usage figure (a subagent that crashed or timed out; `ok: false`) makes its whole side `usage-incomplete`. That follows assumption A3, and failed attempts are exactly where routing escalates, so some real pairs will come out not comparable; the plan accepted the rule, and row 3.7 will show how often it bites. Also, the README list of when a pair is comparable omits `baseline-total-zero`, which the command does emit.
- **Fix**: Optionally add a `meta-unreadable:<side>` warning, mention `baseline-total-zero` in the README, and revisit A3 with the result of row 3.7.
- **Decision**: Fix (c8c8143), docs only: the README compare section lists `baseline-total-zero`, says an unreadable `meta.json` surfaces only as `outcome-not-done` plus goal and `baseSha` warnings, and says a failed step without usage makes its whole side not comparable. No `meta-unreadable` warning added (behavior unchanged). Deferred: revisit assumption A3 with the result of row 3.7.

## Manual rows

- 1.6 and 1.7: ticked with owner direction; see F3 for what they support.
- 1.8: unticked, pending a real interactive foreground run.
- 3.7: unticked, pending two real runs and a pasted `compare --format md` output.
