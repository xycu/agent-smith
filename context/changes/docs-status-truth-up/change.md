---
change_id: docs-status-truth-up
title: Bring ADR statuses, WAVES.md, dead links and pending notes up to date
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 18 (should fix). Found by reading and by `grep` over the documents.

**The defect.** The documents say more was done, or less, than the code shows. A reader, human or agent, who trusts them acts on stale state. The repository holds about 739 KB of prose against about 447 KB of code, so the stale part is not small.

**1. Dead links (6).** All point to `context/changes/<id>/evidence/...`, and the targets moved to the archive when the changes were archived:
- `docs/ADR/ADR-019-late-usage-figure.md:86`
- `docs/ADR/ADR-018-no-nested-subagents.md:91` and `:117`
- `docs/REFERENCE.md:21`, `:340` and `:411`

The targets now live under `context/archive/2026-11-12-nested-subagent-hard-stop`, `2026-11-12-step-prompt-by-file`, `2026-11-13-openai-codex-support` and `2026-11-18-delegated-token-accounting`.

**2. ADR statuses that do not match the code.** ADR-012, 014, 015, 016 and 018 say "Proposed" while their rules are enforced by code and tests. ADR-009, 010 and 017 say "Accepted" with a part "still pending". ADR-010 has four amendments, ADR-008 and ADR-017 three each; a reader must apply them in order to learn the rule in force.

**3. `context/changes/WAVES.md` is out of date.** 126 lines. Line 3 names v1.13.0; the released version is 1.14.0. Line 116 says `quote-router-in-skill-loops` is the only change left; `context/changes/` holds many open folders.

**4. "Pending" notes in the README.** `README.md:32`, `:103`, `:142` and `:148` end with "pending". Some of the items are done and some will never be; the reader cannot tell which.

**5. The roadmap.** `context/foundation/roadmap.md:52` still shows S-12 as ready, and S-20 at `:59` needs the same check.

**6. Archived plans with open rows (read only).** 35 archived plans hold 58 unchecked rows (`grep -c "^- \[ \]" context/archive/*/plan.md`), for example `2026-11-13-step-subagent-git-guard/plan.md:380`, `2026-11-16-nested-step-delegation/plan.md:291`, `2026-11-18-delegated-token-accounting/plan.md:322` and `2026-11-09-worktree-pr-only/plan.md:248`. Most are Manual rows that a human never ticked. `context/archive/` is read-only by convention, so this change does not edit them. It only decides what to do about the cause.

**Direction (for the plan to confirm).**
- Fix the six links to the archive paths. Add a small test under `tools/test/` that resolves relative links in `docs/` and the README, so the next archive move fails CI instead of leaving a dead link. The plan decides whether that test is worth its upkeep.
- Set each ADR status to what is true. Where an ADR has three or more amendments, add a short "Rule in force" section at the top that states the current rule; leave the history below it.
- Rewrite `WAVES.md` from the real folder list, or delete the file if nobody uses it. The owner decides; say which in the plan.
- Resolve each README "pending": done, dropped, or an open change with its id.
- Check S-12 and S-20 against the code and set their state.
- For the cause of item 6: decide whether the archive gate (`verify-archive`, the `archive` step) should refuse a plan with unchecked Automated rows, and whether Manual rows need a recorded answer. If yes, open a separate change for it; do not widen this one.

**Constraints.**
- Never edit `context/archive/` (AGENTS.md Hard Rules).
- Deleting a file is one file at a time; no recursive or forced delete (ADR-016).
- `version` fields are set only by the release pull request; do not edit them to make a document true.
- Routing documentation belongs in `docs/REFERENCE.md`; an ADR index change goes in `docs/ADR/README.md`.
- Documentation only, except the optional link test. Commit type `docs`.

**Done when.**
- No link in `docs/` or the README points to a missing file.
- No ADR whose rule is enforced by code says "Proposed", and each "pending" in an ADR or the README names what is pending and where it is tracked.
- `WAVES.md` matches `context/changes/`, or is gone.
- The roadmap states of S-12 and S-20 match the code.
- The decision about unchecked rows in archived plans is recorded, with a change id if one was opened.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
