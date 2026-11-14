# Recursive-delete guard gaps — Plan Brief

Full plan at [plan.md](plan.md).

## What & Why

The recursive-delete guard misses shell commands in JavaScript, split shell flags, and unsafe filesystem options. Extend its scanner and discovery so these forms fail the existing test gate, including workflow YAML and shell files under `.github/`.

## Starting Point

One test file owns the scanner, regression cases, repository walk, and rule-placement checks. An in-memory probe reproduced all eight missed examples in the brief while the three existing guard tests passed on Node v26.13.1.

## Desired End State

Every brief example produces a diagnostic. Nonrecursive deletion, recursive creation and copying, and explanatory ban text continue to pass. Fixture tests demonstrate that `.github` YAML and shell files enter the same discovery and dispatch path used for the repository scan.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Implementation ownership | Existing `no-recursive-delete.test.mjs` | Wave 5 assigns the complete guard to this file. | WAVES.md and plan |
| Shell checks | Extend and share the current pattern mechanism | Source strings and argument arrays need the same recursive-flag coverage as prose. | Change brief and scanner |
| Filesystem options | Accept absent options or transparent literal objects without recursion | Variables, spreads, shorthand, and opaque keys cannot establish safe options. | Change brief |
| Recursive property values | Reject a recursive key even when false | The brief requires the key to be absent in every spelling. | Change brief |
| Discovery proof | Scratch YAML and shell fixtures plus real repository scan | String-only tests cannot establish file-discovery coverage. | Plan |
| Delivery structure | One phase with five Automated rows | The scanner and its checks share one owner and one entry point. | Plan assumption |

## Scope

The implementation belongs in `skills/10x-pipeline/test/no-recursive-delete.test.mjs`. Planning artifacts and the lifecycle update belong in this change folder. Wave ownership and archive protection govern execution.

## Architecture / Approach

Retain the scanner's diagnostic-array interfaces. Extend shell matching for JavaScript and split flags, inspect filesystem options structurally and conservatively, and add `.github`, `.yml`, `.yaml`, and `.sh` to discovery. Reuse the existing scratch and safe cleanup helpers for fixtures.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Close scanner gaps and prove coverage | Shell and filesystem regressions, scanner fixes, discovery fixtures, and repository verification | Overbroad detection could reject permitted operations or quoted rule explanations. |

Implementation requires Node 24 or later and the Wave 5 worktree baseline.
Estimated effort is one focused implementation and verification pass in the existing test file.

## Open Risks & Assumptions

- The unattended instruction delegates interview and phase decisions to researched evidence. The brief and ownership table support one phase and a conservative options policy.
- Structural scanning must account for quoted delimiters and nested expressions when identifying the second argument.
- Static source scanning has limits for arbitrary runtime-generated commands and aliases.
- Historical ADR-016 exclusions for options variables and workflow coverage are superseded by this change brief.

## Success Criteria (Summary)

- All missed shell and filesystem examples are covered, with permitted forms retained.
- Discovery fixtures and the real repository scan pass, followed by the focused file and full suite on Node 24 or later.
- The implementation respects the single-file Wave 5 ownership boundary.

## References

- [Change brief](change.md).
- [Wave ownership](../WAVES.md).
- [Scanner and tests](../../../skills/10x-pipeline/test/no-recursive-delete.test.mjs).
