# Layered Rules and OpenSpec Definitions in the OpenSpec Folder Implementation Plan

## Overview

Give the rules agent-smith hands to its agents three levels and two categories, and move the OpenSpec definitions out of `skills/10x-pipeline/` into `skills/openspec-pipeline/`.

- **Level 1 (top):** applies to every step of both chains.
- **Level 2 (chain):** applies to the 10xDevs chain or to the OpenSpec chain.
- **Level 3 (step):** applies to one step, for example only `research`.

Every level holds **always-true** rules, which no lower level and no project override can change, and **default** rules, which a lower level or the project override can replace. The plan settles the five open questions of `research.md`: how always-true is made binding, the file layout of the layers, the form of `@prompts` references, the ADR-013 amendment, and the order against the open changes that touch the same files.

## Current State Analysis

- One flat `skills/10x-pipeline/policy.json` serves both chains. The project override is deep-merged over it (`skills/10x-pipeline/scripts/state.mjs:37-44` `deepMerge`, `:51-66` `mergedPolicy`), and every key can be replaced, `prompts.suffix` included (`docs/REFERENCE.md:229`). Nothing marks a rule as fixed.
- The step prompt is assembled at two places: `route.mjs:193-199` (worktree rules, rendered template, advisor, unrendered `prompts.suffix`) and `isolation.mjs:696-697` (the `archive` and `os-archive` prompt: worktree rules, template, suffix).
- `prompts.suffix` (`policy.json:212`) mixes invariants (no `AskUserQuestion`, no recursive delete per ADR-016, no nested subagent per ADR-018, the `RESULT:` line the router parses) with defaults (decide from evidence, `blocked` when no evidence exists, `signals.rigor` MAY, commit only where told). A project override that replaces the suffix drops the invariants too.
- Precedence is hand-written in three places: `prompts/score.md:17`, `prompts/os-archive.md:13` and the `archive` template in `policy.json:231` ("these rules and the generic unattended rules disagree ... these rules **MUST** win").
- Level-3 duplication: the `research.md` frontmatter rule is repeated in the `research`, `research-with-map` and `research-revise` templates (`policy.json:232-245`), all of which run as step `research` (`preplan.mjs:350-351`). Level-2 duplication: the `--change "{id}"` and `--store` rules repeat in `os-propose.md:6-7`, `os-apply.md:5-6` and `os-verify.md:5-6`.
- OpenSpec definitions inside the 10x folder: `prompts/os-{propose,apply,verify,archive}.md`; `policy.json:24-27` (`steps.os-*`) and `:329-348` (`prompts.os-*`); `scripts/openspec.mjs` (imports only `state.mjs`, `:5`; imported by `flow.mjs:14`, `isolation.mjs:10`, `route.mjs:30`); seven OpenSpec test files and `openspec-helpers.mjs` in `skills/10x-pipeline/test/`. `skills/openspec-pipeline/` holds `SKILL.md` only.
- The `@prompts/<file>.md` reference resolves only under `skills/10x-pipeline/prompts/` (`flow.mjs:788-808`).
- CI runs `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (`.github/workflows/ci.yml:39`), so a moved test stops running unless the glob grows.

## Desired End State

- Every prompt the router returns is, in this order: the worktree rules (isolated run), the rendered step template (level 3 defaults), the advisor rules (opt-in), the chain defaults (`prompts.chain-<chain>`, level 2, when set), the generic defaults (`prompts.suffix`, level 1), then the always-true block: the step file, the chain file and the top file, each when it exists, the top file last so the `RESULT:` format ends the prompt.
- `skills/10x-pipeline/rules/top.md` holds the level-1 always-true rules and one precedence rule. No policy key and no override reaches the always-true files. A missing `rules/top.md` halts `init` and `next` before anything is written.
- `skills/openspec-pipeline/` holds `SKILL.md`, `policy.json` (the `os-*` steps and prompts), `prompts/os-*.md`, `rules/chain.md`, `scripts/openspec.mjs` and `test/`. `skills/10x-pipeline/` holds no `os-` file, no `os-` policy key and no OpenSpec-only test.
- `docs/ADR/ADR-023-layered-rules.md` records the hierarchy; ADR-013 carries Amendment 1 for the folder split.
- Verify with the full suite (both test folders), the grep checks of each phase, and the manual rows.

### Key Discoveries:

- `deepMerge` replaces arrays and scalars whole and merges objects key by key (`state.mjs:37-44`); a second plugin file with disjoint keys merges cleanly under it.
- `promptText` throws an `Error` naming the template on a bad reference, and `main` turns it into a JSON halt (`flow.mjs:790-807`); `checkPrompts` runs it for every template before `next` consumes `last-result.json` (`flow.mjs:813-822`). The new file reads reuse this path.
- `render` replaces any `{word}` with its value or `""` (`steps.mjs:674-676`), and `promptProblem` halts on unknown placeholders, with a narrow list for templates rendered with fewer names (`steps.mjs:663-672`, `NARROW_PLACEHOLDERS`).
- Provenance hashes every top-level policy key, `prompts` as resolved text, plus `agentFiles` (`isolation.mjs:42-77`); a section that the record lacks counts as drift (`isolation.mjs:105-120`). Files outside the policy need a section of their own, like `agentFiles`.
- `isolation.mjs:18` `PLUGIN_ROOT = SKILL_DIR/../..`; ADR-013 Results 2 shows the installed plugin cache is a copy of the whole repository tree, so a relative import from `skills/10x-pipeline/scripts/` to `skills/openspec-pipeline/scripts/` resolves after install.
- Seven shared 10x tests import `openspec-helpers.mjs` (`late-usage`, `route`, `pr-comment-flag`, `neutral`, `change-status`, `run-lock`, `cost`), so the helper's new path reaches beyond the OpenSpec tests.
- Tests pin text that this plan moves: the suffix rules (`nested-subagents.test.mjs:35-95`, `no-recursive-delete.test.mjs:242-256`, `rules.test.mjs:191-196`, `advisor.test.mjs:22-48`, `executors.test.mjs:287`), the research status rule (`preplan.test.mjs:22`), the score precedence line (`score.test.mjs:110`), the os prompt files (`openspec-chain.test.mjs:18`, `openspec-steps.test.mjs:19`, `rules.test.mjs:180-190`, `openspec-skill.test.mjs:150`) and the `@prompts/os-archive.md` override (`archive.test.mjs:622-629`).
- `context/foundation/lessons.md`: "Grep every doc for the old behavior when a script's output changes" applies to every phase, because the prompt output changes.

## What We're NOT Doing

- No new rule content beyond the precedence rule and the one-line headings of the always-true files. Rules move; their words stay, except the unified `--change`/`--store` pair of the OpenSpec chain file.
- No orchestrator rule moves. `SKILL.md` keeps its sections; ADR-023 maps them onto the levels (Anti-stall: level 1 always-true, pinned equal in both files by `openspec-skill.test.mjs`; each `## Rules` section: level 2 always-true; `## Tuning`: points at the defaults). The rewrite of both `SKILL.md` files belongs to `skill-md-context-diet` (wave 7). Only the `## Tuning` lines change here.
- `AGENTS.md` contributor rules stay outside the runtime hierarchy; `AGENTS.md` only gets updated paths and pointers.
- No router move. `route.mjs` and the shared modules stay in `skills/10x-pipeline/scripts/` (ADR-013 `:35`, Precondition 2). The chain branches inside shared modules (`state.mjs`, `flow.mjs`, `isolation.mjs`, `steps.mjs`, `route.mjs`, `open-pr.mjs`) and the `os-archive` entry of `NARROW_PLACEHOLDERS` stay where they are; only the OpenSpec-only module moves.
- No move of the root `openspec/` folder; it is the OpenSpec CLI project of this repository. Only its `config.yaml` text gets the new paths.
- No rules for the git, push and `gh` bans; that is `step-subagent-git-guard`, which will use `rules/top.md` as its carrier.
- No change to `prompts.worktree` or `prompts.advisor` placement or keys.
- No shipped content for the empty cells: level-2 10x always-true, level-2 defaults of both chains, level-3 OpenSpec always-true. The carriers exist and are tested; a later change fills them.
- No edit of `context/changes/WAVES.md` or of other changes' folders from this run branch (WAVES.md rule: edit on `main` only); the owner does it after the merge (Manual row 3.7).
- No edit of `context/archive/`.

