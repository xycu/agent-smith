# Route Reviews on Open Findings, With a Confirmation Round Implementation Plan

## Overview

The router decides the next step after a plan review or an implementation review from the pre-edit counts in the review header. Both reviews apply their own fixes, so a review whose every finding is `Decision: APPLIED` still sends the run to a re-plan or a `fix`. This plan makes the router read the per-finding `Severity` and `Decision` lines, route REVISE (plan review) and NEEDS ATTENTION (implementation review) on the findings that are still open, halt for a human when an owner decision is pending, and add an opt-in confirmation round (`review.confirmRounds`, default 0) that re-reviews self-applied fixes with no re-plan between.

## Current State Analysis

- `readReview` (`skills/10x-pipeline/scripts/route.mjs:113-127`) reads the `**Verdict**` line and the `**Findings**` header counts only. It ignores every `### F<n>` block.
- `prompts/plan-review-apply.md` and `prompts/impl-review-apply.md` keep the header counts "as measured before the edits", so after a clean apply the counts still read `1 critical`.
- `decide` (`route.mjs:820-948`) re-plans on `REVISE` with `critical > 0` or `warnings > review.reviseToleranceWarnings` (`:882-885`) and runs `fix` on `NEEDS ATTENTION` with a critical, or any `NEEDS ATTENTION` while `review.fixOnNeedsAttention` is `true` (`:923-925`, the shipped value). `replanNext` (`:1274`) spends one of `limits.maxPlanRevisions` per re-plan.
- The counts are read live from the review file in `decide`; nothing logs them. The consumers are the re-plan and `fix` gates, the noisy-review bump (`:897`), the clean-review drop (`:898`) and the `reason` strings (`:938`, `:1300`, `:1313`, `:1323`).
- Review files carry per-finding blocks (`### F1 — ...`, `- **Severity**: ❌ CRITICAL`, `- **Decision**: APPLIED — <detail>`), see `context/archive/2026-11-03-worktree-step-commits/reviews/plan-review.md`. The review skills write `Decision: PENDING`; human triage in `/10x-plan-review` (Step 7) writes `APPLIED`, `SKIPPED`, `ACCEPTED` or `DISMISSED`.
- Every existing test fixture writes the review through `writeReview` (`skills/10x-pipeline/test/helpers.mjs:74`), a header with no `### F` block, so all existing tests exercise the no-Decision path.

## Desired End State

- A review with Decision lines routes on its open findings. A review without any (a project override that replaces a review prompt with a plain string, every existing fixture) routes exactly as today: same step, same `reason` text, same tier.
- Plan review `REVISE`: no open critical and open warnings within `review.reviseToleranceWarnings` goes on to implement. Otherwise the run halts with the open finding ids, because an open finding needs an owner decision that a re-plan subagent must not make. `RETHINK` keeps its routing.
- Implementation review `NEEDS ATTENTION`: no open critical and open warnings within the tolerance goes on to done. Otherwise the run halts. `REJECTED` keeps its routing.
- `review.openFindings.onOpen: "retry"` restores the old reaction to open findings (re-plan, `fix`), for a project that wants it.
- `review.confirmRounds` (per rigor level, default 0 everywhere) schedules up to N extra reviews of the same kind after a review that applied fixes and left nothing open. A confirmation review is routed by the same open-findings rule and never schedules another confirmation.
- `run.jsonl` review entries carry the measured and the open counts; `status` shows them and `report.md` has a `## Review findings` section.
- Verify: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, `loops-existing.test.mjs` is byte-identical to `HEAD`, and the budget test for the longest legal path holds with the shipped policy.

### Key Discoveries:

- Review `Findings` header counts are pre-edit by the apply prompts, so they cannot tell an applied critical from an open one (`prompts/plan-review-apply.md:6`).
- `loops-existing.test.mjs` characterizes RETHINK/REVISE with header-only reviews; a Decision-less fallback keeps it valid with no edit (AGENTS.md forbids editing it).
- The log entry of a step is written when the step is returned and completed in `attachResult` (`route.mjs:442-503`), which already reads the review file to verify it, so the new `review` field costs one more read of a file it already reads.
- `rigor.budgetDelta` is sized for the longest legal path with `extraSteps.allowance` used up (`budget-executors.test.mjs:198-290`); a new step kind must not lengthen the shipped path, so the confirmation round ships off.
- Step names `plan-review` and `impl-review` drive freshness (`lastIdx`, `route.mjs:849-852`, `:906-910`) and tier policy (`policy.json` `steps`); a confirmation review therefore keeps the step name and differs only by `template`.

## What We're NOT Doing

- No edit of `skills/10x-pipeline/test/loops-existing.test.mjs`, and no change to the RETHINK, REJECTED, frame-round or research-round routing (change.md Constraints, Starting point 3).
- No change to `rigor.budgetDelta`, `extraSteps.allowance` or `limits`; the shipped budgets stay. A project that turns on `confirmRounds` raises `budgetDelta` itself (documented, tested).
- No change to the noisy-review bump (`noisyPlanReviewWarnings`) and the clean-review drop: both keep reading the measured counts.
- No router judgement of whether a Decision claim is true, and no check that an `APPLIED` finding names a commit.
- No edit of the 10x toolkit skills (`10x-plan-review`, `10x-impl-review`) outside this repo; only this plugin's apply prompts change.
- No change to `baseline-policy.json`.
- No code, config or doc outside `skills/10x-pipeline/`, `README.md`, `AGENTS.md` and `docs/ADR/`.

## Implementation Approach

Parse once, route on a small derived structure, keep the old path as the fallback. `readReview` returns the findings it finds (`id`, `severity`, `decision`) next to the measured counts. A helper `openCounts(review, policy)` turns that into `{ aware, openCritical, openWarnings, applied, ids }`; `aware` is true only when the feature is on and at least one `### F` block has a `Decision` line. `decide` branches on `aware` at exactly the four existing gates (re-plan, `fix`, the two `reason` strings), so an unaware review runs the unchanged lines. The confirmation round is a third branch next to those gates that returns the same step name with a new template.

Order: parse and log (no routing change yet), then routing plus the apply prompts that make Decision lines reliable, then the confirmation round, then surfacing and docs.

## Phase 1: Parse findings and log the counts

### Overview

`readReview` understands the `### F` blocks, the policy gets its `review` keys, and review log entries record the counts. Routing is unchanged in this phase.

### Changes Required:

#### 1. Review parser

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Extend `readReview` to return the per-finding records and add `openCounts` that applies the policy. A block runs from a `### F<n>` heading to the next `### ` or `## ` heading; `Severity` is the first of CRITICAL, WARNING, OBSERVATION found on the block's `**Severity**` line (case-insensitive, emoji ignored); `decision` is the first alphabetic word of the `**Decision**` line, upper-cased, or `null` when the line is missing.

**Contract**: `readReview` keeps its fields and gains `findings: [{ id, severity, decision }]`. `openCounts(review, policy)` returns `{ aware, openCritical, openWarnings, applied, ids, unparsed }`:

- `aware` is `policy.review.openFindings.enabled === true` and at least one finding has a non-null `decision`; anything else gives `aware: false` and the caller uses the measured counts.
- A finding is closed when its decision is in `closedDecisions` (default `APPLIED`, `ACCEPTED`, `SKIPPED`, `DISMISSED`); a missing decision, `PENDING` or an unknown word is open. Observations never count.
- `applied` is the number of CRITICAL and WARNING findings whose decision is exactly `APPLIED`.
- Header counts larger than the parsed CRITICAL or WARNING blocks add the difference as open (`unparsed`), so a review that lists fewer blocks than its header claims is never read as cleaner than it says.

