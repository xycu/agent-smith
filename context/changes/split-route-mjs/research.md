---
date: 2026-11-09T02:40:08+0100
researcher: Claude Code (claude-opus-5-5), for Błażej Ksycki
git_commit: 777747fcda315bceedebf7c9c30c441248917626
branch: main
repository: agent-smith
topic: "How should agent-smith's over-long .mjs files be split, with no behavior change, using the laziest approach that works?"
tags: [research, codebase, route.mjs, refactor, tests, ponytail, openspec-seams]
status: partial
last_updated: 2026-11-09
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: How should agent-smith's over-long .mjs files be split, with no behavior change, using the laziest approach that works?

**Date**: 2026-11-09T02:40:08+0100
**Researcher**: Claude Code (claude-opus-5-5), for Błażej Ksycki
**Git Commit**: 777747fcda315bceedebf7c9c30c441248917626 (working tree has untracked `.claude/commands/`, `.claude/skills/`, `openspec/` and the `openspec-pipeline` and `split-route-mjs` change folders; none of them is a `.mjs` file under `skills/` or `tools/`)
**Branch**: main
**Repository**: agent-smith

## Research Question

How should agent-smith's over-long `.mjs` files be split with no behavior change, using the laziest approach that works? The ponytail lens applies: question whether each split needs to exist, delete or merge before adding structure, add no new abstractions and no new dependencies. The research covers the size inventory, the `route.mjs` dependency map and cut lines, the hard constraints, the test files over 1000 lines, a no-behavior-change proof, a ponytail audit of `route.mjs`, and the seams the later `openspec-pipeline` change needs.

## Summary

**Status is `partial` for two reasons.** The test suite was not run, so test coverage of individual router branches is inferred from string matching, not measured. The line counts per module are estimates from the dependency analysis, accurate to about ±15 lines each.

**Recommendation.**

1. **Split only `route.mjs`.** It is the only source file over 1000 lines (3582). The next largest source file, `pr-comment.mjs`, has 249 lines. Leave the four test files over 1000 lines as they are in this change (see 5 and Detailed Findings 4).
2. **Cut it into five sibling modules plus the entry, all in `skills/10x-pipeline/scripts/`.**
   - The modules sit next to `route.mjs`, not in a subfolder. That way `SKILL_DIR` keeps its expression and the plugin-copy tests copy them.
   - Each module uses plain `export function` / `export const` on the moved declarations and plain named `import { … } from "./x.mjs"`.
   - There is no barrel file, no setter and no new helper.
   - The import order is fixed and has no cycles. A module imports only from modules earlier in the table.

   | Order | File | Holds (current `route.mjs` lines) | Est. lines |
   |---|---|---|---|
   | 1 | `state.mjs` | header utilities 22-63, readers 65-202, archive lookup 204-239, run log incl. `paths()` 241-286, decision helpers 667-712, rigor 714-786, churn 788-972, plus four moved items: `isObject` (716), `halt` (3469), `scoreConfig` (1388), `ARTIFACT_NAME` (1198) | ~600 |
   | 2 | `preplan.mjs` | pre-plan 1196-1383, score 1385-1513, `replanNext` 1515-1573, plus `e2eSetup` (1670) moved in | ~395 |
   | 3 | `steps.mjs` | executors 1575-1863, manual verify 1865-2041, code re-plans 2043-2092, tier 2094-2237 | ~635 |
   | 4 | `flow.mjs` | report 288-516, result intake incl. `attachResult` 518-665, open findings and `decide` 974-1194, prompts and agents/advisor 2239-2316 | ~690 |
   | 5 | `isolation.mjs` | provenance 2318-2458, archive adapter 2460-2537, isolation, commits and rollback 2539-2786, `archiveDone` 2815-2953 | ~615 |
   | entry | `route.mjs` | shebang and usage comment 1-15, `let undoOnError` and `undoRollback` 2787-2809, `next` 2955-3123, `verifyArchive`/`riskCommand` 3125-3171, compare 3173-3423, `status` 3425-3465, `main` and the `try` 3473-3582 | ~685 |

   The names are suggestions; `/10x-plan` can rename them. The `util`/`state` merge and the `commands`-into-`route` merge are what keep the count at five plus the entry. The dependency worker's mechanical check found no upward import in its 7+1 layout, and merging adjacent layers keeps that property.
