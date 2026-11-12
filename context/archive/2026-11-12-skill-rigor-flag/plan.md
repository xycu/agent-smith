# Parse --rigor in both skills as the README offers it Implementation Plan

## Overview

`README.md:65` offers `--rigor lean|standard|thorough` and the router reads it (`INIT_FLAGS` in `skills/10x-pipeline/scripts/route.mjs`), but neither skill parses it. A user who types `--rigor thorough` leaves the words in the goal text that goes to `init --goal` and into every step prompt, and the goal text feeds the goal classification. This plan makes both skills parse `--rigor <level>` in Start step 1, remove it from the goal text, and pass it to `init` only when the user gave it. Text-only change to two `SKILL.md` files, `docs/REFERENCE.md` and two test files; no router code.

## Current State Analysis

- `skills/10x-pipeline/SKILL.md:9` `argument-hint` lacks `--rigor`. Start step 1 (line 31) parses and removes only `--archive`, `--chrome` (each with an optional `true`/`false` value) and `--pr-comment`. Start step 4 (line 46) says "Add `--rigor <level>` only when the user named a rigor level (`lean`, `standard` or `thorough`). Never pick one yourself. On a resume the flag can only raise the level."
- `skills/openspec-pipeline/SKILL.md:10` and step 1 (line 34) have the same gap; its step 4 (line 54) has the same sentence.
- The router already validates the value: `route.mjs:846-849` halts with `Invalid --rigor <v>. Use one of: lean, standard, thorough.` before writing anything, and `init` also reads `--rigor=<level>`. So the skill needs no value check.
- `docs/REFERENCE.md:5` and `:388` headings list the arguments without `--rigor`.
- Tests: `openspec-skill.test.mjs:72` pins the exact OpenSpec `argument-hint` (it must change with the hint). `pr-comment.test.mjs:714` only matches `--pr-comment` in the hint. `skill-loop.test.mjs` has no frontmatter or Start-step check for the 10x skill.

### Key Discoveries:

- `skills/10x-pipeline/test/openspec-skill.test.mjs:72` asserts the whole OpenSpec hint string, so changing the hint breaks it until updated.
- `skill-loop.test.mjs` and `openspec-skill.test.mjs` honour `SKILL_PATH` / `OPENSPEC_SKILL_PATH` for the deliberate-break check; new tests must read through the same loaded `skill` and `lines`.
- AGENTS.md Hard Rule: `SKILL.md` must not name models, effort levels or tiers beyond what it documents. `lean`, `standard`, `thorough` are already named in step 4 of both skills; this plan adds no other such word. The `## Anti-stall rules` section must stay equal in both skills, so it is not touched.
- `--rigor` takes a value (unlike `--archive` and `--chrome`, whose value is optional), so the step 1 wording must say the next word is the level.

## What We're NOT Doing

- No router, policy or prompt change; the router already reads and validates `--rigor`.
- No value validation in the skill (the router halts on a bad level, writing nothing).
- No change to step 4's rule that the orchestrator never picks a level itself; a level named in plain words ("run it thorough") stays covered by step 4.
- No change to `README.md` (it already lists the flag), to the Anti-stall rules, or to ADRs.
- No router-level test: `route.test.mjs` already covers `init --rigor`.

## Implementation Approach

Edit the three text surfaces (hint, Start step 1, REFERENCE headings) in both skills, then pin them with content tests. Step 1 gets one added sentence in each skill: the optional flag `--rigor` takes a value, the next word, one of `lean`, `standard` or `thorough` (`--rigor=<level>` too); remove both the flag and its value from the goal text; pass it on to `init` with its value only when the user gave it. Step 4 already says to add `--rigor <level>` only when the user named one; reword it minimally to point back to step 1 so the two steps do not conflict (flag parsed in step 1, plain-words level still handled in step 4).

## Phase 1: Skills and reference

### Overview

Make both skills parse and strip `--rigor`, list it in the hints and the reference headings, and move the one exact-hint assertion with the OpenSpec hint so the suite stays green at the end of this phase.

### Changes Required:

#### 1. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Offer `--rigor` in the hint and parse it in Start step 1, so the flag and its value leave the goal text and reach `init` only when given.

**Contract**: Line 9 becomes `argument-hint: <change-id> [goal text] [--archive] [--chrome false] [--rigor <level>] [--pr-comment]`. Start step 1 gains a sentence naming `--rigor` with its value (`lean`, `standard` or `thorough`, also as `--rigor=<level>`), removing both from the goal text, passing it to `init` only when the user gave it. Step 4's sentence keeps "Never pick one yourself" and "On a resume the flag can only raise the level", and covers a level named in plain words. No model, effort or tier word beyond the three level names already there.

#### 2. OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: Same change for the OpenSpec chain.

**Contract**: Line 10 becomes `argument-hint: <change-name> [goal text] [--archive] [--rigor <level>] [--pr-comment]`. Start step 1 and step 4 get the same wording as the 10x skill, with `<change-name>`. `## Anti-stall rules` stays byte-equal to the 10x skill's.

#### 3. Reference headings

**File**: `docs/REFERENCE.md`

**Intent**: Keep the two skill headings in line with the hints.

