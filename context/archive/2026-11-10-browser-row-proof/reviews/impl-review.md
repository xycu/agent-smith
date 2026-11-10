<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: A browser Manual row needs browser-grade proof

- **Plan**: context/changes/browser-row-proof/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: commits e9690d7 (p1), d9b6e2e (p2), b350498 (p3), f88db7f (p4) against the plan's Changes Required. Router (`steps.mjs` `manualVerifyOptions`, `browserRowIds`, `verifyManual`, `manualVerifyNext`, `manualUnprovenWhyRows`, `doneNotes`), outputs (`flow.mjs` `archiveLines`, `manualCheckLines`, `decide`; `route.mjs` `{browserRows}` and the `status` row), templates, `prompts/manual-verify.md`, `prompts/README.md`, `SKILL.md`, REFERENCE.md, ADR-012 Amendment 1 and AGENTS.md all match their contracts. The router still reads no evidence content. Success criteria run in this review: full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` 944 tests, 942 pass, 0 fail, 2 skipped; the stale-claim grep prints nothing; `node tools/version-check.mjs` OK (1.4.0); `status browser-row-proof` prints valid JSON. Manual rows 3.6, 4.6 and 4.7 carry evidence files that match what the rows ask.

## Findings

### F1 — Chrome rules narrowed to the router's word list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/policy.json (`prompts.manual-verify`, the ToolSearch rule and the "unavailable, fail or are not connected" rule)
- **Detail**: Before this change both rules applied to any row that "needs a browser". The change scoped them to "a Browser row", the router's `browserRowWords` list. A row that needs a browser but names none of the words (for example "open http://localhost:4321/ and see the heading") lost both the rule to load the Chrome tools first and the rule not to wait or ask when the tools are unavailable, while the rule "MUST NOT judge it from the source" still applies to it. For an unattended step the lost no-wait rule is the risky part. The plan's contract (d) for the unavailable case is not scoped to Browser rows.
- **Fix**: Widen both GIVEN/WHEN clauses to "a Browser row, or another row that needs a browser", and say the same in REFERENCE.md "Manual verification".
- **Decision**: APPLIED — 7376376 (fix(browser-row-proof): Chrome rules cover every row that needs a browser)

### F2 — Word list hits hyphenated identifiers

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/steps.mjs `browserRowIds` (via `goalPhrase`, preplan.mjs:24)
- **Detail**: `goalPhrase` treats any non-letter, non-digit as a word start, so `--chrome false`, `implement-e2e`, `executor-e2e.md`, a change id such as `browser-row-proof` and a backticked `` `browser` `` make a row a browser row. This plan's own row 3.6 is one: it mentions `` `browser` `` and asks for a prompt read; it was proved by `test-` evidence without the Chrome attempt the new template asks for. The plan accepts an uncalibrated list and the ADR amendment lists false positives as a risk, so this is no defect of the implementation.
- **Fix**: Owner choice: keep as is (the retry settles it with a test, command or script), or later require a whitespace or start-of-text word boundary for `browserRowWords`.
- **Decision**: PENDING — calibration of the word list is out of this plan's scope ("no calibration of the word list"); the owner decides whether to tighten the match in a later change.

### F3 — The live manual-verify step ran under the installed router

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/browser-row-proof/agent-smith/run.jsonl (entry 5)
- **Detail**: Entry 5 (`manual-verify`) has no `browserRows` field, so the router that verified it was the installed plugin (provenance `plugin: 1.4.0`), not this branch's code. The new `verifyManual` path and the new templates were therefore not exercised by a live step; the CLI tests cover them. Row 4.6 called `tabs_context_mcp` without `createIfEmpty: true`, as the row asked, so a page load is still unseen, as REFERENCE "Limits" says.
- **Fix**: None needed for this change; a live run after release exercises the new path.
- **Decision**: PENDING — no code fix; the owner decides whether to repeat the live check with `createIfEmpty: true` and a page load after the release.

### F4 — Archive "no" message omits the rejection reasons

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md (`archive` step 1, final message after a no)
- **Detail**: Step 1 now reports `summary.manualUnprovenWhy` lines before the gate, as the plan asks, but the final message after a no repeats only `manualUnproven`, `manualNotProved` and `uncommittedTicks`. The reasons were already printed a few lines earlier in the same step, and the plan says the ADR-014 gate text stays unchanged.
- **Fix**: Optionally add `manualUnprovenWhy` to that list in both SKILL.md files.
- **Decision**: PENDING — the gate text is pinned by ADR-014 and mirrored in skills/openspec-pipeline/SKILL.md; the owner decides whether to extend it.
