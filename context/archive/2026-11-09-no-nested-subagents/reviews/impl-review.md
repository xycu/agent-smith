<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Forbid nested subagents in pipeline steps Implementation Plan

- **Plan**: context/changes/no-nested-subagents/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

Done in this subagent, without nested subagents, per the orchestrator note and the change itself. Diff reviewed: `faaff97^..f5dafa7` (the three phase commits); later commits are run-state commits of the router.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Plan adherence (per planned change)

- Phase 1.1 suffix rule (`policy.json` `prompts.suffix`): MATCH. One rule line after the two deletion rules, before `Finish your reply`, names the Agent and Task tools and the reason; no advisor, `Read`, `Grep`, `Glob` or tier word.
- Phase 1.2 implement templates (`implement`, `implement-segment`, `executor-retry.md`): MATCH. Identical line in all three; `implement` stays a string.
- Phase 1.3 executor guides (`executor-tdd.md`, `executor-e2e.md`): MATCH.
- Phase 1.4 `research-with-map.md`: MATCH. No `subagent`, three analyses kept, no `frontmatter`.
- Phase 1.5 `prompts/README.md`: MATCH. Opening paragraph names the nesting rule; the `refactor-opportunities-research.md` row gets the clause; three Not wired rows kept.
- Phase 1.6 and 2.3 and 3.4 `nested-subagents.test.mjs`: MATCH. Checks (a) to (e), the sixth-rule checks and the doc checks are present.
- Phase 1.7 `route.test.mjs`: MATCH. Seven rules, `rules[6]` asserted.
- Phase 2.1 sixth anti-stall rule and intro: MATCH. Same line in both skills; intro names rules 1, 2, 3 and 6 per step and rules 1 and 6 for the archive subagent; defers to rules 1 and 4, so no idle wait on a foreign hand-back.
- Phase 2.2 pinned counts: MATCH (`skill-loop`, `openspec-skill`, `archive-gate`).
- Phase 3.1 `docs/REFERENCE.md`: MATCH. Limits note replaced, anti-stall counts six with the new split, new bullet, upgrade notes; File deletion and Advisor sections untouched.
- Phase 3.2 ADR-018: MATCH. ADR-016 headings, rule lines in scenario form, alternatives and not-covered list as planned.
- Phase 3.3 `AGENTS.md`: MATCH. ADR-018 named, test bullet added, the two "five" bullets now say six.

## Findings

### F1 — Suffix rule only fires when a skill or prompt asks for delegation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/policy.json:210 (`prompts.suffix`, the nesting rule); docs/ADR/ADR-018-no-nested-subagents.md:22
- **Detail**: The rule's condition is "**GIVEN** a skill or a prompt tells you to delegate work to a subagent, to run work in parallel with subagents or to use the Agent tool". A step subagent that reaches for the Agent tool on its own judgment (the host's own tool guidance invites a search subagent for broad searches) does not clearly meet that GIVEN, so the ban reads as conditional. The plan's intent is a ban "for every step", `change.md` says "The subagent **MUST NOT** call the Agent tool", and REFERENCE.md says the suffix "forbids the Agent and Task tools" unconditionally. The wording came from the plan, which allowed the implementer to tighten it but not weaken it, so this is a plan-level gap the implementation copied.
- **Fix**: Widen the condition to "a skill, a prompt or your own judgment would have you delegate work to a subagent, run work in parallel with subagents or use the Agent tool", in the suffix and in the matching ADR-018 rule line; the THEN part, the keyword and the reason stay.
- **Decision**: APPLIED - a2b0095 (suffix and ADR-018 rule line widened; whole suite 946 pass, 0 fail, 2 skipped; the plan's automated criteria rerun green)

### F2 — ADR-018 assumption numbers differ from the plan's

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/ADR/ADR-018-no-nested-subagents.md:53-60
- **Detail**: The plan's A5 is "ADR-018 is written" and its A6 the commit type; the ADR's A5 is the unwired `refactor-opportunities-research.md` and its A6 the commit type, and it drops the plan's A5. Each list is consistent in itself, but an owner who confirms "A5" against both documents reads two different readings.
- **Fix**: None needed for routing; the owner may align the numbering when confirming the ADR.
- **Decision**: PENDING - an observation with no clear fix: which numbering is canonical is the owner's call when confirming ADR-018 (status Proposed); it does not affect routing.
