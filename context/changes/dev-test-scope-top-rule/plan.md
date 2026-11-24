# Development Test Scope Implementation Plan

## Overview

Make focused development testing an always-true instruction for every agent-smith step. A step runs only the test files that cover its changes, including applicable guard tests. CI runs the full suite.

## Current State Analysis

PR #265 is already in this branch as `7568c862`. It narrowed the test instructions in `AGENTS.md`, the implementation-review apply prompt, and the `fix` policy prompt. Installed skills and plan rows can still call for a full local suite. The shared prompt currently lacks an always-true test-scope rule to resolve that conflict. [Change notes](change.md) · [Repository test instructions](../../../AGENTS.md#commands)

### Key Discoveries

- `ruleTail` appends the same required `top.md` after the chain rules for 10xDevs and OpenSpec. The existing precedence rules make that file authoritative over skills, plan rows, and policy defaults. [Rule assembly](../../../skills/10x-pipeline/scripts/flow.mjs#L1067) · [ADR-023](../../../docs/ADR/ADR-023-layered-rules.md#prompt-order-and-precedence-d3)
- `rules.test.mjs` checks the rule form. `rule-levels.test.mjs` already exercises the real router for both chains, checks that the shared block appears once, and tests precedence and suffix overrides. [Rule form tests](../../../skills/10x-pipeline/test/rules.test.mjs#L124) · [Rule assembly tests](../../../skills/10x-pipeline/test/rule-levels.test.mjs#L96)
- `agents-md-size.test.mjs` covers `AGENTS.md`. `skill-loop.test.mjs` covers both pipeline `SKILL.md` files and also checks routing guidance in `AGENTS.md`. [AGENTS.md size guard](../../../tools/test/agents-md-size.test.mjs) · [Skill and routing guards](../../../skills/10x-pipeline/test/skill-loop.test.mjs#L545)

## Desired End State

Fresh prompts in either chain require test files that cover what the step changed, including relevant guards. The rule also applies to pre-handoff checks. A single local full-suite run is allowed only when the user asks for it or when reproducing a CI failure. Either exception is necessary even when a skill or plan criterion requests a full run. CI runs the full suite across its existing shards. [Repository test instructions](../../../AGENTS.md#commands) · [CI test job](../../../.github/workflows/ci.yml#L69)

## Scope

Implementation is limited to the shared rule, its regression in `rules.test.mjs`, the `top.md` row in the rules index, and the list of `top.md` contents in `docs/REFERENCE.md`. PR #265 supplies the existing contributor and prompt guidance. The existing router, OpenSpec chain rule file, pipeline `SKILL.md` files, and CI workflow are outside this change.

## Implementation Approach

Put the test-scope rule in the shared top-level block so the existing precedence and prompt assembly apply automatically. Add one regression for the new rule's contract and use the existing rule-level tests to verify delivery through both chains.

## Phase 1: Add and verify the shared development test rule

### Overview

Ship the instruction once in the shared prompt, document it in the rules index, and verify its wording and delivery locally.

### Changes Required

#### 1. Shared always-true rule

**File**: `skills/10x-pipeline/rules/top.md`

**Intent** Apply the test scope from PR #265 to every step, including when a skill or plan row asks for the full suite.

**Contract** Add one `GIVEN/WHEN/THEN` rule with one bold `MUST` before the precedence and `RESULT:` lines. Require only test files that cover files changed by the step, including before handoff. State that CI runs the full suite and allow a local full-suite run once per step, only at the user's own request (the user's message or the run goal, never a skill gate or plan row) or to reproduce a CI failure. State that a skill gate or plan criterion that names the full suite counts as met by the covering test files and that CI owns the full-suite result, so the step neither skips nor ticks that row on the strength of a full run. Keep the line free of the phrase `calls for delegation` and of `rm -rf`, which `nested-subagents.test.mjs` and `no-recursive-delete.test.mjs` use to find their own rules in `top.md`. Name `tools/test/agents-md-size.test.mjs` and `skills/10x-pipeline/test/skill-loop.test.mjs` as examples of guards that still run when a file they cover is touched.

#### 2. Rule regression

**File**: `skills/10x-pipeline/test/rules.test.mjs`

**Intent** Catch removal or weakening of the always-true instruction.

**Contract** Assert that the shipped `top.md` contains the new rule once and carries the changed-file limit, both full-suite exceptions, the once-per-step limit, the user-request source, the covering-tests-meet-the-criterion clause, CI ownership, and both guard examples. The existing rule-form scan covers the new line. Reuse the existing cross-chain assembly checks in `rule-levels.test.mjs`.

#### 3. Rules index

**File**: `skills/10x-pipeline/rules/README.md`

**Intent** Make the development test policy discoverable alongside the other rules for every step.

**Contract** Update the Files table entry for `top.md` to summarize focused development tests, applicable guards, full-suite CI, and the two exceptions to the local full-suite limit.

#### 4. Reference list

**File**: `docs/REFERENCE.md`

**Intent** Keep the documented contents of the always-true `top.md` true.

**Contract** In the always-true bullet of the rule-levels section (the one that lists what `top.md` holds), add the focused development tests rule to the list. Change no routing behavior text.

### Success Criteria

#### Automated Verification

- Pass the scoped rule and cross-chain prompt tests with `node --test --test-concurrency=2 skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs`.

#### Manual Verification

- Confirm the full-suite CI shards pass after the orchestrator publishes the pull request.

## Testing Strategy

- Use the existing rule-form assertion and the new policy regression for the textual contract. The existing scratch-project tests cover prompt assembly, precedence, and both chains.
- Choose local tests by the files they cover. For example, changing `AGENTS.md` requires its size guard, and changing a pipeline `SKILL.md` requires the skill-loop guard. The rule and cross-chain prompt tests cover this phase's changes. `nested-subagents.test.mjs` and `no-recursive-delete.test.mjs` also read `top.md` by line, so run them too if the new line could match their filters (see the `top.md` contract).
- A skill or plan row that asks for the full suite without either exception still calls for only the covering local tests. Review the full-suite result in CI after publication.

## Performance Considerations

Focused local test runs reduce contention between concurrent development steps. The prompt gains one rule and uses the existing file read.

## Migration Notes

The new rule takes effect when the router assembles a fresh prompt. A historical pending dispatch retains its recorded prompt on neutral retry under the existing provenance rules. [ADR-023 amendment](../../../docs/ADR/ADR-023-layered-rules.md#amendment-1--safety-and-planning-step-owners-2026-11-15)

## Assumptions

- One implementation phase and no further design questions are sufficient. The change notes and `AGENTS.md` settle scope, exceptions, and guard expectations, and the router's fixed-path lookup establishes that a single shared rule covers both chains. [Change notes](change.md) · [Repository test instructions](../../../AGENTS.md#commands) · [Rule assembly](../../../skills/10x-pipeline/scripts/flow.mjs#L1067)

## References

- Commit `7568c862` records the existing test guidance. [PR #265](https://github.com/xycu/agent-smith/pull/265)
- [Rule levels and file index](../../../skills/10x-pipeline/rules/README.md)
- [Wave 6 sequencing](../WAVES.md#wave-6)

## Progress

> Append the closing commit SHA when a row lands. Keep row titles stable.

### Phase 1: Add and verify the shared development test rule

#### Automated

- [x] 1.1 Pass the scoped rule and cross-chain prompt tests with `node --test --test-concurrency=2 skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs`.

#### Manual

- [ ] 1.2 Confirm the full-suite CI shards pass after the orchestrator publishes the pull request.
