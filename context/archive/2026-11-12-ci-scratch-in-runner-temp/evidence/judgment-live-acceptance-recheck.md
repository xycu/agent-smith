# Live acceptance recheck

## Row 1.5

> A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory.

The renewed branch CI query returned `[]`. An additional read-only lookup for all pull requests with this branch as their head also returned `[]`. Both commands exited 0. The latest 30 repository CI runs include successful runs on other branches. Their listing supplies no qualifying observation for this change. Complete command output is saved in command-live-ci-recheck.txt.

The checked workflow declares the following suite environment.

```yaml
      - name: Test suite
        env:
          TMPDIR: ${{ runner.temp }}
```

`makeProject` in skills/10x-pipeline/test/helpers.mjs creates projects through `mkdtempSync` beneath `os.tmpdir()`. `runLockPath` in skills/10x-pipeline/scripts/state.mjs joins the lock filename to `os.tmpdir()`. These source statements establish the configured placement mechanism. The row requires an observed green TrueNAS job, its identity and actual paths. Those observations remain unavailable, so row 1.5 stays pending.

## Row 1.6

> After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded.

The renewed queries provide no run for this branch. The existing change-folder artifacts contain local test results and a live acceptance procedure. The required cancelled-job scratch inventory and subsequent same-runner job-start inventory remain unavailable. The existing configuration and run-lock tests exercise suite environment wiring and router locking. The requested observation concerns GitHub runner job cleanup following cancellation. Row 1.6 stays pending.

## Attempt outcome

The renewed checks used read-only GitHub queries and inspected the existing implementation and verification records. Initiating live acceptance requires publishing or triggering external CI, actions forbidden by this task. Both pending rows retain their original wording and unchecked state. The plan requires no edits. No source files or router-owned run state were written.
