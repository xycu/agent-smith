---
change_id: delete-guard-gaps
title: Close the gaps of the recursive delete guard
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: medium. No violation exists in the repository today; the guard is what ADR-016 relies on when a step subagent writes code.

### Problem

`skills/10x-pipeline/test/no-recursive-delete.test.mjs` scans code files for a delete call with the literal `recursive: true` and prose files for `rm` with a recursive flag. Several forms pass.

Probed with the guard's own regexes (`:144-147`):

| Text in a `.mjs` file | Result |
| --- | --- |
| `execSync("rm -rf " + dir)` | not found |
| `spawnSync("rm", ["-rf", dir])` | not found |
| `fs.rmSync(dir, opts)` | not found |
| `fs.rmSync(dir, { recursive, force: true })` | not found |
| `fs.rmSync(dir, { "recursive": true })` | not found |
| `fs.rmSync(dir, { recursive: !0 })` | not found |

| Text in a prose file | Result |
| --- | --- |
| `rm -f -r build` | not found |
| `rm -f --recursive build` | not found |
| `rm -fr build` | found |

Causes: code files get only `scanCode` (`:236`), so a shell command inside a string is never checked; `RECURSIVE_TRUE` needs the exact text `recursive: true`; `PROSE_BANNED` looks only at the first flag after `rm`. Also not scanned: `.github/` (`SCAN_DIRS` at `:140`) and files ending in `.yml`, `.yaml` or `.sh` (`:192`), where a workflow step or a script could hold the command.

### Fix direction

- Run the shell patterns over code files as well (string contents included), and extend them to the argument-array form (`"rm"` followed by an array that holds a flag with `r` or `R`).
- Accept a recursive flag anywhere among the flags of `rm`, not only first.
- Fail closed on the options argument: a call of `rm`, `rmSync` or `rmdir` with a second argument passes only when that argument is an object literal with no `recursive` key in any spelling. A variable, a spread or a shorthand key is reported.
- Add `.github` to `SCAN_DIRS` and `yml|yaml|sh` to the extensions (prose rules for those).
- Keep the allowance for lines that state the ban.

### Tests

- Each row of the two tables above as a case in the test "the scanner catches every banned form and lets creation through", plus `fs.rmSync(file, { force: true })` and `fs.rmdirSync(d)` still passing.
- The repository scan stays green.

### Done when

Every form in the tables is reported, and a workflow file with `rm -rf` fails the suite.
