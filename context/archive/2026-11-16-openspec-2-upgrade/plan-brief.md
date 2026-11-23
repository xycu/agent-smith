# OpenSpec 2.0.0 Upgrade — Plan Brief

> [Full plan](plan.md) · [Research and executed probes](research.md)

## What & Why

Deliver Wave 2 / roadmap S-13 using exactly OpenSpec 2.0.0. Align the specification-based workflow, committed integration, setup instructions and CI while preserving existing project inputs and saved execution contracts.

## Starting Point

The accepted baseline is `58ce4ea8` after Wave 1 acceptance. CI and committed generated skills target 1.16.1. The local 2.0.0 CLI passes all five existing apply fixtures. Isolated setup, validation and archive probes also passed, exposing an optional archive diagnostic field. [Research](research.md)

## Desired End State

CI selects exactly 2.0.0. Shared generated skills and Claude links work from fresh run worktrees, with verify explicitly included in setup. Existing runs retain their prompts, artifacts, result/usage ownership, validation, optional archive and publication semantics. Evidence names exact tested versions and pending live-host proof.

## Key Decisions Made

| Decision | Choice | Reason | Source |
| --- | --- | --- | --- |
| Version | Pin exactly 2.0.0 and reject successful wrong-version probes | The outcome names an exact compatibility target | S-13 and research |
| Project integration | Migrate all twelve existing workflows to upstream shared skills and Claude links | Preserve the installed workflow set during the layout upgrade | Repository inventory and upstream guide |
| Setup | Use a custom workflow set including propose/apply/verify | The default core profile omits verify | Upstream profiles and executed setup |
| Runtime/state | Retain compatible policy, routing and saved state contracts | Five real fixtures and upstream interfaces support current semantics | Research and existing tests |
| Archive errors | Quote code/message and fix when present | Target collisions omit fix | Executed archive probe |
| Proof | Local gates plus explicit Manual host/publication criteria | Publication follows the enclosing step, and native support needs direct proof | Step rules and Wave 0 acceptance |

## Scope

The change covers the CI pin, exact-version contract fixtures, generated OpenSpec integration, affected setup/discovery instructions, the archive diagnostic clarification and saved-run/delegation verification. S-12 retains first full plan-based delivery ownership. S-15 through S-19 retain their scheduled reliability work, and S-20 retains the final 18-run qualification.

## Architecture / Approach

Expand real CLI contracts first, including a dated ADR-013 amendment for the 2.0.0 pin and exact-version probe outcomes. Migrate the generated layout with preservation checks, then verify the existing shared runner/router/terminal boundaries. Reuse fixture helpers, inspected file-by-file cleanup and fake Git/GitHub clients. The enclosing orchestrator owns actual PR publication and report commenting.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Pin the CLI and expand executable contracts | Exact 2.0.0 CI/probe enforcement and real setup/update/validation/archive fixtures | A successful ambient or wrong-version CLI could mask drift |
| 2. Upgrade generated integration and setup instructions | Preserved twelve-workflow shared skills, Claude links and matching guidance | Update can overwrite custom generated-skill edits |
| 3. Revalidate saved runs, delegation and terminal handoff | Local regressions, exact evidence and publication-ready handoff | Fresh host discovery and inclusive usage remain unproved until exercised |

Prerequisites include the accepted Wave 1 baseline, Node 24+, selected OpenSpec 2.0.0 and worktree-local scratch configuration. Native proof additionally needs trusted projects and authenticated host/model access. PR publication needs the enclosing orchestrator's existing authorization and review-remote access.

Estimated effort is three implementation phases plus account-dependent live verification. There is no fixed delivery deadline.

## Open Risks & Assumptions

- The unattended invocation supplies evidence-backed decisions in place of an interview. Preserving the twelve-workflow set is the conservative project-input interpretation.
- Pending inline/file dispatches retain exact captured bytes while new dispatch provenance reflects upgraded integration. State changes require a demonstrated compatibility need and the existing ownership rules.
- Planning observed Node `v24.19.0`, npm `11.17.0`, Git `2.54.0 (Apple Git-157)`, OpenSpec `2.0.0`, Codex CLI `0.169.0` and Claude Code `2.1.311`. Implementation records its actual versions again.
- Wave 0's six OpenSpec host/provider/launch cells remain pending. Local fixtures and version probes retain their actual evidence scope. Delegated token coverage remains unknown unless explicitly proved.

## Success Criteria (Summary)

- All original and expanded real 2.0.0 contracts, CI probe checks and full-suite gates pass locally with exact counts and skip identities retained.
- Setup/update preserves project inputs, the installed workflow set, valid tracked links and idempotent output. Saved execution, delegation and terminal contracts remain verified.
- Manual acceptance retains fresh OpenSpec host/delegation proof and actual pushed PR, green PR CI and requested report-comment evidence. Unavailable host cells remain pending with their prerequisite.

## References

- [Wave 2 schedule](../../changes/WAVES.md)
- [Roadmap S-13](../../foundation/roadmap.md#s-13-complete-the-specification-based-workflow-on-openspec-200)
- [Wave 0 acceptance](../../changes/nested-step-delegation/evidence/acceptance.md)
- [Upstream 2.0 upgrade guide](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md)
