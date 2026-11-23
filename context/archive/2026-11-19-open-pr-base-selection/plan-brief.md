# Default PR base selection — Plan Brief

[Full implementation plan](plan.md)

## What & Why

A run forked from `main` can open a PR against an old merged branch after the default branch advances. In repositories without a symbolic remote HEAD, alphabetical order can also select an old branch tied with `main`. The change gives the default branch priority at equal distance and keeps feature-based runs stacked when their feature branch is closer. [Change notes](change.md)

## Starting Point

The publisher ranks remote ancestors by commit count and consults an advanced default only after the ancestor search returns empty. The earlier prefix-collision fix landed and already validates automatic candidates against the active and legacy run namespaces. [Publisher](../../../skills/10x-pipeline/scripts/open-pr.mjs#L189) · [Publication ADR](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)

## Desired End State

If a run and fetched `main` each add one commit at the fork point, `main` wins over an old branch at that point because both bases lack one run commit. Without symbolic remote HEAD, `main` wins among equally near `archive-2025`, `develop` and `main` under the shipped policy. A closer pushed feature branch still wins, and `--base` takes precedence.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Distance | Count commits in `<candidate-ref>..HEAD`. Compare the eligible fetched symbolic HEAD target on the same measure even after it diverges. | This uses the same run-side measure as the existing ancestor ranking. |
| Unknown remote HEAD | Prefer configured defaults in policy order among tied eligible ancestors, then use alphabetical ref order. | This honors repository policy and keeps ties deterministic. |
| Unreadable comparison | Keep a ranked ancestor when the fetched default cannot be counted. Use the existing fallback sequence when no candidate ranked. | Only a successful comparison can establish that the default is as near. |
| Publication | Verify the JSON base and outgoing GitHub arguments in local fixtures. | Both outputs can be checked before the orchestrator publishes. |

## Scope

The shared publisher's ranking, tests in the existing offline fixture, and the base-selection descriptions in the reference and ADR-017. Existing PRs continue through the publisher's reuse path. Policies and run metadata need no migration. Out of scope: ranking a diverged default when the remote's symbolic HEAD is unknown, and any extra fetch or GitHub lookup.

## Architecture / Approach

Reuse the publisher's existing eligibility predicate, ancestor scan and older-Git compatibility path, validating the older-Git per-ancestor counts too. Read a diverged default's count from the selected remote's local tracking ref. Keep the existing GitHub lookup as a final fallback.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Rank the default branch with eligible ancestors | Updated selection, offline regressions and publication documentation | A failed count or an overly broad default preference could select the wrong base. |

**Prerequisites** — Node 24+, Git and the prefix-collision fix already present in this worktree.

**Estimated effort** — One focused implementation session.

## Open Risks & Assumptions

- The distance measure and configured tie order come from the change notes. Only the selected remote's fetched default ref participates in diverged-default ranking. [Change direction](change.md)
- Local tracking refs reflect the last fetch or push. Explicit `--base` still controls a run when local information is stale. [Publisher fallback and override](../../../skills/10x-pipeline/scripts/open-pr.mjs#L231)

## Success Criteria

- Offline tests reproduce both wrong choices before the fix. After the fix the publisher's JSON and fake PR-create arguments select the expected base.
- Offline checks retain the closer-feature, failed-comparison, older-Git, explicit-override, eligibility and fallback behavior. Logged calls confirm the comparison needs no fetch or added GitHub default lookup.
- The full Node test suite and `git diff --check` pass, and the reference and ADR match the implemented rule.

## References

- [Full plan and implementation criteria](plan.md)
- [Offline publication tests](../../../skills/10x-pipeline/test/open-pr.test.mjs#L274)
- [Publication reference](../../../docs/REFERENCE.md#L183)
