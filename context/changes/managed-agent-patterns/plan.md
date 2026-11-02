# Run provenance, tool-restricted step agents and an opt-in advisor Implementation Plan

## Overview

Three patterns from the Managed Agents docs, adapted to the local plugin, as three phases of one change. Phase 1 records what a run ran with (`meta.provenance`) and makes `compare` warn when two arms differ. Phase 2 adds a plugin agent definition with a narrow `tools` list for the `score` step, behind `agents.restricted` (default `false`). Phase 3 adds an opt-in prompt rule that asks `plan` and `implement` to consult the advisor once before finishing, behind `advisor.enabled` (default `false`), plus ADR-009 with its decision rule fixed before any run. Phases 2 and 3 default to off so `compare` can measure each on its own; Phase 1 lands first because both need it.

## Current State Analysis

- `meta.json` is written by `init` (and `next` for rigor and `outcome`). `init` builds `meta = { ...prev, id, goal }`, so a new key survives a resume; `baseSha` is the model for a set-once field (`route.mjs:2609`, `route.mjs:2619-2623`).
- The merged policy (`policy.json` deep-merged with `context/foundation/agent-smith-policy.json`) is loaded once per process (`route.mjs:53-58`). Prompts resolve at the point of use (`promptText`, `route.mjs:1848-1862`), so a policy hash alone would miss an edit to `prompts/*.md`.
- `compare` reads each side's `meta.json` through `readSide` (`route.mjs:2323-2381`) and emits a closed list of warnings (`route.mjs:2438-2448`). Existing tests assert `warnings` equal to `[]` for pairs with no provenance (`test/compare.test.mjs:330`, `:753`), so a pair without provenance on both sides must stay silent.
- The pinned baseline file changes `ladder`, `rigor` and `score` by design (`baseline-policy.json`), and the project override holds `compare.targetDropPercent`. A single whole-policy hash therefore carries no information: the record needs per-section fingerprints.
- The orchestrator hard-codes `subagent_type: general-purpose` (`SKILL.md:43`). The router's `run` output has no field that selects an agent type (`route.mjs:2220-2229`).
- No `agents/` directory exists. The marketplace entry uses `"source": "./"`, so `agents/` at the repository root is the plugin's agent directory (`research.md`, Phase 2).
- The native Claude Code advisor is a server-side tool configured by the user's `advisorModel` setting; a plugin cannot set it and no setting caps or forces its calls (`research.md`, Phase 3). The "spawn depth" risk in `change.md` does not apply to it.

## Desired End State

- `meta.json` of a new run carries `provenance`: plugin version, one hash per merged-policy section (prompts hashed by resolved text), a hash of `agents/*.md`, and the feature flags. A mid-run edit is recorded as `drift`.
- `compare` warns, in the existing closed-list style, when two arms differ in provenance outside the sections the comparison expects to differ, and stays silent for two legacy sides.
- With `agents.restricted: true` the router returns `agent: "agent-smith:score"` for the `score` step and the orchestrator dispatches with it; with the default the output is byte-identical to today.
- With `advisor.enabled: true` the prompts of `plan`, `implement` and `implement-segment` carry the advisor rules; with the default no prompt changes.
- ADR-009 records the three decisions, the two A/B rules and the open live checks. `README.md`, `SKILL.md` and `AGENTS.md` describe the new behavior.

### Key Discoveries:

- `init` keeps unknown meta keys and sets `baseSha` once (`route.mjs:2609`, `route.mjs:2619-2623`); provenance follows the same pattern.
- `compare` derives `pinned` from the log and never from the policy (`route.mjs:2285`, `route.mjs:2379`); provenance warnings must exempt the sections the pinned baseline changes by design.
- `writeOverride` adds `score: { minRigor: null }` unless a test gives its own `score` key (`test/helpers.mjs:42-47`), so both new flags defaulting to off keep every existing first step.
- `agents/*.md` frontmatter supports `tools`; an omitted `model` and `effort` leave the router in control because `SKILL.md` already passes both on every Agent call (`research.md`, Phase 2).
- `prompts/*.md` and ADR rule lines are checked for the GIVEN/WHEN/THEN form by `test/rules.test.mjs`; the new prompt and ADR-009 must pass.

## What We're NOT Doing

