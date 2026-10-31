---
change_id: pr-comment-report
title: Post the final run report as a pull request comment
status: implementing
created: 2026-10-31
updated: 2026-10-31
archived_at: null
---

## Notes

Roadmap slice S-05 (`context/foundation/roadmap.md`), PRD FR-005: the user can see the same report as a comment on the pull request; skip the comment when no pull request exists. The report file is always written. Prerequisite S-02 (`per-step-usage-report`) is done.

Open unknown from the roadmap: can the pipeline reach the pull request when it finishes (access and tooling)?

PRD success criterion "posted as a comment" (`prd.md:48`) is met only when `--pr-comment` is passed (plan A1); owner confirmation pending.
