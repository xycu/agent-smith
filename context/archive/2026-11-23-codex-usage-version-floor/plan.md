# Codex token accounting version floor

## Overview

Accept Codex CLI releases from 0.169.0 onward for observed token accounting. A supported version lets the collector examine the evidence. Only a complete, reconciled step tree earns a verified token total.

## Current State Analysis

After native execution settles, `run-codex.mjs:344` passes app-server thread metadata and optional exec usage to `collectCodexUsage`. The root thread’s `metadata.cliVersion` supplies the reported host version. The collector compares that value, every thread’s `metadata.cliVersion`, and each rollout’s first `session_meta.payload.cli_version` to one literal. An otherwise valid 0.171.0 capture therefore returns `unsupported-host` before reconciliation. See `skills/10x-pipeline/scripts/codex-usage.mjs:59,67,76,118`.

The November 23 schema check recorded in [change.md](change.md) found the required identity, history, turn, counter and snapshot fields in 0.171.0. With the pin changed in a scratch collector, 27 of 35 real trees verified, including delegated runs. Each of the eight `incomplete-capture` results lacked a terminal `task_complete`.

## Desired End State

Compatible, reconciled trees with an eligible root host version that fits the version-1 evidence envelope return `usageEvidence.status = "verified"`, the observed root host version, and `usage.totalTokens`. A below-floor or malformed version returns `unsupported-host` and omits the total when its gate is reached. Earlier failures keep their existing precedence. On eligible input a malformed counter returns `unsupported-schema`, and a missing terminal record returns `incomplete-capture`.

### Key discoveries

- Commit `fdf6a7e4` put Claude's reviewed floor and component-wise comparison beside the capture reader. Codex already owns all three checks in one module.
- Root host version and root thread version are the same input. A non-root thread must vary independently to exercise the per-thread check.
- The version-1 evidence envelope accepts at most 32 characters for the reported root host version. An otherwise reconcilable capture with an eligible root version longer than 32 characters fails evidence normalization with `invalid-evidence` and yields no total. Child and rollout versions are checked for eligibility but are not reported in the envelope. See `skills/10x-pipeline/scripts/usage.mjs:42,57–85`.
- Two existing tests classify 0.170.0 as unsupported. The runner case also verifies that accounting failure preserves execution success, duration and lock cleanup on both chains. See `skills/10x-pipeline/test/codex-usage.test.mjs:103` and `skills/10x-pipeline/test/codex-runner.test.mjs:627`.

## Scope

This change covers accounting eligibility, focused regression tests and the three requested documentation entries. Dispatch, permission probing, Claude capture, billing and historical run repair are outside scope.

## Implementation Approach

Ship the version predicate, tests and docs in one implementation phase. Use the requested local commit subject `fix(codex-usage-version-floor): accept supported Codex accounting releases` and the repository’s AI co-author trailer.

**Assumptions.** “Strict X.Y.Z” means three unsigned ASCII decimal components, with zero represented by a single zero. Prefixes, suffixes (including prerelease/build), whitespace, leading zeroes and non-strings are ineligible. This follows the requested release-only scope and the numeric core grammar in `tools/version-check.mjs:18`. Check each source against the floor independently, as specified by the three existing guards. A mixed-version tree can verify when its evidence reconciles and fits the existing envelope.

## Phase 1: Apply the reviewed floor to Codex accounting

### Changes Required

1. **Collector** — `skills/10x-pipeline/scripts/codex-usage.mjs`
   **Intent** — Replace the exact-release pin with a named minimum and one module-local predicate, following `claudeCaptureSupported` in `claude-capture-data.mjs`.
   **Contract** — Compare major, minor and patch numerically in order with an inclusive floor of 0.169.0. Call the same predicate at all three guards. Preserve failure ordering, evidence normalization (including the root version length bound), identity checks, bounded reads, completeness checks and reconciliation. Use built-in JavaScript.
2. **Collector tests** — `skills/10x-pipeline/test/codex-usage.test.mjs`
   **Intent** — Reuse the existing fixture and its rollout rewrite helper to exercise each input independently. Replace the stale 0.170.0 negative assertion.
   **Contract** — Use the matrix below through `collectCodexUsage`. Check exact verified totals for valid input and the existing unavailable assertion for failures.
