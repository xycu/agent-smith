<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run the CI jobs as a non-root user (ADR-020 D4)

- **Plan**: context/changes/ci-runner-non-root/plan.md
- **Mode**: Deep (claims checked by hand against the code; no sub-agent, nested subagents are banned)
- **Date**: 2026-11-12
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓ (`ci.yml`, `ci-runner.test.mjs`, ADR-020 lines 3/43/55, `AGENTS.md` ci bullet, `no-recursive-delete.test.mjs:76-93`, `ci-self-hosted-truenas/plan.md:227`, `release-gate.test.mjs`, `workflow-pins.test.mjs`), symbols ✓ (`privileged` skip, ADR-008/010 "Amendment 1" shape), brief↔plan ✓, Progress↔Phase ✓ (9 + 5 rows match the criteria). Local uid is 501 and `actionlint` is installed, so rows 1.6 and 1.8 can run.

## Findings

### F1 — The `commits` job runs PR code as root before and beside the guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: What We're NOT Doing (no guard in `commits`); Desired End State ("before any model-written code runs")
- **Detail**: Jobs of a workflow run concurrently. On a root runner the `test` job stops at its first step, but `commits` (`ci.yml:37-53`, same runner labels) still checks out the pull request and runs `node tools/commit-lint.mjs` from that branch as uid 0 with fetch-depth 0. So the plan's claim that the guard fails "before any model-written code runs" holds for `test` only. The security exposure that ADR-020 line 55 describes stays open for `commits` until the owner fixes the runner. The plan's reason ("one runner fix covers both jobs") is true for the cure but not for the detection.
- **Fix**: Give `commits` the same first step and make the pin test loop over both jobs (the command is the same string). Or keep the scope and reword the Desired End State to say the guard protects `test` only.
- **Decision**: PENDING — the plan chose "test job only" on purpose and `change.md` names the `test` job; widening the guard to `commits` (or accepting the narrower claim) is the owner's scope call.

### F2 — Stub `id` file and temp folder where a shell function would do

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1, change 2 (Tests for the guard); Implementation Approach
- **Detail**: Test (b) wrote an executable `id` script into a `mkdtempSync` folder, set `PATH`, and then needed an unlink and `rmdirSync` cleanup. That adds file handling, cleanup code under the ADR-016 rule, and a dependency on `os.tmpdir()` being executable (a `noexec` temp mount on the NAS runner would break it). A POSIX shell function `id() { echo 0; }` placed before the command in `sh -c` shadows the external `id` with no files at all. The extraction rule for the `run:` value was also left open.
- **Fix**: Use the shell-function form and state that the `run:` value is the rest of its single `run:` line.
- **Decision**: APPLIED — Implementation Approach and Phase 1 change 2 (Tests for the guard) of `plan.md`; the matching wording in `plan-brief.md` (Key Decisions row, Architecture, Open Risks phase table).

### F3 — Phase 2 order does not say where the root-failure evidence comes from

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 Overview; Manual row 2.4
- **Detail**: Row 2.4 accepts "a run before the owner's fix" as proof that a root runner fails, and rows 2.2 and 2.3 need a run after the fix. The plan only says "fix the runner before merging". Without the order "open PR, read the red root run, fix the runner, rerun, merge" the owner can lose the 2.4 evidence by fixing the runner first.
- **Fix**: Add that order to the Phase 2 Overview.
- **Decision**: APPLIED — Phase 2 Overview of `plan.md`.
