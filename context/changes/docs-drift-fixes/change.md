---
change_id: docs-drift-fixes
title: Fix the places where README, REFERENCE, the ADRs and the manifests disagree with the code
status: implemented
created: 2026-11-12
updated: 2026-11-14
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


## Implementation evidence

### Seven findings reconciled

1. README Quick start qualifies the report path relative to the run root and names the isolated worktree, branch and created-date archive destination. Source contract is paths() in state.mjs and the archive lifecycle in isolation.mjs.
2. The existing stored PR-comment intent and posting procedure remain in place. The README flag row links to the reference’s PR comment (opt-in) section for manual posting and recovery.
3. The reference has one Run lock bullet, retaining execution locking and status --report. The obsolete duplicate was removed.
4. OpenSpec history links to archived probes, plan row 5.6 and the completed openspec-project-rules report. The recorded 2026-11-09 verification is PASS with zero critical findings and zero warnings.
5. Six ADRs carry local historical amendments or repaired reference destinations. Original claims were checked line by line, allowing only the planned pointer substitutions. Links and heading fragments resolve. Both policy ladders have eight entries, and the provenance ignore list matches the amendment.
6. All 17 placeholders match PROMPT_PLACEHOLDERS. The prompt index documents NARROW_PLACEHOLDERS and render()’s empty-text fallback, preserving unknown-name rejection covered by the policy tests.
7. Manifest descriptions already matched at baseline. The standalone guard now requires nonblank exact equality. Its 13 focused tests cover drift in either manifest, invalid and absent descriptions, malformed or missing entries, the three-field collect() contract, CLI exit 1 and unchanged manifest bytes. Existing version tests still pass.

### Gates and adaptations

- Phase 1 source and link checks passed. All 88 focused tests passed. Full suite passed with 1,476 passing tests, zero failures and three skips. Commit 15eda5d.
- Phase 2 historical-text, link, ladder and provenance checks passed. All 38 focused tests passed. Full suite passed with 1,476 passing tests, zero failures and three skips. Commit 6840d4c.
- Phase 3 full suite passed with 1,481 passing tests, zero failures and the same three skips. Commit 0413dec. Final ownership, protected-path, release-version and whitespace checks passed.
- Phase 3 repository CLI reports version-check OK (1.10.2). All 13 focused tests passed. Deliberately disabling equality made the drift and CLI tests fail, after which the original code was restored unconditionally.
- Scratch fixtures use TMPDIR under the worktree. The initial focused run exposed enclosing-repository Git discovery in scratch fixtures. A scratch-parent .git boundary restored the fixtures’ expected unavailable-Git state. The rerun passed. Production and fixture logic required no change for this environment issue.
- The suite’s three skips are the two GH_LIVE opt-in network/authenticated-gh probes and the absent CLAUDE.md import check. OpenSpec CLI contract fixtures ran successfully.
- Assumptions follow the approved plan. Existing aligned description wording and the single-plugin comparison pair are retained, supported by skill-loop.test.mjs. Historical claims use archived evidence and release/pricing commits. Current-host live acceptance remains with the owning changes.
- Protected archive and scheduling paths, the manifests and all three release-owned version fields match the pre-implementation baseline. The pre-existing router-owned run.jsonl edit stays outside these phase commits.

There are no Manual rows in this plan.
