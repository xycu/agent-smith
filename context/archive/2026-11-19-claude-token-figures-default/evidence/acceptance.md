# Claude token capture acceptance

## Automated coverage

The 2.1.311 registry entry uses the retained headless native Agent capture and sanitized replay fixtures. The retained capture established whole-step totals across an enclosing Agent and a child. A separate run showed telemetry arriving after Agent return. The replay covers the launcher, passive hooks, exact invocation attribution and request-tree closure. Both pipeline fixtures cover verified intake, default-off guidance in the original and rebuilt reports, comparison and late attachment. [Retained format review](../../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md) · [Fixture inventory](../../../../skills/10x-pipeline/test/README.md)

## Pending live qualification

- **2.4** An authorized operator starts the launcher in a disposable project to check interactive startup, including trust and hooks, then runs one complete native Claude-hosted pipeline on Claude models. Use 2.1.311 or a later release qualified by 2.5. Record the chain, launch mode, plugin revision, exact host version, settlement and verified step-tree totals in status and the report. Include a multi-request step and an allowed foreground descendant. Check ordinary `claude` as the default-off control, and link the resulting evidence from the README.
- **2.5** For each later release, the maintainer captures a fresh multi-request Agent run and checks request membership, counters and close events against independent observations. Record immediate and late availability, and add a sanitized replay and release note before adding the exact version to the registry. The 2.1.323 build observed during planning is outside the current registry.

Record only redacted totals and coverage. S-20 tracks the separate host, mode and chain matrix. [Plan and manual rows](../plan.md#progress) · [Operator reference](../../../../docs/REFERENCE.md#accounting-activation-and-rollback) · [S-20 matrix](../../../foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)

## Resolution (2026-11-23)

Rows 2.4 and 2.5 are closed on the evidence of the change `claude-capture-async-agent-launch` ([PR #274](https://github.com/xycu/agent-smith/pull/274)).

- **Correction.** The "retained headless native Agent capture" named under Automated coverage was not a live capture: the 2.1.311 fixtures were hand-authored from documented record shapes. A live interactive run on 2.1.323 ended every step `incomplete-capture` because interactive Agent launches settle asynchronously, which the collector did not handle. That change fixed the collector and corrected the README, `docs/REFERENCE.md` and ADR-018 wording. The supported-release registry named under 2.5 was replaced by a floor of 2.1.311 in [PR #272](https://github.com/xycu/agent-smith/pull/272).
- **2.4.** One complete interactive launcher run on Claude Code 2.1.323 ended with verified figures for all five steps (1,248,719 tokens in total; every step total is the sum of its requests). The version, per-step figures and the late recheck of one step are in the evidence note of that change, and the README states the qualification.
- **2.5.** 2.1.323 is a release after the 2.1.311 baseline. Its multi-request live capture (3 to 9 requests per step) was replayed offline through the changed collector and all steps verified. The replay fixtures in the repository are synthetic, shaped after that capture; no real transcript is committed.
- **Not covered.** No headless run, other host or other mode is recorded. S-20 tracks that matrix.
