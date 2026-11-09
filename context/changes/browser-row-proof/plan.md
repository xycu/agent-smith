# A browser Manual row needs browser-grade proof Implementation Plan

## Overview

GitHub issue #37: the `manual-verify` step ticked a Manual row that asks for a check in a browser using only a read of the source, saved as `judgment-` evidence, and the router counted it as proved. This plan makes the proof kind match the row. The router learns which rows are browser rows (a new policy word list), accepts only browser, test, command or script evidence for them (a new policy kind list), and lists any other tick as unproven with a reason that names the kind. The two `manual-verify` templates require the Chrome tools to be tried first and the attempt, or its error, to be recorded. The report marks browser rows. Docs, ADR-012 and tests follow. ADR-012's rule that the router never reads evidence content stays.

## Current State Analysis

- `verifyManual` (`skills/10x-pipeline/scripts/steps.mjs:405`) accepts a tick when the evidence file exists, is non-empty, lies inside the real `evidence` folder and is newer than the step start. The kind (`evidenceKind`, `steps.mjs:349`) is read from the file name prefix and only recorded in `proved`; no kind is rejected. A `judgment-` file proves any row.
- `MANUAL_DEFAULTS` and `manualVerifyOptions` (`steps.mjs:331`, `:335`) hold the display knobs with a "wrong shape reads as default, never halts" rule.
- `manualVerifyNext` (`steps.mjs:290`) returns the step, its template (`manual-verify` or `manual-verify-nochrome` by `meta.chrome`), and `unproven` (ids) which fill `{unproven}` in the prompt (`route.mjs:169`).
- Unproven ticks reach the outputs as ids only: `manualUnprovenIds` (`steps.mjs:279`) feeds `doneNotes` (`steps.mjs:262`), `flow.mjs` `archiveLines` (`:19`), the `done` and `archive` outputs, `meta.outcome` (`finishRun`) and the `status` row (`route.mjs:635`).
- `manualCheckLines` (`flow.mjs:234`) renders `## Manual checks` from the last `manual-verify` entry: `Proved` grouped by kind and `Not proved`. A tick the router rejected is not shown there.
- Both templates are in `skills/10x-pipeline/policy.json:307-318`; the Chrome rules are three lines in `manual-verify`, one in `manual-verify-nochrome`; the shared rules are `prompts/manual-verify.md`, whose judgment rule allows any row asking to read or judge.
- `executors.e2e.rowWords` (`policy.json:349`) is `["playwright", "e2e", "end-to-end", "browser"]`, matched by `goalPhrase` (`preplan.mjs:24`): a phrase matches where it starts at a word start, lower-cased.
- `docs/REFERENCE.md` says in "Manual verification" (about line 181) and "Limits" (about line 313) that no Chrome call from a subagent was tested; ADR-012 "Risks" and "Unverified assumptions" say the same. The README does not repeat it.
- Live check done while planning (2026-11-10): this plan step's subagent (general-purpose, no `Agent` tool) loaded `mcp__claude-in-chrome__tabs_context_mcp` through `ToolSearch select:` and called it once. The call returned a normal tool result, not an error: "This session has no tab group of its own ... Use createIfEmpty: true to create this session's group." So a step subagent can load and call the Chrome tools; a call without `createIfEmpty: true` finds no tab group. Not yet seen: `createIfEmpty: true`, a page load, an exported page text. The Manual row 4.6 repeats the check inside a real `manual-verify` step.

## Desired End State

