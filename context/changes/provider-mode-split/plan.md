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

Both pipeline skills accept the same three modes through `init --provider-mode claude|codex|split` (also `--provider-mode=value`). A fresh run defaults to its actual host's provider. The router stores the mode and rejects a conflicting flag on resume. A historical run with readable metadata that omits `providerMode` retains ADR-024 behavior. A surviving log with missing or unreadable metadata requires recovery before the router can resume. A project ladder can tune models and effort for its own provider and tier. The run mode owns provider assignment.

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

The first three phases cover provider selection, the guarded runner and both orchestrators. Phase 4 verifies the fixes from implementation review on the current candidate. Its checks run locally. Authenticated host qualification and post-publication acceptance stay in Manual rows 3.2 and 3.3.

## Open Risks & Assumptions

- The fresh default follows the actual host. The Wave 1 observation shows why selecting a rung must never silently opt a fresh run into a different provider. Existing mode-less runs retain their prior routing because ADR-024 and the retry protocol already define their behavior.
- The flag is the only mode input. Existing per-run host handling provides the precedent for fixing a run's selection at init. Keep project ladder settings available for model and effort tuning.
- The phrase “only plan and implement” is the role boundary. Review apply prompts still belong to reviewers. OpenSpec's `os-apply-fix` is repair even though it shares the `os-apply` step ID. The frame and [OpenSpec flow](../../../skills/openspec-pipeline/scripts/openspec.mjs#L159) supply the equivalent roles.
- Both directions ship together because [change.md](change.md) specifies both and the frame verified a headless Claude launch. Guard and settlement are the main delivery risks. If supported CLI events cannot prove required protection or closure, the external dispatch stops with a precise capability or reconciliation diagnostic.
- **Decision (owner, 2026-11-19): trusted Claude startup imports may read task bytes before the guard handshake.** Do not redesign pending-task storage. The task text is already exposed in `prompt.md` and `run.jsonl`, and Claude's `InstructionsLoaded` hook cannot veto an import, so the handshake guards tool use and lifecycle evidence, not startup file reads. Implement the by-file dispatch on that basis and state the limit in the runner's documentation and its capability diagnostic. Do not halt on this point again.
- **Decision (owner, 2026-11-19, plan-review F2): a run whose log survives but whose metadata file is missing must stop for recovery.** `init` and `next` halt with a recovery diagnostic; they never treat that run as fresh and never infer a mode from the log. Add no legacy log-only resume path. Update the historical provenance fixture that expects a log-only run to resume so it expects the halt. Do not halt on this point again.
- **Decision (owner, 2026-11-20): accept the applied fixes of impl-review step 14 and resume.** The review's REJECTED verdict applies to `cf984fc2`; F1 to F4 are fixed in `45c94997` with 0 open critical and 0 open warnings. The fix-loop cap halted the run, not an open finding. Resume with a fresh review of the current head. Do not halt on the loop cap for these findings again.
- Preview assignments at init and the actual dispatch at launch. Future model and effort remain conditional on the router's normal evidence, rigor and retries.

## Phase 1: Resolve and persist provider mode

### Overview

Resolve intended providers in the shared router for both chains, then settle tiers against the correct ladder.

### Changes Required:

#### 1. Policy and mode resolution

**Files** `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/codex-policy.json`, `skills/openspec-pipeline/policy.json`

**Intent** Make provider choice explicit while reusing the shipped Claude and Codex tier data. Keep chain-specific split membership with the chain policy.

**Contract** Only the values `claude`, `codex` and `split` are accepted by the init flag. Resolve assignment first, then use the effective provider's ladder in tier settlement and dispatch. Use the existing shipped Claude ladder and Codex preset as the fallbacks. A homogeneous project ladder replaces the ladder for its declared provider only. A mixed project ladder overrides matching entries at their existing indices with fallback to that provider's shipped rung at other indices. Validate selected ladders and step bounds before dispatch or state writes, including holes and tiers outside the resulting ladder. Report how to correct a custom override with unsupported tier ranges. Never translate model names or infer provider from them. Existing mode-less state retains the original ladder and host validation.

