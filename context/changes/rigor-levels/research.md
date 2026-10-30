---
date: 2026-10-30T22:01:19+0100
researcher: Claude (Opus 5.5) for Błażej Ksycki
git_commit: aa8aa30828462c00c5a6f4a08d7730fc757703b7
branch: main
repository: agent-smith
topic: "Rigor-gated routing of optional lifecycle steps in the 10x pipeline: router extension points, toolkit skill interfaces, prior constraints"
tags: [research, router, route.mjs, policy.json, 10x-frame, 10x-research, 10x-archive, 10x-tdd, 10x-e2e, 10x-lesson, rigor, risk]
status: complete
last_updated: 2026-10-30
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Follow-up 3: renamed to rigor-levels, three sibling changes created"
---

# Research: Rigor-gated routing of optional lifecycle steps

**Date**: 2026-10-30T22:01:19+0100
**Researcher**: Claude (Opus 5.5) for Błażej Ksycki
**Git Commit**: aa8aa30 (working tree has only the untracked `context/changes/rigor-gated-routing/`)
**Branch**: main
**Repository**: agent-smith

## Research Question

`change.md` (`context/changes/rigor-gated-routing/change.md:12`) asks for nine things: a per-change rigor level, policy step gates, a RESULT `signals` object, per-phase executor routing, backward loops, a pinned frame step with a needsHuman halt, lesson candidates in `report.md`, logging of skipped steps, and ADR-003 plus doc sync. The research answers three questions for `/10x-plan`:

1. Where in `route.mjs` and `policy.json` does each part attach, and what does the current code assume that the change breaks?
2. What do the toolkit skills it would call (`10x-research`, legacy research prompts, `m4l5-2`/`m4l5-3`, `10x-frame`, `10x-tdd`, `10x-e2e`, `10x-goal-implement`, `10x-archive`, `10x-lesson`) take, write and ask? Can each one run unattended?
3. Which earlier decisions (PRD, roadmap, ADRs, archived changes) constrain or conflict with the change?

## Summary

- **Every new step needs four router hooks.** It needs a branch in `decide()`, an entry in `policy.steps`, a verification case in `attachResult()` and a prompt template. Today `decide()` is a linear chain with no skip path. Plan-review and impl-review always run when their file is stale (`route.mjs:294`, `route.mjs:327-334`). Without a verification case, an unknown step falls into `default: verified = true` (`route.mjs:218`).
- **Rigor cannot live in `meta.json` without an `init` change.** `init` rewrites `meta.json` to `{ id, goal }` (`route.mjs:497`). That would drop a stored rigor level on every resume and break "rigor only rises".
- **Only `10x-goal-implement` and `10x-research` are built for unattended use.**
  - `10x-goal-implement` says "Never invoke interactive question tools" (`~/.claude/skills/10x-goal-implement/SKILL.md:58`).
  - `10x-research` asks only on material ambiguity (`~/.claude/skills/10x-research/SKILL.md:48-54`).
  - `10x-frame` has no unattended mode, and its Step 1.5 "always runs" with AskUserQuestion (`~/.claude/skills/10x-frame/SKILL.md:102-104`).
  - `10x-tdd` and `10x-e2e` have AskUserQuestion pauses at phase gates, commits and between phases.
  - `10x-lesson` says "Pre-fill nothing. The user provides every field." (`~/.claude/skills/10x-lesson/SKILL.md:43`).
- **No executor can be scoped to one phase.** In all four executors `phase N` is a start point; each continues to later phases (`10x-goal-implement/SKILL.md:233`, `10x-implement/SKILL.md:342`, `10x-tdd/SKILL.md:276-293`, `10x-e2e/SKILL.md:313-334`). Per-phase routing must rely on a prompt instruction to stop after phase N. `plan.md` carries no executor hint. The only signal is the Automated row text (`~/.claude/skills/10x-plan/references/plan-templates.md:128-147`).
- **The `implement` success check can be fooled by tdd/e2e skips.** The check counts new `[x]` Automated rows (`route.mjs:217`). The tdd "Skip" option flips rows with no commit and no SHA (`10x-tdd/SKILL.md:178`, `:195`). e2e flips rows for an already-existing test and on "Skip", also without a commit (`10x-e2e/SKILL.md:171`, `:223`).
- **`/10x-archive` has two hard blocks and moves the run state out of reach.**
  - Block 1: any `git status --porcelain` output for the change folder, which includes an untracked `agent-smith/` (`10x-archive/SKILL.md:67`).
  - Block 2: any staged change repo-wide (`:83`).
  - It then `git mv`s the folder, `agent-smith/` included, into `context/archive/` (`:167-168`). After that, `route.mjs` cannot find `change.md` (`route.mjs:273-275`), and `endRun` would write `report.md` to a path that no longer exists or recreate the old folder.
  - Warnings trigger an AskUserQuestion (`:134-147`). A SHA repoint needs "Explicit approval" (`:128`).
- **Lesson candidates have no source to parse.** The impl-review template has no lesson or recurring-pattern section. The only lesson hook is the interactive triage option "Record as lesson" (`10x-impl-review/SKILL.md:389-422`). Candidates must come from the new RESULT `signals` object or from a router prompt instruction.
- **Prior decisions in the repo conflict with parts of the change:**
  - FR-002 allows skipping plan-review "only on a clean rubric" (`context/foundation/prd.md:89`).
  - FR-010 always runs both reviews for elevated risk (`prd.md:108`).
  - Roadmap slice S-04 (plan-review skip) is `blocked` on Q12, "What counts as a 'clean' plan" (`context/foundation/roadmap.md:47`, `:184`).
  - The archived drop-size-flag plan made "no reading of `change.md`, `research.md` or `frame.md` for routing" a non-goal (`context/archive/2026-10-30-drop-size-flag/plan.md:37`). This change reads `frame.md`.
  - AGENTS.md forbids naming models in `SKILL.md` beyond what it already documents. That collides with documenting "frame pinned to opus/high" there.
- **No measured run data exists to size budgets.** The only real-run evidence file was archived unfilled (`context/archive/2026-10-30-per-step-usage-report/real-run-evidence.md:9-17`; `roadmap.md:176`).

## Detailed Findings

### 1. Router: where each part attaches (`skills/10x-pipeline/scripts/route.mjs`, `policy.json`)

**Decision chain.** `decide()` (`route.mjs:265-357`) checks, in order:
1. no `change.md` → halt (`:273-275`)
2. no plan or no `## Progress` → `plan` (`:276-286`)
3. stale plan-review → `plan-review` (`:289-294`)
4. RETHINK, or REVISE over tolerance, with `autoDone === 0` → `plan-revise` (`:296-309`)
5. pending Automated rows → `implement` (`:311-319`)
6. stale impl-review → `impl-review` (`:322-334`)
7. REJECTED, or NEEDS ATTENTION with criticals or `fixOnNeedsAttention` → `fix` (`:336-350`)
8. otherwise `done` (`:352-356`)

