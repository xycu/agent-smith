# Automated implementation evidence

Node v24.19.0. Scratch copies only; production skill files stayed intact. Each mutation ran the corresponding content assertions through SKILL_PATH or OPENSPEC_SKILL_PATH.

| Chain | Mutation | Exit | Failed assertion |
| --- | --- | --- | --- |
| 10x | description | 1 | not ok 1 - 10x: numbered description and archive override record separate retry invocations |
| 10x | archive override | 1 | not ok 1 - 10x: numbered description and archive override record separate retry invocations |
| 10x | conditional flag | 1 | not ok 1 - 10x: background flag is selected from the exposed schema before calling |
| 10x | rule 1 | 1 | not ok 1 - 10x: rule 1 handles launch notices independently of the background flag |
| 10x | fixed identity | 1 | not ok 1 - 10x: rule 6 rejects foreign, conflicting and superseded completion identities |
| 10x | id precedence | 1 | not ok 1 - 10x: rule 6 rejects foreign, conflicting and superseded completion identities |
| 10x | unique fallback | 1 | not ok 1 - 10x: rule 6 rejects foreign, conflicting and superseded completion identities |
| 10x | on-time guard | 1 | not ok 1 - 10x: on-time usage excludes earlier and foreign notifications without delaying next |
| 10x | late mapping | 1 | not ok 1 - 10x: done late usage recovers the earlier numbered launch, not the latest repeated step<br>not ok 2 - 10x: archive late usage recovers the earlier numbered launch, not the latest repeated step<br>not ok 3 - 10x: halt late usage recovers the earlier numbered launch, not the latest repeated step |
| openspec | description | 1 | not ok 1 - openspec: numbered description and archive override record separate retry invocations |
| openspec | archive override | 1 | not ok 1 - openspec: numbered description and archive override record separate retry invocations |
| openspec | conditional flag | 1 | not ok 1 - openspec: background flag is selected from the exposed schema before calling |
| openspec | rule 1 | 1 | not ok 1 - openspec: rule 1 handles launch notices independently of the background flag |
| openspec | fixed identity | 1 | not ok 1 - openspec: rule 6 rejects foreign, conflicting and superseded completion identities |
| openspec | id precedence | 1 | not ok 1 - openspec: rule 6 rejects foreign, conflicting and superseded completion identities |
| openspec | unique fallback | 1 | not ok 1 - openspec: rule 6 rejects foreign, conflicting and superseded completion identities |
| openspec | on-time guard | 1 | not ok 1 - openspec: on-time usage excludes earlier and foreign notifications without delaying next |
| openspec | late mapping | 1 | not ok 1 - openspec: done late usage recovers the earlier numbered launch, not the latest repeated step<br>not ok 2 - openspec: archive late usage recovers the earlier numbered launch, not the latest repeated step<br>not ok 3 - openspec: halt late usage recovers the earlier numbered launch, not the latest repeated step |

## Gates and scope

- Focused content and agent dispatch: 60 passed, 0 failed, 0 skipped.
- Provider, Codex runner, chain and host integration: 79 passed, 0 failed, 0 skipped.
- Break checks: 18 independent scratch mutations returned exit 1 at the targeted assertions. Production files were never mutated.
- Changes are confined to Loop step 2, anti-stall rules 1 and 6, terminal late-usage prose, existing test seams and related reference/ADR paragraphs. OpenAI dispatch, archive lifecycle, cutoff and refusal behavior remain covered by existing assertions.
- Unrelated AGENTS.md and router-owned run.jsonl changes were not staged.

## Content scenario review

These are reviews of instructions, not live Agent observations. The paired content tests assert the clauses cited below.

| Scenario | Required outcome and instruction |
| --- | --- |
| Earlier step, other change or archive completion while a step waits | Rule 6 rejects completion outside the awaited invocation; no result file or next call. |
| Known id plus a different description | Rule 6 requires agreement; description cannot override the id. |
| Matching description plus an id conflicting with the recorded id | Unique-description fallback prohibits that conflict. |
| Unique description, no id returned at launch | Fallback matches the sole recorded launch and associates an id first supplied in the notification. |
| Neutral retry repeats description | Separate records preserve the earlier invocation; its completion cannot advance the current invocation, and description-only matching is ambiguous. |
| Current report has no usage; an earlier step notification is already present | Loop step 2 governs step 4: omit current usage, call next in the same turn, keep the earlier figure for its terminal late-usage path. |
| Foreign or ambiguous usage already present | Leave unattached; it cannot populate current usage. |
| Correctly matched current figure | Step 4 may attach it to the current result. |
| Repeated step name at distinct numbers; late notification while newer step runs | All six terminal paragraphs recover the recorded earlier number, verify full change/number/step identity, and never infer it from the latest step or repeated name. |
| Archive usage | Final message only; numbered late-usage attachment keeps its existing pre-launch cutoff. |

