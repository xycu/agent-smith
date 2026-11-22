# Self-hosted CI hardening — plan brief

[Full plan](plan.md) · [Owner decision](frame.md)

## What & Why

The owner chose to keep CI on TrueNAS. Each of six test shards currently installs OpenSpec from an unlocked npm dependency tree. A transitive install script can therefore execute on the home NAS before the tests begin.

## Starting Point

One workflow line controls all six installs. CI checks the exact version of the binary from each fresh prefix and exercises it on real contract fixtures. The local runner test captures the install arguments using a stub. ADR-020 records a fork approval check from November 15, 2026. D4 describes the intended LAN isolation. [Workflow](../../../.github/workflows/ci.yml#L52) · [ADR-020](../../../docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md)

## Desired End State

Each shard gets a working OpenSpec 2.0.0 without running lifecycle scripts from an unlocked tree. A reader of ADR-020 can identify the checked GitHub policy, the evidence date, the home-network services reachable from a job and the risk accepted for same-repository branches.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runner placement | Keep TrueNAS for pushes to main and same-repository PR CI | The owner accepts execution by repository writers and their automation | Frame |
| Install | Add `--ignore-scripts` to the shared install command | One change covers six shards | Frame, workflow |
| Compatibility fallback | Only for a confirmed required hook, review and commit the CI-only manifest and lock under `.github/ci/openspec/` and install with `npm ci` in the fresh prefix | The resolved tree is fixed and the router stays dependency-free | Frame, ADR-006, plan |
| Evidence | Date each owner-checked setting and describe actual runner reach | The approval policy may drift and workflow code cannot establish LAN connectivity | Frame, ADR-020 |

## Scope

The primary patch affects one install line, two existing install assertions, Amendment 3 to ADR-020 and its index entry. Runner selection, action pins, settings administration and network configuration are outside the patch.

## Architecture / Approach

The workflow installs into job-local storage, verifies the pinned binary and passes its absolute path to the suite. Fork approval and owner review protect a different boundary. Same-repository write access still permits code execution on the NAS. Disabling install hooks also leaves the risk of dependency code running when the CLI is invoked.

## Phases at a Glance

| Phase | Deliverable | Evidence |
| --- | --- | --- |
| 1. Disable install scripts | Shared install line and two updated assertions | Run only `node --test tools/test/ci-runner.test.mjs` locally |
| 2. Record and verify the boundary | Indexed ADR amendment with operational evidence | Check the heading and index locally. Owner confirmation and green PR CI are manual acceptance. |

**Prerequisites and effort.** One small workflow patch and one documentation amendment. Owner input and the published CI run determine elapsed time.

## Open Risks & Assumptions

The dated November 15 policy value is historical. Any later reading and the list of reachable LAN hosts and services must come from the owner. Missing evidence stays visibly pending. If a confirmed install-hook dependency requires test edits beyond the two authorized assertions, the owner decides whether to widen that scope.

## Success Criteria (Summary)

- Local verification passes for the focused runner test and the indexed amendment.
- The owner confirms each stated setting, check date, network reach and accepted risk.
- After publication, all six CI shards pass, each install reports OpenSpec 2.0.0, and the five real contract cases run and pass.
