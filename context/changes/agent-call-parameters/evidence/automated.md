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
