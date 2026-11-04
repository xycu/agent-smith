<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Route Reviews on Open Findings, With a Confirmation Round

- **Plan**: context/changes/review-open-findings/plan.md
- **Mode**: Deep (grounding against `route.mjs`, `policy.json`, tests, prompts and archived reviews, done inline)
- **Date**: 2026-11-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 16/16 paths and line refs checked (`route.mjs` `readReview:113`, `decide:820`, `attachResult:455`, `replanNext:1274`, `reviewWarning:1599`, status projection `:3107`; `SKILL.md:142`, `:147`; `README.md:40`; `helpers.mjs:74`; `rules.test.mjs:128-145`; `meta.baseSha` = `5333a53`; archived reviews; Decision-word counts in the archive) ✓, symbols `readReview`, `decide`, `replanNext`, `attachResult`, `trailingFailures`, `reviseToleranceWarnings`, `fixOnNeedsAttention` ✓, brief↔plan ✓, Progress↔Phase ✓ (one `## Progress`, 4 phases, every criterion has a row, no checkbox outside Progress). The round-4 `worktree-step-commits` plan review parses as 3 criticals/warnings, all `APPLIED`, header counts equal to blocks (manual row 1.6 holds).

## Findings

### F1 — Under the default `halt`, the REVISE-to-research loop and `maxPlanRevisions` no longer see a REVISE

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (plan review routing); Phase 4 §3 and §4 (README, ADR); Migration Notes
- **Detail**: `replanNext` (`route.mjs:1274-1325`) holds branch (d), the REVISE-to-research loop, and the revision cap, and it is reached only when a `REVISE` needs a re-plan. With an aware review and the default `onOpen: "halt"` the plan sends such a `REVISE` to a halt or to implement, never to `replanNext`. So for a review with Decision lines the loop `preplan.loops.reviseResearchAfter` and the REVISE side of `limits.maxPlanRevisions` are dead by default. "What We're NOT Doing" says research-round routing does not change, and the README `Loops` bullet describes the loop with no condition. Neither the plan nor its docs said that the loop now acts only on unaware reviews or with `onOpen: "retry"`.
- **Fix**: State it in the README (also in the `Loops` bullet), in ADR-011 and in the Migration Notes.
- **Decision**: APPLIED — Phase 4 §3 Intent (README text, `Loops` bullet); Phase 4 §4 Intent (ADR consequence); Migration Notes (new bullet); `plan-brief.md` Key Decisions ("Open finding after REVISE or NEEDS ATTENTION" row).

### F2 — "`onOpen: "retry"` restores the old reaction" overstates it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State (`onOpen` bullet); `plan-brief.md` Key Decisions
- **Detail**: The old code ran `fix` on every `NEEDS ATTENTION` while `fixOnNeedsAttention` was `true`, and re-planned an all-applied `REVISE`. With `retry` the plan runs `fix` or a re-plan only for open findings above the tolerance, and states in Phase 2 §2 that `fixOnNeedsAttention` applies only to an unaware review. A reader of the End State would expect the old behaviour back, and the only switch that gives it is `openFindings.enabled: false`.
- **Fix**: Reword the bullet to say what `retry` does and name `enabled: false` as the full opt-out.
- **Decision**: APPLIED — Desired End State (`onOpen` bullet); `plan-brief.md` Key Decisions.

### F3 — The `reason` suffix for open counts does not say which re-plan reasons carry it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 Contract
- **Detail**: A `retry` re-plan can return `research-revise` (branch d) or `plan-revise` (branch e); each builds its own `reason` string, and `replanNext` has no access to the open counts. The Contract named one reason and no way to pass the counts, so the implementer would guess whether the research reason changes.
- **Fix**: Pass the open counts to `replanNext` as an optional argument and name the two reasons that take the suffix and the one that does not.
- **Decision**: APPLIED — Phase 2 §1 Contract.

### F4 — The `## Review findings` counts go stale after an owner edit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 Contract
- **Detail**: The counts are stored in the log entry when the step ends, while `decide` reads the review file live. After a halt on an open finding the owner sets the Decision and resumes; the report then still shows that finding as open for the step that was routed past it. That reads as a router bug.
- **Fix**: State in the Contract that the counts are those of the step's end and that the section says so in one line.
- **Decision**: APPLIED — Phase 4 §1 Contract.

### F5 — An upgraded in-flight run shows provenance drift

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: The plan adds `review` policy keys, edits two apply prompts and adds templates. `provenance` hashes the `review` and `prompts` sections and each `next` records a differing section in `provenance.drift`, so a run that spans the upgrade gets `drift: [prompts, review]` and `compare` warns. It changes no routing, but the Migration Notes said nothing about it.
- **Fix**: Add one Migration Notes bullet.
- **Decision**: APPLIED — Migration Notes (new bullet).
