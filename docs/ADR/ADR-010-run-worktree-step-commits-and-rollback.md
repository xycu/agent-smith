# ADR-010: Run every change in its own worktree, commit each step, roll back a failed step, and make the first implement attempt cheaper

- **Status:** Accepted (owner, 2026-11-08), amended through Amendment 5. Isolated edits, step commits and scratch rollback have recorded results. The permission prompt and first-attempt savings still need evidence. [Live checks](#live-checks) · [First-attempt experiment](#ab-result)
- **Date:** 2026-11-04
- **Deciders:** unattended implementation run of change `worktree-step-commits`; the repository owner confirms or changes the readings below
- **Origin:** change `worktree-step-commits` (`context/changes/worktree-step-commits/change.md`, `plan.md`, `research.md` and `reviews/plan-review.md`). It widens the router's git-write rule in `AGENTS.md` (Hard Rules), which before this change allowed only the pre-archive commit of ADR-003 ("Archive adapter"). That commit is unchanged.

## Rule in force

Shared setup prepares or resumes the isolated worktree using its configured branch identity. The router commits verified step changes and reports paths swept in from outside the change. Before rollback it preserves working contents, commits made by the step and any distinct staged version under recovery refs. `isolation.require: false` opts out of isolated setup, these step commits and terminal publication. [Setup and rollback](../REFERENCE.md) · [Publication](ADR-017-run-branch-always-pushed-for-review.md)

## Context

- Before this change a run worked in the main checkout. The router wrote no git state except the pre-archive commit of an `--archive` run (ADR-003, "Archive adapter"). A failed step left its partial edits in the working tree, and the retry or the next step started from them.
- `decide` is file-driven: it reads `plan.md` `## Progress`, the review files and their file times, and the log. A partial edit therefore changes the next decision. After a failed implement step that ticked every row, the next step was `impl-review`, not a retry.
- Execution commits already happen inside steps (`/10x-goal-implement` commits each green phase, `fix` and the review apply rules commit). The router could not say which commit a step started from, so it could not undo a step.
- The ladder had 7 rungs, with no Opus rung below `high` effort. A move up from `sonnet/high` went straight to `opus/high`.
- The project counts Opus tokens as cost (`prd.md`, “Baseline comparison” in [the reference](../REFERENCE.md), the scorer A/B rule of ADR-007). The first implement attempt ran on the base tier although a failed attempt is retried one tier up anyway.
- A subagent starts in the main conversation's working directory, and a subagent never carries a `cd` over. Claude Code resets the main shell after a `cd` outside the project directory, and the Bash sandbox writes only under the working directory (research F1).
- The run was unattended. Every decision here is evidence-backed and was listed as an assumption of the step that took it; the owner read them and confirmed them on 2026-11-08.

## Decision

Four linked rules. All new git behavior is gated on `meta.isolated: true`, which only the first `init` of a run in a linked worktree sets, and only while `isolation.require` is the boolean `true` (the shipped default). With `{ "isolation": { "require": false } }` in the project override the router behaves as before this change.

Rules, written as scenarios (the form of ADR-004):

### Run isolation

**GIVEN** `isolation.require` is `true` **WHEN** `init` starts a run outside a linked worktree, on a detached HEAD, on a default branch or on a branch outside `isolation.branchPrefix` **THEN** the router **MUST** halt before it writes anything.

**GIVEN** a log with executed steps and no `meta.isolated` **WHEN** `init` resumes it with `isolation.require` `true` **THEN** the router **MUST** halt and name the opt-out, so a run is isolated from its first step or not at all.

**GIVEN** a project root **WHEN** the orchestrator makes the run worktree **THEN** it **MUST** put it at `<project root>/.claude/worktrees/agent-smith-<change-id>` on the branch `agent-smith/<change-id>`, and copy the change folder into it with its file times when it creates the run branch. Amendment 6 covers retries of an interrupted copy.

**GIVEN** an isolated run **WHEN** the router returns a prompt **THEN** it **MUST** start the prompt with the working-directory rules of `prompts/worktree.md`, which name the run root.

### Start commit and step commits

**GIVEN** the first `init` of an isolated run **WHEN** the isolation checks passed and `meta.json` is written **THEN** the router **MUST** commit the change folder as `chore(<id>): start run` before the first step is created, record `meta.startCommit` and keep `meta.baseSha` as HEAD before that commit.

**GIVEN** an isolated run whose last step is verified ok and has no `commit` key **WHEN** `next` runs **THEN** the router **MUST** commit what the step left as `chore(<id>): step <n> <step>` before it reads any file for the next decision, and record the commit, or `null` when nothing changed, on the entry.

**GIVEN** any router commit **WHEN** it is made **THEN** the router **MUST NOT** pass `--no-verify`, push, or set a `-c` option other than `core.quotePath=false`.

**GIVEN** a start or step commit that fails **WHEN** the router handles the failure **THEN** it **MUST** unstage its own add and halt with git's message.

### Failed-step rollback

**GIVEN** an isolated run whose last step failed, has a `startSha`, carries no `uncommitted` list and no `signals.needsHuman`, and was not rolled back or kept before **WHEN** `next` runs **THEN** the router **MUST** snapshot the worktree under `refs/agent-smith/<id>/<run>/failed-<n>` with plumbing (`git add -A`, `write-tree`, `commit-tree -p HEAD`, `update-ref`), reset the worktree with `git reset --hard <startSha>`, set back the file times `decide` compares, and write the router state back, all before risk, rigor and `decide` read the files.

**GIVEN** a side ref **WHEN** the router names it **THEN** `<run>` **MUST** be the first 12 hex characters of the run's start commit (`meta.startCommit`, or the `startSha` of the run's first step when the start commit was empty), so two runs of one change id in one repository never share a ref.

