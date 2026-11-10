# ADR-012: Verify every Manual row in a dedicated subagent, at every rigor level, outside the extra-step pool, with Chrome on by default

- **Status:** Proposed (unattended reading, owner confirmation pending); amended 2026-11-10 (Amendment 1)
- **Date:** 2026-11-05
- **Deciders:** the repository owner (decisions 1 to 7 in `change.md`, 2026-11-05); unattended implementation run of change `automate-manual-checks` for the readings marked A1 to A8 below
- **Origin:** change `automate-manual-checks` (`context/changes/automate-manual-checks/change.md` and `plan.md`). It supersedes the "Manual verification", `--chrome` and manual-verify budget parts of ADR-003 ("Phase executors and manual verification"). The rest of ADR-003 is unchanged.

## Context

- `manual-verify` (ADR-003, change 3) proved only the Manual rows that named an allow-listed backticked command and no human word, and, with `--chrome`, rows with a browser word. It ran at `standard` and above, once, before the first implementation review, drew 1 from the extra-step pool and started one tier above its floor. Every other row stayed a human checklist in `manualPending`.
- The archive holds about 100 unticked rows across 13 changes, nearly all Manual rows (`change.md`, "Context"). The pipeline ended `done` with a checklist that nobody worked through.
- The owner asked for all manual testing to be handled by a separate subagent with a clean context, starting on `sonnet/medium`, using every tool it has, Claude in Chrome included, and treating a row covered by a green automated test as manually tested (`change.md`, "Owner request").
- The `lean` pool is 0, so a `lean` run never verified anything, and at `standard` the step competed with segments and executors for a pool of 2.

## Decision

The step proves every pending Manual row it can, records how it proved each one and why it could not prove the rest, and the run goes on. Rules, written as scenarios (the form of ADR-004):

### Scope and placement

**GIVEN** no Automated row is pending, no implementation review has run and a Manual row is pending or the last attempt left a tick without valid evidence **WHEN** the router picks the next step at a level at or above `manualVerify.minRigor` (default `lean`) **THEN** it **MUST** return `manual-verify`.

**GIVEN** a pending Manual row, with or without a command, including one that asks a person to read, judge or confirm and one that asks the owner for a decision **WHEN** the router decides whether the step runs **THEN** it **MUST** count that row as in scope.

**GIVEN** a `manual-verify` entry **WHEN** the router computes what the extra-step pool still holds **THEN** it **MUST NOT** charge the entry anything, whatever `extraSteps.cost` says.

**GIVEN** an implementation review entry exists **WHEN** the router picks the next step **THEN** it **MUST NOT** return `manual-verify` again (A1: no re-run after the last `fix`).

**GIVEN** `manualVerify.minRigor` is `null` or not a rigor level **WHEN** the router picks the next step **THEN** it **MUST NOT** return `manual-verify`.

### Attempts and tier

**GIVEN** an earlier `manual-verify` entry in the run **WHEN** the router returns the step again **THEN** it **MUST** add `manualVerify.retryBump` (1) tiers with the reason `manual-verify retry after <n> attempt(s)`, so the first attempt runs on `sonnet/medium` (`steps["manual-verify"].baseTier` 2) and the retry on `sonnet/high`.

**GIVEN** a first attempt that failed its checks or ended `done` with rows still pending **WHEN** fewer than `manualVerify.maxAttempts` (2) entries exist **THEN** the router **MUST** return one retry (A6).

**GIVEN** a `manual-verify` attempt that is not verified **WHEN** the router picks the next step **THEN** it **MUST NOT** count it as a failed attempt, raise the rigor or roll it back.

**GIVEN** the last attempt ran **WHEN** rows are still pending **THEN** the router **MUST** go on to the implementation review with no halt.

### Evidence

**GIVEN** a Manual row ticked during the step **WHEN** its suffix does not name a non-empty regular file inside the real `evidence` folder written after the step started **THEN** the router **MUST** record the tick as unproven.

