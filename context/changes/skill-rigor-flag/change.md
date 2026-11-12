---
change_id: skill-rigor-flag
title: Parse --rigor in both skills as the README offers it
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low.

### Problem

`README.md:65` offers the option `--rigor lean|standard|thorough`, and the router reads it (`INIT_FLAGS` in `skills/10x-pipeline/scripts/route.mjs:824`). Neither skill parses it.

- `argument-hint` of `skills/10x-pipeline/SKILL.md` is `<change-id> [goal text] [--archive] [--chrome false] [--pr-comment]`; that of `skills/openspec-pipeline/SKILL.md` is `<change-name> [goal text] [--archive] [--pr-comment]`.
- Start step 1 of both skills parses and removes only `--archive`, `--chrome` (10x) and `--pr-comment`.
- Start step 4 says: "Add `--rigor <level>` only when the user named a rigor level".

So a user who types `--rigor thorough` depends on the orchestrator reading the flag as "the user named a level", and the words `--rigor thorough` stay in the goal text that goes to `init --goal` and into every step prompt. The goal text also feeds the goal classification (length and keywords).

### Fix direction

- Add `[--rigor <level>]` to `argument-hint` of both skills.
- Start step 1 of both skills: parse `--rigor` with its value, remove both from the goal text, and pass them to `init` only when the user gave them. Keep the rule that the orchestrator never picks a level itself. A level named in plain words ("run it thorough") stays covered by step 4.
- `docs/REFERENCE.md`: the headings of both skill sections list the arguments; add the flag there.

### Tests

- Content checks in `skill-loop.test.mjs` and `openspec-skill.test.mjs`: the hint and step 1 name `--rigor`.

### Done when

`/agent-smith:10x-pipeline <id> <goal> --rigor thorough` starts a `thorough` run whose stored goal does not contain the flag.
