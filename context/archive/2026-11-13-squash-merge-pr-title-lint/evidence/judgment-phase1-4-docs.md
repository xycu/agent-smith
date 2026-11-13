Judgment of rows 1.4, 2.5, 3.4, 4.5, 4.6 (text read in the worktree).

1.4 tools/commit-lint.mjs header: "The repository squash-merges, so the pull request title is the one subject that lands on main ... Range mode lints the branch commits as hygiene (ADR-008, Amendment 2)." No "rebase-merges" text. Pass.

2.5 pr-title.yml read whole: triggers opened/edited/synchronize/reopened; own concurrency group pr-title-<number>; title passed via env TITLE, run uses "$TITLE"; two pinned actions; uid guard first; advisory noted in header. ci.yml diff main...HEAD is 2 lines +2 lines, all in header comment ("The repository squash-merges, so the pull request title is the commit on main: pr-title.yml lints it..."). Pass.

3.4 ADR-017 Decision step 5: "...titled as Amendment 1 says and with the report header as its body." Amendment 1 rules: "falls back to the untyped titleFor result and never fail" when git log fails; "the title is set once, at creation, and an owner edit stays." Pass.

4.5 ADR-008: "Amendment 2: squash-only merging and a PR title lint" exists (line 89). Old sentences at lines 12, 13, 52, 62, 85 each say "Superseded ... see Amendment 2" / "adopted in Amendment 2" / "since Amendment 2". Pass.

4.6 AGENTS.md Commits: "The owner squash-merges, so the pull request title is the one subject on main: pr-title.yml lints it and the commits job in ci.yml lints each branch commit, both advisory. Run PRs get a derived title (ADR-017)." Pass.
