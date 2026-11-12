---
change_id: agents-md-slim
title: Slim AGENTS.md to rules and pointers and fix its stale statements
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

`AGENTS.md` is 31,875 bytes, and every agent session in this repository loads all of it. Its `## Project Structure` section (lines 14 to 59) is 20,389 bytes, 64% of the file: a catalog with one long bullet per test file, prompt file, script and decision record. The rules an agent must not break (`## Hard Rules`) are 8% of the file.

- The catalog is in order of addition, not by topic: prompt bullets sit between test bullets, and script bullets are spread over the section.
- It is already incomplete, so it cannot be relied on as an index: `skills/10x-pipeline/test/at-or-above.test.mjs` is not named, and `prompts/README.md` covers prompt files that `AGENTS.md` leaves out.
- It repeats itself: the test command is given twice, the rule about hidden release sections twice, and the ADR bullet is one line of about 2,700 bytes (its ADR-019 sentence is duplicated; see `agents-md-duplicate-adr019`).

Some statements are no longer true:

- Releases: "The version is `0.x` (SemVer initial development). To release `1.0.0`, put a `Release-As: 1.0.0` footer on a commit." The version is 1.5.0. The same section says "the first release PR confirms it" about a check that has long been confirmed or refuted.
- Testing: "Then run `init` and `status` against a scratch change folder and confirm the JSON output is valid." With the shipped `isolation.require: true`, `init` in a scratch folder without git halts, and a halt is valid JSON. The check passes while no routing code ran.
- Commands: `status` is listed without `--report`, which rewrites `report.md`; `pr-comment.mjs` is listed without `--timeout-ms`.

### Fix direction

- Keep in `AGENTS.md`, in this order: Hard Rules; the test command once, with the smoke check; Commits; Coding Style; a layout of ten to twelve lines, one per directory, each pointing at its index file; a short Releases section. Target size: about 8 KB.
- Move the test bullets to a new `skills/10x-pipeline/test/README.md`, and the one-line ADR summaries to a new `docs/ADR/README.md`. Delete the prompt bullets; `skills/10x-pipeline/prompts/README.md` is their index. Keep the import-order rule of the router modules as one sentence, and move the export lists to `docs/REFERENCE.md` or drop them.
- Reduce Commands to one line per command; the flags are in `docs/REFERENCE.md`.
- Fix the three stale statements. The smoke check names the override it needs (`{ "isolation": { "require": false } }`) and says that success means `init` returns a step.
- No `@` imports (`tools/test/agents-md-no-imports.test.mjs`). These tests read `AGENTS.md` and pin text in it: `advisor.test.mjs`, `no-recursive-delete.test.mjs` (the delete rule and `removeTree`), `pr-comment.test.mjs` (the script in Hard Rules and Commands). Keep what they pin, or move the pin with the text.

### Tests

- The full suite, with the three tests above still green.
- A size check is optional; if added, put it in `tools/test/` with a limit that leaves room (for example 12 KB).

### Done when

`AGENTS.md` holds the rules, the commands an agent needs for every change and pointers to the indexes, and no statement in it contradicts the repository.
