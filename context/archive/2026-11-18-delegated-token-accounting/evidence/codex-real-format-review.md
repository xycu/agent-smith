# Codex 0.169.0 retained-record compatibility check

A model-free check passed the committed Phase 2 collector (26a524e4) actual `thread/read` and completed `thread/turns/list` results for three captured PR #214 invocations and all five children. All three runs were incorrectly marked `missing-identity`. For each native child, app-server `Thread.sessionId` equals that child's thread ID. The child's persisted `session_meta.session_id` and `token_usage_record.session_id`, by contrast, equal the primary thread's causal session ID. Parent IDs, fork IDs, terminal turns, and root turn IDs were consistent.

A scratch copy of the phase commit changed the app-server metadata validation from `meta.sessionId !== rootThreadId` to `meta.sessionId !== item.id` and retained the check of persisted causal session IDs against the primary root. It recovered the following exact values using the same app-server metadata and retained rollouts:

| PR #214 step | Threads | Distinct requests | Expected and recovered tokens |
| --- | ---: | ---: | ---: |
| plan-review | 2 | 24 | 1,997,884 |
| implement | 3 | 99 | 11,804,994 |
| impl-review | 3 | 67 | 5,080,419 |

Correct the session-field check in the production collector and make the fake app-server fixture mirror the observed host metadata while keeping causal fields in rollout records. Include a test refusing an unrelated app-server session ID and a test retaining refusal for incorrect persisted causal lineage. No live data or transcript bytes are included in this record. This establishes one real-format compatibility case for the corrected Codex path and does not qualify the final candidate across the planned host matrix.

[Reconstructed PR #214 report](https://github.com/xycu/agent-smith/pull/214#issuecomment-6935363565)