No branch returns a skip. Pre-plan steps (research, domain brief, frame) must sit before branch 2. Archive must sit at branch 8.

**Step registry.**
- `tierFor` reads `policy.steps[d.step]` (`route.mjs:374`). `next()` reads `policy.steps[d.step].skill` (`:439`).
- Each new step (research, frame, domain brief, archive, tdd, e2e) needs a `steps` entry (`policy.json:11-17`) and a `prompts` template (`policy.json:52-60`).
- The template is chosen with `d.template ?? d.step` (`route.mjs:432`) and rendered with `{id}`, `{goal}` and `{verdict}` only (`:433`). A failure note or phase number in a prompt needs new render variables.

**Verification.**
- `attachResult` verifies four step names by artifact: `plan`, `plan-review`, `impl-review` and `implement` (`route.mjs:213-217`).
- Any other step name hits `default: verified = true` (`:218`). Research (`research.md` mtime), frame (`frame.md` mtime plus Confidence), domain brief (`context/domain/02-*.md` or `03-*.md`) and archive (folder moved) each need their own case.
- The `implement` case compares `autoDone` with `last.before.autoDone` (`:217`, `:447`). Per the executor findings in section 3, this needs a SHA or new-commit check to catch skip flips.

**RESULT line and signals.**
- The RESULT contract is the `suffix` prompt (`policy.json:53`).
- `SKILL.md` parses the last `RESULT:` line and writes it to `resultFile` (`skills/10x-pipeline/SKILL.md:39-40`).
- `attachResult` stores the whole object as `last.result` (`route.mjs:220`), so a `signals` key already reaches `run.jsonl` unvalidated. Only `usage` is sanitized, by `cleanUsage` (`:191-199`, `:221-222`). That function is the existing pattern for a whitelist-and-type sanitizer for `signals`.
- `SKILL.md` step 3 falls back to `{"status":"unknown"}` when parsing fails (`SKILL.md:39`). A malformed `signals` value inside valid JSON passes through as-is today.

**Run state, meta and the rigor level.**
- `init` writes `{ id, goal }` (`route.mjs:497`), keeping only `goal` from the previous `meta.json` (`:494-496`). A `rigor` field would be lost on every `init` (resume).
- `next()` deletes only `meta.outcome` (`:426-429`).
- `parseFlags` already accepts `--rigor <value>` generically (`:24-33`), but only `init` reads flags (`:491-497`).

**Step budget.**
- `next()` halts when `log.length >= policy.limits.maxTotalSteps` (`route.mjs:408-409`). The default is 14 (`policy.json:48`).
- The budget is checked before `decide()`. A rigor-scaled budget needs the rigor level resolved before line 408.
- Skipped-step records counted in `log.length` would eat budget. They would also disturb `trailingFailures` (`:237-245`, which stops at the first different step), `lastIdx` (`:230-235`) and `count()` (`:271`).

**Report.**
- `buildReport` renders one table row per log entry (`route.mjs:148-152`) and the totals line `Steps: N · Tokens: …` (`:165`).
- Skipped steps that are not log entries need a separate section, or the row contract changes (see section 4).
- Every end-of-run path goes through `endRun` (`:177-186`). Exception: the missing-result halt in `attachResult` (`:204-206`) does not.

**Backward loops (current behavior to change).**
- RETHINK and REVISE both route to `plan-revise`, at `rethinkBump` +2 and `reviseBump` +1 (`route.mjs:302-308`; `policy.json:35-36`). Revisions are counted by `template === "plan-revise"` and capped by `maxPlanRevisions` 2 (`route.mjs:300-301`; `policy.json:49`).
- The re-plan branch only fires when `plan.autoDone === 0` (`route.mjs:299`). An impl-review REJECTED that re-plans after code exists does not satisfy that guard.
- Implement failures: `next()` halts when `trailingFailures >= maxAttemptsPerStep`, which is 3 (`route.mjs:421-423`; `policy.json:34`). This check runs after `decide()` has already chosen `implement`. "Third implement attempt re-plans" therefore needs a failure-count check inside `decide()`, plus a re-plan template that carries the last `result.note`.
- REJECTED routes to `fix` at the last code tier +1 (`route.mjs:336-349`).

**Pinning frame.**
- Ladder index 4 is `{ "model": "opus", "effort": "high" }` (`policy.json:7`).
- `tierFor` clamps to `[minTier, maxTier]` (`route.mjs:392`). A frame entry with `baseTier`, `minTier` and `maxTier` all at 4 pins it through data alone, with no code path.

**No git access today.**
- `route.mjs` imports only `node:fs`, `node:path` and `node:url` (`route.mjs:12-14`).
- Risk path rules on the diff, and the commit of `agent-smith/` before archive, need `node:child_process`. That is a `node:` built-in, which AGENTS.md permits ("uses only `node:` built-ins").

### 2. Pre-plan step interfaces

**`/10x-research`** (`~/.claude/skills/10x-research/SKILL.md`)
- Args: `<change-id>`. It reads the change's "request/change/frame artifacts" (`:27-30`).
- Writes `context/changes/<id>/research.md` with frontmatter `status: complete | partial` (`:104-105`; `references/research-document.md:4-5`).
- Moves `change.md` from `new` to `preparing` through `metadata-guard.mjs mark-researched` (`:140-141`).
- Unattended: viable. "An unambiguous research request needs no interview" (`:53-54`).

**Legacy research prompts** (`~/.claude/prompts/m4l3-*`, `m4l4-*`)
- These are not slash commands, and `~/.claude/commands` does not exist. The course uses them by @-mention (`10xdevs4-content/en/m1/m1l2-…md:319`). The router would have to read the file text and pass it as the prompt.
- They live in the user's `~/.claude/prompts`, outside this plugin and outside the target project. The router has no defined path to them.
- `m4l3-1` hardcodes change-id `post-flow-analysis` and reads `context/map/repo-map.md` (`m4l3-1-research-with-map.md:1`, `:22`).
- `m4l4-2` and `m4l4-3` hardcode `refactor-opportunities` (`m4l4-2…md:1-4`; `m4l4-3…md:13-15`).
- `m4l3-2` and `m4l4-3` need `ast-grep`. Inference: the prompts assume it is installed but do not check.
- `m4l4-2` is explicitly non-interactive. It says, in Polish, "do not ask me to choose, confirm or approve" (`m4l4-2…md:22`).
- The legacy signal is the existence of `context/map/repo-map.md`. Its frontmatter has `artifact: repo-map` (`~/.claude/skills/10x-repo-map/references/report.md:73`).