**Contract**: Line 5 heading `## \`/agent-smith:10x-pipeline <change-id> [goal] [--archive] [--chrome false] [--rigor <level>] [--pr-comment]\``; line 388 heading `## \`/agent-smith:openspec-pipeline <change-name> [goal] [--archive] [--rigor <level>] [--pr-comment]\``.

#### 4. OpenSpec hint assertion

**File**: `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Keep the existing exact-hint assertion in step with the OpenSpec hint, in the same phase that changes the hint.

**Contract**: Line 72 expects `<change-name> [goal text] [--archive] [--rigor <level>] [--pr-comment]`. No other change to this file in this phase.

### Success Criteria:

#### Automated Verification:

- The `argument-hint` of both skills contains `[--rigor <level>]`: `grep -c "^argument-hint:.*\[--rigor <level>\]" skills/10x-pipeline/SKILL.md skills/openspec-pipeline/SKILL.md`
- Start step 1 of both skills names `--rigor`: `grep -n "^1\. Parse the arguments.*--rigor" skills/10x-pipeline/SKILL.md skills/openspec-pipeline/SKILL.md`
- Both REFERENCE headings list the flag: `grep -n "^## .*agent-smith:.*pipeline.*--rigor" docs/REFERENCE.md`
- Anti-stall sections, prompt rule checks and the hint assertions still pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`

#### Manual Verification:

- Start step 1 and step 4 of each skill read as consistent: the flag form is parsed in step 1, a level in plain words is still handled in step 4, and the orchestrator never picks a level itself.

**Implementation Note**: The hint edit and the assertion at `openspec-skill.test.mjs:72` land together in this phase, so a per-phase full-suite gate stays green.

---

## Phase 2: Content tests

### Overview

Pin the hint and step 1 of both skills with new content tests.

### Changes Required:

#### 1. 10x skill content check

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs`

**Intent**: Add a test that the 10x hint and Start step 1 name `--rigor`.

**Contract**: One test reading the loaded `skill`/`lines`: the `argument-hint:` line includes `[--rigor <level>]`; the line starting `1. Parse the arguments` holds a sentence (split on `. `) that includes `--rigor`, `--rigor=<level>`, `goal text`, `lean`, `standard` and `thorough`, so the `--archive` sentence's own `goal text` cannot satisfy it. Same style as the existing content checks; no new helper beyond a local line lookup.

#### 2. OpenSpec skill content check

**File**: `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Add the Start step 1 check (the exact-hint assertion was updated in Phase 1).

**Contract**: One new test with the same step 1 assertions as the 10x test, using this file's `lines`.

### Success Criteria:

#### Automated Verification:

- Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Deliberate break: with the `--rigor` sentence removed from a scratch copy of the 10x skill, the new test fails: `SKILL_PATH=<scratch copy> node --test skills/10x-pipeline/test/skill-loop.test.mjs`; the same for the OpenSpec skill with `OPENSPEC_SKILL_PATH=<scratch copy> node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Router still starts a run with the flag: in a scratch project with a change folder (git initialised, or `isolation.require` set to `false` in its override), `init <id> --goal "fix typo" --rigor thorough` then `status <id>` prints valid JSON with rigor `thorough`. This proves the router side only; that the flag stays out of the stored goal is the manual row below.

#### Manual Verification:

- Run `/agent-smith:10x-pipeline <id> <goal> --rigor thorough` in a scratch project: the run starts at `thorough` and the stored goal in `meta.json` does not contain `--rigor` or `thorough`.

---

## Testing Strategy

### Unit Tests:

- Content checks of the hint and Start step 1 for both skills (Phase 2), including the deliberate-break run through `SKILL_PATH`.

### Integration Tests:

- Existing suite: `route.test.mjs` already drives `init --rigor`; `nested-subagents.test.mjs`, `rules.test.mjs` and `skill-loop.test.mjs` guard the Anti-stall equality and the word bans.

### Manual Testing Steps:

1. In a scratch project with a change folder, run the 10x skill with `--rigor thorough` after the goal text.
2. Read `meta.json` and `run.jsonl`: rigor requested is `thorough`, goal has no flag words.
3. Repeat with `--rigor=lean` and with no flag (no rigor passed to `init`).

## Performance Considerations

None; documentation text only.

## Migration Notes

None. A resume with `--rigor` can only raise the stored level (existing router rule).

## References

- Change: `context/changes/skill-rigor-flag/change.md`
- Router flag list: `skills/10x-pipeline/scripts/route.mjs:824`, validation at `:846`
- Option table: `README.md:65`
- Existing hint test: `skills/10x-pipeline/test/openspec-skill.test.mjs:72`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skills and reference

#### Automated

- [x] 1.1 The `argument-hint` of both skills contains `[--rigor <level>]`
- [x] 1.2 Start step 1 of both skills names `--rigor`
- [x] 1.3 Both REFERENCE headings list the flag
- [x] 1.4 Anti-stall sections and prompt rule checks still pass

#### Manual

- [x] 1.5 Start step 1 and step 4 of each skill read as consistent — evidence: evidence/judgment-start-steps.md

### Phase 2: Content tests

#### Automated

- [x] 2.1 Skill content tests pass
- [x] 2.2 Deliberate break fails the new 10x test
- [x] 2.3 Full suite passes
- [x] 2.4 Router starts a run with the flag and keeps it out of the goal

#### Manual

- [ ] 2.5 A live skill run with `--rigor thorough` starts a thorough run with a flag-free stored goal
