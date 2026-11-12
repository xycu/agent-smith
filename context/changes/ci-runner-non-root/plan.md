# Run the CI jobs as a non-root user (ADR-020 D4) Implementation Plan

## Overview

ADR-020 D4 lists "A non-root service user" as a prerequisite of the TrueNAS runners, but the CI jobs run as uid 0 (CI run 43134692634, runner `truenas-agent-smith-1`). Add a guard as the first step of the `test` job in `ci.yml` that fails at once when `id -u` is 0, pin it with tests, and align ADR-020 and the `AGENTS.md` line about `ci-runner.test.mjs`. Changing the runner user on the NAS hosts is an owner action; it stays a Manual row and is not claimed done here.

## Current State Analysis

- `.github/workflows/ci.yml:25-35`: job `test` starts with `actions/checkout`, then `setup-node`, then the suite and the version check. Nothing checks the user. Job `commits` (`ci.yml:37-52`) runs on the same runners.
- `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:43` lists the non-root prerequisite; `:55` says model-written code on `agent-smith/<id>` branches runs on the runner with no approval step. No file enforces the prerequisite.
- `skills/10x-pipeline/test/no-recursive-delete.test.mjs:76-77` and `:93` skip when `process.getuid() === 0`, so two `removeTree` safety tests never run in CI (evidence in `change.md`). They need no edit: they un-skip once the runner is non-root.
- `tools/test/ci-runner.test.mjs` reads workflow text with no YAML parser and compares the `runs-on` lines; `tools/test/release-gate.test.mjs` and `workflow-pins.test.mjs` read `ci.yml` too, and none of them pins the step list, so a new `run:` step breaks none of them (the new step has no `uses:`).
- The hosted fallback (`ubuntu-latest`, fork pull requests) runs as the non-root user `runner`, so the guard passes there.
- `context/changes/ci-self-hosted-truenas/plan.md:227`: Progress row 2.3 (ADR prerequisites match the real hosts) is still open; this change supplies its evidence but does not tick it.

## Desired End State

- `ci.yml` job `test` has a first step that exits non-zero with a clear message when `id -u` is 0, before checkout and before any model-written code runs.
- `tools/test/ci-runner.test.mjs` pins that step (first step of `test`, before the suite) and proves that the command fails for uid 0 and passes for another uid.
- ADR-020 says the prerequisite is enforced by that step, and records that the first reading of the runners found uid 0.
- A CI run on the TrueNAS runner, after the owner's fix, shows a non-root user and the two privileged-skip tests passing; a root runner fails the `test` job.

## What We're NOT Doing

- No runner setup in the repository (user, container image, `--ephemeral`): the owner does it on the hosts (ADR-020 D4 says the repository holds no runner setup).
- No guard in the `commits` job. The goal and `change.md` name the `test` job; a runner that fails `test` is fixed for both jobs because both use the same runner user.
- No edit of the two privileged-skip tests in `no-recursive-delete.test.mjs`.
- No edit of `context/changes/ci-self-hosted-truenas/plan.md`. Row 2.3 is ticked by the owner or a later run after the evidence below exists.
- No change to `release.yml`, pinned actions, `runs-on` expressions, or other repository settings.
- No skip-count check in CI (that is change `ci-fail-on-unexpected-skips`).

## Implementation Approach

One plain-text `run:` step, first in the job, so a root runner fails before checkout and before PR code runs. Reuse the plain-text test style of `ci-runner.test.mjs`. To prove the guard fails for root without being root, the test extracts the command from `ci.yml` and runs it with `sh -c` after a shell function `id() { echo 0; }` (or `echo 1000`) that shadows the external `id`; no temp folder or stub file is needed. Docs follow: an Amendment 1 in ADR-020 and one clause in `AGENTS.md`.

Sequencing risk: once merged, every CI run on a root runner is red, which also holds back `release.yml` (it starts from a green CI run of `main`). The owner fixes the runner first, then merges; Phase 2 states this order.

## Phase 1: Add the uid guard, pin it, align docs

### Overview

Workflow step, two tests, ADR-020 amendment, `AGENTS.md` clause.

### Changes Required:

#### 1. Guard step in the test job

**File**: `.github/workflows/ci.yml`

