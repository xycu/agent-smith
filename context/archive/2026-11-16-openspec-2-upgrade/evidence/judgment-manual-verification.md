# Manual verification attempt

Candidate examined was 5e8fc8f8f1e762850da1774d32bfaa27f826929a on agent-smith/openspec-2-upgrade, on 2026-11-16.

## Row 3.4

> Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded.

The current host catalog lists the twelve generated OpenSpec skills. The accompanying script and output independently verify twelve canonical skills with generatedBy "2.0.0" and resolving relative Claude links. This establishes the installed integration metadata.

The acceptance record identifies cells 3, 4, 7, 8, 11 and 12 as pending, spanning Claude interactive/headless, mixed-provider interactive/headless and Codex interactive/headless launches. Each requires a fresh normal-entry run, collected nonce, recovery, restrictions and usage evidence. This verification invocation supplies one host context and no completed normal-entry matrix run.

The plan's native procedure requires a disposable change with valid spec/tasks, router advancement and staged/working recovery. The pipeline skill's normal loop writes results and calls next. route.mjs writes meta.json, and state.mjs owns run.jsonl and last-result.json. Those writes exceed this step's plan/evidence-only write permission. The normal pipeline additionally reaches Git writes and terminal publication, which this step prohibits. No acceptance pipeline was launched.

The existing codex-chain.test.mjs explicitly states "Real router and Git recovery through the fake Codex process. Native Claude dispatch remains live acceptance." Its native branch states "no assertion that Agent was called." Re-running that fixture cannot establish the required six live launches. No automated test found covers the full row. Account, quota and trust readiness remain unmeasured.

Judgment is to leave 3.4 pending. The prerequisite is a controller-authorized normal-entry acceptance context for each of the six cells, permitting disposable-change/router/recovery writes and retaining actual host/provider/usage evidence. The existing acceptance matrix records each cell's concrete launch prerequisites.

## Row 3.5

> The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof.

The plan states "The step has no publication authority. External PR, CI and report-comment acceptance occurs in the enclosing orchestrator's terminal handling and remains Manual here." The acceptance record retains the same pending handoff. This step explicitly forbids push, gh, equivalent publication APIs and indirect invocation of publication scripts.

Local fake-client tests cover publication behavior but supply no actual push, PR CI or posted report. No external handoff was attempted or verified in this invocation. Judgment is to leave 3.5 pending for the enclosing orchestrator's authorized terminal publication and actual PR/CI/comment evidence.

## Scope and reproduction

Run from the absolute run root.

    node context/changes/openspec-2-upgrade/evidence/script-manual-preflight.mjs

Output is retained in script-manual-preflight-output.txt. The script reads project files and uses read-only Git commands. No source edits or plan ticks were made. Existing Automated rows were preserved. The full suite was not rerun because neither pending claim is covered by its simulated execution/publication fixtures.