- Dynamic workflows (model-written fan-out) and a token budget: out of scope per `change.md`.
- A nested `Agent` call as an advisor (research option b): it gives the consultant a summary instead of the transcript, adds a subagent start-up per consult and reproduces the depth risk.
- The router reading `advisorModel` from user settings files, or any user-level file. It records only what the policy and `meta.json` hold.
- Restricted agent definitions for `research` and `frame`. They need `Write`, `Bash`, `Skill` and `Agent`, so the restriction would remove only `Edit`, `NotebookEdit` and web tools, while a type that does not resolve costs them retries and a halt (they are not advisory like `score`). The policy map and the agents folder make adding them later a data change.
- A router-side fallback to `general-purpose` when an agent type does not resolve. A silent fallback would make a run labelled restricted run unrestricted.
- A hook or any path-scoped write guard. Plugin agents ignore `hooks`, so "write only `complexity.json`" is not achievable here.
- Editing `version` fields, `run.jsonl`, `meta.json` by hand, or anything under `context/archive/`.
- Setting `agents.restricted` or `advisor.enabled` to `true` by default.

## Implementation Approach

Phase order follows dependency: provenance first, so the two flags land into a record that `compare` can read. Each phase is one commit with a Conventional Commits subject (`feat(managed-agent-patterns): ... (pN)`).

Decisions taken without a human (the run is unattended; each is evidence-backed and listed as an assumption in the RESULT line):

- Provenance is recorded once at the first `init` of a run that has no executed step, and recomputed at each `next`; a change since the record adds the section name to `provenance.drift` and leaves the first hashes untouched (research Open Question 2). A run started before this change records nothing and reads as unknown.
- `compare` warns on every differing section except an expected set held in `policy.json`: `ladder`, `rigor`, `score` for a pinned pair, `score` for an `--unpinned` pair (Open Question 3). The `compare` and `provenance` sections of the policy are not hashed, because the project override holds the compare target. Provenance never changes `comparable`, `reasons` or `verdict`.
- Phase 2 ships the `score` agent only (Open Question 6), with the step-to-agent map in `policy.json` (`agents.steps`) so the name can be corrected without code. The name `agent-smith:score` is inferred from the docs and is confirmed by a live check (Open Question 1).
- Phase 3 takes research direction (a): a prompt rule on top of the user's own `advisorModel`, no router read of settings (Open Questions 4 and 5). `advisor.enabled` asks for a consult; it does not configure the advisor. The measurement precondition (do advisor tokens appear in the step's reported `totalTokens`) is a live check recorded in ADR-009, and the rule says the flag stays off when it cannot be measured. If the check fails the whole way, Phases 1 and 2 still ship and the owner may drop Phase 3 (`change.md`).
- The advisor can only add tokens at an unchanged tier, so its A/B rule weighs quality proxies (`steps`, `failedAttempts`) against a token allowance, not a token drop.

## Phase 1: Run provenance

### Overview

Record what a run ran with in `meta.json` and make `compare` say when two arms differ. No behavior of routing changes.

### Changes Required:

#### 1. Provenance record in the router

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Compute a provenance object from the merged policy, the resolved prompt texts, the plugin manifest and the agents folder; record it at the first `init` of a run with no executed step; recompute at each `next` and record drift. Uses `node:crypto` (a built-in, ADR-006).

**Contract**: `meta.provenance = { schemaVersion: 1, plugin: <plugin.json version | null>, sections: { <policy key>: <16 hex of sha256 of canonical JSON>, prompts: <hash of the resolved text of every template>, agentFiles: <hash of the sorted contents of <plugin root>/agents/*.md | null> }, flags: { archive, chrome, "score.minRigor", "agents.restricted", "advisor.enabled" }, drift?: [<section name>, ...] }`. Policy sections listed in `policy.provenance.ignore` are not hashed; the `prompts` policy key is replaced by the resolved texts. Canonical JSON means keys sorted recursively. `drift` is a sorted unique list and is omitted while empty. `next` writes `meta.json` only when `drift` changes. A stored record is never rewritten; a run with executed steps and no record gets none. The plugin version is only read (`<SKILL_DIR>/../../.claude-plugin/plugin.json`), never written. Computing the record never halts and never changes what `init` or `next` do today: an unreadable `plugin.json` gives `plugin: null`, a missing or unreadable `agents/` folder gives `agentFiles: null`, and a template whose `@prompts/` reference does not resolve gives `prompts: null` (`checkPrompts` still halts at `next`, after `init` has written `meta.json`, as before). A flag the policy lacks or malforms reads `false` (so the record exists before Phases 2 and 3 add their blocks); `score.minRigor` reads the merged value or `null`; `archive` and `chrome` read the stored `meta` value or `false`. `drift` covers the keys of `sections` only (`plugin` and `flags` are not drift-tracked).

