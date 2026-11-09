Row 2.3 judgment. Files read: skills/10x-pipeline/SKILL.md and skills/openspec-pipeline/SKILL.md.

Both skills, identical structure:
- done branch: "Then do the pull request step." on its own line, followed by "Then call TaskList. When a task with the subject `PR comment: ...` ... open, do the PR comment step." No STOP in done. PR step precedes PR comment step.
- archive branch, step 5 (verify-archive), first bullet: "First, whatever `archived` says, do the pull request step, so the `chore(archive)` commit is pushed. Then call TaskList. ... do the PR comment step." This covers archived: true and archived: false. The only STOP in the branch is the third bullet (`On archived: false: ... and STOP`), which comes after the first bullet.
- halt branch: "Before you STOP, do the pull request step. Then call TaskList. ... do the PR comment step."
- "Pull request (always)" section: "Every run that ends in `done`, `archive` or `halt` does this step once, with or without `--pr-comment`, before the PR comment step and before any STOP. No flag turns it off (ADR-017)."

Conclusion: done, archive (including archived: false) and halt each run the pull request step before the PR comment step and before any STOP, in both skills.
