# Check 1: skill reach from the run worktree

ADR-013 precondition 1. Pass criterion (plan Phase 1 item 1): a subagent whose working directory is `.claude/worktrees/agent-smith-openspec-pipeline` lists and can invoke `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`.

Observed on 2026-11-09 by the Phase 1 implementing subagent. Its primary working directory, as its environment block states, is `/Users/blazej/WebstormProjects/agent-smith/.claude/worktrees/agent-smith-openspec-pipeline` (a linked git worktree on `agent-smith/openspec-pipeline`).

## Skills the subagent sees

The `openspec-*` entries of the subagent's available-skills list, copied verbatim (entries without a description are listed by name only, as in the list):

```
- openspec-apply-change: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. Also use when the user says "openspec apply", "opsx apply", or "openspec implement".
- openspec-archive-change: Archive a completed OpenSpec change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. Also use when the user says "openspec archive" or "opsx archive".
- openspec-bulk-archive-change
- openspec-continue-change
- openspec-explore
- openspec-ff-change
- openspec-new-change
- openspec-onboard
- openspec-propose: Propose a new OpenSpec change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. Also use when the user says "openspec propose" or "opsx propose".
- openspec-sync-specs: Sync delta specs from an OpenSpec change to main specs. Use when the user wants to update main specs with changes from a delta spec, without archiving the change. Also use when the user says "openspec sync" or "opsx sync".
- openspec-update-change
- openspec-verify-change
```

The same list also holds the `opsx:*` commands (`opsx:apply`, `opsx:archive`, `opsx:propose`, `opsx:verify` and others). All three skills the chain needs (`openspec-propose`, `openspec-apply-change`, `openspec-verify-change`) are listed as invocable through the Skill tool.

## The worktree holds none of them

```
$ cd .claude/worktrees/agent-smith-openspec-pipeline && ls -a .claude
.
..
.cc-writes
settings.json

$ git ls-files .claude openspec        # run branch agent-smith/openspec-pipeline, HEAD 4fa61a3
.claude/settings.json

$ ls ~/.claude/skills | grep -i openspec
(no output, exit 1)                    # no user-level OpenSpec skill
```

## Where the skills resolve from

```
$ ls -a /Users/blazej/WebstormProjects/agent-smith/.claude/skills
.  ..  openspec-apply-change  openspec-archive-change  openspec-bulk-archive-change
openspec-continue-change  openspec-explore  openspec-ff-change  openspec-new-change
openspec-onboard  openspec-propose  openspec-sync-specs  openspec-update-change  openspec-verify-change

$ git worktree list
/Users/blazej/WebstormProjects/agent-smith                                                 dcf1988 [chore/track-openspec-skills]
/Users/blazej/WebstormProjects/agent-smith/.claude/worktrees/agent-smith-openspec-pipeline 4fa61a3 [agent-smith/openspec-pipeline]
/Users/blazej/WebstormProjects/agent-smith/.claude/worktrees/agent-smith-split-route-mjs   7a5b373 [agent-smith/split-route-mjs]
```

The skills exist only in the main checkout's `.claude/skills/`, and the subagent sees them. They therefore resolve from the session's project (the main checkout, where the orchestrator session was started), not from the files of the worktree the subagent works in.

## Tracking state (changed since planning)

The plan says the main checkout holds the OpenSpec skills and `openspec/` untracked. That is no longer so: the main checkout is on branch `chore/track-openspec-skills`, whose commit `dcf1988` ("chore(openspec): track the OpenSpec skills, commands and project config", 2026-11-09 04:20 +0100) tracks them.

```
$ git -C /Users/blazej/WebstormProjects/agent-smith ls-files .claude openspec
.claude/commands/opsx/{apply,archive,bulk-archive,continue,explore,ff,new,onboard,propose,sync,update,verify}.md
.claude/settings.json
.claude/skills/openspec-*/SKILL.md     (12 files, the twelve skills above)
openspec/changes/archive/.gitkeep
openspec/config.yaml
openspec/specs/.gitkeep

$ git merge-base --is-ancestor dcf1988 HEAD; echo $?     # from the run worktree
1                                                         # not in the run branch
$ git branch -a --contains dcf1988
+ chore/track-openspec-skills
  remotes/origin/chore/track-openspec-skills
```

The reach observed above does not depend on that commit: the run branch has neither the skills nor `openspec/`, and the subagent still lists them.

## Limits

- Invocation is not shown here. The live run of check 3 (`evidence/check-3-live.md`) adds the invocation evidence, because each of its probes runs one of these skills in a subagent.
- The reach depends on the session's project. A session started inside the worktree (for example a headless `claude -p` from the worktree) would see the worktree's files, which hold no OpenSpec skill until a commit that tracks them is part of the run branch. ADR-013 D3 already asks that `openspec/` and the OpenSpec skills be committed before a run.

Result: pass

The three skills are listed and invocable from a subagent whose working directory is the run worktree, and they resolve from the session's project. The invocation evidence follows in `check-3-live.md`.
