# Rigor Levels, Churn Risk and Skip Logging Implementation Plan

## Overview

Give every pipeline run a rigor level (`lean | standard | thorough`) that the router derives from cheap signals, raises but never lowers, and uses to decide three things: whether plan-review runs, how large the step budget is, and the lowest effort an interactive toolkit skill may get. Risk comes from git history: paths that change very often (churn) raise rigor, so a change on a hot path never runs at `lean` (FR-010). A skipped step is logged in `run.jsonl` with a reason and shown in `report.md`, with every count kept correct. The subagent RESULT line gains an optional, sanitized `signals` object. Rules written into prompts follow the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword, and a `node:test` check enforces it.

This is change 1 of 4 (split from `rigor-gated-routing`). It writes the ADR-003 skeleton that changes 2 to 4 extend.

## Current State Analysis

- `decide()` is a linear chain with no skip path (`skills/10x-pipeline/scripts/route.mjs:265-357`). Plan-review runs whenever its file is stale (`:289-294`).
- `init` rewrites `meta.json` to `{ id, goal }` (`route.mjs:491-497`), so any stored state, rigor included, is lost on every resume. `parseFlags` already accepts `--rigor` generically (`:24-33`) but only `init` reads flags.
- The step budget is a single `limits.maxTotalSteps` of 14, checked before `decide()` (`route.mjs:408-409`; `policy.json:48`).
- Every log helper assumes each entry is an executed step: `lastIdx` (`:230-235`), `trailingFailures` (`:237-245`), `count` (`:271`), `n: log.length + 1` (`:436`), `attachResult` halting on a last entry with no result (`:202-206`), `buildReport` rows and totals (`:143-168`), `status` (`:463-480`).
- `attachResult` stores the whole RESULT object, so an unvalidated `signals` key already reaches `run.jsonl`. Only `usage` is sanitized (`cleanUsage`, `:191-199`), which is the pattern for a `signals` sanitizer.
- Effort floors are static per step: `plan` `minTier` 2, `plan-review` 1, `impl-review` 2 (`policy.json:11-17`). The owner decided that all three ask questions, so they get an effort floor that depends on rigor (research.md, Follow-up 2, decision 1).
- `route.mjs` imports only `node:fs`, `node:path`, `node:url` (`:12-14`). It has no git access. `node:child_process` is a `node:` built-in and passes the AGENTS.md no-dependency rule.
- There is no test setup. AGENTS.md (Testing) says to exercise the router by hand. The `prompts/*.md` files (85 rules, all valid) are committed but not read by the router.
- The PRD still says plan-review is skipped "only on a clean rubric" (`context/foundation/prd.md:89`) and elevated risk comes from "configurable path rules" (`:108`). The roadmap already carries S-03 `rigor-levels` (ready) and S-04 merged into S-03 (`context/foundation/roadmap.md:47-48`).

## Desired End State

- `route.mjs init <id> [--goal ...] [--rigor lean|standard|thorough]` stores a rigor level in `meta.json`. A resume keeps it. It rises with phase count, failures, hot paths and a `signals.rigor` value, and never falls.
- At `lean`, a fresh plan skips plan-review: the router appends a skip entry to `run.jsonl`, goes on to implement, and `report.md` lists the skip with its reason. Any hot path in the plan raises rigor to at least `standard` first, so plan-review runs.
- The step budget is `limits.maxTotalSteps` plus a per-level delta. Interactive steps (`plan`, `plan-review`, `impl-review`) never get an effort below the level's floor.
- A RESULT `signals` object is sanitized into `run.jsonl`; `signals.needsHuman` halts the run once with a report.
- `node --test skills/10x-pipeline/test/*.test.mjs` passes and covers rigor, churn, skips, signals and rule form.
- ADR-003 (design skeleton) and ADR-004 (rule format) exist. `SKILL.md`, `README.md`, `AGENTS.md` and the PRD match the new behavior.

Verify with the test suite, then one scratch-folder run (AGENTS.md, Testing).

### Key Discoveries:

- Rigor must survive `init`, so `init` writes `{ ...prev, id, goal }` instead of `{ id, goal }` (`route.mjs:497`). It keeps every stored field (`rigor`, `baseSha`, and whatever changes 2 to 4 add) instead of a whitelist; `next()` already deletes `outcome` when a run continues (`route.mjs:414-418`).
- A skip entry has no `result`, no `ok`, no `n` and no `template`. That keeps `simpleSignal` (`:363`, `:369`, which tests `e.ok === false`) and the `plan-revise` count (`:300`) correct without edits. Every other helper must filter skip entries or accept them as fresh (table in Phase 4).
- The effort floor can be written in effort names, not tier numbers, so it survives a project's own `ladder` override. The router converts a name to the lowest ladder index with at least that effort.
- Churn must be counted up to the commit the run started from (`meta.baseSha`), or the run's own commits would make the files it touches look hot.
- Black-box tests through the CLI are the only option: `route.mjs` runs `main` on import (`:484-505`) and exports nothing. A read-only `risk <id>` subcommand makes churn testable and gives the owner a way to look at the numbers (Open Question 10, no calibration data).
- Rule form comes from `../life-to-lore/docs/adr/ADR-012-prompt-rules-as-scenarios.md`: one line, `**GIVEN** … **WHEN** … **THEN** …`, exactly one bold keyword, `MUST` only for hard limits.

## What We're NOT Doing