Separate input-shape validation from effective ladder validation. For explicit-mode runs, check the selected chain's step and template assignments against each assigned provider's effective ladder, including both forms of OpenSpec apply in split mode. Validate under the run lock before mutating init or advancing `next`. A short override for one provider affects only roles assigned to it, and diagnostics name the affected step and provider. On neutral replay and late `usage`, keep general policy validation and use the recorded dispatch without looking up its tier in the current provider ladder. Keep legacy validation on the original merged policy. Tier indices are shared ordinal positions. A 10x host-side `fix` carries the last code tier as a numeric floor, bounded by the receiving provider's normal tier clamp. OpenSpec keeps its existing same-step failure count when the apply template changes provider.

#### 2. State, dispatch and visibility

**Files** `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/steps.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent** Keep mode immutable and use one provider decision for ordinary steps, archive and runner validation.

**Contract** Validate the flag before writes and recheck mode and host with the authoritative metadata under the init lock. Store `providerMode` at fresh init, including the host-derived default. Existing metadata without the field stays ladder-driven and refuses a flag that would change its mode. Conflicts halt without advancing state. New attempts use the stored mode. Neutral retries use the saved provider, model, effort, profile, agent and prompt handoff. Preserve capability checks such as restricted agents, advisor options and Chrome evidence rules for the effective dispatch. Share the mode-aware archive descriptor for pre-commit checks, terminal action and runner validation. Add `providerMode` and `providersByStep` to init visibility and show mode in status/report and initial provenance. Include used default ladder data in provenance so edits are observable. Historical reports and comparisons remain readable with their original evidence semantics.

Use the saved step/template identity for the OpenSpec preview exception. Both `archive` and `os-archive` derive their exact agent and rendered prompt from the same read-only descriptor as their target and path. Resolve and validate those fields before the pre-archive commit. Persist the browser evidence capability for new `manual-verify` dispatches. Both external transports select a truthful local-evidence fallback when Chrome is unavailable, with a distinct reason for explicit `--chrome false`. The router accepts only covering test, command or script evidence for browser rows under that fallback. Older entries retain their existing verification behavior.

#### 3. Router fixtures

**Files** `skills/10x-pipeline/test/{providers,ladder,host-integration,route}.test.mjs`, `skills/openspec-pipeline/test/openspec-steps.test.mjs`, existing archive and provenance fixtures

**Intent** Drive the real route CLI with local artifacts and cover the provider decision independently of CLI launch.

**Contract** Cover both chains, all six host/mode combinations, explicit and implicit selection, mixed and homogeneous overrides, provider-specific effort floors, custom tier gaps, the split role boundaries, exact retries, archive descriptors, legacy metadata and no-write halts. Exercise legacy mixed and Codex-only fixtures with existing run state rather than treating a fresh host-native default as legacy.

Exercise a provider-specific short ladder on both a relevant and an unrelated role, a cross-provider `fix` floor, and both OpenSpec apply templates. Change valid ladder settings before replay and late accounting to prove those paths use the saved dispatch. Cover rejected `browser-` evidence, accepted covering local proof and the pending reason for a headless Claude manual-verification entry, including `--chrome false` and neutral replay.

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

**Files** `skills/10x-pipeline/scripts/run-claude.mjs`, `run-codex.mjs` and a shared dispatch validator in the same directory, `step-guard.mjs`, `hooks/hooks.json`, `agents/step.md`, `agents/score.md` for the restricted scorer contract

**Intent** Require the precise pending action and a guarded fresh Claude session. Reuse existing action and archive validation rather than introducing another interpretation of router state.

**Contract** Accept the unchanged action on stdin from the run root for a Codex-hosted Claude `run` or `archive` action. Check root, change, chain, host, step identity, provider, model, effort, routed agent, archive descriptor or exact pending prompt and result path under the shared lock. Check handoff path and task bytes as in the Codex runner, including revalidation after external preflight. Launch Claude via an argument array with the exact routed agent, model and effort and a runner-owned session UUID. Resolve plugin and other required skill locations from the fresh child. Use existing trust, authentication and permissions without approval prompts or elevated allowances. Reject unsupported exact agent mappings and native advisor requirements with a diagnostic. Prove required CLI/agent/toolkit/guard and step-specific permissions before sending the work prompt. Keep local preflight deterministic in fake CLI tests.

For both runners, compare the archive agent and exact prompt bytes with the shared descriptor, together with the existing target and path checks. Fixture cases alter the prompt and agent independently and require refusal before launch. Check toolkit discovery against the saved effective skill and template, including TDD/E2E executor overrides and each chain's archive skill or CLI requirement. Bind the Claude plugin's agent and hook files to the trusted plugin revision used to route the step. A parent catalog or version response supplies no proof of fresh-child discovery.

**Guard contract** Bind a fail-closed Bash guard to the runner's exact headless session and use the existing parser for its direct-command checks. Keep ordinary main sessions and native `agent-smith:step` calls under their existing rules. A missing, mismatched or failed guard must stop dispatch. Scope the same guard to the supported descendant chain. Require a verified hook-load and identity signal from the configured session, and qualify the effective allow/deny behavior on a fresh installation. Existing host restrictions still apply to other tool paths. Preserve scoped commit permissions for the authorized enclosing steps. The archive step may commit only its archive work. Leaves may not commit, and steps may not publish.

Use `hooks/hooks.json` to wire the startup and tool/lifecycle evidence the runner relies on. Require the matching UUID, agent and hook handshake and successful preflight in the executing session before the runner sends the work turn, including an inline or by-file prompt. Trusted startup imports may read existing task files before that handshake, as allowed by the owner decision above. Apply the same headless identity check to normal and oversized Bash events. Require the supported Agent call path to enforce foreground `agent-smith:step` leaves, inherited restrictions and no further delegation. Fixture cases cover missing and mismatched handshakes, oversized guarded events, a foreground leaf and a refused background launch. Cover the default agent and the restricted scorer's effective tool boundary, with a prelaunch refusal where the exact restrictions cannot be proved. A separate probe session and terminal usage counts cannot substitute for runtime guard or per-leaf collection evidence.

#### 2. Result, ownership and usage

**Files** `skills/10x-pipeline/scripts/run-claude.mjs`, `state.mjs`, `usage.mjs`, `skills/10x-pipeline/test/{claude-runner,step-guard}.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent** Accept enclosing results only after the execution tree settles and keep partial or unverifiable evidence observable.

