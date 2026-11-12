---
change_id: attach-result-persist-first
title: Persist the step result in run.jsonl before deleting last-result.json
status: planned
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 1, "Must fix".

### Problem

`attachResult` in `skills/10x-pipeline/scripts/flow.mjs` reads `agent-smith/last-result.json` into the last executed log entry in memory and deletes the file right away (`fs.rmSync(p.result)`, flow.mjs:467). The log entry reaches disk only later in `next()` (`route.mjs`): in the skip loop, in `endRun`, in `stepCommit` (isolated runs, ok steps only), in `rollback` (isolated runs, failed steps only), or when the next entry is pushed. Any router error thrown between `attachResult` (route.mjs:82) and the first `writeLog` ends in main's catch, which prints a halt and exits without writing the log. The result file is gone and the entry has no `result`.

### Reproduction (verified)

Scratch project, `isolation.require: false`:

1. `route.mjs init demo --goal "add a thing"` returns step 1 `plan`.
2. Write `last-result.json` with `{"status":"done","note":"wrote plan","usage":{"totalTokens":1234}}`.
3. Break the override, for example `"ladder": []`.
4. `route.mjs next demo` halts with `Router error: Cannot destructure property 'model' of 'policy.ladder[tier]' as it is undefined.` The `agent-smith/` folder then holds only `meta.json` and `run.jsonl`, and the last log line has no `result`.
5. Restore the override and run `next` again. It halts with `Step 1 (plan) has no result. Write .../last-result.json first.` and suggests `orchestrator-error`, which reruns the whole finished step.

### Who is hit

- Every run with `isolation.require: false`.
- Isolated runs whose last step is not ok and gets no rollback: a fallback entry, an advisory (score) entry, an implement entry with `uncommitted`, or a result with `signals.needsHuman`. `stepCommit` writes the log first only for an ok step, and `rollback` writes the state only for a step it rolls back.
- Any throw after `attachResult`: a malformed policy key read only in `decide`, `tierFor` or `resolveRigor` (`rigorLevels` throws), or a template that `decide` names and `policy.prompts` lacks (`checkPrompts` checks only the templates that exist).

Lost: the step's `status` and `note`, the usage figure (tokens, tool uses, duration), the cleaned `signals` (needsHuman, rigor, lesson candidates), the `review` record and the verification side effects (`uncommitted`, `fallback`, `ticked`/`unproven`). Rerunning a finished plan or implement step costs a full subagent run, and in a non-isolated run the rerun lands on top of the edits already made.

### Fix direction

- At the end of `attachResult`, after `last.finishedAt`, call `writeLog(p.log, log)` and only then `fs.rmSync(p.result)`. `writeLog` is already imported in flow.mjs. The file is still removed before `stepCommit`'s `git add -A` and before `rollback`'s snapshot, so no commit ever holds `last-result.json`.
- Check that `neutralRetry` keeps its order: it already writes the log right after its `rmSync`, and the only branch between them goes through `endRun`, which writes the log.
- A resumed `next` after the fix sees `last.result` set, skips `attachResult` and decides again from the files. The only effect of the extra write is that a crash after it keeps the result.

### Tests

- A new case in `route.test.mjs` (or a new test file): write a result, break a policy key that only `next` reads after `attachResult` (for example `"ladder": []`), run `next` and assert that the halt is a `Router error`, that `run.jsonl` holds the entry with `result`, `usage` and `ok`, and that `last-result.json` is gone. Then restore the policy, run `next` again and assert that it routes on without asking for a result.
- The same case in an isolated run with a non-ok, non-rollback entry (a fallback), using the hermetic git helpers of the isolation tests.
- Run `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`, then `init` and `status` against a scratch change folder (AGENTS.md "Testing").

### Done when

A router error at any point after `attachResult` leaves the step's result in `run.jsonl`, and the next `next` after the cause is fixed routes on without a rewritten result file and without rerunning the step.
