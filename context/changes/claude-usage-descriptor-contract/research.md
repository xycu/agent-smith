---
date: 2026-11-25T13:29:46+0100
researcher: Claude (for Błażej Ksycki)
git_commit: dab94515
branch: main
repository: agent-smith
topic: "What must change so native Claude step usage is recorded at step time without depending on the orchestrator hand-building a descriptor"
tags: [research, claude-usage, claude-transcript, usage-evidence, next-intake, late-usage, skill-loop]
status: complete
last_updated: 2026-11-25
last_updated_by: Claude
---

# Research: router-owned Claude usage at step time

**Date**: 2026-11-25T13:29:46+0100
**Researcher**: Claude (for Błażej Ksycki)
**Git Commit**: dab94515 (main; the change folder is uncommitted)
**Branch**: main
**Repository**: agent-smith

## Research Question

From `frame.md`: Claude step accounting depends on an optional orchestrator step (SKILL.md Loop step 4) that hand-builds a nested descriptor of facts the router already holds, and the router cannot tell when that step was skipped. What does `/10x-plan` need to know to move measurement, identity or the evidence-present check into the router? That means: where the router could measure, which fact only the host has, which prior decisions constrain the design, how retries and resumed sessions affect identity, and which tests and docs pin the current contract.

## Summary

- **One fact is host-only.** `measureClaudeTranscript` anchors the measurement on `invocation.agentId` (`claude-transcript.mjs:104-107`, `:141`).
  - `sessionId` comes from `CLAUDE_CODE_SESSION_ID` (`:35-38`), and a supplied value must equal it (`:106`).
  - `runId` falls back to `rootMeta.toolUseId` (`:147`).
  - The `router` block is used only to rebuild the expected description, which is compared with `rootMeta.description` (`claude-usage.mjs:14-22`, `claude-transcript.mjs:143`). The router holds `change`, `chain`, `n` and `step`.
  - On the inspected Claude Code 2.1.330 host, the orchestrator sees `agentId` in the `async_launched` tool result (`toolUseResult.agentId`, linkedin-prm session `39b8c516`). It does not have to wait for the hand-back.
- **The router can import the measurement.** `claude-transcript.mjs` imports only `usage.mjs` and `claude-capture-data.mjs` (`:7-8`), and neither imports `state`, `flow` or `route`. `init-usage.mjs:44` already loads it dynamically in the router process.
  - The insertion point is `attachResult` in `flow.mjs`, between verification and `normalizeAccounting` (`flow.mjs:685-688`).
  - `attachResult` is synchronous (`flow.mjs:616`), and it receives neither `meta` (which holds the host) nor `id`/`chain` (`route.mjs:105`). The plan must pass these in or measure in `route.mjs` before the call.
- **Prior decisions forbid description-based selection, not router-side measurement.**
  - Selection: "never select by description, modification time or file order alone" (`context/archive/2026-11-24-claude-transcript-capture/plan.md:98`) and "never derive them from a description" (`skills/10x-pipeline/SKILL.md:72`, origin `context/archive/2026-11-18-delegated-token-accounting/plan.md:185`).
  - The reasons are that neutral retries repeat a description and that a step must not certify itself (`delegated-token-accounting/plan.md:71`; `docs/REFERENCE.md:474`).
  - No inspected document considers or rejects measurement in `next`. `claude-transcript-capture/research.md:32` notes that no earlier change rejected a transcript-only collector by name.
  - ADR-018 Amendment 4 (`docs/ADR/ADR-018-no-nested-subagents.md:115`) restricts what is persisted ("raw source records and paths never enter router state"), not where reading happens.
- **`next` accepts a Claude step with no evidence and says nothing.** `normalizeAccounting` returns `{}` when both fields are absent (`usage.mjs:73`). No branch at `flow.mjs:685-692` looks at `claudeCaptureMode` or provider. The report counts the step only in the aggregate "Missing" figure (`flow.mjs:184`), and per-step limitation lines cover only `unavailable` (`flow.mjs:112-134,187`).
- **Late recovery is closed for steps logged without evidence**, and partly closed for `unavailable` evidence with `hostVersion: "unknown"`.
  - A structured attach needs a recorded invocation plus equal `source` and `hostVersion` (`route.mjs:889-896`).
  - `unavailableEvidence` writes `hostVersion: "unknown"` when none is given (`usage.mjs:56-61`).
