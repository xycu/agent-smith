# Explicit Pipeline Invocation Implementation Plan

## Overview

Require explicit user invocation of both pipeline skills through Claude Code slash commands. Set `disable-model-invocation: true`, describe that entry point consistently, and cover the shipped frontmatter with the existing content tests.

The owner selected slash commands in the run goal. This plan records that decision and the compatibility evidence needed to implement it in Wave 5.

## Current State Analysis

- Both skills advertise plain-language triggers and omit the invocation-control key. Their public names and argument hints already provide the intended slash-command interface. See `skills/10x-pipeline/SKILL.md:1` and `skills/openspec-pipeline/SKILL.md:1`.
- The plugin manifest and marketplace plugin entry have different descriptions. Align the two plugin descriptions with the README introduction while conveying the explicit entry point. The marketplace-level metadata describes the marketplace itself. See `.claude-plugin/plugin.json:6`, `.claude-plugin/marketplace.json:7`, `.claude-plugin/marketplace.json:14` and `README.md:7`.
- The 10x content test loads a configurable `SKILL_PATH`. The OpenSpec test loads `OPENSPEC_SKILL_PATH` and already parses the first frontmatter block. These seams support deliberate-break verification using copies. See `skills/10x-pipeline/test/skill-loop.test.mjs:3`, `skills/openspec-pipeline/test/openspec-skill.test.mjs:15` and `skills/openspec-pipeline/test/openspec-skill.test.mjs:41`.
- The existing two-file baseline passes 49 tests with zero skips on Node v24.19.0. The installed Claude Code reports 2.1.311. Planning exercised the content tests and CLI version reporting. Live invocation acceptance remains pending.
- A scoped repository search across `skills/`, `agents/`, `tools/`, `.claude/`, `.github/`, the manifests, README, docs and active change briefs found documented slash-command usage and headless caveats. It found no repository-owned executable Skill-tool caller or `/loop` automation starting either pipeline. Historical archives were excluded from this caller inventory.
- Wave 5 assigns this change both frontmatter descriptions, the new key and manifest descriptions. README and the two content tests are shared files with region-level edits. The stale-copy final-message paragraph belongs to `stale-main-change-copy`. See `context/changes/WAVES.md:11` and `context/changes/WAVES.md:99`.
- `context/foundation/roadmap.md` exists and has no item with this Change ID. Planning metadata belongs in this change folder.

## Desired End State

Both installed pipeline skills carry the unquoted YAML boolean `disable-model-invocation: true`. Their descriptions identify the chain, purpose and explicit command. Users can select `/agent-smith:10x-pipeline` and `/agent-smith:openspec-pipeline` directly in Claude Code.

Both plugin descriptions agree exactly, and the README introduction communicates the same product and explicit invocation contract. A short README subsection near Quick start records the following supported invocation behavior, with source links and a distinction between documented behavior and observed acceptance evidence.

| Entry point | Documented behavior | Evidence |
| --- | --- | --- |
| Direct `/agent-smith:10x-pipeline <change-id>` | User invocation loads the skill with the flag enabled. | Anthropic skills invocation-control table |
| Direct `/agent-smith:openspec-pipeline <change-name>` | User invocation loads the skill with the flag enabled. | Anthropic skills invocation-control table |
| Plain-language requests such as `pipeline this change` | Automatic loading is disabled and the description is absent from model context. | Anthropic skills invocation-control section |
| `claude -p "/agent-smith:10x-pipeline <change-id>"` and the OpenSpec equivalent | User-invoked skill commands expand in print mode. Current documentation describes waiting for background work subject to an idle ceiling. Full pipeline completion requires version-specific live evidence. | Anthropic headless command-support and background-tasks-at-exit sections |
| `/loop 5m /agent-smith:10x-pipeline <change-id>` and the OpenSpec equivalent | A scheduled fire delivers the disabled skill prompt as plain text. Automatic skill expansion is disabled. | Anthropic scheduled-tasks documentation |
| Another skill calling either pipeline through the Skill tool | Calls require explicit authorization through the matching slash command in the current user message. A separate command word after prose permits Claude to call the skill. A command at the start invokes it directly. | Anthropic invocation-control and command-placement sections |

