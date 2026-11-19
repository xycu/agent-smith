# Provider Mode Implementation Plan

## Overview

### Reported observation

Every step of the Wave 1 run executed on OpenAI models through Codex, although the user works in Claude Code and did not choose that. The router has no way to say "run this step on the other tool".

### Reframed problem

> **The actual problem to plan around is**: the router chooses a provider by complexity tier only, so the user cannot name a provider for a run or for a step; and, separately, a Codex-hosted session has no way to run a Claude step.

The change identity calls for both split directions in the same delivery. Implement mode selection first, then qualify the headless Claude execution path and wire both skills to it.

## Current State Analysis

| Frame hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Provider selection is only by tier rung | `dispatchTarget` reads `policy.ladder[tier]`. `tierFor` settles an integer using the ladder's actual effort values, including the rigor floor. | Strong |
| The project override explains the surprise | The project override replaces the ladder with eight OpenAI rungs. Arrays replace wholesale. The shipped `codex-policy.json` is currently a copyable preset. | Strong |
| Host rules block the split on a Codex host | `hostProblem` rejects any Claude rung from a Codex host. The router checks that on init, next and usage. An explicit host mismatch on resume is refused. | Strong |
| No Claude dispatch exists from a Codex host | Both skills run Claude via the Claude Agent tool and OpenAI via `run-codex.mjs`. The Claude runner and its usage, guard and settlement contracts need separate work. | Strong |
| Several steps write files outside plan and implement | `fix` changes code, review templates can apply edits, archive is pinned, and manual verification selects prompts by capability. Each role needs an explicit assignment. | Strong |

The frame narrows the concern to unexpected tool selection, covers both hosts and names plan and implement as the split targets. The previous OpenAI integration intentionally limited Codex hosts to OpenAI. The frame's Claude Code 2.1.311 probe proves a headless response and a usage summary. Tool restrictions, guard activation, toolkit discovery and child settlement still need qualification. See [frame](frame.md) and [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md).

### Key Discoveries