Assumptions follow plan A2–A6: identity is built from existing router fields, each invocation is separate, and unavailable live acceptance stays pending. No runtime interface or policy changes were needed.

Environment adaptation: the first full-suite attempt was interrupted before any verdict after stalling with worktree-local TMPDIR. The rerun sets GIT_CEILING_DIRECTORIES to that scratch directory so non-repository fixtures cannot discover the parent checkout. Test concurrency is 2, following the current AGENTS.md command. No repository test or helper was changed for this environment adjustment.

## Blocking full-suite gate

Command: `GIT_CEILING_DIRECTORIES="$PWD/.agent-call-tmp" TMPDIR="$PWD/.agent-call-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

The run reported failures for both chains in `run-lock.test.mjs`: "a runner holds the shared lock through close, plain status reads and report status refuses". It was interrupted after confirming the blocker, so there is no successful full-suite summary and row 1.4 remains pending.

Focused recheck: the same environment, `node --test --test-name-pattern="a runner holds the shared lock" --test-reporter=tap skills/10x-pipeline/test/run-lock.test.mjs`. Exit 1: 10x passed, OpenSpec failed at line 215 (`lock is retained while the child is terminating`, expected 1, actual 0). Exact output is in `run-lock-failure.tap`.

The unchanged test creates the fixture with `closeDelay: 350` at line 189, sends SIGTERM, waits for a terminating marker, then launches a separate router process and expects it to observe the lock before that delay expires (lines 211–215). The observed success status is consistent with termination finishing before the router checks the lock. This content-only patch changes none of those runtime files or tests. Repairing that timing-sensitive test lies outside this plan's named test files and Wave 4 ownership; no assertion was weakened or skipped to claim a pass.

Final scope verification passed: exactly six owned lines changed in each skill, all other skill lines unchanged. `git diff --check`, `git diff --cached --check`, version-check and the proposed phase-title lint passed. Row 1.5 remains pending behind the failed full-suite gate. Rows 1.1–1.3 are checked without a commit SHA; the phase is not committed because its gates are not all green. Manual row 1.6 remains pending, as detailed in `unproven.md`.

## Automated recovery on 2026-11-14

The tested base is `9c5bb9e2f41c0768bcafadfcd9002fe0fea59d53`, on `agent-smith/agent-call-parameters`. The implemented Agent-call correction remains at `43e28f3aaf5f37a7becd05f9933c67da60b9ff93`. Node is v24.19.0. The recovery diff changes the shared fake CLI and its two cancellation consumers. Its SHA-256 is `dface714d4c1e586ac18b34433e4d785e09566a5249f980d4f2d3f42bc648153` from `git diff HEAD -- skills/10x-pipeline/test/codex-helpers.mjs skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs`.

### Recovery behavior and review

The opt-in `holdUntilRelease` mode acknowledges SIGTERM or SIGINT through `terminating` and waits for the existing `release` marker. Both chains check retention, explicitly release the child and await close. They require the cancellation envelope to contain `launched: true`, `completed: false`, a cancellation reason, `exitCode: 0` and `signal: null`, then check cleanup and lock availability. Cleanup hooks release and signal the child, await close and report any forced SIGKILL with the envelope even if an earlier assertion failed.

The reviewed callers are `run-lock.test.mjs`, `codex-runner.test.mjs` and `codex-chain.test.mjs`. Their default fixture mode retains its timer behavior. `run-codex.mjs` owns the existing five-second cancellation fallback, child-close wait, output cleanup and lock release. Source tracing and the captured historical OpenSpec failure establish the timer race addressed by this recovery. Repository lessons supply the no-nesting rule. The roadmap lookup found no matching change.

Reviewed `43e28f3` directly, including its skill, test, reference and ADR changes. Both current skills match that checkpoint. Each skill has the six owned line replacements, identical six-rule anti-stall sections, three terminal identity mappings and the Loop step 4 usage ownership guard. The reference and ADR-018/019 agree on schema-dependent flag selection, both description formats, known-id precedence, compatible unique-description fallback, separate retry invocations and on-time/late usage ownership. The existing live-verification statements remain accurate.

### Commands and scratch isolation

All test commands below start in this run worktree. They remove inherited Git redirection variables and set both scratch variables to the same absolute worktree-local directory. Individual fixture roots and runner temporary roots are siblings inside it.

#### Content and Agent dispatch

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-recovery-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-recovery-tmp" node --test --test-reporter=tap skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs
```

