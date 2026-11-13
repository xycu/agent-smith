# OpenAI Codex Support Implementation Plan

## Overview

Support both approved uses of agent-smith: Codex CLI orchestrating GPT steps, and Claude Code orchestrating a ladder containing Claude and GPT steps. Both the 10xDevs and OpenSpec chains retain the shared deterministic router, file contracts, isolation and recovery behavior.

The owner selected a shared `codex exec` runner, provider selection on each ladder rung, and a configurable GPT preset proposed during planning. The four phases and preset below were approved on 2026-11-13. This document authorizes no implementation by itself.

## Current State Analysis

- The policy already owns the ordered model/effort ladder; routing operates on indexes and effort order rather than a model allow-list. The normal dispatch in `skills/10x-pipeline/scripts/route.mjs:183` drops all rung fields except model and effort. Neutral retries and archive dispatch construct their own outputs in `flow.mjs:354` and `isolation.mjs:595`.
- Both chain skills assume Claude Code: Agent dispatch, `${CLAUDE_SKILL_DIR}`, Task-based PR-comment intent, question tools and usage notifications. Their existing worktree, archive and PR rules are shared invariants worth preserving, not duplicating into separate Codex skills.
- `flow.mjs:793` owns prompt resolution, `flow.mjs:826` validates placeholders, and `flow.mjs:404` accepts optional usage figures. Prompts and prompt files contain Claude-specific skill/tool instructions. `steps.mjs:293` selects the browser verification template before the provider is known.
- The router alone owns run logs and metadata. A standalone runner may read them for identity checks and reuse the run lock, but must not write them. `state.mjs:836` already provides a PID-owned lock in the OS temporary directory.
- `compare` retains a fixed Sonnet/high baseline (`route.mjs:355`); prices are optional blended rates keyed by model. Existing tests exercise the real router in scratch projects, fake external commands, isolation and recovery.
- Research is complete in `research.md`, but two observations are superseded: installed Codex is now 0.169.0, and required 10x skills are present under `~/.agents/skills`. The three required OpenSpec skills were not found there. A parent session's skill catalog does not prove discovery in a fresh CLI child.
- Current official documentation supports native Codex subagent model/effort overrides. Their alleged general unavailability is not a reason for the selected runner. Shared execution and usage handling across both hosts are the reasons.

## Desired End State

A user keeps the existing Claude experience or copies the opt-in GPT policy overlay into their project override. Existing Codex configuration is used by default; a named configuration profile is optional. Both pipeline skills recognize their host, pass host identity to the router, and execute an OpenAI action through the same standalone runner. Claude-hosted runs continue to use native Agent dispatch for Claude rungs.

Every new dispatched step identifies provider, model and effort in the action, pending entry, status and report. Neutral retries retain the original dispatch and exact prompt. Archive actions use the same provider contract. Legacy entries without provider remain readable as Claude entries without rewriting historical files.

Codex execution requires successful CLI completion and a valid final RESULT; router verification still judges the actual artifacts. Known unsupported capabilities stop clearly or use the documented evidence fallback. Tests cover both chains and failure recovery; live acceptance checks establish actual installation, skill discovery and execution compatibility before claiming support.

### Key Discoveries:

- Preserve the dispatch seam: router action out, normalized result into `last-result.json`; model calls stay in the standalone runner, outside the router and its imported modules.
- Codex 0.169.0 emits cumulative thread usage in `turn.completed`. Use the latest completed snapshot from a fresh process; `totalTokens = input_tokens + output_tokens`. Cached input and reasoning output are already included in those fields.
- A zero exit code alone is insufficient: Codex can finish without a final assistant message. Require exit zero, completed-turn evidence and a parseable final RESULT.
- Codex can disable delegation, but its V2 switch takes precedence over `agents.enabled`. Disable both paths for a pipeline child.
- `--trust` persists trust even with ephemeral execution. The runner must not grant trust or bypass sandbox, approval, hooks or repository instructions automatically.
- Default workspace-write protects `.git` and resolved linked-worktree Git directories as read-only. Implementation and archive children must commit before returning, so fixed workspace-write plus never-approve settings cannot satisfy this workflow. F1 triage preserves child-owned commits and requires actual Git-capability checks before model launch. A named profile is not a prerequisite; the runner uses existing Codex configuration by default.

