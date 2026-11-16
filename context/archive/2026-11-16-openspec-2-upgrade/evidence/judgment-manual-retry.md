# Manual verification retry

Examined candidate `684621fad9ffbada7f20b30b6a70f8997837b996` on branch `agent-smith/openspec-2-upgrade` on 2026-11-16. Read the prior unproven record before inspecting the plan, change identity, acceptance and verification records, pipeline instructions, router state writes, OpenSpec reader, Codex runner and fixture scope.

## Row 3.4

> Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded.

The saved acceptance matrix still identifies cells 3, 4, 7, 8, 11 and 12 as pending. It says each cell needs a fresh trusted normal-entry launch with retained child nonce, settlement, recovery, restriction and usage evidence. The current host catalog exposes the twelve upgraded OpenSpec skills. Reran `node context/changes/openspec-2-upgrade/evidence/script-manual-preflight.mjs` successfully on this candidate. Its retained source and refreshed output verify twelve canonical skills with `generatedBy` equal to `2.0.0`, each with a resolving project-relative Claude link. See `script-manual-preflight.mjs` and `script-manual-preflight-output.txt`.

The existing chain fixture explicitly states the following scope.

> Real router and Git recovery through the fake Codex process. Native Claude dispatch remains live acceptance.

> This is an artifact/result fixture for native dispatch, with no assertion that Agent was called.

These fixtures cannot establish the six actual host/provider launches. The normal pipeline loop persists results and advances the router. `route.mjs` calls `attachResult`, `stepCommit`, `rollback` and metadata writers in that path. The native procedure additionally requires disposable change artifacts and independently staged/working recovery specimens. This step permits writes only to this plan and its evidence directory and permits only read-only Git. Launching that procedure would exceed those specific restrictions. No live cell was launched in this retry. Trust, account, quota, effective native restrictions and inclusive usage were unmeasured.

Leave 3.4 pending. Each cell needs an authorized normal-entry acceptance context that permits its disposable change, router and recovery writes, plus its matrix-specific trusted host/provider prerequisites. Existing discovery metadata supplies a partial observation. Full native ownership and recovery acceptance remains outstanding.

## Row 3.5

> The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof.

The plan states the following ownership.

> The step has no publication authority. External PR, CI and report-comment acceptance occurs in the enclosing orchestrator's terminal handling and remains Manual here.

Tried an additional read-only proof through the connected GitHub search tool, using `mcp__codex_apps__github_search_prs` with these arguments.

```json
{"query":"head:agent-smith/openspec-2-upgrade","repository_full_name":"xycu/agent-smith","state":"all","topn":10}
```

The connector completed successfully with `isError` equal to `false` and returned this structured content.

```json
{"issues":[]}
```

The search supplied no matching PR whose head, CI and report comment could be checked. This result establishes the observed search outcome. External handoff acceptance remains unproved. No publication action was performed. `open-pr.mjs` contains commit and push operations, so invoking it would violate this step's publication and read-only Git restrictions. Local fake-client coverage cannot establish actual PR CI or a published report comment.

Leave 3.5 pending for authorized orchestrator publication and retained PR/head, successful CI and report-comment evidence.

## Decisions and remaining scope

Applied the supplied plan/evidence-only and read-only Git restrictions to every proposed acceptance launch. Kept both pending Manual rows unchanged and preserved all completed rows. No existing automated test covers either full live acceptance claim, so the simulated fixture suite was not rerun. No source files, router-owned state or Git refs were written by this attempt. The pre-existing router-owned `run.jsonl` modification remains outside this step's edits.