#### 2. Provenance policy data

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Hold the ignore list and the expected-difference sets as data, as `AGENTS.md` requires for policy.

**Contract**: new top-level `provenance: { "ignore": ["compare", "provenance"], "expected": { "pinned": ["ladder", "rigor", "score"], "unpinned": ["score"] } }`. A value that is not an array of strings reads as the default above.

#### 3. compare reads and compares provenance

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Carry each side's provenance in the `compare` output and add warnings next to the existing ones.

**Contract**: `readSide` adds `provenance` (the stored object or `null`). Warnings, appended after the existing list: `provenance-unknown:<side>` when exactly one side has no record (both unknown stays silent); `provenance-differs:<names>` (sorted, comma-joined) for sections or `plugin` that differ outside the expected set of the mode (the mode is `unpinned` when `--unpinned` is on, else `pinned`; it never reads `baseline.pinned`); `flags-differ:<keys>` for flags that differ outside the expected set (a flag key is exempt when its first dot segment is an exempt section); `provenance-drift:<side>:<names>` when a side has `drift`. `compareMarkdown` needs no new line: warnings already print. `comparable`, `reasons`, `dropPercent` and `verdict` do not change.

#### 4. Tests

**File**: `skills/10x-pipeline/test/provenance.test.mjs` (new)

**Intent**: Drive the real router through the CLI in scratch projects, in the style of `compare.test.mjs`.

**Contract**: test names start with the Progress row number. Cases are the Automated rows below. `helpers.mjs` `run` always spawns the real `route.mjs`, whose plugin root is this repository, so a test must never edit `prompts/*.md`, `agents/*.md` or `plugin.json` in place. Cases that change a file (row 1.2 prompt edit) copy `skills/10x-pipeline`, `.claude-plugin` and, when it exists, `agents` into a scratch directory with the same relative layout, edit the copy, and spawn the copy's `route.mjs` with `spawnSync` inside the test file (`helpers.mjs` stays unchanged). Row 1.1 accepts `agentFiles` as `null` or 16 hex characters, because `agents/` exists only from Phase 2.

#### 5. Documentation

**Files**: `README.md`, `AGENTS.md`

**Intent**: Describe provenance, correct the sentence that says `compare` does not warn when arms differ in features, and list the new test file.

**Contract**: README gets a "Run provenance" bullet group (what is recorded, the drift rule, the expected sets, the warning names, the legacy rule) and the "Baseline comparison" sentence "`compare` does not warn when the two arms differ in these features" is rewritten to point at the provenance warnings. `AGENTS.md` "Project Structure" lists `provenance.test.mjs`.

### Success Criteria:

#### Automated Verification:

- A fresh `init` writes `meta.provenance` with `schemaVersion`, `plugin`, a hash for every merged-policy section except the ignored ones, `prompts`, `agentFiles` and `flags`: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- The hashes are stable across two runs with identical inputs; editing `prompts/score.md` changes only `prompts`; changing `compare.targetDropPercent` changes nothing: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- A resume keeps the stored record; a policy edit between steps adds its section to `provenance.drift` once at the next `next` and leaves the stored hashes untouched: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- A run whose log already holds executed steps and has no record gets none, and the missing record never halts `init`, `next` or `compare`: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- `compare` stays silent when both sides lack provenance and warns `provenance-unknown:<side>` when exactly one does: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- `compare` warns `provenance-differs`, `flags-differ` and `provenance-drift` as specified, exempts `ladder`, `rigor` and `score` for a pinned pair and only `score` for an `--unpinned` pair, and leaves `comparable`, `reasons` and `verdict` unchanged: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- `init` and `status` on a scratch change folder print valid JSON, and the resulting `meta.json` holds a readable `provenance` object
- The README provenance text and the corrected "Baseline comparison" sentence read correctly and match the warning names the router prints

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Tool-restricted step agents

### Overview

A plugin agent definition for the `score` step with a narrow `tools` list, selected by the router through a new output field when `agents.restricted` is `true`. Default off: no output changes.