## What We're NOT Doing

- Native Codex subagent dispatch, direct OpenAI API calls, a second router, new npm dependencies, or separate duplicated host entry skills.
- Claude steps from a Codex host, provider selection outside the ordered ladder, automatic provider failover, cross-host resumption of an existing run, or guessing a provider from its model name.
- Changing tier indexes, escalation thresholds or effort ordering; adding `ultra`; claiming measured cost, speed or quality equivalence between model families.
- Implementing Codex equivalents of Claude's restricted score agent, native advisor, or Claude-in-Chrome tools. Unsupported opt-ins fail clearly; browser proof uses the existing covering-test/command path or remains pending.
- Editing or installing the upstream 10x/OpenSpec toolkits as part of product code, changing authentication, granting project trust automatically, publishing a release, or changing version fields by hand.
- A persistent job service, automatic reattachment to an uncertain child process, fabricated tool-use counts, tokenizer normalization, or a new pricing schema.
- Rewriting archived changes, historical run entries, existing implementation Progress, or unrelated open changes.

## Implementation Approach

Keep one policy and one pair of chain entrypoints. A rung gains `provider: "claude" | "openai"`; absence retains the legacy Claude meaning. `init` gains a validated `--host claude|codex`, defaulting to Claude for existing callers. Host identity belongs in router-owned metadata and is fixed for the run; reject a conflicting resume before changing state. Codex-hosted policies must contain only OpenAI rungs, so an incompatible default or override is reported before a run starts. Recheck compatibility when mutable policy is used later.

Ship `skills/10x-pipeline/codex-policy.json` as a copyable project overlay, following the existing baseline-policy distribution pattern; the router does not read that file implicitly. It replaces only the ladder, preserves the existing effort sequence and tier indexes, and uses OpenAI on every rung:

| Tier | Model | Effort |
| --- | --- | --- |
| 0 | `gpt-6-luna` | `low` |
| 1 | `gpt-6.1-sol` | `low` |
| 2 | `gpt-6.1-sol` | `medium` |
| 3 | `gpt-6.1-sol` | `high` |
| 4 | `gpt-6-astra` | `medium` |
| 5 | `gpt-6-astra` | `high` |
| 6 | `gpt-6-astra` | `xhigh` |
| 7 | `gpt-6-astra` | `max` |

The preset is an initial capability ordering, not a price benchmark. The existing Claude ladder remains the shipped default. A Claude-hosted project creates a mixed ladder by explicitly tagging its GPT rungs; all existing policy merge semantics continue to apply.

OpenAI execution uses existing Codex configuration by default. Optional `codex.profile` names an existing user-selected configuration profile; its shipped null value means omit `-p`. A supplied name is passed with `-p`; both paths respect existing permission/approval settings and outer host restrictions. Record the nullable profile choice with dispatch identity so neutral retries do not silently change configuration after a policy edit. Actual missing Git capability produces an actionable refusal; absence of a named profile does not.

The standalone `run-codex.mjs` consumes an action on stdin, with the change ID and chain supplied as arguments, from the absolute run root. It validates the action and pending identity, runs a fresh Codex child, and prints one JSON envelope containing launch/completion metadata and the normalized result. The orchestrator writes the result file and advances the router only after the runner ends. Archive action handling returns its result to the archive branch and performs no run-state write after the archive move.

## Critical Implementation Details

### State sequencing

The runner holds the existing per-run lock for the entire child lifetime. It releases only after the child closes; forwarding cancellation must precede releasing it. All mutating router commands use that same lock: `init`, `next`, `usage` and `status --report`. Plain `status` remains read-only and unlocked. Do not invoke `next`, rollback or archive verification while a child is still running, and do not relaunch a background command merely because the host's foreground wait ended. Uncertain process state requires inspection, not an automatic duplicate launch.

### Usage and completion

Read JSONL incrementally with bounded buffering. Use the final valid cumulative usage snapshot, safe integer checks and monotonic elapsed duration; omit `toolUses`. Preserve optional RESULT fields and signals, replace model-authored usage with measured usage, and normalize a child-authored `orchestrator-error` to `unknown`. Missing telemetry stays absent where distinguishable; Codex's emitted zero may itself represent missing internal telemetry, so document that limit.

## Phase 1: Provider Contract

### Overview

