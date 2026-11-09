# Check 3, CLI part: OpenSpec facts the router copies

ADR-013 precondition 3 has two parts. This file holds the CLI facts (plan Phase 1 item 2). The live run of the guides is recorded in `check-3-live.md`.

Observed on 2026-11-09 between 04:37 and 04:45 CET with `openspec` 1.16.1 (`/opt/homebrew/bin/openspec`) and Node v24.19.0, in the scratch project `/tmp/claude-501/os-cli-check.1feotw` (realpath `/private/tmp/claude-501/os-cli-check.1feotw`, made with `mktemp -d "$TMPDIR/os-cli-check.XXXXXX"`; the repository was not touched). No environment variable was needed: the CLI ran inside the sandbox with no telemetry or config write that failed.

JSON is trimmed to the fields the router copies; `artifacts[]` keeps `id`, `status`, `requires` and `missingDeps`, `artifactPaths` keeps `existingOutputPaths`, `tasks[]` keeps `id`, `description`, `done` and `line`, and `contextFiles` shows its keys. The first status and apply outputs are shown in full.

## Setup

```
$ D=$(mktemp -d "$TMPDIR/os-cli-check.XXXXXX") && cd "$D"
$ mkdir -p openspec/specs openspec/changes/archive
$ printf 'schema: spec-driven\n' > openspec/config.yaml
```

## 1. What `openspec new change` creates

```
$ openspec new change greet-cli
- Creating change 'greet-cli' with schema 'spec-driven'...
Created change 'greet-cli' at openspec/changes/greet-cli/
Schema: spec-driven
Next: openspec status --change greet-cli
exit=0

$ ls -la openspec/changes/greet-cli
-rw-r--r--@ 1 blazej  wheel   40 Nov  9 04:37 .openspec.yaml
$ cat openspec/changes/greet-cli/.openspec.yaml
schema: spec-driven
created: 2026-11-09
```

"The change exists" therefore means: the folder `openspec/changes/<n>/` exists and holds `.openspec.yaml` (`schema`, `created`). No artifact file, no `specs/` folder.

## 2. Status and apply readiness per planning state

### S0: empty change (only `.openspec.yaml`), full output

```
$ openspec status --change greet-cli --json        # exit 0
{
  "changeName": "greet-cli",
  "schemaName": "spec-driven",
  "planningHome": { "kind": "repo", "root": "/private/tmp/claude-501/os-cli-check.1feotw",
    "changesDir": "/private/tmp/claude-501/os-cli-check.1feotw/openspec/changes", "defaultSchema": "spec-driven" },
  "changeRoot": "/private/tmp/claude-501/os-cli-check.1feotw/openspec/changes/greet-cli",
  "artifactPaths": {
    "proposal": { "outputPath": "proposal.md", "resolvedOutputPath": ".../greet-cli/proposal.md", "existingOutputPaths": [] },
    "specs": { "outputPath": "specs/**/*.md", "resolvedOutputPath": ".../greet-cli/specs/**/*.md", "existingOutputPaths": [] },
    "design": { "outputPath": "design.md", "resolvedOutputPath": ".../greet-cli/design.md", "existingOutputPaths": [] },
    "tasks": { "outputPath": "tasks.md", "resolvedOutputPath": ".../greet-cli/tasks.md", "existingOutputPaths": [] }
  },
  "isPlanningComplete": false,
  "isComplete": false,
  "applyRequires": ["tasks"],
  "nextSteps": ["Run openspec instructions proposal --change \"greet-cli\" --json before writing that artifact."],
  "actionContext": { "mode": "repo-local", "sourceOfTruth": "repo", "planningArtifacts": ["proposal","specs","design","tasks"],
    "linkedContext": [], "allowedEditRoots": ["/private/tmp/claude-501/os-cli-check.1feotw"],
    "requiresAffectedAreaSelection": false,
    "constraints": ["Repo-local change artifacts and implementation edits are scoped to this project."] },
  "artifacts": [
    { "id": "proposal", "outputPath": "proposal.md", "status": "ready", "requires": [] },
    { "id": "specs", "outputPath": "specs/**/*.md", "status": "blocked", "requires": ["proposal"], "missingDeps": ["proposal"] },
    { "id": "design", "outputPath": "design.md", "status": "blocked", "requires": ["proposal"], "missingDeps": ["proposal"] },
    { "id": "tasks", "outputPath": "tasks.md", "status": "blocked", "requires": ["specs","design"], "missingDeps": ["specs","design"] }
  ],
  "root": { "path": "/private/tmp/claude-501/os-cli-check.1feotw", "source": "nearest" }
}

$ openspec instructions apply --change greet-cli --json        # exit 0
{
  "changeName": "greet-cli",
  "changeDir": "/private/tmp/claude-501/os-cli-check.1feotw/openspec/changes/greet-cli",
  "schemaName": "spec-driven",
  "contextFiles": {},
  "progress": { "total": 0, "complete": 0, "remaining": 0 },
  "tasks": [],
  "taskTrackingConfigured": true,
  "state": "blocked",
  "missingArtifacts": ["tasks"],
  "missingPrerequisites": ["proposal","specs","design","tasks"],
  "instruction": "Cannot apply this change yet. Missing artifacts: tasks.\nNot created yet, in build order: proposal, specs, design, tasks. Build the ones this change needs before applying - the schema says which are conditional.\nCreate each with `openspec instructions <artifact> --change greet-cli` (`openspec status --change greet-cli` shows what is left).",
  "root": { "path": "/private/tmp/claude-501/os-cli-check.1feotw", "source": "nearest" }
}
```