### Changes Required:

#### 1. The agent definition

**File**: `agents/score.md` (new, plugin root)

**Intent**: A subagent type for the score step that can read and search the repository and write its one file, and nothing else (no `Bash`, `Edit`, `Skill`, `Agent` or web tools).

**Contract**: frontmatter `name: score`, a one-sentence `description`, `tools: Read, Grep, Glob, Write`. No `model`, `effort`, `hooks`, `mcpServers` or `permissionMode` key, so the router's per-call `model` and `effort` stay in control. The body is a short role line that defers to the prompt the router passes. Registered as `agent-smith:score`.

#### 2. Policy data

**File**: `skills/10x-pipeline/policy.json`

**Intent**: The flag and the step-to-agent map, as data.

**Contract**: new `agents: { "restricted": false, "steps": { "score": "agent-smith:score" } }`. Only the boolean `true` turns it on; a block of another shape reads as off.

#### 3. Router output

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: When restricted and the step has a mapped agent, add the agent type to the `run` output and the log entry, and show it in `status`.

**Contract**: `run` output gains `agent: <string>` only when set; the log entry gains `agent`; `status` step rows gain `agent` when present. The `archive` action and every other output stay as they are. No fallback to `general-purpose`.

#### 4. Orchestrator dispatch

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Use the router's agent type when it gives one.

**Contract**: Loop step 2 of the `run` action reads: `subagent_type` is the router's `agent` when the output has one, else `general-purpose`. SKILL.md names no model, effort or tier (`AGENTS.md` Hard Rules); an agent name is none of those.

#### 5. Tests

**File**: `skills/10x-pipeline/test/agents.test.mjs` (new)

**Intent**: Cover the flag, the output field, the definition file and the provenance link.

**Contract**: test names start with the Progress row number. A test starts the scorer with `policy: { score: { minRigor: "standard" }, agents: { restricted: true } }`. Row 2.5 edits `agents/score.md` only in a scratch copy of the plugin tree (see Phase 1 item 4), never in this repository.

#### 6. Documentation

**Files**: `README.md`, `AGENTS.md`

**Intent**: Document the flag, what the restriction does and does not do, and the new folder.

**Contract**: README gets a "Restricted step agents (opt-in)" bullet group: the flag, the `score` agent and its tools, that `Write` cannot be path-scoped, no fallback, the failure behavior (a type that does not resolve is a failed `score` attempt, which is neutral and ends in a skip after 3), and the A/B reading (same model and fewer tools, so the criterion is no extra failed attempts and no halts, not a token drop). `AGENTS.md` "Project Structure" lists `agents/score.md` and `agents.test.mjs`; README "Layout" lists `agents/`.

### Success Criteria:

#### Automated Verification:

- With the default policy no `run` output and no log entry has an `agent` field: `node --test skills/10x-pipeline/test/agents.test.mjs`
- With `agents.restricted: true` the `score` run output and log entry carry `agent: "agent-smith:score"`, no other step does, and `status` shows it: `node --test skills/10x-pipeline/test/agents.test.mjs`
- A malformed `agents` block (restricted not `true`, `steps` not an object, a value that is not a non-empty string) reads as off and never halts: `node --test skills/10x-pipeline/test/agents.test.mjs`
- `agents/score.md` has `name`, `description` and `tools` exactly `Read, Grep, Glob, Write`, and no `model`, `effort`, `hooks`, `mcpServers` or `permissionMode` key; every value of `agents.steps` is `<plugin name>:<file>` for an existing `agents/<file>.md`: `node --test skills/10x-pipeline/test/agents.test.mjs`
- Editing `agents/score.md` changes the provenance `agentFiles` hash, and flipping `agents.restricted` changes the `agents` section and the `agents.restricted` flag: `node --test skills/10x-pipeline/test/agents.test.mjs`
- `SKILL.md` tells the orchestrator to use the router's `agent` as `subagent_type` when present and still names no model alias: `node --test skills/10x-pipeline/test/agents.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Live check 1: install the plugin from this branch, set `agents.restricted: true` in a scratch project override, run a `standard` pipeline; the score step starts as `agent-smith:score` and writes a valid `complexity.json`. If the type does not resolve, record the Agent error text and correct `agents.steps.score`
- Live check 2: in that restricted run the subagent cannot call `Bash`, `Edit` or an MCP tool; record the observed behavior for MCP tools in ADR-009 (the docs describe only the background case)
- The README restricted-agents text and the `AGENTS.md` and README layout lists read correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Opt-in advisor and ADR-009

