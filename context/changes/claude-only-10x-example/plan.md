# Restore the shipped Claude-only ladder: README recipe Implementation Plan

## Overview

Add a short recipe to the README `## ⚙️ Configure` section for a project whose `context/foundation/agent-smith-policy.json` carries the OpenAI ladder (the `codex-policy.json` preset). The recipe restores the shipped Claude ladder, keeps every unrelated override key, explains that arrays replace whole, and tells the reader how to check the override ladder and the run providers when a fresh run starts. A small test keeps the published snippet equal to the shipped ladder. Docs and one test only; no router, policy or prompt change.

## Current State Analysis

- README Configure (`README.md:122-136`) documents the price override, the opt-in fable ladder merge and the subagent depth setting. It has no path back from an OpenAI ladder to the Claude ladder.
- `docs/REFERENCE.md:23` (upgrade note) says to "re-merge the entire preset ladder ... preserving unrelated keys" for the OpenAI preset. Nothing says how to go the other way.
- The shipped Claude ladder is the eight rungs in `skills/10x-pipeline/policy.json` (`ladder`, haiku/low to opus/max, no `provider` key). The OpenAI ladder is `skills/10x-pipeline/codex-policy.json`, every rung `provider: "openai"`.
- Merge rule: objects merge key by key, arrays replace whole (`docs/REFERENCE.md` fable section, "Arrays replace whole"). `providerLadder` in `skills/10x-pipeline/scripts/state.mjs:120-131` replaces a provider's ladder only with a homogeneous override; a mixed one overlays by ordinal position. A leftover `provider: "openai"` rung therefore keeps its position OpenAI.
- A project override may not carry `splitProviders` (`state.mjs:80-81`). A step ceiling above the last rung index fails the policy check at load (ADR-022).
- Verified by a scratch smoke run: with the OpenAI preset as the project ladder, `init demo --goal x` on a Claude host returns `providerMode: "claude"`, `providersByStep` all `claude`, and `provider`, `model`, `effort` of the first step. `init` is therefore the documented place to read the effective providers (`docs/REFERENCE.md:17`: "Init returns `providerMode` and `providersByStep`"). Review check (same scratch run): `init` reports the same all-Claude result and `model: "sonnet"` for the first step before the recipe is applied, because a homogeneous OpenAI ladder never matches a Claude-assigned run and `providerLadder` falls back to the shipped Claude rungs. `init` output therefore confirms the run mode and provider only; it cannot show whether the project `ladder` was restored. `init` also starts the run (`run.jsonl` and `meta.json` are written and the mode is fixed; there is no in-place conversion), so it is not a read-only check.
- Test precedent for a documented snippet: `skills/10x-pipeline/test/ladder.test.mjs:399-430` extracts the fable JSON fence from `docs/REFERENCE.md` and asserts it against the shipped policy.

## Desired End State

A reader with an OpenAI-configured project finds, under README Configure, a recipe that: (1) replaces only the `ladder` key with the shipped eight Claude rungs, or deletes the key; (2) leaves `compare`, `limits`, `codex.profile` and any other key alone; (3) says why (arrays replace whole, so no rung-by-rung editing, and a stale `provider: "openai"` rung stays OpenAI); (4) names the leftovers to clear (`steps.*.maxTier` above 7, never `splitProviders`); (5) ends with the check, in two parts: confirm the override's `ladder` equals the published rungs (no `provider` key left in it; `init` cannot show this), then start the fresh run with `init --provider-mode claude`, which fixes the mode, and require `providerMode: "claude"`, every `providersByStep` value `claude` and a Claude model in the first step. The test suite fails if the published ladder drifts from `policy.json`.

### Key Discoveries:

- `skills/10x-pipeline/scripts/state.mjs:120-131`: homogeneous override replaces a provider ladder, mixed overlays by index.
- `skills/10x-pipeline/scripts/state.mjs:80-81`: `splitProviders` in an override halts.
- `docs/REFERENCE.md:17`: init shows `providerMode` and `providersByStep` before launch.
- `skills/10x-pipeline/test/ladder.test.mjs:399-430`: fence-extraction test pattern to copy; `makeProject({ policy })`, `init` and `run` helpers in `skills/10x-pipeline/test/helpers.mjs`.
- The S-12 launch manifest (`first-unattended-delivery`, `evidence/launch.md`) named in `change.md` is not in this repository, so wording follows the code and `docs/REFERENCE.md`.

## What We're NOT Doing

