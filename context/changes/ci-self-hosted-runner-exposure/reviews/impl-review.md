<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Harden the OpenSpec install on TrueNAS CI

- **Plan**: context/changes/ci-self-hosted-runner-exposure/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Diff against the merge base touches only `.github/workflows/ci.yml` (one line), `tools/test/ci-runner.test.mjs` (the two authorized assertions), `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` and `docs/ADR/README.md`, plus the change folder. Runner expression, pins, permissions and release placement are untouched.
- `--ignore-scripts` sits immediately before the package argument, after `--package-lock=false`; prefix, cache, userconfig, version check and export are preserved.
- `node --test tools/test/ci-runner.test.mjs`: 14 pass, 0 fail.
- `rg -n '^## Amendment 3'` hits ADR-020 line 81; `rg -n 'ADR-020.*Amendment 3'` hits the index row; status line reads "Amendments 1 through 3".
- `node tools/workflow-pins.mjs` exit 0; `node tools/version-check.mjs` OK (1.15.4).
- Reviewer re-ran the plan's local pre-check: `@fission-ai/openspec@2.0.0` installed with `--ignore-scripts` into a scratch prefix reports `2.0.0`; 75 installed manifests, none declares `preinstall`, `install` or `postinstall`; no `binding.gyp` in the tree. So the flag skips no hook today.
- Amendment 3 content checked against the plan contract: install protection and its limits, events that run on the NAS, fork approval gate with UI name, required value, observed value, date and source, accepted same-repository risk (dated 2026-11-21, includes automation). Anchors `#rows-35-and-36` and `#accepted-residual-risk` exist.
- Full suite not run, by orchestrator instruction; CI runs it.

## Findings

### F1 — Reach evidence still open in Amendment 3

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:91
- **Detail**: The amendment names the reach unknowns (hosts, services, restrictions, per-runner differences) as "awaiting dated owner confirmation". This is the plan's allowed state while the owner's evidence is outstanding, and Progress row 2.2 stays open. These facts are owner-only network knowledge; the repo cannot supply them.
- **Fix**: Owner supplies the dated description of reachable hosts and service roles; replace the awaiting sentence with it and tick 2.2.
- **Decision**: PENDING — observation, left open per orchestrator rule; the owner must supply and date the reachable home-network hosts and services.

### F2 — Published PR CI not yet observed

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ci-self-hosted-runner-exposure/plan.md (Progress row 2.3)
- **Detail**: Real-CLI compatibility on all six shards (version check 2.0.0, five contract cases without skips) needs a published PR run. Step subagents may not push. Locally the install with `--ignore-scripts` and `--version` work, and the transitive tree has no lifecycle hooks, so the risk is low.
- **Fix**: After the orchestrator opens the PR, inspect the six shard results and tick 2.3.
- **Decision**: PENDING — observation, left open per orchestrator rule; needs the PR run after publication.

### F3 — Pre-check result is not recorded in the repo

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:83
- **Detail**: The plan's local pre-check (list every installed manifest with a lifecycle hook) left no trace in the change folder or Amendment 3. The reviewer re-ran it: 75 manifests, no hooks, no `binding.gyp`. The amendment states only the limit (tree unlocked), not that no hook exists today.
- **Fix**: Add one sentence to Amendment 3 or an evidence note: on 2026-11-22 the 2.0.0 tree had 75 manifests and no preinstall, install or postinstall hook.
- **Decision**: PENDING — observation, left open per orchestrator rule; goes into the PR body, owner may add the sentence.