#### Provider, runner, chain, host and lock regression

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-recovery-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-recovery-tmp" node --test --test-reporter=tap skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/host-integration.test.mjs skills/10x-pipeline/test/run-lock.test.mjs
```

#### Targeted cancellation, two final runs

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-recovery-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-recovery-tmp" node --test --test-reporter=tap --test-name-pattern="a runner holds the shared lock|handled cancellation waits" skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs
```

#### Full repository suite

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-recovery-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-recovery-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

### Deliberate-break result

After staging the recovery, temporarily changed only the fake CLI’s release-marker predicate to ignore `release` when `holdUntilRelease` was selected. Ran the targeted cancellation command above. Exit 1 was expected and observed. All four cases failed, covering lock/report retention and raw-output retention for both 10x and OpenSpec. Each diagnostic contained `exitCode: null`, `signal: "SIGKILL"` and the cancellation reason after the unchanged five-second fallback. The mutation was restored unconditionally from an exact byte copy of the staged fixture, with byte equality checked. The two final targeted runs followed that restoration.

The historical 18 content mutations supporting completed row 1.3 remain applicable because this recovery changes no skills or content assertions. Completed rows 1.1–1.3 retain their original text and checkbox state.

### Additional gates and live handoff

`git diff --check` and `git diff --cached --check` passed with exit 0. `node tools/version-check.mjs` passed with version 1.10.0. `node tools/commit-lint.mjs --title "test(agent-call-parameters): control child shutdown"` passed. Dependency-free review assertions verified paired rules, terminal mapping counts, checkpoint equality, matching documentation and the handoff’s required capability/restriction/checklist entries.

Automated 1.8 verifies the expanded `unproven.md` handoff. Manual 1.6 remains pending for top-level Claude schema acceptance, completion delivery and usage attribution. The host exposes no Claude Agent tool, and the unattended no-nesting rule applies. The recovery commit SHA is recorded on newly completed Automated rows in `../plan.md` after the commit lands.

### Focused gate summaries

| Gate | Exit | Tests | Pass | Fail | Cancelled | Skipped |
| --- | --- | --- | --- | --- | --- | --- |
| Content and Agent dispatch | 0 | 60 | 60 | 0 | 0 | 0 |
| Provider, runner, chain, host and lock, final diff | 0 | 91 | 91 | 0 | 0 | 0 |
| Targeted cancellation, final run 1 | 0 | 4 | 4 | 0 | 0 | 0 |
| Targeted cancellation, final run 2 | 0 | 4 | 4 | 0 | 0 | 0 |
| Ignored-release deliberate mutation | 1, expected | 4 | 0 | 4 | 0 | 0 |

Two earlier targeted runs also passed 4/4. The final pair followed the added failure-cleanup SIGKILL diagnostic and deliberate-break restoration. The provider/runner/lock group was rechecked against that final diff and passed 91/91. The targeted runs retained both chains and all four cancellation cases throughout.

### Completed full-suite verdict

Exit 0 on the recovery diff identified above. The terminal summary is saved verbatim below.

```text
ℹ tests 1301
ℹ suites 13
ℹ pass 1298
ℹ fail 0
ℹ cancelled 0
ℹ skipped 3
ℹ todo 0
ℹ duration_ms 477942.478875
```

The three existing skips are the two opt-in live GitHub checks requiring `GH_LIVE=1` and authenticated `gh`, and the optional `CLAUDE.md` import check because that file is absent. The suite retains both chains’ deterministic cancellation cases. There were zero test failures and zero cancellations. No production script, policy, environment helper or CI file is included in the recovery diff.