- Pre-plan steps (research, legacy research, domain brief, frame), their prompts wiring, the RETHINK/REVISE loops and frame authority over `needsHuman`. That is change 2 (`pre-plan-steps`). `skills/10x-pipeline/prompts/*.md` are only checked for rule form here, not loaded.
- Per-phase executors, manual-row automation, the tdd/e2e skip-flip check and the "third attempt re-plans" loop. Change 3 (`phase-executors`).
- The archive adapter, `verify-archive` and lesson candidates. Change 4 (`archive-and-lessons`).
- Skipping any step other than plan-review. impl-review always runs; at `lean` it only gets a lower tier.
- A halt for a human "at the highest level" by rigor alone (FR-010 tail). The halt is the generic `signals.needsHuman` path.
- LLM-scored complexity (FR-011), churn calibration (no run data exists), and any change to `~/.claude/skills`, the toolkit or `context/archive/`.
- Rule ids in code (ADR-012 keeps them in a TypeScript `rule()` helper; agent-smith has none).
- Adding rigor-dependent behavior to `thorough` beyond its larger budget and its churn trigger. Later changes add gates that use the level.

## Implementation Approach

Build bottom-up so each phase leaves a green test suite.

1. Rule form first: it is independent, and it guards the prompt text that Phase 5 rewrites.
2. Rigor core next: the level, its persistence, the budget and the effort floor. Everything else hangs on it. This phase also creates the CLI test harness.
3. Churn: the only phase that touches git. It feeds rigor.
4. Skip entries and the `lean` plan-review skip: needs rigor (Phase 2) and churn (Phase 3), because a hot path must prevent the skip.
5. Signals: sanitizer, `signals.rigor`, `needsHuman` halt, and the new prompt suffix rules.
6. Docs and sync last, once the behavior is fixed.

Settled by research (no re-opening): `lean` skips plan-review; risk paths are churn from git history; skips live in `run.jsonl`; the effort floor covers plan, plan-review and impl-review (high or above at `standard`/`thorough`, medium or above at `lean`); rule form and `node:test`; ADR-003 skeleton.

Details the research left open, decided here and listed in the brief:

- Start level from the goal class: `short` is `lean`, `plain` and `hard` are `standard`. `--rigor` replaces this start level at the first `init`; afterwards it only raises. Raising inputs (phases, failures, churn, signals) still apply on top of an explicit `lean`.
- Phase count 3 or more is at least `standard`; 6 or more is `thorough`. One failed step is at least `standard`; 3 or more is `thorough`.
- Budget deltas on `limits.maxTotalSteps`: `lean` -4, `standard` 0, `thorough` +4.
- At `lean`, impl-review gets one more tier off (floor still applies).
- Plan-review is skipped only before implementation starts. The skip is frozen once any `implement` or `fix` entry exists in the log, even a failed one: a later rigor rise does not bring plan-review back (it would review a half-built change, and a `REVISE` verdict could re-plan over existing code). impl-review covers that change.
- A skip needs a measured risk: the churn source is `window` or `all-history` and the plan names at least one path. When git history is missing, too short or unreachable, or the plan yields no path, churn flags nothing, the run records "churn unavailable" and plan-review runs (rigor stays as resolved). This keeps FR-010 (elevated risk never runs at `lean`): a risk that could not be measured is not read as "not hot".

## Phase 1: Rule form — ADR-004 and `node:test` check

### Overview

Record the rule format as an ADR and enforce it with a test, before any prompt text changes. This also introduces `node:test` to the repo.

### Changes Required:

#### 1. ADR-004 prompt rules as scenarios

