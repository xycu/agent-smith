---
date: 2026-10-31T01:15:00+01:00
researcher: Claude Sonnet 5.5 (autonomous subagent, no human answers)
git_commit: 54f172914faa1f9828700f6b379262b803bb7589
branch: baseline-usage-comparison-research
repository: agent-smith
topic: "S-06 baseline-usage-comparison (FR-009): how to compare the total usage of a routed run with a baseline run of the same change"
tags: [research, codebase, route.mjs, policy.json, run.jsonl, report.md, baseline, usage]
status: complete
last_updated: 2026-10-31
last_updated_by: Claude Sonnet 5.5
---

# Research: baseline usage comparison (roadmap S-06, FR-009)

**Date**: 2026-10-31T01:15:00+01:00
**Researcher**: Claude Sonnet 5.5 (autonomous run, no AskUserQuestion)
**Git Commit**: 54f172914faa1f9828700f6b379262b803bb7589
**Branch**: baseline-usage-comparison-research
**Repository**: agent-smith

## Research Question

Roadmap S-06: "user can compare the total usage of a routed run against a baseline run of the same change (a full run on Sonnet-5.5 at high effort)" (`context/foundation/roadmap.md:149`). Seed unknowns: what usage drop counts as success (PRD Open Question 1) and how two runs of one change are made comparable (`roadmap.md:156-157`). Questions for the plan: how a baseline run is requested and recorded; where run state lives and how two runs of one change stay apart; which usage figures exist and which are optional or missing; what the comparison output looks like and where it is written; how noise is handled with only dozens of runs; what a hermetic test can cover; which exact lines the change touches, so parallel changes S-05 (`pr-comment-report`) and S-07 (`pre-plan-steps`) can merge cleanly.

## Summary

- **No success threshold exists.** The PRD says only "drops significantly ... `# TODO: target percentage`" (`prd.md:49`) and Open Question 1 is owner-routed (`prd.md:144`). The plan must add it as a policy value the owner fills (`compare.targetDropPercent`, default `null`), not as a number. Until set, the comparison prints the observed drop and the verdict `target not set`.
- **Run state is one folder per change id, so two runs of one change cannot share a working tree.** `paths(id)` derives `context/changes/<id>/agent-smith/` from `process.cwd()` (`route.mjs:20`, `route.mjs:145-159`), and a second `init` on the same id resumes the first run (`route.mjs:1200-1250`; README "Re-running `init` ... resumes"; SKILL.md:30). The baseline must therefore live in a second checkout of the repository started from the routed run's `meta.baseSha`, with its own copy of the change folder. The baseline also needs that separate checkout for a second reason: `implement` and `plan` read the artifacts and code on disk (`route.mjs:296-328`, `route.mjs:618-640`), so a baseline run in the routed run's tree would find the plan and the finished code already there.
- **A baseline needs no new router logic to run.** Probed in a scratch project on this commit: an override file with a 7-entry ladder of `sonnet/high` and `init --rigor standard` yields `sonnet/high` for `plan` and `plan-review`; a 1-entry ladder crashes the router with `Cannot destructure property 'model' of 'policy.ladder[tier]'`. The baseline pin can be verified afterwards from `run.jsonl` itself, because every executed entry records `model` and `effort` (`route.mjs:1088-1103`).
- **Usage figures are optional and thin.** Per executed step the router can store `usage.{totalTokens, toolUses, durationMs}` (`route.mjs:271-282`, `319-320`). No split into input, output or cache tokens, no cost, no model-weighting, no figure for the archive step, none for the orchestrator's own session. Whether a real foreground Agent result carries these figures is unconfirmed: the evidence note was archived unfilled (`context/archive/2026-10-30-per-step-usage-report/real-run-evidence.md:7-17`; `roadmap.md:235`). No test in `skills/10x-pipeline/test/` mentions `usage` or `totalTokens` (grep of the 5 files in that folder, 0 hits).
- **Recommended shape (smallest edit surface):** a new read-only command `route.mjs compare <change-id> --baseline <path>` that reads two run folders and prints JSON (and Markdown with `--format md`). It touches no `decide`, `tierFor`, `next` or `buildReport` code. One new policy block `compare` (threshold `null`, completeness rule), one new test file, README and AGENTS.md bullets. See "Touch points".
- **Noise:** with dozens of runs a single pair is anecdote. Report the observed drop per pair with completeness and outcome flags, never a significance claim; aggregate across pairs by the median and the range (descriptive only) once the owner sets a minimum number of pairs.

