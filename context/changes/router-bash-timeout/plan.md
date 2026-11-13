# Router Bash timeout Implementation Plan

## Overview

Both orchestrator skills call `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` through the Bash tool without a `timeout`. The Bash default (120000 ms) equals the router's git timeouts, so the Bash tool kills the router inside a slow `git commit` (project hooks) before the router can unstage its own add. Fix: one new line in each `SKILL.md` that tells the orchestrator to pass `timeout: 600000`, pinned by content tests, plus a `docs/REFERENCE.md` bullet that states how the Bash limit relates to `gitTimeoutMs`.

## Current State Analysis

- `skills/10x-pipeline/SKILL.md:25-27` and `skills/openspec-pipeline/SKILL.md:28-30` hold three script path lines (`Router:`, `PR comment script:`, `Pull request script:`) before `## Start`. Neither names a Bash timeout (`grep -n timeout` finds none).
- `skills/10x-pipeline/policy.json:117,124`: `archive.gitTimeoutMs` and `isolation.gitTimeoutMs` are both 120000, applied per git call (`scripts/isolation.mjs:250,402,425,439,470,545,599`, `scripts/route.mjs:220,900`). `open-pr.mjs:17` has a fixed `GIT_TIMEOUT_MS = 120000`, not overridable by policy.
- `docs/REFERENCE.md` documents `isolation.gitTimeoutMs` only in passing (the `startSha` read, line 52) and the `--timeout-ms` flag of the PR scripts for `gh` calls (line 70). It says nothing about the Bash tool limit.
- Tests that pin the SKILL.md files: `skills/10x-pipeline/test/skill-loop.test.mjs` (anti-stall section, script path lines, PR section) and `skills/10x-pipeline/test/openspec-skill.test.mjs` (same, plus `lines.filter(l => l.includes("node $ROUTER"))` must all carry `--chain openspec`, no model/effort/tier words, anti-stall section equals the 10x one, exactly 6 `**GIVEN**` lines in the file). `nested-subagents.test.mjs` and `rules.test.mjs` also pin the anti-stall section and the `**GIVEN**` count.

## Desired End State

Both SKILL.md files carry the same `Bash timeout:` line right after the `Pull request script:` line, outside `## Anti-stall rules`, with no `**GIVEN**` form, no `node $ROUTER` text, and no model, effort or tier word. Content tests in both test files fail when the line is removed, moved into the anti-stall section, or loses `timeout: 600000` or one of the three script names. `docs/REFERENCE.md` states that the Bash limit must exceed the git timeouts and names the override keys. The full suite passes.

### Key Discoveries:

- A `timeout` is none of the names AGENTS.md forbids in SKILL.md (models, effort levels, tiers), so the Hard Rule holds.
- The line must avoid the literal `node $ROUTER`, or `openspec-skill.test.mjs:94` would demand `--chain openspec` on it in both skills.
- Anti-stall equality (`openspec-skill.test.mjs:107`) only compares the section, so a line above `## Start` leaves it untouched.

## What We're NOT Doing

- Not changing the shipped `gitTimeoutMs` values (120000) in `policy.json`; a policy change would need a router test sweep for no gain, and a project can override them.
- Not making `open-pr.mjs`'s `GIT_TIMEOUT_MS` configurable.
- Not changing the `gitSafety` staged-index halt message (the optional item in `change.md`). It touches `isolation.mjs` and its tests, and the new timeout line removes the usual cause. Left for a separate change.
- Not touching the `## Anti-stall rules` section, router code, or `README.md`.

## Implementation Approach

Phase 1 adds the line to both skills and pins it in both test files (test first inside the phase: write the tests, see them fail, add the lines). Phase 2 documents the relation in `REFERENCE.md`, then the full suite runs.

## Phase 1: Skill line and content tests

### Overview

Add one identical line to each SKILL.md and pin it.

### Changes Required:

#### 1. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Tell the orchestrator to run every router and PR-script call with the Bash tool's maximum timeout, and say why in one sentence.

**Contract**: One line directly after the `Pull request script:` line (before `## Start`), identical in both skills:
`Bash timeout: run every `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` call with the Bash tool's `timeout: 600000`, its maximum. The default of 120000 ms equals the router's git timeouts, so the Bash tool would kill the router inside a slow `git commit`.`
No `**GIVEN**`, no `node $ROUTER`, no model, effort or tier word.

