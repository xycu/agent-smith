<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Halt on damaged run metadata implementation plan

- **Plan**: context/changes/meta-json-damage-halts/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

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

- Reader (`state.mjs` `inspectMeta` and `readMeta`): fallback only on `ENOENT`; invalid JSON (empty and whitespace included), non-object JSON and other read errors produce a diagnostic with the absolute path and a stable reason, no raw bytes, and a project-relative `git show <sha>:./<path>` hint inside the project.
- Writers: `init`, `next`, `usage` and `status --report` all reach `mutationMeta` under the run lock, before `cleanupStateTemps`, result consumption, report generation, state writes or Git writes. `init` reads metadata before the log, so the log-less window is closed. The logged-missing guard is kept.
- Plain `status` uses `inspectMeta`: `host` and `providerMode` are `null`, `metadataProblem` is set, log-derived steps remain, also without a log.
- `risk` and both `compare` sides use the strict `readMeta` and halt (JSON even with `--format md`).
- `storedChain` and `resolveChain`: damaged OpenSpec metadata halts inference; explicit `--chain openspec` keeps plain `status` and `verify-archive`; live/archive precedence and the 10x-name rule are unchanged.
- `runner-dispatch.mjs` needed no edit: `readMeta` throws inside `validateAction`, which already turns exceptions into the normal failure envelope.
- Scratch probe: `next` and `usage` on a conflict-marked `meta.json` exit 1 with `action: "halt"`, path, `Invalid JSON` and the recovery guidance.
- Docs: `docs/REFERENCE.md` provider recovery paragraph, state recovery section, OpenSpec chain notes and the `compare` eligibility bullet agree with the code. A grep for the older logged-only wording found no stale mention.
- Automated criteria 1.1 to 1.6: the full gate `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` passed on the reviewed code: 2180 tests, 2177 pass, 0 fail, 3 skipped. The focused run of `run-state`, `providers` and `openspec-chain` passed 219 of 219. Manual criteria: none in the plan.

## Findings

### F1 — Halt reason carries a "Router error:" prefix

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/state.mjs:749
- **Detail**: `readMeta` throws, so the top-level catch in `route.mjs` prefixes the reason with `Router error:`. The envelope (exit 1, `action: "halt"`) matches the plan. The damaged-log halt calls `halt()` directly and has no prefix. Tests assert on the diagnostic substring, so behavior is correct.
- **Fix**: None required. Optionally route the writers through a direct `halt()` in `mutationMeta`.
- **Decision**: PENDING — cosmetic wording only, no defect. The owner decides whether the prefix is worth a change.

### F2 — Metadata halt now precedes `usage` argument refusal

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:1152
- **Detail**: For `usage <id> <bad-n>` on damaged metadata the user sees the metadata halt, not the usage-syntax refusal. The plan asks for the metadata check before writer effects, so this is acceptable. Argument errors reappear once the metadata is restored.
- **Fix**: None required.
- **Decision**: PENDING — consistent with the plan; no change proposed. The owner may confirm.
