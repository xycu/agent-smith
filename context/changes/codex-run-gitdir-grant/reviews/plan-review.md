<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Codex Run Gitdir Grant Implementation Plan

- **Plan**: context/changes/codex-run-gitdir-grant/plan.md
- **Mode**: Deep (claims verified directly against the code; no sub-agent, because a step subagent keeps its own work)
- **Date**: 2026-11-24
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 1 observation

Verdict and counts are as measured on the plan before the fixes below were applied.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (`run-codex.mjs`, `permission-probe.mjs`, `state.mjs`, `runner-dispatch.mjs`, `flow.mjs`, `route.mjs`, `docs/REFERENCE.md`, `ADR-024`, the three test files), symbols ✓ (`configArgs`, `dispatchTarget`, `codexProfileArgs`, `readGuarded`, `REFERENCE.md` phrase "grants no trust or permissions"), brief↔plan ✓, Progress↔Phase ✓ (one `## Progress`; rows 1.1-1.4, 2.1-2.2, 3.1-3.3 match the Success Criteria; no checkboxes in phase bodies). No Automated criterion needs a pushed branch, a PR or PR CI. `codex-policy.json` carries no `codex` object, so the plan's "check and add" step needs no edit there.

## Findings

### F1 — Dispatch validation misses the archive branch; one reference is mislabeled

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis (dispatch chain), Key Discoveries, Phase 1 §2
- **Detail**: `runner-dispatch.mjs` has two exact-match checks. The run branch (`:44`, `:54`) is in the plan. The archive branch (`:76-77`) compares a fixed key list (`provider, model, effort, profile, archivePath, prompt, agent`) against `archiveDescriptor` (`isolation.mjs:841`, which spreads `...target`). The archive action will carry `permissions`, but the list does not check it, and a strict `!==` against an absent field would read `undefined !== null` as stale. The plan also calls `route.mjs:777` a neutral replay; it only prints the status step list. The replay is `flow.mjs:500`, and `route.mjs:269`/`:322` and `isolation.mjs:841` carry the new field through `...target` with no edit.
- **Fix**: Name the archive branch in Phase 1 §2, compare `?? null` on both sides, add `"permissions"` to the key list, correct the `route.mjs:777` description, and add legacy/neutral-retry/archive test cases.
- **Decision**: APPLIED — Current State Analysis (dispatch chain bullet), Key Discoveries (`runner-dispatch.mjs` bullet), Phase 1 §2 Intent and Contract, References.

### F2 — The grant evidence is lost on the refusal path, and the no-grant refusal gives no way out

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 Contract, Phase 2 §1 Contract and tests
- **Detail**: The plan says `envelope.preflight` "additionally records `grant`". The runner sets `envelope.preflight = proof` only after a successful preflight and replaces the whole object, so a naive edit drops `grant`. On a refusal `envelope.preflight` is never set, so the evidence is missing exactly when it matters. When no grant is attempted (no name, builtin `:` name, invalid name, no gitdir) the refusal still tells the user only the old generic causes plus stderr. Nothing says that setting `codex.permissions` fixes it.
- **Fix**: Merge as `{ ...proof, grant }` on success. On both refusals append a grant status (profile and gitdir, or the no-grant reason with a pointer to `codex.permissions`) before the stderr tail, and test it.
- **Decision**: APPLIED — Phase 1 §3 Contract, Phase 2 §1 Contract, Phase 2 §2 Contract; `plan-brief.md` scope bullet and decisions row.

### F3 — Config file reads ignore the repo's lock-free read rule and the symlink case

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 Contract ("Read with a size bound")
- **Detail**: The runner reads `<ROOT>/.codex/config.toml`, a file the repository controls, and `$CODEX_HOME/config.toml`, outside any run lock. A size bound does not stop a FIFO there from blocking the runner forever. `lessons.md` ("Open a lock-free read target by descriptor, never lstat then read") requires `O_NOFOLLOW | O_NONBLOCK`, `fstat` and a regular-file check. A blanket `O_NOFOLLOW` would also break a symlinked `~/.codex/config.toml`, which dotfile managers create. The plan decides neither.
- **Fix**: Bounded descriptor read for both files. `O_NOFOLLOW` only for the project file. Resolve the `CODEX_HOME` file with `realpath`. Reuse `readGuarded` (`state.mjs:1103`) where it fits. Test a FIFO, a directory and a symlink.
- **Decision**: APPLIED — Phase 1 §3 Contract and Phase 1 §4 test contract.

### F4 — Tie cases left to the implementation: TOML line forms, byte versus character counts, control characters

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 Contract, Phase 2 §1 Contract and tests
- **Detail**: "The first top-level `default_permissions = "<name>"` line" does not say what single quotes, a trailing comment, `default_permissions="x"` or a dotted key do. Phase 2 says "last 512 bytes" but the existing pattern (`proofText.slice(-8192)`) counts UTF-16 characters, so multibyte stderr could exceed 512 bytes while the test asserts at most 512 bytes. "Control characters" in a path is not defined, and DEL (0x7f) is not escaped by `JSON.stringify` yet is invalid in a TOML basic string.
- **Fix**: Pin one line regex (basic double-quoted string, optional comment), tail by `Buffer` bytes before decoding, reject `[\x00-\x1f\x7f]` in the gitdir, and cover each in tests.
- **Decision**: APPLIED — Phase 1 §3 Contract, Phase 1 §4 test contract, Phase 2 §1 Contract, Phase 2 §2 Contract.

### F5 — Docs sweep is limited to named files; one `SKILL.md` sentence is left unexamined

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: What We're NOT Doing (`SKILL.md` bullet), Phase 3 §2
- **Detail**: Both `SKILL.md` files say existing controls own authentication, trust and Git permissions "without creating profiles or granting trust". The plan leaves `SKILL.md` unchanged without saying why that stays true, and Phase 3 only edits `REFERENCE.md` and ADR-024. `lessons.md` ("Grep every doc for the old behavior when a script's output changes") asks for a grep across all docs.
- **Fix**: State in What We're NOT Doing that the sentence stays true (no profile, no trust, one path of an existing profile), and add a final grep of `README.md`, `docs/` and both `SKILL.md` files for the old phrase to Phase 3 §2.
- **Decision**: APPLIED — What We're NOT Doing (`SKILL.md` bullet) and Phase 3 §2 Contract.
