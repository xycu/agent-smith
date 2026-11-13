---
date: 2026-11-13T15:07:22+01:00
researcher: Claude Sonnet 5.5 (session for Błażej Ksycki)
git_commit: b79777be3474fef44edc882f7207c35eb2b82cd6
branch: chore/new-change-proper-structure-of-rules
repository: agent-smith
topic: "Layered rules (top / framework / skill, each split into always-true and defaults) and OpenSpec definitions kept out of the 10x folder"
tags: [research, codebase, policy, prompts, skills, openspec, rules]
status: complete
last_updated: 2026-11-13
last_updated_by: Claude Sonnet 5.5
---

# Research: Layered rules, and OpenSpec definitions outside the 10x folder

**Date**: 2026-11-13T15:07:22+01:00
**Researcher**: Claude Sonnet 5.5 (session for Błażej Ksycki)
**Git Commit**: b79777be3474fef44edc882f7207c35eb2b82cd6 (branch off `origin/main` e3f7eae, v1.8.0)
**Branch**: chore/new-change-proper-structure-of-rules
**Repository**: agent-smith

## Research Question

From `change.md`: rules and behaviour should have three levels (1 top, applies to everything; 2 framework, either 10xDevs or OpenSpec; 3 skill, applies to one skill such as `10x-research`). Each level splits into "always true" (lower levels may not change it) and "defaults" (lower levels may change them). OpenSpec definitions should live in the OpenSpec folder, not in the 10xDevs folder. What exists today, and what constrains the change?

## Summary

- **No layers exist today.** One flat `skills/10x-pipeline/policy.json` serves both chains. A project override merges over it with `deepMerge` (`scripts/state.mjs:37-43`): objects merge key by key, and an array, scalar or `null` replaces the base value whole. The merge has no per-key lock. Every key, including `prompts.suffix`, can be replaced (`docs/REFERENCE.md:229`).
- **"Always true" rules are carried three ways.** (a) Router code that reads no policy key (for example `guardArchived`, the run lock, the `attachResult` file checks). (b) Text in `AGENTS.md` Hard Rules and in the Rules and Anti-stall sections of the two `SKILL.md` files. (c) The shared prompt suffix `policy.json` `prompts.suffix` (`:212`), which is appended to every step prompt (`scripts/route.mjs:197-199`). Only (a) cannot be overridden. (c) can be replaced by a project override.
- **Level mixing is real.** The suffix holds invariants (no recursive delete, no nested subagents, the `RESULT:` format) next to defaults (`signals.rigor` is a MAY) in one string. Two prompt files already state a precedence rule by hand: `prompts/score.md:17` and `prompts/os-archive.md:13` say their own rules win over the suffix.
- **OpenSpec definitions sit in the 10x folder.** The four `os-*` prompt files, the `os-*` blocks of `policy.json`, `scripts/openspec.mjs`, seven OpenSpec-only test files and the helper `openspec-helpers.mjs` live under `skills/10x-pipeline/` (`ls skills/10x-pipeline/test | grep -i openspec`). `skills/openspec-pipeline/` holds `SKILL.md` only. The `@prompts/<file>.md` reference form resolves only under `skills/10x-pipeline/prompts/` (`scripts/flow.mjs:788-808`), so moving a prompt file needs a new resolver form.
- **"Skill" in level 3 is a step prompt, not a skill folder.** This repository ships two skills (`ls skills/` shows `10x-pipeline` and `openspec-pipeline`). `10x-research` is a user-level 10xDevs skill outside the repository; agent-smith reaches it only through the step `research` (`policy.json:19`, template `policy.json:232`). The carriers of "skill specific" rules today are the per-step templates in `policy.json` and the files in `skills/10x-pipeline/prompts/`.
- **Collision risk is high.** Eight open changes listed in Historical Context touch files this change would edit (both `SKILL.md`, `policy.json`, `prompts/`). Two of them, `step-subagent-git-guard` and `nested-subagent-hard-stop`, depend on how "always true" gets carried, so this change should settle that first. `context/changes/WAVES.md` is stale for waves 2 and 3.

## Detailed Findings

### Where "always true" and "default" live today