## Implementation Approach

Three phases, each green on its own:

1. Move the OpenSpec definitions with no change to any returned prompt: a policy fragment merged at load, a second reference form, the module and the tests.
2. Add the rule levels to the router: the always-true files read by fixed path, the chain defaults key, one tail builder used by both assembly sites, the precedence rule, the provenance section, and the move of rules out of the suffix and the duplicated templates.
3. Record the decisions: ADR-023, ADR-013 Amendment 1, the ADR-016 and ADR-018 notes, `docs/REFERENCE.md`, and the doc sweep.

### Decisions settled (from the open questions of `research.md`)

1. **Binding of always-true.** Always-true rules live in plugin files under `<skill>/rules/`, outside `policy.json`. The router reads them by fixed path and never through the merged policy, so neither the project override nor a lower-level default can remove them. A missing `skills/10x-pipeline/rules/top.md` halts like a missing prompt file. Defaults stay policy keys, overridable as today. Precedence inside one prompt is one always-true rule in `top.md`: an always-true rule wins over every other rule, between two always-true rules the higher level wins (top, then chain, then step), and among the other rules the one written earlier in the prompt wins. The prompt lists step, then chain, then generic defaults, so the more specific level wins. Evidence: `research.md` Architecture Insights ("a place the merge cannot reach"); ADR-022 for fail-closed halts; ADR-004 keywords stay independent of category (a default may say **MUST**).
2. **File layout.**

   | Level | Always-true (no override) | Defaults (overridable) |
   | --- | --- | --- |
   | 1 top | `skills/10x-pipeline/rules/top.md` (both chains; it lives with the shared router) | `prompts.suffix` in `skills/10x-pipeline/policy.json` |
   | 2 chain 10x | `skills/10x-pipeline/rules/chain.md` (none shipped) | `prompts.chain-10x` (none shipped) |
   | 2 chain OpenSpec | `skills/openspec-pipeline/rules/chain.md` | `prompts.chain-openspec` (none shipped) |
   | 3 step | `<chain skill>/rules/steps/<step>.md`, keyed by step, so it covers every template of the step (`skills/10x-pipeline/rules/steps/research.md` shipped) | the step's templates, `prompts.<template>` |

   `prompts.suffix` keeps its key, so existing overrides keep working and now replace only the defaults. `skills/10x-pipeline/rules/README.md` indexes the files of both skills and states the table.
