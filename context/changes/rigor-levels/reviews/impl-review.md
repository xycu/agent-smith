<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Rigor Levels, Churn Risk and Skip Logging Implementation Plan

- **Plan**: context/changes/rigor-levels/plan.md
- **Scope**: Full plan (6 of 6 phases)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

Reviewed `git diff main...HEAD` (commits 690b214, 63c956a, e36f95f, d59a8a3, 1edfe99, da343f1, 9ce3291) against the plan, its Revision Notes, `reviews/plan-review.md` (round 2, F1-F7), the owner decisions in `research.md`, the AGENTS.md hard rules and PRD FR-002, FR-003, FR-010. `route.mjs` (867 lines), `policy.json`, all four test files, ADR-003, ADR-004, `SKILL.md`, README, AGENTS.md and the PRD diff were read in full. No sub-agents: the router is one file and the risky claims were run, not inferred.

## Verification run

| Check | Result |
|-------|--------|
| `node --test skills/10x-pipeline/test/*.test.mjs` (Node v24.19.0) | `tests 62, suites 0, pass 62, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 11576` |
| 6.3 grep (`SKILL.md` names no model, effort or absolute tier) | passes (no match) |
| `git diff --name-only main -- context/archive .claude-plugin` | 0 files (6.5, 6.6 hold) |
| `node skills/10x-pipeline/scripts/route.mjs risk rigor-levels` on this repo (3.3) | `source: window`, `hot`: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`; no `context/**` or `*.md` path; `planHits` the same two; `level: standard` |
| Node 18 (`npx -y node@18 --test ...`, rows 2.5, 3.4, 6.10) | NOT RUN. No Node 18 on this machine (fnm has 24.18 and 24.19 only). The `npx` fetch was denied by the permission classifier and not retried. Treat as unverified. |
| Banned-API grep over `route.mjs` and `test/*.mjs` (`toSorted`, `toReversed`, `toSpliced`, `.with(`, `groupBy`, `Set` methods incl. `intersection`/`union`, `import.meta.dirname`/`filename`, `partialDeepStrictEqual`, `mock.timers`, `findLast`, `.at(`, `structuredClone`, `Object.hasOwn`, `withResolvers`, `replaceAll`, regex `v` flag) | no hits. Imports are `node:fs`, `node:path`, `node:os`, `node:child_process`, `node:url`, `node:test`, `node:assert/strict` only. One caveat in O1. |
| Working tree after review | clean (`git status --short` empty) |

### Mutation checks (tests really detect what they claim?)

Each mutation was applied, the suite run, then restored with `git checkout --`.

| # | Mutation | Expected | Actual |
|---|----------|----------|--------|
| 1 | Budget check counts skips: `executed(log).length >= budget` to `log.length >= budget` | red | RED: `skips do not use budget` fails (38 pass, 1 fail) |
| 2 | Drop the freeze: `skipAt > planAt && (skippable \|\| codeRan)` to `skipAt > planAt && skippable` | red | RED: `a skip between failed attempts keeps the failure streak` and `after a failed implement, a rigor rise does not bring plan-review back` fail (37 pass, 2 fail) |
| 3 | `init` stops keeping stored fields: `{ ...prev, id, goal }` to `{ id, goal }` | red | RED: 4 fail (`init keeps every stored meta field`, `a second init without the flag keeps the level`, `--rigor lean on resume does not lower standard`, `init stores baseSha once ...`) |
| 4 | Effort floor applied BEFORE the `minTier`/`maxTier` clamp instead of last | red | GREEN (39 pass, 0 fail). Gap, see F2. |
| 5 | Delete the bare-keyword check in `ruleProblems` (`if (bare) problems.push(...)`) | red | GREEN (6 pass, 0 fail). Gap, see F3. |

Probe of the plan-path parser (scratch script, outside the repo, 9 commits touching `src/hot.js`, lean goal `fix typo`):

| `**File**:` line | `planHits` | Result |
|------------------|-----------|--------|
| `` `src/hot.js` `` | `src/hot.js` | standard, plan-review runs |
| `` `./src/hot.js` `` | `src/hot.js` | standard, plan-review runs |
| `` `src/` `` | none | lean, plan-review SKIPPED |
| `` `src/*.js` `` | none | lean, plan-review SKIPPED |
| `src/hot.js (new section)` (no backticks) | none | lean, plan-review SKIPPED |
| `` `/abs/src/hot.js` `` and `` `SRC/hot.js` `` | none | lean, plan-review SKIPPED |

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Plan Adherence: every planned change in phases 1-6 exists and matches. Revision-note items F1 to F9 and round-2 observations F2 to F7 are implemented: `tformat:@@`, `--relative`, `since` regex, `baseSha` regex and `--` terminator, explicit `maxBuffer`, `HOME` plus `realpath` in `gitEnv()`, `{ ...prev, id, goal }`, ack on the log entry, order attach / rigor / `needsHuman` / budget, budget clamped to at least 1, `meta.json` and `rigor` shape guards, `^\*\*Files?\*\*:` anchor, `try/catch` around `main` printing JSON. Scope Discipline: nothing from changes 2 to 4 leaked in (no pre-plan steps, no executors, no archive adapter; `prompts/*.md` untouched and only checked). `context/archive/`, `.claude-plugin/` and (by absence from the diff) `~/.claude/skills` are untouched. No npm dependency. Routing stays in `route.mjs` and `policy.json`. `SKILL.md` adds only relative wording ("one tier down", "the floor in `rigor.minEffort`"), no model, effort name or absolute tier.

Counts with skip entries were traced line by line and hold: budget (`executed(log).length`, `route.mjs:707`), `n` (`ran.length + 1`, `:754`), `trailingFailures` (called with the executed list in `tierFor`, `:652`), `count()` and `lastIdx` (inside `decide` on the executed list, `:501`), `attachResult` (`:236`), `simpleSignal` (skip has no `ok`), report rows, `Steps:` and `Skipped:` totals (`:153-186`), `status` (`:796`), `endRun` step counts. `meta.rigor` persists across `init`. The skip freeze keys on `codeRan` and fails safe: no skip is ever written unless `source` is `window` or `all-history` and `planPaths >= 1` (`:540-541`). The signals sanitizer keeps only `rigor` (a policy level) and `needsHuman` (string, squashed whitespace, 300 chars; `true` becomes generic text), strips raw `signals` from the stored result, and `needsHuman` halts once via the log-entry ack.

## Findings

### F1 — A plan path that is a directory, a glob or a path with a trailing note is never matched, so `lean` can skip plan-review for a change on a hot file

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:459-473 (`planPaths`), :480 (`planHits`), :540-541 (skip gate)
- **Detail**: `planHits` is an exact string match of each plan token against the hot set. The skip gate counts any token as a "measured" path (`planPaths >= 1`). A `**File**:` value that names a directory (`` `src/` ``), a glob (`` `src/*.js` ``), an absolute or differently-cased path, or an unbackticked path followed by a note (`src/hot.js (new section)`, which falls to the comma-split branch and keeps the note) counts as a path but can never hit. The probe above shows each of these skipping plan-review at `lean` on a repo where the touched file has 9 of 10 commits. This is the FR-010 failure the round 1 fix (F2) closed for "no path" and round 2 F1 closed for `**Files**:`. It is narrower here, because the shipped plan format backticks file paths and `10x-plan` normally writes them that way, and it fails open only for `lean` plus a skip. Later protection is weak: the skip freezes once implement runs, so a diff hit after implement raises rigor but cannot bring plan-review back; impl-review still runs.
- **Fix**: In `planPaths`/`measureRisk`, treat a token as a hit when it equals a hot path, is a directory prefix of one (`token` ends with `/` or matches `hot.startsWith(token + "/")`), or matches as a glob via the existing `globToRegex`; for non-backticked tokens strip a trailing parenthetical note before comparing. Add one test per form (directory, glob, annotated path) next to `the plan paths are read from both **File**: and **Files**: lines`.
  - Strength: closes the hole with the glob helper that already exists; keeps exact match for the common case.
  - Tradeoff: a directory token now raises rigor for every hot file under it, which over-flags broad plans (raise-only, so the safe direction).
  - Confidence: HIGH — probed locally; each form reproduces.
  - Blind spot: real `10x-plan` output was not sampled beyond this repo's own plans, so how often non-backticked paths occur is unmeasured.
- **Decision**: PENDING

### F2 — The "effort floor is applied last, so it wins over `maxTier`" property is not pinned by any test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/route.mjs:663-673 (`tierFor`); skills/10x-pipeline/test/route.test.mjs:173-238
- **Detail**: Plan Phase 2 change 3 says the floor is applied after the `minTier`/`maxTier` clamp "so it wins over `maxTier` and over every discount". The code does this correctly. But mutation 4 (move the floor before the clamp) leaves all 39 route tests green: with the shipped policy `maxTier` (5 for plan-review and impl-review) is above every floor, so no test can tell the orders apart. The discount-versus-floor case is covered (`simple is false where the floor undid the discount`); the `maxTier` case is not. A later refactor could reorder the two and nothing would fail.
- **Fix**: Add a test with a policy override such as `{ steps: { "plan-review": { maxTier: 1 } } }` at `standard`, asserting `plan-review` still gets tier 3 and `tierWhy` names the floor.
- **Decision**: PENDING

### F3 — Two of the six negative rule fixtures pass for the wrong reason, so the bare-keyword check is untested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/rules.test.mjs:70-82 (and the check at :32-33)
- **Detail**: The plan says the negative fixtures prove the checker rejects "an unbolded `MUST`" and "`SHALL`". The fixtures `**GIVEN** a **WHEN** b **THEN** you MUST c` and `... you SHALL c` contain no bold keyword at all, so they are already rejected by `no bold keyword`. Mutation 5 deletes the `unbolded keyword` check and the suite stays green (6 of 6). The check matters in practice for a line like `**THEN** you **MUST** do x and SHOULD y`, which has exactly one bold keyword plus one bare one; nothing tests that.
- **Fix**: Change the two fixtures to carry one valid bold keyword plus a bare one (for example `... **THEN** you **MUST** c and SHOULD d` and `... **THEN** you **MUST** c, as SHALL be`), and assert the problem text names the bare keyword.
- **Decision**: PENDING

### F4 — Node 18 is unverified, and `after` from `node:test` needs 18.8 or later

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/route.test.mjs:2, churn.test.mjs:2; plan rows 2.5, 3.4, 6.10
- **Detail**: No Node 18 run happened here (see Verification run), so rows 2.5, 3.4 and 6.10 stay open, and the PR must say Node 18 is unverified. The grep for the plan's ban list is clean and no Node 20+ API was found. One residual: the tests import `after` from `node:test`, which exists from Node 18.8 (and 16.18); Node 18.0 to 18.7 would fail at import. AGENTS.md says "Node 18+", so the stated floor is slightly below what the suite needs.
- **Fix**: Run `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` once outside this sandbox; if the floor matters, state "18.8 or later" for the tests in AGENTS.md or drop `after` for a per-test `try/finally`.
- **Decision**: PENDING

### F5 — `simple: yes` is still reported where the clamp or the lean offset absorbed the discount

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:655, :675
- **Detail**: `simple` is `discount > 0 && !floorRaised`. At `lean` with a simple change, `impl-review` is 3 - 1 (discount) - 1 (offset) = 1, clamped to 2, floor 2, `floorRaised` false, so `simple` is true although the tier equals what the offset alone gives. This is plan-review round 2 F4, which the plan did not take up; the implementation follows the plan wording ("the floor never leaves a stale yes"). The report column therefore can still claim a saving that did not happen on this path (pre-existing for the clamp, new for the offset).
- **Fix**: Define `simple` as "final tier is lower than the tier computed without the discount", or note the limit in the report legend.
- **Decision**: PENDING

### F6 — Small additions and doc gaps outside the plan text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: route.mjs:541 (`plan.autoDone === 0`); AGENTS.md "Project Structure" router bullet; context/foundation/roadmap.md S-03
- **Detail**: (a) The skip gate also requires `plan.autoDone === 0`, which the plan does not state; it is benign and conservative (no skip once rows are checked). (b) AGENTS.md still describes the router as "`init`, `next`, `status`" in Project Structure while Commands lists `risk`. (c) The S-03 roadmap row moved `ready` to `in-progress`, which the plan assigns to the implement step, and `change.md` is `implemented` while S-03 is not `done`; that is normal for a branch not yet merged.
- **Fix**: Add `autoDone === 0` to the Phase 4 text in the plan or the ADR; add `risk` to the AGENTS.md router bullet.
- **Decision**: PENDING

### F7 — The skip-loop guard and the `needsHuman` text path have no test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: route.mjs:713-718 (`Router error: skip loop`); :697-703 (`needsHuman` halt reason)
- **Detail**: The skip-loop halt is unreachable with the shipped policy (a skip is frozen as handled after it is written), so it is dead-defensive code without a test; the plan lists the behavior but no case for it. Separately, the `needsHuman` text (up to 300 characters, written by a subagent) is placed in the `halt` reason that the orchestrator model reads. It is length-capped and whitespace-squashed, and SKILL.md tells the orchestrator to STOP, so the risk is low; content is not filtered.
- **Fix**: Either drop the guard's claim of coverage in the plan or force it with a policy override test; optionally quote the text as data in the SKILL.md `halt` line (it already says "Show the quoted text").
- **Decision**: PENDING

### F8 — Manual rows are all pending; non-git route tests are not fully hermetic

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress rows 1.3, 2.4, 2.5, 3.3, 3.4, 4.3, 5.4, 6.7-6.12; test/route.test.mjs:17-268, :450-558
- **Detail**: All 13 Manual rows are `[ ]`, none claimed done, so there is no rubber-stamping. Evidence found in this review: 3.3 (`risk rigor-levels` output above), 2.4/4.3/5.4 are exercised by tests (`tierWhy names the floor`, `report lists the skipped step`, `the plan prompt carries the three rules`); 6.8 to 6.12 read consistently in ADR-003, PRD FR-002/FR-010/Open Question 11 and `change.md`. The rigor, effort-floor and signals tests call the router without `gitEnv()`, so they inherit the developer's git environment and `TMPDIR`; none asserts on git-derived results (plans there name no `**File**:` paths), so a `TMPDIR` inside another repo cannot change a result today, but the hermetic guarantee only covers `churn.test.mjs` and the skip tests.
- **Fix**: Tick the manual rows when a human confirms them; pass `gitEnv(project)` through `init`/`next` in `helpers.mjs` by default.
- **Decision**: PENDING
