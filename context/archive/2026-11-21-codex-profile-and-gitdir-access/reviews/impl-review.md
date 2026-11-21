<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Init Permission Warnings Implementation Plan

- **Plan**: context/changes/codex-profile-and-gitdir-access/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

- Automated rows 1.1 to 1.4 re-run: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node 24.19.0: 2207 tests, 2204 pass, 0 fail, 3 skipped.
- Real Codex 0.171.0 with `default_permissions = "agent-smith"` and no `[permissions]` table prints exactly the missing-table error the probe matches (exit 1, 0.03 s).
- Plan vs diff: every planned file changed (`route.mjs`, new `init-permissions.mjs`, shared `codex-startup.mjs`, `run-codex.mjs`, both SKILL.md, REFERENCE.md, new test and its README row, AGENTS.md module note). The one addition, `codex-startup.mjs`, is the planned shared Codex startup input.
- Router contract: the warning runs after selection and isolation validation and before `cleanupStateTemps` and the first state write; stdout stays one action JSON; the `neutralReplay` refactor in `route.mjs` keeps the old truthiness.

## Findings

### F1 — REFERENCE claims Codex 0.169.0 diagnostics that were never observed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:21
- **Detail**: The sentence said the fixtures cover diagnostics "present in Codex 0.169.0 and 0.171.0 source". The plan's Assumptions state the exact diagnostics were observed on 0.171.0 only and that the 0.169.0 behavior belongs to live acceptance (row 1.5, still open; `evidence/unproven.md`). The doc overstated verified behavior.
- **Fix**: State that the diagnostics were observed on 0.171.0 and that the 0.169.0 baseline is not yet verified.
- **Decision**: APPLIED — rewritten in docs/REFERENCE.md (commit 1bbf9fca).

### F2 — Manual rows 1.5 and 1.6 are open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: plan.md Progress rows 1.5, 1.6; evidence/unproven.md
- **Detail**: The live Codex check on 0.171.0 and 0.169.0 with profile clearance, and the sandboxed Claude linked-worktree check, were not run. The rows are correctly left unchecked and the reasons are recorded (no 0.169.0 install without an external download; the unattended step is unsandboxed). No rubber-stamping found.
- **Fix**: The owner runs both live checks and ticks the rows; no code change.
- **Decision**: PENDING — needs the owner to run the live checks (Codex 0.169.0 install and a sandboxed Claude session), which this unattended step cannot do.
