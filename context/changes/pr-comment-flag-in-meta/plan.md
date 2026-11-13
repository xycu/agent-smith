# Store the --pr-comment request in meta.json Implementation Plan

## Overview

Both orchestrator skills keep the `--pr-comment` request in a session task (`PR comment: <change-id>`). That needs three task tools, an env key and permissions the plugin cannot ship, and a resume in a new session loses it. The router already stores the sibling flag `--archive` in `meta.json`. This plan stores `--pr-comment` the same way (`prComment`), has the `done`, `archive` and `halt` outputs and `status` report it, and deletes the task bookkeeping from both `SKILL.md` files. The router still never calls `gh`; the orchestrator still runs `pr-comment.mjs`.

## Current State Analysis

- `init` reads `goal`, `rigor`, `archive`, `chrome` and `chain` (`INIT_FLAGS`, `skills/10x-pipeline/scripts/route.mjs:831`) and halts on any other flag. `--archive` and `--chrome` are parsed before anything is written (bare or `true` stores `true`, `false` stores `false`, anything else halts) and written to `meta` after the isolation checks (`route.mjs:862-882`, `:920-921`). A resume keeps a stored value because `meta` starts as `{ ...prev }`.
- Every `done` and ordinary `halt` of `next` goes through `endRun` -> `finishRun` (`skills/10x-pipeline/scripts/flow.mjs:316-337`), which spreads `result`, an `archive` extra and `report`. The archive branch (`archiveDone`, `skills/10x-pipeline/scripts/isolation.mjs:590-710`) prints its post-commit halts and the `archive` action with `out()` directly, so they bypass `finishRun`. `status` (`route.mjs:636`) reads `meta` only for `rigor`.
- Both skills hold the task design: `allowed-tools` lists `TaskCreate`, `TaskUpdate`, `TaskList`; Start step 5 stores the request; the `done`, `archive` and `halt` branches each say "call TaskList ..."; the "PR comment (opt-in)" section is gated on an open task and ends steps with "Mark the task completed" (`skills/10x-pipeline/SKILL.md:16-18,47-50,66,75,80,95-103`; `skills/openspec-pipeline/SKILL.md:17-19,55-58,73,82,87,102-111`). Start step 1 tells the orchestrator to "never pass [--pr-comment] to `init`".
- `.claude/settings.json` sets `CLAUDE_CODE_ENABLE_TODO_TOOLS` and allows `TaskCreate` and `TaskList` only for this repository.
- Tests that pin the task text: `skills/10x-pipeline/test/pr-comment.test.mjs:722-782`, `skill-loop.test.mjs:136`, `openspec-skill.test.mjs:192`. `route.test.mjs:697` pins the `init reads:` list. `change.md` says `pr-comment.test.mjs` is unchanged; that is wrong, it asserts `TaskList`, `TaskCreate`, the subject and `task list unavailable`.
- Docs that describe the task: `docs/REFERENCE.md:386-396` (PR comment group), `docs/ADR/ADR-003-rigor-gated-routing.md` "### PR comment" ("The flag is not stored in `meta.json`..." and the alternative "The flag in `meta.json`: kept as the fallback"), `README.md:69`.

## Desired End State

`init <id> --pr-comment [true|false]` stores `prComment` in `meta.json`; a resume keeps it; `--pr-comment false` turns it off. The `done`, `archive` and `halt` outputs of a run with it on carry `prComment: true` (the `archive` action before the folder moves), and `status` shows it. Neither skill names a task tool; each branch says "when the output has `prComment: true`, do the PR comment step". A run started with `--pr-comment` therefore posts its report in any session that can run the script. Verified by the full suite and by the init, skill-content and archive-gate tests named in the phases.

### Key Discoveries:

