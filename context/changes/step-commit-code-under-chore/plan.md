# Stop Shipping Implemented Code in Chore Step Commits Implementation Plan

## Overview

In an isolated run the router commits whatever a verified step left in the worktree under `chore(<id>): step <n> <step>`. When a step subagent leaves its code uncommitted, the code reaches `main` (the owner rebase-merges) under a `chore` subject, which release-please hides: no changelog line, and a run of only `chore`/`docs` commits opens no release PR. This plan makes such code visible and makes the implement-class steps commit their own code under a typed subject.

Done when (from `change.md`): a run that changes files outside its change folder leaves at least one non-`chore` commit that holds them, or its report names every path the router committed under `chore`.

## Current State Analysis

- `stepCommit` (`skills/10x-pipeline/scripts/isolation.mjs:456`) calls `routerCommit` without `rel` (`isolation.mjs:325`), which runs `git add -A` (`isolation.mjs:334`) and commits under `isolation.commit.message` = `chore({id}): step {n} {step}` (`skills/10x-pipeline/policy.json:125`). It records only `last.commit` on the log entry (`isolation.mjs:474`). Nothing records which paths outside the change folder the commit holds.
- The other router commits are folder-only: the start commit, the pre-archive commit and the late-usage commit pass `rel` and already check that the commit holds nothing outside it (`isolation.mjs:360-367`). The rollback snapshot goes to a side ref, not the branch.
- `open-pr.mjs` commits leftovers as `chore(<id>): final run state` with `git add -A` (`skills/10x-pipeline/scripts/open-pr.mjs:20`, `:248-265`) and reports `{ committed, commit, commitError }` only.
- Prompts: the suffix says "Do not commit unless the skill itself commits." (`policy.json` `prompts.suffix`). `/10x-goal-implement` commits each phase itself, but its type list includes `chore` (`~/.claude/skills/10x-goal-implement/SKILL.md:211`), and the observed runs show no phase commit. `prompts/os-apply.md:25` forbids the `os-apply` subagent to commit, stage or stash, "because the router commits each step of an isolated run", so every `os-apply` code change lands in a `chore` step commit by design. `prompts/executor-retry.md` asks for a commit but names no type. The `fix` template already asks for `fix:` commits; tdd and e2e executors commit and the router checks it (`scripts/steps.mjs:48-99`).
- `report.md` is built by `buildReport` (`scripts/flow.mjs:105-159`) from per-section helpers (`rollbackLines`, `neutralLines`, `reviewLines`, ...). `open-pr.mjs` `buildBody` (`open-pr.mjs:306`) puts only the report lines before the first table row into the pull request body.
- `status` maps each entry's optional keys (`scripts/route.mjs:655-674`), for example `commit` and `rolledBack`.

## Desired End State

