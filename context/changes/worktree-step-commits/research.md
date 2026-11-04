---
date: 2026-11-03T01:05:20+01:00
researcher: Claude (claude-sonnet-5-5, unattended research subagent)
git_commit: 62ada19edf0d0f7af9734bf299b5fb1a0c45767b
branch: feat/worktree-step-commits
repository: agent-smith
topic: "Follow-up for plan review round 2 (F1-F5) of worktree-step-commits"
tags: [research, follow-up, worktree, claude-code-docs, effort-floor, ladder-renumbering, rollback, step-commit, route.mjs, policy.json]
status: complete
last_updated: 2026-11-03
last_updated_by: Claude (claude-sonnet-5-5, unattended research subagent)
last_updated_note: Follow-up 1 added for plan-review round 2 findings F1-F5. research.md did not exist before this run, so the file starts with this follow-up.
---

# Research: Follow-up for plan review round 2 (F1-F5) of worktree-step-commits

**Date**: 2026-11-03T01:05:20+01:00
**Researcher**: Claude (claude-sonnet-5-5, unattended research subagent)
**Git Commit**: 62ada19edf0d0f7af9734bf299b5fb1a0c45767b (working tree: change folder uncommitted)
**Branch**: feat/worktree-step-commits
**Repository**: agent-smith

## Research Question

