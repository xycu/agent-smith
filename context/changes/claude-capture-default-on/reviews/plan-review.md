<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Claude capture default-on gate

- **Plan**: context/changes/claude-capture-default-on/plan.md
- **Mode**: Deep (done in-step, no sub-agent; claims checked against the code)
- **Date**: 2026-11-24
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths and line anchors checked (`init-usage.mjs:39-76`, `route.mjs:1132-1134`, `isolation.mjs:286-318`, `state.mjs:219`, `helpers.mjs:94-95`, `policy.json:118-119`, ADR-018 Amendments 5-7, ADR-019 Amendment 2, README 154-165) ✓, symbols ✓ (`claudeCaptureReadiness`, `SKILL_DIR`, `hostOf`, `providersByStep`, `recordDrift`), brief↔plan ✓. Progress block matches both phases (1.1-1.8, 2.1-2.6); no publication-dependent Automated row (2.4 lints local commits only). Module order holds: `init-usage.mjs` may import `SKILL_DIR` from `state.mjs`.

## Findings

### F1 — Resume claim is false for a first `init`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Key Discoveries, Phase 1 item 3 (halt text), Phase 2 README contract, Migration Notes, plan-brief Architecture
- **Detail**: The plan says the halt text tells the owner that "host and provider mode are saved" and the run "resumes with its saved host and provider mode". The halt happens before `cleanupStateTemps` and `mkdirSync` (`route.mjs:1134-1136`), so on a first `init` no `meta.json` exists and nothing is saved. Only a run that already has a `meta.json` (`route.mjs:1105`) keeps its host and provider mode. A user who started with `--provider-mode split` or `--goal` and trusts the halt text would repeat a shorter command and get a different run.
- **Fix**: Say that the same command is repeated with the same flags; a run that already has steps resumes with its saved host and provider mode. Fix every place that states the saved-mode claim.
- **Decision**: APPLIED — Desired End State, Key Discoveries, Phase 1 item 3 (gate reason order), Phase 2 item 2 (README), Migration Notes of `plan.md`, and the Architecture paragraph of `plan-brief.md`.

### F2 — Test breakers missing from the direct-override list

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 items 5 and 6
- **Detail**: Three breakers are unlisted. (a) `isolation.test.mjs:311` rewrites the whole override with only an isolation opt-out and then expects `initIn(wt).json.action === "run"`; it would halt at the capture gate. (b) `score.test.mjs:131-152` asserts the exact content of the override that `writeOverride` writes (`score`, `isolation`, `manualVerify`); injecting `claudeCapture` fails five `deepEqual`s. (c) `skills/10x-pipeline/test/README.md:119` lists the injected keys and goes stale. The open-pr, rollback, neutral and preplan overrides are read-modify-write or never run `init` through them, so they stay safe. The plan only said "the full-suite run finds the rest".
- **Fix**: Name the three in items 5 and 6 and note which other writers were checked.
- **Decision**: APPLIED — Phase 1 items 5 and 6 of `plan.md`.

### F3 — ADR Status lines still say "opt-in native capture"

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 item 3
- **Detail**: `docs/ADR/ADR-018-no-nested-subagents.md:3` says "as amended through opt-in native capture" and links Amendment 5. After Amendment 8 the header would contradict the body. The plan only adds the amendment sections and index rows.
- **Fix**: Add the Status line update to item 3.
- **Decision**: APPLIED — Phase 2 item 3 of `plan.md`.

### F4 — Greps and migration note

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 1, Success Criteria 2.1, Migration Notes
- **Detail**: The two doc greps use an unquoted `--include=*.md`, which aborts in zsh ("no matches found") and so proves nothing. The hashed `claudeCapture` provenance section also adds `claudeCapture` to `provenance.drift` of runs started before the upgrade (`recordDrift`, `isolation.mjs:157`); the plan does not say so.
- **Fix**: Quote the glob in both places and add one Migration Notes sentence on the drift entry.
- **Decision**: APPLIED — Phase 2 item 1, Phase 2 Automated criterion 1 and Migration Notes of `plan.md`.
