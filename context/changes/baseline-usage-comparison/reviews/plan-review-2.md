<!-- PLAN-REVIEW-REPORT -->
# Plan Review (round 2): Baseline Usage Comparison Implementation Plan

- **Plan**: context/changes/baseline-usage-comparison/plan.md (revision d915dd7)
- **Mode**: Deep (single reviewer, code and probes run directly, no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 4 observations

Round 1 is in `reviews/plan-review.md` (F1-F10). Finding IDs below restart at F1 for this round.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (route.mjs, policy.json, helpers.mjs, rules.test.mjs, SKILL.md, README.md, AGENTS.md, ADR-004), 12/12 symbols ✓ (`deepMerge`, `loadPolicy`, `parseFlags`, `rigorInputs`, `effortFloorTier`, `cleanUsage`, `attachResult`, `entry`, `skipEntry`, `makeProject({ policy })`, `gitProject`/`finishPlan` in route.test.mjs:309-319, `skipPlanReviewAt` read at route.mjs:653), Progress↔Phase consistent (1.1-1.7, 2.1-2.12, 3.1-3.7; one `## Progress`; no stray checkboxes), brief↔plan ✗ for one row reference (F5). No `docs/reference/contract-surfaces.md`, no `lessons.md`.

Probes run (Node v24.19.0, scratch projects, real router):

1. The shipped-file shape (7 x `sonnet`/`high`, `rigor.fromGoal` all `standard`, `rigor.skipPlanReviewAt: []`) as `context/foundation/agent-smith-policy.json`: "refactor the auth module" gives `plan opus high` / `standard` by default and `plan sonnet high` / `standard` with the file; "fix typo" gives `plan sonnet medium` / `lean` by default and `plan sonnet high` / `standard` with the file. The keys exist in the real policy, the loader (`deepMerge`, route.mjs:38-46) merges `rigor` key by key and replaces `skipPlanReviewAt` whole, and rows 1.2 can fail as specified.
2. `met` math: `100/71/29` true, `100/72/29` false, `1000/705/29.5` true. The relative slack `1e-9 * max(1, right)` starts to accept a drop one token short only when `target * baseline` reaches about 3e11 (baseline near 1e10 tokens at 29.5 %). Harmless at any realistic total.
3. `node --test --test-name-pattern="^9\.1 " file` where no test matches: exit 0, and the reporter prints `✔ <file>`, `ℹ tests 1`, `ℹ pass 1`. See F2.
4. Dispatch tail of `main` (route.mjs:1254-1259): the chain ends `... else if (cmd === "verify-archive") { verifyArchive(id, flags); } else { halt(...) }`. A new branch can be inserted after the `verifyArchive` line without touching an existing line, so row 3.5 (at most 1 removed line, the usage string) holds.
5. Sibling ADR numbers: `main` has ADR-001 to ADR-004. The S-05 plan (`pr-comment-report-plan-v2`) and the S-07 plan (`pre-plan-steps-plan`) both put their decisions into ADR-003 sections. No branch and no change folder mentions ADR-005 apart from this plan.
6. An Agent call made from a nested subagent (this review) returned at launch with no usage and the completion notice carried `<usage><subagent_tokens>…</subagent_tokens><tool_uses>…</tool_uses><duration_ms>…</duration_ms></usage>`. The Agent schema available to that subagent has no `run_in_background` parameter, so the call ran in the background. See F1.

## Round 1 fix verification

| Round 1 | Landed in plan.md? | Sound? |
|---|---|---|
| F1 pinned = executed entries only, skips warn | Yes: A7, Pair object, `baseline-skipped-steps:<n>`, row 2.4, Key Discoveries | Yes. Stable under S-07 skip entries. |
| F2 rigor in data | Yes: Phase 1 contract 1, Current State bullet 4, README step 2, Desired End State | Yes, probe 1. Guard test 1.1 asserts the extra keys. |
| F3 rows 1.2 / 1.3 can fail | Yes: hard-keyword and short goal, default vs file, plan-review skip control | Yes, probe 1 confirms each default/file pair differs. Row 1.3 needs `gitProject` history of 10 commits (route.test.mjs:309); the plan says to copy it. |
| F4 inputs rule + warning | Yes: A2, contract, README step 2, row 2.6 | Yes. Name-only comparison is deterministic. |
| F5 integer `met` | Yes: A9, row 2.2 | Yes, probe 2. Display-rounding gap is F6 below. |
| F6 usage spike first | Row exists (1.7) and "If usage is absent" exists | Not sound for an unattended run. See F1. |
| F7 archive survival | Yes: row 2.10 replaces manual 3.8; A11, Current State bullet 7 | Yes. |
| F8 discriminating rows | Partly: per-row patterns, 3.3 grep targets, merge-base diff, wider grep, row 2.11 all present | The pattern rows carry a wrong detection instruction. See F2. |
| F9 contract guesses | Yes: all nine lines present in the Phase 2 and 3 contracts | One gap: undefined target (F6). |
| F10 docs gaps | Yes: ADR-005, AGENTS.md bullet, `<plugin dir>`, proxy wording, keep-worktree rule | ADR-005 is not covered by `rules.test.mjs` (F4); brief has a stale row number (F5). |

## Findings

### F1 — Manual row 1.7 gates Phase 2 only in prose; an unattended implementation runs straight through or tries to run a live pipeline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — Manual 1.7 and Implementation Note; "If usage is absent"; Progress 1.6-1.7
- **Detail**: The implementation runs unattended in a subagent (`/10x-goal-implement`). That skill flips only Automated rows, commits per phase, and lists pending Manual rows as a closing checklist. It does not stop at a pending Manual row, so "Do not start Phase 2 until row 1.7 has an answer recorded" is a sentence the unattended run has no step to honour. It will start Phase 2 after the Phase 1 automated rows pass. Row 1.7 as worded is also not executable by that subagent: it says to run `/agent-smith:10x-pipeline` in a scratch project, "stop the session" and read `status`. A nested subagent cannot stop its parent session, and launching the pipeline from inside the implementation spawns plan, review and implement subagents on the owner's budget (depth limit 3 per README). The only thing it can run is a bare `Agent` call, and that is not the call that matters. SKILL.md Loop step 2 requires a foreground call (`run_in_background: false`) from the top-level orchestrator. Probe 6 shows a subagent's Agent tool has no such parameter: the call ran in the background, the launch result carried no usage, and the figures arrived only in the completion notice, named `subagent_tokens`, `tool_uses`, `duration_ms`. That is evidence about a different call path than the one the feature depends on, and the names differ from SKILL.md's `totalTokens`/`toolUses`/`durationMs`. So row 1.7 must stay a human gate (top-level session, installed plugin), and the plan needs a mechanical stop so an unattended run neither skips it nor hangs.
- **Fix A ⭐ Recommended**: Turn the prose gate into a file gate and say what an unattended run does.
  - Create `real-run-evidence.md` in Phase 1 with the usage-spike heading holding the single line `USAGE: pending`. A human replaces it with `USAGE: present` (and pastes the raw `status` line and the raw Agent-result usage text) or `USAGE: absent`.
  - Add an unnumbered precondition at the top of Phase 2 (before "Changes Required"): the first command of Phase 2 is `grep -q "^USAGE: present" context/changes/baseline-usage-comparison/real-run-evidence.md`. If it fails, an unattended run MUST NOT edit `route.mjs`, MUST NOT tick 1.6 or 1.7, commits Phase 1, and finishes `blocked` with `signals.needsHuman` "row 1.7 needs a live top-level session; set USAGE: present or absent in real-run-evidence.md, then resume". `USAGE: absent` follows the existing "If usage is absent" default (stop). Resuming `/10x-goal-implement` continues at Phase 2 once the line says `present`.
  - State in the Phase 1 Implementation Note that rows 1.6, 1.7 and 3.7 are human rows: an unattended run MUST NOT run `/agent-smith:10x-pipeline`, MUST NOT try to emulate the spike, and lists them as the closing checklist. It MAY run one bare `Agent` probe and paste the raw notice under a sub-heading "advisory (nested subagent, background call, not the orchestrator path)"; that never changes the `USAGE:` line.
  - Reword 1.7 to say "top-level session only" and to paste the raw usage text of the Agent result next to the `status` line, so the name mapping (`subagent_tokens` vs `totalTokens`) is on record. Add to the "present" case: SKILL.md Loop step 4 says "copied exactly"; if the harness names the field differently the mapping is the orchestrator's judgement and the owner should decide whether SKILL.md needs a one-line fix (a separate change, as the plan already says).
  - Strength: no row renumbering (the precondition is unnumbered, the Progress rows stay), it stops cleanly instead of hanging, and a human unlocks Phase 2 by editing one line.
  - Tradeoff: an unattended run always ends after Phase 1 until a human acts, so Phases 2 and 3 wait a session. That matches the plan's own default (stop with no owner answer).
  - Confidence: HIGH — the three skill behaviours (flip Automated only, list Manual, report blocked) are in the 10x-goal-implement description and the README Limits.
  - Blind spot: the precondition is outside the Progress contract, so a different implementer skill could ignore it. Put the same sentence in the Phase 2 Overview too.
- **Fix B**: Build Phases 2 and 3 regardless (the plan's own option (b)) and treat 1.7 and 3.7 as the closing human checklist.
  - Strength: no wait; Phases 2 and 3 are valid with fabricated `usage`, as the plan says.
  - Tradeoff: if the answer is `absent`, a session of work serves no real pair until a separate SKILL.md change lands. This reverses the plan's "default is to stop".
  - Confidence: MEDIUM — depends on how likely the answer is "absent"; probe 6 shows figures do reach a parent in the background form.
  - Blind spot: the foreground call path is still unobserved.
- **Decision**: PENDING

### F2 — The `--test-name-pattern` note gives a check that cannot detect a pattern that matches nothing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "Test-name convention (F8a)" paragraph; every Automated row of Phases 1-3 that uses a pattern (1.1-1.4, 2.1-2.11, 3.1)
- **Detail**: The plan warns that a pattern matching nothing exits 0 and says to "confirm `# pass` is at least 1". Probe 3 shows that on Node 24 a no-match run still prints `ℹ tests 1`, `ℹ pass 1` (the test file itself counts as a passing test) and exits 0, and the line format is `ℹ pass`, not `# pass`. The stated check passes in exactly the case it should catch, for example a test named `2.4  baseline` (two spaces) or `2.4: baseline`, or a row whose test was never written. An unattended run reads exit codes and cannot do the "read the output" step. Eleven of the twenty-four Automated rows rest on this.
- **Fix**: Replace the sentence with a mechanical check that works for both the spec and the tap reporter, and tie it to the exit code. For example, state that each pattern row passes only when the output has a line matching `(✔|^ok [0-9]+ -) <row> ` for the row's number, e.g. `node --test --test-name-pattern="^2\.4 " F > $TMPDIR/r.txt 2>&1 && grep -qE "(✔|ok [0-9]+ -) 2\.4 " $TMPDIR/r.txt`. Say it once in the convention paragraph and let the rows keep their short form. An alternative that needs no grep is one `test("row coverage", ...)` at the end of `compare.test.mjs` that reads the test names from a list and fails when a row number has no test, but that costs a maintained list.
- **Decision**: PENDING

### F3 — ADR-005: no collision exists today; the merge-time collision is silent and the plan has no check or procedure

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Edit discipline ("renumber at merge"); Phase 3 — ADR-005; AGENTS.md ADR range token
- **Detail**: Probe 5: `main` stops at ADR-004, and neither S-05 nor S-07 creates an ADR file (both extend ADR-003), so S-06 is the only claimant of 005 in sight. The risk is another future change that also picks "next number". Two files `ADR-005-a.md` and `ADR-005-b.md` do not conflict in git (different names), so a duplicate number merges silently. The plan's line "if a parallel change also claims 005, renumber at merge" names no way to notice, and the AGENTS.md rule "on a conflict take the higher number" only helps if a conflict appears in that one line.
- **Fix**: Add to the Edit discipline bullet: (1) Detection: before merging, run `ls docs/ADR/ADR-005-*` on the merged tree and expect exactly one file; a second hit means collision. (2) Procedure: the change that merges second renumbers its own ADR to the next free number with `git mv`, edits the `# ADR-00N:` title, every `ADR-005` mention it added (`grep -rn "ADR-005" README.md AGENTS.md docs context/changes/baseline-usage-comparison`), and the AGENTS.md range token to the highest number. (3) Nothing in code refers to the number except `rules.test.mjs` (see F4), so the rename touches docs only.
- **Decision**: PENDING

### F4 — `rules.test.mjs` does not check ADR-005, so row 3.4 is the only guard and it is weaker than the ADR-004 form

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — ADR-005 contract and row 3.4; Non-goal "No new prompt (so `rules.test.mjs` is unaffected)"
- **Detail**: `rules.test.mjs:116-123` selects ADR files by `/^ADR-00[34]-.*\.md$/`. ADR-005 is not read, so the ADR-004 form (one bold keyword per rule line, no bare upper-case keywords, no bold keyword on a non-rule line) is unchecked for it. Row 3.4 counts `**GIVEN**` lines and that each holds some bold keyword, but not "exactly one" (the second grep only rejects lines with none) although the Progress row text claims "each with exactly one bold keyword". The claim in the row is stronger than the command.
- **Fix**: Widen the regex in `rules.test.mjs` to `/^ADR-\d{3}-.*\.md$/` (one-line edit, also removes the next renumbering) and rename the test to "ADR rule lines follow the rule form"; keep row 3.4's counts as a floor of 4 rule lines. If the plan wants zero test-file edits, change the row text to "each with a bold keyword" instead.
- **Decision**: PENDING

### F5 — plan-brief.md points A1 at the wrong row

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan-brief.md` "Open Risks & Assumptions", first bullet
- **Detail**: The brief says the `sonnet` alias check is "row 1.5". After the renumbering the alias row is 1.6 and row 1.5 is the full-suite row. Everything else I cross-checked (1.7 usage spike, 3.7 real pair, 2.10/2.11, row counts per phase, the "Review response" table, the evidence-note headings) is consistent.
- **Fix**: Change "row 1.5" to "row 1.6" in the brief. Also drop the stray fragment "Node 18 only (AGENTS.md ban list)." at the end of the 1.4 case in the plan (it reads as a leftover; the ban list already applies to all new code).
- **Decision**: PENDING

### F6 — Three small gaps in the verdict and target rules

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: A8, A9; Phase 2 — `targetDropPercent` contract; Phase 3 — Markdown `Verdict` line
- **Detail**: (1) Displayed rounding can contradict the verdict: baseline 100000, routed 71004 is a 28.996 % drop; `dropPercent` prints `29`, the target is 29, and the verdict is `not met`. A reader sees "29 / 29 / not met". (2) The contract says the target is "`null` or a finite number in [0, 100]; anything else halts", but an override with `"compare": null` (or a missing key) makes `policy.compare?.targetDropPercent` `undefined`, which the sentence classes as invalid. `deepMerge` returns the override whole for a non-object, so `compare: null` is reachable. Say `undefined` is treated as `null`. (3) The `1e-9` relative slack is correct for realistic totals (probe 2) but is documented only as "keeps a fractional target exact"; note its range (exact for baselines below about 1e9 tokens) so a later reader does not widen it.
- **Fix**: (1) Print an unrounded-enough comparison in the Markdown `Verdict` line when rounding hides the difference, or simply state "decided on exact tokens, printed rounded to 2 decimals" next to `Drop`; (2) add "`undefined` counts as `null`" to the target contract; (3) one sentence on the slack range in A9.
- **Decision**: PENDING
