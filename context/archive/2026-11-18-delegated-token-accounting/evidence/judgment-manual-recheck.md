# Manual verification retry — 2026-11-18

Read unproven.md first, then plan.md, change.md, plan-brief.md, accounting.md, prior qualification judgments and retained host-format reviews. Traced the current Codex/Claude collectors, their fixture producers and safe cleanup helper. No source, test, router state or Git history was changed by this attempt.

## 4.3 — pending

Claim checked: “Qualify the final candidate on fresh multi-request delegated Codex and native Claude runs in both interactive and headless modes, across both pipeline entry points; record exact versions, invocation boundaries, matching totals or explicit unavailable reasons, and unchanged settlement in `evidence/accounting.md`.”

The plan explicitly distinguishes deterministic local acceptance from live qualification. accounting.md says: “Synthetic fixtures and historical probes do not satisfy this row.” codex-fresh-smoke-review.md describes a “complete pre-review candidate” and says: “It did not run the full change workflow.” claude-real-format-review.md says: “Interactive coverage is pending.” These retained observations cannot establish the final candidate and full mode/chain matrix.

Tried another bounded proof: script-adapter-recheck.mjs replays synthetic documented shapes through the unchanged current collectors. Its assertions first establish working baseline fixtures, then independently vary one metadata/encoding field to match each retained review. The output in script-adapter-recheck.log confirms Codex child metadata sessionId yields unavailable/missing-identity and numeric Claude event.sequence intValue yields unavailable/unsupported-schema on both chain fixtures. No tokens survive either unavailable result. This is a reproducible compatibility check, not captured telemetry, a newly observed host version, invocation attribution or settlement proof. It supports retaining unqualified status and does not establish all behavior of the real hosts.

No fresh live matrix was obtained. Interactive CLI launches wait for input and are forbidden by this step. No matched in-root native live descriptor for the required matrix was supplied or identified in the inspected evidence. Outside-root host captures cannot be read under the worktree rule. A headless-only launch or another fixture pass cannot satisfy the interactive cells. No capture settings, permissions or exporters were changed, and no outside-root records were read.

Decision: leave 4.3 unchecked. Adapter fixes and renewed live qualification require a subsequent authorized implementation/verification stage; this step may write only plan/evidence.

## 4.4 — pending

Claim checked: “Inspect immediate, late and archive output on the qualified hosts: no final-request count presented as a whole step, no double count, no missing value shown as zero, no archive usage in numbered totals, and clear subtotal and routing-rate labels; retain unsupported positive paths as unqualified.”

The qualifying phrase “on the qualified hosts” remains unproved by 4.3. The new script checks collector results only. It does not launch either pipeline, attach late usage, archive a run or inspect their live rendered outputs. Existing accounting.md also identifies accounting-readers.test.mjs as hand-authored fixtures rather than live-host qualification. Neither prior tests nor the new negative compatibility reproduction supplies that missing evidence. No tests were claimed as fresh proof of this row.

Decision: leave 4.4 unchecked; retain both unsupported positive paths as unqualified. The missing live boundary prevents an honest tick even though local fixtures already cover several individual display invariants.

## Scope and safety

Saved the runnable script source and complete output. Its synthetic scratch sources stayed under evidence and were removed using removeTree (10 files, 7 directories). No model invocation, interactive prompt, publication, Git write, router invocation or router-state edit was performed. Existing automated ticks and commit suffixes remain untouched. No total for this verifier or child work is inferred. A read-only git diff --check passed after the script run; final evidence checks are recorded separately.
