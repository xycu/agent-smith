<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Explicit Pipeline Invocation

- **Plan**: `context/changes/skills-disable-model-invocation/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

The verdict and counts describe the plan before triage. All three clear fixes were applied to the plan and synchronized into its brief. The six Progress rows retain their original indices, titles and unchecked state.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding — 7/7 implementation paths verified, 4/4 referenced symbols and seams verified, brief and plan consistent.

- Both skill frontmatter blocks currently omit the invocation flag and advertise plain-language triggers. Their names and argument hints support the documented namespaced commands. Evidence in `skills/10x-pipeline/SKILL.md:1–16` and `skills/openspec-pipeline/SKILL.md:1–17`.
- Both manifests exist and their plugin descriptions differ as described. README already documents both explicit commands, Codex selection and the Claude Code minimum version. Evidence in `.claude-plugin/plugin.json:6`, `.claude-plugin/marketplace.json:14` and `README.md:30–68`.
- `SKILL_PATH`, `OPENSPEC_SKILL_PATH`, `frontmatter()` and `fields.description` exist in the named content tests. The OpenSpec helper extracts the first frontmatter block and overwrites duplicate keys. Evidence in `skills/10x-pipeline/test/skill-loop.test.mjs:10–12` and `skills/openspec-pipeline/test/openspec-skill.test.mjs:15,41–53,71–76`.
- Wave 5 ownership permits the seven planned files and shared-file regions. The body-preservation boundary fits the sibling change. Evidence in `context/changes/WAVES.md:11,99–107`.
- The caller sweep covered skills, agents, tools, Claude settings, workflows, manifests, public docs and active change material. It found documented entry points and headless caveats. The native frontmatter field owns the requested invocation change.
- Progress has one phase, five Automated rows and one Manual row. Every phase acceptance bullet matches its Progress title. Accepted lessons support keeping this review's header counts and all findings explicit.

The three riskiest claims were checked directly in this subagent, following the run's nested-delegation restriction. Verification covered host invocation semantics, frontmatter parsing and override seams, and the shared-file ownership boundary.

## Findings

### F1 — Skill-tool guidance omits explicit user authorization

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State invocation matrix, Phase 1 public invocation guidance, Migration Notes
- **Detail**: The original matrix says Claude cannot invoke a flagged skill through the Skill tool. Current official documentation permits that call when the current user message contains the matching slash command as a separate word after prose. The existing statement would make the README describe authorized integrations incorrectly. [Invocation control and command placement](https://code.claude.com/docs/en/skills#where-you-write-the-skills-name)
- **Fix**: State the current-message authorization condition and distinguish direct leading-command expansion from permission supplied by a command word after prose. Keep automatic plain-language invocation disabled.
- **Decision**: APPLIED — updated Desired End State, Implementation Approach / Assumptions and Decisions, Phase 1 / Public invocation guidance, Migration Notes and References. Synchronized the brief's Architecture / Approach and References.

### F2 — Parsed-value checks miss duplicate invocation keys

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 frontmatter regression checks, Testing Strategy / Contract Tests
- **Detail**: The skill contract requires exactly one invocation key, while the test contract only asks for an unquoted true value through the existing parser. That parser assigns `fields[key]` for every matching line. An in-memory reproduction using the actual helper accepted both two true keys and false followed by true, returning `"true"` in both cases. The four planned negative mutations miss this failure. Evidence in `skills/openspec-pipeline/test/openspec-skill.test.mjs:41–53` and original plan sections Phase 1 / Skill frontmatter and Frontmatter regression checks.
- **Fix**: Count top-level invocation keys in the raw first frontmatter block before checking the value. Add duplicate-key deliberate breaks with two true values and conflicting values in both orders. Assert that `user-invocable` remains absent and prove that inserting false fails.
- **Decision**: APPLIED — updated Phase 1 / Frontmatter regression checks and Testing Strategy / Contract Tests, with duplicate checks mapped to existing row 1.1. Synchronized the brief's Architecture / Approach. Progress rows retain their original text.

### F3 — Headless guidance needs current source precedence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State headless matrix row, Phase 1 public invocation guidance, Testing Strategy, Migration Notes
- **Detail**: The plan directs README guidance to the existing foreground-completion caveat. That reference predicts immediate headless exit and explicitly calls the prediction unverified. Current Anthropic documentation describes waiting for background work with an idle ceiling. The plan already leaves live acceptance pending, so its citation needs a provenance qualification before that older hypothesis becomes new public guidance. Evidence in `docs/REFERENCE.md:421`. [Current headless behavior](https://code.claude.com/docs/en/headless#background-tasks-at-exit)
- **Fix**: Use current official documentation for host waiting behavior, identify the repository hypothesis as historical and unverified, and retain version-specific end-to-end completion evidence as the acceptance condition.
- **Decision**: APPLIED — updated Desired End State / Invocation matrix and Key Discoveries, Phase 1 / Public invocation guidance, Testing Strategy, Migration Notes and References. Synchronized the brief's Architecture / Approach, Open Risks & Assumptions and References.

## Verification

- Existing focused suite passed on Node v26.13.1 with 49 passes, zero failures and zero skips using `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- The duplicate-key reproduction evaluated the existing OpenSpec parser in memory and confirmed both duplicate forms produce the expected true string, demonstrating the missing assertion.
- Current official skills, headless and scheduled-task documentation was retrieved on 2026-11-14. Direct command expansion and scheduled-fire behavior agree with the plan. Findings F1 and F3 record the compatibility corrections.
- Final checks passed for byte-for-byte preservation of Progress, phase-to-row title correspondence, router parsing of all three APPLIED decisions, original verdict/count retention and `git diff --check`.

## Assumptions and Remaining Acceptance

- The run goal's explicit slash-command choice remains the product decision. Current official host semantics provide the compatibility wording. All clear findings were applied under the task's standing triage authorization.
- This deep review performed the skill's verification directly because the unattended step forbids nested delegation. The task's three-file edit boundary governs review artifacts and metadata.
- Live Claude Code invocation, minimum-version compatibility and full headless pipeline completion remain pending acceptance in the implementation plan. This review ran the existing focused content suite. Full-suite execution belongs to the implementation phase.
