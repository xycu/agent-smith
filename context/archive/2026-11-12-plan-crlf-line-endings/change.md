---
change_id: plan-crlf-line-endings
title: Parse plan.md with CRLF line endings without crashing or dropping rows
status: archived
created: 2026-11-12
updated: 2026-11-13
archived_at: 2026-11-13T11:26:26Z
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 2, "Must fix".

### Problem

The plan readers split on `"\n"` and then match each line with a pattern anchored at `$`. With CRLF line endings every line keeps a trailing `\r`. In JavaScript, `.` does not match `\r`, so `(.*)$` fails on such a line.

- `readPlan` in `skills/10x-pipeline/scripts/state.mjs:181`: the phase heading test `/^### Phase \d+/` passes, but `line.match(/^### Phase (\d+)\s*:?\s*(.*)$/)` returns `null` for `### Phase 1: Core\r`, and `Number(h[1])` throws. The router halts with `Router error: Cannot read properties of null (reading '1')`. A heading without a name (`### Phase 1\r`) still matches, because `\s*` eats the `\r`.
- In the same loop, the row pattern `/^- \[( |x|X)\] (.*)$/` never matches a CRLF row. Rows, `autoPending`, `autoDone` and `manualPending` all read as 0, so `decide` treats pending implementation work as done and goes on to the implementation review, `manual-verify` or `done` without saying anything.
- `planPaths` (state.mjs:690) and `phaseFiles` (`skills/10x-pipeline/scripts/steps.mjs:135`) call `planFileTokens`, whose pattern `/^\*\*Files?\*\*:(.*)$/` also fails on `\r`. The plan then names no paths, so churn risk reads as not measured and the tdd executor never sees a pure-logic phase.

### Reproduction (verified)

A scratch project with `isolation.require: false` and a `plan.md` written with `\r\n` that contains `## Progress`, `### Phase 1: Core`, `#### Automated` and `- [ ] 1.1 Do it`. `route.mjs init demo --goal "add a thing"` halts with `Router error: Cannot read properties of null (reading '1')`.

### Who is hit

Windows users with `core.autocrlf=true`, the default of Git for Windows. git writes CRLF on every checkout of `plan.md`: when a worktree is made from a branch that holds the plan, and on the rollback's `git reset --hard` of an isolated run. An editor that saves CRLF hits it on any platform. The README names no supported platform, and Claude Code runs on Windows.

### Fix direction

- Use `split(/\r?\n/)` in `readPlan`, `planPaths` and `phaseFiles`, as `aggregateGap`, `e2eSetup`, `readUnprovenReasons` and `readVerdict` already do.
- Check the other `split("\n")` readers and leave the ones that already tolerate `\r`: `readFindings` and `readReview` (no `$` anchor on the captured text), `readLog` (`JSON.parse` ignores trailing whitespace) and `readTasks` (`TASK_ROW` has no `$`). `createdValue` in isolation.mjs reads `created:` as /10x-archive reads it, unmodified, on purpose. Leave it and record that choice in the plan.
- Since `readPlan` keeps the row text it parses, check that the stored row text (`rowId`, `text`) carries no `\r` after the change, so a row id of a CRLF plan equals the id of the same plan in LF.

### Tests

- In `route.test.mjs` or a new test file: the same plan written with LF and with CRLF gives the same `readPlan` result (phases, rows, `autoDone`, `autoPending`, `manualPending`, `phaseList` with ids and texts), and `init` on a CRLF plan routes to the same step as on the LF plan.
- A CRLF plan with `**Files**:` lines gives the same `risk` output as its LF copy.
- Run the full suite, then `init` and `status` against a scratch change folder.

### Done when

A plan with CRLF line endings routes exactly like the same plan with LF endings, and no plan reader throws on a `\r`.