- Select the provider's effective ladder before `tierFor` applies effort floors and escalation. Archive currently computes a target twice and needs the same selection path as normal steps. See [steps.mjs](../../../skills/10x-pipeline/scripts/steps.mjs#L548) and [isolation.mjs](../../../skills/10x-pipeline/scripts/isolation.mjs#L811).
- A neutral retry reconstructs the pending dispatch from the log, including the verbatim task handoff. It must survive changes to current ladder settings. See [flow.mjs](../../../skills/10x-pipeline/scripts/flow.mjs#L417).
- Claude's current hook requires a native subagent identity. Headless `--agent` selects the main session's agent and needs its own guard binding. The native usage collector requires evidence that a one-shot CLI summary cannot provide. See [step-guard.mjs](../../../skills/10x-pipeline/scripts/step-guard.mjs#L495) and [claude-usage.mjs](../../../skills/10x-pipeline/scripts/claude-usage.mjs).

## Desired End State

Both pipeline skills accept the same three modes through `init --provider-mode claude|codex|split` (also `--provider-mode=value`). A fresh run defaults to its actual host's provider. The router stores the mode and rejects a conflicting flag on resume. A mode-less historical run retains ADR-024 behavior. A project ladder can tune models and effort for its own provider and tier. The run mode owns provider assignment.

| Mode | Claude Code host | Codex host |
| --- | --- | --- |
| `claude` | All steps use native Claude Agent | All steps use the headless Claude runner |
| `codex` | All steps use the existing Codex runner | All steps use the existing Codex runner |
| `split` | Plan and implement use Codex. Other steps use native Claude Agent. | Plan and implement use headless Claude. Other steps use Codex. |

Split assigns 10x `plan` and `implement` to the other provider, including replans, implementation segments and executor/retry templates with those step IDs. `plan-review` and `impl-review` stay on the host, including their apply prompts. `fix`, pre-plan, scoring, manual verification and archive stay on the host. In OpenSpec, `os-propose` and ordinary `os-apply` use the other provider. The `os-apply-fix` repair template, `os-verify` and `os-archive` stay on the host. Confirmations inherit the provider of their review step.

The init response explains the effective mode and provider assignments before the skills launch the first step. It lists possible steps for the selected chain, including the OpenSpec repair exception. Historical runs identify their ladder-driven assignment and possible providers without predicting a future tier. Each launched step identifies its actual provider, model and effort. Status and reports expose the effective mode.

## Scope boundaries

The change covers dispatch, compatible ladder selection, headless Claude settlement and truthful reporting. External runners use the existing authentication and permission authority. Shipped policy data continues to own model choices. Live provider and publication evidence belongs to Manual verification.

## Implementation Approach

Deliver three phases. Provider selection first makes policy and stored-mode behavior testable without a provider process. The second phase qualifies a guarded runner against fake CLI fixtures. The third phase connects both orchestrators and documents the live acceptance cases. Continue through Automated checks unattended and record Manual rows in canonical Progress for later verification.

## Open Risks & Assumptions

- The fresh default follows the actual host. The Wave 1 observation shows why selecting a rung must never silently opt a fresh run into a different provider. Existing mode-less runs retain their prior routing because ADR-024 and the retry protocol already define their behavior.
- The flag is the only mode input. Existing per-run host handling provides the precedent for fixing a run's selection at init. Keep project ladder settings available for model and effort tuning.
- The phrase “only plan and implement” is the role boundary. Review apply prompts still belong to reviewers. OpenSpec's `os-apply-fix` is repair even though it shares the `os-apply` step ID. The frame and [OpenSpec flow](../../../skills/openspec-pipeline/scripts/openspec.mjs#L159) supply the equivalent roles.
- Both directions ship together because [change.md](change.md) specifies both and the frame verified a headless Claude launch. Guard and settlement are the main delivery risks. If supported CLI events cannot prove required protection or closure, the external dispatch stops with a precise capability or reconciliation diagnostic.
- Preview assignments at init and the actual dispatch at launch. Future model and effort remain conditional on the router's normal evidence, rigor and retries.

## Phase 1: Resolve and persist provider mode

### Overview

Resolve intended providers in the shared router for both chains, then settle tiers against the correct ladder.

### Changes Required:

#### 1. Policy and mode resolution

**Files** `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/codex-policy.json`, `skills/openspec-pipeline/policy.json`

**Intent** Make provider choice explicit while reusing the shipped Claude and Codex tier data. Keep chain-specific split membership with the chain policy.

**Contract** Only the values `claude`, `codex` and `split` are accepted by the init flag. Resolve assignment first, then use the effective provider's ladder in tier settlement and dispatch. Use the existing shipped Claude ladder and Codex preset as the fallbacks. A homogeneous project ladder replaces the ladder for its declared provider only. A mixed project ladder overrides matching entries at their existing indices with fallback to that provider's shipped rung at other indices. Validate selected ladders and step bounds before dispatch or state writes, including holes and tiers outside the resulting ladder. Report how to correct a custom override with unsupported tier ranges. Never translate model names or infer provider from them. Existing mode-less state retains the original ladder and host validation.

#### 2. State, dispatch and visibility

**Files** `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent** Keep mode immutable and use one provider decision for ordinary steps, archive and runner validation.

**Contract** Validate the flag before writes and recheck mode and host with the authoritative metadata under the init lock. Store `providerMode` at fresh init, including the host-derived default. Existing metadata without the field stays ladder-driven and refuses a flag that would change its mode. Conflicts halt without advancing state. New attempts use the stored mode. Neutral retries use the saved provider, model, effort, profile, agent and prompt handoff. Preserve capability checks such as restricted agents, advisor options and Chrome evidence rules for the effective dispatch. Share the mode-aware archive descriptor for pre-commit checks, terminal action and runner validation. Add `providerMode` and `providersByStep` to init visibility and show mode in status/report and initial provenance. Include used default ladder data in provenance so edits are observable. Historical reports and comparisons remain readable with their original evidence semantics.

#### 3. Router fixtures

**Files** `skills/10x-pipeline/test/{providers,ladder,host-integration,route}.test.mjs`, `skills/openspec-pipeline/test/openspec-steps.test.mjs`, existing archive and provenance fixtures

**Intent** Drive the real route CLI with local artifacts and cover the provider decision independently of CLI launch.

**Contract** Cover both chains, all six host/mode combinations, explicit and implicit selection, mixed and homogeneous overrides, provider-specific effort floors, custom tier gaps, the split role boundaries, exact retries, archive descriptors, legacy metadata and no-write halts. Exercise legacy mixed and Codex-only fixtures with existing run state rather than treating a fresh host-native default as legacy.

### Success Criteria

#### Automated Verification:

- The provider and ladder CLI fixtures prove the six host/mode combinations, host-native defaults, validated overrides and role-aware dispatch on both chains.
- Resume, neutral retry, archive and provenance fixtures prove immutable selection, exact pending dispatch and continued compatibility with mode-less runs.

#### Manual Verification:

None for this phase.

## Phase 2: Add the guarded headless Claude runner

### Overview

Supply the missing Codex-to-Claude execution boundary. Share exact validation with the Codex path. Keep provider-specific launch, guard and evidence handling with the relevant runner.

### Changes Required:

#### 1. Runner dispatch and permissions

**Files** `skills/10x-pipeline/scripts/run-claude.mjs`, `run-codex.mjs` and a shared dispatch validator in the same directory, `step-guard.mjs`, `agents/step.md`

**Intent** Require the precise pending action and a guarded fresh Claude session. Reuse existing action and archive validation rather than introducing another interpretation of router state.

**Contract** Accept the unchanged action on stdin from the run root for a Codex-hosted Claude `run` or `archive` action. Check root, change, chain, host, step identity, provider, model, effort, routed agent, archive descriptor or exact pending prompt and result path under the shared lock. Check handoff path and task bytes as in the Codex runner, including revalidation after external preflight. Launch Claude via an argument array with the exact routed agent, model and effort and a runner-owned session UUID. Resolve plugin and other required skill locations from the fresh child. Use existing trust, authentication and permissions without approval prompts or elevated allowances. Reject unsupported exact agent mappings and native advisor requirements with a diagnostic. Prove required CLI/agent/toolkit/guard and step-specific permissions before sending the work prompt. Keep local preflight deterministic in fake CLI tests.

**Guard contract** Bind a fail-closed Bash guard to the runner's exact headless session and use the existing parser for its direct-command checks. Keep ordinary main sessions and native `agent-smith:step` calls under their existing rules. A missing, mismatched or failed guard must stop dispatch. Scope the same guard to the supported descendant chain. Require a verified hook-load and identity signal from the configured session, and qualify the effective allow/deny behavior on a fresh installation. Existing host restrictions still apply to other tool paths. Preserve archive-only commit permissions and the prohibition on step publication.

#### 2. Result, ownership and usage

**Files** `skills/10x-pipeline/scripts/run-claude.mjs`, `state.mjs`, `usage.mjs`, `skills/10x-pipeline/test/{claude-runner,step-guard}.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent** Accept enclosing results only after the execution tree settles and keep partial or unverifiable evidence observable.

**Contract** Reuse awaited foreground launch and the shared run lock, recording launch ownership before spawn and the exact session identity. Use bounded CLI output and the same normalized result envelope fields as the existing runner. Validate the enclosing reply's final `RESULT:` line only after a matched terminal event, validated output, process-group closure, and complete matched lifecycle and foreground collection of each allowed native leaf. Block detached/background launches and unmatched children. Preserve valid `failed` and `blocked` results. A verified prelaunch refusal permits a neutral retry. A settled launched failure uses existing unknown-result handling. Cancellation or uncertain settlement retains the lock and triggers suspension before result writes, rollback, relaunch, archive, or publication. Retained headless ownership must fail closed for any supported reader. Treat the CLI aggregate token summary as unavailable for observed step-tree tokens and carry supported elapsed duration with a bounded coverage reason. Keep optional native Claude usage and existing Codex accounting paths intact.

### Success Criteria

#### Automated Verification:

- Fake Claude and Codex runner fixtures prove exact inline, by-file and archive dispatch validation, fresh-session guard binding, restricted capability refusal and normalized result handling.
- Fake Claude runner and hook fixtures prove cancellation and uncertain closure suspend the run, settled failures release ownership, unrelated or child results are ignored, and unverified tokens stay unavailable.

#### Manual Verification:

None for this phase.

## Phase 3: Wire and document both pipeline skills

### Overview

Use the host/provider pairing to select the transport and show its effective selection and evidence before and after launch.

### Changes Required:

#### 1. Orchestrator loops and acceptance evidence

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, shared rule carriers and integration fixtures

**Intent** Keep both loops consistent and preserve their existing stop, retry, archive and publication behavior.

**Contract** Forward the explicit flag only when supplied, derive the host from the session, and show the init assignment and actual step provider. Send all OpenAI actions to the Codex runner and Codex-hosted Claude actions to the headless runner. Keep native Claude actions on Agent. Apply the same envelope handling, lock-first suspend checks and archive validation to both runner paths. Keep headless Claude browser evidence unavailable unless proved by the existing supported capability, with locally executable covering test evidence or a pending reason. Archive gates and comment authorization retain their host-owned protocols. Keep shared anti-stall text identical.

#### 2. User and architecture documentation

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-024-openai-codex-support.md`, repository command summary

**Intent** Explain the default and the selected mode, and state exactly what is qualified for each transport.

**Contract** Document both invocations, role allocation, legacy compatibility, mixed and homogeneous custom ladder rules, provider-specific prerequisites, guard/usage limits and recovery. Search active docs for the old Codex-host restriction and manual-verification capabilities. Record live qualification only when evidence exists. Preserve archived material and the release-managed version fields.

### Success Criteria

#### Automated Verification:

- Both skill loop contracts and the full Node 24 repository suite pass locally using scratch fixtures and fake provider and GitHub clients.

#### Manual Verification:

- Qualify both skills on fresh Claude Code and Codex sessions in both split directions and exercise each full mode, including headless Claude's exact guard allow/deny behavior, toolkit discovery, implementation child collection, safe cancellation and archive.
- After orchestrator publication, verify the run branch, open PR and PR CI on its head, and verify report comment behavior only if the owner elected it.

## Testing Strategy

### Unit Tests

Test provider selection, rung validation, step/template exceptions, malformed flags, legacy metadata and guard event identity. Include launch/result/settlement cases with fake CLI adapters.

### Integration Tests

Use fresh repo fixtures and real router CLI init/next/status/archive transitions for both chains. Test a known valid change in scratch with isolation disabled and assert init dispatches `action: "run"`. Extend the existing host integration and archive tests to verify the transport-facing output. Run the focused gates for phases 1 and 2 as their fixtures land, then run the full required gate in phase 3.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

### Manual Testing Steps

1. Run qualification in isolated disposable projects with authenticated, supported tools and upstream skills. Capture selected providers and exact agent/guard behavior and compare the emitted status and usage evidence. Exercise one permitted action and one guarded rejection using a harmless local fixture. Demonstrate that a headless implement waits for an allowed leaf and suspension protects a run with unverified settlement.
2. Inspect the branch and PR only after the orchestrator publishes. Confirm the head CI result and any explicitly authorized report comment.

## Performance Considerations

The router preview resolves assignments without launching providers. Apply existing CLI timeout and output bounds to the headless path and reuse its one enclosing process for the step. Report provider effort and elapsed duration independently of token coverage.

## Migration Notes

Existing router-owned `meta.json` and `run.jsonl` require no rewrite. Resume mode-less runs on their original host and policy. Fresh mixed-ladder users can select `split` for role-based routing. Document the fresh host-native default and that mixed rung-driven behavior is retained for existing runs. Existing homogeneous overrides still supply tiers for their named provider. During rollout, run explicitly selected new sessions on the enabling router and skills together. To roll back, first settle any runner and resolve an outstanding dispatch on the enabling revision. Keep its TMPDIR and state intact during reconciliation. Finish the run on the enabling revision, or start a separate compatible run on the older revision, which cannot honor new mode semantics.

## References

- [Frame brief](frame.md) and [change identity](change.md)
- [Reference for provider dispatch](../../../docs/REFERENCE.md#codex-and-provider-dispatch)
- [ADR-024 provider dispatch and settlement](../../../docs/ADR/ADR-024-openai-codex-support.md)
- [ADR-018 native child safety and observed usage](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [Repository lessons](../../foundation/lessons.md)
- [Claude CLI](https://code.claude.com/docs/en/cli-reference), [hook payloads](https://code.claude.com/docs/en/hooks#common-input-fields), [subagents](https://code.claude.com/docs/en/sub-agents)

## Progress

> Convention `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Keep titles stable.

### Phase 1: Resolve and persist provider mode

#### Automated

- [ ] 1.1 The provider and ladder CLI fixtures prove the six host/mode combinations, host-native defaults, validated overrides and role-aware dispatch on both chains.
- [ ] 1.2 Resume, neutral retry, archive and provenance fixtures prove immutable selection, exact pending dispatch and continued compatibility with mode-less runs.

### Phase 2: Add the guarded headless Claude runner

#### Automated

- [ ] 2.1 Fake Claude and Codex runner fixtures prove exact inline, by-file and archive dispatch validation, fresh-session guard binding, restricted capability refusal and normalized result handling.
- [ ] 2.2 Fake Claude runner and hook fixtures prove cancellation and uncertain closure suspend the run, settled failures release ownership, unrelated or child results are ignored, and unverified tokens stay unavailable.

### Phase 3: Wire and document both pipeline skills

#### Automated

- [ ] 3.1 Both skill loop contracts and the full Node 24 repository suite pass locally using scratch fixtures and fake provider and GitHub clients.

#### Manual

- [ ] 3.2 Qualify both skills on fresh Claude Code and Codex sessions in both split directions and exercise each full mode, including headless Claude's exact guard allow/deny behavior, toolkit discovery, implementation child collection, safe cancellation and archive.
- [ ] 3.3 After orchestrator publication, verify the run branch, open PR and PR CI on its head, and verify report comment behavior only if the owner elected it.
