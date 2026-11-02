# Orchestrator Anti-Stall Rules Implementation Plan

## Overview

Add five GIVEN/WHEN/THEN rules to `skills/10x-pipeline/SKILL.md` so the orchestrator never stalls between steps of a run. Origin: in the managed-agent-patterns run (2026-11-02) the orchestrator ended its turn waiting for a usage notice after the `score` step had reported back. Nothing was running and the run sat idle until the user asked. The rules are guarded by tests of their form and content, and documented in `README.md`, `AGENTS.md` and the scope list of ADR-004.

## Current State Analysis

- The Loop section of `skills/10x-pipeline/SKILL.md` (lines 37-59) tells the orchestrator to call the Agent tool with `run_in_background: false`, parse the `RESULT:` line, add `usage` "if the Agent result reports usage", write the `resultFile`, run `next` and repeat (lines 43-46). It says nothing about a background launch notice, a usage figure that arrives late, or when a turn may end.
- Legal turn ends besides the end of a run: Start step 2 (`STOP` when `change.md` is missing, the change is archived, or the 10x skills are missing, SKILL.md:30), the `archive` branch step 5 (`archived: false`, then `STOP`, SKILL.md:57) and the `halt` branch (SKILL.md:58-59).
- The `archive` action has no result file and no `next` call (SKILL.md:54); a usage figure of the archive subagent goes into the final message (SKILL.md:56).
- The router logs a step when it returns it: `log.push(entry); writeLog(p.log, log)` runs before the `run` object is printed (`skills/10x-pipeline/scripts/route.mjs:2218-2219`).
- `next` consumes `last-result.json` and deletes it (`route.mjs:433-442`). When the last logged step has no result and no result file exists, `next` halts with `Step <n> (<step>) has no result. Write <resultFile> first.` (`route.mjs:436-438`); `init` on a resume calls `next` too (`route.mjs:2625`). `usage` is stored through `cleanUsage` only if the key is in the result file (`route.mjs:482-483`, `route.mjs:360-368`). A step without a figure shows `-` in `report.md` (`route.mjs:296`), and `compare` marks a side with such a step `usage-incomplete` (`route.mjs:2433`).
- SKILL.md prose is checked by `skills/10x-pipeline/test/pr-comment.test.mjs:662-735` only. Its `branch()` helper (not exported) reads a loop branch up to the next line starting `- **` or `## `, so new text must not sit inside an existing branch. No test checks SKILL.md for the ADR-004 rule form: `skills/10x-pipeline/test/rules.test.mjs` checks `policy.json` prompts, `prompts/*.md` and ADR rule lines, and ADR-004 lists exactly that scope (`docs/ADR/ADR-004-prompt-rules-as-scenarios.md:30-34`, `:51`).
- SKILL.md has no `**GIVEN**` line today.
- AGENTS.md hard rule: `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.

## Desired End State

SKILL.md has a section `## Anti-stall rules` between `## Loop` and `## PR comment (opt-in)`: a short prose intro and five rules in ADR-004 form (one line each, one bold RFC 2119 keyword after `**THEN**`), one per behavior in `change.md`, in that order. The Loop `run` branch points at the section. `rules.test.mjs` checks the section's form and a new `skill-loop.test.mjs` checks the five behaviors, the placement and that the section names no model, effort or tier. README documents the rules and the headless limit of rule 1, AGENTS.md lists the new test file and ADR-004 lists the section in its checked scope. The full suite passes.

### Key Discoveries:

- The router deletes `last-result.json` when `next` runs (`route.mjs:442`), so a late usage figure has nowhere to go; the only legal outcome is that the step shows `-` for tokens. Rule 3 states this instead of adding a command.
- A new `## ` section ends the `halt` branch for `branch()` in `pr-comment.test.mjs:663-671`, so placing the rules in their own `## ` section keeps the PR comment tests (`countOf(text, "TaskList") === 1` per branch) unaffected. Checked on a scratch copy of SKILL.md with the reference wording below: every branch keeps its counts and holds no `**GIVEN**` line.
- A SKILL.md rule line must carry exactly one bold keyword (`rules.test.mjs:17-35`), and the strict prose check rejects a bold keyword or an upper-case `SHALL`, `REQUIRED`, `RECOMMENDED` or `OPTIONAL` on any other line (`rules.test.mjs:38-44`).
- An interrupted step cannot resume by itself: the router has already logged it, so a re-run halts with `has no result` until a result file is written (`route.mjs:436-438`, `route.mjs:2218-2219`). The README limit for headless runs states this.

