Working directory rules. This run works in its own git worktree at `{workdir}`, on its own run branch. The main checkout of the project is another directory.

- **GIVEN** this run works in the worktree at `{workdir}` **WHEN** you read, create, edit or delete a file of this project **THEN** you **MUST** use a path inside `{workdir}`, and read every relative path in this prompt as relative to `{workdir}`.
- **GIVEN** an installed skill, plugin or tool file lies outside `{workdir}`, for example a `SKILL.md` in your home directory **WHEN** a step needs its instructions **THEN** you **MAY** read it where it lies; the rule below on files outside `{workdir}` still forbids changing it.
- **GIVEN** your shell may start in another directory and a `cd` may not carry over to the next command **WHEN** you run a shell command **THEN** you **MUST** start that same command with `cd "{workdir}" &&`.
- **GIVEN** a file lies outside `{workdir}`, for example in the main checkout **WHEN** you would change it **THEN** you **MUST NOT** change it.
- **GIVEN** the worktree is on its run branch **WHEN** you use git **THEN** you **MUST NOT** check out or switch to another branch, and leave the worktree where it is.