**Contract** Reuse awaited foreground launch and the shared run lock, recording launch ownership before spawn and the exact session identity. Use bounded CLI output and the same normalized result envelope fields as the existing runner. Validate the enclosing reply's final `RESULT:` line only after a matched terminal event, validated output, process-group closure, and complete matched lifecycle and foreground collection of each allowed native leaf. Block detached/background launches and unmatched children. Preserve valid `failed` and `blocked` results. A verified prelaunch refusal permits a neutral retry. A settled launched failure uses existing unknown-result handling. Cancellation or uncertain settlement retains the lock and triggers suspension before result writes, rollback, relaunch, archive, or publication. Retained headless ownership must fail closed for any supported reader. Treat the CLI aggregate token summary as unavailable for observed step-tree tokens and carry supported elapsed duration with a bounded coverage reason. Keep optional native Claude usage and existing Codex accounting paths intact.

Write the existing `native` presence marker before spawn so the preceding reader also refuses stale cleanup. Record the Claude session UUID as typed identity alongside that marker. Only clear ownership after verified settlement or definitive proof that the work never launched and all preflight processes closed. Cover an absent owner PID and process group with unresolved leaf ownership, including the preceding reader's classification. Replace all step-authored accounting with runner-measured duration and structured unavailable `usageEvidence` from the shared helper. A headless session UUID alone supplies no native `agentId` or `runId`. Feed a result with its own token claim through intake and verify that status, reports and comparisons still show unavailable token coverage.

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

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, shared rule carriers, `skills/10x-pipeline/scripts/{open-pr,pr-comment}.mjs`, and host integration and publication fixtures

**Intent** Keep both loops consistent and preserve their existing stop, retry, archive and publication behavior.

**Contract** Forward the explicit flag only when supplied, derive the host from the session, and show the init assignment and actual step provider. Send all OpenAI actions to the Codex runner and Codex-hosted Claude actions to the headless runner. Keep native Claude actions on Agent. Apply the same envelope handling, lock-first suspend checks and archive validation to both runner paths. Keep headless Claude browser evidence unavailable unless proved by the existing supported capability, with locally executable covering test evidence or a pending reason. Archive gates and comment authorization retain their host-owned protocols. Keep shared anti-stall text identical.