- **Size budget.**
  - Both SKILL.md files sit at 24 B and 23 B under their ceilings (`skill-loop.test.mjs:552-557`).
  - The step 4 text is pinned phrase by phrase (`skill-loop.test.mjs:632-681`; `openspec-skill.test.mjs:299-310`). Shrinking the step frees bytes, but every pinned phrase that moves needs a test update.

## Detailed Findings

### The descriptor and what each field does

- `collectClaudeUsage` takes the transcript branch when `descriptor.mode === "transcript"` (`claude-usage.mjs:66`). Before measuring, it evaluates `routerDescription(descriptor.router)` (`:69`). That call fails `missing-identity` when `router` is not an object or `chain` is not `10x`/`openspec` (`:15-16`). This is why every flat descriptor seen in linkedin-prm failed. Those descriptors had no `router` key, and most had no `chain` (frame.md, Hypothesis 1).
- `measureClaudeTranscript` (`claude-transcript.mjs:101-147`) does the following:
  - It rejects `checkpoint`/`process`/`sources` keys (`:102`). It requires an object `invocation` with a path-safe `agentId` (`:104`).
  - It reads `subagents/agent-<agentId>.meta.json` (`:115`, `:141`) and requires:
    - a valid `toolUseId`;
    - `spawnDepth === 1`;
    - no `parentAgentId`;
    - a description that matches exactly;
    - `toolUseId === runId` when `runId` is given (`:142-143`).
  - It then sets the invocation from host records (`:147`). Later checks need `finished === true` and a root return in the main transcript (`:209-213`, `:228-231`). A second meta with the same `toolUseId` yields `ambiguous-history` (`:235`).
- `main()` parses stdin with `JSON.parse(input)` at `claude-usage.mjs:402`. Its catch (`:404`) reports `error.reason ?? "unsupported-schema"` with `source: "claude-native"`. A parse error carries no `reason`, so malformed JSON is labelled `unsupported-schema`. `claude-usage.test.mjs:289` asserts that label for malformed stdin.

### Host records on the inspected host (Claude Code 2.1.330, linkedin-prm)

- Each step has `<sessionId>/subagents/agent-<agentId>.meta.json`. Inspected example: `{"agentType":"agent-smith:step","description":"agent-smith inbox-thread-parser-mismatch step 6 manual-verify","toolUseId":"toolu_01L7…","spawnDepth":1,"requestShape":"background","model":"sonnet","effort":"high","finished":true}`. All five metas of session `39b8c516` had `finished: true` when read after the run.
- The Agent tool result for a background launch carries `{"isAsync":true,"status":"async_launched","agentId":"ab556b2b8acf7b37a","description":"agent-smith … step 1 score",…}` (session `39b8c516`, first two launches inspected).
- Unverified: whether `finished: true` is on disk before the orchestrator receives the hand-back message.

### `next` intake

- The call sequence is `route.mjs:80` `next()` → `neutralRetry` (`:101`) → `attachResult(p, log, policy)` (`:105`, defined at `flow.mjs:616`). `attachResult` reads `p.result` (`flow.mjs:631`) and verifies per step (`:636-683`). It then splits `signals`, `usage` and `usageEvidence` off the result (`:685`), normalizes them (`:686`), stores the accounting on `last.result` and on the entry (`:687-688`), and writes the log (`:695`).
- `normalizeAccounting` "validates shape, not provenance" (`usage.mjs:71`). The router cannot tell step-authored accounting from orchestrator-merged accounting. Only the skill tells the orchestrator to delete step-authored fields (`skills/10x-pipeline/SKILL.md:97`).
- Fields available on the entry at intake (`route.mjs:263-275`; `state.mjs:163-171`):
  - `n`, `step`, `template`, `provider`, `model`, `effort`, `startedAt`;
  - `neutralRetries[].at` (`flow.mjs:484`);
  - `claudeCaptureMode`, set only when host and provider are both `claude` (`state.mjs:167`). It can stand in for the host check.

