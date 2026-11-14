# OpenAI Codex Support — Plan Brief

> Full plan: [plan.md](plan.md)
> Research: [research.md](research.md)

## What & Why

Let agent-smith run GPT steps from Codex CLI and mix Claude/GPT steps from Claude Code. Both 10xDevs and OpenSpec keep the same deterministic routing, artifact verification, isolated worktrees and recovery rules.

## Starting Point

The router already selects an indexed model/effort ladder without model-specific logic. The chain skills, some prompts, usage intake and packaging assumptions are tied to Claude; run/archive dispatch currently carries no provider.

## Desired End State

Users keep Claude defaults or opt into a GPT policy overlay using existing Codex configuration by default. Both hosts use one Codex runner for OpenAI steps; reports identify provider/model/effort, and failed execution cannot masquerade as successful artifact verification.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Both hosts, both chains; mixed ladder under Claude | Covers both explicitly selected uses | Research / Plan |
| Execution | Shared `codex exec` runner | One process/result/usage contract for GPT steps | Plan: owner 1A |
| Provider selection | Provider per ordered rung | Extends existing escalation without a second selector | Plan: owner 2A |
| GPT defaults | Configurable opt-in eight-rung preset | Usable starting point; preserves tier indexes | Plan: owner 3A, preset/phase approval |
| Host identity | Validated at init, fixed per run | Reject impossible host/provider combinations before writes | Plan |
| Entry skills | Same two host-aware skills | Preserve one worktree/archive/PR contract | Plan |
| Git permissions | Existing Codex configuration; optional `codex.profile`; actual Git preflight | Avoid forcing settings that prevent required child commits | Plan-review F1; implementation correction |
| Concurrency | Shared lock covers `init`, `next`, `usage`, `status --report`; plain `status` stays unlocked | Every router write must respect the active execution boundary | Plan-review F2: owner fix in plan |
| PR comment | Router metadata stores explicit intent | Removes dependency on Claude Task tools | Plan |
| Capability gaps | Reject restricted-agent/advisor opt-ins; covering browser proof or pending rows | Preserve safety without claiming absent tools exist | Research / Plan |

## Scope

**In scope:** provider-bearing actions/logs/reports; legacy compatibility; shared runner; host-aware prompts/skills; compatibility packaging; fake-CLI tests and live acceptance checks.

**Out of scope:** native Codex subagents, Claude steps from Codex, direct API calls, toolkit edits, automatic trust, cross-host run migration, new pricing schema, rung calibration or release publication.

## Architecture / Approach

Router selects provider/model/effort and exact prompt. Claude dispatch stays native; OpenAI dispatch goes through standalone `run-codex.mjs`. Runner returns a normalized result, orchestrator writes `last-result.json`, router verifies artifacts and owns all log/metadata writes. Archive replies return to the archive branch without recreating moved folders.

The GPT overlay replaces only the ladder: tier 0 Luna/low; tiers 1–3 Sol/low, medium, high; tiers 4–7 Astra/medium, high, xhigh, max. Exact IDs are `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`. Claude defaults and effort ordering stay unchanged; this ordering is not measured cost/quality equivalence.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Provider Contract | Validated providers/host, preset, dispatch/retry/archive/report identity | Legacy and pending-step compatibility |
| 2. Codex Runner | Profile/Git preflight, pinned execution, RESULT/usage, locking/cancellation | Unwritable Git metadata, false success or duplicate processes |
| 3. Host Integration | Shared skills/prompts, durable PR-comment intent, packaging/docs | Host tool and dependency differences |
| 4. Verification | Both-chain integration matrix and live evidence | Real installation, trust and model access |

**Prerequisites:** Node 24+, git, Codex CLI 0.169.0+, authenticated model access, separately installed chain skills; Claude Code for mixed-host acceptance. Project trust is established explicitly. OpenSpec dependencies were absent from the inspected Codex skill directory.
**Estimated effort:** Large cross-cutting change, roughly 4–6 focused implementation/verification sessions; model latency and prerequisite setup may extend live acceptance.

## Open Risks & Assumptions

- Latest cumulative Codex usage snapshot supplies input plus output tokens; cached/reasoning subsets are not added again. Tool-use count is omitted; emitted zero may mean missing internal telemetry.
- Subprocess startup and rung ordering need measurement. Current docs allow native model overrides; shared execution is the reason for using `exec`.
- Browser, restricted-agent and advisor limits are explicit. Missing trust/dependencies must surface clearly; no automatic bypass.
- Nullable profile choice is preserved on retries. Real Git-permission checks must pass during Phase 2; insufficient permissions stop before model launch. A named profile is optional.
- Existing Claude pinned baseline remains; GPT/custom baselines use `--unpinned`. Cross-provider token totals are raw counts.
- Overlaps with existing PR-comment, timeout, skill-path and delegation changes need coordination. No related change is closed automatically.

## Success Criteria (Summary)

- Both chains run GPT steps from Codex and mixed-provider steps from Claude, preserving verification and recovery.
- Tests prove dispatch identity, token accounting, failure/cancellation safety and archive boundaries; live checks prove actual skill discovery and host behavior.
- Default Claude runs and legacy logs remain supported; unsupported features and missing prerequisites produce clear outcomes.

## References

- [Research](research.md); [full plan and source references](plan.md#references).
- [Codex model guidance](https://learn.chatgpt.com/docs/models.md); [pinned 0.169.0 usage implementation](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L119).