Update both argument hints and consume either mode flag form before deriving the goal or preparing a worktree. Omit the flag on resume unless explicitly supplied. Resolve the headless runner from the loaded skill location. Check skill and tool prerequisites in the transport that executes the routed action, including discovery in a fresh CLI child for external steps. The host still owns orchestration prerequisites. Have the terminal publication scripts hold the same run lock through their side effects, using the original run identity even when the report has moved to an archive. Share the lock primitive with the runners without importing the router entrypoint into publication scripts. Exercise open/close ownership and retained-lock refusal in both chains using local fake Git and GitHub clients. Direct read-only inspection remains available during suspension.

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

The owner or an authorized top-level session performs fresh-host qualification on the final candidate across all six host/mode combinations for each chain. Use disposable changes with completed local archive prerequisites to qualify the archive transport. Leave 3.2 and 3.3 pending during unattended in-run verification. On the delivery run, 3.3 becomes verifiable only after terminal publication. If the 10x archive gate encounters those pending rows, use its existing keep-unarchived path unless the owner explicitly authorizes archival with checks still open and project policy permits it. The orchestrator can publish the live change after skipping archive. The owner can archive later. Claims of live support require recorded qualification evidence for the relevant combination.

## Phase 4: Verify the implementation review fixes

### Overview

**Assumption.** The REJECTED verdict describes candidate `ff22d32f`. The reviewer recorded F1–F8 as applied in `84205bf02744`, which is on the run branch. Verify each fix against the current candidate using the existing fixtures first. If a fixture misses the reported case, add the missing assertion. If it fails, correct the behavior at the source named below and rerun it. [Implementation review](reviews/impl-review.md)

### Changes Required:

#### 1. Verify Claude settlement and accounting (F1, F4)

**Intent** Keep ownership until the enclosing session has demonstrably finished. Preserve the cost evidence for work that ran, including attempts that yield no usable RESULT.

**Contract** In `run-claude.mjs`, settle only after a matching enclosing session and work turn, a Stop with no unresolved leaves, and verified process-group closure. A success terminal requires boolean `is_error: false` and a reply that matches both the assistant text and Stop digest. A recognized CLI failure terminal requires boolean `is_error: true` and settles the ordinary step without consuming a reply. A missing or invalid flag, unknown subtype, mismatched success reply or subsequent enclosing assistant output suspends execution and retains the native lock. Preserve valid failed or blocked RESULTs from a verified ordinary reply. For a launched archive, retain ownership on transport failure, an invalid final RESULT or uncertain settlement. A verified successful Claude terminal with a valid task-level `blocked` or `failed` RESULT releases ownership and returns the reply. The enclosing skill checks the move with `verify-archive`. Extend the existing fake archive fixture with a CLI failure, a malformed final RESULT and a settled `blocked` reply. Assert lock disposition and the returned envelope in each case.

Extend the existing settled-failure cases in `claude-runner.test.mjs` to exercise both chains. For a supported CLI failure and malformed RESULT, confirm lock release, feed the launched-but-incomplete envelope fields into each chain's router as `unknown`, and assert measured duration, unavailable `usageEvidence` and refusal of late numeric tokens. Keep the `host-integration.test.mjs` check that both skill texts prescribe forwarding those fields. The two checks together cover the local loop contract. Live execution of the skills belongs to row 3.2.

#### 2. Verify metadata recovery and capability checks (F2, F3, F5, F6, F7)

**Intent** Preserve saved provider choices and require the executing session to have the capabilities the pending action needs.

**Contract**

