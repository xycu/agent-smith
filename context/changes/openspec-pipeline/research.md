---
date: 2026-11-09T02:32:47+01:00
researcher: Claude Code (claude-sonnet-5-5), for Błażej Ksycki
git_commit: 777747fcda315bceedebf7c9c30c441248917626
branch: main
repository: agent-smith
topic: "How can agent-smith's router drive an OpenSpec chain (FR-006) while keeping the general OpenSpec way of work?"
tags: [research, codebase, openspec, route.mjs, policy.json, isolation, fr-006]
status: partial
last_updated: 2026-11-09
last_updated_by: Claude Code (claude-sonnet-5-5)
---

# Research: How can agent-smith's router drive an OpenSpec chain (FR-006) while keeping the general OpenSpec way of work?

**Date**: 2026-11-09T02:32:47+01:00
**Researcher**: Claude Code (claude-sonnet-5-5), for Błażej Ksycki
**Git Commit**: 777747fcda315bceedebf7c9c30c441248917626 (working tree has untracked `.claude/skills/`, `.claude/commands/`, `openspec/` and this change folder)
**Branch**: main
**Repository**: agent-smith

## Research Question

How can agent-smith's router drive an OpenSpec chain (FR-006, a second pipeline skill sharing the same router and policy) while keeping the general OpenSpec way of work? Covered: OpenSpec artifact and task state, which of propose/apply/verify/archive can map to router steps, how the router can read progress and verdicts without `plan.md` and `reviews/`, where run state and the isolation worktree live, base tier per step, and which existing constraints (ADR-004/006/007/009/010/011/012, `AGENTS.md`) bind reuse. Constraint: agent-smith never edits OpenSpec or the 10x skills (add-on only).

## Summary

**Status is `partial`.** Everything below that is not marked as a gap was observed in files or in live CLI runs. Nothing was run through a real subagent, so the behaviour of the OpenSpec skills when driven unattended is unverified (see Open Questions).

1. **Scope is decided at the level of direction only.** FR-006 says "a second pipeline skill sharing the same router and policy" (`context/foundation/shape-notes.md:20`, `:50`, `:108`). It was parked as a non-goal on 2026-10-31 and "built after dynamic routing works" (`context/foundation/prd.md:143`, `:151`; `context/foundation/roadmap.md:267`). No ADR, slice or design exists for it. The PRD and roadmap still say "parked"; this change is the first record that un-parks it.
2. **OpenSpec exposes machine-readable state for every step except verify.** For `openspec` CLI 1.16.1, in a probe project: `openspec status --change X --json` gives `isPlanningComplete` and per-artifact `ready|blocked|done|skipped`; `openspec instructions apply --change X --json` gives `state` (`blocked|ready|all_done`) and `progress {total, complete, remaining}`; `openspec validate X --json` gives `ERROR`/`WARNING` issues and exit code 1 on any ERROR; `openspec archive X --json --yes` archives without prompts. **Verify has no CLI command and writes no file.** The `openspec-verify-change` skill prints a markdown report in chat (`.claude/skills/openspec-verify-change/SKILL.md`). Nothing in OpenSpec writes an event log or a hook output.
3. **The router engine is mostly reusable, its decision core and paths are not.** `route.mjs` has 3582 lines. Tiering, budget, rigor machinery, provenance, report writing, isolation, step commits and rollback take step names from `policy.json` or work on the whole worktree. The state machine `decide()` (`route.mjs:1026`), the per-step "verified by the file it writes" switch in `attachResult()` (`route.mjs:603`), `readPlan`/`readReview`, the archive code and the path factory `paths()` (`route.mjs:244`) are fixed to `context/changes/<id>/` with `plan.md` and `reviews/*.md`.
4. **"Sharing the router" is therefore a design decision, not a free property.** Two ways appear in the evidence: add a chain switch inside `route.mjs` (a `paths()` that takes a root, a second decision function beside `decide()`, new `case`s in `attachResult()`), or give the second skill its own router entry (`route.mjs` has no `export` statement, grep count 0, and is a CLI script whose `main()` starts at `:3473`, so another script cannot import its functions without a refactor). Which one fits is for ADR-013.
5. **Verification (verify) and the archive step are the two real design gaps.** Verify needs a verdict file that the verify subagent writes in a format the router defines. Archive has two incompatible paths in OpenSpec (the skill moves the folder itself and syncs specs by an agent-driven merge, with three prompts; the CLI `openspec archive --yes --json` merges mechanically and asks nothing).
6. **One risk found by inference, not tested:** the OpenSpec skills now sit in `.claude/skills/openspec-*` of this project and are untracked in git. An isolated run works in a linked worktree under `.claude/worktrees/`, which holds tracked files only. Whether subagents in that worktree can see project-level skills that are not committed has not been checked. The 10x skills are not affected, they are user-level (`~/.claude/skills/`).