### S1: proposal only

`proposal.md` with `## Why`, `## What Changes`, `## Capabilities` (new capability `greeting`) and `## Impact`.

```
$ openspec status --change greet-cli --json        # exit 0, trimmed
{ "isPlanningComplete": false, "isComplete": false, "applyRequires": ["tasks"],
  "artifacts": [
    { "id": "proposal", "status": "done", "requires": [] },
    { "id": "specs", "status": "ready", "requires": ["proposal"] },
    { "id": "design", "status": "ready", "requires": ["proposal"] },
    { "id": "tasks", "status": "blocked", "requires": ["specs","design"], "missingDeps": ["specs","design"] } ],
  "existingOutputPaths": { "proposal": ["openspec/changes/greet-cli/proposal.md"], "specs": [], "design": [], "tasks": [] } }

$ openspec instructions apply --change greet-cli --json        # exit 0, trimmed
{ "state": "blocked", "progress": { "total": 0, "complete": 0, "remaining": 0 },
  "missingArtifacts": ["tasks"], "missingPrerequisites": ["specs","design","tasks"],
  "tasks": [], "contextFiles": ["proposal"],
  "instruction": "Cannot apply this change yet. Missing artifacts: tasks.\nNot created yet, in build order: specs, design, tasks. Build the ones this change needs before applying - the schema says which are conditional.\n..." }
```

### S2: proposal, one `specs/greeting/spec.md` and `tasks.md`, no `design.md`

The delta spec:

```
## ADDED Requirements

### Requirement: Greet by name
The system SHALL print a greeting for the name given as the first argument, and a greeting for the world when no argument is given.

#### Scenario: Name given
- **WHEN** the user runs `./greet.sh Ada`
- **THEN** the output is `Hello, Ada!`

#### Scenario: No name given
- **WHEN** the user runs `./greet.sh` with no argument
- **THEN** the output is `Hello, world!`
```

`tasks.md`: three rows `- [ ] 1.1 ...`, `- [ ] 1.2 ...`, `- [ ] 2.1 ...` under `## 1. Script` and `## 2. Check`.

```
$ openspec status --change greet-cli --json        # exit 0, trimmed
{ "isPlanningComplete": false, "isComplete": false, "applyRequires": ["tasks"],
  "artifacts": [
    { "id": "proposal", "status": "done", "requires": [] },
    { "id": "specs", "status": "done", "requires": ["proposal"] },
    { "id": "design", "status": "ready", "requires": ["proposal"] },
    { "id": "tasks", "status": "done", "requires": ["specs","design"] } ],
  "existingOutputPaths": { "proposal": ["openspec/changes/greet-cli/proposal.md"],
    "specs": ["openspec/changes/greet-cli/specs/greeting/spec.md"], "design": [],
    "tasks": ["openspec/changes/greet-cli/tasks.md"] } }

$ openspec instructions apply --change greet-cli --json        # exit 0, trimmed
{ "state": "ready", "progress": { "total": 3, "complete": 0, "remaining": 3 },
  "missingPrerequisites": ["design"],
  "tasks": [
    { "id": "1", "description": "1.1 Create `greet.sh` that prints `Hello, <name>!` with `world` as the default name", "done": false, "line": 3 },
    { "id": "2", "description": "1.2 Make `greet.sh` executable", "done": false, "line": 4 },
    { "id": "3", "description": "2.1 Run `./greet.sh Ada` and `./greet.sh` and compare the output with the spec scenarios", "done": false, "line": 8 } ],
  "contextFiles": ["proposal","specs","tasks"],
  "instruction": "Read context files, work through pending tasks, mark complete as you go.\nPause if you hit blockers or need clarification." }
```