### Identity uniqueness, retries and sessions

- `n` is `ran.length + 1` over executed entries (`route.mjs:264`; `state.mjs:744`), and no inspected code truncates the log. So a new attempt after a failure gets a new `n`.
- A neutral retry reuses the same entry (`flow.mjs:444-447`, `:484`, `:490-496`), so the same `n` and description are launched again in the same session. The archive description has no `n` (`claude-usage.mjs:17-19`), so every archive attempt shares one description.
- On these paths, a lookup by description alone could match more than one meta. `agentId` or `toolUseId` tells them apart. This is the stated reason for the existing rule against description selection.
- The run state stores no session ID. The transcript is located only through the `CLAUDE_CODE_SESSION_ID` of the process doing the measuring (`claude-transcript.mjs:35-38`).
  - `init` resumes a run with its saved host (`route.mjs:1108-1111`), possibly from another session.
  - If a step was launched in session A and `next` runs in session B, the router would look under B and get `missing-source`.
  - Inference, not inspected behavior: the `next` call that dispatches a step runs as a child of the orchestrator session, so the router could record that session ID on the entry at dispatch.

### Late `usage` command

- `route.mjs:840-932`:
  - The structured `--usage-file` path needs `verified` or `transcript` evidence (`:861-864`) and a recorded entry whose invocation, source and hostVersion equal the payload's (`:889-896`).
  - Numeric flags are refused once evidence exists (`:913`).
- If `next` recorded `unavailable` evidence with an invocation and the real host version, a later transcript payload could attach. With `hostVersion: "unknown"` (`usage.mjs:56-61`), the equality at `:893` fails.

### OpenSpec chain

- The OpenSpec chain shares the same `route.mjs next` with `--chain openspec` (`skills/openspec-pipeline/SKILL.md:23`) and the same `attachResult`; OpenSpec steps are verified at `flow.mjs:679-681`. The collector's router identity accepts `chain: "openspec"` (`claude-usage.mjs:15-16`). The step 4 text is duplicated at `skills/openspec-pipeline/SKILL.md:103`.

### Cost bounds for measuring inside `next`

- Limits (`claude-capture-data.mjs:27-29`; `usage.mjs:16`):
  - 32 MB of total bytes across main and agent transcripts (`claude-transcript.mjs:118`);
  - 1 MB per record, 200,000 records, 512 agents, 100,000 requests;
  - 4096 directory entries per scan (`:58`);
  - a 2000 ms deadline.
- The largest inspected linkedin-prm orchestrator transcript was 5,587,963 bytes (`0a70f36c`).

## Code References

- `skills/10x-pipeline/scripts/claude-usage.mjs:14-22` — `routerDescription`. `:60-75` — the transcript branch of `collectClaudeUsage`. `:394-412` — `main()` and the CLI entry.
- `skills/10x-pipeline/scripts/claude-transcript.mjs:35-38` — session ID from env. `:101-147` — identity checks. `:209-235` — completion and duplicates.
- `skills/10x-pipeline/scripts/flow.mjs:616-700` — `attachResult`. `:112-134,158,179-187` — report rendering of usage.
- `skills/10x-pipeline/scripts/usage.mjs:56-61` — `unavailableEvidence`. `:71-101` — `normalizeAccounting`.
- `skills/10x-pipeline/scripts/route.mjs:80-108` — `next`. `:263-275` — the dispatch entry. `:840-932` — the `usage` command.
- `skills/10x-pipeline/scripts/init-usage.mjs:42-83` — the dynamic import and the init readiness preflight.
- `skills/10x-pipeline/SKILL.md:28,68,72,97,137,151-153`; `skills/openspec-pipeline/SKILL.md:30,74,78,103,154-158`.
- Tests:
  - `skills/10x-pipeline/test/claude-usage.test.mjs:285-296` — CLI and malformed input. `:422-570` — async launch. `:582-937` — transcript.
  - `claude-helpers.mjs:147-188` — `transcriptFixture`, which writes metas.
  - `accounting-readers.test.mjs:14,314,366,399,414`.
  - `late-usage.test.mjs:619-829` — structured attach.
  - `result-persist.test.mjs:380,401` — intake.
  - `skill-loop.test.mjs:552-557` — ceilings. `:632-681` — step 4 and late-usage phrases.
  - `skills/openspec-pipeline/test/openspec-skill.test.mjs:248,299-310`.