**GIVEN** a tick with valid evidence **WHEN** the router records it **THEN** it **MUST** store `{ id, kind, file }` in `proved`, where the kind is the part of the file's base name before the first `-` when it is in `manualVerify.evidenceKinds`, and `other` for any other prefix or none (A5).

**GIVEN** an evidence file **WHEN** the router verifies the step **THEN** it **MUST NOT** read its content.

### Unproved reasons

**GIVEN** `evidence/unproven.md` (`manualVerify.unprovenFile`) is a regular file inside the real `evidence` folder, at most 65536 bytes and newer than the step start **WHEN** the router completes the entry **THEN** it **MUST** copy each `- <row id> — <reason>` line that names a Manual row into `reasons`, one line, cut to `manualVerify.reasonMaxChars` (200) code points (A4).

**GIVEN** that file is missing, stale, a symlink, too large or malformed **WHEN** the router completes the entry **THEN** it **MUST NOT** change whether the step is verified.

**GIVEN** a `done` run in which a `manual-verify` entry ran **WHEN** Manual rows are still pending **THEN** the router **MUST** list each as `<row text> — not proved: <reason>` (`no reason recorded` without one) in `manualNotProved` of the final message, `meta.outcome` and the `archive` summary.

### Chrome

**GIVEN** `meta.chrome` is not `false` (absent, `true`, or a run from before this change) **WHEN** the router returns `manual-verify` **THEN** it **MUST** use the template `manual-verify`, which carries the Chrome rules (A2).

**GIVEN** `meta.chrome` is `false` **WHEN** the router returns `manual-verify` **THEN** it **MUST** use the template `manual-verify-nochrome`.

## What each rule covers

- Policy: `steps["manual-verify"]` `baseTier` 2 (`minTier` 2, `maxTier` 6). `manualVerify` is `{ minRigor: "lean", maxAttempts: 2, retryBump: 1, evidenceKinds: ["command", "test", "script", "browser", "judgment"], unprovenFile: "unproven.md", reasonMaxChars: 200 }`. The keys `maxRuns`, `commandWords`, `humanWords` and `browserWords` are removed (A7); an override that still carries them is ignored. `extraSteps.cost` loses `manual-verify`. The display knobs read the default when they have the wrong shape and never halt.
- Templates: `manual-verify` (the shared prompt file plus three Chrome rules) and `manual-verify-nochrome` (the shared prompt file plus one rule that the Chrome tools are off). `manual-verify-chrome` is gone. `{unproven}` is the only router variable in the prompt; nothing else from earlier steps reaches the subagent.
- Ways to prove a row, set by the prompt: run the row's command; run a covering automated test now and save its output with the test file and test name on the first line; write a throw-away script in a `mktemp -d` scratch directory or under `evidence/`, never in the source or test tree, and save its source and output; use the Chrome tools; or write a judgment that quotes the text or behaviour checked and gives the reasoning. Evidence names start with their kind (`command-`, `test-`, `script-`, `browser-`, `judgment-`).
- `init --chrome` and `--chrome true` store `true` and change nothing in effect; `--chrome false` stores `false`; a resume keeps the stored value. Provenance records the effective setting, `flags.chrome = meta.chrome !== false`.
- Log entry of a `manual-verify` step: `ticked`, `unproven`, `proved` (`[{ id, kind, file }]`), `pending` (row ids still pending) and, when the ledger gave any, `reasons`. `status` shows `proved` as a count per kind and `pending` as a count. `report.md` gets a `## Manual checks` section after `## Review findings`: the proved rows grouped by kind, then the pending rows with their reasons. The archive lines of `report.md` gain `Manual checks not proved: N`. `manualPending` and `manualUnproven` stay as they were.
- Unchanged: the router's file-based evidence check, the rule that no Automated row, row title or SHA suffix may change, the neutral fallback entry, `baseline-policy.json` and `loops-existing.test.mjs`.

## Budget

