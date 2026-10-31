<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Baseline Usage Comparison Implementation Plan

- **Plan**: context/changes/baseline-usage-comparison/plan.md
- **Mode**: Deep (single reviewer, codebase checked directly, no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 0 critical, 7 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (route.mjs, policy.json, helpers.mjs, archive.test.mjs, SKILL.md, README.md, AGENTS.md, ADR-003), 14/14 symbols ✓ (`cleanUsage`, `attachResult`, `buildReport`, `riskCommand`, `archiveDirs`, `readPlan`, `readLog`, `readMeta`, `executed`, `halt`, `entry`, `skipEntry`, `writeMetaFile`, `skipPlanReviewAt`), every cited route.mjs line anchor within 2 lines of the code, Progress↔Phase consistent (1.1-1.5, 2.1-2.10, 3.1-3.8, one `## Progress`, no stray checkboxes), brief↔plan ✓. No `docs/reference/contract-surfaces.md`, no `lessons.md`. Probes run in scratch projects: (1) default policy and the 7-entry baseline file both give `plan sonnet/high` for goal "fix typo" at `--rigor standard`; for "refactor the auth module" default gives `opus/high`, baseline gives `sonnet/high`. (2) `git mv` of a folder moves a gitignored `run.jsonl` along. (3) `(100-71)/100*100` is `28.999999999999996` in Node.

Claims confirmed against code: `compare` can be read-only (no write call in `loadPolicy`, `readLog`, `readMeta`, `readPlan`, `out`); the 7-entry uniform ladder pins every step incl. `archive` (tier 3) and the effort floor cannot move it (`effortFloorTier` returns index 0 for an all-`high` ladder); a ladder shorter than a step's `minTier` makes `policy.ladder[tier]` undefined at `route.mjs:1084` and ends as a `Router error:` JSON halt (no stack trace); `meta.outcome.action` is `done` for `--archive` runs too (`finishRun` at `route.mjs:941`, before the `archive` action), so the outcome rule is safe.

## Findings

### F1 — `pinned` rejects any skip entry, which contradicts A7 and will break when S-07 merges

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Pair object (`pinned`), reason `baseline-not-pinned`, Progress 2.4; Assumption A7
- **Detail**: `pinned` requires "no skip entry" in the baseline log. Today that holds at `standard` (`skipPlanReviewAt` is `["lean"]`, `policy.json:53`). A7 says S-07's optional pre-plan steps run on both sides "if they run". The S-07 research (branch `pre-plan-steps-research`, section 4 and assumptions) says gated-out pre-plan steps are "logged as skips with a reason" and the gate is `minRigor: standard` plus `when`/`skipIf` predicates. At `standard` the baseline will therefore usually carry skip entries (research already exists, no framing doubt, no domain signal). After S-07 merges, `compare` would label almost every baseline `baseline-not-pinned`, `comparable: false`, verdict `not comparable`. The pin is about what ran. A skipped step spent no tokens and the pin check on executed entries already proves model and effort.
- **Fix A ⭐ Recommended**: `pinned` = at least one executed entry and every executed entry `sonnet`/`high`. List baseline skip entries as a warning `baseline-skipped-steps:<n>` with the step names, not a reason.
  - Strength: Stable under S-07; still catches a wrong ladder; a skipped step cannot inflate the baseline.
  - Tradeoff: A baseline that skipped plan review (lean) looks comparable. The warning shows it, and F2 removes the usual cause.
  - Confidence: HIGH — S-07 research states the skip-entry mechanism and `buildReport` already treats skips as zero-cost.
  - Blind spot: S-07's final plan is not yet written (only its research exists); its skip semantics could still change.
- **Fix B**: Keep skips as a reason but only for the step names the baseline policy lists as mandatory.
  - Strength: Strictness stays for `plan-review`.
  - Tradeoff: Adds a policy list that S-07 must keep current.
  - Confidence: MEDIUM — needs a second key and a second maintainer.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A (accepted). `pinned` now means at least one executed entry and every executed entry `sonnet`/`high`. Baseline skip entries become the warning `baseline-skipped-steps:<n>`, not a reason. Reason: a skip spent no tokens, and S-07 will log gated-out pre-plan steps as skips. Plan: A7, Phase 2 contract, row 2.4.

### F2 — The baseline relies on `--rigor standard`, which SKILL.md does not parse and which pollutes the goal text

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Baseline policy file ("selected with `--rigor standard`, not with policy"); Phase 3 — README block step (2) "name rigor `standard`"; A2, A7
- **Detail**: SKILL.md Start step 1 parses `<change-id>`, goal text and `--archive` only. Step 3 passes `--rigor` "only when the user named a rigor level", but never says how the user names it. A user who types `... <goal> --rigor standard` leaves that text inside the goal (step 1 removes only `--archive`). Then `meta.goal` differs from the routed run (`goal-mismatch` on every pair) or, if the orchestrator drops the words, a short goal starts at `lean`, plan review is skipped, and the baseline is `not pinned` after a full paid run. Running `init` by hand first does not work: `init` starts step 1, and a second `init` from the orchestrator then halts on "has no result". The plan forbids a SKILL.md change (shared with S-05, which edits the same Start step).
- **Fix A ⭐ Recommended**: Put the level in the data file: `baseline-policy.json` carries `ladder` plus `rigor.fromGoal` set to `standard` for `short`, `plain` and `hard`, and `rigor.skipPlanReviewAt: []`. The README then needs no `--rigor` instruction and the goal text stays identical.
  - Strength: Zero code and zero SKILL.md change; `deepMerge` merges `rigor` key by key and replaces arrays whole (`route.mjs:38-56`); no skip is possible at any level; goal text pairs exactly.
  - Tradeoff: The file has three keys, so Contract text "no other key" and guard test (a) change (test asserts the three keys and values).
  - Confidence: HIGH — `rigorInputs` reads `R.fromGoal?.[kind]` (`route.mjs:395`) and `decide` reads `skipPlanReviewAt` (`route.mjs:653`); the probe shows the override mechanism works.
  - Blind spot: Not run end to end with the extra keys; case (b) in F3 would prove it.
- **Fix B**: Keep `--rigor` and add `--rigor` to SKILL.md Start step 1 as a parsed flag.
  - Strength: Reuses the existing `init` flag.
  - Tradeoff: Edits SKILL.md Start step 1, the line S-05 also rewrites; more merge work.
  - Confidence: MEDIUM — depends on merge order.
  - Blind spot: Orchestrator compliance is still a model behaviour.
- **Decision**: FIXED via Fix A (accepted). `baseline-policy.json` carries `ladder` plus `rigor.fromGoal` (`short`, `plain`, `hard` all `standard`) and `rigor.skipPlanReviewAt: []`. Keys verified against `policy.json`, `route.mjs:38-46, 395, 653` and by a scratch probe: "fix typo" gives `plan sonnet high` at `standard` with the file and `plan sonnet medium` at `lean` without it. README gives no `--rigor` instruction. Plan: Phase 1 contract 1, Current State, Key Discoveries.

### F3 — Phase 1 case (b) cannot fail: the default policy already gives `sonnet/high` for a short goal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — compare.test.mjs (b); Progress 1.2; Testing Strategy "Integration Tests"
- **Detail**: At `--rigor standard` the plan step has base tier 4, -1 first-plan bump, -1 simple discount, then the `high` effort floor, which gives tier 3 = `sonnet/high` with no override at all. Probe: "fix typo" gives `plan sonnet high` with and without the baseline file. Row 1.2 passes with an empty override, and the contract leaves the goal text as `"<text>"`. "Pins every step" is claimed for all seven tiers but only one step at one tier is exercised.
- **Fix**: Specify a hard-keyword goal (for example "refactor the auth module", default gives `opus/high`) and assert both the default result differs and the override gives `sonnet/high`; add an assertion that all seven `ladder` entries equal `sonnet`/`high` (already in (a)) and, after F2, that no step gets skipped.
- **Decision**: FIXED (accepted). Row 1.2 now uses a hard-keyword goal and a short goal with no `--rigor` flag and asserts the default policy differs from the baseline file in each case; new row 1.3 asserts plan review is skipped by default and not under the baseline file for the same plan. Plan: Phase 1 contract 3, rows 1.2 and 1.3.

### F4 — The baseline checkout may not get the same inputs as the routed run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: A2; Phase 3 — README block step (2) "copy only `change.md`"
- **Detail**: This repository's own flow runs `/10x-research` (and sometimes `/10x-frame`) before `/10x-plan`, and the plan step reads those files from the change folder. If the routed run had an uncommitted `research.md` and the baseline gets only `change.md`, the baseline plans from scratch and spends more plan tokens. That inflates `dropPercent` with no routing effect, and nothing in `compare` can detect it. The plan's warnings only cover `goal` and `baseSha`.
- **Fix**: README rule: copy every file that existed in the change folder when the routed `init` ran (inputs: `change.md`, `research.md`, `frame.md` and similar), never the files the run produced (`plan.md`, `reviews/`, `agent-smith/`). Optionally add `compare` warning `input-files-differ` listing names present in one side's change folder before `plan.md` mtime, only if cheap; the README rule alone is enough for a first version.
- **Decision**: FIXED (accepted, README rule plus a cheap warning). README rule: copy every input file that existed in the routed change folder at `init`, never produced files. `compare` also warns `input-files-differ:<names>`, a name-only, deterministic comparison of top-level files (excluding `plan.md`, `plan-brief.md`); content and mtime are not compared. Reason for adding the code check: without it the inflated plan tokens are undetectable. Plan: A2, Phase 2 contract and row 2.6, Phase 3 README.

### F5 — `dropPercent` float arithmetic breaks the inclusive `met` boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: A8, A9; Phase 2 — verdict rule; Progress 2.2
- **Detail**: A9 computes `(baseline - routed) / baseline * 100` and compares it "unrounded" to the target with `>=`. `(100-71)/100*100` is `28.999999999999996` in Node, so an exact 29 % drop with `targetDropPercent: 29` gives `not met`. Row 2.2 ("a drop equal to the target gives `met`") passes only for lucky numbers such as 1000/600.
- **Fix**: Decide `met` in integers: `(baseline - routed) * 100 >= target * baseline` (target from the policy may be fractional, so also acceptable: compare after `Math.round(x * 1e6) / 1e6`). Print the 2-decimal rounded value. Add a boundary case with baseline 100, routed 71, target 29.
- **Decision**: FIXED (accepted). `met` is decided with `diff*100 >= target*baselineTotal` (exact integer left side, `1e-9` relative slack for fractional targets); printed value rounds to 2 decimals. Boundary rows: 100/71/target 29 is `met`, 72 is `not met`, 1000/705/target 29.5 is `met`. Plan: A9, row 2.2.

### F6 — The foundation of the feature, real usage figures, is tested last

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Manual 3.7; Current State Analysis bullet 5; Progress ordering
- **Detail**: If a real foreground Agent result carries no usage, every real pair is `not comparable` and the whole command is idle. The plan builds all three phases first and checks this in the last manual row, after real runs cost tokens. The previous change (`per-step-usage-report`) archived the same check unfilled, so the risk is not theoretical. Hermetic tests with fabricated `usage` cannot show the figure arrives through SKILL.md step 4. The check costs one routed step.
- **Fix A ⭐ Recommended**: Move row 3.7 to Phase 1 manual (before Phase 2), as a one-step spike: run the pipeline on a scratch change, stop after the first `next`, read `status`. If no step carries `usage`, stop and report; the owner decides before Phase 2 and 3 are built.
  - Strength: Cheap early exit; removes the largest unknown.
  - Tradeoff: Phase 1 now needs a live session.
  - Confidence: HIGH — the check is a single `status` line.
  - Blind spot: One step's figure does not prove every step carries one; row 3.6 still covers that (completeness).
- **Fix B**: Keep the order and add an explicit stop note to the Phase 3 overview.
  - Strength: No restructure.
  - Tradeoff: Wasted work if the answer is no.
  - Confidence: MEDIUM — only reorders risk.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A (accepted). The usage check is Manual row 1.7 in Phase 1, a one-step spike with a stop rule. New section "If usage is absent": stop before Phase 2, record it, owner chooses between a separate SKILL.md change and building anyway; default is to stop. The evidence note is created in Phase 1. Row 3.7 still checks that every step carries a figure.

### F7 — Manual row 3.8 (archived `run.jsonl`) is automatable and already answered by existing evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis bullet 6; A11; O7; Progress 3.8; Phase 2 Progress 2.8
- **Detail**: The "unresolved" question has code answers. `archive.test.mjs:594` asserts `agent-smith/run.jsonl` is in the pre-archive commit (it is a probe file; a gitignored one is refused at `init` and at `done`, `route.mjs:1224-1226`). `/10x-archive` moves the folder with `git mv` (skill "Move and stamp" step 3) and falls back to `mv` of the whole folder. README and ADR-003 say ignored files "still move with the folder", and a scratch probe confirms `git mv` carries a gitignored `run.jsonl`. The ADR sentence "`report.md` ... only router artifact that survives the move" is about what the report must carry for a reader of the archive (it is the only file the pending-Manual note lives in), not a deletion of `run.jsonl`. `archive.test.mjs:1035` already simulates the move with `git mv`. So a real `--archive` run is not needed; one test is.
- **Fix**: Replace Manual 3.8 with an automated row in `compare.test.mjs`: init a hermetic git project (helpers `gitInit`, `commitFiles`), write a log and meta, `git mv` the change folder to `context/archive/<date>-<id>/`, run `compare` with that project as the routed side and assert the figures. Update Current State bullet 6 and A11 to say "resolved by `archive.test.mjs:594` and git mv semantics"; keep the halt-on-missing behaviour. Drop O7 and the third evidence heading.
- **Decision**: FIXED (accepted). Manual 3.8, gap G1, O7 and the third evidence heading are gone. New automated row 2.10 moves a scratch folder with `git mv` while `run.jsonl` is gitignored and asserts `compare` reads the same totals. Current State and A11 now cite `archive.test.mjs:594`, the `/10x-archive` move step and the probe.

### F8 — Several success criteria cannot discriminate

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress 2.1-2.9 (all one command), 3.3, 3.4
- **Detail**: (a) 2.1-2.9 and 1.1-1.3 all run `node --test .../compare.test.mjs`, so a pass of one row cannot be told from another; use `--test-name-pattern` (Node 18.11+) or name tests per row. (b) 3.3 `grep -c "compare" route.mjs >= 3` is true for the words "compare" in any comment; check for `cmd === "compare"` and the usage string instead. (c) 3.4 `git diff -U0 main` counts removed lines against the `main` tip: after S-05 or S-07 lands on `main` and this branch is not rebased, removals from `main`'s side fail the row; use `git merge-base main HEAD`. (d) 2.10 banned-API grep omits the regex `v` flag and `Set` intersection methods listed in AGENTS.md. (e) A hand-fixture suite never feeds `compare` a log made by the real router; one case that drives `init`/`next` with a scratch policy, writes `usage` in `last-result.json` and then runs `compare` would join intake to comparison.
- **Fix**: Tighten the five rows as listed; none changes scope.
- **Decision**: FIXED (accepted, all five). (a) Test names start with the row number and rows use `--test-name-pattern` (Node 18.11+; the plan warns that a pattern matching nothing exits 0). (b) Row 3.3 checks `cmd === "compare"` and the usage string. (c) Row 3.5 diffs against `git merge-base main HEAD`. (d) Banned-API grep adds the `Set` methods and a rough regex `v` flag check. (e) New row 2.11 feeds `compare` a log written by the real router with a `usage` figure. Rows were renumbered: Phase 1 has 1.1-1.7, Phase 2 has 2.1-2.12, Phase 3 has 3.1-3.7.

### F9 — `compareCommand` contract leaves implementer guesses

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Compare block in the router; Phase 3 — Markdown format
- **Detail**: Unspecified: (1) `--routed` or `--format` given without a value (`parseFlags` sets `true`); (2) relative `<dir>` resolved against `ROOT`; (3) the contract says it "reuses `archiveDirs`" in spirit, but `archiveDirs` is bound to `ROOT` (`route.mjs:113`), so the archive-name rule is duplicated for another root, so name the regex once as a shared constant or accept the copy and test it; (4) `usage.totalTokens` must be tested with `Number.isSafeInteger`, not just presence, since `run.jsonl` may be hand-edited; (5) `byModel` for an entry with no `model`; (6) `toolUses` and `durationMs` sums have no coverage count, so a partial sum reads like a total; (7) `out()` prints JSON only, so Markdown needs its own `process.stdout.write` and exit; (8) the target comes from `ROOT`'s policy, not from `--routed`'s project when they differ; (9) both `changes/<id>` and an archive folder present for one side is not defined (precedence is "changes", but the ambiguity halt covers only archive folders).
- **Fix**: Add one line per item to the Contract, using the existing halt style for invalid flags.
- **Decision**: FIXED (accepted, all nine). (1) valueless `--baseline`/`--routed`/`--format` halt; (2) `path.resolve(ROOT, dir)`; (3) the archive-name regex is a local copy of the `archiveDirs` pattern, tested with near-miss names; (4) figures count only if `Number.isSafeInteger` and non-negative; (5) `byModel.unknown`; (6) `toolUses` and `durationMs` carry `{ total, stepsWithFigures }`; (7) Markdown uses its own `process.stdout.write`; (8) the target comes from `ROOT`'s policy; (9) `changes` wins over an archive folder with the warning `archive-also-present:<side>`.

### F10 — Docs and decision record gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — README, AGENTS.md; References
- **Detail**: (1) `baseline-policy.json` is a routing-relevant file outside `route.mjs`/`policy.json` (AGENTS.md Hard Rule 1) and is not added to AGENTS.md Project Structure. (2) The README tells users to copy `skills/10x-pipeline/baseline-policy.json`; in a target project that is the plugin cache directory, not a project path, so say `<plugin dir>` as the S-05 plan does for its script. (3) `met` is decided on raw tokens, a proxy for the PRD's weekly-limit metric: it understates savings from `haiku` steps and overstates a drop bought by moving work to heavier `opus` tokens. The README should call the unit a proxy next to the verdict values. (4) The measurement method (baseline arm, comparability rules) is a decision that ADR-003 and the S-05 plan record; consider a short ADR-003 section or an ADR-005, with GIVEN/WHEN/THEN rule lines (ADR-004). (5) The baseline worktree holds the only copy of its `run.jsonl`; the README should say to keep it until `compare` ran. (6) Merge-risk check against the real sibling plans: S-05 (branch `pr-comment-report-plan`) declares it touches neither `route.mjs` nor `policy.json`, so the plan's "S-05 likely edits `buildReport`/`finishRun`" is stale. Real overlap is README (S-05 adds a block after "Archive (opt-in)", this plan after "Usage report": separate hunks), AGENTS.md (Commands and Project Structure lists: adjacent-line conflicts, easy) and SKILL.md (not touched here). S-07 touches `route.mjs` `decide`/`next`/skip cap and `policy.json` `steps`/`prompts`/a `preplan` block; the plan's insertion points (after `riskCommand`, last dispatch branch, between `archive` and `prompts`) are sound, except `prompts` adjacency in `policy.json`, where S-07 also edits.
- **Fix**: Fold the six notes into the Phase 3 contracts and the Current State text.
- **Decision**: FIXED (accepted, all six). (1) `baseline-policy.json` gets an AGENTS.md Project Structure bullet; (2) README says `<plugin dir>`; (3) README, A4 and the Markdown verdict call raw tokens a proxy and name the bias; (4) new `docs/ADR/ADR-005-baseline-usage-comparison.md` with GIVEN/WHEN/THEN lines (a new file, not an ADR-003 edit, to avoid parallel conflicts; renumber at merge if 005 is taken); (5) README says to keep the baseline worktree until `compare` ran; (6) stale S-05 claim corrected, and the `compare` policy block moves between `limits` and `archive` to stay away from S-07's `prompts` edits.
