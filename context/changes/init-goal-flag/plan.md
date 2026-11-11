# init --goal parsing Implementation Plan

## Overview

`init` reads `--goal` through the generic `parseFlags`, which treats a value starting with `--` as the next flag and skips every argument that belongs to no flag. A goal like `--verbose flag should print timings` is stored as `""`, and an unquoted goal `fix the bug` is stored as `fix`. Make `--goal` always take the next argument, and make `init` halt on leftover words, writing nothing (GitHub issue #90).

## Current State Analysis

- `parseFlags` in `skills/10x-pipeline/scripts/state.mjs:14-23` is the only parser; it has one caller, `main()` in `skills/10x-pipeline/scripts/route.mjs:811`, for every command.
- `init` stores the goal at `route.mjs:871-872`: a non-blank string wins, else the stored goal, else `""`. A bare `--goal` (value `true`) therefore keeps the stored goal.
- Positionals are legitimate for `usage <id> <n>` (the step number) and skipped silently elsewhere. `main()` already destructures `cmd` and `id` before `parseFlags(rest)`.
- Both orchestrator skills quote the goal (`SKILL.md:46`, `openspec-pipeline/SKILL.md:54`), so the unquoted case is a hand-run command.

## Desired End State

- `init demo --goal "--verbose flag should print timings"` stores that text as the goal.
- `init demo --goal fix the bug` halts (`action: "halt"`, exit 1), names the leftover words and says to quote the goal, and writes nothing.
- Every other command and flag behaves as before.

### Key Discoveries:

- `halt` is called before `fs.mkdirSync(p.dir)` at `route.mjs:869` for the other init argument errors (`--rigor`, `--archive`, `--chrome`), so a leftover check placed beside them writes nothing.
- A stray word after `--archive` or `--chrome` is read as that flag's value (`--archive false`), and a bad value already halts; so the leftover check only sees words after valued flags or after a `--goal` value.

## What We're NOT Doing

- No change for `next`, `status`, `risk`, `usage`, `verify-archive`, `compare`: leftover words stay silently skipped there (`usage` needs its positional).
- No general "flags with required values" framework; only `--goal` is special-cased.
- No change to the empty/blank/valueless `--goal` rule (keeps the stored goal).
- No ADR: the change needs no design decision beyond the issue's stated fix.
- No change to SKILL.md files; they already quote the goal.

## Implementation Approach

`parseFlags(args, valueFlags = [])` takes a list of flags that always consume the next argument when one exists, and collects arguments that belong to no flag in `flags._` (an array assigned after the loop, so a hand-typed `--_` flag cannot replace it). `main()` passes `["goal"]` and, in the `init` branch before anything is written, halts when `flags._` is non-empty.

## Phase 1: Parser and init halt

### Overview

Fix `--goal` consumption and reject leftover words at `init`.

### Changes Required:

#### 1. Flag parser

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Let a named flag take its value even when the value starts with `--`, and record arguments that no flag consumed.

**Contract**: `parseFlags(args, valueFlags = [])`. For a flag in `valueFlags`, `flags[key]` is `args[i+1]` whenever it exists (else `true`, as today). Non-flag arguments not consumed as a value are collected in an array and assigned to `flags._` after the loop (always present, possibly empty, and never overwritten by a `--_` argument, which `slice(2)` turns into the key `_`). Behaviour for flags outside `valueFlags` is unchanged.

#### 2. Init halt

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Pass `["goal"]` to `parseFlags` and, in the `init` branch next to the `--rigor`/`--archive`/`--chrome` checks, halt on leftover words so an unquoted goal never starts a run on its first word.

**Contract**: Halt text: `Unexpected argument(s) after the flags: <words>. Quote the goal: --goal "<text>". Nothing was written.` The check runs before `guardArchived` and before any write. Update the usage comment at the top of `route.mjs` only if it needs a word (it does not).

### Success Criteria:

#### Automated Verification:

- Router suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Reproduction 1 stores the text: in a scratch project, `init demo --goal "--verbose flag should print timings"` leaves `meta.json` with that goal.
- Reproduction 2 halts: `init demo --goal fix the bug` exits 1 with `action: "halt"` and creates no `agent-smith/` folder.

#### Manual Verification:

- A hand-run `init` with a quoted multi-word goal still starts a run and `status` prints valid JSON.

---

## Phase 2: Tests and docs

### Overview

Pin the new behaviour and document it where the init flags are described.

### Changes Required:

#### 1. Tests

**File**: `skills/10x-pipeline/test/route.test.mjs`

**Intent**: Cover the two reproductions and the guards that must not change, using the existing `makeProject`, `init` and `run` helpers (`helpers.mjs` stays as it is).

**Contract**: Tests: a goal starting with `--` is stored verbatim; an unquoted goal halts, exits 1, names the leftover words and writes no `agent-smith/` folder; a quoted goal followed by `--rigor standard` still works; bare `--goal` in last position on a resume keeps the stored goal, and so does `--goal ""`; `--goal --archive` stores `--archive` as the goal and leaves archive off; an argument `--_` does not hide leftover words; `usage <id> <n> --tokens N` still parses its positional (it is not an `init`); the same halt applies with `--chain openspec`.

#### 2. Reference docs

**File**: `docs/REFERENCE.md`, `AGENTS.md`

**Intent**: State the rule where `init --goal` is described.

**Contract**: One sentence in the `init` bullet of `AGENTS.md` Commands: `--goal` takes the next argument whatever it starts with, and `init` halts on words that belong to no flag. A matching bullet in `docs/REFERENCE.md`, as the last bullet of the "How routing works:" list in the 10x section (after the bullet that ends "...or when the step budget is spent."), because no bullet there lists the `init` flags. Do not touch other sections (parallel changes edit the same files).

### Success Criteria:

#### Automated Verification:

- New tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete form was added: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- The two doc sentences read correctly and match the halt text.

---

## Testing Strategy

### Unit Tests:

- Goal beginning with `--`; goal as the last argument; goal followed by another flag.
- Leftover words: after a goal, before a flag, after a flag with a valid value.

### Integration Tests:

- CLI `init` for both chains in a scratch project, checking `meta.json` and the absence of writes on halt.

### Manual Testing Steps:

1. Run both reproductions from the issue in a scratch project.
2. Run `init` with a quoted goal and `--rigor standard`, then `status`.

## Performance Considerations

None.

## Migration Notes

A hand-run command with an unquoted multi-word goal now halts instead of storing the first word. The orchestrator skills already quote the goal.

A `--goal` followed by a flag-looking argument now takes it as the goal text: `init demo --goal --archive` stores `--archive` as the goal and does not turn archive on, and `init demo --goal --rigor standard` halts on the leftover `standard`. This follows from "always take the next argument" (issue #90); only a `--goal` in last position still keeps the stored goal.

## References

- Issue: GitHub #90; change file `context/changes/init-goal-flag/change.md`
- Parser: `skills/10x-pipeline/scripts/state.mjs:14-23`
- Init goal storage: `skills/10x-pipeline/scripts/route.mjs:871-872`
- Similar argument checks: `skills/10x-pipeline/scripts/route.mjs:826-845`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parser and init halt

#### Automated

- [x] 1.1 Router suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.2 Reproduction 1 stores the text: in a scratch project, `init demo --goal "--verbose flag should print timings"` leaves `meta.json` with that goal.
- [x] 1.3 Reproduction 2 halts: `init demo --goal fix the bug` exits 1 with `action: "halt"` and creates no `agent-smith/` folder.

#### Manual

- [x] 1.4 A hand-run `init` with a quoted multi-word goal still starts a run and `status` prints valid JSON. — evidence: evidence/command-init-quoted-goal.txt

### Phase 2: Tests and docs

#### Automated

- [x] 2.1 New tests pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [x] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 2.3 No recursive delete form was added: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual

- [x] 2.4 The two doc sentences read correctly and match the halt text. — evidence: evidence/judgment-doc-sentences.txt