Follow-up 1. `reviews/plan-review.md` (round 2, verdict REVISE) names five findings. This document gathers the facts the re-plan needs for each of them: F1 (worktree directory vs Claude Code's working directory), F2 (renumbering vs the "never edit" test file), F3 (`opus/medium` vs the ADR-003 effort floor), F4 (reset target after a failed implement step) and F5 (the step commit running more than once). No earlier research findings exist: `research.md` was absent when this run began, so nothing was rewritten.

## Summary

- **F1 (settled with docs; Fix A holds, two residual risks).** Claude Code keeps a main-session `cd` only inside the project directory or an added directory, so a sibling directory is reset (tools-reference, "Bash tool behavior"). A subagent "starts in the main conversation's current working directory" (sub-agents doc), which closes the blind spot in Fix A: a subagent starts in the worktree when the orchestrator's `cd` into `.claude/worktrees/agent-smith-<id>` carried over. Residual risks: (1) `.claude` is a protected directory and the documented exemption names "Claude's own git worktrees under `.claude/worktrees/`"; whether a worktree made by plain `git worktree add` is covered is not stated. (2) Not tested in a live run.
- **F2 (owner decision; facts for it).** With the Phase 1 numbers applied to a scratch copy of the repository and no other change, 8 tests fail on tier literals in 5 files. Only 2 of them are in `loops-existing.test.mjs` (lines 46 and 69). The "never edit" rule is a convention (AGENTS.md:23, the file header, the loops.test.mjs header); no test or CI check compares its bytes.
- **F3 (fix verified on a scratch copy; wider test cost than the plan states).** The proposed loop in `settle` keeps every interactive step off `opus/medium`, and with it 15 tests need new literals, not 8. `scoreShift.effective` reads 2 for a shift of 1 when the floor skips a rung.
- **F4 (owner decision; new evidence).** `10x-goal-implement` is built to resume at the first pending Automated row after a STOP, with committed phases and flipped rows kept. A reset to `startSha` throws that away. The four archived runs have no failed step, so the frequency is unknown. A reset to the failed step's own head (Fix B) loses only the SHA suffixes written after the last phase commit.
- **F5 (confirmed; applied fix is sound).** Every halt path in `next` goes through `finishRun`, which writes `run.jsonl`; on resume `attachResult` returns early, so the "last entry is ok" condition holds again. The `commit` key on the entry is the right guard.

## Detailed Findings

### F1 - Worktree location and Claude Code's working directory

Observed in the docs (fetched 2026-11-03 with WebFetch; the first two quotes were also read verbatim in the saved page text, the protected-path text is as returned by the fetch tool's summary):

- Main session `cd`: "the new working directory carries over to later Bash commands as long as it stays inside the project directory or an additional working directory"; "Subagent sessions never carry over working directory changes"; "If `cd` lands outside those directories, Claude Code resets to the project directory and appends `Shell cwd was reset to <dir>`" (code.claude.com/docs/en/tools-reference, "Bash tool behavior"). This confirms the mechanism in review F1.
- Subagent start directory: "A subagent starts in the main conversation's current working directory. Within a subagent, `cd` commands don't persist between Bash or PowerShell tool calls" (code.claude.com/docs/en/sub-agents, Working directory). This answers the blind spot of Fix A for the case the orchestrator is the main conversation. Not inspected: a pipeline whose orchestrator itself runs inside a subagent, where its `cd` would never carry over.
- Location and convention: Claude Code creates worktrees under `.claude/worktrees/<name>/` at the repository root and recommends ignoring that directory (code.claude.com/docs/en/worktrees, "Start Claude in a worktree"). The same page lists "Have Claude edit in a worktree made with `git worktree add` under the directory the session started in" as a supported way to work when `blockWritesOutsideWorkingDirectories` is on. The periodic sweep leaves a worktree "you created ... yourself with `git worktree add`", so Claude Code does not delete the run's worktree.
- Protected paths: `.claude` is a protected directory whose writes are never auto-approved, "with a few exceptions, such as ... Claude's own git worktrees under `.claude/worktrees/`" (code.claude.com/docs/en/permission-modes, "Protected paths"). The page does not say whether a worktree made by `git worktree add` counts as "Claude's own". If it does not, Edit and Write by an unattended subagent under the worktree path prompt even in `acceptEdits`. Open; manual check 2.5 should include an Edit without a prompt in `acceptEdits`.
- `EnterWorktree` alternative: a `path` under `.claude/worktrees/` is entered without a prompt and moves the session's working directory and write access; the tool is removed when `permissions.blockWritesOutsideWorkingDirectories` is on (tools-reference, "EnterWorktree tool behavior"). While a session is isolated this way, Claude Code also blocks Edit/Write and git redirects that target the main checkout (worktrees doc, "How Claude Code enforces isolation"). It is an option, not tested here; the plan uses `cd`.
- Router side: `const ROOT = process.cwd()` (`skills/10x-pipeline/scripts/route.mjs:23`), so every router call works on the shell's current directory. A reset to the project directory therefore reaches the isolation gate of `init` as a non-linked worktree, as review F1 says.
- Local probes (git 2.54.0 Apple Git-157, scratch repo `scratchpad/wt1/main`, one run each):
  - After `git worktree add -b agent-smith/x .claude/worktrees/agent-smith-x`, `git status --porcelain` in the main checkout printed `?? .claude/`; `git check-ignore -q .claude/worktrees/` returned 1.
  - After appending `.claude/worktrees/` to the file printed by `git rev-parse --git-path info/exclude`, the main checkout status was empty, `check-ignore` returned 0 in the main checkout and inside the worktree, and the worktree status was clean.
  - `git rev-parse --git-common-dir` printed the relative `.git` from the main checkout's top level and an absolute path from inside the worktree. `git rev-parse --git-path info/exclude` printed the absolute `<main>/.git/info/exclude` from both. The plan's `$(git rev-parse --git-common-dir)/info/exclude` works from the top level only (a subdirectory was not tried); `--git-path info/exclude` is cwd-independent in the two places tried.
  - In this repository, `mkdir` and `touch` under `.claude/worktrees/` succeed in the current Bash sandbox, and `git check-ignore -v .claude/worktrees/x` names `.gitignore:1` (commit 78c3079, "chore: ignore .claude/worktrees"). The directory exists and is empty.
- Starting state: this change's folder is uncommitted in the main checkout (`git status`: `M change.md`, `?? plan.md`, `?? reviews/` and others), so a worktree created from `HEAD` lacks it and the copy step in Phase 2 §3 is needed.

### F2 - Which tests the renumbering breaks

Method: copied `skills/`, `agents/`, `docs/`, `tools/` to a scratch directory, applied only the Phase 1 §1-§2 data (insert `opus/medium` at index 4; `plan` 5/7; `plan-review`, `impl-review`, `research`, `domain-brief`, `manual-verify` maxTier +1; `implement` and `fix` maxTier 7; `frame` 5/5/5; `complexity.firstPlan.bump.plain` -2; baseline ladder 8 entries), left `route.mjs` unchanged and ran `node --test` on the whole suite. The copy has no README.md, AGENTS.md or release-please files, so 5 failures that read them are artifacts of the copy and are left out below.

- Run 1 (data only): 558 tests, 13 failures, 8 real:
  - `loops-existing.test.mjs:46` (`last.tier` 6, actual 7) and `:69` (5, actual 6).
  - `loops.test.mjs:114` (frame tier 4, actual 5), `:152` (6, actual 7) and `:398` (4, actual 5).
  - `preplan.test.mjs:49` (policy literal `maxTier: 5` for `research`; lines 50 and 51 pin `domain-brief` and `frame` the same way).
  - `preplan.test.mjs:924` (frame retry, 4, actual 5).
  - `score.test.mjs:591` (hard-keyword first plan, 4, actual 5).
- Only the first failing assertion of each test is reported, so later literals in the same tests are not counted (for example `preplan.test.mjs:50-51`).
- The two `loops-existing.test.mjs` assertions pin the index of `opus/max` (6 on the old ladder, RETHINK: base 4 + 2) and `opus/xhigh` (5, REVISE: base 4 + 1). Their `tierWhy` assertions (`+2 from results`, `+1 from results`) do not change. No router-code literal needs renumbering: a search of `route.mjs` for tier comparisons and `ladder[<n>]` found none.
- The rule: AGENTS.md:23 ("the characterized RETHINK/REVISE loop (never edit it)"); `loops-existing.test.mjs` lines 1-3 ("committed before any router change and is never edited afterwards"); `loops.test.mjs:2`. The file has one commit (648bb11). Enforcement found: none in tests or CI. The only automated-style check is a plan row of the archived pre-plan-steps change that diffs the file against its first commit (`context/archive/2026-10-30-pre-plan-steps/plan.md:328`, `:404`).
- No way was found to keep the two assertions green with the rung inserted at index 4: the same model and effort sit one index higher, so any renumbering moves them. An old ladder injected through `writeOverride` is the alternative the review already rejected.
- `loops.test.mjs:152` ("RETHINK below minRigor behaves as on main") asserts the same tier at the same level as `loops-existing.test.mjs:46` and is not under the rule.

### F3 - `opus/medium` and the effort floor

- Rule: ADR-003 "Effort floor", `docs/ADR/ADR-003-rigor-gated-routing.md:62`: at `standard` or `thorough` the router "**MUST** pick a tier with effort `high` or above" for an interactive skill; `:63` sets `medium` at `lean`.
- Code: `effortFloorTier` returns the lowest index whose effort ranks at least the minimum (`route.mjs:1767-1775`); `settle` applies it as an index floor only (`route.mjs:1809-1814`). On the planned ladder `sonnet/high` is index 3 and `opus/medium` index 4, so an interactive step that lands on 4 stays there.
- Observed instance: this run's plan review, step 4 in `agent-smith/run.jsonl`, has `tier: 4`, `tierWhy: "base 2, +2 for 6 phases, floor high (tier 3)"`; on the planned ladder that value means `opus/medium` at `thorough`.
- Fix check: in the scratch copy I added, after the index floor, `while (final < top && effortRank(ladder[final].effort) < effortRank(minEffort)) final++` (rank from `rigor.effortOrder`). Run 2 (data plus this loop; `tools/` tests not run): 546 tests, 18 failures, 3 copy artifacts, 15 real. The 7 beyond run 1:
  - `preplan.test.mjs:808` (failed research retry, 4, actual 5) and `:833`.
  - `score.test.mjs:584`, `:599`, `:755` (`plan.maxTier` 4 is beaten by the floor, as it is today), `:810` and `:933` (`scoreShift` is `effective: 2` for a shift of 1, because the plain-goal first plan goes from 3 to 5 over the skipped rung).
  - The report text reads `effective` only as applied or not (`route.mjs:271`), so the output text does not change; the status JSON and the test do.
- The plan's Phase 1 table rows for interactive steps (plan, plan-review, impl-review, an interactive base-3 step after one failure) agree with run 2: they land on index 5 `opus/high`. Non-interactive rows (`implement`, `fix`) were not driven in run 2 beyond the unchanged tests.
- Edge not exercised: an effort name absent from `effortOrder` ranks -1 and would move the step to the top rung; the shipped ladder and the baseline ladder use only listed names.

### F4 - What a failed implement step leaves

- `10x-goal-implement` (user skill file `~/.claude/skills/10x-goal-implement/SKILL.md`, read 2026-11-03): rows are flipped and `plan.md` is staged into each phase commit (`:183`); the short SHA is written into the flipped rows after the commit, which leaves `plan.md` dirty until the next phase commit or the epilogue commit (`:229`, `:256`); on a STOP "completed Progress rows stay flipped, in-progress work stays in the worktree uncommitted" and "Resume needs no extra state" (`:171`, `:249`).
- Consequence for Fix A (reset to `startSha`): committed phases and their ticks of the failed step are dropped from the branch, and the retry, two tiers above the first attempt, redoes them. Consequence for Fix B (reset to the head the step left): ticks of committed phases are inside their phase commits and survive; the SHA suffix of the last committed phase is the only Progress edit lost, and the skill itself says SHA-less rows are surfaced as an archive warning, not a failure (`:209`, stated there for the empty-diff case).
- Router side: a plain implement step counts as done by `plan.autoDone > before.autoDone` (`verifyImplement`, `route.mjs:1371-1392`), and `ok` also needs `status === "done"` (`attachResult`, `route.mjs:488`). A step that stops with committed phases therefore ends `ok: false`. The `before.autoDone` of the retry is read from the files after the rollback, so Fix B needs no second baseline for the count; `before.head` and `commitEvidence` (`route.mjs:1324-1328`, `:1342`) read HEAD at entry creation and stay correct.
- Frequency: the four archived runs with a log (`context/archive/*/agent-smith/run.jsonl`) hold 34 executed steps, 9 of them implement steps, and no step with `ok: false`. No evidence exists on how often an implement step fails after committing a phase.
- The change notes fix the target ("hard-reset the worktree to the step's start commit", `change.md`), so Fix B changes an owner decision.

### F5 - Repeat of the step commit

- `attachResult` returns at once when the last executed entry already has `result` (`route.mjs:437`), and it changes the log only in memory.
- Every halt in `next` after it (needs-human, budget, `decide` halt, attempts cap) goes through `endRun` -> `finishRun`, which calls `writeLog` and writes `meta.json` and `report.md` (`route.mjs:338-347`). After such a halt the last entry is persisted with `ok: true` and its `result`, so a resume meets the same "last executed entry is ok" condition. The existing guard pattern for the same shape is the `needsHumanAck` flag on the entry (`route.mjs:2284-2286`).
- The applied fix (commit only when the entry has no `commit` key, `commit: null` for an empty index, the key left absent on a git failure) is consistent with that. Two observed side effects, not findings against the plan: the `commit` value and, after a halt, `report.md` and `meta.json` land dirty and go into the next step's commit; and `archiveDone` requires an empty index (`route.mjs:2148-2153`), which the step commit's own post-commit check already guarantees.
- Order inside `next`: `beforeExtra` reads HEAD at entry creation (`route.mjs:2371` area), after the commit would run in the same call, so `startSha` and `before.head` of the next entry follow the router's commit.

## Code References

- `skills/10x-pipeline/scripts/route.mjs:23` - `ROOT = process.cwd()`.
- `skills/10x-pipeline/scripts/route.mjs:434-490` - `attachResult` (early return at 437, `ok` at 488).
- `skills/10x-pipeline/scripts/route.mjs:338-347` - `finishRun` writes log, meta and report.
- `skills/10x-pipeline/scripts/route.mjs:1767-1775` - `effortFloorTier`; `:1809-1814` - floor in `settle`; `:1825-1829` - `scoreShift.effective`.
- `skills/10x-pipeline/scripts/route.mjs:1324-1328`, `:1342`, `:1371-1392` - `beforeExtra`, `commitEvidence`, `verifyImplement`.
- `skills/10x-pipeline/scripts/route.mjs:2265-2400` - `next`; `:2119` - `archiveDone`.
- `skills/10x-pipeline/test/loops-existing.test.mjs:1-3`, `:46`, `:69` - header and the two tier literals.
- `skills/10x-pipeline/test/loops.test.mjs:2`, `:114`, `:152`, `:398`; `preplan.test.mjs:49-51`, `:808`, `:833`, `:924`; `score.test.mjs:584`, `:591`, `:599`, `:755`, `:810`, `:933`.
- `AGENTS.md:23` - the "never edit it" wording.
- `docs/ADR/ADR-003-rigor-gated-routing.md:58-63` - effort floor.
- `.gitignore:1` - `.claude/worktrees/`.
- `~/.claude/skills/10x-goal-implement/SKILL.md:171,183,229,249,256` - commit ritual and resume.

## Architecture Insights

- Router state is file-driven and reads the working directory once (`ROOT`), so the isolation gate depends entirely on where the shell is; the documented subagent start directory makes the orchestrator's `cd` the single source of truth for every step.
- The ladder is read by index in the tier math and by effort name in the floor; once the ladder is not ordered by effort, the floor needs the second check (F3). This is the only place the router compares efforts.
- Resume-by-files is the design of both the router and `10x-goal-implement`. A rollback that rewinds files also rewinds the state the next step reads, which is why F4 is a design question and not a detail.

## Historical Context (from prior changes)

- `context/archive/2026-10-30-pre-plan-steps/plan.md:117-142`, `:328`, `:404` - why `loops-existing.test.mjs` exists and the byte-identity row used then.
- `docs/ADR/ADR-003-rigor-gated-routing.md:353` - a neutral fallback entry already has "no tier bump, no rigor rise", the precedent for the neutral cheap failure in Phase 5.
- `context/archive/2026-11-02-llm-complexity-scorer/` - the `score` step, whose `advisory` entry is the model for the neutral failure and whose tests contain most of the tier literals in F3.

## Related Research

None under `context/changes/**/research.md` for this change; `context/archive/2026-10-30-phase-executors/research.md` mentions `loops-existing.test.mjs` in passing.

## Open Questions

- F1: does `git worktree add` at `.claude/worktrees/<name>` count as "Claude's own git worktrees" for the protected-path exemption (unattended Edit/Write in `acceptEdits`)? Live check, manual row 2.5.
- F1: does a subagent of a real pipeline run start in the worktree after the orchestrator's `cd`? Documented, not run. Also untested: the orchestrator started from a subdirectory (relative `--git-common-dir`), and `EnterWorktree` as the entry method.
- F2: owner decision on a one-time edit of two literals (46: 6 to 7, 69: 5 to 6) in `loops-existing.test.mjs`. The simulation lists at least 15 literal groups in 4 more files for the re-plan to name; hidden later assertions are not counted.
- F3: how `scoreShift.effective` should read when the floor skips a rung (2 for a shift of 1); `score.test.mjs:933` pins it.
- F4: owner decision between reset to `startSha` (Fix A) and reset to the failed step's own head (Fix B); no failure-rate data exists (0 failed steps in 34 archived).
- Nothing was run against a live Claude Code session or a live `/10x-goal-implement`.