- `finishRun` is the single place all ordinary `done` and `halt` outputs pass (`flow.mjs:316`), so one spread there covers `done`, budget halts, needs-human halts, rollback and step-commit halts and the neutral-rerun halt.
- `archiveDone` has five direct `out()` calls (kind-B precheck halt `isolation.mjs:617`, report-error halt `:677`, two commit halts `:687-688`, the `archive` action `:697`); only these need the field. The OpenSpec archive path is the same function. One helper, `prCommentField(meta)` in `state.mjs`, owns the rule "the field is `true` or absent", so `finishRun`, the five calls and `status` cannot drift apart.
- `summary` of the `archive` action is `deepEqual`-pinned by tests (`archive.test.mjs:578`, `openspec-archive.test.mjs:63`), so `prComment` goes at the top level, not into `summary`.
- `pr-comment.mjs` edits its own marker comment, so "post once" needs no task and a repeated step is harmless.
- Provenance `flags` (`isolation.mjs:80-92`) hold routing flags only; `prComment` does not route, so it stays out.

## What We're NOT Doing

- No `gh` call in the router; `pr-comment.mjs` and `policy.json` are untouched (`pr-comment.test.mjs` guard "router scripts never call gh and policy.json has no prComment key" stays true).
- No `prComment` in the provenance record or in `report.md`.
- A `halt` printed outside `finishRun` and `archiveDone` carries no `prComment`: `halt()` before any run state exists (usage errors, archived-guard, lock, policy errors) and the mid-run halts with no report (`attachResult` "has no result", `flow.mjs:365` "without a stored prompt"). None of them ends a run with a report to post, and the skill's `no report` line is not printed for them.
- No rewrite of the seven GIVEN rules of ADR-003 "### PR comment"; the ADR gets an amendment.
- No change to the pull request step, `open-pr.mjs` or `pr-comment.mjs`.

## Implementation Approach

Router first (data the skills will read), then the skills and their content tests, then docs and settings. Mirror `--archive` exactly where possible. Phase 1 and 2 each leave the suite green, so each can be committed on its own; a skill that already reads `prComment: true` is only correct once the router emits it, hence the order.

## Phase 1: Router stores and reports prComment

### Overview

`init` reads and stores the flag; `done`, `archive`, `halt` and `status` report it; tests for both chains.

### Changes Required:

#### 1. init flag

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `pr-comment` to `INIT_FLAGS` (after `chrome`), validate it before anything is written exactly like `--archive` and `--chrome`, and write it to `meta` next to them. Update the file header usage comment and the usage string in `main()`.

**Contract**: bare flag or `true` -> `meta.prComment = true`; `false` -> `meta.prComment = false`; any other value halts with `Invalid --pr-comment <v>. Use --pr-comment, --pr-comment true or --pr-comment false.` and writes nothing; no flag leaves the stored value (a run that never had it has no key). The unknown-flag halt text becomes `init reads: --goal, --rigor, --archive, --chrome, --pr-comment, --chain.` No git requirement (unlike `--archive`).

#### 2. Outputs

**Files**: `skills/10x-pipeline/scripts/flow.mjs` (`finishRun`), `skills/10x-pipeline/scripts/isolation.mjs` (`archiveDone`), `skills/10x-pipeline/scripts/route.mjs` (`status`)

**Intent**: Add `prCommentField(meta)` to `skills/10x-pipeline/scripts/state.mjs`: it returns `{ prComment: true }` when `meta.prComment === true` and `{}` otherwise. `finishRun` spreads it into its returned object, so every `endRun` output (`done` and `halt`) carries it on both chains. `archiveDone` spreads it into its five direct `out()` objects, including the `archive` action. `status` spreads it into its JSON (read `meta` once; keep `rigor` as is). No module imports from a later one: `flow.mjs` and `isolation.mjs` already import `state.mjs`.

**Contract**: the field is present only as `true`; absent otherwise (no `prComment: false` in any output). `summary` of the `archive` action is unchanged. `meta.outcome` and `report.md` are unchanged.

#### 3. Tests

**Files**: new `skills/10x-pipeline/test/pr-comment-flag.test.mjs`; `skills/10x-pipeline/test/route.test.mjs` (line 697 string); `skills/10x-pipeline/test/README.md` (row in "Orchestrator skills and pull-request scripts")

**Intent**: Pin the init behaviour and the output field on both chains. Reuse `makeProject`, `run`, `readMetaFile`, `gitInit` and friends from `helpers.mjs`, `makeOpenspecProject` from `openspec-helpers.mjs`, and a small local copy of the finished-run builders of `archive.test.mjs:531-551` and `openspec-archive.test.mjs:33-42`.