The step is outside the pool, so its attempt and its retry lengthen the longest failure-free path of every level by 2. `rigor.budgetDelta` grows by 2 at each level (A3), from -4, +3 and +8 to -2, +5 and +10, so with `limits.maxTotalSteps` 14 the budgets are 12, 19 and 24. Each delta is `longest path + 2 - maxTotalSteps`: one failed step and its retry still fit. `budget-executors.test.mjs` walks every saturating fixture with the step on, including a variant whose Manual row stays pending through both attempts, and pins the paths below.

| Level | Typical longest failure-free path | Steps | Budget | Before this change |
| --- | --- | --- | --- | --- |
| `lean` | plan, plan-review, implement, `manual-verify`, `manual-verify` retry, impl-review (`REJECTED`), fix, impl-review, fix, impl-review | 10 | 12 | no step, budget 10 |
| `standard` | score (1), plan loop (6), `implement-segment`, `implement-e2e`, plain tail (3), `manual-verify` and its retry (2), impl-review, fix, impl-review, fix, impl-review (5) | 17 | 19 | 15 of 17 |
| `thorough` | research, domain brief, frame, score, plan, review `RETHINK`, frame-rethink, plan-revise, review, plan-revise, review (11), `implement-segment`, `implement-e2e`, `implement-tdd`, plain tail (4), `manual-verify` and its retry (2), then 5 | 22 | 24 | 20 of 22 |

The `lean` row is the walk of the lean budget test, not a proof that no longer `lean` path exists: a `lean` run whose plan loop re-plans can still spend its budget, as before this change. The failure path of ADR-003 now reads score, plan, plan-review, implement failed twice, `plan-replan`, plan-review, implement, `manual-verify`, impl-review, fix, impl-review (12 steps of 19). A project that pinned the old deltas in its override has no room for the step and its retry; it raises each delta by 2 or sets `manualVerify.minRigor` to `null`.

## Safety constraints

Any row is now in scope, not only allow-listed commands, so the subagent can run anything the plan text suggests. The limits are prompt rules in `skills/10x-pipeline/prompts/manual-verify.md` and the Chrome rules in `policy.json`:

| Constraint | Enforced by |
| --- | --- |
| Never push, deploy, publish or post to an external service | prompt only |
| Never write outside the run root and the scratch directory; in the run root, only `plan.md` and `evidence/` | prompt only (A8: the router never checks for stray writes; the step commit and the implementation review see the diff) |
| Read-only git in the run root; never delete a branch, worktree or ref | prompt only; the router owns the git writes of the run (ADR-010) |
| Never run a command that does not end by itself or waits for input; a server only in the background, stopped before the step ends | prompt only |
| Redact credentials, tokens, environment dumps and personal data before saving evidence, because the step commit stores `evidence/` in the run branch | prompt only; the router never reads the content |
| In Chrome, open only local pages or pages the row names; never sign in, submit a form to an external service or enter a credential | prompt only (the Chrome rules of the `manual-verify` template) |
| No change to a row title, an Automated row or a SHA suffix; no untick of an earlier tick | router: the step is not verified when they change |
| A tick needs a non-empty regular evidence file inside the real `evidence` folder, newer than the step start | router: the tick is listed as `manualUnproven` otherwise |
| The reasons file is read only as a regular file of at most 65536 bytes inside the real `evidence` folder, newer than the step start | router |

The router never reads evidence content, never judges whether a judgment is sound and never checks that a named test exists or ran. A file of junk text passes its check.

## Consequences

