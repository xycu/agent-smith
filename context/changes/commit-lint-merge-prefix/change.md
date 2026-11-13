---
change_id: commit-lint-merge-prefix
title: Stop commit-lint from accepting any subject that starts with Merge
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low.

### Problem

`tools/commit-lint.mjs:17`: `if (subject.startsWith("Merge ")) return null;`. The line is meant for merge commits, but it tests the text, not the commit. An ordinary commit with the subject "Merge the two parsers into one" is accepted: `lintSubject("Merge the two parsers into one")` returns `null`.

Such a commit passes the `commits` job, lands on `main` through the rebase-merge, and release-please finds no type in it: no changelog line and no version bump for that change.

Second gap: `.github/workflows/ci.yml:38` runs the lint only on `pull_request`. A commit pushed straight to `main` is never linted. All commits on `main` pass today, so this is a missing check and not a present fault.

### Fix direction

- Delete line 17 and pass `--no-merges` to `git log` in `lintRange` (`:27`). Real merge commits are then left out by git, and a subject is judged on its form alone.
- Optional: lint pushes to `main` too, over `${{ github.event.before }}..${{ github.sha }}`, in a job that reports and does not block (the commits are already on `main`).

### Tests

- `tools/test/commit-lint.test.mjs`: "Merge the two parsers into one" is an error; a range that holds a real merge commit passes; the existing cases stay.

### Done when

A non-merge commit whose subject starts with "Merge " fails the `commits` job.

**Rescoped 2026-11-13.** Gap 1 (the `Merge ` exemption) is folded into `squash-merge-pr-title-lint` phase 1. Gap 2 (lint pushes to `main`) no longer applies: the ruleset blocks direct pushes, and with squash-only merging the pull request title is the one subject on `main`.
