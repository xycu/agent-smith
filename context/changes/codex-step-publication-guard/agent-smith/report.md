# Run report: codex-step-publication-guard

Goal: Stop Codex steps from pushing, publishing or reading GitHub tokens: move git push and the publishing gh forms (pr, api, release, repo) out of the blanket allow in .codex/rules/project.rules, spawn the codex child in run-codex.mjs with an environment that holds no GH_TOKEN, GITHUB_TOKEN or enterprise GitHub tokens, test both, and state in docs/REFERENCE.md what the Codex host enforces and what it cannot.
Rigor: thorough (hot paths skills/10x-pipeline/scripts/run-codex.mjs, skills/10x-pipeline/test/codex-helpers.mjs, skills/10x-pipeline/test/codex-runner.test.mjs)
Provider mode: claude
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (aa551be) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (579a953) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (e8b60a9) | - |
| 4 | implement | claude | sonnet | high | 3 | no | ok (b6e8f8a) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (4adf915) | - |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (49a3a8b) | - |
| 7 | impl-review | claude | opus | high | 5 | no | failed | - |
| 8 | impl-review | claude | opus | xhigh | 6 | no | ok (2e8ef4b) | - |

Steps: 8 · Tokens: - (figures for 0 of 8 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 8 · Legacy/unverified scope: 0 · Missing figures: 8
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 plan-review: missing-source — The required host usage source is unavailable.
- Step 4 implement: missing-source — The required host usage source is unavailable.
- Step 5 manual-verify: missing-identity — The host invocation cannot be attributed exactly.
- Step 6 manual-verify: missing-source — The required host usage source is unavailable.
- Step 7 impl-review: missing-source — The required host usage source is unavailable.
- Step 8 impl-review: missing-source — The required host usage source is unavailable.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 8 impl-review: NEEDS ATTENTION, 0 critical, 3 warnings measured; 0 critical, 1 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 3.5 A human runs one live Codex step that tries git push, gh pr create and gh auth token with GH_TOKEN set, and records the refusals and a token-free environment in the evidence file — not proved: live codex exec ran (see evidence/command-live-codex-untrusted-run.md) but the scratch project was untrusted, so Codex ignored .codex/rules/project.rules: git push and gh ran instead of being refused.
- 3.6 The same human notes whether bash -lc "git push" is refused, so the wrapper statement in the reference is confirmed or tightened — not proved: same run: bash -lc "git push origin HEAD" ran (exit 0), but with rules not loaded this says nothing about wrappers under the rules; static codex execpolicy check for bash -lc "git push" matched no rul

## Complexity score

Scores: cognitive 5, execution 5 (ambiguity 2, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Never list a Codex project rule or config file as enforced in docs without stating that Codex loads it only for a trusted project.` (step 8)
- `/10x-lesson Never write host environment variable values into test fixture files; record the names or a marker value only.` (step 8)
