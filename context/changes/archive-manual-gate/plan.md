# Archive Manual Gate Implementation Plan

## Overview

A run started with `--archive` archives on its own even when Manual rows are still pending. Add a yes/no gate in the orchestrator of both chains: when the router returns the `archive` action with `summary.manualPending` not empty, the orchestrator asks the user with `AskUserQuestion` before it launches the archive subagent. Only a yes archives. A no, any other answer, or a session with no question tool ends the run like `done`, unarchived. The router does not change. ADR-014 records the decision.

## Current State Analysis

- The router's `archive` action already carries `summary.manualPending` (and `manualUnproven`, `manualNotProved`, `uncommittedTicks`) and the pre-archive commit is done before the action returns (`skills/10x-pipeline/scripts/isolation.mjs:549-577`, `:640-660`). The only router-side gate is `archive.haltOnManualPending` (default `false`, a halt before the commit; `policy.json` `archive`).
- The orchestrator (`skills/10x-pipeline/SKILL.md`, `archive` branch, lines 61-69) reports the pending rows as a checklist in step 1, runs the archive subagent in step 3 and repeats the checklist after the move. The `archive` prompt tells the unattended `/10x-archive` subagent to continue past pending Manual rows (`policy.json` `prompts.archive`), so nothing stops the archive today.
- `skills/openspec-pipeline/SKILL.md` mirrors the branch. In the OpenSpec chain `summary.manualPending` is always `[]`: there is no plan, and an open `tasks.md` row halts before the action (`openspec-archive.test.mjs:60`). The gate is dormant there but mirrored, as the goal asks.
- Neither skill lists `AskUserQuestion` in `allowed-tools`. A subagent cannot ask; the orchestrator runs in the user's session and can.

### Key Discoveries:

- `skill-loop.test.mjs` and `openspec-skill.test.mjs` pin exactly five `**GIVEN**` lines per skill, all in `## Anti-stall rules`, and the two sections must be equal. The gate therefore needs plain prose, not a new rule line, and the anti-stall section stays untouched.
- `openspec-skill.test.mjs:120` pins `4. Write no result file and do not call \`next\`` as a step of the `archive` branch, and rule 1 names "step 4 of the `archive` branch". Step numbers stay as they are, so the gate is added at the end of step 1.
- `pr-comment.test.mjs:716-717` requires the PR comment pointer to come before the first "Call the Agent tool" in the `archive` branch. The gate sits after that pointer.
- `agents.test.mjs:349-` requires the archive branch to keep "Call the Agent tool with the same parameters as for `run`", and both skill tests ban model, effort and tier words in the skills.
- Both skills end the run only through `done`, `archive` or `halt`, and anti-stall rule 4 forbids ending a turn before that. The "no" path is a STOP in the `archive` branch, so rule 4 holds.
- `10x-archive` answers its own manual-rows warning as "continue" for the unattended subagent. That prompt stays: it is still correct after a yes.

## Desired End State

With `--archive` and one or more Manual rows pending, the orchestrator reports the run as before, posts the PR comment (if asked), then asks one yes/no question that lists the pending rows. Yes: the archive subagent runs and `verify-archive` follows as today. No (or no answer possible): no subagent, no `verify-archive`; the final message says the change is committed on the run branch but not archived, repeats the checklist and names `/10x-archive <change-id>` as the way to archive later. With no pending rows nothing changes. Verified by the content tests of both skills and by a live run (manual).

## What We're NOT Doing

- No router, policy or prompt change: the router stays non-interactive, `summary.manualPending` already carries the data, and `archive.haltOnManualPending` keeps its meaning (a halt before the commit, when set).
- No new policy key to turn the question off. An owner who wants no question sets `archive.haltOnManualPending` (halt) or runs without `--archive`.
- No rewrite of `report.md`: its `Archive: requested` line stays as the router wrote it and the final message says the run was not archived.
- No change to the anti-stall section, the step numbers of the `archive` branch or the `10x-archive` unattended prompt.
- Unproved ticks (`manualUnproven`, `uncommittedTicks`) do not trigger the question; only pending rows do. They are shown in the question text when present.
- No undo of the pre-archive commit on a no.

## Implementation Approach

Edit the `archive` branch of both SKILL.md files: end of step 1 gets a "Manual gate" paragraph (the question, the yes and no paths), `AskUserQuestion` goes into `allowed-tools`. Add one content test file that pins the gate in both skills (placement before the Agent call and after the PR comment pointer, yes/no/unavailable handling, no new rule line, router scripts free of `AskUserQuestion`). Then document it: ADR-014, the archive sections of `docs/REFERENCE.md` (both chains), the `--archive` row of `README.md`, and `AGENTS.md` (ADR list, test list).

## Critical Implementation Details

