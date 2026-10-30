<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Archive Adapter Implementation Plan

- **Plan**: context/changes/archive-adapter/plan.md
- **Mode**: Deep
- **Date**: 2026-10-30
- **Verdict**: REVISE
- **Findings**: 1 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 existing paths found (route.mjs, policy.json, SKILL.md, README.md, AGENTS.md, prd.md, ADR-001, ADR-002, `~/.claude/skills/10x-archive/SKILL.md`, `references/archive-sha.md`); 14/14 cited line anchors match the current code (`route.mjs` :19-22, :178-186, :207-209, :352-356, :403, :413-417, :485-486, :493, :497; `policy.json` :11-17, :52-60 and the suffix at :53; `SKILL.md` :29, :36-43). Not yet present, as expected: `docs/ADR/ADR-003`, `skills/10x-pipeline/test/*` (both come from `rigor-levels`). Brief and plan agree. Progress and Success Criteria map one to one, checked mechanically: Phase 1 has 3 bullets and 3 rows, Phase 2 has 6 and 6, Phase 3 has 6 and 6, Phase 4 has 12 and 12. The title text is identical in every pair. There is one `## Progress` heading, and no checkbox sits in a phase body. No `docs/reference/contract-surfaces.md` and no `lessons.md` exist, so those checks were skipped.

Two checks were run against real git in a scratch repo (git config isolated), because the plan states them as facts. Both results are used in F1 and F2.

## Findings

### F1 — `git check-ignore` on the `agent-smith` directory does not detect the ignore rule at `init`

- **Severity**: CRITICAL
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 change 2 (`init` checks), Phase 3 change 2 (pre-checks), Decision row 5, test case ".gitignore containing agent-smith/ halts"
- **Detail**: The plan runs `git check-ignore -q -- context/changes/<id>/agent-smith` and halts on exit 0. Checked in a scratch repo with `.gitignore` = `agent-smith/`. With the directory absent, the command exits 1 (not ignored). With the directory present, it exits 0. At `init` the directory does not exist yet, because the plan requires that `init` "writes nothing" before it halts. So the init-time refusal never fires for the most common ignore pattern, and the Phase 2 test written in the plan fails as specified. The only way to make it pass is to create the directory first, which breaks "writes nothing". The same check at `done` does work, but only after the whole run has been paid for. The directory probe also misses file-level patterns: with `.gitignore` = `*.jsonl`, the path `.../agent-smith` exits 1 while `.../agent-smith/run.jsonl` exits 0, so `run.jsonl` would silently stay out of the commit and out of the archive history. A project that ignores `context/` or `context/changes/` is not covered at all, and the later `git add -- context/changes/<id>` fails ("The following paths are ignored") at `done`.
- **Fix**: Probe files, not the directory. Run `git check-ignore -q` on `context/changes/<id>/agent-smith/run.jsonl`, `.../meta.json`, `.../report.md` and `context/changes/<id>/change.md`. Probe paths work whether or not they exist (checked: a nonexistent file under an ignored directory exits 0). Halt if any exits 0. Add a test for a file-level pattern (`*.jsonl`) and for the missing-directory case.
- **Decision**: PENDING

### F2 — "`git commit -- <path>` commits only that path even if a hook stages something else" is false, and no check follows the commit

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Key Discoveries (bullet "git commit -m <msg> -- <path> after git add"), Phase 3 change 2 (commit and clean check), Phase 3 tests
- **Detail**: Tested in a scratch repo with a `pre-commit` hook that runs `git add other.txt`, then `git add -- context/changes/demo` and `git commit -m ... -- context/changes/demo`. The commit contained `other.txt` as well as the folder. Afterwards `git status --porcelain` showed `D  other.txt` (staged deletion) and `?? other.txt`. So `git diff --cached --quiet` fails after the router's commit, and `/10x-archive` hard block 2 (`10x-archive/SKILL.md:80-94`) stops the archive subagent with `blocked`. The router's clean check only looks at `git status --porcelain -- context/changes/<id>/`, which is empty in that state, so it reports success. A hook that rewrites files inside the folder (formatter) leaves ` M` entries; the clean check does catch that, but a resumed `next` will re-add and re-commit, and a non-idempotent hook never converges. The plan's hook tests cover only a failing pre-commit hook and a post-commit hook that creates a stray file. Hooks that stage unrelated files are uncommon, but the plan states the opposite as fact, and the pre-check "nothing staged" only protects the state before the commit.
- **Fix**: After the commit, add two read-only checks. First, `git diff --cached --quiet` must exit 0 (else halt listing `git diff --cached --name-only`). Second, `git show --name-only --format= HEAD` must list only paths under `context/changes/<id>/` (else halt, naming the extra paths and saying the commit is already made). Replace the false Key Discovery with the tested behavior, and add a test with a hook that stages an unrelated file.
  - Strength: Closes the gap with two cheap reads; turns a late `/10x-archive` block into an early, explained router halt.
  - Tradeoff: Two more git calls; the halt happens after a commit that already exists, so it must print JSON only (the plan already has that rule).
  - Confidence: HIGH — behavior reproduced with real git.
  - Blind spot: Other git versions were not tried.