- Every step commit of an isolated run that holds a path outside the change folder records those paths on its log entry as `swept`; `status` shows them, and `report.md` names every one of them in a `## Code committed by the router` section, plus a count line in its header (so the pull request body shows it too).
- `open-pr.mjs` returns `swept` (the leftover commit's paths outside the change folder) in its JSON, and both orchestrator skills print them.
- The `implement`, `implement-segment`, `implement-retry` and `os-apply` prompts tell the subagent to commit its code before the `RESULT:` line under `<type>(<id>): <summary>` with a type from `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, never `chore`; the suffix no longer reads as a ban on commits.
- Verify: the full suite passes, the new tests in `stepcommit.test.mjs`, `openspec-isolation.test.mjs`, `open-pr.test.mjs` and `rules.test.mjs` pass, and `init`/`status` on a scratch change folder print valid JSON.

### Key Discoveries:

- `routerCommit` returns `{ commit, made }` and is shared by four callers (`isolation.mjs:325-376`); only `stepCommit` calls it without `rel`, so a name list read only in the `!rel` branch changes no other caller.
- The folder-only check reads names relative to the git root and strips `rev-parse --show-prefix` (`isolation.mjs:361-366`); `changeRel(p, id)` (`isolation.mjs:381`) already picks `context/changes/<id>` or `openspec/changes/<id>` by chain.
- Log keys are additive (ADR-005): `commit`, `rolledBack`, `kept` and `neutralRetries` are only written when they apply, and `status`/`report.md` show them only then.
- `rollback.test.mjs:73` (`toImplement`) drives an isolated run to its first `implement` step; `openspec-isolation.test.mjs:85` drives a verified `os-apply` step commit.
- `nested-subagents.test.mjs:53-60` pins that `implement` stays a string and that the templates contain `IMPLEMENT_RULE` by line inclusion, so an added line does not break it.
- `tools/commit-lint.mjs:11-13`: types `feat, fix, docs, chore, ci, refactor, perf, test, build, revert`; scope `[a-z0-9][a-z0-9._-]*`. Change ids are kebab-case, so `<type>(<id>): ...` lints.

## What We're NOT Doing

- No `signals.commit` field on the `RESULT:` line and no router commit under a subagent-chosen subject (change.md option 1 of the safety net). The recorded-paths option is the smaller change, as change.md says.
- No change to the subject of any router commit (`isolation.commit.message`, `startMessage`, `archive.*`) or of the `open-pr.mjs` leftover commit, so ADR-010, ADR-017 and ADR-021 tests keep their literals.
- No halt or failure when a step leaves code uncommitted: the step commit still takes it; it is recorded, not refused.
- No commit rule added to `impl-review-apply.md`, `manual-verify.md`, `plan*` or other templates; the router record covers any step that leaves code.
- No change to the `fix` template (it already asks for `fix:` commits) or to the tdd/e2e executors (they already commit, and the router checks it).
- No cap on the number of recorded paths: the done-when asks for every path.
- No rewrite of history for the runs already on `main`.

## Implementation Approach

Safety net first, in the router, because it alone meets the done-when for every step. Then the same record in `open-pr.mjs`, which commits after the report is written. Last, the prompt rules that make the implement-class steps produce typed commits, so release-please sees the work.

## Critical Implementation Details

- **Name list before the commit, not after.** Read the staged names in `routerCommit` right after its `git add -A` and before `git commit`, with `git diff --cached --name-only --no-renames -z`. A failure there goes through the existing `failed()` path (unstage, "Nothing was committed"), so the entry gets no `commit` key and a resume retries: the router never makes a step commit whose paths it could not record. `--no-renames` lists both sides of a move. A pre-commit hook that stages extra files is not seen; that is the known limit.
- **State sequencing.** `stepCommit` writes `run.jsonl` before the commit (`isolation.mjs:463`) so the commit holds the step's result, then sets `last.commit` and writes the log again (`isolation.mjs:474-476`). Set `last.swept` next to `last.commit`, under the same condition (`res.made`), so it reaches disk in the same write and lands in the next step commit or the leftover commit, as `commit` does.

## Phase 1: Router records the paths it commits under chore

### Overview

The step commit records the paths outside the change folder that it commits; `status` and `report.md` show them.

### Changes Required:

#### 1. Name list of a whole-worktree commit

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: In `routerCommit`, when called without `rel` and the index is not empty after `git add -A`, read the staged names before `git commit` and return them, so the step commit knows what it holds. A failed read is handled like a failed add.

**Contract**: `routerCommit(g, timeout, { rel, message, trailer })` returns `{ commit, made, names? }`; `names` (git-root-relative paths, `--no-renames`) is present only when `rel` is null and `made` is true. The error return of the post-commit checks (`after()`, `made: true`) carries the same `names`, because `stepCommit` records `commit` on that path (`if (res.made || !res.error)`) and must record `swept` with it before it halts. The `rel` callers (start, pre-archive, late-usage) are unchanged. Update the function's header comment.

#### 2. `swept` on the log entry

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: In `stepCommit`, when the commit was made, keep the names that do not start with `<show-prefix><changeRel(p, id)>/` and store them, sorted, as `last.swept` only when the list is not empty. Works for both chains through `changeRel`.

**Contract**: New optional log entry key `swept: string[]` (git-root-relative paths of files outside the change folder that the router's step commit holds). Absent when there were none or no commit was made. Update the `stepCommit` header comment.

#### 3. `status` field

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Show the record in `status`, as `commit` and `rolledBack` are shown.

**Contract**: each `steps[]` item gains `swept: string[]` when the entry has a non-empty `swept` array (next to the `commit` spread at `route.mjs:671`).

#### 4. Report section and header line

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Add a helper next to `rollbackLines` that renders `## Code committed by the router`: one sentence saying these paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them; then per step `- step <n> <step> (<short commit>):` followed by one `  - \`<path>\`` line per path (each path collapsed to one line with the existing `oneLine`). No entry with `swept`, no section. Also add one header line after the archive lines, `Code under chore commits: <k> path(s) in <s> step commit(s); see "Code committed by the router"`, only when there is any, so the pull request body (which takes the report lines before the table) shows it.

**Contract**: `buildReport` output gains the header line and the section (placed after the skipped-steps section, before `## Rolled-back steps`); a run without `swept` gives a byte-identical report.

#### 5. Tests

**File**: `skills/10x-pipeline/test/stepcommit.test.mjs`, `skills/10x-pipeline/test/openspec-isolation.test.mjs`

**Intent**: Prove the record on both chains and its absence when there is nothing to record.

**Contract**:
- `stepcommit.test.mjs`: an isolated run reaches its first `implement` step (same driver as `toImplement` in `rollback.test.mjs:73`); the "subagent" commits `src/done.js` itself as `feat(demo): ...`, leaves `src/left.js` new and `src/old.js` renamed to `src/moved.js` uncommitted, ticks its row and answers `done`. After `next`: the step commit subject is still `chore(demo): step 3 implement`; the entry's `swept` equals the sorted list `src/left.js`, `src/moved.js`, `src/old.js` (not `src/done.js`, no change-folder path); `status --report` shows the same `swept`; `report.md` holds the header line and a `## Code committed by the router` section naming each path. The plan step's entry of the same run has no `swept` key, and a run with no outside path has neither the header line nor the section.
- `stepcommit.test.mjs`: a `git` shim (as `gitLosingHash` at `stepcommit.test.mjs:131`) that fails `diff --cached --name-only` makes the step commit halt with "Nothing was committed", leaves the entry without `commit`, and the resume (shim removed) commits and records `swept`.
- `openspec-isolation.test.mjs`: the verified `os-apply` step commit of the test at line 85 records the code file in `swept` and no path under `openspec/changes/<id>/`.

#### 6. Docs

**File**: `docs/REFERENCE.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

**Intent**: Describe the record where step commits are described (REFERENCE "Step commits" bullet, line 52), and add `Amendment 1` to ADR-010 (as ADR-012 has one): the step commit records the paths outside the change folder it commits, why (release-please hides `chore`), the pre-commit name read and its hook limit. Mark the amendment in the ADR status line.

**Contract**: prose only; rule lines, if any, keep the ADR-004 form (`rules.test.mjs` checks ADRs).

### Success Criteria:

#### Automated Verification:

- Step commit and report tests pass: `node --test skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/openspec-isolation.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `init` and `status` against a scratch change folder print valid JSON (10x and `--chain openspec`), per AGENTS.md "Testing"

**Implementation Note**: After completing this phase and all automated verification passes, go on to Phase 2.

---

## Phase 2: open-pr.mjs names the code of its leftover commit

### Overview

The leftover commit of the pull request step is the one `chore` commit made after the report is written; its paths outside the change folder go into the script's JSON and the orchestrator prints them.

### Changes Required:

#### 1. `swept` in the JSON output

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: After a successful leftover commit, list the commit's files (`git show --name-only --no-renames -z --format= HEAD`) and keep those outside the change folder (`changeDir(opts)` made relative to the top level). A failed listing gives `swept: null`, never a failure; the script still pushes.

**Contract**: the output object gains `swept`: `null` when no leftover commit was made or the list could not be read, else a sorted array of top-level-relative paths (empty when the commit held only the change folder). `result()` defaults it to `null`.

#### 2. Orchestrator print line

**File**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: In the "Pull request (always)" step, after the `Pull request:` line, print `Pull request: the final run state commit holds code under chore: <paths>` when `swept` is a non-empty array. Same sentence in both skills; no model, effort or tier words.

**Contract**: one added sentence per skill, outside the `## Anti-stall rules` section (its equality test stays green).

#### 3. Tests and docs

**File**: `skills/10x-pipeline/test/open-pr.test.mjs`, `docs/REFERENCE.md`

**Intent**: Extend the leftover commit test (`open-pr.test.mjs:434`): a leftover `src/x.js` next to the report edit gives `swept: ["src/x.js"]`; a report-only leftover gives `swept: []`; no leftover gives `swept: null`. Update the REFERENCE "Leftover commit" and "Output" bullets (lines 65 and 68).

**Contract**: the output field list in REFERENCE reads `{ pushed, committed, commit, commitError, swept, branch, remote, base, pr: { action, url, state, reason }, reason, manual }`.

### Success Criteria:

#### Automated Verification:

- open-pr tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs`
- Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

**Implementation Note**: After completing this phase and all automated verification passes, go on to Phase 3.

---

## Phase 3: Implement-class prompts commit their code under a typed subject

### Overview

The four implement-class templates get one commit rule; the suffix stops reading as a ban; `os-apply` switches from "never commit" to "commit your code, leave the change folder to the router".

### Changes Required:

#### 1. Commit rule in the 10x implement templates

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the same rule line to `implement` (appended to the string, which stays a string), `implement-segment` and `implement-retry` (a new array part after `@prompts/executor-retry.md`).

**Contract**: the exact line, in ADR-004 rule form:
`- **GIVEN** a phase changed files outside \`context/changes/{id}/\` **WHEN** its gates pass **THEN** you **MUST** commit those files before you write the RESULT line, under a Conventional Commits subject \`<type>({id}): <summary>\` whose type is \`feat\`, \`fix\`, \`refactor\`, \`perf\`, \`test\` or \`docs\`, never \`chore\`.`

#### 2. Suffix wording

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Replace "Do not commit unless the skill itself commits." in `prompts.suffix` with a sentence that does not contradict the new rule: "Commit only where the skill or a rule of this prompt tells you to." The rest of the suffix stays byte-identical.

**Contract**: prose line, no bold keyword (`rules.test.mjs` strict prose check).

#### 3. `os-apply` commit rule

**File**: `skills/10x-pipeline/prompts/os-apply.md`

**Intent**: Replace the rule at line 25 (never commit, stage or stash) with: when you end the step and changed files outside `openspec/changes/{id}/`, stage those files one by one by name and commit them under `<type>({id}): <summary>` with a type from the same list, never `chore`, and leave every file under `openspec/changes/{id}/` unstaged, because the router commits the change folder. Stashing stays forbidden (keep it in the same line's subject or as its own rule line).

**Contract**: rule lines in ADR-004 form, one bold keyword each; applies to `os-apply` and `os-apply-fix` (both reference the file).

#### 4. Tests

**File**: `skills/10x-pipeline/test/rules.test.mjs`

**Intent**: Pin the new rule: `implement` (still a string), `implement-segment` and `implement-retry` each contain the exact commit rule line once; `os-apply.md` has a rule that names the type list and `never \`chore\``, and no longer says `**MUST NOT** commit`; the suffix no longer contains "Do not commit unless"; the router's `implement` prompt (via a scratch run, as `nested-subagents.test.mjs:72` does) contains the rule once, before the `RESULT:` line; the type list in the rule equals a subset of `TYPES` of `tools/commit-lint.mjs` without `chore`.

**Contract**: new `test(...)` blocks in `rules.test.mjs`; `nested-subagents.test.mjs` keeps passing unchanged.

#### 5. Docs that described the old os-apply rule

**File**: `skills/openspec-pipeline/SKILL.md`, `docs/REFERENCE.md`, `skills/10x-pipeline/prompts/README.md`, `AGENTS.md`

**Intent**: Bring every statement that `os-apply` never commits in line with the new rule: openspec SKILL.md line 53 and line 122 (isolation off: the code is now committed by `os-apply`; only change-folder files stay uncommitted), REFERENCE line 364 (`os-apply` stages its code by name and never the router files) and line 413, the `os-apply.md` row of `prompts/README.md` (line 31), and the suffix description in `prompts/README.md` if it quotes the old sentence. Before this phase ends, grep `skills docs README.md AGENTS.md` (not `context/archive/`) for the other wordings of the old rule, `never archive or commit`, `forbid commits`, `forbid staging`, `nothing commits the code` and `not committed`, and bring every hit in line; the check in 3.3 matches only the two exact old sentences. In AGENTS.md, extend the ADR-010 sentence of `docs/ADR/` with "its Amendment 1 records the paths a step commit takes from outside the change folder".

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- Rule-form and prompt tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No prompt or doc outside `context/archive/` still says the `os-apply` subagent must not commit: `grep -rnE "MUST NOT\*\* commit, stage or stash|Do not commit unless" skills/*/SKILL.md skills/10x-pipeline/policy.json skills/10x-pipeline/prompts docs AGENTS.md README.md` prints nothing

---

## Testing Strategy

### Unit Tests:

- `swept` filter on both chains: change-folder paths never listed; renames list both sides; a self-committed file never listed.
- The name read failure path: no commit, no `commit` key, resume records.
- `open-pr.mjs` `swept`: `null` / `[]` / list.
- Prompt rule presence and form; suffix wording.

### Integration Tests:

- The CLI-driven isolated runs in `stepcommit.test.mjs` and `openspec-isolation.test.mjs` (real linked worktrees, hermetic git), and `open-pr.test.mjs` (bare remote, fake `gh`).

## Performance Considerations

One extra `git diff --cached --name-only` per step commit that has something to commit; one `git show --name-only` per leftover commit. Negligible next to the commit itself.

## Migration Notes

Additive log key (ADR-005): old `run.jsonl` files have no `swept`, and `status`/`report.md` of old runs are unchanged. Changing `prompts.*` changes the provenance prompt hash, as any prompt change does; `compare` warns about drift for runs that straddle the change.

## References

- Change: `context/changes/step-commit-code-under-chore/change.md`
- Score: `context/changes/step-commit-code-under-chore/complexity.json`
- Step commit: `skills/10x-pipeline/scripts/isolation.mjs:325-376`, `:456-477`
- Report: `skills/10x-pipeline/scripts/flow.mjs:105-206`
- Status: `skills/10x-pipeline/scripts/route.mjs:655-674`
- Leftover commit: `skills/10x-pipeline/scripts/open-pr.mjs:248-265`, `:306-316`
- Prompts: `skills/10x-pipeline/policy.json` (`prompts.suffix`, `implement`, `implement-segment`, `implement-retry`), `skills/10x-pipeline/prompts/os-apply.md:25`, `skills/10x-pipeline/prompts/executor-retry.md`
- ADRs: ADR-004 (rule form), ADR-005 (additive log keys), ADR-010 (step commits), ADR-013 (OpenSpec chain), ADR-017 (open-pr), ADR-021 (trailer)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router records the paths it commits under chore

#### Automated

- [ ] 1.1 Step commit and report tests pass: `node --test skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/openspec-isolation.test.mjs`
- [ ] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.3 `init` and `status` against a scratch change folder print valid JSON (10x and `--chain openspec`), per AGENTS.md "Testing"

### Phase 2: open-pr.mjs names the code of its leftover commit

#### Automated

- [ ] 2.1 open-pr tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs`
- [ ] 2.2 Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- [ ] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

### Phase 3: Implement-class prompts commit their code under a typed subject

#### Automated

- [ ] 3.1 Rule-form and prompt tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`
- [ ] 3.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.3 No prompt or doc outside `context/archive/` still says the `os-apply` subagent must not commit: `grep -rnE "MUST NOT\*\* commit, stage or stash|Do not commit unless" skills/*/SKILL.md skills/10x-pipeline/policy.json skills/10x-pipeline/prompts docs AGENTS.md README.md` prints nothing
