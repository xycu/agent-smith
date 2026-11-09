# Neutral Orchestrator Retry Implementation Plan

## Overview

Add a neutral way to rerun a logged step after an orchestrator or harness fault (no subagent ran, or its report was lost). The orchestrator declares the fault by writing the result `{"status":"orchestrator-error","note":"..."}`. The router then returns the same step again, with the same tier and the same prompt, as no failed attempt, no tier bump, no rigor rise, no rollback and no step-budget use. The rerun is shown in `run.jsonl`, `status` and `report.md`, and a per-step cap stops an endless loop. Both chains use it, because both go through `next` in `route.mjs`. The decision is recorded as ADR-015.

## Current State Analysis

- `attachResult` (`skills/10x-pipeline/scripts/flow.mjs:347`) halts with `Step <n> (<step>) has no result. Write <resultFile> first.` when the last logged step has no result file. Any result whose status is not `done` becomes `ok: false` (flow.mjs:411), which `isFailure` (`state.mjs:388`) reads as a failed attempt. That one entry then feeds the retry tier (`trailingFailures`, `state.mjs:395`, used by `tierFor`), `escalation.maxAttemptsPerStep` (`route.mjs:150`), the failed-step rigor rise (`state.mjs:463`), `budgetSteps` (`state.mjs:393`) and the isolated rollback (`isolation.mjs:448`).
- `init` on resume ends in the same `next()` call (`route.mjs:809`), so it hits the same halt. The only way out today is a non-`done` result, which counts as a failure. Found in the `openspec-project-rules` run: the orchestrator truncated the prompt of step 2 (`os-apply`), no subagent ran, and the retry went one tier up.
- A logged entry stores tier, model, effort, reason and tierWhy, but not the rendered prompt. The prompt is rebuilt from `decide()` output, the template, the policy and the files (`route.mjs:160-175`), so it cannot be reproduced after the files changed.
- Both orchestrator skills write the result file in step 3 to 5 of the `run` branch (`skills/10x-pipeline/SKILL.md:55-60`, `skills/openspec-pipeline/SKILL.md`). `openspec-skill.test.mjs:119` pins the start of step 3 of the OpenSpec `run` branch; the `## Anti-stall rules` section must stay five rules and equal in both skills (`skill-loop.test.mjs`, `openspec-skill.test.mjs:102`).
- Existing neutral patterns to follow: `fallback` and `advisory` entries (`state.mjs:386-393`), the cheaper first attempt that uses no budget, and `skipped` entries that `executed()` filters out.

### Key Discoveries:

- The simplest neutral rerun keeps the pending entry itself: no new entry means no new `n`, no new tier computation, no new count in any streak, budget or rigor reading. Everything that reads `ok === false` is untouched because the entry never gets a result.
- The prompt has to be stored while the step is pending, because `decide()` may answer differently once a lost run edited files. Dropping it when the result is consumed keeps `run.jsonl` small and keeps it out of step commits.
- `route.mjs:155` clears a stale `meta.outcome` before a continued run; the rerun path must do the same.
- A `limits` change alters the `limits` provenance section, so a run in flight records `provenance.drift: ["limits"]` after the upgrade. That is expected and changes no routing (same as earlier policy additions in `docs/REFERENCE.md`).

## Desired End State

A run whose orchestrator hit a harness fault continues with one more `orchestrator-error` result file and one `next`/`init` call. The log entry of the step carries `neutralRetries`, the next `run` output has the same prompt, model and effort, and `status` and `report.md` say how many neutral reruns each step had. A third fault of one step (default cap 2) halts the run with a clear way forward. Verification: the new `neutral.test.mjs`, both chains, an isolated run, and the full suite pass.

## What We're NOT Doing

- No re-emit of the pending step when `next` finds no result file. A missing file can mean the subagent is still running in the background (the headless note in `docs/REFERENCE.md`); the halt stays, and the orchestrator declares the fault explicitly.
- No neutral rerun of the `archive` action (10x or OpenSpec). It has no log entry and no result file, and `next` already repeats its checks safely.
- No change to the `unknown` status for an unresolved agent type or a reply with no `RESULT:` line. Those are deterministic or model faults and stay failed attempts.
- No count of neutral reruns in `compare`, and no token figure for a lost run (the host never reported it).
- No new rigor, tier, budget or rollback rule; no new prompt template; no change to `helpers.mjs`.
- No automatic `done` from files for a lost report: the router never trusts an orchestrator's claim that work finished.

