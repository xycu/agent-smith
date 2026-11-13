<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Router Bash timeout Implementation Plan

- **Plan**: context/changes/router-bash-timeout/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence (no sub-agents, the run forbids nested subagents; checked inline):

- Diff `main..HEAD` touches exactly the planned files: both `SKILL.md`, both content tests, `skills/10x-pipeline/test/README.md`, `docs/REFERENCE.md`, plus run artifacts. No router code, `policy.json`, anti-stall section or `README.md` change.
- The `Bash timeout:` line is byte-identical in both skills, sits directly after `Pull request script:`, has no `**GIVEN**`, no `node $ROUTER`, no model, effort or tier word.
- Both tests assert presence (exactly one), the three script names, `` `timeout: 600000` ``, index = `Pull request script:` + 1, outside the anti-stall section; the OpenSpec test also asserts equality with the 10x copy.
- Deliberate-break check re-run: a SKILL.md copy without the line makes both new tests fail (`actual: 0, expected: 1`) via `SKILL_PATH` and `OPENSPEC_SKILL_PATH`.
- `docs/REFERENCE.md` "Bash limit" bullet matches `policy.json` (both `gitTimeoutMs` 120000), `open-pr.mjs:17` (`GIT_TIMEOUT_MS = 120000`) and the `pr-comment.mjs` `--timeout-ms` flag.
- Manual rows 1.5 and 2.3 carry evidence files that quote the sources.
- Full suite: see the result recorded in the reply (`node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`).

## Findings

### F1 — Shipped git timeouts can still exceed the Bash limit in the worst case

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: docs/REFERENCE.md:53, skills/10x-pipeline/policy.json:117,124
- **Detail**: The new bullet states the rule "the git timeouts of one call must add up to less than the Bash limit". The shipped values (120000 ms per git call, one router call makes several: safety reads, add, commit, post-commit checks) add up to more than 600000 ms if every call hangs. The usual case (one slow hook under 120 s) is fixed. The plan lists changing `gitTimeoutMs` and the `gitSafety` message under "What We're NOT Doing", so this is out of scope.
- **Fix**: Either lower the shipped git timeouts or add a per-call-sum cap in a separate change. Not applied here.
- **Decision**: PENDING — out of the plan's scope ("What We're NOT Doing" excludes the `gitTimeoutMs` values); the owner decides whether the worst-case sum needs its own change.
