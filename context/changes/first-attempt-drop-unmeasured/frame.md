# Frame Brief: Measure the first-attempt tier drop

> Owner decision record before /10x-plan. The question was whether the
> measurement will ever be made (see `change.md`).

## Reported Observation

`skills/10x-pipeline/policy.json:50` ships `"firstAttempt": { "drop": 1, ... }`. No routed-against-baseline pair has run (`docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:159`). ADR-010 line 171 says that anything other than a proven saving, "including fewer than 5 comparable pairs", sets the drop to `0`.

## Owner Decision (2026-11-21)

**Option A: measure.** Run at least 5 comparable pairs (routed against baseline), record them in ADR-010, and keep or change the drop by the result. Options B (drop `0` now, keep `compare`) and C (drop `0`, remove `compare`) were offered and not chosen.

## What the plan must cover

- Which pairs count as comparable: same change, same chain, same host, and the provider mode stated for each pair.
- The source of the figures. Claude pairs need `claude-token-figures-default` (opt-in capture hook) first. Codex pairs can run earlier if `codex-usage.mjs` gives verified figures on the current Codex host (`CODEX_USAGE_VERSION = "0.169.0"`); the plan checks that before it relies on it.
- Where the pairs and their figures are recorded (ADR-010), and the result rule that ADR-010 already states.
- `policy.json`, ADR-007 (line 134 "Pending"), ADR-010, `docs/REFERENCE.md:475` and the README agree about the drop and about what was measured.

## Open for the owner

Until 5 pairs exist, `drop: 1` contradicts the rule at ADR-010 line 171. The plan either sets the drop to `0` while the measurement runs, or amends ADR-010 to say that the rule applies once the measurement window closes, with a date. The owner picks one when the plan is reviewed.

**Owner decision (2026-11-23):** ship `drop: 0` now, while the measurement runs. ADR-010 keeps its decision rule unamended, and `1` returns only if the pairs prove the saving.

## Schedule

Wave 5, after `claude-token-figures-default` (Wave 4). A measurement is live work with paid runs; a passing fixture does not replace it.
