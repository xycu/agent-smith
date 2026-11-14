Judgment row 1.5. Quoted from skills/10x-pipeline/SKILL.md:25-28 and skills/openspec-pipeline/SKILL.md:28-31.

Line (identical in both skills, lines 28 / 31):
"Bash timeout: run every `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` call with the Bash tool's `timeout: 600000`, its maximum. The default of 120000 ms equals the router's git timeouts, so the Bash tool would kill the router inside a slow `git commit`."

It sits directly after the Router / PR comment script / Pull request script path lines, same "Label: text" form, one line, no blank line between. It names all three scripts, the exact value, and the reason. In both skills it covers the same three scripts (openspec paths differ only by ../10x-pipeline). Reads clearly.
