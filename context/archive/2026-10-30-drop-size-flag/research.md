---
date: 2026-10-30T17:28:25+0100
researcher: Claude Code (claude-sonnet-5-5)
git_commit: 2ce2577
branch: main
repository: agent-smith
topic: "What does removing the --size flag touch, and what does the router lose?"
tags: [research, codebase, route.mjs, policy.json, size-flag, routing]
status: complete
last_updated: 2026-10-30
last_updated_by: Claude Code (claude-sonnet-5-5)
---

# Research: What does removing the --size flag touch, and what does the router lose?

**Date**: 2026-10-30T17:28:25+0100
**Researcher**: Claude Code (claude-sonnet-5-5)
**Git Commit**: 2ce2577
**Branch**: main
**Repository**: agent-smith

## Research Question

The owner wants to drop the `--size s|m|l` parameter of `/agent-smith:10x-pipeline`, because the router is meant to pick the model and effort mix from the change itself. Which files use the flag, what does it change in routing today, and what would be lost if it were removed?

## Summary

Scope: the repository at commit `2ce2577`, excluding `context/archive/` (read-only by `AGENTS.md`) except where it records past decisions.

- **What the flag does.** `--size` is stored in `meta.json` by `init` (`route.mjs:470-476`). It changes the tier in exactly two places. The first is the first `plan` step only: `sizeBump` (-1, 0, +1) is added as `d.bump` (`route.mjs:260`, `policy.json:21`), and `--size s` also marks that step "simple", which takes a further -1 (`route.mjs:338-339`, `policy.json:25`). The second is every step after the plan: `--size l` blocks the "simple" discount (`route.mjs:344`). `s` and `m` behave identically for steps after the first plan (this inspected path only: `route.mjs:343-345` tests only `!== "l"`).
- **What would be lost.** `--size s` is the only inspected way to start the first plan below tier 4. The `plan` step has `baseTier` 4 (opus/high) and `minTier` 2 (`policy.json:12`). With `--size s` it runs at tier 2 (sonnet/medium), with `--size m` at tier 4, with `--size l` at tier 5 (opus/xhigh). Without any replacement signal, every first plan would run on opus/high. The archived S-01 plan already recorded this as a known cost: "Without `--size s` the first plan still starts at tier 4 (opus/high), above the Sonnet-5.5 high baseline" (`context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:35`).
- **No replacement signal exists yet.** Before the first plan, the router has no plan to measure. The only inputs it holds are the change id, the `--goal` text and the existence of `change.md`. The goal text is used only for the prompt and the report (`route.mjs:158, 408`), and `change.md` is checked for existence only (`route.mjs:256`).
- **Blast radius.** The flag appears in 5 source/doc files that ship with the plugin (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, and `AGENTS.md` as a command example), in 3 product documents (`prd.md`, `shape-notes.md`, `ADR-001`), and in the archived changes, which stay untouched.

## Detailed Findings

### Where the flag enters and is stored

- `init` reads `flags.size`, falls back to the stored `prev.size`, then to `"m"`, and writes `size` and `sizeBump` into `meta.json` (`skills/10x-pipeline/scripts/route.mjs:470-476`). A resumed run keeps its stored size unless `--size` is passed again (`route.mjs:470`).
- The flag is parsed by the generic `parseFlags` (`route.mjs:24-33`), so removing the `--size` handling needs no parser change. An unknown `--size` argument would be ignored silently, not rejected.
- The usage string and the file header comment name the flag (`route.mjs:7`, `route.mjs:461`).
- `SKILL.md` parses `--size s|m|l` (default `m`) and passes `--size <size>` to `init` (`skills/10x-pipeline/SKILL.md:9, 28, 30`).

### Where the flag changes the tier

1. **First plan bump.** `decide` returns `bump: meta.sizeBump` for the first `plan` step, that is when no plan or no `## Progress` exists (`route.mjs:259-260`). `tierFor` adds `d.bump` (`route.mjs:357`). `plan-revise` steps carry no size bump (they use `E.rethinkBump` or `E.reviseBump`, `route.mjs:277-283`).
2. **First plan "simple" signal.** For `d.step === "plan"`, `simpleSignal` returns simple only when the template is the first `plan`, `meta.size === "s"` and no step has failed (`route.mjs:337-341`). The discount for `plan` is 1 (`policy.json:25`).
3. **Blocking the discount.** For the other steps, `simpleSignal` requires `meta.size !== "l"` among its conditions (`route.mjs:343-344`).

Resulting first-plan tiers, from `baseTier` 4 (`policy.json:12`) with no failures: `s` gives 4 - 1 (bump) - 1 (discount) = 2, which is sonnet/medium (`policy.json:5`). `m` gives 4, opus/high (`policy.json:7`). `l` gives 5, opus/xhigh (`policy.json:8`). The archived S-01 plan lists the same `s` and `m` results as its checks 2.4 (`context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:241`).

### Where the flag is only displayed

- The report prints `Size: ${meta.size ?? "-"}` (`route.mjs:159`), and `README.md:41` describes the report as holding "goal, size and outcome". Removing the flag makes this line always `-` unless it is removed too.

### What a removal leaves behind