`missingArtifacts` is absent: a missing `design.md` is only a `missingPrerequisites` entry and does not block apply.

### S2b and S2c: bounds of apply readiness (extra probes, change `probe-nospecs`)

Proposal and `tasks.md` with no `specs/` and no `design.md`:

```
status: isPlanningComplete false; proposal done, specs ready, design ready, tasks done
apply:  { "state": "ready", "progress": { "total": 3, "complete": 0, "remaining": 3 },
          "missingPrerequisites": ["specs","design"], "contextFiles": ["proposal","tasks"] }
```

The same with `skip_specs: true` in `.openspec.yaml`:

```
status: isPlanningComplete false; proposal done, specs skipped, design ready, tasks done
apply:  { "state": "ready", "missingPrerequisites": ["design"], ... }
```

Apply readiness needs only a `tasks.md` with at least one checkbox row; specs are not checked.

### S3: all four files

`design.md` with `## Context`, `## Goals / Non-Goals`, `## Decisions`, `## Risks / Trade-offs` added to S2.

```
$ openspec status --change greet-cli --json        # exit 0, trimmed
{ "isPlanningComplete": true, "isComplete": true, "applyRequires": ["tasks"],
  "artifacts": [
    { "id": "proposal", "status": "done", "requires": [] },
    { "id": "specs", "status": "done", "requires": ["proposal"] },
    { "id": "design", "status": "done", "requires": ["proposal"] },
    { "id": "tasks", "status": "done", "requires": ["specs","design"] } ],
  "existingOutputPaths": { "proposal": [".../proposal.md"], "specs": [".../specs/greeting/spec.md"],
    "design": [".../design.md"], "tasks": [".../tasks.md"] } }

$ openspec instructions apply --change greet-cli --json        # exit 0, trimmed
{ "state": "ready", "progress": { "total": 3, "complete": 0, "remaining": 3 },
  "tasks": [ ...the same three rows, done false... ],
  "contextFiles": ["proposal","specs","design","tasks"],
  "instruction": "Read context files, work through pending tasks, mark complete as you go.\nPause if you hit blockers or need clarification." }
```

`missingPrerequisites` is absent once all four exist.

## 3. `tasks.md` with no checkbox row

Change `probe-nospecs`, `tasks.md` = `## 1. Script`, then the plain lines `1.1 Create greet.sh` and `1.2 Make it executable`.

```
$ openspec instructions apply --change probe-nospecs --json        # exit 0, trimmed
{ "state": "blocked", "progress": { "total": 0, "complete": 0, "remaining": 0 },
  "missingPrerequisites": ["specs","design"], "tasks": [], "contextFiles": ["proposal","tasks"],
  "instruction": "The tasks.md file exists but contains no tasks to work on.\nAdd tasks to tasks.md, or rebuild it: Create it with `openspec instructions tasks --change probe-nospecs` (`openspec status --change probe-nospecs` shows what is left)." }
$ openspec status --change probe-nospecs --json   ->  isPlanningComplete false, tasks "done"
```

This is the second form of `blocked`: no `missingArtifacts` key, and the `tasks` artifact reads `done` in `status`.

## 4. Which rows count (task row rule)

The `tasks` instruction of the schema (`openspec instructions tasks --change <n> --json`, field `instruction`) says: "A box holding only `x` counts as done, upper or lower case and with any spacing, so `- [ x]` is done too. Every other marker, including `- [~]`, `- [-]` and an empty `- []`, reads as unfinished. A line with no checkbox is not tracked at all." Probe of that rule:

```
$ cat -n openspec/changes/probe-nospecs/tasks.md
     3	- [x] a lower x
     4	- [X] b upper X
     5	- [ x] c space then x
     6	- [x ] d x then space
     7	- [ ] e open
     8	- [] f empty brackets
     9	- [~] g tilde
    10	- [-] h dash
    11	* [x] i star bullet
    12	  - [x] j indented
    13	-  [x] k two spaces after dash
    14	- [x]l no space after bracket
    15	1. [x] m numbered
$ openspec instructions apply --change probe-nospecs --json   (state, progress, then line done description)
{"state":"ready","progress":{"total":13,"complete":9,"remaining":4}}
3 true a lower x      4 true b upper X       5 true c space then x     6 true d x then space
7 false e open        8 false f empty        9 false g tilde           10 false h dash
11 true i star bullet 12 true j indented     13 true k two spaces      14 true l no space after bracket
15 true m numbered
```

Every probed line is a task; done means the box holds only `x` or `X` with any spacing. The bullet may be `-`, `*` or `1.`, and no space is needed after `]`. The plan's row pattern `^\s*-\s+\[([ xX])\]\s+` (Phase 2 item 2) misses lines 5, 6, 8 to 11, 14 and 15 of this probe, so it undercounts both total and complete rows against the CLI. This is an input for Phase 2 (`readOpenspec`); the Phase 4 contract test is where a drift shows. With the three-row `tasks.md` of S2, `- [x]`, `- [X]` and `- [ ]` read 2 of 3 complete, and all three ticked read `"state": "all_done"`, `"progress": { "total": 3, "complete": 3, "remaining": 0 }`, instruction "All tracked tasks are complete.\nReview or verify the change as appropriate before archiving."

## 5. An `agent-smith/` folder inside the change: validate and archive

```
$ mkdir -p openspec/changes/greet-cli/agent-smith
$ printf '{"chain":"openspec"}\n' > openspec/changes/greet-cli/agent-smith/meta.json
$ printf 'Verdict: PASS\nCritical: 0\nWarnings: 0\n## Critical\n## Warnings\n' > openspec/changes/greet-cli/agent-smith/verify.md
$ printf '#!/bin/sh\necho "Hello, ${1:-world}!"\n' > greet.sh && chmod +x greet.sh

$ openspec validate greet-cli --json        # exit 0
{ "items": [ { "id": "greet-cli", "type": "change", "valid": true, "issues": [], "durationMs": 18 } ],
  "summary": { "totals": { "items": 1, "passed": 1, "failed": 0 },
               "byType": { "change": { "items": 1, "passed": 1, "failed": 0 } } },
  "version": "1.0", "root": { "path": "/private/tmp/claude-501/os-cli-check.1feotw", "source": "nearest" } }

$ openspec status --change greet-cli --json   ->  exit 0, isPlanningComplete true

$ date '+%Y-%m-%d %H:%M:%S %Z'
2026-11-09 04:39:04 CET
$ openspec archive greet-cli --yes --json        # exit 0
{ "archive": { "change": "greet-cli", "archivedAs": "2026-11-09-greet-cli",
    "path": "/private/tmp/claude-501/os-cli-check.1feotw/openspec/changes/archive/2026-11-09-greet-cli",
    "specsUpdated": true, "totals": { "added": 1, "modified": 0, "removed": 0, "renamed": 0 } },
  "root": { "path": "/private/tmp/claude-501/os-cli-check.1feotw", "source": "nearest" } }

$ find openspec -print | sort        (probe-nospecs lines left out)
openspec/changes/archive/2026-11-09-greet-cli/.openspec.yaml
openspec/changes/archive/2026-11-09-greet-cli/agent-smith/meta.json
openspec/changes/archive/2026-11-09-greet-cli/agent-smith/verify.md
openspec/changes/archive/2026-11-09-greet-cli/design.md
openspec/changes/archive/2026-11-09-greet-cli/proposal.md
openspec/changes/archive/2026-11-09-greet-cli/specs/greeting/spec.md
openspec/changes/archive/2026-11-09-greet-cli/tasks.md
openspec/config.yaml
openspec/specs/greeting/spec.md
$ cat openspec/changes/archive/2026-11-09-greet-cli/agent-smith/meta.json
{"chain":"openspec"}
```

