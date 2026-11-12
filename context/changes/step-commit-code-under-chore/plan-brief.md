# Stop Shipping Implemented Code in Chore Step Commits — Plan Brief

> Full plan: `context/changes/step-commit-code-under-chore/plan.md`

## What & Why

In an isolated run the router commits whatever a verified step left in the worktree as `chore(<id>): step <n> <step>`. Code that a step subagent did not commit itself reaches `main` under `chore`, which release-please hides: no changelog line, and a run of only `chore`/`docs` commits opens no release PR. Sixteen of 31 implement-class step commits on `main` hold code (change.md evidence).

## Starting Point

`stepCommit` → `routerCommit` runs `git add -A` and records only the commit hash (`scripts/isolation.mjs:325-477`). `open-pr.mjs` does the same for leftovers as `chore(<id>): final run state`. The prompt suffix says "Do not commit unless the skill itself commits", and `prompts/os-apply.md:25` forbids `os-apply` to commit at all.

## Desired End State

Every path outside the change folder that the router commits under `chore` is named: on the log entry (`swept`), in `status`, and in a `## Code committed by the router` section of `report.md` with a count line in the report header (which the PR body shows). `open-pr.mjs` returns `swept` for its leftover commit and the orchestrator prints it. The implement-class prompts make the subagent commit its code as `<type>(<id>): …` with a non-`chore` type, so the record is the exception, not the rule.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Router safety net | Keep the `chore` step commit, record the swept paths | change.md calls it the smaller change; no new `RESULT:` field to parse or validate | Plan (change.md option 2) |
| Which steps are recorded | Every step commit, not only implement-class | The done-when is step-agnostic; `impl-review-apply` and `manual-verify` can also leave code | Plan |
| When the names are read | Before `git commit`, from the index; a failed read aborts like a failed add | The router never makes a step commit it cannot account for; resume retries | Plan |
| Path form | Git-root-relative, `--no-renames` | Matches the existing halt messages and the PR diff; a move names both sides | Plan |
| open-pr leftover commit | Same subject; new `swept` JSON field, printed by both skills | Keeps ADR-017/021 tests; the commit happens after the report is written | Plan (change.md item 3) |
| Prompt rule | One rule line in `implement`, `implement-segment`, `implement-retry`; `os-apply` switches to "commit your code by name, leave the change folder" | change.md fix direction 1; types `feat fix refactor perf test docs`, never `chore` | change.md |
| Suffix | "Commit only where the skill or a rule of this prompt tells you to." | Old sentence read as a ban next to the new rule | Plan |
| ADR | Amendment 1 to ADR-010, no new ADR | Step commits are ADR-010's decision; ADR-012 set the amendment pattern | Plan |

## Scope

**In scope:** `swept` record in the step commit, `status`, `report.md`; `swept` in `open-pr.mjs` output and both SKILL.md print lines; the commit rule in four templates and the suffix wording; tests in `stepcommit`, `openspec-isolation`, `open-pr`, `rules`; REFERENCE, ADR-010, prompts README, openspec SKILL.md, AGENTS.md text.

**Out of scope:** `signals.commit` and router commits under a chosen subject; any change to router or leftover commit subjects; halting on uncommitted code; commit rules for review, plan or manual-verify templates; a path cap; rewriting history already on `main`.

## Architecture / Approach

`routerCommit` (whole-worktree form only) reads the staged names before committing and returns them; `stepCommit` keeps those outside `changeRel(p, id)` as `last.swept`, set and written with `last.commit`. `buildReport` and `status` render the additive key. `open-pr.mjs` lists its own commit's files after the commit. Prompts change last.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router records the paths it commits under chore | `swept` on entries, `status`, report section and header line | Getting the name read before the commit without breaking the four `routerCommit` callers |
| 2. open-pr.mjs names the code of its leftover commit | `swept` JSON field, print line in both skills | Skill content tests that pin SKILL.md text |
| 3. Implement-class prompts commit their code under a typed subject | Rule line in 3 templates, `os-apply` rule flip, suffix wording, doc sync | `os-apply` reverses a deliberate ADR-013-era rule; docs that describe it must all move |

**Prerequisites:** Node 24+, git; no new dependencies.
**Estimated effort:** ~1 implement session across 3 phases, about 12 files.

## Open Risks & Assumptions

- Why the implement subagents skipped `/10x-goal-implement`'s phase commits is not proven; the suffix sentence is the likely cause. The router record meets the done-when even if the prompt fix does not change behavior.
- A pre-commit hook that stages extra files is not seen by the pre-commit name read.
- With isolation off, `os-apply` now commits on the checked-out branch, as `/10x-goal-implement` already does for the 10x chain.
- A step that leaves thousands of untracked, non-ignored files records them all.

## Success Criteria (Summary)

- A run whose subagent leaves code uncommitted shows every such path in `report.md` (and the PR body count), in `status`, and in `open-pr.mjs` output.
- Implement-class prompts ask for a typed, non-`chore` commit of the code before `RESULT:`.
- Full suite green; `init`/`status` print valid JSON on both chains.
