# Step prompt handoff by file — Plan Brief

> Full plan: [plan.md](plan.md)
> Task: [change.md](change.md)

## What & Why

Add an opt-in policy that lets the router hand a step its complete task through a file. The orchestrator forwards a short instruction instead of transcribing several kilobytes. The full task and RESULT contract stay exact.

## Starting Point

The router already stores the full pending prompt for neutral retries. Claude receives it through Agent; the shared Codex runner validates it against pending state before passing it to a CLI child. Current isolated task samples range from 4,910 to 13,210 bytes. These are bytes, not tokens.

## Desired End State

With `prompts.byFile: true`, numbered steps receive a short prompt naming a router-owned file. The router manages publication, retries and cleanup before its commits; both archive actions stay inline. The shipped default remains false while live benefit and quality evidence are unavailable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Configuration | Strict boolean `prompts.byFile`, default false | Preserve existing behavior and reject mistakes before writes | Task; ADR-022 |
| Task authority | Full `pendingPrompt` plus a stored compact handoff | Replay remains exact after policy changes | Plan; ADR-015/024 |
| File location | Fixed `agent-smith/prompt.md` in the selected change | Reuse sequential run ownership and avoid new configuration | Task; current router |
| Provider path | Both providers receive the compact prompt | One transport contract; Codex still verifies exact file/task identity | Plan; current runner |
| Cleanup | Persist result, remove file, prune cleanup marker, then commit | Avoid lost results and stale task files in router commits | Plan; current intake |
| Provenance | Hash actual templates, exclude only the new option | Transport does not masquerade as changed task content | Task; current hash code |
| Size target | Measure whole actions near 1 KB; report path overhead | A representative design estimate is 1,036 bytes at this root | Planning measurement |
| Default decision | Keep false; document missing live evidence | Compare excludes orchestrator tokens and cannot prove quality by itself | Task; ADR-005 |

## Scope

**In scope:** shared transport/lifecycle code, narrowly necessary policy/hash/runner integration, both Loop step 2 sections, focused reference text, regression tests and a comparison record.

**Out of scope:** routing changes, new dependencies, CLI transport flags, archive file handoffs, compare redesign, WAVES/archive edits, CI and sibling Wave 6 regions.

## Architecture / Approach

Render once using the existing rules and templates. Store the full task and exact compact descriptor, atomically publish the file, and forward the descriptor unchanged. Codex validates the descriptor and file against pending state before launching. On consumption, durable result intake and recoverable cleanup precede commits; neutral retries restore the original file without new attempts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Complete transport boundary | Policy, dispatch, lifecycle, runner validation and tests | Losing retry identity or committing a transient file |
| 2. Dispatch guidance | Both skill loops and focused reference updates | Orchestrator expanding the file or changing usage behavior |
| 3. Measurements and decision | Actual output sizes, comparison evidence and default rationale | Mistaking byte savings or fake-provider tests for live benefit |

**Prerequisites:** Node 24+, current layered-rules/provider architecture, existing test helpers and isolated Git fixtures. Live acceptance additionally needs top-level Claude/OpenAI hosts and matched independent runs.

**Estimated effort:** Three implementation phases; the first carries most engineering work. Live comparison time depends on available representative changes and host telemetry.

## Open Risks & Assumptions

- Unattended instructions authorize evidence-based planning decisions; no interview approval or live model experiment occurred.
- Necessary runner/validation/hash edits map the Wave 6 prompt behavior to current modules. Actual sibling overlap must be reported for scheduling.
- No file-handoff records or matched live pairs are available. Default false is the evidence-backed decision; live acceptance stays pending.
- A 1,280-byte representative ceiling expresses “about 1 KB”; longer paths/reasons are measured separately without truncating contracts.
- Cleanup protects consumed tasks; it cannot undo an improper earlier child commit, and pending tasks retained after a missing-result halt may enter the existing final-PR commit.

## Success Criteria (Summary)

- Inline compatibility, exact file/task/RESULT contracts, neutral replay and cleanup are proved for both chains and provider paths.
- The required Node suite passes; the complete action payload is measured, with provenance and runner safeguards preserved.
- Evidence distinguishes bytes, child usage, orchestrator telemetry and live quality; missing evidence leaves the default false and Manual rows unticked.

## References

See the full plan's source anchors and test matrix, [Wave 6 ownership](../WAVES.md), and ADR-005, ADR-015 and ADR-024 in `docs/ADR/`.
