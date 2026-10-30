<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Rigor Levels, Churn Risk and Skip Logging Implementation Plan

- **Plan**: context/changes/rigor-levels/plan.md
- **Mode**: Deep (done in the main thread, no sub-agent: the router is 505 lines and was read in full)
- **Date**: 2026-10-30
- **Verdict**: REVISE
- **Findings**: 1 critical, 6 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Paths: 14/14 existing paths and files the plan reads or edits exist (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, `prd.md`, `roadmap.md`, ADR-001, ADR-002, `plan-brief.md`, `research.md`, `prompts/*.md`); the new files (tests, ADR-003, ADR-004) are correctly marked as new. Symbols: `attachResult`, `lastIdx`, `trailingFailures`, `cleanUsage`, `tierFor`, `parseFlags`, `buildReport`, `endRun` and all cited `route.mjs` and `policy.json` line numbers check out. Roadmap lines cited as `:46-47` are `:47-48` (off by one, harmless). `../life-to-lore/docs/adr/ADR-012-prompt-rules-as-scenarios.md` is not present on this machine, so the source ADR was not re-read (the research is the only witness). Brief and plan agree except for one claim (F3) and one stale line (F8). Checked on the real prompts: all 6 `prompts/*.md` files have no stray bold keyword and no bare `SHALL|REQUIRED|RECOMMENDED|OPTIONAL` outside `**GIVEN**` lines, so the planned Phase 1 test will pass on them. No `contract-surfaces.md` and no `lessons.md` exist, so those checks were skipped.

## Findings

### F1 — The planned `git log` command is invalid, so churn would always read "unavailable"

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, change 2 (Churn computation)
- **Detail**: The plan specifies `git log --no-merges --since=<since> -n <maxCommits> --format=@@ --name-only <rev>`. Run in this repo, `--format=@@` fails with `fatal: invalid --pretty format: @@` (a format string without a `%` placeholder is read as a named format). The plan says any git failure yields "unavailable" and no flag, so the code would swallow this error: every run would report `unavailable`, nothing would ever be hot, and `lean` would skip plan-review for every change, including those on hot paths. The research dry run used `--format=` (empty), which works. `--format=tformat:@@` works (checked here), and so does `--since=90.days` (36 commits).
- **Fix**: Use `--format=tformat:@@` (or `--format=%x00` and split on NUL), and add a churn test that asserts `source` is `window` on a repo with 10+ recent commits, so a swallowed git error cannot pass as "no hot paths".
- **Decision**: PENDING

### F2 — Every failure to measure risk lets `lean` skip plan-review, with a reason that hides it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 (churn, plan-path input), Phase 4, change 2 (skip reason)
- **Detail**: FR-010 says an elevated-risk change never runs at `lean`. The plan lets the skip happen whenever no hot path is *found*, and several cases look the same as "nothing is hot": (a) `git` missing, no commits, or `baseSha` no longer reachable after a rebase, all mapped to "unavailable, no flag"; (b) a plan with no parsed `**File**:` lines ("contributes nothing"), for example a differently formatted plan; (c) a project root that is a subdirectory of the git repo, where `git log --name-only` prints repo-root-relative paths and the plan's `**File**:` paths are project-relative, so the intersection is always empty; (d) a mistyped `risk.churn.since`, which git accepts silently (`--since=bogus` returned 0 commits here) and which then falls back to all history. The skip entry always reads `rigor lean: plan-review skipped`, and "churn unavailable" is recorded nowhere the plan names (the report shows no churn source), so a reader of `report.md` cannot tell a measured "not hot" from "could not measure".
- **Fix**: Skip only when the churn source is `window` or `all-history` AND the plan yielded at least one path; otherwise run plan-review at `standard`. Normalize paths with `--relative` (or `git rev-parse --show-prefix`). Put the source and the path count in the skip `reason` and in `meta.rigor.by`. Strength: closes the FR-010 hole at the cost of about 10 lines; plan-review then runs for every project without usable history, which is the conservative direction. Tradeoff: young repos never get the `lean` saving until they have 10 commits. Confidence: HIGH — follows the owner rule "elevated risk never runs at lean". Blind spot: whether the owner wants `lean` to work in repos with no history (the research says "do not flag").
- **Decision**: PENDING