- **Policy merge.** `deepMerge` (`scripts/state.mjs:37-43`, read directly): when the override value is an array, a non-object or `null`, it replaces the base value; otherwise objects merge recursively. `mergedPolicy` (`state.mjs:50-66`, worker-reported) halts on an unparseable or non-object override and does no per-key check.
- **Validation at load.** `policyProblems` (`state.mjs:118-159`, worker-reported) fails closed, but for these keys only: `limits`, `escalation`, `rigor`, `rigor.budgetDelta`, `steps` and `ladder`. Other keys are read by tolerant readers that fall back to a default. Nothing checks that `prompts.suffix` still holds the invariant rules. ADR-022 (`docs/ADR/ADR-022*`) is the precedent for fail-closed checks at load.
- **Prompt assembly.** `route.mjs:197-199` (read directly): worktree line (isolated runs), then the rendered step template, then the advisor text when enabled, then `promptText(policy, "suffix")`. The suffix is not rendered. A template or the suffix is a string or an array of strings; a part `@prompts/<name>.md` is replaced by that file's text (`flow.mjs:788-808`, read directly).
- **Rule form.** ADR-004 (`docs/ADR/ADR-004-prompt-rules-as-scenarios.md:25`): `MUST` and `MUST NOT` are for hard limits, a style rule is `SHOULD`. `rules.test.mjs:104-116` checks every `policy.json` prompt string and every `prompts/*.md` file except `README.md` against the form. So the repository already has a vocabulary that separates invariant from default inside a prompt, but it is not tied to a level and nothing enforces precedence.
- **Existing hand-written precedence.** `prompts/os-archive.md:13`: when the generic unattended rules say not to commit and the archive succeeded, the commit rule of the file wins. `prompts/score.md:16-17`: the file forbids `signals.rigor` although the suffix allows it, and "these rules **MUST** win" when they disagree.
- **Inventory (worker A, every file in its list read in full except the numeric middle of `policy.json`).** Rules appear in `AGENTS.md:7-12`, both `SKILL.md` files (Rules, Anti-stall, Tuning), `policy.json:212` (suffix), `policy.json:213-348` (step templates), and 24 files in `skills/10x-pipeline/prompts/`. Duplicated text: the Anti-stall section is equal in `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md` (a test pins it), and several rules recur in three to six places (recursive-delete ban in `AGENTS.md:11`, both `SKILL.md`, `policy.json:212`, `manual-verify.md:10`; the no-Agent-tool rule in `policy.json:212/224/266`, `executor-e2e.md`, `executor-tdd.md`, `executor-retry.md`). Mixed-level places: the suffix; the Tuning section of the 10x `SKILL.md` (framework text and per-step rules under one heading); `prompts/manual-verify.md:26-32` (top-level safety rules inside a step prompt); `AGENTS.md` Hard Rules (contributor rules at `:7`, `:10` next to runtime rules at `:9`, `:11`).
- **Where invariants are enforced in code** (worker C, anchors not all re-read): `guardArchived` (`state.mjs:384`), `acquireRunLock` (`state.mjs:846`), `attachResult` (`flow.mjs:487-565`, a `done` status counts only with a file-level verification), the run-branch and isolation checks (`isolation.mjs`), `remove-tree.mjs`. **Text only:** the orchestrator rules in the `SKILL.md` Rules sections, and the step-subagent rules in the suffix (no `rm -rf`, no Agent tool, no questions).

### Where OpenSpec definitions live today

