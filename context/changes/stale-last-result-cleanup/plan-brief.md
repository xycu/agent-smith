# Stale last-result cleanup — Plan Brief

> Full plan: `context/changes/stale-last-result-cleanup/plan.md`

## What & Why

A crash after persisting a step result can leave `last-result.json` behind. The next step can then consume the previous step's status, note, signals and usage. Put cleanup in shared result intake so recovery cannot advance with that stale file.

## Starting Point

Atomic log publication already prevents partial log writes, and intake persists before deleting the result. Recovery skips deletion for completed inline entries; file prompts happen to clean results through their handoff marker. Planning reproduced stale note and token attribution on both chains by exiting immediately after the real log rename.

## Desired End State

A completed latest executed entry owns any leftover result, which disappears before routing, commits or rollback snapshots. A pending entry still consumes its own file once. Filesystem cleanup failures halt safely and remain recoverable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Owner | Extend `attachResult` in `flow.mjs` | Both chains and resume paths already use it | Code research |
| Recovery marker | Existing latest executed entry's result | A new dispatch is logged before being returned | Code research |
| Timestamp checks | None | Output freshness does not prove result ownership | Code research |
| Prompt cleanup | Remove its result unlink; retain task marker lifecycle | One owner for result cleanup, same file-mode recovery | Code research |
| Publication | Preserve atomic write before unlink | Failed publication must retain pending input | change.md / current architecture |
| Late usage and neutral retries | Preserve existing command boundaries | Usage may arrive while a later step has a real result | Code research |

## Scope

**In scope:** shared router cleanup, regression tests for both chains and transports, real isolated Git proof, late usage and neutral compatibility, routing reference and test-index updates.

**Out of scope:** protocol/schema additions, new dependencies, lock redesign, historical misattribution repair, live model runs, `WAVES.md`, archives and version changes.

## Architecture / Approach

Under the existing run lock and guards, neutral retry stays first. Shared intake persists a new result or recognizes existing completion, then unlinks the result, tolerating only ENOENT. Handoff cleanup follows, then Git and routing. Cleanup failure stops advancement. No changes to `usageCommand`, policies or skill loops are expected.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared result ownership and crash recovery | Shared cleanup with deterministic both-chain/transport crash proof | Deleting input before persistence or weakening handoff recovery |
| 2. Compatibility, isolation and routing documentation | Git, neutral and usage proof; reference updates; full test gate | Pending result loss or stale result entering a commit |

**Prerequisites:** Node 24+, Git for isolated fixtures, existing atomic writer and test helpers.
**Estimated effort:** One focused implementation session plus regression and full-suite runtime; two sequential phases.

## Open Risks & Assumptions

- Unattended planning uses the user's delegated decision rule; no unresolved product decisions remain.
- The sequential producer contract remains: a future dispatched step has a pending log entry; unsolicited concurrent writes are outside this fix.
- Existing misattribution after a prior bad advance cannot be safely inferred from an untagged pending file.
- Atomic rename does not add a power-loss durability guarantee. Non-ENOENT unlink errors halt for repair.
- Planning reproduced non-isolated failure on both chains. Implementation, isolated regressions and the full suite remain unexecuted.

## Success Criteria (Summary)

- Inline crash regressions fail before the fix and pass afterward on both chains. File-prompt recovery stays green before and after the change. Every case removes stale input and requires the next step to supply its own result.
- Normal intake, neutral replay, late usage and isolated recovery retain their current contracts.
- Seven unchecked automated Progress rows cover both phases; required repository tests and documentation checks pass before completion.

## References

- `context/changes/stale-last-result-cleanup/change.md`
- `skills/10x-pipeline/scripts/flow.mjs:544`, `skills/10x-pipeline/scripts/route.mjs:82`
- `skills/10x-pipeline/test/result-persist.test.mjs`, `skills/10x-pipeline/test/run-state.test.mjs`
- `docs/REFERENCE.md`, `context/foundation/lessons.md`
