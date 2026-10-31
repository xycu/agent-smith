# Baseline Usage Comparison — Plan Brief

> Full plan: `context/changes/baseline-usage-comparison/plan.md`
> Research: `context/changes/baseline-usage-comparison/research.md`
> Revised after plan review (REVISE, F1-F10 all accepted): see "Review response" in the plan.

## What & Why

Roadmap S-06 (FR-009): a user can compare the total usage of a routed run with a baseline run of the same change, where the baseline is a full run with every step on `sonnet` at `high` effort. The PRD's primary success criterion is a usage drop measured by exactly this A/B comparison, and nothing in the router reads two runs today.

## Starting Point

Each step's usage (`totalTokens`, `toolUses`, `durationMs`) is already optional in `run.jsonl`, and `report.md` sums it for one run. Run state is one folder per change id per checkout, and a second `init` resumes the first run. A 7-entry `sonnet/high` ladder in the override file already makes a run use `sonnet/high` for every step. Whether a real Agent result reports usage is not yet confirmed.

## Desired End State

A shipped `baseline-policy.json` defines the baseline arm (all tiers `sonnet`/`high`, rigor `standard`, plan review never skipped, no flag needed). `route.mjs compare <id> --baseline <dir>` prints, for one routed/baseline pair, the token totals with coverage, a check that the baseline really ran pinned, whether the pair is comparable, the observed drop and a verdict. It writes nothing. The README explains how to set up the baseline checkout. A real Agent result has been shown to carry usage before Phase 2 starts, and one real pair has been run and recorded.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| How to request a baseline | Shipped override file, no `init` flag | Zero edits to routing code that S-05 and S-07 also touch | Research |
| Fixing the rigor level | `rigor.fromGoal` all `standard` and `skipPlanReviewAt: []` in the baseline file | SKILL.md parses no `--rigor`; a short goal would start `lean` and skip plan review | Review F2 |
| Keeping two runs apart | Second checkout from `meta.baseSha`, copy of every input file (`change.md`, `research.md`, `frame.md`), never produced files | Run state is per checkout; same inputs on both sides; `compare` warns on differing input names | Research, review F4 |
| Success threshold | `compare.targetDropPercent: null`, verdict `target not set` | The PRD gives no number and none is invented (O1) | Research |
| Unit | Raw `totalTokens`, per-model raw sums, no weights | No token-to-limit mapping exists in the repo (O2) | Research |
| Comparability | Both runs `done`, every executed step has a valid token figure, every executed baseline step `sonnet/high`; skips only warn | Partial sums or dropped failures bias the drop; S-07 will log skips | Plan, review F1 |
| Noise | One pair, observed drop only, no significance claim | Dozens of runs cannot support one (ADR-001) | Research |
| Output | stdout JSON, `--format md`; no `--out`, no `report.md` | Writes nothing, so it is safe after the routed run was archived | Plan |
| `met` boundary | Integer test `diff*100 >= target*baseline`, target in 0 to 100 or `null` | "Drops by at least"; float math fails an exact 29 % | Plan, review F5 |
| Archived runs | Look in `context/archive/<date>-<id>/agent-smith/`; no `report.md` fallback | `report.md` table is lossy; `git mv` keeps `run.jsonl`, proven by a hermetic test | Plan, review F7 |
| Pairing keys | `meta.goal` and `meta.baseSha`; mismatch is a warning | Numbers stay visible | Plan |

## Scope

**In scope:** `baseline-policy.json`, `compare` policy key, `compare` command (JSON and Markdown), usage-intake tests, `compare.test.mjs`, README block, AGENTS.md lists, ADR-005, evidence note and three manual rows (alias, usage spike, real pair).

**Out of scope:** `init --baseline`, any change to `decide`, `tierFor`, `next`, `buildReport`, prompts or `SKILL.md`; threshold value, weights, significance tests, aggregate mode; orchestrator-session tokens; writing files; roadmap status flip (left to the merge to avoid conflicts with S-05 and S-07).

## Architecture / Approach

The baseline arm is data; the comparison is one read-only command in its own block of `route.mjs`, after `riskCommand`. `compare` finds `run.jsonl` on each side (folder, `context/changes/<id>/agent-smith/`, or one archive folder), sums executed entries, verifies the pin from the log and applies the comparability rules. Edits to shared files are one dispatch branch (placed last), one usage-string edit, one policy block between `limits` and `archive`, and one README block after "Usage report".

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baseline arm, policy key, guard tests and usage spike | `baseline-policy.json`, `compare` policy block, tests that fail without the file, usage intake tests, one-step live usage check | Real Agent results may carry no usage: the spike stops the work before Phase 2 |
| 2. `compare` command (JSON) | Read-only command, all rule tests, `git mv` archive test, router-made-log case | Edit overlap with S-07 in `main`; kept to two one-line edits |
| 3. Markdown output, docs and real-pair evidence | `--format md`, README, AGENTS.md, ADR-005, one real pair | Real runs cost tokens |

**Prerequisites:** S-01 and S-02 are done. Node 18+, git for the manual runs.
**Estimated effort:** about 3 sessions across 3 phases, plus a manual real pair.

## Open Risks & Assumptions

- A1: `sonnet` alias is read as Sonnet-5.5; the repo does not record the resolved version (row 1.5).
- A7: the baseline includes whatever optional steps S-07 adds at `standard` (O6).
- Foreground Agent usage is unconfirmed (row 1.7, now before Phase 2); without it every pair is `not comparable`, and the default is to stop and hand the owner two options.
- Raw tokens are a proxy for the weekly limit (understates `haiku` savings, overstates a drop bought with `opus`).
- Owner questions with defaults applied: O1 threshold, O2 weights, O3 sample size and aggregate mode, O5 orchestrator tokens, O6 baseline scope.

## Success Criteria (Summary)

- A scratch pair with known token totals yields the expected drop (including the exact-boundary case), and each incomplete, unpinned, halted or mismatched case yields the specified reasons or warnings.
- The baseline file changes the first step and the plan-review skip compared with the default policy, with no flag.
- The command writes nothing and the full suite passes on Node 18.
- One real routed run and one real baseline run have been compared, and the real shape of usage figures is recorded.