**Domain brief prompts `m4l5-2` / `m4l5-3`** (`~/.claude/prompts/`)
- Inputs: `prd.md`, `tech-stack.md` and the README "if they exist" (`m4l5-2…md:4-5`; `m4l5-3…md:4-7`). Neither reads `domain-distillation.md` or `glossary.md`.
- Outputs: `context/domain/02-invariant-aggregate-refactor.md` and `context/domain/03-anti-corruption-layer.md`, both with frontmatter `type: refactor-plan` (`m4l5-2…md:51-55`; `m4l5-3…md:49-53`). Both are non-interactive.
- These outputs are project-level paths, not change-level ones. A second change would overwrite them.
- Signals:
  - Aggregate refactor: `context/domain/domain-distillation.md` has an "Invariants and policies" table with a status column. Values are `enforced`, `declared`, `ignored`, `contradicted` and `undocumented` (`~/.claude/skills/10x-domain-distillation/references/report.md:24-35`, `:158`).
  - The `m4l5-1` prompt writes `context/domain/01-domain-distillation.md` instead (`m4l5-1…md:56-62`), so both paths need checking.
  - Anti-corruption layer: no structured signal exists in any artifact inspected.

**`/10x-frame`** (`~/.claude/skills/10x-frame/SKILL.md`)
- Args: `<change-id>`, which resolves to that change's `research.md` and reads it if present (`:54`). The skill also reads `lessons.md` if present (`:77`).
- Writes `context/changes/<id>/frame.md` (`:196`) from the template at `:200-277`. It creates the folder and `change.md` if missing. It moves `new` to `preparing` with a direct edit, not through a guard script (`:190-194`).
- Parseable output: the `## Confidence` section with HIGH, MEDIUM or LOW (`:258-265`). The template lists all three labels plus "[Pick one…]", so a parser must find the chosen label, not the first match. On LOW the brief lists "the specific verification step needed before /10x-plan" (`:265`).
- Ask points:
  - Step 1: echo and confirm in text (`:85-96`).
  - Step 1.5: AskUserQuestion, "always runs" (`:102-106`).
  - Step 4: narrowing AskUserQuestion, skippable on conclusive evidence (`:157-171`).
  - Step 7: next-step question, then `pbcopy` (`:301-318`).
- No unattended flag or default option exists. The change's "decision guide" must override all four ask points through the prompt alone. PRD guardrail: toolkit skills are not changed (`prd.md:59`).
- `/10x-plan-review` never recommends frame on RETHINK; the word does not appear in the skill (`10x-plan-review/SKILL.md:136-138`). RETHINK → frame comes from ADR-002 diagram 6 (`docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md:298`).
- No pre-frame "framing doubt" signal exists. Two candidates:
  - The skill's own trigger words: "fix", "bug", "broken", "root cause", "should we even", "rethink" (`10x-frame/SKILL.md:7-9`).
  - `/10x-new` suggests `/10x-frame` for bug-shaped intent or "rethink" (`10x-new/SKILL.md:111`).

### 3. Executor interfaces (per-phase routing)

| Executor | Unattended | Out-of-scope phase | Commit / epilogue |
|---|---|---|---|
| `10x-goal-implement` | Yes (`SKILL.md:58`) | No fit gate. A Structural mismatch or a gate failing 3 times prints `STOPPED — … in Phase <N>` and halts (`:86-90`, `:164-169`) | `<type>(<id>): <title> (p<N>)` (`:211`); SHA write-back (`:229`, `:247`); epilogue sets `status: implemented` (`:255-259`) |
| `10x-implement` | No: 8 ask points, from the mode question (`:68-79`) to the review offer (`:448`) | n/a | Same formats (`:282`, `:316-317`, `:420-427`) |
| `10x-tdd` | No: manual pause "Do not proceed until they confirm" (`:241`), commit approval (`:264`), next phase (`:276`) | Code already exists → STOP with `→ /10x-implement` (`:119-133`). Not TDD-able → AskUserQuestion: Hand off, Implement inline or Skip (`:169-195`). No test runner → STOP (`:84-94`) | `test`/`feat` subject (`:264`); epilogue (`:313-315`) |
| `10x-e2e` | No: ask points at `:125`, `:278`, `:301`, `:313` | No Playwright config or seed → STOP (`:96-109`). Feature not built → STOP (`:155-167`). Not browser-level → question (`:193-210`) | `test(<id>): …` (`:301`); epilogue, or partial with `chore(<id>): progress` (`:352-379`) |

- **Phase scoping:** see the Summary. `phase N` is a start point in all four.
- **TDD fit:** a phase is TDD-able when "there is an observable outcome you can assert before the code exists" (`10x-tdd/SKILL.md:139`).
  - Fits: pure functions, parsers, validators, state machines, contracts, business logic, bug fixes.
  - Excluded: scaffolding, config, CI, visual polish, spikes, docs (`:143-148`).
  - It also needs an existing test runner (`:36`, `:84`).
- **E2E setup signal:** `context/foundation/test-stack.md` has a `## E2E` section with required fields, including `config` and `seed` (`10x-e2e-setup/references/test-stack-e2e-schema.md:37-71`). `/10x-e2e` treats the section as stale when it points to missing files (`10x-e2e/SKILL.md:94-96`). A cheap router check: the section exists, and both the `config` and `seed` paths exist on disk.
- **plan.md has no executor tag.** Progress rows are copied word for word from Success Criteria (`10x-plan/SKILL.md:423`, `:568`). Progress allows no prose (`10x-plan/references/progress-format.md:72`). Keyword matching on row text, e.g. `npx playwright test` (`plan-templates.md:73-79`), is the only available per-phase signal.
- **Fallback detection:** a blocked tdd or e2e run shows up as RESULT `status` `blocked`, with redirect strings such as "isn't test-first material" or "needs the Playwright infrastructure". The current verification cannot tell a skip flip from real work (see the Summary).
- **Spawn depth:** `10x-goal-implement` spawns one `Task` subagent per phase (`10x-goal-implement/SKILL.md:98-103`). That matches the README requirement of depth ≥ 3 (`README.md`, Limits). tdd and e2e were not found to spawn subagents (inference from the same read; not exhaustively checked).

### 4. Close and learning steps

