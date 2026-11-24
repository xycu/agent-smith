---
date: 2026-11-24T23:56:09+0100
researcher: Claude (for Błażej Ksycki)
git_commit: 4f508aff
branch: main
repository: agent-smith
topic: "What must change so transcript-mode Claude capture takes the host version from the records and keeps invocation identity on failure"
tags: [research, claude-usage, claude-transcript, usage-evidence, late-usage, skill-loop]
status: complete
last_updated: 2026-11-24
last_updated_by: Claude
---

# Research: transcript capture version authority and identity on failure

**Date**: 2026-11-24T23:56:09+0100
**Researcher**: Claude (for Błażej Ksycki)
**Git Commit**: 4f508aff (main; the change folder is uncommitted)
**Branch**: main
**Repository**: agent-smith

## Research Question

From [frame.md](frame.md): transcript-mode capture trusts a host version that the orchestrator cannot observe over the versions it reads from the transcript records, and when that guess is wrong the failure evidence drops the invocation identity that late recovery needs. What code, tests, docs and guards does a fix touch, what did earlier changes decide, and how can a real run prove the fix?

## Summary

- **Version authority.** In transcript mode, the version passed in the descriptor is the only thing that can make records whose versions agree with each other fail. It seeds `evidence.hostVersion` (`skills/10x-pipeline/scripts/claude-transcript.mjs:104-107`). Each record version is then compared with it (`:141-147`), and on a mismatch the code deletes `hostVersion` and fails with `unsupported-host`. Without a descriptor version, the first record seeds the value and later records must equal it (`:146`). The records are already floor-checked (`:142`), so the descriptor adds no qualification.
- **Identity loss.** `evidence.invocation` is set at `claude-transcript.mjs:223`, after the main-transcript scan at `:218`. That scan calls `version()` for the root launch and return records. So an `unsupported-host` raised in the main scan ends without an invocation. The catch in `skills/10x-pipeline/scripts/claude-usage.mjs:74-77` restores identity only when `evidence.hostVersion` is set and the reason is `missing-source` or `incomplete-capture`. After the version `delete`, neither holds. This is the shape recorded in run `dev-test-scope-top-rule`: five entries, `claude-transcript`, `unsupported-host`, `hostVersion: "unknown"`, no invocation.
- **Late attach.** `skills/10x-pipeline/scripts/route.mjs:889-896` needs the recorded invocation to deep-equal the payload's invocation, and the source and `hostVersion` to match exactly. `:913` refuses numeric flags once evidence exists. If the unavailable evidence kept the invocation and the records' version, the existing ADR-019 path could attach a later measurement without any policy change (ADR-019 `docs/ADR/ADR-019-late-usage-figure.md:80`, `:90`).
- **Guards.** Both SKILL.md files are within 44 bytes (10x) and 43 bytes (openspec) of their byte ceilings (`skills/10x-pipeline/test/skill-loop.test.mjs:553-554`, sizes 32357 and 36853). `skill-loop.test.mjs:629-663` pins the exact Loop step 4 and late-usage phrases, including "observed IDs/version" and "qualified recorded host version". Any wording fix must fit these limits or update them in the same change.
- **History.** The archived `claude-transcript-capture` plan chose "Derive the version from attributed records when the host descriptor omits it, and reject disagreement" (`context/archive/2026-11-24-claude-transcript-capture/plan.md:34`). No reason is given for rejecting a disagreeing descriptor. The 35 telemetry-era `unsupported-host` entries come from 8 runs logged before #272. They have a different mechanism: an exact-release allowlist plus a caller version that was absent or malformed. They are not evidence for this fix.
- **Live proof.** No automated live test exists for Claude capture. The archived transcript-capture rows 3.4 and 3.5 are ticked, but that change's `evidence/unproven.md` says neither was proven live. A Manual row with a human-run native pipeline run is the only proof route found.

## Detailed Findings

### Transcript collector control flow (`claude-transcript.mjs`, `claude-usage.mjs`)

