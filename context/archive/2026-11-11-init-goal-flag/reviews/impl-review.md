<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: init --goal parsing Implementation Plan

- **Plan**: context/changes/init-goal-flag/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

Reviewed in this subagent, no sub-agent launched. Diff range `102a5a9..c5fbf97` (start commit to step 4). Every code and doc file in the diff is named in the plan (`state.mjs`, `route.mjs`, `route.test.mjs`, `AGENTS.md`, `docs/REFERENCE.md`); no planned file is missing. No ADR, no `SKILL.md` change, as the plan says.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- Router suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (rows 1.1, 2.2): my full run did not finish in this review, because the machine was at load average above 200 from parallel runs, so I could not read a total. The implement step recorded it green. What I re-ran here, all green: `route.test.mjs` with `openspec-chain.test.mjs` and `late-usage.test.mjs` (92 of 92), `no-recursive-delete.test.mjs` with `rules.test.mjs` and `archive-gate.test.mjs` (32 of 32), and the 8 new init-goal tests by name (8 of 8).
- 1.2 and 1.3: covered by the new tests `a goal that starts with -- is stored verbatim` and `an unquoted goal halts at init, names the leftover words and writes nothing` (halt, exit 1, no `agent-smith/` folder).
- 2.1, 2.3: the new tests sit in `route.test.mjs` and pass; `no-recursive-delete.test.mjs` passes and the diff adds no recursive or forced delete form.
- Manual 1.4: `evidence/command-init-quoted-goal.txt` shows `init` with a quoted goal and `--rigor standard` returning a `run` step, and `status` printing valid JSON.
- Manual 2.4: the `AGENTS.md` sentence and the `REFERENCE.md` bullet match the halt text in `route.mjs` word for word.

## Findings

### F1 — `--_` swallows the word after it from the halt message

- **Severity**: OBSERVATION
- **Impact**: LOW — cosmetic; the run still halts and writes nothing
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/state.mjs:19-22
- **Detail**: `--_` is not a value flag, so `init demo --goal fix --_ the bug` reads `the` as the value of `--_` and lists only `bug` as leftover. The check cannot be bypassed (`flags._` is assigned after the loop, and the test pins that), but the message names fewer words than were typed. Only a hand-typed `--_` does this.
- **Fix**: None needed.
- **Decision**: APPLIED - 5e73030. An argument with no flag name (`--`, `--_`, `--=x`) is now a leftover word and takes no value, so the halt names `--_ the bug`; `init` also halts on a flag it does not read.

### F2 — `--goal=text` is still not understood

- **Severity**: OBSERVATION
- **Impact**: LOW — outside the plan
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/state.mjs:19
- **Detail**: The `--key=value` form gives a flag named `goal=text` that no code reads, so the goal stays empty. This is the behaviour before the change and the plan does not cover it; neither orchestrator skill uses it. Noted because the issue is about goals that are silently dropped.
- **Fix**: None in this change.
- **Decision**: APPLIED - 5e73030. `parseFlags` reads `--key=value`, split at the first `=`, for every flag.