3. **Runner regression** — `skills/10x-pipeline/test/codex-runner.test.mjs`
   **Intent** — Change the fake unsupported host from 0.170.0 to 0.168.99.
   **Contract** — Retain the existing settlement and lock assertions for both chains.
4. **Accounting documentation** — `README.md:51`, `docs/REFERENCE.md:58`, `skills/10x-pipeline/test/README.md:67`
   **Intent** — Describe the accounting floor as “0.169.0 or later” and explain that schema and reconciliation checks still apply. Update the test index row to describe fixture coverage.
   **Contract** — Distinguish the accounting rule from the documented 0.169.0 dispatch contract and from live qualification. Describe the November 23, 2026 observations from the change notes as a dated accounting check. The dated ADRs and the earlier `first-attempt-drop-unmeasured` framing record the prior behavior. The three listed entries document the current rule.

### Success Criteria

#### Automated Verification

- Verify all three version checks and the failure reasons with `node --test skills/10x-pipeline/test/codex-usage.test.mjs`.
- Verify both chains still settle on an unsupported host with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs`.
- Confirm all three documentation entries describe the accounting floor with `rg -n '0\.169\.0 or later' README.md docs/REFERENCE.md skills/10x-pipeline/test/README.md` (one accounting match per file).

For Progress row 1.3, inspect the matched lines for accounting context and check the count for each file independently. Use this local exit-status check for the counts.

```sh
(
  for doc in README.md docs/REFERENCE.md skills/10x-pipeline/test/README.md; do
    test "$(rg -F -c '0.169.0 or later' "$doc")" = 1 || exit 1
  done
)
```

## Testing Strategy

| Vary one source, keep the others valid | Inputs and expected result |
| --- | --- |
| App-server root metadata | 0.168.99 and a non-release string yield `unsupported-host`. 0.169.0 and 0.171.0 verify the flat fixture’s 110 tokens and report the actual host version. |
| Rollout header | Apply the same four cases to `payload.cli_version`, rewrite the fixture file, and assert the same refusals or 110 verified tokens. |
| App-server child metadata | With root and rollouts at the floor, 0.171.0 verifies the fixture’s 132 tokens. A below-floor or malformed child version refuses the whole tree. |
| Release syntax and ordering | Verify `0.169.1` (higher patch with equal major/minor), `0.170.0` and `1.0.0`. Expect `unsupported-host` for `0.99.99`, `v0.171.0`, `0.171.0-rc.1`, `0.171.0+build`, `0.0171.0`, `"0.171.0\n"` and the array `["0.171.0"]`. |
| Version-1 evidence bound | Vary only root metadata on the intact fixture. An eligible 32-character root version verifies and is reported verbatim. An eligible 33-character root version returns `invalid-evidence` and omits the total. Use nonzero decimal patch components on `0.169` for both cases. |
| All sources at 0.171.0 | Verify 110 tokens for the intact flat fixture. In separate cases change a numeric counter to a string or remove the terminal marker. Assert unavailable with `unsupported-schema` or `incomplete-capture` respectively and no total. |

## Migration Notes

The collector reads native metadata and rollout records and returns the existing version-1 evidence shape to the runner. Deployment changes eligibility on the next collection. Existing evidence needs no rewrite or backfill. Keep one runner revision through settlement and intake, then revert the implementation commit to restore the exact pin. Previously stored evidence remains readable under the unchanged envelope.

## References

- [Recorded 0.171.0 schema check](change.md)
- [Claude capture floor precedent](../../../skills/10x-pipeline/scripts/claude-capture-data.mjs)
- [Collector fixtures](../../../skills/10x-pipeline/test/codex-usage.test.mjs)

## Progress

### Phase 1: Apply the reviewed floor to Codex accounting

#### Automated

- [x] 1.1 Verify all three version checks and the failure reasons with `node --test skills/10x-pipeline/test/codex-usage.test.mjs`. — a4b4eabc
- [x] 1.2 Verify both chains still settle on an unsupported host with `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs`. — a4b4eabc
- [x] 1.3 Confirm all three documentation entries describe the accounting floor with `rg -n '0\.169\.0 or later' README.md docs/REFERENCE.md skills/10x-pipeline/test/README.md` (one accounting match per file). — a4b4eabc
