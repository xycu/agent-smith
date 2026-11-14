<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Skill directory variable for script paths

- **Plan**: context/changes/skill-dir-variable/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

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

- Diff `edfc947..HEAD` touches exactly the planned files: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`, `README.md`, plus the change folder. No router, policy, prompt, `docs/REFERENCE.md` or `context/archive/` edit.
- `grep` over `skills agents docs README.md AGENTS.md tools .claude-plugin`: no `base directory` placeholder left; `${CLAUDE_SKILL_DIR}` appears only in the 8 planned SKILL.md lines, the tests and the README line.
- SKILL.md lines match the plan contracts: `ROUTER`, `PR_COMMENT`, `OPEN_PR` and the Tuning `policy.json` bullet of both skills; the quote note on both `Router:` lines (in the openspec skill it sits before `Every router call carries --chain openspec`, which keeps that sentence last).
- Tests pin the new lines and the absence of the placeholder for both skills; the existing file-exists assertions stay.
- README line (Install section) matches the changelog entries quoted in `evidence/judgment-2.4-readme-changelog.md` (2.1.69 and 2.1.292).

## Success criteria (run during this review)

- 1.1 `! grep -rn "this skill's base directory" skills/*/SKILL.md` — pass (exit 0).
- 1.2 skill-loop, pr-comment, archive-gate, nested-subagents tests — 85 pass, 2 skipped (the `GH_LIVE` tests), 0 fail.
- 1.3 `openspec-skill.test.mjs` — 13 pass.
- 1.4 Deliberate break: `${CLAUDE_SKILL_DIR}` swapped back to the placeholder in scratch copies. `SKILL_PATH=<copy> node --test skill-loop.test.mjs` — 2 fail (OPEN_PR line, script paths). `OPENSPEC_SKILL_PATH=<copy> node --test openspec-skill.test.mjs` — 3 fail (router, placeholder/Tuning, OPEN_PR). Both overrides exist; the plan's parenthetical "the openspec test has no path override" is out of date, as the plan's Contract already says.
- 1.5, 3.1 Full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 1118 tests, 1115 pass, 3 skipped, 0 fail (it covers rules, agents, provenance and `tools/test`).
- 2.1 `grep -n "2.1.292" README.md` — line 30. 2.2 `node tools/version-check.mjs` — `OK (1.6.1)`. 3.3 `node tools/commit-lint.mjs main..HEAD` — `OK`.
- 3.2 `init scratch-x --goal "check"` and `status scratch-x` in a scratch project — both print valid JSON.
- 3.4 `gh pr checks 140` — Conventional Commits, Tests and version check, semgrep: all pass.
- Manual 1.6 and 2.4 ticked with judgment evidence that quotes the lines and the changelog; checked, consistent with the diff.
- Manual 3.5 and 3.6 (installed plugin, live substitution) stay pending, with reasons in `evidence/unproven.md`. They are the only proof that Claude Code substitutes the cache path for an installed plugin; a human runs them.

## Findings

### F1 — Router calls stay unquoted; a path with a space rests on one note

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/SKILL.md:25, skills/openspec-pipeline/SKILL.md:28
- **Detail**: change.md names "a path with a space" as one failure the change should end. The `Router:` lines now say "When you put the path in a command, quote it for the shell", but every loop line still reads `node $ROUTER ...` unquoted, as the plan decided (tests pin `node $ROUTER`, e.g. `openspec-skill.test.mjs` filters lines on `node $ROUTER`). An orchestrator that copies a loop line literally, with the path pasted in for `$ROUTER`, breaks on a cache path with a space. Plugin cache paths under `~/.claude/plugins/cache/` rarely hold a space, so the risk is low.
- **Fix**: Write the loop lines as `node "$ROUTER" ...` in both skills and update the tests that match `node $ROUTER`.
  - Strength: The quoting sits at every call, not only in the head note.
  - Tradeoff: Touches many pinned lines and tests in both skills; the plan kept them unchanged on purpose.
  - Confidence: MED — depends on how literally orchestrators copy the loop lines.
  - Blind spot: No live run with a space in the plugin path.
- **Decision**: PENDING — outside the plan's scope (the plan keeps every `node $ROUTER` call as it is); the owner decides whether to quote the loop calls in a follow-up change.
