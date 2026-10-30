---
date: 2026-10-30T22:44:34+0100
researcher: Claude (Sonnet 5.5) for Błażej Ksycki
git_commit: 6f9196558833472c7cdf89242e9c68baed89e146
branch: archive-adapter-research
repository: agent-smith
topic: "Archive adapter: verify the accepted design against current route.mjs, SKILL.md and the real /10x-archive skill"
tags: [research, router, route.mjs, 10x-archive, archive, git, endRun, verify-archive]
status: complete
last_updated: 2026-10-30
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Archive adapter, accepted design vs current code and the real `/10x-archive`

**Date**: 2026-10-30T22:44:34+0100
**Researcher**: Claude (Sonnet 5.5) for Błażej Ksycki
**Git Commit**: 6f91965 (working tree: untracked `context/changes/archive-adapter/` only)
**Branch**: archive-adapter-research
**Repository**: agent-smith

## Research Question

`context/changes/archive-adapter/change.md` scopes an opt-in `--archive` adapter around `/10x-archive`. The design is accepted in `context/changes/rigor-levels/research.md` (section 4 and Follow-up 1 "Archive adapter"), so this research does not redo it. It answers four questions for `/10x-plan`:

1. What exactly was accepted?
2. Does it still fit the current `route.mjs` and `SKILL.md`?
3. Does the real `/10x-archive` skill behave as the design assumes, and which answers must the unattended subagent give?
4. What does the change depend on from `rigor-levels` (not yet in code), and what is risky or open?

Scope note: `change.md` says the folder already exists. In this worktree it was absent (it is untracked in the main checkout), so its content was copied unchanged from there. Nothing else in the folder was created beyond this file.

## Summary

- **The design holds on four points and is wrong on one.** It holds for the ordering (report, then commit, then `archive` action), for "no result file into the folder that moves", for the two hard blocks, and for `verify-archive` being read-only. It is wrong where it commits only `agent-smith/`. For a normal pipeline run, `git status --porcelain context/changes/<id>/` stays non-empty after that commit (details in "The commit scope is too narrow").
- **Re-running the router after the move writes into the old path.** `next()` and `init` call `fs.mkdirSync(p.dir, { recursive: true })` before any check (`route.mjs:403`, `:493`). The `halt` for a missing `change.md` then goes through `endRun`, which writes `meta.json`, `run.jsonl` and `report.md` (`route.mjs:178-186`, `:273-275`). This is inferred from the code; it was not executed.
- **The `archive` action fits `SKILL.md` with three edits.** A new action, a result-less Agent call that skips loop steps 3-5, and a call order of `status` before `archive` (the `done` branch runs `status` at `SKILL.md:42`, which reads a log that has moved after the archive).
- **The unattended subagent must be told the answers.** The generic suffix says "choose the recommended or most conservative option" (`policy.json:53`). For the warnings prompt that would be `Cancel`. The archive prompt must override it with `Continue archiving`, and with `Archive without repointing` for the repoint prompt.
- **`rigor-levels` is a textual and data dependency more than a logical one.** Both edit `endRun`, `buildReport`, `init`/`meta.json` and `next()`. Nothing in the archive flow needs skip entries to work. All of it is not yet in code.

## Detailed Findings

### 1. The accepted design (summary only)

Source: `context/changes/rigor-levels/research.md`.

- Owner decision 7 and the Follow-up 2 decision 5 accept the adapter "as designed in Follow-up 1" (`:291`, `:452`). The change is the fourth of the split (`:507`, under the then-name `archive-and-lessons`); `change.md` has since split lesson candidates off, so this is change 5 of 5.
- Constraints A1-A4 (`:367-371`): a clean change folder including `agent-smith/` and `last-result.json`; nothing staged repo-wide; scripted answers for warnings and the SHA repoint; no change folder after `git mv`, and `context/archive/` read-only.
- Steps (`:375-386`): at `done` with `--archive`, halt if `git diff --cached --quiet` fails; write the final `report.md` with an "archive: pending" line; set `meta.outcome`; `git add` and commit `agent-smith/`; re-check `git status --porcelain context/changes/<id>/` is empty; return an `archive` action instead of `run`. The subagent runs `/10x-archive <id>` at effort `high` or above and answers `Continue archiving` and `Archive without repointing`; its RESULT is never written to disk. `route.mjs verify-archive <id>` reads `context/archive/*-<id>/change.md` and checks that the old folder is gone.
- Out of scope (`:387-390`): no edit of `/10x-archive`, no write after the move, and the outcome lives only in the final orchestrator message and the archive commit.
- Inference recorded there (`:392`): the commit is the router's first git write and settles FR-008's "git handling is decided downstream" (`prd.md:101`; research `:234`). ADR-003 records it.

