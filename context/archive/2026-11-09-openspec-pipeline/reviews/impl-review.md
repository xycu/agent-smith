<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: OpenSpec Chain on the Shared Router Implementation Plan

- **Plan**: context/changes/openspec-pipeline/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations

The verdict and counts were measured on the code at 10a0532, before the fixes below. This review replaces the step 9 report. The step 9 fixes (its F1, F2, F3, F6 and F9) are in 10a0532 and were checked again. Its open observations are carried over here as F4 to F8.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Success criteria (re-run)

At 10a0532:

- Full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 830 tests, 828 pass, 0 fail, 2 skipped.
- `git diff --exit-code 0e49df5 -- skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/test/loops-existing.test.mjs`: exit 0.
- `node tools/version-check.mjs`: OK (0.7.1).
- `openspec-contract.test.mjs` against CLI 1.16.1: 4 pass. With `OPENSPEC_BIN=/nonexistent`: 4 skipped, exit 0.
- `init demo --chain openspec` and `status demo --chain openspec` in a scratch project print valid JSON.

After the fixes (99dbd2a):

- Full suite: 833 tests, 831 pass, 0 fail, 2 skipped.
- The helpers and loops-existing diff exits 0.
- version-check is OK.
- The contract test gives 4 pass.
- `node tools/commit-lint.mjs HEAD~1..HEAD` is OK.
- A scratch `init`/`status --chain openspec` prints valid JSON.

Manual rows:

- 1.8 and 5.5 carry evidence files.
- 5.6, one live `/agent-smith:openspec-pipeline` run, is still pending.

Plan drift:

- Every contract bullet of Phases 2 to 5 is implemented.
- The 10x chain is unchanged apart from the usage text and the policy section hashes.
- The extras are consistent with the plan: the `chain` key on the paths object, `isArchiveName` for dated ids, the guard in plain `status` and the skill's pre-checks.
- The plan's Migration Notes were missing from REFERENCE (F9).

## Findings

### F1 — An archived 10x change is resolved as an OpenSpec run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:633-641 (`storedChain`), :643-657 (`resolveChain`)
- **Detail**:
  - The step 9 fix keeps an archived OpenSpec run from claiming its name while `context/changes/<id>/` is live. Once the 10x change that reused the name is archived itself, the claim comes back.
  - Probe, with an archived OpenSpec `foo` and an archived 10x `foo`:
    - `verify-archive foo --path context/archive/2026-11-09-foo` returns `archived: false` with "--path context/archive/2026-11-09-foo is not an archive folder of foo. Archive folders of foo: openspec/changes/archive/2026-11-01-foo."
    - `--chain 10x` halts as a contradiction.
  - The 10x skill never passes `--chain`, so its archive check fails after a name reuse that the step 9 fix allowed.
  - The `resolveChain` comment also said that `init` without the flag is a 10x init. For a name that only an archived OpenSpec run holds, it resolves to openspec, which the test "next and status on a moved OpenSpec run halt as archived" relies on.
- **Fix**:
  - `storedChain` returns no chain when a 10x archive folder of the name exists (`archiveDirs(id, "10x")`), as it already does for a live 10x folder.
  - Correct the `resolveChain` comment and the REFERENCE chain-switch bullet.
  - Add a test.
- **Decision**: APPLIED - 99dbd2a; the new test "an archived 10x change that reuses the name of an archived OpenSpec run is verified as 10x" covers `verify-archive` without the flag, with `--chain 10x` and with `--chain openspec`.

### F2 — The change name `archive` writes OpenSpec run state into the archive root

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:663 (id check), skills/10x-pipeline/scripts/state.mjs (`openspecPaths`)
- **Detail**:
  - `archive` passes `^[a-z0-9][a-z0-9-]*$` and resolves to `openspec/changes/archive/`, which is OpenSpec's archive root.
  - In a scratch project with `openspec/changes/archive/2026-01-01-old`, `init archive --chain openspec` returned `os-propose` and wrote `openspec/changes/archive/agent-smith/{meta.json,run.jsonl}`.
  - The start commit and the step commits would then stage `openspec/changes/archive/`, which holds every archived change.
