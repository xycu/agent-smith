# Phase 2 contract proof

## Deliberate-break matrix

Each mutation used scratch skill copies and the existing SKILL_PATH and OPENSPEC_SKILL_PATH overrides. Production bytes were preserved. Every broken fixture exited nonzero at the intended guard.

| Mutation | Failing guard |
| --- | --- |
| 10x-missing-late-call | late usage has one owner and precedes terminal status, publication and archive launch; 10x: done late usage recovers the earlier numbered launch, not the latest repeated step |
| 10x-lost-opt-in | 10x: archive publication covers verification success, failure and gate refusal; 10x: skill byte budget and single procedure owners |
| 10x-changed-anti-stall | 10x: full Anti-stall baseline is immutable; the anti-stall section equals the one of the 10x skill and follows the rule form |
| 10x-forbidden-routing | 10x: routing literals stay in policy and reference |
| 10x-reordered-cutoff | late usage has one owner and precedes terminal status, publication and archive launch |
| 10x-reordered-publication | 10x: archive publication covers verification success, failure and gate refusal; done, archive and halt reach publication before STOP, with comments owned by publication |
| openspec-missing-late-call | openspec: done late usage recovers the earlier numbered launch, not the latest repeated step; one chain-selected usage procedure is called before status and publication on every terminal path |
| openspec-lost-opt-in | openspec: archive publication covers verification success, failure and gate refusal; openspec: skill byte budget and single procedure owners |
| openspec-changed-anti-stall | openspec: full Anti-stall baseline is immutable; the anti-stall section equals the one of the 10x skill and follows the rule form |
| openspec-forbidden-routing | openspec: routing literals stay in policy and reference; the skill names no model alias, effort level or tier word |
| openspec-reordered-cutoff | one chain-selected usage procedure is called before status and publication on every terminal path |
| openspec-reordered-publication | openspec: archive publication covers verification success, failure and gate refusal; terminal branches reach publication and archive verifies before publishing |
| matching-anti-stall-edits | 10x: full Anti-stall baseline is immutable; openspec: full Anti-stall baseline is immutable |
| oversized-10x | 10x: skill byte budget and single procedure owners |

Matching edits to both Anti-stall copies still failed their fixed digests. Cross-chain equality alone would pass that mutation. The original contract fixtures were rerun successfully.

## Operational comparison

Compared against the starting commit recorded in the run scratch evidence. Manual Progress row 2.6 remains pending for independent review.

| Obligation | Final local owner and call paths |
| --- | --- |
| Setup on both hosts | Start 1–5 retain user flag parsing/reset, toolkit prerequisites, absolute script resolution, timeout, saved setup JSON, field/type validation, selected-root checks, original-root archive lookup, resume safety and cleanup only after successful init. Cleanup errors retain the initialized root and print the original path. Final diagnostics retain branch, root, retained paths, side refs and conditional uncommitted-state guidance. |
| Claude dispatch | Run 2 retains host restriction, schema-selected background field, router agent fallback, exact model/effort/description/prompt, independent retry invocation records and rule-6 usage ownership. File handoff remains verbatim and unread by the parent. Orchestrator faults require no running child and the original three launch-fault cases. Other launch errors become unknown without another agent type. |
| OpenAI dispatch | Run 2 retains full action stdin, exact prompt/dispatch, fresh-child discovery prerequisites, existing trust controls, process-handle waits, no timeout relaunch, normalized completed results, launched-but-incomplete unknown results and prelaunch-only orchestrator errors. Uncertain processes close before result/router mutation, rollback or another launch. |
| Native result and telemetry | Run 3–5 retain last-RESULT parsing, unknown fallback, every result key/signals, child-authored orchestrator-error normalization, exact matched usage fields and same-turn next when telemetry is absent. |
| Done | Each branch calls local Late usage before status, then local Final report with the saved done action and status. Final report names the source of verdict, count, report, model/effort and proof/task fields. 10x keeps stale changeStatus diagnostics and both run-root archive commands. Publication follows reporting. |
| Halt | Each branch calls Late usage, status and publication before STOP. It retains saved halt reason, report when present, archive/committed distinctions, retained local commit, next-after-repair guidance and commit-content inspection. It performs no autonomous recovery. |
| Archive before launch | Steps 1–5 keep their meanings. Step 1 calls Late usage before status, with the local cutoff sentence before step 3. The exact manual-gate options, recommended No, native host question, fail-closed handling, distinct-row count and first-bullet-of-step-5 refusal path stay explicit. |
| Archive success | After child close and read-only verification, step 5 publishes with the moved report path for both scripts. It prints archive/report paths, clean-status confirmation, ignored files and child assumptions/usage. OpenSpec also copies archivedAs/path and runs/commits its CLI archive once. 10x repeats summary checklist and reasons. |
| Archive verification failure | Step 5 publishes using the default report, prints verification reason and child note, then stops. The 10x half-archive warning and OpenSpec CLI/date diagnostic remain. |
| Manual-gate refusal | No child or verification launches. The first step-5 bullet publishes with the default report. The final message repeats checklist/reasons, committed/unarchived state, later archive command, repeat-invocation behavior, stale Archive requested line and worktree notes. OpenSpec retains its dormant-gate statement. |
| Publication | One Pull request procedure owns once-per-terminal creation/push, output/error/swept/manual diagnostics and subsequent invocation of PR comment. One PR comment owner requires strict saved terminal action true, preserves intent over status/verify, forwards PR URL, selects moved/default report and skips without retry on absent report/error. OpenSpec always supplies its explicit report path. Results stay final-message-only. |
| Fixed rules and routing | Both complete Anti-stall sections retain the 3333-byte baseline digest, six ordered rule lines and original numbered references. Tuning contains policy, merge/array replacement, immutable-rule and reference pointers. Routing values and explanations reside in policy/reference. |

