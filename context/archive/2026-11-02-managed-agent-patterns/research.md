---
date: 2026-11-02T19:41:36+01:00
researcher: Claude (Sonnet 5.5, unattended subagent)
git_commit: 394b1be33a87d47e34f1b5bb7d04ccaab373640f
branch: feat/managed-agent-patterns
repository: agent-smith
topic: "Run provenance, tool-restricted step agents and an opt-in advisor: what the code and the Claude docs allow"
tags: [research, route.mjs, meta.json, compare, plugin-agents, advisor, SKILL.md, policy.json]
status: complete
last_updated: 2026-11-02
last_updated_by: Claude (Sonnet 5.5, unattended subagent)
---

# Research: Run provenance, tool-restricted step agents and an opt-in advisor

**Date**: 2026-11-02T19:41:36+01:00
**Researcher**: Claude (Sonnet 5.5, unattended subagent)
**Git Commit**: 394b1be33a87d47e34f1b5bb7d04ccaab373640f (the change folder is untracked; no code changed)
**Branch**: feat/managed-agent-patterns
**Repository**: agent-smith

## Research Question

`context/changes/managed-agent-patterns/change.md` proposes three patterns from the Managed Agents docs, as three phases of one change:

1. Run provenance: `meta.json` records plugin version, a hash of the merged policy and prompt files, and the feature flags in force; `compare` warns when the two arms differ.
2. Tool-restricted step agents: plugin `agents/*.md` with a narrow `tools` list for `score`, `research` and `frame`, used when `agents.restricted` is `true` (default `false`), no `model` in the frontmatter.
3. Advisor: `plan` and `implement` consult a stronger tier once before finishing when `advisor.enabled` is `true` (default `false`); open risk is spawn depth with `10x-goal-implement`.

Which facts of the repository and of the Claude docs bound each phase, and which parts of the sketch do not hold?

## Summary

- Phase 1 fits the code as it is. `init` already keeps every stored `meta.json` field and sets `baseSha` once (`route.mjs:2609`, `route.mjs:2619-2623`), and `compare` already reads `meta.json` per side (`route.mjs:2326`). Two design facts matter: the baseline arm always has a different merged policy by construction (`baseline-policy.json`), so a single hash mismatch carries no information; and the merged policy contains keys that do not affect routing (`compare.targetDropPercent`, which the project override already sets, `context/foundation/agent-smith-policy.json`). The record needs per-section fingerprints, not one hash.
- Phase 2 is feasible but weak as a "restriction". The Claude Code docs support plugin agents in `agents/` at the plugin root (named `<plugin>:<agent>`), a `tools` allowlist, and a per-invocation `model` and `effort` that override the frontmatter. But the three steps need `Write`, and two of them need `Skill` and `Agent`; the allowlist cannot scope `Write` to one path, and plugin agents ignore `hooks`. Only `score` gets a real narrowing (no `Bash`, no `Edit`, no `Skill`, no `Agent`, no web). It also needs a new router output field, because the orchestrator hard-codes `subagent_type: general-purpose` (`SKILL.md:43`).
- Phase 3 rests on a wrong premise. The open risk "spawn depth" disappears, because Claude Code has a native advisor tool that runs server-side and needs no nested `Agent` call. But the native advisor is configured per session (`advisorModel` setting, `--advisor`, `/advisor`), is inherited by subagents, has no cap or force switch, and the plugin cannot set it (a plugin manifest `settings` key only honors `agent` and `subagentStatusLine`). So `advisor.enabled` in `policy.json` cannot turn the advisor on or off for `plan` and `implement` only; it can only add prompt text. The change needs a decision between (a) a prompt nudge that relies on the user's `advisorModel`, (b) a nested `Agent` call on a stronger tier, which gives the consultant far less context than the real advisor and does hit the depth limit, or (c) dropping phase 3.

## Detailed Findings

### Phase 1: run provenance

