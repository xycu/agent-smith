# Frame Brief: Claude token counts lost on a host version mismatch

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

In run `dev-test-scope-top-rule` (PR #294, 2026-11-24), all five native Claude steps (1 score, 3 plan-review, 5 and 6 manual-verify, 7 impl-review) were logged with `usageEvidence` `{source: claude-transcript, status: unavailable, reason: unsupported-host, hostVersion: "unknown"}`, no `invocation` and no `totalTokens`. Measured again without `hostVersion` in the descriptor, the same invocations returned transcript totals (3,874,071 tokens, records at version 2.1.330). The router's `usage` command then refused to attach them.

## Initial Framing (preserved)

- **User's stated cause or approach**: SKILL.md Loop step 4 ("Pass … observed IDs/version") led the orchestrator to put `claude --version` (2.1.325, the CLI) into the descriptor. The Desktop host writing the transcripts is 2.1.330. The collector rejects the mismatch with a misleading `unsupported-host`. Once recorded, the loss cannot be recovered because of the ADR-019 rule that recorded evidence never changes.
- **User's proposed direction**: (1) fix the skill wording; (2) let the records' version win or give the refusal an accurate reason; (3) decide whether an `unavailable` record may be upgraded once.
- **Pre-dispatch narrowing**: the leading concern is **tokens missing at run time**; recovery afterward is secondary. The user had seen this failure **only in this run**.

## Dimension Map

1. **Skill instruction**: SKILL.md asks for an "observed" host version without naming a source. ← initial framing (defect 1)
2. **Collector strictness**: the transcript collector treats a version the caller supplied as authoritative over the records it reads. ← initial framing (defect 2)
3. **Failure evidence drops identity**: the `unavailable` evidence loses `invocation` and `hostVersion`, so the designed late-recovery path cannot run. ← initial framing attributed this to ADR-019 policy (defect 3)
4. **No authoritative version source**: a native-Agent orchestrator has nowhere reliable to read the version the transcripts will carry.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Skill wording invites a wrong version | `skills/10x-pipeline/SKILL.md:72` "observed host version", `:97` "other observed IDs/version", `:153` "qualified recorded host version"; mirrored at `skills/openspec-pipeline/SKILL.md:78,158`. `docs/REFERENCE.md:477` allows omission ("when available") but never warns that a mismatch fails the step. `claude --version` is named nowhere: the orchestrator chose it. | STRONG as amplifier |
| 2. Collector check is stricter than its purpose | `claude-transcript.mjs:104-106` seeds `evidence.hostVersion` from the descriptor; `:141-146` fails every record whose version differs (`delete evidence.hostVersion; fail("unsupported-host")`). Records are floor-checked themselves (`:142`), so the descriptor adds no qualification. ADR-018 Amendment 6 justifies failing on records that conflict with each other, not on records that differ from a value the caller supplied. `usage.mjs:24` text ("not qualified") is false here: both versions pass 2.1.311. Pinned by `test/claude-usage.test.mjs:614`. | STRONG (proximate cause) |
| 3. Failure path drops identity, closing late recovery | `claude-transcript.mjs:223` sets `evidence.invocation` only after the version checks, so every `unsupported-host` ends with no invocation. `claude-usage.mjs:74` restores identity only for `missing-source`/`incomplete-capture`. `route.mjs:889-896` needs a recorded invocation and an equal `hostVersion`; `:913` refuses numeric flags once evidence exists. ADR-019:80, :90 and SKILL.md:153 assume unavailable evidence keeps identity. `late-usage.test.mjs:663-668` enriches only evidence that carries an invocation. The telemetry path (`claude-usage.mjs:81-82`) keeps identity, so only the transcript path strips it. | STRONG: a collector defect, not ADR policy |
| 4. No authoritative version source | The checkpoint returns only `{sessionId, offset}` (`claude-usage.mjs:99-101`). `claudeTranscriptReadiness` (`claude-transcript.mjs:61-62`) reads only `CLAUDE_CODE_SESSION_ID`; no version env var is read anywhere. Only the launcher (`claude-capture.mjs:71-75`) and the headless runner (`run-claude.mjs:191`) learn a version, and neither path is open to a native orchestrator. Under Desktop, the CLI on PATH is a different binary from the host writing transcripts. | STRONG (root gap) |

## Narrowing Signals

- The re-measurement without `hostVersion` succeeded for all five steps, with every record at 2.1.330. This rules out per-record causes (missing `version`, pre-release strings, a mid-session update) and isolates the descriptor value.
- Survey of every recorded run (`context/archive/*/agent-smith/run.jsonl` and live run folders): **no Claude step has ever recorded a token figure**. There are 0 `transcript` or `verified` Claude entries. Outcomes are 35 `unsupported-host`, 14 `capture-disabled`, 11 `missing-identity` and 9 `missing-source`, all in telemetry mode (`claude-native`). `unsupported-host` appears in 17 archived runs. This contradicts "only this run": the earlier failures were in a different capture mode, but they belong to the same class.
- `dev-test-scope-top-rule` is the first run since transcript capture became the default (PR #290, 1.18.0). Transcript mode failed on its first real run because of the descriptor version alone.

## Cross-System Convention

A measuring tool takes identity and version facts from the source it measures, and treats caller hints as filters at most. The collector already does this when no hint is given (`:146`, the first record seeds the version, the rest must agree). Telemetry mode compares against a version the launcher recorded at bind time, which is a real observation. Transcript mode has no such binding, so the descriptor version there is a guess the caller passes in. A failed measurement conventionally keeps its identity so that a retry or late attach can match it. ADR-019 already assumes this.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: transcript-mode capture trusts a host version that the orchestrator cannot observe, over the versions it reads from the transcript records, and when that guess is wrong the failure evidence drops the invocation identity that late recovery needs.

The initial framing named the right three places, but its weight and its third point shift. The wording in SKILL.md (defect 1) amplifies the problem but does not cause it: nothing a native orchestrator can read gives the right version, so better wording alone only moves the guess. The root is defect 2 together with dimension 4: transcript mode should not need a version from the caller. Defect 3 is not an ADR-019 policy question. The collector drops identity that ADR-019 already expects to be kept, so recovery would work under the current rules once the identity survives. Separately, no Claude step has ever produced a token figure in any recorded run, so this change should end with proof that a real native run records Claude figures.

## Confidence

**HIGH**: code paths confirmed at file:line by three independent reads, the re-measurement isolates the descriptor value, and the run-history survey matches. Not verified: the cause of the 35 telemetry-era `unsupported-host` entries (it may be the same descriptor/binding mismatch at `claude-usage.mjs:95`); that is out of scope here unless planning finds the same root.

## What Changes for /10x-plan

Plan around transcript capture reading the host version from the records and keeping invocation identity on every failure. Treat the descriptor `hostVersion` in transcript mode as unneeded, and align SKILL.md (both chains), REFERENCE.md and the reason code with that. No ADR-019 relaxation is needed for recovery. Acceptance should include a live native run that records Claude token figures, plus updated pins at `claude-usage.test.mjs:614` and new identity-retention cases beside `late-usage.test.mjs:663-668`.

## References

- `skills/10x-pipeline/scripts/claude-transcript.mjs:61-62, 104-106, 141-146, 168, 223, 257`
- `skills/10x-pipeline/scripts/claude-usage.mjs:63, 74, 81-82, 95, 99-101`
- `skills/10x-pipeline/scripts/usage.mjs:6, 24, 56-67`
- `skills/10x-pipeline/scripts/route.mjs:889-896, 913`
- `skills/10x-pipeline/SKILL.md:72, 97, 153`; `skills/openspec-pipeline/SKILL.md:78, 158`
- `docs/REFERENCE.md:477, 481, 488`; `docs/ADR/ADR-019-late-usage-figure.md:80, 90, 100`; ADR-018 Amendment 6
- Tests: `skills/10x-pipeline/test/claude-usage.test.mjs:614, 643`; `skills/10x-pipeline/test/late-usage.test.mjs:663-668, 735`
- Incident: run `dev-test-scope-top-rule`, PR #294
