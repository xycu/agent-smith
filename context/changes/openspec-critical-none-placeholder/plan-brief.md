# OpenSpec Critical Placeholder Plan Brief

[Full implementation plan](plan.md)

## What & Why

A clean OpenSpec report with `- None` under `## Critical` can send a run into a fix loop. At the loop cap, changing the header as instructed can still leave the run halted if old findings remain in the list. The plan fixes both cases.

## Starting Point

`readVerdict` counts every `- ` bullet in the Critical section and uses the larger of that result and the header count. The same reader feeds both the verification log and routing. [Verdict reader](../../../skills/openspec-pipeline/scripts/openspec.mjs#L98)

## Desired End State

A `PASS` report with a zero critical count and only `- None` routes as successful. A bullet such as `- None of the migrations ran` still counts as a critical finding. New reports keep both headings and write zero item lines for empty lists. A run halted at the fix-loop cap tells the operator to fix the issues, update the header, clear the Critical bullets and rerun.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Placeholder scope | Whole bullets `- None`, `- (none)` and `- N/A`, ignoring case, an optional final period and trailing spaces or tabs | A complete match preserves findings that start with the same words. |
| Count precedence | Use the larger of the header count and the capped list of actual findings | A disputed or stale header cannot clear a real finding. |
| Where to filter | In the shared reader, before sanitization and the prompt cap | Verification and routing agree, and placeholders cannot consume the slots reserved for findings. |
| Report and recovery | Write blank empty lists and include the Critical list edit in the cap halt | Generated files and operator instructions follow the reader's rules. |

## Scope

The phase covers the verdict reader, fix-loop halt, verification prompt, prompt index, routing reference and local regression tests.

## Architecture / Approach

`os-verify` writes `verify.md`. The router uses `readVerdict` to record the review and rereads the file for routing. The filtered findings go to the fix prompt when a real issue needs work. Existing files use the same reader on resume.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Correct OpenSpec verdict handling | A shared placeholder rule, accurate halt guidance and CLI regression coverage | An overly broad match could hide a real finding. |

Node 24 or later and local Git are sufficient for the automated gates. Estimated effort is one small implementation phase.

## Open Risks & Assumptions

- The audit's three spellings define the exemption. Trailing spaces and tabs are treated as formatting, and the matcher inspects raw eligible bullets so sanitization cannot broaden the exemption.
- One phase covers the shared reader and the directly affected writer, documentation and tests.

## Success Criteria

- Focused OpenSpec step and isolation tests pass and cover placeholder acceptance, real findings and fix-cap recovery.
- The full repository test suite passes on Node 24 or later.

## References

- [Audit cases and proposed behavior](change.md)
- [Verification writer guide](../../../skills/openspec-pipeline/prompts/os-verify.md#L14) · [Existing CLI and reader tests](../../../skills/openspec-pipeline/test/openspec-steps.test.mjs#L159)
