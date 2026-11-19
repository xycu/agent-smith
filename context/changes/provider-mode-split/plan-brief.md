# Provider Mode Plan Brief

[Full plan](plan.md) · [Frame brief](frame.md)

## What & Why

> **The actual problem to plan around is**: the router chooses a provider by complexity tier only, so the user cannot name a provider for a run or for a step; and, separately, a Codex-hosted session has no way to run a Claude step.

## Starting Point

The Wave 1 project's OpenAI-only ladder sent every step to Codex, even from Claude Code. The router already logs each dispatch, and the existing Codex runner validates exact pending actions. A headless Claude probe returned a valid response and usage summary, with guard and child settlement qualification still pending.

## Desired End State

Run either pipeline from Claude Code or Codex with `--provider-mode claude|codex|split`. A fresh run defaults to its host's provider, and init displays the assignments before launch. A resumed run retains its existing mode and exact pending dispatch.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Mode and host scope | Claude, Codex or split on both hosts | The change calls for both split directions, and the headless launch is feasible. | Frame and change identity |
| Split roles | The other provider gets 10x plan/implement and OpenSpec propose/ordinary apply, including 10x templates of those steps. The host provider gets review, repair, verification and archive, including OpenSpec's apply-fix template. | Keep the stated authoring roles and the host-owned review and repair roles explicit. | Plan, based on frame and chain roles |
| Configuration | Init flag and immutable run metadata. Fresh runs default to the host, and existing mode-less runs retain ladder-driven routing. | The host default removes cross-provider surprise while preserving saved runs. | Plan, based on Wave 1 and ADR-024 |
| Ladder | Choose provider before tier settlement. Use matching project rungs and shipped defaults at the same tier. Validate bounds for each assigned role. | The selected provider supplies effort floors. Tier indices preserve the existing repair floor across providers. | Plan, based on router behavior |
| Visibility | Preview provider assignment at init and give actual provider, model and effort at launch. | Future tiers depend on artifacts, retries and rigor. | Plan, based on router behavior |

## Scope

- Router mode, ladder compatibility, exact retry and archive dispatch, and the two skill loops.
- Guarded headless Claude execution with exact result ownership and a retained lock on uncertain settlement.
- Deterministic local checks and live qualification, with publication acceptance after the enclosing orchestrator publishes.

## Architecture / Approach

The router selects a provider for the step, then settles the tier on that provider's ladder. Each skill dispatches the unchanged router action through native Agent, the Codex runner or the headless Claude runner according to the host/provider pair. Each external runner checks the exact action, including the archive prompt and agent. The headless Claude runner requires guard and toolkit proof from the executing session before giving it the task. It reports a result only after the execution tree settles. Both terminal publication scripts respect the run lock.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Resolve and persist provider mode | Shared routing and legacy-compatible state with a visible provider assignment. | Alternate ladders must honor tier and effort bounds. |
| 2. Add the guarded headless Claude runner | Exact dispatch, guard identity, settlement and truthful usage evidence. | Fresh headless behavior must preserve required permissions and child ownership. |
| 3. Wire and document both pipeline skills | Both host loops, local integration gates and the Manual acceptance protocol. | Installed CLIs and skills may expose different capabilities. |
| 4. Verify the implementation review fixes | Recheck F1–F8 on the current candidate with local fake providers, scratch runs and CLI help. | Ambiguous Claude completion could release the run lock and allow a retry while work is still active. |

**Prerequisites** Node 24, Git, OpenSpec CLI 2.0.0 and scratch repositories for local tests. Authenticated supported CLIs and the upstream skills for each routed transport are required for live qualification.

**Estimated effort** Three implementation phases, one local review verification phase and a live qualification pass.

## Open Risks & Assumptions

- The optional CLI summary supplies no verified step-tree token total. The runner replaces step-authored accounting with measured duration and structured unavailable token evidence.
- The headless launch probe covered a simple response. Guard behavior, tool restrictions, native child settlement and fresh-child toolkit discovery need evidence on the final candidate. Unsupported or uncertain execution fails closed.
- Use the enabling revision and the same TMPDIR to reconcile unresolved runners. Existing runs keep their original metadata and routing on upgrade.

## Success Criteria (Summary)

- Local router fixtures prove all six host/mode combinations, both chains, exact retries and saved-run compatibility.
- The review records all eight fixes in `84205bf02744`. Phase 4 verifies terminal ownership and failure accounting, metadata preservation, advisor and skill checks, Codex preflight and discovery bounds, and agreement between CLI help, transport behavior and documentation. [Implementation review](reviews/impl-review.md)
- Fake CLI and guard fixtures prove dispatch identity, normalized results and suspension on uncertain closure. Fake Git and GitHub clients prove publication honors suspension. The full Node 24 suite runs locally before closing each code-changing phase.
- During unattended verification, leave fresh-host qualification and post-publication checks pending. Qualify all six host/mode combinations per chain on the final candidate. After terminal publication, verify the branch, open PR and PR CI. Check report comments when the owner elected them.

## References

- [Change identity](change.md)
- [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md) and [provider dispatch reference](../../../docs/REFERENCE.md#codex-and-provider-dispatch)
- [Claude CLI](https://code.claude.com/docs/en/cli-reference) and [hook payloads](https://code.claude.com/docs/en/hooks#common-input-fields)
