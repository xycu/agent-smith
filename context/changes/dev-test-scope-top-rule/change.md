---
change_id: dev-test-scope-top-rule
title: Add a top-level rule that testing scope during development stays minimal
status: impl_reviewed
created: 2026-11-22
updated: 2026-11-24
archived_at: null
---

## Notes

Owner decision of 2026-11-22: during development a step runs only the test files that cover the files it changed. CI runs the full suite and is the gate. A full-suite run in a step's dev loop is a defect.

Add this as a hard rule in `skills/10x-pipeline/rules/top.md` (the always-true rules of every step, ADR-023, in `GIVEN/WHEN/THEN ... MUST` form) and, if the OpenSpec chain needs its own copy, in `skills/openspec-pipeline/rules/chain.md`. The rule has to win over a skill or a plan row that asks for the full suite, because the always-true heading beats the rest of a prompt.

Why a rule and not only prompt text: Wave 4 sessions kept running the whole suite, 3 in parallel on one machine, and each router-owned or skill step still asks for it:

- `prompts/impl-review-apply.md` and the `fix` prompt in `policy.json` ("run the plan's automated success criteria and the test suite"). PR #265 already narrows both and `AGENTS.md`; this change must not redo that, only build on it.
- The `/10x-goal-implement` skill gate (c) ("full test suite, lint, typecheck") and the `/10x-implement` repo-wide checks, both outside this repository.
- Plan rows that name the full command or "The required Node test suite passes" (for example row 2.3 of a Wave 4 plan).

Open points for the frame or plan:

- What the rule says about a pre-handoff check: one full run is allowed only when the user asks or to reproduce a CI failure, as `AGENTS.md` now says.
- Size-limit and guard tests that must still run when their file is touched (`tools/test/agents-md-size.test.mjs`, `skill-loop.test.mjs`): the rule should name touched-file tests, not forbid them.
- Rule tests: `rules.test.mjs` and the README row in `skills/10x-pipeline/rules/README.md` need the new rule.
- Keep `SKILL.md` text out of this change, or raise the `skill-loop.test.mjs` ceiling in the same commit.
