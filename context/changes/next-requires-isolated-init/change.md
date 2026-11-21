---
change_id: next-requires-isolated-init
title: Make next refuse a run that init would refuse for missing isolation
status: implemented
created: 2026-11-19
updated: 2026-11-21
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 6 (should fix). Reproduced twice through the router CLI in scratch repositories.

**The defect.** Run isolation (`isolation.require`, shipped `true`) is checked only in `init`: `skills/10x-pipeline/scripts/route.mjs:1075-1078` calls `isolationCheck` before anything is written. The `next` command (`route.mjs:83-121`) has no such check. It reads `meta.json` with the fallback `{ id, goal: "" }` (line 90) and writes it when anything changed (line 121).

**Reproduced case.** Main checkout on `main`, default policy, a change folder with `change.md`, no `meta.json`:

- `init demo --goal "add a small thing"` halts: "Run isolation needs a linked git worktree on a run branch ... Nothing was written."
- `next demo` in the same place returns `"action": "run"`, `"n": 1`, `"step": "score"`, with `root` set to the main checkout.
- `meta.json` afterwards is `{ "id": "demo", "goal": "", "rigor": { "level": "standard", "by": "goal plain" } }`: no `isolated`, no `branch`, no `baseSha`, no `provenance`, no `host`.
- A second `next` after a result file continues with `n: 2`. `git branch --show-current` prints `main`.

**Why it matters.** The steps then run on the default branch with an empty goal, without step commits and without the rollback snapshot that ADR-010 relies on. One skipped `init` (an orchestrator that resumes from the wrong place, or a person who types `next`) is enough. No test or document covers `next` before `init`.

**Direction (for the plan to confirm).** In `next()`, halt when `isolationOn(policy)` is true and `meta.isolated !== true`, with a message that tells the caller to run `init` first and says that nothing was written. Projects that turn isolation off keep today's behavior, so the many tests that use `{ "isolation": { "require": false } }` are not affected. The plan also decides whether `next` without any `meta.json` should halt even when isolation is off, because the run then has no goal.

**Constraints.**
- `route.mjs` and the modules it imports own `meta.json` and `run.jsonl`; the check belongs there, not in a skill file.
- A resumed isolated run must still pass: `meta.isolated` is set at the first `init` and stays.
- `docs/REFERENCE.md` gets one line under the `next` command.

**Done when.**
- A test: with the default policy and no `meta.json`, `next <id>` halts, writes nothing, and names `init`.
- A test: an isolated run that was started by `init` still advances with `next`.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