**`/10x-archive`** (`~/.claude/skills/10x-archive/SKILL.md`)
- Arg: `<change-id-or-path>` (`:4`).
- Hard blocks (`:60-96`): non-empty `git status --porcelain "context/changes/<id>/"`, untracked files included (`:67-73`), and `git diff --cached --quiet` non-zero repo-wide (`:83`).
- Soft warnings trigger AskUserQuestion with Continue, Resume or Cancel (`:100-147`). Examples: status not `implemented`/`impl_reviewed`, pending Progress rows, `[x]` without SHA.
- A SHA repoint needs explicit approval (`:128`). For an unattended run, the conservative pick is "Archive without repointing". That is an inference; the skill does not name an unattended default.
- It does `git mv` (`:167-168`), a best-effort roadmap update (`:173-195`) and commits `chore(archive): close <change-id>` (`:201-206`).
- Consequences for the router:
  1. `agent-smith/` must be committed, and the index left clean, before archive runs.
  2. `report.md` must be final and committed before archive, because the folder then moves to `context/archive/`. AGENTS.md: "Never edit `context/archive/`."
  3. Archive can only be the last step. Any later `next` would halt on the missing `change.md` (`route.mjs:273-275`), and a later `endRun` would write to the old path.
  4. The archive verification case must check that the folder moved, not just a file mtime.

**`/10x-lesson`** (`~/.claude/skills/10x-lesson/SKILL.md`)
- Interactive by design: a four-field AskUserQuestion interview (`:41-50`) and an Append, Edit or Cancel confirm (`:56-65`).
- Inline text is only "a seed for the Rule field" (`:22`).
- Human command shape: `/10x-lesson <rule seed text>` (`:22`).
- Entry format: `## <Rule title>`, then Context, Problem, Rule and Applies to, where Applies to is `frame|research|plan|plan-review|implement|impl-review|all` (`:69-76`).
- This supports change item (7): `report.md` can hold a ready `/10x-lesson <seed>` line and never run the skill.

**`/10x-impl-review`** (`~/.claude/skills/10x-impl-review/SKILL.md`)
- Header lines: `**Verdict**: [APPROVED/NEEDS ATTENTION/REJECTED]` and `**Findings**: [N critical] [N warnings] [N observations]` (`:281-282`). These match `readReview` (`route.mjs:93-99`).
- Findings are `### F<n> — <title>` (`:297-309`). There is no lesson-candidate section.
- Proceed option `Done` = "print the saved report path and STOP" (`:351-362`). The report and `status: impl_reviewed` are written before that question (`:267-270`). This matches the current prompt's "save and stop" (`policy.json:58`).

## Code References

- `skills/10x-pipeline/scripts/route.mjs:201-226` — `attachResult`: result intake, verification switch, `default: verified = true` at `:218`
- `skills/10x-pipeline/scripts/route.mjs:265-357` — `decide`: linear step chain, no skip branch
- `skills/10x-pipeline/scripts/route.mjs:296-309` — RETHINK/REVISE → `plan-revise`, guarded by `autoDone === 0`
- `skills/10x-pipeline/scripts/route.mjs:336-350` — REJECTED/NEEDS ATTENTION → `fix`
- `skills/10x-pipeline/scripts/route.mjs:373-395` — `tierFor`: clamp at `:392` allows pinning by data
- `skills/10x-pipeline/scripts/route.mjs:408-423` — budget halt before `decide`; repeated-failure halt after `tierFor`
- `skills/10x-pipeline/scripts/route.mjs:432-434` — template choice and render variables `{id}`, `{goal}`, `{verdict}`
- `skills/10x-pipeline/scripts/route.mjs:491-497` — `init` rewrites `meta.json` to `{ id, goal }`
- `skills/10x-pipeline/scripts/route.mjs:143-186` — report builder and `endRun`
- `skills/10x-pipeline/policy.json:7` — ladder index 4 = opus/high
- `skills/10x-pipeline/policy.json:11-17`, `:47-51`, `:52-60` — steps, limits, prompts
- `skills/10x-pipeline/SKILL.md:39-40` — RESULT parsing and `resultFile` write
- `skills/10x-pipeline/SKILL.md:60-70` — "How the tier moves" (must be updated with tier logic, per AGENTS.md)

## Architecture Insights

- Routing is data plus one decision function. The change can add steps as `policy.steps` and `prompts` entries. Gates and predicates need code in `decide()`. AGENTS.md: routing decisions stay in `route.mjs` and `policy.json`.
- Disk artifacts are the source of truth (ADR-001, ADR-002 decision 4). Every new step needs an artifact-based verification. Otherwise the default `verified = true` path accepts a step that did nothing.
- Only `10x-goal-implement` and `10x-research` were designed for unattended runs. The other skills the change adds rely on the generic suffix "choose the recommended or most conservative option" (`policy.json:53`) and on any prompt overrides. Their real unattended behavior has not been observed in this repo.
- Project-level artifacts (`context/map/`, `context/domain/`, `context/foundation/test-stack.md`) act as cheap existence signals. Reading them for routing stays within ADR-001 Phase 1 (deterministic, no LLM).

## Historical Context (from prior changes)

- **PRD**
  - FR-002 skips plan-review "only on a clean rubric" (`context/foundation/prd.md:89`).
  - FR-010: elevated risk from configurable path rules "always runs plan-review and implementation review and halts for a human at the highest level". It constrains FR-002 (`prd.md:108`).
  - Open Question 11 (which path rules and levels define elevated risk) is unresolved (`prd.md:150`).
  - Guardrail: toolkit skills are not changed (`prd.md:59`).
  - FR-008: git handling of `agent-smith/` "is decided downstream" (`prd.md:101`). The archive commit makes that decision.
- **Roadmap**
  - No slice has Change ID `rigor-gated-routing`, and milestone M-1 is open (`roadmap.md:12`).
  - Inference: the change overlaps S-03 `risk-gated-review` (`proposed`, `roadmap.md:46`, `:106-118`) and S-04 `plan-review-skip-on-clean-plan` (`blocked`, `:47`, `:129`).
  - S-03 "must exist before any review is skipped (S-04)" (`:117`).
  - S-04 blocks on Q12, "What counts as a 'clean' plan in Phase 1?" (`:184`).
- **Archived drop-size-flag**
  - Made "no reading of `change.md`, `research.md` or `frame.md` for routing" a non-goal (`context/archive/2026-10-30-drop-size-flag/plan.md:37`). This change reverses it for `frame.md` and `research.md`.
  - Its plan-review required relative tier deltas in `SKILL.md`, with "no absolute tier numbers and no model names" (`context/archive/2026-10-30-drop-size-flag/reviews/plan-review.md:36`).
- **Archived cheaper-routing-simple-change**
  - Built the plan-review discount under "no skipping of plan-review (S-04)" (`context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:32`).
  - The discount is withheld after any failed step (`…/reviews/impl-review.md:30`).
- **Archived per-step-usage-report**
  - Fixed the `report.md` layout and the "one table row per step" contract (`context/archive/2026-10-30-per-step-usage-report/plan.md:92`).
  - Required every end branch to go through `endRun` (`:98`). The `needsHuman` and second-RETHINK halts must too.
  - Noted that `/10x-archive` cannot be changed, so "before archive" means "when the run ends" (`:12`).