### 2. Current code: where the adapter attaches (`skills/10x-pipeline/scripts/route.mjs`)

**The `done` path.**
- `decide()` ends at `return { done: true, reason, manualPending }` (`:352-356`). Reaching it means plan review was fresh, no Automated rows were pending, impl review was fresh and no fix was needed (`:289-350`).
- `next()` turns a `done` decision into `endRun(... { action: "done", reason, manualPending, steps: log.length })` (`:413-417`). `done` is therefore the only place where the adapter hooks in. The halt and budget branches (`:408-410`, `:416`) also call `endRun`, so they need a rule for "no archive" (Open Question 4).
- The default policy has `fixOnNeedsAttention: true` (`policy.json:45`). Under that default, `done` is reached only with an `APPROVED` verdict, or when the review file has no verdict (`ir.verdict ?? "APPROVED"`, `:354`). A project override can also make a `NEEDS ATTENTION` review without criticals reach `done`.

**`endRun` and `buildReport`.**
- `endRun` writes the log, sets `meta.outcome = { action, reason }`, rewrites `meta.json`, writes `report.md` via `writeReport`, and prints with `out()` (`:178-186`). `out()` calls `process.exit` (`:19-22`), so `endRun` cannot be followed by git work. The adapter has to run before `out()`, which means `endRun` must be split into a write step and a print step.
- `buildReport` renders `Goal`, `Outcome`, one row per log entry and a `Steps:` totals line (`:143-168`). It has no slot for "archive: pending". `rigor-levels` also changes this function (its skip section), so the two changes touch the same lines.
- `meta.outcome` is deleted by `next()` when a run continues (`:426-429`), so a resumed run does not keep an old outcome.

**`init` and `meta.json`.**
- `init` rewrites `meta.json` as `{ id, goal }` (`:497`) and keeps only `goal` from the previous file (`:494-496`). A stored `archive` flag would be lost on every resume, exactly like the rigor level in the earlier research (`rigor-levels/research.md:90-91`).
- `parseFlags` accepts any `--flag` generically (`:24-33`). `init` reads only `flags.goal` (`:496`). `--archive` parses today, and has no effect.
- The main block validates the id with `^[a-z0-9][a-z0-9-]*$` (`:485`) and dispatches `init`, `next`, `status` (`:491-505`). `verify-archive` needs a new branch there and a usage-string update (`:486`).