- Existing `meta.json` files may hold `size` and `sizeBump`. After a removal, nothing reads them. The fallback meta in `next` and `status` already carries `sizeBump: 0` (`route.mjs:379, 451`), so those two lines also name the field.
- `tierFor` guards the bump with `if (d.bump)` (`route.mjs:357`), so an undefined `bump` on the first plan is safe (this inspected path only).
- A project override file may set `complexity.sizeBump`. The merge is a deep merge (`route.mjs:35`), so an unused key would be ignored. No override file exists in this repository (`context/foundation/` holds `prd.md`, `README.md`, `roadmap.md`, `shape-notes.md`).
- No automated tests exist (`AGENTS.md` Testing), so the only check is the scratch-folder run described there.

### Documents that name the flag

- `README.md:18` (usage line) and `README.md:32` ("a simple change (a small plan or `--size s`)"), plus `README.md:41` (report contents).
- `AGENTS.md:25` uses `--size m` in the `init` command example.
- `SKILL.md:9, 28, 30, 62-64`. Lines 62-64 are the "How the tier moves" list. `AGENTS.md` requires that list and the `README.md` routing bullets to be updated when tier logic changes.
- `context/foundation/prd.md:23, 35, 83, 91, 125, 127` name the flag as a shipped parameter or as a Phase 1 routing signal.
- `context/foundation/shape-notes.md:36, 137`.
- `docs/ADR/ADR-001-phased-complexity-routing.md:10, 40`. The ADR decision (line 40) lists "the size flag" among the Phase 1 deterministic signals. Line 59 is a different thing, the rejected "single size label" alternative, and does not name the flag.

## Code References

- `skills/10x-pipeline/scripts/route.mjs:7` - header comment with the `--size` usage
- `skills/10x-pipeline/scripts/route.mjs:159` - `Size:` line in the report
- `skills/10x-pipeline/scripts/route.mjs:260` - first plan carries `meta.sizeBump`
- `skills/10x-pipeline/scripts/route.mjs:337-345` - `simpleSignal`: `--size s` on the first plan, `--size l` blocks the discount
- `skills/10x-pipeline/scripts/route.mjs:357` - `d.bump` added to the tier
- `skills/10x-pipeline/scripts/route.mjs:379, 451` - fallback meta with `sizeBump: 0`
- `skills/10x-pipeline/scripts/route.mjs:461` - usage string
- `skills/10x-pipeline/scripts/route.mjs:470-476` - `init` stores `size` and `sizeBump`
- `skills/10x-pipeline/policy.json:12` - `plan` step: `baseTier` 4, `minTier` 2
- `skills/10x-pipeline/policy.json:21` - `sizeBump` map
- `skills/10x-pipeline/policy.json:25` - `discount.plan` is 1
- `skills/10x-pipeline/SKILL.md:9, 28, 30, 62-64` - argument hint, parsing, `init` call, tier list
- `README.md:18, 32, 41` - usage line, routing bullet, report description
- `AGENTS.md:25` - `init` command example

## Architecture Insights

- Routing decisions are meant to live in `route.mjs` and `policy.json` (`AGENTS.md` Hard Rules). The flag is the one routing input that comes from the user's command line, not from artifacts or the run log.
- All other tier movements read evidence the router already holds: the phase and row counts of `plan.md`, review verdicts and counts, and failures in the log (`route.mjs:259-325`). Only the first plan step has none of these, which is why the flag was attached there.
- The "simple" discount for steps after the plan is already artifact-driven (at most 1 phase and 6 Progress rows, `policy.json:23-24`). Removing the flag leaves that path intact; it only drops the `l` veto.

## Historical Context (from prior changes)

- `context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:35` - the S-01 plan states that the first plan stays on opus/high without `--size s`, and defers lowering `steps.plan.baseTier`.
- `context/archive/2026-10-30-cheaper-routing-simple-change/plan-brief.md:53` - lists the same risk: the usage drop may depend on passing `--size s`.
- `context/archive/2026-10-30-cheaper-routing-simple-change/plan-brief.md:25` - the first-plan signal is `--size s` only, because no plan exists yet to count.
- `context/archive/2026-10-30-cheaper-routing-simple-change/reviews/plan-review.md:36-42` - finding F2 raised that the default `--size m` leaves the plan step on opus/high.
- `context/archive/2026-10-30-cheaper-routing-simple-change/reviews/impl-review.md:34-46` - finding F2 offers, as Fix B, dropping the `plan` discount and keeping `sizeBump` as the only `--size s` effect. The result is not recorded here.
- The flag itself predates both archived changes. It is in the repository's first commit (`0e26587`, from `git log -S"--size"`).

## Related Research

None. No other `research.md` exists under `context/changes/` or `context/archive/` for this topic.

## Open Questions

These are product decisions for `/10x-plan`, not research gaps:

1. **What sets the first plan's tier once the flag is gone?** Options visible from the evidence: lower `steps.plan.baseTier` in `policy.json`, derive a signal from the goal text or `change.md`, or accept opus/high for every first plan. The router holds no content signal for the first plan today.
2. **Is the loss of a cheap first plan acceptable?** `--size s` is the only inspected path to a first plan below tier 4. Removing it without a replacement raises the cost of every small change's first step.
3. **Do the PRD and ADR-001 text change?** Both name the size flag as a Phase 1 routing signal (`prd.md:127`, `ADR-001:40`). Dropping the flag contradicts them. Whether to edit them or note the deviation is undecided.
4. **Does the report keep a `Size:` line?** With no flag it would always read `-`.
