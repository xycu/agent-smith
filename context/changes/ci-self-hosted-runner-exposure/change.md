---
change_id: ci-self-hosted-runner-exposure
title: Decide whether pull request CI may run on the self-hosted runner
status: planned
created: 2026-11-19
updated: 2026-11-22
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 15 (should fix). Found by reading the workflows and ADR-020. The repository settings on GitHub were not checked.

**This is an owner decision first.** Run `/10x-frame` before `/10x-plan`: the question is how much risk the owner accepts on a home NAS, not how to write the YAML.

**What is there today.** `.github/workflows/ci.yml:30` and `:81` choose the runner with one expression: a pull request from a fork gets `ubuntu-latest`; everything else gets `["self-hosted","linux","truenas"]`. `pr-title.yml` uses the same expression. The comment at `ci.yml:8-11` says the real boundary is the repository setting "Require approval for all external contributors". `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` (two amendments) records the choice. `release.yml` already runs on `ubuntu-latest`.

**Problem 1: the boundary is a setting, not the workflow.** The repository is public. The fork check keeps fork pull requests off the NAS. Everything else that can start a workflow lands on it: a branch pushed to this repository by anyone with write access, or by a compromised token or automation that has it. That code then runs on a machine inside the owner's home network. Nothing in the repository proves that the approval setting is on, and a later settings change removes the boundary without any diff.

**Problem 2: an unpinned install with lifecycle scripts on that runner.** `ci.yml:63` runs `npm install --prefix "$prefix" --no-save --package-lock=false @fission-ai/openspec@2.0.0` in six jobs. The top package is pinned by version. Its dependency tree is not: there is no lockfile, and there is no `--ignore-scripts`. A compromised transitive release runs its install script on the NAS.

**Options for the frame.**
- A. Keep the self-hosted runner. Add `--ignore-scripts` to the install, record the required repository settings in ADR-020 with the date they were checked, and say what the runner can reach on the network.
- B. Move pull request jobs to `ubuntu-latest` and keep the NAS only for pushes to `main`.
- C. Move everything to hosted runners and retire ADR-020.

The audit's minimum, whatever the frame decides: `--ignore-scripts` on the `npm install` line, or an install from a committed lockfile.

**Constraints.**
- `tools/test/ci-runner.test.mjs` holds 10 text pins on the runner expression. Any change to the expression updates that test in the same commit.
- `tools/workflow-pins.mjs` requires 40-hex SHA pins with version comments for every remote action; keep that.
- A decision that changes ADR-020 is a new amendment or a superseding ADR, indexed in `docs/ADR/README.md`.
- This repository adds no npm dependency (ADR-006). The CI install of OpenSpec is a test tool, not a dependency of the router; the plan says where a lockfile for it would live if option A takes that path.
- Repository settings and branch protection are the owner's to change by hand; no code or skill changes them (AGENTS.md Hard Rules).

**Done when.**
- The frame records the chosen option and the reason.
- The install line no longer runs lifecycle scripts of unpinned packages on a self-hosted machine.
- ADR-020 and `tools/test/ci-runner.test.mjs` match the workflows.
- CI is green on the pull request that makes the change.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
