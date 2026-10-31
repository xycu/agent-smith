# Baseline Usage Comparison Implementation Plan

## Overview

Roadmap S-06 (FR-009): let a user compare the total usage of a routed run with a baseline run of the same change, where the baseline is a full run with every step pinned to the `sonnet` alias at `high` effort. The baseline arm is data: a shipped policy file used as the per-project override in a second checkout. It also fixes the rigor level at `standard` and turns the plan-review skip off, so the user passes no flag. The comparison is a new read-only router command, `compare`, that reads two run folders and prints the observed token drop with completeness and outcome checks. No success threshold is invented: the target is a policy value that ships as `null`.

## Current State Analysis

- Per-step usage already lands in `run.jsonl` when the orchestrator passes `usage` (`cleanUsage`, `route.mjs:271-282`; stored by `attachResult`, `route.mjs:319-320`). `buildReport` sums it for one run (`route.mjs:202-240`). Nothing reads two runs. No test in `skills/10x-pipeline/test/` covers usage intake.
- Run state is one folder per change id under `ROOT = process.cwd()` (`route.mjs:20`, `paths` at `:145-159`). A second `init` on the same id resumes the first run (`main`, `:1228-1248`), and the plan and the code are read from disk. A baseline run therefore needs its own checkout.
- A 7-entry `sonnet/high` ladder in the override file makes every step run at `sonnet/high` (probed in the research on commit 54f1729). A ladder shorter than a step's `minTier` crashes `next` with `Cannot destructure property 'model'`. `rigor.minEffort` is `high` at `standard` and `thorough`, so the floor never leaves `sonnet/high` for a pinned ladder.
- The rigor level decides whether plan review runs: a short goal starts at `lean` (`rigor.fromGoal.short`), and `rigor.skipPlanReviewAt` is `["lean"]` (`policy.json:53`). With the default policy a short goal such as "fix typo" gets `plan sonnet/medium` at `lean`; with the override below it gets `plan sonnet/high` at `standard` (probe in a scratch project, review-revision session). SKILL.md Start step 1 parses only `<change-id>`, the goal text and `--archive`; it does not parse `--rigor`, so a flag typed after the goal would stay in the goal text. The baseline therefore fixes the level in data (`rigor.fromGoal`, `rigor.skipPlanReviewAt`). `deepMerge` merges objects key by key and replaces arrays whole (`route.mjs:38-46`).
- `risk` is the precedent for a read-only command (`riskCommand`, `route.mjs:1158-1163`). `main` takes `<cmd> <change-id>` for every command and dispatches with `else if (cmd === "...")` branches (`:1200-1259`).
- Whether a real foreground Agent result reports usage is unconfirmed (`context/archive/2026-10-30-per-step-usage-report/real-run-evidence.md` was archived unfilled; roadmap Open Question 4). Every real pair depends on it, so it is checked first (Phase 1 Manual 1.7), not last. The check needs a live top-level session, which an unattended implementation does not have, so Phase 2 is gated by a `USAGE:` line in `real-run-evidence.md` (see "Phase 2 gate").
- Archived `run.jsonl` (research gap G1) is resolved by code, not by a real run. The pre-archive commit holds `agent-smith/run.jsonl` (`archive.test.mjs:594`; a gitignored one is refused at `init` and at `done`, `route.mjs:1224-1226`). `/10x-archive` moves the whole folder with `git mv`, falling back to `mv` of the folder, and a scratch probe shows `git mv` carries a gitignored `run.jsonl` along. The ADR-003 sentence "`report.md` ... only router artifact that survives the move" says where the pending-Manual note must live for a reader of the archive; it does not say `run.jsonl` is deleted. Phase 2 row 2.10 proves it with a hermetic `git mv` test.

## Desired End State

- `skills/10x-pipeline/baseline-policy.json` exists, pins all seven ladder tiers to `sonnet`/`high`, sets every `rigor.fromGoal` class to `standard` and `rigor.skipPlanReviewAt` to `[]`.
- `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <dir> [--routed <dir>] [--format md]` prints, for one pair of runs: per-side totals and coverage, the baseline pin check, `comparable`, `reasons`, `warnings`, `dropPercent`, `targetDropPercent` and `verdict` (`target not set`, `met`, `not met`, `not comparable`). It writes nothing. Tokens are a proxy for the PRD's weekly-limit metric.
- `policy.json` has `compare.targetDropPercent: null`. The README documents how to make the baseline checkout and how to read the output. ADR-005 records the method.
- `compare.test.mjs` covers the cases in Testing Strategy and the full suite passes on Node 18.
- Manual evidence exists for the real shape of a foreground Agent result (the `USAGE:` line says `present` before Phase 2 starts) and for one real pair.

### Key Discoveries:

- Baseline needs no routing change: an override file is deep-merged, so the shipped file carries `ladder` plus two `rigor` keys (`rigorInputs` reads `R.fromGoal?.[kind]` at `route.mjs:395`, `decide` reads `skipPlanReviewAt` at `:653`; research section 2).
- The pin is verifiable from the log: every executed entry records `model` and `effort` (`route.mjs:1088-1103`), skip entries carry `skipped: true` (`:171-175`). `compare` checks the executed entries instead of trusting a flag. A skip entry spent no tokens, so it is a warning, not a reason. S-07 will log gated-out pre-plan steps as skips.
- Log fields `tier`, `simple` and `rigor` are meaningless for a pinned run; `compare` ignores them.
- `entry(n, step, over)` and `skipEntry` in `test/helpers.mjs:16-197` already accept any field, so `usage` fixtures need no helper change; two scratch projects model two checkouts. `gitInit` and `commitFiles` give a hermetic git project. The `gitProject` and `finishPlan` helpers live inside `route.test.mjs` (not exported), so `compare.test.mjs` copies the few lines it needs.
- `readPlan` (`route.mjs:64-88`) gives `phases` and `rows`, enough to show when the two plans differ in size.
- Anchors in the research drifted by a few lines after the archive-adapter merge. Re-anchor by function name, not by number, when implementing.

## What We're NOT Doing

- No `init --baseline` flag, no `meta.baseline`, no change to `init`, `decide`, `tierFor`, `next`, `buildReport`, `finishRun`, `attachResult` or `archiveDirs`. S-07 changes `decide`, `next` and the skip cap; S-05 declares it touches neither `route.mjs` nor `policy.json`, but it shares README and AGENTS.md lines.
- No new prompt and no change to `SKILL.md`: `compare` is not part of the orchestrator loop, and the baseline needs no `--rigor` flag. The only edit to `rules.test.mjs` is the ADR file regex and test name (Phase 3, ADR-005), so that ADR-005 is checked against the ADR-004 rule form.
- No success threshold value, no model weights, no significance test, no confidence interval, no pairs ledger or `aggregate` mode (owner questions O1 to O3).
- No `--out` flag. The command only prints; a user redirects stdout. This makes "writes nothing" unconditional and removes the archive-path refusal logic.
- No parsing of `report.md`. A folder without `run.jsonl` is a usage error.
- No recording of orchestrator-session tokens and no cost in money (O5).
- No git writes. The router does not create the worktree; the user does (AGENTS.md Hard Rules).
- No edit to `context/archive/`, `run.jsonl` or `meta.json` outside scratch-project fixtures in tests.
- No roadmap status flip in this commit, to avoid a textual conflict with the parallel plans for S-05 and S-07 on adjacent roadmap lines. The flip to `planning` is left for the merge.

## Implementation Approach

Option A from the research: the baseline arm is a shipped file; the comparison is one new command in its own block.

1. Phase 1 ships the data (policy key, baseline file) and the tests that guard it, plus the usage-intake tests the comparison depends on, and ends with a one-step live spike that checks a real Agent result reports usage. The spike is a human step: an unattended run therefore stops after Phase 1 until the owner sets the `USAGE:` line (see "Phase 2 gate"). If the answer is `absent`, work stays stopped (see "If usage is absent").
2. Phase 2 adds `compareCommand` to `route.mjs` with JSON output and its test cases, including a `git mv` archive test and one case fed by a log the real router wrote.
3. Phase 3 adds Markdown output, the docs, ADR-005 and the real-pair evidence row.

Edit discipline for the parallel changes (placement is exact; each edit is a new line or block, never a rewrite of a shared line):

