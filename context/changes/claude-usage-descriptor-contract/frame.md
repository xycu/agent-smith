# Frame Brief: Claude token counts missing at step time

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

In linkedin-prm, 10 active runs on plugin 1.18.2 (Claude Desktop host 2.1.330, `--provider-mode split`) logged no Claude token figure for any native Claude step (score, plan-review, manual-verify, impl-review). Five runs have `usageEvidence: unavailable / missing-identity` with no invocation. The other five have neither `usage` nor `usageEvidence`. Every Codex step has verified evidence. The transcripts are intact, and the collector, given a correct descriptor, returns `status: transcript` totals for the same steps. Example: step 1 of `inbox-thread-parser-mismatch` measures 325,516 tokens, and its five Claude steps total about 6.55M.

## Initial Framing (preserved)

- **User's stated cause or approach**: SKILL.md Loop step 4 never states the descriptor keys, so orchestrators send a flat descriptor and get `missing-identity`. Some orchestrators never call the collector. `claude-usage.mjs` labels a JSON parse error `unsupported-schema` / `claude-native`. Late attach (`usage --usage-file`) cannot recover a step logged without an invocation.
- **User's proposed direction**: make the contract hard to get wrong. The collector could take the router fields from run state, or the router could record the invocation identity. `next` could refuse or warn when a Claude step has no evidence.
- **Pre-dispatch narrowing**: the priority is the figure missing *at step time*; later recovery is secondary. The symptom has been checked only in linkedin-prm.

## Dimension Map

1. **Skill contract text**: SKILL.md never gives the descriptor keys, so a flat shape is a fair reading. ← initial framing
2. **Orchestrator compliance**: the orchestrator skips, half-runs or drops the collector step.
3. **Interface ownership**: the collector makes the orchestrator restate facts the router already holds.
4. **Router acceptance**: `next` accepts a Claude step result without evidence and says nothing.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Skill text gives no shape | `skills/10x-pipeline/SKILL.md:97` and `skills/openspec-pipeline/SKILL.md:103` say only "router identity, returned agent ID and other observed IDs" in prose. Line 72 lists `sessionId`, `runId` and `agentId` as sibling fields, which suggests a flat object. The only literal `router`/`invocation` example is the telemetry one at `docs/REFERENCE.md:486-494`, which carries `sources`/`process`/`hostVersion` and fails in transcript mode (`invalid-evidence`, `claude-transcript.mjs:103`). The skill never points to it for this step. `skill-loop.test.mjs:552-558` leaves 24 B and 23 B of headroom. A flat descriptor fails at `claude-usage.mjs:15-16` (`router` undefined). | STRONG |
| 2. Orchestrator compliance | No session called the collector correctly during a run. Sessions `38639f23`, `4450d2ef` and `5ba52561` never called it. There was no compaction first, and SKILL.md was in context. `4450d2ef` wrote "Writing the result now, without usage", reading anti-stall rule 1 (SKILL.md:137) as leave to skip step 4. `0a70f36c` merged collector output for one step and dropped it for later steps. `e8e67f73` carried step 2's evidence into steps 4 and 5 without measuring. Every session dispatched Agent steps in the background, so results arrived as hand-back messages, not tool results, and "for every Agent result" never fired as written. The three sessions that skipped entirely ran on Sonnet. The two clean-calling sessions ran on Opus. The nested shape appeared only after an orchestrator read `claude-usage.mjs` source, and only after the user asked. | STRONG |
| 3. Interface ownership | The router holds `change`, `chain`, `n`, `step` and `claudeCaptureMode` (`route.mjs:263-275`, `state.mjs:167`). The description is a pure function of them (`claude-usage.mjs:14-22`). `router` is used only for an identity check against `rootMeta.description` (`claude-transcript.mjs:143`). `sessionId` comes from env regardless (`:35-38`, `:107`). `runId` falls back to `rootMeta.toolUseId` (`:147`). Only `agentId` is caller-only (`:105`, `:115`). The router already reads the main transcript at `init` (`init-usage.mjs:61-83`). ADR-018:115 allows host-derived identity as long as raw records and paths stay out of router state. | STRONG |
| 4. Router acceptance | `flow.mjs:685-692` strips and normalizes accounting, with no branch on host, provider or `claudeCaptureMode`. With neither field present, `normalizeAccounting` returns `{}` (`usage.mjs:73`). The report counts the step as legacy "missing" (`usage.mjs:109,117`; `flow.mjs:184`) with a `-` token cell (`flow.mjs:158`). Per-step limitation lines cover only `unavailable` (`flow.mjs:116,187`). A skipped collector looks the same as a pre-capture legacy step. Tolerating missing usage is deliberate (ADR-018:44, ADR-019:29), but the skill also says a missing source should yield `unavailable` evidence, so a step with no evidence at all means the step was skipped. | STRONG |

