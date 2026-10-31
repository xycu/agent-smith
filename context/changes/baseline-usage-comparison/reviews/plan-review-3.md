<!-- PLAN-REVIEW-REPORT -->
# Plan Review (round 3): Baseline Usage Comparison Implementation Plan

- **Plan**: context/changes/baseline-usage-comparison/plan.md (revision 1b555c6)
- **Mode**: Deep (single reviewer, code and probes run directly, no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 4 observations

Rounds 1 and 2 are in `reviews/plan-review.md` (F1-F10) and `reviews/plan-review-2.md` (F1-F6). Finding IDs below restart at F1 for this round. The `Decision` fields of the earlier rounds were not trusted; each fix was re-checked against the plan text, the code and the skill text.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

Plan Completeness is WARNING only for observations F2 to F4 (gate commands that are weaker than the text around them). None blocks implementation.

## Grounding

Grounding: 9/9 paths ✓ (route.mjs, policy.json, helpers.mjs, rules.test.mjs, README.md, AGENTS.md, docs/ADR, plan-review skill, 10x-goal-implement skill), 16/16 symbols ✓ (`readLog`, `readMeta`, `executed`, `readPlan`, `halt`, `out`, `parseFlags`, `deepMerge`, `cleanUsage`, `riskCommand`, `verifyArchive`, `archiveDirs`, `paths`; helpers `makeProject`, `init`, `next`, `writeResult`, `readLogEntries`, `readMetaFile`, `writeMetaFile`, `entry`, `skipEntry`, `writeLog`, `gitInit`, `commitFiles`, `gitEnv`, `gitAvailable`, `run`, `cleanupAll` are all exported), Progress↔Phase consistent (Phase 1: 5 Automated + 2 Manual; Phase 2: 13 + 0; Phase 3: 7 + 1; one `## Progress`; no stray checkboxes; three `## Phase N:` headings match), brief↔plan ✓ (rows 1.6, 1.7, 2.13, 3.7 and the gate text agree). No `docs/reference/contract-surfaces.md`, no `lessons.md`. Default ladder length 7, highest `maxTier` 6, `rigor.minEffort` `high` at `standard` and `thorough`: the baseline-file bounds hold. The dispatch chain in `main` ends with `verify-archive` then `else { halt }`, so the `compare` branch is a pure insertion. `policy.json` order is `limits` (line 70) then `archive` (line 75): the `compare` block fits between them. The banned-API grep of row 2.12 prints nothing on the current `route.mjs` and `helpers.mjs` (exit 1, see F3).

## Round 2 fix verification

| Round 2 | Landed in plan.md? | Sound? |
|---|---|---|
| F1 `USAGE:` file gate | Yes: "Phase 2 gate" section, unnumbered Phase 2 precondition, Phase 1 evidence file with `USAGE: pending`, row 2.13, owner steps, brief row | Yes, with one gap (F4). Walkthrough below. |
| F2 pattern-row detection | Yes: one command form in "Convention for pattern rows", checked on spec and tap | Yes for match and no-match. A skipped test is mis-described for the tap reporter (F2). |
| F3 ADR-005 detection and renumber | Yes: Edit discipline items (1) to (3), row 3.8 | Yes. `main` holds ADR-001 to ADR-004 only; code names no ADR number. |
| F4 widened `rules.test.mjs` regex | Yes: item 4a, row 3.8, Non-goal text corrected | Yes. Probed: a copy of `rules.test.mjs` with `/^ADR-\d{3}-.*\.md$/` passes 7/7 on this tree, so ADR-001 to ADR-004 survive. Test renamed to "ADR rule lines follow the rule form" matches the row 3.8 pattern `^ADR rule lines`. |
| F5 brief row 1.6 | Yes | Yes. |
| F6 rounding, `undefined` target, slack range | Rounding and `undefined` landed; the slack argument is wrong (F1). | Rounding sound for integer targets; see F1. |

### Special attention 1: can an unattended `/10x-goal-implement` really stop after Phase 1?

Read from `/Users/blazej/.claude/skills/10x-goal-implement/SKILL.md`:

- It flips only Automated rows and never blocks on or ticks Manual rows ("Manual rows"), so rows 1.6 and 1.7 stay `[ ]` without any special handling.
- Phase 1 commits on green gates. The "Phase 1 bootstrap" seeds the touched-file set with every untracked file in `context/changes/<id>/`, so `real-run-evidence.md` (with `USAGE: pending`) lands in the Phase 1 commit.
- It reads the whole plan at Setup, so the main context sees the Phase 2 precondition and the "Phase 2 gate" section. Preflight only checks that the gate commands are runnable; `grep` is, so row 2.13 does not trip it.
- Its only halt is the STOP block ("STRUCTURAL MISMATCH" or "GATE FAILURE"). A precondition that fails fits "a phase that depends on output a prior phase never produced". Completed Progress rows stay flipped, uncommitted work stays in the tree, and the resume point is the first pending Automated row.
- The dispatched implementation subagent receives only Overview, Changes Required and Success Criteria. The `### Precondition` block sits between Overview and Changes Required and may not be forwarded. Enforcement therefore rests on the main context (which has read the plan) and on row 2.13. That is acceptable; it is why the backstop exists.
- Router side: a result with `signals.needsHuman` makes `next` halt once through `endRun` (`route.mjs:1031-1038`). The implement step is `10x-goal-implement`, so Phase 1 is committed and the run ends with a report. A second `init` resumes.
- Backstop order: row 2.13 is the last Automated row of Phase 2, so a skipped precondition costs a full Phase 2 build before the gate fires. The plan accepts that; with a failing 2.13 the Phase 2 commit does not land and rows 2.1 to 2.12 stay flipped for the resume. One hole remains (F4).

Conclusion: the stop-after-Phase-1 path works as designed, with `blocked` plus `signals.needsHuman` as the pipeline-level result and the STOP block as the skill-level result. No mechanical hook is needed or claimed.

### Special attention 6: row-index gaps and ordering

Progress rule: indices are unique within a phase, never renumbered, gaps are acceptable. There is no ascending-order requirement. Phase 3 lists `3.1 ... 3.6, 3.8` under Automated and `3.7` under Manual. The goal-implement parser takes the first pending row under `#### Automated` in document order, flips rows by number and uses the Phase block bullet order only for the human mapping. The Phase 3 Success Criteria block also puts the ADR bullet last, so bullet order and row order agree. Rows 2.13 and 3.8 add no gap. Sound.

## Findings

### F1 — The A9 slack argument uses the wrong granularity; the verdict can read `met` while the printed drop is below the target

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: A9; Phase 2 contract (`comparable` / `met`); row 2.2
- **Detail**: A9 says one token is 100 on the left side of `diff * 100 >= target * baselineTotal`, so a slack of `1e-9 * max(1, right)` stays below one token while `target * baselineTotal < 1e11`. The gap that matters is not one token. For a target with at most 2 decimals, `right = t * B / 100` (t the target in hundredths), so `left` (a multiple of 100) and `right` can differ by as little as 0.01 when the exact answer is `not met`. The slack reaches 0.01 once `right` reaches 1e7, which is a baseline of about 350 000 tokens at a 29 % target. Probe (Node 24): baseline 1 004 202, routed 712 883, target 29.01. Exact integer test `diff * 10000 >= t * B`: not met (drop 29.0099 %, `q` = 2900, prints 29). The A9 float test: `met`. Across 51 412 boundary cases (targets 0.01 to 100 in steps of 0.07, baselines 100 to 123 456 789, diff within two tokens of the threshold) the A9 formula disagreed with exact math 91 times; a relative slack of `4 * Number.EPSILON` disagreed 0 times. So the A9 claim "the printed value is at least the target exactly when the verdict is `met`" is false for such targets. Real-world impact is tiny (the pair must land within about 1e-5 percentage points of the target), which is why this stays an observation. The plan also says the slack "must not be widened", which hides that it is already too wide.
- **Fix**: In A9 and the Phase 2 contract, replace the `1e-9` relative slack with `4 * Number.EPSILON` relative (it only has to absorb the rounding of `target * baselineTotal`), and correct the sentence about "100 on the left side" (the minimum gap is 0.01 for a 2-decimal target). Optionally decide by integer math when the target has at most 2 decimals: `diff * 10000 >= Math.round(target * 100) * baselineTotal` (both sides stay below 2^53 for baselines under 1e11). Add to row 2.2: baseline 1 004 202, routed 712 883, target 29.01 gives `not met` with `dropPercent` 29. Row title stays unchanged (titles are immutable).
- **Decision**: PENDING

### F2 — The plan says a skipped test prints no marker; the tap reporter prints `ok N - name # SKIP`, which the row command accepts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "Convention for pattern rows" (last sentence); rows 1.3 and 2.10
- **Detail**: The paragraph states "A skipped test prints neither, so a git-dependent row (1.3, 2.10) fails on a machine without git instead of passing silently." Probe on Node 24: the spec reporter prints `﹣ 1.3 ... # SKIP` (no match, claim true); the tap reporter prints `ok 1 - 1.3 skipped git row # SKIP`, which matches `^ *ok [0-9]+ - 1\.3 `. On Node 18, where tap is the default, a machine without git passes rows 1.3 and 2.10 silently. The case is narrow (git is always present in a dev checkout and the router needs it for churn), so this is a wording and command gap, not a blocker.
- **Fix**: Add `&& ! grep -q "# SKIP" "$TMPDIR/r.txt"` to the one command form, and say that a skipped row fails. Or replace the claim with "git is required for rows 1.3 and 2.10".
- **Decision**: PENDING

### F3 — Several gate commands are weaker than the unattended-runner reading the plan itself argues for

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "Convention for pattern rows" command (`$TMPDIR`); rows 2.12 and 3.4 (expected-empty greps)
- **Detail**: Round 2 F2 argued that an unattended run reads exit codes. Three commands still depend on a human reading output. (a) `> "$TMPDIR/r.txt"` writes to `/r.txt` when `TMPDIR` is unset (common on Linux CI); the redirect fails, `&&` stops and the row fails with a confusing error, not silently. (b) Row 2.12's banned-API grep and row 3.4's `grep ... | grep -vcE ...` print nothing or `0` and exit 1 exactly when the code is right (`grep -c` exits 1 on a zero count; confirmed with `grep -vc`). A runner that goes by exit code marks a correct tree as a gate failure, and the 2-attempt self-fix budget is then spent on nothing. A runner that reads "prints 0" will judge correctly, so this is fragile, not wrong.
- **Fix**: Use `${TMPDIR:-/tmp}` in the command form. For expected-empty checks write a form whose success is exit 0, for example `! grep -nE "<pattern>" files` and `test "$(grep ... | grep -vcE ...)" = 0`, or `grep ... ; test $? -eq 1`.
- **Decision**: PENDING

### F4 — Nothing forbids an unattended run from writing the `USAGE:` line, and row 2.13 can be satisfied by doing so

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: "Phase 2 gate"; Phase 2 precondition; row 2.13; Phase 1 Implementation Note
- **Detail**: The gate's prohibitions cover `route.mjs` edits, ticking 1.6 and 1.7, running the pipeline and emulating the spike, and the advisory probe "never changes the `USAGE:` line". No sentence forbids the unattended run itself from editing that line. `10x-goal-implement` "Self-fix escalation" gives a failing gate two fix attempts through a `Task` subagent, with the instruction to fix the code to meet the check. For row 2.13 the only edit that makes the grep pass is `USAGE: present`, which would unlock Phase 2 on fabricated evidence and defeat the gate. The risk is low (a self-fix subagent would have to choose to write evidence), but the gate exists precisely because the unattended run has no one to ask, and the closing line costs one sentence. Related and accepted: the precondition is outside the sections forwarded to the phase subagent, and the backstop fires only after Phase 2 is built.
- **Fix**: Add to the "Phase 2 gate" bullet list and to the precondition: an unattended run MUST NOT write, replace or add any line that starts with `USAGE:`, and a failing row 2.13 is not self-fixable: print the STOP block at once, with no self-fix attempt.
- **Decision**: PENDING
