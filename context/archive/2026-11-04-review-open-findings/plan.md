# Route Reviews on Open Findings, With a Confirmation Round Implementation Plan

## Overview

The router decides the next step after a plan review or an implementation review from the pre-edit counts in the review header. Both reviews apply their own fixes, so a review whose every finding is `Decision: APPLIED` still sends the run to a re-plan or a `fix`. This plan makes the router read the per-finding `Severity` and `Decision` lines, route REVISE (plan review) and NEEDS ATTENTION (implementation review) on the findings that are still open, halt for a human when an owner decision is pending, and add an opt-in confirmation round (`review.confirmRounds`, default 0) that re-reviews self-applied fixes with no re-plan between.

## Current State Analysis

- `readReview` (`skills/10x-pipeline/scripts/route.mjs:113-127`) reads the `**Verdict**` line and the `**Findings**` header counts only. It ignores every `### F<n>` block.
- `prompts/plan-review-apply.md` and `prompts/impl-review-apply.md` keep the header counts "as measured before the edits", so after a clean apply the counts still read `1 critical`.
- `decide` (`route.mjs:820-948`) re-plans on `REVISE` with `critical > 0` or `warnings > review.reviseToleranceWarnings` (`:882-885`) and runs `fix` on `NEEDS ATTENTION` with a critical, or any `NEEDS ATTENTION` while `review.fixOnNeedsAttention` is `true` (`:923-925`, the shipped value). `replanNext` (`:1274`) spends one of `limits.maxPlanRevisions` per re-plan.
- The counts are read live from the review file in `decide`; nothing logs them. The consumers are the re-plan and `fix` gates, the noisy-review bump (`:897`), the clean-review drop (`:898`) and the `reason` strings (`:938`, `:1300`, `:1313`, `:1323`).
- Review files carry per-finding blocks (`### F1 — ...`, `- **Severity**: ❌ CRITICAL`, `- **Decision**: APPLIED — <detail>`), see `context/archive/2026-11-03-worktree-step-commits/reviews/plan-review.md`. The review skills write `Decision: PENDING`; human triage in `/10x-plan-review` (Step 7) writes `FIXED` (its own word for an applied fix; 67 of the `Decision` lines under `context/archive/*/reviews/` read `FIXED`, 28 read `APPLIED`), `SKIPPED`, `ACCEPTED` or `DISMISSED`. Triage in `/10x-impl-review` (Step 5) also writes `ACCEPTED-AS-RULE: <rule title>` (finding left unfixed, rule recorded) and `FIXED + ACCEPTED-AS-RULE: <rule title>`. Older hand-written lines in the archive start with `Accepted.`, `Fix (<sha>):`, `Skip` or `Deferred`.
- Every existing test fixture writes the review through `writeReview` (`skills/10x-pipeline/test/helpers.mjs:74`), a header with no `### F` block, so all existing tests exercise the no-Decision path.

## Desired End State

- A review with Decision lines routes on its open findings. A review without any (a project override that replaces a review prompt with a plain string, every existing fixture) routes exactly as today: same step, same `reason` text, same tier.
- Plan review `REVISE`: no open critical and open warnings within `review.reviseToleranceWarnings` goes on to implement. Otherwise the run halts with the open finding ids, because an open finding needs an owner decision that a re-plan subagent must not make. `RETHINK` keeps its routing.
- Implementation review `NEEDS ATTENTION`: no open critical and open warnings within the tolerance goes on to done. Otherwise the run halts. `REJECTED` keeps its routing.
- `review.openFindings.onOpen: "retry"` re-plans (plan review) or runs `fix` (implementation review) on open findings above the tolerance, instead of halting. It does not bring back a `fix` for an implementation review with nothing open or with open warnings within the tolerance, and it does not bring back a re-plan for an all-applied `REVISE`. `review.openFindings.enabled: false` is the full opt-out: every review routes on the measured header counts as today.
- `review.confirmRounds` (per rigor level, default 0 everywhere) schedules up to N extra reviews of the same kind per run after a review that applied fixes and left nothing open. A confirmation review is routed by the same open-findings rule; one that again applied fixes and left nothing open schedules the next confirmation only while fewer than N ran, so with N = 1 a confirmation never schedules another.
- `run.jsonl` review entries carry the measured and the open counts; `status` shows them and `report.md` has a `## Review findings` section.
- Verify: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, `loops-existing.test.mjs` is byte-identical to its state at the branch point (`meta.baseSha`; in an isolated run the step commits move `HEAD`, so a `git diff` against `HEAD` cannot see an edit that an earlier step committed), and the budget test for the longest legal path holds with the shipped policy.