**File**: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`

**Intent**: Copy the decision of life-to-lore ADR-012 into an agent-smith ADR in the house style of ADR-001 and ADR-002 (bullet header with Status, Date, Deciders, Origin). State the form, the five keywords, the `MUST` scarcity rule and the test. Name what differs from the source: no rule ids, no `PROMPT_VERSION`, and the checked files are `policy.json` prompts and `skills/10x-pipeline/prompts/*.md`.

**Contract**: Sections Context, Decision, Alternatives considered, Consequences, Sources. Attribute `ADR-012` and `CLAUDE.md:28` of life-to-lore. The rule form is one line: `**GIVEN** <context> **WHEN** <trigger> **THEN** <behavior>` with exactly one of `**MUST**`, `**MUST NOT**`, `**SHOULD**`, `**SHOULD NOT**`, `**MAY**`. `SHALL`, `REQUIRED`, `RECOMMENDED`, `OPTIONAL` are never used. Persona or prose lines carry no keyword. Bad-rule examples in ADR-004 sit in a fenced code block, so the checker skips them; the negative fixtures stay in the test file.

#### 2. Rule-form test

**File**: `skills/10x-pipeline/test/rules.test.mjs`

**Intent**: One test per source checks every rule line of `policy.json` `prompts` (each string, split by newline) and every `skills/10x-pipeline/prompts/*.md` except `README.md`. A rule line is any line that contains `**GIVEN**`. For `policy.json` prompts and `prompts/*.md` also fail any line that holds a bold RFC keyword but no `**GIVEN**`, and any bare `SHALL|REQUIRED|RECOMMENDED|OPTIONAL`. For `docs/ADR/ADR-003-*.md` and `ADR-004-*.md` (when they exist) check only the lines that contain `**GIVEN**` outside fenced code blocks (a line between triple-backtick fences is skipped), because ADR prose may discuss the keywords and ADR-004 must show bad-rule examples. Include negative fixtures that prove the checker rejects a missing `WHEN`, two keywords, no keyword, an unbolded `MUST`, wrong order and `SHALL`.

**Contract**: An exported-in-file `ruleProblems(line)` returning an array of problem strings, empty when valid. Uses only `node:test`, `node:assert/strict`, `node:fs`, `node:path`. Run with `node --test skills/10x-pipeline/test/*.test.mjs` (shell glob, so it works on Node 18 and later without the directory-argument differences). The test code follows the Node 18 rules listed in Phase 2, change 2.

### Success Criteria:

#### Automated Verification:

- Rule-form test passes on all current rules and rejects the bad fixtures: `node --test skills/10x-pipeline/test/rules.test.mjs`
- ADR-004 has its required sections: `test $(grep -c '^## ' docs/ADR/ADR-004-prompt-rules-as-scenarios.md) -ge 4`

#### Manual Verification:

- ADR-004 reads clearly, credits life-to-lore ADR-012, and lists the differences from it

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Rigor core — level, persistence, budget, effort floor

### Overview

Add the rigor level and the places it takes effect, except the plan-review skip (Phase 4) and the churn and signal inputs (Phases 3 and 5). Create the CLI test harness.

### Changes Required:

#### 1. Policy keys

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the `rigor` block and mark interactive steps. Defaults reproduce today's budget at `standard`.

**Contract**: New top-level key and a new step flag:

```json
"rigor": {
  "levels": ["lean", "standard", "thorough"],
  "fromGoal": { "short": "lean", "plain": "standard", "hard": "standard" },
  "fromPhases": ["standard", "thorough"],
  "fromFailures": [{ "minFailed": 1, "level": "standard" }, { "minFailed": 3, "level": "thorough" }],
  "skipPlanReviewAt": ["lean"],
  "budgetDelta": { "lean": -4, "standard": 0, "thorough": 4 },
  "effortOrder": ["low", "medium", "high", "xhigh", "max"],
  "minEffort": { "lean": "medium", "standard": "high", "thorough": "high" },
  "tierOffset": { "lean": { "impl-review": -1 } }
}
```

`steps.plan`, `steps.plan-review` and `steps.impl-review` get `"interactive": true`. `skipPlanReviewAt` is read in Phase 4. Keys are camelCase, level values lowercase. `fromPhases` has no thresholds of its own: entry *i* is the level reached when the plan has at least `complexity.phaseThresholds[i]` phases (3 and 6 today), so one override cannot drift from the other.

#### 2. Rigor resolution and persistence

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Resolve the level at the top of `next()`, after `attachResult` and before the budget check. The level is the highest of: the stored level, the start level (`--rigor` value if given, else the goal class), the phase-count level, the failure level. Store it in `meta.rigor`, write `meta.json` only when it changed, and put `rigor` on every executed log entry. `init` writes `{ ...prev, id, goal }`, so `meta.rigor` and (from Phase 3) `meta.baseSha` survive and so does any field a later change adds; it validates `--rigor` before writing anything, and halts with JSON on an invalid or valueless flag. On resume a `--rigor` value can raise the stored level and request but never lower them.

**Contract**: `meta.rigor = { level, requested, by }`. `by` names the inputs that set the current level (for example `goal short`, `phases 3`, `failed steps 1`) and changes only when the level rises. Level order comes from `policy.rigor.levels`. `next()` budget is `limits.maxTotalSteps + (rigor.budgetDelta[level] ?? 0)`. Node 18 ban list for all new router and test code (this machine runs Node 24, where these work silently and crash on 18): no `toSorted`/`toReversed`, `Object.groupBy`, `Set` methods such as `intersection`, `import.meta.dirname`/`import.meta.filename` (use `fileURLToPath`), regex `v` flag; in tests no `assert.partialDeepStrictEqual` and no `mock.timers`. Sort with `[...a].sort()` and intersect with a plain loop over a `Set`. A malformed `rigor` policy block never throws a stack trace: wrap the command dispatch in one `try/catch` that prints `{ "action": "halt", "reason": "Router error: …" }` and exits 1.

#### 3. Effort floor and lean offset in `tierFor`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `tierFor` takes the rigor level. After the existing bumps and discounts, apply `rigor.tierOffset[level][step]`. After the existing `minTier`/`maxTier` clamp, if the step is `interactive`, raise the tier to the lowest ladder index whose effort is at least `rigor.minEffort[level]` in `effortOrder`. The floor is applied last so it wins over `maxTier` and over every discount. For an interactive step `tierWhy` always names the floor (for example `floor medium (tier 2)`), also when it changes nothing, so the reason text is stable.

**Contract**: Helper that maps an effort name to a ladder index (first index with `effortOrder.indexOf(entry.effort) >= effortOrder.indexOf(name)`; top index when none; unknown names ignored). With the shipped ladder this gives floor tier 2 at `lean` and 3 at `standard`/`thorough`. `plan` at `lean` stays reachable at tier 2 (base 4, minus 1 plain-goal bump, minus 1 simple discount), which equals the floor, so the floor changes nothing there. The returned `simple` flag (the report column) is true only when the discount survived the floor: where the floor raised the tier back over the discounted value (for example `plan-review` at `standard`: base 2, minus 1, floor 3) `simple` is false, so `report.md` never claims a saving that did not happen.

#### 4. Report and status show the level

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `buildReport` adds a `Rigor: <level> (<by>)` line under `Goal`. `status` adds a top-level `rigor` field read from `meta.json` without recomputing. The step table keeps its columns.

**Contract**: The `Outcome` and table layout of `report.md` stay as they are today.

#### 5. Test harness and rigor tests

**Files**: `skills/10x-pipeline/test/helpers.mjs`, `skills/10x-pipeline/test/route.test.mjs`

**Intent**: `helpers.mjs` builds a scratch project in `os.tmpdir()` (change folder with `change.md`, optional `plan.md`, optional policy override), runs `route.mjs` through `spawnSync(process.execPath, …, { cwd })`, parses the JSON, and writes `last-result.json`. It is the one place that owns log fixtures: `writeLog(project, entries)` writes `run.jsonl` directly in the router's schema (scratch projects only; AGENTS.md forbids hand edits of real runs, and a fixture pins the schema in one file), and tests that need N prior steps call it instead of looping `next`. It also owns the git environment for churn tests (`gitEnv()`, used in Phase 3). `route.test.mjs` starts with the rigor cases.

**Contract**: Cases: short goal starts `lean`; plain and hard-keyword goals start `standard`; `--rigor` sets the start; `--rigor foo` and a bare `--rigor` halt with JSON and write nothing; a second `init` without the flag keeps the level; `--rigor lean` on resume does not lower `standard`; a 3-phase plan raises to `standard`, 6 phases to `thorough`; one failed step raises to `standard`; budget differs per level (`halt` reason cites 10, 14, 18 spent, using a `writeLog` fixture of that many entries); effort floor: `plan-review` and `impl-review` never below tier 3 at `standard` and never below tier 2 at `lean`, `implement` unaffected; lean impl-review offset still respects the floor; `tierWhy` names the floor for `plan` on `init demo --goal "fix typo"` even though it changes nothing; `simple` is false for `plan-review` at `standard` when the floor undid the discount and true where it survived; a `meta.json` that is not an object and a non-array `rigor.levels` override give a JSON `halt`.

### Success Criteria:

#### Automated Verification:

- Rigor tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- `policy.json` parses and carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.rigor||!p.steps.plan.interactive||!p.steps["impl-review"].interactive)process.exit(1)'`

#### Manual Verification:

- In a scratch change folder, `init <id> --goal "fix typo"` returns a `run` for `plan` and the tier text mentions the effort floor; `status` shows the rigor level and `meta.json` holds `rigor`
- The whole suite passes on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` (`npx` fetches a run-time Node, not a repo dependency). If Node 18 cannot be run, record the status as unverified in the PR

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Churn risk paths

### Overview

Measure churn from git history and raise rigor when the plan, then the diff, touches hot paths.

### Changes Required:

#### 1. Policy keys

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add `risk` with the churn parameters from research Follow-up 2 and the rigor each hit count raises to. All values are uncalibrated and live in policy so a project can override them.

**Contract**:

```json
"risk": {
  "churn": {
    "since": "90.days",
    "maxCommits": 500,
    "minCommitsInWindow": 10,
    "exclude": ["context/**", "docs/**", "**/*.lock", "package-lock.json", "pnpm-lock.yaml", "assets/**", "**/*.md"],
    "hotPercentile": 80,
    "hotMinCommits": 3
  },
  "raise": [{ "minHot": 1, "level": "standard" }, { "minHot": 3, "level": "thorough" }]
}
```

#### 2. Churn computation

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add a small git layer (`node:child_process` `execFileSync`, no shell) and a glob matcher without dependencies. Compute the hot-path set from `git log --no-merges --relative --since=<since> -n <maxCommits> --format=tformat:@@ --name-only <rev>`, where `<rev>` is `meta.baseSha` (HEAD when unset). The format must be `tformat:@@`: a bare `--format=@@` has no `%` placeholder, git reads it as a named format and fails with `fatal: invalid --pretty format: @@` (checked on this repo), which the "any git failure is unavailable" rule would swallow and leave every run reading "unavailable". `--relative` makes the printed paths relative to the project root (the router's working directory), so they match the plan's project-relative `**File**:` paths even when the project is a subdirectory of the git repo. Count commits per path, drop `exclude` matches, take the `hotPercentile` value (nearest rank, `ceil(p/100 * N)` of the ascending non-zero counts) and keep paths whose count is at least that value and at least `hotMinCommits`. If the window holds fewer than `minCommitsInWindow` commits, repeat without `--since`; if that is still fewer, report no hot paths. Any git failure yields "unavailable" and no flag, never an exception. `since` is validated before it reaches git (digits plus `.day|.days|.week|.weeks|.month|.months|.year|.years`, or `YYYY-MM-DD`); anything else, such as a typo like `bogus` that git accepts silently, gives "unavailable" instead of quietly using all history. An unreachable `baseSha` (for example after a rebase) also gives "unavailable".

**Contract**: Hot-set math uses plain arrays and `Map`/`Set` loops (Node 18 ban list, Phase 2). Glob: `**/` matches zero or more directories, `**` matches anything, `*` matches non-slash characters, `?` one non-slash character, everything else literal. `meta.baseSha` is set once, from `git rev-parse HEAD`, at the first `init` that finds none; `init` keeps it afterwards. `risk.raise` picks the highest level whose `minHot` is at most the number of distinct hot paths touched. Rigor only rises.

#### 3. Plan-path and diff-path inputs

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Two inputs to the rigor level. After the plan exists: paths from the `**File**:` and `**Files**:` lines of `plan.md` (match each line with `^\*\*Files?\*\*:`, so a plan that lists one hot file under `**Files**:` is not under-read; take backtick-quoted tokens on the line; fall back to the comma-split text; strip a leading `./`). After at least one implement or fix step has run: `git diff --name-only --relative <baseSha> HEAD`, filtered by `exclude`. Both are intersected with the hot set. Add the hit names to `meta.rigor.by` when they raise the level.

**Contract**: The diff input runs only when `baseSha` is set and the log has an executed `implement` or `fix`. A plan with no `**File**:` or `**Files**:` lines contributes nothing and reports `planPaths` 0, which stops the `lean` skip (Phase 4).

#### 4. `risk` subcommand

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `route.mjs risk <change-id>` prints JSON `{ source, hot, planPaths, planHits, diffHits, level }` and writes nothing (`planPaths` is the number of paths read from the plan). It makes churn testable through the CLI and lets the owner inspect thresholds on a real repo.

**Contract**: `source` is `window`, `all-history` or `unavailable`. Usage text in the halt message lists the new command.

#### 5. Churn tests

**File**: `skills/10x-pipeline/test/churn.test.mjs`

**Intent**: Build scratch git repos and assert through `risk` and `next`. Skip the file's tests with a clear message when `git` is missing. Fixtures are hermetic: every git call goes through `gitEnv()` from `helpers.mjs`, which sets `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` to a null file, `GIT_CEILING_DIRECTORIES` to the scratch parent, fixed `GIT_AUTHOR_*`/`GIT_COMMITTER_*` names, and passes `-c commit.gpgsign=false -c init.defaultBranch=main`, so the developer's global config, hooks or a `TMPDIR` inside another repo cannot change a result. Old commits for the window-fallback cases are made with `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` set to a date older than the window (`--since` reads the committer date).

**Contract**: Cases: a plan that names a new test file under `**File**:` and a hot file under `**Files**:` reports the hot file in the plan paths (the `^\*\*Files?\*\*:` pattern); a repo with 10 or more recent commits reports `source` `window` (so a swallowed git error cannot pass as "no hot paths"); counts `[1,1,1,1,4,9]` give threshold 4 and two hot paths (the research dry run); `hotMinCommits` blocks a young repo; excluded globs (`context/**`, `**/*.md`, `package-lock.json`) never count; fewer than `minCommitsInWindow` commits in the window (old-dated commits) falls back to all history and reports `all-history`; still fewer gives no hot paths and `unavailable`; a project root that is a subdirectory of the git repo still matches plan paths (`--relative`); a mistyped `risk.churn.since` gives `unavailable`; an unreachable `baseSha` gives `unavailable`; a plan naming one hot file raises rigor to `standard` and three raise it to `thorough`; commits made after `baseSha` do not change the hot set; a diff hit after implement raises rigor; a directory that is not a git repo gives `unavailable`, no flag, no exception; an `exclude` override that is not an array is ignored without a stack trace.

### Success Criteria:

#### Automated Verification:

- Churn tests pass: `node --test skills/10x-pipeline/test/churn.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- `node skills/10x-pipeline/scripts/route.mjs risk rigor-levels` on this repo lists `route.mjs` and `policy.json` among the hot paths and no `context/**` or `*.md` path (counts differ from the research dry run because the history moved)
- The churn tests pass on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/churn.test.mjs` (unverified status goes into the PR if Node 18 cannot be run)

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Skip entries and the `lean` plan-review skip

### Overview

Add skip entries to `run.jsonl`, make every count and the report correct for them, and use them to skip plan-review at `lean`.

### Changes Required:

#### 1. Skip entry and log helpers

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A skip entry records a step the router decided not to run. Treat it like this in every spot that reads the log:

| Spot | Handling |
| --- | --- |
| `attachResult` | The target is the last executed (non-skip) entry. A skip after it never triggers the "no result" halt. |
| Budget in `next()` | Count executed entries only. |
| `n` of a new entry | Executed count + 1. Skip entries carry no `n`. |
| `trailingFailures` | Pass over skip entries. A skip between two failed attempts keeps the streak. |
| `lastIdx(..., okOnly)` | Skip entries never match for `okOnly`; plan-review freshness reads them through a dedicated check. |
| `count(step)`, `lastCode`, `struggled`, `revisions` | Run on the executed list. |
| `simpleSignal` | Unchanged: skip entries have no `ok`, so `e.ok === false` stays false. |
| `buildReport`, `status`, `endRun` result | Rows, `Steps: N` and `steps` count executed entries only. Skips get their own listing. |

**Contract**: Entry shape `{ "skipped": true, "step": "plan-review", "reason": "...", "rigor": "lean", "afterN": <executed steps before it>, "at": <ms> }`. No `n`, `template`, `ok` or `result`. `decide()` may return `{ skip: { step, reason } }`; `next()` appends the entry, writes the log, and calls `decide()` again, at most three times in one `next` so a bug cannot loop; if the third call still returns a skip, `next()` halts with `Router error: skip loop` and writes the report. A new resume-safe helper returns the executed entries.

#### 2. `lean` skips plan-review

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `decide()`, when plan-review is not fresh and the current level is in `rigor.skipPlanReviewAt`, return a skip instead of `plan-review`, but only when risk was measured: the churn source is `window` or `all-history` and the plan yielded at least one path (`planPaths` of Phase 3). Otherwise (git missing, short or unreachable history, no `**File**:` lines) plan-review runs with the reason `plan changed since last review; risk not measured (<source>, <N> plan paths)`, so a failure to measure is never read as "not hot". A skip entry written after the last successful plan step makes plan-review count as handled while the level is still skippable, or once any executed `implement` or `fix` entry exists after the skip (frozen, even a failed one). If rigor rises before any `implement` or `fix` entry exists, the handled flag lapses and plan-review runs; after one exists it does not. Downstream code (`needsReplan`, noisy-warning bump, clean-review drop) treats the review as absent after a skip. A fresh review file that already exists is used as before; nothing is skipped over it.

**Contract**: Reason text `rigor lean: plan-review skipped (churn <source>, <N> plan paths, none hot)`; the skip entry also carries `risk: { source, planPaths }` so `report.md` and `status` show how the decision was made (`meta.rigor.by` is left alone: it names only what raised the level). impl-review is never skipped. The `plan-revise` path cannot fire after a skip because no verdict exists.

#### 3. Report and status

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `report.md` gets a `## Skipped steps` section, shown only when a skip exists, with columns `After step`, `Step`, `Reason`, `Rigor`. The totals line gains ` · Skipped: K` when K is above zero and keeps `Steps: N` as the executed count. `status` marks skip entries with `skipped: true`.