- Every run with a pending Manual row spends one or two more subagent runs, `lean` included. The first runs on `sonnet/medium`, the retry on `sonnet/high`. The cost is raw tokens, visible per step in `report.md`.
- `manualPending` shrinks to the rows nobody could prove, and each comes with a reason in `manualNotProved`.
- A judgment is weaker proof than a command, test or script run. The report lists each proved row with its evidence kind, so the owner sees which rows were judged rather than run.
- Rows are proved against the code before the first implementation review. A later `fix` can change what a ticked row claims, and the step does not run again (A1). The implementation review reads the code after the fix.
- Behaviour change for the release PR: `lean` runs gain a step and Chrome is on by default. The owner decides at commit time whether it ships as `feat` or `feat!` (`AGENTS.md`, "Commits").
- A run in flight records `provenance.drift` for `manualVerify`, `steps`, `extraSteps`, `rigor` and `prompts` at its next `next` call; routing is unaffected. A run in flight that already has a `manual-verify` entry keeps counting it toward `maxAttempts`. `compare` pairs where one arm ran the old step show `provenance-differs` warnings.
- For a routing-only baseline comparison the baseline override now also needs `{"manualVerify": {"minRigor": null}}`, because a pool allowance of 0 no longer turns the step off.
- `AGENTS.md` Hard Rules are unchanged: no new git write, no new network call, no new dependency. The router still never calls a model.

## Risks

- The subagent runs commands from `plan.md` with no allow-list. The plan is the same trust domain as the plan author, as in ADR-003, but the scope is now every row. Only the prompt stops a destructive or external command.
- A subagent can write outside the change folder or leave a server running. Nothing in the router catches it; the step commit records the writes inside the worktree, and writes outside it are not seen at all.
- A judgment that quotes the wrong text, or a test that does not cover the row, passes the router's check. The kind in the report is the only signal.
- Evidence is committed to the run branch. A secret the subagent fails to redact lands in git history.
- Whether a subagent can load and call the Chrome tools through ToolSearch was not tested when this ADR was written. A live check of 2026-11-10 settled that part; see Amendment 1. When the tools cannot be used, the row stays pending with a reason, or is proved another way.

## Rollback

- Per project: `{ "manualVerify": { "minRigor": null } }` in `context/foundation/agent-smith-policy.json` turns the step off. The deltas stay 2 higher, which only leaves more room.
- Per run: `init --chrome false` keeps the step and turns the Chrome rules off.
- In the plugin: set `manualVerify.minRigor` to `null` in `policy.json`, or back to `standard`; the router does not change. Restoring the old eligibility gate would need code, because `manualEligible` is removed.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Keep the command allow-list and widen it | rejected | Reading, wording and owner rows have no command; the owner asked for every row. |
| Keep the step in the extra-step pool | rejected | The `lean` pool is 0, so `lean` would never verify, and at `standard` the step would still compete with segments and executors. |
| Halt for a human when a row stays unproved | rejected | The owner chose no halt (decision 2); the reason in `manualNotProved` is the hand-off. |
| Re-run the step after the last `fix` | rejected (A1) | It doubles the cost on every fix loop and the router cannot re-prove ticked rows without a second pass over the whole Manual set. |
| Carry the unproved reasons in a `signals` key of the `RESULT` line | rejected | A file under `evidence/` survives a retry, the retry reads it first, and the router reads it for display only. |
| Let the router read the evidence or check for stray writes | rejected (A8) | It would make the router judge content it cannot judge, and the step commit and the implementation review already see the diff. |
| Keep Chrome opt-in | rejected (A2) | The owner asked for every tool, Chrome especially; `--chrome false` keeps the opt-out. |

## Unverified assumptions

- No live run has used the new prompt, the retry tier or the reasons file. The router side is covered by tests; the subagent's behaviour is not.
- No Chrome call from a subagent had been tested when this ADR was written; Amendment 1 records the first live check (the tools load and `tabs_context_mcp` answers; a page load and an exported page text are still unseen).
- Whether `sonnet/medium` proves enough rows on the first attempt to make the retry rare is not measured.
- The figure of about 100 unticked archived rows is the owner's count in `change.md`, not one this ADR re-derived.

## Amendment 1: browser rows need browser-grade proof (change browser-row-proof, issue #37)

### Context

