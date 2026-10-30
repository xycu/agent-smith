<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Archive Adapter Implementation Plan

- **Plan**: context/changes/archive-adapter/plan.md
- **Scope**: Full plan (phases 1-4 of 4)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

Range reviewed: plan commit 931f20f to 8cd3f1f (p1 7f586e7, p2 f11536b, p3 03025de, p4 35f085e, epilogue 8cd3f1f). Done in the main thread, unattended, without sub-agents: the code was read against the plan and every risky claim was checked against the real files, the real suite and two local mutations.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

Automated verification, run here (Node v24.19.0):

- `node --test skills/10x-pipeline/test/*.test.mjs`: 149 tests, 149 pass, 0 fail.
- Criterion 3.4 grep (`push`, `git push`, `--no-verify`, `--no-gpg-sign`) over `route.mjs`: no match. Imports are `node:fs`, `node:path`, `node:child_process`, `node:url` only. A grep for the Node 18 ban list (`toSorted`, `groupBy`, `intersection`, `import.meta.dirname`, `partialDeepStrictEqual`, `mock.timers`, `findLast`, `replaceAll`, `Object.hasOwn`, `structuredClone`) in `route.mjs` and `archive.test.mjs` found nothing. Node 18 itself is not available here: **unverified on Node 18**.
- `git diff --name-only 931f20f HEAD -- context/archive .claude-plugin`: 0 files. No `agent-smith/` run files are tracked under `context/`. No hand edit of `run.jsonl` or `meta.json`.
- `SKILL.md` names no model, effort level or tier (placeholders `<model>/<effort>` only). The archive prompt is nine rule lines, each GIVEN/WHEN/THEN with one bold keyword; `rules.test.mjs` passes on it and on the six ADR-003 rules.

Mutation spot-checks (code broken locally, tests run, file restored with `git checkout`; tree is clean):

1. The best-effort `git reset` after a failed commit replaced by a no-op: `kind C: a failing pre-commit hook halts ...` FAILS (0 pass, 1 fail). The test guards the "nothing left staged" rule.
2. The post-commit extra-path filter (`!name.startsWith(inFolder)`) replaced by `false`: `kind D: a commit that holds an extra path is caught even when the index ends clean` FAILS; the other four `kind D` and `nested root` tests pass, as they should. The test guards check 2.

Plan review round 3 observations, folded in?

| ID | Observation | Status | Evidence |
| --- | --- | --- | --- |
| F1 | Commit message and tier validated after `git add`; `ladder[tier]` may be missing | folded in (code, tested) | `route.mjs:903-919` validates the template, the rendered message, `tierFor` and `policy.ladder[tier]` inside the pre-checks (kind A), before `finishRun` (932) and `git add` (946). Tests `a blank commit message halts as kind A and never stages the folder` and `a custom ladder too short ... halts before git add`. The optional try/catch around the git section was not added; nothing after `git add` can throw (`runGit` never throws), so this is fine |
| F2 | `git status --porcelain` quotes names with spaces | folded in | `statusEntries` (`route.mjs:829`) uses `status --porcelain -z`, drops the second NUL field of R/C records, and feeds both the `ignored` list and the clean check; diff and show listings use `-z` too. Test `nested root named with non-ASCII and a space` |
| F3 | Plan references name pre-merge branches and treat the dependency as open | NOT folded into `plan.md` | `plan.md` is changed by the implementer in Progress rows only; lines 7, 11, 100-118 and 450-456 still say `rigor-levels-fix` and "waits for merge". ADR-003 Origin and Sources were updated to `context/archive/2026-10-30-rigor-levels/`. See F5 |
| F4 | (a) "every halt" wording; (b) `verify-archive` missing in AGENTS.md structure bullet | (b) folded in. (a) folded in code and docs, not in plan.md | `AGENTS.md:18` lists `verify-archive`. README and ADR-003 say "a halt printed by the `done` branch or by the end of the run" and list the halts that carry neither field; `plan.md:30` keeps the old sentence |
| F5 | A resume skips post-commit check 2 | folded in | `COMMIT_EXISTS` (`route.mjs:853`) says the check is not repeated and that clearing the index does not remove a path the commit holds; README, ADR-003 consequences and SKILL.md `halt` (suggests `git show --stat HEAD`) say the same. Tests assert the sentence in kinds B and D |

Focus areas, verified against the code:

- **Git safety**: nothing is staged before the commit (pre-check `diff --cached --quiet`, `route.mjs:894-900`); `git add -- <rel>` and `git commit -m <msg> -- <rel>` are the only writes, plus `git reset -q -- <rel>` after a failed add or commit; every write is scoped to `context/changes/<id>`. The `git subcommands` shim test asserts this over every call (allow-list, only `-c core.quotePath=false`, no `push`, no `--no-verify`, `--` plus the folder at the end of each write). No `-c` touches hooks, signing or identity.
- **Post-commit checks**: index empty, commit holds only `<prefix><rel>/` (raw NUL-split strings, prefix from `rev-parse --show-prefix`), folder clean. Halts A to D match the plan table and ADR-003: A writes through `finishRun` and gets `archive: "skipped: run halted"` and `committed: false` from `finishRun`; B, C and D go through `out()` and write nothing. `meta.outcome` stays `done` after C and D; `assertFilesAsCommitted` proves the files are byte-identical.
- **Resume**: second `next` returns `archive` with `commit: null`; kind B prints JSON only (test snapshots the folder). A rewrite on resume gives the same bytes because the report carries no timestamp.
- **Re-entry guard**: `guardArchived` runs before the first `mkdirSync` in `next` and `init`, and in `status --report`; plain `status` and `risk` stay read-only. `verify-archive` uses `fs` reads only (it calls `paths()`, which only joins strings), never git; a test runs it with no `git` on `PATH` and compares the tree.
- **`archivedAt`** comes from the `archived_at` frontmatter field, which `/10x-archive` stamps (`~/.claude/skills/10x-archive/SKILL.md:162`).
- **`init --archive` outside a work tree** halts before `mkdirSync` and writes nothing (test at `archive.test.mjs:394`).

Implementer assumptions, judged:

- `runGit` extra `timedOut` field and status 124: acceptable. Additive, used only for the timeout sentence. The timeout path has no test (F7).
- `init` re-probes on resume with a stored `archive: true`: acceptable. It follows the plan's wording ("when the result is true") and README says so. A resume in a directory that stopped being a work tree halts with nothing written.
- Report line `Archive: not run (run not ended)`: acceptable. More accurate than the plan's "any other end" for `status --report` in mid-run. It is in no test and in no doc (F7).
- `report.md` written before `git add` in kind C: acceptable. The plan itself orders `finishRun` before the commit, and the halt table says `meta.outcome` stays `done`. A late `reportError` check is the one weak spot (F3).
- Roadmap S-09 Outcome wording "commit the change folder": correct and the only wording change beside the status flip to `in-progress` and the `updated` date.

## Findings

### F1 — Real end-to-end run and all Manual rows are still pending

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/archive-adapter/plan.md:473, 486-487, 501-504, 521-526 (rows 1.3, 2.5, 2.6, 3.5-3.8, 4.8-4.13)
- **Detail**: Every Automated row is `[x]` with a commit SHA and the suite is green, but all 15 Manual rows are `[ ]`. `change.md` already says `status: implemented`. The plan names row 4.8/4.9 as "the only check that exercises the prompt answers against the real skill": the nine archive prompt rules (warnings answer, repoint answer, SHA history check, blocking-warning precedence) have been tested for form and wording only, never against a real `/10x-archive` run by an unattended subagent. Rows 3.5-3.8 are covered by automated tests with the same content, so they are low risk; 4.8-4.10 are not covered by anything.
- **Fix**: Run the Phase 4 end-to-end on a throwaway repo (rows 4.8-4.10), then tick the Manual rows with evidence. Do not archive this change before that.
  - Strength: It is the only evidence for the part of the adapter that depends on a skill the repo does not own.
  - Tradeoff: One manual run with a real subagent.
  - Confidence: HIGH — the plan makes the same statement.
  - Blind spot: The SHA-history path depends on the local `gh` and remote state of the throwaway repo.
- **Decision**: PENDING

### F2 — ADR-003 rejection reason for "gitignore `agent-smith/`" is circular and does not explain the refusal

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-003-rigor-gated-routing.md:106
- **Detail**: The sentence "rejected, because the run state would stay out of history, and `/10x-archive` still blocks on the other uncommitted files of the folder" was written by the implementer; the plan lists the alternative without a reason. The first clause restates what the alternative does, not why that is bad. The second clause applies to every option that leaves `reviews/` and `plan.md` uncommitted, not to this one. The same ADR says ignored files elsewhere are tolerated (reported, still moved by `git mv`), and the router refuses an ignored probe file at `init` and `done`, so the reader has no stated reason for that asymmetry.
- **Fix**: Reword to the real constraint: the pre-archive commit is the only copy of the run state in history and `report.md` is the only router artifact the archived folder keeps, so a run whose `agent-smith/` files are ignored would archive without them committed and the FR-008 decision would hold only on paper; hence the probe refusal. Keep the `/10x-archive` blocking point as a separate sentence only if it is tied to the files that remain.
- **Decision**: PENDING

