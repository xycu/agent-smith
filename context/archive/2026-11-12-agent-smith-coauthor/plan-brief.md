# Agent Smith Co-Authors Router Commits — Plan Brief

> Full plan: `context/changes/agent-smith-coauthor/plan.md`

## What & Why

Agent Smith (https://github.com/agent-smith-exile, Agent Smith <agent-smith@ksycki.pl>) should appear as co-author on the commits the pipeline makes, the way Claude does through its `Co-Authored-By` trailer.

## Starting Point

The router makes start, step, pre-archive and late-usage commits through `routerCommit`, a rollback snapshot through `commit-tree`, and `open-pr.mjs` commits leftovers. None adds a trailer.

## Desired End State

Each of those commits ends with `Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>`; `coAuthor: null` in the override turns it off.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Which commits | Router and `open-pr.mjs` commits | Deterministic code paths; subagent commits keep Claude's trailer |
| Where the identity lives | `coAuthor` key in `policy.json` | AGENTS.md: policy belongs in policy.json |
| How it is applied | `git commit --trailer` (commit-tree: second `-m`) | Correct trailer format; git here is 2.54 |
| Bad config | Router halts; `open-pr.mjs` skips the trailer | Router halts on bad policy elsewhere; the PR step must not fail |
| Provenance | `coAuthor` added to `provenance.ignore` | Cannot change routing |
| Testing | Automatic, hermetic scratch repos; no Chrome | No UI involved |

## Scope

**In scope:** policy key, helper and validation, router commits, rollback snapshot, `open-pr.mjs`, tests, docs, ADR-020.

**Out of scope:** subagent-made commits, author identity, rewriting history, browser tests.

## Architecture / Approach

One pure helper in `state.mjs` renders the trailer; `isolation.mjs` passes it to `routerCommit` and the snapshot. `open-pr.mjs` re-reads the same key itself because it may not import router modules.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Policy key and router commits | Trailer on router commits and snapshot, tests | Existing tests comparing whole commit bodies |
| 2. `open-pr.mjs` | Trailer on leftovers commit | Duplicated validation drifts |
| 3. Docs, ADR, full run | Docs, ADR-020, green suite, scratch run | None notable |

**Prerequisites:** git 2.32+ (2.54 present), Node 24. **Estimated effort:** small, about three commits.

## References

- `skills/10x-pipeline/scripts/isolation.mjs`, `open-pr.mjs`, `state.mjs`, `policy.json`