- A pending Manual row whose text names a browser word is a browser row. Only a `browser-`, `test-`, `command-` or `script-` evidence file proves it. A tick with `judgment-` or `other` evidence is listed as unproven with the reason `browser row ticked with <kind> evidence; only browser, test, command, script evidence proves it`, the retry one tier up runs as for any unproven tick, and the run goes on after the last attempt.
- The reason shows in the log entry (`unprovenWhy`), `status`, the final message and `archive` summary and `meta.outcome` (`manualUnprovenWhy`), and the archive lines of `report.md`. The `## Manual checks` section marks browser rows `[browser row]` and lists rejected ticks with their reason.
- `manual-verify` requires the Chrome tools first for a browser row and requires the attempt or its error in the evidence; `manual-verify-nochrome` allows only a test, command or script and otherwise the reason `Chrome off (--chrome false)`.
- REFERENCE.md, ADR-012 (amendment), AGENTS.md and the tests say so, and the Chrome live-check result is recorded in "Limits".
- Verified by: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` green; the rule-form tests green for the changed prompts and ADR; Manual row 4.6 proved by a `manual-verify` subagent or left pending with the Chrome error as its reason.

### Key Discoveries:

- The e2e word list and the browser-row list overlap but serve different checks, so the new list is its own key, not a reference to `executors.e2e.rowWords`; a test keeps the shipped lists in sync.
- ADR-012 (A7) says the keys `browserWords`, `commandWords`, `humanWords` and `maxRuns` of `manualVerify` are removed and an override carrying them is ignored. Reusing `browserWords` would give an old override new meaning, so the new keys are `browserRowWords` and `browserProofKinds`.
- A row that has been ticked carries ` — evidence: evidence/browser-...`; matching words on the full text would make every ticked row a browser row. Match on the text without the suffix (`withoutEvidence`, `steps.mjs:275`), from the baseline in `before.manual`.
- The attempt count does not change (a rejected tick is the existing unproven path with the existing retry), so the step budget and `budget-executors.test.mjs` stay as they are; their Manual row `Run \`node --version\`...` names no browser word.
- The router cannot tell a real browser run from a file that is named `browser-` and holds junk. This change moves the weak point from "any kind proves a row" to "the kind prefix is honest"; ADR-012 already accepts that the router never reads content. The templates make the claim checkable by a reader: the evidence lists the calls or quotes the error.

## What We're NOT Doing

- No change to the OpenSpec chain (no `manual-verify` step there, ADR-013 D10).
- The router does not read evidence content, check that a Chrome tool was called, or probe for the tools (the orchestrator still does not probe).
- No new step, no extra attempt, no change to `maxAttempts`, `retryBump`, the budget deltas or the extra-step pool.
- No other row classes (a "UI", "CLI" or "network" row) and no calibration of the word list; the shipped list is uncalibrated, like the others.
- `executors.e2e.rowWords` is not changed and does not read the new list.
- `baseline-policy.json` is not changed.
- The archive Manual gate (ADR-014) is not changed: it already lists `manualUnproven` ids. The reason is extra output, not a new gate.
- No new test file; the new tests go into `skills/10x-pipeline/test/manualverify.test.mjs`.

## Implementation Approach

Router first, outputs second, prompts third, docs last, so each phase leaves the suite green. The reason is computed once in `verifyManual`, stored on the log entry, and read from there by every output, as the existing `reasons` are. The prompt gets the router's own list of browser rows (`{browserRows}`) so the subagent and the router use one predicate.

## Phase 1: Router detects browser rows and rejects weak proof

### Overview

Two policy keys, the browser-row predicate, the kind check in `verifyManual`, and the browser rows handed to the prompt.

### Changes Required:

#### 1. Policy keys

**File**: `skills/10x-pipeline/policy.json` (`manualVerify` block)

**Intent**: Ship the two lists as data so a project can override them.

**Contract**: `manualVerify.browserRowWords` default `["playwright", "e2e", "end-to-end", "browser", "chrome"]` (the `executors.e2e.rowWords` plus `chrome`); `manualVerify.browserProofKinds` default `["browser", "test", "command", "script"]`. Matching is `goalPhrase`'s: lower-case, a phrase starts at a word start.

#### 2. Option reader and predicate