### Overview

A rule-form prompt that asks `plan` and `implement` to consult the advisor once before finishing, appended by the router when `advisor.enabled` is `true`, plus ADR-009 with the decisions and decision rules fixed before any run.

### Changes Required:

#### 1. The advisor prompt

**File**: `skills/10x-pipeline/prompts/advisor.md` (new)

**Intent**: Rules for one consult at the key moment, safe when no advisor is available.

**Contract**: GIVEN/WHEN/THEN lines with one bold keyword each (ADR-004): consult once, only after the plan draft or the implementation is complete and before the RESULT line; only when an advisor tool is available to you, else continue without it and without mentioning it; never more than once; never ask a worker subagent of `/10x-goal-implement` to consult; act on the advice or record why not; add one `assumptions` entry saying a consult happened. No model name appears in the file.

#### 2. Policy data

**File**: `skills/10x-pipeline/policy.json`

**Intent**: The flag, the templates it applies to, and the prompt entry.

**Contract**: `advisor: { "enabled": false, "templates": ["plan", "implement", "implement-segment"] }` and `prompts.advisor: "@prompts/advisor.md"` (so `checkPrompts` and the provenance `prompts` hash cover it). Only the boolean `true` turns it on; another shape reads as off. Re-plans, retries, executors, reviews, `fix`, `score` and the pre-plan steps get no advisor text.

#### 3. Router

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Append the advisor rules to the prompt of a listed template, before the generic suffix, and log it.

**Contract**: prompt = rendered template, then the advisor text, then `policy.prompts.suffix`; the log entry gains `advisor: true` for those steps. The router never reads a settings file, never checks that a consult happened and never caps it (the native advisor offers no cap).

#### 4. Prompt index

**File**: `skills/10x-pipeline/prompts/README.md`

**Intent**: Keep every prompt file wired or listed.

**Contract**: a row in "Wired": `advisor.md`, source none (this pipeline), step `plan` and `implement`, wired as the `advisor` template appended when `advisor.enabled`.

#### 5. ADR-009

**File**: `docs/ADR/ADR-009-managed-agent-patterns.md` (new)

**Intent**: Record the three decisions in the form of ADR-007, with scenario rules and two decision rules fixed before any run.

**Contract**: Status `Proposed` (unattended reading, owner confirmation pending). Context, Decision rules as GIVEN/WHEN/THEN lines (router stays a script; provenance recording and the compare warnings; restricted agents are opt-in and carry no model; the advisor flag only adds prompt text), Consequences, Alternatives (nested `Agent` consult, router reading `advisorModel`, restricted `research` and `frame`, silent fallback, hooks), and sections "Live checks" and "A/B result" marked pending. Decision rules, fixed here:

- Advisor precondition P0: one live run with `advisorModel` set shows whether the step's reported `totalTokens` includes the advisor's tokens. If it does not, the pair cannot be read and `advisor.enabled` stays `false`.
- Advisor A/B: pairs of one change, `advisor.enabled` false as baseline and true as routed, same `advisorModel` and Claude Code version on both arms, `compare --unpinned`, arms alternating. The default becomes `true` only when all hold over at least 5 comparable pairs: the sum of `steps` of the advisor arm is below the baseline's; the sum of `failedAttempts` of the advisor arm is at most the baseline's; the median `dropPercent` is -10 or higher (the advisor arm costs at most 10% more tokens); one A/A pair has an absolute `dropPercent` below 10. Anything else, including fewer than 5 comparable pairs, leaves the default `false`.
- Restricted agents A/B: same pairs with `agents.restricted` false and true, scorer on in both. The default becomes `true` only when over at least 5 comparable pairs the restricted arm has no more failed `score` attempts than the baseline in total, no halt, and live checks 1 and 2 passed. No token claim is made.
- A pair that is not comparable is recorded with its reasons and does not count. Five pairs is a screen, not a significance test. The thresholds are uncalibrated.

#### 6. Documentation and tests

**Files**: `README.md`, `AGENTS.md`, `skills/10x-pipeline/test/advisor.test.mjs` (new)

