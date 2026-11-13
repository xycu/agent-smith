# ADR-013: Drive an OpenSpec change through a second pipeline skill that shares the router, with a chain switch, file-based state reading and a router-defined verify verdict

- **Status:** Accepted (the owner accepted decisions D1 to D12 on 2026-11-09; the four checks of "Preconditions" passed on 2026-11-09)
- **Date:** 2026-11-09
- **Deciders:** the repository owner (direction: FR-006, `context/foundation/shape-notes.md:20`; scope request of 2026-11-09); decisions D1 to D12 below accepted as proposed on 2026-11-09
- **Origin:** change `openspec-pipeline` (`context/changes/openspec-pipeline/research.md`, status `partial`). It un-parks FR-006, which `context/foundation/prd.md:143` listed as a non-goal of the first delivery. It builds on the module split of change `split-route-mjs`, which gave the router the seams used here.

## Context

- FR-006 says "a second pipeline skill sharing the same router and policy". No ADR, slice or design existed for it. ADR-001 states the rule that binds it: the 10x toolkit and OpenSpec are never changed or forked; agent-smith is an add-on.
- OpenSpec (CLI 1.16.1, schema `spec-driven`) gives a router these facts: `openspec status --change <name> --json` (artifact states `ready`, `blocked`, `done`, `skipped`; `isPlanningComplete`), `openspec instructions apply --change <name> --json` (`state` of `blocked`, `ready` or `all_done`; `progress` with `total`, `complete`, `remaining`), `openspec validate <name> --json` (exit 1 on any `ERROR`) and `openspec archive <name> --yes --json` (no prompts). Artifact state is file existence. Task state is the count of `- [x]` lines of `tasks.md`.
- **Verify has no CLI command and writes no file.** The `openspec-verify-change` skill prints a report in chat. Nothing in OpenSpec records a verdict, and the archive skill never reads one.
- OpenSpec has no plan review, no fix step and no phase or Automated/Manual structure. `tasks.md` has checkbox rows only.
- Probe of 2026-11-09 (CLI 1.16.1, scratch project): with an `agent-smith/` folder and a stray `verdict.md` inside `openspec/changes/<name>/`, `validate`, `status`, `list` and `instructions apply` still return valid JSON with the same fields, and `archive --yes --json` moves the whole folder, extra files included, to `openspec/changes/archive/<date>-<name>/`.
- After the split, `route.mjs` is an entry over `state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs` and `isolation.mjs`. The path factory `paths()`, `decide()`, the per-step verification switch of `attachResult()`, `readPlan`, `readReview`, the archive code and `locateSide` of `compare` stay fixed to `context/changes/<id>/` with `plan.md` and `reviews/*.md`. Tiering, budget, provenance, isolation, step commits and rollback take step names from `policy.json` or work on the whole worktree.

## Decision

A second skill, `openspec-pipeline`, runs the OpenSpec skills as step bodies through the same router. The router gains a chain switch. Rules are written as scenarios (ADR-004). The behavior as built, with every threshold, halt text and limit, is in `docs/REFERENCE.md`, section `/agent-smith:openspec-pipeline`.

### Chain seam (D1)

**GIVEN** `init` is called with `--chain openspec` **WHEN** the run starts **THEN** the router **MUST** store `chain: "openspec"` in `meta.json` and read it on every later call.

**GIVEN** a run with no `chain` in `meta.json` **WHEN** the router handles it **THEN** it **MUST** treat it as the `10x` chain, so every existing run and test behaves as before.

**GIVEN** the `openspec` chain **WHEN** the router needs a path **THEN** it **MUST** take it from `paths()` with the chain's root `openspec/changes/<name>/`.

**GIVEN** the `10x` chain **WHEN** `paths()` gains the chain's root **THEN** the router **MUST NOT** change any 10x path.

**GIVEN** the `openspec` chain **WHEN** the router picks the next step **THEN** it **MUST** use a decision function of its own in a new module.

**GIVEN** the `openspec` chain gets its own decision function **WHEN** it is added **THEN** the change **MUST NOT** edit `decide()`.

The second skill is `skills/openspec-pipeline/SKILL.md`. It calls the router at `skills/10x-pipeline/scripts/route.mjs`; it carries no copy.

### Reading OpenSpec state (D2)

**GIVEN** the `openspec` chain **WHEN** the router reads artifact or task state **THEN** it **MUST** read the files itself with the OpenSpec rules (an artifact exists when its file does; a task is complete only as `- [x]` or `- [X]`).

**GIVEN** the `openspec` chain **WHEN** the router needs OpenSpec state **THEN** it **MUST NOT** run the `openspec` CLI.