- `meta.json` is created and updated only by `init` (and `next` for rigor and `outcome`). `init` builds `meta = { ...prev, id, goal }`, so any new key survives a resume (`route.mjs:2609`). `baseSha` is the model for a "set once, kept on resume" field: it is written only when no valid stored value exists (`route.mjs:2619-2623`).
- The router reads and merges the policy once per process: `loadPolicy` deep-merges `skills/10x-pipeline/policy.json` with `context/foundation/agent-smith-policy.json` (`route.mjs:53-58`, `deepMerge` at `route.mjs:40-47`; arrays are replaced whole). `main` calls it before every command (`route.mjs:2567`). The merged object is therefore available at `init` with no new I/O.
- Prompts are resolved at the point of use: `promptText` replaces each `@prompts/<file>.md` part with the trimmed file text (`route.mjs:1848-1862`), and `checkPrompts` resolves every template on each `next` (`route.mjs:1867-1876`). A provenance hash of the resolved prompt text (not of the `@prompts/` reference strings) is what changes behavior. Hashing only `policy.json` would miss an edit to `prompts/score.md`.
- The plugin version is at `<SKILL_DIR>/../../.claude-plugin/plugin.json` (`SKILL_DIR` is `skills/10x-pipeline`, `route.mjs:21`). The marketplace entry uses `"source": "./"` (`.claude-plugin/marketplace.json`), so the plugin root is the repository root and `agents/` at the root is in the scan path. `version` is release-please-owned (`AGENTS.md` Hard Rules, Releases); the router only reads it.
- `compare` reads each side with `readMeta` and keeps `goal`, `baseSha`, `rigor` and `outcome` (`route.mjs:2326-2369`). Its warnings are a closed list: `goal-mismatch`, `baseSha-mismatch`, `baseline-skipped-steps:N`, `input-files-differ:...`, `archive-also-present:...`, `baseline-unpinned` (`route.mjs:2437-2450`). Provenance warnings slot in next to these. A side whose `meta.json` has no provenance (every run started before this change, and the in-flight run for this very change, whose `meta.json` holds only `id`, `goal`, `rigor` and `baseSha`) must read as "unknown", not "different".
- What would be a false alarm. The pinned baseline uses `baseline-policy.json` (all ladder rungs `sonnet`/`high`, `rigor.skipPlanReviewAt: []`, `score.minRigor: null`), so its merged policy differs from the routed arm by design (`baseline-policy.json:1-17`). `compare` already derives `pinned` from the log, not from the policy (`route.mjs:2285`, `route.mjs:2379`). A provenance warning is useful only when it names which sections differ outside the expected set. The project override also holds `compare.targetDropPercent: 30` (a value read from the running project, not from `--routed`, per README "Baseline comparison"), so a whole-policy hash would differ between two checkouts that route identically. Per-section hashes (for example `ladder`, `steps`, `score`, `preplan`, `executors`, `extraSteps`, `codeReplan`, `manualVerify`, `rigor`, `prompts`) avoid that.
- The resume case: `init` on an existing run keeps the stored provenance, so a resume after a policy edit would still show the original fingerprints. Either record provenance once and add a second "now" check at `next`, or accept that a run is attributed to its first `init`. This is a decision for the plan (see Open Questions).
- Feature flags "in force" today are `archive`, `chrome` and the stored rigor (`meta.archive`, `meta.chrome`, `meta.rigor`), plus policy-level switches such as `score.minRigor`, `extraSteps.allowance`, `codeReplan.afterFailures`. The two new flags (`agents.restricted`, `advisor.enabled`) are policy keys, so they appear in the per-section fingerprints without extra code.

### Phase 2: tool-restricted step agents

