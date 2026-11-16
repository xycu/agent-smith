# Manual publication verification

Rechecked on 2026-11-16 against local revision `768a802b` after reading the earlier `unproven.md`.

## Claims checked

> 1.4 After local verification and pipeline reviews, the authorized orchestrator pushes the run branch, opens or retains a reviewable pull request and records its URL and successful PR CI result.

> 1.5 The authorized orchestrator posts or updates the requested run-report comment on that pull request and records its URL with the actual local test results and any remaining acceptance items.

## Observations

Read-only Git inspection identifies branch `agent-smith/compare-damaged-logs-not-comparable` and repository `xycu/agent-smith`.

Fresh GitHub connector searches used `search_prs` with the exact head query and an alternative `"damaged" in:title` query, both scoped to `xycu/agent-smith` and state `all`. Both succeeded with `{"issues":[]}`. An independent `git ls-remote --exit-code --heads` check for the exact run branch exited 2 with no matching ref. Exact requests, responses and command results are saved in `command-publication-recheck.md`. No matching pull request was returned, so there was no PR URL, successful PR CI result or report-comment URL to inspect.

The existing implementation evidence explicitly states, “Manual acceptance remains pending for orchestrator-owned publication, successful PR CI, and the requested run-report comment. Progress rows 1.4 and 1.5 retain their pending state.” A search of the change Markdown artifacts found no recorded GitHub PR or comment URL.

The comparison owner was inspected in `route.mjs`. Its side-specific integrity guard and verdict calculation address local comparison behavior. They cannot establish remote publication, PR CI or comment delivery. Existing local test results therefore cannot prove these Manual claims.

## Judgment

Neither row is proved. Both remain unchecked. The remote run branch was absent and both searches returned no PR at verification time. The missing publication, CI and comment artifacts prevent proving the quoted claims. The manual-verification rules reserve publication and report posting for the orchestrator. No tests were rerun because these rows require actual external delivery evidence. The existing local verification report remains historical evidence of the implementation gates.
