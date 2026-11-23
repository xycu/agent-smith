# Release gate acceptance

Verified on 15 November 2026 through GitHub APIs, a controlled existing-workflow rerun script, and focused Node 24 tests.

## Rows 3.4 and 3.5

CI run 43657049140 on main commit `7c0a2ba12742ac91ccf84873608a7761dea9e4d5` failed on attempt 1 and succeeded on attempt 2. The failure finished at 00:18:46 UTC. Release run 43657545608 was created at 00:18:48 UTC and skipped its sole job with zero executed steps. The skipped job performed no release-please PR or tag operation. The successful CI rerun finished at 00:26:00 UTC. Release run 43658140604 started at 00:26:03 UTC and completed successfully.

The API snapshots are retained in `command-failure-and-rerun-2026-11-15.json`. The original skipped attempt was captured before the controlled concurrency rerun.

[Failed CI attempt](https://github.com/xycu/agent-smith/actions/runs/43657049140/attempts/1) · [Successful CI rerun](https://github.com/xycu/agent-smith/actions/runs/43657049140/attempts/2) · [Original skipped release](https://github.com/xycu/agent-smith/actions/runs/43657545608/attempts/1) · [Release after the successful rerun](https://github.com/xycu/agent-smith/actions/runs/43658140604)

## Row 3.6

A script reran existing Release workflows after checking that no release PR was pending. Both valid jobs use the identical job-level `release-please` concurrency configuration.

| Observation | UTC time |
| --- | --- |
| Run 43704056262 attempt 2 executing | 11:14:45 |
| Run 43703229308 rerun observed queued | 11:14:50 |
| Skipped run 43657545608 attempt 2 job created | 11:14:52 |
| First valid release job completed successfully | 11:14:54 |
| Previously queued valid release job started | 11:14:55 |
| Previously queued valid release job completed successfully | 11:15:02 |

The skipped run completed while the second valid run was pending. The pending run then executed and succeeded. Assertions checked these timestamps, queue state and conclusions against API responses. Complete observations are in `script-release-queue-2026-11-15.json`.

[Active release](https://github.com/xycu/agent-smith/actions/runs/43704056262/attempts/2) · [Queued valid release](https://github.com/xycu/agent-smith/actions/runs/43703229308/attempts/2) · [Skipped release](https://github.com/xycu/agent-smith/actions/runs/43657545608/attempts/2)

## Current checks

The release-gate, CI-runner and workflow-pin suites passed 39 tests with zero failures or skips on Node 24.19.0. Version check passed at 1.11.2. Actionlint passed for both workflows. The current main CI run 43703539173 passed the complete repository suite. Accepted runtime and workflow sources match main at `87fd022`.

All previously pending release-gate rows have verified outcomes. Historical run reports retain the state recorded by their original pipeline executions.