**The `last-result.json` write.**
- `attachResult` does not write `last-result.json`. It reads it (`:207`) and deletes it (`:209`). The orchestrator writes it, at `SKILL.md:40`.
- Consequence for the design: at `done` the file has already been deleted (the last `run` step's result was consumed by `attachResult` in the same `next` call), so no stray result file is in the folder at commit time. The A1 mention of `last-result.json` (`rigor-levels/research.md:368`) only matters if the `archive` action were written like a `run` action. It is not.
- The `archive` action has no `resultFile`, so the orchestrator writes nothing into the folder that moves.

**The no-git baseline.** `route.mjs` imports `node:fs`, `node:path` and `node:url` only (`:12-14`). The commit needs `node:child_process` (a `node:` built-in, allowed by AGENTS.md). `rigor-levels` adds the same import for churn.

**Write paths after the move (inferred, not run).**
- `next()` calls `fs.mkdirSync(p.dir, { recursive: true })` as its first action (`:403`), and `init` does the same (`:493`).
- With `context/changes/<id>/` gone, `decide()` returns `halt` for the missing `change.md` (`:273-275`) and `endRun` then writes `run.jsonl` (empty log, `:179`), `meta.json` and `report.md` into a freshly recreated `context/changes/<id>/agent-smith/`.
- `status` without `--report` is read-only (`:463-473`) and `status --report` refuses when `p.change` is missing (`:475`). That is the pattern `verify-archive` should copy.

### 3. Current `SKILL.md`: how an `archive` action fits

- The loop acts on three actions: `run`, `done`, `halt` (`SKILL.md:36-43`). An unknown action has no rule.
- `run` is a five-step sequence: print a line, spawn the Agent with `model`/`effort`/`prompt` verbatim, parse `RESULT:`, write `resultFile`, call `next` (`:37-41`). The `archive` action needs steps 1 and 2 only. It must say explicitly: no result file, no `next`.
- `done` runs `node $ROUTER status <change-id>` and shows the log (`:42`). The log lives in the folder that archive moves, so `status` after archive returns an empty list. The router has to return the `done` payload (report path, `manualPending`, steps) before `archive`, and the orchestrator has to print it first.
- The report path in `done` points at `context/changes/<id>/agent-smith/report.md`. After the move it is `context/archive/<created>-<id>/agent-smith/report.md`. `<created>` comes from `change.md` (`10x-archive/SKILL.md:154-155`).
- Rules: "Never skip the router, call two steps without it, or run a step it did not return" (`:48`). A router-returned `archive` action satisfies it. "Never edit ... `run.jsonl` or `meta.json`" (`:49`) stays true.
- `Start` step 2 stops when `change.md` is missing and tells the user to run `/10x-new` (`:29`). After archive that message is misleading.
- AGENTS.md: `SKILL.md` must not name models or tiers beyond what it documents. The archive step's effort floor belongs in `policy.json` (`steps.archive`, pinned tier). The `tierFor` clamp can pin it by data alone (`route.mjs:392`; `rigor-levels/research.md:112`).

### 4. The real `/10x-archive` (`~/.claude/skills/10x-archive/SKILL.md`, read only)

**Confirmed.**
- Hard block 1: `git status --porcelain "context/changes/<change-id>/"`, any output blocks (`:64-73`). It covers the whole folder, and untracked files appear in porcelain output.
- Hard block 2: `git diff --cached --quiet`, non-zero blocks, repo-wide (`:80-94`). Both blocks stop before the warning prompt (`:96`).
- `git mv "context/changes/<id>" "$DEST"` with `DEST=context/archive/<created>-<id>` (`:154-155`, `:167`). The `change.md` stamp (`status: archived`, `archived_at`, `updated`) is written before the move and re-staged after it (`:160-165`, `:171`).
- Commit subject `chore(archive): close <change-id>`, no body, no `--no-verify` (`:197-206`). It never pushes (`:239`).
- Warnings are collected, printed, then asked once through `AskUserQuestion` with `Continue archiving`, `Resume implementation`, `Cancel` (`:100-143`). Without a native question tool the skill asks in plain text and waits (`:132`).
- The repoint prompt (`Update and archive / Archive without repointing / Cancel`) replaces the ordinary prompt when a verified mapping exists, and needs explicit approval (`:128`).

**Corrections and additions to the accepted design.**
1. **Which answers apply when.** The warnings prompt is probable in a pipeline run: `10x-goal-implement` never flips Manual rows (`10x-goal-implement/SKILL.md:239`), so a plan with Manual rows triggers the pending-Progress warning (`10x-archive/SKILL.md:105-107`). Other warnings: status not in `{implemented, impl_reviewed}` (`:104`), missing review coverage (`:110`), Progress rows without SHA (`:111`).
2. **The repoint prompt needs a merged implementation PR and network access.** The SHA diagnosis resolves the PR base through `gh` or `git ls-remote` and fetches the target ref (`references/archive-sha.md:7-9`). It offers a mapping only when a squash-merge commit is proven (`:21-29`). A run on an unmerged branch ends in the ordinary prompt. So `Archive without repointing` is an answer for a rare case, and `Continue archiving` is the answer for the common one.
3. **Answers the unattended subagent must give.** The prompt must state these explicitly, because the suffix default ("recommended or most conservative", `policy.json:53`) would pick `Cancel` and leave the folder unchanged:
   - warnings prompt: `Continue archiving` (never `Resume implementation`, never `Cancel`);
   - repoint prompt: `Archive without repointing` (never `Update and archive`, because it edits `plan.md`; `references/archive-sha.md:31-35`);
   - any other question: stop and report `blocked`.
4. **A plain-text question ends a subagent turn.** The skill falls back to plain text and "waits" (`:132`). A subagent that asks in text ends its turn with no `RESULT:` line, and the orchestrator records `unknown`. The prompt must say "never ask in text".
5. **The roadmap close edits and stages a second file.** If `context/foundation/roadmap.md` has an item whose `Change ID` equals the id, the skill edits it and stages it into the archive commit, unless the file was dirty beforehand (`:173-195`). Otherwise it prints a warning and leaves it in the working tree (`:194`). This repo's roadmap has no item with Change ID `archive-adapter` at the current commit (`context/foundation/roadmap.md:53`, `:187-189` name `archive-and-lessons`). The adapter should expect either outcome.
6. **No git is allowed.** Without git the skill prints a warning and moves with plain `mv`, with no commit (`:98`, `:168`). The adapter's own commit is git-only, so `--archive` without git needs a rule (Open Question 5).

### 5. The commit scope is too narrow

The accepted design commits only `context/changes/<id>/agent-smith/` and then expects `git status --porcelain context/changes/<id>/` to be empty (`rigor-levels/research.md:379-380`). The toolkit steps in a pipeline run leave other files uncommitted in the same folder, so the re-check would fail:

- `10x-plan` does not commit its artifacts (`10x-plan/SKILL.md:504`).
- `10x-plan-review` writes `reviews/plan-review.md` and stamps `change.md` (`10x-plan-review/SKILL.md:258`), with no commit.
- The goal-implement epilogue stages exactly `plan.md` and `change.md` (`10x-goal-implement/SKILL.md:256-260`). A plan-review file written before it is not staged there.
- `10x-impl-review` writes `reviews/impl-review.md` and sets `status: impl_reviewed` (`10x-impl-review/SKILL.md:269-270`) with no commit. The prompt tells it "Do not commit unless the skill itself commits" (`policy.json:53`).
- `research.md` (and `frame.md` once `pre-plan-steps` exists) are likewise written without a commit.

Inference: at `done`, a typical run has an untracked `reviews/` directory and a modified `change.md`, so hard block 1 fires after the design's commit. Observed only by reading the skills; no run was executed.

Options for `/10x-plan` (Open Question 1): commit the whole change folder in one `chore(<id>): ...` commit (`git add context/changes/<id>`), or commit `agent-smith/` and halt with the list of other dirty paths so a human decides. The first keeps the flow unattended; the second keeps authorship cleaner.

### 6. `verify-archive` read-only guarantees

- Do not reuse `paths()`+`next()`/`init` code: both create directories (`:403`, `:493`). Use `fs.readdirSync("context/archive")` and `fs.readFileSync` only, plus `out()`.
- Match the archive directory with an anchored pattern, `^\d{4}-\d{2}-\d{2}-<id>$`. The skill itself finds archives by "name ends with `-<change-id>`" (`10x-archive/SKILL.md:54`), which also matches `2026-01-01-x-<id>`. A suffix match could report a wrong change as archived.
- Check three things: the archive directory exists, its `change.md` frontmatter has `status: archived` (`10x-archive/SKILL.md:161`), and `context/changes/<id>/` does not exist.
- The skill's partial-failure mode leaves `status: archived` in the old folder with the folder still in place (`:230`). `verify-archive` must report this as `not archived`, not infer success from the status line alone.
- It must not call `git`. The archive commit exists only in git history; checking it is optional and would need `git log`, which is read-only, but it adds the first read of git state to a command meant to be file-only. Left to Open Question 6.
- The id check (`:485`) and `loadPolicy()` (`:488`) run before dispatch and write nothing.

### 7. What `rigor-levels` will change that this change depends on (not yet in code)

All items below are planned in `context/changes/rigor-levels/change.md` and its research. None exists in `route.mjs`, `policy.json` or `SKILL.md` at 6f91965.

| Planned in `rigor-levels` | Source | Why it matters here |
| --- | --- | --- |
| Skip entries in `run.jsonl` (`skipped: true`, reason, no `result`), with budget, numbering, `trailingFailures`, freshness and report totals kept correct | `change.md` Scope; `rigor-levels/research.md:335-349` | The archive flow reads the log only to write it out and commit it. The dependency is textual: both edit `next()`, `buildReport` and the log helpers. A skipped plan-review must not break the `done` condition the adapter hooks into. |
| `endRun` and `buildReport` changes (skip section, totals) | `change.md` ("touches `endRun`"); `:348` | The adapter splits `endRun` and adds an "archive: pending" line. Same functions, so the changes must be sequenced. |
| `--rigor` flag and `meta.json` persistence across `init` | `change.md` Scope; `:90-93`, `:504` | `--archive` needs the same persistence. The mechanism is built there, and the adapter should reuse it, not add a second one. |
| `signals` sanitizer, rigor-scaled step budget, churn risk (adds `node:child_process`) | `:86`, `:94`, `:323`, `:504` | Not needed for archive. The `child_process` import arrives with the churn code. |
| Effort floor for interactive skills | `:435-441` | The archive step is interactive by design (2 `AskUserQuestion` mentions, `rigor-levels/research.md:303`). Its floor of tier 3 applies here. |
| ADR-003 skeleton and the GIVEN/WHEN/THEN rule format | `change.md` Scope; `:293-299` | `docs/ADR/` holds only ADR-001 and ADR-002 today. This change adds a section to ADR-003 for the first git write and FR-008. |

## Code References

- `skills/10x-pipeline/scripts/route.mjs:12-14` - imports: `fs`, `path`, `url` only
- `skills/10x-pipeline/scripts/route.mjs:19-22` - `out()` exits the process
- `skills/10x-pipeline/scripts/route.mjs:24-33` - `parseFlags`, generic `--flag`
- `skills/10x-pipeline/scripts/route.mjs:143-186` - `buildReport`, `writeReport`, `endRun`
- `skills/10x-pipeline/scripts/route.mjs:201-226` - `attachResult` reads and deletes `last-result.json`
- `skills/10x-pipeline/scripts/route.mjs:273-275` - missing `change.md` halt
- `skills/10x-pipeline/scripts/route.mjs:352-356` - `done` decision
- `skills/10x-pipeline/scripts/route.mjs:401-461` - `next()`, including `mkdirSync` at `:403` and the `run` output at `:451-460`
- `skills/10x-pipeline/scripts/route.mjs:463-480` - `status`, read-only without `--report`
- `skills/10x-pipeline/scripts/route.mjs:484-505` - id check, dispatch, `init` rewrite of `meta.json` at `:497`
- `skills/10x-pipeline/SKILL.md:36-43` - loop actions; `:40` writes `resultFile`; `:42` runs `status` at `done`
- `skills/10x-pipeline/policy.json:11-17`, `:45`, `:52-60` - steps, `fixOnNeedsAttention`, prompts and suffix
- `~/.claude/skills/10x-archive/SKILL.md:64-96` - hard blocks; `:100-149` - warnings and prompts; `:154-206` - move, stamp, roadmap, commit
- `~/.claude/skills/10x-archive/references/archive-sha.md:7-9`, `:21-35` - integration target, mapping, applying an approved mapping

## Architecture Insights

- Routing stays data plus one decision function. The archive step is a `policy.steps.archive` entry (pinned tier) plus a prompt template. Only the `done` branch of `next()` and the new `verify-archive` command need code.
- The disk is the source of truth (ADR-001, ADR-002 decision 4). The archive step cannot be verified by `last-result.json` or an mtime in the folder that moves. Its only artifact is the moved folder, which is why verification is a separate read-only command run by the orchestrator after the Agent call.
- The adapter is an exception to "each step logs a result". The `archive` action produces no log entry, no usage figure and no report row. The report's totals therefore cover the steps before archive only.

## Historical Context (from prior changes)

- `context/changes/rigor-levels/research.md:43-47` - the original finding that archive has two hard blocks and moves the run state out of reach (supported by the code read here).
- `context/archive/2026-10-30-per-step-usage-report/plan.md:12`, `:98` - "before archive" means "when the run ends", and every end branch goes through `endRun` (as cited at `rigor-levels/research.md:248-249`). The new `archive` action must not bypass that.
- `context/foundation/roadmap.md:106` - resolved: the router writes `agent-smith/report.md` when a run ends.
- `context/foundation/roadmap.md:187-197` - S-09 (here still named `archive-and-lessons`, with lesson candidates in the same slice). The split into `archive-adapter` and `lesson-candidates` is committed on branch `split-archive-adapter` only (not on this branch's base).

## Related Research

- `context/changes/rigor-levels/research.md` - the accepted design; read-only reference.

## Open Questions

1. **Commit scope.** Commit the whole change folder, or `agent-smith/` plus a halt that lists the other dirty paths? The accepted design says the second, and cannot succeed for a typical run (section 5). A third option is to require the human to commit before the run, which defeats the unattended purpose.
2. **Commit message and attribution.** The design gives `chore(<id>): agent-smith run state` (`rigor-levels/research.md:379`). AGENTS.md asks for Conventional Commits. Whether the router adds co-author trailers is undecided.
3. **Git state beyond staged files.** The design checks only the index. A detached HEAD, a mid-rebase or mid-merge state, a protected current branch, or a failing pre-commit hook would make the commit fail or land on the wrong branch. Proposed rule for the plan: any `git` failure is a `halt` with the git message and no archive.
4. **Run not `done`.** `--archive` only acts at the `done` branch. After a `halt` (budget, repeated failures, revisions, fix loops) nothing is committed and no archive is offered, so `agent-smith/` stays untracked and a later human `/10x-archive` hits hard block 1 (`10x-archive/SKILL.md:67`). Should a halt print a one-line hint with the commit command? The plan decides; no code path for it exists.
5. **Repo without git, or `agent-smith/` in `.gitignore`.** The skill tolerates no git (`:98`). `git add` of an ignored path fails. Proposed rule: `--archive` halts at init when the directory is not a git work tree, and `git check-ignore` on `agent-smith/` is checked before `git add`. Whether `git mv` carries an ignored `agent-smith/` along was not tested.
6. **`verify-archive` scope.** File checks only, or also `git log -1 --format=%s` for `chore(archive): close <id>`? The second adds a git read to a command designed as file-only.
7. **Re-entry after archive.** `next` and `init` on an archived change recreate the old folder (section 2). Add a guard before `mkdirSync` that refuses with a JSON `halt` when `context/archive/<date>-<id>/` exists? Needed to keep "nothing writes after the move".
8. **Second `done` with the same state.** A resumed `done` rewrites `meta.json` and `report.md`. The commit can then be empty. The plan needs "skip the commit when `git diff --cached --quiet` passes after `git add`", the same guard as the goal-implement epilogue (`10x-goal-implement/SKILL.md:258`).
9. **Archive step and the usage report.** Without a result file, the archive subagent's token figures are lost. Accept, or record them in the orchestrator's final message only?
10. **Roadmap interplay.** The skill closes a roadmap item and stages it only when `roadmap.md` was clean (`10x-archive/SKILL.md:194`). Whether the adapter should warn about a dirty `roadmap.md` before archive is unspecified.

---

## Owner decisions (2026-10-30)

- **Open Question 1 resolved: option A.** The router commits the whole `context/changes/<id>/` folder in one Conventional Commit before archive (`git add context/changes/<id>`), so `/10x-archive` hard block 1 clears on a normal run. Questions 2-10 stay open for `/10x-plan`.
