# Frame Brief: Ship an opt-in capture hook for Claude token figures

> Owner decision record before /10x-plan. It answers the questions in
> `change.md`; the questions that the decision leaves open go to the plan.

## Reported Observation

Since 1.14.0 a default install records `usageEvidence.status: "unavailable"` and no `totalTokens` for every Claude step. `claude-usage.mjs` returns `verified` evidence only on host version `CLAUDE_USAGE_VERSION = "2.1.311"` exactly, and only from a hook-capture JSONL file and an OTLP log that the operator supplies. `compare` adds `usage-incomplete:<side>` (`route.mjs:572`) and gives no verdict for a Claude-hosted run.

## Owner Decision (2026-11-21)

**The plugin ships a capture hook that the user opts into.** With the hook on, Claude steps get `verified` figures. With it off, the behavior stays as it is today. The options "keep verified-only and only explain" and "report a labelled `legacy` figure by default" were offered and not chosen.

Answers to the questions in `change.md`:

1. **No figures by default** stays the default, because the plugin enables no capture or telemetry without an explicit user choice. It is no longer the only state: the user can turn capture on.
2. **Source:** a capture hook that the plugin ships and the user opts into. A final-request footprint (`<subagent_tokens>`) is still never reported as a whole-step total.
3. **`compare` with lower-trust figures:** not decided by the owner. Default for the plan: `compare` keeps refusing a verdict when a side lacks verified figures, because the chosen path produces verified figures. The plan may propose otherwise and must say why.
4. **Version check:** not decided by the owner. The plan proposes either a qualified range or a qualification step per Claude Code release, and names who qualifies a release. A capture that breaks on the next host release does not meet this decision.

## What the plan must cover

- The opt-in surface: how the user turns capture on and off, and where that choice is stored. The plan states that nothing is captured before the user opts in.
- The hook itself. `hooks/hooks.json` already registers `claude-hook.mjs` on `SessionStart`, `SubagentStart`, `SubagentStop` and `Stop`, but that hook acts only when the headless runner sets `AGENT_SMITH_CLAUDE_SESSION`. The plan decides whether capture extends that hook or adds a new one. A change to either file changes `guardRevision` in `claude-hook.mjs`.
- `claude-usage.mjs`: read what the shipped hook writes, keep the provenance checks, and handle question 4.
- The loop text in both `SKILL.md` files (equal `## Anti-stall rules` sections; raise the size ceiling in `skill-loop.test.mjs` in the same commit if the text grows).
- `docs/REFERENCE.md`, the README coverage paragraph (`README.md:142`, `:146`) and amendments to ADR-018 and ADR-019.
- Tests for each reader of the evidence: `status --report`, the run report, `compare`.
- With capture off, the report and `compare` say in one line why the figure is missing and how to turn capture on.
- A Manual row: one full pipeline run on Claude models with capture on. It also closes the Claude qualification that `README.md:142` lists as pending.

## Effect on other changes

- `first-attempt-drop-unmeasured` (owner chose to measure) needs this change for Claude pairs.
- `usage-capture-preflight` warns before step 1 when capture cannot work; its plan builds on the opt-in state this change adds.
