# Per-Step Usage Report Implementation Plan

## Overview

Make every pipeline run end with a human-readable `report.md` that lists which model and effort ran each step, with token figures where the orchestrator could supply them. Roadmap item S-02 (milestone M-1), PRD FR-004 and FR-009. The report is the basis for the later PR comment (S-05) and baseline comparison (S-06).

## Current State Analysis

- `route.mjs` already logs `model`, `effort`, `tier`, `simple`, `ok`, `verified`, `reason` and the raw `result` per step in `run.jsonl` (`route.mjs:334-348`, `:131-154`). `status` prints a JSON list of them (`route.mjs:362-372`). No readable report file exists.
- The router learns that a run has ended in three places inside `next`: the step budget (`route.mjs:310-313`), `decide` returning `done` or `halt` (`route.mjs:315-321`), and `maxAttemptsPerStep` (`route.mjs:325-328`). A fourth `halt` in `attachResult` (`route.mjs:135`) fires before any result exists and is not an end of run.
- The router never sees token figures. Subagent transcripts under `~/.claude/projects/.../subagents/agent-<id>.jsonl` carry per-message `usage`, but are keyed by an agent id the router does not have and sit outside the project. The orchestrator sees a usage summary in the Agent tool result and already writes the step's `RESULT` JSON to `resultFile`, which `attachResult` stores whole on the log entry as `result`.
- `/10x-archive` is a toolkit skill and cannot be changed (PRD Non-Goals), so "before archive" can only mean "when the run ends".
- `SKILL.md` must not name models or tiers beyond what it already documents; routing numbers live in `policy.json` (AGENTS.md Hard Rules).

## Desired End State

When `route.mjs next` returns `done` or `halt`, `context/changes/<id>/agent-smith/report.md` exists. It has one row per step with model, effort, tier, simple flag, result and tokens, plus a totals line that states how many steps had token figures. `route.mjs status <id> --report` rewrites it on demand. Steps without figures show `-`. A run whose orchestrator passes no usage still gets a complete model-and-effort report. Verify with a scratch change folder: a finished run, a halted run, a run with partial usage.

### Key Discoveries:

- `last.result = result` already keeps the whole RESULT JSON on the log entry (`route.mjs:150`), so an added `usage` key reaches `run.jsonl` with no router change; the router only has to validate it.
- `parseFlags` already returns `true` for a bare `--report` (`route.mjs:24-33`); `status` just ignores flags today (`route.mjs:397-398`).
- `init` rewrites `meta.json` from `id`, `goal`, `size`, `sizeBump` only (`route.mjs:388-393`), so an `outcome` field stored there is cleared when a run is resumed.
- The Agent result gives one total, not an input/output split, so the report shows total tokens, tool uses and duration, nothing finer.

## What We're NOT Doing

- Baseline comparison against a Sonnet-5.5 high-effort run (S-06) and any cost-in-money figure.
- Posting the report to a pull request (S-05); the report is only a file.
- Reading subagent transcripts from `~/.claude/projects` or any path outside the change folder.
- Changing `policy.json`, tier logic, or `/10x-archive`. No new policy keys: the report file name is fixed in `route.mjs`.
- Splitting tokens into input, output and cache.
- Writing a report when `attachResult` halts for a missing result file.

## Implementation Approach

Three small phases in dependency order. First make usage valid data on the log entry and visible in `status`. Then build the report from the log and write it where the router already ends a run. Finally update the orchestrator instructions, which is the only place that makes the figures appear at all. Phases 1 and 2 change `route.mjs` only; both are checked against a scratch change folder because the repo has no test suite.

## Phase 1: Usage intake

### Overview

The router accepts an optional `usage` object in the step result, keeps only valid numbers on the log entry, and shows it in `status`.

### Changes Required:

#### 1. Normalise usage on result intake

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `attachResult`, read `result.usage` and store a cleaned copy as `last.usage`. Drop anything that is not a finite non-negative number; drop the whole object when no field survives. Never let a bad usage object fail a step or change `ok`.

**Contract**: `last.usage` is absent or `{ totalTokens?: number, toolUses?: number, durationMs?: number }`. The raw `result` stays on the entry unchanged.

#### 2. Show usage in `status`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `usage` (or `null`) to each step object that `status` prints.

**Contract**: `status` JSON step objects gain `usage: {…} | null`; all existing keys keep their names and order.

### Success Criteria:

#### Automated Verification:

- Script parses: `node --check skills/10x-pipeline/scripts/route.mjs`
- Scratch run with `usage` in `last-result.json` puts `usage.totalTokens` on the `run.jsonl` entry and in `status` output
- Scratch run with a string or negative `usage` field stores no such field and the step is still `ok`
- A fresh scratch change with `--size m` still routes to the `plan` step on opus/high (`baseTier` 4 in `policy.json`), as before this phase

