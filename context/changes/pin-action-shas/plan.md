# Pin GitHub Actions to commit SHAs Implementation Plan

## Overview

Replace the tag references of the three actions in `.github/workflows/ci.yml` and `release.yml` with full 40-character commit SHAs, each with its version in a trailing comment, and add a test that keeps them pinned. GitHub issue #99.

## Current State Analysis

`release.yml` runs `googleapis/release-please-action@v5` with `contents: write` and `pull-requests: write`; a moved tag would run foreign code with a write token. `ci.yml` uses `actions/checkout@v5` (twice) and `actions/setup-node@v5` (twice) with read-only permissions. No test or doc mentions the action references. `tools/test/*.test.mjs` already holds repo-guard tests run by CI.

## Desired End State

Every `uses:` line in `.github/workflows/*.yml` that names a remote action is `owner/repo@<40 hex> # vX.Y.Z`. A test fails when one is not. The pinned SHAs are the commits the `v5` tags resolve to today, so behavior does not change.

### Key Discoveries:

- SHAs resolved with `git ls-remote https://github.com/<repo> 'refs/tags/v5*'` on 2026-11-11:
  - `actions/checkout` `v5` = `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` (same commit as `v5.1.0`).
  - `actions/setup-node` `v5` = `a0853c24544627f65ddf259abe73b1d18a591444` (same commit as `v5.0.0`).
  - `googleapis/release-please-action` `v5` is an annotated tag; its peeled commit (`v5^{}`) is `45996ed1f6d02564a971a2fa1b5860e934307cf7` (same as `v5.0.0^{}`). Use the peeled commit, not the tag object `0dfd8538...`.
- `ci.yml` has four `uses:` lines (lines 24, 25, 35, 38 region); `release.yml` has one (line 32).

## What We're NOT Doing

- No Dependabot or Renovate config to refresh pins (new file, new decision; the pins go stale until bumped by hand).
- No bump to newer versions: pins keep today's `v5` behavior.
- No ADR (ADR-008 only records that the workflows exist; this is not an architecture decision).
- No change to workflow logic, permissions or triggers.

## Implementation Approach

Edit five `uses:` lines. Add one small `node:test` file under `tools/test/` that reads `.github/workflows/*.yml` and asserts each `uses:` of a remote action matches `@[0-9a-f]{40}` followed by a `# v` comment. Re-verify each SHA with `git ls-remote` at implementation time in case a tag moved since planning (if a `v5` tag now points elsewhere, pin the commit of the version that was current at planning: the `v5.1.0`, `v5.0.0`, `v5.0.0` tags listed above).

## Phase 1: Pin the actions

### Overview

Pin all five `uses:` lines.

### Changes Required:

#### 1. Workflow files

**File**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**Intent**: Replace each `@v5` with the commit SHA of Key Discoveries and add the version as a comment, so the SHA stays readable and bumpable.

**Contract**: Line form `- uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0`; `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0`; `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`. No other line changes.

### Success Criteria:

#### Automated Verification:

- No tag reference is left: `grep -nE 'uses: [^ ]+@v[0-9]' .github/workflows/*.yml` prints nothing
- Each pinned SHA is the commit of its tag: `git ls-remote https://github.com/<repo> 'refs/tags/<version>*'` shows the SHA used (checkout, setup-node, release-please-action)
- Version fields still agree: `node tools/version-check.mjs`

#### Manual Verification:

- Reviewer reads the diff: five `uses:` lines changed, nothing else
- After merge, the CI run on the pull request or `main` and the next release-please run resolve the actions (no "unable to find version" error)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Guard test

### Overview

Keep the pins from drifting back to tags.

### Changes Required:

#### 1. Pin guard test

**File**: `tools/test/workflow-pins.test.mjs` (new)

**Intent**: Fail when a remote action in a workflow is not pinned to a full commit SHA with a version comment.

**Contract**: `node:test` file in the style of `tools/test/version-check.test.mjs`; reads every `.github/workflows/*.yml` from the repo root (path from `import.meta.url`), takes each `uses:` value that does not start with `./` or `docker://`, and asserts `owner/repo[/path]@<40 hex>` followed by ` # v<digits>...`. Also asserts at least one `uses:` was found, so an empty match cannot pass. Built-ins only (ADR-006).

### Success Criteria:

#### Automated Verification:

- New test passes: `node --test tools/test/workflow-pins.test.mjs`
- The test fails on a tag reference (check once by temporarily running it against a scratch copy with `@v5`; do not edit repo files for this)
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Test failure message names the file and the offending `uses:` line

---

## Testing Strategy

### Unit Tests:

- `workflow-pins.test.mjs`: every remote `uses:` is SHA-pinned with a version comment; at least one found.

### Manual Testing Steps:

1. Open the pull request; confirm the `Tests and version check` job resolves all actions.
2. After merge, confirm the `Release` workflow run on `main` starts without an action resolution error.

## Performance Considerations

None.

## Migration Notes

Pins do not update by themselves. To bump: look up the new tag's commit with `git ls-remote`, replace the SHA and the version comment together.

## References

- Issue: GitHub #99; `context/changes/pin-action-shas/change.md`
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Test style: `tools/test/version-check.test.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pin the actions

#### Automated

- [x] 1.1 No tag reference is left in `.github/workflows/*.yml`
- [x] 1.2 Each pinned SHA is the commit of its tag, checked with `git ls-remote`
- [x] 1.3 Version fields still agree: `node tools/version-check.mjs`

#### Manual

- [ ] 1.4 Reviewer reads the diff: five `uses:` lines changed, nothing else
- [ ] 1.5 After merge, CI and the next release-please run resolve the actions

### Phase 2: Guard test

#### Automated

- [x] 2.1 New test passes: `node --test tools/test/workflow-pins.test.mjs`
- [x] 2.2 The test fails on a tag reference, checked on a scratch copy
- [x] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.4 Test failure message names the file and the offending `uses:` line