**Contract**: tests cover (10x unless named) bare flag and `true` store `true`; a resume without the flag keeps it; `--pr-comment false` stores `false` and clears the output; an invalid value halts with nothing written; a run without the flag has no `prComment` key and no output field; the same store/keep/clear on `--chain openspec`; `status` shows `prComment: true` only when set; `done` (archive off) carries it; an ordinary `halt` through `endRun` (staged file in an archive project) carries it; each reachable direct `out()` halt of `archiveDone` carries it, reusing the fixtures of `archive.test.mjs` (kind B at `:925`, kind C at `:716`, kind D at `:901`); the report-error halt (`isolation.mjs:677`) has no fixture and is covered by the shared helper; the `archive` action carries it with `summary` unchanged; the OpenSpec `done` and `archive` action carry it. Git-dependent tests use `{ skip: noGit }`.

### Success Criteria:

#### Automated Verification:

- New init and output tests pass: `node --test skills/10x-pipeline/test/pr-comment-flag.test.mjs`
- Existing init and archive tests pass with the new flag list: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/openspec-archive.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- No router module mentions `gh` or a task tool: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/open-pr.test.mjs` (the guard tests in them)

#### Manual Verification:

- In a scratch project, `init <id> --goal x --pr-comment` then `status <id>` shows `prComment: true`, and `meta.json` holds `"prComment": true`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Skills drop the task and read the router

### Overview

Both `SKILL.md` files pass `--pr-comment` to `init`, lose Start step 5, the TaskList paragraphs and the three task tools, and gate the PR comment step on `prComment: true`. Their content tests follow.

### Changes Required:

#### 1. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: (a) Remove `TaskCreate`, `TaskUpdate`, `TaskList` from `allowed-tools`. (b) Start step 1: parse `--pr-comment` like `--archive` and `--chrome` (list it with them) and delete "and never pass it to `init`". (c) Start step 4: add that `--pr-comment` is added only when the user gave it, a resume keeps a stored one, and `--pr-comment false` turns it off. (d) Delete Start step 5 entirely. (e) In `done`, `archive` step 5 and `halt`, replace each "Then call TaskList. When a task ... is open, do the PR comment step. If the call errors ..." with: when the output (for `archive`, the `archive` action) has `prComment: true`, do the PR comment step; keep "do the pull request step" before it and the `--report` sentence of the archive bullet. (f) "PR comment (opt-in)" section: the step runs only when the `done`, `archive` or `halt` output has `prComment: true`; drop "Mark the task completed" (steps become 1 and 2) and from the `no report` and `script error` bullets; keep the `100 characters`, quoting and `PR comment: skipped, no report` / `skipped, script error` lines. Also fix the sentence that points at "see the README" (it goes away with Start step 5).

**Contract**: the strings `do the pull request step` and `do the PR comment step` stay in each of the three branches in that order (`skill-loop.test.mjs:120-127`); the `halt` branch ends `Before you STOP, do the pull request step. Then, when the output has \`prComment: true\`, do the PR comment step.`; the PR comment lines name no model, effort or tier word (`pr-comment.test.mjs` banned-word test); `## Anti-stall rules` is untouched.

#### 2. OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: The same edits with `<change-name>`: `allowed-tools`, Start step 1 (`--pr-comment` listed with `--archive`; here the flag list has only `--archive`), Start step 4, delete Start step 5, the three branches, the PR comment section.

**Contract**: wording equals the 10x skill's wherever the 10x skill has the same sentence; no model, effort or tier word beyond what the 10x skill documents.

#### 3. Skill content tests