## What We're NOT Doing

- No `route.mjs usage <id> <n>` command. `change.md` marks it optional and "may be split out". It touches the router, `run.jsonl` ownership (AGENTS.md hard rule) and a second test surface. Split into a later change if late usage figures matter.
- No headless branch in rule 1 (owner decision on plan-review finding F6). The headless behavior is a documented limit in README only.
- No change to `route.mjs`, `policy.json`, prompts, or the step budget. A router path that reruns an interrupted step without a result file is out of scope.
- No live reproduction of the background-launch notice or of a headless run. It is orchestrator runtime behavior and cannot be driven by the node:test suite; the tests check the text only.
- No new ADR. The change adds no routing or architecture decision; ADR-004 only gets its scope list extended.

## Implementation Approach

Write the rules as a standalone SKILL.md section so existing branch-based tests stay valid. Keep each rule on one line in ADR-004 form. Guard them with a form check (extend `rules.test.mjs`) and a content check (new `skill-loop.test.mjs`). Then document in README, AGENTS.md and ADR-004. Three small phases, each independently verifiable.

## Phase 1: Anti-stall rules in SKILL.md

### Overview

Add the section with an intro and the five rules, and a pointer from the Loop `run` branch.

### Changes Required:

#### 1. Anti-stall section

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add `## Anti-stall rules` after the `halt` branch of Loop and before `## PR comment (opt-in)`. A short prose intro (one paragraph) states the scope, then five rule lines follow, in this order:

1. Background launch: in a `run` step the Agent tool returns a launch notice instead of a final report although `run_in_background` is `false`. The orchestrator ends its turn and continues the Loop at step 3 (find the `RESULT:` line) when the subagent's final report arrives. It does not start another step or poll.
2. Missing usage at report time: the final report of a `run` step holds its `RESULT:` line and no usage figure has arrived. The orchestrator writes the result file without `usage` and runs `next` in the same turn.
3. Late usage: a usage figure arrives after `next` ran for a `run` step. The orchestrator never rewrites the result file or calls `next` again for that step. The step keeps `-` for tokens in the report.
4. No idle end: the run has not ended in `done`, `archive` or `halt`, and no STOP instruction of the Start or Loop sections applies (for example `archived: false` in the `archive` branch). The orchestrator never ends its turn unless a launched subagent is still running.
5. Status question: the user asks what the run is doing. The orchestrator states only what tool output in this session shows, and says so when nothing is running.

The intro says three things, as prose, not as extra rules: rule 1 also holds for the archive subagent, and after its final report the orchestrator continues at step 4 of the `archive` branch; rules 2 and 3 do not apply to it, because the `archive` action has no result file and no `next` call, so a usage figure it reports goes only into the final message; a run has ended when the orchestrator has finished every step of its `done`, `archive` or `halt` branch (so rule 4 still holds while the `done` or `archive` branch is being worked through, and the STOP of `archived: false` is the exit it names).

**Contract**: Each rule is one line: `- **GIVEN** <context> **WHEN** <trigger> **THEN** <subject> **MUST** <behavior>.` or the same with `**MUST NOT**` (rules 3 and 4). Exactly one bold keyword per rule line, after `**THEN**`. No bold keyword and no upper-case `MUST`, `SHOULD`, `MAY`, `SHALL`, `REQUIRED`, `RECOMMENDED` or `OPTIONAL` on any other line of the section. The section names no model, effort or tier (no word matching `/\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i`) and no `PR comment` text, so the `pr-comment.test.mjs` line filter ignores it. The five `**GIVEN**` lines are the only ones in SKILL.md. The Phase 2 needles must appear verbatim in the matching rule line. Reference wording, checked on a scratch copy against the rule-form check, the needles, the banned-word regex and `branch()`:

```markdown
## Anti-stall rules

These rules hold for every `run` step. Rule 1 also holds for the archive subagent: when its final report arrives, continue at step 4 of the `archive` branch. Rules 2 and 3 do not apply to it, because the `archive` action has no result file and no `next` call; a usage figure it reports goes only into the final message. A run has ended when the orchestrator has finished every step of its `done`, `archive` or `halt` branch.

- **GIVEN** a `run` step **WHEN** the Agent tool returns a launch notice instead of a final report although `run_in_background` is `false` **THEN** the orchestrator **MUST** end its turn and continue the Loop at step 3 when the subagent's final report arrives, without starting another step or polling.
- **GIVEN** the final report of a `run` step holds its `RESULT:` line **WHEN** no usage figure has arrived **THEN** the orchestrator **MUST** write the result file without `usage` and run `next` in the same turn.
- **GIVEN** `next` ran for a `run` step **WHEN** a usage figure for that step arrives later **THEN** the orchestrator **MUST NOT** rewrite the result file or call `next` again, so the step keeps `-` for tokens in the report.
- **GIVEN** the run has not ended in `done`, `archive` or `halt` and no STOP instruction of the Start or Loop sections applies (for example `archived: false` in the `archive` branch) **WHEN** the orchestrator would end its turn **THEN** it **MUST NOT** end it unless a launched subagent is still running.
- **GIVEN** a run in this session **WHEN** the user asks what the run is doing **THEN** the orchestrator **MUST** state only what tool output in this session shows, and say so when nothing is running.
```

#### 2. Pointer from the Loop

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In the `run` branch step 4, add a pointer so the step cannot be read as waiting for a usage figure, and the Loop and the new rules do not contradict each other.

**Contract**: Step 4 keeps "add `usage` when the Agent result reports it, copied exactly, omit the key otherwise" and adds one sentence before the Write instruction: "Do not wait for a figure that has not arrived; see the anti-stall rules." The lowercase text `anti-stall rules` is the needle Phase 2 checks. No change to the `done`, `archive` or `halt` branches (they are covered by `pr-comment.test.mjs` counts).

### Success Criteria:

#### Automated Verification:

- The section exists once, between `## Loop` and `## PR comment (opt-in)`: `node -e "const s=require('fs').readFileSync('skills/10x-pipeline/SKILL.md','utf8');const a=s.indexOf('## Loop'),b=s.indexOf('## Anti-stall rules'),c=s.indexOf('## PR comment (opt-in)');process.exit(a<b&&b<c&&s.split('## Anti-stall rules').length===2?0:1)"`
- Existing SKILL.md tests still pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`

#### Manual Verification:

- Reading the section, each of the five behaviors in `change.md` appears as exactly one rule, in the stated order, and the rules do not contradict the Loop steps (in particular the STOP instructions of Start step 2 and `archive` step 5, and `archive` step 4).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Tests for the rules

### Overview

Guard the form (ADR-004) and the content of the section.

### Changes Required:

#### 1. Rule-form check for SKILL.md

**File**: `skills/10x-pipeline/test/rules.test.mjs`

**Intent**: Add one test that slices the `## Anti-stall rules` section out of `skills/10x-pipeline/SKILL.md` (up to the next `## ` heading) and runs `lineProblems(lines, { strict: true })` over it, as done for `prompts/*.md`.

**Contract**: Test name `SKILL.md anti-stall rules follow the rule form`. It asserts the section exists and has no problems. It reuses `lineProblems` and `SKILL_DIR` already defined in the file; no export change.

#### 2. Content check

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs` (new)

**Intent**: Assert the section holds exactly five rule lines and that each behavior is recognisable by fixed needles in its own line, so a rewording that drops or reorders a behavior fails. Assert the section is outside every Loop branch, that the `run` branch points at it, that SKILL.md has no `**GIVEN**` line outside the section, and that the section's text names no model, effort or tier.

**Contract**:
- Read the file with `fs.readFileSync`; the path defaults to `skills/10x-pipeline/SKILL.md` resolved from `import.meta.url` and is overridden by the `SKILL_PATH` environment variable, for the deliberate-break check.
- Section: from `## Anti-stall rules` to the next `## ` heading. Rule lines are the lines that contain `**GIVEN**`; there are exactly five, and SKILL.md as a whole has exactly five.
- Needles are positional: rule line k contains every needle of set k. (1) `run_in_background`, `launch notice`, `end its turn`; (2) `` without `usage` ``, `` `next` ``, `same turn`; (3) `**MUST NOT**`, `rewrite`, `result file`; (4) `done`, `archive`, `halt`, `still running`; (5) `tool output`, `nothing is running`.
- Branches: a local copy of the `branch()` helper of `pr-comment.test.mjs:663-670` (it is not exported, and importing a test file runs its tests). For `run`, `done`, `archive` and `halt` the branch text holds no `**GIVEN**`; the `run` branch contains `anti-stall rules`.
- Banned words on the section text, as in `pr-comment.test.mjs:731`: `/\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i`.
- The file name is covered by the glob in the AGENTS.md test command.

