# Baseline Usage Comparison Implementation Plan

## Overview

Roadmap S-06 (FR-009): let a user compare the total usage of a routed run with a baseline run of the same change, where the baseline is a full run with every step pinned to the `sonnet` alias at `high` effort. The baseline arm is data (a shipped policy file used as the per-project override in a second checkout). The comparison is a new read-only router command, `compare`, that reads two run folders and prints the observed token drop with completeness and outcome checks. No success threshold is invented: the target is a policy value that ships as `null`.

## Current State Analysis

- Per-step usage already lands in `run.jsonl` when the orchestrator passes `usage` (`cleanUsage`, `route.mjs:271-282`; stored by `attachResult`, `route.mjs:319-320`). `buildReport` sums it for one run (`route.mjs:202-240`). Nothing reads two runs. No test in `skills/10x-pipeline/test/` covers usage intake.
- Run state is one folder per change id under `ROOT = process.cwd()` (`route.mjs:20`, `paths` at `:145-159`). A second `init` on the same id resumes the first run (`main`, `:1228-1248`), and the plan and the code are read from disk. A baseline run therefore needs its own checkout.
- A 7-entry `sonnet/high` ladder in the override file makes every step run at `sonnet/high` (probed in the research on commit 54f1729). A ladder shorter than a step's `minTier` crashes `next` with `Cannot destructure property 'model'`. `rigor.minEffort` is `high` at `standard` and `thorough`, so the floor never leaves `sonnet/high` for a pinned ladder. At `standard` plan review is never skipped (`skipPlanReviewAt` is `["lean"]`, `policy.json:53`).
- `risk` is the precedent for a read-only command (`riskCommand`, `route.mjs:1158-1163`). `main` takes `<cmd> <change-id>` for every command (`:1192-1259`).
- Whether a real foreground Agent result reports usage is unconfirmed (`context/archive/2026-10-30-per-step-usage-report/real-run-evidence.md` was archived unfilled; roadmap Open Question 4).
- README and ADR-003 say `report.md` is "the only router artifact that survives the move" for `--archive`; the folder-move description suggests `run.jsonl` moves too. Unresolved (research gap G1).

## Desired End State

- `skills/10x-pipeline/baseline-policy.json` exists and pins all seven ladder tiers to `sonnet`/`high`.
- `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <dir> [--routed <dir>] [--format md]` prints, for one pair of runs: per-side totals and coverage, the baseline pin check, `comparable`, `reasons`, `warnings`, `dropPercent`, `targetDropPercent` and `verdict` (`target not set`, `met`, `not met`, `not comparable`). It writes nothing.
- `policy.json` has `compare.targetDropPercent: null`. The README documents how to make the baseline checkout and how to read the output.
- `compare.test.mjs` covers the cases in Testing Strategy and the full suite passes on Node 18.
- Manual evidence exists for one real pair and for the real shape of a foreground Agent result.

### Key Discoveries:

- Baseline needs no routing change: an override file is deep-merged and arrays are replaced whole (`route.mjs:38-56`), so the shipped file only has to carry `ladder` (research section 2).
- The pin is verifiable from the log: every executed entry records `model` and `effort` (`route.mjs:1088-1103`), skip entries carry `skipped: true` (`:171-175`). `compare` checks the log instead of trusting a flag.
- Log fields `tier`, `simple` and `rigor` are meaningless for a pinned run; `compare` ignores them.
- `entry(n, step, over)` and `skipEntry` in `test/helpers.mjs:16-197` already accept any field, so `usage` fixtures need no helper change; two scratch projects model two checkouts.
- `readPlan` (`route.mjs:64-88`) gives `phases` and `rows`, enough to show when the two plans differ in size.
- Anchors in the research drifted by a few lines after the archive-adapter merge. Re-anchor by function name, not by number, when implementing.

## What We're NOT Doing

