---
change_id: late-step-usage
title: Keep a step's usage figure when it arrives after next ran
status: impl_reviewed
created: 2026-11-10
updated: 2026-11-10
archived_at: null
---

## Notes

GitHub issue #71: run reports show `-` for the tokens of most steps, although every subagent reported usage in its task notification. The notification often arrives after the orchestrator has written `last-result.json` and run `next`. Anti-stall rule 2 makes it write the file without `usage`, and rule 3 forbids using a figure that arrives later. Whether a step keeps its figure therefore depends on tool batching and message order. It was seen again on 2026-11-10: step 1 (`score`) of the `no-nested-subagents` run lost its figure this way.

The OpenSpec chain is affected the same way. `skills/openspec-pipeline/SKILL.md` carries the same rules 2 and 3 in its equal `## Anti-stall rules` section, and both chains store usage through `attachResult` in `skills/10x-pipeline/scripts/flow.mjs`.

Fix: suggestion 2 of the issue, a router command that attaches a late figure. It does not depend on message order. Suggestion 1 (write the file in its own call and wait for the notification before `next`) only lowers the odds, so it is not the fix.

Scope:

- **Router command:** `route.mjs usage <change-id> <n> --tokens N --tool-uses N --duration-ms N [--chain 10x|openspec]`. It attaches the figure to executed step `<n>` of `run.jsonl`, through the same validation as `usage` in a result file. It works for both chains, with the chain resolved as for the other commands.
- **Guards:**
  - It refuses a step number that is not logged, a skip entry, or a step that is still pending (no result yet). A pending step's figure belongs in its result file.
  - It never overwrites a figure. The same figure again is a no-op; a different one halts.
  - It writes nothing for an archived change, nor into a change folder that the router has already handed to an `archive` action.
- **No figure lost to git:**
  - The patch must survive a later step's rollback in an isolated run. `git reset --hard <startSha>` must not restore a `run.jsonl` without the figure.
  - It must also reach the branch, through the next step commit or a commit of its own.
  - Never commit while a step subagent may be using git, unless that is shown to be safe.
- **Ended runs:** when the run has ended (`done`, `halt` or an `archive` action not yet carried out), the command rewrites `report.md`, so its totals and the `Cost (est.)` column include the figure.
  - For an `--archive` run, the last step's figure must still land before the archive subagent starts: the archive skill refuses an uncommitted change folder. Then `report.md` inside the archive also has it.
  - After the archive subagent has started, the figure is dropped.
- **Orchestrator skills:** both `SKILL.md` files.
  - Rule 3 changes from "MUST NOT use a late figure" to "run the `usage` command once for it".
  - Loop step 4 and the `archive` branch say when to run it.
  - The `## Anti-stall rules` sections stay equal in both skills.
- **Read-only consumers:** `status`, `report.md` and `compare` show a late figure like any other. `compare` then reports `usage-incomplete` only for steps that never got one.
- **Docs and tests:**
  - `docs/REFERENCE.md`: the "Usage report", "Orchestrator anti-stall" and OpenSpec sections, plus the command list in `AGENTS.md`.
  - The rule-form tests and `skill-loop.test.mjs`.
  - A new test file that drives the command on both chains, including a rollback after the patch, an ended run with `report.md`, and the `--archive` path.
- **ADR:** if one is needed, the next free number. ADR-018 is taken by the in-flight `no-nested-subagents` change.

Runs in parallel with `no-nested-subagents`, which also edits both `## Anti-stall rules` sections and the rule-count tests. Whichever merges second rebases and resolves the conflict.
