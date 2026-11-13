<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Layered Rules and OpenSpec Definitions in the OpenSpec Folder

- **Plan**: context/changes/proper-structure-of-rules/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

- Diff range `b79777b..HEAD` (commits 6a55f80, f8e1260, ec08106, 30fae5a and the run's chore commits). Every file under "Changes Required" of the three phases is in the diff. The one gap is the plan's "README.md layout block": `README.md` has no such block, so the new paths went into its Configure section. Every unplanned file is a run artifact under `context/changes/proper-structure-of-rules/`.
- Code against the plan contract:
  - `pluginPolicy()` and `OPENSPEC_DIR` in `state.mjs`, and the halt that names the unreadable file.
  - `PROMPT_REF` and `isPromptRef` in `flow.mjs`, matching the contract regex.
  - `ruleTail`, `checkRules` and `RULE_DIRS` in `flow.mjs`. The order is chain defaults, suffix, step file, chain file, then `top.md`. ENOENT means "no file" for optional files; `top.md` is required; step names are checked against `^[a-z0-9][a-z0-9-]*$`.
  - Both assembly sites: `route.mjs` next and `isolation.mjs` archiveDone.
  - `NARROW_PLACEHOLDERS` gains `chain-10x` and `chain-openspec`.
  - The `ruleFiles` provenance section.
  - `ruleProblem` halts `init`, `next` and `usage` before any write.
  - Import paths of the moved `openspec.mjs`.
- Rule files: `top.md` copies the former suffix invariants word for word, adds the two precedence rules and ends with `RESULT:`. The suffix keeps only the defaults. `rules/steps/research.md` and `openspec-pipeline/rules/chain.md` each hold their rule exactly once. The three hand-written precedence lines are gone.
- Conflict check: `chain.md` is now also appended to the `os-archive` prompt. `openspec archive --help` (local CLI) shows no `--change` option, so "pass `--change` to every command that takes it" does not clash with "`openspec archive {id} --yes --json` with no other flag".
- Doc sweep (lessons.md, "grep every doc"): `git grep` finds no old `10x-pipeline/(prompts/os-|scripts/openspec.mjs|test/openspec-)` path in `AGENTS.md`, `README.md`, `docs/`, `skills/`, `openspec/config.yaml` or `.github/`. The only matches are historical text in ADR-013 Results and ADR-020. REFERENCE.md describes the rule levels, the order, the reference forms and the upgrade notes.
- Automated success criteria, run in this review:
  - Full suite `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 1188 tests, 1185 pass, 0 fail, 3 skipped.
  - Criteria 1.2, 1.3, 1.5, 1.8, 2.3, 2.4, 2.5 and 3.2 to 3.5 pass. 1.4 prints 4 at 6a55f80. `version-check` reports OK (1.8.0).
  - Smoke checks in scratch projects: `init demo` returns `run plan`, and `init demo --chain openspec` returns `run os-propose`. Both prompts end with the `RESULT:` line of `rules/top.md`. The OpenSpec prompt ends with `chain.md` followed by `top.md`.
- Manual rows: 1.9 has diff evidence. 2.7 has a judgment file (see F1). 3.6 and 3.7 are pending and listed in `evidence/unproven.md` (a live plugin install, and an owner action on `main`).

## Findings

### F1 — Manual row 2.7 asks for the owner's agreement but was ticked from an agent's judgment

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/proper-structure-of-rules/plan.md:409 (row 2.7), context/changes/proper-structure-of-rules/evidence/judgment-top-vs-suffix-split.md
- **Detail**: The plan's Manual criterion says "The owner reads `skills/10x-pipeline/rules/top.md` against `prompts.suffix` and agrees with the always-true versus default split". The row is `[x]`, but its evidence is a `manual-verify` subagent's reasoning, not the owner's. The reasoning holds: harness facts, safety bans and the `RESULT:` format are always-true, and ask, commit and rigor behavior are defaults. Still, the row records an agreement the owner has not given.
- **Fix**: The owner reads the evidence file and `rules/top.md`. If they agree, they keep the tick; if not, they untick row 2.7 and name the lines to move.
- **Decision**: PENDING — only the owner can give the agreement this row asks for. The owner must confirm or reject the always-true versus default split. This review may not edit `## Progress`.

### F2 — Behavior that project overrides can see changes, and the release type is not settled

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: docs/REFERENCE.md:229, docs/REFERENCE.md:238, skills/10x-pipeline/scripts/flow.mjs:790
- **Detail**: Three changes reach existing project overrides, as the plan's Migration Notes intend:
  1. An override that names `@prompts/os-*.md` now halts `init` and `next` with "cannot be read".
  2. A literal prompt part that starts with `@<lowercase-name>/prompts/` is now read as a reference.
  3. A `prompts.suffix` override now replaces only the defaults.

  `docs/REFERENCE.md` documents all three as upgrade notes. The commits are `feat` and `refactor`, with no `!` and no `BREAKING CHANGE:` footer, so release-please will cut a minor release (ADR-008). AGENTS.md says to mark a change breaking only when it is. Whether a halting override counts as breaking is the owner's call, not something the plan settles.
- **Fix**: The owner decides the release type when the run PR is merged.
  - Strength: The squash subject is the one place the bump is set (AGENTS.md Commits). No code changes either way.
  - Tradeoff: If the owner marks it `!`, the next release is 2.0.0 for a narrow override case.
  - Confidence: MED. The documented override surface includes `@prompts/` references (REFERENCE.md:229), but how many projects override an `os-` prompt is unknown.
  - Blind spot: Overrides in real user projects were not checked.
- **Decision**: PENDING — this is a release-policy decision outside the plan's scope. The owner must decide whether the squash title of the run PR carries `!` (major) or stays `feat` (minor).