Extend dispatch identity across both chains without changing tier calculations or migrating old state.

### Changes Required:

#### 1. Policy, host identity and preset

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/codex-policy.json`, `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add provider identity and a usable GPT overlay while preserving existing configurations. Validate host/provider combinations before any new state or git write.

**Contract**: Accept only the two provider values when present; absence means Claude, including legacy log reads. Validate `--host` in both flag forms, reject unsupported values and conflicting resumes, and retain default Claude behavior for old callers. A Codex host rejects a ladder containing Claude rungs; changing the project override must not bypass the check on later commands. Preserve arbitrary nonempty model identifiers and current effort validation.

Add optional nullable `codex.profile` to shipped policy. Missing/null means use existing Codex configuration; a supplied value must be a nonblank profile name. Both OpenAI and Claude-only configurations remain valid without a named profile. Named profile selection is supplied by the user, never inferred from model names or generated by a step. Include this policy input in provenance.

#### 2. Dispatch, retries, archive and prompt ownership

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Carry the selected provider wherever model/effort already travel. Keep effective prompt selection and capability rejection in router modules rather than in the runner.

**Contract**: New actions and executed entries carry explicit provider; a neutral retry uses the stored provider/model/effort/prompt despite policy edits. Archive output carries provider, host-compatible prompt and any data the runner needs without creating a normal numbered step. Reject OpenAI dispatch of a configured restricted agent or matching native advisor before recording the new step; never silently drop either opt-in. Apply the same validation before archive-side git writes when applicable.

OpenAI actions and entries also carry the nullable profile choice. Preserve it on a neutral retry and validate it with the rest of the pending identity; archive actions carry it too. Null means default configuration, while an unavailable explicitly named profile produces a clear error without falling back or broadening permissions.

#### 3. Reports, comparison and provenance

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/baseline-policy.json`

**Intent**: Make it clear which provider ran each model and avoid treating equal model strings from different providers as the same dispatch.

**Contract**: Expose provider in status/report and provider/model aggregation where aggregation exists. Keep optional model-keyed blended prices and missing-usage behavior. The existing pinned comparison remains explicitly Claude/Sonnet/high; compare provider as part of that identity, interpreting legacy entries as Claude. GPT/custom baselines use the existing `--unpinned` path with its existing validity checks. Report cross-provider token comparisons as raw counts, without implying equal tokenizer work or billing. Include new dispatch policy inputs in provenance and preserve warning-only behavior for old records.

#### 4. Connected regression coverage

**Files**: `skills/10x-pipeline/test/providers.test.mjs`, `skills/10x-pipeline/test/policy-validate.test.mjs`, `skills/10x-pipeline/test/neutral.test.mjs`, `skills/10x-pipeline/test/archive.test.mjs`, `skills/10x-pipeline/test/openspec-archive.test.mjs`, `skills/10x-pipeline/test/compare.test.mjs`, `skills/10x-pipeline/test/provenance.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Exercise the real router with default, OpenAI-only, mixed and malformed policies. Extend established fixtures only where their contracts change.

**Contract**: Cover normal and archive actions on both chains, legacy records, policy drift during neutral retry, host mismatch, capability refusals and provider-aware comparison. Refusals promised before writes must leave the scratch change and git state unchanged. Index the new test file; do not modify the protected characterized loop tests.

### Success Criteria:

#### Automated Verification:

- Provider tests prove default/legacy Claude behavior, both explicit providers, host validation and write-free rejection of malformed or incompatible inputs.
- Router tests prove provider propagation through normal actions, exact neutral retries, both archive actions, reports, provenance and baseline comparison.
- Preset checks prove eight OpenAI rungs with exactly the approved models/efforts and unchanged shipped Claude defaults and tier indexes.
- Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 2: Codex Runner

### Overview

Add one dependency-free execution boundary for GPT steps that both hosts can call.

### Changes Required:

#### 1. Standalone action execution

**Files**: `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/remove-tree.mjs`

**Intent**: Execute the router's exact OpenAI action without embedding a model call in the router or copying its decisions into a second service.

**Contract**: CLI is `node run-codex.mjs <id> [--chain 10x|openspec]` from the run root, with the action JSON on stdin. Accept only valid OpenAI run/archive actions belonging to that ID, chain and root. For run actions, verify the pending entry number, provider, model, effort, selected profile, prompt and result destination before launch; reject stale or already-consumed actions. For archive actions, verify ended archive state and the router-selected destination and profile before launch. Return structured launch/completion information plus result, never mutate metadata/logs/result files, choose another rung, or import `route.mjs`.