**GIVEN** an isolated run **WHEN** `next` creates a step entry and `git rev-parse HEAD` fails, times out after `isolation.gitTimeoutMs` or prints no hash **THEN** the router **MUST** halt before it logs the step and name the cause, because a step without a `startSha` cannot be rolled back.

**GIVEN** the cwd is not a linked worktree on `meta.branch` **WHEN** a rollback would run **THEN** the router **MUST** halt before any git write.

**GIVEN** a `next` call that rolled back **WHEN** it ends in a halt **THEN** the router **MUST** undo the reset (`git reset --hard <ref>`, then `git reset -q <ref>^`), set back the file times the failed step left and mark the entry `kept`, so the final failure keeps its partial edits for a human.

**GIVEN** an entry marked `rolledBack` or `kept` **WHEN** a later `next` runs **THEN** the router **MUST NOT** roll it back again.

### Cheaper first implement attempt

**GIVEN** an isolated run and a step whose template `escalation.firstAttempt.templates` lists **WHEN** that step has no failed entry in the run and no simple-change discount applies **THEN** the router **MUST** lower its tier by `escalation.firstAttempt.drop` before the clamp and the effort floor.

**GIVEN** a first-attempt drop that survived the score shift, the clamp and the floor (the final tier is below the tier the step gets without the drop and without the shift) **WHEN** that attempt fails **THEN** the router **MUST NOT** count the failure for `rigor.fromFailures` or the step budget.

**GIVEN** a failed cheap first attempt **WHEN** the router computes the retry tier, checks `maxAttemptsPerStep` or counts implement failures for the code re-plan **THEN** it **MUST** count the failure as any other.

**GIVEN** a first-attempt drop that applied **WHEN** the score shift is computed **THEN** the router **MUST NOT** add a down shift on top of it.

### The ladder and the effort floor

**GIVEN** the ladder **WHEN** the policy ships **THEN** it **MUST** have `opus/medium` at index 4.

**GIVEN** the inserted rung **WHEN** the step pins are renumbered **THEN** every step **MUST** keep the model and effort it had at its base tier.

**GIVEN** an interactive step at a level with `rigor.minEffort` **WHEN** the floor is applied **THEN** the router **MUST** also move the step up past a rung whose own effort ranks below the floor, so ADR-003's effort guarantee holds on a ladder that is not ordered by effort.

**GIVEN** an interactive step with a floor **WHEN** it failed `k` times in a row **THEN** the router **MUST** move it `k` rungs up counting only rungs whose effort clears the floor (a below-floor rung it starts on or passes is skipped for free), so each failed attempt still raises its effort: a step that starts on `sonnet/high` runs `opus/high` on its second attempt and `opus/xhigh` on its third, as before the inserted rung.

### What each rule covers

- Allowed git writes of the router, all in the run worktree except the archive commit: the start commit of the first `init`, the step commits, the side-ref snapshot under `refs/agent-smith/<id>/<run>/failed-<n>` (`git add -A`, `write-tree`, `commit-tree`, `update-ref`), the `git reset --hard <startSha>` of the rollback and the two resets of its undo, and the pre-archive commit of ADR-003. A failed start or step commit runs a `git reset` of the router's own add. A failed rollback halts and leaves what it staged; the side ref, once made, keeps the edits.
- The side ref is made with plumbing, so no hook runs on it. Step and start commits run every hook and signing.
- `startSha` is HEAD when the entry is created, so a file that is untracked or modified at step start is staged by the snapshot and removed or reverted by the reset. The start commit keeps the orchestrator's copy of the change folder (`research.md`, `frame.md`, a ready `plan.md`, an edited `change.md`) out of reach of the first rollback.
- File times: each entry of an isolated run records `before.mtimes` for `plan.md`, `reviews/plan-review.md` and `reviews/impl-review.md` (0 when absent). The rollback sets them back after the reset; the undo sets the times the failed step left. A run that starts with a reviewed plan therefore keeps its review fresh after a rolled-back implement, and a rolled-back plan review that rewrote its file runs again.
- Not rolled back: a `blocked` fallback step, a failed `score` attempt, an entry with `uncommitted` rows (the `implement-retry` step needs those ticks and that code), an entry with `signals.needsHuman` (the run halts on it). What a fallback or a failed score attempt leaves goes into the next successful step's commit; when the next step fails instead, its rollback resets those leftovers too, and its side ref keeps them.
- `report.md` lists rolled-back and kept steps under `## Rolled-back steps` with their side ref; `status` shows `rolledBack`, `kept` and the short `commit`.
- `escalation.firstAttempt` ships `drop: 0` while measurement is pending. Projects can set `drop: 1` to enable a one-tier discount for eligible first attempts of `implement`, `implement-segment`, `implement-tdd` and `implement-e2e`. `implement-retry`, re-plans and `fix` never get it. A drop the clamp or the floor absorbed (a tdd or e2e step on the floor, a step on its `minTier`) sets no `cheap` flag, reads `-1 first attempt not applied (clamp or floor)` in `tierWhy`, and its failure counts as usual. A drop that an execution-sum up shift cancels (+1 and -1, so the step runs on the tier it gets without both) sets no `cheap` flag either and reads `-1 first attempt not applied (cancelled by the score shift)`. The retry of a cheap attempt runs two tiers above it.
- Intended interactions of a failed cheap attempt (owner decision, review F10): it is neutral only for `rigor.fromFailures` and the step budget. It still counts as a failed implement attempt everywhere else, so the implementation review that follows it runs one tier up (the `struggled` bump), the simple-change discount is withheld for the rest of the run, and the score down shift is blocked for the rest of the run (both read "no failed step").

