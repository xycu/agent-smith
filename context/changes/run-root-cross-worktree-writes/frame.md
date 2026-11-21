# Frame Brief: Writes into the run root refused in Claude desktop worktree sessions

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

In an isolated run, writes into the run root were refused (issue #243, agent-smith 1.15.0, Claude host):

1. The orchestrator session, started from a sibling worktree, could not write into the run root. `init` routed step 1, but no step subagent ran. The run was resumed from the main checkout as a neutral rerun.
2. A manual-verify step said the run root "may only write plan.md and evidence/". It could not install dependencies or add a symlink, so a paid eval row stayed unproven.

## Initial Framing (preserved)

- **User's stated cause or approach**: a `PreToolUse` Write hook refuses writes that cross worktrees.
- **User's proposed direction**: document which paths a step may write in the run root and make the hook's allowlist match; a refusal names the rule and the path; `init` records an actionable note or fails fast before step 1; the orchestrator's cross-worktree writes are allowed.
- **Pre-dispatch narrowing**: the owner believes both observations have one cause. Host surface: the Claude desktop app's Code tab. Evidence at hand: only the paraphrase in the issue and the run report.

## Dimension Map

1. **Plugin hooks**: `hooks/hooks.json` or the headless guard in `run-claude.mjs` refuses `Write`.
2. **User or project settings hooks**: a `PreToolUse` hook in `~/.claude/settings.json` or the target project's `.claude/settings*.json`.
3. **Host hook of the desktop app**: the app guards Write/Edit for worktree sessions and linked sessions. ← initial framing, if "a Write hook" means the host's
4. **Run-root placement**: `prepare-run.mjs` puts the run root at `<root>/.claude/worktrees/agent-smith-<id>`, where `<root>` is the checkout `prepare-run` ran from. The placement decides which host rule applies.
5. **Prompt rule**: a step prompt limits which files the step may write.
6. **Orchestrator fault handling**: a refused write of the result file leaves the step with no result and no early, named error.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Plugin hooks refuse Write | `hooks/hooks.json` registers `PreToolUse` for `Bash` only (`step-guard.mjs`); `claude-hook.mjs` runs on lifecycle events and acts only when the headless runner sets `AGENT_SMITH_CLAUDE_SESSION`. `run-claude.mjs` guards headless Claude children only (host `codex`), not the desktop orchestrator. | NONE |
| 2. Settings hooks refuse Write | The owner's `~/.claude/settings.json` has `PreToolUse`/`PermissionRequest`/`PostToolUse` hooks of a terminal integration that print `{}`; transcripts record them as `hook_success` on every Write. The target projects' settings were not read; no refusal text matches a settings hook. | NONE |
| 3. Host hook of the desktop app | Literal tool errors in the owner's session transcripts (life-to-lore, run `entry-limit-race`): (a) *"PreToolUse:Write hook error: This session is running in an isolated git worktree at `<repo>/.claude/worktrees/wave-1-…`, but `<repo>/.claude/worktrees/agent-smith-entry-limit-race/…/last-result.json` belongs to a different worktree. Do not write to other worktrees' files from this session."* (b) *"PreToolUse:Write hook error: `<repo>/.claude/worktrees/wave-1-…/.claude/worktrees/agent-smith-entry-limit-race/context/changes/entry-limit-race/research.md` is in this worktree's .claude folder, which holds the settings of the session that owns the worktree. This session only shares the worktree, so it can't edit them."* Message (b) hit both the step subagent (`research.md`) and the orchestrator (`last-result.json`). The archived reports of `2026-11-19-run-branch-must-match-change-id` and `2026-11-19-next-requires-isolated-init` record the same fault in this repository: "step agent blocked by linked-session write hook; run returned to owner session". The Claude Code docs describe no such rule (only the working-directory permission boundary and the optional `permissions.blockWritesOutsideWorkingDirectories`), so it belongs to the desktop app. | STRONG |
| 4. Run-root placement triggers the host rules | `prepare-run.mjs:302`, `:375`, `:496` fix the run root at `<root>/.claude/worktrees/agent-smith-<id>`. A session in its own app worktree that runs `prepare-run` from the main checkout gets a sibling worktree → message (a). A linked session that shares another session's worktree and runs `prepare-run` there gets a run root inside that worktree's `.claude/` folder → message (b). The owner session that runs `prepare-run` from its own worktree writes into its own `.claude/` folder, and the 2026-11-19 runs finished that way after being "returned to owner session". | STRONG |
| 5. Prompt rule limits manual-verify | `skills/10x-pipeline/prompts/manual-verify.md:28`: "GIVEN you write a file in the run root WHEN it is not plan.md and not under `context/changes/{id}/evidence/` THEN you MUST NOT write it." This is the wording of observation 2. No hook is involved. | STRONG (for observation 2 only) |
| 6. Fault handling hides the refusal | `SKILL.md:46` and `:71` make the orchestrator write the result file with Write; when the host refuses it, `next` halts with "Step N has no result" (seen in the linkedin-prm transcripts) or the orchestrator stops. Nothing before step 1 checks that the session can write into the run root. | WEAK as a cause, STRONG as the reason the fault is silent |

## Narrowing Signals

- Step 3 found the literal host messages, so no narrowing question was needed.
- The owner's belief "both observations, one cause" does not hold: observation 1 is the host hook; observation 2 is the prompt rule at `manual-verify.md:28`.
- The same transcripts show a third, separate refusal: the host's Bash sandbox blocks `.git/worktrees/<name>/index.lock` (`Operation not permitted`), so `git commit` in a run worktree needed a sandbox bypass. That belongs to `codex-profile-and-gitdir-access` (gitdir write access), not to this change.

## Cross-System Convention

A host that isolates sessions in worktrees keeps each session's writes inside its own worktree and keeps `.claude/` as the owning session's settings folder. A plugin that creates a second worktree under `.claude/worktrees/` and then writes there from a session that does not own it works against both rules. The convention is to run where the host allows writes, or to detect the case and stop before work starts with one named error.

## Reframed Problem Statement

> **The actual problem to plan around is**: the run root that `prepare-run` places at `<root>/.claude/worktrees/agent-smith-<id>` is not writable from a Claude desktop session that does not own it. The desktop app's own `PreToolUse:Write` hook refuses the write, and nothing before step 1 detects this, so the run stalls with no named error.

The refusing hook is the host's, not the plugin's, so there is no plugin allowlist to widen. The plan must choose where the run root lives, or when `prepare-run`/`init` refuse to start, given the two host rules: no writes into another worktree from an isolated session, and no writes under a shared worktree's `.claude/` folder from a linked session. The manual-verify write limit is a separate, deliberate prompt rule. Whether a step may install dependencies or add a symlink in the run root belongs with `run-root-worktree-readiness` (#244), which prepares the run root before step 1.

## Confidence

**HIGH**: literal host error text from two sessions, the same fault recorded in two archived reports of this repository, the plugin and settings hooks excluded by reading them, and the inverse case (the owner session) completing.

## What Changes for /10x-plan

- Plan around the host's rules, not a plugin hook. Candidates to compare: run-root placement, a preflight in `prepare-run` or `init` that names the host rule and the session that can run the change, and the orchestrator text in both `SKILL.md` files. Changing the host hook is out of reach.
- Keep observation 2 out of this change; hand the manual-verify write limit to `run-root-worktree-readiness` or its own change.
- The fix lands in setup (`prepare-run.mjs` and/or `init`), so it shares the Setup lane with `run-root-worktree-readiness` and `prepare-run-setup-lock-and-residue-followups`.
- A Manual row must reproduce both host messages in the desktop app (an isolated worktree session and a linked session) and show the new behavior.

## References

- `hooks/hooks.json`; `skills/10x-pipeline/scripts/claude-hook.mjs:1`; `skills/10x-pipeline/scripts/run-claude.mjs`
- `skills/10x-pipeline/scripts/prepare-run.mjs:302`, `:375`, `:496`
- `skills/10x-pipeline/SKILL.md:46`, `:71`
- `skills/10x-pipeline/prompts/manual-verify.md:28`
- `context/archive/2026-11-19-run-branch-must-match-change-id/agent-smith/report.md` ("Neutral reruns"); `context/archive/2026-11-19-next-requires-isolated-init/agent-smith/report.md` ("Neutral reruns")
- Claude Code docs: permissions (working directories, `blockWritesOutsideWorkingDirectories`), sandboxing, desktop, worktrees
- Issue #243