- No change to `route.mjs`, `scripts/`, `policy.json`, `codex-policy.json`, prompts or rules.
- No new command or flag, and no detection of a stale OpenAI ladder by the router.
- No `AGENTS.md` change, no `CHANGELOG.md` edit (release-please owns it), no version edit.
- No recipe for OpenAI or split mode, and no rewrite of the fable section.
- No new test file, so no new row in `skills/10x-pipeline/test/README.md`.
- No push, PR or `gh` call (the orchestrator publishes).

## Implementation Approach

Put the recipe in the README Configure section as a short `###` subsection (the change goal names README). Add one cross-link sentence in `docs/REFERENCE.md` beside the OpenAI upgrade note. Guard the JSON snippet with a test that reads the README fence, compares it to `policy.json`, and drives `init` in a scratch project holding an OpenAI override plus unrelated keys. Both phases are locally executable; the full suite runs at the end.

## Phase 1: Document the recipe

### Overview

README subsection plus one REFERENCE cross-link.

### Changes Required:

#### 1. README Configure recipe

**File**: `README.md`

**Intent**: Add `### Restore the shipped Claude ladder` directly before `### Claude Code subagent depth`, after the "Opt-in extras" paragraph, so the missing-price and opt-in-extras paragraphs stay outside the new subsection. It tells an OpenAI-configured project how to return to Claude and how to prove it.