- Docs: `docs/REFERENCE.md:472-499` (observed accounting and descriptor), `:521-688` (late usage); ADR-018 Amendments 4–9 (`:111-147`); ADR-019 Amendments 1–5 (`:76-102`); `README.md:154-168`.

## Architecture Insights

- Measurement code is already a pure library (`usage.mjs` ← `claude-capture-data.mjs` ← `claude-transcript.mjs`) with no dependency on router modules. The collector CLI is a thin wrapper. The ownership split goes back to `claude-transcript-capture/plan.md:27`: "The router owns capture mode and run state. The host supplies invocation observations…". It exists because the host-only `agentId` must come from somewhere, not because of a stated rule that the router may not read transcripts.
- Codex usage reaches run state without a hand-built descriptor, because the runner (`run-codex.mjs`, `codex-usage.mjs`) measures its own dispatch. In the 10 linkedin-prm runs, every Codex step has verified evidence (frame.md). The Claude path is the one place where a model has to rebuild structured identity.
- `normalizeAccounting` validates shape only. Whoever writes `last-result.json` decides provenance. Measurement inside the router would make the router the provenance owner for Claude steps, as the runner already is for Codex.

## Historical Context (from prior changes)

- `context/archive/2026-11-18-delegated-token-accounting/plan.md:71,173,185,269`: a step cannot certify its own accounting. Collectors write no run state. Invocation identity is recorded independently of repeated descriptions.
- `context/archive/2026-11-24-claude-transcript-capture/plan.md:27,31,88,98` and `research.md:32,176`: this change introduced the transcript collector and the init readiness probe. It ruled out selection by description, mtime or file order, and moved telemetry to opt-in.
- `context/archive/2026-11-22-claude-capture-async-agent-launch/change.md`: Claude Code launches Agent asynchronously even when `run_in_background` is omitted. This is why results arrive as hand-backs.
- `context/changes/claude-usage-host-version-mismatch/frame.md:29,40,46`: unavailable evidence should keep identity, and "a measuring tool takes identity and version facts from the source it measures". That change is at `impl_reviewed` and its code merged in #298. This change builds on it.

## Related Research

- `context/changes/claude-usage-host-version-mismatch/research.md`
- `context/archive/2026-11-24-claude-transcript-capture/research.md`
- `context/archive/2026-11-18-delegated-token-accounting/research.md`

## Open Questions

1. **Which design (owner choice)?** The options have different trust and complexity:
   - (a) The router measures in `next`, with the orchestrator supplying only `agentId`.
   - (b) The router selects the subagent by description plus dispatch time, with no orchestrator input. This needs a reversal of `claude-transcript-capture/plan.md:98`, with retry and archive disambiguation.
   - (c) The orchestrator collector stays, but takes router facts from run state, and `next` flags a missing collector call.
2. **How `agentId` reaches the router under (a).** The options are a field in `last-result.json`, a `next` flag, or recording it in a separate call after launch. The result file is written by the orchestrator, and steps may also write files in the run root. The plan should state how a step-forged `agentId` is contained. The exact-description and `spawnDepth` checks bind it to this step's launch.
3. **Session ID at dispatch.** Should the entry record the dispatching session so that a resumed run measures in the right directory? It is unverified whether Claude Code keeps the same session ID on `/resume`.
4. **Timing.** Is `finished: true` written before the hand-back is delivered? If not, `next` would record `incomplete-capture` and need a late path.
5. **What `next` does with a Claude step that has no evidence.** It could warn, record `unavailable` with a reason such as `not-collected`, or halt. ADR-018:44 and ADR-019:29 require missing figures to stay tolerated, so a halt would need an amendment.
6. **`hostVersion: "unknown"` on unavailable evidence** blocks a structured late attach (`route.mjs:893`). Should the router record the observed version, or should the check relax `unknown`?