## Detailed Findings

### 1. What is already decided

- **Direction.** `shape-notes.md:19-20`: gray area "OpenSpec relation to 10x chain", decision "second pipeline skill sharing the same router and policy". `shape-notes.md:50` repeats it as delta item 1. `prd.md:98` states FR-006 ("The user can run an OpenSpec chain through a second pipeline skill. Priority: nice-to-have"), `prd.md:53` lists it as a secondary goal.
- **Park condition.** Socrates note on FR-006 (`prd.md:99`): "kept as nice-to-have, built after dynamic routing works." The PRD non-goal at `prd.md:143` ("OpenSpec support (FR-006) in this delivery", confirmed 2026-10-31) and Open Question 5 at `prd.md:151` bind that delivery only. `roadmap.md:28` says the milestone M-1 leaves FR-006 out, and `roadmap.md:23` records M-1 as done (as reported by a worker; not re-read by me).
- **Add-on rule.** `prd.md:59`, `prd.md:123`, `prd.md:142`, `shape-notes.md:142`, `shape-notes.md:157`: the 10x toolkit and OpenSpec are never changed or forked by agent-smith.
- **Not decided:** the step mapping, where run state lives, how the router reads OpenSpec progress, how verify and archive run, tiers per step, and the skill's name. `grep -ril openspec` over the repo (excluding `.claude/skills` and `.claude/commands`) finds only `README.md`, `prd.md`, `shape-notes.md`, `roadmap.md`, `ADR-001` and three files of `context/archive/2026-11-02-release-packaging/`. The archive hits are about excluding a different repository's `openspec.yml` workflow from that change and are unrelated to FR-006.
- **Wording differences.** `shape-notes.md:20` says "sharing the same router and policy"; `prd.md:98` says only "a second pipeline skill". The shape-notes wording is the stronger commitment.

### 2. OpenSpec state a router can read (CLI 1.16.1, observed in a scratch project)

The probe project was `/private/tmp/claude-501/-Users-blazej-WebstormProjects-agent-smith/2958ee06-e981-4d47-8e2d-bcab4e6b71a7/scratchpad/os-probe`. The repository itself was not touched. Artifact files were written by hand there.

| Question | Source | Observed values |
|---|---|---|
| Planning complete? | `openspec status --change X --json` | `isPlanningComplete` (`isComplete` is a legacy duplicate) |
| Which artifact is next? | same | first `artifacts[]` entry with `status: "ready"`; statuses `ready`, `blocked`, `done`, `skipped` |
| Can apply start, is it finished? | `openspec instructions apply --change X --json` | `state`: `blocked`, `ready`, `all_done`; `progress {total, complete, remaining}`; `tasks[{id, description, done, sourcePath, line}]` |
| Tasks done/total for a list view | `openspec list --json` | `changes[].completedTasks`, `totalTasks`, `status` in `in-progress`, `complete`, `no-tasks` (`list.js:166` in the package) |
| Is the change valid? | `openspec validate X --json [--strict]` | `items[].issues[].level` `ERROR`/`WARNING`; exit 1 on any ERROR |
| Archive without prompts | `openspec archive X --json --yes` | success JSON `archive.archivedAs`, `path`, `specsUpdated`, `totals` |

Details that matter for a router:

- **Artifact `status` is file existence only.** With the `spec-driven` schema (`proposal → specs → design → tasks`), `tasks` stays `blocked` until `design.md` exists, even though the design instruction says "create only if…". The propose skill tells the agent to write the file anyway when it is "blocked only because you skipped a conditional dependency" (`openspec-propose/SKILL.md:138`, per the worker).
- **`state: "blocked"` has two forms** under `instructions apply`: missing artifacts (then `missingArtifacts` is set), and a `tasks.md` with no checkboxes (no `missingArtifacts`; instruction "The tasks.md file exists but contains no tasks to work on."). A router must read `missingArtifacts` to tell them apart.
- **Checkbox rule.** Only `- [x]`/`- [X]` counts as complete (archive skill text, `openspec-archive-change/SKILL.md:40-42`). The task `id` in the JSON is a sequence number; the label such as "1.1" stays in `description`.
- **Missing change** gives exit 1 and `{"status":[{"severity":"error","code":"change_error",...}]}`.
- **Archive via CLI.** Incomplete tasks without `--yes` give exit 1 and `archive_tasks_incomplete`, nothing archived. With `-y` it warns "Continuing due to --yes flag" and archives. The archive folder is `openspec/changes/archive/YYYY-MM-DD-<name>` and `.openspec.yaml` moves with it. The CLI merges delta specs mechanically into `openspec/specs/<cap>/spec.md`; a MODIFIED or RENAMED delta against a missing main spec errors, and a REMOVED-only delta needs `retire_capabilities: true` in `.openspec.yaml` (`archive.js:1508` in the package).
- **State location.** The active change is `openspec/changes/<name>/` with `.openspec.yaml`, `proposal.md`, `specs/<cap>/spec.md`, `design.md`, `tasks.md`. Nothing else is written there: no verdict file, run log or lock file.
- **No verify command** in `openspec --help`. The verify skill is read-only and "advisory" (`openspec-verify-change/SKILL.md`, final assessment as free text such as "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."). The archive skill never reads a verify result. Severity classes are CRITICAL, WARNING, SUGGESTION. Mechanical proxies that a router can read without the skill: `apply.state == "all_done"`, `validate` ERROR count, `list` `status == "complete"`. These cover completeness and spec structure, not correctness or coherence.

### 3. The 12 OpenSpec workflows as pipeline steps

Observed in `.claude/skills/openspec-*/SKILL.md` (worker read propose, ff, apply, verify, update, archive, continue, new in full; sync, bulk-archive, explore, onboard in part). Installed from `openspec init`; every skill carries `generatedBy: "1.16.1"`.

| Skill | Does | Asks the user? | Fit for an unattended subagent step |
|---|---|---|---|
| propose | creates the change and all required artifacts, never implements (`:15`, `:170`) | on missing input, "material ambiguity" (`:55`), an artifact that needs input (`:141`), an existing change (`:174`) | candidate, with an unattended decision guide |
| ff | same artifacts, fewer stops; "prefer making reasonable decisions" (`:127`) | only if "critically unclear" | candidate, closest to unattended |
| new | scaffold only, then "STOP and wait" | yes (step 6) | no |
| continue | one next artifact | if context is unclear | possible but slow (one artifact per step) |
| apply | implements tasks, ticks `- [ ]` → `- [x]` at the returned `sourcePath:line` | pauses on unclear task, design issue, extra scope, error | candidate, with a guide that maps pauses to `blocked` + `signals.needsHuman` |
| update | revises artifacts, never code | confirms every edit before writing | no |
| verify | read-only check, three dimensions (completeness, correctness, coherence), prints a report | no | candidate, needs a verdict file |
| sync | agent-driven merge of delta specs into `openspec/specs/` | if unclear | optional, normally part of archive |
| archive | checks status and tasks, offers sync, moves the folder by `mv` (it does not call `openspec archive`) | three prompts (incomplete artifacts, incomplete tasks, sync choice) | candidate, with answers given as rules, as the 10x archive prompt does |
| bulk-archive | multi-select archive | always (prompt for selection) | no |
| explore | a conversational stance, no output (`:17`) | n/a | no |
| onboard | 8-phase tutorial with `**PAUSE**` at `:174`, `:264`, `:408` | yes | no |

Mapping to 10x steps, as a starting point only: propose/ff ↔ `plan` (but with no plan review in OpenSpec), apply ↔ `implement`, verify ↔ `impl-review` (advisory, no verdict file), archive ↔ `archive`. OpenSpec has no counterpart of plan review, `fix` or the phase/Automated/Manual structure of `plan.md`.

### 4. How coupled `route.mjs` is to the 10x chain

File sizes (`wc -l`, 2026-11-09): `route.mjs` 3582, `SKILL.md` 150, `policy.json` 357.

