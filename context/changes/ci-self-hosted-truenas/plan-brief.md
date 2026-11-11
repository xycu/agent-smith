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
| Fork PRs | Fall back to `ubuntu-latest` via a `runs-on` expression | Public repo: fork code must not reach the NAS | Plan |
| `release.yml` | Stays hosted | Holds a write token; goal names CI only | Plan |
| Node 24 | Keep `actions/setup-node` | Keeps the requirement in the workflow; no new action, pins stay green | Plan |
| Guard | `tools/test/ci-runner.test.mjs`, plain text | Matches `workflow-pins.mjs` style, no YAML parser | Plan |

## Scope

**In scope:** `ci.yml` runner selection, a guard test, ADR-020, two stale doc lines.

**Out of scope:** installing runners, `release.yml`, caching, container jobs, autoscaling.

## Architecture / Approach

One ternary in each job's `runs-on`: fork PR gives `ubuntu-latest`, everything else gives the label array. A test reads the YAML as text and pins that shape.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Switch ci.yml | New `runs-on`, guard test | Expression typo; only a real run proves it |
| 2. Docs | ADR-020, ADR-008 and AGENTS.md edits | Prerequisites differ from the real runners |
| 3. Prove on a runner | Owner checks runners and a PR run | Runner offline or lacks git or internet |

**Prerequisites:** runners registered to `xycu/agent-smith` with the three labels.
**Estimated effort:** ~1 session for phases 1-2, then one PR run for phase 3.

## Open Risks & Assumptions

- Labels are assumed; adjust `runs-on` and the test if the runners use others.
- Runners need `git`, a writable temp dir and outbound HTTPS for Node 24 (or Node preinstalled).
- Jobs queue if every runner is offline.

## Success Criteria (Summary)

- Both CI jobs pass on the TrueNAS runner for a same-repo PR and for `main`.
- A fork PR never lands on the NAS.
