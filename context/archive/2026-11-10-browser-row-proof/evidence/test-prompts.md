skills/10x-pipeline/test/manualverify.test.mjs: manual verify prompts; browser rows in the prompt
Chrome: not needed (covering test renders the real policy.json prompts)
✔ manual verify prompts (261.669ms)
✔ browser rows in the prompt (362.439084ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 713.1115
--- manual-verify template order in policy.json (lines 307-316): line1 'Browser rows: {browserRows}'; ToolSearch/Chrome-first rule; createIfEmpty rule; browser- evidence begins with tool calls that ran; failure shape 'Chrome: <tool> failed: <error text>'; unproven reason 'Chrome failed: <tool>: <error text>'. Nochrome: 'Chrome: off (--chrome false)'.
    "manual-verify": [
      "Prove the pending #### Manual rows of context/changes/{id}/plan.md on your own, and tick only the rows you proved. Rows rejected by the router last time: {unproven}. Browser rows: {browserRows}",
      "@prompts/manual-verify.md",
      "- **GIVEN** a Browser row is pending or was rejected **WHEN** you start to prove it **THEN** you **MUST** load the `mcp__claude-in-chrome__*` tools with one ToolSearch call that selects `tabs_context_mcp` together with the other tools the row needs, and call them before any other proof.",
      "- **GIVEN** you call `tabs_context_mcp` **WHEN** this session has no tab group yet **THEN** you **MUST** pass `createIfEmpty: true`, because without it the call finds no tab group.",
      "- **GIVEN** the Chrome tools proved a Browser row **WHEN** you save its evidence **THEN** you **MUST** begin the `browser-` evidence file with the tool calls that ran (tool, target, result), followed by the page text, or an image or GIF the tool can export, under `context/changes/{id}/evidence/`.",
      "- **GIVEN** a Chrome tool failed for a Browser row and a covering test, command or script proves the row **WHEN** you save that evidence **THEN** you **MUST** begin the file with `Chrome: <tool> failed: <error text>`.",
      "- **GIVEN** a row needs a browser **WHEN** you decide how to prove it **THEN** you **MUST NOT** judge it from the source of the page or the code.",
      "- **GIVEN** you use the Chrome tools **WHEN** you open a page **THEN** you **MUST NOT** open a page that is neither local nor named by the row, sign in, submit a form to an external service or enter a credential.",
      "- **GIVEN** the Chrome tools are unavailable, fail or are not connected **WHEN** a Browser row needs them **THEN** you **MUST NOT** wait for a connection or ask for one: prove the row by a covering test, command or script, or leave it at `[ ]` with `- <row id> — Chrome failed: <tool>: <error text>` in `evidence/unproven.m
