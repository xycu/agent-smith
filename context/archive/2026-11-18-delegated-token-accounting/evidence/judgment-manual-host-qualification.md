# Manual verification attempt — 2026-11-18

## 4.3 — pending

Checked claim: “Qualify the final candidate on fresh multi-request delegated Codex and native Claude runs in both interactive and headless modes, across both pipeline entry points.”

Installed executables report Codex 0.169.0 and Claude Code 2.1.311, with Node v24.19.0; see command-manual-host-versions.log. Matching version numbers establish availability only, not invocation attribution, totals or settlement.

Existing accounting.md explicitly states: “Synthetic fixtures and historical probes do not satisfy this row.” The retained-record reviews likewise do not establish the final candidate's full matrix. codex-real-format-review.md reports app-server child sessionId equals the child's own thread ID; current codex-usage.mjs still checks meta.sessionId against rootThreadId. claude-real-format-review.md reports numeric intValue and native attachment/request-membership differences requiring adapter changes. These are reasons to retain unqualified status, not grounds to change implementation during this verification-only step.

No fresh model invocation was launched: an interactive host launch waits for input, which this step forbids, and no authorized, matched in-root native capture descriptor was supplied for the required live matrix. Host-owned captures outside the worktree cannot be inspected under the working-directory rule. Installing capture or changing export settings would exceed this step. A headless fixture cannot substitute for both interactive entry points. No new invocation boundaries, live totals or settlement outcomes are claimed.

Decision: leave 4.3 pending. No publication, host configuration, Git write or router-state write was performed by this verifier.

## 4.4 — pending

Checked claim: “Inspect immediate, late and archive output on the qualified hosts: no final-request count presented as a whole step, no double count, no missing value shown as zero, no archive usage in numbered totals, and clear subtotal and routing-rate labels; retain unsupported positive paths as unqualified.”

Ran skills/10x-pipeline/test/claude-usage.test.mjs now: 34 passed, zero failed/skipped. Complete output is test-manual-claude-usage.log; its first line identifies the file and covered lifecycle test. This exercises the read-only collector's immediate/late/archive contract with synthetic inputs, including unavailable late capture, exact membership, independent counters and measured zero. It does not inspect live pipeline report/archive output on qualified hosts, nor independently cover every report-label assertion of this row.

accounting-readers.test.mjs explicitly labels its inputs “Hand-authored protocol fixtures through real producers and router intake; no live-host qualification.” Existing accounting.md requires output inspection “on qualified hosts”; 4.3 remains unproved. A source review or fixture pass cannot establish that missing prerequisite. Unsupported positive paths remain unqualified.

Decision: leave 4.4 pending. No plan rows were ticked or altered.