**Chain-agnostic or data-driven (reusable as is)** per the worker's classification, with the anchors I re-checked marked ✓:
- Log and meta handling (`readLog`, `writeLog`, `readMeta`), `cleanUsage`, `cleanSignals`, `isFailure`, `budgetSteps` (`:683`), `trailingFailures`.
- `tierFor` (`:2120`) and the ladder, effort floor, first-attempt drop: they read `policy.steps[d.step]`, so a new step name gets tiers from `policy.json` with no engine change. `complexity.appliesTo`, `complexity.simple.discount`, `rigor.tierOffset`, `escalation.firstAttempt.templates` and `extraSteps.cost` are keyed by step name; a new step missing from them gets zero effect.
- `promptText`/`render`/`checkPrompts` (`:2247`, `:2266`): template resolution by name. `checkPrompts` validates every template in the policy before each `next`, so a second chain's templates must all resolve.
- Provenance (`:2318-2452`): hashes whole policy sections, so new policy keys are hashed automatically; any edit marks `provenance.drift` in in-flight 10x runs (expected, no routing effect).
- Isolation, `stepCommit`, `rollback`, `undoRollback`: `git add -A` for the whole worktree, so they do not depend on the change folder path. Exceptions: `startCommit` commits `context/changes/${id}` ✓ (`route.mjs:2673`), and the file-time restore (`timedFiles`, `:2707`) names `plan.md` and the two review files.
- `compare` (`:3173`) except `locateSide` (`:3192-3213`) which hard-codes `context/changes/<id>/agent-smith` ✓ (`:3194`) and `context/archive` ✓ (`:3195`).

**Hard-wired to 10x:**
- **`paths()`** ✓ `route.mjs:244-260`: `change = ROOT/context/changes/<id>`, run state in `agent-smith/`, `plan.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `complexity.json`.
- **Literal `context/changes` in `route.mjs`** ✓ (grep, this inspected file, one comment excluded): lines 245, 821, 1625, 2673, 2819, 3147, 3155, 3194, 3460. **Literal `context/archive`** ✓: lines 206, 211, 230, 2849, 3137, 3148, 3150, 3195.
- **Override file** ✓ `route.mjs:57`: `ROOT/context/foundation/agent-smith-policy.json`, one file, merged key by key by `deepMerge` (arrays replaced whole).
- **`decide()`** ✓ `route.mjs:1026`: fixed state machine on `plan.md` `## Progress` and `reviews/*.md`; line 1035-1036 requires `change.md` ("Run /10x-new …").
- **`attachResult()`** ✓ `route.mjs:603`: the switch at `:615-653` verifies each step by file by step name: plan → `plan.md`, plan-review/impl-review → review file with a parsed verdict, research/frame/domain-brief → their files, score → `complexity.json`, implement → `verifyImplement`, manual-verify → `verifyManual`, default (`fix`) → trusted.
- `readPlan` (`:75-117`, seven call sites per the worker), `readReview`/`readFindings` (`:119-203`), `simpleSignal`, `measureRisk`, pre-plan steps (`:1196-1384`), score (`:1385-1574`), phase executors (`:1575-1864`), manual verification (`:1865-2042`), code re-plans (`:2043-2095`), `archiveDone` (`:2818-2953`, uses `created:` in `change.md` and `/10x-archive`), `verifyArchive` (`:3126-3164`).
- A step missing from `policy.steps` makes `tierFor`/`next` throw (`Router error:` via the catch in `main`), per the worker (`:2121`, `:3068`).

**Policy.** `steps` and `prompts` are open maps; step name and template name are separate (`const template = d.template ?? d.step;`, `route.mjs:3050` ✓), so one step can have several templates. A second chain's steps and templates can live in the same `policy.json`; name collisions (`plan`, `implement`, `fix`, `archive`, `score`) are the only risk. A second policy file would need `loadPolicy` (`:54-59`) to take a path.

**`SKILL.md`** (150 lines): the Loop actions `run`, `done`, `archive`, `halt` are chain-neutral in shape, but the prose names `context/changes/<id>/change.md`, `/10x-new`, `/10x-archive`, the 10x skills (`SKILL.md:30`), `manualPending` and friends. There is no include mechanism (the worker found no `@`-include in `SKILL.md`). `skill-loop.test.mjs` checks the `## Anti-stall rules` section of that one file; `rules.test.mjs` checks the rule form of `policy.json` prompts, `prompts/*.md` and that section (ADR-004).