3. **Reference form.** `@prompts/<file>.md` keeps its meaning, a file under `skills/10x-pipeline/prompts/`. The new form `@<skill>/prompts/<file>.md` names a folder under the plugin's `skills/`, with `<skill>` matching `[a-z0-9][a-z0-9-]*` (no dot, no slash, so no path escapes). A part that starts with `@prompts/` or matches `^@[a-z0-9][a-z0-9-]*/prompts/` is a reference; any other part is literal text. The OpenSpec prompts are referenced as `@openspec-pipeline/prompts/os-*.md`.
4. **OpenSpec policy and ADR-013.** `skills/openspec-pipeline/policy.json` holds `steps.os-*` and `prompts.os-*`. The router loads it with the 10x `policy.json` as one plugin policy (`deepMerge(base, fragment)`), then merges the one project override on top, for both chains alike. ADR-013 Amendment 1 rewords Consequence `:141` from "one policy" to "one merged plugin policy from two files with disjoint keys, one override file", and records the folder contents of `skills/openspec-pipeline/`. `:35` (the skill carries no router copy) stays true.
5. **Order against the open changes.** Run this change alone, after wave 3 (merged in 1.8.0) and before wave 4. Every colliding change is still `new` without a plan, so retargeting costs only `change.md` text. Going later would force rebases over planned work. It overlaps `ci.yml` (the wave-4 `ci-scratch-in-runner-temp` lane), `state.mjs` (wave 4 `run-state-atomic-writes`), the prompt assembly (wave 6 `step-prompt-by-file`), `prompts/README.md`, `REFERENCE.md` and ADRs (wave 6 `docs-drift-fixes`), ADR-018 (wave 6 `nested-subagent-hard-stop`), `openspec-contract.test.mjs` (wave 5 `ci-fail-on-unexpected-skips`) and both `SKILL.md` (wave 7 `skill-md-context-diet`). Four more `new` changes without a plan name a moved path or a re-pinned rule: `tests-strip-git-env` (the OpenSpec tests), `agent-call-parameters` (`openspec-skill.test.mjs`), `delete-guard-gaps` (`no-recursive-delete.test.mjs`, which pins suffix rules) and `coverage-and-failed-undo-test` (the `ci.yml` test command). `step-subagent-git-guard` runs after this change and puts its bans in `rules/top.md`. The owner records the order in `WAVES.md` on `main` (Manual row 3.7).

## Critical Implementation Details

- **Assembly order and the `RESULT:` line.** The `RESULT:` format moves from the suffix to the end of `rules/top.md`, and `top.md` is always the last part of the prompt, so the reply contract still closes every prompt. An override that keeps the old full suffix text then carries the `RESULT:` block twice; that is harmless and is noted in `docs/REFERENCE.md`.
- **Rendering.** The step file, the chain file and `prompts.chain-*` are rendered with the same `vars` as the template at the run site, and with `{ id }` only at the archive site. `top.md` is not rendered, because `render` would blank any `{word}` in a file that nothing may change. `prompts.suffix` stays unrendered (`NARROW_PLACEHOLDERS.suffix: []`). Add `chain-10x` and `chain-openspec` to `NARROW_PLACEHOLDERS` with `["id"]`, because the archive site fills only `id`. A static test keeps the rule files within the same limits: `top.md` without placeholders, `chain.md` within `["id"]`, step files within `PROMPT_PLACEHOLDERS` (within `["id"]` for `archive` and `os-archive`).
- **Step file lookup.** Build `rules/steps/<step>.md` only from a step name matching `^[a-z0-9][a-z0-9-]*$`; any other name reads as no file. Step names can come from an override.

## Phase 1: Move the OpenSpec definitions into skills/openspec-pipeline

### Overview

Every OpenSpec-only definition moves to `skills/openspec-pipeline/`. Prompts, steps, routing and every returned prompt stay byte-identical. Nothing new is visible to a user except the new reference form.

### Changes Required:

#### 1. Plugin policy from two files

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Load the OpenSpec policy fragment together with the 10x policy, so the merged policy holds the `os-*` keys as before, and expose the plugin policy without the project override for tests.

