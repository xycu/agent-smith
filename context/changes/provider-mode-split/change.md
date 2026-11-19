---
change_id: provider-mode-split
title: Select a Claude, Codex or split provider mode for a run
status: implemented
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Wave 1 run on 2026-11-19. Every step ran on OpenAI because the project override `context/foundation/agent-smith-policy.json` holds an OpenAI-only ladder. Nothing in the router picks a provider per step, so a user cannot say "plan and implement on the other tool".

**Wanted.** One run mode, chosen by the user, with three values:

1. **Full Claude Code.** Every step runs on Claude.
2. **Full Codex.** Every step runs on OpenAI through `run-codex.mjs`.
3. **Split.** The tool that hosts the session does most steps. The other tool does only `plan` and `implement`.
   - Hosted in Claude Code: most steps run on Claude; `plan` and `implement` run on Codex.
   - Hosted in Codex: most steps run on Codex; `plan` and `implement` run on Claude Code.

**What exists today.** Each ladder rung can set `provider` to `claude` or `openai`, and a rung is chosen by complexity tier, not by step. A Claude host accepts a mixed ladder. A Codex host requires an OpenAI-only ladder (ADR-024), so the second half of mode 3 needs a Claude dispatch from a Codex host, which the router refuses now.

**Open questions for framing.**

- Do `fix` and `plan-review` follow `plan` and `implement`, or stay on the host tool?
- Does the mode live in `init`, in the project policy file, or both?
- Can a Codex host dispatch a Claude step at all, and through what boundary?