**Tests.** 31 test files, about 15k lines (worker count). `helpers.mjs` `makeProject` hard-codes `context/changes/<id>/change.md` (`helpers.mjs:19-41`, `:23`). `AGENTS.md` says `helpers.mjs` "stays as it was" except `writeOverride`, and `loops-existing.test.mjs` is never edited (one exception for two tier literals). A second chain's tests therefore need a new helper file and a `tasks.md`-style artifact builder.

### 5. Where run state and the worktree would live

- **Both trees are separate, so there is no path collision.** `context/changes|archive|foundation/` versus `openspec/changes/`, `openspec/changes/archive/`, `openspec/specs/`, `openspec/config.yaml`. File names overlap only conceptually (`research.md`, `design.md`).
- **Name collisions are possible.** An OpenSpec change and a 10x change can share a name. The run branch `agent-smith/<id>`, the worktree `.claude/worktrees/agent-smith-<id>` and the refs `refs/agent-smith/<id>/…` would then clash between chains (ADR-010 key by `<id>` only).
- **Run state location is undecided.** Candidates: `openspec/changes/<name>/agent-smith/` (next to the change, moves with `mv`/`openspec archive`), or `context/changes/<name>/agent-smith/` (existing convention, `FR-008`, `prd.md:102`). Not verified: whether the `openspec` CLI (`validate`, `archive`, `list`) tolerates an extra directory or extra files inside `openspec/changes/<name>/`. The worker's probes put no extra files there.
- **Worktree.** ADR-010 and `docs/REFERENCE.md` ("Run isolation") copy the change folder into the worktree with `cp -Rp` only when the run branch is created, because the folder is untracked in a fresh worktree. `openspec/changes/<name>/` would be in the same situation. `openspec/specs/` is read as committed at the branch point. Currently `openspec/` is untracked in this repository (`git status`), so it would also have to be committed before a run.
- **Step commits and rollback** commit and reset the whole worktree, so edits to `openspec/specs/` and `openspec/changes/<name>/` are covered (`docs/REFERENCE.md` rollback section). The `init` gate "git ignores a router file of the change" (`ignoredProbePaths`, `route.mjs:820-824`) probes `context/changes/<id>/…` only.
- **OpenSpec "stores".** The skills support `--store <id>`, a standalone OpenSpec repo registered on the machine, where `planningHome` can be outside this repository (worker, from the skills' "Store selection" blocks). A change hosted there would sit outside the worktree and outside ADR-010's rollback. Not tested.

### 6. Constraints that bind a second chain

- **ADR-004** (`docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, Accepted 2026-11-07): every prompt rule is one line `GIVEN … WHEN … THEN … MUST|MUST NOT|SHOULD|SHOULD NOT|MAY` with exactly one bold keyword, enforced by `rules.test.mjs`.
- **ADR-006 / ADR-007 / ADR-009:** Node 24, `node:` built-ins only, no npm dependency; no network or model call in the router. A subprocess is not named as forbidden (git already is one). Whether the router may call the `openspec` CLI is therefore not settled by these ADRs. `AGENTS.md:9` also says "Everything else it does with git is a read" for git; it says nothing about other binaries.
- **ADR-010** git-write allowlist (`AGENTS.md:9`): start commit, step commits, failed-step snapshot, rollback resets, undo on halt, pre-archive commit; never in the main checkout, never push, never `--no-verify`, no `-c` except `core.quotePath=false`. `AGENTS.md:10`: the router never calls `gh`.
- **ADR-011** review routing reads `### F<n>` blocks and verdict words in `reviews/*.md`. OpenSpec has no such review files; verify output has different severity classes (CRITICAL/WARNING/SUGGESTION) and no `Decision` lines. ADR-011 does not apply without a new review artifact.
- **ADR-012** `manual-verify` reads `plan.md` Automated/Manual rows. `tasks.md` has only `- [ ]`/`- [x]` rows (probe). It does not apply as is.
- **ADR-007** scorer reads `change.md`, the goal and upstream artifacts and writes `complexity.json` into the change folder. For OpenSpec the inputs would be `proposal.md`, `specs/`, `design.md`.
- **Stable surface** (`prd.md:122`): `/agent-smith:10x-pipeline`, the override file `context/foundation/agent-smith-policy.json`, and the formats of `run.jsonl` and `report.md` stay stable. A new command does not break these. Both skills would read the same override.
- **Contributor rules** (`AGENTS.md`): policy keys camelCase, step names kebab-case; routing decisions only in `route.mjs` and `policy.json`; a tier-logic change updates "How the tier moves" in `SKILL.md` and the routing bullets in `docs/REFERENCE.md`; run `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` after changing `route.mjs`, `policy.json`, a prompt or `tools/`; Conventional Commits with a `Co-Authored-By:` trailer; never hand-edit the four version fields; new files go into the `AGENTS.md` Project Structure list and the README Layout block. `.claude-plugin/plugin.json` carries no skills list (inspected), and `skills/` holds only `10x-pipeline`; the plugin description says "(10xDevs)" only, so `plugin.json`, `marketplace.json` and the README one-liner would need to stay aligned (`tools/version-check.mjs`, `AGENTS.md`).
- **Subagents cannot ask the user** (`docs/REFERENCE.md`, Limits). The OpenSpec propose, apply and archive skills ask questions, so each would need an unattended decision guide in the style of `frame-unattended.md`, mapping unanswerable cases to `blocked` + `signals.needsHuman`.

## Code References

- `skills/10x-pipeline/scripts/route.mjs:244-260` - `paths()`, the single path factory (`context/changes/<id>`, `agent-smith/`, `plan.md`, `reviews/*.md`, `complexity.json`)
- `skills/10x-pipeline/scripts/route.mjs:54-59` - `loadPolicy()`, one base file plus one override at `context/foundation/agent-smith-policy.json`
- `skills/10x-pipeline/scripts/route.mjs:603-665` - `attachResult()`, per-step verification by step name
- `skills/10x-pipeline/scripts/route.mjs:1026-1040` - `decide()`, fixed 10x state machine and the `change.md` check
- `skills/10x-pipeline/scripts/route.mjs:2120` - `tierFor()`, policy-driven tiers by step name
- `skills/10x-pipeline/scripts/route.mjs:2673`, `:2819`, `:2849`, `:3137-3155`, `:3194-3195` - `context/changes` and `context/archive` literals in start commit, archive, `verify-archive` and `compare`
- `skills/10x-pipeline/SKILL.md:30` - requires `context/changes/<change-id>/change.md`, names the four 10x skills
- `.claude/skills/openspec-verify-change/SKILL.md` - verify prints a report, writes nothing
- `.claude/skills/openspec-archive-change/SKILL.md:40-42` - only `[x]` counts as complete; three prompts
- `.claude/skills/openspec-propose/SKILL.md:15`, `:55`, `:138`, `:141`, `:170`, `:174` - planning boundary, ask-the-user points, conditional-dependency rule
- `context/foundation/shape-notes.md:19-20`, `:50`, `:108`, `:142`, `:157` - FR-006 and the add-on rule
- `context/foundation/prd.md:53`, `:98`, `:122`, `:143`, `:151` - FR-006, stable surface, parked status
- `context/foundation/roadmap.md:28`, `:267` - FR-006 left out of M-1, parked
- `docs/REFERENCE.md` ("Run isolation") - worktree, start commit, step commits, rollback, change-folder copy
- `AGENTS.md:7-12` - Hard Rules (routing in `route.mjs`/`policy.json`, git-write allowlist, no `gh`, no dependencies)

## Architecture Insights

- The router is an engine plus a 10x-specific decision core. The engine already takes step names from data, which is why a new set of steps can reuse tiering, budget, provenance, isolation, commits and rollback without engine change. The seams that do not exist today are: a chain selector, a root for `paths()`, a decision function per chain, and a per-step verification switch per chain.
- OpenSpec's own CLI is a read-only oracle for planning and apply progress; the files it reads are plain (`tasks.md` checkboxes, artifact existence). A router could read the same facts with file reads (same rules as the CLI: existence for artifacts, `- [x]` count for tasks) or by calling the CLI with `--json`. Both are consistent with the probe; choosing between them trades an extra binary dependency against a re-implemented parser that could drift from OpenSpec's.
- Verify is the odd step: no verdict artifact exists, and the archive skill never reads one. A pipeline that wants to route on verify must define its own verdict file, written by the verify subagent (for example under the run's `agent-smith/` folder, to leave OpenSpec's change folder untouched).
- "Keep the general OpenSpec way of work" most naturally means: use the OpenSpec skills as the step bodies (as the 10x pipeline uses the 10x skills), write only files OpenSpec already defines inside `openspec/`, and run `openspec archive` or the archive skill rather than a private replacement. This reading is mine, not stated in the repo.

## Historical Context (from prior changes)

- `context/foundation/shape-notes.md` (2026-10-29, owner) and `context/foundation/prd.md` (v1, 2026-10-31): FR-006 scope and park, see Detailed Findings 1. Supported: direction and add-on rule. Superseded in practice (not in the document): the park, by the owner's request of 2026-11-09 recorded in `context/changes/openspec-pipeline/change.md`.
- `docs/ADR/ADR-001-phased-complexity-routing.md:54` - "Neither the 10x toolkit nor OpenSpec provides this mechanism. It is added by agent-smith as an add-on and changes neither toolkit." Supported.
- `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md` (Proposed, 2026-10-30) - the 10x lifecycle only; no OpenSpec mention (worker grep).
- `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Accepted 2026-11-08, live checks pending) - isolation assumes the change folder exists on the run branch; the open `.claude/worktrees/` permission question applies to an OpenSpec run too.
- `context/archive/2026-11-02-release-packaging/{research,plan-brief,plan}.md` - mention OpenSpec only to exclude another repository's workflow file; not related to FR-006.

## Related Research

- None on OpenSpec. `context/archive/2026-11-03-worktree-step-commits/` and `context/archive/2026-11-05-automate-manual-checks/` are the nearest prior work on isolation and on a step that reads `plan.md` rows; not re-read here beyond what the workers reported.

## Open Questions

Facts that ADR-013 needs and this research could not settle:

1. **Chain seam.** Chain switch inside `route.mjs` (needs `paths()` root, a second decision function, new `attachResult` cases, `SKILL.md`-level changes) versus a separate router entry for OpenSpec. Which keeps the PRD wording "sharing the same router and policy"?
2. **How the router reads OpenSpec state.** Parse files itself, or call `openspec status/instructions --json`. No ADR forbids a subprocess; `AGENTS.md` constrains only git, `gh`, network, model calls and dependencies. Unsettled.
3. **Run state location** and whether the `openspec` CLI tolerates an `agent-smith/` directory or other extra files inside `openspec/changes/<name>/` (not tested: `validate`, `archive`, `list` with an extra directory).
4. **Verify verdict.** Who writes it, where, in what format, and how it maps to continue/stop. Routing on it would need a new review-like artifact; ADR-011 does not cover it.
5. **Archive path.** Skill (agent-driven spec merge, three prompts that need rule-based answers) versus `openspec archive --yes --json` (mechanical merge, no prompts, different merge semantics). Whether `--yes` archiving with open tasks is acceptable, or the router should halt on `progress.remaining > 0`.
6. **Unattended behaviour of the OpenSpec skills.** Not run. Whether propose/ff/apply/archive in a subagent stop where their text says they ask, and whether decision guides produce the `blocked` + `signals.needsHuman` result the router needs. Needs a live probe.
7. **Skill availability in an isolated run.** `.claude/skills/openspec-*` and `.claude/commands/opsx/` are untracked here; a linked worktree contains tracked files only. Needs a check of whether a subagent started in `.claude/worktrees/agent-smith-<id>` can use project-level skills (and whether committing them is required). Also whether a second skill in this plugin can call `../10x-pipeline/scripts/route.mjs` (path resolution not checked).
8. **Naming collisions** between a 10x change and an OpenSpec change of the same name (branch, worktree, refs), and whether the second skill needs a branch or ref prefix.
9. **Which rigor/score/executor features apply.** `tasks.md` has no phases and no Automated/Manual split, so phase executors, `manual-verify`, the `plan` phase-count rigor input, `simpleSignal` and the review loops have no direct input. Which of them to keep, drop or re-derive is a design choice. Whether OpenSpec progress can be fed to `readPlan` unchanged was not checked (the worker did not read a real `tasks.md` template beyond its hand-written probe).
10. **Base tiers per step** (propose/apply/verify/archive) have no data yet; ADR-001/003 say the existing thresholds are uncalibrated.
11. **Store-hosted OpenSpec changes** (`--store`) fall outside the worktree and rollback; should the chain refuse them?
12. **Docs and manifests.** A new skill folder needs `AGENTS.md` and README layout entries and possibly `plugin.json`/`marketplace.json` descriptions; whether skills in `skills/` are auto-discovered without a manifest list was inferred from `plugin.json` having none, not verified against Claude Code.