3. **Delete nothing first.**
   - The ponytail audit found no dead function, no unused import and one unused parameter (`scoreNext`'s `meta`, `route.mjs:1447`, passed at `:1041`).
   - Its safe merges total about 75 lines, roughly 2% of the file. That is too small to shrink the split, and each merge risks an output change that a pure move does not.
   - Keep those merges for a separate follow-up after the split.
4. **No-behavior-change check.** Three layers:
   - **Run the full suite after every step.** All test files drive the router as a CLI.
   - **A throw-away Node script, kept outside the repository**, that proves two things:
     - (a) The multiset of top-level declaration texts is the same before and after. Strip a leading `export ` and the `import` lines first.
     - (b) Every name a module uses that is declared in another module appears in its `import` list, and no module imports from a later module or from `route.mjs`.
   - **Widen the `gh` source guard in `pr-comment.test.mjs:624-630`** from `route.mjs` to every `scripts/*.mjs` except `pr-comment.mjs`. Do this in its own first commit, before any code moves.

   Check (b) matters because a forgotten import throws `ReferenceError` only when that code runs. `main`'s catch (`route.mjs:3568-3582`) turns it into a `Router error:` halt, and some halt paths have no test (see Detailed Findings 5).
5. **Extraction order, smallest risk first.** Each step is one `refactor:` commit with a green suite.
   1. Widen the `gh` guard (a test edit that strengthens the oracle).
   2. Extract `state.mjs`, the leaf.
   3. Extract `preplan.mjs`.
   4. Extract `steps.mjs`.
   5. Extract `flow.mjs`.
   6. Extract `isolation.mjs`.
   7. Update the docs that name `route.mjs` as the home of routing (`AGENTS.md:7`, `:8`, `:20`, `:62`, `:63`, `:67`; `SKILL.md:114`).

   Each extraction cuts a contiguous block, plus the named moved items, out of `route.mjs`. The new module imports only from modules already extracted, and `route.mjs` gains one import line. Steps 2-6 can run in this order because the remaining `route.mjs` code always sits above the extracted code in the dependency graph.
6. **The `openspec-pipeline` seams land without extra work.**
   - `paths()` lands in `state.mjs` and reads module-level `ROOT`; that change can add a root parameter later.
   - `decide()` and the `attachResult()` switch land together in `flow.mjs`.
   - `loadPolicy` lands in `state.mjs`.
   - `next()` stays in `route.mjs`.
   - None of these signatures changes now.

## Detailed Findings

### 1. Size inventory

- `git ls-files '*.mjs'` plus untracked `.mjs` under `skills/` and `tools/` yields 33 files and 18,135 lines in total. No untracked `.mjs` file exists under `skills/` or `tools/`.
- Files over 1000 lines (5 files):
  - `skills/10x-pipeline/scripts/route.mjs` 3582
  - `test/openfindings.test.mjs` 1211
  - `test/preplan.test.mjs` 1130
  - `test/executors.test.mjs` 1116
  - `test/archive.test.mjs` 1084
- Next largest: `score.test.mjs` 945, `pr-comment.test.mjs` 821, `manualverify.test.mjs` 815, `compare.test.mjs` 763.
- Other source files: `scripts/pr-comment.mjs` 249, `tools/version-check.mjs` 75, `tools/commit-lint.mjs` 61. None needs a split.

### 2. `route.mjs` structure and dependency map

- **Top-level inventory.** The dependency worker parsed the file with Node 24's bundled acorn and counted 206 top-level items:
  - 159 function declarations, none async
  - 18 arrow consts
  - 27 value consts
  - 1 `let`
  - the final `try`
- **Section markers.** The file has `// ----` section markers at 22 places, from `:65` to `:3467`. Four logical sections have no marker:
  - decision helpers, inside "decision" at `:667`
  - open findings and `decide`, `:974-1194`
  - tier, `:2094-2237`
  - `archiveDone`, `:2815-2953`

  The hint map was right on the main boundaries. Two corrections:
  - `:667-712` holds the decision helpers `lastIdx`, `isFailure`, `budgetSteps`, `trailingFailures` and `goalClass`; rigor starts at `:714`.
  - `paths()` is at `:244-260`, in the "run log" section that starts at `:241`.
- **Module-level state** (worker, spot-checked):
  - `SKILL_DIR` (`:22`) is computed from `import.meta.url` plus `".."`.
  - `ROOT` (`:23`) is `process.cwd()`, captured at import.
  - `PLUGIN_ROOT` (`:2323`) is `path.resolve(SKILL_DIR, "../..")`.
  - Nine regex consts and about 15 literal consts are never reassigned (worker grep).
  - `let undoOnError` (`:2794`) is the only mutable binding. `next` writes it at `:2969` and `:2971`, and `main`'s catch reads and writes it at `:3574-3576` (verified).
  - No cache, Map, Set, `process.env` read, `process.on` or `chdir` (worker scan).
  - `process.argv` is read only in `main` (`:3474`).
  - The only import-time side effect is `try { main() } catch` at `:3568-3582`.
- **Cycles in the current section order.** Two strongly connected groups:
  - Group A: run log, decision helpers, rigor, churn, pre-plan, score, executors, code re-plans.
  - Group B: isolation, `archiveDone`, `next`, compare, `main`.

  Four back-edges force code to move:
  - `paths()` calls `scoreConfig` (`:247` → `:1388`, verified).
  - `isObject` is defined in rigor (`:716`) and used by 47 declarations across 19 sections (66 call sites by grep).
  - `halt` is defined in main (`:3469`) and called at `:2553`, `:2666`, `:3207`, `:3212` and `:3294-3310` (verified by grep).
  - `PREDICATES` (`:1286`) calls `e2eSetup` (`:1670`).

  The other back-edges point downward once the sections are regrouped as in the table above. Examples are `report` → `doneNotes`/`scoreSummary`, `attachResult` → `verifyImplement`/`verifyManual`/`verifyCodeReplan`, and `decide` → `preplanNext`/`scoreNext`/`executorNext`. That is why report, intake and `decide` sit in `flow.mjs` above `steps.mjs`.
- **Blockers for a naive split:**
  - **`undoOnError`.** An ES module cannot assign an imported binding, so `let undoOnError`, `undoRollback`, `next` and `main` stay in one file, `route.mjs`. The only alternative is a setter, which is a new abstraction. The `let` must stay above `try { main() }` to avoid the TDZ. This case is tested at `rollback.test.mjs:338-350` (tests worker).
  - **`SKILL_DIR`.** If it moves into a subfolder such as `scripts/lib/`, the same expression resolves to `scripts/` and breaks `loadPolicy` (`:55`), `churnConfig` (`:850`), `evidenceExcludes` (`:1606`) and `promptText` (`:2256`). Sibling files keep the expression valid. Define it once in `state.mjs` and import it elsewhere; `PLUGIN_ROOT` stays in `isolation.mjs`, where provenance uses it.
  - **Modules must never import `route.mjs`.** It runs `main()` on import (`:3568`; `route.test.mjs:1`: "route.mjs runs on import and exports nothing").
- **Things that are not blockers:**
  - `ROOT = process.cwd()` keeps its import-time timing, because nothing calls `chdir`.
  - `PREDICATES` builds an object of arrow functions at import and calls none of them.
  - `out()` (`:25-28`) ends the process with `process.exit` from any module.
- **Module sizes.** The worker's 7+1 layout:
  - util ~60 (0 imports, 9 exports)
  - state ~540 (6 imports, 31 exports)
  - preplan ~395 (7, 11)
  - steps ~635 (17, 20)
  - flow ~690 (41, 11)
  - isolation ~615 (21, 17)
  - commands ~340 (17, 4)
  - route ~345 (57 imports)

  The recommended 5+1 layout merges util into state (~600) and commands into route (~685). That keeps every file under about 700 lines. Only five new files is the lazier choice; the extra files of the 7+1 layout buy nothing the owner asked for.

### 3. Hard constraints a split must keep

- **Entry path.** `SKILL.md:24` sets `ROUTER=<this skill's base directory>/scripts/route.mjs`.
  - `test/helpers.mjs:14` resolves `../scripts/route.mjs`.
  - `agents.test.mjs:306,315` and `provenance.test.mjs:67` spawn the copy's `scripts/route.mjs`.
  - The CLI lines in `AGENTS.md:49-56` and in `docs/REFERENCE.md` keep working while the entry stays at that path (docs worker).
- **Plugin-tree copies.** `provenance.test.mjs:58-68` and `agents.test.mjs:298-307` `cpSync` the whole `skills/10x-pipeline/` minus `test/`. Modules under `skills/10x-pipeline/scripts/` are copied with it. Modules outside `skills/10x-pipeline/` would be missing from the copy (verified at `provenance.test.mjs:60-67`).
- **Provenance.** It hashes merged policy sections (`provenanceSections` `:2375-2383`), resolved prompt text (`promptsHash` `:2348`), `agents/*.md` (`agentFilesHash` `:2357`) and the `plugin.json` version (`:2369`). Nothing under `scripts/` is hashed, so a pure split causes no `provenance.drift` and no `compare` warning.
- **Packaging.**
  - `.claude-plugin/plugin.json` and `marketplace.json` list no files.
  - There is no `package.json`, `.npmignore` or `files` whitelist.
  - `release-please-config.json` `extra-files` names only the two manifest version fields.
  - `tools/version-check.mjs:36-43` reads only the manifests and `.release-please-manifest.json`.
  - CI (`ci.yml`, Node 24) runs the shell glob `skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

  New script modules need no packaging change (docs worker).
- **ADR-006.** "a new router or test file **MUST** use only `node:` built-ins and add no npm dependency". The wording already allows several router files. A grep of `docs/ADR/` for "one file", "single file" and "a script" found no rule on router file count or size. "Stays a script" (ADR-007, ADR-009:24) means no network or model call (docs worker).
- **Source-text test.** `pr-comment.test.mjs:624-630` reads only `scripts/route.mjs` and asserts that no `"gh"` literal appears (verified). After a split it would silently check only the entry, so widen it as recommended. No other test reads router source, line numbers or section order (tests worker grep of `test/*.mjs` and `tools/test/*.mjs`). `rules.test.mjs` and `skill-loop.test.mjs` do not read `scripts/`. `preplan.test.mjs:122` lists `prompts/*.md` only.
- **Docs that become inaccurate** (verified):
  - `AGENTS.md:7`: "Keep routing decisions in `skills/10x-pipeline/scripts/route.mjs` and …"
  - `AGENTS.md:8`: "`route.mjs` owns … `run.jsonl` and `meta.json`"
  - `AGENTS.md:20`: the Project Structure bullet; add one bullet for the new modules.
  - `AGENTS.md:62`: "never in `route.mjs`"
  - `AGENTS.md:63`: "tier logic in `route.mjs` (`tierFor`, `decide`)". After the split `tierFor` is in `steps.mjs` and `decide` in `flow.mjs`.
  - `AGENTS.md:67`: "after any change to `route.mjs`, …"
  - `SKILL.md:114`: "see `scripts/route.mjs`, `tierFor` and `decide`"

  `docs/REFERENCE.md:20` stays true while `route.mjs` is the entry. The ADR mentions (ADR-003:141, :181 and others) are historical records; leave them. The README Layout block names `skills/10x-pipeline/` only and needs no change (docs worker).

### 4. Test files over 1000 lines

From the tests worker; static `test(` counts.

| File | Tests | Structure | Shared local helpers across a seam |
|---|---|---|---|
| `openfindings.test.mjs` | 111 | parser/fallback/policy/log 58-400; routing/halt 401-806; confirm 807-1080; report 1081-1212 | `reviewText` (22-32, 72 uses) and `block`/`CRIT`/`WARN`/`OBS` (34-38) are used in every section; 403-427 are used by confirm |
| `preplan.test.mjs` | 53 | static policy/prompt checks 44-338; behaviour 339-1131 | helpers 24-42 used at 668-675; `thorough` (363) used at 56 |
| `executors.test.mjs` | 42 | phase 1 57-269; phase 2 330-819; tdd/gate/phase 6 820-1117 | `strictProject`/`tickAll`/`finish` (27-55) and `e2eProject`/`start`/`lastEntry`/`advance` (270-328) used across sections; about 90 lines would need a shared module |
| `archive.test.mjs` | 79 | guard and verify-archive 67-334 (no git); git/done-branch 335-1085 | `archivedOnly` and `snapshot` used at 481-486 and 835-843 |

- **Duplicated setup.** Within each file, setup is already factored, and the repeated literals are test data. Across files, small helpers recur with diverging signatures:
  - `finish` in 8 files
  - `start` in 6
  - `put` in 6
  - `lastEntry` in 4
  - `touch` in 3
  - a `SKILL_DIR` const in 13
  - a `POLICY` load in 5

  Extracting them saves about 40-60 lines of a suite of about 14k lines. They cannot go into `helpers.mjs` (`AGENTS.md`: it "stays as it was" except `writeOverride`).
- **Cost of splitting.** Each new file adds about 15-20 lines of imports, `after(cleanupAll)` and consts. Two of the files (openfindings, executors) would also need a new shared helper module. `AGENTS.md`'s Project Structure names each test file by purpose and would need edits.
- **Parallel runs.** Splitting is safe for parallel runs:
  - Every scratch dir is a unique `mkdtempSync` (`helpers.mjs:19`; 12 call sites).
  - There are no fixed tmp names, ports or `chdir`.
  - Git is hermetic per scratch base (`helpers.mjs:171-184`).
  - The CI glob picks up new top-level `test/*.test.mjs` files.
- **Ponytail verdict.** Not worth it in this change: it saves no lines and edits the oracle of the refactor. If the owner still wants every file under 1000 lines, the two clean seams are:
  - `archive.test.mjs` at line 335, with `archivedOnly`/`snapshot` copied or exported.
  - `preplan.test.mjs` at line 339, with helpers 24-42 and `thorough` shared.

  openfindings and executors need a shared helper module, so they are the costliest. This is an owner decision (Open Questions 1).

### 5. Safety net and the no-behavior-change proof

- **What the suite exercises** (tests worker, by static count of `run()` calls, not measured):
  - `init` and `next`: 20+ each
  - `status`: 30+, with `--report` in 11 files
  - `risk`: 1
  - `verify-archive`: 3
  - `compare`: about 10, including `--format md`

  Assertions cover the JSON fields, `run.jsonl`, `meta.json`, `report.md` and git state.
- **What a pure move can break:**
  - A wrong named import is a link-time `SyntaxError`, so every test fails and it is caught.
  - A forgotten import is a `ReferenceError` only when the code runs. `main`'s catch turns it into `Router error: X is not defined` (`:3568-3582`). That is caught only on tested paths.
- **Branches with no test evidence** (tests worker, from 89 halt and reason string fragments of which 70 had no 30-character match, then a hand spot-check):
  - `Unknown command` (`:3564`)
  - the usage halt and the invalid-id halt (`:3476`)
  - the non-blank checks of `isolation.commit.startMessage` and `commit.message` (`:2672`, `:2699`)
  - `Router error: skip loop` (`:3012`)
  - the undo-failure texts (`:2801`, `:2974`, `:3578`)
  - the isolation probe failures (`:2561`, `:2600`)
  - `No change folder` in `status --report` (`:3460`)
  - the code re-plan and score-skip note texts (`:2069`, `:2081`, `:1462`, `:1471`); their routing is tested

  A missing import in one of these paths would pass the suite. Check (b) covers it.
- **Proposed check.** The cheapest one is a throw-away Node script with no dependency, kept in the scratchpad or `$TMPDIR` and not committed:
  1. **Declaration multiset.** Before the split, cut `route.mjs` into top-level declaration chunks with `/^(?=(?:export )?(?:function|const|let|try) )/m`. Hash each chunk after removing a leading `export ` and trailing blank lines. After the split, do the same over all six files with `import` lines dropped. Compare the two sorted hash lists: they must be equal. The code style puts every top-level declaration at column 0 (`AGENTS.md` Coding Style; 206 items found by the worker's parser), so the regex is adequate. Comment blocks between declarations attach to the preceding chunk; either move comments with their function or compare with comment lines stripped.
  2. **Import completeness.** For each module, collect the names declared at top level in the other modules. Every such name that occurs as a whole word in this module, after stripping comments and string literals, must be in its `import { … }` list. Every import must come from a module earlier in the fixed order, and never from `route.mjs`.
  3. **Run `node --check` on each file**, then the full suite: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
  4. **`git diff --stat` shape.** `route.mjs` loses about N lines and the new files gain about N plus their import and export lines. Any other changed file is a red flag, except the guard test and the docs.
- **Rejected options.**
  - Byte-identical CLI output before and after is not cheap: `run.jsonl` entries carry `startedAt` timestamps (`attachResult` compares `mtime(file) > last.startedAt`, `:626-642`), so outputs differ run to run. The suite already asserts the deterministic parts.
  - A `no-undef` lint pass with `npx eslint` would fetch an npm package. ADR-006 rules out dependencies for router and test files. A one-off `npx` run commits no dependency, but check 2 makes it unnecessary.

### 6. Ponytail audit of `route.mjs`

The audit (`ponytail-audit` lens, scoped to `route.mjs`, report only) found:

- **No dead code.** Every named top-level function and const has at least one reference. All five imports are used: `crypto`, `fs`, `path`, `execFileSync` and `fileURLToPath`.
- **One unused parameter:** `scoreNext`'s `meta` (`:1447`; caller `:1041`).
- **One default no caller passes:** `lastIdx(…, okOnly = true)` (`:669`).
- **Safe merges with no output change, about 75 lines in total.** The largest:
  - a `section(title, intro, rows)` helper for `lessonLines`/`rollbackLines`/`reviewLines` (`:328-336`, `:417-425`, `:442-450`), about -20
  - one boolean-flag parser for `--archive`/`--chrome`/`--unpinned` (`:3488-3493`, `:3496-3501`, `:3301-3306`), about -8
  - `findLast`/`findLastIndex` for `lastIdx` (`:669-674`) and five reverse scans (`:1167`, `:1480-1483`, `:1812-1813`, `:1875`, `:2061`), about -7
  - merging the `research`/`frame`/`domain-brief` cases of `attachResult` (`:626-642`), about -6
  - a shared worktree probe for `isolationCheck`/`runBranchReason` (`:2558-2568`, `:2597-2606`), about -6
- **Needs a behavior check first:**
  - Folding the `archiveDone` commit block (`:2882-2932`) into `routerCommit` (`:2623-2658`), about -30. They differ in the unstage text, the `unprefix` of listed paths, the short versus full hash and the halt shape.
- **Keep as is** (would change behavior):
  - Replacing `globToRegex` (`:827-839`) with `path.matchesGlob`: different `**`, `?` and dotfile semantics, and `matchPlanPath` reuses `.source` with the `i` flag (`:929`).
  - Replacing `parseFlags` (`:30-39`) with `util.parseArgs`: strict mode, and values that start with `--`.

Under the ponytail lens these are a follow-up `refactor:` change, not a pre-split step: about 2% of the file, each with its own small output risk. The split itself moves code verbatim and leaves the comment volume untouched. The comments are a large share of the 3582 lines; the audit did not count them.

### 7. Sequencing with `openspec-pipeline`

- `context/changes/openspec-pipeline/research.md` (Summary 3-4, Detailed Findings 4) names four seams a second chain needs: `paths()` taking a root, a decision function per chain, a per-step verification switch, and an importable router. Its Summary item 4 notes that `route.mjs` has no `export` statement.
- After the recommended split:
  - `paths()` (`state.mjs`) is importable. Its callers are `next` (`:2956`), `main` (`:3502`), `verifyArchive` (`:3142`), `riskCommand` (`:3167`) and `status` (`:3426`).
  - `decide()` (`flow.mjs`, called only from `next` at `:3009`) is importable.
  - `attachResult()` (`flow.mjs`, called only from `next` at `:2962`; switch cases at `:617-652`) is importable.
  - `loadPolicy()` (`state.mjs`, called only from `main` at `:3478`) is importable.
- The split leaves all of these signatures unchanged. Adding a `root` argument, a chain selector or a second decision function belongs to `openspec-pipeline`.
- `next()` stays in `route.mjs` because of `undoOnError`. A second skill that needs `next` would either share the entry with a chain flag or need the setter this change avoids. That choice belongs to `openspec-pipeline` (ADR-013).

## Code References

- `skills/10x-pipeline/scripts/route.mjs:22-23`: `SKILL_DIR` from `import.meta.url`, `ROOT = process.cwd()` at import
- `skills/10x-pipeline/scripts/route.mjs:54-59`: `loadPolicy`
- `skills/10x-pipeline/scripts/route.mjs:244-260`: `paths()`; calls `scoreConfig` at `:247`
- `skills/10x-pipeline/scripts/route.mjs:603-665`: `attachResult()`, per-step switch at `:616-652`
- `skills/10x-pipeline/scripts/route.mjs:716`: `isObject`, used across 19 sections
- `skills/10x-pipeline/scripts/route.mjs:1026-1194`: `decide()`
- `skills/10x-pipeline/scripts/route.mjs:1286`, `:1670`: `PREDICATES` → `e2eSetup` back-edge
- `skills/10x-pipeline/scripts/route.mjs:1388`: `scoreConfig`
- `skills/10x-pipeline/scripts/route.mjs:2120-2222`: `tierFor`
- `skills/10x-pipeline/scripts/route.mjs:2323`: `PLUGIN_ROOT`
- `skills/10x-pipeline/scripts/route.mjs:2794`, `:2969`, `:2971`, `:3574-3576`: `let undoOnError`, the only mutable module binding
- `skills/10x-pipeline/scripts/route.mjs:2955-3123`: `next()`
- `skills/10x-pipeline/scripts/route.mjs:3469-3471`: `halt`, called from isolation and compare
- `skills/10x-pipeline/scripts/route.mjs:3568-3582`: `try { main() } catch`, the only import-time side effect
- `skills/10x-pipeline/test/helpers.mjs:14`: `ROUTE` path constant
- `skills/10x-pipeline/test/pr-comment.test.mjs:624-630`: `gh` source guard over `route.mjs` only
- `skills/10x-pipeline/test/provenance.test.mjs:58-68`, `agents.test.mjs:298-307`: plugin-tree copies of `skills/10x-pipeline/` minus `test/`
- `skills/10x-pipeline/test/route.test.mjs:1`: "route.mjs runs on import and exports nothing"
- `skills/10x-pipeline/SKILL.md:24`, `:114`: router path; "How the tier moves" pointer
- `AGENTS.md:7`, `:8`, `:20`, `:60-63`, `:67`: wording tied to `route.mjs`

## Architecture Insights

- `route.mjs` is already layered in practice: low-level readers and git, then step-specific logic (pre-plan, score, executors, manual, tier), then orchestration (intake, `decide`, report), then side-effecting git (isolation, archive), then commands. Only four declarations sit in the wrong place for a layered import graph (`isObject`, `halt`, `scoreConfig`, `e2eSetup` plus `ARTIFACT_NAME`).
- The single shared mutable binding (`undoOnError`) pins `next` and `main` together. That is the main structural fact the split must respect.
- The router has no module-level caches and reads no environment, so splitting does not change evaluation order in any observable way: the only work at import time is constant initialization and `main()`.

## Historical Context (from prior changes)

- `context/changes/openspec-pipeline/research.md` (2026-11-09). Its claims checked here:
  - "`route.mjs` has no `export` statement": supported.
  - "`main()` starts at `:3473`": supported.
  - `decide()` at `:1026`: supported.
  - `paths()` at `:244`: supported.
  - `attachResult()` at `:603`: supported.
  - Its section map is approximate. The decision helpers at `:667-712` precede rigor at `:714`, and four logical sections carry no `// ----` marker.
- `context/archive/2026-10-31-pr-comment-report/research.md:39,61`: chose a separate script so the router never calls `gh`. That is the origin of the guard test that the split must widen (docs worker).
- `context/foundation/prd.md`, `roadmap.md`: no slice about `route.mjs` size. The roadmap notes that slices conflict because all of them edit `route.mjs` (`:65`, `:66`, `:202`, `:230`, per the docs worker). A split reduces that contention.
- `docs/ADR/ADR-003:141` ("`route.mjs` is the most contended file") and `:181` (symbol list in `route.mjs`): historical; leave unchanged.

## Related Research

- `context/changes/openspec-pipeline/research.md`

## Open Questions

1. **Tests over 1000 lines.** This research recommends leaving them. If the owner wants every file under 1000 lines anyway, should only `archive.test.mjs` (cut at 335) and `preplan.test.mjs` (cut at 339) be split, leaving openfindings and executors? Owner choice.
2. **Module names and count.** 5+1 (recommended, files of about 400-700 lines) or 7+1 (util and commands separate, the largest file still ~690). The difference is taste, not safety.
3. **Where the check script lives.** Scratchpad (throw-away, recommended under ponytail) or the change folder as evidence. It must not go under `scripts/` or `test/`.
4. **Doc wording for `AGENTS.md:7`/`:8`** ("route.mjs and the modules it imports under `scripts/`"). Does it need an ADR amendment line? The docs worker recommends leaving ADR text as historical record.
5. **Not measured.** Real branch coverage needs a suite run with `--experimental-test-coverage` or `NODE_V8_COVERAGE`. Module line counts are estimates (±15 lines each) and include comment blocks.