**Intent**: Insert a first step in job `test` (before `actions/checkout`) that fails when the job runs as uid 0, with an error naming ADR-020. Extend the header comment by one line saying why the step exists.

**Contract**: step `name: Refuse to run as root (ADR-020)`, `run: test "$(id -u)" -ne 0 || { echo "::error::the runner runs this job as uid 0; ADR-020 requires a non-root service user"; exit 1; }`. The command must contain the exact substring `test "$(id -u)" -ne 0`. No `uses:` line is added, so the SHA-pin guard stays green. No other step, `runs-on` line or job changes.

#### 2. Tests for the guard

**File**: `tools/test/ci-runner.test.mjs`

**Intent**: Fail when the `test` job loses the uid step, moves it behind the suite, or the command stops failing for uid 0.

**Contract**: two `node:test` tests, built-ins only. (a) Take the text of job `test` (from `\n  test:` to `\n  commits:`); its first `- ` step line must be the uid step, and the index of that step is lower than the index of `node --test` in the same slice. (b) Extract the `run:` value of that step (the rest of its single `run:` line), run `sh -c "id() { echo 0; }; <command>"` and assert exit status 1 and the output containing `::error::`, then run it with `id() { echo 1000; }` and assert exit status 0. A POSIX shell function shadows the external `id`, so the test writes no file and creates no temp folder (nothing to clean up, ADR-016 not touched). Skip (b) on `win32`. Update the header comment of the file to mention the uid guard.

#### 3. ADR-020 alignment

**File**: `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`

**Intent**: Make the prerequisite enforceable and record the finding. Edit D4 line 43 so the non-root service user is the one `ci.yml` checks with its first `test` step, and append `## Amendment 1: the test job refuses to run as root (change ci-runner-non-root)` (same shape as ADR-008 and ADR-010 amendments) with: the finding (CI run 43134692634 ran as uid 0, so prerequisite D4 was not met and two `removeTree` tests skipped), the decision (guard step, fail closed on a root runner, hosted fallback unaffected), the owner action (runner service as a non-root user, or each job in a fresh non-root container; the dataset path must be writable by that user; whether uid 0 was the host or a container is unknown), and that the amendment does not claim the runners are fixed. Add "; amended (Amendment 1)" to the Status line without changing its existing text. The Assumptions bullet "The runners provide the prerequisites above" stays true to the facts: add that the uid part did not hold on the first reading.

**Contract**: ADR-020 names the step and the test file. The ADR records no reading that did not happen.

#### 4. AGENTS.md pointer

**File**: `AGENTS.md`

**Intent**: In the `ci.yml` bullet of Project Structure, say that `tools/test/ci-runner.test.mjs` also pins the uid guard step of the `test` job. One clause; nothing else changes.

**Contract**: the bullet keeps its current wording and gains "and the non-root guard step of the `test` job".

### Success Criteria:

#### Automated Verification:

- The guard tests pass: `node --test tools/test/ci-runner.test.mjs`
- The guard step is in the workflow: `grep -q 'test "$(id -u)" -ne 0' .github/workflows/ci.yml`
- The SHA-pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`
- ADR-020 records the amendment: `grep -q "Amendment 1" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md && grep -q "ci-runner-non-root" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`
- AGENTS.md names the guard: `grep -q "non-root guard step" AGENTS.md`
- Full suite passes locally (as non-root): `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields still equal: `node tools/version-check.mjs`
- Workflow lints clean when `actionlint` is installed: `actionlint .github/workflows/ci.yml` (skip if the binary is absent)

#### Manual Verification:

- The workflow change was reviewed: the diff of `ci.yml` shows only the new first step and the header comment line, and the step runs before checkout.

**Implementation Note**: After this phase passes, pause for the review of the workflow change before Phase 2.

---

## Phase 2: Owner fixes the runner and proves it in CI

### Overview

Owner actions on the NAS hosts and the CI evidence. Not claimed done by this plan; no row below may be ticked by an agent without the quoted evidence. Order: open the pull request first; its CI run on a still-root runner fails at the uid step and is the evidence for row 2.4. Then the owner fixes the runner and reruns the job for rows 2.2 and 2.3, and only then merges.

### Changes Required:

#### 1. Runner user (owner, outside the repository)

**Intent**: Run the runner service on each TrueNAS host as a non-root user, or run each job in a fresh non-root container, with write access to the work dataset path (`/mnt/main/lake/github/agent-smith-<n>/`). Do this before merging this change: after the merge a root runner fails the `test` job on every pull request and push to `main`, and `release.yml` waits for a green `main` CI run.

**Contract**: no repository file. Evidence is the job log.

### Success Criteria:

#### Automated Verification:

None. The proof needs a run on the owner's hosts.

#### Manual Verification:

- The owner has changed the runner user on every TrueNAS runner host (service user or fresh non-root container) and the work dataset is writable by it.
- A CI run of a pull request from this repository on the TrueNAS runner passes the uid step, and its log shows a non-root user (for example the step passing, or `id` output in the setup log).
- In that run the two tests "removeTree leaves the mode of a read-only parent outside the target alone" and "cleanupAll tries every scratch folder and throws one error that names the failures" run with a pass mark, and `skipped` is 2 lower than the 10 of run 43134692634.
- A root runner fails the job: either seen in a run before the owner's fix, or by temporarily running one job as root and reading the `::error::` line.
- After the evidence above, the owner (or a later run) ticks row 2.3 of `context/changes/ci-self-hosted-truenas/plan.md`.

---

## Testing Strategy

### Unit Tests:

- `tools/test/ci-runner.test.mjs`: the uid step is first in job `test` and before the suite; the extracted command exits 1 with `::error::` under a stub `id` of 0 and exits 0 under 1000.

### Integration Tests:

- The existing suite runs unchanged; `release-gate.test.mjs` and `workflow-pins.test.mjs` cover the other readers of `ci.yml`.

### Manual Testing Steps:

1. Read the diff of `ci.yml` (Phase 1 manual row).
2. Owner: fix the runner user, open the pull request, read the job log and the test summary (Phase 2 rows).

## Performance Considerations

None. The step costs one `id` call.

## References

- Change: `context/changes/ci-runner-non-root/change.md`
- Runner decision: `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:43,55`
- Plan whose row 2.3 this answers: `context/changes/ci-self-hosted-truenas/plan.md:227`
- Existing guard test style: `tools/test/ci-runner.test.mjs`
- Privileged-skip tests: `skills/10x-pipeline/test/no-recursive-delete.test.mjs:76-77`, `:93`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add the uid guard, pin it, align docs

#### Automated

- [x] 1.1 The guard tests pass: `node --test tools/test/ci-runner.test.mjs`
- [x] 1.2 The guard step is in the workflow: `grep -q 'test "$(id -u)" -ne 0' .github/workflows/ci.yml`
- [x] 1.3 The SHA-pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`
- [x] 1.4 ADR-020 records the amendment: `grep -q "Amendment 1" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md && grep -q "ci-runner-non-root" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`
- [x] 1.5 AGENTS.md names the guard: `grep -q "non-root guard step" AGENTS.md`
- [x] 1.6 Full suite passes locally (as non-root): `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.7 Version fields still equal: `node tools/version-check.mjs`
- [x] 1.8 Workflow lints clean when `actionlint` is installed: `actionlint .github/workflows/ci.yml` (skip if the binary is absent)

#### Manual

- [ ] 1.9 The workflow change was reviewed: the diff of `ci.yml` shows only the new first step and the header comment line, and the step runs before checkout

### Phase 2: Owner fixes the runner and proves it in CI

#### Manual

- [ ] 2.1 The owner has changed the runner user on every TrueNAS runner host (service user or fresh non-root container) and the work dataset is writable by it
- [ ] 2.2 A CI run of a pull request from this repository on the TrueNAS runner passes the uid step, and its log shows a non-root user
- [ ] 2.3 In that run the two privileged-skip tests of `no-recursive-delete.test.mjs` run with a pass mark, and `skipped` is 2 lower than the 10 of run 43134692634
- [ ] 2.4 A root runner fails the job: seen in a run before the owner's fix, or by temporarily running one job as root and reading the `::error::` line
- [ ] 2.5 After rows 2.2 and 2.3, the owner (or a later run) ticks row 2.3 of `context/changes/ci-self-hosted-truenas/plan.md`
