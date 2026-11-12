---
change_id: step-prompt-by-file
title: Hand the step prompt to the subagent by file instead of through the orchestrator
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: improvement.

### Problem

Every `run` output of the router carries the whole step prompt, and the orchestrator must copy it "verbatim" into the Agent call. Each prompt is therefore in the orchestrator's context twice: once in the router's output and once in the tool call.

Measured on the shipped `policy.json` (template with its guide file, plus `prompts/worktree.md` at 912 bytes and `prompts.suffix` at 2,134 bytes):

| Template | Bytes |
| --- | --- |
| `plan`, `implement`, `fix` | about 3,200 to 3,400 |
| `plan-review` | 5,366 |
| `impl-review` | 7,004 |
| `impl-review-confirm` | 8,563 |
| `os-propose` | 9,770 |
| `manual-verify` | 11,420 |

A `standard` run of 17 steps at about 6 KB each puts roughly 200 KB into the orchestrator's context for text it only passes on. That is context the orchestrator needs for its own rules, in a session that also holds a 41 KB skill.

The copy is also the one place where a language model transcribes a long text. The skill lists it as a fault class ("the prompt could not be passed whole, for example because it was cut", ADR-015), and nothing can check that the copy is exact: the router never sees what the subagent received. The router already keeps the prompt in `run.jsonl` as `pendingPrompt`.

### Fix direction

- Behind a policy key that is off at first (for example `prompts.byFile`): the router writes the prompt to a file in the run folder (`agent-smith/prompt.md`, replaced at each step) and returns `promptFile` plus a short `prompt`: read the file at its absolute path under the run root, follow it as the whole task, and finish with the `RESULT:` line. The short prompt repeats the `RESULT:` contract, because the orchestrator depends on it.
- The orchestrator then copies a few hundred bytes. The subagent pays one Read. The restricted `score` agent has Read.
- Keep the `archive` and `os-archive` prompts inline: nothing may be written into the folder that moves.
- The file must not reach a step commit stale: remove it when `next` consumes the result, as `last-result.json` is removed.
- A neutral rerun points at the same file again. Provenance is unchanged, since it hashes the templates and not the rendered prompt.
- Decide with data before making it the default: run a few changes each way and compare step failures and tokens with `compare`. The risk to measure is a subagent that skims a task it had to read from a file.

### Tests

- With the key on: `init` and `next` write the file, the `prompt` holds the path and the `RESULT:` contract, the file is gone after `next`, a neutral rerun restores it, and an isolated run commits no prompt file.
- With the key off: every existing test passes unchanged.
- Skill content checks for the wording of Loop step 2.

### Done when

With the key on, no `run` output is larger than about 1 KB, and the comparison data says whether the default should change.
