# Slim AGENTS.md to rules and pointers — Plan Brief

> Full plan: `context/changes/agents-md-slim/plan.md`

## What & Why

`AGENTS.md` is 33 KB and loads in every agent session; 60 percent of it is a catalog of tests, prompts and ADRs that is unordered, incomplete, duplicated and partly false. Cut it to about 8 KB of rules, commands and pointers, and move the catalog to indexes next to what they index.

## Starting Point

`## Project Structure` holds 45 long bullets. The test command, the hidden-release-sections rule and the ADR-019 text each appear more than once. Three statements are stale: the version is "0.x" (it is 1.6.1), "the first release PR confirms it", and a smoke check that passes on a halt. `status --report` and `pr-comment.mjs --timeout-ms` are missing from Commands. Three tests pin `AGENTS.md` text.

## Desired End State

`AGENTS.md` has Hard Rules (unchanged), Commands (test command once, the smoke check with the override it needs, one line per command), Commits, Coding Style, a 10-12 line Layout of pointers and a short Releases section. `skills/10x-pipeline/test/README.md` and `docs/ADR/README.md` are the new indexes. The suite passes and CI is green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Prompt bullets | Deleted | `prompts/README.md` already indexes every prompt. | Plan |
| `state.mjs` export lists | Dropped, import-order rule kept as one sentence | The code is the index and `docs/REFERENCE.md` is already 134 KB. | Plan |
| Size check | Added, 12 KB limit in `tools/test/agents-md-size.test.mjs` | Keeps the file from growing back; the change called it optional. | Plan |
| Command lines | Synopsis with flags, one clause each | `--timeout-ms` is documented nowhere else, so the flags stay. | Plan |
| `--timeout-ms` | One sentence added to `docs/REFERENCE.md` | Closes the stale-statement gap at its source. | Plan |
| Test pins | Moved to the index that holds the text | Advisor pin to `prompts/README.md`, the test index and the ADR index; pr-comment test slices to the next heading. | Plan |
| Hard Rules | Kept word for word | They hold the `removeTree` and `pr-comment.mjs` pins and the rules that must not drift. | Change |

## Scope

**In scope:** rewrite `AGENTS.md`; add the two indexes; one sentence in `docs/REFERENCE.md`; re-point the advisor and pr-comment pins; size test.

**Out of scope:** router code, policy, prompts, `SKILL.md`, ADR texts; a test that checks every path in `AGENTS.md`; `context/archive/`.

## Architecture / Approach

Phase 1 only adds files, so the suite cannot break. Phase 2 changes `AGENTS.md` and the pinning tests in one commit. Phase 3 re-runs everything and the pull request goes up through `open-pr.mjs`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Index files | `test/README.md`, `docs/ADR/README.md`, `--timeout-ms` sentence | A test or ADR left out of an index (checked by a loop). |
| 2. Rewrite AGENTS.md | Slim file, re-pointed pins, size test | A pin breaks; the `no-recursive-delete` scan also reads the new READMEs. |
| 3. Verify and PR | Full suite, commit lint, smoke check, CI | CI runs on a self-hosted runner outside the repository. |

**Prerequisites:** Node 24, the run worktree.
**Estimated effort:** about 3 sessions, docs and tests only.

## Open Risks & Assumptions

- Assumption: dropping the `state.mjs` export lists loses nothing an agent cannot read from the code.
- Assumption: the 12 KB limit leaves room (target is 8 KB).
- Risk: "CI is green" cannot be confirmed from the repository.

## Success Criteria (Summary)

- `AGENTS.md` is about 8 KB and no statement in it contradicts the repository.
- Every test and ADR file is findable from an index; the full suite passes.
- CI is green on the pull request.
