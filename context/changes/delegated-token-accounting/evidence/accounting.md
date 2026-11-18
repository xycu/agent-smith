# Delegated token accounting evidence

Implementation candidate, 2026-11-18. Automated verification is separate from live host qualification. No billing completeness, actual spend or measured savings claim is made.

## Fixture provenance and scope

Positive fixtures are hand-authored from the pinned Codex 0.169.0 source `d32063f96c2dff1dc96af839b3952abb6acfeda4` and documented Claude Code 2.1.311 native hook/transcript/OTLP shapes. They are not captured telemetry and do not invent retained probe record IDs. Research links and historical observations remain in [research.md](../research.md); temporary probe paths there are provenance, not test dependencies. This implementation did not read or modify those outside-root captures, run live accounting/qualification probes, install hooks or configure exporters. Implementation used the authorized native leaf agents separately from those host probes.

- `codex-helpers.mjs`/`codex-usage.test.mjs`: synthetic actual thread/session/causal-turn IDs, response IDs, own-context cumulative snapshots, copied legacy and paginated-child boundaries. Archived descendants are represented. Root exec usage is corroboration, never another additive source.
- `claude-helpers.mjs`/`claude-usage.test.mjs`: synthetic fresh paired Agent Pre/PostToolUse, SubagentStop and regular transcripts; UUID/parent chains, request/message usage and final assistant UUID; process-qualified OTLP event prefix through enclosing Agent return. The fixture contains two requests each for enclosing step and leaf, plus unrelated orchestrator usage. Step/leaf total is 151, versus the final step request footprint 70. A flat step total is 117.
- `accounting-readers.test.mjs`: actual Codex runner and Claude collector outputs enter the real router on both chains, then status/report/compare. A prior failed legacy attempt remains in the live continuation. Terminal comparison snapshots copy only completed rows already accepted by intake, leaving the live pending dispatch intact. Mixed scope refuses a verdict; the actual accepted verified row alone remains comparable. Separate fixtures cover same totals/different scope, unavailable claims, zero/missing/subtotals, safe overflow, prototype-shaped model aliases, pricing and structured late refresh/archive exclusion.

## Supported capability boundary

Codex accounting supports the inspected 0.169.0 shape. Real thread IDs, root session and causal turn must match; distinct `(thread_id, response_id)` values are deduplicated and each context reconciles against its own final cumulative snapshot before disjoint totals are added. Input plus output is additive; cached input and reasoning output are subsets. Only proven invocation-local copied legacy/paginated-child boundaries qualify. Unknown referenced, resumed, forked or root history remains unavailable. Observed source and snapshot agreement do not certify requests omitted by the host from both sources or billing completeness.

Claude accounting supports strict optional 2.1.311 local capture, not arbitrary telemetry exports. Native Agent `tool_use_id` is `runId`; exact session/agent/run attribution, transcript membership and final UUID, equal API/assistant-response/native request sets, observed process PID/creation-time resource matching and a contiguous event-sequence prefix from zero through enclosing Agent return are required. Child terminal and return records precede parent close. Notifications, quiet files, final-request totals or “complete” booleans do not prove completeness. Default capture shapes often lack these provenance fields and return unavailable. Uncached input, output, cache read and cache creation are additive. `sessionCount` counts measured agents/threads, not shared outer session IDs.

Both collectors read stable local regular files under canonical roots, reject symlink redirects/replacement, keep independent tool/duration counters, and persist only bounded derived evidence. Limits are 64 KiB descriptor/late file, 4 KiB evidence, 1 MiB record, 32 MiB invocation, 512 contexts, 100000 requests, 200000 Claude events and 2 seconds of read budget. Codex usage metadata plus file reads share its deadline. Synchronous deadlines cannot interrupt a blocked filesystem syscall; blocking remote storage is unqualified.

## Automated gate record

The enclosing implementation step supplied the following completed gate results; logs remain under the ignored run-root `.claude/worktrees/accounting-tmp/` directory. This evidence records the supplied results, not independent reruns by the Phase 4 leaf.

