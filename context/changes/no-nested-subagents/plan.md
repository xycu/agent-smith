# Forbid nested subagents in pipeline steps Implementation Plan

## Overview

A pipeline step runs as a subagent. When that subagent starts its own subagent (the `Agent` tool), Claude Code sends the nested subagent's hand-back report to the top session, not to the parent. The parent ends its turn with no result, the step fails although the work finished, and a rollback discards the finished code. This plan forbids nesting in three places: a hard rule in every prompt (`prompts.suffix`), explicit "same subagent" rules in the templates that run an implement skill, and a rule in both orchestrator skills to ignore a hand-back from a subagent they did not launch for the current step. It also fixes the `docs/REFERENCE.md` Limits note that says the opposite, and adds ADR-018.

Upstream: `context/changes/no-nested-subagents/change.md` (scope list), `complexity.json` (score), `context/foundation/lessons.md` ("Never let a subagent spawn its own subagent"). There is no frame or research file; the codebase was read for this plan.

## Current State Analysis

- The unattended suffix has six rule lines and the `RESULT:` instructions: `skills/10x-pipeline/policy.json` `prompts.suffix`. No line mentions the `Agent` tool. The router appends it to every prompt, the `os-` templates and the `archive` prompt included (`skills/10x-pipeline/scripts/route.mjs:174-178`, `scripts/isolation.mjs:637`).
- `10x-goal-implement` "delegates each phase's code changes to a subagent" (`~/.claude/skills/10x-goal-implement/SKILL.md:98-103`, one `Task` per phase, and a focused `Task` for gate fixes at line 152). The templates `implement` (a plain string, which `executors.test.mjs:273-274` calls `.replace` on), `implement-segment` (array with one inline rule line) and `implement-retry` (`@prompts/executor-retry.md`) run it and say nothing about nesting.
- `/10x-tdd` lists `Agent` in its allowed tools; `/10x-e2e` says "use sub-agents sparingly" (`~/.claude/skills/10x-e2e/SKILL.md:401`). Their guides `prompts/executor-tdd.md` and `prompts/executor-e2e.md` say nothing about nesting.
- `prompts/research-with-map.md:7` says **MUST** "run three parallel subagents". It contradicts the new rule and is wired (`research-with-map` template). `prompts/advisor.md:9` tells `/10x-goal-implement`'s workers not to consult the advisor; with no workers that rule is vacuous but harmless, and `advisor.test.mjs:476` pins it.
- Both orchestrator skills have an identical `## Anti-stall rules` section with five rule lines (`skills/10x-pipeline/SKILL.md:78-86`, `skills/openspec-pipeline/SKILL.md:86-94`). Tests pin "exactly five": `skill-loop.test.mjs:43-47`, `openspec-skill.test.mjs:101-107`, `archive-gate.test.mjs:66-68` (both chains). `openspec-skill.test.mjs:102` requires the two sections to be equal.
- `docs/REFERENCE.md:312` (Limits): "`10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more". The "Orchestrator anti-stall" section (`docs/REFERENCE.md:325-327`) says "Five rules ... The first three hold for every `run` step, the last two for the whole run".
- `AGENTS.md:50` lists ADR-001 to ADR-017.

## Desired End State

- Every prompt the router returns ends with a rule line **MUST NOT** call the `Agent` tool (or start any subagent), do the work in the current subagent, and this wins over any skill that delegates. The line sits before the `RESULT:` instructions.
- `implement`, `implement-segment` and `implement-retry` each carry a rule that `/10x-goal-implement` runs every phase, and every fix of a failed gate, in the same subagent. The `implement-e2e` and `implement-tdd` guides carry the same idea for their skills. `research-with-map` no longer asks for subagents.
- Both `SKILL.md` files have a sixth anti-stall rule: a hand-back from a subagent the orchestrator did not launch for the current step is never a step result; it is ignored and the step's own report stays the only result. The two sections stay equal.
- `docs/REFERENCE.md` Limits states the ban instead of the spawn-depth note, the anti-stall section counts six rules, and ADR-018 records the decision.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, and a new test file `skills/10x-pipeline/test/nested-subagents.test.mjs` pins the new text.

