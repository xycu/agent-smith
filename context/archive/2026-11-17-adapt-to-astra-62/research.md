---
date: 2026-11-17T22:59:29Z
researcher: Claude (Opus 5.5)
git_commit: ca97aaef
branch: claude/adapt-openai-models-4e6ef1
repository: agent-smith
topic: "Adapt to newly released OpenAI models: change the Sol and Astra versions"
tags: [research, codex, openai, ladder, codex-policy, policy]
status: complete
last_updated: 2026-11-17
last_updated_by: Claude (Opus 5.5)
---

# Research: Adapt to newly released OpenAI models (Sol and Astra versions)

**Date**: 2026-11-17T22:59:29Z
**Researcher**: Claude (Opus 5.5)
**Git Commit**: ca97aaef
**Branch**: claude/adapt-openai-models-4e6ef1
**Repository**: agent-smith

## Research Question

OpenAI has released new models. Where does agent-smith name the Sol and Astra model ids, what are the new ids, and what changes when they are swapped? (Source: `context/changes/adapt-to-astra-62/change.md`.)

## Summary

- Current OpenAI model page (https://learn.chatgpt.com/docs/models, read 2026-11-17) lists `gpt-6.2-astra` and `gpt-6.2-sol` as new ids. The repository uses `gpt-6-astra` and `gpt-6.1-sol`. The change-id `astra-62` matches `gpt-6.2-astra`.
- Live (non-archive) files that name those ids: exactly 3 inspected files.
  - `skills/10x-pipeline/codex-policy.json:4-10` is the shipped opt-in GPT ladder preset.
  - `context/foundation/agent-smith-policy.json:13-43` is this repository's own project override. It is a copy of that preset.
  - `skills/10x-pipeline/test/providers.test.mjs:37-40` asserts the preset's model ids by exact value.
- Other places the router uses the preset read it by file, not by literal id. These are 5 test files and `codex-helpers.mjs`. A rename there needs no edit.
- The router does not validate model names. `policyProblems` checks only that `model` is a non-empty string (`skills/10x-pipeline/scripts/state.mjs:178`). The runner passes the id verbatim to `codex exec` (`skills/10x-pipeline/scripts/run-codex.mjs:46-47`). So this is a data change with no code change.
- No docs or ADRs name a GPT model id: `README.md`, `docs/REFERENCE.md`, `docs/ADR/` and `AGENTS.md` were grepped for `gpt-[0-9]`, `sol` and `astra`. Docs therefore need no edit unless the plan adds a mention.

## Detailed Findings

### Shipped GPT preset

- `skills/10x-pipeline/codex-policy.json:3-10` holds 8 rungs, all `provider: "openai"`:
  - rung 0: `gpt-6-luna`/`low`
  - rungs 1-3: `gpt-6.1-sol` at `low`, `medium`, `high`
  - rungs 4-7: `gpt-6-astra` at `medium`, `high`, `xhigh`, `max`
- `README.md:42` tells users to merge this file into `context/foundation/agent-smith-policy.json`. Because arrays replace whole, users who already merged it keep the old ids until they merge again. The README does not name ids.

### This repository's own override

- `context/foundation/agent-smith-policy.json:5-46` holds the same 8 rungs as the preset, plus `compare` and `limits` keys.
- It is the policy that this repo's own pipeline runs use. Because it holds `provider: "openai"` rungs only, it is valid on a Codex host (`skills/10x-pipeline/scripts/state.mjs:106`).
- The last commit to touch it was `d825e4d9`.

### Test that pins the ids

- `skills/10x-pipeline/test/providers.test.mjs:34-49` asserts three things:
  - the preset's ladder model list is exactly `["gpt-6-luna", "gpt-6.1-sol" ×3, "gpt-6-astra" ×4]` (lines 37-40);
  - the effort list equals the Claude default ladder's effort list (line 36);
  - `policyProblems` returns null for the merged preset (lines 45-47).
- A model swap breaks only the assertion at lines 37-40, which must change with the preset.
- The other preset readers take the file as data: `prompt-handoff.test.mjs:25`, `codex-chain.test.mjs:15`, `codex-runner.test.mjs:15`, `host-integration.test.mjs:14` and `codex-helpers.mjs:11`. None of them matched a literal `gpt-` id in the grep.

### Validation and dispatch

- `policyProblems` checks `model` and `effort` as non-empty strings. It also checks that `effort` is in `rigor.effortOrder` (`skills/10x-pipeline/scripts/state.mjs:174-182`). That order is `["low", "medium", "high", "xhigh", "max"]` (`skills/10x-pipeline/policy.json:69`). Model names have no allow-list.
- `run-codex.mjs` refuses an action only when `model` or `effort` is empty or holds NUL, CR or LF (`run-codex.mjs:46-47`). It sends effort as `-c model_reasoning_effort=...` (`run-codex.mjs:129`).

### New OpenAI ids (external source)

Read from https://learn.chatgpt.com/docs/models on 2026-11-17. The page shows no last-updated date.

- New: `gpt-6.2-astra` (card "6.2 Astra") and `gpt-6.2-sol` (card "6.2 Sol"). The page's example config uses `model = "gpt-6.2-sol"`.
- Still listed, and not in the page's deprecated section: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`. No newer Luna id is listed, so rung 0 (`gpt-6-luna`) has no successor.
- Codex CLI minimum: the page states a minimum for `gpt-6.1-terra` only (0.159.0). It states no minimum for the 6.2 models. The repo's verified runner contract is Codex CLI 0.169.0 (`README.md:38`).
- Effort: the page does not list per-model effort values for the 6.2 models. It names Low, Medium, High, Extra High and Max as levels. It says to check the supported Max/Ultra options per model with `/model` → "More reasoning…" in the CLI. Whether `gpt-6.2-astra` accepts `xhigh` and `max`, which rungs 6-7 use, is not confirmed by the page.

### Provenance effect on runs in flight

- `ladder` is a hashed policy section and is in `provenance.expected.pinned` (`skills/10x-pipeline/policy.json:101`, `skills/10x-pipeline/scripts/isolation.mjs:20`).
- So a run started before the swap records `provenance.drift` for `ladder` at its next `next` call. In a pinned `compare`, a run on old ids and a run on new ids differ on `ladder`. Docs record such drift with an "Upgrade note" bullet (pattern at `docs/REFERENCE.md:170`, `:271`, `:392`).
- Live changes now in flight in this checkout: `first-unattended-delivery` and `quote-router-in-skill-loops` (`context/changes/`). This research did not check whether either has an active run log.

## Code References

- `skills/10x-pipeline/codex-policy.json:3-10` - GPT ladder preset (ids to change)
- `context/foundation/agent-smith-policy.json:5-46` - this repo's override, a copy of the preset
- `skills/10x-pipeline/test/providers.test.mjs:37-40` - exact-id assertion on the preset
- `skills/10x-pipeline/scripts/state.mjs:174-182` - ladder validation (strings and effortOrder only)
- `skills/10x-pipeline/scripts/run-codex.mjs:46-47,129` - runner passes model/effort verbatim
- `skills/10x-pipeline/policy.json:69,101` - effortOrder; ladder pinned in provenance
- `README.md:38,42` - verified Codex CLI version; preset merge instructions

## Architecture Insights

- Model choice lives only in policy data. This follows the AGENTS.md hard rule that routing decisions sit in `policy.json`/router modules and that SKILL.md names no literal models.
- The preset keeps tier and effort positions equal to the Claude ladder (`providers.test.mjs:36`). Swapping ids keeps that invariant as long as the efforts stay unchanged.

## Historical Context (from prior changes)

- `context/archive/2026-11-13-openai-codex-support/research.md:139-145` - picked ids from the same OpenAI models page. At that time the recommended ids were `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra` and `gpt-6-luna`, and `xhigh`/`max` were noted as levels. Today that holds partly: all four ids are still listed, but they are no longer the newest Sol/Astra.
- `context/archive/2026-11-13-openai-codex-support/plan.md:54-61` - the rung table that set today's mapping: Luna for rung 0, Sol for rungs 1-3, Astra for rungs 4-7.
- `context/archive/2026-11-13-openai-codex-support/evidence/verification.md:11-12` - a live smoke run used `gpt-6.1-sol`/`medium` and `gpt-6-astra`/`high`. No live run with 6.2 ids exists.

## Related Research

- `context/archive/2026-11-13-openai-codex-support/research.md`

## Open Questions

1. Does `gpt-6.2-astra` accept `model_reasoning_effort` `xhigh` and `max` under Codex CLI 0.169.0? Rungs 6-7 need both. The page does not say. A live `codex exec` probe, or `/model` → "More reasoning…", answers it.
2. Should the project override `context/foundation/agent-smith-policy.json` change in the same change as the shipped preset? It is a copy today, so changing both keeps them equal.
3. Is a `docs/REFERENCE.md` upgrade note about `ladder` provenance drift wanted? Earlier policy changes added one.
4. `gpt-6-luna` (rung 0) has no newer id. Keep it unchanged unless the owner wants Sol at rung 0.