## Implementation Approach

1. The router recognizes the result status `orchestrator-error` before `attachResult`. For the last executed entry that has no result, it consumes the file, appends `{ at, note }` to `entry.neutralRetries`, refreshes nothing else (original `startedAt`, `startSha`, `before` stay, so edits of a lost run still count as fresh and a later rollback goes to the original `startSha`), and prints the `run` action rebuilt from the entry, with the stored prompt.
2. `next()` stores the rendered prompt on the new entry as `pendingPrompt`; `attachResult` deletes it when a real result is consumed.
3. A policy key `limits.maxNeutralRetries` (default 2, per step entry) caps the loop; at the cap the run halts through `endRun` (report and `meta.outcome`), and `0` turns the feature off (the status then reads as any unknown status). The step budget bounds the number of entries, so the per-entry cap bounds the whole run.
4. Visibility: `status` row field, report cell suffix and a report section; the halt text for a missing result names the new status.
5. The two orchestrator skills, `docs/REFERENCE.md`, `AGENTS.md` and ADR-015 describe it.

## Phase 1: Router core and the 10x chain

### Overview

Policy key, the stored prompt, the neutral intake and its cap, wired into `next()`, with tests on the 10x chain.

### Changes Required:

#### 1. Policy

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the cap of neutral reruns of one step next to the other limits.

**Contract**: `limits.maxNeutralRetries` = `2`. A value that is not a non-negative integer reads as 2 (the shipped default); `0` turns neutral reruns off.

#### 2. Stored prompt

**File**: `skills/10x-pipeline/scripts/route.mjs` (`next`, entry creation) and `skills/10x-pipeline/scripts/flow.mjs` (`attachResult`)

**Intent**: Keep the exact prompt the orchestrator received while the step is pending, so a rerun can return it unchanged, and drop it once the step has a result.

**Contract**: log entry field `pendingPrompt` (string). Set where `entry` is built, before `log.push`. `attachResult` deletes it right after it reads the result file (every status). It never reaches `status`, the report, `compare` or a step commit (`stepCommit` rewrites `run.jsonl` from the in-memory log before it commits). One accepted exception: `rollback` runs `git add -A` before any rewrite of `run.jsonl`, so the snapshot under `refs/agent-smith/` of a failed step still holds the on-disk entry with its `pendingPrompt`; the prompt is already in the orchestrator's conversation and the ref is local, so the plan does not add a log write before the snapshot.

#### 3. Neutral intake

**File**: `skills/10x-pipeline/scripts/flow.mjs` (new exported function, for example `neutralRetry(p, log, policy, meta)`), called from `next()` in `skills/10x-pipeline/scripts/route.mjs` after `checkPrompts(policy)` and before `attachResult`

**Intent**: When the last executed entry has no result and `last-result.json` parses with `status: "orchestrator-error"`, either rerun the entry unchanged or, at the cap, halt. Everything else falls through to today's code, byte for byte.

**Contract**:
- Constant status string `orchestrator-error`; `signals`, `usage` and every other key of that result are ignored.
- Rerun: consume the result file; push `{ at: Date.now(), note }` onto `entry.neutralRetries`, with `note` a single line cut to 200 characters (empty when absent); write the log; delete a stale `meta.outcome` as `route.mjs:155` does; print `{ action: "run", n, step, agent?, model, effort, reason, prompt, resultFile, neutralRetry: { count, cap } }`. `reason` is the logged `reason; tier <tier> (<tierWhy>)` text, `prompt` is `pendingPrompt`, `agent` is the entry's `agent` field. No new entry, no change to tier, `startedAt`, `startSha`, `before`, `rigor` or any count.
- Cap: `neutralRetries.length >= maxNeutralRetries` halts through `endRun` with `Step <n> (<step>) hit its limit of <cap> neutral reruns after orchestrator faults (limits.maxNeutralRetries). Needs a human. Fix the harness, then either write a result file with the real status (the router verifies the step by its files), or raise limits.maxNeutralRetries in context/foundation/agent-smith-policy.json and write the orchestrator-error result file again, then run next.` The file is consumed, so the text must name the second write: a `next` with no file halts with the missing-result text.
- Entry without a stored `pendingPrompt` (logged before this change): a plain halt through `halt()` as the missing-result halt does (no `endRun`, no report, no `meta.outcome`), with a text that says the step cannot be rerun unchanged and to write a `failed` result to count the attempt; the file is left in place.
- No pending entry (the last entry has a result), or the cap is 0: fall through unchanged.
- Rollback, step commit, rigor, budget and `decide` are not reached on a rerun, so none of them can fire.

