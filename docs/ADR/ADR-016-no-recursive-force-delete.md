# ADR-016: No recursive or forced directory delete; list, check, delete one by one, then rmdir

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-09
- **Deciders:** the repository owner (the request in `change.md`, 2026-11-09); unattended implementation run of change `no-recursive-delete` for the readings marked A1 to A5 below
- **Origin:** change `no-recursive-delete` (`context/changes/no-recursive-delete/change.md` and `plan.md`)

## Context

- The owner asked that nothing in this repository delete with `rm -rf`: list the files, check the list, then delete them one by one, because reasonable people block `rm -rf` in their harness (`change.md`, "Notes").
- A pipeline step runs unattended. A subagent whose delete command the harness blocks cannot ask anyone, so the step stalls or fails, and the run spends an attempt on it.
- No prompt, skill or doc named a recursive delete, but none said how to remove a directory either. `manual-verify.md` tells the subagent to make a scratch directory with `mktemp -d` and says nothing about removing it, and both `SKILL.md` files tell the user to "remove or stash" the stale main-checkout copy of the change folder with no method.
- Code and tests removed about 30 trees with `fs.rmSync(dir, { recursive: true, force: true })`, one of them in `skills/10x-pipeline/scripts/pr-comment.mjs`.

## Decision

One procedure for every directory delete, in prose and in code, and one helper that implements it in Node. Rules, written as scenarios (the form of ADR-004):

### Text agents follow

**GIVEN** a subagent deletes a directory and its contents **WHEN** it picks the command **THEN** it **MUST NOT** use `rm` with a recursive flag, `rimraf`, `find ... -delete`, or `fs.rm`/`fs.rmSync` with `recursive: true`.

**GIVEN** a subagent must remove a directory **WHEN** it deletes it **THEN** it **MUST** list the files, check that the list holds only what it meant to remove, delete the files one by one and then `rmdir` the empty directories, deepest first.

**GIVEN** the router returns a prompt **WHEN** it appends `prompts.suffix` **THEN** the prompt **MUST** carry both rules above, so every template, the `os-` templates and the `archive` prompt included, gets them (A3).

**GIVEN** `manual-verify` made a scratch directory with `mktemp -d` **WHEN** it removes it before the step ends **THEN** it **MUST** follow the same procedure.

**GIVEN** the orchestrator tells the user to remove the stale main-checkout copy of the change folder **WHEN** it names the method **THEN** it **MUST** name the file-by-file procedure and no recursive delete.

### Code and tests

**GIVEN** code or a test in this repository removes a directory tree **WHEN** it deletes **THEN** it **MUST** call `removeTree` from `skills/10x-pipeline/scripts/remove-tree.mjs` (A1).

**GIVEN** `removeTree(target)` runs **WHEN** the target is a directory **THEN** it **MUST** list every entry with `lstat`, check that each lies inside the target, unlink the files one by one and `rmdir` the directories from the deepest up, never following a symlink (A4).

**GIVEN** `removeTree(target)` runs **WHEN** the target is empty, the filesystem root, the home directory, the current working directory or an ancestor of either **THEN** it **MUST** throw before it deletes anything.

**GIVEN** the guard test `skills/10x-pipeline/test/no-recursive-delete.test.mjs` runs **WHEN** a scanned file holds a banned form, or a place that must carry the rule lost it **THEN** it **MUST** fail (A2, A5).

## Consequences

- A subagent that follows the suffix never runs a command a harness that blocks `rm -rf` would stop, so the step does not stall on it.
- Every prompt changes through the suffix, so a run in flight at upgrade time records `provenance.drift` for `prompts` at its next `next` call. Routing is unchanged.
- `helpers.mjs` changes beyond `writeOverride` in its cleanup line only.
- `removeTree` walks and unlinks entry by entry. The scratch trees of the suite are small, so its cost is noise next to the suite's own time.
- Enforcement is a prompt rule plus a guard test. The router cannot see what a subagent runs, so nothing stops a subagent that ignores the rule.

## Alternatives

- Exempt the tests and keep `fs.rmSync` with `recursive: true` there. Rejected: the owner named tests and code, and a ban with 30 exemptions cannot be checked by a test.
- A harness hook that blocks recursive deletes. Rejected for this repository: hooks belong to the user's own settings, and a plugin agent ignores `hooks` (see "Restricted step agents" in `docs/REFERENCE.md`).
- Leave it as a convention in `AGENTS.md`. Rejected: a convention with no prompt rule never reaches a subagent, and one with no test drifts back.

## Assumptions (unattended readings, for the owner to confirm)

- A1: `fs.rmSync` with `recursive: true` in test cleanup counts as a recursive delete, because the request names tests and code and the score step listed it as the open unknown.
- A2: the banned forms are `rm` with `-r`, `-R`, `-rf`, `-fr` or `--recursive`, `rimraf`, `shutil.rmtree`, `find ... -delete`, and `fs.rm`, `fs.rmSync`, `fs.rmdir`, `fs.rmdirSync` and their `fs.promises` forms with `recursive: true`. `find -delete` is in because it deletes a tree without a list to check.
- A3: the rule lives in `prompts.suffix`, not in `worktree.md`, because `worktree.md` opens only the prompts of an isolated run and a run that is not isolated can hit the same block.
- A4: the helper unlinks a symlink and leaves its target, ignores a path that does not exist and refuses the paths named above. It is the Node form of the procedure, not a way around it.
- A5: the guard scans `skills/`, `agents/`, `docs/`, `tools/`, `README.md` and `AGENTS.md`. `context/` and `openspec/` hold run state and archives, and `.claude/worktrees/` holds other checkouts.

## Not covered

- What a subagent actually runs: the router cannot read it.
- Shell scripts and tools outside this repository.
- Options passed to a delete call through a variable, such as `fs.rmSync(dir, opts)`: the guard reads the call's own argument text.
- Files outside the guard's scope or extensions, such as `.github/` workflows.