**File**: `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: Read the two keys with the existing "wrong shape reads as default, never halts" rule, and expose which Manual rows are browser rows.

**Contract**: `MANUAL_DEFAULTS` gains the two defaults (same values as `policy.json`). `manualVerifyOptions` returns `browserRowWords` (array of non-blank strings; a wrong shape reads as the default; an empty array turns browser rows off) and `browserProofKinds` (non-empty array of non-blank strings, trimmed and lower-cased; a wrong shape or an empty array reads as the default). New export `browserRowIds(rows, policy)`: ids of rows whose `withoutEvidence(text)` hits a word via `goalPhrase`.

#### 3. Kind check in `verifyManual`

**File**: `skills/10x-pipeline/scripts/steps.mjs` (`verifyManual`)

**Intent**: A newly ticked browser row with valid evidence of a kind outside `browserProofKinds` is unproven, not proved; the reason names the kind.

**Contract**: browser rows come from the first entry's baseline (`before.manual`, as the rest of `verifyManual`). The entry gets `browserRows` (ids of every baseline browser row) and, only when a tick was rejected for its kind, `unprovenWhy: { "<id>": "browser row ticked with <kind> evidence; only browser, test, command, script evidence proves it" }` (the kind list is `browserProofKinds` joined with `, `). A rejected id goes to `unproven`, not `proved`/`ticked`; the existing fallback, retry and neutral rules apply unchanged. A row with no or invalid evidence keeps its present handling and gets no `unprovenWhy`. The evidence content is still never read.

#### 4. Browser rows for the prompt

**File**: `skills/10x-pipeline/scripts/steps.mjs` (`manualVerifyNext`) and `skills/10x-pipeline/scripts/route.mjs` (prompt variables, about line 169)

**Intent**: Tell the subagent which rows the router will treat as browser rows.

**Contract**: `manualVerifyNext` returns `browserRows`: ids of pending rows and of rows in `unproven` (retry) that are browser rows, in plan order. `route.mjs` adds the variable `{browserRows}` (`d.browserRows` joined with `, `, else `none`). The `entry.before.manual` shape is unchanged.

### Success Criteria:

#### Automated Verification:

- Defaults and wrong shapes: `node --test --test-name-pattern="browser row words and proof kinds" skills/10x-pipeline/test/manualverify.test.mjs` passes (shipped `browserRowWords` includes every `executors.e2e.rowWords` entry and `chrome`; shipped `browserProofKinds` is `browser`, `test`, `command`, `script`; a string, a number list or a blank entry reads as the default; an empty `browserRowWords` turns the check off; `browserWords` of an old override is ignored).
- A judgment or other tick on a browser row is unproven: `node --test --test-name-pattern="browser row judgment tick is unproven" skills/10x-pipeline/test/manualverify.test.mjs` passes (entry `ok: false`, `fallback`, row in `unproven` and not in `proved`, `unprovenWhy` names the kind, `browserRows` lists the row, the retry prompt lists the row id and `{browserRows}`).
- Proof kinds that count: `node --test --test-name-pattern="browser row proved by browser test command or script" skills/10x-pipeline/test/manualverify.test.mjs` passes (each of the four kinds proves a browser row; a non-browser row with `judgment-` evidence is still proved).
- The evidence suffix is not matched: `node --test --test-name-pattern="evidence file name does not make a browser row" skills/10x-pipeline/test/manualverify.test.mjs` passes (a row ticked with `evidence/browser-x.txt` is not a browser row on that account).
- The existing step tests still pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs skills/10x-pipeline/test/budget-executors.test.mjs` passes.

#### Manual Verification:

(none for this phase)

---

## Phase 2: Outputs and report

### Overview

Carry the reason and the browser marks to `status`, the final message, the `archive` summary, `meta.outcome`, the archive lines and the `## Manual checks` section.

### Changes Required:

#### 1. Final-message note

**File**: `skills/10x-pipeline/scripts/steps.mjs` (`doneNotes`, new `manualUnprovenWhyRows`) and `skills/10x-pipeline/scripts/flow.mjs` (the `done` result around line 731)

**Intent**: Add the reason next to the ids without changing `manualUnproven`.

**Contract**: new export `manualUnprovenWhyRows(log, plan)`: for the ids in `manualUnprovenIds`, the lines `<row text without the evidence suffix> — <unprovenWhy reason>` of the last `manual-verify` entry, in plan order; empty when none. `doneNotes` accepts the key `manualUnprovenWhy` and keeps it only when non-empty, so a run with no such tick carries none. It reaches `done`, the `archive` summary and `meta.outcome` through the existing `...doneNotes(d)` sites (`isolation.mjs` `finishRun` and archive paths) without a change there.

