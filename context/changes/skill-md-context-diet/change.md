---
change_id: skill-md-context-diet
title: Cut the orchestrator skill text that the orchestrator never acts on
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

`skills/10x-pipeline/SKILL.md` is 41,727 bytes in 171 lines (about 6,700 words). It is loaded whole into the orchestrator's context and stays there for a run of up to 24 steps. A good part of it cannot change what the orchestrator does.

- Lines 128 to 171, `## Tuning` with "How the tier moves", are 13,660 bytes, a third of the file. They describe routing internals, while the Rules section of the same file forbids the orchestrator to choose a model, an effort or a step. The same rules are in `docs/REFERENCE.md`. `AGENTS.md` obliges every tier change to update both places.
- The OpenSpec skill shows the target: its `## Tuning` is five lines that point to `policy.json` and `docs/REFERENCE.md`.
- The late-usage paragraph ("for each step whose usage figure arrived after `next` ran for it ...") is written out three times, in `done`, `archive` and `halt`. The TaskList and PR comment paragraph is written out in the same three branches. The OpenSpec skill repeats both the same way.
- Single paragraphs run to 1,500 and 3,000 characters and mix the rule with its reason, so a rule in the middle is easy to miss, more so after a context compaction.

### Fix direction

- Move "How the tier moves" into `docs/REFERENCE.md` (merge it with the routing bullets that are already there) and keep in the 10x skill the short Tuning section of the OpenSpec skill.
- Update `AGENTS.md`: the first hard rule ("`SKILL.md` must not name models, effort levels or tiers beyond what it already documents") becomes "names none", and the Coding Style bullet points to `docs/REFERENCE.md` only.
- Add one section `## Late usage (before every end)` to each skill and refer to it from `done`, `archive` and `halt`, the way `## Pull request (always)` is referred to. Keep the one sentence per branch that differs (the cut-off in `archive`).
- Do the same for the PR comment trigger, or let `pr-comment-flag-in-meta` remove it.
- Do not change the wording of the anti-stall rules; the two sections must stay equal.

### Tests

These tests pin skill text and need their expectations moved, not weakened: `skill-loop.test.mjs`, `openspec-skill.test.mjs`, `late-usage.test.mjs` (the call places in the three branches), `archive-gate.test.mjs`, `nested-subagents.test.mjs`, `rules.test.mjs`. Add one check that the 10x skill names no ladder model and no tier number.

### Done when

The 10x skill holds no routing internals, each repeated paragraph exists once per skill, and the file is at most about 26 KB with the full suite green.