- **Recurring review findings** across the 3 archived changes. All 3 impl-reviews returned NEEDS ATTENTION.
  - Robustness: malformed overrides or state must yield a JSON `halt`, not a stack trace.
  - Docs drift: `SKILL.md`/README overstated rules.
  - Untested rule interplay.
- **Plan-review value:** it returned REVISE in 2 of 3 archived changes (`context/archive/2026-10-30-drop-size-flag/reviews/plan-review.md:7`; `context/archive/2026-10-30-per-step-usage-report/reviews/plan-review.md:7`). The third was SOUND with 1 warning. This is evidence against cheap plan-review skips.
- **Missing files:** neither `context/foundation/lessons.md` nor `context/foundation/agent-smith-policy.json` exists in this repo (checked 2026-10-30).

## Related Research

- `context/archive/2026-10-30-drop-size-flag/research.md` — goal-class rule research, the source of the routing non-goal above.

## Open Questions

These are product choices for `/10x-plan` or the user, not missing evidence.

1. **Plan-review at `lean`.** Skipping it conflicts with FR-002/FR-010 unless (a) a "clean" plan is defined (roadmap Q12, `roadmap.md:184`) and (b) risk paths force at least `standard`. The other option is to keep plan-review always on and let `lean` only lower its tier, as the change already does for impl-review.
2. **Risk path rules and levels.** These are PRD OQ-11. The change lists "risk paths" as a rigor input but no starter set exists. Diff access needs `node:child_process`.
3. **Persisting rigor.** One option is to keep it in `meta.json` and change `init` to preserve it. Another is to derive it from `run.jsonl` on each `next`. Either way, `--rigor` on resume must not lower it.
4. **Skipped-step records.** In `run.jsonl` they would count toward `maxTotalSteps` (`route.mjs:408`) and disturb `trailingFailures` and `lastIdx`. A separate field or file avoids that. `report.md` needs a new section either way, so the step-table contract stays as it is.
5. **Where legacy and domain prompts come from.** They live in the user's `~/.claude/prompts`, hardcode change-ids and are partly in Polish. Options: read them from a configurable path, or ship templated equivalents in `policy.json` prompts. The domain brief outputs are project-level (`context/domain/02-*`, `03-*`) and are overwritten per change.
6. **Frame unattended.** The prompt must override four ask points (Steps 1, 1.5, 4, 7). LOW Confidence in `frame.md` is the parseable trigger for `needsHuman`. Whether the RESULT signal or the file is authoritative when they disagree is unresolved.
7. **Executor fallback.** tdd and e2e need prompt overrides: stop after phase N, skip the manual pause, approve the commit, never choose "Skip". The `implement` verification needs a check for a new commit or SHA suffix so a skip flip does not count as success.
8. **Archive ordering.** The run order must be: final `report.md` → commit `agent-smith/` with a clean index → `/10x-archive` → no further router writes to the old path. The router's "done" output must come before archive, or the archive step must be the terminal step with no `endRun` write after it.
9. **Documentation rule clash.** "Frame pinned opus/high" cannot be named in `SKILL.md` (AGENTS.md hard rule, drop-size plan-review F-note). It belongs in `policy.json` and ADR-003.
10. **No calibration data.** Budget-per-rigor numbers have no measured basis (`real-run-evidence.md:9-17` unfilled).

---

## Follow-up 1 (2026-10-30): owner decisions and new findings

### Owner decisions

These supersede Open Questions 1, 2, 3 and 5. Q4 is in the list as decision 3, because the owner answered it.

1. **`lean` skips plan-review.** The rigor level is derived from risk paths, so FR-010 still holds: an elevated-risk change never runs at `lean`. FR-002 ("only on a clean rubric", `prd.md:89`) and roadmap Q12 (`roadmap.md:184`) are now answered by the owner's decision, not by a clean-plan definition. The plan should update FR-002 and S-04 to match.
2. **Risk paths = files that change very often, measured from git history.** See "Churn as risk signal" below.
3. **Skipped steps go into `run.jsonl`.** Every count must stay correct. See "Skip entries in `run.jsonl`" below.
4. **Legacy and domain prompts are copied from `../10xdevs4-content/.claude/prompts/`.** See "Prompt copy" below for two caveats.
5. **New rule for interactive skills:**
   **GIVEN** a toolkit skill designed to run interactively **WHEN** the pipeline runs it with no human to answer **THEN** the step **MUST** run at effort `high` or above **AND** the subagent **MUST** resolve each question the skill would ask from researched best practice, and cite its evidence.
6. **Manual Progress rows:** the pipeline tries to automate them. It uses Claude-in-Chrome when that is available and helps, for example to mimic a human.
7. **Archive:** run through an adapter. See "Archive adapter" below.

### Rule format

- **Source:** `../life-to-lore/docs/adr/ADR-012-prompt-rules-as-scenarios.md` and `../life-to-lore/CLAUDE.md:28`. No standalone RFC file exists in that repo; a search for `*rfc*` found only `node_modules` hits. ADR-012 is the document to copy.
- **Form:** one line `**GIVEN** <context> **WHEN** <trigger> **THEN** <behavior>`, all three parts required, with exactly one bold RFC 2119 keyword (`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`). `SHALL`, `REQUIRED`, `RECOMMENDED` and `OPTIONAL` are never used. `MUST` is reserved for hard limits; a style rule is `SHOULD` (`ADR-012:16`; `CLAUDE.md:28`).
- **Rule ids:** in life-to-lore each rule has an id in code only (`rule("<PROMPT>-<TOPIC>-<n>", text)`, `../life-to-lore/src/prompts/rules.ts:8-21`). A test checks form and keywords (`ADR-012:52`).
- **Gap:** agent-smith has no test setup (AGENTS.md, Testing), so nothing would check rule form. `node:test` is a built-in that runs on Node 18+ and adds no npm dependency, so it fits the AGENTS.md hard rule. That last point is an inference from the Node docs, not checked here.
- **Where rules apply in agent-smith:** prompt text in `policy.json` `prompts`, especially `suffix` (`policy.json:53`), plus the rules in ADR-003 and `SKILL.md`. Today these are prose.

### Interactive skills and the effort floor

`AskUserQuestion` mentions per `SKILL.md` (count of the string, `grep -c`): `10x-plan` 16, `10x-implement` 13, `10x-tdd` 9, `10x-impl-review` 4, `10x-frame` 4, `10x-lesson` 3, `10x-research` 2, `10x-archive` 2, `10x-plan-review` 1, `10x-goal-implement` 0. `10x-e2e` has 0 mentions but asks through "whichever interactive-question tool" (`10x-e2e/SKILL.md:125`).

