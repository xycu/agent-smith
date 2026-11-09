# Design

## Context

See proposal.md - Why. `openspec/config.yaml` today is `schema: spec-driven` plus the commented examples `openspec init` wrote. OpenSpec 1.16.1 parses `context` as one string (limit 50 KB, injected into every artifact instruction) and `rules` as a map from artifact ID to a list of strings (`dist/core/project-config.js:29-41`, `:270-316`). It warns on an artifact ID the schema does not know (`project-config.js:411`). The `spec-driven` schema has the artifacts `proposal`, `specs`, `design` and `tasks` (`openspec status --change "openspec-project-rules" --json`).

The sources of the constraints: `AGENTS.md:7` (routing only in `route.mjs`, its `scripts/` modules and `policy.json`), `AGENTS.md:11` and ADR-006 (Node 24, `node:` built-ins, no npm dependencies), `AGENTS.md:12` (`context/archive/` read-only), `AGENTS.md:75` and ADR-008 (Conventional Commits), `docs/ADR/ADR-004-prompt-rules-as-scenarios.md:23` (one bold RFC 2119 keyword per rule line).

## Goals / Non-Goals

**Goals:**
- One file, `openspec/config.yaml`, under 40 lines, with `schema`, `context` and `rules`.
- Each constraint stated once in `context`; `rules` turn it into a check per artifact.

**Non-Goals:**
- No `operations` block (apply and archive guidance): the goal asks for context and per-artifact rules only.
- No change to the router, `policy.json`, the prompts, `AGENTS.md` or the tests.

## Decisions

- **Drop the commented examples.** The `openspec init` comments take 26 lines; with them the file cannot hold context and four rule lists under 40 lines. Alternative: keep a one-line pointer to the OpenSpec docs. Rejected as noise; the CLI documents the keys.
- **Context as a YAML block scalar (`context: |`)** with one short line per constraint. It is the form the `openspec init` example shows and keeps each rule on its own line in the injected text.
- **Rules per artifact, two or three lines each.**
  - `proposal`: list each hard rule the change touches in Impact; state out-of-scope items; a change that needs an npm dependency or moves routing out of `route.mjs`/`policy.json` says so as a conflict with AGENTS.md.
  - `specs`: specs describe behavior, not file paths; they keep OpenSpec's SHALL/MUST and `#### Scenario:` form. ADR-004 applies to prompt files under `skills/10x-pipeline/prompts/` and `policy.json` prompt strings, not to delta specs. Alternative: ask for GIVEN/WHEN/THEN with bold keywords in specs too. Rejected: OpenSpec's spec instruction asks for SHALL/MUST, and ADR-004 forbids an upper-case `SHALL` in prompts, so one form cannot serve both.
  - `design`: name the ADR a decision follows or changes; new code uses only `node:` built-ins and runs on Node 24.
  - `tasks`: each task names its verification command (`node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` for router, prompt or tool changes); never a task that edits `context/archive/` or hand-edits `agent-smith/run.jsonl` or `meta.json`; commit subjects as Conventional Commits.
- **Reference ADRs by number, not by path.** Short lines keep the file under 40 lines; `docs/ADR/` names each file by its number.

## Risks / Trade-offs

- [The context repeats AGENTS.md and can drift from it] → Keep the context to the five constraints of the goal and name AGENTS.md as the full source.
- [A rule an agent reads as applying ADR-004 to specs makes `openspec validate` fail or warn] → The `specs` rule says in words that the OpenSpec spec form stays.
- [`AGENTS.md:46` says the repository has no `openspec/` folder, which is no longer true] → Out of scope for this change (goal: fill `config.yaml`); noted for a later docs change.
