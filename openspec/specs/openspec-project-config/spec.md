# openspec-project-config Specification

## Purpose
Gives every OpenSpec artifact written in this repository the project's hard rules, through the context and per-artifact rules of `openspec/config.yaml`.

## Requirements

### Requirement: Spec-driven schema
`openspec/config.yaml` SHALL keep `schema: spec-driven` as the project's default schema.

#### Scenario: Schema stays in force
- **WHEN** `openspec status --change "<name>" --json` runs for a change of this repository that names no schema
- **THEN** the output reports `schemaName` `spec-driven`

### Requirement: Project context names the hard rules
`openspec/config.yaml` SHALL hold a non-empty `context` that states each of these constraints: Node.js 24 or later with `node:` built-ins only and no npm dependencies; prompt rules in GIVEN/WHEN/THEN form with exactly one bold RFC 2119 keyword (ADR-004); Conventional Commits for commit subjects; `context/archive/` is never edited; routing decisions only in `route.mjs` (with the modules it imports under `scripts/`) and `policy.json`.

#### Scenario: Context reaches every artifact instruction
- **WHEN** `openspec instructions <artifact> --change "<name>" --json` runs for `proposal`, `specs`, `design` or `tasks`
- **THEN** the output has a `context` field that names Node 24, `node:` built-ins, no npm dependencies, GIVEN/WHEN/THEN with one bold RFC 2119 keyword, Conventional Commits, `context/archive/`, `route.mjs` and `policy.json`

#### Scenario: Config parses without warnings
- **WHEN** any `openspec` command reads `openspec/config.yaml`
- **THEN** it prints no warning about an invalid, unknown or ignored config field

### Requirement: Per-artifact rules
`openspec/config.yaml` SHALL hold a non-empty `rules` list for each of the artifact IDs `proposal`, `specs`, `design` and `tasks`, and no rules key for any other ID.

#### Scenario: Rules reach their artifact
- **WHEN** `openspec instructions <artifact> --change "<name>" --json` runs for `proposal`, `specs`, `design` or `tasks`
- **THEN** the output has a non-empty `rules` array for that artifact

#### Scenario: Spec rules keep the OpenSpec format
- **WHEN** the `specs` rules are read
- **THEN** no rule asks for the ADR-004 prompt-rule form inside a delta spec, whose requirements use SHALL or MUST and whose scenarios use `#### Scenario:` with WHEN and THEN bullets

### Requirement: Short config file
`openspec/config.yaml` SHALL have fewer than 40 lines.

#### Scenario: Line count
- **WHEN** `wc -l < openspec/config.yaml` runs
- **THEN** it prints a number below 40
