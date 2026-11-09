# OpenSpec Chain on the Shared Router — Plan Brief

> Full plan: `context/changes/openspec-pipeline/plan.md`
> Research: `context/changes/openspec-pipeline/research.md`

## What & Why

Implement ADR-013: a second pipeline skill, `skills/openspec-pipeline/`, runs an existing OpenSpec change through `os-propose`, `os-apply`, `os-verify` and `os-archive` on the existing router, with each step in its own subagent. The owner asked for OpenSpec support that keeps "the general OpenSpec way of work" (FR-006), and ADR-013 settled the design on 2026-11-09. Its four preconditions are checked first, because a failed check changes the design before any code is written.

## Starting Point

The router (`route.mjs` plus `state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs`, `isolation.mjs`) is fixed to the 10x layout: `paths()`, the archive lookup, the isolation probes, the start commit, `verify-archive` and `compare` all hard-code `context/changes/` and `context/archive/`, and `decide()` knows only the 10x steps. OpenSpec CLI 1.16.1 is installed, but the repository tracks no `openspec/` folder and no OpenSpec skill.

## Desired End State

`/agent-smith:openspec-pipeline <name> [goal] [--archive] [--pr-comment]` runs an OpenSpec change in its own worktree, with tiering, budget, rigor from failures, provenance, step commits, rollback, `report.md` and the PR comment. A `verify.md` verdict ends the run or starts at most two fix loops; `--archive` ends it with the router's pre-archive commit and `openspec archive <name> --yes --json`. Every 10x run behaves exactly as before, and ADR-013 records the result of each precondition with its evidence.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Chain seam | `--chain openspec` stored as `meta.chain`, chain-aware `paths()`, own decision module, `decide()` untouched | One router and policy for both chains, with no risk to the 10x state machine. | ADR-013 D1 |
| Reading state | The router reads files itself; the CLI runs only in `os-archive` and the optional contract test | No subprocess dependency in the router (ADR-006); the contract test bounds the drift. | ADR-013 D2 |
| Run state and collisions | Under `openspec/changes/<name>/agent-smith/`; halt on a missing local change (covers `--store`) or on `context/changes/<name>/` | The state moves with the archive, and a store change sits outside the worktree and rollback. | ADR-013 D3, D8; Plan |
| Planning complete | `proposal.md`, at least one `specs/**/*.md` and `tasks.md`; `design.md` optional unless the Phase 1 CLI evidence shows apply needs it | Matches what `os-apply` needs, and the propose skill treats `design` as conditional. | Research; Plan |
| Chain detection | Without `--chain`, an OpenSpec `meta.json` with `chain: "openspec"` selects the chain; a contradicting flag halts | Lets direct CLI calls work and keeps 10x as the default. | Plan |
| Verdict | `verify.md` with `Verdict`, `Critical`, `Warnings` lines and a `## Critical` list; `Critical` above 0 reads as `FAIL` | A conservative, parseable verdict with the findings the fix prompt needs. | ADR-013 D4; Plan |
| Fix loop | `os-apply` with template `os-apply-fix` and the critical lines, at most `limits.maxFixLoops`; verified by status like the 10x `fix` | Reuses the existing cap and the existing fix verification rule. | ADR-013 D4; Plan |
| Archive | Router pre-archive commit and local-date `archivePath`; the subagent runs the CLI once and commits `chore(archive): close <name>` | Mechanical merge with no prompts, and a clean worktree after the move. | ADR-013 D5; Plan |
| Guides | Four rule files `prompts/os-*.md` in the `frame-unattended.md` style | Each OpenSpec ask point gets a fixed answer or a `blocked` with `signals.needsHuman`. | ADR-013 D6 |
| Precondition gate | A failed check stops with `blocked`; a check that cannot run is recorded "not run" and ADR-013 stays Proposed | Follows `change.md` ("a check that fails changes the design") without stalling on tooling limits. | Plan |

## Scope

**In scope:**
- Evidence for the four ADR-013 checks and their results in ADR-013.
- The four decision guides and their policy templates.
- The chain switch in `paths()`, `init`, `next`, `status`, `risk`, `verify-archive`, `compare`, the isolation probes, the start commit and `archiveDone`.
- `scripts/openspec.mjs`: OpenSpec reader, routing, verification, verdict.
- `skills/openspec-pipeline/SKILL.md`, new tests, documentation and manifest descriptions.

**Out of scope:**
- Any change to the 10x chain, `helpers.mjs` or `loops-existing.test.mjs`.
- Score, pre-plan steps, executors, `manual-verify`, code re-plans, confirmation round, plan review and the cheaper first attempt for the OpenSpec chain.
- Store-hosted changes, a finding format for `verify.md`, a move of the router, edits to `pr-comment.mjs`, PRD and roadmap updates, the version bump.

## Architecture / Approach

The new module `scripts/openspec.mjs` sits between `steps.mjs` and `flow.mjs` in the import order. `route.mjs` resolves the chain once per command and, for `openspec`, calls `decideOpenspec` instead of `decide()`; `attachResult` gets `os-` cases that call the OpenSpec verification helpers; `archiveDone`, the isolation probes and the read-only commands take the chain's root. The skill is a sibling of the 10x skill and calls `../10x-pipeline/scripts/route.mjs` with `--chain openspec` on every call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Preconditions and decision guides | Evidence for the four checks, four guides, ADR-013 results | A failed check stops the run; the live check may not launch at subagent depth |
| 2. Chain switch, run state and routing order | `--chain`, OpenSpec paths, collisions, `os-propose`/`os-apply`/`os-verify` order | A 10x path or output changes by accident |
| 3. Step verification, verdict and fix loop | File-based verification, `verify.md` routing, fix loop, isolation for OpenSpec | Verification too loose or too strict for real skill output |
| 4. Archive and read-only commands | Pre-archive commit, `os-archive` action, `verify-archive`, `compare`, contract test | Archive date at midnight; drift from the OpenSpec parser |
| 5. Skill and documentation | `openspec-pipeline` skill, its test, AGENTS, README, REFERENCE, manifests | Skill discovery and the router path in an installed plugin |

**Prerequisites:** OpenSpec CLI on `PATH` for the checks and the contract test; Node 24; the run's worktree on `agent-smith/openspec-pipeline`.
**Estimated effort:** ~5 implementation sessions, one per phase; Phase 1 includes five live probe subagents.

## Open Risks & Assumptions

- The planning predicate is fixed by the Phase 1 CLI evidence (A or B); the planning session could not run the probe.
- Check 3 needs a subagent launched from inside the implementing subagent; if that depth is not available, the check is recorded "not run", ADR-013 stays Proposed and row 1.8 stays for a person.
- `Critical` above 0 overriding a `PASS` line is a planning choice, not stated in ADR-013.
- The `os-archive` subagent commits the archive move; ADR-013 D5 names only the CLI call.
- File-based reading can drift from OpenSpec's parser; the contract test bounds it only where the CLI is installed.

## Success Criteria (Summary)

- A small OpenSpec change runs end to end through `/agent-smith:openspec-pipeline`, unattended, and ends `done` or archived with a `report.md`.
- The full existing suite passes, with only data lines added to `ladder.test.mjs` and `advisor.test.mjs` for the new policy keys, so the 10x chain is unchanged.
- ADR-013 shows the four precondition results with evidence.
