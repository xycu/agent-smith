<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Archive Adapter Implementation Plan

- **Plan**: context/changes/archive-adapter/plan.md
- **Mode**: Deep (round 2, done in the main thread with no sub-agent: the risky claims were run against real git in scratch repos and against the `rigor-levels-impl` router)
- **Date**: 2026-10-30
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 4 observations

Round 1 gave REVISE (1 critical, 5 warnings, 3 observations). The revision resolves seven of the nine findings in full and two in part (F3, F8). No finding is critical now. The four warnings are all cheap to fix in the plan text; the largest (F1 below) is a gap in the archive prompt that the plan's own manual row 4.9 would expose on the first real run. The new mechanisms held up against the real code and git: the three post-commit checks, the `--show-prefix` comparison, the half-archived guard, the `--path` validation, `archive.haltOnManualPending`, the prefix-matched prompt rules and the one-to-one Success Criteria to Progress mapping (new rows 3.7 and 4.13 included). See Grounding for what was run.

## Previous review (round 1)

| ID | Round 1 finding | Status now | Evidence |
| --- | --- | --- | --- |
| F1 | `check-ignore` on the directory misses the ignore rule at `init` | resolved | Re-run: `agent-smith/` gives exit 1 for the absent directory and exit 0 for `run.jsonl`, `meta.json` and `report.md`; `*.jsonl` gives 1 for the directory, 0 for `run.jsonl`, 1 for `meta.json`; `context/` and `context/changes/` give 0 for every file. File probes work whether or not the file exists. Plan probes four files and tests the missing-directory case. A gap that remains for other files is F6 below |
| F2 | "`git commit -- <path>` is safe against hooks" is false, no check after the commit | resolved | Re-run: a `pre-commit` hook that runs `git add hooked.txt` puts `hooked.txt` in the commit, `git diff --cached --quiet` then exits 1, `git status` shows `D  hooked.txt` and `?? hooked.txt`. The false Key Discovery is replaced with this result. Check (1) catches it; check (2) catches it too when the hook stages and the commit has no pathspec (checked: cached-quiet 0, `hooked.txt` in HEAD). A formatter hook that re-adds a folder file leaves `MM` and is caught by (1) and (3). New defect in check (2): F3 below |
| F3 | Archive prompt leans on a plain-text path and an unconditional "continue" | partially resolved | Answers are now pre-given rules, prefix match for `(Recommended)`, Polish label, `blocked` for `Uncertain review coverage`, `Missing review coverage`, `No impl-review found`, `No plan.md found` and a pending Automated row; rule 3 forbids waiting. Checked against `~/.claude/skills/10x-archive/SKILL.md`: the strings and the manual-only nudge are right. Not covered: the skill's SHA history check (F1 below) |
| F4 | `verify-archive` wrong on a reused id; late failure on an existing destination | resolved | `--path` with anchored name check and direct-child check, listing on more than one match, pre-commit `fs.existsSync(archivePath)` halt, `git status` reminder in `SKILL.md`. Fix A as recommended |
| F5 | Pending Manual rows archived with no surviving record | resolved | `Manual checks pending: N` plus rows in the final `report.md`, final-message checklist, `archive.haltOnManualPending` default `false`. `manualPending` is not in `meta.outcome` today (`endRun` stores `{ action, reason }` only), so the plan must add it; it says so in change 3 (see F5 below for the loose spec) |
| F6 | `rigor-levels` phase mapping: staged merge assumed, ADR row, usage string | resolved | Prerequisite is now the whole S-03. The mapping table is accurate against the implementation commits (helpers and `try/catch` in p2, git wrapper in p3, `needsHuman` in p5, ADR-003 in p6). ADR-003 row is `archive-and-lessons`, rename is specified. Usage string "extend, do not overwrite" is stated twice |
| F7 | Half-archived folder and a pre-check halt after the commit rewrite the folder | resolved | Guard on `status: archived` for `init`, `next`, `status --report`; print-only halt when `report.md` is tracked and the folder is clean. Matches the skill's resolution check (`10x-archive/SKILL.md:57`). Spec gaps in F5 below |
| F8 | Small accuracy items (a) to (g) | partially resolved | (a), (c), (d), (e), (f), (g) done; 4.5 re-run mechanically against the PRD (the range holds one FR line, the note and the next FR line, so a one-line note passes). (b) the `push` grep is replaced by the `git subcommands` test, but that test as specified fails against the real router (F2 below) |
| F9 | Roadmap Outcome says "commit its run state" | resolved | Phase 4 change 6 and row 4.13. `grep` confirms the phrase sits exactly in the S-09 table row (line 53) and the item body (line 191); line 199 uses "run state" in another sense and stays |

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 existing paths found (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, `prd.md`, `roadmap.md`, ADR-002, `~/.claude/skills/10x-archive/SKILL.md`, its `references/archive-sha.md`); on branch `rigor-levels-impl` also `docs/ADR/ADR-003`, `ADR-004` and `skills/10x-pipeline/test/{helpers,route,churn,rules}`; brief and plan agree. The cited line anchors still match the current checkout (`done` at `:352-356`, `mkdirSync` at `:403` and `:493`) but the code the plan extends is the `rigor-levels-impl` router (about 870 lines; `done` branch around line 645), so the anchors move; see F7. Names the plan builds on, checked against `rigor-levels-impl`: `{ ...prev, id, goal }` in `init` found; outer `try/catch` that prints `Router error: ...` found; `executed()` helper, skip entries and `Skipped steps` section found; `needsHuman` halt in `next()` found; `gitEnv`, `git`, `commitFiles`, `makeProject({ nest })`, `writeLog`, `run(..., { env })` found in `helpers.mjs`, with these differences: `gitEnv(project)` takes the project, `makeProject` writes a `change.md` with no `created`, `run` already accepts `env`, and the git wrapper is named `gitOut` (returns `null` on any failure, adds `-c core.quotePath=false`, no timeout). `steps.<name>.interactive`, `rigor.minEffort`, `effortOrder` found; `tierFor` takes `level`, not `meta.rigor`. Mechanical checks on the plan: one `## Progress` heading, 0 checkboxes outside it, 4 phase headings equal in body and Progress, every Success Criteria bullet matches a Progress row by title (Phase 1: 2+1, Phase 2: 4+2, Phase 3: 4+3 including new 3.7, Phase 4: 7+6 including new 4.13). Rule form: the seven `prompts.archive` rules and the six ADR-003 rules each pass `rules.test.mjs` (`ruleProblems`); `(Recommended)` does not trip the case-sensitive bare-keyword check. Shell criteria 2.4, 3.4 (grep part), 4.3 and 4.5 were run: 2.4 and the 3.4 grep pass on the `rigor-levels-impl` files, 4.3 passes on its `SKILL.md`, 4.5 fails now and will pass after a one-line note. No `lessons.md` and no `docs/reference/contract-surfaces.md` exist, so those checks were skipped.

