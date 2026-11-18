# Sol and Astra 6.2 Implementation Plan

## Overview

Update the opt-in OpenAI ladder from `gpt-6.1-sol` to `gpt-6.2-sol` and from `gpt-6-astra` to `gpt-6.2-astra`. Update this repository's copied override in the same change, retain every tier and effort, and explain deliberate adoption and in-flight provenance behavior.

Complexity: **LOW**. This is a policy-data migration with an existing exact-value regression test, not a router or state-schema change. One phase keeps the preset, local consumer, assertion and upgrade guidance consistent. Planning is unattended by explicit instruction; the evidence-backed decisions below replace the skill's interview and approval rounds.

## Current State Analysis

The upstream [research](research.md) was read fully. A fresh search confirms three active files contain the old model identifiers: the preset, this repository's override and the provider test. The router already accepts arbitrary nonempty model identifiers and passes the selected model and effort to Codex.

| Surface | Readers / writers and ownership | Compatibility obligation |
| --- | --- | --- |
| `skills/10x-pipeline/codex-policy.json` | Maintainer edits the shipped opt-in preset; users explicitly merge it into a project override; integration fixtures load it directly. | Retain eight ordered `{provider, model, effort}` entries and the single top-level `ladder` key. |
| `context/foundation/agent-smith-policy.json` | This repository supplies its override; shared policy loading serves both chains. | Change seven model values only; preserve Luna, providers, efforts, `compare`, `limits` and all other keys. |
| `skills/10x-pipeline/test/providers.test.mjs` | Exact model-list assertion pins the shipped preset; existing assertions protect effort positions and Claude defaults. | Update expected identifiers alongside the data. Other preset readers need no literal replacements. |
| Router and Codex runner | `state.mjs` validates policy, routing selects a rung, and `run-codex.mjs` passes its values verbatim. | No validation, dispatch, retry or API change. |
| Run logs and provenance | Router alone writes `run.jsonl` and `meta.json`; reports and comparisons read recorded identities. | Preserve historical targets and original provenance. Pending/neutral retries can retain old targets; subsequent new dispatches use effective policy. |

The public models page confirms the new identifiers but does not enumerate their supported effort values. The local Codex capability cache closes that planning gap: `/Users/blazej/.codex/models_cache.json`, fetched `2026-11-18T00:09:05.623083Z`, reports `client_version: 0.169.0` and lists `low`, `medium`, `high`, `xhigh`, `max`, `ultra` for both 6.2 models. The installed CLI reports `codex-cli 0.169.0`. Only those nonsecret capability fields were inspected. This establishes advertised support, not a successful live execution or universal account access.

### Assumptions and decisions

- Update both the preset and this repository's override: they currently contain identical ladders, and the research identifies the override as this repository's actual pipeline input. Updating only the preset would leave the local consumer on old versions.
- Keep Luna and every effort/tier position: the request names Sol and Astra only, the existing provider test protects this invariant, and the capability cache advertises every retained effort. No Ultra rung is added.
- Add a short upgrade note in `docs/REFERENCE.md`: existing upgrade notes document provenance changes, and README already requires explicit merging of replacement arrays. No automatic rewrite of downstream overrides is introduced.
- Preserve the existing Codex 0.169.0 runner contract: metadata for that client advertises the desired models and efforts. Live qualification remains a Manual criterion; this change makes no broader compatibility, quality, cost or speed claim.
- Use one phase and no research delegation: upstream research locates all affected code, and the remaining compatibility fact was resolved by a scoped metadata read. No unresolved product decision remains.

## Desired End State

Both policy ladders equal this mapping; every provider remains `openai`:

| Tier | Model | Effort |
| --- | --- | --- |
| 0 | `gpt-6-luna` | `low` |
| 1 | `gpt-6.2-sol` | `low` |
| 2 | `gpt-6.2-sol` | `medium` |
| 3 | `gpt-6.2-sol` | `high` |
| 4 | `gpt-6.2-astra` | `medium` |
| 5 | `gpt-6.2-astra` | `high` |
| 6 | `gpt-6.2-astra` | `xhigh` |
| 7 | `gpt-6.2-astra` | `max` |

Users who merge the new preset receive the 6.2 targets on new dispatches through either chain. Existing custom or copied ladders stay explicit user-owned configuration. Deterministic tests prove policy and dispatch contracts; separate live evidence is required before marking real model execution verified.

### Key Discoveries:

- `skills/10x-pipeline/codex-policy.json:3` and `context/foundation/agent-smith-policy.json:5` own the two ladder copies.
- `skills/10x-pipeline/test/providers.test.mjs:34` already checks exact models, eight effort positions, provider identity, unchanged Claude defaults and policy validity.
- `skills/10x-pipeline/test/codex-runner.test.mjs:29` already checks exact model/effort arguments through a fake Codex executable for both chains.
- `README.md:42` documents explicit override merging and whole-array replacement.
- `docs/REFERENCE.md:454` says `ladder` is an expected difference in default pinned comparisons. A ladder difference alone must not be described as a pinned-comparison failure. In-flight drift is a separate signal.

## What We're NOT Doing

- Changing routing algorithms, tier counts, effort floors, ceilings, providers, profile handling, the Claude default ladder, baseline policy, Luna or pricing.
- Adding model allow-lists, compatibility aliases, fallback selection, dependencies, a migration script or new test infrastructure.
- Editing skills to name models, changing release versions, rewriting archives or recorded run state, or updating other worktrees and user configuration.
- Running a benchmark or claiming measured capability equivalence, savings, latency improvements or full host certification.
- Publishing branches, PRs or comments from this pipeline step. No publication dependency is part of Automated acceptance.

## Implementation Approach

Extend the existing policy data and assertion in place. Use the existing provider/runner tests and the repository-required full suite. Add the migration explanation beside the OpenAI preset description in the reference document. No expand/contract schema rollout is needed: old and new identifiers share the same data shape and the router supports both as arbitrary strings.

## Phase 1: Update the OpenAI preset and its consumer

### Overview

Make the seven model substitutions in both policies, align the existing regression assertion, and document adoption and rollback without altering routing semantics.

### Changes Required:

#### 1. Policy data

**Files**: `skills/10x-pipeline/codex-policy.json`, `context/foundation/agent-smith-policy.json`

**Intent**: Select the newly released Sol and Astra versions wherever the shipped preset and this repository's own pipeline select their predecessors.

**Contract**: The Desired End State table is exact. Change only the seven `model` fields in each file; preserve all other parsed values and ordering. Keep the two ladders equal.

#### 2. Existing regression assertion

**File**: `skills/10x-pipeline/test/providers.test.mjs`

**Intent**: Pin the new preset identifiers while retaining the checks that prevent accidental routing changes.

**Contract**: Update the expected model list in the existing GPT-overlay test. Preserve its effort, provider, policy-validation and Claude-default assertions. No new test file or test-index row is needed for this data-only edit.

#### 3. Upgrade guidance

**File**: `docs/REFERENCE.md`

**Intent**: Explain the model-version update and give existing users a predictable adoption and rollback path.

**Contract**: Add a concise upgrade note in the opening host/provider section beside the GPT overlay description. Cover explicit re-merge of the entire ladder while preserving unrelated override keys, unchanged tiers/efforts/Luna, pending targets remaining recorded, and `ladder` drift only when the effective policy changes during a run. Describe default comparison expectations accurately: `ladder` is an allowed between-run difference in pinned mode, whereas in-flight drift is reported separately. Follow the Migration Notes below; do not imply installing the plugin rewrites user overrides or that historical execution has been requalified.

### Success Criteria:

#### Automated Verification:

- Policy integrity passes: a local Node assertion confirms the exact target table, equal preset/override ladders, and no parsed policy changes beyond the fourteen intended model substitutions against the pre-edit baseline.
- The required Node 24+ suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`; `git diff --check` also passes.

#### Manual Verification:

- Upgrade guidance review confirms explicit adoption, preservation of unrelated override keys and historical targets, accurate drift/comparison wording, and a reversible rollback path.
- Live Codex verification records successful completion for all seven changed model/effort pairs on the exact tested client/account configuration, without claiming broader host certification.

Leave Manual rows pending until evidence exists. An unattended implementation may finish its local changes and Automated checks without representing those pending rows as passed. Do not request human interaction during this plan step.

## Testing Strategy

### Unit Tests:

Reuse the GPT-overlay assertion in `providers.test.mjs`; updating exact expected values is sufficient for a literal policy change. The policy integrity check is a one-off assertion, not a new permanent test coupled to this repository's override. Before editing, retain the parsed contents of both policy files (or their exact pre-edit Git revision if clean). After editing, assert that applying only the two old-to-new model substitutions to that baseline yields each current object, and assert the target table and ladder equality separately. Do not compare to a moving `HEAD` after committing or ignore pre-existing user edits.

### Integration Tests:

The full suite includes both-chain provider dispatch, fake-Codex exact arguments, neutral retries retaining stored dispatch identity, historical status/report behavior and provenance comparisons. These already cover old/new identifier coexistence without real model calls. A focused diagnostic run, if needed, is `node --test --test-concurrency=2 skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/provenance.test.mjs`; the full suite remains the required gate. Do not invoke the router against this active change merely to run a smoke test.

### Manual Testing Steps:

1. Read the added upgrade note against README's merge rule and the reference's comparison/provenance rules. Confirm it distinguishes an installed preset from an effective project override.
2. In a trusted verification environment with authenticated access, record exact CLI version and each attempted model/effort pair. Exercise Sol `low`, `medium`, `high` and Astra `medium`, `high`, `xhigh`, `max` with a minimal read-only prompt using the existing `codex exec -m <model> -c 'model_reasoning_effort="<effort>"'` interface and existing host safety settings. Do not bypass trust, approvals or inherited step restrictions.
3. Retain successful completion evidence and all failures in `context/changes/adapt-to-astra-62/evidence/verification.md` when this verification is performed. The advertised metadata alone cannot close this criterion. Access/client failures leave it pending with the exact reason; do not silently lower efforts or substitute another model. Any child execution must obey the enclosing step's native delegation contract.

No pushed branch, open PR, remote CI or external report is required to run local checks. Publication remains owned by the orchestrator.

## Performance Considerations

The router adds no work. New models may have different latency, token use and prices despite identical effort labels; this change asserts no performance equivalence or improvement. Do not alter rates or add a benchmark to a model-identifier update.

## Migration Notes

**Forward path:** update both repository policies and the assertion together, verify locally, then let the normal publication owner deliver the change. Downstream users deliberately re-merge the preset ladder into their own override, preserving other keys and any intentionally custom ladder design. Prefer adoption between runs when uninterrupted model identity matters.

**Mixed versions:** old copied overrides remain valid; no automatic migration occurs. Recorded attempts retain their original model names. Pending/neutral retries may still use old stored targets, while future newly selected targets use the current effective ladder. The router records effective policy drift; never repair it by hand or rewrite historical model names. No inventory or mutation of unrelated active runs is needed because no state format changes.

**Comparison:** a mid-run ladder change can produce `provenance.drift` and a drift warning. An old/new ladder difference between separate runs is expected by default pinned comparison policy and is not itself proof of non-comparability. Other comparison modes follow their existing expected-difference configuration.

**Rollback:** restore the previous seven model values in both policies, plus the matching assertion and upgrade guidance, through an ordinary forward edit/revert that preserves unrelated work. Downstream users may re-merge their prior ladder. Already recorded and pending actions retain their identity; rollback changes later dispatches and can itself record drift. Availability of the older models remains an external prerequisite. Never reset logs, rewrite pushed history or overwrite uncommitted versions.

**Idempotence and partial failure:** reapplying the target mapping changes nothing once adopted. There is no migration process or state sidecar to resume. A mismatch between the two repository ladders fails the local integrity check; live access failures remain visible in verification evidence. No destructive contraction is included.

## References

- [Change request](change.md) and [complete upstream research](research.md).
- [Lessons](../../foundation/lessons.md): preserve truthful verification state and inspect documentation when behavior changes.
- `skills/10x-pipeline/codex-policy.json:3`; `context/foundation/agent-smith-policy.json:5`; `skills/10x-pipeline/test/providers.test.mjs:34`.
- `skills/10x-pipeline/scripts/state.mjs:174`; `skills/10x-pipeline/scripts/run-codex.mjs:46` and `:129` (validation and dispatch, as traced by the research).
- `README.md:38` and `:42`; `docs/REFERENCE.md:11`, `:369`, `:454`.
- [OpenAI model documentation](https://learn.chatgpt.com/docs/models), fetched 2026-11-18; confirms 6.2 identifiers, CLI selection and per-client effort discovery.
- Local Codex capability metadata observed 2026-11-18: cache timestamp/client version and relevant advertised effort values recorded under Current State Analysis. No live model calls were made while planning.

## Progress

### Phase 1: Update the OpenAI preset and its consumer

#### Automated

- [x] 1.1 Policy integrity passes: a local Node assertion confirms the exact target table, equal preset/override ladders, and no parsed policy changes beyond the fourteen intended model substitutions against the pre-edit baseline. — 5a32a877
- [x] 1.2 The required Node 24+ suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`; `git diff --check` also passes. — 5a32a877

#### Manual

- [ ] 1.3 Upgrade guidance review confirms explicit adoption, preservation of unrelated override keys and historical targets, accurate drift/comparison wording, and a reversible rollback path.
- [ ] 1.4 Live Codex verification records successful completion for all seven changed model/effort pairs on the exact tested client/account configuration, without claiming broader host certification.
