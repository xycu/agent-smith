---
change_id: first-attempt-drop-unmeasured
title: Measure the first-attempt tier drop or set it to zero as ADR-010 says
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-23
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 16 (should fix). Found by reading the policy, the ADRs and the reference.

**This is an owner decision first.** Run `/10x-frame` before `/10x-plan`. The question is whether the measurement will ever be made, not how to code it.

**The claim.** The plugin exists to spend fewer tokens by starting implement steps on a cheaper model. `skills/10x-pipeline/policy.json:50` sets `"firstAttempt": { "drop": 1, "templates": ["implement", "implement-segment", "implement-tdd", "implement-e2e"] }`: the first attempt of those steps runs one tier below the scored one.

**The evidence.** There is none. `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:159` says "no pair has run yet". Line 167 of the same ADR states the rule: anything other than a proven saving, "including fewer than 5 comparable pairs", sets `escalation.firstAttempt.drop` to `0` in `policy.json`. ADR-007 line 134 still reads "Pending". `docs/REFERENCE.md:475` repeats that the figure is not measured. The shipped value is `1`.

**So the repository breaks its own rule.** By ADR-010 the value today should be `0`. A drop that fails costs a wasted attempt, a rollback and a second attempt on the higher tier, so the drop can also cost more than it saves. Nobody knows which.

**The weight carried for the measurement.** The `compare` command (`comparePair`, `compareMarkdown`, `compareCommand`, `skills/10x-pipeline/scripts/route.mjs:531-700`), `compare.test.mjs` (890 lines), `baseline-policy.json`, the price table and four budget test files that take about 315 s of the suite. Since 1.14.0 `compare` gives no verdict for Claude runs at all, because Claude steps report no token figures by default; `claude-token-figures-default` covers that and must land before any measurement can be made.

**Options for the frame.**
- A. Measure. Run at least 5 comparable pairs (routed against baseline) after `claude-token-figures-default`, record them in the ADR, and keep or change the drop by the result.
- B. Follow the rule now. Set `drop` to `0`, keep `compare` for a later measurement, and say in the README that the saving is not proven.
- C. Follow the rule and cut the weight. Set `drop` to `0` and remove `compare`, `baseline-policy.json` and the tests that exist only for it. This is the lean choice if the owner does not expect to measure.

**Constraints.**
- A policy change belongs in `policy.json`, never in the router scripts (AGENTS.md Coding Style).
- A change to tier logic updates the routing bullets in `docs/REFERENCE.md`.
- Option C removes a documented command; that is a breaking change for anyone who uses `compare`, and the commit type must say so.
- The README must not promise a saving that no run has shown.

**Done when.**
- The frame records the chosen option.
- `policy.json`, ADR-007, ADR-010, `docs/REFERENCE.md` and the README agree with each other about the drop and about what was measured.
- If A: the pairs and their figures are in the ADR. If C: no dead code, test or document for `compare` is left.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
