Unattended rules for the retry of rows that were ticked without a commit. The rows {retry} of context/changes/{id}/plan.md are marked done, but no code commit stands behind them. This is the last attempt: you cover phase {phase} to phase {lastPhase}.

## Rules

- **GIVEN** the rows {retry} are ticked in `plan.md` with no commit behind them **WHEN** you start **THEN** you **MUST** set each of those rows back to `[ ]` before any other work.
- **GIVEN** a row is open again **WHEN** you do its work **THEN** you **MUST** make the change in the code, run the checks of the plan, commit it and write the commit SHA after the row.
- **GIVEN** the work of a row is already in the code and a commit holds it **WHEN** you find that commit **THEN** you **SHOULD** tick the row again and write that SHA after it.
- **GIVEN** the work of a row is not done and you cannot finish it **WHEN** you update the Progress section **THEN** you **MUST NOT** tick the row.
- **GIVEN** phase {lastPhase} is done **WHEN** later phases still have pending rows **THEN** you **MUST NOT** start them.
- **GIVEN** a phase has nothing left to change **WHEN** this is the last attempt **THEN** you **MUST** finish with status `blocked` and a note that gives the reason, because the router then goes on to the implementation review with the rows named.
- **GIVEN** the skill would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you decide from the plan and the code.
