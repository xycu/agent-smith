# Late Usage Help Implementation Plan

## Overview

Show the existing `--usage-file` form wherever the router and its current documentation introduce late usage. This gives readers a working command for steps that carry recorded usage evidence.

## Current State Analysis

The router header gives both forms. The invalid-step-number response and the top-level usage response advertise only the numeric flags. `AGENTS.md` repeats the numeric synopsis, and the reference introduces the command with numeric flags before explaining structured mode separately. The OpenSpec skill already invokes the structured form in its late-usage procedure.

## Desired End State

Both CLI responses show `usage <change-id> <n> (--usage-file <path> | --tokens N [--tool-uses N] [--duration-ms N])`. The current documentation presents structured input first, explains that recorded evidence requires it, and describes numeric flags as the legacy form for steps without a recorded evidence contract. A CLI regression test exercises both responses.

### Key Discoveries

- The header already defines the target synopsis. The two stale strings are in `usageCommand` and `main`. [Header](../../../skills/10x-pipeline/scripts/route.mjs#L14) · [Usage refusal](../../../skills/10x-pipeline/scripts/route.mjs#L794) · [Top-level help](../../../skills/10x-pipeline/scripts/route.mjs#L970)
- The structured branch requires matching, verified evidence for an existing invocation. The numeric branch refuses records that carry an evidence contract. [Router validation](../../../skills/10x-pipeline/scripts/route.mjs#L797)
- The existing late-usage suite runs the actual CLI in scratch projects. OpenSpec already has a test for its single chain-qualified structured call. [CLI tests](../../../skills/10x-pipeline/test/late-usage.test.mjs#L65) · [OpenSpec skill test](../../../skills/openspec-pipeline/test/openspec-skill.test.mjs#L242)

## Scope

The change covers two router string literals, one Commands row in `AGENTS.md`, two reference passages, the OpenSpec late-usage prose, and a CLI regression test. Preserve argument handling, output envelopes, evidence validation, and router-owned state.

## Implementation Approach

Land all wording and the regression test in one phase. Use the header synopsis as the spelling reference and the parser and evidence guard as the source for when each form applies.

### Assumptions

- The explicit scope and local complexity assessment support one low-complexity phase with zero substantive questions. These settle the planning confirmations for this unattended run. [Change brief](change.md) · [Complexity assessment](complexity.json)
- Attach the eligibility clarification to OpenSpec's existing example. Its exact call already satisfies the requested syntax and is covered by a content test. [OpenSpec late usage](../../../skills/openspec-pipeline/SKILL.md#late-usage-before-every-end)
- Use live references as the documentation surface. ADR-019 already records the structured form in its amendment to the original numeric decision. [ADR-019 Amendment 1](../../../docs/ADR/ADR-019-late-usage-figure.md#amendment-1--structured-missing-token-enrichment)

## Phase 1: Align late usage help and documentation

### Overview

Bring the help messages and command references into agreement and guard the CLI output against regression.

### Changes Required

#### 1. Router usage messages

**File** `skills/10x-pipeline/scripts/route.mjs`

**Intent** Make both entry points advertise structured input alongside the numeric alternative.

**Contract** Match the header synopsis in the invalid-step-number message from `usageCommand` and in the `usage` clause of the top-level message from `main`. Keep the command-specific chain option and step-number explanation, and keep the shared chain note in the top-level message.

#### 2. Current command references

**Files** `AGENTS.md`, `docs/REFERENCE.md`, and `skills/openspec-pipeline/SKILL.md`

**Intent** Give readers the form that applies to their step and keep the numeric fallback discoverable.

**Contract** Update the single Commands row in `AGENTS.md` to show both forms and say that numeric flags apply only to steps without recorded evidence. In the reference, introduce the two-form synopsis in “Late usage figure”. In the legacy explanation, clarify that any one or more of `--tokens`, `--tool-uses`, and `--duration-ms` suffice and that each supplied value must be a non-negative safe integer. Invalid numeric input is refused before the usage log is read.

In the OpenSpec summary, place the usage entry after the “Read-only commands” list under a “Late usage” label. Lead with `usage <change-name> <n> --usage-file <path> --chain openspec` and describe the numeric fallback in prose with a link to the shared late-usage rules. In the OpenSpec skill's “Late usage (before every end)” section, clarify in prose why the existing chain-qualified `--usage-file` call is required for recorded evidence. Keep the exact call and its timing and cleanup instructions.

#### 3. CLI regression test

**File** `skills/10x-pipeline/test/late-usage.test.mjs`

**Intent** Fail if either help path stops advertising structured input.

**Contract** Add one test named `1.1 usage help advertises --usage-file` to the existing arguments section. Invoke the CLI with `usage <id>` and with no arguments using the existing helpers. Check the expected refusal and halt envelopes, then match `--usage-file <path>` and the numeric alternative within each `usage` synopsis. A failure from an unrelated diagnostic must fail the assertions.

### Success Criteria

#### Automated Verification

- The focused CLI regression test passes for both late usage messages.
- The documentation scan finds a `--usage-file` synopsis in all three command references and flags zero numeric-only synopses.
- The full Node test suite passes and `git diff --check` exits zero.

## Testing Strategy

- Run the focused regression with `node --test --test-name-pattern='usage help advertises --usage-file' skills/10x-pipeline/test/late-usage.test.mjs`. Confirm it fails against the original message text and passes with the correction.
- Require a match from each of the first four commands below. Check that the matches are in the Commands row, the reference's “Late usage figure” and OpenSpec summary, and the OpenSpec skill's late-usage procedure, respectively. The last command checks each invocation separately and should produce no lines (`rg -v` exits 1).

  ```sh
  rg -nF -- 'usage <id> <n> (--usage-file <path> | --tokens N' AGENTS.md
  rg -nF -- 'route.mjs usage <change-id> <n> (--usage-file <path> | --tokens N' docs/REFERENCE.md
  rg -nF -- 'usage <change-name> <n> --usage-file <path> --chain openspec' docs/REFERENCE.md
  rg -nF -- 'node $ROUTER usage <change-name> <n> --usage-file <usage-file> --chain openspec' skills/openspec-pipeline/SKILL.md
  rg -no -- 'usage[[:space:]]+<[^>]+>[[:space:]]+<n>[^`]*' \
    AGENTS.md docs/REFERENCE.md skills/openspec-pipeline/SKILL.md | rg -v -- '--usage-file'
  ```

- Run `GH_LIVE=0 node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `git diff --check`. Leave the live GitHub tests opted out. Note any expected local skips. The OpenSpec CLI contract fixtures run with OpenSpec 2.0.0 and can skip locally if the CLI is unavailable.

## References

- [Change brief](change.md)
- [Router late-usage handler](../../../skills/10x-pipeline/scripts/route.mjs#L785)
- [OpenSpec late-usage procedure](../../../skills/openspec-pipeline/SKILL.md#late-usage-before-every-end)
- [Documentation drift lesson](../../foundation/lessons.md#grep-every-doc-for-the-old-behavior-when-a-scripts-output-changes)

## Progress

> Use pending and done checkboxes. Append the closing commit SHA when a step lands. Keep step titles stable.

### Phase 1: Align late usage help and documentation

#### Automated

- [x] 1.1 The focused CLI regression test passes for both late usage messages.
- [x] 1.2 The documentation scan finds a `--usage-file` synopsis in all three command references and flags zero numeric-only synopses.
- [x] 1.3 The full Node test suite passes and `git diff --check` exits zero.