#### Manual Verification:

- `status` output stays readable with and without usage

---

## Phase 2: Report writer

### Overview

Build `report.md` from the run log and write it whenever the router ends a run; allow regenerating it with `status <id> --report`.

### Changes Required:

#### 1. Report builder and writer

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `buildReport` and `writeReport` that turn the log and `meta.json` into Markdown and write it to `agent-smith/report.md`. Add `report` to `paths()`.

**Contract**: Output layout, in order: a title with the change id; goal, size and outcome lines (outcome = `done`/`halt` plus reason, or `not ended` for a snapshot); a table with columns `#`, `Step`, `Model`, `Effort`, `Tier`, `Simple`, `Result`, `Tokens`; a totals line `Steps: N · Tokens: X (figures for K of N steps)`. `Result` is `ok`, `failed`, or `-` when the entry has no result. `Simple` is `yes`/`no`. `Tokens` is the number or `-`. Retried steps get their own rows. No table row or line depends on a model name.

#### 2. Write on every end of run, remember the outcome

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add one `endRun` helper (write the log, `writeReport`, print the result) and use it in the three end-of-run branches of `next` (step budget, `done`/`halt` from `decide`, `maxAttemptsPerStep`), so no branch can skip the report. Store `outcome: { action, reason }` in `meta.json` at that moment so a later regeneration prints the real outcome. Leave the `attachResult` halt alone.

**Contract**: `meta.json` gains an optional `outcome`; `init` already rebuilds `meta.json` without it, so resuming clears it, and `next` deletes it whenever it returns `run`, so a continued run never keeps a stale outcome. The `done`/`halt` JSON printed to stdout gains `report: "<relative path>"`.

#### 3. On-demand regeneration

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Pass parsed flags to `status`; with `--report` it writes the report and adds `report` to its output. Without the flag `status` stays read-only.

**Contract**: `route.mjs status <id> --report`. Update the usage line in the header comment and in the final usage error string.

### Success Criteria:

#### Automated Verification:

- Script parses: `node --check skills/10x-pipeline/scripts/route.mjs`
- A scratch run that reaches `done` leaves `agent-smith/report.md` with one table row per `run.jsonl` entry
- A scratch run that halts (three failed attempts of one step) also leaves `report.md`, with the halt reason in the outcome line
- A run where only some steps carry `usage` prints `-` for the others and a totals line with the right `K of N`
- A run with no usage anywhere still writes the report with every `Tokens` cell `-`
- `status <id> --report` rewrites the file and keeps the stored outcome; plain `status` does not touch it
- `init` on an existing log leaves `meta.json` without `outcome`
- After a halt, raising the limit in the override file and calling `next` (which returns `run`) leaves `meta.json` without `outcome`
- A scratch run with `limits.maxTotalSteps` set to 1 in `context/foundation/agent-smith-policy.json` halts on the step budget and still leaves `report.md`
- `git diff --stat` shows no change to `skills/10x-pipeline/policy.json`

#### Manual Verification:

- The generated `report.md` reads clearly as a table in a Markdown viewer

---

## Phase 3: Docs sync

### Overview

Tell the orchestrator to pass usage through, and describe the report in `SKILL.md` and `README.md`.

### Changes Required:

#### 1. Orchestrator instruction

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In the `run` branch, step 4, say that when the Agent result reports usage (total tokens, tool uses, duration) the orchestrator adds `"usage":{"totalTokens":N,"toolUses":N,"durationMs":N}` to the JSON it writes, copied exactly, and omits the key when no figure is reported. In `done` and `halt`, tell it to point the user to `report.md` from the router output.

**Contract**: Edits only the `Loop` section and the `Rules` list if needed. No model names, tiers or numbers beyond what the file already documents. Orchestrator still never edits `run.jsonl` or `meta.json`.

#### 2. README description

**File**: `README.md`

**Intent**: Add a short "Usage report" bullet group under "How routing works" or next to the run-state sentence: what `report.md` contains, when it is written, that token figures are optional, and the `status <id> --report` command.

**Contract**: Mentions `context/changes/<change-id>/agent-smith/report.md`. Keeps `name`, `description` and `version` aligned with both manifests (unchanged).

### Success Criteria:

#### Automated Verification:

