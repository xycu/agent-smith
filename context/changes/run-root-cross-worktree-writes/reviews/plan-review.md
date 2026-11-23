<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Claude Run-Root Write Preflight

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

All five proposed edit paths existed. Verified `prepare`, the router's `init` and `next` paths, `status`, `neutralRetry`, `attachResult` and the headless runner's `capabilityProbe`. The original brief matched the plan's scope and phases. Phase 1 Success Criteria matched all five canonical Progress rows. Both Automated rows use local checks and all three Desktop checks were already Manual.

## Findings

### F1 — Result recovery lacks an attempt match

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff, think through the handoff before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1, Pipeline startup and result handling
- **Detail**: The plan calls for a matched result but does not say how to establish the match across sessions. Neutral reruns reuse the step number, name and result path. Intake attaches the result to the last pending entry, and plain status shows a retry count but no unique launch ID. An empty file also differs from an absent path. The router can consume a zero-byte or malformed file as `unknown`. [Neutral retry](../../../../skills/10x-pipeline/scripts/flow.mjs#L452) · [Result intake](../../../../skills/10x-pipeline/scripts/flow.mjs#L584) · [Status projection](../../../../skills/10x-pipeline/scripts/route.mjs#L771)
- **Fix**: Keep the exact normalized payload and originating launch context available in the original session. Match the latest pending row and retry count with plain status in the saved chain. Allow an authorized session on the recorded host to write only to a confirmed absent path or consume a verified existing payload. Preserve conflicts and continue from `next` after settlement.
  - **Strength**: Uses the existing handoff fields and sequential result protocol.
  - **Tradeoff**: Recovery needs access to the originating session's payload and launch record.
  - **Confidence**: HIGH. The router reads the same pending entry and result path across neutral retries.
  - **Blind spot**: Desktop session handoff still needs live verification.
- **Decision**: APPLIED in Phase 1, Pipeline startup and result handling, with the operator flow mirrored in the plan brief.

### F2 — The result-write STOP can conflict with the existing loop

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Pipeline startup and result handling
- **Detail**: Native Agent results and completed external envelopes reach `next` by different branches. A settled external failure also has a write path. Anti-stall rule 2 orders same-turn intake, and the planned native Write recovery was underspecified for external envelopes on a Codex host. [Loop write paths](../../../../skills/10x-pipeline/SKILL.md#loop) · [Anti-stall rules](../../../../skills/10x-pipeline/SKILL.md#anti-stall-rules) · [Cross-host contract](../../../../skills/10x-pipeline/test/host-integration.test.mjs#L161)
- **Fix**: Define one gate at the intake boundary for all existing result paths, using the existing writer for each host. Make result-write STOP override normal same-turn advancement and keep execution suspension first.
- **Decision**: APPLIED in Phase 1, Pipeline startup and result handling, and Local regression coverage and operator reference.

### F3 — The probe needs explicit containment and retry ownership

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff, think through the scratch lifecycle before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1, Pipeline startup and result handling
- **Detail**: The plan gives no concrete ownership model for a scratch path under an already prepared change directory. Reuse proves the worktree and project prefix, while the probe needs to verify the live directory's canonical containment. Setup releases its lock before the probe. A concurrent initializer or a retry after interruption can stage leftover files because the start commit stages the change folder. [Setup and lock scope](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L378) · [Headless probe pattern](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L26) · [Start commit](../../../../skills/10x-pipeline/scripts/isolation.mjs#L483)
- **Fix**: Require a canonical in-root directory, a uniquely owned scratch directory and a confirmed native marker write. Require sole orchestration ownership and stop on known overlap or earlier probe residue. Limit cleanup to the current attempt and give the owner the retained path.
  - **Strength**: Reuses the headless probe's ownership pattern and the sequential producer contract.
  - **Tradeoff**: An interrupted probe that leaves residue needs owner reconciliation before retry.
  - **Confidence**: HIGH. The existing router lock starts after this probe, and Git stages the change folder.
  - **Blind spot**: Simultaneous starts in an uncoordinated second session fall outside the sequential producer contract.
- **Decision**: APPLIED in Open risks and assumptions and Phase 1, Pipeline startup and result handling, with the ownership assumption mirrored in the plan brief.

### F4 — Verification misses a result-only denial and a startup test consumer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy
- **Detail**: The original Desktop steps exercise preflight denial and normal result intake. They can pass even if the orchestrator continues after a result-only denial. The new text also affects existing OpenSpec startup and cross-host dispatch assertions outside the listed test command. The deliberate-break check did not specify that each chain should fail independently. [OpenSpec startup consumer](../../../../skills/openspec-pipeline/test/openspec-skill.test.mjs#L314) · [Cross-host consumer](../../../../skills/10x-pipeline/test/host-integration.test.mjs#L161) · [Skill override inputs](../../../../skills/10x-pipeline/test/skill-loop.test.mjs#L12)
- **Fix**: Add a disposable Desktop result-only denial scenario to the row 1.5 recovery protocol and check that recovery consumes the result without relaunch. List the two compatible local suites and exercise both deliberate breaks independently.
- **Decision**: APPLIED in Testing Strategy and the plan brief's Success Criteria Summary.

### F5 — ADR-010 repeats the older protected-directory assumption

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Local regression coverage and operator reference
- **Detail**: The plan calls out the stale question in the reference. ADR-010 also discusses the protected `.claude/` assumption and an untested fallback. The frame gives evidence for two Desktop configurations while the broader Git worktree exemption remains unverified. [ADR-010 assumption](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#unverified-assumptions) · [Host evidence](../frame.md#hypothesis-investigation)
- **Fix**: Name ADR-010 in the phase scope. Annotate the assumption with the observed Desktop behavior and a link to the current recovery instructions.
- **Decision**: APPLIED in Phase 1, Local regression coverage and operator reference.

## Triage assumptions

- The existing sequential producer contract governs same-run startup and recovery. The plan uses an explicit operator handoff and defers uncertain ownership or residual files to the owner at runtime. [Result intake contract](../../../../docs/REFERENCE.md#state-publication-and-log-recovery)
- The preflight stays at the Claude orchestrator boundary. The Desktop frame establishes the two host denials and the headless runner provides a scratch ownership precedent. [Host evidence](../frame.md#hypothesis-investigation) · [Headless probe](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L26)
