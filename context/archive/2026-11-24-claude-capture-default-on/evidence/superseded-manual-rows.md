# Superseded Manual rows

Owner decision, 2026-11-24, in the Wave 6 closeout. Row 1.7 stays unticked because the behavior it checks no longer ships.

- 1.7 expects `init` from plain `claude` to halt with a pasteable launcher command. `claude-transcript-capture` (PR #290, v1.18.0) made `claudeCapture.mode: "transcript"` the default, so an ordinary session now passes `init` when its transcript is readable and does not halt.
- The launcher path survives as the opt-in `telemetry` mode. Its live check is row 3.5 of `claude-transcript-capture` (ticked): a fresh launcher session with telemetry mode completes a native Agent step with verified request-record evidence. Row 3.4 of the same change checks the new default in an ordinary session.