**Contract**: Table layout of executed rows is unchanged.

#### 4. Skip tests

**File**: `skills/10x-pipeline/test/route.test.mjs`

**Intent**: Extend the suite with skip and interplay cases.

**Contract**: Cases: lean plus a fresh plan returns `implement` and logs one skip entry with `afterN` and a reason; the next executed entry has `n` 2 (not 3); skips do not use budget; two failed implement runs with a skip between them still trip `maxAttemptsPerStep`; `next` after a skip does not halt with "has no result"; no skip loop (plan-review is not asked for again); `standard` still returns `plan-review`; a plan whose `**File**:` names a hot path never skips; a rigor rise before any `implement` or `fix` entry exists brings plan-review back; a failed `implement` after a skip (no row checked) followed by a rigor rise does not bring plan-review back and no `plan-revise` follows; lean with unmeasured risk (not a git repo, or a plan with no `**File**:` lines) runs plan-review and logs no skip; `report.md` shows the `Skipped steps` section, `Steps:` equals the executed count, and `Skipped: 1`; `status` flags the skip; `init` on a log with a skip resumes cleanly; `simple` discount still applies when a skip is in the log.

### Success Criteria:

#### Automated Verification:

- Skip and interplay tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- On a scratch lean run, after the plan step's result is written, `next` returns `implement` and `report.md` lists the skipped plan-review with its reason

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 5.