#### 2. Archive lines

**File**: `skills/10x-pipeline/scripts/flow.mjs` (`archiveLines`)

**Intent**: Show the reason in the report copy that survives the archive move.

**Contract**: after the `Manual checks unproven: N` block, when `manualUnprovenWhy` is non-empty, `Manual checks unproven, reasons: N` and one `- <line>` each, passed through `oneLine`.

#### 3. `status` row

**File**: `skills/10x-pipeline/scripts/route.mjs` (the `manual-verify` branch of the step row, about line 635)

**Intent**: Show the same facts per step.

**Contract**: the row gains `browserRows` (a count) and, when present, `unprovenWhy` (the entry's object). Entries from earlier runs have neither and the row is as before.

#### 4. `## Manual checks`

**File**: `skills/10x-pipeline/scripts/flow.mjs` (`manualCheckLines`)

**Intent**: A weak proof is visible, a browser row is marked, a rejected tick shows why.

**Contract**: a browser row id of the last entry's `browserRows` gets ` [browser row]` after its label in every group. A group `Unproven: N` (only when the last entry's `unproven` is non-empty) lists `- <label> — unproven: <reason>` with the entry's `unprovenWhy` reason, else `no valid evidence`. The intro line adds that only browser, test, command or script evidence proves a browser row. A report with no browser row and no unproven tick is as before.

### Success Criteria:

#### Automated Verification:

- Reasons reach every output: `node --test --test-name-pattern="unproven why reaches outputs" skills/10x-pipeline/test/manualverify.test.mjs` passes (log entry, `status` row, `done` output, `archive` summary, `meta.outcome`, archive lines of `report.md` and the committed copy; no key and no line when no tick was rejected for its kind).
- The report marks browser rows: `node --test --test-name-pattern="manual checks report marks browser rows" skills/10x-pipeline/test/manualverify.test.mjs` passes.
- The earlier output and report tests pass unchanged: `node --test --test-name-pattern="manual unproven reaches outputs|manual not proved reaches outputs|manual checks report section" skills/10x-pipeline/test/manualverify.test.mjs` passes.
- The suite stays green: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.

#### Manual Verification:

(none for this phase)

---

## Phase 3: Templates and prompt file

### Overview

Tighten the rules: Chrome first and recorded, no judgment for a browser row, and the nochrome limits. Keep every rule in the GIVEN/WHEN/THEN form with one bold keyword (ADR-004).

### Changes Required:

#### 1. Shared prompt file

**File**: `skills/10x-pipeline/prompts/manual-verify.md`

**Intent**: Say, for both templates, which rows are browser rows and what may prove them.

**Contract**: one rule: a row listed under Browser rows is proved only by `browser-`, `test-`, `command-` or `script-` evidence and never by a `judgment-` file or a read of the source; and a rule that a browser row left at `[ ]` is listed in `unproven.md` with the reason. The existing judgment rule gets the exception "other than a Browser row". The file must not contain the tokens `ToolSearch` or `mcp__claude-in-chrome__` (the `--chrome false` test checks the rendered prompt for them).

#### 2. `manual-verify` template

**File**: `skills/10x-pipeline/policy.json` (`prompts.manual-verify`)

**Intent**: Chrome first, recorded, with the failure quoted.

**Contract**: line 1 becomes `Prove the pending #### Manual rows of context/changes/{id}/plan.md on your own, and tick only the rows you proved. Rows rejected by the router last time: {unproven}. Browser rows: {browserRows}`. Chrome rules: (a) for a Browser row, load the `mcp__claude-in-chrome__*` tools with one ToolSearch call (`select:` the tools the row needs together with `tabs_context_mcp`) and call them before any other proof; call `tabs_context_mcp` with `createIfEmpty: true`, because without it the call finds no tab group (live check, Key Discoveries); (b) the first lines of the evidence file name the tool calls that ran (tool, target, result), or, when a test, command or script proved the row, begin with `Chrome: <tool> failed: <error text>`; (c) never judge a Browser row from source; (d) when the tools are unavailable, fail or are not connected, do not wait or ask: prove the row by a covering test, command or script, or leave it at `[ ]` with `- <row id> — Chrome failed: <tool>: <error text>` in `evidence/unproven.md`. The existing rules on local pages, no sign-in, no form submit to an external service and no credential stay, as do their regexes in the tests.

