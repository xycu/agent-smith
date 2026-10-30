<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Archive Adapter Implementation Plan

- **Plan**: context/changes/archive-adapter/plan.md
- **Mode**: Deep (round 3, done in the main thread with no sub-agent: every risky claim was run against real git 2.54 in scratch repos and read against the code on `main` at 4750d86, where `rigor-levels` is merged)
- **Date**: 2026-10-30
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 5 observations

Rounds 1 and 2 gave REVISE. Revision 2 resolves all eight round 2 findings. No claim of the plan was found false against `main`, the real `~/.claude/skills/10x-archive/SKILL.md` or git. The revision introduced no blocker and no warning. The five observations are cheap wording or ordering fixes and none needs a new round; they can be folded into the plan or into the implementation. The plan is ready for `/10x-implement`.

## Previous review (round 2)

| ID | Round 2 finding | Status now | Evidence |
| --- | --- | --- | --- |
| F1 | Archive prompt did not cover the skill's SHA history check; rules 2 and 4 could disagree | resolved | Prompt has nine rules: SHA diagnostics join the warning classes of rule 1, rule 3 answers the "identify, confirm or choose" paths with "skip repointing, no asking", rule 4 forbids the plain-text wait for every named question, rule 6 makes the blocking rule beat both answers, rule 7 beats the generic suffix. Read against `10x-archive/SKILL.md:100-149` and `references/archive-sha.md` (steps 2, 3 and "Establish the integration commit"): every question source is covered. All nine lines pass `ruleProblems` (run) and every string the Phase 2 policy test expects is present in them (run). Row 4.9 now names the no-remote, unmerged-branch run |
| F2 | `git subcommands` shim test failed against the real router (`-c`, `log`) | resolved | Shim skips leading `-c <k=v>` pairs, `log` is on the list, and the no-override rule binds the adapter's calls only. Real router calls on `main`: `-c core.quotePath=false rev-parse HEAD`, `... log --no-merges ...`, `... diff --name-only --relative <rev> HEAD --` (`gitOut`, `churnCounts`, `measureRisk`): all on the list. Spawned `git` resolves from the `PATH` in `run(..., { env })` |
| F3 | Check (2) halted on non-ASCII names and non-ASCII project roots | resolved | Re-run with a root in `proj/ząb` (git root one level up): `show --name-only` default output is quoted and escaped (`"proj/z\304\205b/..."`); `show --name-only -z --format= HEAD` prints raw `proj/ząb/context/changes/demo/zażółć.md`; `rev-parse --show-prefix` prints `proj/ząb/` raw. The NUL-split raw comparison is correct. Tests named `non-ASCII` and `nested root` exist and get their own criterion (3.9). One related quoting gap remains for `status` (F2 below) |
| F4 | ADR and PRD said the router never uses git | resolved | Wording is "writes to git only with `--archive`"; criterion 4.14 greps the four phrases. Run on `main`: no document contains them now, so the grep is a real guard. ADR-003 intro quotes match the file ("split in four changes", "changes 2 to 4 only listed", "Design of changes 2 to 4", "The git write decision of change 4 ... is future work, not decided here", row `archive-and-lessons`) |
| F5 | Halt paths around the commit not specified one by one | resolved | The A to D table is consistent with the sequence: A writes through `finishRun` (log, `meta.outcome`, `report.md`), B, C and D only print, `meta.outcome` stays `done` after a failed hook. `finishRun` fields match `endRun` on `main` (log, `meta.outcome`, `report.md`, `reportError`, `{ ...result, report }`); `manualPending` is in `meta.outcome`; `readPlan` returns `manualPending` as an array of strings. Exit code 0 for printed halts matches `endRun` |
| F6 | Only four files probed; other ignored files skipped silently | resolved | Decision 13. Re-run with `.gitignore` = `reviews/`, `.DS_Store`, `*.log`: `git status --porcelain --ignored -- <folder>` lists the `!!` entries (a fully ignored directory once, e.g. `reviews/`, or `agent-smith/` when it holds only ignored files), and a `git mv` of the folder carried `.DS_Store`, `debug.log` and `reviews/impl-review.md` to the new path. The promise "every file git does not ignore" is accurate |
| F7 | Anchors, fixtures and parser rules not pinned to the real code | resolved | Function names replace line numbers; `tierFor(d, log, policy, plan, meta, level)` is right (`main`); `helpers.mjs` facts are right (`makeProject` writes no `created`, `gitEnv(project)`, `run` takes `env`, `git` and `gitInit` run in `project.base`, `commitFiles` is base-relative); `--path` valueless, absolute and `..` cases are in the Phase 1 tests (`parseFlags` really gives `true` for a bare flag). The branch names in the references are now stale (F3 below) |
| F8 | `created` parsed differently by router and skill | resolved | Decision 14 reads `created` as `awk '/^created:/ {print $2; exit}'` does and requires `^\d{4}-\d{2}-\d{2}$`. Quoted (`"2026-10-30"`) and glued (`created:2026-10-30`) values halt as kind A in the tests. A CRLF file also halts (the `\r` stays in the field and the pattern does not match), which is the safe side |

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 15/15 paths found (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, `test/helpers.mjs`, `test/rules.test.mjs`, `test/route.test.mjs`, `test/churn.test.mjs`, ADR-003, ADR-004, `prd.md`, `roadmap.md`, `~/.claude/skills/10x-archive/SKILL.md`, its `references/archive-sha.md`); 12/12 symbols found on `main` (`gitOut`, `endRun`, `attachResult`, `decide` done return, `tierFor`, `resolveRigor`, `buildReport`, `readPlan` `manualPending`, `parseFlags`, `executed`, `halt`, the outer `try/catch`); brief and plan agree (halt kinds, nine prompt rules, ignored-file decision, `haltOnManualPending`, last-revision note).

