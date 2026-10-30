Verify the report `context/changes/{id}/research.md`: the structural claims its `Refactor opportunities` ranking stands on.

## Rules

- **GIVEN** `ast-grep` is not installed **WHEN** you start **THEN** you **MUST** stop without installing it and report status `blocked` with note `ast-grep missing`.
- **GIVEN** the report **WHEN** you start **THEN** you **MUST** list the STRUCTURAL claims the ranking stands on: method counts, "overrides X but not Y", call-site counts, mirrored type pairs.
- **GIVEN** a claim **WHEN** you check it **THEN** you **MUST** build an ast-grep pattern, run it and report `claim -> confirmed / refined / refuted` with files and lines.
- **GIVEN** ast-grep returns zero matches **WHEN** you judge the claim **THEN** you **MUST** confirm the zero with plain grep.
- **GIVEN** a wrong count or line number **WHEN** you fix it in the report **THEN** you **MUST** correct it in place as `150 (report: 145)`, so the trace of the fix stays in the text.
- **GIVEN** the checks are done **WHEN** you update the report **THEN** you **MUST** add a section `## Claim verification (ast-grep)` with a table: claim, verdict, evidence (`file:line`), method (pattern or rule).
- **GIVEN** the checks are done **WHEN** you update the frontmatter **THEN** you **MUST** update `last_updated`, add the tag `verified` and add the verification commit.
- **GIVEN** the `Refactor opportunities` section and the intent verdicts **WHEN** you update the report **THEN** you **MUST NOT** change them.
- **GIVEN** a result undermines a candidate's rank **WHEN** you record it **THEN** you **MUST** describe it only in the verification section, marked `decide at planning`.
