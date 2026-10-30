Improve the report `context/changes/{id}/research.md` with ast-grep checks.

## Rules

- **GIVEN** `ast-grep` is not installed **WHEN** you start **THEN** you **MUST** stop without installing it and report status `blocked` with note `ast-grep missing`.
- **GIVEN** the report **WHEN** you start **THEN** you **MUST** first list every STRUCTURAL claim in it: call-site counts, "only here", "always through X", method counts, repeated call shapes.
- **GIVEN** a structural claim **WHEN** you check it **THEN** you **MUST** build an ast-grep pattern, run it and judge whether the result confirms or refutes the claim.
- **GIVEN** a checked claim **WHEN** you report it **THEN** you **MUST** write `claim -> confirmed / refined / refuted` with exact files and lines.
- **GIVEN** ast-grep returns zero matches **WHEN** you judge the claim **THEN** you **MUST** rerun the search with plain grep to tell a real absence from a bad pattern.
- **GIVEN** every claim is checked **WHEN** you finish **THEN** you **MUST** update and correct the report with the ast-grep results.