### Key Discoveries:

- The suffix is one string in `policy.json`; the rule-form test (`rules.test.mjs`, "policy.json prompts follow the rule form") checks every line, so the new line needs `**GIVEN**`, `**WHEN**`, `**THEN**` and exactly one bold keyword after `**THEN**`.
- `implement` must stay a string: `executors.test.mjs:273` and other tests call string methods on it. The rule goes in as a second line of the same string, as `implement-segment` already does with an inline rule.
- The anti-stall section is shared text, so the sixth rule is added to both files in the same words. The `skill-loop.test.mjs` needle table is indexed by rule position, so the new rule goes last and the first five keep their indexes.
- `skill-loop.test.mjs` forbids model, effort and tier words in the section, and `openspec-skill.test.mjs` forbids them in the whole skill; the new rule uses none.
- A prompt change moves provenance hashes (`prompts`), so a run in flight records `provenance.drift` at its next `next` call. Routing is unaffected; REFERENCE.md gets an upgrade note, as ADR-016 did.

## What We're NOT Doing

- No router code change: `route.mjs` and the modules under `scripts/` stay as they are. No new policy key.
- No new `result` status and no router-side detection of a nested hand-back. The router cannot see who wrote a result file; the orchestrator rule is the only guard.
- No edit to the Claude Code skills in `~/.claude/skills/` (`10x-goal-implement`, `10x-tdd`, `10x-e2e`, `10x-plan`). The prompt overrides them, as it does for `AskUserQuestion`.
- No change to `advisor.md` or its pinned rule. With no workers its worker line is vacuous but true.
- No per-template exception: no step may spawn a subagent. Research steps that ask a skill for "parallel research" (`/10x-plan`, `/10x-research`) do the research in the step subagent.
- No filing of the Claude Code hand-back routing bug; that report is a separate task of the owner (`change.md`).
- No edit of `context/archive/` or of the router's run files.

## Implementation Approach

Three phases, each ending with a green suite. Phase 1 makes the subagent-side text and its new test file. Phase 2 makes the orchestrator-side rule and updates the three "exactly five" tests. Phase 3 writes the documents. The subagent-side text goes first because it is the fix that prevents the failure; the orchestrator rule is a guard for the case the subagent ignores the prompt. The new suffix line, one rule, in the wording the implementer may tighten but not weaken:

`- **GIVEN** a skill or a prompt tells you to delegate work to a subagent, to run work in parallel with subagents or to use the Agent tool **WHEN** you decide how to do that work **THEN** you **MUST NOT** call the Agent tool or start any other subagent, and you do all of it yourself in this subagent, because the report of a nested subagent goes to the top session and never reaches you.`

## Phase 1: Subagent-side rules

### Overview

Put the ban in the suffix and the "same subagent" rule in the templates that run a delegating skill, remove the one wired prompt that demands subagents, and pin all of it in a new test file.

### Changes Required:

#### 1. The suffix rule

**File**: `skills/10x-pipeline/policy.json` (`prompts.suffix`)

**Intent**: Add one rule line that forbids the `Agent` tool and any nested subagent, for every step. It overrides skills that delegate.

**Contract**: One `**GIVEN** ... **WHEN** ... **THEN** you **MUST NOT** ...` line, placed after the two deletion rules and before the `Finish your reply with exactly one line` instruction, so the `RESULT:` instructions stay last. One bold keyword. It names the `Agent` tool (and may name the older `Task` tool) and the reason in plain words. It names no model, effort or tier. It speaks of subagents and the `Agent`/`Task` tools only; it does not forbid the advisor tool (`prompts/advisor.md`), `Read`, `Grep` or `Glob`, and it must not read as if it did.

