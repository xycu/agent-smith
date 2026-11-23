<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Opt-in Claude token capture implementation plan

- **Plan**: context/changes/claude-token-figures-default/plan.md
- **Mode**: Deep (claims checked directly against the code, no sub-agent)
- **Date**: 2026-11-22
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 existing paths ✓ (the two `claude-capture*.mjs` files are new), symbols `CLAUDE_USAGE_VERSION`, `guardRevision`, `hookFilesHash`, `usage-incomplete` ✓, Progress↔Phase ✓ (1.1-1.2, 2.1-2.5 match the criteria), brief↔plan ✓, no Automated row needs a pushed branch, PR or PR CI. Note: `claude --version` on this machine reports 2.1.323.

## Findings

### F1 — Seed registry holds only 2.1.311, but the installed host is 2.1.323

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Decisions and assumptions (Version qualification); Manual Testing Steps 1 and 2; rows 2.4 and 2.5
- **Detail**: The plan seeds the exact-version registry with 2.1.311 and fails closed on any other build. The Claude Code installed on the maintainer's machine is 2.1.323, so a default user of the shipped launcher gets "unqualified version" until a Manual qualification happens. Row 2.5 says "a subsequent Claude Code release", which does not say that 2.1.323 already counts, and row 2.4 needs "an exact qualified build" without saying which. The end state is unreachable for the current host from the Automated rows alone.
- **Fix**: State that the row 2.4 build is 2.1.311 or a release qualified first through Step 2, and that "subsequent release" means any release other than the seeded baseline, including the one installed now.
- **Decision**: APPLIED — Decisions and assumptions, "Version qualification per release" bullet. Progress rows untouched.

### F2 — The plan never says how process identity reaches the OTLP resource attributes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1 (Launcher contract)
- **Detail**: `claude-usage.mjs` fails with `missing-identity` unless every OTLP resource carries `process.pid` and `process.creation.time`, and the retained probe says its launcher supplied them; Claude itself does not. The plan binds the session to the Claude PID "independently of incoming OTLP" but never states how those two attributes get into the exported batches. A PID is unknown before spawn, so this needs a specific mechanism or every real capture ends unavailable.
- **Fix**: Name the mechanism in the launcher contract: set the two attributes in `OTEL_RESOURCE_ATTRIBUTES` for the exact process that is exec'd, as the probe launcher did, and have the receiver reject batches whose attributes differ from the binding.
- **Decision**: APPLIED — Phase 1, change 1, Contract paragraph (startup binding sentence). The plan brief needed no change for this finding.

### F3 — Hook provenance consumers are left as "existing mechanisms"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 1 (Files line)
- **Detail**: `hookFilesHash` in `skills/10x-pipeline/scripts/isolation.mjs:87` hashes a fixed list of three files, `guardRevision` in `claude-hook.mjs` hashes four files, and `docs/REFERENCE.md` documents the `hookFiles` set. The plan says "hook provenance consumers" without naming `isolation.mjs`, `run-claude.mjs` or the documentation, so a new capture script or `hooks.json` change can drift silently from the recorded hashes.
- **Fix**: Name `hookFilesHash` in `isolation.mjs`, the `guardRevision` use in `run-claude.mjs`, the `hookFiles` text in `docs/REFERENCE.md` and the tests that pin them in the Files line.
- **Decision**: APPLIED — Phase 1, change 1, Files line.

### F4 — Checkpoint and collect surface for the skills is undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 2 (Contract); Phase 2, change 1 (Contract)
- **Detail**: Phase 2 tells the skills to "take the bound native capture checkpoint" and to read shipped capture, but Phase 1 defines no command, input or environment signal for either. The 10x skill is 28083 bytes against a 28100-byte ceiling in `skill-loop.test.mjs`, so the skill text must stay minimal and an undefined interface will push guesswork into SKILL.md.
- **Fix**: Define a `checkpoint` mode on the existing `$CLAUDE_USAGE` entry point and let the collect mode read the launcher-bound location from the session environment, so the skills add no new variable.
- **Decision**: APPLIED — Phase 1, change 2, Contract; Phase 2, change 1, Contract.

### F5 — First real interactive proof comes only after all code exists

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Testing Strategy, Manual Testing Steps 1
- **Detail**: The retained evidence is headless only (the interactive attempts hit the trust prompt or quota). The launcher is interactive, so trust-prompt handling and interactive hook payloads are unproven until row 2.4, after both phases are built. A mismatch means rework in Phase 1 code.
- **Fix**: Run one real interactive launcher probe before finalizing the Phase 1 registry fixtures.
- **Decision**: APPLIED — Manual Testing Steps, step 1; plan-brief Open Risks bullet added.
