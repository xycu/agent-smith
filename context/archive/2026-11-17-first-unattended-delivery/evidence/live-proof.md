# S-12 live proof of Manual rows 3.1 to 3.3

Appended 2026-11-22. This file and the `live-proof/` folder are new; no earlier evidence file is edited. They record the owner-decided live proof (2026-11-21) of the three Manual rows that PR #214 archived unproved. Candidate: `main` at `0680a16b4b7dc847ebe36f82506307e79852e362`, plugin 1.15.4, installed from the main checkout. Versions: claude 2.1.323, node v24.19.0, git 2.54.0 (Apple Git-157). The claude floors in `launch.md` (2.1.292, 2.1.295) are met.

## Setup

- Independent clone of the candidate under an ignored scratch directory outside any repository tree, origin `git@github.com:xycu/agent-smith.git`.
- Acceptance configuration commit `d8155cc3`: deleted only the `ladder` key from `context/foundation/agent-smith-policy.json` (sha256 `9721302c65bf407ad2400ebd06f08faaca3f757fd3b364fda234d1b0e6e18f1f` after the edit). `.claude/settings.json` already set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`. The effective ladder was eight rungs, all Claude.
- Change `claude-only-10x-example` created with `claude -p '/10x-new claude-only-10x-example'` (commit `27a0547f`), goal text added to Notes.
- Toolkit sha256, first 16 characters: `10x-new` 8bbe7d326e94571d, `10x-plan` 3beb283496edbd10, `10x-plan-review` f6522b54b17c9f3b, `10x-goal-implement` 9b59556fbb8c6d84, `10x-impl-review` c56679dbdfb77174.
- Details: [live-proof/prep.md](live-proof/prep.md).

## Row 3.1: proved, one gap

- A fresh headless child at the project root listed the skills and commands `agent-smith:10x-pipeline`, `10x-new`, `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`, and the agents `agent-smith:step` and `agent-smith:score`; plugin path `/Users/blazej/WebstormProjects/agent-smith`; permission mode `auto`.
- Safe denial, scratch repo: a native `agent-smith:step` child ran `git checkout -h`. The `PreToolUse:Bash` hook denied it before execution ("This stateless guard cannot prove preservation..."). The same child created a file with Write, ran `git add` and `git commit`; all were allowed. Scratch HEAD moved only by that authorized commit.
- Real run: four further `PreToolUse:Bash` denials (heredoc form), after which the agent used another route, and 11 chore commits plus the `docs` README commit `cd1a9abf` were made in the generated worktree.
- Gap: the hook is evidenced by its denial text, not by a recorded PreToolUse event. The raw transcripts are kept locally by the acceptance operator and are not in this repository.

## Row 3.2: proved, with two caveats

One launch, run 2026-11-21 22:28:51Z to 2026-11-22 00:27:15Z (1h58m), exit 0, no human input after launch. Command: the `launch.md` normal-entry command plus `--output-format stream-json --verbose`, added only to retain the transcript. Run host and provider mode: Claude, all six steps. Steps: score haiku/low, plan sonnet/high, plan-review sonnet/high (REVISE, 1 critical and 2 warnings, all applied), implement sonnet/medium, manual-verify sonnet/medium, impl-review sonnet/high. Terminal outcome `done - impl review APPROVED`, 0 critical and 0 warnings. Claude reported 47 turns and $7.06 list cost. Token figures for all six steps are unavailable (`missing-identity`). Reports: [report.md](live-proof/report.md), [impl-review.md](live-proof/impl-review.md), [run.jsonl](live-proof/run.jsonl).

Caveats:

1. Worktree setup failed inside the sandbox (`.git/worktrees` read-only). The orchestrator itself retried with the sandbox disabled and ran `git worktree add` by hand for the existing branch; later router calls also ran with the sandbox disabled. A human did not steer, but this is not the documented setup path.
2. impl-review's full suite rerun outside the sandbox did not finish. `helpers-env.test.mjs` (5 tests) fails inside the sandbox and passed outside.

## Row 3.3: proved

- PR: https://github.com/xycu/agent-smith/pull/266, open, not draft, base `main`, head `agent-smith/claude-only-10x-example`, published head `41991ee7b8674280d379d8c224d7e0c1d6211493`, equal to the local worktree HEAD; the worktree status is clean.
- Title `docs(claude-only-10x-example): Claude only 10x example` (no release).
- The published tree holds the README section "Restore the shipped Claude ladder", one sentence in `docs/REFERENCE.md`, three new tests in `skills/10x-pipeline/test/ladder.test.mjs` and the change artifacts. 14 files, 12 commits ahead of `main`.
- CI at 2026-11-22 00:34Z: all 7 `Tests and version check` shards, `Conventional PR title`, `Conventional Commits` and `semgrep-cloud-platform/scan` COMPLETED SUCCESS; merge state CLEAN.
- The PR also carries the two acceptance-only commits `d8155cc3` (removes the `ladder` key, -42 lines) and `27a0547f`. It is acceptance evidence and is not meant to be merged as is.
- Details: [live-proof/pr266.json](live-proof/pr266.json).
