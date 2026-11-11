---
change_id: pin-action-shas
title: "Pin the GitHub Actions of ci.yml and release.yml to commit SHAs"
status: impl_reviewed
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #99.

## What this is

The workflows use actions by tag: `googleapis/release-please-action@v5` in `.github/workflows/release.yml:32`, `actions/checkout@v5` and `actions/setup-node@v5` in `.github/workflows/ci.yml`.

## Problem

A tag can be moved to other code. `release.yml` runs with `contents: write` and `pull-requests: write`.

## Fix

Pin each action to a full commit SHA, with the version in a comment.

## If we skip it

An action whose tag is moved runs with a write token for this repository.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