- **Decision**: PENDING

### F3 — The archive prompt's answers match the skill's labels but lean on a plain-text path and an unconditional "continue"

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 change 1 (`prompts.archive` rules 1 to 4), Phase 4 manual row 4.9
- **Detail**: Checked against `~/.claude/skills/10x-archive/SKILL.md`. The exact strings are right: warnings prompt `Continue archiving` (`:137`), repoint prompt `Archive without repointing` (`:128`), and `Cancel` is never chosen. Four gaps remain. (1) README states that subagents cannot use `AskUserQuestion`, so every archive run takes the skill's plain-text fallback ("ask the same question as plain text ... and wait", `:132`). Rule 3 asks the model to answer its own question and continue in the same turn. A model that follows the skill and stops to wait ends its turn without a `RESULT:` line. This path is the normal one, not the rare one, and only the manual run 4.9 exercises it. (2) For a manual-only pending warning the skill renames the label to `Continue archiving (Recommended)` (`:130`). The rule and the test string check `Continue archiving` only, which is correct as a prefix but must be said as a prefix. (3) The skill supports Polish labels for the repoint prompt (`Archiwizuj bez podmiany`, `:128`); the rule names only the English ones. (4) Rule 1 continues on any warning at all. The skill's other warnings include `Uncertain review coverage`, `Missing review coverage for phases` and `No plan.md found` (`:104-111`), which say the router's `done` may rest on a partial review. The router can reach `done` with only a verdict, so continuing silently on those is the less conservative choice; rule 6 only copies them into `assumptions` after the archive is done.
- **Fix**: Word rules 1 and 2 as pre-given answers instead of choices: **GIVEN** `/10x-archive` would ask the warnings question **WHEN** you are an unattended subagent **THEN** you **MUST NOT** ask and **MUST** proceed as if the answer were `Continue archiving` (label may end in `(Recommended)`, match the prefix; same for `Archive without repointing` and its Polish label `Archiwizuj bez podmiany`). Restrict the continue to warnings of the expected classes (pending Progress rows that are Manual, missing SHA suffix, status other than the two expected); for `Uncertain review coverage`, `Missing review coverage`, or any pending Automated row, finish with `blocked`. Keep 4.9 as a required manual check, and add to it that the subagent produced a `RESULT:` line in the plain-text path.
- **Decision**: PENDING

### F4 — `verify-archive` is file-only and anchored as planned, but two cases give a wrong answer

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 change 2 (`verify-archive`), Phase 3 change 2 (pre-checks), Decision row 6
- **Detail**: Judged as asked. File-only is a sound principle: the command never calls git, never calls `paths()` or `mkdirSync`, and the anchored pattern `^\d{4}-\d{2}-\d{2}-<id>$` fixes the suffix-collision weakness in the skill (`10x-archive/SKILL.md:54`); the id is limited to `[a-z0-9-]`, so it is safe to put in a regex. Two problems. (1) "Exactly one match" fails when an id is reused: archive `demo` on one date, run `/10x-new demo` later, archive again. Two folders match, `verify-archive` reports `archived: false` for a correct second archive, and the orchestrator tells the user to stop. A related case: the destination `context/archive/<created>-<id>` may already exist (same-day reuse), which makes `/10x-archive` stop with "destination already exists" (`:156`) only after the router has already made its commit. The router already computes `archivePath` before the move. (2) If `/10x-archive` moves and stamps the folder but its `chore(archive): close <id>` commit fails (for example a hook), the files satisfy every file check and `verify-archive` prints `archived: true` while the rename is staged and uncommitted. The plan notes the missing `git log` check as a decision, but the staged-not-committed state is the case a user would be surprised by.
- **Fix A ⭐ Recommended**: Keep file-only. Let `verify-archive <id> [--path <archivePath>]` check that exact folder (the orchestrator passes the `archivePath` from the action); without `--path`, keep the glob and report "more than one" with the list. Add a router pre-check that `archivePath` does not exist, before the commit. Add to `SKILL.md` that on `archived: true` the orchestrator prints a one-line reminder to confirm `git status` is clean.
  - Strength: Fixes the false negative and the late failure with no git read in `verify-archive`; small.
  - Tradeoff: A staged-not-committed archive is still reported as `archived: true`.
  - Confidence: HIGH — follows from the code paths in the plan.
  - Blind spot: How often ids are reused in practice is unknown.
