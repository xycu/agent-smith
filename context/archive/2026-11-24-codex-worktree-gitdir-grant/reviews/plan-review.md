<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Narrow per-run Codex Git grant, stale-line listing and macOS acceptance

- **Plan**: context/changes/codex-worktree-gitdir-grant/plan.md
- **Mode**: Deep (riskiest claims checked directly against the code on `main` at `79b6cc36`; no sub-agent)
- **Date**: 2026-11-24
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓ (run-codex.mjs, init-permissions.mjs, codex-runner.test.mjs, init-permissions.test.mjs, docs/REFERENCE.md and ADR-024), 3/3 symbols ✓ (`gitdirGrant`, `configArgs`, `codexWarning`), brief↔plan ✓ after fixes (both said #285 was unmerged; it is merged as `79b6cc36`). Progress↔Phase rows match (1.1-1.5, 2.1-2.4, 3.1-3.4). No Automated row depends on a pushed branch, PR or PR CI.

## Findings

### F1 — Plan treats merged #285 as an open PR

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Overview, Sequencing, Current State Analysis, References; plan-brief
- **Detail**: The plan says "Open PR #285", "implementation starts only after #285 is merged" and cites #285's head `875e98ba`. `main` already holds it as `79b6cc36`. An implementer would wait for something that happened or look for the grant code on a branch. The code names on `main` also differ from the plan's line citations (`configArgs` is `run-codex.mjs:27-33`, `gitdirGrant` `:58-77`, grant shape `{ profile, gitDir }`), and existing assertions on that shape (`codex-runner.test.mjs:797-799`, `:883-886`, `init-permissions.test.mjs:204`) are not listed.
- **Fix**: State that #285 is merged, cite the `main` line ranges and list the existing assertions to update.
- **Decision**: APPLIED — plan.md Overview, Sequencing, Current State Analysis, References; plan-brief.md What & Why, Starting Point, Key Decisions, Prerequisites, Open Risks.

### F2 — A missing `logs` (or any subdirectory) drops the whole grant under a misleading reason

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Grant set in the runner (Contract)
- **Detail**: The contract drops the whole grant with `why` "no gitdir" when any of `objects`, `refs`, `logs` is missing. `<common>/logs` does not exist in a repository with `core.logAllRefUpdates=false`, or before any reflog is written. Such a run is then refused as "no gitdir" though the gitdir resolved fine. `objects` and `refs` always exist; `logs` is the optional one.
- **Fix**: Require `objects` and `refs`; add `logs` only when it exists; use a distinct reason for a missing required subdirectory; realpath each subdirectory; adjust the test cases.
- **Decision**: APPLIED — plan.md Phase 1 §1 Contract and §2 Intent (tests).

### F3 — Automatic write grant on shared refs, logs and objects widens default exposure and is not documented as a risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1; Phase 3 — REFERENCE and ADR; Desired End State
- **Detail**: Before this change the user opted in to any common-dir grant through their own config. Now the router passes write access to `<common>/refs`, `logs` and `objects` on every isolated OpenAI step. A sandboxed step can then rewrite or delete other branches (including `main`) and the router's `refs/agent-smith/` rollback snapshots. The plan states only that `hooks` and `config` stay denied. The residual risk is a trade for no approval prompt and is likely acceptable, but it belongs in the ADR amendment and REFERENCE. Whether it should be opt-in through a policy key is an owner decision the issue does not raise; the plan follows the issue (automatic).
- **Fix**: State the residual risk in the ADR amendment and REFERENCE text (Phase 3 Contract) and in the plan-brief risks.
- **Decision**: APPLIED — plan.md Phase 3 §1 Contract; plan-brief.md Open Risks. An opt-in key is not added; the owner can ask for it in review.

### F4 — The row 3.1 grep cannot pass as written and misses the wording that goes stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Success Criteria, row 3.1
- **Detail**: The plan adds an ADR amendment "next to #285's", so `ADR-024` line 84 ("grants write access to one path") remains and the grep always hits. The grep also misses the other stale statements: REFERENCE.md line 46 ("The grant covers that one path, never the common dir, `objects`, `refs`") and the documented `preflight.grant` shape `{ profile, gitDir }`. The row title cannot change (Progress is immutable), so the clarification goes into the phase's Changes Contract.
- **Fix**: Name the one expected grep hit (the superseded #285 amendment, marked as such), list the sentences and shape to reword, and keep row 3.1 unchanged.
- **Decision**: APPLIED — plan.md Phase 3 §1 Contract.

### F5 — Stale-line scan is under-specified: no gating, no line format, no reuse of the bounded reader

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Read-only stale-line scan
- **Detail**: `initPermissionWarnings` only reaches Codex code inside `providers.has("openai")`, but the plan does not say the scan runs there, so a Claude-only run could read the Codex user config. Without a TOML parser the plan never defines which lines count ("filesystem keys of the form..."), and path comparison ignores that macOS prints `/var/...` where realpath gives `/private/var/...`. `usage.mjs` already exports `readBoundedFile`, which the file imports; the plan implies a new reader.
- **Fix**: Scope the scan to the OpenAI branch, define the matched line (`"<path>" = "write"` under a `[permissions.<name>.filesystem]` header), compare against both path spellings, reuse `readBoundedFile` if it meets the descriptor rules, else mirror `configPermissions`.
- **Decision**: APPLIED — plan.md Phase 2 §2 Intent.

### F6 — The narrow `init` remedy looks redundant with the per-run grant

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Narrow remedy text
- **Detail**: Phase 1 grants the same three paths on every linked-worktree run, so a reader may ask why the remedy still prints them. They remain useful for runs without a per-run grant (main checkout, non-isolated run), but the plan does not say so.
- **Fix**: Add the reason to the Phase 2 §1 Contract.
- **Decision**: APPLIED — plan.md Phase 2 §1 Contract.

### F7 — Manual rows 1.4 and 3.4 give no way to run a write from inside a run's sandbox

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy — Manual Testing Steps
- **Detail**: Row 3.4 asks for a write to `<common>/hooks` and `<common>/config` "from inside that run's sandbox", but a run has no shell for the owner. The practical route is `codex sandbox` with the table copied from the envelope's `preflight.grant` or the refusal text.
- **Fix**: Name that procedure in Manual Testing Step 1 (denied writes: `<common>/hooks/x` and the existing `<common>/config`).
- **Decision**: APPLIED — plan.md Testing Strategy, Manual Testing Steps item 1.
