---
change_id: override-json-error-halt
title: "A project override file with a JSON error is ignored silently"
status: planned
created: 2026-11-11
---

# Halt on an unparsable project override (issue #88)

## Overview

`mergedPolicy` in `skills/10x-pipeline/scripts/state.mjs` reads `context/foundation/agent-smith-policy.json` with `readJson(file, null)`. A JSON error returns `null`, so the router runs on shipped defaults and drops opt-outs, limits, prices and a pinned baseline policy with no message. Make it halt with the file name instead. A missing file stays "no override".

## Current state

- `state.mjs:39-44` `mergedPolicy()`: `readJson(..., null)` then `override ? deepMerge(base, override) : base`.
- Callers: `loadPolicy()` (halts through `out` when the base is null) and `loadPrices()` (wraps `mergedPolicy()` in try/catch for the report and `status`). `halt(reason)` is defined later in the same module (`out({action:"halt",reason},1)`, `process.exit`), and function declarations hoist, so it can be called from `mergedPolicy`.
- `main` in `route.mjs` calls `loadPolicy()` (line ~816) for every command before it reads the chain or the id, so the halt always fires there, first, before anything is written. `loadPrices()` runs later in the same process and re-reads a file that already parsed, so its `try/catch` never sees the halt. `process.exit` in `out` is not catchable anyway.
- `readJson` stays as is: other callers rely on the fallback.
- Test helper `writeOverride` writes valid JSON only; no existing test writes a broken override (to confirm with `grep -rn "agent-smith-policy" skills/10x-pipeline/test`).

## Decisions (assumptions)

- Halt for every command that loads the policy, `status` included: the file is the project's own config, and the issue asks for a halt "when the file exists and does not parse". Evidence: issue text, and `loadPolicy` already halts for an unreadable `policy.json`.
- An empty or whitespace-only file is a parse error too, so it halts (JSON.parse throws). - Valid JSON that is not an object (`[]`, `null`, `5`, `"x"`, `true`) halts too, with `<path> must hold a JSON object of policy keys, not <kind>. Fix the file or remove it.` (implementation review F1): before, `deepMerge` returned an array, string, number or `true` in place of the whole policy, and `null`, `false`, `0` and `""` were dropped silently. The values of the keys inside the object stay unchecked. A file that exists but cannot be read (permissions, a directory) also halts through the same catch, with the read error in the message.
- Message: `Cannot parse <path>: <parse error>. Fix the JSON or remove the file.` No ADR (the issue says add one only when needed).

## Phase 1: Halt on a bad override

### Changes

1. `skills/10x-pipeline/scripts/state.mjs`, `mergedPolicy()`: build the override path, return `base` when `!fs.existsSync(file)`, otherwise `JSON.parse(fs.readFileSync(file, "utf8"))` in a try/catch whose catch calls `halt(...)` with the message above. Halt when the parsed value is not an object (F1), then `deepMerge(base, override)`.
2. New `skills/10x-pipeline/test/override-json.test.mjs` (add it to the test list in `AGENTS.md` Project Structure with one line) (helpers `makeProject`, `init`, `run`, `cleanupAll`):
   - Trailing-comma override `{ "isolation": { "require": false }, }`: `init` exits 1, stdout names `agent-smith-policy.json` and `Cannot parse`, and `context/changes/demo/agent-smith/meta.json` does not exist.
   - `status demo` with the same broken file also halts (through `loadPolicy` in `main`, like every command).
   - Deleting the override file leaves `status demo` exit 0 (missing file is no override).
   - `[]`, `null`, `"x"`, `5` and `false` as the override: `init` and `status` exit 1, the reason names the file and the kind, and no `meta.json` is written (F1).
3. `docs/REFERENCE.md`: one bullet near "Override any policy key per project" saying an override file that does not parse, or whose JSON is not an object, halts every command with the file name and the parse error, and a missing file is no override.

### Success criteria

#### Automated
- New test passes: `node --test skills/10x-pipeline/test/override-json.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual
- In a scratch project without git, write the trailing-comma override and run `init`; confirm the halt names the file, not the isolation error.

## Out of scope

Validating the keys of the override or the shapes of their values; changing `readJson`; the `preplan.mjs` JSON reader.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Halt on a bad override

#### Automated

- [x] 1.1 New test passes: `node --test skills/10x-pipeline/test/override-json.test.mjs`
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [x] 1.3 A trailing-comma override in a scratch project without git halts `init` with the file name and the parse error — evidence: evidence/command-init-halt.txt
