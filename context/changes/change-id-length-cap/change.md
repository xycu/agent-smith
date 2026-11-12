---
change_id: change-id-length-cap
title: Refuse a change id longer than 100 characters at init
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low.

### Problem

The router accepts a change id of any length (`skills/10x-pipeline/scripts/route.mjs:828`, `/^[a-z0-9][a-z0-9-]*$/`). The two scripts that end a run cap it at 100 characters (`ID_RE` in `scripts/pr-common.mjs:10`, `/^[a-z0-9][a-z0-9-]{0,99}$/`) and exit 2 on a longer one.

So a run with a longer id works through every step and then cannot push its branch or open its pull request, which ADR-017 makes the only way out of the run worktree. The OpenSpec skill documents the gap instead of closing it: "a change name longer than 100 characters, which the script refuses and the router does not".

### Reproduction (verified)

1. Scratch project, change id of 101 times `a`: `route.mjs init <id> --goal g` returns `run plan`.
2. `open-pr.mjs <id>` prints `<change-id> must match ^[a-z0-9][a-z0-9-]{0,99}$` and exits 2. `pr-comment.mjs <id>` does the same.

### Fix direction

- `init` halts before anything is read or written when the id is longer than 100 characters, and names the limit. Other commands keep accepting a longer id, so a run that is already in flight can still be inspected.
- The router must not import `pr-common.mjs` (and that file imports no router module). Keep the pattern once in `state.mjs`, and add a parity test against `ID_RE` of `pr-common.mjs`, as `coauthor.test.mjs` does for the trailer rule.
- Remove the parenthesis about the 100 characters from both skills, and name the limit in `README.md` and `docs/REFERENCE.md`.

### Tests

- `init` with a 100-character id starts a run; with 101 characters it halts and the project is byte-identical; both chains.
- The parity test of the two patterns.

### Done when

No id the router accepts at `init` is refused by `open-pr.mjs` or `pr-comment.mjs`.