**GIVEN** the `openspec` binary is on `PATH` **WHEN** the optional contract test runs **THEN** it **SHOULD** compare the router's reading of a fixture change with `openspec status` and `openspec instructions apply` output, and skip when the binary is missing, as `GH_LIVE` does.

The reason: the router makes no network or model call and adds no dependency (ADR-006, ADR-009). A subprocess to a binary the project may not have would add one. A drift from OpenSpec's parser is the price; the contract test bounds it.

### Run state and isolation (D3, D8, D11)

**GIVEN** the `openspec` chain **WHEN** `init` creates run state **THEN** the router **MUST** write `run.jsonl`, `meta.json` and `report.md` under `openspec/changes/<name>/agent-smith/`, so the archive moves them with the change.

**GIVEN** a change that is not under the project's own `openspec/changes/<name>/` (a `--store` change) **WHEN** `init` runs **THEN** it **MUST** halt with a reason, because such a change sits outside the worktree and outside the rollback of ADR-010.

**GIVEN** `context/changes/<name>/` exists or the branch `agent-smith/<name>` belongs to a run of the other chain **WHEN** `init` runs **THEN** it **MUST** halt and name the collision. The branch, worktree and refs keep their ADR-010 names; no prefix is added.

**GIVEN** an isolated `openspec` run **WHEN** the worktree is made **THEN** the orchestrator **MUST** copy `openspec/changes/<name>/` into it as it copies the change folder of a 10x run.

**GIVEN** an isolated `openspec` run **WHEN** it starts **THEN** `openspec/` and the OpenSpec skills **MUST** be committed before the run.

Isolation, the start commit, step commits, rollback, the git-write allowlist and the "never calls `gh`" rule apply unchanged. The start commit commits `openspec/changes/<name>/` for this chain.

### Steps and base tiers (D9, D10)

The chain uses the steps `os-propose`, `os-apply`, `os-verify` and `os-archive`. The `os-` prefix keeps the names clear of `plan`, `implement`, `fix` and `archive`.

**GIVEN** the chain **WHEN** `policy.json` is read **THEN** `steps` **MUST** hold the four steps with these starting tiers, all uncalibrated: `os-propose` at the tier of `plan`, `os-apply` at the tier of `implement`, `os-verify` at the tier of `impl-review`, `os-archive` at the tier of `archive`.

**GIVEN** the chain **WHEN** the router runs **THEN** it **MUST** keep these features: tiering with the ladder and effort floor, the step budget, rigor raised by failed steps, provenance, step commits, rollback, `report.md` and `--pr-comment`.

**GIVEN** the chain **WHEN** the router runs **THEN** it **MUST NOT** run `score`, the pre-plan steps, the phase executors, `manual-verify`, the code re-plans or the confirmation round, because `tasks.md` has no input for them.

A later change may add any of them back.

### Progress and routing (D4)

**GIVEN** `proposal.md`, every `specs/**/*.md` or `tasks.md` is missing (`design.md` is optional, see below) **WHEN** the router picks the next step **THEN** it **MUST** return `os-propose`.

Planning is complete when `proposal.md`, at least one `specs/**/*.md` and `tasks.md` exist (predicate A). The CLI evidence of 2026-11-09 (`context/changes/openspec-pipeline/evidence/check-3-cli.md`) shows that OpenSpec's `isPlanningComplete` stays false without `design.md` while `openspec instructions apply` already reports `state: "ready"`. The router follows apply readiness, because `os-apply` is the step that needs it.

**GIVEN** planning is complete and `tasks.md` has at least one unticked row **WHEN** the router picks the next step **THEN** it **MUST** return `os-apply`.

**GIVEN** every row of `tasks.md` is ticked and no `os-verify` entry exists **WHEN** the router picks the next step **THEN** it **MUST** return `os-verify`.

**GIVEN** `tasks.md` exists with no checkbox row **WHEN** the router picks the next step **THEN** it **MUST** halt for a human, because that is the second form of OpenSpec's `blocked` state.

A step is verified by the file it writes, as in the 10x chain: `os-propose` by the artifact files, `os-apply` by a changed `tasks.md` with more ticks than before, `os-verify` by `verify.md`.

### Verify verdict (D4)

**GIVEN** an `os-verify` step **WHEN** it ends **THEN** the subagent **MUST** write `openspec/changes/<name>/agent-smith/verify.md` whose first line is `Verdict: PASS`, `Verdict: PASS WITH WARNINGS` or `Verdict: FAIL`, followed by `Critical: <n>` and `Warnings: <n>` lines and the report text.

