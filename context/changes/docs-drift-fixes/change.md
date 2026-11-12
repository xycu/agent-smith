---
change_id: docs-drift-fixes
title: Fix the places where README, REFERENCE, the ADRs and the manifests disagree with the code
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low. One change for the small documentation gaps; `AGENTS.md` has its own change (`agents-md-slim`).

### Problems (each verified against the files)

1. `README.md:54` says "The report lands in `context/changes/<change-id>/agent-smith/report.md`." With the default `isolation.require: true` that folder in the main checkout holds no run files; the report is in the run worktree `.claude/worktrees/agent-smith-<change-id>/` and on the branch `agent-smith/<change-id>` until its pull request is merged.
2. Both skills print "run the script by hand after the run, see the README". The README has only the `--pr-comment` row of the options table; the by-hand steps are in `docs/REFERENCE.md` (PR comment section).
3. `docs/REFERENCE.md` holds the "Run lock" paragraph twice, at lines 246 and 353. The second copy sits inside the list of anti-stall rules.
4. `docs/REFERENCE.md:476` says "no live run of the whole skill has been done yet" about the OpenSpec skill. The archived plan `context/archive/2026-11-09-openspec-pipeline/plan.md` records the live run of `openspec-project-rules` on 2026-11-09 (row 5.6).
5. Decision records whose text a later record changed, with no amendment note:
   - `ADR-005`, line 19: "seven ladder tiers". The ladder and `baseline-policy.json` have eight since ADR-010.
   - `ADR-009`, line 64: "`provenance.ignore` (default `compare` and `provenance`)". `policy.json:103` has `compare`, `provenance`, `prices`, `coAuthor`.
   - `ADR-003`, line 132: the PR comment runs at "`archive` before the move". Since ADR-017 it runs after the move.
   - `ADR-008`, line 41: "stays on a `0.x` version". The version is 1.5.0.
   - Pointers to README sections that do not exist (the README headings are Why, Install, Quick start, Options, Configure, More, License): `ADR-003:377` (README, "Budget"), `ADR-010:14` and `:95` (README "Baseline comparison"), `ADR-013:119` ("the README layout block").
6. `skills/10x-pipeline/prompts/README.md` lists the placeholders the router fills, without `{artifacts}`, `{authority}` and `{failure}`, which `policy.json` uses. It also does not say that an unknown name renders as empty text (`steps.mjs:670`).
7. `AGENTS.md` asks to keep `description` aligned between `plugin.json` and `marketplace.json`. They differ ("... and routes each step to a model and effort level based on the results of earlier steps" against "... with dynamic model and effort routing"), and `tools/version-check.mjs` compares versions only.

### Fix direction

- Items 1 to 4 and 6: edit the text. Item 2 disappears if `pr-comment-flag-in-meta` lands first.
- Item 5: add one line "Amended by ADR-0NN: ..." under each stale line, as ADR-003 already does for ADR-012. Do not rewrite a record. Point the README references at `docs/REFERENCE.md`.
- Item 7: copy one description into the other, and add an equality check of the two descriptions to `tools/version-check.mjs` with a test in `tools/test/`.
- `context/archive/` is read-only: change nothing there.

### Tests

- The full suite; several tests pin `docs/REFERENCE.md` and ADR text (`nested-subagents.test.mjs`, `skill-loop.test.mjs`, `no-recursive-delete.test.mjs`).
- The new description check, if added.

### Done when

Each of the seven items reads the same in the document and in the code.
