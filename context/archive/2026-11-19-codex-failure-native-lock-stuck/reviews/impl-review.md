<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Codex Native Lock Recovery After Ordinary Failures

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

The review covered Phase 1 and all five Progress rows. One runner still owns exec and native settlement for both chains. The router continues to own result intake and retries. Both revisions use the existing lock and result formats. Archive settlement and the cancellation boundary remain covered by the existing tests.

## Findings

### F1 — A broken input stream can reach native settlement

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:305`
- **Detail**: The runner ignored stdin errors. A child could publish its root identity, exit 1 before reading the prompt and cause an EPIPE on the supervisor's write. The runner used the close code and available metadata to release the lock even though the plan disqualifies stream faults.
- **Fix**: Capture stream errors separately from process exit and reject settlement before interpreting the exit code. The fake CLI regression closes stdin with a prompt larger than the pipe buffer.
- **Decision**: APPLIED — `6ff1ecbf`

### F2 — Invalid UTF-8 can be repaired into eligible JSONL

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:368`
- **Detail**: The execution decoder replaced illegal bytes with U+FFFD. A nonzero exit could reach settlement when the repaired event parsed as JSON, despite the plan's intact-stream requirement.
- **Fix**: Frame and bound each raw record before fatal UTF-8 decoding. Previously completed records still register the root identity when a later corrupt record arrives in the same chunk. A fixture on each chain exercises this boundary.
- **Decision**: APPLIED — `6ff1ecbf`

### F3 — A metadata fault can be ignored at release

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:225`
- **Detail**: A valid final descendant response resolved its request before the parser finished the chunk. A malformed line later in that chunk set the failure flag after the promise resolved. The runner reached the release callback with a recorded reconciliation fault.
- **Fix**: Check the recorded metadata error at the settlement boundary. On both chains a fake app-server writes a malformed line alongside the final response and the runner retains native ownership.
- **Decision**: APPLIED — `6ff1ecbf`

### F4 — A stale assistant event can qualify a later turn

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/run-codex.mjs:387`
- **Detail**: The runner retained the prior assistant message when it saw another root turn start. If the new turn completed without its own message and the final file matched the stale one, an invalid RESULT could be classified as an ordinary failure with verified reply provenance.
- **Fix**: Clear the message at each root turn start. The completion matrix now requires the lock to remain held when only an earlier turn supplied the matching reply.
- **Decision**: APPLIED — `6ff1ecbf`

### F5 — Reused scratch can lose an existing credential file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `context/changes/codex-failure-native-lock-stuck/evidence/script-real-codex-retry.mjs:17`
- **Detail**: When a caller reused a scratch directory containing auth.json, the exclusive credential copy failed and the finally block unlinked the preexisting file. A synthetic sentinel reproduced the deletion without invoking Codex.
- **Fix**: Require empty scratch and create its private directories exclusively so credential cleanup targets a file owned by this invocation.
- **Decision**: APPLIED — `6ff1ecbf`

### F6 — The earlier ADR paragraph omits the failed-root exception

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-024-openai-codex-support.md:48`
- **Detail**: The earlier native ownership paragraph presented completed latest turns as the general rule. The new amendment described the eligible failed root further down.
- **Fix**: Cross-reference the amendment from the earlier paragraph.
- **Decision**: APPLIED — `6ff1ecbf`

## Verification

| Plan check | Evidence |
|------------|----------|
| 1.1 | Both fake chains record `unknown` with the original reason and duration, issue the same step under a new number, and execute it successfully. |
| 1.2 | Both fake chains preserve state and block intake and relaunch on uncertain evidence. Six new regressions reproduced premature release on the reviewed revision and passed with the fixes. |
| 1.3 | The injected grace test recorded SIGTERM, observed SIGKILL on child close, confirmed temp cleanup and retained native ownership. |
| 1.4 | The focused runner and lock suite passed all 136 tests. The full suite reported 1,953 passed, 3 skipped and zero failures. |
| 1.5 | The saved Codex 0.169.0 live OpenSpec log records `os-propose` attempt 1 with a forced exit 1, `unknown` intake, preserved rollback, the successful attempt 2 and the resulting `os-apply` dispatch. This review inspected the committed evidence. [Live log](../evidence/script-real-codex-retry.log) |

The manual fixture rejected a nonempty scratch directory and preserved its synthetic credential sentinel. `git diff --check` passed.

The final verification ran on Node 24.19.0. An earlier overlapping exploratory run hit two crash-fixture timing assertions. The final focused and full runs both passed.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/run-lock.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```
