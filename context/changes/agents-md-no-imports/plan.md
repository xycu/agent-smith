# AGENTS.md without @ imports Implementation Plan

## Overview

`AGENTS.md` carries two `@README.md` / `@docs/REFERENCE.md` references. Claude Code reads an `@path` as an import and loads the file into every session, so each session and subagent in this repository pays about 158 KB (AGENTS.md 28 KB, README.md 4.5 KB, docs/REFERENCE.md 125 KB) before work starts. We replace the references with plain links and add a guard test so the imports do not return.

## Current State Analysis

- The `@` syntax is in `AGENTS.md`, not in `README.md` or `docs/REFERENCE.md`. Neither of those two files contains an import (grep for `@` finds only `@mention` prose and the plugin install line). The issue text ("Write REFERENCE.md and README.md without the @") names the wrong files; the fix is in `AGENTS.md`.
- `AGENTS.md:3`: `See @README.md for install and use, and @docs/REFERENCE.md for routing behavior.`
- `AGENTS.md:16`: `... and with @README.md.` (a second import of README.md).
- No `CLAUDE.md` exists in the repository, so `AGENTS.md` is the only entry file.
- No test reads these lines; `rules.test.mjs`, `no-recursive-delete.test.mjs` and others only check rules in AGENTS.md by text.

### Key Discoveries:

- `AGENTS.md:3` and `AGENTS.md:16` are the only `@` file references in the repo outside `context/` notes (`grep -rnF "@README"`).
- `context/foundation/shape-notes.md:31` quotes "@README.md" but is not loaded into sessions; leave it.
- A path in a markdown link or a code span is not an import, so the reader still finds the file and reads it only when the task needs it.

## What We're NOT Doing

- No change to `README.md` or `docs/REFERENCE.md` content.
- No shrinking or splitting of `AGENTS.md` itself (28 KB); that is a separate concern.
- No ADR (a docs-only fix; the change note says add one only when needed).
- No change to `context/foundation/shape-notes.md`.

## Implementation Approach

Edit two lines of `AGENTS.md` to use plain links / code spans, then add one `node:test` file in `tools/test/` that fails when `AGENTS.md` holds an `@<path>` token outside a code span. `tools/test/*.test.mjs` already runs in `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 1: Remove the imports and guard them

### Overview

Replace both `@` references and add the guard test.

### Changes Required:

#### 1. Entry file

**File**: `AGENTS.md`

**Intent**: Stop importing README.md and docs/REFERENCE.md into every session while keeping the pointers, with a hint that the reader opens them only when the task needs them.

**Contract**: Line 3 reads `See [README.md](README.md) for install and use, and [docs/REFERENCE.md](docs/REFERENCE.md) for routing behavior (read them only when the task needs them).` Line 16 `with @README.md` becomes `with [README.md](README.md)`. No other `@path` token remains in the file outside backticks.

#### 2. Guard test

**File**: `tools/test/agents-md-no-imports.test.mjs`

**Intent**: Fail when `AGENTS.md` (or a `CLAUDE.md` at the repo root, if one appears) contains a Claude Code import, so the 158 KB load cannot return unnoticed.

**Contract**: Read the file, drop fenced code blocks and inline code spans, then assert no match of the import rule of Claude Code 2.1.311 (`@` at a line start or after whitespace, then a token that starts with `./`, `~/`, `/` or `[a-zA-Z0-9._-]`, any extension or none), widened to an `@` after punctuation: `/(?<![\w@])@(?:~\/|\/(?=\S)|[a-zA-Z0-9._-])(?:[^\s\\]|\\ )*/g` (implementation review F1; the first version matched only `md`, `json` and `mjs` after whitespace, which the `grep` of row 1.1 still shows). Plain `node:test` + `node:assert/strict`, ESM, 2-space indent, double quotes, semicolons, like the other tests in `tools/test/`. Resolve the repo root from `import.meta.url`.

### Success Criteria:

#### Automated Verification:

- No import left: `grep -nE '(^|[[:space:]])@[A-Za-z0-9_./-]+\.(md|json|mjs)' AGENTS.md` prints nothing outside code spans (the guard test checks it)
- Guard test passes: `node --test tools/test/agents-md-no-imports.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version drift check passes: `node tools/version-check.mjs`

#### Manual Verification:

- Start a Claude Code session in the repo and run `/context` (or read the memory file list): `README.md` and `docs/REFERENCE.md` are not loaded, `AGENTS.md` is.
- The two links in `AGENTS.md` resolve to the right files on GitHub's preview.

**Implementation Note**: Commit as `docs(agents-md-no-imports): link README and REFERENCE instead of importing them` plus the test in the same or a `test:` commit; both are hidden-section types, so no release PR (run-branch rule). Add the `Co-Authored-By:` trailer.

---

## Testing Strategy

### Unit Tests:

- The guard test, with a sanity case: a string with `@README.md` outside code fails the matcher, a string with it in backticks passes. Keep the matcher in the test file as a small function so both cases run.

### Integration Tests:

- Full suite as above.

### Manual Testing Steps:

1. Open a fresh session in the repo; check loaded memory files.
2. Ask the agent a routing question and confirm it opens `docs/REFERENCE.md` on demand.

## Performance Considerations

Saves about 130 KB of context per session and per subagent (README.md 4.5 KB + docs/REFERENCE.md 125 KB); AGENTS.md stays.

## Migration Notes

None. Other changes in flight that edit `AGENTS.md` may conflict on lines 3 and 16; the later merge rebases.

## References

- GitHub issue #93; `context/changes/agents-md-no-imports/change.md`
- `AGENTS.md:3`, `AGENTS.md:16`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remove the imports and guard them

#### Automated

- [x] 1.1 No import left: `grep -nE '(^|[[:space:]])@[A-Za-z0-9_./-]+\.(md|json|mjs)' AGENTS.md` prints nothing outside code spans (the guard test checks it)
- [x] 1.2 Guard test passes: `node --test tools/test/agents-md-no-imports.test.mjs`
- [x] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.4 Version drift check passes: `node tools/version-check.mjs`

#### Manual

- [x] 1.5 Start a Claude Code session in the repo and run `/context` (or read the memory file list): `README.md` and `docs/REFERENCE.md` are not loaded, `AGENTS.md` is. — evidence: evidence/command-context-memory-files.txt
- [x] 1.6 The two links in `AGENTS.md` resolve to the right files on GitHub's preview. — evidence: evidence/script-agents-links.txt
