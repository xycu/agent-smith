# Brief: one `atOrAbove` helper

Full plan: [plan.md](plan.md)

## Problem

The rigor gate rule (known level, known `minRigor`, level >= `minRigor`) is spelled out seven times in `steps.mjs` and `preplan.mjs` (issue #97). A rule change needs seven edits.

## Starting Point

`state.mjs` holds `rigorLevels` and `maxLevel`. Seven sites repeat three `indexOf` calls. The suite passes and covers the sites through the CLI, not the rule itself.

## Key Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where | `atOrAbove(policy, level, minRigor)` in `state.mjs` | Signature from the issue; both modules already import `state.mjs` |
| Unknown level or `minRigor` | Closed (false) | Same as today |
| Docs / ADR | None | No behavior change |
| Tests | New `at-or-above.test.mjs` | Nothing pins the rule directly |

## Phases

| # | Phase | Result |
| --- | --- | --- |
| 1 | Helper plus seven replacements | One definition, seven call sites, suite green |
| 2 | Helper unit test | Rule pinned |

Prerequisites: none. Estimated effort: small, under an hour.

## Not Doing

Policy, prompt, SKILL.md, REFERENCE.md or AGENTS.md edits; touching `maxLevel`.