- No `init --baseline` flag, no `meta.baseline`, no change to `init`, `decide`, `tierFor`, `next`, `buildReport`, `finishRun` or `attachResult`. These are shared with S-05 and S-07.
- No new prompt (so `rules.test.mjs` is unaffected) and no change to `SKILL.md`: `compare` is not part of the orchestrator loop.
- No success threshold value, no model weights, no significance test, no confidence interval, no pairs ledger or `aggregate` mode (owner questions O1 to O3).
- No `--out` flag. The command only prints; a user redirects stdout. This makes "writes nothing" unconditional and removes the archive-path refusal logic.
- No parsing of `report.md`. A folder without `run.jsonl` is a usage error.
- No recording of orchestrator-session tokens and no cost in money (O5).
- No git writes. The router does not create the worktree; the user does (AGENTS.md Hard Rules).
- No edit to `context/archive/`, `run.jsonl` or `meta.json` outside scratch-project fixtures in tests.
- No roadmap status flip in this commit, to avoid a textual conflict with the parallel plans for S-05 and S-07 on adjacent roadmap lines. The flip to `planning` is left for the merge.

## Implementation Approach

Option A from the research: the baseline arm is a shipped file; the comparison is one new command in its own block.

1. Phase 1 ships the data (policy key, baseline file) and the tests that guard it, plus the missing usage-intake tests the comparison depends on. No router code changes.
2. Phase 2 adds `compareCommand` to `route.mjs` with JSON output and its test cases.
3. Phase 3 adds Markdown output, the docs, and the manual evidence rows.

Edit discipline for the parallel changes: in `route.mjs` add one block after `riskCommand`, one dispatch branch placed last in the `else if` chain, one change to the usage string, one line in the header comment. In `policy.json` add the `compare` block between `archive` and `prompts`. In README add one block between "Usage report" and "Limits". In AGENTS.md add one Commands bullet, one entry in the test list, and `compare` in the `route.mjs` command list.

### Assumptions (decided without a human; each reversible)

| ID | Assumption | Evidence | Reversal cost |
| --- | --- | --- | --- |
| A1 | "Sonnet-5.5 at high effort" is the ladder alias `sonnet` at `high`. The repo does not record the resolved version. | `policy.json:4-6`, `SKILL.md:38`; Manual row 1.5 checks it once | Low: edit `baseline-policy.json` |
| A2 | The baseline is a second checkout from the routed run's `meta.baseSha`, same goal text, own copy of `change.md`. Not a second change id, not a second slot in one folder. | `route.mjs:20, 145-159, 1228-1248` | Medium: a future `init --baseline` would touch `init` |
| A3 | Totals are compared only when every executed entry of both sides has `usage.totalTokens` and both runs ended `done`. Otherwise partial sums and coverage print, `dropPercent` is `null`, `verdict` is `not comparable`. | Partial sums bias the drop in either direction; do not drop failures (external guidance in research section 6) | Low: relax one condition |
| A4 | Raw `totalTokens` is the primary unit; per-model raw sums are printed. No weights key, because no weights exist (YAGNI, O2). | No token-to-limit conversion in the repo; PRD says weekly limit but gives no mapping | Low: add `compare.modelWeights` later |
| A5 | Noise: the unit is one pair; per-pair observed drop only; no p-value or interval at n = 1; aggregation is left to the reader (O3). | ADR-001 "does not fit"; research section 6 | Low: add an aggregate mode later |
| A6 | `compare` writes nothing and has no `--out`. | AGENTS.md Hard Rules; ADR-003 archive-step bullet | Low |
| A7 | The baseline is every step the router picks at `--rigor standard`, all on `sonnet/high`, so optional steps that S-07 adds are included on both sides if they run (O6). `compare` sums every executed entry whatever its step name. | `policy.json:53-56`; `route.mjs:173` | Low |
| A8 | `met` means `dropPercent >= targetDropPercent` (inclusive). `targetDropPercent` is `null` or a finite number from 0 to 100; anything else halts. | The PRD gives no boundary; inclusive reads "drops by at least" | Low |
| A9 | `dropPercent = (baselineTotal - routedTotal) / baselineTotal * 100` over summed `totalTokens` of executed entries, rounded to 2 decimals for output, compared unrounded. Negative when the routed run cost more. Baseline total 0 gives `null`. | Research section 5 | Low |
| A10 | Pairing keys are `meta.goal` and `meta.baseSha`. A mismatch is a warning, not a refusal. | Research section 3 | Low |
| A11 | If `run.jsonl` is absent in an archived folder the command halts with a message. It does not fall back to `report.md`. Row 3.8 checks what really survives the move. | G1: README vs folder-move wording | Low |