### Success Criteria:

#### Automated Verification:

- Rule-form tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- Deliberate-break check: removing rule 3 (the third `**GIVEN**` line; the content test asserts the five rules are the only `**GIVEN**` lines in SKILL.md) from SKILL.md in a scratch copy makes the content test fail (the test accepts a path override via the `SKILL_PATH` environment variable). Create the copy first, so a missing file cannot make the check pass by accident: `node -e "const fs=require('fs');let n=0;const L=fs.readFileSync('skills/10x-pipeline/SKILL.md','utf8').split('\n').filter(l=>!(l.includes('**GIVEN**')&&++n===3));fs.writeFileSync(process.env.TMPDIR+'/SKILL-broken.md',L.join('\n'))" && test -s $TMPDIR/SKILL-broken.md && ! SKILL_PATH=$TMPDIR/SKILL-broken.md node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

None; the tests are the check.

**Implementation Note**: This phase has no manual check. Go on to Phase 3 once every automated check above passes.

---

## Phase 3: Documentation

### Overview

Record the rules, their headless limit and the wider rule-form scope where contributors look.

### Changes Required:

#### 1. README

**File**: `README.md`

**Intent**: Add a short group `Orchestrator anti-stall:` after `Limits:` and before `PR comment (opt-in):`. It lists the five rules in plain words and states that a usage figure that arrives after `next` is dropped, so that step shows `-` for tokens and `compare` counts the side as `usage-incomplete`. Its last bullet states the headless limit of rule 1 (owner decision on F6), worded as expected behavior, not as a tested fact:
- Rule 1 relies on the host giving the orchestrator a new turn when a background subagent ends, as an interactive Claude Code session does.
- In a headless `claude -p` run the process is expected to end when the orchestrator ends its turn, and the background subagent most likely ends with it: the run exits early instead of stalling. This has not been verified in a live headless run.
- The interrupted step writes no result file. The router logged the step when it returned it, so re-running `/agent-smith:10x-pipeline <change-id>` halts with `Step <n> (<step>) has no result. Write <resultFile> first.` Writing a result file with a status other than `done` there (for example `{"status":"failed","note":"interrupted"}`) and re-running counts the step as a failed attempt, which the router handles like any other failed step (`route.mjs:433-442` reads and deletes the file; `route.mjs:487` sets `last.ok = result.status === "done" && verified`, so a status other than `done` is a failure).
- A killed subagent may leave partial edits in the working tree; check `git status` before the re-run.

**Contract**: The group lies between `\nLimits:` and `\nPR comment (opt-in):`, because `pr-comment.test.mjs` requires the PR comment group after `Limits:` and before `## Layout`. It uses the words `background`, `usage-incomplete`, `same turn`, `idle`, `tool output` (one per behavior) and `headless`, `claude -p`, `has no result`, `not been verified` (the limit). Prose carries no bold keyword and no bare `MUST`.

#### 2. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Add `skills/10x-pipeline/test/skill-loop.test.mjs` to the Project Structure test list with one clause: the content check of the `## Anti-stall rules` section of SKILL.md, whose rule form `rules.test.mjs` checks.

**Contract**: One bullet under `## Project Structure`, same style as the neighbouring test bullets.

#### 3. ADR-004 scope

**File**: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`

**Intent**: The ADR lists exactly what the rule-form check covers; after Phase 2 that list is incomplete. Add the SKILL.md section to it, so the ADR and `rules.test.mjs` agree.

**Contract**: A fourth bullet in the `It checks:` list (lines 30-34): the `## Anti-stall rules` section of `skills/10x-pipeline/SKILL.md`, line by line with the strict prose check, like the prompts. The "What differs from the source ADR" bullet on the checked files (line 51) names the section too. No rule line is added, no status or date change.

### Success Criteria:

#### Automated Verification:

- README group exists in the right place and names the five behaviors: `node -e "const s=require('fs').readFileSync('README.md','utf8');const a=s.indexOf('\nLimits:'),g=s.indexOf('\nOrchestrator anti-stall:'),p=s.indexOf('\nPR comment (opt-in):');const t=s.slice(g,p);process.exit(a>=0&&a<g&&g<p&&['background','usage-incomplete','same turn','idle','tool output'].every(w=>t.includes(w))?0:1)"` (the group must use these five words, one per behavior: background launch, `usage-incomplete` for a dropped late figure, writing the result file and running `next` in the same turn, no idle end, answering a status question from tool output)
- AGENTS.md lists the new test file: `grep -n "skill-loop.test.mjs" AGENTS.md`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields untouched and valid: `node tools/version-check.mjs`
- ADR-004 lists the SKILL.md section in its checked scope: `node -e "const s=require('fs').readFileSync('docs/ADR/ADR-004-prompt-rules-as-scenarios.md','utf8');const a=s.indexOf('It checks:'),b=s.indexOf('Examples of bad rules');const t=s.slice(a,b);process.exit(a>=0&&a<b&&t.includes('## Anti-stall rules')&&t.includes('skills/10x-pipeline/SKILL.md')?0:1)"`
- README group states the headless limit of rule 1: `node -e "const s=require('fs').readFileSync('README.md','utf8');const g=s.indexOf('\nOrchestrator anti-stall:'),p=s.indexOf('\nPR comment (opt-in):');const t=s.slice(g,p);process.exit(g>=0&&g<p&&['headless','claude -p','has no result','not been verified'].every(w=>t.includes(w))?0:1)"`

---

## Testing Strategy

### Unit Tests:

- Form of the five rule lines and the intro (ADR-004): one bold keyword after `**THEN**`, GIVEN/WHEN/THEN order, no bare keyword, no bold keyword in prose.
- Content: five rules, rule line k holds needle set k; the only `**GIVEN**` lines of SKILL.md; section outside every Loop branch; `run` branch pointer; no model, effort or tier words.
- Deliberate break: a copy without rule 3 fails the content test.

### Integration Tests:

- The existing `pr-comment.test.mjs` SKILL.md tests prove the new section does not change any Loop branch count.

### Manual Testing Steps:

1. Reread the section against the five behaviors in `context/changes/orchestrator-anti-stall/change.md` and the STOP instructions of SKILL.md.
2. (Optional, not a gate) In a later live interactive `/agent-smith:10x-pipeline` run, watch for a background launch notice and confirm the turn ends and resumes without a user prompt. The suite cannot reproduce it, and a headless run is not checked here.

## Performance Considerations

None. SKILL.md grows by about ten lines.

## Migration Notes

None. A run in flight reads the new SKILL.md on its next invocation; no router state changes.

## References

- Change identity: `context/changes/orchestrator-anti-stall/change.md`
- Complexity record: `context/changes/orchestrator-anti-stall/complexity.json`
- Plan review: `context/changes/orchestrator-anti-stall/reviews/plan-review.md` (round 1: F1-F5 applied, F6 resolved by the owner as a documented limit; round 2: one observation, applied; the file holds round 2 and carries the round 1 record)
- Loop section: `skills/10x-pipeline/SKILL.md:37-59`; Start STOPs: `SKILL.md:30`
- Result handling in the router: `skills/10x-pipeline/scripts/route.mjs:433-442`, `route.mjs:482-483`; step logged before `run` is printed: `route.mjs:2218-2219`; `usage-incomplete`: `route.mjs:2433`
- Rule form: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, `skills/10x-pipeline/test/rules.test.mjs`
- Branch-based SKILL.md tests: `skills/10x-pipeline/test/pr-comment.test.mjs:662-735`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Anti-stall rules in SKILL.md

#### Automated

- [x] 1.1 The section exists once, between `## Loop` and `## PR comment (opt-in)`
- [x] 1.2 Existing SKILL.md tests still pass

#### Manual

- [ ] 1.3 Each of the five behaviors in `change.md` appears as exactly one rule, in order, without contradicting the Loop steps

### Phase 2: Tests for the rules

#### Automated

- [x] 2.1 Rule-form tests pass
- [x] 2.2 Content tests pass
- [x] 2.3 Deliberate-break check: removing rule 3 in a scratch copy makes the content test fail
- [x] 2.4 Full suite passes

### Phase 3: Documentation

#### Automated

- [x] 3.1 README group exists in the right place and names the five behaviors
- [x] 3.2 AGENTS.md lists the new test file
- [x] 3.3 Full suite passes after the documentation change
- [x] 3.4 Version fields untouched and valid
- [x] 3.5 ADR-004 lists the SKILL.md section in its checked scope
- [x] 3.6 README group states the headless limit of rule 1
