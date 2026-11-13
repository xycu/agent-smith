Unattended rules for /openspec-verify-change. The skill asks nothing beyond picking the change, so these rules fix the change, keep the step read-only and define the verdict file the router reads. The change is `{id}` at `openspec/changes/{id}/`.

## Rules

- **GIVEN** the project check or `openspec status` reports no root, a store declaration error or any other CLI failure **WHEN** you cannot load the change **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` quoting the CLI `message`, and write no verdict file.
- **GIVEN** you verify the change **WHEN** you check completeness, correctness and coherence **THEN** you **MUST** follow every step of the skill as written, including its heuristics for false positives.
- **GIVEN** the verify step is read-only **WHEN** you find an issue **THEN** you **MUST NOT** change code, tests, `tasks.md`, any artifact in `openspec/changes/{id}/` or anything in `openspec/specs/`, and you only report it.
- **GIVEN** the apply state or a finding suggests more work **WHEN** you finish the checks **THEN** you **MUST NOT** implement tasks, tick rows, run `openspec archive`, commit or stage.
- **GIVEN** an applicable check is reported as not verified **WHEN** you sort the issues **THEN** you **MUST** count it as one warning `Not verified: <check> - <reason>`, and a not applicable check counts as nothing.
- **GIVEN** the report holds SUGGESTION issues **WHEN** you count issues **THEN** you **MUST NOT** count them as critical issues or warnings, and they appear only in the report text.
- **GIVEN** the checks are done **WHEN** you save the result **THEN** you **MUST** write `openspec/changes/{id}/agent-smith/verify.md`, the only file this step writes, creating the `agent-smith/` folder when it is missing.
- **GIVEN** you write `verify.md` **WHEN** you write its first three lines **THEN** you **MUST** write line 1 as `Verdict: PASS`, `Verdict: PASS WITH WARNINGS` or `Verdict: FAIL`, line 2 as `Critical: <n>` and line 3 as `Warnings: <n>`, with nothing before them.
- **GIVEN** the issues are counted **WHEN** you pick the verdict **THEN** you **MUST** write `FAIL` when there is any critical issue, else `PASS WITH WARNINGS` when there is any warning, else `PASS`.
- **GIVEN** the three header lines **WHEN** you write the sections after them **THEN** you **MUST** write `## Critical` with one `- ` line per critical issue, then `## Warnings` with one `- ` line per warning, keeping each heading when its list is empty.
- **GIVEN** an issue in the `## Critical` or `## Warnings` list **WHEN** you write its line **THEN** you **MUST** keep it on one line with the issue, its `file:line` where one applies and the recommendation.
- **GIVEN** the two lists are written **WHEN** you check the header **THEN** you **MUST** make `Critical: <n>` equal the number of `- ` lines under `## Critical` and `Warnings: <n>` equal the number under `## Warnings`.
- **GIVEN** the two sections are written **WHEN** you add the skill's report after them **THEN** you **MUST NOT** use the headings `## Critical` or `## Warnings` again in the report text.
- **GIVEN** `verify.md` is written **WHEN** you finish **THEN** you **MUST** finish with status `done` whatever the verdict, and put the verdict line in `note`.
- **GIVEN** the skill would ask the user to pick a change **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input.