- `SKILL.md` mentions `usage` and `report.md`: `grep -n "usage\|report.md" skills/10x-pipeline/SKILL.md`
- `SKILL.md` names no model that it did not name before: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -iE '^\+.*(haiku|sonnet|opus)'` prints nothing
- `README.md` mentions `report.md` and `--report`: `grep -n "report.md\|--report" README.md`
- Manifests untouched: `git diff --stat .claude-plugin` is empty

#### Manual Verification:

- `SKILL.md`, `README.md` and `route.mjs` describe the same report, file path and command
- One real run through the skill on a scratch change (no hand-written result files) leaves `usage` on at least one `run.jsonl` entry and a number in the `Tokens` column of `report.md`

---

## Testing Strategy

### Unit Tests:

None; the repo has no test setup (AGENTS.md). Use scratch change folders.

### Integration Tests:

- Scratch folder `context/changes/s/change.md`, `plan.md` with a `## Progress` section, hand-written `last-result.json` files, run `init`, `next`, `status` from that folder as project root.
- Cases: all steps with usage; mixed; none; invalid usage; halt by repeated failure; resume with `init`.

### Manual Testing Steps:

1. Run a complete scratch sequence to `done` and open `report.md`.
2. Run a sequence that halts and open `report.md`.
3. Run `status <id> --report` and `status <id>` and compare file modification times.
4. After Phase 3, run `/agent-smith:10x-pipeline` once on a scratch change and confirm token figures reach `run.jsonl` and `report.md`.

## Performance Considerations

None. The report is built once per run end from a log of at most `maxTotalSteps` (14) entries.

## References

- Roadmap item S-02: `context/foundation/roadmap.md`
- PRD: `context/foundation/prd.md` (FR-004, FR-009, Open Question 4)
- ADR-001 Phase 1: `docs/ADR/ADR-001-phased-complexity-routing.md`
- Similar earlier change: `context/archive/2026-10-30-cheaper-routing-simple-change/plan.md`
- End-of-run branches: `skills/10x-pipeline/scripts/route.mjs:310-328`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Usage intake

#### Automated

- [x] 1.1 Script parses: `node --check skills/10x-pipeline/scripts/route.mjs`
- [x] 1.2 Scratch run with `usage` in `last-result.json` puts `usage.totalTokens` on the `run.jsonl` entry and in `status` output
- [x] 1.3 Scratch run with a string or negative `usage` field stores no such field and the step is still `ok`
- [x] 1.4 A fresh scratch change with `--size m` still routes to the `plan` step on opus/high (`baseTier` 4 in `policy.json`), as before this phase

#### Manual

- [x] 1.5 `status` output stays readable with and without usage

### Phase 2: Report writer

#### Automated

- [ ] 2.1 Script parses: `node --check skills/10x-pipeline/scripts/route.mjs`
- [ ] 2.2 A scratch run that reaches `done` leaves `agent-smith/report.md` with one table row per `run.jsonl` entry
- [ ] 2.3 A scratch run that halts (three failed attempts of one step) also leaves `report.md`, with the halt reason in the outcome line
- [ ] 2.4 A run where only some steps carry `usage` prints `-` for the others and a totals line with the right `K of N`
- [ ] 2.5 A run with no usage anywhere still writes the report with every `Tokens` cell `-`
- [ ] 2.6 `status <id> --report` rewrites the file and keeps the stored outcome; plain `status` does not touch it
- [ ] 2.7 `init` on an existing log leaves `meta.json` without `outcome`
- [ ] 2.8 After a halt, raising the limit in the override file and calling `next` (which returns `run`) leaves `meta.json` without `outcome`
- [ ] 2.9 A scratch run with `limits.maxTotalSteps` set to 1 in `context/foundation/agent-smith-policy.json` halts on the step budget and still leaves `report.md`
- [ ] 2.10 `git diff --stat` shows no change to `skills/10x-pipeline/policy.json`

#### Manual

- [ ] 2.11 The generated `report.md` reads clearly as a table in a Markdown viewer

### Phase 3: Docs sync

#### Automated

- [ ] 3.1 `SKILL.md` mentions `usage` and `report.md`: `grep -n "usage\|report.md" skills/10x-pipeline/SKILL.md`
- [ ] 3.2 `SKILL.md` names no model that it did not name before: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -iE '^\+.*(haiku|sonnet|opus)'` prints nothing
- [ ] 3.3 `README.md` mentions `report.md` and `--report`: `grep -n "report.md\|--report" README.md`
- [ ] 3.4 Manifests untouched: `git diff --stat .claude-plugin` is empty

#### Manual

- [ ] 3.5 `SKILL.md`, `README.md` and `route.mjs` describe the same report, file path and command
- [ ] 3.6 One real run through the skill on a scratch change (no hand-written result files) leaves `usage` on at least one `run.jsonl` entry and a number in the `Tokens` column of `report.md`