`openspec/changes/greet-cli/` is gone, the `agent-smith/` folder moved with the change unchanged, and the delta was merged into a new main spec `openspec/specs/greeting/spec.md` (`# greeting Specification`, a TBD `## Purpose`, the requirement and both scenarios under `## Requirements`).

## 6. Archive folder name and `archive_target_exists`

- The folder is `openspec/changes/archive/<local YYYY-MM-DD>-<name>`: `2026-11-09-greet-cli` at 04:39 CET on 2026-11-09.
- A name that already starts with a date keeps its name:

```
$ openspec new change 2026-01-02-dated        # then proposal.md and tasks.md "- [x] 1.1 Nothing"
$ openspec archive 2026-01-02-dated --yes --json        # exit 0
{ "archive": { "change": "2026-01-02-dated", "archivedAs": "2026-01-02-dated",
    "path": "/private/tmp/claude-501/os-cli-check.1feotw/openspec/changes/archive/2026-01-02-dated",
    "specsUpdated": false }, "root": { ... } }
```

- Target exists: `greet-cli` made again on the same day with the same four files.

```
$ openspec new change greet-cli        # exit 0
$ openspec archive greet-cli --yes --json        # exit 1
{ "archive": null,
  "root": { "path": "/private/tmp/claude-501/os-cli-check.1feotw", "source": "nearest" },
  "status": [ { "severity": "error", "code": "archive_target_exists",
                "message": "Archive '2026-11-09-greet-cli' already exists." } ] }
$ ls -a openspec/changes/greet-cli
.  ..  .openspec.yaml  design.md  proposal.md  specs  tasks.md        # nothing moved
```

- A validation error refuses the archive too (change `bad-spec`, an ADDED requirement with no scenario):

```
$ openspec validate bad-spec --json        # exit 1
{ "items": [ { "id": "bad-spec", "type": "change", "valid": false, "issues": [
    { "level": "WARNING", "path": "farewell/spec.md", "message": "ADDED \"Say goodbye\" should contain SHALL or MUST (RFC 2119 best practice for English specs)" },
    { "level": "ERROR", "path": "farewell/spec.md", "message": "ADDED \"Say goodbye\" must include at least one scenario" } ] } ],
  "summary": { "totals": { "items": 1, "passed": 0, "failed": 1 }, ... } }
$ openspec archive bad-spec --yes --json        # exit 1
{ "archive": null, "root": { ... },
  "status": [ { "severity": "error", "code": "archive_validation_failed",
                "message": "Validation failed for change 'bad-spec'.",
                "fix": "Run openspec validate bad-spec for details, fix the errors, or rerun with --no-validate." } ] }
```

An error result has `"archive": null`, exit 1, and a `status[]` entry with `severity`, `code`, `message` and sometimes `fix`.

## Planning-complete predicate

- OpenSpec's `isPlanningComplete` needs all four artifacts (S2 false, S3 true).
- Apply readiness (`instructions apply` `state` not `blocked`) needs only a `tasks.md` with at least one checkbox row: it is `ready` without `design.md` (S2), without `specs/` (S2b) and with `skip_specs` (S2c).
- The two disagree on S2. The router follows apply readiness there, because `os-apply` is the step that needs it: a missing `design.md` does not hold the run in `os-propose`.
- Predicate A keeps `proposal.md` and at least one `specs/**/*.md` on top of apply readiness, because the propose skill's required set is `applyRequires` plus every artifact reachable by `requires` edges, and it skips `specs` only when `status` reads `skipped` (`openspec-propose/SKILL.md`, step 6b). `design.md` is the one artifact whose own instruction marks it conditional ("create only if any apply").

Predicate A: `proposal.md`, at least one `specs/**/*.md` and `tasks.md` exist; `design.md` is optional.

Predicate: A
Reason: with `proposal.md`, one spec and `tasks.md` but no `design.md`, `openspec instructions apply` reports `"state": "ready"` (design only under `missingPrerequisites`), not `blocked`; `isPlanningComplete` is `false` there, and the router follows apply readiness where the two disagree.

Open points for Phase 2 (not decided here):

- A change with `skip_specs: true` has no spec file by design, so predicate A never holds for it and the run would loop on `os-propose` until the attempt cap. Apply readiness is `ready` there (S2c).
- A `tasks.md` with no checkbox row is `blocked` for apply (section 3) although `tasks.md` exists; the plan already routes it to a halt.

Result: pass