| Phase | Command/check | Result |
| --- | --- | --- |
| 1 | Intake/evidence focused tests (`p1-intake.log`) | 36 passed |
| 1 | Late usage and state focused tests (`p1-late-retry.log`) | 174 passed |
| 1 | Required full suite (`p1-suite-hermetic.log`) | 1823 tests: 1820 passed, 0 failed, 3 skipped; 1138753.626 ms |
| 2 | Collector/runner focused tests (`p2-collector.log`) | 103 passed |
| 2 | Closure/chain checks (`p2-closure.log`) | 30 passed |
| 2 | Required full suite (`p2-suite.log`) | 1859 tests: 1856 passed, 0 failed, 3 skipped; 810911.702 ms |
| 3 | Claude collector focused tests (`p3-collector.log`) | 70 passed |
| 3 | Skill-loop and related checks (`p3-loops.log`) | 98 passed |
| 3 | Required full suite (`p3-suite.log`) | 1893 tests: 1890 passed, 0 failed, 3 skipped; 815406.173 ms |
| 1–3 | Three deliberate-break checks | Passed; enclosing step restored saved source bytes without destructive Git |
| 4 | `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/cost.test.mjs` | 110 passed |
| 4 | `node --test skills/10x-pipeline/test/accounting-readers.test.mjs` | 13 passed |
| 4 | `node --test skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs` | 33 passed |
| 4 | Required full suite (`p4-suite.log`) | 1906 tests: 1903 passed, 0 failed, 3 skipped; 811208.892 ms |
| 4 | `node tools/version-check.mjs` | Passed: version 1.13.0 |
| 4 | `git diff --check` | Passed |
| 4 | Mixed-scope deliberate-break check (`p4-break.log`) | Passed; disabling the scope guard made the comparison assertion fail; saved source bytes restored |

Required full-suite command:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

An initial Phase 1 full attempt had 13 environment failures: in-root scratch projects discovered enclosing repository HEAD. The enclosing step added an ignored scratch Git-discovery barrier and reran successfully. Subsequent gates use run-root `TMPDIR="$PWD/.claude/worktrees/accounting-hermetic"`. This is test isolation, not a product behavior change. The three existing skips are two `GH_LIVE` checks and the optional `CLAUDE.md` import check; they supply no positive live qualification.

Phase 4 focused retries corrected two missing-token fixtures that incorrectly retained a recorded scalar, and one stale Markdown expectation that omitted the new legacy-scope warning. The router retained its immutability guard; no production behavior or existing provenance assertion was relaxed.

## Assumptions, activation and rollback

Evidence-backed assumptions follow the plan and research: legacy scalars retain unverified scope; missing never becomes measured zero; verified/legacy mixtures cannot support a savings verdict; routing-model prices approximate child usage; source incompleteness must not turn settled execution into an execution fault. Structured late input fills only missing tokens for the originally recorded exact source/version/invocation, never merges counters or replaces recorded numbers. Its uniquely and exclusively created transient input stays outside the change folder and is unlinked by its owner. Existing late cutoffs, locking, report refresh and archive commit/recovery remain in force.

Activate all four phases together only after all Automated gates, including actual producer-to-reader integration, pass. Intermediate phase commits are development checkpoints. Keep one implementation revision through execution settlement and intake. There is no stored-ledger migration, backfill, archive rewrite or destructive contraction. Prefer unavailable evidence when collection fails. Rollback is a normal preserving follow-up commit after settlement; retain logs, evidence and recovery refs. Older readers cannot substantiate verified scope or savings for new/mixed rows.

The enclosing step collected native leaf invocations `/root/phase1`, `/root/phase2`, `/root/phase3` and `/root/phase4`. Each returned its changed paths and stopped writing before the enclosing step ran gates, updated Progress and committed. Their child-inclusive token coverage is unknown; no totals for delegated implementation work are inferred. The leaves ran no gates or Git writes and left real router state untouched.

## Manual acceptance outstanding

- [ ] 4.3 Fresh final-candidate delegated Codex and native Claude qualification in interactive and headless modes across both pipeline entry points. Record exact versions, invocation boundaries, matched totals or explicit unavailable reasons and unchanged settlement. Synthetic fixtures and historical probes do not satisfy this row.
- [ ] 4.4 Inspect immediate, late and archive output on qualified hosts for whole-step scope, no duplicate counting, missing/zero distinction, archive exclusion, subtotals and routing-rate labels. Unsupported positive paths remain unqualified.

## Live-contract consistency review

Searched current `skills/`, `docs/`, `README.md` and `context/foundation/` for flat-token mappings, collaboration suppression and whole-object immutability claims. Updated the reference’s old exec-snapshot and notification mapping, distinguished legacy flag mode from structured enrichment, and appended amendments to ADR-018 and ADR-019 without rewriting history. ADR-024 received an additional amendment because its current collaboration omission also contradicted the new producer contract. Existing skill loops already carry measured usage and exact-identity enrichment. Historical archive files were left untouched.

## Independent Manual verification attempt — 2026-11-18

Rows 4.3 and 4.4 remain pending. Installed CLI versions match the pinned versions (command-manual-host-versions.log). A fresh Claude collector test run passed all 34 tests (test-manual-claude-usage.log), including the immediate/late/archive collector boundary. Neither establishes the required live-host matrix. No fresh live model run, external capture read, exporter setup or publication was performed. judgment-manual-host-qualification.md records the reviewed claims, known real-format gaps and limits of this proof; unproven.md lists every pending Manual row.