- Mode dispatch: `claude-usage.mjs:66` sends `mode: "transcript"` to `measureClaudeTranscript(descriptor, env, routerDescription(descriptor.router), evidence)` with `evidence = { source: "claude-transcript" }` (`:67-69`). The transcript branch does not validate descriptor fields itself.
- Fail order in `measureClaudeTranscript` (`claude-transcript.mjs:98-349`), with the identity known at each point:
  - `:99` `invalid-evidence` when the descriptor has `checkpoint`, `process` or `sources`.
  - `:100-103` `missing-identity` when `invocation` is not an object, `agentId` is not a path id, `host` is not `claude`, `runId` is not an identifier, or the descriptor `sessionId` is not `CLAUDE_CODE_SESSION_ID`.
  - `:104-107` `unsupported-host` when the descriptor version is below the floor or malformed. Otherwise it seeds `evidence.hostVersion`.
  - `:109` `locateSession` returns the session id, which comes from env and not the descriptor, and the session files. It can fail with `missing-identity`, `unsafe-path`, `ambiguous-history`, `missing-source` or `resource-limit`.
  - `:138-140` root meta checks: tool-use id, spawn depth 1, no parent, and description and `runId` equality. A failure here is `missing-identity`.
  - `:141-147` `version()`, the defect, called from `:168` (root calls during the main scan) and `:257` (each agent record).
  - `:218-222` main scan, then `missing-identity` or `incomplete-capture` (no root launch).
  - `:223` `evidence.invocation` is set from `sessionId`, `rootId` and `rootMeta.toolUseId`.
  - `:224` onward: `incomplete-capture`, then child scans and `measureAgent` failures with the invocation set. A version mismatch at `:257` therefore keeps the invocation but loses `hostVersion`.
- Earliest point the full invocation is known: after `:140`, once the session id, the descriptor `agentId` and the meta `toolUseId` (equal to the descriptor `runId` when given) are all validated. The code currently waits until `:223`.
- Restore hazard: `claude-usage.mjs:75-76` reads `descriptor.invocation.agentId` without a guard. It is reachable only when `evidence.hostVersion` is set, which today implies the descriptor invocation was an object. Relaxing that condition must keep the guard.
- If the descriptor seed is removed, the only way to get the `unsupported-host` reason is a record below the floor or two records that disagree. Record-versus-record disagreement stays pinned by `claude-usage.test.mjs:643`.

### Downstream consumers

- `skills/10x-pipeline/scripts/usage.mjs:56-67` `unavailableEvidence`: keeps a valid `invocation`. A missing or invalid `hostVersion` becomes `"unknown"`.
- `usage.mjs:70-102` `normalizeAccounting`: transcript status requires `invocation.host === "claude"` and `claudeCaptureSupported(hostVersion)` (`:85-87`). The unavailable branch passes `{...rawEvidence, invocation}` (`:100`), so collector-supplied identity survives.
- `usage.mjs:24`: the `unsupported-host` text "The host version is not qualified for accounting." `skills/10x-pipeline/scripts/flow.mjs:111-133` (`usageLimitations`) turns `unsupported-host` with source `claude-transcript` into "Claude transcript version unqualified for token accounting", the PR report's header line. It keys on reason and source only.
- `route.mjs:862-865, 889-896, 913, 932`: the late-attach gate and write. Status, report and compare projections (`route.mjs:475, 546, 711-712, 759, 782-783`; `flow.mjs:166, 187`) only read the evidence.
- `skills/openspec-pipeline/scripts/openspec.mjs` has no `usageEvidence` references (grep, inspected file).
- The telemetry path keeps its own `hostVersion` (`claude-usage.mjs:63, 94-95, 108, 216, 315, 390`) and is not part of this question.

### Tests that pin the current behavior (`skills/10x-pipeline/test/`)

