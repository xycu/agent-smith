<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Provider Mode

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 1 critical, 6 warnings, 1 observation

The verdict, counts and source line numbers refer to candidate `ff22d32f`, before review fixes. The critical finding concerned release of native execution ownership without a validated terminal event.

## Verdicts

| Dimension | Verdict | Basis at review |
| --- | --- | --- |
| Plan Adherence | FAIL | The runner’s terminal and capability checks fell short of the Phase 2 dispatch contract. |
| Scope Discipline | PASS | The implementation covers both requested chains. The additional hook, shared validator and lock modules have direct callers. |
| Safety & Quality | FAIL | Malformed completion could release the lock used by retry, rollback and publication. |
| Architecture | PASS | The router owns provider assignment, the shared descriptor owns archive reconstruction and the host owns publication. |
| Pattern Consistency | WARNING | The two runners differed in how they revalidated the requirements they had proved. |
| Success Criteria | WARNING | The original fixtures covered the successful paths and several refusals but missed the cases below. Manual rows 3.2 and 3.3 were correctly open. |

## Findings

### F1 — A malformed Claude terminal event could release the run lock

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — settlement controls every subsequent run mutation
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:287`, `:349`
- **Detail**: After a matching Stop, the runner treated an unknown result subtype as an ordinary failure and could accept success with a missing error flag. It also parsed mutable assistant text after terminal validation, so later enclosing output could replace the verified reply.
- **Fix**: Validate the terminal subtype and boolean error flag before accepting closure. Consume the verified terminal reply and suspend on additional enclosing assistant output. Fixtures cover malformed success, unknown terminal, supported failure and trailing output. Live CLI qualification remains in 3.2.
- **Decision**: APPLIED in `84205bf02744`.

### F2 — Damaged metadata could silently change a logged run’s provider

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — recovery must preserve historical runs
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/route.mjs:70`, `:1062`
- **Detail**: An unreadable or non-object metadata file fell back to an empty object. A resume could overwrite the file using legacy host and mode defaults even when the run already had a log.
- **Fix**: Refuse state writes when a logged run’s existing metadata cannot be read as an object. Keep plain status available and preserve the existing fresh-init behavior for a project without a log. Both chains check byte-for-byte preservation across init, next, late usage and report generation.
- **Decision**: APPLIED in `84205bf02744`.

### F3 — The headless manual template dropped a configured advisor

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the existing advisor lookup owns template selection
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/route.mjs:204`, `skills/10x-pipeline/scripts/flow.mjs:1107`
- **Detail**: A project opt-in for `manual-verify` survived substitution of the OpenAI template. Substituting the headless Claude template lost that opt-in, so the runner could start work without the required capability.
- **Fix**: Resolve the base opt-in for both transport-specific templates in the shared advisor lookup. The headless runner’s existing refusal then applies to either spelling.
- **Decision**: APPLIED in `84205bf02744`.

### F4 — Settled Claude failures lost duration and token coverage

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — accounting crosses the runner and both host loops
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:349`, `skills/10x-pipeline/SKILL.md:87`, `skills/openspec-pipeline/SKILL.md:93`
- **Detail**: A verified unsuccessful terminal or a settled reply with a malformed RESULT reached the failure path before the runner measured usage. The host instructions for unknown results also dropped structured evidence. An executed attempt could therefore accept an unattributed numeric token figure later.
- **Fix**: Attach measured duration and unavailable token evidence on settled work before parsing RESULT. Both loops carry the runner’s evidence into unknown-result intake. The fixtures exercise intake and refusal of a numeric late attachment.
- **Decision**: APPLIED in `84205bf02744`.

### F5 — Codex reused stale policy and capability proof after preflight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — both runners consume the same pending action
- **Dimension**: Pattern Consistency
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:211`, `:248`
- **Detail**: The second validation used the policy loaded before preflight and discarded the effective skill, template and advisor it read. A change during preflight could leave the model launch relying on proof for an earlier dispatch.
- **Fix**: Load and validate current policy inside the shared dispatcher on each check, then compare the effective requirements with those proved. The saved model, effort and prompt still govern an ordinary pending dispatch. Fake preflight changes exercise policy and skill drift before launch.
- **Decision**: APPLIED in `84205bf02744`.

### F6 — A listed Claude skill could lack its invocation tool

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one effective-tool check closes the gap
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-claude.mjs:259`
- **Detail**: Skill discovery proved that a file and catalog entry existed. A tool-restricted session could pass preflight without the Skill tool needed to invoke it.
- **Fix**: Require Skill in the effective tool list for actions that name a skill. A fixture lists the expected skill while withholding its invocation tool.
- **Decision**: APPLIED in `84205bf02744`.

### F7 — Toolkit discovery buffered an unbounded partial line

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the bound belongs at the input boundary
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/runner-toolkit.mjs:19`
- **Detail**: The probe checked message size after readline delivered a complete line. An unterminated response could keep growing in memory until the child timed out.
- **Fix**: Count incoming bytes before assembling discovery records. The fixture checks the size-limit diagnostic for an unterminated response.
- **Decision**: APPLIED in `84205bf02744`.

### F8 — Command help and transport documentation lagged the implementation

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the CLI and reference already define the behavior
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/route.mjs:976`, `docs/REFERENCE.md:65`, `:135`, `:302`
- **Detail**: The usage hint and the reference’s exhaustive init diagnostic omitted provider selection. The browser section also said a new native no-Chrome dispatch could still claim browser-prefixed evidence, despite its persisted local capability. The Bash guard description omitted the headless session’s identity and size checks.
- **Fix**: Include host and mode in CLI help, update the documented flag list and distinguish new no-Chrome dispatches from historical Claude entries. Document the headless guard scope.
- **Decision**: APPLIED in `84205bf02744`.

## Verification

The review compared the candidate against all three phases, including legacy mode-less runs, both archive descriptors, neutral replay, by-file handoff, failure accounting and the original run lock after archive moves. Implementation commits were `379418af`, `e2b409a2` and `f89c77cc`. Release-managed fields and archived material were outside the diff.

Gates ran on Node 24.19.0 with OpenSpec CLI 2.0.0, local Git fixtures and `GH_LIVE=0`.

| Criteria | Command | Result |
| --- | --- | --- |
| 1.1, 1.2 — providers, ladders, legacy runs, retry, archive and provenance | `node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs` | 315 passed, zero failed or skipped |
| 2.1, 2.2 — guarded transports, settlement and accounting | `node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs` | 148 passed, zero failed or skipped |
| 3.1 — both skill loops and repository suite | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 2,087 passed, zero failed, three expected skips (2,090 total) |

The only skips were the two opt-in live GitHub fixtures and the import check for an absent `CLAUDE.md`. All real OpenSpec 2.0.0 contract fixtures ran.

An independent scratch smoke test ran `init` and `status` in split mode on each host for each chain. All four returned `action: run` for the expected planning step and provider. Every status reported `split`.

Manual row **3.2** awaits authenticated qualification for six host/mode combinations per chain on the final candidate. Row **3.3** awaits orchestrator publication, CI on that head and the elected comment check. Local fixtures do not supply either result. [Recorded manual evidence](../evidence/unproven.md)