## Decisions taken for the owner

The run took three decisions that the change notes did not settle. Each is reversible.

| Decision | Evidence | How to reverse it |
| --- | --- | --- |
| The plain first-plan bump `complexity.firstPlan.bump.plain` is -2 instead of -1, so a short or plain goal keeps its first plan on `sonnet/high` (`sonnet/medium` for a short goal at `lean`) | the PRD goal of a lower weekly usage and FR-003; “Baseline comparison” in [the reference](../REFERENCE.md) on Opus tokens; the scorer A/B rule that turns the scorer off when Opus tokens rise; the change notes describe the rung as a shift of tier indexes | `{ "complexity": { "firstPlan": { "bump": { "plain": -1 } } } }` in the project override puts the plain-goal first plan on `opus/medium` |
| A failed cheap first attempt is outside `rigor.fromFailures` and the step budget, as a failed `score` attempt is | the change notes ask for a neutral failure; “Budget” in [the reference](../REFERENCE.md) sizes each level for one failed step and its retry, which a planned cheap failure would use up; a `lean` run keeps its budget of 10 | `{ "escalation": { "firstAttempt": { "drop": 0 } } }` turns the drop off, and with it the exception |
| `loops-existing.test.mjs`, the characterization of the RETHINK/REVISE loop, got one edit: the two tier literals 6 to 7 and 5 to 6 | the file pins model and effort routes (`opus/max`, `opus/xhigh`), which the renumbering keeps; the change notes list tests among the places whose tier indexes shift; no check compares the file's bytes; `ladder.test.mjs` pins both routes by name | not by an override: a ladder that keeps the old indexes no longer exists once the rung is inserted. The owner decides whether the rule "never edit it" holds with this one recorded exception (`AGENTS.md`, test list) |

## Owner decisions after the implementation review

The owner decided four findings of `reviews/impl-review.md`:

- F1, escalation: each failed attempt of an interactive step moves it to the next rung that clears its effort floor. Without this a step that starts on `sonnet/high` ran `opus/high` on both its second and third attempt, because +1 landed on `opus/medium`, which the floor skipped, and +2 landed on `opus/high`. Paths of the Phase 1 table that change: an interactive base-3 step (`impl-review`, `research`, a plain-goal first plan) at `standard` or `thorough` climbs 3, 5, 6 (`sonnet/high`, `opus/high`, `opus/xhigh`); the 3-5 phase `impl-review` and a plain-goal first plan with a score up shift reach 6 on their first retry; `plan-review` (base 2, below the floor) keeps 3, 3, 5 (`sonnet/high`, `sonnet/high`, `opus/high`), the route it had on the 7-rung ladder: the floor lifts it to `sonnet/high` on its first and second attempt, so its first failure moves it from base 2 to the rung the floor already gave it. A non-interactive step and a ladder ordered by effort are unchanged.
- F3, side-ref name: `isolation.rollback.ref` ships `refs/agent-smith/{id}/{run}/failed-{n}`, `{run}` being the 12-character run token above. The baseline and scorer A/B arms run one change id in one repository, and a re-run after a deleted branch reuses the id, so `n` alone collided.
- F9, `startSha`: read with `isolation.gitTimeoutMs`; a failure halts the run before the step is logged.
- F10, the first-attempt drop: `cheap` needs a net drop after the score shift, the clamp and the floor; the other interactions are listed under "What each rule covers" as intended.

## Reset target

A failed step is reset to its `startSha`, as the change notes decide ("hard-reset the worktree to the step's start commit").