#### 4. Halt text of a missing result

**File**: `skills/10x-pipeline/scripts/flow.mjs` (`attachResult`, line 352)

**Intent**: Keep the existing sentence, which tests match, and add a second sentence that names the way out.

**Contract**: `Step <n> (<step>) has no result. Write <resultFile> first.` followed by a sentence telling the orchestrator that a fault of its own, with no subagent running, is declared with `{"status":"orchestrator-error","note":"..."}`.

#### 5. Tests

**File**: `skills/10x-pipeline/test/neutral.test.mjs` (new)

**Intent**: Drive the real router through the CLI in scratch projects (`helpers.mjs`), 10x chain.

**Contract**: cases, each with its own assertion of what must not change:
- rerun returns the identical `prompt`, `model`, `effort`, `n`, `reason` and the same `resultFile`; the log keeps one entry for `n` with `neutralRetries` of length 1 and no `result`, `ok`, `rolledBack`;
- no tier bump: the entry's `tier` and `tierWhy` are unchanged, and a following real `done` result continues as if the fault never happened; a following `failed` result is the first failed attempt (retry bump 1, not 2);
- no rigor rise after the maximum reruns of several steps; `budgetSteps` unchanged (a run at the step budget minus one still gets its next step);
- the original `startedAt` stays, so a file written by the lost run still verifies the step;
- cap: the third fault halts, writes `report.md` and `meta.outcome`, consumes the file; `maxNeutralRetries: 0` reads the status as a failed attempt; a malformed value reads as 2;
- an entry without `pendingPrompt` halts as specified and leaves the file;
- a stray `orchestrator-error` file with no pending entry is not consumed and changes nothing;
- `pendingPrompt` is gone from `run.jsonl` after the real result is consumed.

### Success Criteria:

#### Automated Verification:

- New neutral tests pass: `node --test skills/10x-pipeline/test/neutral.test.mjs`
- Router suite still passes after the policy and entry changes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Scratch `init` then `status` print valid JSON: `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "x"` in a scratch project

#### Manual Verification:

- In a scratch project, a step logged by `init`, then `{"status":"orchestrator-error"}` written and `next` run, returns the same prompt text twice (diff the two outputs)
- A third `orchestrator-error` result for the same step halts with the cap text

---

## Phase 2: Visibility, OpenSpec chain and isolated runs

### Overview

Show the reruns in `status` and `report.md`, and prove the behavior on the OpenSpec chain and in an isolated run (no rollback, no commit).

### Changes Required:

#### 1. Status

**File**: `skills/10x-pipeline/scripts/route.mjs` (`status`)

**Intent**: Show the number of neutral reruns on the row of a step that had any.

**Contract**: optional row field `neutralRetries` (a count, only when above 0), next to `agent` and `commit`. No row without reruns changes.

#### 2. Report

**File**: `skills/10x-pipeline/scripts/flow.mjs` (`buildReport`)

**Intent**: Tell the reader that a step was rerun after an orchestrator fault, and what the orchestrator wrote about it.

**Contract**: the `Result` cell gets the suffix `, <k> neutral rerun(s)` (also for a pending entry, `-, 1 neutral rerun`); a section `## Neutral reruns` after `## Rolled-back steps` lists `- step <n> <step>: <k> rerun(s) after an orchestrator fault` plus the cleaned notes; no rerun, no section and no change to the table. The notes are orchestrator text and `pr-comment.mjs` posts the report as it is, so notes are one line, cut and without backticks (reuse the lesson-candidate sanitizer style).