### Owner questions still open (defaults above apply until answered)

- O1: success threshold and its unit. `compare.targetDropPercent` ships `null`; verdict reads `target not set`. This blocks a `met` verdict, not the command.
- O2: model weights. None shipped.
- O3: pairs needed before the saving is believed; descriptive aggregate wanted?
- O4: confirmed by Manual row 3.7.
- O5: orchestrator-session tokens are not recorded on either side; accepted as cancelling out.
- O6: whether the baseline includes S-07's optional steps (A7 says yes).
- O7: confirmed by Manual row 3.8.

## Phase 1: Baseline arm, policy key and guard tests

### Overview

Ship the data the rest depends on and the tests that keep it correct. No router code changes. Also close the usage-intake test gap.

### Changes Required:

#### 1. Baseline policy file

**File**: `skills/10x-pipeline/baseline-policy.json` (new)

**Intent**: A per-project override that pins every ladder tier to `sonnet`/`high`, so a run in a baseline checkout uses the same model and effort for every step.

**Contract**: One top-level key, `ladder`, with 7 entries `{ "model": "sonnet", "effort": "high" }`. The length must be at least `max(maxTier over policy.steps) + 1` and at least the length of the default ladder in `policy.json`. No other key: the baseline arm is selected with `--rigor standard`, not with policy.

#### 2. Compare policy block

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Hold the owner's success target as data.

**Contract**: New top-level block placed after `archive` and before `prompts`, keys on separate lines: `"compare": { "targetDropPercent": null }`. Policy keys are camelCase.

#### 3. New test file, baseline and intake tests

**File**: `skills/10x-pipeline/test/compare.test.mjs` (new)

**Intent**: Guard the shipped baseline file against a stale ladder length and prove the usage intake the comparison relies on.

**Contract**: Uses `makeProject`, `init`, `next`, `writeResult`, `readLogEntries` from `helpers.mjs`; `cleanupAll` in an `after` hook as the other suites do. Cases: (a) the file has only `ladder`, every entry is `sonnet`/`high`, length is at least the bound above; (b) a scratch project with the file written as `context/foundation/agent-smith-policy.json`, `init <id> --goal "<text>" --rigor standard` returns a first step with model `sonnet` and effort `high`; (c) intake: a result with `usage: { totalTokens: 1000, toolUses: 3, durationMs: 500 }` is stored on the log entry; negative, fractional and non-numeric fields are dropped; a result without `usage` leaves no `usage` key. Node 18 only (AGENTS.md ban list).

### Success Criteria:

#### Automated Verification:

- Baseline file guard passes (only `ladder`, 7 x `sonnet`/`high`, length bound): `node --test skills/10x-pipeline/test/compare.test.mjs`
- A scratch `init --rigor standard` with the baseline file as override returns a first step at `sonnet`/`high`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- Usage intake tests pass (valid figures kept, invalid dropped, absent key stays absent): `node --test skills/10x-pipeline/test/compare.test.mjs`
- `policy.json` and `baseline-policy.json` parse and `compare.targetDropPercent` is `null`; the full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- In a running Claude Code session the `sonnet` alias resolves to Sonnet-5.5 (assumption A1); note the resolved model name in the evidence note

**Implementation Note**: After this phase and its automated checks pass, pause for the manual confirmation before Phase 2.

---

## Phase 2: `compare` command (JSON)

### Overview

Add the read-only `compare` command with JSON output and the cases that cover its rules.

### Changes Required:

#### 1. Compare block in the router

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Read two run folders and report the usage comparison, without touching any routing function.

**Contract**: New function `compareCommand(id, flags, policy)` plus small local helpers, placed after `riskCommand`. Reuses `readLog`, `readMeta`, `executed`, `readPlan`, `halt`, `out`. Does not change `paths`, `archiveDirs`, `readLog` or any shared function; it builds its own paths for a root other than `ROOT`.