#### 2. Implement templates

**File**: `skills/10x-pipeline/policy.json` (`implement`, `implement-segment`), `skills/10x-pipeline/prompts/executor-retry.md`

**Intent**: Tell `/10x-goal-implement` to write every phase's code in the same subagent, and to fix a failed gate itself, instead of dispatching a `Task` per phase.

**Contract**: One rule line with the same words in the three places, in this form: `- **GIVEN** `/10x-goal-implement` would dispatch a subagent for the code of a phase or for the fix of a failed gate **WHEN** you run it in this step **THEN** you **MUST** write that code and those fixes yourself in this subagent, for every phase, and call no Agent or Task tool.` One keyword. `implement` stays a string: the line is appended after a newline, as `implement-segment` already does. `executor-retry.md` gets the line in its `## Rules` list.

#### 3. Executor guides

**File**: `skills/10x-pipeline/prompts/executor-tdd.md`, `skills/10x-pipeline/prompts/executor-e2e.md`

**Intent**: The same rule for `/10x-tdd` (lists `Agent` among its tools) and `/10x-e2e` (suggests sub-agents for search and analysis): do the search and analysis in this subagent.

**Contract**: One rule line in each `## Rules` list, rule form, one keyword, same idea as the implement line (the line names the skill's own delegation, not the suffix rule).

#### 4. The research prompt that demands subagents

**File**: `skills/10x-pipeline/prompts/research-with-map.md`

**Intent**: Remove the contradiction with the suffix. The three analyses stay (e2e trace, test gaps, blast radius); the step subagent does them itself, one after the other.

**Contract**: Line 7 becomes a rule that says `you MUST work through three analyses yourself, one after the other: ...`. The three rules for what each analysis reports keep their content but speak of "the e2e trace", "the test gaps" and "the blast radius" analysis instead of "subagent ... reports". `preplan.test.mjs:139-140` requires that the file mentions no `frontmatter`; keep it so.

#### 5. Prompt index

**File**: `skills/10x-pipeline/prompts/README.md`

**Intent**: Keep the doc true. The opening paragraph already says the suffix carries the deletion rule; add the nesting rule to it, and change the `research-with-map.md` row if its description says "subagents".

**Contract**: Prose only; no new table row, because no new prompt file is added. The `Not wired` row of `refactor-opportunities-research.md` gets a clause in its last cell that the file asks for three exploration subagents, which `prompts.suffix` forbids, so it needs the same rewrite as `research-with-map.md` before anyone wires it. The file itself stays unedited (it is not wired), and the table keeps its three rows, so the `notWired` list pinned in `preplan.test.mjs` stays equal.

#### 6. New test file

**File**: `skills/10x-pipeline/test/nested-subagents.test.mjs`

**Intent**: Pin the subagent-side text and show the router delivers it.

**Contract**: `node:test`, reads `policy.json` and the prompt files as the other tests do (`no-recursive-delete.test.mjs` is the model for the suffix checks). Tests: (a) the suffix has exactly one line that names the `Agent` tool with `**MUST NOT**`, it is a rule line that passes `ruleProblems`, and it comes before the `RESULT:` line; (b) the policy `implement` string, `implement-segment` and `executor-retry.md` each contain the identical "same subagent" line, and the e2e and tdd guides each contain a rule that names the skill and the `Agent` or `Task` tool; (c) `research-with-map.md` contains no `subagent` (case-insensitive) and keeps the three analysis names (`e2e trace`, `test gaps`, `blast radius`); (d) a prompt returned by the real router for an `implement` step (`init` and `next` in a scratch project from `helpers.mjs`) contains the suffix rule and the implement rule, once each; (e) no prompt text names a model, effort or tier word in the new lines.

#### 7. Existing test that counts the suffix rules

**File**: `skills/10x-pipeline/test/route.test.mjs` (the test "the plan prompt carries the six rules and the RESULT line with signals", lines 581-590)

**Intent**: The test counts the `- **GIVEN**` lines of the plan prompt, which are the suffix rules, and asserts 6. The new suffix line makes it 7, so the whole-suite check of this phase fails unless the test changes.

**Contract**: Title says seven, `assert.equal(rules.length, 7)`; the four existing `rules[0]` to `rules[3]` assertions keep their indexes because the new line sits after the two deletion rules (index 6); add one assertion that `rules[6]` matches `**MUST NOT**` and the `Agent` tool. No other change to that test.

### Success Criteria:

#### Automated Verification:

- The new test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs`
- Rule form holds for policy prompts and prompt files: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Suffix, delete-ban and advisor tests still pass: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/advisor.test.mjs`
- Executor and pre-plan prompt tests still pass: `node --test skills/10x-pipeline/test/executors.test.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/codereplan.test.mjs`
- The research prompt asks for no subagent: `grep -ni "subagent" skills/10x-pipeline/prompts/research-with-map.md` prints nothing
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the new suffix line and the implement line once and confirm an unattended subagent that holds a skill saying "dispatch a Task" can tell which instruction wins, and that the line leaves it a way to finish (do it yourself)

**Implementation Note**: After this phase passes its automated checks, pause for the manual confirmation before Phase 2.

---

## Phase 2: Orchestrator rule in both skills

### Overview

Add the sixth anti-stall rule to the 10x and OpenSpec orchestrator skills, in the same words, and update the tests that pin "five".

### Changes Required:

#### 1. The sixth rule and the section intro

**File**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md` (section `## Anti-stall rules`)

**Intent**: A hand-back that comes from a subagent the orchestrator did not launch for the current step (typically one a step subagent started, or a late one of an earlier step) is never a step result. The orchestrator ignores it and keeps the report of the subagent it launched as the only result.

**Contract**: One new `**GIVEN** ... **WHEN** ... **THEN** the orchestrator **MUST NOT** ...` line appended after rule 5, identical in both files. It names: a hand-back, a subagent the orchestrator did not launch for the current step, the step's own report, the result file and `next` (it writes no result file from the foreign hand-back and does not call `next` on it). One keyword. No model, effort or tier word. The intro paragraph changes so rules 1, 2, 3 and 6 are the per-step rules and the archive subagent is covered by rules 1 and 6; rules 4 and 5 stay whole-run. The rule also says how the orchestrator tells the two apart: a hand-back is the step's own only when it is the result of the Agent call it made for the current step, or the task notification that names that call's subagent (the agent id or description the launch notice or result gave); a hand-back that names another subagent, or none it can match to a call of this step, is foreign. The wording must not assume the orchestrator can see who a foreign hand-back's author was. The new rule must not tell the orchestrator to wait with an idle turn: it sits with rule 1 (end the turn on a launch notice, continue when the step's own report arrives) and rule 4 (no idle end while a launched subagent still runs).

#### 2. Update the pinned counts and add the new needle

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`

**Intent**: The tests say five; the skills now have six rule lines. Keep every other check.

**Contract**: `skill-loop.test.mjs`: rule count and total `**GIVEN**` count become 6 and the title says six; add a sixth entry to `NEEDLES` (`"did not launch"`, `"MUST NOT"`, `"result"` or the wording chosen). `openspec-skill.test.mjs`: the two counts become 6. `archive-gate.test.mjs`: the per-chain test "still exactly five GIVEN lines" becomes six (title and number). `rules.test.mjs` needs no change (it checks the form of every line in the section).

#### 3. Add checks to the new test file

**File**: `skills/10x-pipeline/test/nested-subagents.test.mjs`

**Intent**: Pin the rule in both skills with one check that the rule text is identical in the two files and that the intro names rule 6.

**Contract**: For each skill: the section holds a rule line that includes the needles above; the line is equal in both files; `ruleProblems` of the line is empty; the intro line mentions the sixth rule. Test titles say "sixth rule".

### Success Criteria:

#### Automated Verification:

- Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs`
- Rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs`
- New test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs`
- The two sections are equal: `diff <(sed -n '/^## Anti-stall rules/,/^## PR comment/p' skills/10x-pipeline/SKILL.md) <(sed -n '/^## Anti-stall rules/,/^## PR comment/p' skills/openspec-pipeline/SKILL.md)` prints nothing
- PR comment tests that read the skills still pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/open-pr.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the new rule in `skills/10x-pipeline/SKILL.md` next to rules 1 and 4 and confirm they cannot be followed into a deadlock (the orchestrator neither ends its turn idle while its own subagent runs nor waits for a foreign hand-back)

**Implementation Note**: After this phase passes its automated checks, pause for the manual confirmation before Phase 3.

---

## Phase 3: Documents

### Overview

Fix the Limits note, count six rules, record ADR-018, and keep the contributor guide true.

### Changes Required:

#### 1. REFERENCE.md

**File**: `docs/REFERENCE.md`

**Intent**: Replace the false Limits note and document the new behavior in the sections that describe the suffix and the anti-stall rules.

**Contract**: (a) Limits: the line "`10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` ..." becomes a line that says a step subagent starts no subagent, why (the nested report goes to the top session), where the rule lives (the suffix, the implement templates, the executor guides, both skills) and that `/10x-goal-implement` therefore runs every phase in the step's own subagent, so the spawn-depth setting is not needed. (b) "Orchestrator anti-stall": "Five rules" becomes six; the "first three ... last two" sentence is rewritten for the new split; one bullet states the sixth rule. (c) "File deletion (ADR-016)" is not touched. (d) An upgrade note in the new bullet block: the suffix and prompts change, so a run in flight records `provenance.drift` for `prompts` at its next `next` call, and routing is unaffected. (e) The sentence in "Advisor (opt-in)" about the workers of `/10x-goal-implement` stays true; no edit.

#### 2. ADR-018

**File**: `docs/ADR/ADR-018-no-nested-subagents.md`

**Intent**: Record the decision, as ADR-015 and ADR-016 did.

**Contract**: Same headings as ADR-016 (Status, Date, Deciders, Origin, Context, Decision, Consequences, Alternatives, Assumptions, Not covered). Rules in scenario form (`rules.test.mjs` "ADR rule lines follow the rule form" checks every `**GIVEN**` line outside fences). Content: the failure of 2026-11-09 (`neutral-orchestrator-retry` and `worktree-pr-only` implement steps); the four rules (suffix, implement and executor templates, orchestrator ignore rule, research prompt); alternatives rejected (raise `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, which does not fix hand-back routing; a router-side check, which cannot see the author of a result file; wait for the upstream Claude Code fix); assumptions A1 and up for the readings made while planning (see Open Risks); not covered (what a subagent actually calls, a nested subagent that ignores the rule, the upstream bug). Status `Proposed (unattended reading, owner confirmation pending)`.

#### 3. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Keep the ADR list and the test list true.

**Contract**: The `docs/ADR/` bullet names ADR-018 with a one-clause summary; the test bullets get one entry for `nested-subagents.test.mjs`. Two existing test bullets say "five" and become false, so they change too: the `skill-loop.test.mjs` bullet ("five rules in order" becomes six) and the `archive-gate.test.mjs` bullet ("five `**GIVEN**` lines" becomes six). No other line changes.

#### 4. Guard against drift in the docs

**File**: `skills/10x-pipeline/test/nested-subagents.test.mjs`

**Intent**: A doc test so the old note cannot come back.

**Contract**: `docs/REFERENCE.md` no longer contains `spawns its own subagents` nor `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` as a requirement; it contains `ADR-018`; `docs/ADR/ADR-018-no-nested-subagents.md` exists and its rule lines pass `ruleProblems`. Keep it to those checks.

### Success Criteria:

#### Automated Verification:

- New test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs`
- ADR rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs`
- The old note is gone: `grep -rn "spawns its own subagents" docs README.md AGENTS.md skills` prints nothing
- No banned delete form entered the docs: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`
- Version fields still agree: `node tools/version-check.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the new Limits line, the anti-stall bullets and ADR-018 once and confirm they agree with each other and with the prompt text of Phases 1 and 2 (same rule names, same reason, no claim that the upstream bug is fixed)
- Run `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` and `status demo` in a scratch change folder and confirm the output is valid JSON and a returned `implement` prompt ends with the suffix, whose nesting rule stands before the `RESULT:` line

**Implementation Note**: After this phase passes its automated checks, pause for the manual confirmation. The commit type for the whole change is the owner's call; the change touches prompts and docs only, so `fix:` is the natural type (a patch bump).

---

## Testing Strategy

### Unit Tests:

- New `nested-subagents.test.mjs`: suffix rule and its position, the implement, segment, retry, tdd and e2e lines, the research prompt, the two skills' sixth rule and its equality, the REFERENCE.md and ADR-018 checks.
- Updated: `skill-loop.test.mjs`, `openspec-skill.test.mjs`, `archive-gate.test.mjs` (six rule lines, a sixth needle), and `route.test.mjs` (the plan prompt carries seven suffix rules).

### Integration Tests:

- The test that drives the real router through `init` and `next` in a scratch project and reads the returned `implement` prompt (inside the new test file).
- The existing whole suite, which already covers prompt wiring, rule form, provenance and the delete ban.

### Manual Testing Steps:

1. Read the suffix line, the implement line and the sixth anti-stall rule together, as a subagent and as an orchestrator would meet them.
2. Run `init` and `status` against a scratch change folder and read the returned prompt.
3. Run the suite once from a clean checkout of the branch.

## Performance Considerations

The suffix grows by one line, so every prompt is a few dozen tokens longer. No router cost change.

## Migration Notes

No state migration. A run in flight at upgrade time records `provenance.drift` for `prompts` (and no other section; `policy.json` `prompts` is the only policy section that changes) at its next `next` call. Routing is unaffected, and `compare` warns `provenance-drift:<side>:prompts`.

## Open Risks & Assumptions

- A1: the suffix line is the one place that must hold; the implement and executor lines repeat the idea in the words of the skill that delegates, because a subagent weighs a rule that names its own skill more than a general one. Evidence: the failure of 2026-11-09 happened while the suffix had no such rule.
- A2: the new rule goes into the existing anti-stall section as rule 6, not into `## Rules` or the Loop branches, because `change.md` says the anti-stall section stays equal in both skills and the section already holds the hand-back rules (1 and 2). The cost is three "exactly five" tests that change.
- A3: `implement` stays a string, so the rule goes in as a second line of that string. Evidence: `executors.test.mjs:273`.
- A4: `research-with-map.md` is edited (not left to lose to the suffix), because two rules that disagree in one prompt make a subagent guess. The prompt file's opening line and content rules stay.
- A5: ADR-018 is written, because the change replaces a documented limit and adds a rule to every prompt, as ADR-016 did. The owner may drop it; the tests in Phase 3 then lose two checks.
- A6: the commit type is not decided here; `fix:` is suggested in Phase 3.
- Risk: a subagent that ignores the suffix still nests, and the orchestrator then has no signal to tell it apart from the step's own report when it arrives in the same session. The sixth rule says what to do when the orchestrator can tell (the hand-back names a subagent it did not launch for this step); it cannot make a mixed-up hand-back reliable. Not solvable here; the upstream bug stays open.
- Risk: the skills `10x-goal-implement`, `10x-tdd` and `10x-e2e` live outside this repository and may change their delegation wording; the rule lines name the behavior, not a line of those skills.

## References

- Change identity: `context/changes/no-nested-subagents/change.md`
- Score: `context/changes/no-nested-subagents/complexity.json`
- Lesson: `context/foundation/lessons.md` ("Never let a subagent spawn its own subagent")
- Suffix: `skills/10x-pipeline/policy.json` `prompts.suffix`; appended at `skills/10x-pipeline/scripts/route.mjs:174-178`
- Delete-ban precedent: `docs/ADR/ADR-016-no-recursive-force-delete.md`, `skills/10x-pipeline/test/no-recursive-delete.test.mjs:244-248`
- Anti-stall tests: `skills/10x-pipeline/test/skill-loop.test.mjs:43-47`, `skills/10x-pipeline/test/openspec-skill.test.mjs:101-107`, `skills/10x-pipeline/test/archive-gate.test.mjs:66-68`
- Limits note: `docs/REFERENCE.md:312`; anti-stall section: `docs/REFERENCE.md:325-327`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Subagent-side rules

#### Automated

- [x] 1.1 The new test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs` — faaff97
- [x] 1.2 Rule form holds for policy prompts and prompt files: `node --test skills/10x-pipeline/test/rules.test.mjs` — faaff97
- [x] 1.3 Suffix, delete-ban and advisor tests still pass: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/advisor.test.mjs` — faaff97
- [x] 1.4 Executor and pre-plan prompt tests still pass: `node --test skills/10x-pipeline/test/executors.test.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/codereplan.test.mjs` — faaff97
- [x] 1.5 The research prompt asks for no subagent: `grep -ni "subagent" skills/10x-pipeline/prompts/research-with-map.md` prints nothing — faaff97
- [x] 1.6 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — faaff97

#### Manual

- [ ] 1.7 Read the new suffix line and the implement line once and confirm an unattended subagent that holds a skill saying "dispatch a Task" can tell which instruction wins, and that the line leaves it a way to finish (do it yourself)

### Phase 2: Orchestrator rule in both skills

#### Automated

- [x] 2.1 Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs` — 04cd550
- [x] 2.2 Rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs` — 04cd550
- [x] 2.3 New test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs` — 04cd550
- [x] 2.4 The two anti-stall sections are equal: `diff <(sed -n '/^## Anti-stall rules/,/^## PR comment/p' skills/10x-pipeline/SKILL.md) <(sed -n '/^## Anti-stall rules/,/^## PR comment/p' skills/openspec-pipeline/SKILL.md)` prints nothing — 04cd550
- [x] 2.5 PR comment tests that read the skills still pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/open-pr.test.mjs` — 04cd550
- [x] 2.6 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 04cd550

#### Manual

- [ ] 2.7 Read the new rule in `skills/10x-pipeline/SKILL.md` next to rules 1 and 4 and confirm they cannot be followed into a deadlock (the orchestrator neither ends its turn idle while its own subagent runs nor waits for a foreign hand-back)

### Phase 3: Documents

#### Automated

- [x] 3.1 New test file passes: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs` — f5dafa7
- [x] 3.2 ADR rule form holds: `node --test skills/10x-pipeline/test/rules.test.mjs` — f5dafa7
- [x] 3.3 The old note is gone: `grep -rn "spawns its own subagents" docs README.md AGENTS.md skills` prints nothing — f5dafa7
- [x] 3.4 No banned delete form entered the docs: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — f5dafa7
- [x] 3.5 Version fields still agree: `node tools/version-check.mjs` — f5dafa7
- [x] 3.6 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — f5dafa7

#### Manual

- [ ] 3.7 Read the new Limits line, the anti-stall bullets and ADR-018 once and confirm they agree with each other and with the prompt text of Phases 1 and 2 (same rule names, same reason, no claim that the upstream bug is fixed)
- [ ] 3.8 Run `node skills/10x-pipeline/scripts/route.mjs init demo --goal "x"` and `status demo` in a scratch change folder and confirm the output is valid JSON and a returned `implement` prompt ends with the suffix, whose nesting rule stands before the `RESULT:` line