On the ladder (`policy.json:2-10`), effort `high` or above means tier 3 or higher. Tier 3 is the lowest tier with effort `high`.

Today these steps can go below tier 3:
- `plan`: `minTier` 2 (`policy.json:12`)
- `plan-review`: `minTier` 1 (`:13`)
- `impl-review`: `minTier` 2 (`:15`)

**Conflict.** If the rule covers `10x-plan`, `10x-plan-review` and `10x-impl-review` (all three ask questions), their floor rises to 3. Three things then stop working:
- The simple-change discount on plan and plan-review: `discount` 1 (`policy.json:29`).
- The first-plan `-1` for a plain or short goal (`policy.json:24`).
- "`lean` only lowers the impl-review tier" (`change.md:12`): impl-review `baseTier` is already 3, so there is no room left to lower it.

This cuts against the PRD cost goal (FR-003, `prd.md:91`). Only `implement` (`10x-goal-implement`, 0 ask points) keeps its tier 2 floor.

**Unresolved:** whether "designed to run interactively" includes plan, plan-review and impl-review, or only the newly added skills: frame, tdd, e2e, archive, research and the prompts.

### Churn as risk signal

- **Cost:** one `git log --format= --name-only [--since=<window>]` call, counted per path, through `node:child_process`. No LLM is involved, which fits ADR-001 Phase 1.
- **When the router knows the touched paths:**
  - Plan-review is the first gate that the `lean` skip affects, and it runs after `plan.md` exists.
  - The plan template lists touched files as `**File**: \`path\`` under `#### N.` in "Changes Required" (`~/.claude/skills/10x-plan/references/plan-templates.md:59-63`). The router can match those paths against the churn list before it decides to skip plan-review.
  - After implement, `git diff --name-only <first-commit>^..HEAD` gives the actual paths. Rigor can rise again before impl-review.
- **Inference:** before the plan exists, the change touches no known paths, so churn cannot raise rigor for the research, frame and plan steps.
- **Sample (this repo, 31 commits, all time):**
  - `skills/10x-pipeline/scripts/route.mjs` 9 commits, `README.md` 6, `context/foundation/roadmap.md` 6, `skills/10x-pipeline/SKILL.md` 5, `policy.json` 4.
  - `context/changes/*/plan.md` and `change.md` reach 3-4 each.
  - **Inference:** without a path exclusion, the change's own `context/**` files would show up as hot. The churn count should leave out `context/**`, and probably docs, by policy pattern.
- **Unresolved, belongs in `policy.json`:** the window (`--since`), the threshold (an absolute count or a top-N/percentile), the exclusions, and which rigor level a hit raises to. No calibration data exists (Open Question 10 stands).

### Skip entries in `run.jsonl`

A skip entry is a log line with, for example, `skipped: true` and a `reason`, and no `result`. The current code mishandles one in these places:

| Spot | Current behavior | What breaks with a skip entry |
|---|---|---|
| `attachResult` (`route.mjs:202-206`) | The last entry has no `result` and no result file, so the router halts with "has no result" | The next `next` call halts right after a skip. Skip entries must be exempt. |
| Budget (`route.mjs:408`) | `log.length >= maxTotalSteps` | Skips use up budget. Count only executed entries. |
| Numbering (`route.mjs:436`) | `n: log.length + 1` | Skips take step numbers. They need a separate counter, or the report must show them distinctly. |
| `trailingFailures` (`route.mjs:237-245`) | Stops at the first entry of a different step | A skip entry between two failed `implement` runs resets the streak. Skip entries must be passed over. |
| `lastIdx(…, okOnly)` (`route.mjs:230-235`) and `prFresh` (`:289-294`) | Count only `ok` entries | A skipped plan-review never counts as fresh, so `decide()` routes to plan-review again. The freshness check must accept a skip. |
| `count(step)` (`route.mjs:271`) | Counts every entry with that name | Inflates `fix` counts if fix is ever skipped. |
| `simpleSignal` (`route.mjs:363`, `:369`) | `log.some((e) => e.ok === false)` | Safe as long as skip entries leave `ok` unset. |
| `buildReport` (`route.mjs:148-165`) | One table row per entry; `Steps: N` | The report contract is one table row per executed step (`per-step-usage-report/plan.md:92`). Skips need their own marking, and the `Steps` total must count executed steps only. |
| `status` (`route.mjs:466-472`) | Maps every entry | Needs a `skipped` field. |

### Prompt copy from `../10xdevs4-content`

- **Source:** `../10xdevs4-content/.claude/prompts/`. These files are byte-identical to `~/.claude/prompts/` (worker check with `cmp`).
- **Repo identity:** its README says "Lesson text of 10xDevs 4.0 (Przeprogramowani.pl)… Local copy for agent reading and search" (`../10xdevs4-content/README.md:1-3`).
- **No license file:** a search for `LICENSE*` outside `.git` found none.
- **Distribution risk:** agent-smith is published as a marketplace plugin (`README.md`, Install: `/plugin marketplace add xycu/agent-smith`). Copying course prompts into it redistributes them. Whether that is allowed is a question for the content owner, not something the code can decide.
- **The prompts need edits before reuse:**
  - They are in Polish (`m4l3-1…md:1`, `m4l5-2…md:1`).
  - `m4l3-1` hardcodes `post-flow-analysis` and the post-saving topic.
  - `m4l4-3` hardcodes `refactor-opportunities`.
  - `m4l3-2` uses `{change-id}`, while the router renders `{id}` (`route.mjs:398`).
  - `m4l4-2` mixes the two: it writes to change `refactor-opportunities` but reads `{change-id}`.
  - `m4l3-2` and `m4l4-3` call `ast-grep`, which may be missing in the target project.

### Archive adapter

The constraints come from `10x-archive/SKILL.md` (Detailed Findings, section 4) and `route.mjs`:
- A1: the change folder must be clean. This includes `agent-smith/` and the `last-result.json` file that would appear inside it (`:67`).
- A2: nothing may be staged repo-wide (`:83`).
- A3: warnings and the SHA repoint question need a scripted answer (`:128`, `:134-147`).
- A4: after `git mv`, the router has no change folder (`route.mjs:273-275`), and `context/archive/` is read-only (AGENTS.md).

A design that meets all four:

1. **Pre-archive, in `route.mjs` (no LLM).** When `decide()` reaches `done` and archive is opted in (`--archive`):
   - halt if `git diff --cached --quiet` fails (A2);
   - write the final `report.md`, with an "archive: pending" line;
   - set `meta.outcome`;
   - run `git add context/changes/<id>/agent-smith && git commit -m "chore(<id>): agent-smith run state" -- context/changes/<id>/agent-smith`;
   - re-check that `git status --porcelain context/changes/<id>/` is empty (A1);
   - return a new action, e.g. `archive`, with the prompt. It does not return `run`, so the orchestrator writes no `last-result.json` into the folder that is about to move.