Other probes run for this round (scratch repo, git 2.54, hermetic config): idempotent resume (two `next` calls on the `rigor-levels-impl` router leave `run.jsonl`, `meta.json` and `report.md` byte-identical, and a third `init` too); `git commit -- <path>` on an unborn HEAD works and `git show --name-only` lists the file; `git rev-parse --show-prefix` returns `proj/` for a project root in a subdirectory and `git show --name-only` then lists `proj/context/...`; `git mv` of a folder carries an ignored subfolder (`reviews/`) with it.

## Findings

### F1 — The archive prompt does not cover the skill's SHA history check, which a normal pre-merge run reaches

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 change 1 (`prompts.archive` rules 1 to 5), Phase 4 manual row 4.9
- **Detail**: `/10x-archive` runs a fifth warning source, the SHA history check (`10x-archive/SKILL.md` "Soft warnings" item 5, `references/archive-sha.md`). It applies to every completed Progress row that ends in ` — <sha>`, and `10x-goal-implement` writes that suffix on every phase it lands. The check looks for the implementation PR, resolves the integration branch (`git ls-remote`, `gh pr view`), runs `git fetch --no-tags <remote> ...`, then tests ancestry. For a pipeline run that archives before the branch is merged, the SHAs are not in the integration branch, there is no merged PR and often no remote. The reference then says to "ask the user to identify it or continue archiving with a warning and no repointing" and "No candidate -> ask for a commit or allow archive without repointing". None of this is one of the two prompts the rules answer. A SHA-history warning is not in rule 1's three classes either, and rule 4 lists specific warnings plus "asks any other question", so the model must guess: asking means the plain-text wait that rule 3 forbids only for the two named questions, and rule 4 then turns it into `blocked`. The first throwaway-repo run (row 4.9) has no remote and a branch that is not merged, so it would hit exactly this. There is a second, smaller conflict: rule 2 always picks `Archive without repointing`, but when the repoint prompt replaces the warnings prompt and a rule 4 warning is also listed, rules 2 and 4 disagree and no rule says which wins (rule 5 covers only the generic rules).
- **Fix**: Add one rule and extend rule 1. **GIVEN** the SHA history check cannot establish a remote, an integration branch, a PR or an integrating commit, or reports SHAs outside the target history, **WHEN** the skill would ask you to identify or confirm anything **THEN** you **MUST NOT** ask and **MUST** continue with no repointing. Add "SHA history diagnostics" to the warning classes of rule 1 and say in rule 2 that rule 4 wins when both apply. Say in 4.9 that the throwaway repo has no remote and an unmerged branch, so the row exercises this path.
  - Strength: Closes the path that is most likely on the first real run; stays in the prompt, so `/10x-archive` is unchanged.
  - Tradeoff: One more rule (eight) and a longer prompt; `git fetch` and `gh` calls by the archive subagent stay outside the router's control.
  - Confidence: MED — read from the skill text; I did not run `/10x-archive` unattended.
  - Blind spot: How an unattended model resolves "ask or warn" in the fetch-fails case is untested; row 4.9 is the check.