#### 3. `manual-verify-nochrome` template

**File**: `skills/10x-pipeline/policy.json` (`prompts.manual-verify-nochrome`)

**Intent**: Same limits with the browser left out.

**Contract**: line 1 identical to the `manual-verify` line 1. One rule: a Browser row may be proved only by a covering test, command or script, whose evidence file starts with the line `Chrome: off (--chrome false)`; otherwise it stays `[ ]` and `unproven.md` gives the reason `Chrome off (--chrome false)`. The text names no browser tool and does not contain `ToolSearch` or `mcp__claude-in-chrome__`.

#### 4. Prompt docs and SKILL.md

**File**: `skills/10x-pipeline/prompts/README.md` and `skills/10x-pipeline/SKILL.md`

**Intent**: Keep the descriptions true.

**Contract**: the README lists `{browserRows}` among the variables and describes the browser-row rules in the `manual-verify.md` row. `SKILL.md`: the `manual-verify` bullet (about line 152) says a browser row is proved only by browser, test, command or script evidence; the `done` bullet (line 62) and the archive step 1 (line 66) also print `manualUnprovenWhy` lines when present. `SKILL.md` names no model, effort or tier. The five Manual-gate lines of the archive branch, their labels and their order stay (ADR-014); only the listing sentence of step 1 grows.

### Success Criteria:

#### Automated Verification:

- Rendered prompts: `node --test --test-name-pattern="manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs` passes (updated patterns: the new line 1 in both templates, the browser-row rule, Chrome first and recorded, the `createIfEmpty` hint, the `Chrome failed:` reason shape, the nochrome rule with its exact reason, no `ToolSearch` or `mcp__claude-in-chrome__` in the nochrome prompt, `{browserRows}` rendered as `none` when no browser row exists).
- Browser rows reach the prompt: `node --test --test-name-pattern="browser rows in the prompt" skills/10x-pipeline/test/manualverify.test.mjs` passes.
- Rule form: `node --test skills/10x-pipeline/test/rules.test.mjs` passes.
- Skill checks: `node --test skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` passes.
- Provenance and the rest: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.

#### Manual Verification:

- Run `node skills/10x-pipeline/scripts/route.mjs init` for a scratch change with the plugin's real `policy.json` and a plan with one Manual row that mentions `browser`, read the rendered `manual-verify` prompt, and see the Chrome-first rule, the evidence-recording rule and the failure reason shape in order, in plain wording

---

## Phase 4: Docs, ADR and live check

### Overview

Describe the rules, record the live-check result and amend the ADR.

### Changes Required:

#### 1. REFERENCE.md

**File**: `docs/REFERENCE.md`

**Intent**: Document the new behaviour where the old text is, and replace the "not tested" statements with the observed result.

**Contract**: "Manual verification": the two policy keys and their defaults and shape rules; the browser-row definition and the proof kinds; the router reason and where it shows (`unprovenWhy`, `manualUnprovenWhy`, archive lines, `status` `browserRows`); the report marks; the template rules (Chrome first and recorded; nochrome reason); that the router still reads no evidence, so the `browser-` prefix is a claim; that the attempt count and the budget are unchanged; the upgrade note (an in-flight run records `provenance.drift` for `manualVerify`, `prompts`) and that an old override of `browserWords` is ignored. The line "Nothing here has run against a live Chrome session" and the "Limits" Chrome bullet state the live-check result of 2026-11-10 (loaded through ToolSearch, `tabs_context_mcp` answered "no tab group ... createIfEmpty: true"), and what is still unseen (opening a page, exporting evidence). "Usage report" `## Manual checks` description gets the marks and the `Unproven` group. Keep the edits local to these sections: two parallel changes (`no-nested-subagents`, `late-step-usage`) also touch this file.

