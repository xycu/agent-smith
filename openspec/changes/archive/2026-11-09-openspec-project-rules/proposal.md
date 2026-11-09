# Proposal

## Why

`openspec/config.yaml` holds only `schema: spec-driven` and the commented examples of `openspec init`. OpenSpec therefore injects no project context and no per-artifact rules into its instructions, so a proposal, spec, design or task list written for this repository does not know its hard rules (AGENTS.md "Hard Rules", ADR-004, ADR-006, ADR-008) and can plan an npm dependency, a routing rule outside the router or an edit of `context/archive/`.

## What Changes

- Fill `openspec/config.yaml` with a short `context` block that states the repository constraints an agent cannot infer from one file: Node 24 or later with `node:` built-ins only and no npm dependencies (ADR-006); prompt rules in GIVEN/WHEN/THEN form with exactly one bold RFC 2119 keyword (ADR-004); Conventional Commits for every commit subject (ADR-008); `context/archive/` is never edited; routing decisions live only in `skills/10x-pipeline/scripts/route.mjs` (and the modules it imports under `scripts/`) and `skills/10x-pipeline/policy.json`.
- Add `rules` for the artifacts `proposal`, `specs`, `design` and `tasks`, each a few lines that turn the constraints into checks for that artifact.
- Keep `schema: spec-driven` and keep the whole file under 40 lines.
- Out of scope: any change to the router (`skills/10x-pipeline/scripts/`, `policy.json`) or to the tests (`skills/10x-pipeline/test/`, `tools/test/`).

## Capabilities

### New Capabilities

- `openspec-project-config`: the project configuration OpenSpec reads from `openspec/config.yaml` for this repository: the schema, the project context injected into every artifact instruction and the per-artifact rules.

### Modified Capabilities

None. `openspec/specs/` holds no spec yet (`openspec list --specs` reports "No specs found.").

## Impact

- One file changes: `openspec/config.yaml`.
- Every later `openspec instructions <artifact>` call in this repository returns the new `context` and the artifact's `rules`, so later OpenSpec changes (including runs of `/agent-smith:openspec-pipeline` on this repository) are written against these rules.
- No code, policy, prompt, test or dependency changes. The test suite does not read the repository's `openspec/config.yaml` (its scratch projects write their own, `skills/10x-pipeline/test/openspec-helpers.mjs:43`).
