# A browser Manual row needs browser-grade proof — Plan Brief

> Full plan: `context/changes/browser-row-proof/plan.md`

## What & Why

GitHub issue #37: `manual-verify` ticked a Manual row that asks for a check in a browser from a source read, saved as `judgment-` evidence, and the router counted it as proved. The plan makes the proof kind match the row: a browser row is proved only by browser, test, command or script evidence, and the router lists any other tick as unproven with a reason that names the kind. The router still never reads evidence content (ADR-012).

## Starting Point

`verifyManual` accepts any valid evidence file and only records its kind. The template already says to try Chrome, but nothing enforces it, and a rejected tick is shown only as a row id. The README and REFERENCE say the Chrome tools were never tested from a subagent.

## Desired End State

A row that names a browser, Chrome, Playwright or end-to-end is a browser row. Ticked with `judgment-` or other evidence it is unproven, runs the usual retry one tier up, and shows its reason in the log entry, `status`, the final message, the archive summary, `meta.outcome` and the report. The templates require Chrome first and the calls or the error in the evidence; the no-Chrome template allows a test, command or script, else the reason `Chrome off (--chrome false)`. The report marks browser rows. The live-check result is in "Limits".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Policy keys | `manualVerify.browserRowWords`, `manualVerify.browserProofKinds` | `browserWords` is a removed ADR-012 key that an old override may still carry. | Plan |
| Default words | `playwright`, `e2e`, `end-to-end`, `browser`, `chrome` | The e2e row words plus `chrome`, as the change asks; a test keeps the lists in sync. | Plan |
| Match text | Row text without its `— evidence:` suffix, from the baseline | A ticked row's evidence file name must not turn it into a browser row. | Plan |
| Weak proof | Unproven, existing retry path, no new attempt | Budget and `maxAttempts` stay as they are. | Plan |
| Reason | Log entry `unprovenWhy`; note `manualUnprovenWhy`; `manualUnproven` ids unchanged | Existing consumers and the archive gate keep working. | Plan |
| Prompt | `{browserRows}` variable lists the router's browser rows | Router and subagent use one predicate. | Plan |
| ADR | Amend ADR-012, no new number | ADR-018 and the next number are claimed by parallel changes. | Plan |
| Live check | Plan-time check done; a Manual row repeats it in a real `manual-verify` step | A subagent loaded the tool via ToolSearch; `tabs_context_mcp` answered "no tab group, use `createIfEmpty: true`". | Plan |

## Scope

**In scope:** two policy keys, the predicate and kind check in `steps.mjs`, outputs in `flow.mjs` and `route.mjs`, both templates and `manual-verify.md`, `prompts/README.md`, `SKILL.md`, REFERENCE.md, an ADR-012 amendment, AGENTS.md, tests in `manualverify.test.mjs`.

**Out of scope:** the OpenSpec chain, reading evidence content, probing for the Chrome tools, new attempts or budget changes, other row classes, a new test file, `baseline-policy.json`, the archive gate.

## Architecture / Approach

`verifyManual` computes the browser rows from the first entry's baseline, rejects a tick whose evidence kind is outside `browserProofKinds`, and stores `browserRows` and `unprovenWhy` on the log entry. Every output reads the entry. `manualVerifyNext` hands the browser rows to the prompt.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router | Keys, predicate, kind check, `{browserRows}` | Word list false positives (uncalibrated) |
| 2. Outputs and report | Reasons in every output, report marks | Merge noise in shared output sites |
| 3. Templates | Chrome first and recorded, nochrome limits | Rule-form and `--chrome false` token checks |
| 4. Docs and live check | REFERENCE, ADR-012 amendment, AGENTS.md, Chrome check | Conflicts with two parallel changes in the same files |

**Prerequisites:** none.
**Estimated effort:** about 3 sessions across 4 phases.

## Open Risks & Assumptions

- A `browser-` file can still hold junk: the router reads no content, so the prefix is a claim. The templates make it checkable.
- Assumed: no change to the attempt count, so the budget test needs no edit.
- Assumed: commit type `fix`; the owner decides.
- The Chrome check at plan time was read-only and did not open a page.

## Success Criteria (Summary)

- A browser row ticked with judgment evidence is unproven with a reason, in every output.
- Templates require Chrome first and recorded; the nochrome template gives a fixed reason.
- Full suite green; REFERENCE.md and ADR-012 agree with the code and record the live-check result.