Checks run for this round:

- **Success Criteria to Progress, mechanical.** One `## Progress` heading, 0 checkboxes outside it, 4 phase headings equal in body and Progress. Every Success Criteria bullet equals its Progress row by title: Phase 1 2+1, Phase 2 4+2, Phase 3 5+4, Phase 4 8+6. Rows 2.6 and 3.6 carry the revised text in both places; 3.8, 3.9 and 4.14 are new and map one to one. Indices are unique (`1.1 ... 3.4 3.9 3.5 ... 4.7 4.14 4.8 ...`, no duplicates); a new row placed at the end of its subsection with the next free index is what `progress-format.md` allows. Titles of 2.6 and 3.6 changed after a review, but nothing has been implemented and no row has a SHA, so no consumer relies on them.
- **Rule form.** The nine `prompts.archive` lines and the six ADR-003 lines, extracted from the plan, all pass `ruleProblems` from `rules.test.mjs`; `(Recommended)` does not trip the case-sensitive bare-keyword check. The existing suite on `main` passes (73 tests).
- **Shell criteria on `main` as it stands.** 2.4 is valid (`require` works, fails now because the keys do not exist yet); the 3.4 grep part passes; 4.3 passes on the current `SKILL.md` (no match); 4.14 passes; 4.6 and 4.7 give 0; 4.5 fails until the PRD note exists (the range holds exactly one FR-008 entry).
- **Rule precedence.** Blocking rule (5, restated in 6) beats the answer rules (1, 2, 3); the answer rules beat the generic suffix (7). Rule 1 applies only when every warning is in its three classes, rule 2 only when no blocking warning is listed, so they are mutually exclusive with rule 5. No cycle found.
- **Real `/10x-archive`.** Hard blocks, label strings (`Continue archiving`, `Archive without repointing`, `Archiwizuj bez podmiany`, the `(Recommended)` nudge for manual-only pending rows), the blocking warning strings, the roadmap-dirty notice, the `awk` for `created`, the `chore(archive): close <id>` commit, "does not push" and the half-archived error text all match the plan's quotes. The skill's line anchors `:64-94`, `:100-143`, `:113`, `:154`, `:197-206`, `:239` still hold.

Scratch-repo results (git 2.54, hermetic config, repos under `$TMPDIR`):

- **`-z` post-commit path check.** Non-ASCII file and non-ASCII nested root: `-z` listing equals `<prefix>` plus the folder path, byte for byte; the default listing is quoted. Nested root (`app/`) with a `pre-commit` hook that runs `git add hooked.txt`: the commit holds `app/context/changes/demo/change.md|hooked.txt`, `git diff --cached --quiet` exits 1 afterwards, `git status` shows `D  hooked.txt` and `?? hooked.txt`. `hooked.txt` is outside the prefix, so check (2) names it as well, and `git diff --cached --name-only` names it git-root-relative.
- **`check-ignore` file probes.** `agent-smith/` gives dir=1 and run/meta/report=0, change.md=1; `*.jsonl` gives run=0, meta=1, report=1; `context/` gives 0 for every file and the directory; `report.md` gives report=0 only; `/context/changes/demo/change.md` gives change.md=0 only. A tracked file under an ignore rule reads 1 (not ignored). Outside a repository, `check-ignore` and `rev-parse --is-inside-work-tree` exit 128. From a nested cwd the probe works with cwd-relative paths. Probes work for files that do not exist.
- **`git mv` and ignored files.** Carried `.DS_Store`, `agent-smith/debug.log` and `reviews/impl-review.md`; the source folder is gone.
- **Failure and resume mechanics.** `git reset -q -- <folder>` after a failed `pre-commit` hook restores `?? context/` and exits 0, also on an unborn HEAD; a pathspec commit works on an unborn HEAD and `git diff --cached --quiet` then exits 0; `git symbolic-ref -q HEAD` exits 0 on an unborn HEAD (attached); a second `git add` of an unchanged committed folder leaves `git diff --cached --quiet` at 0 (the skip-the-commit case); a `post-commit` hook creating `stray.txt` leaves the commit exit code 0 and `?? .../stray.txt`; `git rev-parse --git-path MERGE_HEAD` and `rebase-merge` print cwd-relative paths.
- **`git subcommands` shim against the real allow-list.** See F2 above in the table; no call outside the list was found in `init`, `next` or the churn code.

## Findings