**Intent**: Document the flag honestly (it asks for a consult and cannot configure or cap the advisor), and test the router behavior.

**Contract**: README "Advisor (opt-in)" bullets: what the flag does, that the user's own `advisorModel` decides whether an advisor exists and which model it is (the pairing rule means a Sonnet 5.5 step needs an advisor at or above it), that the router cannot verify or cap consults, that both arms of a pair need the same advisor setting recorded by hand, and the pointer to ADR-009. `AGENTS.md` "Project Structure" lists `advisor.md`, `advisor.test.mjs` and ADR-009 (the ADR range becomes ADR-001 to ADR-009). Test names start with the Progress row number.

### Success Criteria:

#### Automated Verification:

- With the default policy no prompt contains the advisor text, for every template: `node --test skills/10x-pipeline/test/advisor.test.mjs`
- With `advisor.enabled: true` the prompts of `plan`, `implement` and `implement-segment` carry the advisor rules once, before the suffix, and the log entry has `advisor: true`; `plan-revise`, `plan-replan`, `plan-rejected`, `implement-retry`, executors, reviews, `fix`, `score` and pre-plan steps carry none: `node --test skills/10x-pipeline/test/advisor.test.mjs`
- A malformed `advisor` block reads as off and never halts: `node --test skills/10x-pipeline/test/advisor.test.mjs`
- `prompts/advisor.md` follows the rule form, names no model, and is listed in the `prompts/README.md` wired table: `node --test skills/10x-pipeline/test/advisor.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- Provenance records `advisor.enabled` in `flags`, and flipping it changes the `advisor` section: `node --test skills/10x-pipeline/test/advisor.test.mjs`
- ADR-009 rule lines follow the rule form and the whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Live check P0: with `advisorModel` set, run one `plan` step with `advisor.enabled: true`; record in ADR-009 whether the step consulted and whether the Agent result's `totalTokens` includes the advisor's tokens
- The owner reads ADR-009, confirms or changes the unattended readings (score-only agents, prompt rule over the user's `advisorModel`, the two decision rules) and sets its status
- The README advisor text states that `advisor.enabled` cannot configure or cap the advisor

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Black-box through the CLI in scratch projects (`AGENTS.md` Testing), three new files: `provenance.test.mjs`, `agents.test.mjs`, `advisor.test.mjs`; helpers from `helpers.mjs` only, which stays unchanged. A test that must change a plugin file (a prompt, an agent definition) edits a scratch copy of the plugin tree and spawns that copy's `route.mjs`, never the repository files.
- Hash stability and sensitivity (prompt text, policy section, ignored section), drift, legacy runs, the compare warning matrix (both unknown, one unknown, differing sections, pinned and unpinned exemptions).
- Default-off byte equality for the run output (agents) and the prompt text (advisor).

### Integration Tests:

- The existing suite must pass unchanged, in particular `compare.test.mjs` warnings equal to `[]` for legacy pairs, and `budget-executors.test.mjs` (no new step is added, so the step budget is untouched).

### Manual Testing Steps:

1. `init` and `status` on a scratch change folder; read `meta.json`.
2. A restricted `standard` run with the plugin installed from the branch (live checks 1 and 2).
3. One advisor `plan` step with `advisorModel` set (live check P0).

## Performance Considerations

`next` recomputes provenance on every call: it hashes the merged policy, reads the prompt files that `checkPrompts` already reads, and reads one small folder. No git, no network, no model call (ADR-006).

## Migration Notes

None for data. A run started before this change has no `provenance`; it is read as unknown by `compare` and is never given a record mid-run. The in-flight `managed-agent-patterns` run itself is such a run.

## References

- Related research: `context/changes/managed-agent-patterns/research.md`
- Change identity and sources: `context/changes/managed-agent-patterns/change.md`
- Template for the ADR: `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`
- Meta merge and `baseSha`: `skills/10x-pipeline/scripts/route.mjs:2609`
- compare warnings: `skills/10x-pipeline/scripts/route.mjs:2438`
- Dispatch line: `skills/10x-pipeline/SKILL.md:43`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Run provenance

#### Automated

- [x] 1.1 A fresh `init` writes `meta.provenance` with `schemaVersion`, `plugin`, a hash for every merged-policy section except the ignored ones, `prompts`, `agentFiles` and `flags` — 1f181f5
- [x] 1.2 The hashes are stable across two runs with identical inputs; editing `prompts/score.md` changes only `prompts`; changing `compare.targetDropPercent` changes nothing — 1f181f5
- [x] 1.3 A resume keeps the stored record; a policy edit between steps adds its section to `provenance.drift` once at the next `next` and leaves the stored hashes untouched — 1f181f5
- [x] 1.4 A run whose log already holds executed steps and has no record gets none, and the missing record never halts `init`, `next` or `compare` — 1f181f5
- [x] 1.5 `compare` stays silent when both sides lack provenance and warns `provenance-unknown:<side>` when exactly one does — 1f181f5
- [x] 1.6 `compare` warns `provenance-differs`, `flags-differ` and `provenance-drift` as specified, exempts `ladder`, `rigor` and `score` for a pinned pair and only `score` for an `--unpinned` pair, and leaves `comparable`, `reasons` and `verdict` unchanged — 1f181f5
- [x] 1.7 The whole suite passes — 1f181f5

#### Manual

- [ ] 1.8 `init` and `status` on a scratch change folder print valid JSON, and the resulting `meta.json` holds a readable `provenance` object
- [ ] 1.9 The README provenance text and the corrected "Baseline comparison" sentence read correctly and match the warning names the router prints

### Phase 2: Tool-restricted step agents

#### Automated

- [x] 2.1 With the default policy no `run` output and no log entry has an `agent` field
- [x] 2.2 With `agents.restricted: true` the `score` run output and log entry carry `agent: "agent-smith:score"`, no other step does, and `status` shows it
- [x] 2.3 A malformed `agents` block (restricted not `true`, `steps` not an object, a value that is not a non-empty string) reads as off and never halts
- [x] 2.4 `agents/score.md` has `name`, `description` and `tools` exactly `Read, Grep, Glob, Write`, and no `model`, `effort`, `hooks`, `mcpServers` or `permissionMode` key; every value of `agents.steps` is `<plugin name>:<file>` for an existing `agents/<file>.md`
- [x] 2.5 Editing `agents/score.md` changes the provenance `agentFiles` hash, and flipping `agents.restricted` changes the `agents` section and the `agents.restricted` flag
- [x] 2.6 `SKILL.md` tells the orchestrator to use the router's `agent` as `subagent_type` when present and still names no model alias
- [x] 2.7 The whole suite passes

#### Manual

- [ ] 2.8 Live check 1: install the plugin from this branch, set `agents.restricted: true` in a scratch project override, run a `standard` pipeline; the score step starts as `agent-smith:score` and writes a valid `complexity.json`. If the type does not resolve, record the Agent error text and correct `agents.steps.score`
- [ ] 2.9 Live check 2: in that restricted run the subagent cannot call `Bash`, `Edit` or an MCP tool; record the observed behavior for MCP tools in ADR-009 (the docs describe only the background case)
- [ ] 2.10 The README restricted-agents text and the `AGENTS.md` and README layout lists read correctly

### Phase 3: Opt-in advisor and ADR-009

#### Automated

- [ ] 3.1 With the default policy no prompt contains the advisor text, for every template
- [ ] 3.2 With `advisor.enabled: true` the prompts of `plan`, `implement` and `implement-segment` carry the advisor rules once, before the suffix, and the log entry has `advisor: true`; `plan-revise`, `plan-replan`, `plan-rejected`, `implement-retry`, executors, reviews, `fix`, `score` and pre-plan steps carry none
- [ ] 3.3 A malformed `advisor` block reads as off and never halts
- [ ] 3.4 `prompts/advisor.md` follows the rule form, names no model, and is listed in the `prompts/README.md` wired table
- [ ] 3.5 Provenance records `advisor.enabled` in `flags`, and flipping it changes the `advisor` section
- [ ] 3.6 ADR-009 rule lines follow the rule form and the whole suite passes

#### Manual

- [ ] 3.7 Live check P0: with `advisorModel` set, run one `plan` step with `advisor.enabled: true`; record in ADR-009 whether the step consulted and whether the Agent result's `totalTokens` includes the advisor's tokens
- [ ] 3.8 The owner reads ADR-009, confirms or changes the unattended readings (score-only agents, prompt rule over the user's `advisorModel`, the two decision rules) and sets its status
- [ ] 3.9 The README advisor text states that `advisor.enabled` cannot configure or cap the advisor