---

## Phase 5: RESULT `signals` and the prompt suffix rules

### Overview

Sanitize an optional `signals` object, let it raise rigor or stop the run, and rewrite the unattended-subagent suffix as rules.

### Changes Required:

#### 1. Signal sanitizer and intake

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `cleanSignals(raw, policy)` next to `cleanUsage`. It keeps only known keys with valid types and drops the rest: `rigor` (a level from `rigor.levels`) and `needsHuman` (a non-empty string cut to a fixed length with whitespace squashed; `true` becomes a generic text). `attachResult` stores the clean object as `entry.signals` and removes the raw `signals` from the stored `result`. The rigor resolution (Phase 2) reads `signals.rigor` from executed entries as one more raising input. `next()` checks the last executed entry after `attachResult`: when it carries `signals.needsHuman` and no `needsHumanAck`, set `needsHumanAck: true` on that log entry, write the log, end the run with a `halt` that quotes the text, and write the report. The ack lives on the log entry, which is router-owned and survives `init`; it is not stored in `meta.json`.

**Contract**: Signals can raise rigor or stop the run. They cannot lower rigor, remove a step or add a skip. The ack lets a resumed `init` (which keeps all of `meta.json` and never touches the log) continue past a human-handled halt; the blocked step itself counts as a failed attempt as before. Unknown keys are ignored without error.

