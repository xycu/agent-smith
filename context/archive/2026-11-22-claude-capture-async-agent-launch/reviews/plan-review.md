<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Claude capture settles asynchronously launched Agent runs

- **Plan**: context/changes/claude-capture-async-agent-launch/plan.md
- **Mode**: Deep (direct reads, no sub-agent)
- **Date**: 2026-11-22
- **Verdict**: REVISE, then SOUND after fixes
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

11/11 paths ✓, symbols ✓, brief↔plan ✓. `docs/reference/contract-surfaces.md` absent, check skipped.

## Findings

### F1 — Phase 3 success-criteria bullet with no Progress row

- **Severity**: CRITICAL
- **Impact**: LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Automated Verification
- **Detail**: The bullet "None; this phase is observation of a live host" has no Progress row; empty subsections must be omitted.
- **Fix**: Delete the Automated subsection from Phase 3.
- **Decision**: FIXED

### F2 — Blast radius wider than the verification commands

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1, rows 1.2 and 1.4
- **Detail**: `late-usage.test.mjs`, `accounting-readers.test.mjs` and `compare.test.mjs` also exercise `collectClaudeUsage` and were not in the Phase 1 commands.
- **Fix**: Extend row 1.4's command to include them.
- **Decision**: FIXED

### F3 — Phase 2 links evidence that does not exist yet and moves on archive

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 1
- **Detail**: The README sentence would point at `evidence/` before Phase 3 creates it, and the path changes on archive.
- **Fix**: Phase 2 states qualification is pending without a link; Phase 3 updates README and REFERENCE with the recorded result (new item 3, new row 3.4).
- **Decision**: FIXED

### F4 — Replay row depends on a session scratchpad

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1, Manual row 1.6
- **Detail**: The saved capture lives in a scratchpad that a reboot or cleanup removes.
- **Fix**: Copy the three files to a durable untracked folder outside the repository before implementing.
- **Decision**: FIXED

### F5 — Test selection patterns not fixed

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Lean Execution
- **Location**: Phase 1, rows 1.1 and 1.3
- **Detail**: Patterns `async`, `unaccounted` and `membership` match existing synchronous tests, and depend on new titles.
- **Fix**: New titles start with `async launch: verifies` or `async launch: unavailable`; rows 1.1 and 1.3 select by those prefixes.
- **Decision**: FIXED