Use `spawn` with an argv array and pipe the exact prompt over stdin. Run a fresh `codex exec`, pinned with `-C`, `-m`, TOML `model_reasoning_effort`, `--json`, `--ephemeral` and a unique `-o` file. Add `-p` only when the action explicitly names a profile. Preserve existing configuration permissions and approval controls; do not override them with fixed workspace-write/never-approve settings. Keep `agents.enabled=false` and disabled `multi_agent_v2` as runner-enforced delegation limits. Do not create or broaden a permission profile, grant trust, ignore instructions, enable auto-approval, bypass sandbox/hooks or create another worktree automatically.

Before any model launch, run a model-free permission preflight using the same effective configuration (default or explicitly named profile), working directory, managed requirements and outer host restrictions as execution. Use the CLI's sandbox command to check write access to the actual run worktree's resolved Git metadata, including shared objects and refs. Prove required Git commit behavior in a disposable linked-worktree fixture under those same permissions; do not mutate the run's refs, index or history as a probe. Insufficient permissions, unresolved approval requirements, unavailable preflight support or inconsistent permission resolution stop with an actionable error and no model launch. Child-owned typed phase/archive commits, Progress SHAs and pre-RESULT commit evidence remain required; the later router sweep is not a substitute. Verify this boundary during Phase 2 rather than deferring it to final live acceptance. In the unchanged Progress title 2.5, selected-profile Git access means the effective configuration, including existing/default configuration; the check must not require a named profile.

#### 2. RESULT, usage and failure boundaries

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Convert CLI completion into the existing result protocol with trustworthy accounting and bounded diagnostics.

**Contract**: Successful transport requires exit zero, completed-turn evidence, no later failed/interrupted terminal turn, and a valid JSON object on the final assistant message's last `RESULT:` line. An invalid last RESULT must not fall back to an earlier success. Preserve result keys/signals; never promote malformed, missing or unsuccessful completion to `done`. Distinguish a pre-spawn orchestration failure from a child failure in the envelope so only the orchestrator can declare `orchestrator-error` when no child started. The child cannot self-declare that status.

Measure duration, use latest cumulative input plus output tokens, omit unsupported usage figures, and reject unsafe/negative/overflowing counters. Do not count arbitrary completed items as tool calls. Keep raw transcript/final files in a unique OS temporary folder outside the worktree; redact or bound surfaced diagnostics and clean up through `removeTree`, including failure paths. The runner must return the archive reply without recreating any moved change folder.

#### 3. Lifetime, lock and cancellation

**Files**: `skills/10x-pipeline/scripts/run-codex.mjs`, `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Prevent concurrent launches and router mutations while a Codex child is editing the worktree.

**Contract**: Reuse the existing run lock and release behavior; adjust its diagnostic to include execution if needed. Extend the router's lock gate to cover `status --report` alongside `init`, `next` and `usage`, before any report write; plain read-only `status` remains unlocked and available. Hold the runner's lock through child close and cleanup. Forward termination to the child, await its termination, and avoid orphaning a still-editing child on a handled cancellation. A concurrent runner or mutating router command refuses without launching/consuming work or changing the report. Exiting a foreground tool wait is not a runner timeout; use host background execution/waiting for long steps. Reuse existing host process tracking rather than add a job registry.

#### 4. Fake-CLI tests

**Files**: `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/run-lock.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Prove runner behavior without spending tokens or requiring credentials in CI.

**Contract**: Put a fake `codex` executable on the test PATH using the suite's existing external-command fixture pattern. Record argv/stdin/cwd; emit fragmented JSONL and final-message files. Cover default configuration without a named profile, explicit profile selection, immutable nullable retry profile, unavailable explicitly named profiles, preflight refusal before model launch, repeated cumulative usage, missing usage, unsafe counters, malformed RESULT, nonzero exit after a plausible result, launch errors, stale actions, lock contention, cancellation and archive completion after a folder move. Include the source-backed accounting example input 100 plus output 10 equals 110 despite cached 40, cache-write 60 and reasoning 5. Fake-CLI success alone does not establish real Git-write capability; run and record the model-free real-CLI permission check separately.

