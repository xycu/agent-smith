---
change_id: array-prompt-override
title: "An array-form archive prompt or suffix override breaks the run"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #89.

## What this is

Every prompt template of the policy may be a string or an array of strings, with `@prompts/<file>.md` references. `promptText` resolves both forms.

## Problem

Two places skip `promptText`:

- `skills/10x-pipeline/scripts/isolation.mjs:680`: `render(policy.prompts.archive, { id })`
- `skills/10x-pipeline/scripts/route.mjs:180` and `isolation.mjs:681`: `policy.prompts.suffix` is appended as it is

`checkPrompts` accepts an array for both keys, so nothing warns earlier.

## Reproduce

- Override `{ "prompts": { "archive": ["Run /10x-archive {id}", "- extra rule"] } }` and finish a run started with `--archive`. The router makes the pre-archive commit and then prints `Router error: tpl.replace is not a function`. `next` prints the same error again on every resume.
- Override `{ "prompts": { "suffix": ["line one", "line two"] } }`. Every prompt ends with `line one,line two`.

## Fix

Use `promptText(policy, "archive")` and `promptText(policy, "suffix")` in those places.

## If we skip it

A legal override leaves a committed but never archived change, or a mangled suffix in every step prompt. The comment above the commit says a bad policy "never throws after the commit exists"; this one does.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
