# TrueNAS CI acceptance

Verified on 15 November 2026 through read-only GitHub APIs, current job logs, focused Node 24 tests, and the owner's confirmation that everything works perfectly on TrueNAS.

## Row 2.3

Six Linux X64 TrueNAS runners are online with the required labels. Main CI run 43703539173 used `truenas-agent-smith-4`, runner version 2.338.2, Node 24.22.3 and Git 2.53.0. Its non-root guard passed. The full test suite passed using the configured writable temporary directory `/mnt/main/lake/github/agent-smith-4/_temp`. The owner confirmed the operational TrueNAS setup in this conversation. Host-only configuration is recorded on that confirmation, together with the independently observed runtime checks.

See `command-host-verification-2026-11-15.json` and `command-runner-log-2026-11-15.txt`.

## Rows 3.2 and 3.3

Same-repository PR #185 CI run 43701664098 passed both jobs on `truenas-agent-smith-3` and `truenas-agent-smith-2`. Main push CI run 43703539173 passed the test job on `truenas-agent-smith-4`. The commit-lint job is intentionally skipped on pushes to main.

[Same-repository PR CI](https://github.com/xycu/agent-smith/actions/runs/43701664098) · [Main push CI](https://github.com/xycu/agent-smith/actions/runs/43703539173)

## Rows 3.5 and 3.6

The read-only fork-approval API returned `all_external_contributors`. ADR-020 records the dated reading, command and Progress row 3.5. Its earlier `first_time_contributors` value remains documented as historical evidence. The evidence was collected through read-only API requests.

## Conditional row 3.4

All 177 available pull-request records were checked. The available fork PR count is zero, resolving the conditional live-fork row as not applicable. A script evaluated each current job's actual runner-selection expression for a main push, same-repository PR, external fork PR and missing head-repository name. All eight checks passed. External fork cases select `ubuntu-latest` for both jobs. Live fork execution remains unobserved.

See `command-fork-availability-2026-11-15.json` and `script-fork-fallback-2026-11-15.json`.

## Current checks

The release-gate, CI-runner and workflow-pin suites passed 39 tests with zero failures or skips on Node 24.19.0. Version check passed at 1.11.2. Actionlint passed for both workflows. Current main CI passed the complete repository suite. All pending TrueNAS acceptance rows are resolved, with the conditional fork row recorded as not applicable to available PRs.