### F3 — A `report.md` write failure is detected only after the commit

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:932, 946, 974
- **Detail**: `finishRun` swallows a report write error into `reportError`. The adapter then runs `git add` and `git commit` and checks `done.reportError` as the very last post-commit check, so a run with an unwritable or half-written `report.md` still makes the pre-archive commit and ends as kind D ("report.md was not written"), with the commit in place. This breaks the principle the plan applies to the message and the tier (settle everything that can fail before `git add`). Unlikely in practice (the same directory just took `meta.json`), but the ordering is avoidable.
- **Fix**: Check `done.reportError` right after `finishRun` and before `git add`, as a halt that prints and commits nothing (kind C wording, `committed: false`); keep the late check out.
- **Decision**: PENDING

### F4 — AGENTS.md project structure omits `archive.test.mjs`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md:19
- **Detail**: The bullet lists the suite as `route.test.mjs`, `churn.test.mjs`, `rules.test.mjs` and `helpers.mjs`. The change adds `archive.test.mjs` (971 lines, 55 tests) and both AGENTS.md and README (line 84 says "router and the prompt rule form") were edited by this change without listing it. The plan only asked for `verify-archive` in that bullet, so this is a gap in the plan, not in the implementation.
- **Fix**: Add `archive.test.mjs` to the AGENTS.md bullet.
- **Decision**: PENDING

### F5 — Plan review F3 and F4(a) were not folded into `plan.md`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/archive-adapter/plan.md:7, 11, 30, 100-118, 450-456
- **Detail**: The only edits to `plan.md` after the review are Progress ticks. It still points to `context/changes/rigor-levels/...` (archived now at `context/archive/2026-10-30-rigor-levels/`), to branches `rigor-levels-fix` and `rigor-levels-plan-review-2`, says implementation "waits" for a merge that has happened, and keeps "Every halt of a run with `--archive` says whether the pre-archive commit exists", which is broader than the code (guard, usage, `init` and missing-result halts carry neither field). The code, README and ADR-003 are right; the plan is the stale source of truth for later reviews.
- **Fix**: Replace the branch names with `main` and the archive path, state that the dependency is met, and narrow the sentence at line 30 to halts printed by the `done` branch and by `endRun`.
- **Decision**: PENDING

### F6 — `verify-archive` edge cases around a reused id and `archived_at: null`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md:29; skills/10x-pipeline/scripts/route.mjs:1130
- **Detail**: (a) Start step 2 runs `verify-archive <id>` without `--path`. With a reused id that left two anchored archive folders the command answers `archived: false` ("More than one archive folder ... Pass --path"), and the SKILL text then says "Otherwise tell the user to run `/10x-new`", which is wrong advice for an id that is archived twice. (b) `archivedAt` returns the string `"null"` when a stamped folder still has `archived_at: null` (`frontmatterField` strips quotes but does not map the literal), where the plan says "value or null". `/10x-archive` always writes a datetime, so (b) is theoretical.
- **Fix**: (a) In step 2 say: when `verify-archive` lists archive folders in its reason, show them and STOP instead of suggesting `/10x-new`. (b) Map the literal `null` to JSON `null` in `verifyArchive`.
- **Decision**: PENDING

### F7 — Failure paths without a test, and a git failure reported as "not a work tree"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/route.mjs:193, 446-460, 879, 1198; skills/10x-pipeline/test/archive.test.mjs:659-673
- **Detail**: (a) No test sets `gitTimeoutMs` low or exercises status 124, `timedOut` or the "hook child may still run" sentence. (b) `Archive: not run (run not ended)` (line 193) is in no test and in no doc. (c) The kind C test checks that `report.md` has the Archive line but not that the halt left it unchanged, which the plan asks for ("`report.md` unchanged by the halt"); the sibling kind D tests do assert it through `assertFilesAsCommitted`. (d) Any failed `rev-parse --is-inside-work-tree` (git missing, a timeout, a lock) is reported as "`--archive` needs a git work tree and <root> is not one", at `done` (879) and at `init` (1198), which misleads on a timeout; the git message is dropped.
- **Fix**: Add one test each for (a) and (b), assert the report bytes in the kind C test, and include `gitMessage(inside)` in the halt text for (d).
- **Decision**: PENDING