**Contract**: New `export const OPENSPEC_DIR = path.resolve(SKILL_DIR, "../openspec-pipeline")`. New `export function pluginPolicy()` returns `deepMerge(<10x policy.json>, <openspec policy.json>)`, or `null` when either file is unreadable or not an object. `mergedPolicy()` uses it as its base; the halt text of `loadPolicy` names the file that could not be read. The `readJson(path.join(SKILL_DIR, "policy.json"))` fallbacks at `state.mjs:662` and `open-pr.mjs:38` stay (they read keys only the 10x file holds).

#### 2. OpenSpec policy fragment

**Files**: `skills/10x-pipeline/policy.json`, new `skills/openspec-pipeline/policy.json`

**Intent**: Move `steps.os-propose`, `os-apply`, `os-verify`, `os-archive` and `prompts.os-propose`, `os-apply`, `os-apply-fix`, `os-verify`, `os-archive` out of the 10x file into the fragment, unchanged except the references.

**Contract**: The fragment is `{ "steps": { ...four os- steps }, "prompts": { ...five os- prompts } }`. Each `@prompts/os-<x>.md` part becomes `@openspec-pipeline/prompts/os-<x>.md`. No key of the fragment exists in the 10x file (test below).

#### 3. Second reference form

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Let a prompt part name a prompt file of another skill folder of this plugin.

**Contract**: `PROMPT_REF` accepts `@prompts/<file>.md` (resolved under `SKILL_DIR/prompts/`) and `@<skill>/prompts/<file>.md` (resolved under `path.join(SKILL_DIR, "..", skill, "prompts")`). Reference detection: a part starting with `@prompts/` or matching `^@[a-z0-9][a-z0-9-]*\/prompts\/`; a detected part that fails `PROMPT_REF` keeps the `bad reference` error, an unreadable one keeps `cannot be read`.

```js
const PROMPT_REF = /^@(?:([a-z0-9][a-z0-9-]*)\/)?prompts\/([A-Za-z0-9._-]+\.md)$/;
```

#### 4. Prompt files and the module

**Files**: `git mv skills/10x-pipeline/prompts/os-{propose,apply,verify,archive}.md skills/openspec-pipeline/prompts/`; `git mv skills/10x-pipeline/scripts/openspec.mjs skills/openspec-pipeline/scripts/openspec.mjs`

**Intent**: Move the files with their bytes unchanged (the prompt files are 100% renames); fix only the import paths.

**Contract**: `openspec.mjs` imports from `../../10x-pipeline/scripts/state.mjs`; `flow.mjs:14`, `isolation.mjs:10` and `route.mjs:30` import from `../../openspec-pipeline/scripts/openspec.mjs`. The module import order of `AGENTS.md` (Coding Style) is unchanged: `openspec.mjs` still imports only `state.mjs`.

#### 5. Tests and CI

**Files**: `git mv` of `skills/10x-pipeline/test/openspec-{archive,chain,contract,isolation,readers,skill,steps}.test.mjs` and `openspec-helpers.mjs` to `skills/openspec-pipeline/test/`; the seven shared tests that import the helper; `.github/workflows/ci.yml:39`; new `skills/openspec-pipeline/test/README.md`; `skills/10x-pipeline/test/README.md`

**Intent**: The OpenSpec tests live with the chain and still run in CI. Shared 10x tests import the helper from its new place.

**Contract**:
- Moved tests import `../../10x-pipeline/test/helpers.mjs` and `../scripts/openspec.mjs`; their `SKILL_DIR`-based reads of `policy.json` and `prompts/` point to `pluginPolicy()` and to the OpenSpec `prompts/` folder.
- `late-usage`, `route`, `pr-comment-flag`, `neutral`, `change-status`, `run-lock` and `cost` tests import `../../openspec-pipeline/test/openspec-helpers.mjs`.
- Tests that read `policy.json` directly and need `os-*` keys use `pluginPolicy()`, among them `rules.test.mjs` (the rule-form check covers both policy files and both `prompts/` folders), `cost.test.mjs` and `archive.test.mjs:622-629`, whose override becomes `@openspec-pipeline/prompts/os-archive.md`.
- The CI command and the `AGENTS.md` Commands line become `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- The OpenSpec group of the 10x test README moves to the new README, and the 10x README points to it.
- New cases (in `rules.test.mjs` or a moved OpenSpec test): the two policy files share no key under `steps` or `prompts`; every `@...` part of both files resolves; the resolver accepts `@openspec-pipeline/prompts/os-apply.md`, rejects `@../x/prompts/a.md`, `@Open/prompts/a.md` and `@openspec-pipeline/prompts/../a.md`, and halts with `cannot be read` on `@no-such-skill/prompts/a.md`.

#### 6. Path docs that tests or readers rely on

**Files**: `AGENTS.md` (Hard Rules: routing and log ownership name `skills/openspec-pipeline/scripts/openspec.mjs` and `skills/openspec-pipeline/policy.json`; Commands; Coding Style module list and the `decideOpenspec` line; Layout), `README.md` (layout block), `skills/10x-pipeline/prompts/README.md` (os rows leave; reference forms), new `skills/openspec-pipeline/prompts/README.md` (the four os rows), `skills/openspec-pipeline/SKILL.md` `## Tuning` (the chain's steps and prompts live in `${CLAUDE_SKILL_DIR}/policy.json`, merged with the shared `${CLAUDE_SKILL_DIR}/../10x-pipeline/policy.json`), `docs/REFERENCE.md` OpenSpec section paths and the reference rule at `:229`, `openspec/config.yaml:9,19,24`.

