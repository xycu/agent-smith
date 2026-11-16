# Comparison integrity verification

## Candidate and ownership

Verification started from commit `8273a5c4` on `agent-smith/compare-damaged-logs-not-comparable`, using Node `v24.19.0`. The candidate extends the per-side eligibility loop in `comparePair`, the existing comparison and run-state tests, and the damaged-log/comparison reference paragraphs. Saved-state writers and the tolerant reader retain their existing format and contracts.

The sibling branch was rechecked at `80d448ab`. Its committed diff contains change artifacts, and its plan confirms setup/isolation/publication runtime ownership, separate tests and paragraph-bounded reference edits. The production and test regions remain disjoint. The roadmap lookup found no matching Change ID.

Candidate production/test/reference diff SHA-256 is `3094e690e172e97f2ed0315ebe93561c12e3037e4b3107b6523b3a4a2f75f6a1`, computed from `git diff --` for the four owned paths against the starting HEAD.

## Verification environment

All fixture roots and gate logs are under the ignored `.claude/worktrees/compare-integrity-verification/` directory inside this run worktree. Each gate sources its `env.sh`, which sets `TMPDIR` to the local `tmp/` and prepends the local `bin/` to `PATH`.

The launcher resolves real Git before PATH modification to `/usr/bin/git`. It supplies the absolute scratch `tmp/` as `GIT_CEILING_DIRECTORIES` only when that variable is absent, then executes real Git with the original arguments. Fixture-supplied Git controls retain precedence. The production test helpers require no changes.

Before each test gate, `node .claude/worktrees/compare-integrity-verification/preflight.mjs` spawns Git using `cleanEnv()`. Uninitialized scratch discovery exits 128. A separate scratch repository initializes successfully, discovery exits zero and its absolute root matches that fixture. The preflight cleans both fixtures with the existing `removeTree` helper.

## Gates

| Gate | Command | Exit | Pass | Fail | Cancelled | Skipped |
| --- | --- | --- | --- | --- | --- | --- |
| Full-suite plan criterion | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 0 | 1736 | 0 | 0 | 3 |
| Final repository suite after break-check restoration | `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 0 | 1736 | 0 | 0 | 3 |
| Focused CLI regressions | `node --test --test-concurrency=2 skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/run-state.test.mjs` | 0 | 170 | 0 | 0 | 0 |

The focused gate completed in 49,676.065542 ms. It covers both chains, completed clean controls, the 1,000-versus-1,100 truncation reproduction, baseline/routed/both-side corruption, malformed JSON, primitive/null/array values, whitespace, damaged skipped records and deterministic existing-path EACCES injection. JSON and Markdown, default pinning and `--unpinned` assert the integrity reasons, null drop and ineligible verdict. Partial totals/counts/splits, sanitized diagnostics and byte/type snapshots include metadata, reports and stale temporary sentinels.

Reference verification uses `rg -n 'log-problems|logProblems|unpinned' docs/REFERENCE.md`, `git diff --name-only`, `git diff -- docs/REFERENCE.md` and `git diff --check`. All returned exit zero. Only the assigned damaged-log and comparison paragraphs changed. The live-document search found compatible comparison claims in README, PRD and ADR-005.

## Decisions and remaining acceptance

The plan-selected reason codes follow the existing side-attributed reason convention. No public data migration is required. Repeated comparisons read the same saved format. A preserving revert of the implementation commit is the rollback path, with the known false-success behavior restored by that revert.

One native leaf, `/root/phase1_implementation`, implemented the four assigned files and returned a completed structured handback. The enclosing step reconciled the edits and owns all gates, Progress and commits. Child-inclusive token coverage is unknown, so no token total is asserted.

Manual acceptance for publication, successful PR CI and the requested report comment is complete. The post-publication acceptance record below supplies the external evidence and owner approval.

### Manual acceptance

- [x] 1.4 After local verification and pipeline reviews, the authorized orchestrator pushes the run branch, opens or retains a reviewable pull request and records its URL and successful PR CI result.
- [x] 1.5 The authorized orchestrator posts or updates the requested run-report comment on that pull request and records its URL with the actual local test results and any remaining acceptance items.

The full-suite plan criterion completed in 743,496.88625 ms with 1,739 tests and 13 suites. Its three existing skips are the two opt-in GH_LIVE tests in pr-comment.test.mjs and the CLAUDE.md import guard because that file is absent. Git is available and no Git-dependent gate was skipped.

## Deliberate-break gate

After staging the touched-file set, temporarily removing the integrity guard made both chain-specific truncation regressions fail with exit 1, two failed tests and zero passing tests. The command was `node --test --test-concurrency=2 --test-name-pattern="truncating the 600-token record" skills/10x-pipeline/test/run-state.test.mjs`. The enclosing check restored the saved Buffer in a finally block and verified byte equality against the Git index. It returned exit zero after confirming the expected red result. The staged four-path candidate diff still matches SHA-256 `3094e690e172e97f2ed0315ebe93561c12e3037e4b3107b6523b3a4a2f75f6a1`.

The pre-existing dirty router-owned `agent-smith/run.jsonl` remains outside the staging set. Every change implemented by the leaf was reconciled against its four-path handback. The final full-suite gate uses the same invocation and verified scratch setup after restoration.

## Final gate result

The same final suite process was awaited to completion with exit zero, 1,739 tests, 13 suites and duration 768,851.217 ms. Its three skips match the expected categories above. Focused regressions, reference/scope validation, deliberate-break protection and both complete suite runs passed. `node tools/version-check.mjs` reports OK for 1.12.0. Both planned commit subjects pass `node tools/commit-lint.mjs --title`. Working and staged diff checks pass.

## Post-publication acceptance

Verified on 2026-11-16 after terminal publication. The reviewed implementation was published from `agent-smith/compare-damaged-logs-not-comparable` at `d7b2c0aad6549ee8e1032e31b96b1bcf2d9206b7`. GitHub confirms an open, reviewable pull request with that head and successful CI and PR-title workflows. The installed publication script pushed without force, and its output reported `pushed: true` and `committed: true`. [Pull request](https://github.com/xycu/agent-smith/pull/201) · [Successful CI](https://github.com/xycu/agent-smith/actions/runs/43875038953)

The existing report comment identifies this change and contains the completed step log and the approval verdict. Its Manual section records the earlier manual-verification snapshot. This acceptance record and the checked plan rows record the completed publication checks. [Requested report comment](https://github.com/xycu/agent-smith/pull/201#issuecomment-6917625846)

The owner approved review in this chat on 2026-11-16 with “I approve the review. Please update the manual rows.”

- [x] 1.4 After local verification and pipeline reviews, the authorized orchestrator pushes the run branch, opens or retains a reviewable pull request and records its URL and successful PR CI result.
- [x] 1.5 The authorized orchestrator posts or updates the requested run-report comment on that pull request and records its URL with the actual local test results and any remaining acceptance items.
