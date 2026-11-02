<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run provenance, tool-restricted step agents and an opt-in advisor

- **Plan**: context/changes/managed-agent-patterns/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-02
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

Diff `main..HEAD` (commits 1f181f5, aa71d59, 2ed5c8c, 3d6a564) matches the plan file list: `route.mjs` (provenance record, drift, compare warnings, `stepAgent`, `advisorOn`, status `agent`), `policy.json` (`provenance`, `agents`, `advisor`, `prompts.advisor`), `agents/score.md`, `SKILL.md` dispatch line, `prompts/advisor.md`, `prompts/README.md`, ADR-009, README, AGENTS.md and the three new test files. Nothing planned is missing. The only addition beyond a contract is two sentences in `SKILL.md` loop step 2 (never choose a type; no retry with another type on failure), which implement the plan's "no fallback to `general-purpose`" guardrail at the orchestrator and agree with ADR-009; benign.

Checked: default-off paths are byte-identical (no `agent` key, no advisor text unless `advisor.enabled === true` and the template is listed); malformed blocks read as off and never throw; the init records provenance only with no executed step; `next` writes `meta.json` for drift only when the list changes; `compare` never touches `comparable`, `reasons`, `dropPercent` or `verdict`; the router stays on `node:` built-ins (ADR-006) and reads no user-level file; the new tests copy the plugin tree to a scratch directory before editing a plugin file and never write repository files.

## Success criteria

- Automated: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 552 tests, 550 pass, 0 fail, 2 skipped (the existing `GH_LIVE` tests). This run covers every Automated row command (`provenance.test.mjs`, `agents.test.mjs`, `advisor.test.mjs`, `rules.test.mjs`).
- Manual: rows 1.8, 1.9, 2.8, 2.9, 2.10, 3.7, 3.8 and 3.9 are pending and unticked, as expected (live checks and owner reading). For 1.8 the `manual-verify` step left `evidence/provenance-init-status.txt`: `init` and `status` printed valid JSON and `meta.json` holds a readable `provenance` object, but its `tee` calls failed under the sandbox and the row stayed unticked. No row is ticked without evidence.

## Findings

### F1 — The ADR-009 A/B pairs always raise provenance warnings for the feature under test

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: skills/10x-pipeline/scripts/route.mjs:2621 (`comparePair`), skills/10x-pipeline/policy.json `provenance.expected`
- **Detail**: The plan defines two expected-difference sets, `pinned` (`ladder`, `rigor`, `score`) and `unpinned` (`score`). ADR-009 tells the owner to compare the advisor pairs and the restricted-agent pairs with `compare --unpinned`. Those arms differ by design in the `advisor` (or `agents`) section and the `advisor.enabled` (or `agents.restricted`) flag, so every such pair prints `provenance-differs:advisor` and `flags-differ:advisor.enabled` (or `agents` and `agents.restricted`). The README documents it ("compare warns when two arms differ in any of them"), so this is no drift from the plan. The cost: the README asks the owner to read the warnings before trusting the number, and a warning that every pair of an experiment carries teaches the owner to skip it, so a real unexpected difference in the same list is easier to miss.
- **Fix A ⭐ Recommended**: Add a repeatable `--expect <section>` option to `compare` that extends the expected set for one call, and name it in ADR-009's A/B procedures (`--expect advisor`, `--expect agents`).
  - Strength: Keeps the policy sets as they are and states the intended difference at the call site, where the experiment is defined.
  - Tradeoff: New CLI surface, its flag parsing and tests; the README and ADR-009 procedures change.
  - Confidence: MED — the warning function already takes the expected list as a parameter, so the router change is small.
  - Blind spot: Whether the owner wants the warning kept as an explicit reminder that the arms differ.
- **Fix B**: Leave the code and add one sentence to ADR-009 "Decision rules" saying these two warnings are expected for its pairs and any other name is not.
  - Strength: No code change. The owner reads the expected names once.
  - Tradeoff: The noise stays in every output.
  - Confidence: HIGH — documentation only.
  - Blind spot: None significant.
- **Decision**: PENDING — the plan fixes the expected sets to `pinned` and `unpinned` only; widening them or adding a CLI option is an owner decision outside this plan's scope.

### F2 — A first init that halts on a bad prompt reference keeps `prompts: null` and reports drift for the rest of the run

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2799-2804 (`init` record), route.mjs `recordDrift`
- **Detail**: `init` writes the record before `next` runs `checkPrompts`. When a `@prompts/` reference does not resolve, the record stores `prompts: null` and `next` halts. After the owner fixes the policy, the stored record is never rewritten (plan contract), so the next `next` adds `prompts` to `provenance.drift` and `compare` prints `provenance-drift:<side>:prompts` and, against any healthy run, `provenance-differs:prompts`, although no step ever ran with a different prompt. `provenance.test.mjs` asserts this behavior on purpose, so it matches the plan.
- **Fix**: Let `init` replace a stored record while the log holds no executed step, so a run that never ran a step records what its first step actually runs with.
- **Decision**: PENDING — the plan states "A stored record is never rewritten" and the test asserts the current behavior; changing it is an owner decision.