#### 3. OpenSpec chain and isolation tests

**File**: `skills/10x-pipeline/test/neutral.test.mjs` and `skills/10x-pipeline/test/openspec-helpers.mjs` (reuse only)

**Intent**: The behavior holds for `--chain openspec` and for an isolated run.

**Contract**: OpenSpec case: an `os-apply` step logged, the neutral result, the same prompt, the same tier, no `+1 for 1 failed attempt(s)` in `tierWhy`, the pre-fault ticks (`before.ticks`) unchanged. Isolated case (real linked worktree, hermetic git as in `rollback.test.mjs`): no ref under `refs/agent-smith/`, HEAD and `startSha` unchanged, no step commit, partial edits made after the step start survive the rerun; a later failed result rolls back to the original `startSha`. Report and status cases: field, cell suffix and section appear; an archived-run report keeps the section.

### Success Criteria:

#### Automated Verification:

- Neutral tests, both chains and isolation: `node --test skills/10x-pipeline/test/neutral.test.mjs`
- Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- OpenSpec scratch project `init <id> --chain openspec` and `status <id> --chain openspec` print valid JSON

#### Manual Verification:

- `report.md` of a scratch run with one neutral rerun reads clearly and shows the section
- `status` of the same run shows `neutralRetries` on the right row only

---

## Phase 3: Orchestrator skills, docs and ADR-015

### Overview

Tell both orchestrators when to declare the fault, and document the rules and the decision.

### Changes Required:

#### 1. Orchestrator skills

**File**: `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md` (`run` branch of `## Loop`)

**Intent**: The orchestrator writes `{"status":"orchestrator-error","note":"<what happened>"}` as the result file, and runs `next` as usual, when the fault is its own and no subagent of the step is running: the Agent call was refused or errored before any subagent started and the cause is not the router's `agent`, the prompt could not be passed whole (for example it was truncated), or the Agent call returned neither a reply nor an error. It prints the rerun line with `neutralRetry`. It keeps the `unknown` result for an unresolved agent type (the router's `agent`) and for any reply that came back without a parsable `RESULT:` line.