Reviewed the complete staged recovery file list before commit. It contains the three fixture/test files, this evidence, `unproven.md` and `plan.md`. The pre-existing router-owned `agent-smith/run.jsonl` modification remains outside the staged set. The recovery commit uses the Conventional Commit subject `test(agent-call-parameters): control child shutdown` and the required Codex coauthor trailer. Progress receives its verified commit SHA in the documentation epilogue after this commit lands.

## Implementation-review correction on 2026-11-14

Reviewed base: `7d65a2e`. Node v24.19.0. F1 fixes only the content test: reuse its existing bounded branch helper so a following branch cannot satisfy a missing late-usage identity paragraph. The tested code diff SHA-256 is `3deca9651705f18ca759f0d50141dee966b4bd81274a5eea332b0dd5e97c359c`, from `git diff -- skills/10x-pipeline/test/skill-loop.test.mjs`.

### Reproduction and regression proof

For each chain and each of done/archive/halt, made an independent scratch skill copy. Starting at the selected branch heading, removed only the substring from its first `Recover` clause up to, but not including, `A wrong`, leaving later branches intact. Passed the copy through SKILL_PATH (10x) or OPENSPEC_SKILL_PATH (OpenSpec), using `node --test --test-reporter=tap --test-name-pattern="^<chain>: <branch> late usage" skills/10x-pipeline/test/skill-loop.test.mjs` with the environment below.

| Chain | Branch | Exit before fix | Exit after fix |
|-------|--------|-----------------|----------------|
| 10x | done | 0 | 1 |
| 10x | archive | 0 | 1 |
| 10x | halt | 1 | 1 |
| openspec | done | 0 | 1 |
| openspec | archive | 0 | 1 |
| openspec | halt | 1 | 1 |

All six post-fix runs failed at their corresponding named late-usage assertion. The four pre-fix exit-0 results reproduce the gap; the halt cases are controls. No production skill was mutated. The other historical content mutations are unaffected by this test-only correction.

### Post-fix commands and results

All commands below exited 0. The targeted cancellation command ran twice, passing all four cases each time. Scratch paths are inside this worktree and outside individual fixture projects.

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-review-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-review-tmp" node --test --test-reporter=tap skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs
```

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-review-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-review-tmp" node --test --test-reporter=tap skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/host-integration.test.mjs skills/10x-pipeline/test/run-lock.test.mjs
```

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-review-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-review-tmp" node --test --test-reporter=tap --test-name-pattern="a runner holds the shared lock|handled cancellation waits" skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs
```

```sh
cd "/Users/blazej/.codex/worktrees/15c9/agent-smith/.claude/worktrees/agent-smith-agent-call-parameters" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES TMPDIR="$PWD/.agent-call-review-tmp" GIT_CEILING_DIRECTORIES="$PWD/.agent-call-review-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

| Gate | Tests | Pass | Fail | Cancelled | Skipped |
|------|-------|------|------|-----------|---------|
| Content and Agent dispatch | 60 | 60 | 0 | 0 | 0 |
| Provider, runner, chain, host and lock | 91 | 91 | 0 | 0 | 0 |
| Targeted cancellation, run 1 | 4 | 4 | 0 | 0 | 0 |
| Targeted cancellation, run 2 | 4 | 4 | 0 | 0 | 0 |
| Full suite started after the fix | 1301 | 1298 | 0 | 0 | 3 |

Full-suite terminal summary:

```text
ℹ tests 1301
ℹ suites 13
ℹ pass 1298
ℹ fail 0
ℹ cancelled 0
ℹ skipped 3
ℹ todo 0
ℹ duration_ms 499746.836583
```

The skips remain the two opt-in live GitHub checks and the absent CLAUDE.md import check. The exploratory full-suite run started before the edit also exited 0; the post-fix command above is the acceptance run.

Additional checks passed: `git diff --check`; version-check (1.10.0); commit-lint for the fix title; equality of the paired six-rule sections; all six terminal mappings; the linked manual handoff's checkpoints, capability restriction and checklist; and an unchanged plan.md diff. The router's `readReview` parser recognizes the saved report as APPROVED with one measured warning and F1 APPLIED.

Manual 1.6 remains pending. No live Claude Agent launch or notification was observed, and no nested agent was launched. No router-owned state, production script, policy or skill instruction was edited. The review records the fix commit after creation; its pre-fix verdict and counts stay unchanged.