- **Prompts.** `skills/10x-pipeline/prompts/os-propose.md`, `os-apply.md`, `os-verify.md`, `os-archive.md`, indexed in `prompts/README.md:3,5,30-33`.
- **Policy.** `policy.json:24-27` holds the four `os-*` steps; `policy.json:329-348` holds their prompt arrays, each an inline string plus an `@prompts/os-*.md` reference. `baseline-policy.json` has no OpenSpec keys.
- **Code.** `skills/10x-pipeline/scripts/openspec.mjs` (209 lines) is OpenSpec-only (`decideOpenspec`, `verifyOpenspecStep`, readers). It imports only from `state.mjs` (`:5`). Chain branches (`chain === "openspec"`) sit inside `state.mjs`, `flow.mjs`, `isolation.mjs`, `steps.mjs`, `route.mjs` and `open-pr.mjs` (worker B, line anchors in its report; not re-read here). `preplan.mjs`, `pr-comment.mjs`, `pr-common.mjs` and `remove-tree.mjs` carry no OpenSpec code (worker B).
- **Tests.** Seven OpenSpec-only test files (`openspec-archive`, `-chain`, `-contract`, `-isolation`, `-readers`, `-skill`, `-steps`) plus `openspec-helpers.mjs` in `skills/10x-pipeline/test/`; shared tests with OpenSpec cases include `route`, `policy-validate`, `rules`, `archive`, `ladder`, `nested-subagents` and `open-pr` (worker B).
- **Docs.** `docs/REFERENCE.md:399-487` (OpenSpec chain section), `README.md:34-45`, `AGENTS.md:7,8,54,55,61,69`, ADR-013.
- **The `skills/openspec-pipeline/` skill** holds `SKILL.md` (136 lines) and no scripts. It reaches the router and the shared policy through `${CLAUDE_SKILL_DIR}/../10x-pipeline/...` (`skills/openspec-pipeline/SKILL.md:25-27,134`). Neither manifest has a `skills` key (`grep '"skills"'` over `.claude-plugin/*.json` printed nothing); skills are discovered under `skills/*/SKILL.md`. `marketplace.json` uses `source: "./"`, so the whole repository tree is installed (ADR-013 evidence, worker B; no live install was checked here).
- **The root `openspec/` folder** is the OpenSpec CLI's project folder for this repository: `config.yaml` (schema `spec-driven`, project `context` and per-artifact `rules`), `specs/openspec-project-config/spec.md`, and one archived change. No router code or test reads it (worker B). `openspec/config.yaml` itself states that routing decisions live only in `skills/10x-pipeline/...`. Moving it would break the OpenSpec CLI default for this repository.
- **Constraint from ADR-013.** The second skill "calls the router at `skills/10x-pipeline/scripts/route.mjs`; it carries no copy" (`ADR-013:35`) and the Good consequence is "one router, one policy, one report format and one override file for both chains" (`ADR-013:141`). ADR-013 does not say where the OpenSpec prompts live (worker D). Splitting the policy into two files would contradict `:141`; moving prompt files would not, but needs an ADR-013 amendment.
- **Tests that pin current paths** (worker B): `openspec-skill.test.mjs`, `openspec-chain.test.mjs`, `openspec-steps.test.mjs`, `rules.test.mjs` (scans `prompts/`), `archive.test.mjs`, `archive-gate.test.mjs`, `nested-subagents.test.mjs`, `no-recursive-delete.test.mjs`, `change-status.test.mjs`. CI runs `skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (`.github/workflows/ci.yml:39`), so a test moved outside those folders stops running unless the glob changes.

### What "skill specific" can mean here

In this repository the rule carriers below the framework level are the step templates (`policy.json:213-348`) and the files in `skills/10x-pipeline/prompts/`. The step `research` runs the skill `10x-research` (`policy.json:19`) with the template at `policy.json:232`. Rules for the 10xDevs skills themselves cannot be changed here: those skills live outside the repository. Level 3 therefore means "rules in the prompt of one step".

## Code References

- `skills/10x-pipeline/scripts/state.mjs:37-43` - `deepMerge`, override semantics
- `skills/10x-pipeline/scripts/state.mjs:50-66,118-159` - `mergedPolicy`, `policyProblems` (worker-reported)
- `skills/10x-pipeline/scripts/route.mjs:195-200` - prompt assembly order
- `skills/10x-pipeline/scripts/flow.mjs:788-808` - `PROMPT_REF`, `promptText`, resolution under `SKILL_DIR`
- `skills/10x-pipeline/policy.json:19,24-27,212,232,329-348` - research step, `os-*` steps, suffix, research template, `os-*` prompts
- `skills/10x-pipeline/prompts/score.md:16-17`, `prompts/os-archive.md:13` - hand-written precedence
- `skills/10x-pipeline/test/rules.test.mjs:104-116` - ADR-004 form check over policy prompts and prompt files
- `skills/openspec-pipeline/SKILL.md:25-27,134` - `../10x-pipeline` paths
- `docs/ADR/ADR-004-prompt-rules-as-scenarios.md:25`, `docs/ADR/ADR-013-openspec-pipeline.md:35,141`
- `docs/REFERENCE.md:229` - prompt overrides, `@prompts/` reference rule
- `AGENTS.md:7-12,54,55,61,69` - Hard Rules, router module order, OpenSpec layout lines
- `openspec/config.yaml` - repository's own OpenSpec project rules

## Architecture Insights

- The merge layer is flat, and the only place where "this value may not change" could be expressed is code that ignores policy. A layered model needs either a place the merge cannot reach (router code, a file outside `policy.json`, or a load-time check in the style of ADR-022) or an accepted convention.
- The router already assembles a prompt from ordered parts (worktree, template, advisor, suffix). That order is a ready carrier for levels: the later part is the more general one today, which is the reverse of "lower level wins" unless the precedence is stated.
- Chain scoping inside `policy.json` is carried only by the `os-` name prefix; for the other keys the scope was inferred by workers from `decideOpenspec` and `next`, not from a per-key audit (worker C).
- ADR-004's keyword vocabulary (`MUST`/`MUST NOT` hard, `SHOULD`/`MAY` style) maps onto always-true versus default inside one prompt, and a test already checks the form.

## Historical Context (from prior changes)

- `context/archive/2026-11-09-openspec-pipeline/` and ADR-013: shared router and policy, no fork (see Detailed Findings).
- `context/archive/2026-11-12-array-prompt-override` (worker D, head of `change.md` only): a prompt value may be an array with `@prompts/` references; `archive` and `suffix` accept arrays. Overlaps on the override surface of the suffix.
- `policy-limits-fail-open` and ADR-022 (archived): fail-closed validation at load for caps and placeholders; precedent for enforcing a rule at load.
- `context/archive/2026-11-12-agents-md-slim`: `AGENTS.md` is now rules and pointers; new tests, prompts and ADRs get a row in the README of their folder. Tests pin `AGENTS.md` text (`advisor.test.mjs:596`, `pr-comment.test.mjs:804`, `no-recursive-delete.test.mjs:141,256`; worker D).
- Open changes in `context/changes/` that touch the same files (worker D, from each `change.md`; plans not read):
  - `step-subagent-git-guard` (not in WAVES): adds git, push and `gh` bans to `prompts.suffix` or a new prompt file. It needs an "always true" carrier, so this change should define the carrier first.
  - `nested-subagent-hard-stop` (wave 6): enforces ADR-018 outside the prompt (`.claude/settings.json` variable and/or `agents/step.md`) and amends ADR-018. This is the "not overridable" idea for one rule.
  - `skill-md-context-diet` (wave 7): rewrites both `SKILL.md` whole and keeps the Anti-stall section equal. Its line references are stale. It is the largest collision with any `SKILL.md` restructure.
  - `quote-router-in-skill-loops` (not in WAVES): edits about 13 lines per `SKILL.md` and re-pins `skill-loop`, `openspec-skill` and `archive-gate` tests.
  - `step-prompt-by-file` (wave 6): new `prompts.byFile` key, Loop step 2.
  - `docs-drift-fixes` (wave 6): amends six ADRs, `prompts/README.md`, `REFERENCE.md`.
  - `skills-disable-model-invocation` (wave 5) and `ladder-fable-rung` (wave 5): frontmatter and ladder; low overlap.
- `context/changes/WAVES.md` lane rule: at most two `SKILL.md` changes per wave and one `policy.json` change per block; `context/changes/WAVES.md:3` still says "31 open changes of waves 2 to 7" and lists waves 2 and 3 as pending, though wave 2 is archived and wave 3 is merged in 1.8.0.
- `context/foundation/lessons.md`: the lesson "Check live and archived folders of every chain before choosing the owner of a change name" applies. For this change id nothing exists in `context/changes/`, `context/archive/`, `openspec/changes/` or `openspec/changes/archive/` (checked 2026-11-13).

## Related Research

None found under `context/changes/**/research.md` or `context/archive/**/research.md` for rule layering (worker D searched the change folders and ADRs; it did not open every `research.md`).

## Open Questions

1. **Which folder is "the OpenSpec folder"?** `skills/openspec-pipeline/` (the chain's skill; fits "OpenSpec definitions: prompts, steps, router module") or the root `openspec/` (the CLI project folder of this repository; fits only the repository's own specs). Needs the owner's choice before planning.
2. **How is "always true" made binding?** Options observed: text convention only (today); router-code rule; fail-closed check at load (ADR-022 style) that the invariant block is present; an agent definition or settings variable outside the policy (`nested-subagent-hard-stop` direction). Not decided here.
3. **Where do the layers live as files?** Not decided: one `policy.json` with sections, or a layered set of files. Splitting the policy contradicts `ADR-013:141` unless amended.
4. **Resolver for `@prompts/`.** Any move of `os-*` prompts needs a new reference form (the current pattern allows only a file name under `skills/10x-pipeline/prompts/`, `flow.mjs:788`), plus changes to `rules.test.mjs`, `prompts/README.md` and docs.
5. **Plugin install behaviour.** Whether a `skills/openspec-pipeline/` folder that holds more than `SKILL.md` is installed intact and resolves `${CLAUDE_SKILL_DIR}`-relative paths is untested (the `skill-dir-variable` rows 3.5 and 3.6 for an installed plugin are still unproved).
6. **Sequencing.** Whether this change runs before `step-subagent-git-guard` and `skill-md-context-diet`, merges with them, or waits; `WAVES.md` needs updating either way.
7. **Not inspected:** whether any consumer project overrides `prompts.suffix` today; the plans and reviews of the open changes; `docs/REFERENCE.md` beyond lines 227-230.