- Cost: commits the failed step made itself, such as the green phase commits of `/10x-goal-implement`, leave the branch with the reset. They stay reachable from the side ref, whose parent is the head the step left, and the retry redoes them. This holds after a cheap first attempt too, so a cheap failure can cost a redone phase.
- Alternative: reset to the head the failed step left. It keeps green phase commits, and `/10x-goal-implement` resumes at the first pending row, at the cost of a second start point per step and a `before.autoDone` that no longer matches `startSha`.
- No failure data exists to choose between them: the four archived runs hold 34 executed steps and no failed one (research F4).

## Effective score shift

`scoreShift.effective` keeps its definition from ADR-007: the final tier with the shift minus the final tier without it. When the effort floor skips `opus/medium`, a shift of 1 reads as 2. The report reads the field only as applied or not, so `report.md` text does not change.

## Consequences

- `isolation.require` ships `true`. A run in the main checkout halts at `init` and names the opt-out: a breaking change, released as `feat!`.
- Every step of an isolated run ends at a known commit, and a failed step never reaches another step's commit. The branch history of a run is one start commit, then one step commit per step that changed something, with the subagents' own commits between them.
- A human's uncommitted edits in the worktree after a halt are swept into the next failed step's side ref. Commit them before resuming.
- The change folder in the main checkout becomes a stale copy. It must be removed or stashed before the run branch is merged.
- The router still never pushes, never calls `gh` and never deletes a branch, a worktree or a side ref.
- This ADR amends ADR-003 ("Archive adapter"): its rule that a run started without `--archive` runs no git command that writes the index or history, and its list of the router's git writes, now hold for a run that is not isolated. An isolated run adds the writes listed under "What each rule covers".

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Claude Code's `isolation: "worktree"` on the Agent tool | rejected | It makes one worktree per subagent and cleans it up, while the steps of a run must share one worktree and one branch. |
| `git stash` for the snapshot | rejected | A stash needs `-u` for untracked files and is one stack shared by every worktree of the repository, addressed by position; a named ref per failed step is easier to find and never collides. |
| `git commit` on a throwaway branch for the snapshot | rejected | It moves HEAD and runs hooks on partial, often broken, edits. Plumbing records the same tree without either. |
| A worktree outside the project directory | rejected | Claude Code resets the shell after a `cd` outside the project, and the sandbox and the `acceptEdits` mode cover only the working directory. |
| Deciding the next step first, then rolling back | rejected | `decide` reads files: it would act on files the reset then removes, and a retry logged before the reset would record a `before.autoDone` that counts discarded ticks. |
| No start commit | rejected | The orchestrator's copy of the change folder is untracked in a fresh worktree, so a rolled-back first step would delete `research.md`, `frame.md` or a ready `plan.md`. |

## Unverified assumptions

- A subagent of a live run works in the worktree. The docs say a subagent starts in the main conversation's working directory; an orchestrator that itself runs inside a subagent never carries a `cd` over. The router therefore names the run root in every prompt, and the orchestrator runs each router call with `cd` into it. Row 2.5 subsequently recorded edits confined to the worktree. [Archived isolation check](../../context/archive/2026-11-03-worktree-step-commits/plan.md#progress)
- Claude Desktop refused native Write into a sibling worktree and beneath the protected `.claude/` directory of a worktree shared with a linked session. The owner session was able to resume linked runs. These observations apply to those Desktop session arrangements. Whether plain `git worktree add` generally qualifies for the documented exemption for Claude's own worktrees under `.claude/worktrees/` remains unverified. Both skills now check native Write in the selected change directory before `init`. [Issue #243](https://github.com/xycu/agent-smith/issues/243) · [Claude Write preflight](../REFERENCE.md#claude-write-preflight)
- Hooks: git runs no hook on `git add -A`, `write-tree`, `commit-tree` or `update-ref`. A hook on the step commit can stage or write files; the post-commit checks halt on that.
- Cost: no run has measured whether the cheaper first attempt saves tokens once its failures, retries and redone phases are counted.

## Live checks

