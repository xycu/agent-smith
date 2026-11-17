# Manual verification attempt

Manual verification ran on 2026-11-17 at candidate HEAD `cc3c7ae8f1caa8c2e2ad9a90918d43d1f2eb2773`. All three Manual rows remain pending. This attempt uses local inspection and a read-only inventory. It claims no native acceptance or published delivery.

## Reproduction

Run from the enclosing run root.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && node context/changes/first-unattended-delivery/evidence/script-manual-inventory.mjs
```

The command exited 0. Its retained output is `script-manual-inventory-output.txt`, with source in `script-manual-inventory.mjs`. The acceptance source, generated worktree, representative change identity and transcript directory are absent. The manifest has null installed/candidate acceptance revisions, committed configuration, native discovery, native guard and effective-hook observations. The acceptance ledger says “No attempt records exist yet.”

## Row 3.1

The plan requires “Fresh Claude discovers the pinned plugin/toolkit, delivers native guarded identity and a safe denial, and permits authorized work in the generated worktree with retained evidence.” Its detailed contract says “Guard payload fixtures alone leave native denial pending.”

The generated acceptance worktree is absent. The launch manifest leaves installation identity and native observations pending. `hooks/hooks.json` configures a synchronous Bash PreToolUse hook with `onFailure` set to `block`. `step-guard.mjs` checks native `agent_type` and `agent_id` before evaluating guarded commands. Reading these files establishes the intended contract. Native event delivery and authorized work still require the intended host execution. The launch preparation requires an independent clone, configuration commits and change creation before generated-worktree qualification. This step permits writes only to plan.md and evidence, and permits only read-only Git. Those preparation actions exceed this step’s scope. Existing synthetic tests cannot establish the full claim.

## Row 3.2

The plan requires “One fresh headless Claude-only normal-entry run completes the selected change through planning, plan review, implementation and approved implementation review with zero post-launch steering.” The acceptance record says “No attempt records exist yet.” The representative change source and transcript directory are absent.

The pipeline skill requires isolation/setup, router state updates, step execution and terminal publication. The normal-entry acceptance run therefore requires writes beyond this step’s evidence scope and local commits beyond its read-only Git allowance. Terminal publication is separately prohibited for step subagents. The installed-host run cannot be launched within these restrictions. Local contract tests cannot supply a completed zero-steering native attempt.

## Row 3.3

The plan requires “The representative run has a reviewable PR whose published head contains the completed README change and final artifacts, with terminal outcome, CI state and residual worktree state recorded accurately.” The acceptance record says “Both are pending” for the S-12 candidate PR and representative delivery PR.

The representative source/run project is absent and the record contains no representative PR identity or completed attempt. The enclosing branch’s HEAD/status in the inventory describes this verification context. It supplies no representative published-tree evidence. `open-pr.mjs` commits leftovers and performs `git push` before opening the PR. The step rules explicitly prohibit publication and invoking that script, including indirectly. Fake-client publication fixtures cannot establish the real representative PR claim. The top-level orchestrator must perform publication and retain its PR/head/CI/final-state observations before this row can pass.

## Scope and remaining proof

No covering local test proves any complete pending claim, so this attempt does not rerun the prior local readiness suites. No Manual checkbox changed. `unproven.md` lists all three pending rows. The pre-existing router-owned run-log modification remains owned by the router. This attempt writes only evidence files and makes no commits.
