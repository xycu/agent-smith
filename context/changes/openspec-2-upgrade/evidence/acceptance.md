# OpenSpec 2.0.0 acceptance and handoff

Recorded 2026-11-16 against runtime/integration candidate `c7c9436d2b71276ebc9de56e95763dbf25d125fa`. Phases 1 and 2 are committed as `bef2a2e1` and `c7c9436d`. Their executable contracts and full repository gates passed. Phase 3's final focused gate passed 463 tests with two expected skips, its isolation gate passed all thirteen tests, and its full gate passed 1790 tests with three expected skips. All eight Automated rows are complete. The final test-source correction is identified by the verification record's staged diff hash and Phase 3 Progress. [Verification](verification.md)

## Local acceptance

| Contract | Collected evidence |
| --- | --- |
| Exact selected CLI and CI pin | Thirteen CI/probe tests pass, including unavailable/failed probes, successful wrong/malformed versions and ambient-binary exclusion |
| Apply readiness and task parsing | All five original named status fixtures execute against exactly 2.0.0 |
| Clean setup and profile selection | Real custom `propose,apply,verify` setup supplies the trio, and the real core case demonstrates absent verify |
| Legacy upgrade and shared integration | Twelve-workflow fixture covers customized inputs, dry-run, preservation, Git tracking, relative Claude links, fresh checkout and idempotence |
| Actual repository migration | All twenty-four legacy files match upstream, twelve canonical 2.0.0 skills and twelve relative links are committed, repeated update is unchanged, sixteen protected hashes survive |
| Validation and archive | Valid/malformed specimens, merged specs, entire change-directory preservation, date/path convention, collision and optional diagnostic `fix` execute through the real CLI |
| Instructions and archive safety | Fifty-six focused tests pass, with preserved Anti-stall/result/usage/publication procedures and optional-error-field regression |
| Final saved-run, delegation and terminal handoff | Corrected-candidate focused gate passes 463/465 with two expected skips, isolation gate passes 13/13, and final full gate passes 1790/1793 with three expected skips |