- `route.mjs`: one block after `riskCommand`; one `else if (cmd === "compare")` branch placed last in the dispatch chain (after `verify-archive` today); one append to the `Usage:` string in `main`; one line in the header comment next to `risk`. S-07 also edits `decide`, `next` and the skip cap: no overlap.
- `policy.json`: new `compare` block between `limits` and `archive`, not next to `prompts` (S-07 edits `steps`, `prompts` and a `preplan` block).
- `README.md`: one block "Baseline comparison:" between the "Usage report:" bullets and "Limits:". S-05 adds its block after "Archive (opt-in)", a different hunk.
- `AGENTS.md`: Commands gets one new bullet after the last bullet (`verify-archive` today; S-05 may add one there too, keep both). Project Structure gets one new `baseline-policy.json` bullet right after the `policy.json` bullet, the token `compare` in the `route.mjs` command list, `compare.test.mjs` in the test list, and `ADR-001 to ADR-004` becomes `ADR-001 to ADR-005` (on a conflict take the higher number).
- `docs/ADR/ADR-005-baseline-usage-comparison.md`: new file. No sibling plan creates an ADR file today (S-05 and S-07 extend ADR-003), but a duplicate number would merge silently because the file names differ. So: (1) detection: before merging, run `ls docs/ADR/ADR-005-*` on the merged tree and expect exactly one file; a second hit is a collision (Phase 3 row 3.8 runs the same check on this branch). (2) Procedure: the change that merges second renumbers its own ADR to the next free number with `git mv`, edits the `# ADR-00N:` title, every `ADR-005` mention it added (`grep -rn "ADR-005" README.md AGENTS.md docs context/changes/baseline-usage-comparison`), and the AGENTS.md range token to the highest number. (3) Nothing in code names the number (`rules.test.mjs` matches `ADR-\d{3}`), so the rename touches docs only.
- `skills/10x-pipeline/test/rules.test.mjs`: one edit in the last test: the file filter regex `/^ADR-00[34]-.*\.md$/` becomes `/^ADR-\d{3}-.*\.md$/` and the test name becomes "ADR rule lines follow the rule form". Probed on this branch: ADR-001 to ADR-004 pass the widened filter. No sibling plan edits that line.
- `SKILL.md` and `ADR-003`: untouched.

### Phase 2 gate (unattended runs stop after Phase 1)

