<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Step guard bypass forms Implementation Plan

- **Plan**: context/changes/step-guard-bypass-forms/plan.md
- **Mode**: Deep (code checked inline against `step-guard.mjs` and its tests; no sub-agent, unattended run)
- **Date**: 2026-11-20
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓ (`step-guard.mjs`, its test, `docs/REFERENCE.md:65-71`, `README.md:32`, `test/README.md:36`, `hooks/hooks.json`, `change.md`, archived heredoc plan), 9/9 symbols ✓ (`eventProblem`, `commands`, `commandProblem`, `gitOptions`, `shellExpansionEnd`, `shellWord`, `withoutHeredocData`, `HeredocDenial`, the `:250` and `:398` tests), brief↔plan ✓, Progress↔Phase ✓ (3 phases, rows 1.1-3.5 match their Success Criteria). No Automated row needs a pushed branch, PR or PR comment; the live check (3.4) is already Manual.

## Findings

### F1 — Value-taking long options stay exact-match, so abbreviated `--exc -n` still hides a real clean

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — item 1 (Prefix-aware long options)
- **Detail**: The plan makes the denied flags prefix-aware but leaves the `longValues` lists in `gitOptions` (`--message`, `--file`, `--author`, `--date`, commit's and clean's lists) as exact strings. Git accepts a unique abbreviation of those too, so `git clean --exc -n -fd` runs a real clean with `-n` as the exclude pattern, while the guard reads `-n` as a dry-run flag and allows it. The existing test group "Git option values cannot masquerade as safety flags" pins the full-name forms only. This reopens the same bypass through the abbreviation form the plan is closing.
- **Fix**: Match the value-taking long options with the same prefix helper in `gitOptions`; add deny `git clean --exc -n -fd` and `git commit --mess -- --no-verify`, and allow `git clean --exc pattern -n -fd`.
- **Decision**: APPLIED — Phase 2 item 1 contract and item 5 deny and allow lists.

### F2 — Attached `--config-env=core.hooksPath=...` form is not parsed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — item 3 (Global options and hook-path overrides)
- **Detail**: Git accepts `--config-env=<name>=<envvar>` as one word. The plan returns config values only from the separate-value form and tests only `git --config-env core.hooksPath=ENV commit`. `git --config-env=core.hooksPath=ENV commit -m x` therefore passes `gitOptions` as a value-less flag and skips hooks, the same effect as `--no-verify`.
- **Fix**: Read the attached `--config-env=` form into `config` too, and add the matching deny and allow tests.
- **Decision**: APPLIED — Phase 2 item 3 contract and item 5 lists.

### F3 — Wrapper loop cap of 8 rounds has no defined end behavior and fails open

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — item 2 (Normalization of the effective command)
- **Detail**: "Loop (max 8 rounds)" does not say what happens when a ninth prefix or wrapper is still there. If the leftover words are checked as they stand, `env env env env env env env env env git push` passes, which breaks the fail-closed constraint in `change.md`. The `find -exec` recursion has the same gap.
- **Fix**: Throw a `Denial` when a ninth round would still find a prefix word or wrapper, apply the cap to `find -exec` recursion, and add a nine-`env` deny test.
- **Decision**: APPLIED — Phase 1 item 2 contract, item 4 deny list, and the brief's "Unparseable forms" row.

### F4 — Stale test title and an incomplete out-of-scope list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 4 (test at `:250`), Phase 3 item 1 (`docs/REFERENCE.md:71`)
- **Detail**: The `:250` test is titled "dynamic programs and wrappers are outside the documented direct-command subset". After this change wrappers are inside it, so the plan edits the body but leaves a false title. The docs plan names the out-of-scope forms but not the launchers outside the wrapper table (`setsid`, `stdbuf`, `ionice`, `builtin`, `coproc`, `su -c`, `doas`, `watch`, `parallel`) or a command piped into `sh`, which an AI step can reach for just as it reaches for `env`.
- **Fix**: Rename the test and add those forms to the `:71` out-of-scope sentence.
- **Decision**: APPLIED — Phase 1 item 4 (test rename) and Phase 3 item 1 (`:71` contract).
