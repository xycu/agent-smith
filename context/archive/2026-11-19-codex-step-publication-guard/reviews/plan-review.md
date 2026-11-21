<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Codex step publication guard

- **Plan**: context/changes/codex-step-publication-guard/plan.md
- **Mode**: Deep (checked by hand against the rule evaluator and the code; no sub-agent, per the lesson on nested subagents)
- **Date**: 2026-11-20
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths checked (rule file, `run-codex.mjs`, `codex-helpers.mjs`, `codex-runner.test.mjs`, test README, `docs/REFERENCE.md`, ADR-024, `open-pr.mjs`, `pr-comment.mjs`) ✓, spawn sites `:32` and `:177` confirmed (probe `:225` and exec `:285` go through `launch`) ✓, brief↔plan ✓. Progress ↔ phase Success Criteria rows match (1.1-1.3, 2.1-2.3, 3.1-3.4 Automated; 3.5-3.6 Manual); one `## Progress` heading; no checkboxes outside it. No existing test deep-equals a whole `calls.jsonl` record, so the added `env` field breaks nothing. `codex execpolicy check` (0.169.0) confirmed: a `["git","push"]` forbidden rule beats the `["git"]` allow (and the `git push --delete` prompt), `["gh", [..]]` alternation works, and `gh -R a/b pr create`, `gh run list`, `gh --version` match no rule under the plan's seven-subcommand list.

Publication check (always-true rule of `plan-review`): no Automated criterion needs a pushed branch, an open PR, PR CI or a PR comment. 3.4 lints local commits (`main..HEAD`); 3.5 and 3.6 are Manual. Nothing to move.

## Findings

### F1 — Seven-subcommand `gh` list leaves other mutating and bypass forms to the approval path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 1. Rule file and 2. Rule test; Desired End State; Implementation Approach
- **Detail**: The plan forbids only `gh pr|api|release|repo|issue|auth|workflow` and says other `gh` forms "fall to the host's approval path". Checked with `codex execpolicy check`: `gh run list`, `gh --version` and `gh -R a/b pr create` match no rule. That path ends at the auto reviewer, which may approve (the plan's own argument against `prompt`). Unlisted families mutate GitHub or keep a bypass open: `gh gist create`, `gh secret set`, `gh variable set`, `gh run rerun|cancel`, `gh label create`, `gh ssh-key add`, `gh codespace`, `gh extension`, `gh alias`. The plan's Current State Analysis says no step prompt, rule file or skill needs `gh`, and the always-true rules forbid a step calling `gh`. A blanket prefix `["gh"]` also matches `gh -R <repo> pr …`, which the plan listed as unenforceable.
- **Fix A ⭐ Recommended**: Replace the blanket `gh` allow with one `["gh"]` forbidden rule.
  - Strength: Closes every `gh` family and the `-R`/global-flag bypass with one line; fewer rules and a shorter test table; matches "no step needs gh".
  - Tradeoff: A human using Codex interactively in this repo loses `gh` read forms too (the plan already forbids `gh pr view` and `gh api`).
  - Confidence: HIGH — prefix semantics observed with the real evaluator; no `gh` caller in steps.
  - Blind spot: A future step that needs read-only `gh` would need the forbidden rule narrowed, because strictest-wins ignores an added allow.
- **Fix B**: Keep the seven-subcommand list and add more subcommands as found.
  - Strength: Leaves unlisted read-only forms to the approval path.
  - Tradeoff: Whack-a-mole; `gh -R …` and new `gh` subcommands stay open.
  - Confidence: MEDIUM — list completeness cannot be proven.
  - Blind spot: Subcommands added by `gh` upgrades or extensions.
- **Decision**: APPLIED — Fix A. Plan changed in: Overview, Desired End State, Implementation Approach (decisions sentence), Phase 1 Overview, Phase 1 §1 Rule file (Intent, Contract), Phase 1 §2 Rule test (Contract table adds `gh run list`, `gh gist create`, `gh secret set X`, `gh --version`, `gh -R a/b pr create`; file-shape assertion now "no rule allows `["gh"]`"), Phase 3 §1 Reference (Contract: Enforced and Cannot enforce lists). Plan brief changed in: Desired End State, Key Decisions rows "Blanket allows" and "gh forms".

### F2 — The live check can publish for real if the guard fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Manual Verification; Success Criteria Manual bullet 1
- **Detail**: The manual step tells a Codex step to run `git push origin HEAD`, `gh pr create` and `gh auth token` with `GH_TOKEN` set. The bullet does not say which remote the scratch clone has or whether the token is real. If the rule file does not load (the plan lists untrusted projects as a risk) the push and PR would reach a real remote. The Manual Testing Steps already say "dummy `GH_TOKEN`", so the criterion and the steps disagree.
- **Fix**: State that the scratch clone's `origin` is a local bare repository and `GH_TOKEN` is a dummy value.
- **Decision**: APPLIED — Phase 3 Manual Verification, first bullet (local bare `origin`, dummy `GH_TOKEN`); plan brief, Success Criteria (Summary). Progress row 3.5 left as is.

### F3 — Reference paragraph asserts trust and override behavior that nobody observed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — 1. Reference, Contract
- **Detail**: The contract says it states "only what was observed or is a plain consequence of the rules", then lists "rules load only when the project is trusted, and a user-level configuration or approval mode can still change what a step may run" as fact. Key Discoveries holds no such observation; the brief calls the trust point a risk.
- **Fix**: Make the paragraph say these two points were not verified here.
- **Decision**: APPLIED — Phase 3 §1 Reference, Contract ("Cannot enforce" clause on trust and user-level configuration reworded as not verified).

### F4 — Criterion 1.3 fails, rather than skips, on a machine without Codex

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria (Automated, third bullet); Progress row 1.3
- **Detail**: The title says "when Codex is installed", but the command exits "command not found" where Codex is absent (CI installs none). The in-test cross-check already covers the same claim wherever Codex exists, so the criterion adds nothing there.
- **Fix**: Do not rewrite the Progress row; say in the phase's Implementation Note that a missing `codex` makes 1.3 skipped, not failed.
- **Decision**: APPLIED — Phase 1 Implementation Note. Progress row 1.3 untouched.

### F5 — Env test wording leaves the lower-case keys ambiguous

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — 3. Runner tests, Intent
- **Detail**: "the four names in upper and lower case … drops exactly the four" does not say whether the lower-case keys must go. The pattern carries the `i` flag, so they do, and an implementer could assert the wrong count.
- **Fix**: State that all eight keys are dropped and exactly the other four kept.
- **Decision**: APPLIED — Phase 2 §3 Runner tests, Intent (first test).