2. **Archive subagent.**
   - The prompt runs `/10x-archive <id>` under the interactive-skill rule (effort `high` or above).
   - It answers warnings with `Continue archiving` and a repoint with `Archive without repointing` (A3).
   - The subagent's RESULT goes to the orchestrator only and is never written to disk.
3. **Read-only check.** A new subcommand, e.g. `route.mjs verify-archive <id>`, reads `context/archive/*-<id>/change.md` (`status: archived`) and confirms that `context/changes/<id>/` is gone. It prints JSON and writes nothing (A4).
4. **What the adapter does not do:**
   - It does not edit `/10x-archive`; the toolkit stays unchanged (`prd.md:59`).
   - It writes nothing after the move.
   - The archive outcome lives only in the orchestrator's final message and in the archive commit (`chore(archive): close <id>`, `10x-archive/SKILL.md:201-206`).

**Inference:** the router's first git write is the commit in step 1. FR-008 left git handling of `agent-smith/` to be decided later (`prd.md:101`), so this is that decision, and ADR-003 should record it.

### Manual-row automation

- **Current behavior:**
  - `10x-goal-implement` never flips Manual rows (`10x-goal-implement/SKILL.md:239`).
  - The router lists them in `manualPending` at `done` (`route.mjs:80`, `:355`).
  - ADR-002 says Manual rows "become human checklist" (`ADR-002:104`).
- **Manual rows in this repo's 3 archived plans** (all 10 rows; quoted from `context/archive/*/plan.md`):
  - Readability checks: "reads clearly as a table in a Markdown viewer".
  - Cross-file consistency checks: "`SKILL.md`, `README.md` and `route.mjs` describe the same rule".
  - Diff-scope checks.
  - One real run through the skill (3.6).
  - **Inference:** none of these needs a browser. Most are text checks an agent can do. A real run needs a nested Claude Code session.
- **Where Chrome helps:** UI rows in web-app target projects, for example life-to-lore with Playwright.
- **Claude-in-Chrome availability:**
  - The tools are deferred MCP tools (`mcp__claude-in-chrome__*`), loaded through ToolSearch.
  - Inference, not tested: a `general-purpose` subagent (tools `*`) can load them too.
  - `route.mjs` is a plain script and cannot see which tools exist. Only the orchestrator, following `SKILL.md`, can detect them and pass that to the router, e.g. `init --chrome`, or a capability field the router stores.
- **Risks:**
  - Browser dialogs block the extension.
  - The extension needs per-site permission.
  - An agent that ticks Manual rows certifies its own work. **Inference:** a flipped Manual row needs an evidence suffix (a command output, screenshot or GIF path) so that impl-review and the human can audit it. Rows that cannot be automated stay in `manualPending`.
- **Placement option:** a `manual-verify` step after the last `implement` and before `impl-review`, so the review sees the evidence. It should be verified by new `[x]` Manual rows carrying an evidence suffix.

### Remaining open questions after Follow-up 1

1. **Scope of the effort-floor rule.** Does it cover `10x-plan`, `10x-plan-review` and `10x-impl-review`? If it does, the simple-change discount and the first-plan `-1` stop working on those steps.
2. **Prompt redistribution.** Is copying `10xdevs4-content` prompts into a public plugin allowed? The repo has no license file. Should they be translated to English, and should hardcoded ids be templated to `{id}`?
3. **Churn parameters:** window, threshold, exclusions, and which rigor level a hot path sets.
4. **Frame authority:** when `frame.md` `## Confidence` and RESULT `signals.needsHuman` disagree, which wins? (Open Question 6 still stands.)
5. **Executor verification:** check for a new commit or SHA suffix so a tdd or e2e "Skip" does not count as done. (Open Question 7 still stands.)
6. **Rule checks:** add a `node:test` check for GIVEN/WHEN/THEN form in `policy.json` prompts, or keep rules unchecked?
7. **Size of this change:** 9 scope items plus the decisions above. It overlaps roadmap slices S-03 and S-04 and has no roadmap slice of its own (`roadmap.md:46-47`). Splitting it into several changes or slices is a planning choice.

---

## Follow-up 2 (2026-10-30): owner decisions, written prompts, proposals

This supersedes the "Remaining open questions after Follow-up 1": items 1, 2, 3, 4 and 7 are decided below, and 6 and 7 plus Open Questions 4 and 6 are closed. Item 5 (executor verification) remains open; it now sits with change 3 of the split.

### Decisions

1. **Effort floor covers `10x-plan`, `10x-plan-review` and `10x-impl-review` too.** At rigor `lean` the floor is effort `medium`. The rules:
   - **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `standard` or `thorough` **THEN** the router **MUST** pick a tier with effort `high` or above.
   - **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `lean` **THEN** the router **MUST** pick a tier with effort `medium` or above.
   - **GIVEN** a skill question the subagent cannot ask **WHEN** the skill would ask it **THEN** the subagent **MUST** decide from researched best practice (codebase conventions, project docs, `lessons.md`, authoritative sources) and cite the evidence.
   - **GIVEN** no evidence-backed call is possible **WHEN** the subagent would have to guess **THEN** it **MUST** report status `blocked` with `signals.needsHuman`.

   On the current ladder (`policy.json:2-10`) this means floor tier 3 at `standard`/`thorough` and floor tier 2 at `lean`. **Inference:** the floor depends on rigor, so it cannot stay a static `minTier` in `steps`. It needs a policy key, e.g. `rigor.<level>.minEffortTier` or an `interactive: true` flag per step, applied in `tierFor` before the clamp (`route.mjs:392`). The `lean` floor of 2 keeps the current discounts working at `lean`: plan base 4, minus 1 for a plain goal, minus 1 for the simple discount, gives 2. `lean` also skips plan-review, and impl-review can drop from base 3 to 2.
2. **Prompts copied, translated and rewritten.** Written to `skills/10x-pipeline/prompts/`: 6 prompt files plus a `README.md` with the source map and the adaptations. Processing order, as requested: translate to English, compress in caveman style, convert to rules, write.
   - All 85 rules have the form **GIVEN**…**WHEN**…**THEN** with exactly one bold RFC 2119 keyword and no stray capitalised keyword. Checked with a one-off Node script on 2026-10-30.
   - Adaptations, as listed in the prompts README:
     - Placeholders are `{id}` and `{goal}`, which match `render` (`route.mjs:397-399`).
     - The domain briefs write `context/changes/{id}/refactor-invariant-aggregate.md` and `refactor-anti-corruption-layer.md` instead of `context/domain/0N-*.md`.
     - When two candidates score close, the domain briefs prefer the one the goal touches.
     - The ast-grep prompts stop as `blocked` if `ast-grep` is missing.
   - **Not yet wired:** `route.mjs` does not read `prompts/`. The planned change must load these files, for example `policy.prompts.<name>` = `"@prompts/<file>.md"`, or by reading `SKILL_DIR/prompts`.