Also confirmed: `main()` in `claude-usage.mjs` (around line 400) reports a JSON parse error as `unsupported-schema` with `source: "claude-native"`. In `0a70f36c` and `e8e67f73`, a zsh `set -- $t` (no word split) produced invalid JSON that came back labeled this way. This is a minor diagnostic defect.

## Narrowing Signals

- Not one in-run collector call succeeded in 10 runs. Fixing only the shape (dimension 1) would have helped at most the 5 runs that called the collector, and their Sonnet orchestrators still dropped or reused evidence.
- The nested shape is learned only by reading collector source. Prose is not enough for a model to reconstruct a nested JSON contract.
- Background dispatch, an older known host behavior (archive `2026-11-22-claude-capture-async-agent-launch`), changes how the result arrives, so the trigger in step 4 does not match what the orchestrator sees.
- Model sensitivity: Opus orchestrators mostly followed step 4, Sonnet ones mostly did not. A correctness step that depends on orchestrator model diligence is fragile by design.

## Cross-System Convention

Elsewhere in this router, facts the router can derive are derived by the router, not restated by the skill. Codex usage is measured by the router-side runner from the rollout, and every Codex step in these runs has verified evidence. The Claude path is the only accounting path that depends on a model rebuilding a structured payload and remembering an optional step. Earlier Claude-capture changes (`claude-transcript-capture`, `claude-capture-default-on`, `claude-usage-host-version-mismatch`) all fixed the collector. None of them looked at how its output reaches the router. That matches the Codex convention of moving work out of the model's hands, which the leading hypothesis also points toward.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Claude step accounting depends on an optional, unchecked orchestrator ritual. The model must remember to run it and must hand-build a nested descriptor of facts the router already holds. The router does not take that work over and cannot tell when the ritual was skipped.

The initial framing named the right symptoms, but its weight shifts. Missing descriptor keys (dimension 1) cause only part of the failure. Dimensions 2 to 4 share one root: the router owns everything except `agentId` yet leaves measurement and its absence to the orchestrator. If the orchestrator had to pass only the `agentId` (or less), and `next` measured or at least flagged a host-`claude` step with no evidence, both the shape error and the skipped call would stop costing figures. The parse-error label and late-attach recovery are secondary to this.

## Confidence

**HIGH**: all four dimensions have file:line or transcript evidence. The narrowing signal (no correct in-run call in 10 runs) is decisive, and the reframe matches the Codex convention in the same router. The one open point: the symptom was checked only in linkedin-prm. The orchestrator model mix (Sonnet) may make this project worse than others, but the design defect does not depend on the project.

## What Changes for /10x-plan

The plan should move Claude transcript measurement, or at least the router identity and the check that evidence is present, from the orchestrator into the router. The skill handoff shrinks to the one host-only fact (`agentId`), and it must survive background dispatch and hand-back delivery. Clarifying the SKILL.md wording is a fallback, not the fix. Constraints the plan must respect:
- ADR-018:115: raw records and paths never enter router state.
- ADR-018:44 and ADR-019:29: missing figures stay tolerated, never zero.
- The SKILL.md size ceilings.
- Both chains (`10x` and `openspec`).

## References

- Source files: `skills/10x-pipeline/SKILL.md:68,72,97,137`, `skills/openspec-pipeline/SKILL.md:78,103`, `skills/10x-pipeline/scripts/claude-usage.mjs:14-22,66-75,~400`, `skills/10x-pipeline/scripts/claude-transcript.mjs:35-38,102-147`, `skills/10x-pipeline/scripts/flow.mjs:116,158,184,187,685-692`, `skills/10x-pipeline/scripts/usage.mjs:73,109,117`, `skills/10x-pipeline/scripts/route.mjs:263-275,889-896`, `skills/10x-pipeline/scripts/init-usage.mjs:61-83`, `docs/REFERENCE.md:476,486-494`, `skills/10x-pipeline/test/skill-loop.test.mjs:552-558`
- ADRs: ADR-018 (lines 18, 44, 115, 127), ADR-019 (lines 29, 73, 80)
- Prior changes: archive `2026-11-22-claude-capture-async-agent-launch`, `2026-11-24-claude-transcript-capture`, `2026-11-24-claude-capture-default-on`; open `claude-usage-host-version-mismatch`
- Evidence: linkedin-prm orchestrator transcripts `0a70f36c`, `6a1c1084`, `38639f23`, `4450d2ef`, `e8e67f73`, `39b8c516`, `f8df4d0a`, `5ba52561`, `17d1b5c7`; scratch scans `/private/tmp/claude-501/-Users-blazej-WebstormProjects-agent-smith/97314f25-9dee-4d8e-9eee-d176dcb03c10/scratchpad/scan.mjs`, `/private/tmp/claude-501/-Users-blazej-WebstormProjects-agent-smith/97314f25-9dee-4d8e-9eee-d176dcb03c10/scratchpad/win.mjs`
