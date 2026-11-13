# Squash-only merging: PR title lint, run PR titles, docs — Plan Brief

> Full plan: `context/changes/squash-merge-pr-title-lint/plan.md`
> Research: `context/changes/squash-merge-pr-title-lint/research.md`

## What & Why

The repository now squash-merges only, so the pull request title is the single commit subject that lands on `main`, and release-please reads it to pick the changelog line and the SemVer bump. An untyped title is dropped silently. Nothing lints it, every run PR is opened with an untyped title, and the docs still say the repository rebase-merges.

## Starting Point

`ci.yml` lints branch commits with `tools/commit-lint.mjs`. `open-pr.mjs` titles run PRs from the plain `title:` of `change.md`. ADR-008 rejected a title lint because "the PR title never reaches `main`", and says three times that `main` has no ruleset.

## Desired End State

A PR with a bad title shows a red, advisory `PR title` check; editing the title re-runs only that check. Run PRs open as `<type>(<change-id>): <title>`. No doc says rebase-merge; ADR-008 has Amendment 2 and ADR-017 has Amendment 1.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the title check lives | New `pr-title.yml`, types `opened`, `edited`, `synchronize`, `reopened`, own concurrency group by PR number | `ci.yml` cancels by ref, so `edited` there would cancel `test` | Research |
| How it lints | `tools/commit-lint.mjs --title`, title passed through `env:` | Reuses `lintSubject`, no dependency, no script injection | Research |
| Advisory or required | Advisory | A release PR opened with `GITHUB_TOKEN` runs no workflow, so a required check would block it (ADR-008) | Research |
| Runner | Same `runs-on` as `ci.yml`, pinned by an extended `ci-runner` test | ADR-020 and one runner story | Plan |
| `Merge ` exemption | Removed; range lint uses `--no-merges` (folds in `commit-lint-merge-prefix` gap 1) | A title is never a merge commit, and git skips real ones | Plan |
| Per-commit `commits` job | Kept as hygiene | Harmless, keeps the commit rule visible, costs no change | Plan |
| Squash body setting | `COMMIT_MESSAGES` stays | Bullets give no entry and no bump in release-please 17.6.0; trailers stay on `main` | Research |
| Run PR title | Derive `<type>(<id>): <title>`, highest-ranked type among the run commits, `chore` if none; fall back to the untyped title if git fails | Needs no `change.md` key, works for OpenSpec, no `SKILL.md` edit | Plan |
| Existing PR title | Set once at creation; owner edits are never overwritten | Same rule as today | Plan |

## Scope

**In scope:** title mode and `Merge ` change in `commit-lint.mjs`; `pr-title.yml` and its tests; `open-pr.mjs` title derivation and tests; ADR-008 Amendment 2, ADR-017 Amendment 1, AGENTS.md, header comments, test index; a live check.

**Out of scope:** required checks; dropping the `commits` job; changing squash settings; `type:` key or `--type` flag; `SKILL.md` edits; linting `BREAKING CHANGE:` footers; `context/archive/` and other changes' text.

## Architecture / Approach

Pure `lintSubject` is the single rule. It runs per branch commit (range mode) and per PR title (title mode, new workflow). `open-pr.mjs` produces titles that pass the same rule by ranking the Conventional Commit types of the run's commits.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. commit-lint title mode | `--title`, no `Merge ` exemption, `--no-merges` | Existing tests that assume the exemption |
| 2. PR title workflow | `pr-title.yml`, pinning tests, runner test extension | Real trigger behavior only visible on GitHub |
| 3. Run PR titles | `prTitleFor` in `open-pr.mjs`, tests, ADR-017 Amendment 1 | Fixtures that pin the old title |
| 4. Docs | ADR-008 Amendment 2, AGENTS.md, pointers, rescope note | AGENTS.md size cap (12288 bytes) |
| 5. Live check | Red/green check, no `test` cancel, real squash body | Only a human can observe it |

**Prerequisites:** none; the ruleset and squash settings are already live.
**Estimated effort:** ~3 sessions across 5 phases; phase 5 waits for the PR.

## Open Risks & Assumptions

- Assumed (no human to ask): advisory, keep `commits` job, keep `COMMIT_MESSAGES`, derive the run title.
- A `BREAKING CHANGE:` line in any branch commit body makes the whole squash major, and an unbulleted type-prefixed paragraph is read as an extra commit. Accepted, written into Amendment 2.
- The exact squash body bytes and the ` (#N)` suffix are unobserved until the first squash merge (phase 5).
- A fix added after review is not re-typed in an already open run PR; the title lint only catches untyped titles.

## Success Criteria (Summary)

- A bad PR title gives a red advisory check, and fixing it re-runs only that check.
- A run PR is opened with a conventional title.
- Nothing in the listed files says the repository rebase-merges, and the full test suite passes.