- **Fix B**: As A, plus an extra field `committed`: one read-only `git status --porcelain -- <archivePath> context/changes/<id>` (empty is `true`, git missing is `null`).
  - Strength: Detects the half-done state directly.
  - Tradeoff: First git read in a command designed as file-only; the tests must cover the missing-git case.
  - Confidence: MED — behavior is straightforward but adds a new contract field.
  - Blind spot: Not tried against a worktree or a subdirectory project root.
- **Decision**: PENDING

### F5 — Unchecked Manual rows are archived without being recorded anywhere that survives

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Overview, ADR-003 consequences, Phase 4 manual row 4.9, brief "Open Risks"
- **Detail**: The plan accepts that a run with pending Manual rows reaches `/10x-archive`, gets `Continue archiving`, and is archived with those rows still `[ ]`. Judgement: acceptable as an explicit opt-in, and consistent with the skill (`10x-archive/SKILL.md:130`: "manual checks are often deferred-by-design"), with `10x-goal-implement` never flipping Manual rows (it leaves them for a human), and with the local, unpushed, `git revert`-able commits. It is not acceptable as written, for two reasons. The human checklist is printed (`SKILL.md` `archive` step 1) and the archive then runs at once, so nobody gets a chance to do the checks first. And the report in the archive folder, the only router artifact that survives the move, does not list the pending checks: `buildReport` has no Manual section, and `manualPending` exists only in the `done` and `archive` JSON. The archived `plan.md` still shows `[ ]`, but a reader of `report.md` sees `Outcome: done` and `Archive: requested`, with no sign that checks were skipped.
- **Fix**: Add the pending Manual rows to `report.md` when `meta.archive === true` and the outcome is `done` (a `Manual checks pending: N` line, then the rows), and have `SKILL.md` repeat the checklist in the final message after `verify-archive`. Optionally add `archive.haltOnManualPending` in `policy.json`, default `false`, for projects that want the human gate.
  - Strength: The unverified checks stay visible in the archived copy; the owner's opt-in default is kept.
  - Tradeoff: One more report section and one more policy key to test.
  - Confidence: HIGH — the data is already in `plan.manualPending`.
  - Blind spot: Whether the owner wants the optional halt key now.
- **Decision**: PENDING

### F6 — The per-phase "needs rigor-levels phases N merged" claims are mostly accurate, with three gaps

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "Dependency on rigor-levels" (table and git layer paragraph), Phase 4 change 4 (ADR-003)
- **Detail**: Checked against `git show rigor-levels-plan-review-2:context/changes/rigor-levels/plan.md`. Accurate: Phase 1 needs rigor Phase 2 (`helpers.mjs` and `writeLog`, the dispatch `try/catch`, `{ ...prev, id, goal }` all sit in its Phase 2); Phase 2 needs Phase 1 (`rules.test.mjs`) and Phase 2 (`interactive`, `rigor.minEffort`, floor applied after the clamp, so the pinned tier 3 and the `lean` floor agree); Phase 3 needs Phases 2 (`Rigor:` line, `endRun`), 4 (executed-entries helper, `Skipped steps`, executed counts) and 5 (`needsHuman` check in `next()`); Phase 4 needs Phase 6 (ADR-003 skeleton, doc text, `AGENTS.md` test command) and Phase 1 (ADR rule test). Rigor Phases 1 and 3 are not needed by Phase 3 code, so "1 to 5" is a safe over-statement. The gaps: (1) Staged merging is assumed. `rigor-levels` is one change on one branch, and the roadmap gates S-09 on S-03 as a whole (roadmap Risk line: "waits for S-03 to merge"). Nothing in the rigor-levels plan says its phases land separately, so "Phase 1 can start after rigor phases 1-2 merge" has no support. (2) The rigor-levels ADR-003 skeleton lists the parts of change 4 as `archive-and-lessons`. The archive plan says it adds "its row", but the row needs to be renamed and split into `archive-adapter` and `lesson-candidates`, and the plan does not say so. (3) Both plans edit the `route.mjs` usage string (`:486`); the later one must merge, not overwrite. The git-layer paragraph is accurate: the rigor Phase 3 wrapper turns every failure into "unavailable", so a separate `runGit` is justified, and the plan's "either merge order works" holds.
- **Fix**: State the prerequisite as "S-03 `rigor-levels` merged" (as the roadmap does), or add one line that the owner will merge rigor phases separately. In Phase 4 change 4 say "rename the `archive-and-lessons` row to `archive-adapter` and add a `lesson-candidates` row". In Phase 1 change 2, say "extend the usage string rigor-levels wrote".
- **Decision**: PENDING