#### 2. ADR-012 amendment

**File**: `docs/ADR/ADR-012-automate-manual-checks.md`

**Intent**: Append, not rewrite, because the decision of ADR-012 stands and a new number would collide with the parallel changes.

**Contract**: a final section `## Amendment 1: browser rows need browser-grade proof (change browser-row-proof, issue #37)` with Context (the synthetic run), the rules as GIVEN/WHEN/THEN lines with one bold keyword each (browser row definition, proof kinds, unproven with reason, templates, report), the unchanged rules (router reads no content, no extra attempt, no budget change), Risks (a lying `browser-` file; word-list false positives such as a row that mentions a browser only in passing, which the retry then settles with a test, command or script or leaves pending; uncalibrated) and the live-check result. The `Risks` and `Unverified assumptions` lines about Chrome get a pointer to the amendment. The Status line gains "amended 2026-11-10".

#### 3. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Keep the contributor guide true.

**Contract**: the `manualverify.test.mjs` bullet names the new topics (browser rows, proof kinds, the reason in the outputs, the report marks); the ADR-012 sentence in the `docs/ADR/` bullet adds the amendment. No new test file, so no other change. A one-line edit each, to keep the merge with the parallel changes easy.

### Success Criteria:

#### Automated Verification:

- Rule form of ADR and docs: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs` passes.
- No stale claim remains: `grep -n "Nothing here has run against a live Chrome session\|Whether a subagent can load and call them was not tested" docs/REFERENCE.md` prints nothing.
- Version and commit tools: `node tools/version-check.mjs` exits 0.
- Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.
- `init` and `status` still print valid JSON in a scratch change folder: `node skills/10x-pipeline/scripts/route.mjs status browser-row-proof` prints JSON that `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` accepts.

#### Manual Verification:

- In this step's `manual-verify` subagent, load the Chrome tools with ToolSearch and call `tabs_context_mcp` once; save the tool calls and the result as `browser-` evidence, and see that the "Limits" text of docs/REFERENCE.md agrees with that result
- Read the Manual verification and Limits text of docs/REFERENCE.md and the ADR-012 amendment and see that they agree on the two policy keys, the proof kinds, the reason texts and the upgrade note

---

## Testing Strategy

### Unit Tests:

- New tests in `skills/10x-pipeline/test/manualverify.test.mjs` (string-literal titles, as the file's gate rows require): `browser row words and proof kinds`, `browser row judgment tick is unproven`, `browser row proved by browser test command or script`, `evidence file name does not make a browser row`, `browser rows in the prompt`, `unproven why reaches outputs`, `manual checks report marks browser rows`; the existing `manual verify prompts` is updated.
- Edge cases: ticked row with a `judgment-`, an `other` and a prefix-less file; the same row after a retry that adds `test-` evidence; a retry that unticks; an already ticked row at the start (never re-judged); several rows sharing one evidence file; word at a word start (`browser`, `Chrome`, `end-to-end`) and mid-word (`Rebrowser` does not hit); an override list of the wrong shape; an old run log without `browserRows`.

### Integration Tests:

- The existing CLI-level tests drive the real router in scratch projects; the new output test uses `unprovenProject`-style fixtures with `gitInit` for the `archive` path (skipped without git, as its siblings).
- `budget-executors.test.mjs` runs unchanged to show the longest legal path is the same.

### Manual Testing Steps:

1. Render the `manual-verify` and `manual-verify-nochrome` prompts for a plan with a row that names a browser (Phase 3 Manual row).
2. Live check of the Chrome tools in a `manual-verify` subagent (Phase 4 Manual row).

## Performance Considerations

None: one `goalPhrase` pass per Manual row per `manual-verify` call.

## Migration Notes

- The policy gains `manualVerify.browserRowWords` and `browserProofKinds`; a run in flight records `provenance.drift` for `manualVerify` and `prompts` at its next `next` call and routing is unaffected. A project override that sets `manualVerify.minRigor` is kept; one that sets `evidenceKinds` is kept.
- Behaviour change: a browser row ticked with `judgment-` or other evidence now costs a retry. Suggested commit type `fix` (the issue is a bug); the owner decides at commit time (`AGENTS.md`, "Commits").

## References

- GitHub issue #37; `context/changes/browser-row-proof/change.md`.
- `docs/ADR/ADR-012-automate-manual-checks.md`, `docs/REFERENCE.md` ("Manual verification", "Limits").
- `skills/10x-pipeline/scripts/steps.mjs:279-445`, `skills/10x-pipeline/scripts/flow.mjs:19-40,234-265`, `skills/10x-pipeline/scripts/route.mjs:169,635`, `skills/10x-pipeline/scripts/preplan.mjs:24`, `skills/10x-pipeline/policy.json:307-318,349,375-382`.
- `skills/10x-pipeline/test/manualverify.test.mjs`, `skills/10x-pipeline/test/budget-executors.test.mjs`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router detects browser rows and rejects weak proof

#### Automated

- [ ] 1.1 Defaults and wrong shapes: `node --test --test-name-pattern="browser row words and proof kinds" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 1.2 A judgment or other tick on a browser row is unproven: `node --test --test-name-pattern="browser row judgment tick is unproven" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 1.3 Proof kinds that count: `node --test --test-name-pattern="browser row proved by browser test command or script" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 1.4 The evidence suffix is not matched: `node --test --test-name-pattern="evidence file name does not make a browser row" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 1.5 The existing step tests still pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs skills/10x-pipeline/test/budget-executors.test.mjs` passes