**Contract**: the current step 2 sentence "When the call fails ... go on with step 3, which records the step as `unknown`" is split into the two cases above, so the two skills never give both statuses for one fault; add the text inside step 2 and step 3 of the `run` branch without changing the start of step 3 (`openspec-skill.test.mjs:119`, the regex on the text "3. Find the last line of the subagent's reply that starts with"); the `## Anti-stall rules` section stays untouched and equal in both skills; the same rule in both skills. The new text must avoid every word `openspec-skill.test.mjs` scans the whole OpenSpec skill for (the ladder's model aliases and effort levels, `fable`, `tier`, `tiers`), so it says "the same prompt" and never "the same tier"; the 10x skill follows the same wording. The `Print one line` step mentions the optional `neutralRetry`.

#### 2. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Document the status, the guarantees, the cap, the fields and the limits.

**Contract**: a section "Neutral rerun after an orchestrator fault" in the 10x part and one pointer line in the OpenSpec part; rewrite the sentence in "Headless limit of the first rule" that recommends `{"status":"failed","note":"interrupted"}` to recommend the new status; add to "Budget" that neutral reruns use no budget; upgrade note for `provenance.drift` of `limits`. Mention that a rerun after a lost report continues over the lost run's edits, and that the orchestrator declares `orchestrator-error` only when no subagent of that step can still be running: a background subagent that outlives the declaration would edit the same files as the rerun, which is why the router does not re-emit the step on a missing file by itself (D1 of ADR-015 says the same).

#### 3. Repository guide

**File**: `AGENTS.md`

**Intent**: Keep the guide true.

**Contract**: add `neutral.test.mjs` to the test list with one sentence; update the `docs/ADR/` line to include ADR-015 and its subject. No other rule changes.

#### 4. ADR

**File**: `docs/ADR/ADR-015-neutral-orchestrator-retry.md` (new)

**Intent**: Record the decision and why, in the form of ADR-012 and ADR-013 (Status, Date, Deciders, Origin, Context, Decision as GIVEN/WHEN/THEN scenarios, Consequences, Alternatives).

**Contract**: decisions D1 explicit status over re-emit on a missing file (background-subagent duplicate risk); D2 same entry, not a new one (no counts change); D3 stored `pendingPrompt` instead of recomputation; D4 original `startedAt` and `startSha` kept; D5 cap `limits.maxNeutralRetries` per entry, 0 is off; D6 `unknown` stays a failure; D7 both chains share it; D8 numbering: ADR-015 as the owner named it, ADR-014 is not in this tree.

### Success Criteria:

#### Automated Verification:

- Skill content tests: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`
- Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields unchanged and valid: `node tools/version-check.mjs`

#### Manual Verification:

- The two skill texts read the same for the new rule and mention no model, effort or tier
- `docs/REFERENCE.md` and ADR-015 agree with the router on the status name, the field names and the default cap

---

## Testing Strategy

### Unit Tests:

- The intake function through the CLI: neutral, capped, off, legacy entry, stray file, malformed cap.

### Integration Tests:

- 10x and OpenSpec chains; an isolated run with a real worktree; `status` and `report.md` output; the full existing suite as a regression guard for the changed halt text and the new entry field.

### Manual Testing Steps:

1. In a scratch project, `init`, copy the printed prompt, write the neutral result, run `next`, diff the prompts.
2. Repeat past the cap and read the halt text.
3. Run `status --report` and read `report.md`.

## Performance Considerations

None. `pendingPrompt` lives in `run.jsonl` only while a step is pending (a few KB).

## Migration Notes

A run in flight at upgrade has a pending entry without `pendingPrompt`; the neutral result halts with an explicit text for it (write a `failed` result). The `limits` provenance section changes, so such a run records `provenance.drift: ["limits"]` at its next `next`; routing is unaffected.

## References

- Change: `context/changes/neutral-orchestrator-retry/change.md`
- Result intake and halt: `skills/10x-pipeline/scripts/flow.mjs:347`
- `next` and entry creation: `skills/10x-pipeline/scripts/route.mjs:61`, `:177`
- Failure, budget and rigor readers: `skills/10x-pipeline/scripts/state.mjs:386`, `:393`, `:463`
- Rollback eligibility: `skills/10x-pipeline/scripts/isolation.mjs:448`
- Similar neutral entries: ADR-010 (cheaper first attempt), ADR-012 (neutral failed `manual-verify` attempt)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router core and the 10x chain

#### Automated

- [x] 1.1 New neutral tests pass: `node --test skills/10x-pipeline/test/neutral.test.mjs` — e58ed5c
- [x] 1.2 Router suite still passes after the policy and entry changes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — e58ed5c
- [x] 1.3 Scratch `init` then `status` print valid JSON: `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "x"` in a scratch project — e58ed5c

#### Manual

- [ ] 1.4 In a scratch project, a step logged by `init`, then `{"status":"orchestrator-error"}` written and `next` run, returns the same prompt text twice (diff the two outputs)
- [ ] 1.5 A third `orchestrator-error` result for the same step halts with the cap text

### Phase 2: Visibility, OpenSpec chain and isolated runs

#### Automated

- [x] 2.1 Neutral tests, both chains and isolation: `node --test skills/10x-pipeline/test/neutral.test.mjs` — f25e01a
- [x] 2.2 Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — f25e01a
- [x] 2.3 OpenSpec scratch project `init <id> --chain openspec` and `status <id> --chain openspec` print valid JSON — f25e01a

#### Manual

- [ ] 2.4 `report.md` of a scratch run with one neutral rerun reads clearly and shows the section
- [ ] 2.5 `status` of the same run shows `neutralRetries` on the right row only

### Phase 3: Orchestrator skills, docs and ADR-015

#### Automated

- [x] 3.1 Skill content tests: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` — 1031e46
- [x] 3.2 Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 1031e46
- [x] 3.3 Version fields unchanged and valid: `node tools/version-check.mjs` — 1031e46

#### Manual

- [ ] 3.4 The two skill texts read the same for the new rule and mention no model, effort or tier
- [ ] 3.5 `docs/REFERENCE.md` and ADR-015 agree with the router on the status name, the field names and the default cap
