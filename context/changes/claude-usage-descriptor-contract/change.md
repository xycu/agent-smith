---
change_id: claude-usage-descriptor-contract
title: Claude token counts lost because orchestrators send a malformed usage descriptor
status: impl_reviewed
created: 2026-11-25
updated: 2026-11-25
archived_at: null
---

## Notes

Observed in project linkedin-prm, 2026-11-25, plugin 1.18.2 (contains the `claude-usage-host-version-mismatch` fix, PR #298), Claude Desktop host 2.1.330, `--provider-mode split`. In all 10 active runs (anonymous-search-cards-doc, capture-location-doc, inbox-diff-path-arg, inbox-thread-parser-mismatch, invite-card-english-label, keyword-first-search-default, people-silver-one-command, rank-invite-candidates-by-fit, refuse-empty-search-capture, welcome-notes-not-invited-only), every native Claude step (score, plan-review, manual-verify, impl-review) is logged with no `usage`. Five runs carry `usageEvidence: unavailable / missing-identity` without an invocation, and the other five carry no `usageEvidence` at all (see `frame.md`). Every Codex step has verified `codex-rollout` evidence. The transcripts are intact: run with a correct descriptor, the collector now returns `status: transcript`, e.g. 203,681 tokens for step 1 score of `invite-card-english-label` (orchestrator session `0a70f36c`), 325,516 for step 1 of `inbox-thread-parser-mismatch` (session `39b8c516`).

Defects found in the orchestrator transcripts (`~/.claude/projects/-Users-blazej-WebstormProjects-linkedin-prm/*.jsonl`):

1. **The descriptor shape is never stated.** Loop step 4 of `skills/10x-pipeline/SKILL.md` (line 97) says "Pass `claudeCaptureMode` as `mode`, router identity, returned agent ID and other observed IDs". It does not give the keys. Sessions `6a1c1084`, `f8df4d0a` and `e8e67f73` sent a flat object (`{"mode":"transcript","change":…,"n":…,"step":…,"agentId":…,"sessionId":…,"runId":…}`) instead of `{"mode","router":{"change","chain","n","step"},"invocation":{"host","sessionId","agentId","runId"}}`. Every call returned `unavailable / missing-identity`, and the orchestrator proceeded without evidence, as the skill allows. Check the same wording in `skills/openspec-pipeline/SKILL.md`.
2. **Some orchestrators never call the collector.** Sessions `38639f23` (people-silver-one-command), `4450d2ef` (rank-invite-candidates-by-fit) and `5ba52561` (capture-location-doc) ran 4, 5 and 2 Agent steps with 0 collector calls. Nothing in the router notices a Claude step result with neither `usage` nor `usageEvidence`.
3. **Malformed input gets a misleading reason.** `main()` in `skills/10x-pipeline/scripts/claude-usage.mjs` (around line 400) catches a JSON parse error and reports `unsupported-schema` with `source: "claude-native"`, even when the intended mode was transcript. Seen in sessions `0a70f36c` and `e8e67f73`, where a zsh loop (`set -- $t` does not split words) produced invalid JSON.
4. **No recovery once the step is logged without evidence.** Session `39b8c516` later got correct transcript totals, but `usage --usage-file` refused them ("Structured usage must match the recorded host invocation and step exactly", `route.mjs` around line 892), because the step record holds no invocation. Only numeric `usage <id> <n> --tokens N` remains, which drops the transcript evidence.

Direction to weigh in planning: make the contract hard to get wrong rather than only rewording it. For example, the collector takes the router fields from the run state (it knows change, chain and n) and the orchestrator passes only `--agent-id`/`--run-id` flags, or the router records the step's Claude invocation identity so late attachment can work. Defect 2 may need `next` to refuse or warn on a host-`claude` step result that has no usage evidence.

Backfill of the 10 linkedin-prm runs is follow-up work once the fix lands (collector per step, then `usage` attach).