## Environment and verification

Node v24.19.0, non-root macOS (Darwin, uid 501), installed OpenSpec CLI 2.0.0. CI uses non-root Linux, coverage instrumentation and pinned OpenSpec 1.16.1. Local acceptance does not establish those CI-specific conditions or paid live-host execution.

The final focused suite passed 238 tests with zero failures and two expected GH_LIVE opt-in skips. Version check passed at 1.11.0. Scope checks preserve WAVES.md, all archives, runtime scripts/policies/tools and recorded hashes of router-owned state and Wave 7 sibling tools. The initial router-state modification remains outside the staged set.

## Final automated gate results

The full required suite passed 1535 tests out of 1538, with zero failures, cancellations or todos. Its three skips were the two GH_LIVE opt-in network tests and the absent CLAUDE.md import check. All five real OpenSpec contract fixtures executed with installed CLI 2.0.0. The local suite ran without CI coverage instrumentation.

The final skills measure 25,867 UTF-8 bytes for 10x and 29,230 for OpenSpec. Reductions from the starting source are 22,102 and 7,220 bytes. Both full Anti-stall sections retain the fixed 3333-byte baseline digest. One late-usage command and one strict PR-comment authorization owner remain per skill. The final focused content run passed all 86 tests after whitespace cleanup. The broader focused command passed 238 tests with two expected live-GitHub skips. All 14 deliberate-break fixtures went red at their intended guards and their original contract fixtures passed again.

Guard predicates checked missing per-branch late-usage references, cutoff-before-launch ordering, verify-before-publication ordering, strict true authorization and its single owner, fixed Anti-stall SHA-256, routing literal exclusion and Buffer.byteLength at the 26000-byte ceiling. Branch references are checked separately from their complete local owners.

Version check passed at 1.11.0. Both staged and unstaged diff whitespace checks passed. Preserved-state hashes and owned-file checks passed. Runtime scripts, policy, tools, WAVES.md and archives retain their starting contents. The preexisting router-owned run.jsonl modification was preserved and excluded from both phase commits.

## Run report

Both phases completed their automated gates. Phase 1 committed as c9eb670. Phase 2's commit is recorded in plan.md Progress. Execution stayed in this subagent under the supplied no-delegation rule. No implementation-scope adaptations were required.

Pending manual verification remains unchanged.

- 1.4 A written source-to-reference inventory accounts for every removed routing bullet and confirms its documented thresholds, exceptions and sequencing.
- 2.6 A written comparison of original and compressed skills accounts for each operational obligation across done, halt, archive success, archive verification failure and manual-gate refusal for both hosts and chains.

The inventories above support those independent manual reviews. Live-provider execution and Linux/coverage/pinned-CLI CI equivalence remain unverified.

Starting commit was 6b697d86d3a0ff95a0e13eceb771359f9cae85c1.
