# Frame Brief: Keep pull request CI on the self-hosted runner, hardened

> Owner decision record before /10x-plan. The question was how much risk the
> owner accepts on the home NAS, not how to write the YAML (see `change.md`).

## Reported Observation

Every pull request that is not from a fork runs on `["self-hosted","linux","truenas"]` (`.github/workflows/ci.yml:30`, `:81`; the same expression in `pr-title.yml`). The real boundary is a repository setting that nothing in the repository proves. `ci.yml:63` runs `npm install --prefix "$prefix" --no-save --package-lock=false @fission-ai/openspec@2.0.0` with lifecycle scripts and no lockfile.

## Owner Decision (2026-11-21)

**Option A: keep the self-hosted runner and harden it.** Options B (pull request jobs to `ubuntu-latest`) and C (everything hosted, retire ADR-020) were offered and not chosen.

## What the plan must cover

- Add `--ignore-scripts` to the install line at `ci.yml:63`, which six jobs run. Check that `openspec` still runs without its install scripts. If it does not, install from a committed lockfile instead, and the plan names where that lockfile lives (it is a CI test tool, not a router dependency; ADR-006 stands).
- Amend ADR-020: list the repository settings the boundary depends on ("Require approval for all external contributors" and any other the plan finds), the date the owner checked each one, and what the runner can reach on the home network.
- Keep the runner expression and its pins in `tools/test/ci-runner.test.mjs`. The plan may update only the two install-command assertions in that test (line 60, the `assert.match` on the `npm install` text, and line 116, the argv array), because they pin the install line that gains `--ignore-scripts`. Owner-approved 2026-11-22. While developing, run only that test file, not the full suite; CI is the gate.
- Keep the 40-hex SHA pins (`tools/workflow-pins.mjs`).

## Owner actions (by hand, outside the plan)

- Check the repository settings that ADR-020 will list, and give the plan the date of the check. No code or skill changes repository settings (AGENTS.md Hard Rules).
- Describe the runner's network reach (which hosts and services on the home network it can open) for the ADR text.

## Accepted residual risk

Code pushed to a branch of this repository by anyone with write access, or by a token or automation that holds it, still runs on the NAS. The approval setting covers forks, not branches of this repository. The owner accepts this risk with option A.