- **F2.** Implement the owner’s log-only recovery decision in `route.mjs` at `mutationMeta`, under the existing writer lock. A present run log requires a readable metadata object before `init`, `next`, `usage` or `status --report` can write. Extend the two-chain test in `providers.test.mjs` with a missing file alongside malformed JSON and a non-object value. For each command, assert the recovery diagnostic and identical change-directory bytes and paths, including continued absence of the missing file. Replace the log-only resume expectation in `provenance.test.mjs` with the recovery halt. Keep successful controls for fresh init, valid mode-less metadata and valid metadata lacking provenance.
- **F2 read-only inspection.** Plain `status` must return the logged steps without changing any files. When the log survives and its metadata cannot be read as an object, identify the run-level host and mode as unavailable and explain that recovery is required. Keep the recorded per-step providers visible. Assert the output for a damaged Codex-hosted split run and a valid historical run. Use the explicit `--chain openspec` on the OpenSpec fixture so the command inspects its actual log.
- **F2 fixture migration.** Audit tests that seed a log and then call a writer expecting normal routing, including the rigor cases in `route.test.mjs`, `observe` in `openfindings.test.mjs` and `mvProject` in `manualverify.test.mjs`. Seed valid metadata at the fixture that models an initialized run, using the existing `writeMetaFile` helper. Keep `writeLog` capable of constructing a genuinely log-only run for recovery and read-only tests.
- **F3, F6.** Route headless manual verification with an opt-in under each of `manual-verify` and `manual-verify-headless`. Execute each exact action with the existing fake Claude runner fixture and assert the native-advisor diagnostic before spawn. In the separate available-catalog case with `Skill` omitted from the effective tools, assert a tool-capability refusal before the work turn.
- **F5.** Extend `codex-runner.test.mjs` to exercise the shared `runner-dispatch.mjs` checks before and after preflight. Keep the invalidated policy and changed skill cases and vary the saved template and advisor independently. Assert that each drift case prevents model launch. Use the existing exact-dispatch fixture as the control for matching requirements and the saved model, effort and prompt.
- **F7.** Feed `runner-toolkit.mjs` a fake discovery response that exceeds its 4 MiB byte limit without a newline. Assert the size-limit diagnostic before the probe timeout. Keep the successful discovery fixture as the control.

#### 3. Compare CLI help and the transport reference with local behavior (F8)

**Intent** Give operators accurate flag, evidence and guard rules for the installed revision.

**Contract** Add the no-argument assertion in `route.test.mjs` for both host and provider mode. Compare it and the existing unknown-init-flag assertion with `docs/REFERENCE.md`. Explicitly prove that a newly routed native Claude action with `--chrome false` rejects `browser-` evidence, and that a historical Claude dispatch with no recorded capability preserves its browser evidence rules. Use the existing browser evidence fixtures for these cases. In `step-guard.test.mjs`, retain main and leaf identity checks and include an oversized Bash event with a guarded leaf identity alongside the existing oversized main-session case.

### Success Criteria

#### Automated Verification:

- F1 and F4. Claude fixtures prove that ambiguous completion retains the lock and that settled failures preserve duration and unavailable token evidence through intake in both skill loops.
- F2. Both chain fixtures prove that damaged metadata on a logged run prevents writes and leaves plain status available, while fresh and valid legacy runs retain their routing.
- F3 and F6. Headless Claude refuses work when the manual verification template requires a native advisor or a listed skill lacks its invocation tool.
- F5 and F7. Codex fixtures prove that dispatch drift prevents launch after preflight and that oversized, unterminated toolkit output hits the discovery byte limit.
- F8. Local CLI output and transport fixtures agree with the reference on init flags, no-Chrome evidence and headless Bash guard scope.

