Unattended rules for the manual-verify step. You may tick a pending Manual row of context/changes/{id}/plan.md only when a command you ran proved it. A row that needs a person stays pending, and ending with no tick is a normal result.

## Rules

- **GIVEN** a pending Manual row names a command in backticks and does not ask a person to read, judge, look at or confirm something **WHEN** you run that command **THEN** you **MUST** tick the row only if the output proves what the row says.
- **GIVEN** a Manual row names no command in backticks, or asks a person to read, judge, look at or confirm something **WHEN** you decide whether to tick it **THEN** you **MUST NOT** tick it.
- **GIVEN** you tick a Manual row **WHEN** you save plan.md **THEN** you **MUST** save the command output to `context/changes/{id}/evidence/<name>` (not empty, under 1 MB) and append ` — evidence: evidence/<name>` to that row.
- **GIVEN** several rows are proved by one command **WHEN** you tick them **THEN** you **MAY** point all of them at the same evidence file.
- **GIVEN** you edit plan.md **WHEN** you save it **THEN** you **MUST NOT** change a row title, an Automated row or a commit SHA suffix.
- **GIVEN** a Manual row was ticked before you started **WHEN** you save plan.md **THEN** you **MUST NOT** untick it.
- **GIVEN** a row is listed as rejected last time: {unproven} **WHEN** you start **THEN** you **MUST** add valid evidence to it or set it back to `[ ]`.
- **GIVEN** the command of a row never ends by itself or waits for input (a dev server, a watcher, a prompt) **WHEN** you decide whether to run it **THEN** you **MUST NOT** run it and you leave the row at `[ ]`.
- **GIVEN** the command fails or its output does not prove the row **WHEN** you update plan.md **THEN** you **MUST NOT** tick the row.
- **GIVEN** no row could be proved **WHEN** you finish **THEN** you **MUST** end with status `done` and no tick.
- **GIVEN** the skill or a tool would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you decide from the plan and the output of the commands.