#### 2. Policy keys

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the `review` keys with shipped defaults that leave the shipped behaviour unchanged where no Decision line exists.

**Contract**: under `review`: `openFindings: { enabled: true, closedDecisions: ["APPLIED", "ACCEPTED", "SKIPPED", "DISMISSED"], onOpen: "halt" }` and `confirmRounds: { lean: 0, standard: 0, thorough: 0 }`. A non-object `openFindings`, a non-boolean `enabled`, a `closedDecisions` that is not an array of non-blank strings, an `onOpen` other than `halt` or `retry`, and a `confirmRounds` value that is not a non-negative integer read as the shipped default for that key (`enabled` non-boolean reads as off), and never halt. Keys are camelCase.

#### 3. Review log entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `attachResult`, for a verified `plan-review` or `impl-review` step, store the counts so the log keeps both views.

**Contract**: `entry.review = { critical, warnings, openCritical, openWarnings }` (measured and open); the open pair is present only when `aware`. Entries of other steps and runs with no Decision lines keep their current shape except for the measured pair. `status` rows show `review` when present (`status` projection, `route.mjs:3107-3125`).

### Success Criteria:

#### Automated Verification:

- Parser and fallback tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- Version fields consistent: `node tools/version-check.mjs`

#### Manual Verification:

- `init` and `status` against a scratch change folder print valid JSON, and `status` shows `review` on a review row that has Decision lines.
- The parser reads the round-4 `reviews/plan-review.md` of the archived `worktree-step-commits` change (copied into a scratch project) as 0 open critical and 0 open warnings.

## Phase 2: Route on open findings and make the Decision lines reliable

### Overview

`decide` routes REVISE and NEEDS ATTENTION on the open counts. The two apply prompts require the lines the router now reads.

### Changes Required:

#### 1. Plan review routing

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the `needsReplan` gate (`:882-885`) and the `replanNext` call, use open counts when the review is aware: a `REVISE` with open critical, or open warnings above `review.reviseToleranceWarnings`, halts with the open ids (default `onOpen: "halt"`) or re-plans through `replanNext` (`onOpen: "retry"`); a `REVISE` with nothing open goes on to implement. `RETHINK` is untouched and still calls `replanNext`. An unaware review runs the existing expression.

**Contract**: halt text: `Plan review REVISE left <n> open critical and <m> open warnings (F1, F3). Needs a human.` The `reason` of a `retry` re-plan reads `plan review REVISE (<c> critical, <w> warnings; open <oc> critical, <ow> warnings)` only for an aware review; an unaware review keeps `plan review REVISE (<c> critical, <w> warnings)` character for character. The `plan.autoDone === 0` guard of the gate stays.

#### 2. Implementation review routing

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the `needsFix` gate (`:923-925`), an aware `NEEDS ATTENTION` needs a fix only on `onOpen: "retry"` with open critical or open warnings above the tolerance; with `halt` it halts at those counts; with nothing open it falls through to `done`. `review.fixOnNeedsAttention` applies only to an unaware review. `REJECTED` keeps `codeReplanNext`, the fix-loop cap and its tier bump.

**Contract**: halt text `Implementation review NEEDS ATTENTION left <n> open critical and <m> open warnings (F2). Needs a human.` The `fix` entry's `reason` keeps its format for an unaware review and appends `; open <oc> critical, <ow> warnings` for an aware one.

#### 3. Apply prompts

**Files**: `skills/10x-pipeline/prompts/plan-review-apply.md`, `skills/10x-pipeline/prompts/impl-review-apply.md`

**Intent**: Make the lines the router reads a rule. Each finding block keeps its `**Severity**` and `**Decision**` lines; the Decision word is `APPLIED` or `PENDING` and nothing else; a `PENDING` line gives its reason; the header counts stay pre-edit.

**Contract**: new rules in the existing GIVEN/WHEN/THEN form with one bold RFC 2119 keyword each (ADR-004, `rules.test.mjs` form check); no model, effort or tier word.

