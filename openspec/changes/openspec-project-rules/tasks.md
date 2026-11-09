# Tasks

## 1. Project context

- [ ] 1.1 Replace the commented examples in `openspec/config.yaml` with `schema: spec-driven` and a `context: |` block that states Node 24 with `node:` built-ins only and no npm dependencies, prompt rules in GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (ADR-004), Conventional Commits, `context/archive/` never edited, and routing decisions only in `route.mjs` and `policy.json`; verify that `openspec instructions proposal --change "openspec-project-rules" --json` returns a `context` field naming each of them and that `openspec status --change "openspec-project-rules" --json` still reports `schemaName` `spec-driven`

## 2. Per-artifact rules

- [ ] 2.1 Add a `rules` map with non-empty lists for `proposal`, `specs`, `design` and `tasks` as in design.md "Decisions", the `specs` list keeping OpenSpec's SHALL/MUST and `#### Scenario:` form; verify that `openspec instructions <artifact> --change "openspec-project-rules" --json` returns a non-empty `rules` array for each of the four artifacts and that no `openspec` command prints a config warning (no "Unknown artifact ID", "Invalid" or "ignoring" line on stderr)

## 3. Integration checks

- [ ] 3.1 Verify that `wc -l < openspec/config.yaml` prints a number below 40
- [ ] 3.2 Verify that `git diff --name-only` against the run's start commit lists no path under `skills/`, `tools/`, `agents/` or `docs/`, and that `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` still passes
- [ ] 3.3 Verify that `openspec validate "openspec-project-rules" --json` reports no `ERROR`
