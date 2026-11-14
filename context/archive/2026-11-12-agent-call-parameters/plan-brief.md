# Agent Call Parameters — Plan Brief

> [Full implementation plan](plan.md)

## What & Why

The Agent-call correction is implemented, but its full-suite gate failed on a runner-lock shutdown timing race. This revision finishes verification and commit recovery without repeating the delivered correction or claiming unavailable live Claude acceptance.

## Starting Point

Commit `43e28f3` captured the correction after the implementation worker reported leaving it uncommitted. Completed rows 1.1–1.3 and their evidence remain intact. The blocking test waits only 350 ms before the fake child closes, so a later router process can legitimately see a released lock; a second retention test has the same pattern at 250 ms.

## Desired End State

Every Claude step has description `agent-smith <change-id> step <n> <step>`, and archive has `agent-smith <change-id> archive`. OpenSpec uses its change name as the identifier. Agent calls include the background flag only when the exposed schema declares it. Per-invocation records establish ownership for completion and both on-time and late usage. Known agent ids take precedence and require consistent descriptions. Description fallback requires one unique compatible launch, including across neutral retries, and can associate an id first received in a notification when the launch returned none.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Description ownership | Construct from existing router action fields in Loop step 2 | Fits the assigned skill region and existing interface | Plan, router dispatch |
| Background flag | Set false when exposed, otherwise omit | Fits both schemas described by the request | Change request |
| Archive description | Define its override in Loop step 2 | Archive step 3 already reuses these parameters | Plan, current skills |
| Completion and usage | Match known agent ids first, require consistent descriptions, and allow a unique exact-description fallback compatible with recorded ids | Neutral retries reuse descriptions and earlier usage can arrive during a newer step | Change request, ADR-018, ADR-019, implemented skill contract |
| Provider behavior | OpenAI actions use the shared runner and its current envelope handling | Preserves the explicit provider-dispatch requirement | User instruction, current skills |
| Verification | Deterministic fixture release, focused regression checks and a completed full suite at concurrency 2 | Remove the race without weakening locking assertions | Saved failure evidence, fixture and runner code |
| Commit recovery | Reuse `43e28f3`; commit scoped recovery after green automated gates | The final-run commit already holds the implementation | Git history, current skills |
| Live acceptance | Keep Manual 1.6 pending; add an automated handoff check | No Claude Agent tool or nested-launch authority is available | No-nesting instruction, unproven.md |

## Scope

The implementation owns Loop step 2, anti-stall rules 1 and 6, and all terminal late-usage paragraphs in both skills. It also covers related assertions in `skill-loop.test.mjs`, `agents.test.mjs` and the current OpenSpec test path, `skills/openspec-pipeline/test/openspec-skill.test.mjs`. Documentation edits cover the relevant reference paragraphs, ADR-018's orchestrator identity and ADR-019's usage-number guidance.

Recovery adds only the unassigned fixture/test surface: `codex-helpers.mjs`, `run-lock.test.mjs`, `codex-runner.test.mjs`, and existing test-index descriptions if needed. Reuse the fixture's `terminating` and `release` markers to control when the child closes; preserve other consumers and production timeouts.

Sibling changes own isolation setup, CI scratch, test Git environments, router state writes and comparison accounting. `WAVES.md` belongs to post-wave maintenance. Router-generated description fields, policies, permissions, versions and archived content are outside the planned edit surface.

## Architecture / Approach

The implemented Claude dispatch branch adapts the call to the tool schema and records each invocation separately. Its usage ownership guard governs Loop step 4, so only the current invocation's matched figure enters the current result. An earlier step's figure follows its late-usage path. Shared anti-stall rules reject conflicting metadata, ambiguous description-only notifications and completions from superseded invocations. A unique description still matches when the launch returned no id. Each terminal late-usage paragraph uses the same launch records to recover the earlier numbered step before the current cutoff. OpenAI actions continue through their runner process and normalized-result path.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Correct Agent calls and notification correlation | Retain the implementation; synchronize cancellation tests, finish the full suite, prepare handoff and commit recovery | Preserve lock-through-close assertions and keep live acceptance separate |

Execute new row 1.7 before full-suite row 1.4, prepare handoff row 1.8, then close out and commit under 1.5. Keep existing indices and completed rows unchanged. Prerequisites are the current implementation checkpoint and worktree-local scratch isolation. Estimated effort is one bounded fixture correction plus regression execution; live acceptance remains a separate top-level session.

## Open Risks & Assumptions

- The unattended instruction delegates design choices. One phase uses the exact description formats and current action fields established by the request and repository.
- A Claude executable exists on `PATH`, but this session exposes no Claude Agent tool and prohibits nested agents. Manual row 1.6 stays pending until its required live evidence exists.
- A wrong existing number can receive usage silently. Unmatched or ambiguous notifications remain unattached.
- Scratch checks use worktree-local `TMPDIR` and `GIT_CEILING_DIRECTORIES`, with runner output outside individual fixture roots. Preserve safe deletion and sibling-owned Git helpers.
- The runner still forces termination after five seconds. Tests must release explicitly after bounded retention assertions, require child `exitCode === 0` and `signal === null` after release, and await cleanup on failure. Include the cancellation envelope in failure diagnostics. A real runtime defect remains a blocker for the gate.

## Success Criteria (Summary)

- Written calls handle either Agent schema and assign the required step and archive descriptions.
- Completion and late usage use the recorded launch identity, with existing OpenAI dispatch protected by regression tests.
- All seven Automated rows are proved, including the new synchronization and handoff checks; the full suite must reach a zero-failure terminal summary.
- Recovery is committed through the later implementation workflow. Manual 1.6 stays pending until actual top-level Claude evidence exists; planning itself creates no commit.

## References

- [Change request](change.md)
- [Failure evidence](evidence/automated.md) and [exact test output](evidence/run-lock-failure.tap)
- [Shared cancellation fixture](../../../skills/10x-pipeline/test/codex-helpers.mjs)
- [Wave 4 ownership](../WAVES.md#wave-4-run-state-and-isolation-setup-6)
- [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md)
- [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