**Intent**: No doc names a moved path at its old place.

**Contract**: Pure prose. Keep every test-pinned `AGENTS.md` phrase (`advisor.test.mjs:596`, `pr-comment.test.mjs:804`, `no-recursive-delete.test.mjs:141,256`) or re-pin it in the same commit.

### Success Criteria:

#### Automated Verification:

- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No OpenSpec file is left in the 10x folder: `ls skills/10x-pipeline/prompts skills/10x-pipeline/scripts skills/10x-pipeline/test | grep -iE '^os-|openspec'` prints nothing
- No `os-` key is left in the 10x policy: `node -e 'const p=require("./skills/10x-pipeline/policy.json");process.exit(Object.keys({...p.steps,...p.prompts}).some(k=>k.startsWith("os-"))?1:0)'` exits 0
- The four prompt files moved byte for byte, checked at the Phase 1 commit because Phase 2 edits them: `git diff -M --name-status b79777b..HEAD -- skills | grep -c '^R100.*prompts/os-'` prints 4
- CI runs the moved tests: `grep -n 'skills/openspec-pipeline/test/\*.test.mjs' .github/workflows/ci.yml AGENTS.md` matches both files
- The new resolver and fragment tests pass (disjoint keys, every reference resolves, the accepted and rejected forms listed above)
- The OpenSpec smoke check of `AGENTS.md` (scratch project with `openspec/config.yaml`, `openspec/changes/demo/` and `isolation.require: false`) returns `action: "run"` with step `os-propose` from `init demo --chain openspec --goal "x"`
- No doc names an old path: `git grep -nE '10x-pipeline/(prompts/os-|scripts/openspec\.mjs|test/openspec-)' -- AGENTS.md README.md docs/REFERENCE.md skills openspec/config.yaml .github` prints nothing

#### Manual Verification:

- At the end of Phase 1, before Phase 2 edits the os prompt files, an OpenSpec run prompt returned by `init --chain openspec` reads the same as before the move (spot-check the `os-propose` prompt against the text of `git show b79777b:skills/10x-pipeline/prompts/os-propose.md`)

---

## Phase 2: Rule levels in the router and the prompts

### Overview

The router appends the level defaults and the always-true block to every step prompt, both at the run site and at the archive site. The level-1 invariants leave the overridable suffix, and the duplicated level-2 and level-3 rules collapse into one file each.

### Changes Required:

#### 1. Rule tail builder

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: One function builds everything after the template and the advisor, so both assembly sites order the levels the same way.

**Contract**: `export function ruleTail(policy, { chain, step, vars, dirs })` returns `"\n\n"`-joined parts, empty parts skipped:
1. `render(promptText(policy, "chain-" + chain), vars)` when that key exists;
2. `promptText(policy, "suffix")`, unrendered;
3. the always-true files: `<chainDir>/rules/steps/<step>.md` and `<chainDir>/rules/chain.md`, rendered (each optional, ENOENT reads as none), then `<SKILL_DIR>/rules/top.md`, unrendered like the suffix (required; unreadable throws `Error("skills/10x-pipeline/rules/top.md cannot be read")`).

`dirs` defaults to `{ "10x": SKILL_DIR, openspec: OPENSPEC_DIR }` and exists so tests can point at a scratch tree. `checkPrompts` also reads `rules/top.md`, `rules/chain.md` of both chains and `rules/steps/<step>.md` for every step name of `policy.steps`, through the same reader. A rule file that exists but cannot be read (permission error, a folder in its place) throws with its path, so a broken install halts before `next` consumes the result file instead of in the middle of prompt assembly.

#### 2. Both assembly sites

**Files**: `skills/10x-pipeline/scripts/route.mjs:193-199`, `skills/10x-pipeline/scripts/isolation.mjs:696-697`

**Intent**: Replace `"\n\n" + promptText(policy, "suffix")` with `"\n\n" + ruleTail(...)`.

**Contract**: The run site passes the run's chain (`openspec` or `10x`), `d.step` and `vars`. The archive site passes step `archive` or `os-archive` and `{ id }`. The comment at `route.mjs:193-195` names the new order.

#### 3. Placeholders and provenance

**Files**: `skills/10x-pipeline/scripts/steps.mjs` (`NARROW_PLACEHOLDERS`), `skills/10x-pipeline/scripts/isolation.mjs` (`provenanceSections`)