| Test (file:line) | Pins | If the descriptor version no longer fails | If unavailable evidence keeps the invocation |
| --- | --- | --- | --- |
| `claude-usage.test.mjs:614` (table in "transcript binds launch, return, tool IDs…", ~609-650) | descriptor `2.2.0` against records `2.1.311` → `unsupported-host` | must be inverted or removed | — |
| `claude-usage.test.mjs:643` | a record at `2.2.0` against other records → `unsupported-host` | unchanged (record-vs-record) | the expected invocation may change |
| `claude-usage.test.mjs:856-873` "delayed transcript completion keeps only established late-attachment identity and version" | `invocation === undefined` and `hostVersion === "unknown"` (`:872`) | review | must change |
| `claude-usage.test.mjs:~889-899` (conflicting case) | invocation undefined after `missing-identity` | — | review: identity was not established |
| `claude-usage.test.mjs:875-883, 893-899` | set `descriptor.hostVersion = "2.1.311"` explicitly | review | review |
| `late-usage.test.mjs:661-672, 735` | route equality, refusal when the invocation is absent | unchanged | unchanged (router contract stays) |

Fixtures: `claude-helpers.mjs:27` base descriptor `hostVersion: "2.1.311"`; `:61` records `version: "2.1.311"`; `:156` `transcriptFixture` sends no `hostVersion`; `:173-175` main-file records take `end.version`. Not checked: whether the `unavailable()` helper in `claude-usage.test.mjs` asserts that the invocation is absent.

### Docs and instructions

- Loop step 4, identical in both chains: `skills/10x-pipeline/SKILL.md:97` and `skills/openspec-pipeline/SKILL.md:103`, "Pass `claudeCaptureMode` as `mode`, router identity, returned agent ID and other observed IDs/version." Recording rule: `skills/10x-pipeline/SKILL.md:72` and `skills/openspec-pipeline/SKILL.md:78`, "observed host version". Late usage: `skills/10x-pipeline/SKILL.md:153` and `skills/openspec-pipeline/SKILL.md:158`, "qualified recorded host version … Use the original router identity, version and invocation."
- `docs/REFERENCE.md:475`: transcript descriptors "Forward the observed session ID, Agent tool-use ID (`runId`) and version when available." `:473`: "Unavailable evidence keeps an exact identity only when observed". `:522-523`: late attach needs the exact source, host version and invocation. `:483-488` is the telemetry descriptor example.
- `docs/ADR/ADR-018-no-nested-subagents.md:131-133`, Amendment 6: the 2.1.311 floor, and fail-closed on "unrecognized or conflicting records". Amendment 9 (~`:143-147`) makes transcripts the default. ADR-019 `:80`, `:90`, `:100`: late attach on the exact initial source, version and invocation.
- `README.md:168`: "Capture accepts Claude Code 2.1.311 or later."

### Guards on edits

- `skill-loop.test.mjs:553-554`: byte ceilings 32401 (10x) and 36896 (openspec). Current sizes are 32357 and 36853 (`wc -c` at 4f508aff).
- `skill-loop.test.mjs:629-663`: regexes over Loop step 4 and late usage. They include "returned agent ID and other observed IDs/version.*Only telemetry takes the saved checkpoint" and "with a qualified recorded host version and exact Claude invocation".
- `skill-loop.test.mjs:523-532`: a sha256 of the Anti-stall section. `openspec-skill.test.mjs` (~17-36, 123-124): Anti-stall equality across the chains. Loop step 4 is duplicated in both files.
- `skill-loop.test.mjs:122, 164, 534-547`: banned routing literals (model names, effort, tier) in the SKILL files.
- `tools/test/agents-md-size.test.mjs`: AGENTS.md is at 12244 of 12288 bytes. The fix needs no AGENTS.md edit.

## Code References

- `skills/10x-pipeline/scripts/claude-transcript.mjs:104-107`: seeds the descriptor version.
- `skills/10x-pipeline/scripts/claude-transcript.mjs:141-147`: the `version()` equality check and `delete`.
- `skills/10x-pipeline/scripts/claude-transcript.mjs:218-223`: main scan, then the invocation is set.
- `skills/10x-pipeline/scripts/claude-usage.mjs:66-79`: transcript branch and identity restore on failure.
- `skills/10x-pipeline/scripts/usage.mjs:6-13, 24, 56-67, 85-87, 100`: floor, reason text, unavailable shape, transcript acceptance.
- `skills/10x-pipeline/scripts/flow.mjs:111-133`: the report limitation text.
- `skills/10x-pipeline/scripts/route.mjs:889-896, 913`: the late-attach gate.
- `skills/10x-pipeline/test/claude-usage.test.mjs:614, 643, 856-899`; `skills/10x-pipeline/test/claude-helpers.mjs:27, 61, 156, 173-175`.
- `skills/10x-pipeline/test/skill-loop.test.mjs:523-563, 629-663`.