### Key Discoveries:

- Review `Findings` header counts are pre-edit by the apply prompts, so they cannot tell an applied critical from an open one (`prompts/plan-review-apply.md:6`).
- `loops-existing.test.mjs` characterizes RETHINK/REVISE with header-only reviews; a Decision-less fallback keeps it valid with no edit (AGENTS.md forbids editing it).
- The log entry of a step is written when the step is returned and completed in `attachResult` (`route.mjs:455-511`), which already reads the review file to verify it, so the new `review` field costs one more read of a file it already reads.
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

At the end of every phase, besides its Progress rows, run the branch-point check of "Integration Tests" (`git diff --exit-code 5333a53 -- skills/10x-pipeline/test/loops-existing.test.mjs`): the rows compare against `HEAD`, which the step commits of this isolated run move.

## Phase 1: Parse findings and log the counts

### Overview

`readReview` understands the `### F` blocks, the policy gets its `review` keys, and review log entries record the counts. Routing is unchanged in this phase.

### Changes Required:

#### 1. Review parser

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Extend `readReview` to return the per-finding records and add `openCounts` that applies the policy. A block runs from a `### F<n>` heading to the next `### ` or `## ` heading; `Severity` is the first of CRITICAL, WARNING, OBSERVATION found on the block's `**Severity**` line (case-insensitive, emoji ignored); `decision` is the first run of ASCII letters (`[A-Za-z]+`) after `**Decision**:`, upper-cased, or `null` when the line is missing. So `APPLIED — abc1234` reads `APPLIED`, `Accepted.` reads `ACCEPTED`, `ACCEPTED-AS-RULE: <title>` reads `ACCEPTED` and `FIXED + ACCEPTED-AS-RULE: <title>` reads `FIXED`. A pattern that keeps hyphens would turn the impl review skill's triage word into an unknown, open word.

**Contract**: `readReview` keeps its fields and gains `findings: [{ id, severity, decision }]`. `openCounts(review, policy)` returns `{ aware, openCritical, openWarnings, applied, ids, unparsed }`:

- `aware` is `policy.review.openFindings.enabled === true` and at least one finding has a non-null `decision`; anything else gives `aware: false` and the caller uses the measured counts.
- A finding is closed when its decision is in `closedDecisions` (default `APPLIED`, `FIXED`, `ACCEPTED`, `SKIPPED`, `DISMISSED`; `FIXED` is the word the review skills' own triage writes, so a human who triages and resumes is not read as leaving the finding open); a missing decision, `PENDING` or an unknown word is open. Observations never count.
- `applied` is the number of CRITICAL and WARNING findings whose decision is `APPLIED` or `FIXED`.
- A block whose `**Severity**` line names none of CRITICAL, WARNING or OBSERVATION counts as a WARNING, so an unreadable severity is never read as cleaner than it is.
- Header counts larger than the parsed CRITICAL or WARNING blocks add the difference as open (`unparsed`), so a review that lists fewer blocks than its header claims is never read as cleaner than it says. `ids` lists only parsed blocks; a halt text names the unlisted ones as a count.

#### 2. Policy keys

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the `review` keys with shipped defaults that leave the shipped behaviour unchanged where no Decision line exists.

**Contract**: under `review`: `openFindings: { enabled: true, closedDecisions: ["APPLIED", "FIXED", "ACCEPTED", "SKIPPED", "DISMISSED"], onOpen: "halt" }` and `confirmRounds: { lean: 0, standard: 0, thorough: 0 }`. A non-object `openFindings`, a non-boolean `enabled`, a `closedDecisions` that is not an array of non-blank strings, an `onOpen` other than `halt` or `retry`, and a `confirmRounds` value that is not a non-negative integer read as the shipped default for that key (`enabled` non-boolean reads as off), and never halt. Keys are camelCase.

#### 3. Review log entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `attachResult`, for a verified `plan-review` or `impl-review` step, store the counts so the log keeps both views.

**Contract**: `entry.review = { verdict, critical, warnings, openCritical, openWarnings }` (the verdict and the measured and open counts; the report line of Phase 4 reads the verdict from here); the open pair is present only when `aware`. A review entry of a review without Decision lines gets `verdict` and the measured pair only; entries of other steps keep their current shape. `status` rows show `review` when present (`status` projection, `route.mjs:3107-3125`).

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

**Contract**: halt text: `Plan review REVISE left <n> open critical and <m> open warnings (F1, F3). Needs a human.`, followed by the way back in: ` Set each finding's Decision in <review path> (APPLIED, FIXED, ACCEPTED, SKIPPED or DISMISSED) or triage with /10x-plan-review <review path>, then run again.` `<review path>` is `path.relative(ROOT, p.planReview)` (`context/changes/<id>/reviews/plan-review.md`), as the existing missing-result halt names its file. The word list is the effective `closedDecisions`, joined, so a project override changes the text too. Unparsed open findings add ` Plus <k> counted in the Findings header with no ### F<n> block: add a block with a Decision line for each, or lower the header count.` after the id list. In an isolated run (`meta.isolated === true`) the text ends with ` Commit the edit in the run worktree first: a failed step rolls back uncommitted edits.`, because the next step's rollback resets to its `startSha` and would restore the open Decision lines (README "Run isolation", rollback bullet). The `reason` of a `retry` re-plan reads `plan review REVISE (<c> critical, <w> warnings; open <oc> critical, <ow> warnings)` only for an aware review; an unaware review keeps `plan review REVISE (<c> critical, <w> warnings)` character for character. `replanNext` gets the open counts as an optional last argument (absent for an unaware review and for `RETHINK`); the suffix goes into both REVISE reasons, the `plan-revise` one (`:1323`) and the `research-revise` one (`:1313`), and the `frame-rethink` reason (`:1300`, `RETHINK` only) stays as it is. The `plan.autoDone === 0` guard of the gate stays.

#### 2. Implementation review routing

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the `needsFix` gate (`:923-925`), an aware `NEEDS ATTENTION` needs a fix only on `onOpen: "retry"` with open critical or open warnings above the tolerance; with `halt` it halts at those counts; with nothing open it falls through to `done`. `review.fixOnNeedsAttention` applies only to an unaware review. `REJECTED` keeps `codeReplanNext`, the fix-loop cap and its tier bump.

**Contract**: halt text `Implementation review NEEDS ATTENTION left <n> open critical and <m> open warnings (F2). Needs a human.` with the same way-back sentence as the plan review halt (`<review path>` is `path.relative(ROOT, p.implReview)`, triage with `/10x-impl-review <review path>`, whose resume mode reads a saved report), the same unlisted-count sentence and the same commit sentence in an isolated run. The `fix` entry's `reason` keeps its format for an unaware review and appends `; open <oc> critical, <ow> warnings` for an aware one.

#### 3. Apply prompts

**Files**: `skills/10x-pipeline/prompts/plan-review-apply.md`, `skills/10x-pipeline/prompts/impl-review-apply.md`

**Intent**: Make the lines the router reads a rule. Each finding is a `### F<n>` block (the archive also holds `### W1` and `### O1` headings, which the parser does not read, so they would count as unlisted and halt) and keeps its `**Severity**` and `**Decision**` lines; the Decision word is `APPLIED` or `PENDING` and nothing else; a `PENDING` line gives its reason; the header counts stay pre-edit.

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

**Contract**: returns `{ step: "plan-review" | "impl-review", template: "plan-review-confirm" | "impl-review-confirm", bump: 0, reason: "... confirmation round <k> of <n>: self-applied fixes unchecked" }`. The step name stays so the freshness checks and the tier policy of `plan-review` and `impl-review` apply; the count of confirmations is the number of executed entries with that template, failed ones included (hard cap). A confirmation review is routed by the same open-findings rule (so open findings halt, or re-plan on `retry`, and applied ones go on). One that again applied fixes and left nothing open passes the same gate, so it schedules the next confirmation only while the count is below the cap: N bounds the chain, and with N = 1 a confirmation's own entry exhausts the cap. A confirmation round never runs for `RETHINK`, `REJECTED`, an unaware review, or when `confirmRounds` for the level is 0 or malformed. The confirm entry gets the same `review` field.

#### 2. Templates and prompts

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/plan-review-confirm.md`, `skills/10x-pipeline/prompts/impl-review-confirm.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Add the two templates as the base review text, the confirm prompt and the existing apply prompt (the impl one also the lessons prompt). The confirm prompt tells the subagent that a previous round's report is in the review file: read it first, review the current plan or code in full, treat every `APPLIED` fix as a claim to check against the plan or code, and report a failed one as a finding.

**Contract**: `prompts.plan-review-confirm` and `prompts.impl-review-confirm` entries in `policy.json` reference the new files as `@prompts/<file>.md`; both files follow the rule form and are listed in the "Wired" table of `prompts/README.md` and in its opening list of files written for this pipeline. The confirm templates ignore `reviewWarning` (the first round already carried it; `reviewWarning`, `route.mjs:1599-1605`, returns nothing once an impl review ran after the implement step). A test asserts that both confirm templates carry their apply prompt, beside the existing check at `rules.test.mjs:138`.

#### 3. Budget

**File**: `skills/10x-pipeline/test/budget-executors.test.mjs` (new test cases only; existing ones unchanged)

**Intent**: Prove the shipped path is unchanged and state the cost of turning the round on.

**Contract**: with the shipped policy `longest(level)` equals today's value at every level. The walker writes header-only reviews (`review()` over `writeReview`), which are unaware and never confirm, so the new cases need a local writer of Decision-bearing reviews in the test file (`helpers.mjs` stays as it is). The saturating shape keeps `longScript`'s loop reviews header-only and makes the review that ends each loop aware: the last plan review `REVISE` and the last implementation review `NEEDS ATTENTION`, every CRITICAL and WARNING `APPLIED`. With `confirmRounds` N the router then walks N more `plan-review` steps and N more `impl-review` steps (2N in all), measured with a `budgetDelta` raised in the override; with the shipped `budgetDelta` the longest path passes the point that leaves a failed step and its retry to spare (the assertion form of "raised cap exceeds budget"), which the docs tell a project to answer by raising `budgetDelta` by 2 per round.

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

**Contract**: line form `- step <n> <step>[ (confirmation)]: <VERDICT>, <c> critical, <w> warnings measured[; <oc> critical, <ow> warnings open]`; the open part appears only for an aware review; no review entry gives no section. The counts are the ones stored in the log entry when the step ended, so a later edit of the review file (an owner closing a finding after a halt) is not reflected, and the section says so in one line. The section carries no tier, model or effort word.

#### 2. SKILL.md

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In "How the tier moves", replace the `REVISE` and `NEEDS ATTENTION` bullets (`:142`, `:147`) so they say "open findings" with the measured-count fallback, and add one bullet for the confirmation round and its cap. No model, effort or tier name beyond what the list already uses (AGENTS.md Hard Rules; `skill-loop.test.mjs` only checks the Anti-stall section).

**Contract**: AGENTS.md Coding Style requires this edit with the `tierFor` and `decide` change.

#### 3. README and AGENTS.md

**Files**: `README.md`, `AGENTS.md`

**Intent**: README: rewrite the "Both reviews apply their own fixes" bullet (`:40`, it says "so the router's decisions are unchanged"), add the open-findings routing, the halt on a pending owner decision, `onOpen`, `closedDecisions`, the fallback for a review without Decision lines, the confirmation round with its cap and budget cost (raise `rigor.budgetDelta` by 2 per round at each level that turns it on, one `plan-review` and one `impl-review` step), the halt text's way back in (set the Decision lines or triage with the review skill, commit the edit in an isolated run, run again), and the `## Review findings` section in "Usage report". It also states that `review.reviseToleranceWarnings` now bounds open warnings for both reviews (before, it bounded only the plan review), that an aware implementation review with open warnings within the tolerance goes to done with no `fix` step (`review.fixOnNeedsAttention` applies only to an unaware review), and that the tolerated open warnings stay visible in `## Review findings`. It also states that a `REVISE` with Decision lines never re-plans under the default `onOpen: "halt"`, so the `preplan.loops` REVISE-to-research loop and `limits.maxPlanRevisions` act on a `REVISE` only for a review without Decision lines or with `onOpen: "retry"` (`RETHINK` still reaches both), and the `Loops` bullet of the README says so where it describes that loop. AGENTS.md: add `openfindings.test.mjs` and the two confirm prompts to Project Structure.

**Contract**: README routing bullets and the `SKILL.md` list agree on the same wording for the gates.

#### 4. ADR

**File**: `docs/ADR/ADR-011-route-reviews-on-open-findings.md`

**Intent**: Record the decision (open findings over header counts, halt over re-plan for a pending finding, the shared tolerance and the end of the automatic `fix` for an aware `NEEDS ATTENTION`, a capped confirmation round off by default, the fallback) with the evidence from the `worktree-step-commits` run (two halts, about 1.38M subagent tokens, criticals 1, 3, 1, 1 across rounds) and from this change's own run, whose step-3 plan review applied all six of its findings (0 critical, 4 warnings measured, tolerance 1) and still sent the run to a `plan-revise` re-plan (step 4 of its `run.jsonl`). It also records the consequence for the REVISE loops: under the default `halt`, the REVISE-to-research loop and the `maxPlanRevisions` cap no longer see a `REVISE` that carries Decision lines.

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
- Parser: severities with emoji, a block with no recognizable severity (read as a warning), Decision lines with trailing text (`APPLIED — abc1234`), a `FIXED` line as the review skills' triage writes it, `ACCEPTED-AS-RULE: <title>` (closed, not applied) and `FIXED + ACCEPTED-AS-RULE: <title>` (closed, applied), a mixed-case `Accepted.`, an unknown word such as `Fix (abc1234):` (open), a block without a Decision line, a `### W1` block (not parsed, counted as unlisted through the header), a header count above the parsed blocks, no `### F` block at all, a malformed `openFindings` block.
- Halt texts: the review path, the effective `closedDecisions` (an override changes the listed words), the unlisted-count sentence, and the commit sentence present only in an isolated run.
- Routing: each gate against `all APPLIED`, `PENDING critical`, `open warnings` at and over the tolerance, `closedDecisions` override, `onOpen: "retry"`, RETHINK and REJECTED unchanged, a Decision-less header exactly as before (same `reason` string).
- Confirmation: default off, `confirmRounds: 1` once, cap, skip cases, confirmation that leaves an open finding, failed confirmation counts, `confirmRounds: 2` chains a second confirmation only after a first one that applied fixes and left nothing open, both confirm templates carry their apply prompt.

### Integration Tests:

- Existing `loops-existing.test.mjs`, `loops.test.mjs`, `route.test.mjs`, `budget-executors.test.mjs`, `rules.test.mjs` pass unmodified (they use header-only reviews).
- The Progress rows run `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`. In an isolated run each step commit advances `HEAD`, so that check proves only that the current step left the file alone. Also run `git diff --exit-code 5333a53 -- skills/10x-pipeline/test/loops-existing.test.mjs` at the end of each phase (`5333a53` is `meta.baseSha` of this run, the `main` commit the run branched from): it compares the working tree with the branch point, so it sees an edit whether an earlier step committed it or not. The row text stays as written because Progress titles are fixed.

### Manual Testing Steps:

1. Make a scratch change with a plan, a `plan-review` log entry and a Decision-bearing `plan-review.md`; run `init` and `status` and read the JSON.
2. Flip one critical between `APPLIED` and `PENDING` and run `next`; confirm go-on versus halt.
3. Run `status --report` and read `## Review findings`.

## Performance Considerations

None. One more regex pass over a review file that the router already reads on every `decide`.

## Migration Notes

- A run in flight keeps working: a review with no Decision lines routes as before. A review with Decision lines that a run already holds is routed on its open findings from the next `next` call.
- A project override that replaces a review prompt with a plain string produces no Decision lines and keeps the old routing.
- A run in flight whose plugin is upgraded records `provenance.drift` for `review` and `prompts` at its next `next` call (the policy gains keys, the apply prompts and templates change), and `compare` warns `provenance-drift:<side>:prompts,review`. That is expected and changes no routing; the README states it beside the release note.
- Under the default `halt`, the REVISE-to-research loop (`preplan.loops.reviseResearchAfter`) and the `maxPlanRevisions` cap only see a `REVISE` that has no Decision lines, or any `REVISE` with `onOpen: "retry"`. Say so in the PR text.
- Behaviour change to announce in the PR: a `REVISE` or `NEEDS ATTENTION` whose findings are all `APPLIED` now continues instead of re-planning or fixing, and a pending finding now halts instead of re-planning. `onOpen: "retry"` restores the old reaction to open findings. Whether this ships as `feat` or `feat!` is the owner's call at commit time (AGENTS.md "Commits").

## References

- Change identity and starting points: `context/changes/review-open-findings/change.md`
- Review file shape: `context/archive/2026-11-03-worktree-step-commits/reviews/plan-review.md`, `context/archive/2026-11-03-worktree-step-commits/reviews/impl-review.md`
- Gates: `skills/10x-pipeline/scripts/route.mjs:113-127`, `:820-948`, `:1274-1325`, `:455-511`
- Triage words: `10x-plan-review` SKILL.md Step 7 (`FIXED`, `SKIPPED`, `ACCEPTED`, `DISMISSED`), `10x-impl-review` SKILL.md Step 5 (also `ACCEPTED-AS-RULE`)
- Budget derivation: `skills/10x-pipeline/test/budget-executors.test.mjs:198-290`
- Prior ADRs: `docs/ADR/ADR-003-rigor-gated-routing.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parse findings and log the counts

#### Automated

- [x] 1.1 Parser and fallback tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs` — 772c65b
- [x] 1.2 Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 772c65b
- [x] 1.3 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs` — 772c65b
- [x] 1.4 Version fields consistent: `node tools/version-check.mjs` — 772c65b

#### Manual

- [ ] 1.5 `init` and `status` against a scratch change folder print valid JSON, and `status` shows `review` on a review row that has Decision lines.
- [ ] 1.6 The parser reads the round-4 `reviews/plan-review.md` of the archived `worktree-step-commits` change (copied into a scratch project) as 0 open critical and 0 open warnings.

### Phase 2: Route on open findings and make the Decision lines reliable

#### Automated

- [x] 2.1 Routing tests pass (all APPLIED goes on, open critical halts, open warnings at and above tolerance, pending observation ignored, `retry` mode, RETHINK and REJECTED unchanged, unaware fixture unchanged, unparsed header count open): `node --test skills/10x-pipeline/test/openfindings.test.mjs` — 92500ba
- [x] 2.2 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs` — 92500ba
- [x] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 92500ba
- [x] 2.4 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs` — 92500ba

#### Manual

- [ ] 2.5 A scratch run whose plan review is `REVISE` with one critical marked `APPLIED` goes from `plan-review` to `implement` in one `next` call, and with that critical `PENDING` halts with a readable message naming `F1`.
- [ ] 2.6 The halt message is understandable without reading the code (owner-facing wording check).

### Phase 3: Confirmation round

#### Automated

- [x] 3.1 Confirmation tests pass (off by default, runs once with `confirmRounds: 1`, no second confirmation, skipped for RETHINK, REJECTED, unaware review and open findings, open finding after a confirmation halts, confirmation that applies fixes goes on, a failed confirmation still counts): `node --test skills/10x-pipeline/test/openfindings.test.mjs` — f50664b
- [x] 3.2 Budget tests pass: `node --test skills/10x-pipeline/test/budget-executors.test.mjs` — f50664b
- [x] 3.3 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs` — f50664b
- [x] 3.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — f50664b
- [x] 3.5 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs` — f50664b

#### Manual

- [ ] 3.6 With `{"review":{"confirmRounds":{"standard":1}}}` in a scratch override, a `REVISE` review that applied its only critical returns a `plan-review` step with template `plan-review-confirm` at the next `next`, and the prompt names the confirmation round.
- [ ] 3.7 The confirm prompts read as instructions a subagent can follow without the review skill's questions.

### Phase 4: Surface the counts and update the docs

#### Automated

- [x] 4.1 Report and status tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs` — a7c261e
- [x] 4.2 ADR and prompt form checks pass: `node --test skills/10x-pipeline/test/rules.test.mjs` — a7c261e
- [x] 4.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — a7c261e
- [x] 4.4 Characterization file untouched: `git diff --exit-code HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs` — a7c261e
- [x] 4.5 Version fields consistent: `node tools/version-check.mjs` — a7c261e

#### Manual

- [ ] 4.6 README, `SKILL.md` and ADR-011 describe the same gates and the same defaults.
- [ ] 4.7 `status --report` on a scratch run with Decision-bearing reviews prints the `## Review findings` section.
