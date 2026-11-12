# Run the CI jobs as a non-root user (ADR-020 D4) — Plan Brief

> Full plan: `context/changes/ci-runner-non-root/plan.md`

## What & Why

ADR-020 requires a non-root service user on the TrueNAS runners, but CI runs as uid 0. Model-written code on `agent-smith/<id>` branches runs there with no approval step, and two `removeTree` safety tests skip for root. The plan adds a fail-closed guard to the `test` job and aligns the docs; the runner fix itself is an owner action.

## Starting Point

`ci.yml` job `test` starts with checkout and has no user check. ADR-020 D4 states the prerequisite but nothing enforces it. `tools/test/ci-runner.test.mjs` already pins the `runs-on` lines in plain text.

## Desired End State

A root runner fails the `test` job at its first step with an error naming ADR-020. After the owner's fix, a CI run on the TrueNAS runner passes as non-root and the two privileged-skip tests run. ADR-020 and `AGENTS.md` describe the guard.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Guard placement | First step of `test`, before checkout | Fails before any PR code runs; matches `change.md` "Fix direction" 2. |
| Guard scope | `test` job only | The goal names it; both jobs share the runner user, so one fix covers both. |
| Guard test | Plain-text order check plus a stub-`id` run of the extracted command | Proves it fails for uid 0 without being root; no YAML parser (repo style). |
| ADR change | Amendment 1 plus D4 line edit | Same shape as ADR-008 and ADR-010 amendments; records the finding without claiming a fix. |
| Row 2.3 of `ci-self-hosted-truenas` | Not edited here | Ticks only after CI evidence, as `change.md` says. |
| Merge order | Owner fixes runner before merge | A root runner turns `main` CI red and holds back `release.yml`. |

## Scope

**In scope:** guard step, two tests, ADR-020 amendment, `AGENTS.md` clause, owner Manual rows.

**Out of scope:** runner setup, `commits` job guard, privileged-skip test edits, `release.yml`, skip-count check.

## Architecture / Approach

One `run: test "$(id -u)" -ne 0 || { echo "::error::…"; exit 1; }` step. The test extracts it from `ci.yml` and runs it under `sh` with a stub `id`. Docs follow.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard, tests, docs | Step in `ci.yml`, two tests, ADR-020 amendment, `AGENTS.md` clause | Stub-`id` test must not rely on a recursive delete or the host `id` |
| 2. Owner fix and CI proof | Non-root runner, CI log evidence, `skipped` down by 2 | Red `main` CI if merged before the runner is fixed |

**Prerequisites:** owner access to the TrueNAS hosts for Phase 2.
**Estimated effort:** ~1 session for Phase 1; Phase 2 depends on the owner.

## Open Risks & Assumptions

- Unknown whether uid 0 is the host or a container; the guard detects, the owner decides the fix.
- Assumed that the guard in `test` alone is enough; `commits` shares the runner user.
- Assumed the local developer machine is non-root, so the whole suite runs locally.

## Success Criteria (Summary)

- A root runner fails the job; a non-root runner and the hosted fallback pass.
- The local suite passes and the workflow change is reviewed.
- Phase 2 evidence (non-root log, two tests un-skipped) is gathered by the owner, not claimed by the plan.
