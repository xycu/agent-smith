<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Drop the --size flag

- **Plan**: context/changes/drop-size-flag/plan.md
- **Scope**: Full plan (Phase 1 and Phase 2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Drift check (commits bdc7f91, 0cecc04): every planned item in Phase 1 (policy keys, `goalClass`, `simpleSignal`, storage and usage text) and Phase 2 (SKILL.md, README, AGENTS.md, PRD, ADR-001) matches the plan. A repo-wide grep finds no `--size`, `sizeBump`, `size flag` or `Size:` outside `context/archive`, `shape-notes.md` and this change folder. `.claude-plugin`, the archive, `shape-notes.md` and the roadmap are untouched, and `steps.plan.baseTier` is still 4.
- One benign extra: `decide` also returns `bumpWhy` and `tierFor` prints it, so `tierWhy` reads "from goal class short" instead of "from results". It serves manual criterion 1.14. The plan's Key Discoveries said `tierFor` needs no change; that sentence is now slightly stale.
- Automated criteria 1.1–1.13 and 2.1–2.6 were run before each phase commit and all passed. Manual criteria 1.14, 2.7 and 2.8 were confirmed by the user. Criterion 1.13 was verified with a pre-seeded `meta.json`, because a second `init` in the same folder halts on the missing first-step result (existing behaviour).

## Findings

### F1 — A punctuation-only goal counts as a short goal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:249-259 (`goalClass`)
- **Detail**: Words are split on whitespace only. A goal such as `...`, `-` or `?` is one word, the leading-punctuation strip leaves an empty string, no keyword matches, and the goal is classified `short`. A meaningless goal then gets the simple-change discount and a first plan on sonnet/medium instead of sonnet/high. Confirmed by reading the code and by the review agent's node snippet.
- **Fix**: After stripping, drop words that contain no letter or digit, and treat a zero-word result as `plain`. Count only the remaining words toward `maxWords`.
- **Decision**: FIXED — `goalClass` drops words with no letter or digit after the strip; `...` and `- ? !` now return plain (sonnet/high). Not committed yet.

### F2 — Keyword prefix matching misses common verb forms and over-matches `schema`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/policy.json:21-25 (`hardKeywords`), route.mjs:249-259
- **Detail**: A word matches when it starts with a keyword. `migrating` does not start with `migrate`, and `authenticate` or `authenticating` does not start with `authentication`, so a risky goal such as "migrating the users table" is not hard and may be treated as short (sonnet/medium). In the other direction `schematic` starts with `schema`, so "fix schematic typo" is hard and costs one extra tier. The plan called the keywords starting guesses, but the false negative is the costly side: it sends a risky goal to a cheaper tier.
- **Fix A ⭐ Recommended**: Replace the entries with stems in `policy.json` (`migrat`, `authenticat`, `rewrit`, `redesign`, `refactor`, `architectur`, `securit`) and keep `schema`.
  - Strength: Fixes the false negatives with a data-only change, in the file where routing decisions belong; no logic change.
  - Tradeoff: `securit` also matches `securities`, and `schema` still matches `schematic`; false positives cost only one extra tier.
  - Confidence: HIGH — the review agent reproduced each case; the prefix rule is already the documented behaviour.
  - Blind spot: README and the plan's criteria name `refactor` and `security` only, so the doc examples stay accurate; the plan's "9 keywords" count is unchanged.
- **Fix B**: Keep the nine keywords and accept the gaps for the first release.
  - Strength: No change; failure escalation and plan review still correct a misjudged first plan.
  - Tradeoff: A misjudged risky goal runs its first plan one or two tiers too low, which is the cost the change is meant to avoid.
  - Confidence: MEDIUM — no measurements show how often goals use these inflected forms.
  - Blind spot: Real goals have not been sampled.
- **Decision**: FIXED via Fix A — `hardKeywords` is now `refactor, migrat, rewrit, redesign, architectur, securit, authenticat, schema` (8 stems). `migrating`, `authenticate` and `Rewriting` now return opus/high. Not committed yet.

### F3 — A malformed goal or `firstPlan` override fails with a raw stack trace

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: route.mjs:249-259 (`goalClass`), route.mjs:~492 (`init`)
- **Detail**: A project override that sets `complexity.firstPlan` to null, or `hardKeywords` to a string or to an array with non-strings, makes `goalClass` throw a TypeError, so the orchestrator gets an unparseable stack trace on the first plan step instead of a JSON `halt`. A non-numeric `maxWords` silently makes every goal `plain`. If `meta.json` holds a non-string `goal`, `init` writes it back unchanged. `loadPolicy` validates no key today, so this matches the existing behaviour for other overridden keys, and it only affects the first plan step.
- **Fix**: In `goalClass`, read the keyword list with `Array.isArray(F?.hardKeywords) ? F.hardKeywords.filter((k) => typeof k === "string" && k) : []` and use `Number.isFinite(F?.maxWords)`; in `init`, keep `prev.goal` only when it is a string.
- **Decision**: FIXED — `goalClass` tolerates a missing or malformed `firstPlan` (no keywords match, no goal is short), `decide` reads `firstPlan?.bump ?? {}`, and `init` keeps `prev.goal` only when it is a string. A null `firstPlan`, a string `hardKeywords` with a text `maxWords`, and an object goal no longer throw. Not committed yet.

## Triage Summary

Fixed: F1, F2 (Fix A), F3 (3). Verdict after fixes: NEEDS ATTENTION → APPROVED.
