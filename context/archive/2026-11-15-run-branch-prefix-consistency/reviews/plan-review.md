<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Configured Run-Branch Prefix

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-16
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict and counts describe the plan before edits. Both findings have been applied to the plan and brief. Progress rows retain their original indices, titles and checkbox states.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding verified 15/15 concrete implementation paths, 3/3 central policy/identity symbols and brief-to-plan consistency. Reviewed the five named runtime owners, both skills, five focused test files and three named ADR files including the index. The proposed standalone helper is a new file. `isolation.branchPrefix`, `loadPolicy` and `meta.branch` exist at the described boundaries.

The canonical Progress block matches all three phase headings and every Success Criteria bullet. External push, PR, comment and CI acceptance already belongs to Manual. Local fake-client publication remains Automated. The optional contract-surfaces document is absent.

## Findings

### F1 — Quote configured branch names in recovery commands

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff or non-trivial edit requiring careful review
- **Dimension**: Blind Spots
- **Location**: Implementation Approach, Critical Implementation Details / Publication and recovery identity, Phase 2
- **Detail**: The plan selects native Git ref validation and literal-prefix semantics, then carries that branch into executable manual guidance. Git accepts shell-active characters in a branch name. The existing `manualPr` and `manualFor` interpolate the branch directly into shell text. A valid configured prefix can therefore change the recovery command's arguments or execute shell syntax when the user follows it. The runtime argument-array calls already preserve literals. Read-only checks confirmed that Git accepts `codex/$(id)-demo` and `codex/demo;id`. Evidence in [open-pr.mjs](../../../../skills/10x-pipeline/scripts/open-pr.mjs:380).
- **Fix**: Require shell-safe literal quoting for every dynamic recovery-command argument in the existing message functions, including the complete push refspec. Add a Git-valid metacharacter-prefix regression that checks emitted commands against inert scratch clients.
  - Strength — preserves the planned Git-valid literal-prefix contract across execution and recovery.
  - Tradeoff — emitted manual-command expectations need updating alongside the publisher tests.
  - Confidence — HIGH, the vulnerable interpolation and Git acceptance were verified directly.
  - Blind spot — implementation and regression execution remain future work.
- **Decision**: APPLIED — changed Critical Implementation Details / Publication and recovery identity and Phase 2 / Publisher identity and diagnostics and Publisher regressions. Synchronized the brief's Architecture / Approach and Success Criteria summary.

### F2 — Define selection when saved runs share a change ID

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff or non-trivial edit requiring careful review
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details / Identity resolution precedes mutation, Phase 1
- **Detail**: The plan adds registered-run discovery after source cleanup and prefix drift, including custom worktree locations. It also preserves same-id suffix branches used by baseline arms. Existing lookup accepts only an exact branch, so metadata-based discovery introduces a new candidate-selection boundary. The plan supplies no tie rule for two matching saved runs and no precedence between exact configured selection and fallback candidates. Enumeration order could choose another run or an unrelated candidate could block valid reuse. Legacy 10x metadata also omits `chain`, so candidate checks must retain existing normalization. Evidence in [registeredWorktree](../../../../skills/10x-pipeline/scripts/prepare-run.mjs:71), [same-id baseline branches](../../../../docs/REFERENCE.md:414), [existing in-run behavior](../../../../skills/10x-pipeline/test/prepare-run.test.mjs:145) and [cleanup chain normalization](../../../../skills/10x-pipeline/scripts/prepare-run.mjs:323).
- **Fix**: Validate invocation-recorded identity first, preserve the established in-run case, then prefer exact configured-branch selection. When fallback discovery is necessary, match repository, project prefix, id and normalized chain. Refuse multiple remaining identities with candidate diagnostics before mutation. Revalidate selection under its branch lock. Add duplicate-id baseline and exact-selection precedence cases.
  - Strength — preserves existing exact lookup and saved identity while making added discovery deterministic.
  - Tradeoff — ambiguous fallback discovery requires the caller to resume from its intended worktree.
  - Confidence — HIGH, exact lookup and supported duplicate-id suffix branches are present in the code and Reference.
  - Blind spot — implementation must verify registration and metadata changes under the existing locking contract.
- **Decision**: APPLIED — changed Critical Implementation Details / Identity resolution precedes mutation and Phase 1 / Setup, cleanup and resume and Focused lifecycle regressions. Made legacy chain normalization explicit in Phase 2. Synchronized the brief's Key Decisions Made, Architecture / Approach, Open Risks & Assumptions and Success Criteria summary.

## Verification and assumptions

- Reviewed effective-policy merging, strict boolean opt-out, setup case order, cleanup preservation evidence, standalone source guards, publisher refspec/head flow and base-selection fallbacks. A native read-only child verified the risky claims, callers and existing patterns and returned its findings before this report was finalized.
- Assumed deterministic refusal is appropriate when fallback candidates remain ambiguous. Existing exact registration and immutable saved identity provide the selection precedent. No new selection flag is required.
- Assumed literal Git-valid prefixes remain supported. Native validation confirms that shell quoting is required at recovery-message boundaries.
- Direct `next` retains its current recorded-branch checks at Git writes. Effective-prefix validation is planned at setup, init/resume, cleanup and publication. The plan leaves the sibling's comparison regions, policy/state owners and saved format under their existing ownership.
- The unattended task authorizes applying every clear fix. No owner decision remains pending. The task's three-file write restriction takes precedence over the skill's request to update `change.md`.
- `git diff --check` passed. A read-only Node assertion check verified 15 concrete paths, exact preservation of canonical Progress against HEAD, phase-to-Progress Success Criteria equality and parsing of both WARNING findings as APPLIED through the existing `readReview` function. The original REVISE verdict and warning count still parse correctly.
- This review changes planning artifacts. Runtime tests and live publication were not run. Child-inclusive token coverage is unavailable.
