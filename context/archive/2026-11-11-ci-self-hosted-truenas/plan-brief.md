# Run CI on self-hosted TrueNAS runners — Plan Brief

> Full plan: `context/changes/ci-self-hosted-truenas/plan.md`

## What & Why

Run the CI jobs of `.github/workflows/ci.yml` on self-hosted runner instances on TrueNAS instead of GitHub-hosted runners, to use the owner's own hardware.

## Starting Point

`ci.yml` has two jobs (`test`, `commits`), both on `ubuntu-latest`. The repository is public, so fork pull requests could run untrusted code on a self-hosted runner. `release.yml` also uses `ubuntu-latest`.

## Desired End State

Same-repo PRs and pushes to `main` run both jobs on runners labelled `self-hosted, linux, truenas`. Fork PRs run on `ubuntu-latest`. An ADR records the decision and the runner prerequisites.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runner labels | `self-hosted`, `linux`, `truenas` | Standard auto labels plus one that names the host; none given, so assumed | Plan (assumption) |
| Fork PRs | Fall back to `ubuntu-latest` via a `runs-on` expression, plus the repo setting "Require approval for all external contributors" | Public repo: the fallback is defence in depth only (a fork PR can edit `runs-on`); the approval setting is the boundary | Plan |
| `release.yml` | Stays hosted | Holds a write token; goal names CI only | Plan |
| Node 24 | Keep `actions/setup-node` | Keeps the requirement in the workflow; no new action, pins stay green | Plan |
| Guard | `tools/test/ci-runner.test.mjs`, plain text | Matches `workflow-pins.mjs` style, no YAML parser | Plan |
| Fork approval value | `all_external_contributors`; the owner sets it, an agent only reads it (row 3.5) and records it in ADR-020 (row 3.6) | Measured `first_time_contributors` lets a returning fork contributor run unapproved; ADR-020 D2 already names the stricter value; agents never change repository settings | impl-review F1 (re-plan) |

## Scope

**In scope:** `ci.yml` runner selection, a guard test, ADR-020, two stale doc lines, a read-only check of the fork approval setting and its record in ADR-020.

**Out of scope:** installing runners, `release.yml`, caching, container jobs, autoscaling.

## Architecture / Approach

One ternary in each job's `runs-on`: fork PR gives `ubuntu-latest`, everything else gives the label array. A test reads the YAML as text and pins that shape.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Switch ci.yml | New `runs-on`, guard test | Expression typo; only a real run proves it |
| 2. Docs | ADR-020, ADR-008 and AGENTS.md edits; F2/F3 fixes (`b8541af`), row 2.4 pins F2 | Prerequisites differ from the real runners |
| 3. Prove on a runner | Owner sets fork approval (3.5), ADR-020 records it (3.6), owner checks runners and a PR run | Setting still `first_time_contributors`: the implement step reports `blocked` and the run halts for the owner |

**Prerequisites:** runners registered to `xycu/agent-smith` with the three labels; fork approval policy at `all_external_contributors` (owner).
**Estimated effort:** ~1 session for phases 1-2, then one PR run for phase 3.

## Open Risks & Assumptions

- Labels are assumed; adjust `runs-on` and the test if the runners use others.
- Runners need `git`, a writable temp dir and outbound HTTPS for Node 24 (or Node preinstalled).
- Jobs queue if every runner is offline.
- Until the owner switches the fork approval setting, a returning fork contributor can reach the NAS; the six runners are already online.

## Success Criteria (Summary)

- Both CI jobs pass on the TrueNAS runner for a same-repo PR and for `main`.
- A fork PR run reaches the NAS only after the owner approves it (approval setting on); an honest fork PR runs on `ubuntu-latest`.