Scope these enforcement claims to Claude Code. The README also documents Codex skill-picker selection, and Anthropic identifies invocation control as a Claude Code extension. Cross-host enforcement claims need host-specific evidence.

### Key Discoveries

- Claude Code owns invocation gating before the orchestrator loads. The native frontmatter field is the responsible layer. [Skills frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
- The control preserves direct user invocation and removes automatic discovery by the model. [Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- Current official documentation explicitly supports user-invoked skills in `claude -p` prompts. This settles the brief’s headless-entry-point question at the documentation level. [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- Current headless documentation describes background-work waiting. The prediction of immediate exit in `docs/REFERENCE.md:421` is an older, explicitly unverified hypothesis. README guidance must identify that provenance and use current official documentation for present host behavior. Version-specific end-to-end acceptance remains pending. [Background tasks at exit](https://code.claude.com/docs/en/headless#background-tasks-at-exit)
- `/loop` scheduled fires honor `disable-model-invocation` and deliver such prompts as plain text. [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop)

## Scope Boundaries

Implementation owns these seven files and regions.

| File | Owned region |
| --- | --- |
| `skills/10x-pipeline/SKILL.md` | Folded `description` value and the new frontmatter key |
| `skills/openspec-pipeline/SKILL.md` | Folded `description` value and the new frontmatter key |
| `.claude-plugin/plugin.json` | Plugin `description` |
| `.claude-plugin/marketplace.json` | `plugins[0].description` |
| `README.md` | Introduction and a short invocation subsection near Quick start |
| `skills/10x-pipeline/test/skill-loop.test.mjs` | Frontmatter and description contract assertions |
| `skills/openspec-pipeline/test/openspec-skill.test.mjs` | Existing frontmatter test and closely related assertions |

The skill-body bytes, existing frontmatter fields, manifest identity/version fields, routing modules, policy and sibling-owned test regions form the preservation boundary. `WAVES.md` and `context/archive/` are protected paths. Router-owned run logs and metadata retain their existing ownership.

## Implementation Approach

Use one cohesive implementation phase because the feature consists of native configuration, public descriptions and their contract checks. Add focused assertions to the existing test files and use their environment overrides for deliberate-break checks. Publish compatibility guidance in the README alongside the commands users run.

### Assumptions and Decisions

- Complexity is low and one phase is sufficient. The goal settles the product choice, the responsible native field exists, and the current tests provide the required seams. The unattended-run instruction supplies evidence-based decisions in place of the skill’s interview and phase-approval questions.
- The owner’s explicit slash-command choice settles the brief’s decision branch. Record the rationale in the plan and README invocation guidance using the existing frontmatter capability.
- Align the plugin manifest and marketplace plugin-entry descriptions exactly. Align the README and chain-specific skill descriptions semantically, including explicit invocation. Each skill retains its own name and chain purpose, and marketplace metadata retains its marketplace purpose. Evidence comes from the repository’s Hard Rules and Layout guidance.
- Preserve default user invocation by retaining the current frontmatter fields. The official reference defines `user-invocable` as true by default.
- Explicit user invocation includes a matching slash command written as a separate word after prose in the current message. That permits a Skill-tool call for that message. Integrations that only name the pipeline inside another skill's body need the user-command entry point. [Where you write the skill's name](https://code.claude.com/docs/en/skills#where-you-write-the-skills-name)
- Documentation retrieved on 2026-11-14 establishes the compatibility matrix. Live behavior on the repository’s minimum supported Claude Code 2.1.292 remains an acceptance risk. Record the actual host version whenever live evidence is obtained.
- Put invocation guidance and authoritative links in README. Its shared-file ownership permits this addition, and the existing reference already records the headless completion caveat.

## Phase 1: Enforce Explicit Invocation and Align Public Guidance

### Overview

Ship the native invocation controls, user-facing descriptions, compatibility guidance and regression assertions together.

### Changes Required

#### 1. Skill frontmatter

**Files** `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`

**Intent** Require a deliberate user command before loading either side-effecting pipeline. Replace the discovery-oriented trigger wording with a concise description for someone selecting a slash command.

**Contract** Each first YAML frontmatter block contains exactly one unquoted `disable-model-invocation: true` field. Descriptions identify the matching namespaced command and chain. Existing `name`, `argument-hint`, `allowed-tools` and body content retain their bytes. Use folded descriptions consistent with the current format.

#### 2. Plugin descriptions

**Files** `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`

**Intent** Present the explicit command entry point consistently wherever the plugin is listed.

**Contract** `plugin.json.description` equals `marketplace.json.plugins[0].description`. The text names 10xDevs and OpenSpec, explicit slash commands and per-step model/effort routing. Existing product identity and release-owned fields retain their values.

#### 3. Public invocation guidance

**File** `README.md`

**Intent** Explain how to start the two pipelines and the compatibility impact on headless calls, scheduled prompts and Skill-tool integrations.

**Contract** Align the introduction with the manifest descriptions and add a concise Claude Code invocation subsection near Quick start. Include both existing slash commands, the flag’s purpose, the matrix outcomes above and authoritative source links. Explain the current-user-message authorization condition for Skill-tool integrations. Identify published documentation as evidence and live acceptance as pending until observed. Cite current official headless documentation for background-work waiting and identify the existing reference's immediate-exit prediction as historical and unverified. Preserve the Codex installation/selection guidance and neighboring options content.

#### 4. Frontmatter regression checks

**Files** `skills/10x-pipeline/test/skill-loop.test.mjs` and `skills/openspec-pipeline/test/openspec-skill.test.mjs`

**Intent** Catch a missing, false or malformed invocation flag before release and protect direct user invocation and aligned descriptions.

**Contract** Bound assertions to the first frontmatter block. Reuse OpenSpec’s existing parser and the current file-loading seams. Count top-level `disable-model-invocation` keys in that raw block and require exactly one, then require its unquoted true value. The existing OpenSpec parser overwrites duplicate keys, so parsed-value equality alone leaves the exactly-one contract unproved. Require `user-invocable` to remain absent, preserving the current default. Assert chain identity and explicit command wording without freezing the entire description. Add small manifest-description equality and README invocation-guidance assertions in the existing 10x content test. Preserve all existing checks and environment override behavior.

### Success Criteria

#### Automated Verification

- Both skills pass frontmatter and explicit-command description assertions, including default user invocation, using `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- Deliberate-break copies for each skill fail their corresponding content tests when the key is removed, set to false, quoted as a string, or placed only after the closing frontmatter delimiter, using the existing `SKILL_PATH` and `OPENSPEC_SKILL_PATH` overrides.
- Plugin descriptions are equal, README guidance covers both commands and the supported invocation matrix, and release-owned version fields pass `node tools/version-check.mjs`.
- The full suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, with any skips reported by name and reason.
- The implementation diff stays within the seven-file ownership table and change-local planning/evidence artifacts, the skill bodies and other frontmatter fields match the pre-implementation copies, protected paths have no edits, and `git diff --check` passes.

#### Manual Verification

- In fresh Claude Code sessions using the updated plugin, both explicit slash commands reach their first router-selected run step, and a fresh plain-language request such as `pipeline this change` leaves both pipeline skills uninvoked, with the Claude Code version and observed transcript recorded.

## Testing Strategy

### Contract Tests

Use the existing content-test infrastructure for the positive frontmatter case and description alignment. A string search over the whole document cannot prove a YAML field exists in frontmatter. Reuse the OpenSpec parser, and keep any 10x extraction local to its new assertions.

Create deliberate-break copies inside this worktree under the change folder. Exercise each mutation independently for both skills through the existing environment variables. In addition to the four mutations in row 1.2, cover duplicate invocation keys with two true values and conflicting true/false values in both orders. These cases prove the exactly-one contract in row 1.1. Also insert `user-invocable: false` to prove the direct-user-invocation guard. Each negative run must fail the invocation assertion specifically. Remove the copies individually after verification and remove their directory when empty.

Run focused tests first, then the version check and full suite. The two-file baseline recorded during planning has 49 passes and zero skips. New assertion counts may increase that total.

### Manual Testing Steps

1. Load or reload the updated plugin in a fresh Claude Code session and record the version.
2. Use a disposable prepared project for each chain and invoke the matching namespaced slash command. Record the first router action with `action: "run"` and a step, plus evidence that the skill loaded. A prerequisite halt alone does not satisfy the acceptance row.
3. In a separate fresh session, use the plain-language request with an existing change. Record that neither pipeline skill is invoked and that pipeline setup/state has no new writes.
4. Save the relevant observations in this change folder’s `evidence/` directory. The single Manual row requires all these checks for both chains.

The headless, scheduled-fire and Skill-tool compatibility statements use the official sources below. Record the tested host version with any live result. A live full-pipeline headless success claim requires a completed run transcript proving that the orchestrator consumed each completion. The older immediate-exit hypothesis in the existing reference supplies historical context, while current host waiting behavior comes from the official headless documentation.

## Performance Considerations

Claude Code evaluates the native frontmatter policy at skill selection. This feature adds configuration and content checks at that boundary.

## Migration Notes

Consumers currently starting a pipeline through another skill’s Skill-tool call need the matching slash command in the current user message. Starting the message with that command invokes it directly, and placing it after prose as a separate word permits Claude to invoke it for that message. Users scheduling pipeline skills through `/loop` receive the documented plain-text prompt behavior at scheduled fire time. Direct `claude -p` slash-command expansion and background-work waiting are documented by Anthropic. Version-specific pipeline completion still requires a recorded end-to-end run.

Reload the updated plugin before acceptance. A normal follow-up commit can restore earlier invocation behavior if the owner changes the product decision.

## References

- Change brief and acceptance request in `context/changes/skills-disable-model-invocation/change.md`.
- Ownership and shared-file rules in `context/changes/WAVES.md:11` and `context/changes/WAVES.md:99`.
- Content-test seams in `skills/10x-pipeline/test/skill-loop.test.mjs:3` and `skills/openspec-pipeline/test/openspec-skill.test.mjs:41`.
- Public command examples and minimum Claude Code version in `README.md:30` and `README.md:42`.
- Existing headless execution caveat in `docs/REFERENCE.md:421`.
- Anthropic frontmatter ownership and direct invocation guidance, retrieved 2026-11-14. [Skills](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- Anthropic Skill-tool access guidance, retrieved 2026-11-14. [Restrict Claude’s skill access](https://code.claude.com/docs/en/skills#restrict-claudes-skill-access)
- Anthropic current-message command authorization, retrieved 2026-11-14. [Where you write the skill's name](https://code.claude.com/docs/en/skills#where-you-write-the-skills-name)
- Anthropic print-mode command expansion guidance, retrieved 2026-11-14. [Headless mode](https://code.claude.com/docs/en/headless)
- Anthropic current print-mode waiting behavior, retrieved 2026-11-14. [Background tasks at exit](https://code.claude.com/docs/en/headless#background-tasks-at-exit)
- Anthropic scheduled-fire behavior, retrieved 2026-11-14. [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop)

## Progress

### Phase 1: Enforce Explicit Invocation and Align Public Guidance

#### Automated

- [ ] 1.1 Both skills pass frontmatter and explicit-command description assertions, including default user invocation, using `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`.
- [ ] 1.2 Deliberate-break copies for each skill fail their corresponding content tests when the key is removed, set to false, quoted as a string, or placed only after the closing frontmatter delimiter, using the existing `SKILL_PATH` and `OPENSPEC_SKILL_PATH` overrides.
- [ ] 1.3 Plugin descriptions are equal, README guidance covers both commands and the supported invocation matrix, and release-owned version fields pass `node tools/version-check.mjs`.
- [ ] 1.4 The full suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, with any skips reported by name and reason.
- [ ] 1.5 The implementation diff stays within the seven-file ownership table and change-local planning/evidence artifacts, the skill bodies and other frontmatter fields match the pre-implementation copies, protected paths have no edits, and `git diff --check` passes.

#### Manual

- [ ] 1.6 In fresh Claude Code sessions using the updated plugin, both explicit slash commands reach their first router-selected run step, and a fresh plain-language request such as `pipeline this change` leaves both pipeline skills uninvoked, with the Claude Code version and observed transcript recorded.
