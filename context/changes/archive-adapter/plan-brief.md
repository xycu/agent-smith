# Archive Adapter — Plan Brief

> Full plan: `context/changes/archive-adapter/plan.md`
> Research: `context/changes/archive-adapter/research.md`

## What & Why

Add an opt-in `--archive` flag so a finished pipeline run commits its change folder and archives the change through the unchanged `/10x-archive` skill. Today a finished run leaves `reviews/`, `plan.md` and `agent-smith/` uncommitted, so a human `/10x-archive` hits its hard block and the unattended flow ends with manual git work.

## Starting Point

`route.mjs` ends a successful run at `endRun(... "done")`, which prints and exits; it has no git access. `SKILL.md` knows `run`, `done` and `halt`. `/10x-archive` blocks on any dirty path in the change folder or any staged file, and asks a warnings prompt that a generic unattended subagent would answer with `Cancel`. After the folder moves, a second `next` or `init` would recreate it.

## Desired End State

With `--archive`, a run that reaches `done` makes one commit `chore(<id>): commit change folder before archive`, checks that the commit holds only that folder, returns an `archive` action, and the orchestrator runs `/10x-archive` in one subagent that has `Continue archiving` and `Archive without repointing` given as its answers. `route.mjs verify-archive <id> --path <archivePath>` confirms the move from files alone. Without the flag nothing changes. An archived or half-archived change cannot be touched again by `init` or `next`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Commit scope | Whole `context/changes/<id>/` folder, one commit | The other toolkit steps leave files uncommitted, so committing only `agent-smith/` cannot clear the archive block. | Research (owner decision A) |
| Commit message | `chore(<id>): commit change folder before archive`, no trailer, hooks run | Conventional Commits per AGENTS.md; the user's identity and hooks apply. | Plan |
| Git failures | Any failure halts with git's message; failed commit unstages its own `git add` | An unattended run must not leave a half-staged repo that blocks the human. | Plan |
| Pre-checks | Work tree, no ignored probe file, HEAD attached, no merge or rebase, nothing staged, valid `created`, archive destination free | Each one would make the commit fail, land wrong, or make `/10x-archive` stop after the commit. | Plan, review F1/F4 |
| Post-commit checks | Index empty, commit holds only the change folder, folder clean; halt prints JSON only | A hook can stage or rewrite other files; `git commit -- <path>` does not prevent it (reproduced). | Review F2 |
| Halted run | No commit, no archive, halt output says so | A failed run is not ready to archive. | Plan |
| No git or ignored files | `--archive` halts at `init`, nothing written; probes the files `run.jsonl`, `meta.json`, `report.md`, `change.md`, not the directory | A directory probe exits 1 while the directory is absent and misses `*.jsonl` (reproduced). | Plan, review F1 |
| `verify-archive` | File checks only, anchored folder name, optional `--path <archivePath>`, exit 0 or 1 | Keeps the command read-only, avoids the suffix match, and survives a reused id. | Research / Plan, review F4 |
| Re-entry | `init`, `next`, `status --report` halt on an archived change and on a half-archived one (`status: archived`, folder in place) and write nothing | "Nothing writes after the move." | Research / Plan, review F7 |
| Repeat `done` | Skip the commit when nothing is staged after `git add`; a pre-check halt on a resume prints JSON only when the folder is committed and clean | Makes a resume safe without dirtying the committed folder. | Research / Plan, review F7 |
| Pending Manual rows | Archive stays opt-in; `report.md` lists them; `archive.haltOnManualPending` (default `false`) halts instead | The report is the only router artifact that survives the move. | Review F5 |
| Archive step in report | No log entry, no usage, no row; a report line says archive runs after it | The folder moves, so nothing can be written after. | Research |
| Dirty `roadmap.md` | No router check; subagent copies the skill's notice into `assumptions` | `/10x-archive` already prints it. | Plan |
| Archive tier | `steps.archive` pinned at a tier with effort `high` or above in `policy.json` | Interactive skill; the pin works even at `lean`. | Research / Plan |
| Prompt rules | GIVEN/WHEN/THEN, one bold keyword each; answers given in advance (no question tool in a subagent), prefix match on labels, `blocked` for review-coverage warnings, archive rules beat the generic suffix | The suffix would pick `Cancel`, and a plain-text question ends a subagent turn. | Plan, review F3 |

## Scope

**In scope:** `--archive` flag and persistence; policy keys (including `archive.haltOnManualPending`); commit, post-commit checks, `archive` action; report lines; `verify-archive` with `--path`; re-entry guard (archived and half-archived); roadmap S-09 Outcome wording; `SKILL.md`, README, AGENTS.md, ADR-003 section, PRD FR-008 note; tests in `archive.test.mjs`.

**Out of scope:** lesson candidates, pre-plan steps, phase executors; any change to `/10x-archive`; push, `--no-verify`, protected-branch detection; archiving a halted run; the SHA repoint; recording archive tokens; a git read in `verify-archive`.

## Architecture / Approach

Data plus two code spots. `policy.json` gets a pinned `steps.archive`, an archive prompt and a commit message template. In `route.mjs`, `endRun` splits into a write step and a print step, and the `done` branch of `next()` runs git pre-checks, writes the report, commits, checks the index is empty, the commit holds only the folder and the folder is clean, and prints the `archive` payload. Post-commit failures print JSON only, so nothing is written into the committed folder. The orchestrator runs `status` first, calls the Agent, then `verify-archive`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard and `verify-archive` | Read-only safety, no git | Frontmatter parsing and the anchored name match |
| 2. Policy and `--archive` | Pinned tier, prompt rules, flag, persistence, `init` refusals | Prompt answers must match the real skill's labels |
| 3. `done` branch | Pre-checks, commit, clean check, `archive` action, report lines | Half-staged or dirtied folder after a failure |
| 4. Orchestrator and docs | `SKILL.md` loop, README, AGENTS.md, ADR-003, PRD note, real run | Only the manual run exercises the real `/10x-archive` |

**Prerequisites:** the whole `rigor-levels` change (roadmap S-03) merged before implementation starts; staged merging is unsupported. This plan reuses its test harness, `meta.json` spread, `endRun`/`buildReport`/`next()` rewrites and ADR-003 skeleton. Planning and review can run now.
**Estimated effort:** about 3-4 sessions across 4 phases.

## Open Risks & Assumptions

- Assumed, research questions 2-10 decided with the research's proposed rules (see the plan's decision table).
- `git mv` with an ignored `agent-smith/` is untested; the adapter refuses that case.
- Pending Manual rows raise the warnings prompt on nearly every run; the subagent proceeds with `Continue archiving`, so unchecked manual rows are archived (opt-in, owner-set), but they are listed in `report.md` and the final message.
- A half-finished `/10x-archive` (stamped, not moved) is reported as not archived, blocks `init`/`next` and needs a human. A staged-but-uncommitted archive reads as `archived: true`; the orchestrator reminds the user to check `git status`.
- The commit lands on the current branch (`main` too) and includes every file in the folder; a git timeout may leave a hung hook child and a stale `index.lock`.
- The `runGit` wrapper sits beside the churn git layer from `rigor-levels` Phase 3, which is merged first.
- Plan review 2026-10-30 (REVISE) findings F1 to F9 are resolved in this revision.
- Real `/10x-archive` behavior is checked once, manually, in Phase 4.

## Success Criteria (Summary)

- A `--archive` run ends with two commits (the router's and `chore(archive): close <id>`), the change under `context/archive/`, and `verify-archive` reporting `archived: true`.
- A run without the flag, and any halted run, makes no git write.
- `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new adapter tests.