**GIVEN** `Verdict: PASS` or `PASS WITH WARNINGS` in `verify.md` **WHEN** the router picks the next step **THEN** it **MUST** return its `archive` action, which carries the `os-archive` prompt, when the run was started with `--archive`, else `done`.

The router reads the verdict from `verify.md` each time it decides, not from the log entry, so a human edit of the file after a halt routes the next call.

**GIVEN** `Verdict: FAIL` **WHEN** fewer fix loops than the existing fix-loop cap ran **THEN** the router **MUST** return `os-apply` again with the critical findings in its prompt.

**GIVEN** `Verdict: FAIL` **WHEN** as many fix loops as the existing fix-loop cap already ran **THEN** the router **MUST** halt for a human.

The file lives in the run's `agent-smith/` folder so OpenSpec's artifact files stay untouched. ADR-011 does not apply: there are no `### F<n>` blocks and no `Decision` lines. A review-like finding format may follow in a later ADR.

### Archive (D5)

**GIVEN** the run was started with `--archive` **WHEN** the verdict allows it **THEN** the router **MUST** halt instead when `tasks.md` has an unticked row, and otherwise return its `archive` action.

**GIVEN** an `os-archive` step **WHEN** the orchestrator runs it **THEN** the subagent **MUST** run `openspec archive <name> --yes --json` once and report its `archive.archivedAs` and `path`.

**GIVEN** an `os-archive` step **WHEN** the subagent archives **THEN** it **MUST NOT** use the archive skill, whose three prompts and agent-driven merge differ from the CLI's mechanical merge.

The router makes the pre-archive commit as in ADR-010 before it returns the `archive` action. The orchestrator runs the `os-archive` step in one subagent, as it runs the 10x `archive` step: the step has no log entry, no usage figure and no report row. The orchestrator then calls `verify-archive <name> --chain openspec --path <archivePath>`, which verifies the move from files (`openspec/changes/archive/<date>-<name>/` exists and `openspec/changes/<name>/` is gone), in the way `verify-archive` does for 10x. A halt is never archived.

### Unattended decision guides (D6)

**GIVEN** an OpenSpec skill would ask the user **WHEN** it runs inside a step subagent **THEN** the step prompt **MUST** carry a decision guide as rules, in the style of `frame-unattended.md`: decide from the evidence and list the decision as an assumption, and when no evidence-backed answer exists end `blocked` with `signals.needsHuman`.

The guides cover the points found in the skills: missing input and "material ambiguity" in propose, an unclear task or design issue in apply, and nothing in verify, which is read-only.

### Docs and manifests (D12)

The new skill folder, its prompts and tests go into the `AGENTS.md` Project Structure list and the README layout block. `plugin.json`, `marketplace.json` and the README one-liner stay aligned (`tools/version-check.mjs`). `version` is set only by the release PR. Whether `skills/` is auto-discovered without a manifest list is checked in the precondition below.

## Preconditions

The status moves to Accepted only after these checks. All four passed on 2026-11-09; the results and their evidence are under "Results" below.

1. **Skill reach.** A subagent started in `.claude/worktrees/agent-smith-<name>` can call the OpenSpec skills. They are project-level and untracked in this repository today; if they do not resolve, they must be committed before a run, or the step prompts must carry the instructions.
2. **Router path.** `skills/openspec-pipeline/SKILL.md` reaches `../10x-pipeline/scripts/route.mjs` when the plugin is installed. If it does not, the router moves to a shared folder in a separate change.
3. **Unattended skills.** Propose, apply and the CLI archive run in a subagent with the decision guides, and stop where the guides say. One live run of a small change settles it.
4. **Plugin discovery.** Claude Code finds the second skill without a list in `plugin.json`.

### Results (2026-11-09)

Evidence lives in `context/changes/openspec-pipeline/evidence/`.