#### 2. Prompt suffix as rules

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Replace the "choose the recommended or most conservative option" sentence in `prompts.suffix` with rule lines, keep the commit sentence and the RESULT line, and show `signals` in the RESULT line. The rules are the research decision for interactive skills (Follow-up 2, decision 1, rules 3 and 4) plus a rigor signal rule.

**Contract**: Each rule is one line starting with `- `, in this form:

- **GIVEN** the skill would ask the user a question **WHEN** you have no human to answer **THEN** you **MUST** decide from researched best practice (codebase conventions, project docs, `lessons.md`, authoritative sources), cite the evidence, and list the decision as an assumption.
- **GIVEN** no evidence-backed answer exists **WHEN** you would have to guess **THEN** you **MUST** report status `blocked` with `signals.needsHuman` and the reason.
- **GIVEN** the change is riskier than the goal or plan suggested **WHEN** you write the RESULT line **THEN** you **MAY** add `signals.rigor` set to `standard` or `thorough`.

The RESULT line becomes `RESULT: {"status":"done|blocked|failed","note":"<one sentence>","assumptions":["..."],"signals":{"needsHuman":"<reason, only when blocked>","rigor":"standard|thorough"}}`, and the line says `signals` is optional.

#### 3. Signal tests

**File**: `skills/10x-pipeline/test/route.test.mjs`

**Intent**: Cover the sanitizer and the halt through the CLI.

**Contract**: Cases: unknown keys, a numeric `rigor`, an unknown level, an array in place of the object and an oversized `needsHuman` are dropped or cut; `run.jsonl` holds no raw `signals`; `signals.rigor: "thorough"` raises the level and `"lean"` after `standard` changes nothing; `needsHuman` halts once with a report path and sets `needsHumanAck` on the log entry (not in `meta.json`), and a following `init` does not halt again for the same entry; a RESULT without `signals` behaves as before; the `plan` prompt returned by `next` contains the three rule lines and the RESULT line. The Phase 1 rule-form test must pass on the new suffix.

### Success Criteria:

#### Automated Verification:

- Signal tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Rule-form test passes on the new suffix: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- The `prompt` returned for a `plan` step reads clearly: three rules, then the RESULT line with `signals`

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 6.

---

## Phase 6: Docs and cross-file sync

### Overview

Write ADR-003, update `SKILL.md`, `README.md`, `AGENTS.md` and the PRD, and check the roadmap. AGENTS.md requires `SKILL.md` and the README routing bullets to change with tier logic.

### Changes Required:

#### 1. ADR-003 skeleton

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: The shared design for the four changes, in the style of ADR-001 and ADR-002. Change 1 is written in full. Parts owned by changes 2 to 4 appear as a table (part, owning change, status `planned`) pointing to `context/changes/rigor-levels/research.md`, with no design text for them. Record the git write decision of change 4 as future work only.

**Contract**: Sections Context, Decision (rigor levels and inputs, churn risk, effort floor, skip entries, signals), Consequences (cost of plan-review now at tier 3 at `standard`, uncalibrated numbers, churn blind spots), Alternatives considered (keep plan-review always on, derive rigor from `run.jsonl`, LLM scoring). The effort-floor and signal rules from research Follow-up 2, decision 1 and 7, appear as GIVEN/WHEN/THEN rules (checked by the Phase 1 test).

#### 2. `SKILL.md`

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Update "How the tier moves" and the loop. Document: the rigor level and what raises it, `lean` skipping plan-review, the per-level budget, the effort floor for interactive steps (described by reference to `rigor.minEffort` in `policy.json`, with no model or effort names), skipped steps in the log and report, and that the orchestrator copies `signals` from the RESULT JSON untouched. Mention `--rigor` in Start (the orchestrator passes it only when the user gave it).

**Contract**: No model names, effort names or absolute tier numbers (AGENTS.md Hard Rules). Relative wording only.

#### 3. `README.md`

**File**: `README.md`

**Intent**: Update the routing bullets and the Layout block (add `docs/ADR/`, `skills/10x-pipeline/test/`). Add a short "Rigor" bullet group: levels, churn, skip, budget, effort floor, `signals`, and the `risk` command. Keep `name`, `description` and `version` aligned with the manifests (no version bump in this change).

**Contract**: Same facts as `SKILL.md` and ADR-003.

#### 4. `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Replace "There is no build, lint or test setup" and the Testing section with `node --test skills/10x-pipeline/test/*.test.mjs`, and keep the scratch-folder check. Add `docs/ADR/` and `test/` to Project Structure. Keep every Hard Rule.