**Contract**: One short intro sentence naming the symptom (project override holds the `codex-policy.json` rungs). A single JSON fence with exactly one key, `ladder`, equal to the eight shipped rungs in `skills/10x-pipeline/policy.json`, no `provider` key. Prose, in this order: merge only the `ladder` key into `context/foundation/agent-smith-policy.json`, or delete that key to take the shipped default; arrays replace whole, so paste all eight rungs and never patch single rungs, because a leftover `provider: "openai"` rung keeps its position on OpenAI; leave `compare`, `limits`, `codex.profile` and other keys untouched; delete `steps.<name>.maxTier` values above 7 left from a longer ladder and never add `splitProviders`; verify the file first, since `init` cannot show the ladder (no rung in the override's `ladder` has a `provider` key, and the rungs equal the fence); then run `init --provider-mode claude` in the run worktree and read `providerMode` (`claude`), `providersByStep` (every value `claude`) and the first step's `provider`/`model`. Say plainly that `init` starts the run and fixes its mode, so the ladder is restored before it, and that a resumed run keeps its stored mode, so this applies to a fresh run only. End with a link to `docs/REFERENCE.md#codex-and-provider-dispatch`. Keep the section's house style; no emoji in the heading, and prose names no literal model outside the JSON fence.

#### 2. REFERENCE cross-link

**File**: `docs/REFERENCE.md`

**Intent**: Point readers who adopted the OpenAI preset to the way back, so the two directions sit together.

**Contract**: Append one sentence to the "Upgrade note" paragraph in `## Codex and provider dispatch` (line 23): to return a project to the shipped Claude ladder, follow the README recipe, `README.md#restore-the-shipped-claude-ladder`. No other REFERENCE edit.

### Success Criteria:

#### Automated Verification:

- README holds the recipe heading and its JSON fence has a single `ladder` key of eight rungs with no `provider`: `node -e "const t=require('fs').readFileSync('README.md','utf8');const s=t.split('### Restore the shipped Claude ladder')[1];if(!s)process.exit(1);const j=JSON.parse(s.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/)[1]);if(Object.keys(j).join()!=='ladder'||j.ladder.length!==8||JSON.stringify(j).includes('provider'))process.exit(1)"`
- REFERENCE links to the recipe: `grep -n "README.md#restore-the-shipped-claude-ladder" docs/REFERENCE.md`
- No SKILL.md file changed (SKILL.md names no literal models or effort levels): `! git diff --name-only main...HEAD | grep -q SKILL.md` (exit 0 when no SKILL.md is in the branch diff)
- AGENTS.md checks still pass: `node --test tools/test/agents-md-no-imports.test.mjs tools/test/agents-md-size.test.mjs`

#### Manual Verification:

- The README recipe reads correctly in the rendered Configure section, and its wording matches the S-12 launch intent (the manifest is not in this repository).

---

## Phase 2: Guard the snippet with a test

### Overview

Keep the published ladder equal to the shipped one, and prove that the recipe really yields Claude providers while unrelated keys survive.

### Changes Required:

#### 1. README recipe test

**File**: `skills/10x-pipeline/test/ladder.test.mjs`

**Intent**: Append a block after the fable tests, following the same fence-extraction pattern, reading `README.md` instead of `docs/REFERENCE.md`.

**Contract**: Extract the JSON fence after `### Restore the shipped Claude ladder` in `README.md` (assert it exists). Test 1: its keys are exactly `["ladder"]`, it deep-equals `policy.ladder`, and no rung has a `provider` key. Test 2: build an override from `codex-policy.json` `ladder` plus `compare: { targetDropPercent: 30 }`, `limits: { maxNeutralRetries: 3, maxFixLoops: 3 }` and `codex: { profile: "work" }`; apply the recipe by replacing `ladder` only; `makeProject({ policy })`, before applying the recipe, load the policy with the probe and assert the merged ladder is the OpenAI one (every rung `providerOf` `openai`), as the negative control; then, with the recipe applied, run `init <id> --goal <GOAL> --provider-mode claude` and assert `providerMode` is `claude`, every `providersByStep` value is `claude`, `provider` is `claude`, and the first step's model is in the shipped ladder; then load the merged policy again (same probe as the fable test, `loadPolicy`) and assert `compare`, `limits` and `codex` equal the override values and `ladder` deep-equals `policy.ladder`. The probe assertions carry the proof that the recipe restored the ladder; the `init` assertions only confirm the run is Claude, since they also hold before the recipe. Add a third test: a mixed override that keeps one `provider: "openai"` rung at index 3 makes `stepPolicy(loadedPolicy, { providerMode: "codex" }, "plan").ladder[3]` that OpenAI rung, which backs the README sentence on leftover rungs (`stepPolicy` and `providerOf` are exported from `skills/10x-pipeline/scripts/state.mjs`). Reuse the existing imports and helpers; add none.

### Success Criteria:

#### Automated Verification:

- The new tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/ladder.test.mjs`
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete and no commit-lint breakage: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` and `node tools/commit-lint.mjs main..HEAD`
- Smoke check in a scratch project with the recipe merged into an OpenAI override (a scratch git project with `context/changes/demo/change.md` and an override holding the recipe `ladder` plus `isolation.require: false`): `node skills/10x-pipeline/scripts/route.mjs init demo --goal x --provider-mode claude | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));if(j.action!=='run'||j.providerMode!=='claude'||Object.values(j.providersByStep).some(p=>p!=='claude'))process.exit(1)"` exits 0

#### Manual Verification:

- (none)

---

## Testing Strategy

### Unit Tests:

- README fence equals `policy.ladder`, one key, no `provider`.
- Recipe applied to an OpenAI override leaves `compare`, `limits`, `codex.profile` intact and the merged ladder equal to the shipped one.

### Integration Tests:

- `init` through the real CLI in a scratch project returns `providerMode: "claude"` and all-Claude `providersByStep`.

### Manual Testing Steps:

1. Read the rendered README Configure section and confirm the recipe order and links.

## Performance Considerations

None. Docs and one test.

## Migration Notes

None. Existing overrides are not rewritten; the recipe is opt-in and applies between runs, since a resumed run keeps its stored mode and recorded ladder provenance (a regular `next` records `ladder` drift when the effective ladder changed).

## References

- Change identity: `context/changes/claude-only-10x-example/change.md`
- Shipped ladders: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/codex-policy.json`
- Provider and ladder behavior: `docs/REFERENCE.md#codex-and-provider-dispatch`, `docs/REFERENCE.md#opt-in-fable-ladder`
- Ladder resolution: `skills/10x-pipeline/scripts/state.mjs:80-131`
- Similar snippet test: `skills/10x-pipeline/test/ladder.test.mjs:399-430`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Document the recipe

#### Automated

- [x] 1.1 README holds the recipe heading and its JSON fence has a single `ladder` key of eight rungs with no `provider` — cd1a9abf
- [x] 1.2 REFERENCE links to the recipe anchor — cd1a9abf
- [x] 1.3 No SKILL.md file changed — cd1a9abf
- [x] 1.4 AGENTS.md checks still pass — cd1a9abf

#### Manual

- [ ] 1.5 README recipe reads correctly in the rendered Configure section

### Phase 2: Guard the snippet with a test

#### Automated

- [x] 2.1 The new ladder tests pass — cd1a9abf
- [x] 2.2 The full suite passes — cd1a9abf
- [x] 2.3 No-recursive-delete test and commit-lint pass — cd1a9abf
- [x] 2.4 Smoke check in a scratch project returns all-Claude providers — cd1a9abf
