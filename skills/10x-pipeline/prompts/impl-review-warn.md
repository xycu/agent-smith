Warning for this review: the rows {uncommitted} of context/changes/{id}/plan.md are ticked, but no code commit stands behind them.{evidence}

## Rules

- **GIVEN** the rows {uncommitted} are ticked in `plan.md` with no code commit behind them **WHEN** you review the code **THEN** you **MUST** look for the work of each row in the diff and report each row without code as a CRITICAL finding.
- **GIVEN** the work of such a row exists **WHEN** you find it **THEN** you **SHOULD** name the commit or file.
