# Claude Run-Root Write Preflight Implementation Plan

## Overview

In agent-smith 1.15.0, `init` routed step 1 from a Claude Desktop session in a sibling worktree, but the host refused writes into the selected run root and no step ran. A separate manual-verify step reported its `plan.md` and `evidence/` write limit, leaving a paid evaluation row unproven. [Frame brief](frame.md)

The run root selected by `prepare-run` can fall outside the Desktop session's worktree boundary or inside a shared worktree's protected `.claude/` directory. Add an explicit host Write check before `init` so either denial stops startup with the affected path and a way to resume.

## Current State Analysis

| Frame hypothesis | Evidence and finding |
| --- | --- |
| Plugin hooks refuse Write | The plugin registers a Bash guard. Its headless Claude runner controls different sessions. No plugin Write allowlist governs this refusal. |
| Settings hooks refuse Write | The observed terminal integration hooks returned success. Target-project settings were not inspected, and the captured errors identify worktree ownership. |
| Desktop host refuses Write | Transcripts show two rules, one for another worktree and one for `.claude/` in a linked session. Archived reports record the linked-session recovery in the owner session. |
| Placement triggers the rules | Setup can select a sibling worktree or create a worktree nested under the caller's `.claude/`. Git registration does not establish Desktop session ownership. |
| Manual verification limits writes | Its prompt explicitly limits in-run edits to `plan.md` and `evidence/`. This explains the second reported observation. |
| Startup and result intake hide the cause | Shell setup can succeed under a session whose Write tool refuses the same path. The result write can then fail before `next` has anything to consume. |

The literal errors settle the host diagnosis. The frame also records a separate Bash denial on the Git worktree index lock. Existing readiness gates own dependencies and readiness, and existing permission checks own Git directory access. [Frame brief](frame.md)

### Key discoveries

