# Delegation acceptance

## Native matrix

The normal-entry final-candidate cells below remain pending. The top-level session has separately recorded successful Codex desktop/headless native child probes, a successful Claude headless nested probe and a Claude interactive quota failure. These primitive probes inform implementation and retain their exact scope. [Native observations](capabilities.md#top-level-native-probes)

| Cell | Host | Provider ladder | Chain | Launch mode | Capability | Final candidate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Claude Code | Claude | 10x | interactive | pending | pending |
| 2 | Claude Code | Claude | 10x | headless | pending | pending |
| 3 | Claude Code | Claude | OpenSpec | interactive | pending | pending |
| 4 | Claude Code | Claude | OpenSpec | headless | pending | pending |
| 5 | Claude Code | Claude/OpenAI | 10x | interactive | pending | pending |
| 6 | Claude Code | Claude/OpenAI | 10x | headless | pending | pending |
| 7 | Claude Code | Claude/OpenAI | OpenSpec | interactive | pending | pending |
| 8 | Claude Code | Claude/OpenAI | OpenSpec | headless | pending | pending |
| 9 | Codex | OpenAI | 10x | interactive | pending | pending |
| 10 | Codex | OpenAI | 10x | headless | pending | pending |
| 11 | Codex | OpenAI | OpenSpec | interactive | pending | pending |
| 12 | Codex | OpenAI | OpenSpec | headless | pending | pending |

Recorded primitive observations supply Phase 2's controls and event contract; the complete matrix remains final-candidate qualification. Final-candidate runs exercise both normal entry points, exactly one enclosing router advance, child failure, interruption/resume, late-result rejection, effective scoring/verification/archive restrictions and usage attribution. Retain the exact revision and evidence for each attempt. [Plan acceptance contract](../plan.md#3-functional-acceptance-through-normal-entry-points)

## Local verification

Real candidate headless smoke checks passed through the router and runner on both chains, collecting child nonces and advancing exactly once. The relevant runner, state and flow source hashes still match the final implementation. The candidate settlement verifier also accepted completed native records and rejected forced termination. Full matrix rows remain pending because these checks cover bounded normal-entry flows. [Candidate smoke evidence](capabilities.md#candidate-normal-entry-smoke-evidence)

Phases 1–3 provide deterministic model-free descendant lifecycle, native-lock, recovery and exact-retry coverage. The final full suite passed 1,679 of 1,682 tests with zero failures/cancellations and three existing skips; all Automated rows are complete. Local gate outcomes and the closing commit are recorded in the plan's canonical Progress and the verification record below. Native matrix rows retain their pending state. [Progress](../plan.md#progress) [Fixture evidence](capabilities.md#deterministic-process-evidence)

## Recovery and continuation

Phase 2 is committed as `ce116d2`, using the top-level native observations and authoritative host contracts. Manual row 1.3 and final-candidate qualification stay pending where their full evidence is absent. Historical pending prompts retain their exact bytes. Downgrade requires resolved child-enabled dispatches and proven child closure under the plan's existing router-owned recovery procedure. [Migration notes](../plan.md#migration-notes)

The failed Phase 2 work is preserved in the router recovery ref identified by implementation-feedback.md. The revised local gate includes setup/handoff/archive contract repair, native execution-lock exclusion for an out-of-group child (new row 2.4), and a fresh full suite with zero failures/cancellations. Prior Phase 1 results and the failed attempt's partial logs do not qualify the feature. That planning-only revision left Automated rows pending; the subsequent Phase 2 implementation and successful full gate close rows 2.1–2.4. See the [implementation verification](verification.md) for exact counts and decisions.

Manual rows 3.4 and 3.5 also remain pending. Final-candidate native verification and orchestrator-owned publication/CI are separate acceptance obligations. Performance benchmarking follows the owner's deferral. [Progress](../plan.md#progress)

## Verification record

- On 2026-11-16, Phase 1 focused checks passed all 122 tests across `codex-runner.test.mjs`, `nested-subagents.test.mjs`, `skill-loop.test.mjs` and `run-lock.test.mjs`, with `--test-concurrency=2`.
- The exact row 1.1 command also passed all 108 tests with zero skips, using `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs`.
- The complete repository suite passed 1,625 of 1,628 tests with zero failures and three existing skips, using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- The deliberate-break gate replaced process-group cancellation with parent-PID cancellation in the runner. Both descendant-collection lock cases failed while awaiting `descendant-terminating`. A `finally` block restored the runner byte-for-byte, and Git confirmed the runner had no diff.
- The final post-restoration repository gate passed the same 1,625 tests with zero failures and three skips. The skips cover the two opt-in live GitHub checks and the absent `CLAUDE.md` import check.
- `git diff --check`, `node tools/version-check.mjs` and the required phase commit subject lint passed.
- Tests use a worktree-local ignored TMPDIR beneath `.claude/worktrees/nested-step-delegation-checks`. A temporary Git discovery boundary confines scratch repositories to that area.

The first pending Automated row after Phase 1 was 2.1; Phase 2 has since passed its full replacement suite (1,668 passed, zero failures/cancellations, three existing skips). The top-level session corrected the plan's pre-implementation full-matrix gate after collecting the native observations above. Implementation and local verification are complete; Manual rows 1.3, 3.4 and 3.5 retain their qualification and publication obligations. [Sequencing correction](../plan.md#critical-implementation-details)

## Pending manual verification

- [ ] 1.3 Native capability evidence records parent receipt, event and usage semantics, cancellation and applicable child restrictions for the twelve configuration/mode cells, with unavailable proof explicitly pending until final-candidate qualification.
- [ ] 3.4 Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points, including child collection, failure, interruption/resume, late-result rejection, usage attribution and effective child restrictions.
- [ ] 3.5 The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds, and any explicitly requested report comment describes the actual delegation outcome and pending host evidence.

Phase 3 gate details, the staged-source candidate hash and preservation regression evidence are in [implementation verification](verification.md#phase-3--recovery-and-compatibility). The phase commit is recorded beside the completed Progress rows.