The archived plan records outcomes at the original implementation revisions for rows 2.5, 3.5 and 4.4. Its Manual Testing Steps retain the separate permission-prompt check. [Recorded rows](../../context/archive/2026-11-03-worktree-step-commits/plan.md#progress) · [Permission check](../../context/archive/2026-11-03-worktree-step-commits/plan.md#testing-strategy)

| Check | What it settles | Result |
| --- | --- | --- |
| Live check 1 | In a live run the subagent edits files only under the worktree, not in the main checkout, and Edit and Write under `.claude/worktrees/` do not prompt in `acceptEdits`. | Isolated edits recorded in row 2.5. Prompt-free Edit and Write under `acceptEdits` still require observation. |
| Live check 2 | `git log --oneline` in a run worktree shows the start commit and one `chore(<id>): step <n> <step>` commit per step that left changes, and the subjects pass `node tools/commit-lint.mjs`. | Recorded in row 3.5 for changed steps. |
| Live check 3 | After a forced failed step, `git show refs/agent-smith/<id>/<run>/failed-<n> --stat` lists the partial edits and `git status` in the worktree is clean. | Recorded in row 4.4 in a scratch worktree. |

## First-attempt experiment protocol

1. **Qualify the exact setup.** Run a fresh native 10x pipeline to completion on the pinned plugin revision, host build, launch path and explicit provider mode. Prefer the interactive Claude Code launcher with mode `claude` and `claude-native` evidence. Native Codex with mode `codex` requires CLI `0.169.0` and `codex-rollout` evidence. Inspect plain `status` and the corresponding router-owned evidence read-only. Require verified `step-tree` usage for every executed step, including a multi-request step and any descendants. Version matches and fixtures alone do not qualify a setup. Stop an unqualified host. Use one qualified setup for the cohort and keep any alternate cohort separate. [Prior Claude launcher qualification](../../context/archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md#resolution-2026-11-23) · [Observed token accounting](../REFERENCE.md#observed-token-accounting)
2. **Register the sample and controls before measurement.** Record ordered candidate and reserve lists of distinct, representative changes likely to reach eligible implement routes. Record the A/A control, its designated baseline (the `dropPercent` denominator), its start order, the initial rigor and flags, the approved run limit and independently verifiable external interruptions eligible for replacement. Use the first five eligible A/B pairs and one eligible A/A pair. Count eligible pairs where the drop was absorbed and record the effective route. Within a pair match the change ID, `baseSha`, exact goal and starting input bytes, machine, host/version, launch path, provider mode, plugin and tool/skill revisions, ladder and effective policy except for the tested leaf. Start a fresh native session per arm under equivalent environment and cache conditions. Alternate A/B start order and run arms close in time. Both arms use normal routing. Set the baseline to `drop: 0` and the routed side to `drop: 1` for A/B, and both to `drop: 0` for A/A. The pinned baseline changes the ladder and scorer for a separate comparison.
3. **Prepare isolated arm roots.** Use a disposable experiment repository with no publication remote, and run with archive and PR comments disabled. Create linked worktrees directly at the common `baseSha` using `git worktree add -b <branch> <path> <baseSha>`, with branches `<effective-prefix><id>-baseline` and `<effective-prefix><id>`. Launch each arm from its own root with explicit chain `10x`. Confirm effective isolation, branch and HEAD, fresh and trackable change folders without any corresponding archive, and a base and inputs free of generated artifacts and saved run state. Seed identical starting inputs, including `context/changes/<id>/change.md`, and let each arm generate its own plan and review. Run the same trusted dependency and project readiness checks in both roots. Choose a base that does not track `context/foundation/agent-smith-policy.json`. If the source tracks it, preserve its contents and prepare one documented disposable base commit before pinning both arms. Merge each arm's drop into its own override, preserve the other keys, and use the disposable repository's local Git exclude. Verify the overrides are ignored and absent from the index, and retain their contents and hashes privately. Record the expected missing-remote diagnostic separately from the router outcome and retain both roots and terminal state files.
4. **Reconcile each arm and validate the comparison.** After an arm's invocations settle, check native invocation records against the ledger and attach any matching eligible late evidence through `route usage --usage-file` under the existing accounting contract. For Claude, finish these checks and intake for the qualification run and each arm before exiting its launcher session. The launcher removes its projected capture records on exit. Keep a private record of invocation identities, their ledger matches and verified request counts, and the evidence for any pre-launch failure with no model request. A neutral rerun reuses its numbered entry, so exclude the pair if a prior invocation's usage is missing and a model request occurred or cannot be ruled out. A verified pre-launch failure with no model request can be retried. [Accounting activation and rollback](../REFERENCE.md#accounting-activation-and-rollback)

   Run `node <pinned-plugin>/skills/10x-pipeline/scripts/route.mjs compare <id> --chain 10x --baseline <baseline-root> --routed <routed-root> --unpinned` from an experiment checkout and retain JSON and terminal outcomes. Require `comparable: true`, intended isolated branch identities, the shared pinned base, complete verified `step-tree` figures, matching evidence source and host version, and agreement with the registered controls. Expect `baseline-unpinned` in both designs and an `escalation` mismatch only in A/B under the shipped provenance configuration. Review remaining warnings and compare full effective policy independently, including `score`, which the default unpinned comparison exempts. Exclude mismatched bases, goals, input bytes, unintended policy differences or drift, host/mode differences, and missing or unverified evidence even when the comparator returns a number.
5. **Preserve terminal evidence and apply the guards.** Keep outcomes and rigor for every attempt, including before any recovery that could replace them. On otherwise controlled A/B pairs, a routed halt against a done baseline or a higher routed terminal rigor fails the guard even if the pair is ineligible for the median. If the routed side has no terminal outcome against a done baseline, settle the original run or obtain independent evidence of an external interruption. An unresolved cause keeps the decision inconclusive. Resume an interrupted nonterminal arm only in its original root, after prior invocations settle, with the same controls and full accounting for prior work. Record each exclusion and its evidence. Use reserves in order within the approved limit. If a replacement reuses a change ID, use a separate disposable repository to retain the original branches. Keep refs and evidence through closeout. [Implementation and closeout plan](../../context/changes/first-attempt-drop-unmeasured/plan.md#phase-2-measure-live-and-record-the-default-decision)

## Decision rule

Fixed before any run. The cost claim of the cheaper first attempt is a hypothesis, and no pair has run yet.

Each A/B pair is one change run twice from the same `baseSha`, both arms isolated, `escalation.firstAttempt.drop` `0` as the baseline and `1` as the routed side, compared with `compare --unpinned`. The arms alternate which runs first and run close in time. Record each exclusion and its reason. The pair's token total includes every redone phase after a reset. Ship `1` only when all three conditions hold:

1. Use the first five eligible A/B pairs. Their median `dropPercent` is above 0 and above the absolute `dropPercent` of one eligible A/A pair (drop `0` on both arms).
2. Across those five eligible A/B pairs, the sum of failed implement attempts of the routed arm is at most the baseline's plus one per pair.
3. Across all otherwise controlled A/B pairs, apply the terminal guards even when the pair is ineligible for token comparison. No routed run ends at a higher rigor level than its baseline, and no routed run halts where its baseline ended `done`. Resolve any routed noncompletion against a done baseline as specified in the protocol before enabling `1`.

Anything else, including fewer than 5 comparable pairs, sets `escalation.firstAttempt.drop` to `0` in `policy.json`; the router does not change.

## A/B result

**Pending.** The shipped drop is `0` during measurement. Record each pair's change ID and `baseSha`, arm IDs, redacted evidence pointers, versions and configuration, provider mode, run order and timestamps, eligibility and warnings, per-arm outcome and rigor, verified counts and totals, `tokens.byModel`, `tokens.byTier`, `dropPercent`, and applied-drop and rollback observations. Include failed, retried and redone work in the raw dispatch token totals. Count failed implement attempts from executed entries with `step === "implement"` that satisfy `isFailure` (`ok === false && !fallback && !advisory`), including cheap failures and retries. The comparator's aggregate `failedAttempts` covers other roles too. Retain raw runs and evidence privately.

Record the decision using the first five eligible A/B pairs and an eligible A/A control. Keep `0` for an adverse or inconclusive outcome, including an exhausted sample, missing A/A control or unresolved routed noncompletion. Align the policy and documentation with the result and the host, mode and usage scope tested. If `1` returns, update the shipped-default regression and keep both explicit `0` and `1` cases. Run the focused tests and the recorded local closeout suite before marking the decision complete. [Change record and closeout command](../../context/changes/first-attempt-drop-unmeasured/change.md) · [Separate scorer experiment](ADR-007-llm-complexity-scorer-as-a-routed-step.md#ab-result)

## Amendment 1: the step commit records the code it takes (change step-commit-code-under-chore)

- A step commit of an isolated run takes whatever the step left in the worktree under `chore(<id>): step <n> <step>`. When a step subagent leaves its code uncommitted, that code reaches `main` under a `chore` subject, which release-please hides: no changelog line, and a run of only `chore` and `docs` commits opens no release PR.
- The router now reads the staged names right after its `git add -A` and before `git commit` (`git diff --cached --name-only --no-renames -z`). It keeps those outside the change folder (`context/changes/<id>/` or `openspec/changes/<id>/`) as `swept` on the log entry, sorted, only when there are any. `status` shows it and `report.md` names every path in `## Code committed by the router`, with a header line so the pull request body shows it too.
- The subject, the commit and the halt behavior are unchanged. A failed name read goes through the failure path of a failed add: the router unstages its add, nothing is committed, the entry gets no `commit` key and a resume retries, so the router never makes a step commit whose paths it could not record.
- Known limit: a pre-commit hook that stages extra files after the read is not seen.
- The implement-class prompts (`implement`, `implement-segment`, `implement-retry`, `os-apply`) ask the subagent to commit its code under a typed Conventional Commits subject before the `RESULT:` line, so the record is empty in the normal case. `open-pr.mjs` reports `swept` for its leftover commit too (ADR-017).

## Amendment 2 — Shared executable run setup (2026-11-14)

Both pipeline skills call `skills/10x-pipeline/scripts/prepare-run.mjs <id> [--chain 10x|openspec]` from the original project root before router initialization. The standalone executable uses existing standalone helpers and Node built-ins. It owns setup sequencing and filesystem copying. The router owns isolation enforcement, run state, commits and rollback.

Setup preserves the ordered `opt-out`, `in-run-worktree`, `in-flight-main`, `created`, `reused` and `attached` cases. A fresh branch starts from invoking HEAD with automatic upstream tracking suppressed. Fresh creation alone adds a needed local exclude, reports uncommitted paths outside the selected change folder and copies that folder with regular-file timestamps, modes and symlink targets preserved. Project prefixes are appended once to the selected worktree. Ordinary resume paths preserve destination bytes and timestamps. Amendment 6 defines pending-copy recovery. Git discovery preserves the source index.

Runtime outcomes print one JSON object and exit 0. Successful setup carries `reason: null` and an absolute `runRoot`. A setup failure carries a bounded `reason` and `runRoot: null`, retaining partial resources for inspection. Usage errors print a diagnostic on stderr and exit 2. Skills validate the result and stop before `init` on a failure signal or invalid output.

An exclusive filesystem lock in the absolute Git common directory serializes setup for each full branch name across chains and project prefixes. It covers discovery, worktree registration, complete copying and usable-root validation. Contention returns failure JSON. An interrupted process can leave a lock requiring inspection before manual removal.

Real CLI acceptance tests cover both chains, policy parity with the router loader, prefixes, copy fidelity, unchanged resumes, injected failures, the Git deadline, concurrent setup and command restrictions. The source change folder stays in place and `left` stays empty in Wave 4. Stale-copy cleanup is deferred to Wave 5. The existing live host-permission question above remains open.

## Amendment 3 — Preserve distinct staged versions during rollback (2026-11-16)

The delegated-failure recovery test exposed an existing loss boundary: `git add -A` replaced staged-only bytes before the working snapshot held them. Before that add, rollback now commits the existing index and publishes it under the same per-step recovery ref. The final working snapshot keeps the previous HEAD as its first parent and the index snapshot as its second parent. Existing undo ancestry and router-state schemas stay unchanged.

A retry parents the new index snapshot to any previous commit at that ref, preserving snapshots from an interrupted attempt before replacing the ref. Failures halt through the existing rollback error path. Both working and staged contents remain reachable, including when they differ at the same path. Inspect the original index through `<ref>^2`; cherry-picking the final working snapshot requires `-m 1`.

Both-chain runner tests cover collected child failure, differing staged/working versions, unrelated uncommitted files and rejected stale invocation. The rollback suite covers retry ancestry after an interrupted snapshot; existing undo-on-halt tests retain their first-parent checks.

## Amendment 4 — Configured run-branch identity (2026-11-16)

Both chains use the effective `isolation.branchPrefix` throughout setup, initialization, cleanup and resume. A standalone helper projects isolation policy by merging the shipped 10x policy, OpenSpec fragment and project override in router order. The default prefix is `agent-smith/`. Literal prefixes can omit the trailing slash, including `runs-`.

**GIVEN** active isolation **WHEN** fresh setup chooses a branch **THEN** it **MUST** concatenate the effective prefix and change id and validate the literal Git branch before selecting a mutation target, rejecting blank or non-string prefixes, option-like names and default-branch collisions.

**GIVEN** an isolated saved run **WHEN** setup or initialization continues it **THEN** it **MUST** validate the recorded id, normalized chain and branch against the selected run HEAD and effective policy, including before any executed step, and refuse a conflict with guidance naming the recorded branch and `isolation.branchPrefix`.

Saved invocation identity is checked first, followed by the established already-in-run case and exact configured-branch selection. Fallback registration discovery matches the same Git common directory, nested-project prefix, change id and chain, interpreting an absent saved chain as `10x`. Multiple remaining identities refuse with candidate branches and roots. Invoking setup from the intended run worktree selects its actual branch. The resolved branch lock covers revalidation, and the selected root is revalidated before success. These checks apply after source cleanup and at custom registered locations. An unattached saved branch is inspected before attachment.

**GIVEN** the original fresh setup result **WHEN** cleanup would unlink source inputs **THEN** it **MUST** require agreement among its branch, effective policy, registration, project prefix and router-owned metadata, retaining the existing immutable start-commit, tracking, byte, symlink and race checks.

The router owns `meta.json` and `run.jsonl`, and the saved format needs no added field. Worktree directories use `.claude/worktrees/agent-smith-<id>`. Router recovery refs use `refs/agent-smith/`. The strict boolean isolation opt-out precedes prefix-specific validation. Both skills report saved setup identity and publication identity in terminal diagnostics.

Deploy scripts and skills together. Existing default-prefix runs resume through their recorded identity. An older publisher can refuse a custom-prefix run after downgrade, so keep that run on a compatible revision or restore the fixed version. Roll back code with a new revert commit through the normal review process and retain run branches, worktrees and recovery refs.

## Amendment 5 — Run branch belongs to the change id (2026-11-20)

`validateRunBranch` accepted any branch under the prefix, so a run of change `foo` started in the worktree of run `bar` committed and rolled back on `bar`'s branch.

**GIVEN** a run without a saved identity of the change id **WHEN** setup or `init` validates the branch **THEN** it **MUST** accept only `<prefix><id>` and `<prefix><id>-baseline`, and refuse any other branch under the prefix with a message that names the change id being started and the id the branch belongs to, before any write.

**GIVEN** a saved identity (`meta.json` with the same id) **WHEN** its recorded branch is validated **THEN** it **MUST** start with `<prefix><id>`, so saved runs on other suffix branches resume. A recorded branch of another change is refused with the same message and without the `isolation.branchPrefix` recovery sentence.

Known limit: the name cannot tell the baseline branch of `foo` from the run branch of a change called `foo-baseline`, and a saved identity of `foo` on `agent-smith/foo-bar` still resumes. No branch is deleted and no history is rewritten to recover; the user leaves the other worktree and runs `prepare-run.mjs <id>` from the original project root.

## Amendment 6 — Retry an interrupted setup copy (2026-11-21)

Before Git registers a fresh worktree, setup writes a complete JSON intent to a temporary file and renames it to `agent-smith-setup-<encodeURIComponent(branch)>.pending` in the Git common directory. The intent records the original project root, expected worktree, project prefix, chain and starting commit. The full-branch setup lock protects the intent, registration, overlay and final worktree checks. Setup clears the intent after successful validation. After an interruption, inspect the lock's PID and confirm setup and its Git process have stopped before manually removing the lock. Keep the intent for the retry.

Rerun the same setup from the original project root after repairing the source. Setup verifies the invocation, registered worktree, Git common directory, branch and starting commit before applying the overlay. A completed retry reports `case: "reused"`, `copied: true` and `reason: null`, which keeps original inputs outside the post-init cleanup path. An ordinary resume reports `copied: false`. When router state exists in the destination, setup preserves it and requires a valid saved identity to resume. Ambiguous state, lost ownership or an unresolved copy error returns a bounded reason and `runRoot: null`. For a missing registered directory, inspect `git worktree prune --dry-run` before pruning.

Older failed copies have no intent and need inspection and manual restoration of missing inputs after any worktree edits are preserved. An older executable can treat an incomplete worktree as an ordinary resume. Finish pending copies before downgrading or using mixed versions on a branch.

## Amendment 7 — Prepare a fresh worktree for project gates (2026-11-22)

**GIVEN** setup is about to register a fresh isolated worktree **WHEN** Git can fetch and compare the selected integration tip **THEN** setup **MUST** stop before registration if the pinned start is behind and report the lag. A repository without a remote records a freshness skip. Registered pending retries keep the checked branch point. See [Run isolation](../REFERENCE.md#run-isolation) for remote selection, the `isolation.integrationBranch` override and timeout.

**GIVEN** a fresh copy has passed worktree validation **WHEN** setup is about to run the project gates **THEN** it **MUST** atomically save `copyComplete: true` in the same pending record. The branch lock covers the package manager and optional committed readiness command, including their process-group termination. Both skills stop before `init` on failure. The router continues to own its state files.

Setup installs supported lockfiles under the registered worktree, rejects unsafe dependency paths and requires installer artifacts to be ignored. The trusted project readiness command runs from the selected root and owns checks for project-specific prerequisites, including shared services. The project must also ignore generated hook artifacts before publication.

A gate failure preserves the worktree, copied inputs and pending record. Retry from the original project root after fixing the diagnostic. The retry verifies the registration and pinned start ancestry, reads the readiness command from the worktree's current committed policy and leaves copied inputs and edits in place. A gate-only retry reports `case: "reused"` and `copied: false`. Valid initialized identity still clears pending setup through the existing recovery path.

Existing pending records with no copy marker can finish through overlay recovery and the new gates. Initialized runs and worktrees without a pending record use ordinary resume. Finish copy-complete pending runs with this executable before downgrading, since older versions can repeat the overlay. After pending setup settles, a normal revert restores the prior setup behavior while preserving the run branches and worktrees.

## Amendment 8 — Read pending intent without locking and bound staging residue (2026-11-23)

**GIVEN** a linked checkout on a named branch **WHEN** setup checks for pending intent before opting out or selecting another branch **THEN** it **MUST** read the current branch’s canonical record without taking the branch lock. A valid record directs the caller to its original project root. Worktree selection, registration, copying, validation and project gates on the resolved branch retain their exclusive lock.

**GIVEN** a lock-free reader finds a regular record **WHEN** its payload read fails with `ENOENT` **THEN** the reader **MUST** treat the record as absent only if a second `lstat` confirms disappearance. If the entry remains, the second check fails, or the payload read reports a different error, setup retains the inspection diagnostic. Setup opens the record with `O_NOFOLLOW | O_NONBLOCK` and checks that the descriptor refers to a regular file before reading. Malformed, invalid and non-regular records require inspection. Reads under the resolved branch lock retain strict error handling.

**GIVEN** a writer holds the branch lock **WHEN** it publishes either the initial intent or the copy-complete record **THEN** it **MUST** stage the new record at `<canonical record>.tmp` before atomically renaming it. It unlinks a stale staging entry, including a symlink, before creating the staging file exclusively. A directory or failed unlink stops publication and preserves the canonical record.

Writers from both versions share the same branch lock, canonical path and record format. A retry that skips publication or uses the older UUID-based writer can leave the fixed temp behind. Legacy UUID staging files need manual cleanup. Before removing a stranded temp, verify that setup and its descendants have stopped. If the lock remains, inspect its recorded PID and leave the lock in place while removing the temp. If the lock is gone, prevent new setup on that branch during manual cleanup. Remove the temp by its exact path and keep the canonical record for recovery.

Finish any `copyComplete` recovery with a version that understands it (Amendment 7). Once pending setup settles, a normal revert restores locking during pre-selection and UUID staging while preserving run worktrees, branches and records.
