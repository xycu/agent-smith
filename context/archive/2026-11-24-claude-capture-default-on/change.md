---
change_id: claude-capture-default-on
title: Make token capture expected by default on Claude-hosted runs
status: archived
created: 2026-11-24
updated: 2026-11-24
archived_at: 2026-11-24T22:04:39Z
---

## Notes

**Origin.** Owner request on 2026-11-24: token counting should be on by default for both providers.

**State.**
- Codex: capture needs no opt-in. `codex-usage.mjs` reads rollout and app-server metadata after settlement (CLI 0.169.0 or later). The owner has seen no Codex steps with missing tokens, so Codex is out of scope unless a run shows otherwise.
- Claude: native Agent capture is off unless the session starts through `claude-capture.mjs` (`docs/REFERENCE.md`, "Accounting activation and rollback"). It needs OTEL env set when `claude` starts, so the plugin cannot switch it on inside a running session. `init-usage.mjs` only warns.

**Owner decision (2026-11-24).** Route: auto-relaunch. Capture stays launcher-based; the default changes from opt-in to expected. This overrides the opt-in decision in `context/archive/2026-11-19-claude-token-figures-default/frame.md` (2026-11-21), so ADR-018 and ADR-019 need an amendment.

**Open for the frame.**
- What "expected" means at `init` on an unbound Claude session: halt with the relaunch command, or warn and continue, with an explicit opt-out (flag or policy key).
- Whether the launcher can resume the same run so the user does not lose the session (`docs/REFERENCE.md` already says to resume a Claude-hosted run with its saved provider mode).
- The constraint "the plugin enables no telemetry without an explicit user choice": running the launcher is that choice; the plugin must still not export anything from an ordinary `claude` session.

**Done when.**
- A Claude-hosted run started without capture does not proceed silently without figures: it halts or warns per the frame, with the exact relaunch command and the opt-out.
- A Claude-hosted run started through the launcher records verified figures as today.
- `docs/REFERENCE.md`, README coverage paragraph and ADR-018/019 amendments match the new default; tests cover `init` in both states.
