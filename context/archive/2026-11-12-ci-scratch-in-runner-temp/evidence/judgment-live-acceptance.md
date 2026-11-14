# Live acceptance assessment

## Row 1.5

> A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory.

The read-only GitHub query in command-branch-ci-runs.txt completed successfully and returned an empty run list for agent-smith/ci-scratch-in-runner-temp. No qualifying run URL, runner identity or actual scratch-path observation is available in this change folder. The workflow declares the suite environment as `TMPDIR: ${{ runner.temp }}`, and makeProject() and runLockPath() resolve paths through os.tmpdir(). These declarations establish intended placement. They cannot establish an observed green TrueNAS job. Row 1.5 remains pending.

## Row 1.6

> After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded.

The branch has no listed CI runs. The change folder contains local implementation verification and a live acceptance procedure, without paired same-runner cancellation and subsequent job-start inventories. Existing local configuration and lock tests exercise environment wiring and router lock handling. They do not execute GitHub runner job cleanup. Row 1.6 remains pending because the required live observations are unavailable.

## Attempt boundaries

Only read-only GitHub queries were used. Initiating acceptance would require publishing the branch or triggering external CI, which this manual-verification task forbids. The plan remains byte-for-byte unchanged, including its existing automated ticks and commit suffixes.
