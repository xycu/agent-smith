# Prompt handoff evidence and default decision

Decision: retain `prompts.byFile: false`. The opt-in reduces copied prompt bytes in synthetic fixtures. No live task-quality or end-to-end token benefit has been established.

## Reproduction and measurements

[Raw measurements](size-measurements.json) record the source revision, Node version, exact command, goal, ID, policy overrides, fixture defaults, UTF-8 root/ID lengths, retry metadata, complete pretty-printed stdout bytes, wrapper bytes and canonical task bytes. The source revision identifies the committed router implementation (Phase 1); the phase commit containing this evidence identifies the final measurement test source. Run from this worktree:

```sh
cd "/Users/blazej/.codex/worktrees/8584/agent-smith/.claude/worktrees/agent-smith-step-prompt-by-file" && TMPDIR="$PWD/.agent-smith-test-tmp" HANDOFF_MEASUREMENTS=context/changes/step-prompt-by-file/evidence/size-measurements.json node --test --test-name-pattern="actual emitted sizes" skills/10x-pipeline/test/prompt-handoff.test.mjs
```

These are actual router CLI outputs from synthetic scratch projects, not the planning estimates. The test uses a temporary `p/` directory in the checkout for a 99-byte real root, refuses a collision and removes only its own fixture. It does not launch agents. All 21 recorded dispatches succeeded; none were discarded.

| Fixture group | Complete action bytes | Wrapper bytes | Full task bytes |
| --- | ---: | ---: | ---: |
| 19 normal dispatches, root 99 bytes | 1,026–1,187 | 504–505 | 3,414–11,663 |
| Long root, 250 bytes | 1,406 | 655 | 3,414 |
| Same long root plus long reason and neutral retry | 2,142 | 655 | 3,414 |

Normal cases cover both chains, both providers, initial dispatch, neutral replay, next-step review/apply, native advisor and provider-specific manual verification. Every normal action is below the 1,280-byte ceiling. The 151 additional root bytes add 302 action bytes because the root appears in metadata and the wrapper. The synthetic 682-byte reason extension plus 54-byte retry metadata adds another 736 bytes. Nothing is truncated. Archives are excluded because they remain inline.

For example, the initial 10x task is 3,414 bytes and its wrapper is 504 bytes: 2,910 fewer prompt bytes copied per handoff. This is not a token count or billing estimate. The child still reads all 3,414 task bytes, and the router still stores the full pending task.

## Live comparison inventory

- Attempted matched live pairs: **0**. Completed pairs: **0**. Halted pairs: **0**. There are no JSON/Markdown compare outputs to attach.
- Claude/10x, Claude/OpenSpec, OpenAI/10x and OpenAI/OpenSpec live acceptance are all pending. This unattended subagent may not launch nested agents.
- Live step usage coverage: unavailable (no runs); orchestrator-session telemetry: unavailable. Fake Codex's fixed 110-token counter tests usage ownership only and is not performance evidence.
- Live failed attempts, neutral reruns, task/RESULT correctness and review quality: unknown. Passing synthetic lifecycle tests cannot replace those observations. In future comparisons, count neutral reruns separately: compare excludes them from failed attempts. Retain halted runs and incomplete usage, including their warnings.

For each future pair, keep the same change ID, goal, starting commit, plugin revision, host, provider/model ladder, rigor and inputs, changing only `prompts.byFile`. From an independent run root, save both outputs of:

```text
node <router> compare <id> --baseline <inline-root> --routed <file-root> --unpinned [--chain openspec]
node <router> compare <id> --baseline <inline-root> --routed <file-root> --unpinned --format md [--chain openspec]
```

Inspect outcome, usage coverage, failures, warnings and review correctness; separately capture evidence of complete file reads, correct RESULT handling, usage attribution and inline archives. At least five independent matched changes across the applicable chains/providers, with orchestrator telemetry and no observed task/RESULT/quality regression, are the provisional floor for reviewing a future default change, not a statistical guarantee. Missing evidence leaves the current false default in place.

## Automated proof and limits

The handoff suite exercises actual CLI dispatch/replay, policy validation, byte identity, provenance, redirects/collisions, publication and intake failures, cleanup retries, isolated commits/rollback snapshots, pre-archive cleanup, and fake Codex checks before and after permission preflight. Skill tests pin unchanged forwarding and router-owned cleanup.

Manual Progress rows 3.4 and 3.5 remain unchecked. An earlier child-authored commit can retain transient prompt content in history; a missing-result halt retains the pending task. This change does not rewrite history or alter the final PR helper's staging policy.
