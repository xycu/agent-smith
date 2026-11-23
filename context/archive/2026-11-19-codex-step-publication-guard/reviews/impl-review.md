<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Codex step publication guard

- **Plan**: context/changes/codex-step-publication-guard/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-21
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Summary

All planned files changed as described: the rule file (`.codex/rules/project.rules`) forbids `git push` and `gh` and has no `gh` allow; `codexChildEnv` in `skills/10x-pipeline/scripts/run-codex.mjs` is passed to both `spawn` sites (the app-server and `launch`, which covers the sandbox probe and `exec`); the toolkit discovery in `runner-toolkit.mjs` runs inside the sandbox probe and so inherits the scrubbed environment; the new rule test, the runner tests, the test index rows, the REFERENCE paragraph and the ADR-024 amendment are in place. No unplanned file changed. The real `codex execpolicy check` (codex-cli 0.171.0 on this machine) agrees with the test table, and an extra check with a second rule file that allows `gh` and `git push` still returned `forbidden`, so strictest-wins holds across loaded rule files.

Automated criteria, measured on the code before the review edits:

| Criterion | Result |
|-----------|--------|
| 1.1 `node --test skills/10x-pipeline/test/codex-rules.test.mjs` | PASS, 3/3, the execpolicy cross-check ran |
| 1.2 `! grep -nE 'pattern = \["gh"\], decision = "allow"' .codex/rules/project.rules` | PASS |
| 1.3 `codex execpolicy check --rules "$PWD/.codex/rules/project.rules" git push origin main --force` | PASS, `"decision":"forbidden"` |
| 2.1-2.3, 3.1 full suite `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | PASS, 2118 tests, 2115 pass, 0 fail, 3 skipped (the full suite contains the 2.1-2.3 files) |
| 3.2 `grep -n "Codex publication guard" docs/REFERENCE.md` | PASS |
| 3.3 `node tools/version-check.mjs` | PASS (1.15.0) |
| 3.4 `node tools/commit-lint.mjs main..HEAD` | PASS |

Manual rows 3.5 and 3.6 are unchecked in Progress; the manual-verify steps recorded them as not proved (see F2).

## Findings

### F1 — The reference lists the rule refusal as enforced without its trust condition

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:37, docs/ADR/ADR-024-openai-codex-support.md:78
- **Detail**: The "Codex publication guard" paragraph said "Enforced: … `forbidden`, and the strictest matching rule wins, so a user-level allow cannot undo it" and later "Not verified here: whether rules load only for a trusted project". The plan's Phase 3 contract asks the paragraph to state only what was observed and not to assert either way on trust or user-level configuration. The live run recorded in `evidence/command-live-codex-untrusted-run.md` (codex-cli 0.169.0) observed the opposite of "enforced" in an untrusted clone: Codex printed that untrusted project-local configuration is disabled, and `git push` and `gh` ran, also with a `-c projects.<path>.trust_level="trusted"` override. A reader of the reference would take the rule refusal as unconditional. The ADR-024 amendment had the same unconditional sentence. The "cannot undo" claim holds only between loaded rule files: `codex execpolicy check --rules <user.rules allowing gh and git push> --rules .codex/rules/project.rules gh pr create` returned `forbidden` in this review.
- **Fix**: State that the rule file applies in a trusted project only, record the live observation, keep the "cannot undo" claim limited to another loaded rule file with its evidence, keep the user-level configuration and approval mode as not verified, and add the trust condition to the ADR-024 amendment.
- **Decision**: APPLIED in 3265b6ea — REFERENCE paragraph and ADR-024 amendment now state the trust condition and the observation.

### F2 — The live refusal is unproven and the rule half of the guard may be inactive in real runs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Success Criteria
- **Location**: context/changes/codex-step-publication-guard/plan.md (Progress 3.5, 3.6); context/changes/codex-step-publication-guard/evidence/unproven.md
- **Detail**: Manual rows 3.5 and 3.6 are unchecked and the manual-verify steps recorded them as not proved, so they are not rubber-stamped. The only live run used an untrusted clone, so no real `codex exec` has refused `git push` or `gh` by rule. The run worktree of a routed run lies under `.claude/worktrees/…`, a path other than the main checkout; whether Codex treats it as trusted is unknown, and the runner neither grants trust nor checks that project rules loaded (REFERENCE: "The runner grants no trust or permissions"). If the run worktree is untrusted, only the token scrub protects publication in practice. The scrub was observed to work live (no `GH_TOKEN` or `GITHUB_TOKEN` inside the step).
- **Fix A ⭐ Recommended**: A human repeats the live check in a trusted clone and, if possible, in a real run worktree, and records the result in the evidence folder.
  - Strength: Closes 3.5 and 3.6 with observed behaviour and settles whether run worktrees inherit trust.
  - Tradeoff: Needs `codex exec --trust` or a `projects` entry in the user's Codex configuration, which a step must not write.
  - Confidence: HIGH — the evidence script `evidence/script-live-codex-refusal.mjs` already exists.
  - Blind spot: Codex versions after 0.169.0 may change trust resolution for linked worktrees.
- **Fix B**: Add a runner preflight that refuses to launch when the project rule file is not loaded for the run worktree.
  - Strength: Makes the guard fail closed instead of depending on an installation prerequisite.
  - Tradeoff: Outside this plan's scope (the plan excludes `.codex/config.toml` and runner policy beyond the environment), and no model-free way to read the loaded rules was verified.
  - Confidence: LOW — no Codex interface that reports loaded project rules was found.
  - Blind spot: Whether `codex sandbox` or `app-server` exposes the trust state.
- **Decision**: PENDING — no clear fix inside the plan's scope: the owner must run the trusted live check (it writes the user's Codex trust configuration) and decide whether the runner should verify that project rules load before launch.

### F3 — The fake Codex CLI writes host token values into fixture files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/test/codex-helpers.mjs:39
- **Detail**: `seenEnv` kept every variable whose name contains `TOKEN` with its value, and the fake wrote it to `calls.jsonl` on every sandbox and exec call and to `server-env.json` on every app-server start, in every Codex runner test. `codexFixture` passes the host environment (minus `GIT_*`), and `codexChildEnv` keeps token names outside the `GH_`/`GITHUB_` pattern by design. On this machine `CLAUDE_CODE_MESSAGING_TOKEN` is set, so its value was written to scratch files; `NPM_TOKEN` or a CI token would be too. The plan's intent for the filter was that host variables never land in fixtures. The test needs only the token names and the marker value.
- **Fix**: Record token-like names with a placeholder value and keep the real value only for `CODEX_TEST_KEEP`.
- **Decision**: APPLIED in 3265b6ea — token-like names are recorded with the value "set"; the env tests still pass on both chains.

### F4 — The ADR amendment says `forbidden` replaces `prompt`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-024-openai-codex-support.md:78
- **Detail**: Before this change `git` and `gh` had a blanket `allow`, not `prompt`. The plan and the reference describe `forbidden` as chosen over `prompt`; "replaces `prompt`" suggests a previous `prompt` rule.
- **Fix**: Reword to "`forbidden` was chosen over `prompt` because …".
- **Decision**: APPLIED in 3265b6ea — the amendment now says `forbidden` was chosen over `prompt`.

## Verification after the fixes

The review edits touch `docs/REFERENCE.md`, `docs/ADR/ADR-024-openai-codex-support.md` and `skills/10x-pipeline/test/codex-helpers.mjs`. After them: `codex-rules.test.mjs` 3/3 pass; the three new env tests in `codex-runner.test.mjs` pass; 1.2, 1.3, 3.2 and 3.3 pass; the full suite and commit-lint results are below.

- Full suite: 2118 tests, 2115 pass, 0 fail, 3 skipped.
- `node tools/commit-lint.mjs main..HEAD`: OK, including the fix commit 3265b6ea.