#### 2. OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: Same line, same place (after its `Pull request script:` line).

**Contract**: Byte-identical to the 10x line.

#### 3. 10x content test

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs`

**Intent**: Pin the line in the 10x skill.

**Contract**: New test "the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section": exactly one line starts with `Bash timeout: `; it includes `route.mjs`, `open-pr.mjs`, `pr-comment.mjs` and `` `timeout: 600000` ``; its index is after the `Pull request script: ` line and before `## Start`; it is not inside `section()`.

#### 4. OpenSpec content test

**File**: `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Pin the line in the OpenSpec skill and keep the two copies equal.

**Contract**: Same assertions as above against `lines`, plus `assert.equal` of the line with the one found in `tenx`.

### Success Criteria:

#### Automated Verification:

- New 10x content test passes: `node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- New OpenSpec content test passes: `node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- Anti-stall, rule-form and nested-subagent pins still pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- Deliberate-break check: the new tests fail on a SKILL.md copy without the line, via `SKILL_PATH` and `OPENSPEC_SKILL_PATH`

#### Manual Verification:

- The line reads clearly next to the three script path lines in both skills

---

## Phase 2: Reference note and full suite

### Overview

Document how the Bash limit relates to `gitTimeoutMs`.

### Changes Required:

#### 1. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Under the isolation bullets (after "Step commits"), state the rule so a project with slow hooks knows what to set.

**Contract**: One bullet, "Bash limit": the skills run every `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` call with the Bash tool's `timeout: 600000`, its maximum; the shipped `isolation.gitTimeoutMs` and `archive.gitTimeoutMs` (120000 each, per git call) stay below it, and the Bash limit must stay above any one git timeout; a router call makes several git calls, so a project whose hooks run near 120 s lowers neither but may need `context/foundation/agent-smith-policy.json` overrides of both keys, kept so one call stays under 600000 ms; the push of `open-pr.mjs` uses a fixed 120000 ms (`GIT_TIMEOUT_MS`) and has no override; a Bash kill inside `git commit` leaves the router's `git add` staged, and the next `next` halts in the staged-index check, so check with `git diff --cached --name-only`. Both chains share it (the OpenSpec section points at it, no copy).

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The bullet exists: `grep -n "Bash limit" docs/REFERENCE.md`

#### Manual Verification:

- The bullet states the relation unambiguously and matches `policy.json` and `open-pr.mjs:17`

---

## Testing Strategy

### Unit Tests:

- Two content tests (one per skill file) as in Phase 1; they cover presence, content, placement and cross-skill equality.

### Manual Testing Steps:

1. Read both SKILL.md headers and the new REFERENCE.md bullet for consistency.

## Performance Considerations

None. 600000 is a ceiling; calls that finish sooner are unaffected.

## References

- Change: `context/changes/router-bash-timeout/change.md`
- Script path lines: `skills/10x-pipeline/SKILL.md:25-27`, `skills/openspec-pipeline/SKILL.md:28-30`
- Git timeouts: `skills/10x-pipeline/policy.json:117,124`, `skills/10x-pipeline/scripts/open-pr.mjs:17`
- Staged-index halt: `skills/10x-pipeline/scripts/isolation.mjs:230`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skill line and content tests

#### Automated

- [ ] 1.1 New 10x content test passes: `node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- [ ] 1.2 New OpenSpec content test passes: `node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- [ ] 1.3 Anti-stall, rule-form and nested-subagent pins still pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- [ ] 1.4 Deliberate-break check: the new tests fail on a SKILL.md copy without the line, via `SKILL_PATH` and `OPENSPEC_SKILL_PATH`

#### Manual

- [ ] 1.5 The line reads clearly next to the three script path lines in both skills

### Phase 2: Reference note and full suite

#### Automated

- [ ] 2.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.2 The bullet exists: `grep -n "Bash limit" docs/REFERENCE.md`

#### Manual

- [ ] 2.3 The bullet states the relation unambiguously and matches `policy.json` and `open-pr.mjs:17`