## Detailed Findings

### 1. What S-06 and the PRD ask for

- S-06 outcome, prerequisites S-01 and S-02 (both done), no blockers, two unknowns, status `proposed` (`roadmap.md:147-159`). Its risk line: "With at most dozens of runs the comparison is noisy and may not show a real saving" (`roadmap.md:158`).
- FR-009 asks the pipeline to "record usage per step (model, effort, and token or cost figures where available) in run state, so runs can be compared against a full run on Sonnet-5.5 at high effort" (`prd.md:108`). Recording per step is already done by S-02; what remains is the comparison.
- Primary success criterion: weekly limit consumption "drops significantly, measured by A/B test against a full run on Sonnet-5.5 at high effort" with the target percentage open (`prd.md:49`). Guardrail: the router's own run "counts toward the A/B usage comparison" (`prd.md:58`). The router is a plain script with no LLM today (`prd.md:149`), so its own tokens are zero; the orchestrator session's tokens (the main thread that runs SKILL.md) are not recorded anywhere (see section 4).
- ADR-001 Phase 1 step 1: "Record usage per step in the run state and compare full runs against a baseline" (`docs/ADR/ADR-001-phased-complexity-routing.md`, "Decision / Phase 1 / 1"), and judge quality by "cost per successfully completed change, not by token price alone" (same file, "What holds up"). It warns that "with at most dozens of runs the A/B signal is noisy and the thresholds cannot be calibrated" (same file, "What does not fit").
- ADR-003 names S-06 as the place where the uncalibrated churn numbers can be tuned (`docs/ADR/ADR-003-rigor-gated-routing.md:140`). A comparison that shows which steps cost what is therefore also an input for `risk.churn` tuning; this research does not change those values.

### 2. How a baseline run is requested and recorded

Observed, this inspected path only (commit 54f1729):

- `policy.json` has a 7-entry `ladder` (`policy.json:2-10`) and per-step `baseTier`/`minTier`/`maxTier` (`policy.json:11-18`). The model is chosen by `policy.ladder[tier]` at `route.mjs:1084`; the archive precheck reads the same array at `route.mjs:929-932`.
- A per-project override file is deep-merged over the defaults; arrays are replaced whole (`route.mjs:38-56`; SKILL.md "Tuning").
- `tierFor` clamps the tier into `[minTier, maxTier, ladder.length-1]` (`route.mjs:789`). With a ladder shorter than a step's `minTier`, `policy.ladder[tier]` is `undefined` and `next` ends with `Router error: Cannot destructure property 'model' ...` (probe, scratch project, 1-entry ladder). The archive step is pinned to tier 3 (`policy.json:17`), and a ladder without that index halts the archive precheck by design (`route.mjs:929-932`; `test/archive.test.mjs:947-952`).
- Rigor: `init --rigor <level>` stores `meta.rigor.requested` and replaces the goal class as the start level (`route.mjs:391-395`, `1200-1230`). Plan review is skipped only at a level listed in `rigor.skipPlanReviewAt` (`policy.json:53`; `route.mjs:653`), which is `lean` only by default. `standard` therefore never skips plan review and has `budgetDelta` 0 (`policy.json:54`).
- Probe result (scratch project in `$TMPDIR`, default policy plus override `{"ladder": [7 x {"model":"sonnet","effort":"high"}]}`, goal "fix typo"): plan ran as `sonnet/high`, plan-review as `sonnet/high`; the log entry still records `tier`, `simple: true` and `rigor: lean` from the unmodified rules. Those fields are meaningless for a pinned run and the comparison must ignore them. Probe script: scratchpad `probe.mjs` (not committed, scratch only).

Two ways to request the baseline:

| Option | What the user does | Router change | Verification of "this was a baseline" |
| --- | --- | --- | --- |
| A (recommended) | Copy a shipped file (for example `skills/10x-pipeline/baseline-policy.json`: 7 x `sonnet/high`) to `context/foundation/agent-smith-policy.json` in the baseline checkout and run `/agent-smith:10x-pipeline <id> <goal>` with `--rigor standard` (SKILL.md:30 already allows `--rigor` when the user names a level) | none | `compare` checks every executed entry of the baseline log has `model` `sonnet` and `effort` `high` and no skipped step (`run.jsonl` schema, `route.mjs:1088-1103`; skip entries carry `skipped: true`, `route.mjs:173-175`) |
| B | `init <id> --baseline` stores `meta.baseline: true`; `loadPolicy` overlays a `policy.baseline` block | `main` init flags (`route.mjs:1200-1250`), `loadPolicy` (`route.mjs:51-56`, which has no id today), a clamp so a short ladder cannot crash, plus SKILL.md/README text | `meta.baseline` |

Option A edits no routing code (AGENTS.md: routing decisions live in `route.mjs` and `policy.json`; a per-project override belongs in the override file, not `route.mjs`). Option B touches the init flag parser that S-05 and S-07 may also touch. A hermetic test can assert that the shipped file really pins every step (see section 7), which guards against a stale ladder length.

Sonnet-5.5 note: the ladder stores the alias `sonnet` (`policy.json:4-6`), and SKILL.md passes `model: <model>` to the Agent tool (SKILL.md:38). The repo does not record which Sonnet version an alias resolved to. Treat "baseline = alias `sonnet` at `high`" as "Sonnet-5.5 at high" (assumption A1).

### 3. Where run state lives; keeping two runs of one change apart

