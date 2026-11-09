<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Neutral Orchestrator Retry Implementation Plan

- **Plan**: context/changes/neutral-orchestrator-retry/plan.md
- **Mode**: Deep (checked against the code by the reviewer directly; no sub-agent)
- **Date**: 2026-11-09
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

Grounding: 14/14 paths and line references checked (`flow.mjs:347/352/411`, `state.mjs:388/393/395`, `route.mjs:150/155/173/177/809`, `isolation.mjs:448`, `openspec-skill.test.mjs` regex and anti-stall test, `SKILL.md` Loop steps 2 and 3) ✓, symbols `attachResult`, `isFailure`, `budgetSteps`, `stepCommit`, `rollback`, `endRun`, `finishRun`, `writeState` ✓, brief↔plan ✓, Progress↔Phase consistency ✓ (3 phases, 5 rows each, no checkbox in phase bodies). `ADR-014` is absent from `origin/main` and this tree, so D8 holds. Deep-mode claims verified: `stepCommit` calls `writeLog` before it commits (a deleted `pendingPrompt` stays out of step commits); `provenanceSections` hashes every policy key not in `provenance.ignore` (the `limits` drift note is right); the missing-result sentence is matched by `route.test.mjs:371` and `openspec-chain.test.mjs:80`, so keeping it is required.

## Findings

### F1 — Orchestrator skill rule does not separate `orchestrator-error` from `unknown`, and the OpenSpec word scan applies to the whole skill

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — 1. Orchestrator skills
- **Detail**: Step 2 of the `run` branch today says a failed Agent call goes to step 3, "which records the step as `unknown`". The plan adds `orchestrator-error` for "the Agent call could not start for a reason that is not the router's `agent`" and for "no report came back at all", yet keeps `unknown` for "a reply with no `RESULT:` line". Step 3 itself says "If there is none ... use unknown". An orchestrator model gets two statuses for one fault and no test of "reason that is not the router's agent". Also, `openspec-skill.test.mjs` ("the skill names no model alias, effort level or tier word") scans the whole OpenSpec skill for the ladder's models and efforts, `fable`, `tier` and `tiers`; the plan's own wording ("same tier") would fail it if copied into the skill.
- **Fix**: Split the step 2 sentence into the two cases, define "no report at all" as an Agent call that returned neither reply nor error, restrict the new status to the case where no subagent can still be running, and state that the new text uses "the same prompt" and none of the scanned words.
- **Decision**: APPLIED — Phase 3, 1. Orchestrator skills (Intent and Contract rewritten).

### F2 — Cap halt text sends the human to a `next` that halts again

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 3. Neutral intake, Cap
- **Detail**: At the cap the router consumes `last-result.json`. The planned text says "raise limits.maxNeutralRetries ... then run next again". With the file gone, that `next` halts with `Step <n> (<step>) has no result`, so the first way out given in the text ends in a second halt. "in a row" is also loose: the count is per entry, and entries cannot interleave.
- **Fix**: Name the second write in the halt text ("raise the cap and write the `orchestrator-error` result file again, then run next") and drop "in a row".
- **Decision**: APPLIED — Phase 1, 3. Neutral intake, Cap bullet rewritten.

### F3 — `pendingPrompt` is not kept out of every git object

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 2. Stored prompt; Key Discoveries
- **Detail**: The plan says the prompt stays out of step commits. That holds (`stepCommit` rewrites `run.jsonl` first), but `rollback` runs `git add -A` before any rewrite of `run.jsonl`, so the snapshot under `refs/agent-smith/<id>/<run>/failed-<n>` holds the on-disk entry with `pendingPrompt`. The content is the prompt the orchestrator already received and the ref is local, so the risk is low, but the plan should state it instead of implying the prompt is never committed.
- **Fix**: Document the exception in the contract; add no log write before the snapshot, to keep `isolation.mjs` out of scope.
- **Decision**: APPLIED — Phase 1, 2. Stored prompt, Contract extended.

### F4 — Declaring a fault while the first subagent still runs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — 2. Reference
- **Detail**: The plan rejects re-emit on a missing file because a background subagent may still run, but an explicit `orchestrator-error` has the same hazard when the orchestrator declares it too early: two subagents edit the same files. The router cannot see it. The docs should carry the condition.
- **Fix**: State in `docs/REFERENCE.md` (and D1 of ADR-015) that the orchestrator declares the fault only when no subagent of that step can still be running.
- **Decision**: APPLIED — Phase 3, 2. Reference, Contract extended (the skill text of F1 carries the same condition).

### F5 — Halt path of the legacy entry is unspecified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 3. Neutral intake, entry without `pendingPrompt`
- **Detail**: The cap halt goes through `endRun` (report, `meta.outcome`); the legacy-entry halt only says "halt with a text". The two are different effects: a run left pending with a written `meta.outcome` and report versus the plain halt of the missing-result case. The implementer would guess.
- **Fix**: Specify a plain `halt()` like the missing-result halt, with no report and no `meta.outcome`, since the run is not ended and the file stays.
- **Decision**: APPLIED — Phase 1, 3. Neutral intake, legacy-entry bullet rewritten.
