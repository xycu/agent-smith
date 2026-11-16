---
change_id: compare-damaged-logs-not-comparable
title: Reject damaged run logs as comparable savings evidence
status: impl_reviewed
created: 2026-11-15
updated: 2026-11-16
archived_at: null
---

## Notes

**Owner request.** "Create the changes for both must fixes using 10x-new, please be descriptive in the change."

**Origin.** Must-fix finding 1 of the repository-wide ponytail audit on 2026-11-15, inspected at revision `ddab87c26b78be506cf402112440f14d531b9e39`. The audit reproduced the failure through the real router CLI in scratch projects. The existing suite passed with 1,621 passes, zero failures and three expected skips; its partial-log tests did not catch this incorrect savings verdict.

**Problem.** `compare` reads each run log tolerantly: it retains usable entries and exposes damaged records through `logProblems`. That is useful for inspection, but the comparison then checks usage completeness against only the surviving entries. A missing record disappears from both the token total and the count of steps needing usage. A run whose metadata says `done` can therefore remain `comparable: true` and receive a positive savings verdict despite known incomplete evidence.

**Reproduced case.** Both sides have the same goal and base SHA, completed outcomes, and otherwise eligible comparison inputs. The baseline is pinned to the documented baseline configuration and contains 1,000 tokens. The routed log contains two executed steps with 500 and 600 tokens; the configured reduction target is 30%.

1. Comparing the intact logs returns routed usage of 1,100 tokens, `comparable: true` and `verdict: "not met"`.
2. Remove the final closing brace from the routed log's second JSON record in the scratch fixture.
3. Comparing again reports `logProblems` with `line: 2` and `reason: "Invalid JSON"`, but totals only 500 routed tokens and returns `comparable: true` and `verdict: "met"`.

This is an evidence-integrity failure: damaging the record changes a failed target into an apparent success. It can mislead routing decisions and savings claims even though a diagnostic appears elsewhere in the output.

**Intended outcome.** If either side has any `logProblems`, the pair is not comparable. Preserve partial totals and the existing file/line/reason diagnostics for investigation, but return `comparable: false`, an explicit reason identifying the affected side, `dropPercent: null` and `verdict: "not comparable"`. The same rule applies with `--unpinned`, which waives only baseline pinning. A damaged record must never count as zero usage or disappear from the completeness decision.

**Responsible code and existing coverage.**

- [route.mjs](../../../skills/10x-pipeline/scripts/route.mjs): `readSide` already exposes `logProblems`; `comparePair` owns comparison eligibility and verdicts; `compareMarkdown` renders that same result. Put the eligibility rule in the existing comparison path so JSON and Markdown agree.
- [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs): retain the existing tolerant `readLog` contract and its privacy-preserving diagnostics. Read-only inspection should remain available.
- [compare.test.mjs](../../../skills/10x-pipeline/test/compare.test.mjs): reuse its paired-run fixtures and CLI assertions for the false-success regression.
- [run-state.test.mjs](../../../skills/10x-pipeline/test/run-state.test.mjs): the both-chain partial-log test currently asserts diagnostic attribution and read-only behavior, but not comparison eligibility or the verdict.
- [REFERENCE.md](../../../docs/REFERENCE.md): update the damaged-log and comparison descriptions to state when a partial read disqualifies a pair.

**Done when.**

- The reproduced clean pair still reports 1,100 routed tokens and `not met`; damaging the 600-token record produces `not comparable`, never `met`.
- Damage on the baseline side, routed side, or both sides disqualifies the pair with clear side attribution. Existing `logProblems` categories, including invalid JSON, non-object records and read failures, cannot yield a comparable pair.
- The behavior holds for both 10x and OpenSpec logs, and for pinned and `--unpinned` comparisons. JSON and Markdown agree on eligibility and verdict while retaining the partial evidence.
- Comparison remains read-only: inspected logs, metadata and other run files are byte-identical before and after the command. Raw damaged record contents are not exposed by diagnostics.
- Clean comparisons retain their existing totals, rounding, target verdicts and warnings. Accepted blank lines and CRLF do not become corruption; missing/empty logs retain their existing non-comparable behavior.
- Focused regression tests pass, followed by the required suite: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node 24+. Index any new test file in its folder README.

**Scope boundary.** This fixes the shipped comparison's handling of known damaged input. It does not repair logs, change the saved-run format, add a policy switch, change the savings target or baseline, collect new benchmark runs, or expand cost accounting. The deferred PRD FR-017 savings/scorer experiments remain separate work. No dependencies are needed.