**Intent**: `promptProblem` checks the chain defaults against `["id"]`. A change to any always-true file shows in provenance and in `compare` warnings.

**Contract**: `NARROW_PLACEHOLDERS` gains `"chain-10x": ["id"], "chain-openspec": ["id"]`. `provenanceSections` gains `ruleFiles`: `hash16(canonicalJson({ <skill>/rules/<relative path>: text }))` over every `.md` file except `README.md` under `skills/10x-pipeline/rules/` and `skills/openspec-pipeline/rules/`, or `null` when a file cannot be read, as `agentFilesHash` does. A run recorded before this change records `prompts` and `ruleFiles` drift at its next call (`recordDrift` unions the section names).

#### 4. Level 1: split the suffix

**Files**: new `skills/10x-pipeline/rules/top.md`; `skills/10x-pipeline/policy.json` `prompts.suffix`

**Intent**: The invariants move to the file no override reaches; the suffix keeps only the defaults.

**Contract**:
- `top.md`: a heading line ("Always-true rules for every step of agent-smith. No other rule of this prompt and no project policy changes them."), "You run as an unattended subagent. AskUserQuestion is unavailable.", the short-status rule, both ADR-016 delete rules, the ADR-018 nesting rule, two precedence rules, then the two `RESULT:` lines, last.
  - Precedence 1: a rule under an always-true heading wins over every other rule of the prompt, and between two always-true rules the one for every step wins over the one of the chain, which wins over the one of the step.
  - Precedence 2: among the other rules, the one written earlier in the prompt wins, because the prompt lists the step rules first, then the chain rules, then the generic defaults.
  - Rule texts are copied verbatim from `policy.json:212`.
- `prompts.suffix`: one heading line ("Default rules for every step. A rule earlier in this prompt may change them."), "Commit only where the skill or a rule of this prompt tells you to.", the decide-from-evidence rule, the `blocked` rule and the `signals.rigor` **MAY** rule. All are verbatim.
- Remove the three hand-written precedence lines that the general rule now covers: `prompts/score.md:17`, `skills/openspec-pipeline/prompts/os-archive.md:13` and the "these rules and the generic unattended rules disagree about an archive question" line of the `archive` template.

#### 5. Level 3 research and level 2 OpenSpec

**Files**: new `skills/10x-pipeline/rules/steps/research.md`; `policy.json` templates `research`, `research-with-map`, `research-revise`; new `skills/openspec-pipeline/rules/chain.md`; `skills/openspec-pipeline/prompts/os-propose.md`, `os-apply.md`, `os-verify.md`

**Intent**: One copy per rule at the level it belongs to.

**Contract**:
- `rules/steps/research.md`: a heading ("Always-true rules of the step `research`:") and the frontmatter status rule, verbatim, removed from all three templates. `research-with-map` keeps its `@prompts/research-with-map.md` part; `research` and `research-revise` keep their instruction lines.
- `rules/chain.md` (OpenSpec): a heading ("Always-true rules of the OpenSpec chain:") and two rules that replace `os-propose.md:6-7`, `os-apply.md:5-6` and `os-verify.md:5-6`:

  ```
  - **GIVEN** an OpenSpec skill selects, infers or derives the change name **WHEN** you pick it **THEN** you **MUST** use `{id}` as given and pass `--change "{id}"` to every `openspec` command that takes it.
  - **GIVEN** an `openspec` command accepts `--store` **WHEN** you run it **THEN** you **MUST NOT** pass `--store`, because the run covers only a change inside this project's `openspec/changes/`.
  ```

#### 6. Index and tests

**Files**: new `skills/10x-pipeline/rules/README.md`; new `skills/10x-pipeline/test/rule-levels.test.mjs`; re-pins in `nested-subagents`, `no-recursive-delete`, `rules`, `advisor`, `executors`, `preplan`, `score`, `archive`, `isolation` and the moved OpenSpec tests; `skills/10x-pipeline/test/README.md` row

**Intent**: The README states the level table of the Approach and lists every rule file of both skills. Content tests pin each moved rule to its new single home, so a later edit cannot drop it.

**Contract**: `rule-levels.test.mjs` covers:
- (a) the order of a returned 10x and OpenSpec run prompt: template, then chain defaults (set by override), then suffix, then step file, then chain file, then `top.md`. The prompt ends with the `RESULT:` line.
- (b) an override of `prompts.suffix` replaces the defaults and leaves every line of `top.md` in the prompt.
- (c) `ruleTail` with a scratch `dirs` tree reads `steps/<step>.md` and `chain.md` for both chains, and skips a missing file and a step name like `../x`.
- (d) a missing `top.md` (scratch `dirs`) throws, and `checkPrompts` turns it into the halt; so does an unreadable `chain.md` (a folder in its place).
- (e) the `archive` and `os-archive` prompts end with `top.md`.
- (f) the placeholder limits of the rule files.
- (g) the `ruleFiles` provenance section exists and changes when a rule file changes.
- (h) `top.md`, `chain.md` and the step files pass `lineProblems(…, { strict: true })`, and `rules.test.mjs` scans `skills/*/rules/*.md` and `skills/*/rules/steps/*.md`; `top.md` holds both precedence rules, the higher-level-wins clause included.