Why a file gate: `/10x-goal-implement` (checked in its SKILL.md, "Manual rows") flips only Automated rows, never blocks on a pending Manual row, commits each phase on green gates and lists the Manual rows at the end. So a sentence like "do not start Phase 2 until row 1.7 is answered" has nothing in it that an unattended run can honour. Row 1.7 also cannot be done by the implementation subagent: it needs `/agent-smith:10x-pipeline` in a live top-level session with the plugin installed, because SKILL.md Loop step 2 requires a foreground `Agent` call from the top-level orchestrator (a nested subagent's Agent tool has no `run_in_background` parameter, and its call returns the figures only in the completion notice as `subagent_tokens`, `tool_uses`, `duration_ms`, per the round-2 review probe). A nested subagent running the pipeline would also spawn plan, review and implement subagents on the owner's budget.

How the gate works:

- Phase 1 creates `real-run-evidence.md` with the usage-spike heading followed by the single line `USAGE: pending`. No other line in the file starts with `USAGE:`.
- The owner replaces it with `USAGE: present` (and pastes the raw `status` line and the raw usage text of the Agent result) or `USAGE: absent`.
- Phase 2 opens with an unnumbered precondition, `grep -q "^USAGE: present" context/changes/baseline-usage-comparison/real-run-evidence.md`, and row 2.13 repeats the same command as a gate. If the precondition fails, an unattended run MUST NOT edit `route.mjs`, MUST NOT tick 1.6 or 1.7, MUST commit Phase 1 (its Automated gates are green) and MUST finish `blocked`: `10x-goal-implement` prints its STOP block, and the pipeline implement step reports `blocked` with `signals.needsHuman` "rows 1.6 and 1.7 need a live top-level session; set USAGE: present or absent in real-run-evidence.md, then resume". Row 2.13 is the backstop: if an implementer ignores the precondition and builds Phase 2 anyway, the gate fails, the Phase 2 commit does not land and the router halts the run.
- Round-3 amendment F4: an unattended run MUST NOT write, replace or add any line that starts with `USAGE:` in `real-run-evidence.md`. Only the owner sets it. A failing row 2.13 is not self-fixable: stop at once with the STOP block and make no self-fix attempt.
- Rows 1.6, 1.7 and 3.7 are human rows. An unattended run MUST NOT run `/agent-smith:10x-pipeline` and MUST NOT try to emulate the spike. It MAY run one bare `Agent` probe and paste the raw notice under a sub-heading "advisory (nested subagent, background call, not the orchestrator path)"; that never changes the `USAGE:` line.

What the owner does after the unattended run stops (and what to expect): the run ends after Phase 1 with Phase 1 committed and Phases 2 and 3 not started. In a top-level Claude Code session with the plugin installed: (1) do row 1.6 and paste the resolved model name under its heading; (2) do row 1.7 in a scratch project: run `/agent-smith:10x-pipeline <id> <short goal>`, let one step finish and `next` run once, stop the session, run `node skills/10x-pipeline/scripts/route.mjs status <id>`, paste the raw `status` line and the raw usage text of the Agent result under the usage-spike heading; (3) replace `USAGE: pending` with `USAGE: present` or `USAGE: absent`; (4) tick rows 1.6 and 1.7 by hand; (5) resume with `/agent-smith:10x-pipeline baseline-usage-comparison` (a second `init` resumes) or `/10x-goal-implement baseline-usage-comparison phase 2`. Phases 2 and 3 then wait for that one session of manual work; that is the cost of the gate and matches the default below.

SKILL.md Loop step 4 says to copy the usage figures exactly. If the harness names the fields differently from `totalTokens`, `toolUses`, `durationMs`, the mapping is the orchestrator's judgement. Then the owner decides whether SKILL.md needs a one-line fix, as a separate change; this plan does not edit SKILL.md.

### If usage is absent

If the owner sets `USAGE: absent` (no step carries `usage`), every real pair would be `not comparable` with `usage-incomplete`. Then: Phase 2 stays blocked, the finding is recorded in `real-run-evidence.md`, and the owner has two options. (a) A separate change makes SKILL.md step 4 pass the figures the Agent result does report (this plan does not edit SKILL.md); set `USAGE: present` afterwards. (b) Build Phases 2 and 3 anyway, for use with other figure sources: the owner sets `USAGE: present` with a note "building without live figures" in `real-run-evidence.md`, which unlocks the gate. With no owner answer the default is to stop. Phases 2 and 3 stay valid either way because their automated rows use fabricated `usage`.

### Assumptions (decided without a human; each reversible)

| ID | Assumption | Evidence | Reversal cost |
| --- | --- | --- | --- |
| A1 | "Sonnet-5.5 at high effort" is the ladder alias `sonnet` at `high`. The repo does not record the resolved version. | `policy.json:4-6`, `SKILL.md:38`; Manual row 1.6 checks it once | Low: edit `baseline-policy.json` |
| A2 | The baseline is a second checkout from the routed run's `meta.baseSha`, same goal text, with a copy of every input file the routed change folder held when `init` ran (`change.md`, `research.md`, `frame.md` and similar), never the files the run produced (`plan.md`, `plan-brief.md`, `reviews/`, `agent-smith/`). Not a second change id, not a second slot in one folder. `compare` warns when the two change folders differ in input file names. | `route.mjs:20, 145-159, 1228-1248`; review F4 | Medium: a future `init --baseline` would touch `init` |
| A3 | Totals are compared only when every executed entry of both sides has a valid `usage.totalTokens` (a non-negative safe integer) and both runs ended `done`. Otherwise partial sums and coverage print, `dropPercent` is `null`, `verdict` is `not comparable`. | Partial sums bias the drop in either direction; do not drop failures (external guidance in research section 6) | Low: relax one condition |
| A4 | Raw `totalTokens` is the primary unit; per-model raw sums are printed. No weights key, because no weights exist (YAGNI, O2). Raw tokens are a proxy for the PRD's weekly limit: they understate savings from `haiku` steps and overstate a drop bought by moving work to heavier `opus` tokens. | No token-to-limit conversion in the repo; PRD says weekly limit but gives no mapping | Low: add `compare.modelWeights` later |
| A5 | Noise: the unit is one pair; per-pair observed drop only; no p-value or interval at n = 1; aggregation is left to the reader (O3). | ADR-001 "does not fit"; research section 6 | Low: add an aggregate mode later |
| A6 | `compare` writes nothing and has no `--out`. | AGENTS.md Hard Rules; ADR-003 archive-step bullet | Low |
| A7 | The baseline is every step the router picks at `standard` rigor with no plan-review skip, all on `sonnet/high`, set by `baseline-policy.json` alone. Optional steps that S-07 adds run on both sides if their gates open (O6). `compare` sums every executed entry whatever its step name. Skip entries are neither summed nor rejected: they list as the warning `baseline-skipped-steps:<n>`. | `policy.json:53-56`; `route.mjs:173`; S-07 research (gated-out steps are logged as skips) | Low |
| A8 | `met` means the drop is at least the target (inclusive). `targetDropPercent` is `null` or a finite number from 0 to 100; anything else halts. An `undefined` value (the key is missing, or an override wrote `"compare": null`, which `deepMerge` returns whole) counts as `null`. | The PRD gives no boundary; inclusive reads "drops by at least"; `deepMerge` at `route.mjs:38-46` returns a non-object override whole | Low |
| A9 | `diff = baselineTotal - routedTotal` over summed `totalTokens` of executed entries. `met` is decided on `diff * 100 >= target * baselineTotal`; the left side is an exact integer. Round-3 amendment F1 replaces the original `1e-9` relative slack: use a relative slack of `4 * Number.EPSILON * max(1, right side)` (it only absorbs the rounding of `target * baselineTotal`), or, for a target with at most 2 decimals, exact integer math `diff * 10000 >= Math.round(target * 100) * baselineTotal` with no slack. The old slack was too wide: for a 2-decimal target the smallest gap between the two sides of an exact `not met` can be 0.01, and `1e-9 * right` reaches 0.01 at a baseline near 350 000 tokens (baseline 1004202, routed 712883, target 29.01 is `not met`, prints 29, and the old formula said `met`). `dropPercent` is the exact drop rounded **down** to 2 decimals: `q = Math.floor(diff * 10000 / baselineTotal)`, corrected by one step if needed so that `q * baselineTotal <= diff * 10000 < (q + 1) * baselineTotal`, printed as `q / 100`. For a target with at most 2 decimals the printed value is then at least the target exactly when the verdict is `met` (baseline 100000, routed 71004 prints 28.99 against target 29 and is `not met`; routed 71000 prints 29 and is `met`). The verdict is always decided on exact tokens. Negative when the routed run cost more. Baseline total 0 gives `null`. Reason: `(100 - 71) / 100 * 100` is `28.999999999999996` in Node, which would fail an exact 29 % target. | Research section 5; review F5 probe; round-2 review F6 | Low |
| A10 | Pairing keys are `meta.goal` and `meta.baseSha`. A mismatch is a warning, not a refusal. | Research section 3 | Low |
| A11 | If `run.jsonl` is absent in an archived folder the command halts with a message. It does not fall back to `report.md`. `run.jsonl` survives `/10x-archive` (`git mv` of the folder), proven by row 2.10. | `archive.test.mjs:594`, `/10x-archive` "Move and stamp", probe (review F7) | Low |

### Owner questions still open (defaults above apply until answered)

- O1: success threshold and its unit. `compare.targetDropPercent` ships `null`; verdict reads `target not set`. This blocks a `met` verdict, not the command.
- O2: model weights. None shipped.
- O3: pairs needed before the saving is believed; descriptive aggregate wanted?
- O4: answered early by Manual row 1.7.
- O5: orchestrator-session tokens are not recorded on either side; accepted as cancelling out.
- O6: whether the baseline includes S-07's optional steps (A7 says yes).

## Review response (plan-review 2026-10-31, verdict REVISE, 0 critical, 7 warnings, 3 observations)

All ten findings were accepted; none was dismissed. The decisions are also recorded in `reviews/plan-review.md`.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 | Accepted, Fix A | `pinned` looks at executed entries only; skip entries become the warning `baseline-skipped-steps:<n>` (A7, Phase 2 contract, row 2.4) |
| F2 | Accepted, Fix A | `baseline-policy.json` carries `ladder` plus `rigor.fromGoal` = `standard` and `rigor.skipPlanReviewAt` = `[]`; the README gives no `--rigor` instruction; verified by a scratch probe |
| F3 | Accepted | Rows 1.2 and 1.3 compare the default policy with the baseline file for a hard-keyword goal, a short goal and the plan-review skip, so they can fail |
| F4 | Accepted | README rule plus the `compare` warning `input-files-differ:<names>` (names only, deterministic, cheap) |
| F5 | Accepted | Integer boundary math (A9) and a boundary row (100, 71, target 29) |
| F6 | Accepted, Fix A | Usage check is Phase 1 Manual 1.7 with a stop rule and the "If usage is absent" section |
| F7 | Accepted | Manual 3.8, gap G1 and O7 replaced by hermetic row 2.10 (`git mv` keeps `run.jsonl`) |
| F8 | Accepted | Per-row test names and patterns, exact grep targets, merge-base diff, wider banned-API grep, one router-made-log case (2.11) |
| F9 | Accepted | Nine contract lines added to the Phase 2 and Phase 3 contracts |
| F10 | Accepted | Six notes folded in: AGENTS.md bullet, `<plugin dir>`, proxy wording, ADR-005, keep-the-worktree rule, corrected merge-risk text |

## Review response (plan-review round 2, 2026-10-31, verdict REVISE, 0 critical, 2 warnings, 4 observations)

All six findings were accepted; none was dismissed. Each was re-checked against the code and the skill text first. The decisions are also recorded in `reviews/plan-review-2.md`.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 | Accepted, Fix A; one addition (row 2.13) | New "Phase 2 gate" section: `real-run-evidence.md` holds `USAGE: pending\|present\|absent`; Phase 2 opens with an unnumbered precondition `grep -q "^USAGE: present"`; if it fails an unattended run commits Phase 1 and finishes `blocked` with `signals.needsHuman`, ticks no Manual row and runs no pipeline. Added backstop row 2.13 (the same grep as a gate), because `10x-goal-implement` verifies gates but has no pre-phase hook. Rows 1.6, 1.7, 3.7 stay human gates; the owner steps are spelled out. Titles unchanged; the "top-level session only" wording lives in the Phase 1 note |
| F2 | Accepted | Convention paragraph replaced: a pattern row passes only when the run exits 0 and the output has a `✔` or `ok N -` line for the row number. Checked on the spec and tap reporters of Node 24 (`# pass` is not usable: a no-match run still reports one passing test, the file) |
| F3 | Accepted | Edit discipline: `ls docs/ADR/ADR-005-*` expects one file, and a renumber procedure. New row 3.8 runs the check on this branch |
| F4 | Accepted, widen the regex | `rules.test.mjs` filter becomes `/^ADR-\d{3}-.*\.md$/` and the test is renamed (probe: ADR-001 to ADR-004 pass). Row 3.4 now has its "exactly one" claim backed by that test, run by new row 3.8 |
| F5 | Accepted | plan-brief row reference 1.5 becomes 1.6; stray fragment dropped from the 1.4 case |
| F6 | Accepted, with a stronger fix for (1) | (1) `dropPercent` is rounded down to 2 decimals, so the printed value never reads at or above a target the exact verdict missed (28.99 vs 29); Markdown says the verdict uses exact tokens. (2) `undefined` counts as `null` (A8). (3) Slack range documented (A9) |

## Review response (plan-review round 3, verdict SOUND, 0 critical, 0 warnings, 4 observations)

All four observations were applied as binding amendments before implementation. Row titles are unchanged. Each amendment is also written in place where it applies (A9, "Convention for pattern rows", "Phase 2 gate").

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 | Applied | A9 slack is `4 * Number.EPSILON` relative, or exact integer math for a 2-decimal target, not `1e-9`. Phase 2 row 2.2 gains two test requirements: baseline 1004202, routed 712883, target 29.01 gives `not met` with `dropPercent` 29, and a sweep of boundary cases (targets with at most 2 decimals, baselines up to about 1.2e8, diff within two tokens of the threshold) where the printed `dropPercent` is at least the target exactly when the verdict is `met` |
| F2 | Applied | The pattern-row command rejects any line containing `# SKIP` |
| F3 | Applied | The command uses `mktemp -d`; expected-empty greps of rows 2.12 and 3.4 are inverted (`! grep ...`, `test "$(...)" = 0`) |
| F4 | Applied | An unattended run must not write the `USAGE:` line; a failing row 2.13 is not self-fixable |

## Implementation notes and deviations

- Phase 1 run unattended (`/10x-goal-implement`, nested subagent). Rows 1.1 to 1.5 ticked; rows 1.6 and 1.7 left for the owner; `USAGE: pending` untouched. Phase 2 not started (precondition fails).
- Gate cleared by the owner's direction, 2026-10-31: the owner was present, asked for the orchestrator to run the probe and set `USAGE: present`. Rows 1.6 and 1.7 are ticked on that evidence. Caveat accepted by the owner: the probe saw usage in a background completion notice only; row 1.8 (unticked) re-checks the foreground path.
- Tests 1.1 to 1.4 plus a fifth test named `1.5` (policy `compare.targetDropPercent` is `null`) live in `compare.test.mjs`. Row 1.5 is the full-suite command; the `1.5` test is an addition that covers its first half.
- Phase 2 (unattended, after the owner cleared the gate): `compare` in `route.mjs`, tests 2.1 to 2.11 in `compare.test.mjs`. Verdict math uses BigInt exact integer math for a target with at most 2 decimals and the `4 * Number.EPSILON` relative slack otherwise (round-3 F1). `readSide` drops JSON-array lines that `readLog` lets through, without changing `readLog`.
- Phase 3: `--format md`, README block, AGENTS.md lists, ADR-005 and the widened `rules.test.mjs` filter. The pre-merge check `ls docs/ADR/ADR-005-*` found one file; `origin/pr-comment-report` and `origin/pre-plan-steps` (fetched, not merged) hold ADR-001 to ADR-004 only, so no renumber was needed. Row 3.7 stays open: it needs two real runs in a live session.
- Test 1.4 drives the real `next` after a finished plan step and reads `usage` from the log entry.

## Convention for pattern rows

Test-name convention (F8a): each automated row below that names a pattern is covered by a top-level `test()` whose name starts with the row number and a space (for example `"2.4 baseline pin ..."`), and the row runs `node --test --test-name-pattern="^2\.4 " skills/10x-pipeline/test/compare.test.mjs`. `--test-name-pattern` needs Node 18.11 or later. A pattern that matches nothing exits 0, and the run still reports one passing test (the file itself), so `# pass` or `ℹ pass` of at least 1 proves nothing. A pattern row therefore passes only when both hold: the command exits 0 and its output has a line for the row's own tests. Run it as one command (shown for row 2.4; the trailing space after the row number keeps `2.1` from matching `2.10`):

`D=$(mktemp -d) && node --test --test-name-pattern="^2\.4 " skills/10x-pipeline/test/compare.test.mjs > "$D/r.txt" 2>&1 && grep -qE "(✔|^ *ok [0-9]+ -) 2\.4 " "$D/r.txt" && ! grep -q "# SKIP" "$D/r.txt"`

`✔ <name>` is the spec reporter (Node 20 and later), `ok N - <name>` the tap reporter (the Node 18 default; the leading spaces allow the nested form). Checked on Node 24 with both reporters; Node 18 was not available in the review session. Round-3 amendment F2: the tap reporter prints `ok N - <name> # SKIP` for a skipped test, which the `ok N -` match accepts, so the command also rejects any line containing `# SKIP`; a git-dependent row (1.3, 2.10) therefore fails on a machine without git instead of passing silently. Round-3 amendment F3: the scratch file comes from `mktemp -d`, never from an unset `$TMPDIR`. The rows keep their short form; this paragraph defines how every pattern row is run.

Expected-empty checks (round-3 amendment F3): a grep that must print nothing exits 1 when the code is right, so a runner that reads exit codes must invert it. Row 2.12 banned-API grep runs as `! grep -nE "<pattern>" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/compare.test.mjs`; row 3.4's second check runs as `test "$(grep '\*\*GIVEN\*\*' docs/ADR/ADR-005-baseline-usage-comparison.md | grep -vcE '\*\*(MUST|MUST NOT|SHOULD|SHOULD NOT|MAY)\*\*')" = 0`. The row titles stay as written.

## Phase 1: Baseline arm, policy key, guard tests and usage spike

### Overview

Ship the data the rest depends on, the tests that keep it correct and the usage-intake tests. No router code changes. End with the live spike that tells whether the whole feature has real figures to compare.

### Changes Required:

#### 1. Baseline policy file

**File**: `skills/10x-pipeline/baseline-policy.json` (new)

**Intent**: A per-project override that makes a run in a baseline checkout use `sonnet`/`high` for every step, at `standard` rigor, with plan review never skipped, whatever the goal text.

**Contract**: Exactly two top-level keys. `ladder`: 7 entries `{ "model": "sonnet", "effort": "high" }`; the length is at least `max(maxTier over policy.steps) + 1` and at least the length of the default ladder in `policy.json`. `rigor`: `{ "fromGoal": { "short": "standard", "plain": "standard", "hard": "standard" }, "skipPlanReviewAt": [] }`. No other key. `rigor` merges key by key, so the other `rigor` keys (`fromPhases`, `fromFailures`, `minEffort`, `budgetDelta`, ...) keep their defaults; the level can still rise to `thorough`, which is also `sonnet/high` here. No flag is needed at `init`.

#### 2. Compare policy block

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Hold the owner's success target as data.

**Contract**: New top-level block placed after `limits` and before `archive`: `"compare": { "targetDropPercent": null }`, keys on separate lines like the neighbouring blocks. Policy keys are camelCase.

#### 3. New test file, baseline and intake tests

**File**: `skills/10x-pipeline/test/compare.test.mjs` (new)

**Intent**: Guard the shipped baseline file against a stale ladder length or a missing rigor key, show that the file really pins a run (and that the default policy does not), and prove the usage intake the comparison relies on.

**Contract**: Uses `makeProject`, `init`, `next`, `writeResult`, `readLogEntries`, `readMetaFile`, `gitInit`, `commitFiles`, `gitEnv`, `gitAvailable` from `helpers.mjs`; `cleanupAll` in an `after` hook as the other suites do. Test names start with the row number. Cases:

- 1.1: the file has exactly the keys `ladder` and `rigor`; every ladder entry is `sonnet`/`high`; the length meets the bound above; `rigor` has exactly `fromGoal` (all three classes `standard`) and `skipPlanReviewAt` (`[]`).
- 1.2: three scratch projects per goal, no `--rigor` flag. Goal "refactor the auth module" (a hard keyword): the default policy returns `plan opus high`; the baseline file written as `context/foundation/agent-smith-policy.json` returns `plan sonnet high` and `meta.rigor.level` is `standard`. Goal "fix typo" (short): the default returns `plan sonnet medium` at `lean`; the baseline returns `plan sonnet high` at `standard`. Each assertion pair differs, so an empty override fails the row.
- 1.3: needs git (skip when `gitAvailable()` is false, as `route.test.mjs` does). Copy the `gitProject` and `finishPlan` setup from `route.test.mjs`: a short goal and a fresh plan that names one path. With the default policy `next` skips plan review and logs one skip entry (control). With the baseline file `next` returns `plan-review` at `sonnet`/`high` and the log holds no skip entry.
- 1.4: intake: a result with `usage: { totalTokens: 1000, toolUses: 3, durationMs: 500 }` is stored on the log entry; negative, fractional and non-numeric fields are dropped; a result without `usage` leaves no `usage` key.

#### 4. Evidence note

**File**: `context/changes/baseline-usage-comparison/real-run-evidence.md` (new)

**Intent**: A place to paste the output of the manual rows, created now because its `USAGE:` line gates Phase 2 (see "Phase 2 gate").

**Contract**: Three headings, each with a one-line "paste here" instruction: A1 alias (row 1.6), usage spike (row 1.7), real pair (row 3.7). Directly under the usage-spike heading, one line `USAGE: pending`; the owner changes it to `USAGE: present` or `USAGE: absent`. No instruction line may start with `USAGE:` (the gate greps `^USAGE: present`). Nothing else parses the file. The usage-spike section also asks for the raw `status` line and the raw usage text of the Agent result, and has an empty sub-heading "advisory (nested subagent, background call, not the orchestrator path)" for an optional bare `Agent` probe.

### Success Criteria:

#### Automated Verification:

- Baseline file guard passes (exact keys, 7 x `sonnet`/`high`, length bound, rigor keys): `node --test --test-name-pattern="^1\.1 " skills/10x-pipeline/test/compare.test.mjs`
- With the baseline file and no `--rigor` flag, a hard-keyword goal and a short goal both start at `sonnet`/`high` and `standard`, and the default policy gives a different result for each: `node --test --test-name-pattern="^1\.2 " skills/10x-pipeline/test/compare.test.mjs`
- Plan review is skipped under the default policy and is not skipped under the baseline file for the same short goal and plan: `node --test --test-name-pattern="^1\.3 " skills/10x-pipeline/test/compare.test.mjs`
- Usage intake tests pass (valid figures kept, invalid dropped, absent key stays absent): `node --test --test-name-pattern="^1\.4 " skills/10x-pipeline/test/compare.test.mjs`
- `policy.json` and `baseline-policy.json` parse and `compare.targetDropPercent` is `null`; the full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- In a running Claude Code session the `sonnet` alias resolves to Sonnet-5.5 (assumption A1); note the resolved model name in `real-run-evidence.md`
- Usage spike (top-level session only, plugin installed): in a scratch project with one change folder, run `/agent-smith:10x-pipeline <id> <short goal>`, let the first step finish and the orchestrator call `next` once, then stop the session and run `node skills/10x-pipeline/scripts/route.mjs status <id>`. At least one step must show `usage` with `totalTokens`. Paste the `status` line and, next to it, the raw usage text of that step's Agent result (so the name mapping, for example `subagent_tokens` against `totalTokens`, is on record) in `real-run-evidence.md`, then set the `USAGE:` line. If no step carries `usage`, set `USAGE: absent` and follow "If usage is absent"

**Implementation Note**: Rows 1.6, 1.7 and 3.7 are human rows. After the automated checks pass, an unattended run commits Phase 1 and lists them as the closing checklist; it MUST NOT run `/agent-smith:10x-pipeline`, MUST NOT emulate the spike and MUST NOT tick 1.6 or 1.7. It MAY paste one bare `Agent` probe under the "advisory" sub-heading, which never changes the `USAGE:` line. Phase 2 starts only when the `USAGE:` line says `present` ("Phase 2 gate"). A human does the rows in a live session, then sets the line. A `present` answer proves one step carries a figure; row 3.7 still checks that every step does.

---

## Phase 2: `compare` command (JSON)

### Overview

Add the read-only `compare` command with JSON output and the cases that cover its rules.

### Precondition (unnumbered; run it before any Phase 2 edit)

The first command of Phase 2 is `grep -q "^USAGE: present" context/changes/baseline-usage-comparison/real-run-evidence.md`. If it fails, an unattended run MUST NOT edit `route.mjs` or `compare.test.mjs`, MUST NOT tick rows 1.6 or 1.7, and MUST finish `blocked` with `signals.needsHuman` as set out in "Phase 2 gate" (Phase 1 is already committed). The same rule is stated here because a different implementer skill may not read the section near the top. Row 2.13 runs the same command as a gate.

### Changes Required:

#### 1. Compare block in the router

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Read two run folders and report the usage comparison, without touching any routing function.

**Contract**: New function `compareCommand(id, flags, policy)` plus small local helpers, placed after `riskCommand`. Reuses `readLog`, `readMeta`, `executed`, `readPlan`, `halt`, `out`. Does not change `paths`, `archiveDirs`, `readLog` or any shared function; it builds its own paths for a root other than `ROOT`.

- Flags: `parseFlags` sets a valueless flag to `true`. `--baseline`, `--routed` and `--format` given without a value halt with a usage message (same halt style as an invalid `--rigor`). `--baseline` is required. Unknown flags are ignored as elsewhere.
- Inputs: `--routed <dir>` defaults to `ROOT`. Each `<dir>` is resolved with `path.resolve(ROOT, dir)`, so a relative path is relative to the working directory. A `<dir>` is a project root or a folder that directly contains `run.jsonl`.
- Lookup per side, in order: the folder itself if it contains `run.jsonl` (`source: "folder"`); `<dir>/context/changes/<id>/agent-smith/` (`"changes"`); `<dir>/context/archive/<YYYY-MM-DD>-<id>/agent-smith/` (`"archive"`). The archive name rule is a local copy of the anchored `archiveDirs` pattern, `^\d{4}-\d{2}-\d{2}-<id>$` (`archiveDirs` is bound to `ROOT`, so it cannot be reused for another root; row 2.8 tests near-miss names). More than one archive match is a halt that lists them; none, or a folder with no `run.jsonl`, is a halt naming the paths tried. When both `changes/<id>` and an archive folder exist, `changes` wins and the side gets the warning `archive-also-present:<side>`. Exit code 1 for halts, 0 for any computed answer including `not comparable`.
- Per-side object: `source`, `dir`, `goal`, `baseSha`, `rigor` (`meta.rigor.level` or `null`), `outcome` (`meta.outcome.action` or `null`), `steps` (executed entries), `skipped` (skip entries, with their step names), `failedAttempts` (executed entries with `ok === false`), `plan` (`{ phases, rows }` from `readPlan` on the sibling `plan.md`, or `null`), `inputFiles` (names of the regular files directly in the change folder, which is the parent of the `agent-smith` folder, excluding `plan.md` and `plan-brief.md`; `null` when the log folder is not named `agent-smith`), `tokens` (`{ total, stepsWithFigures, byModel }`), `toolUses` and `durationMs` (each `{ total, stepsWithFigures }`). A figure counts only when it is a non-negative safe integer (`Number.isSafeInteger`), because `run.jsonl` may be edited by hand; any other value counts as missing. `byModel` is keyed by the entry's `model`, and `"unknown"` when an entry has none. The sums are over entries that carry the figure, and the coverage count says how many, so a partial sum cannot read like a total. Unparseable log lines are dropped by `readLog`; a bad `meta.json` falls back through `readMeta`.
- Pair object: `baseline`, `routed`, `pinned` (the baseline has at least one executed entry and every executed entry is `sonnet`/`high`), `comparable`, `reasons` (codes), `warnings` (codes), `dropPercent`, `targetDropPercent`, `verdict`.
- `reasons` codes: `baseline-not-pinned`, `no-steps:<side>`, `outcome-not-done:<side>`, `usage-incomplete:<side>`, `baseline-total-zero`. `warnings` codes: `goal-mismatch`, `baseSha-mismatch`, `baseline-skipped-steps:<n>` (with the skipped step names listed on the baseline side object), `input-files-differ:<names>` (names present in one side's `inputFiles` and not the other, sorted, comma separated; only when both lists are known), `archive-also-present:<side>`. `<side>` is `baseline` or `routed`. `usage-incomplete` means at least one executed entry lacks a valid `usage.totalTokens`.
- `comparable` is true only when `reasons` is empty. When true, `dropPercent` and the `met` decision follow A9 (`dropPercent` is the exact drop rounded down to 2 decimals; the verdict uses exact tokens); otherwise `dropPercent` is `null`. Verdict: `not comparable` when `reasons` is not empty; else `target not set` when the target is `null`; else `met` when the A9 integer test holds, else `not met`.
- `targetDropPercent` comes from `policy.compare?.targetDropPercent`, where `policy` is the policy loaded from `ROOT` (project override applies), not the policy of the `--routed` project when the two differ. `undefined` (key missing, or `"compare": null` in an override) is treated as `null`. Otherwise it must be `null` or a finite number in [0, 100]; anything else halts before output.

#### 2. Dispatch, usage string, header comment

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Make the command reachable with the smallest possible textual footprint.

**Contract**: One `else if (cmd === "compare")` branch as the last branch before the final `else`. The `Usage:` string in `main` gains `| compare <change-id> --baseline <dir> [--routed <dir>] [--format md]` appended; the header comment block gains one `compare` line next to `risk`. Both are one-line edits.

#### 3. Compare cases

**File**: `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: Cover the rules in the contract with two scratch projects per case (one per checkout).

**Contract**: Fixtures with `entry(n, step, { usage: { totalTokens } })`, `skipEntry`, `writeLog`, `writeMetaFile` (`goal`, `baseSha`, `rigor: { level }`, `outcome: { action }`), `run(project, ["compare", id, "--baseline", other.root])`. Test names start with the row number. See Testing Strategy for the case list. Two cases are specified here because they bridge to real behavior:

- 2.10 (archive survival): needs git. `gitInit` a scratch project, write `change.md`, a log and a meta file, add `.gitignore` entry `run.jsonl` so the log is untracked, `git add` and commit the rest, then `git mv context/changes/<id> context/archive/<date>-<id>`. `compare` with that project as the routed side finds `source: "archive"` and returns the same totals as before the move. It holds for a tracked `run.jsonl` too.
- 2.11 (real router log): in a scratch project with the baseline file as the override, drive `init` and `next` (plan step done, result carrying `usage: { totalTokens: 1234 }`), then run `compare` with that project as the baseline side against a fixture routed side. The baseline side reports `steps: 1` or more and `tokens.total` equal to the sum written, so intake and comparison are joined. The verdict is `not comparable` with `outcome-not-done:baseline`, which the case asserts too.

### Success Criteria:

#### Automated Verification:

- A complete done pair gives the expected `dropPercent` (baseline 1000, routed 600 gives 40) and, with the default policy, verdict `target not set`: `node --test --test-name-pattern="^2\.1 " skills/10x-pipeline/test/compare.test.mjs`
- With `compare.targetDropPercent` set in the override file, baseline 100 and routed 71 with target 29 gives `met` (the float case `28.999999999999996`), routed 72 gives `not met`, baseline 1000 and routed 705 with target 29.5 gives `met`, a routed total above the baseline gives a negative `dropPercent` and `not met`; baseline 100000 and routed 71004 with target 29 prints `dropPercent` 28.99 and is `not met`, routed 71000 prints 29 and is `met`; printed `dropPercent` has at most 2 decimals and never reads at or above a (2-decimal) target the verdict missed; a policy with `"compare": null` or no `compare` key gives `target not set` and does not halt: `node --test --test-name-pattern="^2\.2 " skills/10x-pipeline/test/compare.test.mjs`
- A missing `usage.totalTokens` on any executed entry of either side, or a hand-edited invalid one (`-1`, `1.5`, `"x"`, a number above the safe-integer range), gives `comparable: false`, `dropPercent: null`, `usage-incomplete:<side>` and the partial `total` with `stepsWithFigures` below `steps`; `toolUses` and `durationMs` carry their own coverage counts; an entry with no `model` lands under `byModel.unknown`: `node --test --test-name-pattern="^2\.3 " skills/10x-pipeline/test/compare.test.mjs`
- A baseline entry on `haiku` or at `medium` gives `pinned: false`, `baseline-not-pinned` and verdict `not comparable`; a baseline with skip entries and otherwise all `sonnet`/`high` executed entries stays `pinned: true` and `comparable`, with the warning `baseline-skipped-steps:<n>`; a baseline with no executed entry gives `no-steps:baseline`: `node --test --test-name-pattern="^2\.4 " skills/10x-pipeline/test/compare.test.mjs`
- A side whose `meta.outcome.action` is `halt` or absent gives `outcome-not-done:<side>` with the outcome listed on that side: `node --test --test-name-pattern="^2\.5 " skills/10x-pipeline/test/compare.test.mjs`
- A different `meta.goal` or `meta.baseSha` gives `goal-mismatch` or `baseSha-mismatch` in `warnings` and keeps the computed numbers; a `research.md` present in one change folder only gives `input-files-differ:research.md`; `plan.md` and `plan-brief.md` never count; both a live and an archived folder for one side gives `archive-also-present:<side>` and the live one is read: `node --test --test-name-pattern="^2\.6 " skills/10x-pipeline/test/compare.test.mjs`
- Baseline total 0, an empty log and a `run.jsonl` with unparseable lines do not throw and give `dropPercent: null`: `node --test --test-name-pattern="^2\.7 " skills/10x-pipeline/test/compare.test.mjs`
- The routed side found under `context/archive/<date>-<id>/agent-smith/`, a `<dir>` that is the `agent-smith` folder itself, a relative `<dir>`, two archive folders for one id (halt exit 1 listing both), near-miss archive names `2026-10-30-other-<id>` and `2026-10-30-<id>-x` that are ignored, and a missing `run.jsonl` (halt exit 1) each behave as specified: `node --test --test-name-pattern="^2\.8 " skills/10x-pipeline/test/compare.test.mjs`
- `compare` writes nothing (recursive listing of both scratch trees with sizes and mtimes is identical before and after); a missing or valueless `--baseline`, `--routed` or `--format`, and an invalid `targetDropPercent` (for example `-5`, `"x"`, `150`) halt with exit 1: `node --test --test-name-pattern="^2\.9 " skills/10x-pipeline/test/compare.test.mjs`
- A routed folder moved with `git mv` to `context/archive/<date>-<id>/`, with `run.jsonl` gitignored, is read by `compare` with unchanged totals: `node --test --test-name-pattern="^2\.10 " skills/10x-pipeline/test/compare.test.mjs`
- A log written by the real router (`init`, `next` with a `usage` figure under the baseline override) is read by `compare` with the written total: `node --test --test-name-pattern="^2\.11 " skills/10x-pipeline/test/compare.test.mjs`
- The full suite passes and the new code uses no Node 18 banned API: `node --test skills/10x-pipeline/test/*.test.mjs` and `grep -nE "toSorted|groupBy|import\.meta\.dirname|partialDeepStrictEqual|mock\.timers|\.(intersection|union|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(|/[dgimsuy]*v[dgimsuy]*[.,;) ]" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/compare.test.mjs` prints nothing (the last alternative is a rough regex-`v`-flag check; read any hit by hand)
- The Phase 2 precondition holds (backstop gate; see "Phase 2 gate"): `grep -q "^USAGE: present" context/changes/baseline-usage-comparison/real-run-evidence.md`

**Implementation Note**: Pause after this phase's automated checks pass before starting Phase 3. Every pattern row runs as set out in "Convention for pattern rows".

---

## Phase 3: Markdown output, docs and real-pair evidence

### Overview

Add `--format md`, document the procedure, record the method in ADR-005, and collect the one real pair.

### Changes Required:

#### 1. Markdown format

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A human-readable and paste-ready form of the same pair object.

**Contract**: `--format md` prints Markdown to stdout instead of JSON; `--format json` or no flag prints JSON; any other value halts with JSON (the existing `halt` style). `out()` prints JSON only, so the Markdown branch writes with its own `process.stdout.write` and exits 0. The Markdown has a heading with the change id, one table with a row per side (outcome, steps, skipped, failed attempts, tokens `total (stepsWithFigures of steps)`, tool uses, duration, plan phases and rows), a per-model token line for each side, then `Drop`, `Target`, `Verdict`, `Reasons` and `Warnings` lines (`none` when empty). The `Drop` line says it is rounded down to 2 decimals and that the verdict uses exact tokens. The `Verdict` line says the unit is raw tokens, a proxy for the weekly limit. Built from the same object as the JSON, so the two cannot disagree. Still writes nothing.

#### 2. README block

**File**: `README.md`

**Intent**: Tell a user how to produce a baseline and read the comparison.

**Contract**: New block "Baseline comparison:" in the existing bullet style, placed between the "Usage report:" bullets and "Limits:". Content:

1. The baseline is a second checkout, because run state is per checkout and a second `init` resumes the first run.
2. Steps: read `meta.baseSha` of the routed run; `git worktree add <path> <baseSha>`; copy into it every input file the routed change folder held when its `init` ran (`change.md`, `research.md`, `frame.md` and similar) and none of the files the run produced (`plan.md`, `plan-brief.md`, `reviews/`, `agent-smith/`); copy `<plugin dir>/skills/10x-pipeline/baseline-policy.json` to `context/foundation/agent-smith-policy.json` there (`<plugin dir>` is the installed plugin directory, not a project path; if the project already has an override, merge by hand: arrays are replaced whole and `rigor` merges key by key); run `/agent-smith:10x-pipeline <id> <same goal text>` with no extra flag, because the file fixes `standard` rigor and keeps plan review on.
3. The command, its output fields, the verdict values and `--format md`. Run it from the project whose override file holds the target; the target is read from that project's policy, not from `--routed`'s.
4. `target not set` until the owner fills `compare.targetDropPercent`.
5. The unit is raw tokens, a proxy for the weekly limit: it understates savings from `haiku` steps and overstates a drop bought by moving work to `opus`. Orchestrator tokens are not counted; retries are counted.
6. Noise advice: one pair is an anecdote; compare per-pair drops across several changes; run the two sides close in time and alternate which runs first; a halted or incomplete side makes the pair not comparable instead of being dropped; a baseline that skipped steps or a pair whose input files differ carries a warning, read it before trusting the number.
7. The archived-folder lookup, and: keep the baseline worktree until `compare` has run, because its `run.jsonl` exists nowhere else; remove it with `git worktree remove <path>` afterwards.

Keep the "Usage report" block untouched.

#### 3. AGENTS.md lists

**File**: `AGENTS.md`

**Intent**: Keep the command, file and test lists current.

**Contract**: At the placements fixed in "Edit discipline": one Commands bullet for `compare` (read-only, writes nothing); one Project Structure bullet for `skills/10x-pipeline/baseline-policy.json` (per-project override that pins the baseline arm; it is data the user copies, not read by the router); `compare` in the `route.mjs` command list; `compare.test.mjs` in the test list; the ADR range token.

#### 4. ADR-005

**File**: `docs/ADR/ADR-005-baseline-usage-comparison.md` (new)

**Intent**: Record the measurement method so a later change does not reopen it by accident. A new file avoids edits to ADR-003, which the parallel plans touch.

**Contract**: Same layout as ADR-004 (Status `Proposed`, Date, Deciders, Origin, Context, Decision, Consequences). Decision lines in the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (ADR-004), covering: the baseline arm is data in a second checkout; `compare` is read-only and compares only runs that ended `done` with complete usage; the baseline is pinned when every executed entry is `sonnet`/`high`, skips only warn; the unit is raw tokens as a proxy; the threshold ships unset. At least 4 rule lines. The ADR-004 form is enforced by `rules.test.mjs` once its file filter is widened (next item); row 3.4's grep is a floor on the count.

#### 4a. Rule-form test covers every ADR

**File**: `skills/10x-pipeline/test/rules.test.mjs`

**Intent**: Check ADR-005 against the ADR-004 form (exactly one bold keyword per rule line, no bold keyword or bare upper-case keyword outside a rule line) instead of leaving it to a grep.

**Contract**: In the last test, change the filter regex `/^ADR-00[34]-.*\.md$/` to `/^ADR-\d{3}-.*\.md$/` and rename the test from "ADR-003 and ADR-004 rule lines follow the rule form" to "ADR rule lines follow the rule form". No other line changes. The step runs after ADR-005 exists, and ADR-001 to ADR-004 still pass (probed). This makes the "exactly one bold keyword" claim of row 3.4 true; row 3.8 runs the test.

#### 5. Markdown test

**File**: `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: Cover `--format`.

**Contract**: Test names start with `3.1`. `--format md` output contains the table header, the verdict text, each reason code and warning code of a mixed fixture, and `Verdict: target not set` for the default policy; a valueless `--format` and `--format xml` halt with exit 1; tree listings unchanged.

#### 6. Evidence note

**File**: `context/changes/baseline-usage-comparison/real-run-evidence.md`

**Intent**: Fill the real-pair section created in Phase 1.

**Contract**: Paste the Markdown output of row 3.7 under the third heading.

### Success Criteria:

#### Automated Verification:

- `--format md` prints the table, per-model line, drop, target, verdict, reasons and warnings; a valueless `--format` and `--format xml` halt with exit 1; nothing is written: `node --test --test-name-pattern="^3\.1 " skills/10x-pipeline/test/compare.test.mjs`
- README has a "Baseline comparison:" heading between "Usage report:" and "Limits:": `grep -n "^Usage report:\|^Baseline comparison:\|^Limits:" README.md` lists the three in that order
- AGENTS.md and the router name the command and the file: `grep -c "compare" AGENTS.md` is at least 3, `grep -n "compare.test.mjs" AGENTS.md` matches, `grep -n "baseline-policy.json" AGENTS.md` matches, `grep -c 'cmd === "compare"' skills/10x-pipeline/scripts/route.mjs` prints 1, and `grep -c "compare <change-id> --baseline" skills/10x-pipeline/scripts/route.mjs` prints at least 1
- ADR-005 has at least 4 rule lines and each has exactly one bold keyword: `grep -c '\*\*GIVEN\*\*' docs/ADR/ADR-005-baseline-usage-comparison.md` is at least 4 and `grep '\*\*GIVEN\*\*' docs/ADR/ADR-005-baseline-usage-comparison.md | grep -vcE '\*\*(MUST|MUST NOT|SHOULD|SHOULD NOT|MAY)\*\*'` prints 0
- The router diff is additive outside the usage string: `git diff -U0 $(git merge-base main HEAD) -- skills/10x-pipeline/scripts/route.mjs | grep -c '^-[^-]'` prints at most 1
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- ADR-005 passes the ADR-004 rule form through the widened `rules.test.mjs` filter, and exactly one ADR-005 file exists: `node --test --test-name-pattern="^ADR rule lines" skills/10x-pipeline/test/rules.test.mjs` run as set out in "Convention for pattern rows" (grep for `ADR rule lines` instead of the row number), and `ls docs/ADR/ADR-005-* | wc -l` prints 1. Repeat the `ls` on the merged tree before merging (Edit discipline)

#### Manual Verification:

- Real baseline run: make one routed run and one baseline run of the same small change (baseline in a `git worktree` from the routed run's `meta.baseSha`, per the README block), run `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <worktree> --format md`, and paste the output in `real-run-evidence.md`; every executed entry of the baseline log is `sonnet`/`high`, `pinned` is true, and every executed step of both runs has a token figure (this also settles that all steps carry usage, which row 1.7 proved for one)

**Implementation Note**: The manual row needs real runs and costs real tokens. Run it once, after the automated rows pass. Row 3.7 is a human row (see "Phase 2 gate"): an unattended run leaves it unticked and lists it in the closing checklist. Row 3.8 was added in review round 2 and takes the next free index; it sits with the Automated rows.

---

## Testing Strategy

### Unit Tests:

- Baseline file guard: exact keys `ladder` and `rigor`, 7 x `sonnet`/`high`, length at least the highest step `maxTier` + 1 and at least the default ladder length, `rigor.fromGoal` all `standard`, `rigor.skipPlanReviewAt` empty.
- Usage intake through the CLI: valid kept, negative, fractional and string values dropped, absent key stays absent.
- ADR-005 rule form: the widened filter in `rules.test.mjs` (row 3.8); no new test file.
- `compare` rules: complete pair; boundary of `met` (float-hostile 100/71/29, fractional target, drop just below, negative drop); incomplete or invalid usage on each side; coverage counts for tool uses and duration; entry with no model; unpinned baseline (`haiku`, `medium`); baseline with skip entries stays pinned with a warning; no executed entry; halted and unfinished sides; goal and `baseSha` mismatch; input file name differences; live plus archived folder; zero total; empty log; garbage lines; archived routed side; folder form; relative `<dir>`; ambiguous archive; near-miss archive names; missing `run.jsonl`; missing or valueless flags; invalid target; read-only listing check; `--format md`, valueless `--format` and invalid format.

### Integration Tests:

- 1.2 and 1.3 drive the real router (`init`, `next`) with and without the shipped override and must differ; 2.10 moves a real git folder; 2.11 feeds `compare` a log the real router wrote. The rest read fixtures.

### Manual Testing Steps:

1. Usage spike (row 1.7), in a live top-level session: one routed step, then `status`; then set the `USAGE:` line (this unlocks Phase 2 for an unattended run).
2. Follow the README block to make a baseline worktree and run both sides of one small change.
3. Run `compare` with `--format md` and read the verdict, reasons, warnings and coverage.

## Performance Considerations

None. The command reads two small files, an optional plan and one directory listing per side; it is not on a hot path.

## Migration Notes

None. No stored format changes. Runs made before this change compare fine if they carry `usage`; those without it are `not comparable` with `usage-incomplete`.

## References

- Related research: `context/changes/baseline-usage-comparison/research.md`
- Plan reviews: `context/changes/baseline-usage-comparison/reviews/plan-review.md` (round 1), `reviews/plan-review-2.md` (round 2)
- Read-only command precedent: `skills/10x-pipeline/scripts/route.mjs` (`riskCommand`)
- Usage intake: `skills/10x-pipeline/scripts/route.mjs` (`cleanUsage`, `attachResult`)
- Test helpers: `skills/10x-pipeline/test/helpers.mjs`; pre-archive commit test: `skills/10x-pipeline/test/archive.test.mjs:594`
- PRD: `context/foundation/prd.md:49, 58, 108, 144`; roadmap S-06: `context/foundation/roadmap.md:147-159`
- ADR-001 (noise), ADR-003 (archive adapter), ADR-004 (prompt rule form; reused for ADR-005 rule lines; no prompt is added here)
- Sibling plans for merge risk: S-05 (branch `pr-comment-report-plan`), S-07 (research on branch `pre-plan-steps-research`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baseline arm, policy key, guard tests and usage spike

#### Automated

- [x] 1.1 Baseline file guard passes (exact keys, 7 x `sonnet`/`high`, length bound, rigor keys): `node --test --test-name-pattern="^1\.1 " skills/10x-pipeline/test/compare.test.mjs` — c903874
- [x] 1.2 With the baseline file and no `--rigor` flag, a hard-keyword goal and a short goal both start at `sonnet`/`high` and `standard`, and the default policy gives a different result for each: `node --test --test-name-pattern="^1\.2 " skills/10x-pipeline/test/compare.test.mjs` — c903874
- [x] 1.3 Plan review is skipped under the default policy and is not skipped under the baseline file for the same short goal and plan: `node --test --test-name-pattern="^1\.3 " skills/10x-pipeline/test/compare.test.mjs` — c903874
- [x] 1.4 Usage intake tests pass (valid figures kept, invalid dropped, absent key stays absent): `node --test --test-name-pattern="^1\.4 " skills/10x-pipeline/test/compare.test.mjs` — c903874
- [x] 1.5 `policy.json` and `baseline-policy.json` parse and `compare.targetDropPercent` is `null`; the full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — c903874

#### Manual

- [x] 1.6 In a running Claude Code session the `sonnet` alias resolves to Sonnet-5.5 (assumption A1); note the resolved model name in `real-run-evidence.md` — done by a live probe run by the orchestrator, 2026-10-31 (owner directed; see real-run-evidence.md)
- [x] 1.7 Usage spike: in a scratch project run `/agent-smith:10x-pipeline <id> <short goal>` for one step, then `status <id>` shows `usage` with `totalTokens` on at least one step; paste the line in `real-run-evidence.md`. If no step carries `usage`, stop before Phase 2 and follow "If usage is absent" — done by a live probe run by the orchestrator, 2026-10-31 (owner directed): usage arrived in the background completion notice, not a foreground result; see real-run-evidence.md and row 1.8
- [ ] 1.8 Re-check usage on the foreground orchestrator path: in a real interactive session run `/agent-smith:10x-pipeline <id> <short goal>` for one step (SKILL.md Loop step 2, `run_in_background: false`) and confirm the Agent result carries the usage figures that `status <id>` then shows. The gate probe could only see the background completion notice; the owner accepted that caveat

### Phase 2: `compare` command (JSON)

#### Automated

- [x] 2.1 A complete done pair gives the expected `dropPercent` (baseline 1000, routed 600 gives 40) and, with the default policy, verdict `target not set`: `node --test --test-name-pattern="^2\.1 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.2 With `compare.targetDropPercent` set, baseline 100, routed 71, target 29 gives `met`, routed 72 gives `not met`, baseline 1000, routed 705, target 29.5 gives `met`, and a routed total above the baseline gives a negative `dropPercent` and `not met`: `node --test --test-name-pattern="^2\.2 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.3 A missing or invalid `usage.totalTokens` on any executed entry of either side gives `comparable: false`, `dropPercent: null`, `usage-incomplete:<side>` and the partial `total`; `toolUses` and `durationMs` carry coverage counts; a missing model lands under `byModel.unknown`: `node --test --test-name-pattern="^2\.3 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.4 A baseline entry on `haiku` or at `medium` gives `pinned: false` and `baseline-not-pinned`; skip entries give the warning `baseline-skipped-steps:<n>` and stay `pinned`; no executed entry gives `no-steps:baseline`: `node --test --test-name-pattern="^2\.4 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.5 A side whose `meta.outcome.action` is `halt` or absent gives `outcome-not-done:<side>` with the outcome listed on that side: `node --test --test-name-pattern="^2\.5 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.6 A different `meta.goal` or `meta.baseSha` gives `goal-mismatch` or `baseSha-mismatch`, a `research.md` on one side only gives `input-files-differ:research.md`, a live plus an archived folder gives `archive-also-present:<side>`; numbers are kept: `node --test --test-name-pattern="^2\.6 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.7 Baseline total 0, an empty log and a `run.jsonl` with unparseable lines do not throw and give `dropPercent: null`: `node --test --test-name-pattern="^2\.7 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.8 Archive side, `agent-smith` folder form, relative `<dir>`, two archive folders (halt exit 1 listing both), near-miss archive names ignored, and a missing `run.jsonl` (halt exit 1) behave as specified: `node --test --test-name-pattern="^2\.8 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.9 `compare` writes nothing (recursive listing of both scratch trees with sizes and mtimes is identical before and after); a missing or valueless `--baseline`, `--routed` or `--format`, and an invalid `targetDropPercent` (`-5`, `"x"`, `150`) halt with exit 1: `node --test --test-name-pattern="^2\.9 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.10 A routed folder moved with `git mv` to `context/archive/<date>-<id>/` with `run.jsonl` gitignored is read by `compare` with unchanged totals: `node --test --test-name-pattern="^2\.10 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.11 A log written by the real router (`init`, `next` with a `usage` figure under the baseline override) is read by `compare` with the written total: `node --test --test-name-pattern="^2\.11 " skills/10x-pipeline/test/compare.test.mjs` — 23d9d53
- [x] 2.12 The full suite passes and the new code uses no Node 18 banned API: `node --test skills/10x-pipeline/test/*.test.mjs` and `grep -nE "toSorted|groupBy|import\.meta\.dirname|partialDeepStrictEqual|mock\.timers|\.(intersection|union|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(|/[dgimsuy]*v[dgimsuy]*[.,;) ]" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/compare.test.mjs` prints nothing — 23d9d53
- [x] 2.13 The Phase 2 precondition holds (backstop gate, see "Phase 2 gate"): `grep -q "^USAGE: present" context/changes/baseline-usage-comparison/real-run-evidence.md` — 23d9d53

### Phase 3: Markdown output, docs and real-pair evidence

#### Automated

- [x] 3.1 `--format md` prints the table, per-model line, drop, target, verdict, reasons and warnings; a valueless `--format` and `--format xml` halt with exit 1; nothing is written: `node --test --test-name-pattern="^3\.1 " skills/10x-pipeline/test/compare.test.mjs` — 0793234
- [x] 3.2 README has a "Baseline comparison:" heading between "Usage report:" and "Limits:": `grep -n "^Usage report:\|^Baseline comparison:\|^Limits:" README.md` lists the three in that order — 0793234
- [x] 3.3 AGENTS.md and the router name the command and the file: `grep -c "compare" AGENTS.md` is at least 3, `grep -n "compare.test.mjs" AGENTS.md` matches, `grep -n "baseline-policy.json" AGENTS.md` matches, `grep -c 'cmd === "compare"' skills/10x-pipeline/scripts/route.mjs` prints 1, `grep -c "compare <change-id> --baseline" skills/10x-pipeline/scripts/route.mjs` prints at least 1 — 0793234
- [x] 3.4 ADR-005 has at least 4 rule lines, each with exactly one bold keyword: `grep -c '\*\*GIVEN\*\*' docs/ADR/ADR-005-baseline-usage-comparison.md` is at least 4 and `grep '\*\*GIVEN\*\*' docs/ADR/ADR-005-baseline-usage-comparison.md | grep -vcE '\*\*(MUST|MUST NOT|SHOULD|SHOULD NOT|MAY)\*\*'` prints 0 — 0793234
- [x] 3.5 The router diff is additive outside the usage string: `git diff -U0 $(git merge-base main HEAD) -- skills/10x-pipeline/scripts/route.mjs | grep -c '^-[^-]'` prints at most 1 — 0793234
- [x] 3.6 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 0793234
- [x] 3.8 ADR-005 passes the ADR-004 rule form through the widened `rules.test.mjs` filter and exactly one ADR-005 file exists: `node --test --test-name-pattern="^ADR rule lines" skills/10x-pipeline/test/rules.test.mjs` (run as in "Convention for pattern rows") and `ls docs/ADR/ADR-005-* | wc -l` prints 1 — 0793234

#### Manual

- [ ] 3.7 Real baseline run: make one routed run and one baseline run of the same small change (baseline in a `git worktree` from the routed run's `meta.baseSha`, per the README block), run `compare <id> --baseline <worktree> --format md`, and paste the output in `real-run-evidence.md`; every executed entry of the baseline log is `sonnet`/`high`, `pinned` is true, and every executed step of both runs has a token figure
