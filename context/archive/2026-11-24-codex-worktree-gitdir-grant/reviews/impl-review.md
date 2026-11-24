<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Narrow per-run Codex Git grant, stale-line listing and macOS acceptance

- **Plan**: context/changes/codex-worktree-gitdir-grant/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

Phase 3 was reviewed for its code-side work (docs, automated rows 3.1 and 3.2). Its Manual rows 3.3 and 3.4 are unchecked and pending the owner's live macOS run (see `evidence/unproven.md`); they are acknowledged, not findings.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Success criteria run (before fixes)

- `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/init-permissions.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs`: 202 tests, 202 pass.
- `grep -rn "grants write access to one path\|\"<common>\" = \"write\"" docs README.md skills`: one hit, `docs/ADR/ADR-024-openai-codex-support.md:86`, the historical #285 amendment the plan names as the one expected hit.
- `node tools/version-check.mjs`: OK (1.16.2).

After the fixes: runner, providers and no-recursive-delete tests 189/189 pass; the doc grep still has only the expected hit; version check OK.

## Findings

### F1 — Docs still call the packed-refs outcome an open check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-024-openai-codex-support.md:96, docs/REFERENCE.md:46
- **Detail**: The ADR amendment said "whether branch deletion, `gc` or `pack-refs` need it is a recorded Manual check", and REFERENCE only said the grant never covers `packed-refs`. The Phase 1 manual evidence (`evidence/command-codex-sandbox-grant-output.txt`, row 1.5) settled it: branch creation and `git gc --auto` pass, but `git branch -d` and `git pack-refs --all` fail on `<common>/packed-refs.lock`, a new file in the common dir that only a whole-common-dir grant would allow. Phase 3's intent is to record the macOS proof; the docs (commit b81ab2b0) predate the manual step and left a known limit of every sandboxed OpenAI step unstated.
- **Fix**: State the observed result and its reason in the ADR amendment and in the REFERENCE "Per-run gitdir grant" paragraph.
- **Decision**: APPLIED — aec6c30b

### F2 — Unguarded stat of a common subdirectory can throw out of the runner

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/run-codex.mjs:81
- **Detail**: `gitdirGrant` realpathed `<common>/<name>` inside a try, then called `fs.statSync(dir).isDirectory()` outside it. A directory removed between the two calls (for example `logs` during a concurrent `git` operation) threw from `gitdirGrant` into `runCodex` instead of dropping the path or the grant with a reason. Narrow race, but every other failure in the function returns `none(why)`.
- **Fix**: Move the `isDirectory` check into the same try, so any failure sets `dir = null` and takes the existing optional-`logs` or "no common subdirectory" path.
- **Decision**: APPLIED — aec6c30b

### F3 — Row 2.4 checked against a scratch config, not a live init

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/codex-worktree-gitdir-grant/evidence/test-init-stale-listing.txt
- **Detail**: Manual row 2.4 asks to run `init` in a repo whose `~/.codex/config.toml` has dead `agent-smith-*` lines and compare checksums. The recorded evidence is the automated init test with a scratch `CODEX_HOME` (byte-identical config, stale count 2). That proves the behavior but not on the owner's real config, which holds 42 `worktrees` lines (plan, Current State).
- **Fix**: The owner runs `init` once with an OpenAI step in this repository and compares `shasum ~/.codex/config.toml` before and after.
- **Decision**: PENDING — no code change can settle it; the owner decides whether the scratch-config test is enough for row 2.4 or runs the live `init` checksum comparison on the real `~/.codex/config.toml`.