### F1 — Two steps of the commit stage can fail outside the halt table and leave the index staged

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 change 2 step 4 (message validation), change 3 (tier and payload)
- **Detail**: Step 4 runs `git add`, then `git diff --cached --quiet`, then validates `policy.archive.commitMessage` ("non-string or blank halts with a clear reason"). A halt there leaves the folder staged, belongs to none of the kinds A to D (kind C is a failed `add` or `commit`), and the next `next` meets its own residue at the "nothing staged" pre-check. Separately, the tier and payload are computed after the commit: `next()` does `const { model, effort } = policy.ladder[tier]`, and `steps.archive` pins `minTier = maxTier = 3`, so a project override with a ladder of three entries or fewer makes `policy.ladder[3]` undefined and the destructuring throws. The throw reaches the outer `try/catch` ("Router error: ...") after the commit exists, with no `committed` field and no kind B or D message. Both need an unusual override, so the impact is small.
- **Fix**: Validate the commit message in the pre-checks (before `git add`, as kind A), and compute `tierFor`, `model`, `effort` and `archivePath` before step 4; `ladder[tier]` missing becomes a kind A halt. Optionally run the git section in a `try/catch` that does the best-effort `git reset` before rethrowing.
- **Decision**: PENDING

### F2 — `git status --porcelain` still quotes names with spaces, so `ignored` and the clean-check listing are not "as written"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 2 steps 3 and 5 (3), last sentence of step 5; decision 13
- **Detail**: Step 5 says display listings from `runGit` "show names as written" because of `core.quotePath=false`. That holds for `diff --cached --name-only`, but not for `status --porcelain`. Run in a root under `proj/ząb`: `git -c core.quotePath=false status --porcelain --ignored` printed `!! "proj/ząb/context/changes/demo/ig file.txt"` with the quotes, because the space triggers quoting. Step 3 strips the `--show-prefix` prefix from the start of each `!!` line, so for such a name the prefix is not at the start and `ignored` carries a quoted, git-root-relative string instead of a project-relative path. Display only (nothing halts on it), but it is the same root cause as round 2 F3 in a place the fix did not reach.
- **Fix**: Use `git status --porcelain -z --ignored -- <folder>` (checked: `-z` prints plain paths, entries NUL-separated, the two-character status first), split on NUL, strip the prefix, and use the same call for the step 5 (3) listing. Reword the sentence "show names as written" to say which commands.
- **Decision**: PENDING

### F3 — References still name the pre-merge branches and treat the dependency as open

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Overview, Current State Analysis (first paragraph and ADR bullet), "Dependency on `rigor-levels`", References
- **Detail**: `rigor-levels` is merged into `main`. The plan still says "checked against branch `rigor-levels-fix`", points to `rigor-levels-fix` and `rigor-levels-plan-review-2` in References, says "ADR-003 and ADR-004 ... come from `rigor-levels`" in the future sense, and gates implementation on a merge that has happened. Every claim was re-checked against `main` in this round and holds, so the content is right; only the pointers are stale and the branches may disappear.
- **Fix**: Replace the branch names with `main` (4750d86), say the dependency is met, and keep the reuse table as "what this plan reuses". No design change.
- **Decision**: PENDING

### F4 — Two documentation statements are broader than the code

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State (halt bullet), Phase 4 change 3 (`AGENTS.md`)
- **Detail**: (a) "Every halt of a run with `--archive` says whether the pre-archive commit exists (`committed`) and carries an `archive` field." Halts printed outside `finishRun` do not: `attachResult`'s "Step N has no result" halt (exit 1), the Phase 1 guards, the usage halt and the top-level "Router error". `SKILL.md` keys on the presence of `archive`, so nothing breaks, but the sentence and the README bullet would be wrong for those. (b) `AGENTS.md` change 3 adds `verify-archive` to the Commands list and a Hard Rules sentence. The Project Structure bullet `route.mjs — router: init, next, status, risk` would stay stale, and criterion 4.2 (grep for `verify-archive` in `AGENTS.md`) passes from the Commands list alone.
- **Fix**: (a) Say "every halt printed by the `done` branch and by `endRun`". (b) Add `verify-archive` to the Project Structure bullet in change 3.
- **Decision**: PENDING

### F5 — A resume skips check (2), so an extra path already in the pre-archive commit is accepted once the index is cleared

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 change 2 step 5 (2), halt kinds B and D
- **Detail**: Check (2) runs only "when this call made a commit". Reproduced in the nested repo above: a hook that stages `hooked.txt` puts it into the commit and leaves `D  hooked.txt` in the index. Kind D (or kind B on the next call) halts and names the path. After the human runs `git reset`, the resume has a clean index, skips the commit and check (2), passes check (3) and returns `archive`, so the contaminated commit goes on to `/10x-archive` without another word. The plan says a resume "repeats safely after the cause is fixed"; for this cause the human decision (amend, or accept) is not recorded anywhere. It is a local commit that is never pushed, so the damage is bounded.
- **Fix**: Say in the kind B and D messages that the commit already holds the named path and that clearing the index does not remove it (amend, or accept). No router change needed.
- **Decision**: PENDING