- **Fix**:
  - Every command that resolves to the OpenSpec chain halts on the id `archive` before anything is written.
  - Document it in REFERENCE.
  - Add a test.
- **Decision**: APPLIED - 99dbd2a; the new test "the name archive halts for the OpenSpec chain" covers `init`, `next` and `status`.

### F3 — A critical line under `Critical: 0` reads as PASS

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/openspec.mjs:115 (`readVerdict`)
- **Detail**:
  - `Verdict: PASS`, `Critical: 0`, `Warnings: 0` followed by `## Critical` and `- real bug at a.js:1` parsed as `{ ok: true, verdict: "PASS", critical: 0 }`. The run ends `done`, and in an `--archive` run it archives.
  - Step 9 left this open (its F5) because a verify step might write `- none` under an empty section.
  - The `os-verify` guide rules that out. It says to keep each heading "when its list is empty", to write one `- ` line per issue, and to make `Critical: <n>` equal the number of lines. A `- none` line therefore breaks the guide's own contract.
  - The 10x reader (ADR-011) never reads a review as cleaner than it says.
- **Fix**: The critical count is the larger of the header count and the `- ` lines under `## Critical`, so any such line reads as FAIL.
  - Strength: a miscounted `verify.md` can no longer end or archive a run with a critical issue; same rule as ADR-011.
  - Tradeoff: a verify step that breaks the guide with `- none` starts a fix loop, bounded by `limits.maxFixLoops`, and then halts for a human.
  - Confidence: HIGH — the guide defines empty sections as having no lines.
  - Blind spot: only one live verify output exists (`evidence/check-3-live.md`).
- **Decision**: APPLIED - 99dbd2a. `readVerdict` takes the larger count, REFERENCE says so, and the new test "a critical line under a lower Critical count reads as FAIL with the larger count" covers it.

### F4 — The task-row pattern is narrower than the CLI, and its code comment said it was not

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/openspec.mjs:7-9 (`TASK_ROW`), skills/10x-pipeline/scripts/isolation.mjs:531-534
- **Detail**:
  - CLI 1.16.1 counts tasks with `TASK_LINE_PATTERN` (`dist/utils/task-progress.js`): bullets `-`, `*`, `+` or `1.`/`1)`, and any marker other than `x`/`X` is open.
  - The router counts only `- [ ]`, `- [x]` and `- [X]`. A probe read `{ total: 4, open: 3 }` where the CLI read 11 rows.
  - Missed open rows (`* [ ]`, `1. [ ]`, `- [~]`, `- []`) let the run reach `os-verify` and the archive pre-check with open work. `openspec archive --yes` then only warns.
  - Phase 1 found this (`evidence/check-3-cli.md` section 4). The plan (Phase 2 item 2) kept the narrow pattern, and REFERENCE "Limits" documents it.
  - The code comment claimed the pattern was "as narrow as OpenSpec's own", which is false.
- **Fix**: Adopt the CLI's `TASK_LINE_PATTERN`, count every marker other than `x`/`X` as open, and update the test "tasks.md without checkboxes halts", whose `* [ ]` case codifies the narrow form.
  - Strength: router and CLI agree on open work, so neither the verify step nor the archive pre-check sees fewer open rows.
  - Tradeoff: departs from the plan's pattern and a written test; the contract test should gain non-standard rows.
  - Confidence: HIGH — the CLI source and the Phase 1 probe agree.
  - Blind spot: the pattern can change in a later CLI version.
- **Decision**: ACCEPTED - the owner chose to widen the pattern to the CLI's TASK_LINE_PATTERN (2026-11-09). The router copies it and the contract test covers every list form and marker.

### F5 — A router call without --chain blocks a later OpenSpec init

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:67 (`fs.mkdirSync(p.dir, ...)`), :645-657 (`resolveChain`)
- **Detail**:
  - Take a fresh OpenSpec change with no `meta.json` yet.
  - `next demo` or `status demo --report` without the flag resolves to the 10x chain. It creates `context/changes/demo/agent-smith/` and halts with "No change folder. Run /10x-new demo first."
  - After that, `init demo --chain openspec` halts on the D8 collision ("context/changes/demo/ exists").
  - The OpenSpec skill always passes `--chain openspec`, so only a hand-run command or the 10x skill on that name triggers this. Deleting the stray folder recovers.
