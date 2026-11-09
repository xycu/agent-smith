# Check 3, live: the OpenSpec skills run unattended with the decision guides

Date: 2026-11-09. OpenSpec CLI 1.16.1, Node v24.19.0. Model of every probe: `sonnet` (one mid-ladder model, as the plan allows: the probes test the guides, not the tier).

## Setup

A scratch OpenSpec project, made with `mktemp -d` at `/private/tmp/claude-501/os-live.OW18`:

```
mkdir -p openspec/specs openspec/changes/archive
printf 'schema: spec-driven\n' > openspec/config.yaml
printf '#!/bin/sh\necho "Hello"\n' > greet.sh; chmod +x greet.sh
git init -q; git add -A; git commit -qm init
openspec new change add-name-arg
openspec new change empty-probe
```

Both changes held only `.openspec.yaml` after `openspec new change`.

Each probe was one subagent launched by the implementing agent of this change (Agent tool, `general-purpose`, model `sonnet`), with the scratch directory as its working directory. After each step the implementing agent committed the scratch project (`step propose`, `step apply`, `step verify`), as the router's step commit would in an isolated run.

## Prompt composition

Each prompt was composed by hand from what Phase 2 wires, in this order:

1. A working-directory header in the form of `prompts/worktree.md`, naming `/private/tmp/claude-501/os-live.OW18` as the run root (two rules: paths inside the run root; `cd "<run root>" &&` before each shell command).
2. The template's lead line, with `{id}` and `{goal}` filled in:
   - os-propose: `Run /openspec-propose for the existing OpenSpec change add-name-arg (openspec/changes/add-name-arg/). Goal: Let greet.sh take an optional name argument and print "Hello, <name>" when it is given, keeping "Hello" without one.`
   - os-apply: `Run /openspec-apply-change for the OpenSpec change add-name-arg (openspec/changes/add-name-arg/). Implement every open task of tasks.md.`
   - os-verify: `Run /openspec-verify-change for the OpenSpec change add-name-arg (openspec/changes/add-name-arg/) and write openspec/changes/add-name-arg/agent-smith/verify.md.`
   - os-archive: `Archive the OpenSpec change add-name-arg with the OpenSpec CLI.`
   - negative os-propose: `Run /openspec-propose for the existing OpenSpec change empty-probe (openspec/changes/empty-probe/). Goal: ` (empty goal)
3. The full text of the guide file (`skills/10x-pipeline/prompts/os-propose.md`, `os-apply.md`, `os-verify.md`, `os-archive.md` as committed with this evidence), with `{id}` replaced by the change name.
4. `policy.json` `prompts.suffix`, unchanged (the unattended rules and the `RESULT:` line format).

## Probe 1: os-propose with a one-sentence goal

RESULT line:

```
RESULT: {"status":"done","note":"Wrote proposal.md, specs/greeting/spec.md, design.md and tasks.md (3 open rows) for add-name-arg; openspec validate passes.","assumptions":["Empty-string name prints plain Hello (greet.sh:2 is echo \"Hello\"; a trailing 'Hello, ' is not useful) - recorded in specs/greeting/spec.md and design.md","Extra args ignored, only $1 used (greet.sh has no option parsing) - recorded in spec scenario and design.md","printf '%s\\n' used for the named case so a name starting with '-' is not read as an echo option - design.md","no-name behavior also captured in new greeting spec because openspec/specs/ does not exist"]}
```

`ls -R openspec/changes/add-name-arg` after the step:

```
design.md
proposal.md
specs
tasks.md

openspec/changes/add-name-arg/specs:
greeting

openspec/changes/add-name-arg/specs/greeting:
spec.md
```

`tasks.md` held three open rows (`- [ ] 1.1`, `- [ ] 1.2`, `- [ ] 2.1`), each with a `Verify:` command. `git status` showed only `?? openspec/changes/`: no project code was touched, nothing was committed.

Questions observed: none. The subagent decided the open details (empty name, extra arguments, `printf`) from `greet.sh:2` and listed them as assumptions.

Criterion: ends `done`; predicate A holds (`proposal.md`, `specs/greeting/spec.md`, `tasks.md`; `design.md` too); no plain-text question. **Met.**

## Probe 2: os-apply

RESULT line:

```
RESULT: {"status":"done","note":"Ticked 1.1, 1.2 and 2.1; greet.sh prints 'Hello, <name>' via printf for a non-empty $1 else 'Hello', and every Verify command passes.","assumptions":["Used printf for both branches, not echo, so no-name output is the same bytes; design.md:'Use printf' prefers printf and spec.md 'No argument' requires Hello plus newline."]}
```