**Contract**: Commands list gains the `risk` subcommand.

#### 5. PRD

**File**: `context/foundation/prd.md`

**Intent**: Bring FR-002 and FR-010 in line with the owner decisions: FR-002 skips plan-review when the change's rigor is `lean` (keep the `Was:` text and add a dated Socrates-style note); FR-010 defines elevated risk as paths that change often in git history, configured in `policy.json`, and never runs at `lean`. Mark Open Question 11 resolved with the date, as the roadmap already does. FR-010's tail, "halts for a human at the highest level", is kept as a recorded deferral (a dated note: out of scope for `rigor-levels`, only the generic `signals.needsHuman` halt exists), not deleted.

**Contract**: Edit those three entries only.

#### 6. Roadmap check

**File**: `context/foundation/roadmap.md`

**Intent**: Read-only check that S-03 and S-04 already match (S-03 `rigor-levels`, S-04 merged). No edit is planned; the `ready` to `planning` and `in-progress` flips belong to `/10x-plan` persistence and `/10x-implement`.

**Contract**: If a mismatch is found, fix only the S-03/S-04 text.

#### 7. `change.md` scope line

**File**: `context/changes/rigor-levels/change.md`

**Intent**: The scope bullet says "Signals only add steps or raise rigor", but this change adds the `signals.needsHuman` stop. Reword it in the same change that ships the stop.

**Contract**: New wording: signals can raise rigor or stop the run (`needsHuman`); they never lower rigor, remove a step or add a skip. No other line of `change.md` changes.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Rigor is documented in all four places: `for f in skills/10x-pipeline/SKILL.md README.md docs/ADR/ADR-003-rigor-gated-routing.md context/foundation/prd.md; do grep -qi rigor "$f" || exit 1; done`
- `SKILL.md` names no model, effort level or absolute tier: `! grep -Eiq "haiku|sonnet|opus|xhigh|tier [0-9]|effort[^.]{0,40}\b(low|medium|high|max)\b|\b(low|medium|high|max)\b[^.]{0,20}effort" skills/10x-pipeline/SKILL.md`
- `AGENTS.md` names the test command: `grep -q "node --test" AGENTS.md`
- Nothing under `context/archive/` changed: `test "$(git diff --name-only main -- context/archive | wc -l)" -eq 0`
- Manifests untouched: `test "$(git diff --name-only main -- .claude-plugin | wc -l)" -eq 0`

#### Manual Verification:

- `SKILL.md`, `README.md`, ADR-003 and `route.mjs` describe the same rules (inputs, levels, skip, floor, budget)
- ADR-003 is readable as a skeleton: change 1 complete, changes 2 to 4 only listed
- PRD FR-002, FR-010 and Open Question 11 read consistently with the roadmap's S-03 text
- The whole suite passes on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` (or the PR states it is unverified)
- The `change.md` scope bullet on signals matches the shipped `needsHuman` stop
- PRD FR-010 keeps its "halts for a human at the highest level" tail as a dated deferral

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation. The change then goes to plan review and implementation review.

---

## Testing Strategy

### Unit Tests:

- `rules.test.mjs`: `ruleProblems` on valid and invalid lines; scan of `policy.json` prompts, `prompts/*.md`, ADR-003 and ADR-004.
- No function-level tests of `route.mjs`: it exports nothing and runs on import. The CLI is the unit.

### Integration Tests:

- `route.test.mjs`: scratch project per test (`os.tmpdir()`), real `route.mjs` through `spawnSync`; `helpers.mjs` owns the `run.jsonl` fixtures and the hermetic git environment. Rigor, budget, effort floor, skips and their interplay, signals, and malformed input (bad flag, bad `meta.json`, bad override) always ending in JSON.
- `churn.test.mjs`: hermetic scratch git repos (null global/system config, ceiling dir, dated commits); hot-path math, `source` assertions, exclusions, fallback, subdirectory root, `baseSha` stability, plan and diff inputs, no-git case.

### Manual Testing Steps:

1. In a scratch folder with `context/changes/demo/change.md`, run `init demo --goal "fix typo"`, write a plan with one phase, write the plan step's result, run `next`: expect `implement`, a skip in `report.md`.
2. Repeat with a plan whose `**File**:` line names `skills/10x-pipeline/scripts/route.mjs`: expect `plan-review` at an effort of high or above.
3. Run `route.mjs risk rigor-levels` on this repo and read the hot list.

Node 18 is the supported floor (AGENTS.md); this machine has Node 24. The suite uses only `node:test` features present in 18 (`test`, `node:assert/strict`), and router and test code follow the Node 18 ban list in Phase 2. Manual criteria 2.5, 3.4 and 6.10 run it on Node 18 with `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` (a run-time tool, not a repo dependency); if that cannot be run, the PR states Node 18 as unverified.

## Performance Considerations

One `git log` per `next` once a plan exists (at most 500 commits, output a few KB) and one `git diff --name-only` after implement. Both are local and read-only. `risk` reuses the same code.

## Migration Notes

Existing `meta.json` files have no `rigor`. The first `next` after upgrade resolves one from the goal, the plan and the log, so an in-flight run resumes with a valid level. The effort floor raises `plan-review` and `impl-review` from medium to high effort at `standard` (a deliberate cost increase, owner decision 1); `lean` keeps the current cheap tiers. A run in flight when the router is upgraded gets `baseSha` = HEAD at the first `init` after the upgrade, so the diff input and the churn cut-off miss commits made earlier in that run; such a run is only partly measured. A project that overrides `complexity.phaseThresholds` moves the rigor phase levels with it (one source).

## Revision Notes

Revised after `reviews/plan-review.md` (verdict REVISE, 2026-10-30). All findings were checked against `route.mjs`, `policy.json` and git before acting.

- F1 confirmed (`git log --format=@@` fails here with `invalid --pretty format`): `--format=tformat:@@`, plus a test that `source` is `window`.
- F2 accepted with one change: the skip needs `source` of `window`/`all-history` and at least one plan path; paths use `--relative`; `since` is validated. The reason and a `risk` field go on the skip entry, not into `meta.rigor.by`, because `by` names only what raised the level. Assumption: running plan-review at `lean` when risk is unmeasured is the conservative reading of FR-010 (the research only said "do not flag").
- F3 accepted as Fix A: the skip freezes once any `implement` or `fix` entry exists.
- F4 accepted: `init` writes `{ ...prev, id, goal }`; the `needsHuman` ack lives on the log entry.
- F5, F6, F7 accepted as written in Phases 2 to 4.
- F8 accepted: items 1 to 6 are in Phase 4, Phase 2 (`fromPhases` now reads `complexity.phaseThresholds`), Migration Notes, Phase 6 (PRD deferral, `change.md` scope line) and the brief. `change.md` is edited at implementation time, not in this revision.
- F9 accepted: the 6.3 grep also catches effort words; ADR-004 shows bad rules inside fenced blocks and the rule-form test skips fences in ADRs.

## References

- Related research: `context/changes/rigor-levels/research.md` (Follow-ups 1 to 3)
- Change scope: `context/changes/rigor-levels/change.md`
- Rule form source: `../life-to-lore/docs/adr/ADR-012-prompt-rules-as-scenarios.md`
- Router: `skills/10x-pipeline/scripts/route.mjs:201-226` (attach), `:265-357` (decide), `:373-395` (tier), `:491-497` (init)
- Prior design: `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`
- Requirements: `context/foundation/prd.md` FR-002, FR-003, FR-010

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rule form — ADR-004 and `node:test` check

#### Automated

- [x] 1.1 Rule-form test passes on all current rules and rejects the bad fixtures: `node --test skills/10x-pipeline/test/rules.test.mjs` — 690b214
- [x] 1.2 ADR-004 has its required sections: `test $(grep -c '^## ' docs/ADR/ADR-004-prompt-rules-as-scenarios.md) -ge 4` — 690b214

#### Manual

- [ ] 1.3 ADR-004 reads clearly, credits life-to-lore ADR-012, and lists the differences from it

### Phase 2: Rigor core — level, persistence, budget, effort floor

#### Automated

- [x] 2.1 Rigor tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [x] 2.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [x] 2.3 `policy.json` parses and carries the new keys: `node -e 'const p=require("./skills/10x-pipeline/policy.json");if(!p.rigor||!p.steps.plan.interactive||!p.steps["impl-review"].interactive)process.exit(1)'`

#### Manual

- [ ] 2.4 In a scratch change folder, `init <id> --goal "fix typo"` returns a `run` for `plan` and the tier text mentions the effort floor; `status` shows the rigor level and `meta.json` holds `rigor`
- [ ] 2.5 The whole suite passes on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` (`npx` fetches a run-time Node, not a repo dependency). If Node 18 cannot be run, record the status as unverified in the PR

### Phase 3: Churn risk paths

#### Automated

- [ ] 3.1 Churn tests pass: `node --test skills/10x-pipeline/test/churn.test.mjs`
- [ ] 3.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 3.3 `node skills/10x-pipeline/scripts/route.mjs risk rigor-levels` on this repo lists `route.mjs` and `policy.json` among the hot paths and no `context/**` or `*.md` path (counts differ from the research dry run because the history moved)
- [ ] 3.4 The churn tests pass on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/churn.test.mjs` (unverified status goes into the PR if Node 18 cannot be run)

### Phase 4: Skip entries and the `lean` plan-review skip

#### Automated

- [ ] 4.1 Skip and interplay tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [ ] 4.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 4.3 On a scratch lean run, after the plan step's result is written, `next` returns `implement` and `report.md` lists the skipped plan-review with its reason

### Phase 5: RESULT `signals` and the prompt suffix rules

#### Automated

- [ ] 5.1 Signal tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [ ] 5.2 Rule-form test passes on the new suffix: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 5.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 5.4 The `prompt` returned for a `plan` step reads clearly: three rules, then the RESULT line with `signals`

### Phase 6: Docs and cross-file sync

#### Automated

- [ ] 6.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 6.2 Rigor is documented in all four places: `for f in skills/10x-pipeline/SKILL.md README.md docs/ADR/ADR-003-rigor-gated-routing.md context/foundation/prd.md; do grep -qi rigor "$f" || exit 1; done`
- [ ] 6.3 `SKILL.md` names no model, effort level or absolute tier: `! grep -Eiq "haiku|sonnet|opus|xhigh|tier [0-9]|effort[^.]{0,40}\b(low|medium|high|max)\b|\b(low|medium|high|max)\b[^.]{0,20}effort" skills/10x-pipeline/SKILL.md`
- [ ] 6.4 `AGENTS.md` names the test command: `grep -q "node --test" AGENTS.md`
- [ ] 6.5 Nothing under `context/archive/` changed: `test "$(git diff --name-only main -- context/archive | wc -l)" -eq 0`
- [ ] 6.6 Manifests untouched: `test "$(git diff --name-only main -- .claude-plugin | wc -l)" -eq 0`

#### Manual

- [ ] 6.7 `SKILL.md`, `README.md`, ADR-003 and `route.mjs` describe the same rules (inputs, levels, skip, floor, budget)
- [ ] 6.8 ADR-003 is readable as a skeleton: change 1 complete, changes 2 to 4 only listed
- [ ] 6.9 PRD FR-002, FR-010 and Open Question 11 read consistently with the roadmap's S-03 text
- [ ] 6.10 The whole suite passes on Node 18: `npx -y node@18 --test skills/10x-pipeline/test/*.test.mjs` (or the PR states it is unverified)
- [ ] 6.11 The `change.md` scope bullet on signals matches the shipped `needsHuman` stop
- [ ] 6.12 PRD FR-010 keeps its "halts for a human at the highest level" tail as a dated deferral
