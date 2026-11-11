# Implementation Review: AGENTS.md without @ imports

**Plan**: context/changes/agents-md-no-imports/plan.md
**Verdict**: APPROVED
**Findings**: 0 critical, 0 warnings, 2 observations

## Scope

Diff `main..HEAD` for `AGENTS.md` and `tools/test/agents-md-no-imports.test.mjs`. Plan has one phase, rows 1.1 to 1.6 all ticked.

## Plan compliance

- `AGENTS.md:3` matches the Contract text exactly (two links plus "read them only when the task needs them").
- `AGENTS.md:16` reads `with [README.md](README.md)`.
- No `@<path>` token left outside backticks (grep prints nothing; guard test passes).
- Guard test: `node:test` + `node:assert/strict`, ESM, 2-space indent, double quotes, semicolons, repo root from `import.meta.url`, fences and inline code stripped, regex as in the Contract, sanity case for bare vs code span present. `CLAUDE.md` case skips while the file is absent.
- No drift: `README.md`, `docs/REFERENCE.md` and `shape-notes.md` untouched, no ADR, per "What We're NOT Doing".
- Evidence for manual rows 1.5 and 1.6 exists (`evidence/command-context-memory-files.txt`, `evidence/script-agents-links.txt`); `/context` lists only user CLAUDE.md, MEMORY.md and AGENTS.md.

## Verification run

- `node --test tools/test/agents-md-no-imports.test.mjs`: 2 pass, 1 skip (no CLAUDE.md).
- `node tools/version-check.mjs`: OK (1.4.3).
- Full suite: 987 tests, 984 pass, 0 fail, 3 skipped.

## Findings

### F1: Matcher misses an import written right after punctuation

**Severity**: OBSERVATION
**Decision**: PENDING - no fix wanted by the plan; the owner decides whether to widen the regex (for example allow `(` or `"` before `@`).

The regex requires start of line or whitespace before `@`, and an extension of `md`, `json` or `mjs`. A form such as `(@README.md)` or `@docs/notes.txt` would pass the guard. Claude Code's own rule for where an `@` import is recognised is not documented in the plan, so widening it would be a guess. Current `AGENTS.md` has no such form.

### F2: `findImports` is exported from a test file

**Severity**: OBSERVATION
**Decision**: PENDING - cosmetic, no behaviour impact; the owner decides whether to drop `export`.

The export is unused by other files. Harmless, since `node --test` runs the file as is.
