# Step guard bypass forms — Plan Brief

> Full plan: `context/changes/step-guard-bypass-forms/plan.md`

## What & Why

The Bash guard for `agent-smith:step` subagents denies `git push`, `rm -rf` and similar only when they are the first word of a command. Wrap them in `X=1 ...`, `( ... )`, `if ...; then`, `$(...)`, a backtick, `xargs`, `find -exec`, `env`/`sudo`/`timeout`, or abbreviate an option (`--no-verif`, `--har`), and they pass. The 2026-11-19 audit confirmed about 60 such forms. The guard also wrongly denies `git log --grep "--no-verify"`. This plan closes the forms an AI step writes by habit, without turning the guard into a shell interpreter.

## Starting Point

`step-guard.mjs` (747 lines) scans words, splits on `;`, `&`, `|` and newline, and checks `words[0]`. It already has a heredoc-aware lexer (`shellExpansionEnd`) from the merged `step-guard-heredoc-false-positives`. Long options are compared as exact strings. The test file pins direct forms and asserts that `echo "$(git push)"` passes.

## Desired End State

Every form from the change list is denied, each next to an allow case for a normal command of the same shape (`X=1 git status`, `(cd sub && git status)`, `git switch feature`, `git reset --soft HEAD~1`). The three `--no-verify` search commands pass. `docs/REFERENCE.md` and `README.md` state the new coverage and what stays out of scope. A live subagent check confirms the denials.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | All forms in the goal and `change.md` direction | The done-when list needs a deny test per form in scope |
| Substitutions | Reuse `shellExpansionEnd`, recurse on the inner text | One matcher exists and is already depth-capped |
| Unparseable forms | Unterminated substitution exits 2; `env -S`, `sudo -s` strings deny with guidance | Fail closed, as the constraints require |
| Option abbreviations | Any non-empty prefix of the denied name | Git rejects ambiguous prefixes, so a floor only leaves valid ones (`--ha`) open |
| `--no-verify` scope | Only `commit merge pull am rebase cherry-pick revert` | Fixes the search-pattern false denial |
| `update-ref` | Deny `--stdin`, delete, `refs/agent-smith/`; allow creating other refs | Steps must be able to preserve work in a ref |
| Hook path override | Deny `-c`/`--config-env` `core.hooksPath=`, case-insensitive | Skips hooks like `--no-verify` |
| Out of scope | `sh -c`, `bash -c`, `eval`, interpreters, aliases, hook-skip env vars, `git config` | Needs a shell interpreter, so documented instead |

## Scope

**In scope:** scanner and normalization in `step-guard.mjs`; Git option handling; guard tests; `docs/REFERENCE.md`, `README.md`, test index row.

**Out of scope:** Codex children, hook wiring and timeout, byte cap, heredoc rules, foundation docs and ADRs, hook-skipping environment variables.

## Architecture / Approach

`commands()` learns to split on `(`/`)`, recurse into `$(...)` and backticks, and drop glued redirects. A new `resolve()` strips assignments and reserved words, unwraps the listed wrappers and `xargs`, and extracts `find -exec` commands. The headless commit gate and `commandProblem` then see the effective command. Git checks use one prefix-aware `longFlag` helper and a per-verb table of discarding forms.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Command shapes and normalization | Scanner and `resolve()`, shape tests | A false denial on a normal command; wrapper option tables miss a case |
| 2. Git option handling | Prefix helper, `--no-verify` scoping, global options, new verbs | Denying a safe form a step needs (commit, branch, ref preservation) |
| 3. Docs, index and live check | Updated reference, README, test index; full suite; live row | Docs drift from tests |

**Prerequisites:** `step-guard-heredoc-false-positives` merged (it is).
**Estimated effort:** about 3 sessions across 3 phases; one script, one test file, three doc spots.

## Open Risks & Assumptions

- No human answered during planning; the decisions above rest on `change.md`, the code and Git's own behavior, and are listed as assumptions.
- The guard source is scanned by a test that forbids words like `import`, `eval`, `Function` and `.exec(` calls, including in comments.
- The live check needs a session with the plugin installed; the harness cannot cover it.

## Success Criteria (Summary)

- Each listed form is denied and each safe sibling still runs, shown by paired tests.
- The full suite passes and the guard stays inside its 5 s hook timeout on pathological input.
- The live subagent denies `X=1 git push` and `(git push)` and runs `X=1 git status`.