- **Decision**: PENDING

### F2 — The `git subcommands` test, and criterion 3.4 with it, fails against the real router

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 4 (last test), Success Criteria 3.4 and Progress row 3.4
- **Detail**: The test records git calls through a shim on `PATH` and allows `rev-parse`, `check-ignore`, `symbolic-ref`, `diff`, `status`, `add`, `commit`, `reset`, `show`, `ls-files`. The `rigor-levels` router also calls `git log` on every `next` that has a plan (`churnCounts`), and every churn call is `git -c core.quotePath=false <subcommand> ...`. Run: the `rigor-levels-impl` router on a scratch repo with a plan and `init demo --goal "fix typo"` logged `-c core.quotePath=false rev-parse HEAD` and `-c core.quotePath=false log --no-merges --relative --since=90.days -n 500 ...`. So `log` is missing from the allowed list, and a shim that reads the first argument as the subcommand sees `-c`. The criterion cannot pass as written. The plan's "the router sets no `-c` overrides" is also not true of the existing `gitOut`; it holds only for the adapter's own calls.
- **Fix**: Make the shim skip leading `-c <k=v>` pairs, add `log` to the list, and state that the no-override rule covers the adapter's write calls. Or assert the forbidden set instead of the allowed set: no `push`, no `--no-verify`, no `--no-gpg-sign`, and any `add`, `commit` or `reset` only on the change folder path.
- **Decision**: PENDING

### F3 — Post-commit check (2) halts on a legitimate commit when a path has non-ASCII characters

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 change 2 (post-commit checks (1) and (2), `--show-prefix` comparison)
- **Detail**: `git show --name-only --format= HEAD` quotes and escapes non-ASCII names by default. Run: a file `zażółć.md` in the change folder printed as `"context/changes/demo/za\305\274\303\263\305\202\304\207.md"` (with quotes), while `-z` or `-c core.quotePath=false` printed the plain name. The plan compares each line with `<prefix>context/changes/<id>/`; a quoted line starts with `"`, so check (2) names a folder file as an "extra path" and halts right after a correct commit. The same applies to a project root that sits in a non-ASCII subdirectory (`--show-prefix` prints it raw). The halt is recoverable (a resume skips the commit and check (2)), but the message is wrong and the first run stops. The `git diff --cached --name-only` and `git status` listings in the halts would show escaped names too.
- **Fix**: Read the commit's paths with `git -c core.quotePath=false show --name-only -z --format= HEAD` (NUL-separated, no quoting) and compare as raw strings; use the same flags for the listings. Add one test with a non-ASCII file name in the folder and one with the project root in a subdirectory (`makeProject({ nest })` already exists, and the plan has no nested-root case although `--show-prefix` is new logic).
- **Decision**: PENDING

### F4 — The ADR and PRD text says the router does not use git without the flag; since `rigor-levels` that is false

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 change 4 (ADR-003 "without the flag the router never touches git"), change 5 (PRD note "otherwise the router does not use git"), row 4.12
- **Detail**: The merged `rigor-levels` router reads git on every run: `init` runs `git rev-parse HEAD` for `baseSha`, `next` and `risk` run `git log` and `git diff`. ADR-003 has a "Churn risk" section for it, and the README says "Churn risk also reads `git` history". The plan's own End State says "the router runs no git write", which is accurate. The two documents the plan writes would contradict ADR-003 in the same file and the README, and row 4.12 checks only that the PRD and the ADR agree with each other, so it would pass on a false statement. Related: the ADR-003 intro says "split in four changes" and "changes 2 to 4"; the plan adds a fifth row (`lesson-candidates`) and does not update that sentence.
- **Fix**: Word both as "the router writes to git only with `--archive`" (reads stay as ADR-003 describes), and add to change 4 that the intro count and "changes 2 to 4" follow the new table.
- **Decision**: PENDING

