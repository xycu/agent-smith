# Documentation Drift Fixes — Plan Brief

[Full implementation plan](plan.md)

## What & Why

Reconcile seven drift findings with code after Waves 1–5. Correct report-location guidance, lock documentation, OpenSpec history and historical ADR pointers. Complete the existing manifest guard with description equality checking.

## Starting Point

The observations date from 2026-11-12. Merged work has since replaced the old PR-comment handoff, aligned manifest descriptions and documented all 17 placeholders plus unknown-name rejection. Those fixes supply the baseline.

## Desired End State

Readers can find an isolated report and PR-comment recovery instructions, see one current lock description, and follow preserved live-run evidence. Historical ADRs carry local amendments. CI's existing version-check command also rejects description drift with an actionable diagnostic.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Merged fixes | Record and verify their current disposition | Wave 6 follows PR-comment and explicit-invocation changes | Task, Waves, code |
| Report location | Explain the run root and archive destination | Default isolation puts run files in a separate worktree | state.mjs, ADR-010 |
| Unknown placeholders | Preserve rejection and explain the internal empty fallback | Validation and rendering have distinct responsibilities | steps.mjs, flow.mjs |
| Historical decisions | Add adjacent amendment notes with actual sources | The request preserves ADR history | change.md, ADRs, changelog |
| Description pair | Compare plugin.description and marketplace.plugins[0].description exactly, requiring nonblank strings | Existing tests identify this pair | skill-loop.test.mjs |
| Releases | Preserve the three release-owned values | release-please owns versions | Repository rules, ADR-008 |
| Phase approval | Use three automated phases under the unattended instruction | Source evidence resolves the required choices | Plan assumption |

## Scope

Edits cover the README report paragraph and flag link, two reference bullets, six ADRs, the prompt-index explanation, the manifest guard and tests, and its existing test-index row. Existing manifest wording supplies the description baseline.

Wave 6 siblings own ID-limit guidance, nesting hardening, prompt dispatch, CI commands and rollback tests. Protected paths include WAVES.md and context/archive/.

## Architecture / Approach

Guidance follows responsible source modules. Historical notes cite superseding ADRs or dated commits. check(root) adds description diagnostics to its existing error array, and the CLI uses its exit-1 path. collect(root) retains three version pairs. CI already invokes the command.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Reconcile current guidance | Report path, PR-comment link, single lock paragraph, OpenSpec history and placeholder explanation | Shared-document regions require localized hunks |
| 2. Amend historical ADRs and repair pointers | Notes and valid documentation destinations in six ADRs | Preserve original decisions and distinguish action emission from posting |
| 3. Enforce description equality | Guard, regression tests, index update and full-suite verification | Existing fixtures require valid descriptions |

Node 24+ and the merged Waves 1–5 baseline are prerequisites. Estimated effort is one small implementation session across three phases.

## Open Risks & Assumptions

- Complexity is medium. The unattended instruction supplies the interview fallback, with evidence-backed choices recorded in the full plan.
- Existing aligned descriptions count as reconciled. Remaining executable work is the standalone guard and focused tests.
- Archived evidence establishes completion on 2026-11-09 with PASS and zero findings. Usage telemetry is partial, and current-host acceptance belongs to its owning changes.
- Concurrent integration must preserve sibling ID-limit and nesting regions.

## Success Criteria (Summary)

- Seven findings have current source-backed dispositions, and edited local links resolve.
- The guard accepts valid equal descriptions and versions, rejects description drift and malformed descriptions, and leaves manifests untouched.
- Focused checks and the full suite pass, preserving ownership, historical text and protected release/archive paths.

## References

- [Seven findings](change.md) and [Wave 6 ownership](../WAVES.md).
- [Existing equality assertion](../../../skills/10x-pipeline/test/skill-loop.test.mjs) and [standalone guard](../../../tools/version-check.mjs).
- [Historical live-run record](../../archive/2026-11-09-openspec-pipeline/plan.md) and [run report](../../../openspec/changes/archive/2026-11-09-openspec-project-rules/agent-smith/report.md).
