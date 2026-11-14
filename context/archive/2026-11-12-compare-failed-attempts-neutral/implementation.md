# Implementation evidence

## Phase 1

Compare imports the existing `isFailure` predicate and uses it in each side aggregation. JSON and Markdown share the resulting count. Regression coverage and the reference documentation cover advisory and fallback neutrality, cheap and legacy failures, pinned baseline compatibility, and usage completeness.

## Verification

- Focused acceptance selection passed all 5 tests.
- Complete compare file passed all 35 tests with zero skips on Node 26.13.1.
- Deliberate-break check passed on Node 24.19.0. Reinstating the original predicate made the advisory regression fail with 2 instead of 1. The production file was restored byte-for-byte in a finally block.
- Full router, OpenSpec and tools suite passed on Node 24.19.0 with 1288 tests, 1285 passed, zero failed and 3 skipped.
- The skipped checks were the two opt-in live GitHub checks requiring `GH_LIVE=1` and authentication, and the import check for an absent `CLAUDE.md`.
- Documentation assertions passed for both public metric names, advisory and fallback neutrality, cheap-failure inclusion, and usage accounting.
- `git diff --check` and the version consistency check passed.

## Environment adaptation

The initial full-suite run on Node 26.13.1 recorded 1270 passed, 15 failed and 3 skipped. With `TMPDIR` inside this worktree, scratch projects without their own Git repository discovered the enclosing run checkout. Setting `GIT_CEILING_DIRECTORIES` to the worktree root follows the existing `gitEnv` helper and fixed the affected routing and prompt checks. The two runner-lock checks also failed on Node 26 and passed in isolation on Node 24, matching CI. The final full-suite retry used Node 24.19.0 and the Git discovery ceiling.

```sh
TMPDIR="$PWD" GIT_CEILING_DIRECTORIES="$PWD" /Users/blazej/.local/share/fnm/node-versions/v24.19.0/installation/bin/node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

## Assumptions

- Cheap failures count under ADR-010 and the approved plan. Their exceptions apply to rigor and budget.
- Node 24, matching CI, and isolated scratch Git discovery provide the repository-wide acceptance environment.

## Manual verification

The plan contains no Manual rows. Live GitHub integration checks remain opt-in.
