# No recursive force delete — Plan Brief

> Full plan: `context/changes/no-recursive-delete/plan.md`

## What & Why

Ban `rm -rf` and every other recursive or forced directory delete from the prompts, skills, scripts, tests and docs of this repository. The replacement is: list the files, check the list, delete them one by one, then `rmdir` the empty directories, deepest first. People block `rm -rf` in their harness, and a run that hits the block stalls.

## Starting Point

No prose uses `rm -rf` today, but no rule forbids it either: `manual-verify.md` tells the subagent to make a `mktemp -d` scratch directory and says nothing about removing it, and the shared prompt suffix has no delete rule. In code, `fs.rmSync(..., { recursive: true })` appears about 30 times: once in `pr-comment.mjs` and the rest in test cleanup (`helpers.mjs`, ten test files, two files in `tools/test`).

## Desired End State

Every place an agent is told to delete a directory names the list, check, delete one by one, `rmdir` procedure. Code and tests use one shared helper, `removeTree`. A guard test fails if a banned form returns. `AGENTS.md`, `docs/REFERENCE.md` and ADR-016 state the rule.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tests count | `fs.rmSync` with `recursive: true` in tests is banned too | The goal names tests and router code, and a narrow reading leaves the ban untestable | Plan |
| Helper | `scripts/remove-tree.mjs`, `removeTree(dir)`, no `recursive` or `force` option | One implementation of the procedure for code and tests, Node built-ins only | Plan |
| Where the prompt rule lives | `prompts.suffix` plus `manual-verify.md` plus both `SKILL.md` | The suffix reaches every step, isolated or not; `worktree.md` reaches isolated runs only | Plan |
| Banned forms | `rm` with a recursive flag, `rimraf`, `shutil.rmtree`, `find -delete`, recursive `fs.rm*` | `find -delete` removes a tree with no list to check | Plan |
| Not banned | `mkdirSync`/`cpSync` recursive, single-file `rmSync`, `git worktree remove` | They create or remove one path, not a tree | Plan |
| Enforcement | Prompt rule and guard test only | The router cannot see what a subagent runs | Plan |
| ADR | New ADR-016 | A repository-wide hard rule and a shared helper | Plan |

## Scope

**In scope:** the helper and its tests, every recursive delete in code and tests, the rule in the suffix, `manual-verify.md` and both skills, the guard test, `AGENTS.md`, `docs/REFERENCE.md`, ADR-016.

**Out of scope:** `context/archive/`, run state, router routing, git-write rules, harness hooks, npm dependencies.

## Architecture / Approach

A standalone module `remove-tree.mjs` lists the tree with `lstat`/`readdirSync` (symlinks never followed), checks every path lies under the target, unlinks files one by one, then calls `rmdirSync` deepest first. It refuses an empty path, the root and the home directory. A new test file holds the helper tests and the guard, which scans `skills/`, `agents/`, `docs/`, `tools/`, `README.md` and `AGENTS.md`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The removeTree helper | `remove-tree.mjs` and its tests | Read-only git objects and symlinks in scratch trees |
| 2. Replace every recursive delete | `pr-comment.mjs` and ~30 test call sites use `removeTree` | A cleanup that stops working leaves `as-*` directories in the temp dir |
| 3. Put the rule in the text agents follow | Two suffix rules, a `manual-verify.md` rule, both skills, prompts README | One bold keyword per rule line (`rules.test.mjs`) and the anti-stall text staying equal |
| 4. Guard test and documents | Guard, `AGENTS.md`, `REFERENCE.md`, ADR-016 | Guard false positives on lines that state the ban |

**Prerequisites:** Node 24, the branch `agent-smith/no-recursive-delete`.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Test cleanup counts as a recursive force delete (owner may read it narrower).
- `prompts.suffix` changes, so a run in flight records `provenance.drift` for `prompts`; routing is unaffected.
- Prompt rules are advice: nothing stops a subagent from running `rm -rf`; the harness block stays the backstop.
- ADR-014 and ADR-015 do not exist on this branch; ADR-016 is named as the user asked.

## Success Criteria (Summary)

- The whole suite passes and the guard finds no banned form.
- A returned prompt ends with the two delete rules before the `RESULT` instructions.
- No `as-*` scratch directory is left in the temp dir after a suite run.
