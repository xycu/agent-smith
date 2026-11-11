# Array-form archive prompt and suffix override Implementation Plan

## Overview

A policy prompt may be a string or an array of strings (with `@prompts/<file>.md` parts); `promptText` resolves both. Two call sites skip it: the archive prompt and the generic suffix. An array override then throws `tpl.replace is not a function` after the pre-archive commit, or mangles the suffix into `a,b`. Route both through `promptText`. GitHub issue #89.

## Current State Analysis

- `skills/10x-pipeline/scripts/isolation.mjs:680` renders `policy.prompts.archive` directly for the 10x chain (the OpenSpec branch already uses `promptText(policy, "os-archive")`).
- `isolation.mjs:681` and `skills/10x-pipeline/scripts/route.mjs:180` append `policy.prompts.suffix` raw.
- `promptText` (`scripts/flow.mjs`, ~line 760) joins parts with `\n`, resolves `@prompts/` refs, throws on a bad key. `checkPrompts` already validates every key at `next`, so a bad reference halts before any commit; no new validation is needed.
- `isolation.mjs` already imports `promptText` (line 11); `route.mjs` imports it (line 31).

## Desired End State

An array override of `prompts.archive` or `prompts.suffix` (including `@prompts/` parts) yields the joined text in the archive action prompt and in every step prompt. Shipped string defaults give byte-identical prompts. `grep -n "policy.prompts\.\(archive\|suffix\)" skills/10x-pipeline/scripts` finds nothing outside `promptText`.

### Key Discoveries:

- `isolation.mjs:680-681`, `route.mjs:180` are the only raw reads (grep of `prompts\.` in `scripts/`).
- The Router comment above the archive commit promises a bad policy never throws after the commit; `checkPrompts` at `next` covers it once the render uses `promptText`.

## What We're NOT Doing

- No new validation, no policy change, no docs or ADR (behaviour already documented: "string or array of strings").
- No change to `promptText` or `checkPrompts`.

## Implementation Approach

Two one-line edits, then tests that drive the real router with an override.

## Phase 1: Resolve archive prompt and suffix through promptText

### Overview

Replace the raw reads and cover both forms with tests.

### Changes Required:

#### 1. Archive prompt

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Render the 10x archive prompt from `promptText(policy, "archive")` so an array form works, as the OpenSpec branch already does.

**Contract**: line 680 becomes `render(promptText(policy, openspec ? "os-archive" : "archive"), { id })` (or the equivalent two-call ternary); line 681 appends `promptText(policy, "suffix")`.

#### 2. Step prompt suffix

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Append `promptText(policy, "suffix")` instead of the raw value at line 180.

**Contract**: prompt string for a string-valued suffix is unchanged.

#### 3. Tests

**File**: `skills/10x-pipeline/test/archive.test.mjs` and `skills/10x-pipeline/test/route.test.mjs`

**Intent**: Archive test: reuse `archiveProject({ policy: { prompts: { archive: ["Run /10x-archive {id}", "- extra rule"], suffix: ["line one", "line two"] } } })` and `runNext`; assert exit 0, action `archive`, the prompt starts `Run /10x-archive demo\n- extra rule` and ends `line one\nline two`, and no `line one,line two`. Route test: with `suffix` as an array (using a `makeProject` policy override), the prompt of a normal `run` step ends with `line one\nline two`.

**Contract**: follow the existing patterns at `archive.test.mjs:572` (done with `--archive`) and the `makeProject`/`run` helpers; use `{ skip: noGit }` for the git-based one.

### Success Criteria:

#### Automated Verification:

- New archive test passes with array `archive` and `suffix` overrides: `node --test skills/10x-pipeline/test/archive.test.mjs`
- New route test passes for array `suffix`: `node --test skills/10x-pipeline/test/route.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No raw read remains: `grep -rn "policy\.prompts\.\(archive\|suffix\)" skills/10x-pipeline/scripts` prints nothing

#### Manual Verification:

- In a scratch project with an array `suffix` override, `route.mjs next` prints a prompt whose suffix lines are newline-separated

---

## Testing Strategy

### Unit Tests:

- Array `archive` and `suffix` overrides in the archive action; array `suffix` in a step prompt.
- Existing string-default tests stay green (byte-identical prompts).

## References

- Issue #89; `context/changes/array-prompt-override/change.md`
- `skills/10x-pipeline/scripts/flow.mjs` `promptText`, `checkPrompts`
- Similar call: `isolation.mjs:154` (`promptText(policy, "frame-authority")`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Resolve archive prompt and suffix through promptText

#### Automated

- [ ] 1.1 New archive test passes with array `archive` and `suffix` overrides: `node --test skills/10x-pipeline/test/archive.test.mjs`
- [ ] 1.2 New route test passes for array `suffix`: `node --test skills/10x-pipeline/test/route.test.mjs`
- [ ] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.4 No raw read remains: `grep -rn "policy\.prompts\.\(archive\|suffix\)" skills/10x-pipeline/scripts` prints nothing

#### Manual

- [ ] 1.5 In a scratch project with an array `suffix` override, `route.mjs next` prints a prompt whose suffix lines are newline-separated
