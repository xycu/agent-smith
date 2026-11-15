# Workflow Pin Guard: Referenced Local Actions — Plan Brief

> Full plan: `context/changes/workflow-pins-local-actions/plan.md`

## What & Why

The pin guard currently ignores local references before it can inspect their dependencies. A composite action outside `.github/` can therefore hide an unpinned remote. Follow referenced local metadata recursively and fail when referenced metadata is missing.

## Starting Point

One dependency-free module scans YAML under `.github/` and root action metadata. Its seven tests pass, but worktree-local probes confirmed that a nested unpinned remote and a missing target both incorrectly return no errors.

## Desired End State

`check(root)` validates every remote in the seed files and reachable local actions. Bad remotes identify their own file and line; missing local metadata identifies the referring file and line. Repeated references and cycles scan each physical file once.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Ownership | Extend `check` and expose local edges in `findUses` | Existing module owns discovery and diagnostics; no second scanner is needed. | Code and change.md |
| Discovery | Existing seeds plus referenced local metadata | Closes the gap without scanning unrelated directories. | change.md |
| Resolution | Relative to the checked root, including nested edges | Matches the explicit fix direction. | change.md |
| Metadata names | Inspect both existing spellings; reject missing/non-file targets | Preserves the current conservative seed behavior. | Code; plan assumption |
| Termination | Worklist with canonical visited file identities and root containment | Cycles and aliases cannot cause repeated scanning or escape the checked root. | User requirement; plan assumption |
| Local workflows | Preserve conventional `.github/workflows/*.yml` and `.yaml` file references | Those files are already seed inputs; do not misclassify them as action directories. | Code; plan assumption |
| Pin rules | Preserve remote regex, Docker exemption, and no-remote failure | This change extends coverage without weakening existing checks. | Existing tests and code |
| Delivery | One phase; no human gate | All acceptance behavior is deterministically testable. | Scope and unattended instructions |

## Scope

**In scope:** `tools/workflow-pins.mjs`, its existing test module, and only the workflow-pins description in the AGENTS Layout entry; planning/lifecycle artifacts in this change folder.

**Out of scope:** YAML dependencies, action execution, remote downloads, unrelated directories, new configuration or CLI, skills, CI edits, WAVES, archives, router-owned state, and the parallel commit-lint change.

## Architecture / Approach

Keep the current sorted seed inventory. Return local references with their source locations from the existing scanner, resolve their metadata against the checked root, and add unseen files to the same checking worklist. Preserve raw remote values for validation. Reject unsupported local syntax, missing metadata, and root escapes with actionable diagnostics.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Follow Local References and Prove the Guard | Traversal, focused regression tests, scoped guidance, and full-suite verification | Local parsing or deduplication could hide a remote or break reusable workflows. |

**Prerequisites:** Node 24+, current run worktree, existing test fixtures and cleanup helper; full-suite environment prerequisites already required by the repository.
**Estimated effort:** One small implementation phase plus the required repository suite.

## Open Risks & Assumptions

- The scanner remains deliberately strict about YAML; this does not introduce general YAML support.
- Missing local metadata now fails intentionally. Local-only graphs still fail the existing no-remote check.
- Inspect both metadata spellings and preserve local reusable workflows, based on current seed behavior.
- Keep traversal within the canonical root and deduplicate aliases; test cycles with a bounded subprocess timeout.
- No unresolved decision requires a human. No matching roadmap item exists; leave the roadmap unchanged.

## Success Criteria (Summary)

- Nested unpinned remotes and missing targets fail with useful file/line diagnostics; pinned nested actions pass.
- Duplicate references, cycles, metadata variants, containment, reusable workflows, and existing strictness rules have regression coverage.
- Focused and required full suites pass; the diff respects Wave 7 ownership and the AGENTS region restriction.

## References

- `context/changes/workflow-pins-local-actions/change.md` and `context/changes/WAVES.md`, Wave 7.
- `tools/workflow-pins.mjs`, `tools/test/workflow-pins.test.mjs`, and the AGENTS Layout entry.
- Full plan: implementation contracts, test matrix, assumptions, and five pending Progress rows.