The local records retain both failed test attempts, all three deliberate-break red runs and the migration EPERM/retry. Existing tests cover saved prompts, ownership, lock settlement, recovery and fake terminal clients. Native qualification and external handoff remain pending under the Manual rows below. [Attempt records](verification.md#executed-attempts)

## Fresh-child discovery observation

The enclosing implementation step `/root` launched the native Codex leaf `/root/phase3` after the migration commit. Its fresh injected host skill catalog names root alias `r16` as `/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade/.agents/skills`. The leaf's read-only discovery check observed every alias below and independently read every canonical file's `generatedBy: "2.0.0"` metadata.

| Exact catalog alias | Canonical path from the run root |
| --- | --- |
| `agent-smith:openspec-apply-change` | `.agents/skills/openspec-apply-change/SKILL.md` |
| `agent-smith:openspec-archive-change` | `.agents/skills/openspec-archive-change/SKILL.md` |
| `agent-smith:openspec-bulk-archive-change` | `.agents/skills/openspec-bulk-archive-change/SKILL.md` |
| `agent-smith:openspec-continue-change` | `.agents/skills/openspec-continue-change/SKILL.md` |
| `agent-smith:openspec-explore` | `.agents/skills/openspec-explore/SKILL.md` |
| `agent-smith:openspec-ff-change` | `.agents/skills/openspec-ff-change/SKILL.md` |
| `agent-smith:openspec-new-change` | `.agents/skills/openspec-new-change/SKILL.md` |
| `agent-smith:openspec-onboard` | `.agents/skills/openspec-onboard/SKILL.md` |
| `agent-smith:openspec-propose` | `.agents/skills/openspec-propose/SKILL.md` |
| `agent-smith:openspec-sync-specs` | `.agents/skills/openspec-sync-specs/SKILL.md` |
| `agent-smith:openspec-update-change` | `.agents/skills/openspec-update-change/SKILL.md` |
| `agent-smith:openspec-verify-change` | `.agents/skills/openspec-verify-change/SKILL.md` |

The required `openspec-propose`, `openspec-apply-change` and `openspec-verify-change` skills are available through those catalog aliases. The installed CLI version observations are Codex `0.169.0`, Claude Code `2.1.311` and OpenSpec `2.0.0`. The native host runtime build was not separately exposed. This was a fresh delegated implementation leaf. The observation covers catalog discovery and canonical metadata in that launch context.

Unique child-nonce collection, normal `/agent-smith:openspec-pipeline` dispatch, router advance, interruption/recovery, late/foreign-result exclusion, negative permission probes and usage inclusion remain required for the six pending normal-entry cells. The enclosing step collected Phase 3's evidence before its own RESULT. Child-inclusive token coverage and aggregate token totals remain unknown.

## OpenSpec normal-entry matrix

Cell numbers retain Wave 0's existing identities. No cell below has been attempted against this upgraded candidate in this Automated-only implementation step. Each needs an authorized fresh trusted acceptance launch through the normal pipeline entry point and retained raw or stable sanitized evidence. Account, quota and trust readiness require checks in that actual launch. Earlier quota and primitive-probe observations retain their original recorded scope. [Wave 0 matrix](../../nested-step-delegation/evidence/acceptance.md) [Historical native observations](../../nested-step-delegation/evidence/capabilities.md)

| Wave 0 cell | Host | Provider ladder | Launch | Candidate result | Concrete remaining prerequisite |
| --- | --- | --- | --- | --- | --- |
| 3 | Claude Code | Claude | interactive | pending | Fresh interactive trusted Claude session, upgraded skill discovery, usable Claude account/quota and guarded awaited child execution |
| 4 | Claude Code | Claude | headless | pending | Trusted headless Claude launch with installed guarded step mapping, effective depth/restrictions and usable Claude account/quota |
| 7 | Claude Code | Claude/OpenAI | interactive | pending | Fresh trusted interactive Claude host with both provider accounts/configuration and awaited provider handoff |
| 8 | Claude Code | Claude/OpenAI | headless | pending | Headless Claude launcher with both providers, Codex permission/profile preflight and guarded awaited children |
| 11 | Codex | OpenAI | interactive | pending | Fresh trusted interactive Codex pipeline launch on the upgraded candidate, effective restrictions and usable provider access |
| 12 | Codex | OpenAI | headless | pending | Trusted headless Codex normal-entry launch with retained native metadata, usable provider access and verified enclosing/descendant settlement |

Every cell must retain candidate and exact tool/host versions, configuration and launch identity, discovered 2.0.0 skills, child identity and nonce, collection before enclosing RESULT, exactly one router advance, collected failure and interruption/resume behavior, late/foreign-result exclusion, effective restrictions and measured usage scope. Distinct staged and working versions must survive recovery. Unknown settlement retains its lock and excludes result intake, rollback, relaunch and terminal publication. Existing deterministic fixtures retain their model-free evidence scope. S-20 owns qualification of the final combined candidate and its eighteen normal runs. [Plan contract](../plan.md#phase-3-revalidate-saved-runs-delegation-and-terminal-handoff)

## Enclosing-step handoff

Phase 1 and Phase 2 native leaf returns were collected before their enclosing gates and commits. The enclosing step collected the Phase 3 leaf's two evidence files and the Phase 1 leaf's ambient-home correction before their gates. The enclosing implementation step owns final gate execution, evidence reconciliation, Progress updates and authorized local commits. The current run branch remains `agent-smith/openspec-2-upgrade`.

The outer orchestrator owns pushing that run branch, opening or retaining the reviewable pull request, observing successful PR CI and posting the requested report comment. The local fake-client tests exercise the default/archived terminal paths and suspended-execution exclusion. The actual external publication remains pending. The report must retain the six pending live-host cells and unknown inclusive child usage scope. [Verification](verification.md#phase-3-final-gates)

## Pending Manual rows

- [ ] 3.4 Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded.
- [ ] 3.5 The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof.
