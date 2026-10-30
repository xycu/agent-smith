<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Rigor Levels, Churn Risk and Skip Logging Implementation Plan

- **Plan**: context/changes/rigor-levels/plan.md
- **Mode**: Deep (round 2, done in the main thread, no sub-agent: the router is 505 lines and was read in full, and the risky claims were run against git and the code)
- **Date**: 2026-10-30
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 6 observations

Round 1 gave REVISE (1 critical, 6 warnings, 2 observations). The revision answers all nine findings. This round found no new critical defect and one warning. The warning (F1) is a one-line fix to a parser and should go into the plan before `/10x-implement`; it does not need another revise loop (one warning is within the router's own `reviseToleranceWarnings` of 1).

## Previous review (round 1)

| ID | Round 1 finding | Status now | Evidence |
|----|-----------------|------------|----------|
| F1 | `git log --format=@@` invalid, churn always "unavailable" | Resolved | Plan Phase 3 uses `--format=tformat:@@` and adds a `source` is `window` test. Re-run here: `--format=@@` gives `fatal: invalid --pretty format: @@`, `tformat:@@` works, commits with no files still print `@@` under `--relative`. |
| F2 | A failure to measure risk lets `lean` skip plan-review | Partially resolved | Skip needs source `window` or `all-history` and at least one plan path; `--relative`; `since` validated (re-run: `--since=bogus` returns 0 commits, `--since=90.days` returns 38). Reason and `risk` go on the skip entry, not in `meta.rigor.by`, which is a sound deviation (`by` names only what raised the level). Residual gap: the plan-path parser can under-read a plan and still report at least one path (new F1). |
| F3 | Skip-return rule contradicts brief, can fire mid-implementation | Resolved | Fix A applied: the skip freezes once any `implement` or `fix` entry exists, even a failed one. Brief and plan now agree. See F3 below for a note on the lapse branch. |
| F4 | `needsHuman` ack location and the `meta.json` whitelist | Resolved | `init` writes `{ ...prev, id, goal }` (Phase 2); ack lives on the log entry (Phase 5). See F2 below for the stored-shape guard. |
| F5 | Node 18 asserted, never checked | Resolved | Ban list in Phase 2 contract, manual rows 2.5, 3.4, 6.10 with `npx -y node@18`, unverified-status fallback. The list is "such as", not exhaustive (F7). |
| F6 | 2.4 contradicts tier math, `simple` flag misleads | Resolved | `tierWhy` always names the floor for interactive steps; `simple` true only if the discount survived the floor. Tier math re-checked: `plan` at `lean` = 4 - 1 - 1 = 2 = floor; `plan-review` at `standard` = 2 - 1 = 1, floor 3, `simple` false. A residual nuance remains for the clamp path (F4). |
| F7 | Unstated churn and skip test fixtures | Resolved | `helpers.mjs` owns `writeLog` and `gitEnv()` (null global/system config, ceiling dir, author env, `gpgsign=false`), dated commits for the window fallback. Hardening notes in F5. |
| F8 | Smaller gaps (items 1 to 6) | Resolved | (1) skip loop halts with `Router error: skip loop`; (2) `fromPhases` reads `complexity.phaseThresholds`; (3) Migration Notes cover `baseSha`; (4) PRD FR-010 tail kept as a dated deferral (Phase 6 change 5, row 6.12); (5) `change.md` scope line (Phase 6 change 7, row 6.11); (6) brief now says Follow-ups 1 to 3 are used. |
| F9 | Weak doc checks | Resolved | 6.3 grep extended to effort words and passes on the current `SKILL.md` (run here); ADR-004 bad examples sit in fenced blocks and the test skips fences in ADRs. |

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Paths: 14/14 existing paths the plan reads or edits exist (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, `prd.md`, `roadmap.md`, `change.md`, `plan-brief.md`, `research.md`, ADR-001, ADR-002, `prompts/*.md`, `../life-to-lore/docs/adr/ADR-012-prompt-rules-as-scenarios.md` in the sibling checkout); new files (`docs/ADR/ADR-003`, `ADR-004`, `skills/10x-pipeline/test/*`) are correctly absent. Symbols: `attachResult`, `lastIdx`, `trailingFailures`, `cleanUsage`, `tierFor`, `simpleSignal`, `parseFlags`, `readMeta`, `buildReport`, `endRun` all exist; 17 of 18 cited `route.mjs`/`policy.json` line ranges are exact; one is wrong (F6). Brief and plan agree on every decision checked. Source ADR-012 was re-read: five keywords, one-line form, `MUST` scarcity and the "never SHALL/REQUIRED/RECOMMENDED/OPTIONAL" rule match what the plan copies. No `contract-surfaces.md` and no `lessons.md` exist, so those checks were skipped.

Mechanical Progress check (script, not by eye): exactly one `## Progress`; six `## Phase N` headings match six `### Phase N` headings by number and name; every Success Criteria bullet maps one-to-one, in order and with identical text, to a Progress row (1.1-1.3, 2.1-2.5, 3.1-3.4, 4.1-4.3, 5.1-5.4, 6.1-6.12; 31 rows, the new rows 2.5, 3.4, 6.10-6.12 included); zero `- [ ]` or `- [x]` outside Progress. The new rows 2.5, 3.4, 6.10, 6.11 and 6.12 all have a matching criterion in their phase.

Real prompts: all 6 `prompts/*.md` files hold 85 rule lines, 0 stray bold keywords, 0 bare upper-case `SHALL|REQUIRED|RECOMMENDED|OPTIONAL`, so the Phase 1 test will pass on them.

### Revision-note claims checked against code and owner decisions

| Claim in Revision Notes | Result |
|-------------------------|--------|
| F1: `--format=@@` fails here | Confirmed by running it. |
| F2: skip needs measured risk, `--relative`, validated `since`; reason/`risk` on the skip entry | Present in Phase 3 and 4. `--relative` confirmed to keep file-less commits as `@@` lines, so commit counts stay right. |
| F3: freeze on any `implement` or `fix` entry | Present in Phase 4 change 2, its test list, brief "Open Risks" and Overview. Consistent. |
| F4: `{ ...prev, id, goal }`; ack on log entry | Matches `route.mjs:491-497`. `next()` deletes `outcome` only on a continuing run (`:425-429`), so `outcome` carried by the spread is cleaned there; on an early halt it is replaced by `endRun`. |
| F5, F6, F7 "as written" | All three are in the contracts of Phases 2 to 4. |
| F8: items 1 to 6 | All six placed (see table above). |
| F9: 6.3 grep, fenced examples | 6.3 passes on today's `SKILL.md` on macOS grep; fence rule is in Phase 1 change 2. |
| Owner decisions (research Follow-up 1 decisions 1 to 3, Follow-up 2 decisions 1 and 7, churn proposal) | `lean` skips plan-review; elevated risk never runs `lean`; floor `medium` at `lean`, `high` at `standard`/`thorough` and applied last; skip entries keep every count; `node:test` rule check; churn keys and the 90-day/500/10/80th percentile/3 values match the proposal; the dry run `[1,1,1,1,4,9]` gives threshold 4 (nearest rank 5 of 6). The changes from the proposal (array form of `raise`, `tformat:@@`, `--relative`, `baseSha` cut-off) are called out in the plan. |
| AGENTS.md hard rules | No npm dependency (`node:child_process` is built in; `npx -y node@18` is a run-time tool, flagged as such); Node 18 ban list present; routing stays in `route.mjs` and `policy.json`; `SKILL.md` names no model, effort or tier (6.3); `context/archive/` and `~/.claude/skills` untouched (6.5, scope list); manifests untouched (6.6). |

## Findings

### F1 — The plan-path parser reads only `**File**:` lines, so a plan can pass the "at least one path" test and still hide a hot file

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 change 3 (plan-path input); Phase 4 change 2 (skip condition)
- **Detail**: The revision stops `lean` from skipping when the plan yields no path. It does not cover a plan that yields some paths but misses others. The parser takes "`**File**:` lines". This plan itself uses `**Files**:` (plural) at line 171 for two files, so the plural form occurs in real plans written by the same toolkit. A plan that puts a new test file under `**File**:` and `route.mjs` under `**Files**:` reports `planPaths` 1 with no hot hit, so `lean` skips plan-review for a change on a hot path. That is the FR-010 failure the round 1 fix (F2) was written to close. The same line also says "take backtick-quoted tokens on the line" and is not anchored: several `Intent` lines in this plan contain the text `**File**:` mid-sentence (lines 236, 238, 303, 495), whose backtick tokens (`plan.md`, `meta.rigor.by`, a `git diff` command) would be read as paths. That direction only raises rigor, so it is harmless, but it shows the pattern is loose.
- **Fix**: Anchor the pattern at line start and accept both forms (`^\*\*Files?\*\*:`), and add one test with a mixed `**File**:` plus `**Files**:` plan where the hot file sits under `**Files**:`. Strength: closes the hole for about one line of regex and one test case. Tradeoff: a plan that names files only in prose still yields too few paths; accepted, because zero paths already blocks the skip.
- **Decision**: PENDING

### F2 — Test case "a `meta.json` that is not an object … gives a JSON `halt`" contradicts `readMeta`, and the stored `rigor` shape is not guarded

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 5 (test contract); Phase 2 change 2 (`init` spread)
- **Detail**: `readMeta` (`route.mjs:132-135`) deliberately falls back to `{}` / `{ id, goal: "" }` for a non-object `meta.json`; no phase changes that. The test case says it "gives a JSON `halt`". An implementer must either add a new halt (a behaviour change no phase lists) or write a test that fails. Separately, `{ ...prev, id, goal }` keeps whatever is stored, so a hand-edited or old `meta.rigor` that is a string, or a `level` not in `rigor.levels` (after a policy override), reaches the resolver unchecked. Only the outer `try/catch` stops a stack trace, and that turns a recoverable state into a hard halt.
- **Fix**: Reword the test as "falls back as today and output stays valid JSON" (or name the new halt in Phase 2 change 2), and say the resolver ignores a stored `rigor` whose `level` is not in `rigor.levels`.
- **Decision**: PENDING

### F3 — The "lapse" branch of the skip rule is nearly unreachable, and the unmeasured case silently keeps the run at `lean`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4 change 2; Phase 4 change 4 (test list)
- **Detail**: `next()` writes the skip, then calls `decide()` again in the same call, which returns `implement` and appends that entry. So an `implement` entry exists as soon as a skip exists; the state "skip, no `implement`/`fix` yet, rigor rises" can only be reached by a hand-built log or a `decide()` that returns something other than `implement` (for example a plan with no pending automated rows). The test "a rigor rise before any `implement` or `fix` entry exists brings plan-review back" is feasible only through a `writeLog` fixture, which is fine but should say so. Also, when risk is unmeasured, plan-review runs but the level stays `lean` (documented as an assumption in the Revision Notes), so that run keeps the smaller budget (-4), the `lean` impl-review offset and a `medium` floor for plan-review. This is a defensible reading of FR-010; say in Phase 4 which effort the unmeasured plan-review gets so the report is not a surprise.
- **Fix**: Note in the test contract that the lapse case uses a fixture, and add one sentence to Phase 4 change 2 naming the tier the unmeasured plan-review gets (the `lean` floor).
- **Decision**: PENDING

### F4 — The `simple` rule is described by outcome, not by formula, and the clamp path still overstates a saving

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 3 (Contract)
- **Detail**: "true only when the discount survived the floor … where the floor raised the tier back over the discounted value" works for the two tested cases (`plan-review` at `standard`: false; `plan` at `lean`: true). It does not say what happens when the `minTier` clamp or the `lean` impl-review offset absorbs the discount first. Example at `lean`, simple change: `impl-review` base 3 - 1 (discount) - 1 (offset) = 1, clamp to 2, floor 2. The final tier equals what the offset alone gives (3 - 1 = 2), so the discount saved nothing, yet `discount > 0` still reports `simple: yes`. The clamp case was already true before this plan (`SKILL.md` admits it), so the plan's stated goal that the report "never claims a saving that did not happen" is only met for the floor, not for the clamp.
- **Fix**: Define `simple` as "final tier is lower than the tier computed without the discount", or narrow the Contract wording to "the floor never leaves a stale `simple: yes`". Either is a one-line change; the first is more honest but touches the pre-existing clamp behaviour.
- **Decision**: PENDING

### F5 — Churn git layer: three cheap hardening gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 change 2 (git layer); Phase 3 change 5 (hermetic fixtures)
- **Detail**: (a) `meta.baseSha` is read from `meta.json` and passed to `git log`/`git diff` as an argument. A value that starts with `-` would be read as an option (for example `--output=<file>`). `since` is validated; `baseSha` is not. (b) `execFileSync` has a 1 MiB default `maxBuffer`; 500 commits with `--name-only` can pass that after a large rename or vendored import. The error is swallowed into "unavailable", which is the safe direction, but the "output a few KB" claim in Performance Considerations is optimistic and the user would see `unavailable` with no hint why. (c) `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` need git 2.32 or later; with an older git the null-file setting is ignored and the developer's `~/.gitconfig` leaks in. Setting `HOME` to the scratch directory as well closes it. Not verified here: whether `GIT_CEILING_DIRECTORIES` matches when `os.tmpdir()` is a symlinked path (macOS `/var` to `/private/var`); using `fs.realpathSync(os.tmpdir())` for the scratch root avoids the question.
- **Fix**: Require `baseSha` to match `/^[0-9a-f]{40,64}$/` (else "unavailable"); pass `maxBuffer` explicitly; add `HOME` and a real-path scratch root to `gitEnv()`.
- **Decision**: PENDING

### F6 — Small factual slips and check weaknesses in the prose

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries; Current State Analysis; Migration Notes; Phase 2; Phase 5; Phase 6 criteria 6.5 and 6.6
- **Detail**:
  - Key Discoveries cites `route.mjs:414-418` for "`next()` already deletes `outcome` when a run continues". That range is the `endRun` call; the delete is at `:425-429`. The other line references in the plan (`:265-357`, `:373-395`, `:491-497`, `:201-226`) are right.
  - Current State says "only `init` reads flags". `status` also reads `--report` (`:474`).
  - Migration Notes say the floor raises both `plan-review` and `impl-review` "from medium to high effort at `standard`". `impl-review` has `baseTier` 3, already `sonnet`/`high`; it only drops to medium today through the simple-change discount. The claim is right for `plan-review` and for a discounted `impl-review`. The same note says `lean` "keeps the current cheap tiers", but `lean` impl-review is one tier cheaper than today.
  - An in-flight run with a short goal and 10 or more executed steps resolves to `lean` (budget 10) at the first `next` after the upgrade and halts at once. Rare, but the Migration Notes already cover the neighbouring `baseSha` case.
  - Phase 2: `fromPhases` has one entry per `phaseThresholds` entry; an override with a longer `phaseThresholds` leaves entries undefined. Say that extra thresholds map to the last level.
  - Phase 1/5: the keyword scan "bare `SHALL|REQUIRED|RECOMMENDED|OPTIONAL`" is only safe if it is case-sensitive; Phase 5 wants the RESULT line to say `signals` is "optional", which a case-insensitive scan would reject. State "upper case, whole word".
  - Criteria 6.5 and 6.6 diff the working tree against the tip of `main`. If `main` gains an archive commit or a manifest change before this branch merges, the check fails for a reason unrelated to this change. `git merge-base main HEAD` as the base avoids that.
  - The Node 18 ban list is "such as"; also add `Array.prototype.with`/`toSpliced`, `Map.groupBy`, `Promise.withResolvers`, `URL.canParse`, `fs.globSync`. The 18 run in 6.10 is the real check, so this is cosmetic. Rows 2.5, 3.4 and 6.10 run the same suite three times; 6.10 alone would do.
- **Fix**: Correct the line reference and the three prose claims, state the case rule, and use the merge-base in 6.5 and 6.6.
- **Decision**: PENDING

### F7 — Needs-human ack and budget are not ordered against each other

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 2 (order inside `next()`); Phase 5 change 1
- **Detail**: Phase 2 puts rigor resolution "after `attachResult` and before the budget check". Phase 5 puts the `needsHuman` check "after `attachResult`" without saying whether it runs before or after the budget check. If it runs after, a blocked step at the budget limit halts as "Step budget spent" and the human reason never reaches the report. Also `maxTotalSteps + budgetDelta` has no lower bound: a project override of `maxTotalSteps` at 4 or less gives a non-positive budget at `lean` and a halt before the first step.
- **Fix**: State the order (attach, rigor, `needsHuman`, budget) and clamp the effective budget to at least 1.
- **Decision**: PENDING