### Phase 2: Outputs and report

#### Automated

- [ ] 2.1 Reasons reach every output: `node --test --test-name-pattern="unproven why reaches outputs" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 2.2 The report marks browser rows: `node --test --test-name-pattern="manual checks report marks browser rows" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 2.3 The earlier output and report tests pass unchanged: `node --test --test-name-pattern="manual unproven reaches outputs|manual not proved reaches outputs|manual checks report section" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 2.4 The suite stays green: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes

### Phase 3: Templates and prompt file

#### Automated

- [ ] 3.1 Rendered prompts: `node --test --test-name-pattern="manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 3.2 Browser rows reach the prompt: `node --test --test-name-pattern="browser rows in the prompt" skills/10x-pipeline/test/manualverify.test.mjs` passes
- [ ] 3.3 Rule form: `node --test skills/10x-pipeline/test/rules.test.mjs` passes
- [ ] 3.4 Skill checks: `node --test skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` passes
- [ ] 3.5 Provenance and the rest: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes

#### Manual

- [ ] 3.6 Run `node skills/10x-pipeline/scripts/route.mjs init` for a scratch change with the plugin's real `policy.json` and a plan with one Manual row that mentions `browser`, read the rendered `manual-verify` prompt, and see the Chrome-first rule, the evidence-recording rule and the failure reason shape in order, in plain wording

### Phase 4: Docs, ADR and live check

#### Automated

- [ ] 4.1 Rule form of ADR and docs: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs` passes
- [ ] 4.2 No stale claim remains: `grep -n "Nothing here has run against a live Chrome session\|Whether a subagent can load and call them was not tested" docs/REFERENCE.md` prints nothing
- [ ] 4.3 Version and commit tools: `node tools/version-check.mjs` exits 0
- [ ] 4.4 Full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes
- [ ] 4.5 `init` and `status` still print valid JSON in a scratch change folder: `node skills/10x-pipeline/scripts/route.mjs status browser-row-proof` prints JSON that `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` accepts

#### Manual

- [ ] 4.6 In this step's `manual-verify` subagent, load the Chrome tools with ToolSearch and call `tabs_context_mcp` once; save the tool calls and the result as `browser-` evidence, and see that the "Limits" text of docs/REFERENCE.md agrees with that result
- [ ] 4.7 Read the Manual verification and Limits text of docs/REFERENCE.md and the ADR-012 amendment and see that they agree on the two policy keys, the proof kinds, the reason texts and the upgrade note
