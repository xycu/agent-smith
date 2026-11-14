# OpenAI Codex support verification

Verified on 2026-11-14 with Node v24.19.0, Codex CLI 0.169.0 and plugin version 1.7.0. The base implementation revision was `938fd09`, followed by the Phase 4 verification working tree. Release version fields belong to release-please.

## Router smoke

`node /tmp/agent-smith-codex-smoke.mjs` created fresh scratch projects, merged the GPT overlay with `isolation.require: false`, then ran the actual router CLI `init demo --goal "fix typo" --host codex --chain <chain>` and `status demo --chain <chain>`. Both initializations returned a run action with a step. Both status commands exposed the selected provider and model. Fixture cleanup used `removeTree`.

| Chain | Action | Step | Provider | Model | Effort | Profile | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10x | run | plan | openai | gpt-6.1-sol | medium | null | readable |
| OpenSpec | run | os-propose | openai | gpt-6-astra | high | null | readable |

The structured output is in `router-smoke.json`. These checks made zero paid model calls.

## Integration matrix

`node --test skills/10x-pipeline/test/codex-chain.test.mjs` drives the actual router, shared runner and Git recovery in scratch repositories. The CLI process emits deterministic fixture output. Its implementation and archive paths make actual typed commits before RESULT. The matrix covers both chains with an OpenAI-only ladder through completion, provider-bearing status/report/self-comparison and guarded archive. A second path on each chain uses a Claude-hosted mixed ladder, a native-result fixture, failed-step side-ref preservation, rollback, OpenAI escalation, pre-spawn refusal and exact neutral retry after ladder/profile drift.

Each chain also runs a failed OpenAI RESULT through real isolated rollback, verifies the saved side-ref file and retries at a higher tier before completion.

Native Claude results are supplied as fixtures. Native Agent dispatch remains a live acceptance check. The shared skill archive gate is covered by the fail-closed host instruction tests. Process contention, handled interruption and cleanup are covered by the runner and run-lock tests. Actual native sandbox Git capability is documented in `phase2-permissions.md`.

## Gates

All listed commands completed against the Phase 4 working tree.

| Command or check | Result |
| --- | --- |
| Runner, lock, host and chain scoped tests | PASS, 66 tests |
| Both-chain no-isolation router smoke | PASS |
| Deliberate-break check of matrix coverage | PASS, corrupted normalized usage made both chain tests fail, exact bytes restored |
| `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` | PASS, 1,239 passed, 3 skipped, zero failures (1,242 total) |
| `node tools/version-check.mjs` | PASS, 1.7.0 |

## Adaptations and acceptance limits

Verification found that a filesystem error could return 8,296 diagnostic characters. Both runner error boundaries now cap diagnostics at 2,048 characters. The regression tests fail when the cap is removed.

The implementation workers hit the host usage limit during Phase 3 and before Phase 4 edits. The main agent completed the authorized work and retained the phase gates and commit boundaries. Connected fixtures validate each absolute run root before comparing outputs across roots. Test-fixture helper options reuse the existing fake CLI for supplied linked-worktree projects and mixed hosts.

A named Codex configuration profile is optional. Existing configuration is the default. Native sandbox can force legacy `sandbox_mode` settings read-only and leave permission parity unverifiable. Filesystem/Git probes do not establish model-command hook or execpolicy approval behavior. The runner preserves those controls and refuses an unverifiable preflight.

Manual rows 4.4, 4.5 and 4.6 remain pending. They cover clean compatibility import, actual child-visible toolkit discovery, both-host live execution, native Claude dispatch, interruption/resume and archive approval in the real hosts. The automated matrix establishes routing, transport and artifact/Git behavior with fixtures. Live model access, native host tool availability and full installed-host behavior require those acceptance runs. No external PR comment or message forms part of this verification.