- Run state per change: `context/changes/<id>/agent-smith/{meta.json, run.jsonl, last-result.json, report.md}` (`route.mjs:145-159`). The folder is derived from `process.cwd()` (`route.mjs:20`). `meta.json` holds `id`, `goal`, `rigor`, `baseSha`, optional `archive`, `outcome` (`route.mjs:250-256`, `1230-1248`).
- A second `init` for the same id resumes (`meta` is merged from the old one, `route.mjs:1228-1248`), so a "second run" in the same tree would continue the first. Starting fresh in the same tree would require deleting `run.jsonl`, which AGENTS.md forbids (Hard Rules).
- After `done` with `--archive`, the whole change folder is committed and moved to `context/archive/<created>-<id>/` (`docs/ADR/ADR-003-rigor-gated-routing.md` "Archive adapter"; README "Archive (opt-in)"; `route.mjs:110-116` `archiveDirs`). The `agent-smith/` folder is part of that move (the archive-adapter research states the report path becomes `context/archive/<created>-<id>/agent-smith/report.md`: `context/archive/2026-10-30-archive-adapter/research.md:87`). Whether `run.jsonl` itself survives in the archived copy is an inference from "the folder moves" and "the commit holds every non-ignored file" (README archive bullets); the ADR sentence "`report.md` ... is the only router artifact that survives the move" (ADR-003, "Archive adapter") reads the other way for `run.jsonl`. This conflict is unresolved; `compare` should accept a folder that has `run.jsonl` and fall back to reading `report.md` only if the plan decides to parse it (not recommended: the table is lossy, no `skipped`, no `usage` object). Gap G1.
- Why not a second change id such as `<id>-baseline` in the same tree: `/10x-new` creates a distinct change with its own plan, and `implement` would run against code the routed run already changed. A second change folder also contradicts "same change". It would only be valid if the routed run was never merged and the tree were reset, which is exactly what a second checkout provides.
- Recommended layout: `git worktree add <path> <meta.baseSha>` (a human or the orchestrator runs it; the router must not, because its only git writes are the archive commit's `add`, `commit`, `reset`: AGENTS.md Hard Rules). Copy `change.md` (and nothing else from `context/changes/<id>/`) and the baseline override file into the worktree, then run the pipeline there with the same goal text. `meta.baseSha` is set once at `init` and kept (`route.mjs:1240-1246`), so churn risk is counted from the same history for both sides (ADR-003:44).
- Pairing key for `compare`: `meta.goal` equal (exact string) and `meta.baseSha` equal. Either mismatch is a warning, not a refusal; the output states both values.

### 4. Which usage figures exist, which are optional or missing

Observed:

- Intake: the orchestrator adds `usage` to the RESULT JSON when the Agent result reports it (SKILL.md:40). `cleanUsage` keeps `totalTokens`, `toolUses`, `durationMs` that are non-negative safe integers, drops the rest, returns `null` if none survive (`route.mjs:271-282`). `attachResult` stores the result on the last executed entry and sets `entry.usage` only when something survived (`route.mjs:319-320`).
- Output today: `status` prints `usage` per step (`route.mjs:1174`); `buildReport` sums `totalTokens` over entries that have one and prints "Steps: N · Tokens: X (figures for K of N steps)" (`route.mjs:202-240`).
- Missing by construction: the archive step logs nothing (`docs/ADR/ADR-003-rigor-gated-routing.md` "Archive adapter", bullet on the archive step; README line 60); the orchestrator's own session tokens; input/output/cache split (plan-brief of `per-step-usage-report`, "Key Decisions": "The Agent result gives one total, no input/output split"); money cost ("Cost figures are not available", `roadmap.md:107`); a skipped step has no entry with usage (`route.mjs:173-175`).
- Unconfirmed: a real foreground Agent result with usage. `real-run-evidence.md` still contains the placeholders "(paste the line here)" (`context/archive/2026-10-30-per-step-usage-report/real-run-evidence.md:7-17`) and roadmap Open Question 4 says "Not yet confirmed" (`roadmap.md:235`). Without real figures the comparison has nothing to compare, but hermetic tests do not need them.
- Unit mismatch: the success criterion is weekly limit consumption (`prd.md:49`); the data is raw `totalTokens` summed across models. Whether one token on `haiku` or `opus` counts the same against the weekly limit is not stated in the repo. The comparison should show raw tokens per run and per model, and the policy should carry an optional per-model weight map the owner fills (`compare.modelWeights`, default `null` meaning raw tokens). No weights are proposed here (assumption A4).
- Correctness caveat for totals: retried steps are separate entries, so totals include failed attempts (plan-brief of `per-step-usage-report`, "Open Risks"). That is desirable for cost, and the comparison should also show `ok === false` counts.

### 5. What the comparison output looks like and where it is written

Proposed (decision for `/10x-plan`; no repo source fixes it):

- Command: `node skills/10x-pipeline/scripts/route.mjs compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--out <file>]`. Read-only by default, like `risk` (`route.mjs:1158-1163`, which "writes nothing"). `<dir>` is a project root (the command looks under `context/changes/<id>/agent-smith/`, then `context/archive/*-<id>/agent-smith/` using `archiveDirs`) or a folder that contains `run.jsonl`. `--routed` defaults to the current project root.
- JSON fields: per side `{ steps, skipped, outcome, rigor, goal, baseSha, tokens: { total, stepsWithFigures, stepsTotal, byModel }, toolUses, durationMs, failedAttempts }`; plus `pinned` (baseline entries all `sonnet/high`, no skips), `comparable` (boolean) with `reasons[]`, `dropPercent` (null unless both sides are complete), `targetDropPercent`, `verdict`.
- `verdict` values: `target not set` (policy value `null`), `met`, `not met`, `not comparable` (reason listed). `dropPercent = (baseline - routed) / baseline * 100` over summed `totalTokens` of executed entries; if the baseline total is `0` or missing, `dropPercent` is `null`.
- Completeness rule (assumption A3): a total is "complete" only when every executed entry on that side has `usage.totalTokens`. If either side is incomplete, the command still prints the partial sums and coverage ("K of N steps", the form `buildReport` already uses at `route.mjs:233`) but sets `dropPercent` to `null` and `comparable` to `false`. Rationale: a missing figure on the baseline side inflates the drop; on the routed side it deflates it.
- Outcome rule: both runs must have ended `done` (`meta.outcome.action`, written at `route.mjs:250-256`) to be `comparable`. Dropping a halted baseline or routed run would bias the result toward the survivors (external guidance, see "Noise"); the output instead lists the outcome of each side.
- Where written: stdout by default. `--out <file>` writes the Markdown/JSON to a path the user names; the command refuses a path under `context/archive/` (read-only by convention: AGENTS.md Hard Rules) and a path that equals `run.jsonl` or `meta.json`. It does not write `report.md`. Reason: the comparison usually runs after the routed run was archived, when "nothing may be written under the change folder" (ADR-003, archive step bullet). A convenience default of `context/changes/<id>/agent-smith/comparison.md` would be valid only for an unarchived change and is left to the plan as an option.
- S-05 interplay: S-05 posts `report.md` to a pull request (`roadmap.md:134-145`). `compare --format md` output can be pasted or posted by the same mechanism later; S-06 does not depend on S-05 (it lists S-01 and S-02 as prerequisites only).

### 6. Noise with only dozens of runs

- Repo evidence: ADR-001 says the A/B signal is noisy with "at most dozens of runs" and thresholds cannot be calibrated; the PRD sizes the user base at dozens to a hundred users once shipped but today "nobody" uses it (`prd.md:22`, `prd.md:28`).
- External guidance (practitioner posts, not peer reviewed; web search 2026-10-31): repeat each configuration instead of trusting a single score; compare paired per-task deltas, which cancel task-difficulty variance; report a paired interval or the raw deltas rather than overlapping marginal intervals; do not drop one side's failures; show cost as its own metric, not folded into quality; compute the minimum detectable effect before trusting a comparison; bootstrap intervals on very small samples are unstable. Sources: [Noise Floor Audit for Agent Benchmarks](https://arxiv.org/pdf/2608.22331), [Why LLM Eval Scores Change: Measure Variance Before Setting Thresholds](https://oneuptime.com/blog/post/2026-08-31-measure-llm-eval-variance-thresholds/markdown), [our ai benchmark couldnt detect a 7 point regression](https://www.basedash.com/blog/our-ai-benchmark-couldnt-detect-a-7-point-regression), [Why your LLM agent gives a different p-value every time](https://dev.to/cheng-peng0718/why-your-llm-agent-gives-a-different-p-value-every-time-and-what-to-build-instead-5dc6). The search returned no source specific to token-cost variance.
- Consequences for the design (assumption A5):
  1. The unit of comparison is a pair: one change, one routed run, one baseline run, same `goal` and `baseSha`.
  2. Each pair prints its own observed drop. No p-value, no confidence interval at pair level (n = 1).
  3. Aggregation over pairs is descriptive: count, median drop, min, max. The command's single-pair JSON is stable enough for the owner or a later slice to aggregate. An `aggregate` mode or a pairs ledger is out of scope for the first plan unless the owner asks (open question O3).
  4. Variance sources inside one pair that the router can show but not remove: different plans (baseline makes its own plan), review loops, and model nondeterminism. Show phase counts and row counts of each side's `plan.md` via `readPlan` (`route.mjs:64-88`) so a reader sees when the plans differ in size. No threshold is invented for "differs too much".
  5. Order and time effects are procedural: run the pair close in time, and alternate which side runs first across pairs. This is advice for the README, not code.

### 7. What a hermetic test can cover

- Harness: `makeProject`, `writeLog`, `entry`, `skipEntry`, `writeMetaFile`, `run`, `readLogEntries`, `readReportFile`, and the hermetic git helpers live in `skills/10x-pipeline/test/helpers.mjs:16-197`. `entry(n, step, over)` already takes any field override, so `entry(1, "plan", { usage: { totalTokens: 1000 } })` works with no helper change. A scratch project has its own root, so two projects model two checkouts; `run(project, args)` sets `cwd` to that root (`helpers.mjs:73-83`), and the baseline path is passed as an absolute directory.
- Cases that need no LLM, no network and (except the optional `baseSha` check) no git:
  - complete pair gives the expected `dropPercent` and, with `compare.targetDropPercent` set through the project override file, `met` and `not met` at the boundary; with the default `null`, `target not set`.
  - missing `usage` on one entry of either side gives `comparable: false`, `dropPercent: null`, coverage "K of N".
  - baseline entry on `haiku` or at `medium`, or a `skipEntry` in the baseline log, gives `pinned: false` and `not comparable`.
  - a halted side (`meta.outcome.action: "halt"`) gives `not comparable` with the outcome listed.
  - goal or `baseSha` mismatch gives a warning and keeps the numbers.
  - baseline total `0` gives `dropPercent: null` (no division by zero); empty log and unparseable `run.jsonl` lines (`readLog` drops them: `route.mjs:161-171`) do not throw.
  - routed side archived: the log lives under `context/archive/<date>-<id>/agent-smith/`; lookup works; the command writes nothing (directory listing before and after is identical); `--out` into `context/archive/` is refused.
  - the shipped baseline file pins every step: for each step name in `policy.steps`, drive `init` and `next` in a scratch project with that override and assert `sonnet`/`high`. This also covers the 7-entry versus short-ladder crash (a ladder-length assertion on the shipped file).
- Not coverable hermetically: that a real foreground Agent result reports usage, and any real saving. Those need one real routed run and one real baseline run; keep them as manual evidence rows in the plan (the archived `per-step-usage-report` plan did so, and left the evidence unfilled).
- Gap in the existing suite: 0 of the 5 files in `skills/10x-pipeline/test/` mention `usage`/`totalTokens`, so intake (`cleanUsage`) is itself untested. A small intake test in the new file is cheap insurance because the comparison depends on it.
- Constraints for the new tests: Node 18 only, no `toSorted`, `Object.groupBy`, `Set` intersection, `import.meta.dirname`, regex `v` flag, `assert.partialDeepStrictEqual`, `mock.timers` (AGENTS.md "Testing"). Run `node --test skills/10x-pipeline/test/*.test.mjs` after any change to `route.mjs`, `policy.json` or a prompt. `rules.test.mjs` checks prompt rule form (ADR-004); recommended design adds no prompt, so it is unaffected.

## Touch points (exact, to keep edits small and avoid parallel-change conflicts)

Recommended design (Option A, new `compare` command). Anchors are for commit 54f1729; re-anchor after S-05/S-07 merge.

| File | Where | Change | Conflict risk |
| --- | --- | --- | --- |
| `skills/10x-pipeline/scripts/route.mjs` | after `riskCommand` (`:1158-1163`), before `status` | new function `compareCommand(id, flags, policy)` plus small helpers; reuses `readLog` (`:161`), `readMeta` (`:178`), `executed` (`:173`), `readPlan` (`:64`), `archiveDirs` (`:110`), `deepMerge`/`loadPolicy` (`:38-56`) | low: new code in its own block |
| same | `main` dispatch chain (`:1250-1256`, the `else if (cmd === ...)` ladder) | one new branch `cmd === "compare"` | medium: S-05 may add a command to the same ladder. Put the branch last, one line, so a textual conflict is trivial |
| same | usage string `:1195`; header comment `:6-12` | add `compare` | medium, same reason; keep it one line |
| same | `paths(id)` (`:145-159`) is bound to `ROOT` | compare needs the same layout for another root: add an optional `root` parameter, or build the two paths inside `compareCommand` | low; avoid changing the signature if S-05 also edits `paths` |
| `skills/10x-pipeline/policy.json` | new top-level `compare` block, placed after `archive` (`:75-79`) and before `prompts` (`:80`) | `{ "targetDropPercent": null, "modelWeights": null, "requireComplete": true }` (names are proposals) | low to medium: S-05/S-07 may add keys near the same lines; JSON merges cleanly if keys are on separate lines |
| `skills/10x-pipeline/baseline-policy.json` (new) | new file | 7 x `{"model":"sonnet","effort":"high"}` under `ladder`; no other key (the baseline needs `--rigor standard`, not a policy change) | none (new file) |
| `skills/10x-pipeline/test/compare.test.mjs` (new) | new file | cases in section 7 | none (new file) |
| `README.md` | new "Baseline comparison" block after "Usage report" (`:65-70`), before "Limits" (`:73`) | how to make the baseline checkout, the command, the verdict values | medium: S-05 likely edits the "Usage report" block |
| `AGENTS.md` | "Commands" bullet list; "Project Structure" test list (`route.test.mjs ... helpers.mjs`) | one bullet for `compare`, add `compare.test.mjs` | low to medium: any change that adds a command or test file edits the same lists |
| `skills/10x-pipeline/SKILL.md` | none | `compare` is not part of the orchestrator loop; the orchestrator never picks models (SKILL.md "Rules"). `--rigor` for the baseline is already allowed when the user names a level (SKILL.md:30) | none |
| `decide()` (`:618-740`), `tierFor()` (`:763-805`), `next()` (`:1015-1115`), `buildReport()` (`:202-240`) | not touched | | S-07 edits `decide`; S-05 likely edits `buildReport`/`finishRun`. Staying out of them is the main conflict control |

If Option B (`init --baseline`) is chosen instead, add: `main` init flag parse and `meta` write (`:1200-1248`), `loadPolicy` signature, a ladder-length guard, SKILL.md "Start" step 3 text, README routing bullets, and a note in "How the tier moves" (AGENTS.md Coding Style asks for that only when tier logic changes; a pinned overlay arguably does). That is a bigger overlap with S-05/S-07.

## Code References

- `skills/10x-pipeline/scripts/route.mjs:20` - `ROOT = process.cwd()`; run state is per project root.
- `skills/10x-pipeline/scripts/route.mjs:38-56` - `deepMerge`, `loadPolicy`; override file merged over defaults, arrays replaced.
- `skills/10x-pipeline/scripts/route.mjs:110-116` - `archiveDirs(id)`: lookup of archived folders.
- `skills/10x-pipeline/scripts/route.mjs:145-159` - `paths(id)`: run-state layout.
- `skills/10x-pipeline/scripts/route.mjs:161-175` - `readLog`, `executed` (skip entries filtered).
- `skills/10x-pipeline/scripts/route.mjs:202-256` - `buildReport`, `writeReport`, `finishRun` (tokens column, "figures for K of N steps", `meta.outcome`).
- `skills/10x-pipeline/scripts/route.mjs:271-282` - `cleanUsage`.
- `skills/10x-pipeline/scripts/route.mjs:296-328` - `attachResult`; usage stored at `:319-320`.
- `skills/10x-pipeline/scripts/route.mjs:391-395`, `653` - requested rigor replaces goal class; plan-review skip needs a level in `skipPlanReviewAt`.
- `skills/10x-pipeline/scripts/route.mjs:763-805` - `tierFor`, clamp at `:789`.
- `skills/10x-pipeline/scripts/route.mjs:1084-1103` - model/effort from `policy.ladder[tier]`; log entry fields.
- `skills/10x-pipeline/scripts/route.mjs:1158-1176` - `riskCommand` (read-only precedent), `status` with per-step `usage`.
- `skills/10x-pipeline/scripts/route.mjs:1192-1262` - `main`: usage string, init flags, dispatch.
- `skills/10x-pipeline/policy.json:2-18, 48-57, 75-80` - ladder, steps, rigor, archive/prompts insertion point.
- `skills/10x-pipeline/SKILL.md:28-30, 40` - argument parsing, `--rigor` only when user names it, usage copy-through.
- `skills/10x-pipeline/test/helpers.mjs:16-197` - scratch project and log-fixture helpers.
- `context/foundation/prd.md:49, 58, 108, 144` - success criterion, router-cost guardrail, FR-009, Open Question 1.
- `context/foundation/roadmap.md:147-159, 235` - S-06 slice; Open Question 4 note.

## Architecture Insights

- The router is a CLI of small read-only and stateful commands over files; every command ends in `out()` JSON (`route.mjs:22-25`). `compare` fits the `risk` pattern (read-only) without disturbing the state machine.
- Per-project policy lives in data; the baseline configuration is data too (Option A), so the "A/B arm" is a file, not a code path. This keeps the comparison honest: the baseline cannot silently share routing code paths that it should bypass, and `compare` verifies the pin from the log instead of trusting a flag.
- State is keyed by checkout, not by run. Anything that wants two runs of one change must use two checkouts. This is a property to document, not to fix.

## Historical Context (from prior changes)

- `context/archive/2026-10-30-per-step-usage-report/plan-brief.md` - decided the usage source (orchestrator copies the Agent result's usage; router validates), the figures kept (total tokens, tool uses, duration), `-` for missing figures, and "S-06 out of scope". Verdict on its claim "the Agent result's usage summary is not a documented contract": still open; real evidence never filled (`real-run-evidence.md`). Verdict on "totals include failed attempts": supported by `buildReport` summing all executed entries (`route.mjs:202-240`).
- `context/archive/2026-10-30-rigor-levels/` - added rigor levels, skips (with `skipped` entries) and the `rigor.minEffort` floor that makes interactive steps run at `high` for `standard`/`thorough`. Relevant here: `--rigor standard` is the lowest level at which no step is skipped and the budget delta is 0 (`policy.json:53-56`).
- `context/archive/2026-10-30-archive-adapter/research.md:87` and ADR-003 "Archive adapter" - the archived folder path and the rule that nothing is written into the change folder after the pre-archive commit. Verdict: supported for the folder move; the claim that `report.md` is "the only router artifact that survives the move" conflicts with the folder-move description for `run.jsonl` (Gap G1).
- `context/archive/2026-10-30-cheaper-routing-simple-change/` and `2026-10-30-drop-size-flag/` - the simple-change discount and goal classes; their output fields (`simple`, `tier`) are meaningless in a pinned baseline run.

## Related Research

- `context/archive/2026-10-30-rigor-levels/research.md` (churn parameters; "Follow-up 2").
- `context/archive/2026-10-30-archive-adapter/research.md` (archive move, commit scope).
- Parallel, not yet written when this research ran: S-05 `pr-comment-report`, S-07 `pre-plan-steps` (`context/changes/pre-plan-steps/change.md` exists with no research). Baseline step names: `compare` sums all executed entries whatever their `step` name, so optional pre-plan steps added by S-07 are counted on both sides if they run.

## Assumptions (decided without a human; each is reversible)

- A1. "Sonnet-5.5 at high effort" is the ladder alias `sonnet` at `high`; the repo does not record the resolved version. Evidence: `policy.json:4-6`, SKILL.md:38.
- A2. The baseline is a second checkout from the routed run's `meta.baseSha` with the same goal text, not a second change id and not a second run slot in one folder. Evidence: `route.mjs:20, 145-159, 1228-1248` and the on-disk plan/code dependence in section 3.
- A3. Totals are compared only when every executed entry of both sides has `usage.totalTokens`, and both runs ended `done`. Evidence: partial sums bias the drop in either direction (reasoning from `buildReport`'s sum over entries that have figures, `route.mjs:208-233`) and external guidance not to drop failures.
- A4. Raw `totalTokens` is the primary unit; model weights are an optional owner-filled policy value, default none. Evidence: no token-to-limit conversion exists in the repo; Agent usage has no per-model split (plan-brief of `per-step-usage-report`).
- A5. Noise is handled by pairing, completeness and outcome flags, and descriptive aggregation; no significance test at this scale. Evidence: ADR-001 "does not fit" bullets; external guidance above.
- A6. `compare` is read-only by default and refuses output paths under `context/archive/`. Evidence: AGENTS.md Hard Rules, ADR-003 archive-step bullet.
- A7. The baseline is "every step the router chooses at `standard`, all pinned to sonnet/high", so it includes whatever optional steps S-07 adds at that level. The PRD says "full run" without defining it.

## Open Questions

For the owner (none blocks the research; O1 blocks a `met`/`not met` verdict, not the command):

- O1. **Success threshold.** What observed drop counts as success, and on which unit (raw `totalTokens`, weighted tokens, or share of the weekly limit)? Policy value `compare.targetDropPercent` ships as `null`; the verdict says `target not set` until filled. (PRD Open Question 1, `prd.md:144`.)
- O2. **Weights.** Should different models count differently toward the weekly limit? If yes, provide the weights for `compare.modelWeights`; no value is proposed here.
- O3. **Sample size.** How many pairs (distinct changes) must exist before the saving is believed, and is a descriptive median/range enough, or is an `aggregate` mode wanted in S-06?
- O4. **Real usage figures.** Does a foreground Agent result report total tokens, tool uses and duration? The evidence note was archived unfilled (`real-run-evidence.md`). One real run is needed before the first real comparison.
- O5. **Orchestrator tokens.** The main-thread session that runs SKILL.md is not recorded on either side. Accept that it cancels out, or record it by hand? The PRD guardrail says router cost counts (`prd.md:58`); the script itself uses no tokens.
- O6. **Baseline scope.** Does the baseline include the optional steps S-07 will add (A7), or only plan, plan-review, implement, impl-review, fix?
- O7. **Archived `run.jsonl`.** Confirm that `agent-smith/run.jsonl` is present in `context/archive/<date>-<id>/agent-smith/` after an `--archive` run (Gap G1). If not, `compare` must either read `report.md` or the baseline must be compared before archive.

## Gaps

- G1. Archived `run.jsonl` presence unverified (no archived run exists in this repo to inspect; `context/archive/` holds 5 changes, none with an `agent-smith/` folder).
- G2. No real usage figure from a foreground Agent result has been seen (O4).
- G3. Model alias to version mapping is not recorded (A1).
- G4. S-05 and S-07 had no research or plan when this ran, so their exact edits to `route.mjs`, `policy.json`, README and SKILL.md are predicted from roadmap text (`roadmap.md:134-145`, `161-173`), not read.