### F3 — The rule for when a skipped plan-review comes back contradicts the brief and can fire mid-implementation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4, change 2 vs. "Details the research left open" and plan-brief "Open Risks"
- **Detail**: The plan and the brief both say plan-review is skipped "only before implementation starts; a rise after code exists does not bring it back". The mechanism is `plan.autoDone > 0`, which is not the same thing. Case: `lean`, skip, `implement` runs and fails without checking a row (autoDone still 0). One failed step raises rigor to `standard` (Phase 2), the handled flag lapses, and `decide()` returns `plan-review` for a plan that is already half implemented, possibly with partial commits. A `RETHINK` or `REVISE` verdict then triggers `plan-revise` while `autoDone === 0` (`route.mjs:299`), re-planning under existing code. The plan's own test list ("a rigor rise before any automated row is done brings plan-review back") encodes this.
- **Fix A ⭐ Recommended**: Freeze the skip once any `implement` or `fix` entry exists in the log (not once a row is done)
  - Strength: matches the sentence in the plan and brief; impl-review still covers the change; no re-plan on top of code.
  - Tradeoff: a `lean` run that fails its first implement attempt gets no plan-review even though rigor rose.
  - Confidence: HIGH — one condition in `decide()`, and `lastIdx(log, ["implement","fix"], false)` already exists in spirit.
  - Blind spot: None significant.
- **Fix B**: Keep the `autoDone` rule and change the plan and brief text to say "before any automated row is done"
  - Strength: more review after a failure.
  - Tradeoff: costs a step, and the re-plan-over-code path stays reachable.
  - Confidence: MED — not tested against `plan-revise` with partial work.
  - Blind spot: Behavior of `10x-goal-implement` after a plan revision.
- **Decision**: PENDING

### F4 — Where the `needsHuman` ack lives is not decided, and `init` keeps only a whitelist of `meta.json` fields

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 5, change 1; Phase 2, change 2 (`init` persistence)
- **Detail**: Phase 5 says the router checks "no `needsHumanAck`" and "sets the ack", but not on which object. Phase 2 and 3 make `init` keep `rigor` and `baseSha` only, and `init` still writes a fresh `{ id, goal, ... }`. If the ack goes into `meta.json`, the resumed `init` drops it and the same halt repeats forever, which the planned test ("a following `init` does not halt again for the same entry") is meant to catch but the plan does not prevent. The same whitelist style will break again for every field changes 2 to 4 add (`outcome`, frame state, archive state).
- **Fix**: Store the ack on the log entry (the log is router-owned and survives `init`), and make `init` write `{ ...prev, id, goal }` instead of a whitelist; `next()` already deletes `outcome` when it continues. State both in Phase 2 and Phase 5.
- **Decision**: PENDING

### F5 — Node 18 compatibility is asserted but never checked, and the likely traps sit in the new code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Testing Strategy (last paragraph); Phase 3 (hot-set math, path intersection); Phases 1 to 5 (tests)
- **Detail**: AGENTS.md says the router must run on Node 18+. The plan says the suite "was not run on 18" and offers no way to run it there. Written on Node 24, the new code will naturally reach for APIs missing in 18: `Array.prototype.toSorted` (the percentile step sorts counts), `Set.prototype.intersection` (plan paths against the hot set), `Object.groupBy`, `import.meta.dirname` (20.11+), the regex `v` flag (glob matcher), and in tests `assert.partialDeepStrictEqual` or `mock.timers`. All are silent on Node 24 and crash on 18, and the dry-run phrase "the shell glob works on Node 18" covers only the test invocation.
- **Fix**: Add to Phase 2 and 3 contracts a short ban list (use `[...].sort()`, plain loops over `Set`, `fileURLToPath`) and a manual criterion that runs the whole suite on Node 18 (for example `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs`, which is a run-time tool, not a repo dependency). If that cannot be run, record the Node 18 status as unverified in the PR.
- **Decision**: PENDING

