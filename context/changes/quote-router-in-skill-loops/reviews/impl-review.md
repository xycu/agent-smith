<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Quote router calls in pipeline skills

- **Plan**: [Quote router calls in pipeline skills](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-24
- **Reviewed revision**: `5d07aa28` against the integrated baseline `f81bdb52`
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

Both chains quoted every target script at the reviewed revision. Four regression checks still accepted broken command examples. All four now reject the corresponding mutations. The verdict and counts describe the implementation before commit `0b029007`.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — The quoting guard missed malformed recovery commands

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — confined to the shared content test
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/test/skill-loop.test.mjs:330` at the reviewed revision
- **Detail**: On both chains, the named regression passed when the recovery command used either `node -- $ROUTER` or `node '$ROUTER'`. The first splits a spaced path. The second passes a literal dollar sign. Discovery depended on the spelling it was meant to verify.
- **Fix**: Find Node commands by script-variable reference, then check the complete quoted prefix and reject a second reference in the same command.
- **Decision**: APPLIED — `0b029007`

### F2 — The diagnostic tests allowed the two roots to trade places

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — both chains use the same assertion
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/test/skill-loop.test.mjs:485` at the reviewed revision
- **Detail**: Swapping the two `verify-archive` prefixes passed the root-selection test on each chain. A pre-selection failure could therefore point at a run root that setup never returned.
- **Fix**: Require the sole original-root fallback before selection and the run-root command on the successful-setup diagnostic line.
- **Decision**: APPLIED — `0b029007`

### F3 — The PR-comment call could move outside the opt-in section

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the test already extracts the opt-in section
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/test/pr-comment.test.mjs:748` at the reviewed revision
- **Detail**: Moving the sole comment command into “Pull request (always)” passed the ownership check on both chains. The 10x position check extended to “Rules”, past the intervening publication section. The shared check verified the authorization prose without locating the executable call.
- **Fix**: Count the command once in the entire skill and require it inside the opt-in section on each chain.
- **Decision**: APPLIED — `0b029007`

### F4 — The OpenSpec selector check accepted an invalid chain name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one matcher checks every router call
- **Dimension**: Plan Adherence
- **Location**: `skills/openspec-pipeline/test/openspec-skill.test.mjs:112` at the reviewed revision
- **Detail**: The per-call assertion accepted `--chain openspecx` in the recovery command because it matched a substring. The router rejects that value.
- **Fix**: Require the complete selector value on each extracted command.
- **Decision**: APPLIED — `0b029007`

### F5 — Both skills shortened existing PR-comment instructions

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the integrated baseline supplies the exact wording
- **Dimension**: Scope Discipline
- **Location**: `skills/10x-pipeline/SKILL.md:165` and `skills/openspec-pipeline/SKILL.md:170`
- **Detail**: The implementation shortened the shell-quoting sentence in both skills and re-pinned its prose test. The plan reserved text compression for the earlier rewrite, and the recorded run goal authorized increasing the byte ceilings for quotes.
- **Fix**: Restore the baseline sentences and their assertion. Increase the 10x ceiling from 32,375 to 32,401 bytes and the OpenSpec ceiling from 36,870 to 36,896 bytes. Each increase accounts for exactly 13 quote pairs.
- **Decision**: APPLIED — `0b029007`

### F6 — The inventory overstated the number of script calls

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the baseline can be counted directly
- **Dimension**: Success Criteria
- **Location**: `evidence/command-contracts.md:35`, lines 52 and 70
- **Detail**: Each integrated skill had 11 router calls on 10 lines, plus one PR-comment and one open-PR call. The itemized commands were correct, but the summary counted 14 calls per skill.
- **Fix**: Correct the two inventory totals and the verification summary to 13 calls per skill.
- **Decision**: APPLIED — `0b029007`

### F7 — The prerequisite evidence omits the loaded revision and first OpenSpec step

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the owner already accepted the directory-marketplace runs in `b95ad16c`
- **Dimension**: Success Criteria
- **Location**: `evidence/command-installed-plugin-substitution.md:3` and line 27
- **Detail**: The record gives the plugin version, host version, expanded commands and both `action: "run"` results. It identifies the 10x step as `score`. For OpenSpec it lists the provider map without the step actually returned. A mutable directory checkout and a plugin version do not identify the exact source commit.
- **Fix**: Attach contemporaneous revision and step evidence if the original records contain them.
- **Decision**: PENDING — the committed record lacks those details and the transcripts were retained outside the repository. The owner can supply the original evidence or accept this limit on reproducibility.

## Verification

- **Integration and scope.** The rewrite and its archive are ancestors of `f81bdb52`. The integrated inventory identifies the additional init-permissions assertion introduced after planning. The implementation updated it in the same commit as the two skills. The Tuning paths appear only in prose.
- **Command behavior.** After the fixes, a byte comparison reproduced each complete skill from `f81bdb52` by adding the 26 quote characters alone. The anti-stall sections match across chains. The six shell fixtures passed with spaced plugin and run-root paths, including OpenSpec sibling traversal, goal forwarding and report-path arguments.
- **Negative checks.** All six required single-pair quote removals failed the named per-chain test in isolated skill copies. Eleven additional scratch mutations covered root swaps, Node options before a bare path, single quotes, bare braces, moving the PR-comment call, and a malformed OpenSpec selector. Each failed its intended check after the fixes.
- **Focused suites.** On Node 24.19.0, the eight Testing Strategy files plus `init-permissions.test.mjs` passed 264 tests. The two opt-in live GitHub checks skipped. The agents, change-status and recursive-deletion guard suites passed another 33 tests. Total for this review was **297 passed, 0 failed, 2 skipped**. `git diff --check` passed.
- **Fixture isolation.** On the first pass, two routing fixtures discovered the enclosing worktree after their helpers stripped inherited Git variables. A discovery boundary at the worktree-local scratch parent isolated those fixtures for the final run.
- **Full-suite evidence.** The implementation recorded 2,321 passes and three skips on Node 24.19.0. The current review ran the focused suites under the user's CI-only full-suite rule. [Implementation evidence](../evidence/command-contracts.md)
- **Manual acceptance.** Progress is 8/10. The owner accepted rows 1.2 and 1.3 using the directory marketplace. Rows 2.6 and 2.7 remain unchecked. Each still requires a live invocation of the fixed revision from an installed cache path containing spaces. [Prerequisite evidence](../evidence/command-installed-plugin-substitution.md) · [Open manual checks](../evidence/unproven.md)

The read-only plan-drift and quality reviews returned to the enclosing step. The host supplied no verified child-inclusive token total.