- Inputs: `--baseline <dir>` is required (a missing or valueless flag halts with a usage message). `--routed <dir>` defaults to `ROOT`. Each `<dir>` is a project root or a folder that directly contains `run.jsonl`.
- Lookup per side, in order: the folder itself if it contains `run.jsonl` (`source: "folder"`); `<dir>/context/changes/<id>/agent-smith/` (`"changes"`); `<dir>/context/archive/<YYYY-MM-DD>-<id>/agent-smith/` using the same anchored name rule as `archiveDirs` (`"archive"`). More than one archive folder match is a halt that lists them; none, or a folder with no `run.jsonl`, is a halt naming the paths tried. Exit code 1 for halts, 0 for any computed answer including `not comparable`.
- Per-side object: `source`, `dir`, `goal`, `baseSha`, `rigor` (`meta.rigor.level` or `null`), `outcome` (`meta.outcome.action` or `null`), `steps` (executed entries), `skipped`, `failedAttempts` (executed entries with `ok === false`), `plan` (`{ phases, rows }` from `readPlan` on the sibling `plan.md`, or `null`), `tokens` (`{ total, stepsWithFigures, byModel }`, sums over entries that carry `usage.totalTokens`), `toolUses`, `durationMs` (sums over entries that carry them). Unparseable log lines are dropped by `readLog`; a bad `meta.json` falls back through `readMeta`.
- Pair object: `baseline`, `routed`, `pinned` (baseline has at least one executed entry, every executed entry is `sonnet`/`high`, and no skip entry), `comparable`, `reasons` (codes), `warnings` (codes), `dropPercent`, `targetDropPercent`, `verdict`.
- `reasons` codes: `baseline-not-pinned`, `no-steps:<side>`, `outcome-not-done:<side>`, `usage-incomplete:<side>`, `baseline-total-zero`. `warnings` codes: `goal-mismatch`, `baseSha-mismatch`. `<side>` is `baseline` or `routed`. `usage-incomplete` means at least one executed entry lacks `usage.totalTokens`.
- `comparable` is true only when `reasons` is empty. When true, `dropPercent` follows A9; otherwise `null`. Verdict: `not comparable` when `reasons` is not empty; else `target not set` when the target is `null`; else `met` when `dropPercent >= target`, else `not met`.
- `targetDropPercent` comes from `policy.compare?.targetDropPercent` (project override applies). Not `null` and not a finite number in [0, 100]: halt before output.

#### 2. Dispatch, usage string, header comment

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Make the command reachable with the smallest possible textual footprint.

**Contract**: One `else if (cmd === "compare")` branch as the last branch before the final `else`. The `Usage:` string in `main` gains `compare <change-id> --baseline <dir> [--routed <dir>] [--format md]` appended; the header comment block gains one `compare` line next to `risk`. Both are one-line edits.

#### 3. Compare cases