`ls -R openspec/changes/add-name-arg` after the step: unchanged file list (`design.md`, `proposal.md`, `specs/greeting/spec.md`, `tasks.md`). `grep -c '\- \[x\]' tasks.md` gave `3`, all three rows ticked. `git status --short`: ` M greet.sh`, ` M openspec/changes/add-name-arg/tasks.md`. The subagent reported `openspec instructions apply` at `state: "all_done"`, 3/3, and made no commit, no archive and no write under `openspec/specs/`.

Questions observed: none.

Criterion: ends `done`; every row of `tasks.md` is ticked. **Met.**

## Probe 3: os-verify

RESULT line:

```
RESULT: {"status":"done","note":"Verdict: PASS","assumptions":["No --store passed; project root found by nearest openspec/"]}
```

First lines of `openspec/changes/add-name-arg/agent-smith/verify.md`:

```
Verdict: PASS
Critical: 0
Warnings: 0

## Critical

## Warnings

## Verification Report: add-name-arg
```

`ls -R openspec/changes/add-name-arg` after the step adds `agent-smith/verify.md`; `git status --short` showed only `?? openspec/changes/add-name-arg/agent-smith/`, so the step was read-only apart from its verdict file. The report held one SUGGESTION (no automated tests for `greet.sh`), not counted, as the guide says.

Questions observed: none.

Criterion: ends `done`; `verify.md` has the three header lines and the two sections. **Met.**

## Probe 4: os-archive

RESULT line:

```
RESULT: {"status":"done","note":"archivedAs=2026-11-09-add-name-arg path=/private/tmp/claude-501/os-live.OW18/openspec/changes/archive/2026-11-09-add-name-arg","assumptions":[]}
```

The subagent ran `openspec archive add-name-arg --yes --json` once (exit 0, no warnings, `specsUpdated` with 2 requirements added) and committed `openspec/` as `chore(archive): close add-name-arg`.

`git log --oneline` of the scratch project after the step:

```
babf10a chore(archive): close add-name-arg
4bdd6fc step verify
3008edf step apply
0907136 step propose
e552651 init
```

`ls -R openspec` after the step:

```
changes
config.yaml
specs

openspec/changes:
archive
empty-probe

openspec/changes/archive:
2026-11-09-add-name-arg

openspec/changes/archive/2026-11-09-add-name-arg:
agent-smith
design.md
proposal.md
specs
tasks.md

openspec/changes/archive/2026-11-09-add-name-arg/agent-smith:
verify.md

openspec/changes/archive/2026-11-09-add-name-arg/specs:
greeting

openspec/changes/archive/2026-11-09-add-name-arg/specs/greeting:
spec.md

openspec/changes/empty-probe:

openspec/specs:
greeting

openspec/specs/greeting:
spec.md
```

`openspec/specs/greeting/spec.md` starts with `# greeting Specification` and `TBD - created by archiving change add-name-arg.`: the delta spec was merged. The `agent-smith/` folder moved with the change. `git status --short` was empty after the commit.

Questions observed: none.

Criterion: ends `done` with `archivedAs`; the change folder moved under `openspec/changes/archive/`; the spec merged into `openspec/specs/`. **Met.**

## Probe 5: negative, os-propose on an empty change with an empty goal

RESULT line:

```
RESULT: {"status":"blocked","note":"Goal is empty and openspec/changes/empty-probe/ holds only .openspec.yaml, so nothing describes the change; no artifact written.","assumptions":[],"signals":{"needsHuman":"Missing input: what empty-probe should build. Give a goal, or add a description (for example proposal.md) in openspec/changes/empty-probe/."}}
```

`ls -aR openspec/changes/empty-probe` after the step:

```
.
..
.openspec.yaml
```

Questions observed: none. No artifact, no `openspec new change`, no `openspec init`, no commit.

Criterion: ends `blocked` with `signals.needsHuman`. **Met.**

## Skill reach (adds to check 1)

Probes 1 to 3 were told to run `/openspec-propose`, `/openspec-apply-change` and `/openspec-verify-change` from a project that holds no `.claude/skills/`. Their output follows the skills' own text: the verify report in `verify.md` opens with the skill's line `Using change: add-name-arg (override: /opsx:verify <other>)`, and the apply step reports the skill's `openspec instructions apply` state. The skills resolved from the session's project (the agent-smith main checkout), as `check-1-skill-reach.md` recorded. This is the invocation evidence check 1 asked for. The transcripts of the probe subagents were not saved, so which tool call loaded each skill is not recorded here.

## Result

All five probes met their criteria on the first run; no guide was revised.

Result: pass
