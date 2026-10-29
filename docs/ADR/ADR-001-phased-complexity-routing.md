# ADR-001: Route model and effort from cheap deterministic signals first, add scored complexity only if data demands it

- **Status:** Proposed
- **Date:** 2026-10-29
- **Deciders:** repository owner
- **Origin:** a ChatGPT conversation titled "Assigning Change Complexity" (https://chatgpt.com/share/6ae3c815-27a4-83eb-8e9b-6cce1f91cdd8) proposed a full scoring scheme. After review the scheme was narrowed to the phased approach below.

## Context

agent-smith routes each pipeline step to a model and effort level. Today `skills/10x-pipeline/scripts/route.mjs` picks one tier from `skills/10x-pipeline/policy.json`, using review verdicts, finding counts, phase count, the `--size` flag and failed attempts. The product goal (see `context/foundation/prd.md`) is to cut Claude usage, mostly the weekly limit, by choosing cheaper models and effort when a change is simple, with a router that is itself cheap to run.

A single "small, medium, large" label is a poor basis for that choice. A 500-line mechanical refactor can run on a cheap model, and a five-line change to authentication logic can need strict verification.

## The proposal and why it was narrowed

The source proposal scores every change on three independent dimensions: cognitive complexity (ambiguity, novelty, dependency coupling) picks the model, execution complexity (context discovery, work volume, verification difficulty) picks the effort, and risk sets mandatory review controls. Each factor is scored 0 to 3, the two complexity scores are summed to 0 to 9 and cut at fixed thresholds, a confidence value is added, and the result is stored in a machine-readable file with evidence and unknowns. The assessment runs once for the intent and again for each task.

What holds up:

- Model capability, effort and risk are separate questions. In particular risk should decide review depth regardless of the model.
- Evidence and unknowns should accompany any score, and routing quality should be judged by cost per successfully completed change, not by token price alone.
- Each implementation task can be routed on its own.

What does not fit this project:

- Honest scores need repository inspection, which costs tokens. That conflicts with a router that is cheap to run, and running the assessment twice roughly doubles the cost.
- Six subjective 0 to 3 judgments, summed and cut at arbitrary thresholds, give false precision. With at most dozens of runs the A/B signal is noisy and the thresholds cannot be calibrated.
- Effort controls reasoning depth. It does not track work volume, so mapping execution complexity to effort is doubtful.
- `route.mjs` already reads cheap signals for free: phase count, verdicts, finding counts and failures. Escalating after a failure costs nothing when the first attempt succeeds.
- The highest risk level needs human approval, but the pipeline runs unattended and subagents cannot ask questions.
- It is heavy for a three-week, after-hours, solo build, and the source is a single unvalidated answer.

## Decision

Adopt a phased approach.

### Phase 1 (this delivery)

1. **Measure first.** Record usage per step in the run state and compare full runs against a baseline of a full run on Sonnet-5.5 at high effort. Report the model and effort per step (PRD FR-004, FR-005).
2. **Route on deterministic signals.** The script chooses the tier from signals it can read without an LLM: phase count, the size flag, files changed in the diff, review verdicts, finding counts and failed attempts. The existing single ladder of model and effort pairs stays. Splitting model and effort into separate axes waits for measurements that show their effects separately.
3. **Treat risk as a separate axis, set by path rules.** Configurable path patterns in `policy.json` (for example authentication, data migrations, public API files) mark a change as elevated risk. Elevated risk means plan-review always runs, the implementation review runs at a minimum tier, and no step is skipped on a clean rubric. At the highest level the pipeline halts for a human instead of asking, because subagents cannot ask. The exact levels and patterns are policy data decided during implementation.
4. **Keep escalation on failure.** The current per-failure escalation stays as the correction for a change that was misjudged as simple.

### Phase 2 (only if the data requires it)

If measurements show first-pass failures or overspend that the deterministic signals do not explain, add LLM-scored complexity on a cheap model: scored factors with evidence and unknowns, stored in a machine-readable file next to the change's artifacts, with reassessment on events such as a new dependency, scope expansion, repeated unexplained failure or a risk change. The three-dimension scheme described above is the candidate design. Its thresholds are untested heuristics and must be calibrated against the Phase 1 data before use.

## Consequences

- No LLM scoring pass is needed in Phase 1, so the router stays cheap and PRD open questions 3 and 6 are narrowed: the router reads artifacts and diff stats with a script.
- Risk constrains PRD FR-002. Plan-review can be skipped only when the change is not elevated risk.
- Usage data per step is required for Phase 1, so PRD open question 4 (where usage and cost data comes from) becomes a blocker.
- A path-based risk rule can miss risky changes in unexpected files and flag harmless ones. The patterns need review after the first runs.
- Neither the 10x toolkit nor OpenSpec provides this mechanism. It is added by agent-smith as an add-on and changes neither toolkit.

## Alternatives considered

- **Full three-dimension scorecard up front:** the source proposal. Deferred to Phase 2 for the reasons above.
- **Single size label (small, medium, large):** simple, but it hides the difference between hard reasoning, long execution and high risk.
- **Escalation on failure only (the current behavior):** costs nothing on success, but it pays for failed attempts and cannot choose a cheap tier up front from the change itself. It stays as the fallback in Phase 1.