- **Fail closed.** The question tool errors or is missing in a headless `claude -p` session. That must read as "no": never launch the archive subagent without an explicit yes.
- **Order.** The router has already written `report.md` and made the pre-archive commit when the action returns. The PR comment (step 1) is posted before the question, so it is posted on both paths; the report line `Archive: requested` is then stale on a no, and the final message corrects it.

## Phase 1: Orchestrator gate and content tests

### Overview

Add the gate to both skills and pin it with tests.

### Changes Required:

#### 1. 10x orchestrator

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add `AskUserQuestion` to `allowed-tools`. At the end of step 1 of the `archive` branch (after the PR comment pointer), add the gate: when `summary.manualPending` is empty, go on to step 2; otherwise ask one yes/no question and launch the archive subagent only on yes.

**Contract**: One `AskUserQuestion` call, one question (header `Archive`), two options, `No, keep it unarchived` first and marked recommended, `Yes, archive anyway` second. The question text states the count of pending Manual rows, lists them (at most 10, then "and N more"), adds `manualNotProved` lines when present, and says the archive moves the change folder and these checks stay unverified. Only the `Yes, archive anyway` answer continues at step 2. Any other answer, an error, or no question tool: do not call the Agent tool, print `Archive: skipped, <n> Manual check(s) pending.`, then end the branch with a STOP and a final message that says: not archived; the change folder is committed on the run branch (the action's `commit`, or already committed); the checklist again; `/10x-archive <change-id>` archives it later; plus the worktree notes of Start step 3 when the run root is not `<root>`. No `**GIVEN**` line, no model, effort or tier word, no renumbering, step 4 text unchanged.

#### 2. OpenSpec orchestrator

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: Same gate in the `archive` branch and `allowed-tools`, with the OpenSpec names.

**Contract**: Same as above with `<change-name>`, `--chain openspec` on any router call, and the later-archive hint `openspec archive <change-name> --yes --json` run by the user (never `/opsx:archive` from the skill, per its Rules). Dormant in practice: `summary.manualPending` is `[]` in this chain.

#### 3. Gate tests

**File**: `skills/10x-pipeline/test/archive-gate.test.mjs` (new)

**Intent**: Content checks of the gate for both skills, in the style of `skill-loop.test.mjs`.

**Contract**: For each skill: `allowed-tools` lists `AskUserQuestion`; the `archive` branch names `summary.manualPending` and `AskUserQuestion`; `AskUserQuestion` comes after the `PR comment step` pointer and before `Call the Agent tool`; the text names the yes label, the no label, the unavailable-tool case and a `STOP`; steps 2 to 5 keep their numbers (`4. Write no result file`); the other branches (`run`, `done`, `halt`) do not mention `AskUserQuestion`; the skill still has exactly five `**GIVEN**` lines. Also: no file under `skills/10x-pipeline/scripts/` mentions `AskUserQuestion`. A router check ties the data to the gate: the archive action of a run with a pending Manual row carries `summary.manualPending` (existing `archive.test.mjs:584`) and one without carries `[]` (`openspec-archive.test.mjs:60`); the new file does not duplicate them.

### Success Criteria:

#### Automated Verification:

- New gate tests pass: `node --test skills/10x-pipeline/test/archive-gate.test.mjs`
- Skill content tests still pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/agents.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Router scripts untouched: `git diff --stat main -- skills/10x-pipeline/scripts skills/10x-pipeline/policy.json skills/10x-pipeline/prompts` prints nothing

#### Manual Verification:

- In a live interactive session, a `--archive` run that ends with a Manual row pending shows the question with the row listed; answering yes archives (`verify-archive` prints `archived: true`), and answering no runs no archive subagent and leaves the change folder in `context/changes/` with the pre-archive commit
- In a headless `claude -p` run with a pending Manual row the orchestrator does not archive and prints the skipped line
- A run with no pending Manual row archives without a question

---

## Phase 2: ADR-014 and documentation

### Overview

Record the decision and update the user-facing and contributor docs.

### Changes Required:

#### 1. ADR-014

**File**: `docs/ADR/ADR-014-archive-manual-gate.md` (new)

**Intent**: Record that the orchestrator, not the router and not the archive subagent, owns the question; the fail-closed reading; the dormant OpenSpec gate; the stale `Archive: requested` report line.

**Contract**: Same layout as ADR-012 and ADR-011 (Status, Date, Deciders, Origin, Context, Decision as GIVEN/WHEN/THEN scenarios per ADR-004, alternatives, consequences). Alternatives named and declined: a router halt only (`archive.haltOnManualPending` already exists and is all-or-nothing), a router-side question (the router never calls a model or the user), a subagent question (subagents cannot ask), a policy key to turn the question off. Status `Proposed (unattended reading, owner confirmation pending)`, readings A1 to A5 listed.

#### 2. Reference, README and contributor guide

**Files**: `docs/REFERENCE.md`, `README.md`, `AGENTS.md`

**Intent**: Describe the gate where the archive behavior is described.

**Contract**: `docs/REFERENCE.md` "Archive (opt-in)" (10x) gets a bullet for the question, its yes and no paths, the fail-closed rule and the stale report line; the OpenSpec "Archive (`--archive`, D5)" section gets a bullet that the gate is mirrored and dormant. `README.md` `--archive` row: "Archive the change when the run is done; asks first when Manual checks are pending." `AGENTS.md`: ADR list gains ADR-014, the test list gains `archive-gate.test.mjs`; the Hard Rules do not change.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields untouched: `node tools/version-check.mjs`
- ADR file exists and is named in the docs: `grep -l "ADR-014" AGENTS.md docs/REFERENCE.md docs/ADR/ADR-014-archive-manual-gate.md`
- Scratch smoke: `init` and `status` against a scratch change folder print valid JSON (per AGENTS.md "Testing")

#### Manual Verification:

- ADR-014 reads as a decision the owner can confirm or change, and its scenarios match the skill text
- `docs/REFERENCE.md` and the two SKILL.md files agree on the labels, the 10-row cap and the fail-closed rule

---

## Testing Strategy

### Unit Tests:

- Content tests of both SKILL.md files (placement, labels, fail-closed text, no new rule line, no renumbering)
- Existing tests pin the router data the gate reads: pending row listed in `summary.manualPending`, `[]` when none

### Integration Tests:

- None possible for `AskUserQuestion`: no harness drives it. The live run covers it.

### Manual Testing Steps:

1. Scratch project with a plan that has one Manual row left, run `/agent-smith:10x-pipeline <id> "<goal>" --archive`; answer yes at the question and check `verify-archive`.
2. Repeat and answer no; check no archive folder exists, the change folder is committed on the run branch and the final message says not archived.
3. Repeat headless (`claude -p`); check the fail-closed line.

## Performance Considerations

None. One extra user prompt only on a run that ends with pending Manual rows.

## Migration Notes

No policy or router change, so no provenance drift. A run in flight picks the new skill text on its next invocation. An `--archive` run that used to archive unattended with Manual rows pending now needs a yes; unattended runs stop short of the archive. Whether this ships as `feat` or `feat!` is the owner's call at commit time.

## References

- ADR-010 (isolated run, pre-archive commit), ADR-011 (halt on open owner decisions), ADR-012 (Manual rows), ADR-013 (OpenSpec archive)
- Archive action and gate data: `skills/10x-pipeline/scripts/isolation.mjs:549-577`, `:640-660`
- Skill tests: `skills/10x-pipeline/test/skill-loop.test.mjs`, `openspec-skill.test.mjs`, `pr-comment.test.mjs:703-720`, `agents.test.mjs:349-`
- Lessons applied: `context/foundation/lessons.md` (read a verdict never cleaner than its findings: the gate reads `manualPending` from the action, not from a report line)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Orchestrator gate and content tests

#### Automated

- [ ] 1.1 New gate tests pass: `node --test skills/10x-pipeline/test/archive-gate.test.mjs`
- [ ] 1.2 Skill content tests still pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/agents.test.mjs`
- [ ] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.4 Router scripts untouched: `git diff --stat main -- skills/10x-pipeline/scripts skills/10x-pipeline/policy.json skills/10x-pipeline/prompts` prints nothing

#### Manual

- [ ] 1.5 In a live interactive session, a `--archive` run that ends with a Manual row pending shows the question with the row listed; answering yes archives (`verify-archive` prints `archived: true`), and answering no runs no archive subagent and leaves the change folder in `context/changes/` with the pre-archive commit
- [ ] 1.6 In a headless `claude -p` run with a pending Manual row the orchestrator does not archive and prints the skipped line
- [ ] 1.7 A run with no pending Manual row archives without a question

### Phase 2: ADR-014 and documentation

#### Automated

- [ ] 2.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.2 Version fields untouched: `node tools/version-check.mjs`
- [ ] 2.3 ADR file exists and is named in the docs: `grep -l "ADR-014" AGENTS.md docs/REFERENCE.md docs/ADR/ADR-014-archive-manual-gate.md`
- [ ] 2.4 Scratch smoke: `init` and `status` against a scratch change folder print valid JSON (per AGENTS.md "Testing")

#### Manual

- [ ] 2.5 ADR-014 reads as a decision the owner can confirm or change, and its scenarios match the skill text
- [ ] 2.6 `docs/REFERENCE.md` and the two SKILL.md files agree on the labels, the 10-row cap and the fail-closed rule
