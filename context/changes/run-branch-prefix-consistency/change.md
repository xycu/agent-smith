---
change_id: run-branch-prefix-consistency
title: Honor the configured run-branch prefix throughout the workflow
status: impl_reviewed
created: 2026-11-15
updated: 2026-11-16
archived_at: null
---

## Notes

**Owner request.** "Create the changes for both must fixes using 10x-new, please be descriptive in the change."

**Origin.** Must-fix finding 2 of the repository-wide ponytail audit on 2026-11-15, inspected at revision `ddab87c26b78be506cf402112440f14d531b9e39`. A scratch project with a committed custom prefix reproduced successful worktree setup followed by rejection from the real router. Source inspection also found the same fixed-prefix assumption in cleanup, publication and user-facing instructions.

**Problem.** The existing `isolation.branchPrefix` policy setting and the scripts that prepare and publish runs disagree. The router checks the configured prefix, while `prepare-run.mjs` creates and recognizes `agent-smith/` branches, its cleanup expects `agent-smith/<id>`, and `open-pr.mjs` accepts only that exact default branch name. Automatic PR-base discovery and publication guidance also use the fixed prefix. Changing an advertised policy setting can therefore create a worktree that the next command refuses to use.

**Reproduced case.** In a scratch Git project, commit the change inputs and this project override in `context/foundation/agent-smith-policy.json`:

```json
{ "isolation": { "require": true, "branchPrefix": "codex/" } }
```

Run the standalone setup script for change `demo`, then run router `init demo --goal "<goal>"` from the returned run root. Setup succeeds on `agent-smith/demo`, but initialization returns:

```json
{
  "action": "halt",
  "reason": "Branch agent-smith/demo does not start with codex/; run isolation needs the run branch codex/demo. Nothing was written."
}
```

The halt writes no router state, but setup has already created a branch and worktree. Manually preparing `codex/demo` only bypasses the first mismatch: the publisher's fixed-prefix guard still rejects it.

**Intended outcome.** A valid configured prefix determines the run branch consistently throughout fresh setup, initialization, cleanup, reuse/attachment, terminal publication and diagnostics. With the override above, a fresh run uses `codex/demo` and can reach normal PR publication without changing the policy or renaming the branch by hand. The default remains `agent-smith/`.

**Affected paths and ownership.**

- [prepare-run.mjs](../../../skills/10x-pipeline/scripts/prepare-run.mjs): extend the existing isolation-policy projection as needed; reconcile fresh branch naming, recognition of an existing run worktree, branch-scoped setup locking, registration lookup and cleanup validation. Preserve the established setup-case order and copy-on-fresh-creation behavior.
- [isolation.mjs](../../../skills/10x-pipeline/scripts/isolation.mjs) and [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs): align with effective policy loading and the router's recorded run identity. `meta.branch` and the linked-worktree checks must continue to protect the original run during resume and Git writes.
- [open-pr.mjs](../../../skills/10x-pipeline/scripts/open-pr.mjs): reconcile the isolation guard, automatic base selection's exclusion of other run branches, and manual-recovery messages with the effective prefix and actual run branch. Keep the existing publication flow and safety checks.
- Both [10x SKILL.md](../../../skills/10x-pipeline/SKILL.md) and [OpenSpec SKILL.md](../../../skills/openspec-pipeline/SKILL.md): report the actual branch returned by setup/publication instead of asserting a default name for every run. Keep both chains consistent and preserve their shared Anti-stall rules.
- [REFERENCE.md](../../../docs/REFERENCE.md), [ADR-010](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md) and [ADR-017](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md): reconcile fixed-branch wording with the supported override, documenting any changed contract through the repository's normal ADR amendment convention.
- Existing tests in [prepare-run.test.mjs](../../../skills/10x-pipeline/test/prepare-run.test.mjs), [isolation.test.mjs](../../../skills/10x-pipeline/test/isolation.test.mjs), [open-pr.test.mjs](../../../skills/10x-pipeline/test/open-pr.test.mjs), [skill-loop.test.mjs](../../../skills/10x-pipeline/test/skill-loop.test.mjs) and [openspec-skill.test.mjs](../../../skills/openspec-pipeline/test/openspec-skill.test.mjs) cover the relevant seams. Reuse their scratch repositories and fake Git/GitHub clients.

**Done when.**

- For both chains, a committed `codex/` override creates `codex/demo`; the returned run root initializes successfully with an actionable router step, rather than merely returning parseable halt JSON.
- Cleanup accepts the fresh setup identity and removes only the original files that the existing preservation checks authorize. A second setup reuses the same run, preserves its current contents and creates no stray `agent-smith/demo` branch.
- Existing-branch attachment and setup from the selected run worktree recognize the configured prefix. Coverage includes a project nested below the Git root so branch naming is not confused with the filesystem project prefix.
- A completed isolated run with commits beyond base passes the publisher guard and publishes the configured branch through the existing fake-client workflow. Automatic base discovery excludes other run branches under the effective prefix, and output/manual instructions name the actual branch.
- Default-prefix runs and existing saved runs retain their recorded identity. If a policy change conflicts with a saved run, continuation refuses safely with actionable guidance; it does not silently switch branches, rename work or create a replacement run.
- Main-checkout, detached-HEAD, wrong-run and default-branch protections remain effective. Invalid prefix/branch values cannot cause branch creation or publication to an unintended target; isolation opt-out keeps its existing behavior.
- Focused regressions pass, followed by the required suite: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node 24+. Index any new test file in its folder README. Live remote acceptance, if needed, belongs in Manual criteria; deterministic local publication checks stay Automated.

**Scope boundary.** Support the existing policy key; do not add another branch-naming option. The worktree directory convention and rollback namespace `refs/agent-smith/` are distinct from the run-branch prefix and are not renamed by this change. Do not migrate or delete existing branches, rewrite pushed history, weaken publication guards, add dependencies, or modify `context/archive/`. Reuse the responsible policy/helper seams while respecting the router-module import order and standalone-script boundaries. The parked script-path quoting change and roadmap host-acceptance, recovery and truthful-halt work remain separate.