What the docs establish (https://code.claude.com/docs/en/sub-agents, read 2026-11-02):

- Plugin agents live in `agents/` at the plugin root and register as `<plugin>:<name>` (the docs' example is `my-plugin:review:security` for `agents/review/security.md`). This session's own agent list shows the same form for installed plugins (`caveman:cavecrew-builder`, `vercel:ai-architect`). The page does not state the exact `subagent_type` string for a plugin agent, so `agent-smith:score` is an inference to confirm with one live call.
- Supported frontmatter includes `tools`, `disallowedTools`, `model`, `effort`, `skills` and `maxTurns`; an omitted `tools` inherits the full tool pool; plugin agents ignore `hooks`, `mcpServers` and `permissionMode`.
- Model precedence: the per-invocation `model` parameter beats the frontmatter, which beats `CLAUDE_CODE_SUBAGENT_MODEL`. The Agent tool's `effort` parameter overrides the frontmatter `effort` (Claude Code v2.1.292 or later) and `CLAUDE_CODE_EFFORT_LEVEL` beats both. So a definition with no `model` and no `effort` keeps the router in control, as change.md requires. `SKILL.md` already passes both on every call (`SKILL.md:43`), so no new version floor arises for the effort parameter.
- A `tools` allowlist is a real narrowing only for tools the step does not need. `Skill` is not in the always-removed list, and the docs say omitting it from `tools` stops the subagent from invoking skills.

What the repository needs from each step:

| Step | Prompt | Tools the step cannot do without | Source |
| --- | --- | --- | --- |
| `score` | "Score the complexity..." + `prompts/score.md` | `Read`, `Grep`, `Glob`, `Write` (writes `complexity.json`, "change no other file") | `policy.json` `prompts.score`; `prompts/score.md` rules |
| `research` | "Run /10x-research ..." | `Skill`, `Read`, `Grep`, `Glob`, `Bash` (the skill runs `metadata-guard.mjs` with node), `Write`, `Agent` (the skill dispatches 2 to 4 parallel workers), plus web tools when the question needs them | `policy.json` `prompts.research`; `~/.claude/skills/10x-research/SKILL.md` allowed-tools |
| `frame` | "Run /10x-frame ..." + `prompts/frame-unattended.md` | `Skill`, `Read`, `Grep`, `Glob`, `Write`, plus `Bash` and `Agent` per the skill's own allowed-tools | `policy.json` `prompts.frame`; `~/.claude/skills/10x-frame/SKILL.md` allowed-tools |

Consequences:

- `score` can drop `Bash`, `Edit`, `Skill`, `Agent`, `WebFetch` and `WebSearch`. That is a real restriction, and `score` is the step with the strictest prompt ("change no other file").
- `research` and `frame` keep `Write` and `Bash`, so they can still write any file. The restriction removes at most `Edit` and `NotebookEdit` (and web tools for `frame`). Whether it is worth shipping for these two is a judgment call; the router's artifact checks (`research.md` frontmatter, `frame.md` `## Reframed`) already catch a missing artifact, not a stray write.
- A path-scoped write guard needs a hook, and plugin agents ignore `hooks`. So "the agent can write only `complexity.json`" is not achievable with this mechanism.
- Dispatch plumbing. The router's `run` output has `action`, `n`, `step`, `model`, `effort`, `reason`, `prompt`, `resultFile` (`route.mjs:2220-2229`), and the orchestrator calls `Agent` with `subagent_type: general-purpose` for every step (`SKILL.md:43`). Selecting an agent type needs one new router field (for example `agent`) and one `SKILL.md` instruction ("use the router's `agent` as `subagent_type` when present"). `AGENTS.md` forbids `SKILL.md` from naming models, effort or tiers; an agent name is not one of those, so the rule is not broken. The router also needs the flag in `policy.json` (`agents.restricted`, default `false`) and a step-to-agent map in the policy, not in `route.mjs` (`AGENTS.md` Hard Rules).
- Failure mode. If the type does not resolve (plugin loaded under another name, older Claude Code), the `Agent` call errors, the orchestrator writes `{"status":"unknown"}`, and the router counts a failed attempt (`SKILL.md:44`); for `score` that is neutral, for `research` and `frame` it costs a retry tier and eventually a halt after three attempts (README "Pre-plan steps"). There is no router-side fallback to `general-purpose`.
- Provenance interplay. The restricted definitions change behavior, so their file contents belong in the provenance hash (`agents/*.md` fingerprint) and the flag in the recorded flags. This is the stated reason phase 1 lands first.

### Phase 3: advisor

What the docs establish (https://code.claude.com/docs/en/advisor.md and the Managed Agents multiagent page, read 2026-11-02):

- Claude Code has a native advisor: a server-side tool that receives the full conversation, configured by the `advisorModel` setting, the `--advisor` flag or `/advisor`. "Subagents inherit the configured advisor and apply the same pairing check against their own model." Claude decides when to call it; "There is no setting to cap or force advisor calls"; a consultation can be requested in the prompt ("consult the advisor before you continue"). It is experimental, Anthropic API only (not Bedrock, Vertex, Foundry), and needs feature-flag fetching on. `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` disables it. Advisor tokens count toward session totals in `/usage`.
- Pairing rule: the advisor must rank at or above the main model (for a Sonnet 5.5 main model: Fable, Opus 5 or later, Sonnet 5.5; for Haiku 5.5 and Sonnet 5 main models Opus 4.7 or later). Claude Code does not attach an advisor that ranks below the model of the session or subagent; the conversation continues with no error and no advisor.
- The plugin manifest's `settings` key honors only `agent` and `subagentStatusLine` (plugins-reference), and plugin agent frontmatter has no advisor field in the supported-field list. So a plugin cannot enable the advisor itself.
- The Managed Agents advisor (`multiagent.advisor: {"type": "enabled", "model": "..."}`, with `max_uses`, `max_tokens` and `caching` absent there) is a different surface: it needs the Managed Agents API and a `multiagent` agent config, which a local Claude Code plugin does not use. It is the source of the idea, not an implementation path. Its stated rules (advisor at least as capable as the agent; only the primary thread consults; consultations billed at the advisor's rates; each consultation resends the conversation so far, so later calls cost more input) match the native advisor.

What this does to change.md phase 3:

- Spawn depth is not the blocker. The native advisor is a server tool, so a `plan` or `implement` step subagent does not spawn anything to consult it. The depth limit still matters for a nested `Agent` fallback: the sub-agents page says a subagent can spawn subagents up to three layers below the main conversation and `Agent` is withheld at the limit. The orchestrator is layer 0, the step subagent layer 1, the `10x-goal-implement` phase worker (a `Task` call, `~/.claude/skills/10x-goal-implement/SKILL.md:103`) layer 2; a consult called from the step subagent is layer 2 and fits, while one called from inside a phase worker would be layer 3 and is the case README already flags (`README.md:203`).
- The opt-in cannot be router-scoped. `advisorModel` applies to every subagent of the session that satisfies the pairing, so with it set, `score`, `research`, reviews, `fix` and every inner `goal-implement` worker may consult it, not only `plan` and `implement`. `advisor.enabled: true` can only append a rule to the `plan` and `implement` prompts ("consult once before finishing"), and the router cannot verify that a consultation happened or cap it to one. This weakens the "decision rule fixed before any run" of ADR-009: the treatment is "prompt says consult" on top of a user setting, not a controlled switch.
- Measurement gap. `compare` sums `usage.totalTokens` per executed step and splits them by the step's `model` alias and tier (`route.mjs:2341-2352`), and the usage figure is what the Agent result reports (`SKILL.md:45`). The docs say advisor tokens appear in session totals, but nothing read here says whether a subagent's reported `totalTokens` includes the advisor's tokens or attributes them to the advisor model. If they are missing, an advisor arm looks cheaper than it is and `byModel` never shows the stronger model's share. This must be checked with one live run before any decision rule is fixed. It is the same class of gap ADR-007 handled with `byTier`.
- Confound with `compare`. Whether `advisorModel` is set is a property of the user's settings, not of the run; two arms with different settings differ in cost for a reason the router does not see. Provenance can record it only by reading settings files (`~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`) and the env var; today the router reads no user-level file. Recording `advisor.enabled` from the policy alone does not capture the confound.
- Alternative (b), a nested `Agent` call on a stronger tier. It needs no setting, can be router-scoped and capped (the prompt names the model alias only if the router passes it, which breaks `SKILL.md`'s rule of naming no model, so the router would have to inject the alias into the prompt text), but the consultant sees only what the step writes in its prompt, not the transcript, and every consultation adds a full subagent start-up. It also reproduces the depth risk. This changes what is being measured: "a stronger reviewer with a summary", not "the advisor".

### Cross-cutting

- Tests. The suite drives the real router through the CLI (`AGENTS.md` Testing). `makeProject` always writes the override through `writeOverride`, which adds `score: { minRigor: null }` unless the test supplies its own `score` key (`test/helpers.mjs:42-47`), so any new default must not change the first step of existing tests; both new flags default to off, which keeps that. In the grep of `test/*.mjs` for `meta.json` readers, tests read `meta.json` through `readMetaFile(...)` and assert on single fields (`.rigor`, `.baseSha`, `.archive`, `.outcome.*`); no hit deep-equals the whole object, so extra provenance keys should not break them (this inspected set only; the plan should re-run the suite). No test bounds `SKILL.md` for model names except the PR comment lines (`test/pr-comment.test.mjs:729-735`), which scan only lines that mention the PR comment.
- Doc obligations from `AGENTS.md`: a tier-logic change updates "How the tier moves" in `SKILL.md` and the routing bullets in `README.md`; a router change runs `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`. Commits need Conventional Commit subjects; `version` is never hand-edited.
- Out of scope per change.md: dynamic workflows and a token budget. The Managed Agents docs confirm dynamic workflows are model-written fan-out (`multiagent_20261001` turns them on by default), which is the reason given for leaving them out.

## Code References

- `skills/10x-pipeline/scripts/route.mjs:21` - `SKILL_DIR`, source of the plugin root for the version read
- `skills/10x-pipeline/scripts/route.mjs:40-58` - `deepMerge`, `readJson`, `loadPolicy` (merged policy)
- `skills/10x-pipeline/scripts/route.mjs:203-207` - `readMeta` (plain-object guard)
- `skills/10x-pipeline/scripts/route.mjs:416-430` - `cleanSignals` (what a step result may carry; `score` drops `rigor`)
- `skills/10x-pipeline/scripts/route.mjs:1848-1876` - `promptText`, `checkPrompts` (prompt resolution)
- `skills/10x-pipeline/scripts/route.mjs:2183-2229` - prompt render, log entry and the `run` output the orchestrator receives
- `skills/10x-pipeline/scripts/route.mjs:2285`, `2326-2380` - `BASELINE_PIN`, `readSide` (what `compare` reads from `meta.json` and the log)
- `skills/10x-pipeline/scripts/route.mjs:2437-2450` - the `compare` warning list
- `skills/10x-pipeline/scripts/route.mjs:2570-2625` - `init`, meta merge and `baseSha`
- `skills/10x-pipeline/SKILL.md:22,43-45` - "no models" rule, the Agent call with `subagent_type: general-purpose`, usage pass-through
- `skills/10x-pipeline/policy.json:11-22` - `steps` (the three steps and their tiers); `policy.json:155-175` - `score` block
- `skills/10x-pipeline/baseline-policy.json:1-17` - pinned baseline override
- `skills/10x-pipeline/test/helpers.mjs:42-47` - `writeOverride` and the score-off default
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` - plugin name `agent-smith`, `"source": "./"`, version `0.2.0`
- `README.md:203` - existing spawn-depth requirement for `10x-goal-implement`
- `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md` - the model for ADR-009 (scenario rules, decision rule fixed before runs, `compare --unpinned` and `byTier` as measurement)

## Architecture Insights

- The repository keeps three invariants this change must respect: routing data in `policy.json` (not `route.mjs`); the router makes no model or network call (ADR-006, `AGENTS.md`); `SKILL.md` names no model, effort or tier. Phase 2 needs a policy-held step-to-agent map; phase 3 cannot be done in the router at all, only in prompt text plus user settings.
- Every earlier optional feature followed one pattern: policy flag defaulting to off or to a rigor gate, router logs the decision, `report.md` and `status` show it, `compare` measures it. Provenance is the missing piece that lets `compare` say why two arms differ, and for features that live in user settings (the advisor) it cannot see the cause.
- ADR-007's A/B method (scorer on vs off, at least 5 comparable pairs, an A/A spread, rule fixed in advance) is directly reusable for restricted agents. For restricted agents the expected effect on tokens is about zero (same model, fewer tools), so the honest success criterion is "no extra failed attempts and no halts", not a token drop.

## Historical Context (from prior changes)

- `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md` - rules in GIVEN/WHEN/THEN form, "keep only if it saves more than it costs", `compare --unpinned` waiver, `byTier` split. Supported as the template for ADR-009. The claim "the router stays a script" (ADR-006) still holds for all three phases.
- `README.md` "Baseline comparison" and "Scorer A/B check" - the A/B protocol; "`compare` does not warn when the two arms differ in these features" (executors, segments) is the exact gap phase 1 fills, partly: that README sentence is correct today and becomes stale once provenance warnings exist.
- `README.md:203` ("`10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more") - supported for the nested-`Agent` path; not applicable to the native advisor.
- `context/foundation/roadmap.md` - milestone M-1 is `done`; this change has no roadmap slice (like `release-packaging`, an off-roadmap change). A slice or an "off-roadmap change" note is a bookkeeping decision for the plan.
- No `context/domain/` or `context/map/` artifacts exist in the repository, so no domain or map input was used.

## Related Research

- `context/archive/` and `context/changes/` hold earlier change folders (for example `llm-complexity-scorer`, cited by ADR-007); none was re-read for this question beyond ADR-007's own summary of them.

## Open Questions

1. Does `subagent_type: "agent-smith:score"` resolve for a plugin installed from the marketplace, and what does the Agent call return when it does not? One live call settles it; nothing in the docs states the string.
2. Provenance scope. Options: one set of per-section hashes written at first `init` (simple, attributes a run to its start), or also re-computed at each `next` and a drift marker written when it changes mid-run (covers a policy edit between steps). Which does the plan want? Default taken in this research: first `init` plus a drift marker, because `meta.json` already tolerates extra keys.
3. Should `compare` warn on every differing section, or exempt the sections the pinned baseline is known to change (`ladder`, `rigor.fromGoal`, `rigor.skipPlanReviewAt`, `score`)? Exempting them keeps the warning meaningful for the pinned comparison; `--unpinned` pairs (scorer A/B) would want all sections except `score`.
4. Phase 3 direction: (a) prompt nudge on top of the user's `advisorModel`, (b) nested `Agent` call on a stronger tier, or (c) drop. This research recommends deciding (a) vs (c) only after a live run shows whether the step's reported `totalTokens` includes advisor tokens; without that, ADR-009's decision rule cannot be measured and should not be fixed. This is a product decision for the owner.
5. If (a): does the router read `advisorModel` from the settings files and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` from the environment to record them in provenance and to skip the prompt nudge when no advisor is configured? That would be the router's first read of a user-level file; the hard rules do not forbid reads, but the project has not done it before.
6. Is the restricted-agent saving worth shipping for `research` and `frame`, whose tool lists lose only `Edit` and `NotebookEdit`? A smaller scope (`score` only) would still meet change.md's intent for the one step where the restriction bites. Owner decision.
7. Not verified here: whether a plugin agent's `tools` list also filters MCP tools in a foreground subagent (the docs describe the background case only), and whether `10x-research`'s own `Task*` and `AskUserQuestion` allowed-tools matter inside a restricted agent (the docs say the second is always removed for subagents). Both need a live check before the agent files are written.