**Files**: `skills/10x-pipeline/test/pr-comment.test.mjs`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`

**Intent**: Replace the task assertions with the new contract. `pr-comment.test.mjs`: the three tests at `:722-761` become "Start step 4 passes `--pr-comment` to `init` and Start has no task step", "done, archive and halt each carry the `prComment: true` condition and the PR comment step once, with no TaskList", and "the PR comment section is gated on `prComment: true` and keeps the script-error fallback"; the README/REFERENCE group test (`:776-790`) drops the `task list unavailable` needle. `skill-loop.test.mjs:136` and `openspec-skill.test.mjs:192`: the halt regex becomes the new sentence. `archive-gate.test.mjs`: inside the per-chain loop, add one test that `allowed-tools` lists none of `TaskCreate`, `TaskUpdate`, `TaskList`, the skill text has none of them, and the `done`, `archive` and `halt` branches each contain `` `prComment: true` `` once.

**Contract**: the `lines.length >= 8` count of PR comment lines in `pr-comment.test.mjs:773` is lowered to the new real count. `archive-gate.test.mjs` keeps "still exactly six GIVEN lines". Criterion 2.3 and 3.3 grep `skills/`, which includes `skills/10x-pipeline/test/`: so no test file spells `TaskList`, `TaskCreate`, `TaskUpdate` or `task list unavailable` as a literal. An assertion that a tool name is absent builds the name from parts (for example `["Task", "List"].join("")`).

### Success Criteria:

#### Automated Verification:

- Skill-content tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs`
- The skills share their anti-stall section and bans: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/agents.test.mjs`
- No task tool is named in either skill: `grep -c "TaskList\|TaskCreate\|TaskUpdate" skills/10x-pipeline/SKILL.md skills/openspec-pipeline/SKILL.md` prints 0 for both

#### Manual Verification:

- Read Start and the `done`, `archive` and `halt` branches of both skills: no sentence still refers to a task, a task subject or `task list unavailable`, and step numbers in Start run 1 to 4.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Docs, ADR amendment and settings

### Overview

Bring the documentation and the repository settings in line; run the whole suite.

### Changes Required:

#### 1. Reference and README

**Files**: `docs/REFERENCE.md` (PR comment group, `:386-396`), `README.md` (`:69`), `AGENTS.md` (Commands, the `init` line)

**Intent**: REFERENCE: replace "The flag is kept as an orchestrator task ... `route.mjs` and `policy.json` are not involved" with: `init --pr-comment [true|false]` stores `prComment` in `meta.json` like `--archive`, a resume keeps it, `false` turns it off; `done`, `archive` (before the move) and `halt` outputs and `status` carry `prComment: true`; the router never calls `gh`. Drop the `task list unavailable` skip reason, and reword the bullet "The orchestrator prints a `PR comment:` line when the flag was given. A missing line means the step was dropped." to say the line is printed when the `done`, `archive` or `halt` output has `prComment: true`. Add `--pr-comment` to the Archive-style description of kept flags only if a matching bullet exists; do not invent one. README options row: say the request is stored with the run, so a resume keeps it, and keep "Needs `gh`." AGENTS.md: add `[--pr-comment]` to the `init` flag list in Commands; the file stays under the 12288-byte limit of `tools/test/agents-md-size.test.mjs` (10681 bytes now).

**Contract**: the `pr-comment.test.mjs` README/REFERENCE group test keeps its remaining needles (`unsupported host`, `gh timed out`, `100 characters`, `script error`, `report.md`, `agent-smith`) and the group still lies after `Limits:` at the end of the 10x section.

#### 2. ADR-003 amendment

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Append `## Amendment 1: --pr-comment stored in meta.json (2026-11-13)` at the end, in the style of ADR-017 Amendment 1: context (the session task tools are missing in a project that installs the plugin; a resume depends on the session), decision (the flag moves into `meta.json` as the "fallback" alternative of the original text anticipated; the orchestrator still runs the script; the router still never calls `gh`), a consequence (the request now persists in `meta.json`: a resume without the flag still posts, and `--pr-comment false` is the only way to turn it off, as for `--archive`), and two GIVEN rules (an init with `--pr-comment` stores it and a resume keeps it; an end-of-run output of such a run carries `prComment: true`). Add the amendment to the `Status` line. Do not edit the original "### PR comment" text or its seven rules.

**Contract**: the "### PR comment" section keeps exactly seven `**GIVEN**` lines (`pr-comment.test.mjs` ADR test slices from `### PR comment` to `## Alternatives considered`); the amendment sits after that range.

#### 3. Settings and test index

**Files**: `.claude/settings.json`

**Intent**: Remove the `env` block (`CLAUDE_CODE_ENABLE_TODO_TOOLS`) and the `permissions` block (`TaskCreate`, `TaskList`); nothing else in the repository uses task tools (checked by grep). Keep `sandbox`.

