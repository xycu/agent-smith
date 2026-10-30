# Rigor Levels, Churn Risk and Skip Logging — Plan Brief

> Full plan: `context/changes/rigor-levels/plan.md`
> Research: `context/changes/rigor-levels/research.md`

## What & Why

Give each pipeline run a rigor level (`lean`, `standard`, `thorough`) that the router derives from cheap signals and only ever raises. `lean` skips plan-review, which saves usage on simple changes, but only when the churn risk could be measured. A change that touches paths which change very often in git history never runs at `lean` (FR-010). Skipped steps are logged with a reason, so the report stays honest.

## Starting Point

`decide()` in `route.mjs` is a linear chain with no skip path. `init` rewrites `meta.json` to `{ id, goal }` and drops any stored state. The step budget is one fixed number. Effort floors are static per step. The router has no git access and the repo has no tests.

## Desired End State

`init` stores a rigor level that survives resume. At `lean` the router skips plan-review, writes a skip entry to `run.jsonl`, and lists it in `report.md`. Interactive steps get an effort floor that depends on the level. The budget scales per level. A RESULT `signals` object is sanitized, can raise rigor, and `needsHuman` halts the run. `node --test skills/10x-pipeline/test/*.test.mjs` covers all of it, including the GIVEN/WHEN/THEN rule form of prompt text.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Plan-review at `lean` | Skipped; elevated risk never runs at `lean` | Owner decision, replaces the "clean plan" definition | Research |
| Risk paths | Churn from git history, counted up to the run's start commit | No LLM, fits ADR-001 Phase 1; own commits must not make files hot | Research / Plan |
| Skip logging | Entry in `run.jsonl` with no `n`, `ok` or `result`, plus the churn source | Keeps budget, numbering, streaks and freshness correct | Research |
| Skip needs measured risk | No skip when git history is missing, short or unreachable, or the plan names no path | FR-010: "could not measure" must not read as "not hot" | Plan review |
| Persistence | `init` keeps all of `meta.json`; the `needsHuman` ack lives on the log entry | A field whitelist drops every new field; the log survives `init` | Plan review |
| Effort floor | Effort names per level, applied last in `tierFor` | Survives a custom ladder; floor wins over discounts | Research / Plan |
| Rule form | Copy life-to-lore ADR-012; `node:test` check | Test can enforce the form without npm dependencies | Research |
| ADR numbers | ADR-003 rigor design, ADR-004 rule form | change.md names ADR-003 as the shared design | Plan |
| Start level | `short` goal is `lean`; `plain` and `hard` are `standard`; `--rigor` sets the start, then only raises | Hard keyword already keeps full plan effort; flag lets the owner force `lean` | Plan |
| Budget | Delta on `limits.maxTotalSteps`: -4, 0, +4 | One source for the base number; uncalibrated | Plan |
| Tests | CLI black-box, plus a read-only `risk` subcommand | `route.mjs` runs on import and exports nothing | Plan |

## Scope

**In scope:** rigor level and persistence; `--rigor`; churn risk paths (plan paths, then diff); `lean` skips plan-review; budget and effort floor per level; skip entries with correct counts and report section; `signals` sanitizer and `needsHuman` halt; prompt suffix as rules; `node:test` rule check; ADR-003 skeleton, ADR-004; SKILL.md, README, AGENTS.md, PRD FR-002/FR-010 sync.

**Out of scope:** pre-plan steps, executors, manual-row automation, archive adapter, lesson candidates (changes 2 to 4); skipping impl-review; calibration; LLM scoring.

## Architecture / Approach

Rigor is resolved at the top of `next()` from stored level, goal class, phase count, failures, churn hits and signals, then written to `meta.json` only when it rises. `decide()` can return a skip, which `next()` logs and re-decides. Churn is one `git log` per `next` through `node:child_process`, with a small glob matcher. Everything is data in `policy.json` (`rigor`, `risk`) so a project can override it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Rule form | ADR-004 and `rules.test.mjs` | Test too strict for existing prompts (85 rules already pass) |
| 2. Rigor core | Level, persistence, budget, effort floor, test harness | Floor raises plan-review and impl-review cost at `standard` |
| 3. Churn | Hot paths, plan and diff inputs, `risk` command | Git edge cases; uncalibrated thresholds |
| 4. Skip entries | `lean` skips plan-review; counts, report, status | A skip entry breaks a count nobody listed |
| 5. Signals | Sanitizer, rigor raise, `needsHuman` halt, suffix rules | Rule suffix changes subagent behavior everywhere |
| 6. Docs | ADR-003, SKILL.md, README, AGENTS.md, PRD | Docs drift from the router |

**Prerequisites:** research done; Node 18 or later; `git` for churn tests.
**Estimated effort:** about 6 sessions, one per phase; Phases 2 to 4 carry most of the risk.

## Open Risks & Assumptions

- The effort floor is a deliberate cost increase at `standard` (plan-review and impl-review move up one tier); `lean` keeps today's tiers.
- All thresholds (phases 3/6, failures 1/3, budget deltas, churn numbers) are uncalibrated; no real run data exists.
- Plan-review is skipped only before implementation starts; once any `implement` or `fix` entry exists (even a failed one) a rigor rise does not bring it back.
- At `lean` in a repo with no usable history (under 10 commits, no git) plan-review still runs: the saving needs a measured risk. This is a plan decision, not an owner one.
- Churn is blind to a risky file that rarely changes, and to a young repo with fewer than 10 commits.
- Node 18 is not available on this machine (Node 24); the plan bans Node 20+ APIs and adds a manual Node 18 run.
- Research Follow-up 4 (archive adapter split) belongs to a later change; this plan uses Follow-ups 1 to 3.

## Success Criteria (Summary)

- A lean run on a scratch change skips plan-review, logs why, and shows it in `report.md`.
- A plan that names a hot file runs plan-review and never reports `lean`.
- Every prompt rule line passes the form check; the full test suite is green.
- SKILL.md, README, AGENTS.md, ADR-003 and the PRD describe the same behavior.
