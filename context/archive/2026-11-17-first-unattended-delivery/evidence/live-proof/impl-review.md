<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Restore the shipped Claude-only ladder: README recipe

- **Plan**: context/changes/claude-only-10x-example/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

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

- Plan Adherence: `README.md` gains `### Restore the shipped Claude ladder` directly before `### Claude Code subagent depth`. It has one JSON fence with a single `ladder` key of eight rungs and no `provider` key. The prose follows the planned order: merge only `ladder` or delete the key, arrays replace whole with the leftover-rung warning, unrelated keys untouched, `maxTier` above 7 and never `splitProviders`, check the file first because `init` cannot show the ladder, then fresh `init --provider-mode claude` and the fixed-mode and resumed-run notes, ending with the REFERENCE link. `docs/REFERENCE.md` gets exactly one sentence in the Upgrade note, linking `README.md#restore-the-shipped-claude-ladder`. `ladder.test.mjs` adds the three planned tests after the fable tests, with the planned negative control and the one extra import (`stepPolicy`) that the plan names.
- Scope Discipline: the change touches no router, `scripts/`, `policy.json`, `codex-policy.json`, prompt, rule, SKILL.md, AGENTS.md, CHANGELOG or version file. The other files in the branch diff are change-folder artifacts (plan, brief, complexity, reviews, evidence, run state) and `context/foundation/agent-smith-policy.json`. That last file comes from the earlier acceptance commit `d8155cc3`, which predates this change, so it is out of scope here.
- Safety & Quality: docs and one test. The test writes only to scratch projects created by `makeProject`. No deletion, network or publish call.
- Pattern Consistency: the new test block copies the fence-extraction approach of the fable test and reuses the existing helpers (`makeProject`, `writeOverride`, `init`, `run`).
- Manual row 1.5 has evidence in `evidence/judgment-readme-recipe.md`. It quotes the README clause for each part of the change goal, so it is not a rubber stamp.

## Success criteria run

- README heading and fence check (1.1): pass (exit 0).
- REFERENCE link grep (1.2): 1 match.
- No SKILL.md in the branch diff (1.3): pass.
- `agents-md-no-imports` and `agents-md-size` (1.4): 6 pass, 1 skipped, 0 fail.
- `ladder.test.mjs` (2.1): all pass, including the three recipe tests.
- Full suite (2.2): 2199 tests, 2191 pass, 3 skipped, 5 fail. The five failures are all in `skills/10x-pipeline/test/helpers-env.test.mjs`. Each is `git init` failing with "cannot copy .../templates/hooks/commit-msg.sample ... Operation not permitted", which the Bash sandbox of this review session causes. The test file does not touch the changed files. A re-run outside the sandbox did not finish inside the time limit and was stopped, so those five stay unconfirmed outside the sandbox.
- `no-recursive-delete.test.mjs` is part of the full suite and passes. `node tools/commit-lint.mjs main..HEAD`: OK (2.3).
- Smoke check (2.4) is covered by the recipe test, which drives the real CLI `init --provider-mode claude` over an OpenAI override with the recipe applied. It asserts `providerMode` `claude`, all-Claude `providersByStep` and a shipped model.

## Findings

None.