**Contract**: valid JSON with only `sandbox` left.

### Success Criteria:

#### Automated Verification:

- The ADR, docs and index pins pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs tools/test/*.test.mjs`
- `.claude/settings.json` parses and has no task entry: `node -e "const s=JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));if(s.env||s.permissions)process.exit(1)"`
- No stale task wording remains in live docs: `grep -rn "TaskList\|TaskCreate\|TaskUpdate\|TODO_TOOLS\|task list unavailable" README.md AGENTS.md docs skills .claude` prints nothing (the ADR-003 amendment says "task tools" and names none)
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read the ADR-003 amendment next to the original "### PR comment" text: the original is unchanged and the amendment states what changed and why.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- New `pr-comment-flag.test.mjs`: init store/keep/clear/invalid on both chains, absent key without the flag, `status` field, output field on `done`, `halt` (both the `endRun` path and the direct `out()` path) and the `archive` action, both chains.
- Updated content tests for both skills.

### Integration Tests:

- The full suite drives the real router through the CLI in scratch projects; no new harness.

### Manual Testing Steps:

1. Smoke check from `AGENTS.md`: scratch project, `init <id> --goal x --pr-comment`, `status <id>` shows `prComment: true`.
2. Re-run `init <id>` without the flag: `meta.json` keeps `prComment: true`; with `--pr-comment false`: `false`.

## Performance Considerations

None: one boolean read per call.

## Migration Notes

A run started before this change has no `prComment` key and behaves as a run without the flag. A user who relied on a session task for an in-flight run passes `--pr-comment` again on resume.

## References

- Change: `context/changes/pr-comment-flag-in-meta/change.md`
- Complexity record: `context/changes/pr-comment-flag-in-meta/complexity.json`
- Sibling flag: `route.mjs:862-882` (`--archive`, `--chrome`)
- Original design: `docs/ADR/ADR-003-rigor-gated-routing.md` "### PR comment"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router stores and reports prComment

#### Automated

- [x] 1.1 New init and output tests pass: `node --test skills/10x-pipeline/test/pr-comment-flag.test.mjs` — aa228af
- [x] 1.2 Existing init and archive tests pass with the new flag list: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/openspec-archive.test.mjs skills/10x-pipeline/test/provenance.test.mjs` — aa228af
- [x] 1.3 No router module mentions `gh` or a task tool: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/open-pr.test.mjs` (the guard tests in them) — aa228af

#### Manual

- [ ] 1.4 In a scratch project, `init <id> --goal x --pr-comment` then `status <id>` shows `prComment: true`, and `meta.json` holds `"prComment": true`.

### Phase 2: Skills drop the task and read the router

#### Automated

- [x] 2.1 Skill-content tests pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs` — f5d787f
- [x] 2.2 The skills share their anti-stall section and bans: `node --test skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/agents.test.mjs` — f5d787f
- [x] 2.3 No task tool is named in either skill: `grep -c "TaskList\|TaskCreate\|TaskUpdate" skills/10x-pipeline/SKILL.md skills/openspec-pipeline/SKILL.md` prints 0 for both — f5d787f

#### Manual

- [ ] 2.4 Read Start and the `done`, `archive` and `halt` branches of both skills: no sentence still refers to a task, a task subject or `task list unavailable`, and step numbers in Start run 1 to 4.

### Phase 3: Docs, ADR amendment and settings

#### Automated

- [x] 3.1 The ADR, docs and index pins pass: `node --test skills/10x-pipeline/test/pr-comment.test.mjs tools/test/*.test.mjs`
- [x] 3.2 `.claude/settings.json` parses and has no task entry: `node -e "const s=JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));if(s.env||s.permissions)process.exit(1)"`
- [x] 3.3 No stale task wording remains in live docs: `grep -rn "TaskList\|TaskCreate\|TaskUpdate\|TODO_TOOLS\|task list unavailable" README.md AGENTS.md docs skills .claude` prints nothing (the ADR-003 amendment says "task tools" and names none)
- [x] 3.4 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 3.5 Read the ADR-003 amendment next to the original "### PR comment" text: the original is unchanged and the amendment states what changed and why.