### Success Criteria:

#### Automated Verification:

- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `rule-levels.test.mjs` passes with cases (a) to (h)
- The suffix holds no invariant: `node -e 'const s=require("./skills/10x-pipeline/policy.json").prompts.suffix;process.exit(/Agent tool|rm -rf|RESULT:|AskUserQuestion/.test(s)?1:0)'` exits 0
- Each moved rule has one home: `grep -c "status: complete or status: partial" skills/10x-pipeline/policy.json` prints 0 and `skills/10x-pipeline/rules/steps/research.md` holds it once; `grep -l -- "--store" skills/openspec-pipeline/prompts/*.md` prints nothing and `skills/openspec-pipeline/rules/chain.md` holds it once
- No hand-written precedence is left: `grep -rn "generic unattended rules" skills` prints nothing
- The smoke checks of `AGENTS.md` for both chains return `action: "run"`, and each returned `prompt` ends with the `RESULT:` line of `rules/top.md`

#### Manual Verification:

- The owner reads `skills/10x-pipeline/rules/top.md` against `prompts.suffix` and agrees with the always-true versus default split of the former suffix lines

---

## Phase 3: Decisions and the doc sweep

### Overview

Record the hierarchy and the folder split as decisions, and leave no doc that describes the old suffix contents or the old paths.

### Changes Required:

#### 1. ADR-023

**File**: new `docs/ADR/ADR-023-layered-rules.md`; row in `docs/ADR/README.md`

**Intent**: The decision of record for the three levels and two categories.

**Contract**: Sections Context, Decision, Consequences, Sources, as in ADR-022. Decision rules in ADR-004 form, covering:
- where each cell lives (the table of the Approach);
- the binding (files outside the merge, read by fixed path; missing `top.md` halts);
- the prompt order and the two precedence rules;
- step files keyed by step;
- the reference forms;
- `ruleFiles` provenance;
- the orchestrator mapping (Anti-stall, `## Rules`, `## Tuning`);
- `AGENTS.md` outside the runtime hierarchy.

Consequences:
- empty cells;
- an override can no longer drop the ADR-016 and ADR-018 rules;
- a suffix override that copies the old text repeats the `RESULT:` block;
- in-flight runs record `prompts` and `ruleFiles` drift.

#### 2. ADR-013 Amendment 1 and the carrier notes

**Files**: `docs/ADR/ADR-013-openspec-pipeline.md`, `docs/ADR/ADR-016-no-recursive-force-delete.md`, `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/README.md` rows

**Intent**: ADR-013 gains "## Amendment 1: the chain's definitions live in its skill folder (change proper-structure-of-rules)", in the style of ADR-008's amendments. It covers the folder contents, the fragment merged at load before the one override file, the reworded Consequence `:141`, the `@<skill>/prompts/` form, and the CI glob. ADR-016 `:25` and ADR-018 `:24` each get one amendment line: the rules now live in `skills/10x-pipeline/rules/top.md` (ADR-023), and the prompt still carries them.

**Contract**: Keep every rule line in ADR-004 form; `rules.test.mjs` checks ADR rule lines.

#### 3. Reference and remaining docs

**Files**: `docs/REFERENCE.md` (new subsection "Rule levels" next to the prompt overrides at `:229`; `:328` advisor placement; `:344` and `:348` where the delete and nesting rules live; `:381` the narrow placeholder list), `skills/10x-pipeline/prompts/README.md` (the paragraph that says the suffix carries the ADR-016 and ADR-018 rules), `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md` `## Tuning` (one line each: always-true step rules live in `rules/`, and no override reaches them), `AGENTS.md` Layout (`rules/` folders), `README.md` layout block

**Intent**: Every doc describes the new assembly and carriers. Upgrade notes go to `docs/REFERENCE.md`:
- `@prompts/os-*.md` in an override now halts, and the fix is `@openspec-pipeline/prompts/os-*.md`;
- a suffix override now replaces only the defaults;
- in-flight runs record drift.

**Contract**: Pure prose; apply `lessons.md` "grep every doc" with the commands below.

### Success Criteria:

#### Automated Verification:

- The full suite passes, the ADR rule-form check included: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- ADR-023 exists and is indexed: `ls docs/ADR/ADR-023-*.md && grep -c "ADR-023" docs/ADR/README.md`
- ADR-013 carries the amendment: `grep -n "^## Amendment 1" docs/ADR/ADR-013-openspec-pipeline.md`
- No doc says the suffix carries the delete, nesting or RESULT rules: `git grep -nE "suffix (carries|holds)|in \`prompts.suffix\`" -- AGENTS.md README.md docs/REFERENCE.md skills` prints only lines that describe the defaults
- `node tools/version-check.mjs` exits 0

