---
change_id: ci-runner-non-root
title: Run the CI jobs as a non-root user as ADR-020 requires
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: medium to high (security). This answers the open Progress row 2.3 of `ci-self-hosted-truenas` ("The ADR prerequisites match what the owner's TrueNAS runners actually provide", `plan.md:227`): one prerequisite does not match.

### Problem

`docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:43` lists "A non-root service user" as a runner prerequisite. The CI jobs run as uid 0.

The same ADR (line 55) states that the runner is persistent and that the `agent-smith/<id>` branches pushed by `open-pr.mjs` are same-repository pull requests, "so code that a model wrote runs there with no approval step". That code therefore runs `node --test` as root, with its work folder on a NAS dataset (`/mnt/main/lake/github/agent-smith-<n>/`).

### Evidence

Log of CI run 43134692634 on the runner `truenas-agent-smith-1`:

- `Copying '/root/.gitconfig' to '/mnt/main/lake/github/agent-smith-1/_temp/…/.gitconfig'` (twice, once per checkout).
- Both tests that skip for a privileged user are skipped (`skills/10x-pipeline/test/no-recursive-delete.test.mjs:76-77` and `:93`, `skip: privileged`, where `privileged` is `process.getuid() === 0`): "removeTree leaves the mode of a read-only parent outside the target alone" and "cleanupAll tries every scratch folder and throws one error that names the failures". So two safety tests of `removeTree` never run in CI.

Not known: whether uid 0 is the NAS host or a container (the tool cache path suggests a container image). Root in a container with a host dataset mounted read-write is still root on those files.

### Fix direction

1. Owner, on the hosts: run the runner service as a non-root user, or run each job in a fresh non-root container. The dataset path needs write access for that user.
2. `ci.yml`, `test` job: a first step `test "$(id -u)" -ne 0` so that a runner set up as root fails at once. The hosted fallback runs as a non-root user and passes.
3. Tick row 2.3 of `ci-self-hosted-truenas` only after a CI log shows a non-root user and the two tests above run.

### Tests

- A check in `tools/test/ci-runner.test.mjs` that the `test` job has the uid step before the suite.
- CI evidence: `skipped` falls by 2 and the two test names appear with a pass mark.

### Done when

A CI run on the TrueNAS runner executes the suite as a non-root user, and a root runner makes the job fail.
