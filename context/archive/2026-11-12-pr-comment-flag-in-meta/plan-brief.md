# Store the --pr-comment request in meta.json — Plan Brief

> Full plan: `context/changes/pr-comment-flag-in-meta/plan.md`

## What & Why

The `--pr-comment` request lives in a session task today. That needs task tools, an env key and permissions that a project installing the plugin does not have, so the user's explicit request is silently dropped; a resume in a new session loses it too. The router already stores `--archive` in `meta.json`; `--pr-comment` should work the same way.

## Starting Point

`init` halts on a flag it does not read and stores `archive` and `chrome` in `meta.json`. Both `SKILL.md` files carry the task design: three task tools in `allowed-tools`, Start step 5, a "call TaskList" paragraph in `done`, `archive` and `halt`, and a task-gated PR comment section. Tests pin that text, and `.claude/settings.json` enables the tools for this repository only.

## Desired End State

`init --pr-comment [true|false]` stores `prComment`; a resume keeps it; `false` turns it off. `done`, `archive` (before the move), `halt` and `status` report `prComment: true`. Both skills say "when the output has `prComment: true`, do the PR comment step" and name no task tool. A run started with `--pr-comment` posts its report in any session that can run the script.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the flag lives | `meta.prComment`, written by `init` like `--archive` | The sibling flag already works this way and a resume keeps it. | Change |
| `--pr-comment false` | Stores `false`; outputs show the field only as `true` | Mirrors `--archive` and `--chrome`; no `false` noise in outputs. | Plan |
| Bare `--pr-comment` | Means `true` | Same rule as `--archive`. | Plan |
| Where outputs get the field | `finishRun` (all `endRun` outputs) plus the five direct `out()` calls of `archiveDone`, both through one `prCommentField(meta)` helper in `state.mjs` | One spread covers every ordinary end; the archive path bypasses `finishRun`; one helper keeps the rule in one place. | Plan |
| `archive` action | Top-level `prComment`, `summary` unchanged | Tests `deepEqual` the summary. | Plan |
| Provenance and `report.md` | Not recorded | `prComment` does not route. | Plan |
| `pr-comment.test.mjs` | Updated, not "unchanged" | It asserts `TaskList`, `TaskCreate` and the task subject. | Plan |
| ADR-003 | Appended `Amendment 1`; original text and seven rules untouched | A test pins the seven rules; change asks to amend. | Change |
| Settings | Remove `env` and `permissions` from `.claude/settings.json` | Nothing else uses task tools. | Change |

## Scope

**In scope:** `route.mjs` (`INIT_FLAGS`, parsing, `status`), `flow.mjs` (`finishRun`), `isolation.mjs` (`archiveDone`), both `SKILL.md` files, content tests, a new `pr-comment-flag.test.mjs`, `docs/REFERENCE.md`, `README.md`, ADR-003 amendment, `.claude/settings.json`, test index row.

**Out of scope:** any `gh` call in the router, `pr-comment.mjs`, `open-pr.mjs`, `policy.json`, provenance, `halt()` before run state exists.

## Architecture / Approach

Router first, so the skills read data that exists: `init` parses the flag with the `--archive` pattern and writes `meta.prComment`; `finishRun` and `archiveDone` add `prComment: true` to their output objects; `status` echoes it. Then the skills lose the task bookkeeping and gate the PR comment step on that field. `pr-comment.mjs` edits its own marker comment, so repeating the step is harmless.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router stores and reports prComment | Flag, outputs, `status`, new tests | A direct `out()` path in `archiveDone` missed |
| 2. Skills drop the task | Both `SKILL.md` files and their content tests | Breaking pinned wording (halt sentence, step order, banned words) |
| 3. Docs, ADR amendment, settings | REFERENCE, README, ADR-003, settings, full suite | Test that slices ADR-003 by heading |

**Prerequisites:** Node 24+, `git` for the archive-path tests.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumption: `--pr-comment false` stores `false` rather than deleting the key (mirrors `--archive`).
- Assumption: a pre-run `halt()` (usage error, archived guard) needs no `prComment`; it has no report to post.
- Risk: a run in flight before this change has no `prComment`; the user passes the flag again on resume.

## Success Criteria (Summary)

- A run started with `--pr-comment` posts its report with or without task tools, also after a resume in a new session.
- Neither `SKILL.md` names `TaskCreate`, `TaskUpdate` or `TaskList`.
- The full suite passes, including the new init, skill-content and archive-gate tests.