1. **Skill reach: pass.** A subagent working in the run worktree lists all `openspec-*` skills although the worktree has no `.claude/skills/`: the skills resolve from the session's project, not from the worktree files. The live probes of check 3 ran the propose, apply and verify skills from a scratch project with no skills of its own. A session started inside the worktree would not see them until a commit that tracks them is on the run branch, so the commit rule of D11 stays. Evidence: `check-1-skill-reach.md`, `check-3-live.md`.
2. **Router path: pass.** The installed plugin cache (`~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/`) is a copy of the whole repository tree, so `skills/10x-pipeline/scripts/route.mjs` sits beside any second folder under `skills/` and `../10x-pipeline/scripts/route.mjs` resolves from it. Evidence: `check-2-router-path.md`.
3. **Unattended skills: pass.** Five live probes with the guides `prompts/os-propose.md`, `os-apply.md`, `os-verify.md` and `os-archive.md`: propose, apply and verify ended `done` with the expected files, the CLI archive moved the change, `agent-smith/` included, and merged its spec, and propose on an empty change with an empty goal ended `blocked` with `signals.needsHuman`. No probe printed a question. The CLI facts fix the planning predicate as A (`proposal.md`, at least one `specs/**/*.md`, `tasks.md`; `design.md` optional), see D4. Evidence: `check-3-cli.md`, `check-3-live.md`.
4. **Plugin discovery: pass.** Neither this plugin's `plugin.json` nor the installed `sentry` plugin's has a skills key, and every `skills/*/SKILL.md` of `sentry` appears as `sentry:<name>` in the session. A live listing of `agent-smith:openspec-pipeline` from the worktree plugin is a manual check of the implementation. Evidence: `check-4-plugin-discovery.md`.

## Consequences

- **Good:** one router, one policy, one report format and one override file for both chains. The existing 10x runs, the stable surface of the PRD and `helpers.mjs` do not change. OpenSpec is used as it ships.
- **Cost:** the router gains a chain switch in `paths()`, `init`, `next`, `attachResult()` and `compare`'s `locateSide`, and a new decision module. The tests need a helper file of their own, because `helpers.mjs` stays as it was and hard-codes `context/changes/`.
- **Cost:** reading `tasks.md` and artifact files in the router can drift from the OpenSpec parser. The contract test bounds it; it does not remove it.
- **Dropped in v1:** score, pre-plan steps, executors, `manual-verify`, plan review and the review-finding routing. An OpenSpec run is therefore cheaper and less checked than a 10x run. This is the main product gap and the first thing to revisit.
- **Uncalibrated:** the four base tiers, as every other threshold of ADR-001 and ADR-003.
- **Follow-ups:** refresh the line anchors of `research.md` against the split modules; the `PRD` and roadmap still say FR-006 is parked.

## Sources

- `context/changes/openspec-pipeline/research.md` and its open questions 1 to 12; the OpenSpec probe of 2026-11-09 (extra folder and file inside the change folder, CLI 1.16.1).
- `context/foundation/shape-notes.md:19-20`, `:50`; `context/foundation/prd.md:98`, `:143`; `docs/ADR/ADR-001-phased-complexity-routing.md:54`.
- `docs/ADR/ADR-004`, `ADR-006`, `ADR-009`, `ADR-010`, `ADR-011` and `ADR-012`.

## Amendment 1: the chain's definitions live in its skill folder (change proper-structure-of-rules)

### Context

- The OpenSpec definitions sat inside the 10x skill: the `os-` guides in `skills/10x-pipeline/prompts/`, the `os-` steps and prompts in `skills/10x-pipeline/policy.json`, the module `openspec.mjs` and seven OpenSpec test files. `skills/openspec-pipeline/` held `SKILL.md` only.

### Rules

- **GIVEN** a definition that only the OpenSpec chain uses **WHEN** it is added or moved **THEN** it **MUST** live in `skills/openspec-pipeline/`: `policy.json` (the `os-` steps and prompts), `prompts/os-*.md`, `rules/chain.md` (ADR-023), `scripts/openspec.mjs` and `test/`.
- **GIVEN** the router loads the policy **WHEN** it reads the plugin files **THEN** it **MUST** merge `skills/10x-pipeline/policy.json` with `skills/openspec-pipeline/policy.json` (`deepMerge(base, fragment)`, disjoint keys) into one plugin policy, and then merge the one project override on top, for both chains alike.
- **GIVEN** a policy prompt part **WHEN** it starts with `@<skill>/prompts/` **THEN** the router **MUST** read it from `skills/<skill>/prompts/`, with `<skill>` matching `[a-z0-9][a-z0-9-]*`; the OpenSpec templates use `@openspec-pipeline/prompts/os-*.md`.
- **GIVEN** CI or a contributor runs the suite **WHEN** they name the test files **THEN** the command **MUST** include `skills/openspec-pipeline/test/*.test.mjs`.

### Consequences

- The first Consequence above now reads: one router, one merged plugin policy from two files with disjoint keys, one report format and one override file for both chains.
- The router stays in `skills/10x-pipeline/scripts/`, so the line "it carries no copy" in D1 stays true; `openspec.mjs` imports `state.mjs` from there.
- A project override that names `@prompts/os-*.md` halts with "cannot be read"; the fix is `@openspec-pipeline/prompts/os-*.md`.