- In the synthetic run `synth-demo` (2026-11-07, plugin 0.7.0) the `manual-verify` step ticked a Manual row that asks for a check in a browser. It never called a Chrome tool. Its evidence `evidence/judgment-hello-heading.md` said "Browser not driven; judged from source", and the router counted the row as proved (`proved: {judgment: 1}`), because A8 accepts any kind for any row.
- The decision of ADR-012 stands: every Manual row is in scope, the router reads no evidence content, and the step costs no extra attempt. This amendment makes the proof kind match the row.

### Rules

- **GIVEN** a pending Manual row whose text without its evidence suffix names a word of `manualVerify.browserRowWords` (default `playwright`, `e2e`, `end-to-end`, `browser`, `chrome`) **WHEN** the router verifies a `manual-verify` step **THEN** it **MUST** treat the row as a browser row.
- **GIVEN** a browser row is ticked with valid evidence **WHEN** the kind of the evidence file is not in `manualVerify.browserProofKinds` (default `browser`, `test`, `command`, `script`) **THEN** the router **MUST** list the row as unproven with the reason `browser row ticked with <kind> evidence; only browser, test, command, script evidence proves it`.
- **GIVEN** the router lists a browser row as unproven **WHEN** the step has attempts left **THEN** the retry one tier up **MUST** run as for any unproven tick, and the run goes on after the last attempt.
- **GIVEN** the router rejected a tick for its kind **WHEN** it writes its outputs **THEN** it **MUST** carry the reason in the log entry (`unprovenWhy`), `status`, the final message, the `archive` summary and `meta.outcome` (`manualUnprovenWhy`) and the archive lines of `report.md`.
- **GIVEN** a Manual row is a browser row **WHEN** the `manual-verify` template runs **THEN** the subagent **MUST** load the Chrome tools with ToolSearch, call them before any other proof, and name the tool calls that ran, or quote the Chrome error, in the evidence.
- **GIVEN** the run has `--chrome false` **WHEN** a browser row is pending **THEN** the subagent **MUST** prove it only by a covering test, command or script, or leave it at `[ ]` with the reason `Chrome off (--chrome false)`.
- **GIVEN** the report lists the Manual checks **WHEN** a browser row appears in a group **THEN** the report **MUST** mark it `[browser row]`, and a rejected tick appears in an `Unproven` group with its reason.

### Unchanged

- The router still reads no evidence content (A8), adds no attempt, and changes no budget delta, `maxAttempts`, `retryBump` or the extra-step pool. `budget-executors.test.mjs` runs unchanged.
- The new keys are `browserRowWords` and `browserProofKinds`, not `browserWords`: A7 removed `browserWords`, and an old override that still carries it stays ignored.

### Risks

- The router cannot tell a real browser run from a file that is named `browser-` and holds junk. The weak point moves from "any kind proves a row" to "the kind prefix is honest". The templates make the claim checkable by a reader: the evidence lists the calls or quotes the error.
- The word list is uncalibrated and has false positives, such as a row that mentions a browser only in passing. The retry settles it with a test, command or script, or the row stays pending.
- `verifyManual` does not read `meta.chrome`, so with `--chrome false` the router still accepts `browser-` evidence for a browser row; only the `manual-verify-nochrome` prompt forbids it. Gating on `meta.chrome` would change the `verifyManual` signature for a claim that is a prefix anyway.
- A tick the router rejects stays `[x]` in `plan.md`, because the router never edits `plan.md`. The outputs and the report list it as unproven.
- A run in flight records `provenance.drift` for `manualVerify` and `prompts`; routing is unaffected.

### Live check (2026-11-10)

- The plan step of this change ran in a general-purpose subagent without the `Agent` tool. It loaded `mcp__claude-in-chrome__tabs_context_mcp` through `ToolSearch select:` and called it once. The call returned a normal tool result, not an error: "This session has no tab group of its own ... Use createIfEmpty: true to create this session's group." A step subagent can therefore load and call the Chrome tools, and a call needs `createIfEmpty: true`. Not yet seen: that call with `createIfEmpty: true`, a page load and an exported page text. Manual row 4.6 of the plan repeats the check inside a real `manual-verify` step.