- **Fix**: Choose one.
  - Halt and ask for `--chain` when `openspec/changes/<id>/` exists and `context/changes/<id>/` does not. Strength: no stray state. Tradeoff: changes the "no flag is 10x" rule.
  - Have the 10x `next` skip `mkdirSync` when `change.md` is missing. Strength: no chain-rule change. Tradeoff: changes 10x output, which the plan keeps byte-identical.
  - Confidence: MED — both are small edits, but each touches a rule the plan fixed.
  - Blind spot: whether a user runs the router by hand on OpenSpec names.
- **Decision**: ACCEPTED - the owner kept the behaviour as a documented limit (2026-11-09); REFERENCE "Limits" names the stray folder and the way out.

### F6 — tasks.md and verify.md readers lack the guards of the other file readers

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/openspec.mjs:11-28, :90-116
- **Detail**:
  - `readTasks` and `isFile` follow symlinks and have no size cap.
  - `readVerdict` refuses a symlink, but has no byte cap and no real-path containment.
  - Neither strips `\p{Cc}`/`\p{Cf}` characters. A probe carried U+202E and BEL from `## Critical` into the `{findings}` text of the fix prompt.
  - `readComplexity` (preplan.mjs) and the `unproven.md` reader (steps.mjs) apply all of these guards. `readPlan` sets the no-cap precedent.
- **Fix**: Reuse the `unproven.md` hardening for `verify.md` (size cap, containment, control and format character strip), and lstat and cap `tasks.md`.
- **Decision**: ACCEPTED - the owner chose guarded readers with constants, not policy keys (2026-11-09): lstat, real-path containment, 256 KiB for tasks.md, 64 KiB for verify.md, control and format characters stripped.

### F7 — compare resolves the chain from the current project and counts os-propose output as input files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/route.mjs:345-406 (`locateSide`, `readSide`)
- **Detail**:
  - Without `--chain`, `compare` reads the stored chain of the project it runs in, not of `--routed` or `--baseline`.
  - For the OpenSpec chain, `inputFiles` lists `proposal.md`, `design.md`, `tasks.md` and `specs/`, which `os-propose` may produce. Two arms that differ only in the optional `design.md` get a spurious input-files warning.
  - REFERENCE says the baseline procedure is written for the 10x chain.
- **Fix**: Give the OpenSpec chain its own list of produced files, and document that `compare` on OpenSpec runs needs `--chain openspec`.
- **Decision**: ACCEPTED - the owner chose to fix it (2026-11-09): the OpenSpec chain lists proposal.md, design.md, tasks.md and verify.md as produced files; REFERENCE says compare needs --chain openspec.

### F8 — --chain openspec on a 10x run is not halted as a contradiction

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:653-656 (`resolveChain`)
- **Detail**:
  - A contradicting flag halts only when the stored chain is `openspec`.
  - On a 10x run, `next --chain openspec` halts with the generic "No OpenSpec change folder".
  - `status --chain openspec` prints an empty log with `openspec: { planningComplete: false }`.
  - `init` is covered by the D8 collision.
- **Fix**: Treat a live `context/changes/<id>/agent-smith/meta.json` as a stored 10x chain, so `--chain openspec` halts there.
- **Decision**: ACCEPTED - the owner chose to fix it (2026-11-09): a live context/changes/<id>/agent-smith/meta.json counts as a stored 10x chain, so --chain openspec halts there.

### F9 — REFERENCE lacked the plan's upgrade note and the fix-loop count rule

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/REFERENCE.md (OpenSpec section)
- **Detail**:
  - The plan's Migration Notes say that a 10x run in flight records `provenance.drift` for `steps` and `prompts`. Every earlier change that added policy keys carries such an "Upgrade note" in REFERENCE; this one did not.
  - The OpenSpec fix-loop cap counts only verified `os-apply-fix` steps (openspec.mjs:186). The 10x cap counts every `fix` attempt (flow.mjs `count("fix")`). REFERENCE did not say so.
- **Fix**: Add the upgrade note and one sentence on the count to the OpenSpec section.
- **Decision**: APPLIED - 99dbd2a.