**File**: `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: Cover the rules in the contract with two scratch projects per case (one per checkout).

**Contract**: Fixtures with `entry(n, step, { usage: { totalTokens } })`, `skipEntry`, `writeLog`, `writeMetaFile` (`goal`, `baseSha`, `rigor: { level }`, `outcome: { action }`), `run(project, ["compare", id, "--baseline", other.root])`. See Testing Strategy for the case list.

### Success Criteria:

#### Automated Verification:

- A complete done pair gives the expected `dropPercent` (for example baseline 1000, routed 600 gives 40) and, with the default policy, verdict `target not set`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- With `compare.targetDropPercent` set in the routed project's override file, a drop equal to the target gives `met`, a drop just below gives `not met`, a routed total above the baseline gives a negative `dropPercent` and `not met`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- A missing `usage.totalTokens` on any executed entry of either side gives `comparable: false`, `dropPercent: null`, `usage-incomplete:<side>` and the partial `total` with `stepsWithFigures` below `steps`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- A baseline entry on `haiku` or at `medium`, or a skip entry in the baseline log, gives `pinned: false`, `baseline-not-pinned` and verdict `not comparable`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- A side whose `meta.outcome.action` is `halt` or absent gives `outcome-not-done:<side>` with the outcome listed on that side: `node --test skills/10x-pipeline/test/compare.test.mjs`
- A different `meta.goal` or `meta.baseSha` gives `goal-mismatch` or `baseSha-mismatch` in `warnings` and keeps the computed numbers: `node --test skills/10x-pipeline/test/compare.test.mjs`
- Baseline total 0, an empty log and a `run.jsonl` with unparseable lines do not throw and give `dropPercent: null`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- The routed side found under `context/archive/<date>-<id>/agent-smith/`, a `<dir>` that is the `agent-smith` folder itself, two archive folders for one id, and a missing `run.jsonl` each behave as specified (found, found, halt exit 1 listing both, halt exit 1): `node --test skills/10x-pipeline/test/compare.test.mjs`
- `compare` writes nothing (recursive listing of both scratch trees with sizes and mtimes is identical before and after); a missing `--baseline` and an invalid `targetDropPercent` (for example `-5`, `"x"`, `150`) halt with exit 1: `node --test skills/10x-pipeline/test/compare.test.mjs`
- The full suite passes and the new code uses no Node 18 banned API: `node --test skills/10x-pipeline/test/*.test.mjs` and `grep -nE "toSorted|groupBy|import\.meta\.dirname|partialDeepStrictEqual|mock\.timers" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/compare.test.mjs` prints nothing

**Implementation Note**: Pause after this phase's automated checks pass before starting Phase 3.

---

## Phase 3: Markdown output, docs and real-run evidence

### Overview

Add `--format md`, document the procedure, and collect the manual evidence the hermetic suite cannot give.

### Changes Required:

#### 1. Markdown format

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A human-readable and paste-ready form of the same pair object.

**Contract**: `--format md` prints Markdown to stdout instead of JSON; `--format json` or no flag prints JSON; any other value halts with JSON. The Markdown has a heading with the change id, one table with a row per side (outcome, steps, skipped, failed attempts, tokens `total (stepsWithFigures of steps)`, tool uses, duration, plan phases and rows), a per-model token line for each side, then `Drop`, `Target`, `Verdict`, `Reasons` and `Warnings` lines (`none` when empty). Built from the same object as the JSON, so the two cannot disagree. Still writes nothing.

#### 2. Evidence note template

**File**: `context/changes/baseline-usage-comparison/real-run-evidence.md` (new)

**Intent**: A place to paste the output of the manual rows, with labelled sections for rows 3.6, 3.7 and 3.8 and the A1 check from row 1.5.

**Contract**: Four headings, each with a one-line "paste here" instruction. Not parsed by anything.

#### 3. README block

**File**: `README.md`

**Intent**: Tell a user how to produce a baseline and read the comparison.

**Contract**: New "Baseline comparison" block between "Usage report" and "Limits". Content: (1) the baseline is a second checkout, because run state is per checkout and a second `init` resumes the first run; (2) steps: read `meta.baseSha` of the routed run, `git worktree add <path> <baseSha>`, copy only `change.md` of the change into it, copy `skills/10x-pipeline/baseline-policy.json` to `context/foundation/agent-smith-policy.json` (merge by hand if the project already has an override: arrays are replaced whole), run `/agent-smith:10x-pipeline <id> <same goal>` and name rigor `standard`; (3) the command and its output fields, verdict values, `--format md`; (4) `target not set` until the owner fills `compare.targetDropPercent`; (5) raw tokens, orchestrator tokens not counted, retries counted; (6) noise advice: one pair is an anecdote, compare per-pair drops across several changes, run the two sides close in time and alternate which runs first, a halted or incomplete side makes the pair not comparable instead of being dropped; (7) the archived-folder lookup. Keep the "Usage report" block untouched.

#### 4. AGENTS.md lists

**File**: `AGENTS.md`

**Intent**: Keep the command and test lists current.

**Contract**: One Commands bullet for `compare` (read-only, writes nothing); `compare` added to the `route.mjs` command list in Project Structure; `compare.test.mjs` added to the test list.

#### 5. Markdown test

**File**: `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: Cover `--format`.

**Contract**: `--format md` output contains the table header, the verdict text, each reason code and warning code of a mixed fixture, and `Verdict: target not set` for the default policy; `--format xml` halts with exit 1; tree listings unchanged.

### Success Criteria:

#### Automated Verification:

- `--format md` prints the table, per-model line, drop, target, verdict, reasons and warnings; `--format xml` halts with exit 1; nothing is written: `node --test skills/10x-pipeline/test/compare.test.mjs`
- README has a "Baseline comparison" heading between "Usage report" and "Limits": `grep -n "^Usage report:\|^Baseline comparison\|^Limits:" README.md` lists the three in that order
- AGENTS.md and the router name the command: `grep -c "compare" AGENTS.md` is at least 3, `grep -c "compare" skills/10x-pipeline/scripts/route.mjs` is at least 3, and `grep -n "compare.test.mjs" AGENTS.md` matches
- The router diff is additive outside the usage string: `git diff -U0 main -- skills/10x-pipeline/scripts/route.mjs | grep -c '^-[^-]'` prints at most 1
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- Real baseline run: make one routed run and one baseline run of the same small change (baseline in a `git worktree` from the routed run's `meta.baseSha`, per the README block), run `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <worktree> --format md`, and paste the output in `real-run-evidence.md`; every entry of the baseline log is `sonnet`/`high` and `pinned` is true
- A real foreground Agent result reports usage: after the routed run, `status <id>` shows `usage` with `totalTokens`, `toolUses` and `durationMs` on at least one step; paste the line in `real-run-evidence.md`. If no step carries usage, record that and stop calling the comparison usable until the orchestrator passes it
- Archived `run.jsonl`: run one routed pipeline with `--archive` in a scratch project and check that `context/archive/<date>-<id>/agent-smith/run.jsonl` exists and that `compare` reads it; record the answer in `real-run-evidence.md` (resolves research gap G1 and open question O7)

**Implementation Note**: The manual rows need real runs and cost real tokens. Run them once, after the automated rows pass.

---

## Testing Strategy

### Unit Tests:

- Baseline file guard: only `ladder`, 7 x `sonnet`/`high`, length at least the highest step `maxTier` + 1 and at least the default ladder length.
- Usage intake through the CLI: valid kept, negative, fractional and string values dropped, absent key stays absent.
- `compare` rules: complete pair; boundary of `met` (drop equal to target, drop just below, negative drop); incomplete usage on each side; unpinned baseline (`haiku`, `medium`, skip entry); halted and unfinished sides; goal and `baseSha` mismatch; zero total; empty log; garbage lines; archived routed side; folder form; ambiguous archive; missing `run.jsonl`; missing `--baseline`; invalid target; read-only listing check; `--format md` and invalid format.

### Integration Tests:

- Phase 1 case (b): a scratch `init --rigor standard` with the shipped override returns `sonnet`/`high`. This is the only router-driving case; the rest read fixtures.

### Manual Testing Steps:

1. Follow the README block to make a baseline worktree and run both sides of one small change.
2. Run `compare` with `--format md` and read the verdict, reasons and coverage.
3. Confirm a step in the routed run carries `usage`.
4. Run one `--archive` routed pipeline and confirm `run.jsonl` is in the archive folder.

## Performance Considerations

None. The command reads two small files and an optional plan; it is not on a hot path.

## Migration Notes

None. No stored format changes. Runs made before this change compare fine if they carry `usage`; those without it are `not comparable` with `usage-incomplete`.

## References

- Related research: `context/changes/baseline-usage-comparison/research.md`
- Read-only command precedent: `skills/10x-pipeline/scripts/route.mjs` (`riskCommand`)
- Usage intake: `skills/10x-pipeline/scripts/route.mjs` (`cleanUsage`, `attachResult`)
- Test helpers: `skills/10x-pipeline/test/helpers.mjs`
- PRD: `context/foundation/prd.md:49, 58, 108, 144`; roadmap S-06: `context/foundation/roadmap.md:147-159`
- ADR-001 (noise), ADR-003 (archive adapter), ADR-004 (prompt rule form; no prompt is added here)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baseline arm, policy key and guard tests

#### Automated

- [ ] 1.1 Baseline file guard passes (only `ladder`, 7 x `sonnet`/`high`, length bound): `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 1.2 A scratch `init --rigor standard` with the baseline file as override returns a first step at `sonnet`/`high`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 1.3 Usage intake tests pass (valid figures kept, invalid dropped, absent key stays absent): `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 1.4 `policy.json` and `baseline-policy.json` parse and `compare.targetDropPercent` is `null`; the full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 1.5 In a running Claude Code session the `sonnet` alias resolves to Sonnet-5.5 (assumption A1); note the resolved model name in the evidence note

### Phase 2: `compare` command (JSON)

#### Automated

- [ ] 2.1 A complete done pair gives the expected `dropPercent` (for example baseline 1000, routed 600 gives 40) and, with the default policy, verdict `target not set`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.2 With `compare.targetDropPercent` set in the routed project's override file, a drop equal to the target gives `met`, a drop just below gives `not met`, a routed total above the baseline gives a negative `dropPercent` and `not met`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.3 A missing `usage.totalTokens` on any executed entry of either side gives `comparable: false`, `dropPercent: null`, `usage-incomplete:<side>` and the partial `total` with `stepsWithFigures` below `steps`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.4 A baseline entry on `haiku` or at `medium`, or a skip entry in the baseline log, gives `pinned: false`, `baseline-not-pinned` and verdict `not comparable`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.5 A side whose `meta.outcome.action` is `halt` or absent gives `outcome-not-done:<side>` with the outcome listed on that side: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.6 A different `meta.goal` or `meta.baseSha` gives `goal-mismatch` or `baseSha-mismatch` in `warnings` and keeps the computed numbers: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.7 Baseline total 0, an empty log and a `run.jsonl` with unparseable lines do not throw and give `dropPercent: null`: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.8 The routed side found under `context/archive/<date>-<id>/agent-smith/`, a `<dir>` that is the `agent-smith` folder itself, two archive folders for one id, and a missing `run.jsonl` each behave as specified (found, found, halt exit 1 listing both, halt exit 1): `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.9 `compare` writes nothing (recursive listing of both scratch trees with sizes and mtimes is identical before and after); a missing `--baseline` and an invalid `targetDropPercent` (for example `-5`, `"x"`, `150`) halt with exit 1: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 2.10 The full suite passes and the new code uses no Node 18 banned API: `node --test skills/10x-pipeline/test/*.test.mjs` and `grep -nE "toSorted|groupBy|import\.meta\.dirname|partialDeepStrictEqual|mock\.timers" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/compare.test.mjs` prints nothing

### Phase 3: Markdown output, docs and real-run evidence

#### Automated

- [ ] 3.1 `--format md` prints the table, per-model line, drop, target, verdict, reasons and warnings; `--format xml` halts with exit 1; nothing is written: `node --test skills/10x-pipeline/test/compare.test.mjs`
- [ ] 3.2 README has a "Baseline comparison" heading between "Usage report" and "Limits": `grep -n "^Usage report:\|^Baseline comparison\|^Limits:" README.md` lists the three in that order
- [ ] 3.3 AGENTS.md and the router name the command: `grep -c "compare" AGENTS.md` is at least 3, `grep -c "compare" skills/10x-pipeline/scripts/route.mjs` is at least 3, and `grep -n "compare.test.mjs" AGENTS.md` matches
- [ ] 3.4 The router diff is additive outside the usage string: `git diff -U0 main -- skills/10x-pipeline/scripts/route.mjs | grep -c '^-[^-]'` prints at most 1
- [ ] 3.5 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 3.6 Real baseline run: make one routed run and one baseline run of the same small change (baseline in a `git worktree` from the routed run's `meta.baseSha`, per the README block), run `compare <id> --baseline <worktree> --format md`, and paste the output in `real-run-evidence.md`; every entry of the baseline log is `sonnet`/`high` and `pinned` is true
- [ ] 3.7 A real foreground Agent result reports usage: after the routed run, `status <id>` shows `usage` with `totalTokens`, `toolUses` and `durationMs` on at least one step; paste the line in `real-run-evidence.md`. If no step carries usage, record that and stop calling the comparison usable until the orchestrator passes it
- [ ] 3.8 Archived `run.jsonl`: run one routed pipeline with `--archive` in a scratch project and check that `context/archive/<date>-<id>/agent-smith/run.jsonl` exists and that `compare` reads it; record the answer in `real-run-evidence.md` (research gap G1, open question O7)
