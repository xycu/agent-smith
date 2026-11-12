# ADR-021: Agent Smith co-authors the commits of the router

- **Status:** Accepted (implemented by an unattended run of change `agent-smith-coauthor`; the owner has not yet checked the GitHub attribution on a pushed commit)
- **Date:** 2026-11-12
- **Deciders:** the repository owner (change `agent-smith-coauthor`, `change.md`); unattended plan and implementation runs for the readings below
- **Origin:** change `agent-smith-coauthor` (`context/changes/agent-smith-coauthor/change.md`, `plan.md` and `reviews/plan-review.md`). It builds on ADR-010 (start and step commits, rollback), ADR-017 (`open-pr.mjs`) and ADR-019 (the late-usage commit); no earlier decision is superseded.

## Context

- Claude Code ends the commits it makes with a `Co-Authored-By: Claude ...` trailer, so GitHub shows Claude as a co-author. The commits the agent-smith scripts make had no such line: the start commit, step commits, the rollback snapshot, the pre-archive commit and the late-usage commit of the router (`isolation.mjs`), and the leftover commit of `open-pr.mjs`.
- The owner wants those commits to name Agent Smith the same way: name `Agent Smith`, email `agent-smith@ksycki.pl`, GitHub account `agent-smith-exile`. GitHub links a trailer to an account only when the email is a verified email of that account.
- `open-pr.mjs` may not import a router module (AGENTS.md, ADR-017), so it cannot call `loadPolicy` or a helper of `state.mjs`.

## Decision

### The policy key (D1)

**GIVEN** a commit made by the router or by `open-pr.mjs` **WHEN** `policy.coAuthor` is `{ name, email }` **THEN** the commit **MUST** end with `Co-Authored-By: <name> <<email>>` and keep its subject as it was.

`policy.json` ships `"coAuthor": { "name": "Agent Smith", "email": "agent-smith@ksycki.pl" }`. `{ "coAuthor": null }` in the project override turns it off. The key is in `provenance.ignore` (and in its fallback list in `isolation.mjs`), because it cannot change routing.

### Validation (D2)

**GIVEN** `coAuthor` is not `null`, missing or an object whose `name` and `email` are non-blank strings with no newline, `<` or `>` **WHEN** the router is about to make a commit **THEN** it **MUST** stop before it stages anything, with a reason that starts `policy.coAuthor`.

`coAuthorProblem(policy)` in `state.mjs` returns the message or `null` and never halts; each caller turns it into its own stop (`stop` of the start commit, the step commit and the rollback, `precheck` of the archive path, the refusal of `usage`), so the end-state write and the undo of those callers still run. Read-only commands never read the key. A wrong trailer is worse than none, so the router does not drop a malformed value silently.

### How git gets it (D3)

`git commit` gets `--trailer "<line>"` right after `-m <message>` and before the `--` of the pathspec form, so the git shims and the argument-order test of the archive path keep matching. The rollback snapshot is made with `git commit-tree`, which has no `--trailer`, so it gets a second `-m` paragraph. Hooks and signing apply as before; never `--no-verify`.

### `open-pr.mjs` (D4)

`open-pr.mjs` reads `coAuthor` from the plugin `policy.json` next to it and from `context/foundation/agent-smith-policy.json` under the current directory (an override key, `null` included, wins), with built-ins only. Its `coAuthorLine(policy)` is a copy of the rule of D2 that gives `null` for an invalid value: a malformed key never fails the push or the pull request. `coauthor.test.mjs` feeds both rules the same values and checks they agree.

## Alternatives

- A constant in the scripts: no off switch for a project, and the identity would live in code instead of policy.
- Setting the commit author or committer to Agent Smith (git config or `--author`): it hides the human or Claude identity that made the run, and the router never writes git config.
- A shared standalone `co-author.mjs` imported by both `isolation.mjs` and `open-pr.mjs`: one copy of the rule, but it changes the import rules of AGENTS.md and ADR-017. Left open for the owner (plan review F6); the parity test guards the copy.

## Not done

- Commits made inside step subagents (plan, implement, fix) keep Claude's trailer only; adding Agent Smith there needs a `prompts.suffix` rule and is a separate change.
- No change to author or committer identity, no rewrite of existing commits, no new npm dependency and no change to the `route.mjs` command surface.

## Consequences

- A run that spans the upgrade has mixed history: only commits made after it carry the trailer.
- Whether GitHub shows the `agent-smith-exile` avatar depends on `agent-smith@ksycki.pl` being a verified email of that account, which no test can check.