#### Manual Verification:

- The plugin installed from this branch runs: in a scratch OpenSpec project, `/agent-smith:openspec-pipeline demo` reaches its first step with a prompt that ends with the `rules/top.md` rules, and `/agent-smith:10x-pipeline` does the same in a scratch 10x project
- After the merge, the owner records in `context/changes/WAVES.md` on `main` that this change ran before wave 4. The owner also notes the moved paths in the `change.md` files of `ci-fail-on-unexpected-skips`, `docs-drift-fixes`, `step-prompt-by-file`, `nested-subagent-hard-stop`, `tests-strip-git-env`, `agent-call-parameters`, `delete-guard-gaps`, `coverage-and-failed-undo-test` and `step-subagent-git-guard`, the last with `rules/top.md` as its carrier

---

## Testing Strategy

### Unit Tests:

- `ruleTail` with an injected `dirs` tree: every cell, the optional files, a bad step name, the missing top file.
- The resolver: both forms, rejected forms, an unreadable file.
- `pluginPolicy`: disjoint keys, an unreadable fragment returns `null`.

### Integration Tests:

- Router CLI in scratch projects (existing helpers): a 10x run prompt, an OpenSpec run prompt, the archive prompts of both chains, a suffix override, a `prompts.chain-openspec` override, a missing `rules/top.md` (scratch copy of the router tree is not needed: use `dirs` injection for that case and the CLI for the rest).
- The moved OpenSpec suite unchanged in behavior.

### Manual Testing Steps:

1. Install the plugin from the branch and run the OpenSpec smoke run (Manual row 3.6).
2. Read `top.md` against the suffix (Manual row 2.7).

## Performance Considerations

Each prompt gains the heading lines and the two precedence rules, a few hundred bytes. The research and OpenSpec prompts lose their duplicate lines. The router reads up to three more small files per step.

## Migration Notes

- Project overrides keep working. A `prompts.suffix` override now replaces only the defaults.
- An override that references `@prompts/os-*.md` halts at `init` or `next` with "cannot be read". The fix is `@openspec-pipeline/prompts/os-*.md`, and `docs/REFERENCE.md` says so.
- In-flight runs record `prompts` and `ruleFiles` drift at their next call.

## References

- Research: `context/changes/proper-structure-of-rules/research.md`
- Prompt assembly: `skills/10x-pipeline/scripts/route.mjs:193-199`, `skills/10x-pipeline/scripts/isolation.mjs:696-697`
- Resolver and checks: `skills/10x-pipeline/scripts/flow.mjs:788-845`
- Policy load: `skills/10x-pipeline/scripts/state.mjs:37-72`
- Provenance: `skills/10x-pipeline/scripts/isolation.mjs:42-120`
- Decisions: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, `ADR-013-openspec-pipeline.md:35,141`, `ADR-016-no-recursive-force-delete.md:25`, `ADR-018-no-nested-subagents.md:24`, `ADR-022-policy-validation-at-load.md`
- Order: `context/changes/WAVES.md`, `context/changes/step-subagent-git-guard/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Move the OpenSpec definitions into skills/openspec-pipeline

#### Automated

- [x] 1.1 The full suite passes over both test folders and tools
- [x] 1.2 No OpenSpec file is left in the 10x prompts, scripts or test folders
- [x] 1.3 No os- key is left in the 10x policy
- [ ] 1.4 The four os prompt files moved byte for byte (R100)
- [x] 1.5 CI and AGENTS.md run the moved tests
- [x] 1.6 The new resolver and fragment tests pass
- [x] 1.7 The OpenSpec smoke check returns action run with step os-propose
- [x] 1.8 No doc names an old OpenSpec path

#### Manual

- [ ] 1.9 An OpenSpec run prompt reads the same as before the move

### Phase 2: Rule levels in the router and the prompts

#### Automated

- [ ] 2.1 The full suite passes over both test folders and tools
- [ ] 2.2 rule-levels.test.mjs passes with cases (a) to (h)
- [ ] 2.3 The suffix holds no invariant
- [ ] 2.4 Each moved rule has one home
- [ ] 2.5 No hand-written precedence is left
- [ ] 2.6 The smoke checks of both chains return action run and each prompt ends with the RESULT line of rules/top.md

#### Manual

- [ ] 2.7 The owner agrees with the always-true versus default split of the former suffix lines

### Phase 3: Decisions and the doc sweep

#### Automated

- [ ] 3.1 The full suite passes, the ADR rule-form check included
- [ ] 3.2 ADR-023 exists and is indexed
- [ ] 3.3 ADR-013 carries Amendment 1
- [ ] 3.4 No doc says the suffix carries the delete, nesting or RESULT rules
- [ ] 3.5 version-check exits 0

#### Manual

- [ ] 3.6 The plugin installed from this branch runs both chains with prompts that end with the rules/top.md rules
- [ ] 3.7 The owner records the order in WAVES.md on main and notes the moved paths in the open changes
