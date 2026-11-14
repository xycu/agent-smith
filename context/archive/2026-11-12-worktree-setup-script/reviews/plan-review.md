<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Shared run setup implementation plan

- **Plan**: context/changes/worktree-setup-script/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict and finding counts describe the plan before edits. Both findings have been applied. No owner decision remains pending. Implementation must prove the added acceptance cases.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding passed for 9/9 existing modification paths and 9/9 referenced symbols. The brief and plan agree on two phases, ownership and preservation behavior. The two additional paths are intentional new deliverables, `prepare-run.mjs` and `prepare-run.test.mjs`.

The existing paths checked were both pipeline skills, both skill-content test files, the 10x test index, AGENTS.md, REFERENCE.md, ADR-010 and the ADR index. The symbols checked were `ID_RE`, `spawn`, `isEntryPoint`, `loadPolicy`, `isolationOn`, `run`, `gitEnv`, `gitInit` and `cleanupAll`.

The canonical Progress block contains seven unchecked rows. Its two phases and all seven acceptance bullets match the implementation phases. Review edits preserve that entire block byte-for-byte.

### Claims verified

- Both skills implement the same ordered six cases, including recognition of another id's linked run branch and copying only during fresh creation. The planned caller changes stay in their owned Start step 3 sections. [10x skill](../../../../skills/10x-pipeline/SKILL.md#start), [OpenSpec skill](../../../../skills/openspec-pipeline/SKILL.md#start)
- Router policy loading merges the 10x policy, the OpenSpec fragment and the project override. Invalid present project overrides fail, and isolation requires boolean true in an object. The planned projection and parity tests fit those semantics. [state.mjs](../../../../skills/10x-pipeline/scripts/state.mjs), [isolation.mjs](../../../../skills/10x-pipeline/scripts/isolation.mjs)
- Existing standalone exports supply id validation, bounded argument-array subprocesses and entrypoint detection. Router state ownership remains separate from setup. [pr-common.mjs](../../../../skills/10x-pipeline/scripts/pr-common.mjs), [open-pr.mjs](../../../../skills/10x-pipeline/scripts/open-pr.mjs)
- Wave 4 owns setup and Start step 3. The shared helpers and the existing no-push guard test are sibling-owned. The plan correctly places new setup coverage in its own test file and defers source cleanup to Wave 5. [WAVES.md](../../WAVES.md), [stale-main-change-copy](../../stale-main-change-copy/change.md)

## Findings

### F1 — Reuse can observe an unfinished setup

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff, pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / State sequencing and failure safety

**Detail**

The original plan says Git's non-forced creation arbitrates competing invocations. That protects branch creation, while setup continues with a separate copy operation. A second invocation can discover the newly registered branch and worktree, select reuse and return a usable runRoot before the first copy finishes. An invocation from the new worktree can similarly select in-run-worktree. Router initialization can then consume incomplete inputs.

A real scratch-repository proof created an untracked source change folder, completed `git worktree add --no-track -b`, and immediately confirmed that `worktree list --porcelain -z` exposed the run branch while the destination change.md was still absent. This establishes the publication window without a new setup implementation. The original ordered predicates are recorded in both callers. [10x skill](../../../../skills/10x-pipeline/SKILL.md#start), [OpenSpec skill](../../../../skills/openspec-pipeline/SKILL.md#start)

**Fix**

Use one exclusive filesystem lock in the Git common directory, keyed by the selected full branch name and shared across chains and project prefixes. Preserve read-only no-setup cases, acquire before returning an existing run root or selecting creation/reuse/attachment, refresh discovery under the lock, and hold through the complete copy. Return the existing runtime failure envelope on contention and release only the acquired lock in finally. Add a real two-process regression that pauses after worktree registration and checks competing calls from both directories.

- Strength — protects the interval Git leaves exposed using Node built-ins within the setup owner.
- Tradeoff — an interrupted setup can leave a lock requiring inspection before manual removal.
- Confidence — HIGH, the publication window was reproduced with real Git.
- Blind spot — implementation and process-interruption handling still need their planned tests.
- **Decision**: APPLIED — changed Critical Implementation Details / State sequencing and failure safety, Phase 1 / Setup executable, and Testing Strategy / Real-script acceptance matrix. Synchronized the brief's Key Decisions Made, Open Risks & Assumptions and Success Criteria.

### F2 — The test deadline can preempt timeout JSON

- **Severity**: WARNING
- **Impact**: LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach and Testing Strategy / Real-script acceptance matrix

**Detail**

The plan fixes each Git subprocess deadline at 120000 ms and requires a real-script timeout case through existing helpers. The `run` helper also kills its child after 120000 ms by default and throws on timeout. Its timer starts before setup reaches the blocking Git call, so a test using the default outer deadline loses the process before it can validate the required runtime JSON. The existing helper already accepts a per-call timeout override. [helpers.mjs](../../../../skills/10x-pipeline/test/helpers.mjs), [open-pr.mjs](../../../../skills/10x-pipeline/scripts/open-pr.mjs)

**Fix**

Give the real timeout case a 150000 ms outer deadline through `run`'s existing option. Use one bounded blocking wrapper process, await its termination before fixture cleanup, and assert the script's failure JSON. Keep ordinary cases on the helper's existing deadline.

- **Decision**: APPLIED — changed Testing Strategy / Real-script acceptance matrix failure-test instructions and the brief's Success Criteria. The timeout and concurrency checks map to existing Progress row 1.2.

## Verification

- The existing isolation and skill-content baseline passed with 51 tests, zero failures and zero skips. The command ran both chains' isolation suites and both skill-content suites using Node v26.13.1 and Git 2.54.0.
- The real Git publication-window assertion passed. Temporary repositories and test fixtures stayed inside this worktree and were removed with the repository's removeTree helper.
- Final checks cover router parsing of both finding blocks, preserved header counts, APPLIED decisions, the immutable Progress block, file scope and whitespace.

## Assumptions and limits

- Unattended review uses the existing ownership documents and code as decision evidence. All deep verification was performed in this subagent, following the supplied prohibition on nested delegation.
- The exclusive setup lock is the narrow synchronization mechanism for F1. It adds no routing policy, dependencies or recovery-state format.
- Only plan.md, plan-brief.md and this review are review deliverables. The supplied file scope keeps change.md lifecycle metadata outside this step's edits.
- The setup implementation, new regression suite, full repository suite and live host permission checks remain unverified in this review. The planned timeout regression will add roughly 120 seconds to a suite execution. Interrupted setup locks require inspection before removal.
