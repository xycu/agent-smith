---
change_id: browser-row-proof
title: A browser Manual row needs browser-grade proof, not a source read
status: new
created: 2026-11-10
updated: 2026-11-10
archived_at: null
---

## Notes

GitHub issue #37. In the synthetic run `synth-demo` (2026-11-07, plugin 0.7.0), the `manual-verify` step ticked Manual row 1.3. The row asks for a check in a browser: the heading `hello synthetic` on `synth/hello.html`. The step never loaded or called any `mcp__claude-in-chrome__*` tool. Its evidence `evidence/judgment-hello-heading.md` says "Browser not driven; judged from source". The router counted the row as proved (`proved: {judgment: 1}`), and the implementation review recorded it only as a non-blocking observation.

The `manual-verify` template in `skills/10x-pipeline/policy.json` already says to load the Chrome tools with ToolSearch for rows that need a browser. When they are unavailable, it says to prove the row another way or leave it pending with a reason. Nothing enforces this. ADR-012 says the router never reads evidence content, and a `judgment-` file is accepted for any row.

The OpenSpec chain is not affected: it has no `manual-verify` step (ADR-013 D10).

Fix: make the proof kind match the row. Keep ADR-012's rule that the router never reads evidence content.

- **Router:**
  - **Browser rows.** A pending Manual row whose text names a browser is a browser row. The word list is a new policy key under `manualVerify`, matched like the other word lists. Its default starts from `executors.e2e.rowWords` plus `chrome`. Uncalibrated.
  - **What proves a browser row.** Only a kind in a new policy list proves it: `browser`, `test`, `command` or `script`. A `judgment` or `other` tick is not proof.
  - **A tick without valid proof.** It is listed as unproven, with a router reason that names the kind. The retry one tier up runs as for any unproven tick, and the run goes on after the last attempt, as now.
  - **Where it shows.** In the log entry, `status`, the final message, the `archive` summary and `meta.outcome`.
- **Prompts:**
  - **`manual-verify` template.** For a browser row it requires the Chrome tools to be tried first. The evidence file must say which tool calls ran, or quote the error that made them unavailable. A `judgment-` file is never allowed for a browser row. When neither the browser nor a covering test, command or script proves the row, it stays `[ ]`, and its `unproven.md` reason names the Chrome failure.
  - **`manual-verify-nochrome` template.** The same rules, with the browser left out. A browser row there can be proved only by a test, command or script; otherwise it stays pending with the reason `Chrome off (--chrome false)`.
- **Report:** the `## Manual checks` section of `report.md` marks browser rows, so a weak proof is visible. A browser row that the router rejected shows its reason.
- **Live check:** a Manual row in the plan proves whether a step subagent can load the Chrome tools through ToolSearch and call one read-only tool such as `tabs_context_mcp`. README and REFERENCE "Limits" both say this was never tested. Record the result there, whatever it is.
- **Docs and tests:**
  - `docs/REFERENCE.md`, "Manual verification" and "Limits".
  - ADR-012: append to it, or add a new ADR. The next free number is after ADR-018 (taken by `no-nested-subagents`) and the one `late-step-usage` may take.
  - `AGENTS.md`, if a test file is added.
  - `manualverify.test.mjs` and the budget test, if the attempt count changes.
  - The rule-form tests.

Runs in parallel with `no-nested-subagents` and `late-step-usage`. Overlap is likely only in `docs/REFERENCE.md` and the `AGENTS.md` ADR list. Whichever merges later rebases and resolves the conflict.
