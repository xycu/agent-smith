# Sol and Astra 6.2 — Plan Brief

> Full plan: [plan.md](plan.md)
> Research: [research.md](research.md)

## What & Why

Update the opt-in OpenAI ladder to `gpt-6.2-sol` and `gpt-6.2-astra` so new dispatches select the newly released versions. Update this repository's copied override at the same time and explain adoption for existing users.

## Starting Point

The preset and local override currently use `gpt-6.1-sol` at tiers 1–3 and `gpt-6-astra` at tiers 4–7. An existing test pins these identifiers; the shared router and Codex runner already accept and forward arbitrary model strings.

## Desired End State

Both ladders use Sol 6.2 at `low`, `medium`, `high` and Astra 6.2 at `medium`, `high`, `xhigh`, `max`. Tier 0 stays `gpt-6-luna`/`low`; all providers, eight tier positions and unrelated settings stay unchanged. Users adopt by explicitly merging the preset, and prior run records keep their original identities.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Update both policy files and the existing assertion. | The local override is an independent copy used by this repository. | Research + Plan |
| Efforts | Preserve every effort and tier; add no Ultra rung. | Existing tests protect positions; Codex 0.169.0 capability metadata advertises all required efforts. | Research + Plan |
| Adoption | Explicit merge with a reference upgrade note. | Arrays replace whole and unrelated user keys must survive. | README + Plan |
| State | Preserve history and stored pending targets. | The router owns state and provenance; no schema change is needed. | Research + existing tests |
| Verification | Local deterministic checks plus separate Manual live verification. | Advertised support and fake execution do not prove account-specific live success. | Plan |
| Delivery | One implementation phase; no new dependencies or scripts. | This is a literal policy migration with existing regression coverage. | Plan |

## Scope

**In scope:** the shipped GPT preset, this repository's override, the exact model assertion in `providers.test.mjs`, and upgrade guidance in `docs/REFERENCE.md`.

**Out of scope:** router changes, other models, effort retuning, pricing, benchmarks, automatic user-config migration, archives, state rewrites, release-version changes and publication by a step subagent.

## Architecture / Approach

Keep model selection in existing policy data. Change seven model values in each policy, update the existing test expectation, and reuse the provider/runner/provenance tests. Add guidance for explicit adoption, mixed old/new runs and rollback. Default pinned comparisons allow ladder differences between runs; mid-run drift is a separate reported signal.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Update the OpenAI preset and its consumer | Two synchronized ladders, updated assertion, upgrade note and local verification. | Actual client/account execution still needs live evidence. |

**Prerequisites:** Node 24+, Git and the existing test fixtures for Automated checks; trusted Codex configuration and authenticated access for Manual live verification.

**Estimated effort:** one small implementation session plus full-suite runtime; live verification depends on account access.

## Open Risks & Assumptions

- The owner delegated planning decisions for an unattended run. Research and existing conventions support updating both copies, retaining all efforts and adding an upgrade note.
- The local capability cache fetched `2026-11-18T00:09:05.623083Z` for client `0.169.0` advertises all required efforts for both 6.2 models. It proves advertised capability only; planning made no live model calls.
- Old overrides and pending actions may continue selecting old versions. Adoption is deliberate; no history is rewritten. Rollback restores the prior values with a forward edit and depends on old-model availability.
- No measured quality, cost or latency equivalence is claimed. Manual rows stay pending until their own evidence exists.

## Success Criteria (Summary)

- **Automated:** assert the exact target table, equal ladders and only fourteen intended policy substitutions; pass the repository-required full Node test suite and `git diff --check`.
- **Manual:** review the adoption/drift/rollback guidance and verify all seven changed model/effort pairs on an exact recorded Codex configuration.
- Local checks require no pushed branch, PR, remote CI or external comment; the orchestrator owns publication.

## References

- [Research and source anchors](research.md), [complete plan and Progress](plan.md), and [change request](change.md).
- [OpenAI model documentation](https://learn.chatgpt.com/docs/models), checked 2026-11-18.
- `README.md:42`, `docs/REFERENCE.md:454`, and `skills/10x-pipeline/test/providers.test.mjs:34`.
