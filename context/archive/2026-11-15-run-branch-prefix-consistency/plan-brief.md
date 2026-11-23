# Configured Run-Branch Prefix — Plan Brief

Full plan in [plan.md](plan.md).

## What & Why

Make the existing `isolation.branchPrefix` setting work through the complete run lifecycle for 10x and OpenSpec. A committed `codex/` override currently creates a default-named branch that initialization rejects, and publication also assumes the default.

## Starting Point

Setup already projects isolation policy and returns a branch. Router metadata already records the run identity. Existing scratch repositories, local remotes and fake GitHub clients cover setup, cleanup and publication. Planning inspected revision `9f13a087`, following the merged Wave 0 delegation change.

## Desired End State

Both chains can create `codex/demo`, initialize to an actionable step, clean preserved original inputs, resume without overwriting run contents and publish the same branch. Saved runs retain their recorded identity, and conflicting policy changes produce actionable refusal before redirecting work.

## Key Decisions Made

| Decision | Choice | Evidence |
| --- | --- | --- |
| Policy ownership | Extend the existing isolation projection and share its narrow standalone behavior | Setup projection and router merge parity |
| Prefix syntax | Literal prefix, optional trailing slash, native Git branch validation | Existing `startsWith` contract and input-safety acceptance |
| Saved identity | Exact recorded branch and id, absent chain normalized to `10x`, deterministic selection and refusal on conflict or ambiguous fallback | Existing isolation guards, cleanup normalization and same-id baseline arms |
| Legacy publication | Exact generated branch when metadata carries no saved identity | Existing publisher fixtures, including empty metadata |
| Automatic base | Exclude configured and legacy run namespaces | Existing default exclusion and configured-prefix requirement |
| External acceptance | Manual rows completed after orchestrator publication | ADR-017 Amendment 2 and plan-step rules |

## Scope

Includes setup, initialization validation, cleanup, reuse/attachment, resume, publication, base selection, branch diagnostics, focused tests, both skills, README, Reference and ADR-010/017 amendments.

Retains the existing worktree layout, recovery namespace and saved-state format. Other wave changes and the parked script-path quoting work retain their ownership.

## Architecture / Approach

Resolve effective isolation configuration once per entry point through a shared standalone seam, validate its branch targets, then carry actual run identity through existing lifecycle operations. Setup and publication retain standalone boundaries. The router owns saved-state writes and recovery. Both skills consume returned branch values.

Saved invocation identity takes precedence, followed by established in-run handling and exact configured-branch selection. Fallback registration discovery matches repository, nested-project prefix, change id and normalized chain, and refuses multiple remaining identities. Executable recovery commands quote every dynamic argument literally because Git-valid branch names can contain shell metacharacters.

## Phases at a Glance

| Phase | Delivers | Primary risk |
| --- | --- | --- |
| 1. Setup and saved identity | Configured creation, init, cleanup and safe resume | Policy drift creating a replacement run or authorizing cleanup |
| 2. Publication and bases | Configured head/refspec and correct base exclusions | Publishing another run or choosing its branch as base |
| 3. Guidance and gates | Skills, documentation amendments, full suite and review handoff | Fixed branch claims surviving in failure messages |

Prerequisites include plan review, Node 24+, Git and a confirmed disjoint sibling implementation boundary. The required full suite runs after each implementation phase. Estimated effort is three implementation phases plus review and terminal publication, with live CI timing externally determined.

## Open Risks & Assumptions

- Unattended planning uses the task's delegated decision authority. Explicit non-string and blank prefixes are rejected when isolation is active, and valid prefixes without a slash remain supported.
- Sibling ownership was confirmed against its change record and the Wave ledger. It owns comparison code/tests and eligibility paragraphs. This change leaves `route.mjs`, `state.mjs`, policy defaults and log readers read-only. Recheck a later sibling plan before parallel implementation and coordinate adjacent Reference hunks.
- Saved identity discovery must still work after source cleanup and at custom registered worktree locations. Partial, contradictory or ambiguous fallback identity must refuse before mutation. Regression cases include multiple same-id baseline arms and legacy 10x metadata without `chain`.
- Rollback retains branches and run data. An older publisher can reject a custom run created by the fix, so retain or restore the compatible plugin version for it.
- Read-only research children were collected. Child-inclusive token totals are unavailable. Installed-host qualification remains with the roadmap's existing acceptance changes.

## Success Criteria (Summary)

- Automated local tests prove both-chain configured/default lifecycles, preservation, deterministic saved-run selection, ambiguity refusal, wrong-run guards, fake-client publication, literal recovery-command arguments and base selection. Reintroducing the original faults makes focused tests fail.
- Both skills report actual branch identity, amendments match behavior, the full Node suite passes, and local diff/version/commit checks pass before publication.
- Manual acceptance records the orchestrator's open PR, requested report-comment URL and green PR CI for owner inspection.

## References

- [Change and acceptance](change.md).
- [Detailed phases and canonical Progress](plan.md).
- [Wave ownership](../WAVES.md) and [sibling change](../compare-damaged-logs-not-comparable/change.md).