### F7 — Two write paths remain around the commit and the move

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 change 1 (guard), Phase 3 change 2 (pre-checks via `endRun`)
- **Detail**: The guard covers `init`, `next` and `status --report` when the folder is missing and an anchored archive folder exists; plain `status`, `verify-archive` and the rigor-levels `risk` command write nothing. That answers the main question. Two paths are left. (a) After a partial `/10x-archive` failure (`status: archived` stamped, folder still in `context/changes/`), the guard does not fire, so `next` runs the `done` branch again, rewrites `report.md` and `meta.json`, and commits again, on a folder the skill has declared archived. Add: when `change.md` has `status: archived`, `init` and `next` halt without writing, which mirrors the skill's own resolution check (`:57`). (b) A pre-check failure on a resumed `next` goes through the writing `endRun` (plan: "any failure ends the run as a normal halt through endRun"). If the first `next` already committed and returned `archive`, and the user then stages a file, the resumed `next` rewrites `meta.json` and `report.md` with a `halt` outcome, dirtying the committed folder. Use the print-only path when the folder is already committed (`git ls-files` shows `agent-smith/report.md` tracked and clean).
- **Fix**: Add the `status: archived` halt to the guard and make the pre-check halt print-only when `report.md` is tracked and unmodified.
- **Decision**: PENDING

### F8 — Small accuracy and hygiene items in the docs and criteria

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 criterion 3.4, Phase 4 changes 1 to 3 and criterion 4.5
- **Detail**: (a) The router's git writes are `git add`, `git commit` and `git reset`, so the `AGENTS.md` wording "only git write is the pre-archive commit" and the ADR rule "MUST NOT run a git write command" should say "index and commit writes of the pre-archive commit". (b) Criterion 3.4 greps for the quoted string `"push"`; an array like `['push']` or a template string passes. Grep for `push` as a word in `execFileSync`-style call sites, or list the allowed git subcommands in a test. (c) Criterion 4.5 greps `FR-008 -A3`; the entry is two lines plus the note, so it fits now, but it breaks if the note takes more than three lines. (d) `AGENTS.md` asks to update "How the tier moves" in `SKILL.md` when tier logic changes; the new pinned `steps.archive` is tier data, so add one relative-wording bullet (no model or effort names; 4.3 still passes, checked on the current file). (e) The commit takes everything in the folder, so editor junk (for example `.DS_Store`) is committed too; the README should say so. (f) The commit lands on the current branch, including `main`; the plan puts protected-branch detection out of scope, so the README should state it. (g) `gitTimeoutMs` kills git on timeout but not a hung hook child, and the best-effort `git reset` can then hit a stale `index.lock`; say so in the Performance note.
- **Fix**: Apply (a) to (g) as wording and criterion edits in Phase 3 and Phase 4.
- **Decision**: PENDING

### F9 — The roadmap edit (S-09 to `planning`) is appropriate, with one stale phrase

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `context/foundation/roadmap.md` (S-09 row and item body), diff vs `main`
- **Detail**: The diff against `main` changes two lines: the S-09 table status and the S-09 item `Status`, both `proposed` to `planning`, plus `change.md` `new` to `planned`. This is appropriate: the rigor-levels plan says the `planning` flip belongs to the `/10x-plan` persistence step (its Phase 6 change 6), and nothing else in the roadmap changes. It is also not listed in any plan phase, which is right since it is workflow bookkeeping, not implementation. Two notes. S-09 goes from `proposed` straight to `planning` while its prerequisite S-03 is not merged (`ready` is skipped); harmless, but S-09's own Risk line says it waits for S-03. The Outcome text still says "commit its run state" in both the table and the item, while the plan now commits the whole change folder (owner decision A). `/10x-archive` will match `Change ID: archive-adapter` and close S-09 on archive, so the Outcome text is what gets copied into the `## Done` entry.
- **Fix**: When the implement step runs, change "commit its run state" to "commit the change folder" in the S-09 row and item. Leave the status flip as is.
- **Decision**: PENDING