### F6 — Manual check 2.4 contradicts the tier math, and the `simple` flag will mislead after the floor

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 3 (`tierWhy`) and Success Criterion 2.4
- **Detail**: For `init demo --goal "fix typo"` the plan tier is 4 − 1 (plain bump) − 1 (simple discount) = 2, which equals the `lean` floor (medium, tier 2). The floor changes nothing, and if the reason is added only when the floor raises the tier, the text 2.4 expects ("the tier text mentions the effort floor") is absent. Separately, at `standard` the floor undoes the simple-change discount on plan-review (base 2, minus 1, raised to 3), yet `entry.simple` and the report column still say "yes", so `report.md` claims a saving that did not happen.
- **Fix**: State that `tierWhy` always names the floor for interactive steps (for example `floor medium (tier 2)`), and set `simple` only when the discount survived the floor, or add a `floored` marker next to it.
- **Decision**: PENDING

### F7 — Churn and skip tests have unstated fixtures that make them flaky or impossible as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3, change 5; Phase 2 and 4 tests
- **Detail**: (a) The window fallback case ("fewer than `minCommitsInWindow` commits falls back to all history") needs commits older than 90 days. Commits made in a test are all dated now, so the test needs `GIT_COMMITTER_DATE` and `GIT_AUTHOR_DATE` (git's `--since` reads the committer date), which the plan never mentions. (b) Scratch repos inherit the developer's global git config and any parent repository: `commit.gpgsign`, hooks, `init.defaultBranch`, or a `TMPDIR` inside a repo all change results. Needed: `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` set to a null file, `GIT_CEILING_DIRECTORIES`, `-c commit.gpgsign=false`. (c) The budget test (halt cites 10, 14 and 18 spent) and the "two failed implement runs with a skip between them" case need a pre-filled `run.jsonl` of 10 to 18 entries. AGENTS.md says nobody writes `run.jsonl` by hand; scratch fixtures are fine, but they pin the log schema, so the helper should build them by calling `next` or document that it writes the schema directly.
- **Fix**: Add the three fixture rules to the Phase 3 and Phase 2 test contracts, and state that `helpers.mjs` owns log fixtures in one place.
- **Decision**: PENDING

### F8 — Smaller gaps in the skip loop, thresholds, migration and a stale brief line

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4, change 1; Phase 2, change 1; Migration Notes; plan-brief
- **Detail**: (1) `next()` re-decides "at most three times" after a skip, but the plan does not say what happens when the third call still returns a skip (halt with a router error is the safe choice). (2) `rigor.fromPhases` (3, 6) copies `complexity.phaseThresholds` (3, 6); a project override of one will drift from the other. Reading the thresholds from one place avoids that. (3) Migration: a run in flight when the router is upgraded gets `baseSha` = HEAD at the first `init` after upgrade, so the diff input misses commits made earlier; say so in Migration Notes. (4) The plan keeps FR-010's "halt at the highest level" out of scope (the plan rules out halting by rigor alone); the PRD edit in Phase 6 must keep that tail as a recorded deferral, not delete it. (5) `change.md` says "signals only add steps or raise rigor", but the plan adds a `needsHuman` stop; update the `change.md` scope line in the same change. (6) plan-brief says a Follow-up 4 does not exist in the research; the file now has one.
- **Fix**: Add one line for each of these to the relevant phase or note.
- **Decision**: PENDING

### F9 — Two doc checks are weaker than their wording

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6 criteria 6.3; Phase 1 change 2 vs. change 1
- **Detail**: Criterion 6.3 says `SKILL.md` names no "effort level" but the grep only looks for `xhigh`, so `high`, `medium`, `low` and `max` pass. Also ADR-004 will have to show bad-rule examples (it states the form and what is rejected). The Phase 1 test checks every line containing `**GIVEN**` in ADR-004, so an example of a bad rule in the ADR fails the ADR's own test. The negative fixtures are in the test file only.
- **Fix**: In 6.3 grep for `\b(low|medium|high|xhigh|max)\b` next to "effort" (or list the exact allowed phrases), and tell ADR-004 to show bad examples without the `**GIVEN**` marker or in a fenced block that the checker skips.
- **Decision**: PENDING