### Success Criteria:

#### Automated Verification:

- Routing tests pass (all APPLIED goes on, open critical halts, open warnings at and above tolerance, pending observation ignored, `retry` mode, RETHINK and REJECTED unchanged, unaware fixture unchanged, unparsed header count open): `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual Verification:

- A scratch run whose plan review is `REVISE` with one critical marked `APPLIED` goes from `plan-review` to `implement` in one `next` call, and with that critical `PENDING` halts with a readable message naming `F1`.
- The halt message is understandable without reading the code (owner-facing wording check).

## Phase 3: Confirmation round

### Overview

An opt-in extra review of the same kind after a review that applied fixes and left nothing open, capped per run, with no re-plan or fix in between.

### Changes Required:

#### 1. Confirm gate

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: After the plan-review routing says "go on" and after the impl-review routing says "done", return a confirmation review when the review was aware, its verdict was `REVISE` (plan) or `NEEDS ATTENTION` (impl), `applied > 0`, nothing is open, and the number of earlier confirmations of that kind in the run is below `review.confirmRounds[<level>]`. Plan review confirms only while `plan.autoDone === 0` (the same moment the re-plan gate acts).

**Contract**: returns `{ step: "plan-review" | "impl-review", template: "plan-review-confirm" | "impl-review-confirm", bump: 0, reason: "... confirmation round <k> of <n>: self-applied fixes unchecked" }`. The step name stays so the freshness checks and the tier policy of `plan-review` and `impl-review` apply; the count of confirmations is the number of executed entries with that template, failed ones included (hard cap). A confirmation review is routed by the same open-findings rule (so open findings halt, or re-plan on `retry`, and applied ones go on); it cannot trigger another confirmation because its own entry exhausts the cap. A confirmation round never runs for `RETHINK`, `REJECTED`, an unaware review, or when `confirmRounds` for the level is 0 or malformed. The confirm entry gets the same `review` field.

#### 2. Templates and prompts

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/plan-review-confirm.md`, `skills/10x-pipeline/prompts/impl-review-confirm.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Add the two templates as the base review text, the confirm prompt and the existing apply prompt (the impl one also the lessons prompt). The confirm prompt tells the subagent that a previous round's report is in the review file: read it first, review the current plan or code in full, treat every `APPLIED` fix as a claim to check against the plan or code, and report a failed one as a finding.

**Contract**: `prompts.plan-review-confirm` and `prompts.impl-review-confirm` entries in `policy.json` reference the new files as `@prompts/<file>.md`; both files follow the rule form and are listed in the "Wired" table of `prompts/README.md`. The confirm templates ignore `reviewWarning` (the first round already carried it).

#### 3. Budget

**File**: `skills/10x-pipeline/test/budget-executors.test.mjs` (new test cases only; existing ones unchanged)

**Intent**: Prove the shipped path is unchanged and state the cost of turning the round on.

**Contract**: with the shipped policy `longest(level)` equals today's value at every level; with `confirmRounds` raised the router walks one more `plan-review` step and one more `impl-review` step per round, and the test shows the shipped `budgetDelta` then halts a saturating run, which the docs tell a project to answer by raising `budgetDelta`.

### Success Criteria:

#### Automated Verification:

- Confirmation tests pass (off by default, runs once with `confirmRounds: 1`, no second confirmation, skipped for RETHINK, REJECTED, unaware review and open findings, open finding after a confirmation halts, confirmation that applies fixes goes on, a failed confirmation still counts): `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- Budget tests pass: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`
- Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual Verification:

- With `{"review":{"confirmRounds":{"standard":1}}}` in a scratch override, a `REVISE` review that applied its only critical returns a `plan-review` step with template `plan-review-confirm` at the next `next`, and the prompt names the confirmation round.
- The confirm prompts read as instructions a subagent can follow without the review skill's questions.

## Phase 4: Surface the counts and update the docs

### Overview

The report and `status` show measured and open counts; `SKILL.md`, `README.md`, `AGENTS.md` and a new ADR describe the routing.

### Changes Required:

#### 1. Report section

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `buildReport` adds a `## Review findings` section after `## Rolled-back steps`, one line per review entry that has a `review` field.

