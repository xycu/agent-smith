<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Explicit Pipeline Invocation

- **Plan**: context/changes/skills-disable-model-invocation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-14
- **Reviewed commit**: d1b9076
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

The full-plan request covers phase 1, including its pending Manual row. Progress records five completed Automated rows and one pending Manual row, giving completion of 5/6. Automated criteria pass. F1 records the remaining live acceptance evidence.

## Scope and Implementation Evidence

The implementation commit is 33aac40. Comparisons use its parent for preservation checks and main...HEAD for the branch-wide scope check.

| Planned file or region | Assessment |
| --- | --- |
| skills/10x-pipeline/SKILL.md frontmatter | MATCH. Exactly one unquoted true invocation flag, folded description naming 10xDevs and its explicit namespaced command. |
| skills/openspec-pipeline/SKILL.md frontmatter | MATCH. Same invocation contract with the OpenSpec chain and command. |
| .claude-plugin/plugin.json description | MATCH. Describes both chains, explicit commands, separate subagents and model/effort routing. |
| .claude-plugin/marketplace.json plugin-entry description | MATCH. Exact equality with the plugin manifest description. |
| README.md introduction and invocation subsection | MATCH. Both commands, plain-language gating, print mode, scheduled fires and current-message Skill-tool authorization are documented with authoritative sources. Codex guidance remains present. |
| skills/10x-pipeline/test/skill-loop.test.mjs | MATCH. First-block assertions cover invocation gating, default user invocation, chain description, manifest alignment and README guidance through the existing override seam. |
| skills/openspec-pipeline/test/openspec-skill.test.mjs | MATCH. Reuses the existing parser and adds raw-block key counting, the unquoted true assertion, default user invocation and explicit command wording. |

Byte comparisons passed for both skill bodies and the existing frontmatter fields outside the descriptions. JSON comparisons passed for all manifest fields outside the two descriptions, including release-owned version fields. The branch-wide diff contains the seven implementation paths and this change folder. Protected-path checks passed.

Native Claude Code frontmatter owns selection before the orchestrator starts. This implements invocation policy at its responsible layer. The body-preservation checks and focused suites cover the existing orchestration contract. Current Anthropic documentation agrees with the README on direct invocation, current-message authorization, print-mode expansion and background waiting, and plain-text scheduled fires. [Skills](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill) · [Command placement](https://code.claude.com/docs/en/skills#where-you-write-the-skills-name) · [Headless execution](https://code.claude.com/docs/en/headless#background-tasks-at-exit) · [Scheduled prompts](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop)

## Findings

### F1 — Fresh-session invocation acceptance remains unproved

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/skills-disable-model-invocation/plan.md, Progress row 1.6
- **Detail**: Row 1.6 is unchecked. The existing evidence records Claude Code 2.1.311 version/help and passing content assertions, while fresh-session transcripts proving explicit startup and suppressed plain-language invocation remain absent. Both chains still need an observed first router action with action run and a selected step, plus evidence that the plain-language request invokes neither pipeline and creates no pipeline state. The README accurately records live acceptance as pending. Evidence is in context/changes/skills-disable-model-invocation/evidence/judgment-manual-invocation-retry.md and evidence/unproven.md.
- **Fix**: Complete row 1.6 in fresh top-level Claude Code sessions using the updated plugin and disposable prepared projects, then record the host version, command transcripts and state-write observations in this change folder.
- **Decision**: PENDING — fresh agent sessions are prohibited by this step's always-true no-subagent rule, and static checks cannot supply the required host observations. The owner must decide when to run the top-level acceptance sessions before marking row 1.6 complete.

## Automated Verification

Verification ran in this worktree. Node preflight reported v24.19.0, and the post-suite report check reported v26.13.1. Both satisfy the repository's Node 24+ requirement.

| Criterion | Command or proof | Observed result |
| --- | --- | --- |
| 1.1 | node --test --test-reporter=tap skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs | 53 passes, zero failures, zero skips. |
| 1.2 and duplicate/default-invocation checks | Deliberate-break copies through SKILL_PATH and OPENSPEC_SKILL_PATH | All 16 cases failed specifically at the invocation assertion. Each chain rejected missing, false, quoted, body-only, duplicate true, true/false, false/true and user-invocable false variants. Temporary copies were removed individually. |
| 1.3 | Focused manifest/README assertions and node tools/version-check.mjs | Description equality and invocation guidance passed. Version check passed at 1.10.1. |
| 1.4 | node --test --test-reporter=tap --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs | Exit 0. 1,425 tests, 1,422 passes, zero failures, three skips. Duration 1,107,041 ms. |
| 1.5 | Git scope check, byte/JSON comparisons and git diff --check | All checks passed. |

### Full-suite skips

- `live: a branch with no pull request is skipped` requires GH_LIVE=1, network access and authenticated gh. Repository instructions reserve the live tests for a human.
- `live: the real comment projection is one parseable object per line across pages` has the same opt-in and authenticated-network requirements.
- `CLAUDE.md has no @ imports` is skipped because the optional CLAUDE.md file is absent. The AGENTS.md counterpart passed.

## Assumptions and Remaining Acceptance

- The explicit full-plan request determines review coverage despite pending Manual row 1.6. The skill's review passes were performed directly under the task's no-subagent rule.
- Full-suite fixtures used a worktree-local TMPDIR. A temporary invalid Git-directory pointer at that scratch root blocked discovery of the parent repository, following the established implementation verification setup in evidence/implementation.md. Fixture-owned repositories used their own Git directories.
- Version-specific live invocation, minimum-supported-version behavior and full headless pipeline completion remain unverified. Official documentation supplies the compatibility contract recorded in the README.