Extend `run-lock.test.mjs` on both chains: while a runner holds the shared lock, `status --report` must refuse and leave the report byte-identical, while plain `status` succeeds without writing. After child close and lock release, `status --report` must work normally. These cases fulfill the existing process-contention success criterion without changing its Progress title.

### Success Criteria:

#### Automated Verification:

- Fake-CLI tests prove exact argv/stdin/cwd, model/effort pinning, disabled delegation, preserved RESULT fields and zero router-owned state writes.
- Runner tests prove final-snapshot token accounting, omitted tool-use counts, completion/failure distinctions and rejection of stale or malformed actions.
- Process tests prove contention refusal, lock retention until child close, handled cancellation and temporary-file cleanup on both chains including archive moves.
- Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- Permission checks prove selected-profile Git access in a real linked worktree, preserve pre-RESULT commit evidence, and refuse insufficient profiles before model launch.

## Phase 3: Host Integration

### Overview

Make the existing two pipeline skills usable from either host while keeping one worktree/resume/archive/PR contract.

### Changes Required:

#### 1. Host-aware chain entrypoints

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: Add explicit host dispatch instructions around the shared router protocol without moving model/routing decisions into prose.

**Contract**: Resolve script paths from `${CLAUDE_SKILL_DIR}` under Claude and from the absolute loaded skill path under Codex; OpenSpec resolves the sibling 10x scripts directory. Pass the actual host at initialization. Claude actions use native Agent only from Claude; OpenAI actions use the shared runner from either host, archive included. Write only the returned normalized result into the router-selected result file and advance only after completion. A child that is running in the background is waited on, never relaunched. Keep both Anti-stall sections equal and preserve isolated worktree creation/reuse, stale-main-copy notices, commits/rollback ownership, manual archive approval, late native usage, PR opening and reporting behavior.

Do not add model/effort/tier names to either skill beyond the repository's existing allowance; link to policy data and reference docs. For the manual archive gate, use the host's actually available native question capability; if none exists, retain the current fail-closed answer. Check child-visible toolkit/CLI prerequisites and report missing dependencies instead of claiming this parent's catalog proves availability.

#### 2. Durable PR-comment intent

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `skills/10x-pipeline/test/pr-comment-intent.test.mjs`

**Intent**: Remove the dependency on Claude Task tools for remembering an explicitly requested PR comment across a host context reset.

**Contract**: Accept boolean `--pr-comment` in router initialization, store intent only through router-owned `meta.json`, and surface it on terminal run/archive actions. Direct router resumes without the flag keep stored intent. Each explicit pipeline-skill invocation forwards true when requested and false when absent, preserving the existing opt-in/reset behavior. Missing legacy metadata means false; do not infer authorization from unrelated tasks. Both hosts run the existing comment script only for authorized intent. Preserve existing standalone script behavior and the rule that the router never invokes `gh` or pushes. Index the new test and coordinate this absorbed portion with the open `pr-comment-flag-in-meta` change without editing that change's lifecycle artifacts.