**Contract**: line form `- step <n> <step>[ (confirmation)]: <VERDICT>, <c> critical, <w> warnings measured[; <oc> critical, <ow> warnings open]`; the open part appears only for an aware review; no review entry gives no section. The section carries no tier, model or effort word.

#### 2. SKILL.md

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In "How the tier moves", replace the `REVISE` and `NEEDS ATTENTION` bullets (`:142`, `:147`) so they say "open findings" with the measured-count fallback, and add one bullet for the confirmation round and its cap. No model, effort or tier name beyond what the list already uses (AGENTS.md Hard Rules; `skill-loop.test.mjs` only checks the Anti-stall section).

**Contract**: AGENTS.md Coding Style requires this edit with the `tierFor` and `decide` change.

#### 3. README and AGENTS.md

**Files**: `README.md`, `AGENTS.md`

**Intent**: README: rewrite the "Both reviews apply their own fixes" bullet (`:40`, it says "so the router's decisions are unchanged"), add the open-findings routing, the halt on a pending owner decision, `onOpen`, `closedDecisions`, the fallback for a review without Decision lines, the confirmation round with its cap and budget cost, and the `## Review findings` section in "Usage report". AGENTS.md: add `openfindings.test.mjs` and the two confirm prompts to Project Structure.

**Contract**: README routing bullets and the `SKILL.md` list agree on the same wording for the gates.

#### 4. ADR

**File**: `docs/ADR/ADR-011-route-reviews-on-open-findings.md`

**Intent**: Record the decision (open findings over header counts, halt over re-plan for a pending finding, a capped confirmation round off by default, the fallback) with the evidence from the `worktree-step-commits` run (two halts, about 1.38M subagent tokens, criticals 1, 3, 1, 1 across rounds).

**Contract**: follows the numbering and the checks of `rules.test.mjs:131`.

### Success Criteria:

#### Automated Verification:

- Report and status tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- ADR and prompt form checks pass: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- Version fields consistent: `node tools/version-check.mjs`

#### Manual Verification:

- README, `SKILL.md` and ADR-011 describe the same gates and the same defaults.
- `status --report` on a scratch run with Decision-bearing reviews prints the `## Review findings` section.

---

## Testing Strategy

### Unit Tests:

- New `skills/10x-pipeline/test/openfindings.test.mjs`, black-box through the CLI like `loops.test.mjs`. It writes its own Decision-bearing review (a local helper in the file; `helpers.mjs` stays as it is) next to the existing `writeReview` header, so the same test can pair a header with and without blocks.
- Parser: severities with emoji, Decision lines with trailing text (`APPLIED — abc1234`), a block without a Decision line, a header count above the parsed blocks, no `### F` block at all, a malformed `openFindings` block.
- Routing: each gate against `all APPLIED`, `PENDING critical`, `open warnings` at and over the tolerance, `closedDecisions` override, `onOpen: "retry"`, RETHINK and REJECTED unchanged, a Decision-less header exactly as before (same `reason` string).
- Confirmation: default off, `confirmRounds: 1` once, cap, skip cases, confirmation that leaves an open finding, failed confirmation counts.

### Integration Tests:

- Existing `loops-existing.test.mjs`, `loops.test.mjs`, `route.test.mjs`, `budget-executors.test.mjs`, `rules.test.mjs` pass unmodified (they use header-only reviews).

### Manual Testing Steps:

1. Make a scratch change with a plan, a `plan-review` log entry and a Decision-bearing `plan-review.md`; run `init` and `status` and read the JSON.
2. Flip one critical between `APPLIED` and `PENDING` and run `next`; confirm go-on versus halt.
3. Run `status --report` and read `## Review findings`.

