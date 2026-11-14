<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Step prompt handoff by file

- **Plan**: context/changes/step-prompt-by-file/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict and counts describe the plan before these edits. Both findings have been applied to the plan. All 15 Progress rows retain their original indices, titles and pending state.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding checked 19/19 existing modification paths and 8/8 symbols. The three additional paths are intentional new deliverables, comprising the handoff test and two evidence files. The brief and plan agree on scope, three phases, replay authority, inline archives and retaining the false default.

The checked symbols are `paths`, `writeFileAtomic`, `neutralRetry`, `attachResult`, `checkPrompts`, `promptProblem`, `promptsHash` and `validateAction`. The Progress check found one final heading, three matching phases and 15 rows matching their phase verification bullets. The optional contract-surfaces document is absent.

## Codebase verification

The five highest-risk claims were traced directly in this subagent, following the unattended nesting restriction.

| Claim | Evidence | Assessment |
| --- | --- | --- |
| The shared dispatch boundary owns the full rendered task | `skills/10x-pipeline/scripts/route.mjs:215` assembles the worktree/template/advisor/rule text, and line 265 stores `pendingPrompt` before returning it | Confirmed. Shared flow helpers with narrow `next` wiring fit the existing ownership |
| Replay must use stored task and dispatch identity | `skills/10x-pipeline/scripts/flow.mjs:355` replays the pending entry and records neutral retries | Confirmed. Persisting the compact descriptor alongside the canonical task preserves the existing replay contract |
| Result persistence and task cleanup must precede Git writes | `skills/10x-pipeline/scripts/flow.mjs:491` records intake, and `skills/10x-pipeline/scripts/route.mjs:97` invokes intake before step commit and rollback | Confirmed. The planned durable cleanup marker covers resuming an already attached result, and the planned recovery tests exercise the additional boundaries |
| Codex exact-action validation needs both transport forms | `skills/10x-pipeline/scripts/run-codex.mjs:25` validates the action, line 58 requires exact pending-prompt equality, and lines 208 and 235 invoke validation around preflight | Confirmed. The planned checks extend the current trust boundary while preserving both validation calls |
| The boolean needs explicit classification in template readers and provenance | `skills/10x-pipeline/scripts/flow.mjs:822` and line 891 enumerate prompt keys, and `skills/10x-pipeline/scripts/isolation.mjs:43` hashes resolved templates | Confirmed. Excluding exactly the reserved key preserves malformed-template checks and transport-independent hashes |

The caller sweep also checked template-enumeration tests, both host loops, archive rendering, temporary cleanup callers, the score agent and user-facing configuration text. The plan already covers the affected enumeration tests. `agents/score.md` declares Read, and `skills/10x-pipeline/scripts/isolation.mjs:731` returns the archive action independently of numbered dispatch. Wave 6's current-path note supports the plan's bounded supporting edits in the runner, validation and hash owners. The reference and test-environment gaps are recorded below.

## Findings

### F1 — Full-suite scratch files need worktree-local TMPDIR

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Testing Strategy / Integration Tests
- **Detail**: The original plan restricts the local TMPDIR instruction to router-only tests, then gives the full suite as a bare Node command. Shared `makeProject` creates directories under `os.tmpdir()`, and `codexFixture` creates its separate temporary project through the same helper. Running the mandatory full gate with the host's default temporary directory can create files outside the permitted worktree. [Shared helper](../../../../skills/10x-pipeline/test/helpers.mjs#L63) [Codex fixture](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L78)
- **Fix**: Apply worktree-local TMPDIR to focused and full-suite invocations, include directory creation and the scoped full-suite command, and preserve the runner's separate temporary-project layout within that directory.
- **Decision**: APPLIED — changed Testing Strategy / Integration Tests and its required full-suite command.

### F2 — Reference scope leaves the prompt-key contract contradictory

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Wave 6 scope map / User-facing reference and Phase 2 / Focused reference update
- **Detail**: The original scope map permits a new subsection and a provider paragraph. The existing Prompt overrides paragraph assigns the string-or-array contract to every `prompts` key. Adding the boolean option only in a new subsection leaves those public instructions inconsistent with Phase 1's strict validation. The existing paragraph needs a bounded reserved-key exception. [Current contract](../../../../docs/REFERENCE.md#L278)
- **Fix**: Include the existing Prompt overrides paragraph in scope and require it to describe boolean `byFile` separately from string/array template keys, consistently with the new subsection and validator.
- **Decision**: APPLIED — changed Wave 6 scope map / User-facing reference and Phase 2 / Focused reference update.

## Assumptions and triage

- The explicit unattended instructions authorize applying both clear fixes. The review uses repository evidence and performs the skill's deep verification directly, following the prohibition on nested delegation.
- `change.md` metadata remains under the orchestrator's lifecycle ownership for this step. The task's file allowlist permits the plan, brief and review as review-edit targets.
- The shipped default remains false and live evidence remains pending, as already specified by the plan. ADR-005 and the roadmap's provisional five-pair precedent support that planning assumption.

## Verification

- Read the plan, brief, change request, lessons, ownership map and affected production/test surfaces.
- Mechanically verified modification paths, phase-to-Progress matching and verification-bullet coverage before editing.
- After editing, checked exact preservation of the entire Progress block, router parsing of the saved verdict and both APPLIED findings, the scoped document diff and whitespace.

Runtime implementation and live provider acceptance remain future plan work. This review's proof consists of source tracing and document-contract checks.
