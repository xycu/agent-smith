Row 2.5. flow.mjs line 790 builds the reason: "plan.md has no pending Automated Progress row (read ${plan.rows} rows) (goal:<kind>...)".
Test plan-rows.test.mjs line 218 asserts /plan\.md has no pending Automated Progress row \(read \d+ rows\)/ on the `next` JSON after a failed first plan; 17/17 pass (test-plan-rows-retry-reason.txt). The text names the missing thing (pending Automated row) and how many rows were read, so a reader sees why plan runs again. Reads clearly.

Row 3.5. docs/REFERENCE.md line 126 quotes:
"Verification of a `plan` or `plan-revise` step requires a freshly written `plan.md` with at least one pending Automated row: a line `- [ ] N.M title` at the start of a line under `#### Automated` in `## Progress` ... The reader counts only that row form: `*`, `+`, numbered and indented items are not rows ..."
It states a minimum for verification (at least one pending Automated row in the existing `- [ ] N.M` form) and describes the reader, not a new plan format; no new syntax is introduced. Row holds.
