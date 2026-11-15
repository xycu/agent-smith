# Step subagent Git and deletion safety plan brief

Full plan at [plan.md](plan.md).

## What & Why

Three routed steps used prohibited cleanup or Git commands, or published a PR to satisfy an Automated criterion. Add safety rules to every routed task, keep acceptance achievable before publication, and block common direct unsafe Bash commands in supported Claude step agents.

The rejected implementation review adds a follow-up: verify its applied Git-option fix and remove accidentally tracked `.DS_Store` metadata from the package while preserving the local file.

## Starting Point

Phases 1–3 have implemented the shared rules, dedicated Claude identity, hook, provenance and documentation; all 11 Automated rows are complete. Review F1 was fixed in `19affb2` with a regression. F2 remains: the root `.DS_Store` is tracked and strict plugin validation reports `ARCHIVE_OS_METADATA_FILE` despite exiting zero. Three Manual rows remain pending.

## Desired End State

Both chains retain their safety and planning rules, guarded Claude dispatch and orchestrator publication ownership. The F1 regression passes; tracked package contents omit `.DS_Store`, local metadata remains intact and ignored, and a clean candidate export validates without the metadata diagnostic.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Shared safety | Extend `rules/top.md` | Project overrides cannot remove these invariants | ADR-023 |
| Planning acceptance | Add `plan`, `plan-review` and `os-propose` step rule files | One carrier reaches each step's variants | Ticket and existing rule lookup |
| Native guard | Plugin PreToolUse hook plus default `agent-smith:step` identity | Supported identity separates routed agents from orchestrator/unrelated calls | Current Claude documentation and local 2.1.311 CLI |
| Compatibility | Preserve custom restricted mappings, OpenAI checks and exact historical retries | Existing public dispatch/replay contracts remain usable | ADR-009, ADR-015, ADR-024 |
| Guard coverage | Bounded direct Bash-command subset | Small implementation covers observed breach forms | Ticket and explicit plan matrix |
| Publication | Existing orchestrator scripts retain push, PR and comment ownership | PR state exists after the run | ADR-017 |
| Concurrent edits | Reuse existing agent forwarding | Both SKILL.md files stay with Wave 7 owners | Current skills and active change definitions |
| Review F1 | Reuse the applied correction and existing regression | The classifier already consumes option values and honors real flag precedence | Review, `19affb2`, guard code/test |
| Review F2 | Remove tracking, preserve local bytes, ignore `.DS_Store` at every depth | Closes the delegated review scope gap without discarding preferences | User's replan request, review and Git inventory |
| Package acceptance | Validate a clean tracked export and inspect diagnostics | Exit zero alone misses the metadata warning; the retained local file may still trigger it in the working directory | Review verification evidence |

## Scope

Included work covers the original safety implementation plus Phase 4's F1 verification, `.gitignore`, root `.DS_Store` tracking removal and new evidence inside this change folder. This revision edits only the plan and brief; cleanup belongs to implementation.

Excluded work covers local metadata deletion, history rewriting, broad packaging tooling, the existing missing-icon warning, remote-ref polling, a general shell parser, OpenAI permission redesign, dependencies, release fields, model/tier changes, WAVES.md and archived files. The review and prior evidence remain unchanged.

## Architecture / Approach

The existing rule tail, provider-aware dispatch, scoped Bash hook and independent provenance hashes retain their owners. Phase 4 reuses the guard regression and Git's tracking, ignore and export facilities; it adds no package helper or dependency. New acceptance rows preserve all completed Progress identities and existing Manual checks.

## Phases at a Glance

| Phase | Deliverable | Primary risk |
| --- | --- | --- |
| 1. Shared safety and planning rules | Always-true safety and pre-publication acceptance carriers, with regressions | Missing a template, override or archive path |
| 2. Scoped Claude guard and dispatch compatibility | Dedicated agent, native hook, provenance and provider/retry tests | Overblocking safe commands or overstating runtime coverage |
| 3. Documentation and integration acceptance | Reference/index/ADR amendments and concurrent-change verification | Drift against the Wave 7 skill rewrite |
| 4. Implementation-review follow-up | F1 regression acceptance, F2 tracking cleanup and clean-export validation | Mistaking a zero validator exit or a dirty working directory for package acceptance |

Prerequisites are Node 24+, a loaded plugin and existing test helpers. The overall Claude Code baseline stays 2.1.292+, while fail-closed hook handling requires 2.1.295+ and a supported identity schema. Older hosts retain prompt rules and existing permission controls, with runtime guard enforcement unverified. The plan needs no external service for Automated criteria.

Remaining effort is one small follow-up phase plus the existing live acceptance pass. Overall complexity stays HIGH; the follow-up adds three pending Automated rows, 4.1–4.3.

## Open Risks & Assumptions

- Unattended evidence-backed choices replace the interview and approvals. A1–A10 record the decisions, including reuse of F1, inclusion of F2 and validation of a clean export.
- Stage-only restore can discard a unique index version. The stateless hook denies it because it cannot establish preservation. Phase 2 explains this correction to the retained wording of Progress row 2.2.
- The hook covers a documented direct-command subset. Script internals, dynamic shell construction, alternative executables, filesystem/MCP actions, OpenAI children and custom agent types retain semantic rules and host controls.
- Historical pending dispatches retain their exact stored prompt and agent, so an upgrade gains full new coverage at the next newly assembled action.
- Disabled hooks and unsupported identity schemas provide no runtime guarantee. A hook startup failure can block matching orchestrator calls under fail-closed handling.
- Both skills remain owned by concurrent changes. This change relies on their existing forwarding interface and verifies it during integration.
- Live identity, blocking and planning adherence remain Manual checks. Actual PR CI acceptance occurs after orchestrator publication.
- An ignored local `.DS_Store` can still trigger a working-directory warning; acceptance uses the candidate tracked export. Record its tree identity and the retained local file's before/after digest.

## Success Criteria Summary

- Every new routed task carries the Git/deletion/publication rules, including archive and file-handoff tasks.
- Planning/review keep publication-dependent acceptance out of Automated criteria, while allowing local fake-client tests.
- Guard, provider, retry, provenance and complete repository suites pass, and documented runtime limits agree with live evidence available at acceptance.
- F1's inert regression passes; F2 leaves no tracked metadata, preserves local bytes and passes diagnostic-aware validation on a clean export.

## References

See the full plan, [implementation review](reviews/impl-review.md), [verification record](evidence/impl-review-verification.txt) and [F1 payload evidence](evidence/impl-review-guard-regression.txt). The review recorded 11 passing guard tests and 1,570 of 1,573 complete-suite tests passing, with three expected skips. This revision claims no new test execution; Phase 4 and Manual rows 2.6, 2.7 and 3.4 remain pending.
