---
change_id: run-state-atomic-writes
title: Write run.jsonl and meta.json atomically and stop dropping unreadable log lines
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

The run state is rewritten in place. `writeLog` (`skills/10x-pipeline/scripts/state.mjs:427`) and every `meta.json` write (`flow.mjs:290`, `flow.mjs:353`, `isolation.mjs:446`, `isolation.mjs:500`, `route.mjs:104`, `route.mjs:177`, `route.mjs:930`) call `fs.writeFileSync` on the live file, which truncates it and then writes. A router process that dies in between (the Bash tool timeout of `router-bash-timeout`, an interrupt, a full disk) leaves a short or empty file.

`readLog` (`state.mjs:405`) then skips every line that does not parse and says nothing. The next `writeLog` makes the loss permanent. The run lock (`run-state-lock`) stops two writers; it does not help a writer that dies.

### Reproduction (verified)

Scratch project, `isolation.require: false`:

1. `init x`, write a `failed` result, `next x`. `run.jsonl` has two lines.
2. Cut the last 40 bytes of `run.jsonl`.
3. `status x` lists one step and reports no problem.
4. `init x` returns step 2 again and rewrites the log: the cut entry is gone, with no warning anywhere.

With an empty `run.jsonl` the run starts again at step 1, with a fresh step budget and fresh attempt counts, on top of the work already on disk.

### Fix direction

- `writeFileAtomic(file, text)` in `state.mjs`: write `<file>.<pid>.tmp` in the same directory, then `fs.renameSync` over the target, and unlink the temp file on failure. Use it for `run.jsonl`, `meta.json` and `report.md`.
- A temp file left by a killed process must not reach a step commit (`git add -A`): remove stale `*.tmp` files of the run folder when the run lock is taken, and keep the name pattern in one constant.
- `readLog` in the writing commands (`init`, `next`, `usage`): a non-empty line that does not parse halts with the file and the line number, and writes nothing. The read-only commands (`status`, `risk`, `compare`, `verify-archive`) keep reading the good lines and add a `logProblems` field.
- The halt text tells the human what to do: restore the line from the last step commit on the run branch (`git show <sha>:<path>`), since every step commit holds the log.

### Tests

- A truncated last line and a truncated middle line: `next` halts, the file is unchanged, `status` reports the line.
- A crash between temp write and rename (simulate by leaving a `.tmp` file): the next call removes it and the step commit does not hold it.
- `late-usage.test.mjs` byte-identity cases still pass, since `usage` restores bytes on a failed commit.

### Done when

A router process killed at any point leaves either the old or the new content of each state file, and a damaged log line stops the run with a message instead of being dropped.
