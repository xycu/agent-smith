---
name: 10x-pipeline
description: >
  Run a change end to end (plan, plan review, implement, implementation review, fix)
  with each step in its own subagent. A bundled router picks the next step and its
  model and effort from the previous results: review verdicts, finding counts,
  plan size, failed attempts. Use when the user wants an orchestrated or adaptive
  10x run, "run the whole chain", "pipeline this change", or dynamic model routing.
argument-hint: <change-id> [goal text]
allowed-tools:
  - Agent
  - Bash
  - Read
  - Write
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# 10x Pipeline

You are the orchestrator. You do not plan, implement or review yourself. You do not pick models or effort levels. The router script decides every step; you execute what it returns.

Router: `ROUTER=<this skill's base directory>/scripts/route.mjs`. Run it with `node` from the project root.

## Start

1. Parse the arguments: `<change-id>` (required, kebab-case), and optional goal text.
2. If `context/changes/<change-id>/change.md` is missing, tell the user to run `/10x-new <change-id>` and STOP. If the 10x skills (`10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`) are not available in this project, tell the user to install the 10x toolkit first and STOP.
3. Run `node $ROUTER init <change-id> --goal "<goal text>"`. Quote the goal safely for the shell. Re-running `init` on a change with an existing log resumes it: the router reads the disk state and continues from there. Add `--rigor <level>` only when the user named a rigor level (`lean`, `standard` or `thorough`). Never pick one yourself. On a resume the flag can only raise the level.

## Loop

The router prints one JSON object. Act on `action`:

- **`run`** (the router may have skipped a step before this answer, for example plan review for a `lean` change. It logs the skip with its reason. You do nothing for a skipped step.)
  1. Print one line: `Step <n>: <step> on <model>/<effort>. <reason>`.
  2. Call the Agent tool with `subagent_type: general-purpose`, `model: <model>`, `effort: <effort>`, `run_in_background: false`, and `prompt` set to the router's `prompt`, copied verbatim.
  3. Find the last line of the subagent's reply that starts with `RESULT:`. Parse the JSON after it. If there is none, or it does not parse, use `{"status":"unknown","note":"no RESULT line"}`. Keep every key of the JSON as it is, including the optional `signals` object. Copy it untouched. The router validates it.
  4. If the Agent result reports usage (total tokens, tool uses and duration), add `"usage":{"totalTokens":N,"toolUses":N,"durationMs":N}` to that JSON, with the figures copied exactly. Omit the key when no figure is reported. Write the JSON to the router's `resultFile` with the Write tool.
  5. Run `node $ROUTER next <change-id>` and repeat the loop with its output.
- **`done`**: report the final verdict, the number of steps, and every entry in `manualPending` as a checklist for the human. Then run `node $ROUTER status <change-id>` and show the model/effort used per step as a short list. Point the user to the router's `report` path (`report.md`).
- **`halt`**: report `reason` and the status output. A reason that says `needs a human` comes from the subagent, which found no evidence-backed answer. Show the quoted text. Point the user to the router's `report` path (`report.md`) when present. STOP. Do not try to recover on your own.

## Rules

- Never choose or change `model` or `effort`. Never edit the prompt the router returns.
- Never skip the router, call two steps without it, or run a step it did not return.
- Never edit `context/changes/<change-id>/agent-smith/run.jsonl` or `meta.json` next to it. The router owns them.
- Do not read the subagent's work in detail. The router reads the artifacts on disk and verifies them.
- If the user interrupts and asks to change routing, point them to the policy (below). Do not hand-tune a single run.

## Tuning

Routing lives in data, not in this file:

- `<this skill's base directory>/policy.json` holds the defaults: the model/effort ladder, the base tier per step, escalation and de-escalation rules, retry caps, and prompt templates.
- A project can override any key in `context/foundation/agent-smith-policy.json`. The router deep-merges it over the defaults. Arrays such as `ladder` are replaced whole.

How the tier moves (see `scripts/route.mjs`, `tierFor` and `decide`):

- Rigor level: every run has one level (`lean`, `standard` or `thorough`), stored in `meta.json` and kept on resume. It starts from the goal class (or `--rigor`) and only rises: with the phase count (`rigor.fromPhases`), with failed steps (`rigor.fromFailures`), when the plan or the diff touches a hot path (`risk`), and when a result carries `signals.rigor`.
- Hot paths are paths that change often in the repository history, measured up to the commit the run started from. A change that touches one never stays at the lowest level. When the history is missing, too short or unreadable, the router flags nothing and records that risk was not measured. The `risk` command prints the numbers.
- The lowest level skips plan review before implementation starts, but only when risk was measured and the plan names at least one path. The router writes a skip entry to `run.jsonl` with the reason, and `report.md` lists it. A skip uses no step budget. Implementation review is never skipped.
- The step budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` for the level.
- Effort floor: plan, plan review and implementation review ask questions, so the router never runs them below the floor in `rigor.minEffort` for the level. The floor is applied last, so it wins over the simple-change discount. The report marks a step as simple only when the discount survived the floor.
- The lowest level also moves implementation review one tier down (`rigor.tierOffset`), never below the floor.

- Plan size: +1 tier per `phaseThresholds` entry reached by the phase count in `## Progress`.
- First plan, from the goal text (changes relative to the plan step's base): a short goal (at most `firstPlan.maxWords` words, no hard keyword) = -1 plus the simple-change discount. A goal with a hard keyword from `firstPlan.hardKeywords` = no reduction, whatever its length. Any other goal, including an empty one = -1.
- A simple change (at most 1 phase and 6 `## Progress` rows) = -1 on plan review, implement and implementation review. The step's `minTier` can absorb the discount, for example implement after a clean `SOUND` review. The discount is withheld after any failed step, so the first retry of a discounted step moves up 2 tiers (the lost discount plus the failure).
- Plan review `RETHINK` = re-plan at +2. `REVISE` with criticals or too many warnings = re-plan at +1.
- A noisy plan review (3+ warnings) = implement at +1. A clean `SOUND` = implement at -1.
- Each failed or unverified attempt of the same step = +1, capped by `maxAttemptsPerStep`.
- Impl review after retries or fixes = reviewer at +1.
- Impl review `REJECTED` = fix at the last code tier +1. `NEEDS ATTENTION` = fix at the last code tier.
- A step counts as failed when its reported status is not `done`, or the expected artifact did not change: `plan.md` with `## Progress`, a review file with a verdict, or new checked Automated rows.
