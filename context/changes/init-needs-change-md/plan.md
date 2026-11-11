# init and next write run state for a 10x change that has no change.md Implementation Plan

## Overview

GitHub issue #96. For the 10x chain, `init` and `next` create `context/changes/<id>/agent-smith/` (`mkdirSync`) before anything checks that `change.md` exists, so a mistyped id leaves `meta.json`, `run.jsonl` and `report.md`, and in an isolated run a `chore(<id>): start run` commit. This plan moves the `change.md` check in front of both `mkdirSync` calls, with the existing halt text, as the OpenSpec branch already does for its change folder. The docs line that lists the empty folder as a known limit is rewritten.

## Current State Analysis

- `next` (`skills/10x-pipeline/scripts/route.mjs:63-69`) halts early only for an OpenSpec chain without `p.change` (`missingChangeReason`), then runs `fs.mkdirSync(p.dir, { recursive: true })`.
- `init` (`route.mjs:~845-870`) does the same: the OpenSpec branch halts with `... Nothing was written.`; for the 10x chain nothing is checked before the isolation gate, the start commit and `fs.mkdirSync(p.dir, ...)` at `:870`.
- The only 10x check is late: `decide` (`skills/10x-pipeline/scripts/flow.mjs:589-591`) returns `No change folder. Run /10x-new <id> first.` when `change.md` is missing.
- `status --report` already guards a missing `p.change` (`route.mjs:674`); `usage` refuses a missing folder.
- `makeProject({ change: false })` (`test/helpers.mjs:37`) builds a project whose change folder exists without `change.md`. Only `test/archive.test.mjs:140-148` ("a suffix-collision archive folder does not trigger the guard") relies on init creating state without `change.md`; it must keep proving that the archive guard stays quiet.
- `docs/REFERENCE.md:462` (OpenSpec "Limits") says `next demo` run by hand on an OpenSpec-only name creates an empty `context/changes/demo/agent-smith/` folder. That scenario halts after this change.

## Desired End State

- `init <id>` and `next <id>` on the 10x chain, with no `context/changes/<id>/change.md`, halt with `No change folder. Run /10x-new <id> first.` (exit 1, `action: "halt"`) and write nothing: no `agent-smith/` folder, no start commit.
- Runs with `change.md` behave exactly as before; the OpenSpec chain is unchanged.
- Verified by: the new tests and `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` green.

## What We're NOT Doing

- No change to the OpenSpec chain checks or `missingChangeReason`.
- The late check in `decide` stays (defence if `change.md` vanishes mid-run).
- No new ADR, policy key, or `helpers.mjs` change.
- No cleanup of folders earlier hand-runs already left behind.

## Implementation Approach

One shared check in `route.mjs`, called at the two places that precede `mkdirSync`, after `guardArchived` so archived-change halts keep their text. Then docs.

## Phase 1: Halt before writing

### Overview

Check `change.md` for the 10x chain before `init` and `next` write anything.

### Changes Required:

#### 1. Early check

**Intent**: For the 10x chain, halt with the `decide` text when `<p.change>/change.md` is missing, before any write.
**Contract**: a small helper in `route.mjs` (`halt` from `state.mjs`) used in `next` before `fs.mkdirSync(p.dir...)` and in `init` right after `guardArchived(p, id)` / the OpenSpec block, before `readMeta`, the isolation gate and `mkdirSync`. Text: `No change folder. Run /10x-new ${id} first.` (match `flow.mjs:590`). OpenSpec chain unaffected.

#### 2. Tests

**Intent**: Prove the halt and that nothing is written, for `init` and `next`, plain and isolated; fix the one test that relied on the old behavior.
**Contract**: in `skills/10x-pipeline/test/route.test.mjs`, plain tests using `makeProject({ change: false })`: `init` and `next` exit 1 with the reason matching `/No change folder\. Run \/10x-new demo first\./` and `agent-smith/` absent. The isolated variant goes in `skills/10x-pipeline/test/isolation.test.mjs` (its `worktree()` helper is local to that file; test name contains `missing change.md`): `policy: { isolation: { require: true } }`, a linked worktree whose change folder has no `change.md`, `init` halts and `git log` has no start commit. If another test in the suite relied on `init`/`next` creating state without `change.md`, fix it the same way. Update `archive.test.mjs:140-148` to assert the halt is the missing-change one (no `archived` in the reason) and that no `meta.json` was written.

### Success Criteria:

#### Automated Verification:

- `init` and `next` without `change.md` halt and write nothing.
- The isolated `init` makes no start commit.
- The archive-guard test still proves the guard is quiet.
- The whole suite passes.

#### Manual Verification:

- In a scratch project, `route.mjs init nosuch --goal x` prints the halt and `ls context/changes` shows no `nosuch`.

## Phase 2: Docs

### Overview

Rewrite the known-limit line and note the behavior.

### Changes Required:

#### 1. REFERENCE.md

**Intent**: Replace the `:462` limit (hand-run `next` creates an empty folder) with the new behavior; add one bullet to the "How routing works" list (10x chain section) saying that `init` and `next` halt with `No change folder. Run /10x-new <id> first.` and write nothing when `change.md` is missing. Rewrite the `:462` bullet to say that hand-run call now halts and creates no folder, and drop its D8 collision pointer, which no longer applies.
**Contract**: edit `docs/REFERENCE.md` only; no policy, ADR or `AGENTS.md` change.

### Success Criteria:

#### Automated Verification:

- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes (rule and content tests included).

#### Manual Verification:

- REFERENCE.md no longer says a hand-run command creates an empty `context/changes/<name>/agent-smith/` folder.

## Testing Strategy

Router tests through the CLI in scratch projects, per `AGENTS.md`; then `init` and `status` against a scratch change folder to confirm valid JSON.

## Performance Considerations

None: one `fs.existsSync`.

## Migration Notes

None. Existing junk folders from earlier hand-runs stay; delete them file by file.

## References

- GitHub issue #96; `context/changes/init-needs-change-md/change.md`.
- `skills/10x-pipeline/scripts/route.mjs:63-69,845-870`, `skills/10x-pipeline/scripts/flow.mjs:589-591`, `skills/10x-pipeline/test/helpers.mjs:37`, `skills/10x-pipeline/test/archive.test.mjs:140-148`, `docs/REFERENCE.md:462`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Halt before writing

#### Automated

- [x] 1.1 `init` and `next` without `change.md` halt and write nothing: `node --test --test-name-pattern="missing change.md" skills/10x-pipeline/test/route.test.mjs` passes
- [x] 1.2 The isolated `init` makes no start commit: `node --test --test-name-pattern="missing change.md" skills/10x-pipeline/test/isolation.test.mjs` passes
- [x] 1.3 The archive-guard test still passes: `node --test --test-name-pattern="suffix-collision" skills/10x-pipeline/test/archive.test.mjs` passes
- [x] 1.4 The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes

#### Manual

- [ ] 1.5 In a scratch project, `route.mjs init nosuch --goal x` prints the halt and `context/changes/nosuch` is not created

### Phase 2: Docs

#### Automated

- [x] 2.1 The suite stays green after the docs edit: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes

#### Manual

- [ ] 2.2 `docs/REFERENCE.md` no longer says a hand-run command creates an empty `context/changes/<name>/agent-smith/` folder
