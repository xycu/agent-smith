Row 1.4: reviewer reads the diff: five `uses:` lines changed, nothing else.
Checked: `git diff main...HEAD -- .github/workflows` (read-only).

Changed lines (quoted):
ci.yml  -  - uses: actions/checkout@v5      +  - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0
ci.yml  -  - uses: actions/setup-node@v5    +  - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
ci.yml  -  - uses: actions/checkout@v5      +  (same pin as above, second job)
ci.yml  -  - uses: actions/setup-node@v5    +  (same pin as above, second job)
release.yml -  - uses: googleapis/release-please-action@v5  +  ...@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0

Count: `git diff main...HEAD -U0 -- .github | grep '^[-+]' | grep -v '^(---|+++)'` gave 10 lines = 5 removed + 5 added. Hunk context lines (with:, node-version, etc.) are unchanged. No other file under .github changed (diff --stat lists only ci.yml and release.yml there).
Reasoning: five `uses:` lines, each only @tag -> @sha + version comment, matching the plan Contract; nothing else in the workflows changed. Row supported.