- Both pipeline skills validate the selected root and change inputs between `prepare-run` and `init`. Setup resolves fresh, attached and existing roots, including nested project prefixes. [10x Start](../../../skills/10x-pipeline/SKILL.md#start) · [OpenSpec Start](../../../skills/openspec-pipeline/SKILL.md#start) · [Setup selection](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L302)
- `init` creates the runtime directory and can write metadata, commit inputs and route a step. The check needs to run before that call. The live change directory is already available at that point. [Router init](../../../skills/10x-pipeline/scripts/route.mjs#L1087)
- Both skills already use exclusively owned transient files for late usage. Result intake uses `last-result.json` and preserves an already persisted completion when a stale file survives. [10x late usage](../../../skills/10x-pipeline/SKILL.md#late-usage-before-every-end) · [Result intake](../../../docs/REFERENCE.md#state-publication-and-log-recovery)

## Desired End State

On Claude, each invocation checks Write in the resolved change directory after setup and before `init`. Success clears the check and continues the existing flow. Failure reports the path, the tool's reason and the appropriate session recovery, then stops before a step is routed. If a real result write fails later, the current invocation stops with the result path and retains enough context to recover the same step safely.

## Scope Boundaries

This change covers the two skill entry points, result-write refusal handling, contract tests and operator documentation. Worktree placement, standalone CLI contracts and run records retain their existing formats. Dependency installation, manual-verify scope, Git directory permissions and Desktop host policy belong to their existing owners.

## Implementation Approach

Use the orchestrator's native Write tool as the capability check. Directory names, Git metadata and a shell filesystem probe cannot identify the Desktop session's effective Write rules. Checking at the skill boundary avoids a guessed session-type flag or a new router state contract. Apply the check by actual Claude orchestrator host, independent of routed provider, isolation mode or whether the selected root equals the current root. Codex keeps its existing startup path.

### Open risks and assumptions

- **Planning decision.** Keep the current run placement and start/stop at the skill boundary. The frame documents two independent host denials and a working owner-session recovery, and setup already has established branch and retry semantics. Relocation would change those semantics without proving host access. [Frame brief](frame.md) · [Worktree isolation ADR](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
- **Probe coverage.** A successful Write proves the tested directory and file operation in the current session. It does not prove child-session permissions, a specific result filename or future host availability. Handle actual result-write failure and verify the Desktop behavior manually.
- **Recovery.** Keep the prepared run and original inputs on preflight denial. Retrying in an authorized session may take the ordinary reuse path, so the original inputs can remain under the existing cleanup contract. Start or resume in the session that can Write to the reported root. An owner of the containing worktree can retry a linked-session refusal. A sibling session must leave its isolated workspace and use a session with access to the selected root. [Setup cleanup contract](../../../skills/10x-pipeline/SKILL.md#start) · [Frame brief](frame.md)

## Phase 1: Gate Claude writes and preserve recovery

### Overview

Fail before `init` when the orchestrator cannot Write in the prepared change directory. Make a later result-write failure explicit while preserving the pending invocation.

### Changes Required

#### 1. Pipeline startup and result handling

**Files** `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`

**Intent** Check the actual host operation that failed, and surface the same context if Write later refuses the real result.

**Contract** Place the probe after validation of the returned run root and live change inputs and before `init`, on fresh setup and resume. Use one uniquely owned transient file under the selected chain's live change directory, with an absolute path and inert content. Follow the existing transient-file ownership and cleanup pattern. Use only a verified in-root location with a new target that cannot overwrite existing files. Clean up only the owned probe and any empty scratch directory owned by this attempt. Finish cleanup before `init`. A shell operation may manage scratch ownership and cleanup, while only a successful native Write completes the capability check. Use the change directory so a fresh invocation does not need to create `agent-smith/` or touch `last-result.json`, metadata or the log.

**Contract** A denied, unavailable or unconfirmed Write, or failed probe cleanup, stops the invocation before `init`, source cleanup, dispatch or publication. Name the absolute path and bounded tool reason. When the reason identifies a different worktree or protected shared `.claude/`, name that rule and the appropriate session recovery. For other errors, report the actual failure and direct the operator to resolve it in the selected root. Preserve the prepared worktree, branch, source inputs and existing run state. Report any retained transient path on cleanup failure. Keep missing-change and archive lookup guidance in its existing order.

**Contract** Apply one result-write failure rule before any `next` call, covering the native Agent, external-runner envelope and neutral orchestrator-error result paths. After a failed or unconfirmed write, show the affected `resultFile`, tool reason and pending step identity, and retain its validated result or launch-failure information for recovery after execution settles. The invocation stops with the on-disk result bytes and pending step intact. In the authorized session, inspect the pending dispatch and result file first. Resume normal `next` intake only when the file holds the matched result, writing the retained payload with native Write if the matching dispatch is still pending and the path is empty. Treat unverified or conflicting bytes as an owner decision and avoid rerunning `init` to recover a completed child. The existing execution suspension STOP takes precedence while runner ownership is unresolved.

#### 2. Local regression coverage and operator reference

**Files** `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/README.md`, `docs/REFERENCE.md`

**Intent** Keep the two skill contracts aligned and document where an operator should resume. Retire the stale open question about `.claude` protection using the frame's observed Desktop behavior, with the scope of that evidence stated.

**Contract** Add cross-chain assertions for startup ordering, native Write, fresh/resume coverage, cleanup ownership, failure STOP, result-write coverage and suspension precedence. Keep the byte-ceiling checks and adjust only a ceiling that the new instructions exceed by the measured increment. The 10x skill starts with six bytes of headroom. Document the same paths and recovery in Run isolation and result handling. Search current docs for stale descriptions of these flows and update any drift.

### Success Criteria

#### Automated Verification:

- Both skill contracts pass the startup and result-write ordering checks in `node --test skills/10x-pipeline/test/skill-loop.test.mjs`, and a local deliberate removal of the gate fails the new contract assertion.
- Existing setup, reuse and result-intake contracts pass `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/result-persist.test.mjs`.

#### Manual Verification:

- Reproduce the sibling-worktree Write denial in Claude Desktop and verify the new path-specific recovery message stops before `init` or dispatch.
- Reproduce the linked-session `.claude/` Write denial in Claude Desktop and verify the new path-specific recovery message stops before `init` or dispatch.
- Resume a refused run in a Claude Desktop session with Write access and verify the probe is removed, the same prepared worktree is reused, and the first step and its result intake succeed.

## Testing Strategy

### Contract and integration tests

The skill-loop suite verifies the text contract in both chains. Existing real-CLI scratch tests verify that normal setup, reuse and result intake remain compatible. Neither suite exercises the Desktop Write tool.

### Manual testing steps

1. Use a disposable project and the frame's sibling-worktree topology. Record the host version, attempted path and denial. Confirm the prepared worktree and source inputs survive and the failed invocation makes no `init` call, dispatch or result write.
2. Repeat from a linked session sharing another session's worktree with the run under that worktree's `.claude/`. Confirm the different reason and owner-session guidance.
3. With the same branch and run root, rerun in a session that owns or can write the selected root. Confirm the probe leaves no file, setup reuses the prepared worktree, and result intake advances once. Run these checks locally before any publication and record redacted evidence for the Manual rows.

## Performance Considerations

One native Write and bounded scratch setup and cleanup per Claude invocation. The probe needs no network, polling or external process launch beyond existing local file tooling.

## Migration Notes

The pipeline skills own the transient probe and the router continues to own the persistent run records. Existing records, branch registrations, CLI callers and older/newer installations use the same paths and formats. No migration is needed. Revert the skill and reference changes together if necessary. Prepared worktrees and saved state remain available for recovery with the matching plugin version.

## References

- [Issue #243](https://github.com/xycu/agent-smith/issues/243) · [Frame and observed host errors](frame.md)
- [Worktree isolation and cleanup contract](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md) · [Readiness plan](../run-root-worktree-readiness/plan.md)
- [Setup and resume regression tests](../../../skills/10x-pipeline/test/prepare-run.test.mjs) · [Skill contract tests](../../../skills/10x-pipeline/test/skill-loop.test.mjs) · [Result intake tests](../../../skills/10x-pipeline/test/result-persist.test.mjs)

## Progress

> Use `- [ ]` for pending and `- [x]` for completed. Append ` — <commit sha>` when a step lands. Keep row titles stable.

### Phase 1: Gate Claude writes and preserve recovery

#### Automated

- [ ] 1.1 Both skill contracts pass the startup and result-write ordering checks in `node --test skills/10x-pipeline/test/skill-loop.test.mjs`, and a local deliberate removal of the gate fails the new contract assertion.
- [ ] 1.2 Existing setup, reuse and result-intake contracts pass `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/result-persist.test.mjs`.

#### Manual

- [ ] 1.3 Reproduce the sibling-worktree Write denial in Claude Desktop and verify the new path-specific recovery message stops before `init` or dispatch.
- [ ] 1.4 Reproduce the linked-session `.claude/` Write denial in Claude Desktop and verify the new path-specific recovery message stops before `init` or dispatch.
- [ ] 1.5 Resume a refused run in a Claude Desktop session with Write access and verify the probe is removed, the same prepared worktree is reused, and the first step and its result intake succeed.
