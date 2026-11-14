# Claude compatibility review

- Date: 2026-11-14
- Range: `a506d63..d278704` (before OpenAI support through the crash-lock fix)
- Scope: Claude-only operation and preservation of Claude capabilities in both pipeline chains; source, packaging, generated dispatch and automated behavior.
- Findings: No actionable Claude regression identified. Live Claude model execution remains outside this review's proof.

## Preserved behavior

| Area | Evidence and conclusion |
| --- | --- |
| Default routing | All 23 existing non-prompt policy sections are deeply equal to the baseline, including ladder, steps, rigor, escalation, budgets, agents, advisor, isolation, archive and manual verification. The eight Claude model/effort positions are unchanged. The GPT overlay is opt-in. |
| Claude execution | Both skills retain `Agent`, `AskUserQuestion`, `Bash`, `Read` and `Write`. Claude actions still use native Agent with the routed agent type, model, effort, foreground setting and verbatim prompt. Claude-only dispatch has no Codex CLI, profile or authentication prerequisite. |
| Restricted agents and advisor | `agents/score.md` is unchanged. Restricted Claude scoring still dispatches `agent-smith:score`; advisor configuration and prompt injection remain. The new unsupported-capability refusal applies only to OpenAI targets. |
| Browser verification | The original Chrome and no-Chrome inline templates and shared manual guide remain. OpenAI's alternate template and narrower browser evidence rules are provider-specific. Baseline comparison confirms identical Claude manual-verification prompt bodies with Chrome both on and off. |
| Legacy runs | Missing host/provider fields resolve to Claude. Actual baseline-created runs resume with the current router on both chains. Neutral retries retain the exact historical prompt; failure retries retain the same model/effort escalation. Historical entries are readable without a forced rewrite. |
| Results and usage | Native RESULT parsing, unknown-result handling, usage notifications, late usage, anti-stall rules and child identity checks remain in both skills. Reports add a Provider column; comparison retains existing model/tier aggregates and its Claude/Sonnet/high baseline. |
| Isolation and archive | Worktree rules, rollback snapshots, step commits and archive safety checks remain. Claude archive actions still dispatch through Agent. The manual archive gate still uses `AskUserQuestion` under Claude and refuses without an affirmative answer. |
| Packaging | No tracked file was deleted. Marketplace metadata, restricted agent definition and baseline policy are unchanged. The plugin manifest only adds the explicit shared skills directory. Claude Code 2.1.311 accepts the plugin and marketplace manifests. |

## Removed or changed Claude-facing instructions

`TaskCreate`, `TaskUpdate` and `TaskList` were removed from both orchestrators. Their only pipeline responsibility was remembering the optional PR-comment request. That responsibility now belongs to router-owned `meta.json` and the terminal action's strict `prComment: true` field. Explicit skill invocations set true or reset false; missing legacy intent authorizes no comment. Tests cover both chains, resume/reset, done, halt and archive. The posting script and its error handling remain.

The common suffix replaces the Claude-specific statement that `AskUserQuestion` is unavailable with the equivalent unattended rule that no human answers questions. Evidence-based decisions, blocking when evidence is absent, RESULT output, deletion safeguards and the nested-agent ban remain. Host-native skill-loading instructions were added. Referenced executor prompts only gain host-portability instructions; the lesson prompt broadens its existing prohibition against invoking the lesson skill.

The shared lock still supports ordinary numeric router locks. Execution ownership applies to Codex children, including under a Claude host with an explicitly mixed ladder. `status --report` now takes the same lock as other mutations; plain `status` remains readable.

## Verification

- **Baseline differential: 16/16 passed.** Extracted the actual baseline plugin into a temporary directory, ran both routers against scratch projects, and compared action, step, model, effort, agent, reason, result path and retry fields. Cases: fresh lean/standard/thorough on both chains; upgrade resume, neutral retry and failure escalation on both chains; restricted score; advisor plan; Claude manual verification with Chrome on/off. Also asserted the Claude host/provider and absence of an OpenAI profile. Historical neutral prompts and the advisor/browser prompt bodies were compared byte-for-byte.
- **Policy preservation: passed.** All existing non-prompt sections match the baseline. Among existing inline prompt templates, only the shared suffix changed; `manual-verify-openai` is the added template. Referenced prompt-file changes were reviewed separately.
- **Native manifest validation: passed.** `claude plugin validate .` and `claude plugin validate .claude-plugin/plugin.json --json`, using Claude Code 2.1.311. The plugin manifest has zero errors and zero warnings. The separate catalog check reports a non-blocking missing icon; no icon was removed by this change. This validates manifests, not live skill discovery or model dispatch.
- **Full current test suite: passed.** `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node v24.19.0: 1,245 tests, 1,242 passed, 3 skipped, zero failures, 362,189 ms. Includes the unchanged legacy-loop, manual/browser verification, neutral-retry, archive-gate, isolation and OpenSpec behavior suites, plus restricted-agent, advisor and new provider/PR-intent tests. Reviewed changes to existing tests account for additive dispatch fields, the Provider report column and the replacement PR-intent mechanism.

Temporary differential script: `/tmp/agent-smith-claude-compat.mjs`. Results: `/tmp/agent-smith-claude-compat-differential.json`. Full-suite log: `/tmp/agent-smith-claude-compat-tests.log`. Scratch baseline and project directories were removed with the repository's `removeTree` helper.

## Limits

No live Claude model session, Claude-in-Chrome session, external PR/comment posting or mixed-provider live dispatch was launched. Those require native-host acceptance; passing source and CLI checks cannot establish that an installed session actually discovers upstream skills or honors all permission hooks. Existing manual acceptance rows 4.4–4.6 remain pending. Production source was not changed by this review.