Run the focused Node 24 gate below from the repository root with local fake providers. Run the full gate in Testing Strategy after any implementation change.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,providers,provenance,host-integration,route,openfindings,manualverify,step-guard}.test.mjs
```

#### Manual Verification:

Fresh-host and publication evidence belong to the existing rows 3.2 and 3.3.

## Testing Strategy

### Unit Tests

Test provider selection, rung validation, step/template exceptions, malformed flags, legacy metadata and guard event identity. Include launch/result/settlement cases with fake CLI adapters.

### Integration Tests

Use fresh repo fixtures and real router CLI init/next/status/archive transitions for both chains. Test a known valid change in scratch with isolation disabled and assert init dispatches `action: "run"`. Extend the existing host integration and archive tests to verify the transport-facing output. Use the focused gates for diagnosis, then run the repository's full required gate before closing each code-changing phase. Make Git and the real OpenSpec CLI 2.0.0 available via `PATH` or `OPENSPEC_BIN` for the full gate. Check skipped test identities against the documented conditions and keep `GH_LIVE` disabled for unattended verification.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/{providers,ladder,host-integration,route,archive,provenance}.test.mjs skills/openspec-pipeline/test/{openspec-steps,openspec-archive}.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/{claude-runner,codex-runner,step-guard}.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

### Manual Testing Steps

1. Run qualification in isolated disposable projects with authenticated, supported tools and upstream skills. Capture selected providers and exact agent/guard behavior and compare the emitted status and usage evidence. Exercise one permitted action and one guarded rejection using a harmless local fixture. Demonstrate that a headless implement waits for an allowed leaf and suspension protects a run with unverified settlement. Use disposable changes that meet each chain's archive prerequisites to exercise archive.
2. Inspect the branch and PR after terminal publication, including publication of the live change when archive was skipped. Confirm the head CI result and any explicitly authorized report comment.

## Performance Considerations

The router preview resolves assignments without launching providers. Apply existing CLI timeout and output bounds to the headless path and reuse its one enclosing process for the step. Report provider effort and elapsed duration independently of token coverage.

## Migration Notes

Existing router-owned `meta.json` and `run.jsonl` require no rewrite. Resume runs with valid mode-less metadata on their original host and policy. If only the log survives, use plain status with the affected chain to inspect recorded steps. Recovery requires the metadata for that same run from a verified source before retrying a writer. Keep the log and any pending result intact. Document this distinction and the read-only status output in `docs/REFERENCE.md`. Fresh mixed-ladder users can select `split` for role-based routing. Document the fresh host-native default and that mixed rung-driven behavior is retained for existing runs. Existing homogeneous overrides still supply tiers for their named provider. During rollout, run explicitly selected new sessions on the enabling router and skills together. To roll back, first settle any runner and resolve an outstanding dispatch on the enabling revision. Keep its TMPDIR and state intact during reconciliation. Finish the run on the enabling revision, or start a separate compatible run on the older revision, which cannot honor new mode semantics.

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

- [x] 1.1 The provider and ladder CLI fixtures prove the six host/mode combinations, host-native defaults, validated overrides and role-aware dispatch on both chains. — 379418a
- [x] 1.2 Resume, neutral retry, archive and provenance fixtures prove immutable selection, exact pending dispatch and continued compatibility with mode-less runs. — 379418a

### Phase 2: Add the guarded headless Claude runner

#### Automated

- [x] 2.1 Fake Claude and Codex runner fixtures prove exact inline, by-file and archive dispatch validation, fresh-session guard binding, restricted capability refusal and normalized result handling. — e2b409a2
- [x] 2.2 Fake Claude runner and hook fixtures prove cancellation and uncertain closure suspend the run, settled failures release ownership, unrelated or child results are ignored, and unverified tokens stay unavailable. — e2b409a2

### Phase 3: Wire and document both pipeline skills

#### Automated

- [x] 3.1 Both skill loop contracts and the full Node 24 repository suite pass locally using scratch fixtures and fake provider and GitHub clients. — f89c77cc

#### Manual

- [ ] 3.2 Qualify both skills on fresh Claude Code and Codex sessions in both split directions and exercise each full mode, including headless Claude's exact guard allow/deny behavior, toolkit discovery, implementation child collection, safe cancellation and archive.
- [ ] 3.3 After orchestrator publication, verify the run branch, open PR and PR CI on its head, and verify report comment behavior only if the owner elected it.

### Phase 4: Verify the implementation review fixes

#### Automated

- [x] 4.1 F1 and F4. Claude fixtures prove that ambiguous completion retains the lock and that settled failures preserve duration and unavailable token evidence through intake in both skill loops. — 07221f54
- [x] 4.2 F2. Both chain fixtures prove that damaged metadata on a logged run prevents writes and leaves plain status available, while fresh and valid legacy runs retain their routing. — 07221f54
- [x] 4.3 F3 and F6. Headless Claude refuses work when the manual verification template requires a native advisor or a listed skill lacks its invocation tool. — 07221f54
- [x] 4.4 F5 and F7. Codex fixtures prove that dispatch drift prevents launch after preflight and that oversized, unterminated toolkit output hits the discovery byte limit. — 07221f54
- [x] 4.5 F8. Local CLI output and transport fixtures agree with the reference on init flags, no-Chrome evidence and headless Bash guard scope. — 07221f54