## Performance Considerations

None. One more regex pass over a review file that the router already reads on every `decide`.

## Migration Notes

- A run in flight keeps working: a review with no Decision lines routes as before. A review with Decision lines that a run already holds is routed on its open findings from the next `next` call.
- A project override that replaces a review prompt with a plain string produces no Decision lines and keeps the old routing.
- Behaviour change to announce in the PR: a `REVISE` or `NEEDS ATTENTION` whose findings are all `APPLIED` now continues instead of re-planning or fixing, and a pending finding now halts instead of re-planning. `onOpen: "retry"` restores the old reaction to open findings. Whether this ships as `feat` or `feat!` is the owner's call at commit time (AGENTS.md "Commits").

## References

- Change identity and starting points: `context/changes/review-open-findings/change.md`
- Review file shape: `context/archive/2026-11-03-worktree-step-commits/reviews/plan-review.md`, `context/archive/2026-11-03-worktree-step-commits/reviews/impl-review.md`
- Gates: `skills/10x-pipeline/scripts/route.mjs:113-127`, `:820-948`, `:1274-1325`, `:442-503`
- Budget derivation: `skills/10x-pipeline/test/budget-executors.test.mjs:198-290`
- Prior ADRs: `docs/ADR/ADR-003-rigor-gated-routing.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parse findings and log the counts

#### Automated

- [ ] 1.1 Parser and fallback tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- [ ] 1.2 Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.3 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 1.4 Version fields consistent: `node tools/version-check.mjs`

#### Manual

- [ ] 1.5 `init` and `status` against a scratch change folder print valid JSON, and `status` shows `review` on a review row that has Decision lines.
- [ ] 1.6 The parser reads the round-4 `reviews/plan-review.md` of the archived `worktree-step-commits` change (copied into a scratch project) as 0 open critical and 0 open warnings.

### Phase 2: Route on open findings and make the Decision lines reliable

#### Automated

- [ ] 2.1 Routing tests pass (all APPLIED goes on, open critical halts, open warnings at and above tolerance, pending observation ignored, `retry` mode, RETHINK and REJECTED unchanged, unaware fixture unchanged, unparsed header count open): `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- [ ] 2.2 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.4 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual

- [ ] 2.5 A scratch run whose plan review is `REVISE` with one critical marked `APPLIED` goes from `plan-review` to `implement` in one `next` call, and with that critical `PENDING` halts with a readable message naming `F1`.
- [ ] 2.6 The halt message is understandable without reading the code (owner-facing wording check).

### Phase 3: Confirmation round

#### Automated

- [ ] 3.1 Confirmation tests pass (off by default, runs once with `confirmRounds: 1`, no second confirmation, skipped for RETHINK, REJECTED, unaware review and open findings, open finding after a confirmation halts, confirmation that applies fixes goes on, a failed confirmation still counts): `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- [ ] 3.2 Budget tests pass: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 3.3 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 3.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.5 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual

- [ ] 3.6 With `{"review":{"confirmRounds":{"standard":1}}}` in a scratch override, a `REVISE` review that applied its only critical returns a `plan-review` step with template `plan-review-confirm` at the next `next`, and the prompt names the confirmation round.
- [ ] 3.7 The confirm prompts read as instructions a subagent can follow without the review skill's questions.

### Phase 4: Surface the counts and update the docs

#### Automated

- [ ] 4.1 Report and status tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- [ ] 4.2 ADR and prompt form checks pass: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 4.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 4.4 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 4.5 Version fields consistent: `node tools/version-check.mjs`

#### Manual

- [ ] 4.6 README, `SKILL.md` and ADR-011 describe the same gates and the same defaults.
- [ ] 4.7 `status --report` on a scratch run with Decision-bearing reviews prints the `## Review findings` section.