## Architecture Insights

- The collector already has two version sources: the caller descriptor and the records. Telemetry mode has a third, the launcher binding recorded at bind time (`claude-usage.mjs:94-95`). Only the binding and the records are observations. The transcript descriptor value is a caller claim, and no host interface gives a native orchestrator that value. The checkpoint returns `{sessionId, offset}` only (`claude-usage.mjs:99-101`), and readiness reads only `CLAUDE_CODE_SESSION_ID` (`claude-transcript.mjs:61-62`).
- Fail-closed in ADR-018 Amendment 6 protects against record shapes and records that conflict with each other. A disagreement between the records and the caller is a different case, and no ADR, comment or test explains why it must fail.
- Identity and version are what late attach keys on. Today the collector sets them last, so any early failure prevents a late attach, even though ADR-019 already allows one.

## Historical Context (from prior changes)

- `context/archive/2026-11-24-claude-transcript-capture/plan.md:34`: "Derive the version from attributed records when the host descriptor omits it, and reject disagreement." Supported by the code (`claude-transcript.mjs:104-107, 141-147`). No justification for rejecting a descriptor/record disagreement appears in that plan, brief or research (worker read).
- `context/archive/2026-11-24-claude-transcript-capture/plan.md:225-226`, rows 3.4 and 3.5, are ticked. That change's `evidence/unproven.md` states neither was proven live. Partial: the ticks overstate the evidence.
- Telemetry-era `unsupported-host`: 35 entries in 8 archived runs, run.jsonl last committed 2026-11-21. That is before #272 (`fdf6a7e4`, 2026-11-22), which replaced the exact release list `["2.1.311"]` (`git show fdf6a7e4^:skills/10x-pipeline/scripts/claude-usage.mjs`, ~`:108`) with the floor. 34 carry `hostVersion: "unknown"` and an invocation; one (open-pr-base-prefix-collision step 4) carries `2.1.323`. `context/archive/2026-11-19-claude-token-figures-default/change.md:16` names the exact-version pin as a cause. The mechanism is inferred, because archived descriptors were not kept. It is a different mechanism from this change.
- `context/archive/*/claude-capture-async-agent-launch/evidence/live-requalification.md`: one interactive launcher run on 2.1.323 verified all five steps (1,248,719 tokens in total) in a probe project, not in a recorded pipeline run.
- `context/archive/*/claude-capture-default-on/plan.md:269`, row 1.7, is still unticked.

## Related Research

- `context/archive/2026-11-24-claude-transcript-capture/research.md`: the transcript evidence sample behind the current collector.
- `context/changes/claude-usage-host-version-mismatch/frame.md`: the frame this research builds on.

## Open Questions

- **Descriptor version in transcript mode** (a choice for /10x-plan): ignore it, reject it as `invalid-evidence` when present, or keep it as a consistency hint with an accurate reason. The evidence supports ignoring it or rejecting it. A hint has no reliable source (`claude-transcript.mjs:61-62`; `claude-usage.mjs:99-101`).
- **Reason code when records disagree with each other**: `unsupported-host` text (`usage.mjs:24`) is accurate only for a below-floor version. No existing reason means "records disagree". Whether to add one or reuse `invalid-evidence` is a contract choice that affects `flow.mjs:111-133`.
- **Where identity is set**: moving `evidence.invocation` to after `:140`, or always restoring it in the catch, changes which failures become attachable. The planner must keep `late-usage.test.mjs:735` (refusal when absent) true for evidence that never established identity.
- **SKILL.md wording within the byte limits**: about 44 bytes of headroom per file, and the regexes pin "observed IDs/version". Either rephrase within the regexes or update the ceilings and regexes together.
- **Live proof**: a human-run Manual row is needed (native Agent calls are not available to step subagents). This change's history also suggests recording the evidence file, not only ticking the row.