### F5 — Halt paths around the commit are not specified one by one

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 changes 1 to 3, Phase 4 change 1 (`SKILL.md` `halt`)
- **Detail**: There are now five kinds of halt in the `done` branch, and the plan names the output path for three of them. (a) Pre-check failure, folder not committed: `endRun`, named. (b) Pre-check failure on a resume, folder committed and clean: print-only, named. (c) Failed `git add` or `commit` (after the `reset`): not named. `endRun` would set `meta.outcome` to `halt` and the report to `Archive: not run (run halted)` for a run that is `done`; print-only would leave the folder as it was. (d) Post-commit failures: print-only, named. (e) `haltOnManualPending`: a pre-check, so `endRun`. The text also says a halt with `meta.archive` "carries `archive: "skipped: run halted"`", and `SKILL.md` tells the orchestrator to say "the run was not committed or archived" when `archive` is present. That is false for (b) and (d), where the commit exists. Also, `finishRun` (change 1) says `meta.outcome` accepts an `archive` field, and change 3 says `manualPending` is kept there too; change 1 should name both.
- **Fix**: Add a five-row table (halt kind, output path, `archive` field yes or no, wording) and say that the `archive` field is carried only by halts where no pre-archive commit exists. Name `manualPending` in change 1. Treat (c) as print-only so a failed hook does not rewrite the run's final state.
- **Decision**: PENDING

### F6 — Only four files are probed for ignore rules; other ignored files in the folder are skipped silently

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Decision row 5, Key Discoveries ("`git mv` carries ignored files was not tested"), Phase 2 change 2
- **Detail**: `.gitignore` entries such as `reviews/` or `plan.md` are not among the four probe files. Run: with `reviews/` ignored, `git add -- context/changes/demo` skipped `reviews/impl-review.md` without an error, the commit held `change.md` and `meta.json` only, `git status --porcelain` for the folder was empty (clean check passes), and `git status --porcelain --ignored -- <folder>` showed `!! context/changes/demo/reviews/`. A later `git mv` of the folder moved `reviews/` with it (the rename is a directory rename; checked). So the "not tested" statement is answered: ignored files are carried. The effect is that the promise "the whole folder is committed" breaks silently for ignored files, which stay out of history. It does not break the archive.
- **Fix**: After `git add`, add one read: `git status --porcelain --ignored -- context/changes/<id>/`; a line starting `!!` is reported in the `archive` payload (or halts, owner's choice). Replace the "not tested" sentence with the result above.
- **Decision**: PENDING

### F7 — Anchors, fixtures and parser rules the plan should pin to the real code

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, Phase 1 changes 1 and 2, Phase 3 changes 3 and 4, References
- **Detail**: (a) Line anchors (`:352-356`, `:413-417`, `:485-486`, `:403`, `:493`) name the pre-`rigor-levels` file; after S-03 merges the same code sits about 300 lines lower (the usage string is inside `main()`, `halt("Usage: ...")`). The plan already says implementation waits for S-03, so reference by function name. (b) "`tierFor` ... with `log` and `meta.rigor`": the real signature is `tierFor(d, log, policy, plan, meta, level)`; pass the `level` that `resolveRigor` returned. (c) `helpers.mjs` `makeProject` writes `change.md` without `created`, so every full-path test must overwrite it; `gitEnv(project)` takes the project; `run` already accepts `env` (the "if `rigor-levels` did not add one" clause is stale). (d) Test cases for `--path` with no value (`parseFlags` gives `true`, so the code must check `typeof`) and for an absolute or `..` path are not listed, only suffix collisions and other ids.
- **Fix**: Replace line anchors with function names, correct (b), (c) and (d) in the same edit.
- **Decision**: PENDING

### F8 — `created` is parsed differently by the router and by `/10x-archive`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 2 (pre-check "`created:` not `YYYY-MM-DD`"), change 3 (`archivePath`)
- **Detail**: The skill computes the destination with `awk '/^created:/ {print $2; exit}'`: the first line in the file that starts with `created:`, second field, no quote stripping. The plan does not say how the router reads `created`; the Phase 1 frontmatter reader strips quotes. With `created: "2026-10-30"` the router could accept the value while the skill's `DEST` carries the quotes, so `archivePath` differs from the real folder and `verify-archive --path` reports `archived: false` after a good archive.
- **Fix**: Read `created` with the skill's rule (first `^created:` line, second field, unmodified) and require the exact pattern `^\d{4}-\d{2}-\d{2}$`; anything else halts before the commit. Add one test with a quoted value.
- **Decision**: PENDING
