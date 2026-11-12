# Array-form archive prompt and suffix override — Plan Brief

> Full plan: `context/changes/array-prompt-override/plan.md`

## What & Why

Prompt overrides may be a string or an array, but the archive prompt and the suffix skip `promptText`. An array archive override throws after the pre-archive commit; an array suffix prints `a,b`. Fix: use `promptText` in both places (issue #89).

## Starting Point

`promptText` and `checkPrompts` already handle both forms. Raw reads sit at `isolation.mjs:680-681` and `route.mjs:180`.

## Desired End State

Array overrides of `archive` and `suffix` render joined by newlines; string defaults are unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Validation | none new | `checkPrompts` covers every key at `next` | Plan |
| Docs/ADR | none | Behavior already documented | Plan |

## Scope

**In scope:** two call-site edits, tests for both forms.

**Out of scope:** `promptText`, policy, docs.

## Architecture / Approach

Replace `policy.prompts.X` with `promptText(policy, "X")` at three places.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Resolve via promptText | Fix plus tests | Existing prompt-equality tests (low) |

Prerequisites: none. Effort: small.
