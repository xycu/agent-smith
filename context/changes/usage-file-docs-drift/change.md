---
change_id: usage-file-docs-drift
title: Document --usage-file in the router usage text and AGENTS.md
status: planned
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Review of the past week's changes on 2026-11-19. PR #215 (1.14.0) added `usage <id> <n> --usage-file <path>` and left three usage texts on the old form.

**The drift.** `usageCommand` in `skills/10x-pipeline/scripts/route.mjs` accepts `--usage-file` (line 797 onward), and the header comment at line 14 documents it: `usage <change-id> <n> (--usage-file <path> | --tokens N [--tool-uses N] [--duration-ms N])`. These places still show only the numeric flags:

- `route.mjs:794`, the usage message of the `usage` command;
- `route.mjs:970`, the top-level usage message of `main()`;
- `AGENTS.md:26`, the `usage` row under Commands.

**Why it matters.** Once a step has recorded an evidence contract, the numeric form is refused: `route.mjs:864` answers `A recorded evidence contract requires --usage-file.` Since 1.14.0 every Claude step and every Codex step records `usageEvidence`, so the form the usage text advertises is the one that fails. An orchestrator or a person who follows the printed usage gets a refusal and no hint in the usage line itself.

**The change.**
- Make both usage messages in `route.mjs` match the header comment at line 14.
- Update the `usage` row in `AGENTS.md` to show both forms and say in a few words when each applies (numeric flags only for a step with no recorded evidence).
- Check `docs/REFERENCE.md` and `skills/openspec-pipeline/SKILL.md` for the same old form and align them.

**Constraints.**
- Text only; no behavior change in `usageCommand`.
- `AGENTS.md` stays short: one row, no new section.
- Tests that pin the usage strings change with them and keep their meaning.

**Done when.**
- No usage text for the `usage` command omits `--usage-file`.
- A test asserts that the usage message of the `usage` command names `--usage-file`.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