3. **Churn parameters:** see the proposal below.
4. **Skip entries:** make every count in the Follow-up 1 table work. This is settled; the plan owns the details.
5. **Archive adapter:** accepted as designed in Follow-up 1.
6. **Manual-row automation:** accepted as designed in Follow-up 1. It covers evidence suffixes, a `--chrome` capability passed by the orchestrator, and a `manual-verify` step before `impl-review`.
7. **Authority and rule checks:**
   - (a) The subagent's RESULT `signals.needsHuman` wins over the `frame.md` `## Confidence` value.
     - **GIVEN** RESULT `signals.needsHuman` and `frame.md` Confidence disagree **WHEN** the router decides after frame **THEN** it **MUST** follow `signals.needsHuman`.
   - (b) Add a `node:test` check (built into Node, no npm dependency) that every rule line in `policy.json` prompts and `skills/10x-pipeline/prompts/*.md` passes the same form check.
8. **Split into four changes.** See below.

### Churn proposal (risk paths)

Proposed `policy.json` keys:

```json
"risk": {
  "churn": {
    "since": "90.days",
    "maxCommits": 500,
    "minCommitsInWindow": 10,
    "exclude": ["context/**", "docs/**", "**/*.lock", "package-lock.json", "pnpm-lock.yaml", "assets/**", "**/*.md"],
    "hotPercentile": 80,
    "hotMinCommits": 3
  },
  "raise": { "hotPaths1": "standard", "hotPaths3": "thorough" }
}
```

How it works:
- **Source:** `git log --no-merges --since=<since> -n <maxCommits> --format= --name-only`. Count commits per path and drop the `exclude` matches.
- **Fallback:** if the window holds fewer than `minCommitsInWindow` commits, repeat the query without `--since` (last `maxCommits` commits). If that also gives fewer, report no hot paths and do not flag.
- **Hot path:** its count is at least the `hotPercentile` value of all non-zero counts, and at least `hotMinCommits`.
- **Inputs, by stage:**
  - after the plan: the paths in `plan.md` `**File**: \`path\`` lines (`plan-templates.md:63`). All 3 archived plans use that line: 6, 7 and 9 occurrences.
  - after implement: `git diff --name-only` since the run's first commit.
- **Rigor:** 1-2 hot paths touched raise rigor to at least `standard`, which brings plan-review back. 3 or more raise it to `thorough`. Rigor never drops.
- **Why these numbers:**
  - 90 days follows the change's working cadence.
  - The percentile adapts to repo size.
  - `hotMinCommits` stops a young repo from flagging every file.
  - Excluding `**/*.md` keeps docs churn out.
  - All values are uncalibrated (Open Question 10). They live in policy, so a project can override them.
- **Dry run on this repo** (31 commits in 90 days, `context/**` and `docs/**` excluded):
  - Counts: `route.mjs` 9, `README.md` 6, `SKILL.md` 5, `policy.json` 4, `AGENTS.md` 2, five files at 1.
  - With the `**/*.md` exclusion, the remaining non-zero counts are 9, 4, 1, 1, 1, 1 (`route.mjs`, `policy.json`, `LICENSE`, the header image, `plugin.json`, `marketplace.json`). Their 80th percentile is 4, nearest-rank: rank `ceil(0.8 × 6) = 5` of the sorted list.
  - Result: `route.mjs` and `policy.json` are hot. A plan that touches either runs at least `standard`.
  - **Inference:** every past change here touched `route.mjs`, so none of them would have run at `lean`. That matches the plan-review evidence (REVISE in 2 of 3).

### Split into four changes

Each change is runnable on its own, in this order. Each one updates ADR-003, `SKILL.md` "How the tier moves" and the README routing bullets for its own part.

| # | Change id (proposed) | Scope (from `change.md:12` items) | Depends on |
|---|---|---|---|
| 1 | `rigor-levels` | (1) rigor level and its persistence across `init`; churn risk paths; `--rigor`; budget per level; effort floor per level; `lean` skips plan-review; (3) RESULT `signals` intake and sanitizer; (8) skip entries in `run.jsonl` with correct counts and report; `node:test` rule check; rule-format ADR copied from life-to-lore ADR-012; ADR-003 skeleton | none |
| 2 | `pre-plan-steps` | (2) gates for research, legacy research (repo map), domain brief, frame; wiring `skills/10x-pipeline/prompts/`; (6) frame at opus/high plus the decision guide and the `needsHuman` halt; (5) RETHINK → frame once, then re-plan, then halt; REVISE twice → research | 1 |
| 3 | `phase-executors` | (4) per-phase executor routing (tdd, e2e, goal-implement), stop after phase N, fallback; SHA or commit verification against skip flips; (5) third implement attempt re-plans with the failure note; REJECTED → re-plan; manual-row automation with Claude-in-Chrome | 1 |
| 4 | `archive-and-lessons` | archive adapter (pre-commit, `archive` action, `verify-archive`); (7) lesson candidates in `report.md` with a `/10x-lesson` command | 1 |

**Inference:** changes 2, 3 and 4 all edit `decide()` in `route.mjs`, so they should run one after another, not in parallel worktrees (ADR-002 step 23: shared files go one by one). This change, `rigor-gated-routing`, can become change 1, or stay as an umbrella holding this research, with four new change folders made by `/10x-new`. The roadmap has no slice for any of them yet (`roadmap.md:46-47` covers S-03 and S-04 only).

### Remaining open items

- Pick how to split: rename this change to `rigor-levels`, or keep it as the umbrella. Then add roadmap slices (S-03 and S-04 fold into change 1).
- Executor verification (Follow-up 1, item 5) is still a design detail for change 3.
- The prompts in `skills/10x-pipeline/prompts/` are not committed. They will be published with the plugin on the next push.

---

## Follow-up 3 (2026-10-30): split applied

- This change was renamed from `rigor-gated-routing` to `rigor-levels`, and it is change 1 of the split. Earlier mentions of `context/changes/rigor-gated-routing/` in this document refer to this folder.
- Created with status `new`: `context/changes/pre-plan-steps/`, `context/changes/phase-executors/` and `context/changes/archive-and-lessons/`. Each `change.md` names its scope and dependencies, and points back to this research.
- Planned order: `rigor-levels`, then `pre-plan-steps`, then `phase-executors`, then `archive-and-lessons`.
- Roadmap slices are not added yet.
