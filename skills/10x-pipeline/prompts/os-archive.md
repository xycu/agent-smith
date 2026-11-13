Unattended rules for archiving the OpenSpec change `{id}` with the OpenSpec CLI. The router already made the pre-archive commit; this step runs one CLI command and commits its result.

Use the CLI from either host. Native skill shortcuts do not replace this archive command.

## Rules

- **GIVEN** the change `{id}` is ready to archive **WHEN** you archive it **THEN** you **MUST** run `openspec archive {id} --yes --json` exactly once, with no other flag.
- **GIVEN** the working-directory rules at the top of this prompt name a run root **WHEN** you run the command **THEN** you **MUST** run it with the run root as the current directory, and with the project root when no run root is named.
- **GIVEN** an archive skill or workflow exists (`openspec-archive-change`, `/opsx:archive`, the sync-specs workflow) **WHEN** you archive **THEN** you **MUST NOT** use it, because its prompts and agent-driven merge differ from the CLI's mechanical merge.
- **GIVEN** the change folder or a spec looks wrong **WHEN** you are about to archive **THEN** you **MUST NOT** edit, move, copy or delete any file or folder under `openspec/` by hand, before or after the command.
- **GIVEN** the command exits non-zero, prints `"archive": null` or a `status` entry with `"severity": "error"` (for example `archive_target_exists` or `archive_validation_failed`) **WHEN** you read its output **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` quoting the `code`, `message` and `fix` of each error.
- **GIVEN** the command failed **WHEN** you would retry it, pass `--no-validate` or `--skip-specs`, or fix the cause **THEN** you **MUST NOT** run any further `openspec` command or change any file.
- **GIVEN** the command succeeded with an `archive` object **WHEN** you commit **THEN** you **MUST** stage only the paths the CLI changed (`git add -A -- openspec/changes/{id} openspec/changes/archive/<archive.archivedAs> openspec/specs`) and commit them with the message `chore(archive): close {id}`.
- **GIVEN** you staged those paths **WHEN** `git diff --cached --name-only` lists a path outside `openspec/changes/{id}/`, `openspec/changes/archive/<archive.archivedAs>/` and `openspec/specs/` **THEN** you **MUST NOT** commit, and you finish with status `blocked` and `signals.needsHuman` naming those paths.
- **GIVEN** the generic unattended rules say not to commit **WHEN** the archive succeeded **THEN** the commit rule above **MUST** win.
- **GIVEN** you commit **WHEN** a hook runs **THEN** you **MUST NOT** pass `--no-verify`, amend, push or change any git setting.
- **GIVEN** the commit fails **WHEN** git prints its error **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` quoting git's message, and leave the archived folder where the CLI put it.
- **GIVEN** the command printed a warning **WHEN** you write the RESULT line **THEN** you **MUST** copy each warning into `assumptions`.
- **GIVEN** the archive and the commit succeeded **WHEN** you write the RESULT line **THEN** you **MUST** finish with status `done` and put `archivedAs=<archive.archivedAs> path=<archive.path>` in `note`, copied from the JSON output.
- **GIVEN** the archive has finished or stopped **WHEN** you have more to do **THEN** you **MUST NOT** write any file under `openspec/`.
- **GIVEN** a step would ask the user a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you answer by the rules above.