#### 3. Prompt portability and capability handling

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/README.md`, `skills/10x-pipeline/prompts/executor-retry.md`, `skills/10x-pipeline/prompts/executor-tdd.md`, `skills/10x-pipeline/prompts/executor-e2e.md`, `skills/10x-pipeline/prompts/impl-review-lessons.md`, `skills/10x-pipeline/prompts/os-apply.md`, `skills/10x-pipeline/prompts/os-archive.md`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Make skill invocation and unattended/nesting rules understandable to Codex while preserving the same work and RESULT/evidence contracts.

**Contract**: Prefer named-skill instructions usable by both hosts over broad slash-to-dollar rewriting. Audit all resolved templates and wired prompt files, including nested skill/tool mentions, archive and both OpenSpec fix paths. Keep GIVEN/WHEN/THEN rule form and required safeguards. The router selects and records a dedicated OpenAI manual-verification template after provider selection, using covering tests/commands/scripts or leaving rows pending with a truthful browser-unavailable reason. Reuse existing evidence-kind verification; do not fabricate Chrome calls or evidence that says the user supplied `--chrome false` when they did not. Existing explicit no-Chrome behavior stays available. Advisor/restricted-agent incompatibility is an actionable refusal, not an unenforced promise.

#### 4. Packaging, documentation and architecture record

**Files**: `.claude-plugin/plugin.json`, `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-023-openai-codex-support.md`, `docs/ADR/README.md`, `skills/10x-pipeline/test/README.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/nested-subagents.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`, `skills/10x-pipeline/test/rules.test.mjs`

**Intent**: Ship the two shared skills through the existing compatibility package and describe the supported combinations and limits precisely.

**Contract**: Explicitly declare the existing `./skills/` directory in the compatibility manifest if required by the documented packaging contract; retain existing names/descriptions and version ownership. Do not add another version-bearing manifest or broaden release automation. Document Codex CLI 0.169.0 as the verified minimum contract, authenticated model access, separately installed toolkit skills, explicit project trust, preset copying/merging, existing Codex configuration with optional `codex.profile`, permission preflight, host dispatch, long-running commands, measured usage limits, raw cross-provider comparisons and unsupported opt-ins. Add the ADR/index row and update reference sections affected by dispatch/manual verification; change tier documentation only if tier behavior actually changes. Update connected content tests without weakening their underlying safety assertions.

### Success Criteria:

#### Automated Verification:

- Skill/prompt tests prove shared host dispatch, equal Anti-stall rules, portable wired instructions, nesting prohibition and fail-closed archive approval on both chains.
- Router tests prove durable PR-comment opt-in/reset/resume behavior and actionable capability refusals without unauthorized dispatch or posting.
- Prompt/evidence tests prove OpenAI browser fallback records truthful reasons and never accepts invented browser proof; packaging checks retain shared skills and unchanged version fields.
- Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 4: Verification

### Overview

Prove complete chain behavior and identify live support limits with inspectable evidence.

### Changes Required:

#### 1. Integration matrix and acceptance evidence

**Files**: `skills/10x-pipeline/test/providers.test.mjs`, `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/openspec-chain.test.mjs`, `skills/10x-pipeline/test/openspec-isolation.test.mjs`, `skills/10x-pipeline/test/rollback.test.mjs`, `skills/10x-pipeline/test/README.md`, `context/changes/openai-codex-support/evidence/`

**Intent**: Connect the new execution boundary to real router decisions and the existing git recovery machinery, with paid/live checks kept out of CI.

**Contract**: Use scratch projects and fake Codex output to cover Claude-compatible defaults, OpenAI-only policies and Claude-hosted mixed escalation on both chains. Exercise successful steps, a failed step followed by rollback/escalation, neutral retry with policy drift, completion and guarded archive, plus provider-bearing status/report/comparison. Real native Claude dispatch belongs in live acceptance, not a simulated assertion that Agent was called. A router smoke must actually return `action: "run"` with a step; halt-shaped JSON is not a successful smoke.

Save commands, CLI/plugin revisions, selected models/efforts, outcomes and limitations in evidence files inside this change. Never include credentials or raw private transcripts. Existing live GitHub tests stay human-run; do not use a pipeline smoke to send an unsolicited message/comment or merge a branch.

### Success Criteria:

#### Automated Verification:

- Both-chain scratch integration tests prove OpenAI execution, mixed-provider escalation, neutral retry, isolation/rollback and guarded archive without live model calls.
- Scratch CLI smoke returns a real run action and readable status for both chains under the GPT overlay, including the documented no-isolation override.
- Final checks pass: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `node tools/version-check.mjs`.

#### Manual Verification:

- Live Codex-hosted 10x and OpenSpec scratch runs discover installed shared skills/dependencies, execute the selected model/effort and produce verified artifacts plus provider-bearing usage reports.
- Live Claude-hosted mixed-provider scratch runs on both chains hand a GPT step through the shared runner, retain native Claude dispatch and complete the same artifact/PR-report workflow without an unsolicited external post.
- Live interruption/resume and archive-gate checks prove no duplicate child launch, clear missing-trust/dependency failures, no automatic trust/sandbox bypass and pending browser rows when covering proof is unavailable.

## Testing Strategy

### Unit Tests:

Validate provider/host fields, compatibility defaults and supported capability combinations at their owning boundaries. Check streamed JSONL framing, final RESULT parsing and cumulative usage arithmetic with source-backed fixtures. Do not assert that every completed Codex item is a tool use.

### Integration Tests:

Reuse the real-router scratch harness and fake-command patterns. Exercise policy validation before writes, provider propagation through normal/retry/archive paths, historical logs, provider-aware comparisons, pending-action identity, process locking and cancellation. Keep existing isolation, co-author, rollback, provenance, archive and prompt-rule coverage intact. Register each new test file in the folder index.

### Manual Testing Steps:

1. Install/discover the compatibility plugin in an isolated Codex configuration and a Claude environment; verify both skill names and required upstream skills. Record the exact tested CLI versions. Establish authentication/trust explicitly before model execution; use existing Codex configuration unless a named `codex.profile` was explicitly selected. Confirm the Phase 2 permission-preflight evidence covers the tested host and real linked-worktree Git paths.
2. Run a small 10x change and a small OpenSpec change under the GPT overlay from Codex. Inspect executed model/effort, real artifacts, latest usage snapshot and report; exercise completion and optional archive in scratch repositories.
3. From Claude, run each chain with an explicitly mixed ladder and observe at least one native Claude dispatch and one GPT runner dispatch. Keep external PR/comment checks within the user's existing authorization; otherwise record local script results and leave external posting unperformed.
4. Exercise missing dependency/trust, failed child, interruption and same-host resume. While a child runs, attempt a second runner/router mutation and verify refusal; then verify lock cleanup after termination.
5. Leave a browser row without covering proof and attempt manual-gated archive with a native question capability absent or declined. Verify the row stays pending and the existing archive approval boundary holds. Review opt-in restricted-agent/advisor refusals.

Manual rows are acceptance checks for the completed feature, not invitations to assume success when the required host, model, dependency or question capability is unavailable. Record failures/limitations and leave the corresponding rows pending.

## Performance Considerations

Each GPT step starts one fresh CLI process. Stream events with bounded memory; keep transcripts outside the worktree so step commits and rollback do not sweep them in. Do not add a separate application timeout shorter than the step's legitimate work; hosts use their supported background command and wait facilities. Calibration of rung ordering, token savings and process overhead is deferred until real evidence exists.

## Migration Notes

This is an additive dispatch contract: missing provider/host fields mean Claude, and old entries are not rewritten. A neutral retry keeps its stored dispatch and prompt; policy changes affect subsequent newly chosen steps. Host identity is fixed for a run, so switching hosts requires a separate run rather than modifying history.

The GPT overlay is explicitly merged/copied by the user and does not silently replace project overrides or Claude defaults. Existing Claude comparison pins and model-keyed prices remain supported. Pipeline invocation forwards PR-comment intent explicitly; old Task-only intent is not imported as authorization.

Users enabling OpenAI execution can keep existing Codex configuration; a named `codex.profile` is optional. This change supplies no permissive configuration and changes no host permissions. A profile name is not proof of capability: failed Git-permission preflight stops before model launch, with no automatic permission broadening.

The implementation overlaps the open changes `pr-comment-flag-in-meta`, `router-bash-timeout`, `skill-dir-variable`, `agent-call-parameters`, `step-prompt-by-file` and `nested-subagent-hard-stop`. Recheck current work before editing overlapping files, absorb only what these contracts require, and do not close or modify those changes automatically. Preserve module import order and use `removeTree` for directory cleanup. Release-please retains sole ownership of all version values.

## References

- Baseline research: `context/changes/openai-codex-support/research.md`; project constraints: `AGENTS.md`; accepted recurring rules: `context/foundation/lessons.md`.
- Router ownership and integration seams: `skills/10x-pipeline/scripts/route.mjs:68`, `:183`, `:355`, `:636`; `state.mjs:118`, `:402`, `:836`; `flow.mjs:354`, `:404`, `:793`, `:826`, `:866`, `:879`; `isolation.mjs:595`; `steps.mjs:293`, `:554`.
- Existing architecture: ADR-006/007 (deterministic dependency-free router), ADR-009 (restricted agents/advisor), ADR-010 (isolation/recovery), ADR-013 (OpenSpec), ADR-014 (manual archive gate), ADR-015 (neutral retry), ADR-018 (no nested delegation), ADR-019 (usage), ADR-022 (validation before writes).
- Codex 0.169.0 local `exec --help` and `features list`, inspected during planning; model-effort support checked against local model metadata for that client. [Official model guidance](https://learn.chatgpt.com/docs/models.md) supports the model roles, not measured rung equivalence.
- Pinned Codex source: [cumulative usage conversion](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L119), [thread total usage](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/app-server-protocol/src/protocol/v2/thread.rs#L2155), [usage inclusion fixture](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/codex-api/src/sse/responses.rs#L895), [exit/approval behavior](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/lib.rs#L846), [configuration schema](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core/config.schema.json), [agent gating](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core/src/config/mod.rs#L1742).
- Current host contracts: [skills and absolute skill paths](https://learn.chatgpt.com/docs/build-skills.md), [subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents.md), [plugin packaging](https://developers.openai.com/plugins/build/plugins.md), [compatibility conversion guide](https://developers.openai.com/plugins/guides/submit-claude-plugin.md), [manifest reference](https://developers.openai.com/plugins/deploy/submission.md). Live installation and enforcement remain Phase 4 acceptance work.
- F1 permission correction: [protected Git paths in workspace-write](https://learn.chatgpt.com/docs/agent-approvals-security#protected-paths-in-writable-roots); local Codex 0.169.0 `exec --help` confirms `-p` configuration profiles, and `sandbox --help` confirms model-free commands with `-p`, `-C` and managed-configuration support. These CLI capabilities do not establish that a particular profile can commit; Phase 2 must prove that.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Provider Contract

#### Automated

- [x] 1.1 Provider tests prove default/legacy Claude behavior, both explicit providers, host validation and write-free rejection of malformed or incompatible inputs. — 49da3cf
- [x] 1.2 Router tests prove provider propagation through normal actions, exact neutral retries, both archive actions, reports, provenance and baseline comparison. — 49da3cf
- [x] 1.3 Preset checks prove eight OpenAI rungs with exactly the approved models/efforts and unchanged shipped Claude defaults and tier indexes. — 49da3cf
- [x] 1.4 Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 49da3cf

### Phase 2: Codex Runner

#### Automated

- [x] 2.1 Fake-CLI tests prove exact argv/stdin/cwd, model/effort pinning, disabled delegation, preserved RESULT fields and zero router-owned state writes. — 96bd62a
- [x] 2.2 Runner tests prove final-snapshot token accounting, omitted tool-use counts, completion/failure distinctions and rejection of stale or malformed actions. — 96bd62a
- [x] 2.3 Process tests prove contention refusal, lock retention until child close, handled cancellation and temporary-file cleanup on both chains including archive moves. — 96bd62a
- [x] 2.4 Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 96bd62a
- [x] 2.5 Permission checks prove selected-profile Git access in a real linked worktree, preserve pre-RESULT commit evidence, and refuse insufficient profiles before model launch. — 96bd62a

### Phase 3: Host Integration

#### Automated

- [x] 3.1 Skill/prompt tests prove shared host dispatch, equal Anti-stall rules, portable wired instructions, nesting prohibition and fail-closed archive approval on both chains.
- [x] 3.2 Router tests prove durable PR-comment opt-in/reset/resume behavior and actionable capability refusals without unauthorized dispatch or posting.
- [x] 3.3 Prompt/evidence tests prove OpenAI browser fallback records truthful reasons and never accepts invented browser proof; packaging checks retain shared skills and unchanged version fields.
- [x] 3.4 Required suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Phase 4: Verification

#### Automated

- [ ] 4.1 Both-chain scratch integration tests prove OpenAI execution, mixed-provider escalation, neutral retry, isolation/rollback and guarded archive without live model calls.
- [ ] 4.2 Scratch CLI smoke returns a real run action and readable status for both chains under the GPT overlay, including the documented no-isolation override.
- [ ] 4.3 Final checks pass: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` and `node tools/version-check.mjs`.

#### Manual

- [ ] 4.4 Live Codex-hosted 10x and OpenSpec scratch runs discover installed shared skills/dependencies, execute the selected model/effort and produce verified artifacts plus provider-bearing usage reports.
- [ ] 4.5 Live Claude-hosted mixed-provider scratch runs on both chains hand a GPT step through the shared runner, retain native Claude dispatch and complete the same artifact/PR-report workflow without an unsolicited external post.
- [ ] 4.6 Live interruption/resume and archive-gate checks prove no duplicate child launch, clear missing-trust/dependency failures, no automatic trust/sandbox bypass and pending browser rows when covering proof is unavailable.
