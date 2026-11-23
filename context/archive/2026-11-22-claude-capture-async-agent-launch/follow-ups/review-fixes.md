# Review fixes queued from reviews/impl-review.md (2026-11-23)

Apply on the branch `claude-capture-async-agent-launch` (PR #274), then re-run the claude-usage suite, the replay in the scratchpad (`replay-real.mjs`, all six steps must stay `verified`), and the doc greps.

- [x] F2 (code, do first): in `skills/10x-pipeline/scripts/claude-usage.mjs` (telemetry-only branch, ~347-357) require an `assistant_response` for a telemetry-only request. Risk: the live capture held telemetry-only requests with and without `assistant_response`. Replay all six 2.1.323 steps first; if any step turns unavailable, stop and take this back to the owner (Fix A: document as trust assumption).
- [x] F3 (code): apply `agent.stop.textHash ?? hash("")` only to the launched root; add sync-root and child null-stop regression tests (stay `incomplete-capture`).
- [x] F1 (docs/tests): breadth kept. Correct README/REFERENCE/ADR-018 Amendment 7 so the rule reads for every agent, not only the root; add a sync-root and a child telemetry-only test.
- [x] F4 (docs/tests): reword the code comment, REFERENCE and Amendment 7 to "any status other than completed"; add a test with a non-`async_launched` status.
- [x] F5 (docs): known limit in docs/REFERENCE.md, side queries with no `agent_id` are ignored, so the figure undercounts.
- [x] F7 (plan): addendum under Phase 1 listing the `telemetryOnly: "response"` option, the two extra tests, the `parentUuid: null` adaptation, the unknown-parent check and the early evidence note.
- [x] F8 (tests): sync root telemetry-only, child/sync null stop, non-async status, request cap with telemetry-only requests, `tool_use`-only final with a null stop.
