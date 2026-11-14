<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Strip inherited Git variables from test environments

- **Plan**: `context/changes/tests-strip-git-env/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warning, 0 observations

The verdict and counts describe the plan before review edits. F1 has been applied. Its runtime acceptance checks belong to implementation.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | PASS |

## Grounding

Grounding checked 9/9 existing modification paths, the explicitly new regression path, and 8/8 existing symbols. The brief and plan agree on ownership, override order and the two phases.

The existing paths cover `helpers.mjs`, `open-pr.test.mjs`, `pr-comment.test.mjs`, `commit-lint.test.mjs`, `openspec-contract.test.mjs`, `provenance.test.mjs`, `rule-levels.test.mjs`, `agents.test.mjs` and the 10x test index. The existing symbols are `run`, `gitEnv`, `envFor`, `GIT_ENV`, `cliApply`, both `runCopy` functions and `record`. `cleanEnv` and `helpers-env.test.mjs` are explicit additions.

The environment-site sweep confirms eight inherited spreads and five direct pass-through arguments in the listed Git-capable builders. Both chains and the Codex fixtures use the shared helper. Fixture overrides include `open-pr`'s intentional `GIT_LOG`, so sanitizing the inherited base owns the fix. The reviewed ownership regions agree with the Wave 4 table and sibling change descriptions.

The plan has one bottom-of-file Progress section, two matching phases and five pending automated rows. Every phase success criterion has a corresponding row. The edits preserve the entire Progress section byte-for-byte.

## Findings

### F1 — In-worktree scratch directories can discover the run repository

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff, pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Victim observation and process isolation, Phase 2 / Environment and victim regressions, Testing Strategy / Full-suite acceptance driver
- **Detail**: The original plan places child scratch directories inside this run worktree and strips all inherited `GIT_` variables. `run` then supplies no repository-discovery limit unless its caller explicitly passes `gitEnv`. Git can walk from an uninitialized scratch directory to the enclosing worktree. The full suite includes a no-repository score case whose `envOf` deliberately returns an empty options object, so sanitization alone can expose the real repository and alter the expected risk and scoring behavior. The independent victim snapshot would still cover only the victim.
- **Evidence**: A read-only probe built an environment by filtering every inherited `GIT_` key and ran `git rev-parse --show-toplevel` from `context/changes/tests-strip-git-env`. Git exited 0 and returned this run worktree. `makeProject` places projects below the supplied temporary directory. `run` inherits its base environment, and the router reads HEAD and churn from its current directory. Sources are `skills/10x-pipeline/test/helpers.mjs` at lines 65 and 129, `skills/10x-pipeline/test/score.test.mjs` at lines 198, 555 and 670, `skills/10x-pipeline/scripts/state.mjs` at lines 655 and 723, and `skills/10x-pipeline/scripts/route.mjs` at line 992.
- **Fix**: Add a filesystem discovery boundary to each harness-owned temporary parent. A `.git` file can point to an absent target within that parent. Preflight with an independently sanitized observer that an uninitialized descendant resolves neither a repository nor HEAD and an initialized descendant resolves its own repository.
  - Strength — Keeps all scratch files inside the authorized worktree and contains discovery after environment sanitization.
  - Tradeoff — Adds one temporary boundary file and two preflight checks to each harness setup.
  - Confidence — HIGH. Source tracing and the read-only Git probe demonstrate the discovery path. The preflights make the proposed boundary an explicit implementation gate.
  - Blind spot — Execution of the boundary preflights and both suite gates remains part of implementation.
- **Decision**: APPLIED — Updated Critical Implementation Details / Victim observation and process isolation, Phase 2 / Environment and victim regressions and Testing Strategy / Full-suite acceptance driver. Synchronized plan-brief.md / Open Risks & Assumptions. Existing Progress rows 2.1 and 2.3 carry the added proof through their phase contracts.

## Assumptions and verification

The unattended invocation selects application of every finding with a clear fix. The filesystem boundary follows the worktree-local scratch requirement and the existing Git discovery behavior. Review and triage ran in this subagent under the supplied unattended rules and the accepted lesson about nested subagents.

Verification covers the read-only discovery probe, path and symbol grounding, the complete environment-site audit, phase-to-Progress consistency, preservation of Progress and parsing the saved review through the router's reader. Runtime sanitizer regressions and the ordinary and hostile suites remain implementation acceptance work.
