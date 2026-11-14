# Required CI tool checks — Plan Brief

Full plan in [plan.md](plan.md).

## What & Why

Make CI fail when required Git or OpenSpec contract checks cannot execute. Missing tools currently produce successful test runs with skipped checks. The owner approved a pinned OpenSpec CLI installation as a CI-only exception to the npm dependency rule.

## Starting Point

The shared Git helper returns false on an unsuccessful version probe. The moved OpenSpec contract test skips five fixtures when its binary fails the version probe. Both behaviors reproduced with CI=1 on Node 26.13.1. CI currently sets up Node 24 and runs the suite immediately.

## Desired End State

CI requires successful availability probes and runs all five contract fixtures against OpenSpec 1.16.1. Local runs retain their existing tool-dependent skips. CI acceptance records each remaining skipped test by identity and gating condition.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| CI contract tool | `@fission-ai/openspec@1.16.1` | The reader and ADR-013 identify this existing contract version. | Task, ADR-013, reader |
| Failure ownership | Existing Git and OpenSpec probes | Every affected test already reaches these boundaries. | Existing code |
| CI switch | Nonempty `process.env.CI` | Matches the brief and GitHub Actions environment. | Brief, plan assumption A3 |
| Installation | Unique runner-temp prefix and explicit OPENSPEC_BIN | Selects the pinned executable on either runner path. | Workflow conventions, plan |
| Expected skips | Three default skips, plus optional real-gh check when gh is absent | Current gates explain each conditional skip. | Existing tests |
| Regression coverage | Existing `tools/test/ci-runner.test.mjs` | WAVES explicitly associates it with the CI lane. | WAVES, plan assumption A6 |
| Structure | Two phases, MEDIUM complexity | Shared test infrastructure and CI setup require separate verification. | Plan assumption A4 |

## Scope

Primary ownership covers the new CI prerequisite step, `gitAvailable()` in the shared helper, and `skills/openspec-pipeline/test/openspec-contract.test.mjs`. Supporting work covers existing CI regression tests, the contract-test README entry, the shared OpenSpec reference paragraph, and a focused ADR-013 D2 amendment documenting the CI requirement. Wave 6 owns the existing suite command. WAVES and archived folders serve as read-only references.

## Architecture / Approach

Enforce tool availability in the existing probes. Install the approved CLI after Node setup and before Test suite, validate its version, and publish its absolute path through GITHUB_ENV. Keep conditional skip accounting beside the workflow step and in contract documentation. Verify failure handling with isolated subprocesses and workflow command stubs, then run the real pinned contracts and full suite under Node 24.

Nested test subprocesses clear their copied `NODE_TEST_CONTEXT`, select TAP explicitly, and assert all five fixture identities and states, following the existing `helpers-env.test.mjs` convention. Node 24.19.0 review probes confirmed that an inherited worker context exits 0 with zero tests executed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fail required probes in CI | CI failures, local compatibility, isolated probe regression coverage | Module-level discovery observes environment before tests start. |
| 2. Install the pinned CI tool and account for skips | Exact CLI selection, workflow regressions, documented skip inventory, live acceptance | Registry/install failures and ambient runner tooling. |

Prerequisites include Node 24, a non-root Linux runner, writable runner temp storage, and npm registry access for the approved CLI. Estimated effort is one small implementation session plus a normal PR CI acceptance run.

## Open Risks & Assumptions

- The pin uses ADR-013's established 1.16.1 contract. The local CLI reports 2.0.0. Pinned CLI execution and Node 24 acceptance remain implementation checks.
- Default Linux CI skips are the two GH_LIVE tests and the absent-CLAUDE.md import check. Missing gh adds the optional real-gh test. A present CLAUDE.md runs its check and reduces the total by one. Validate identities and conditions together.
- Non-root Linux CI executes both permission checks. The existing UID guard enforces that prerequisite.
- The unattended task supplies evidence-backed decisions in place of interactive questions. Supporting test ownership follows the CI lane in WAVES.

## Success Criteria (Summary)

- Missing or unusable Git/OpenSpec fails CI with a command-specific reason while local skip behavior is preserved.
- All five OpenSpec contract fixtures execute successfully against 1.16.1, and the Node 24 repository suite passes.
- A normal non-root TrueNAS PR run records the selected version, required-check execution, and only the documented conditional skips.

## References

- [Change brief](change.md) and [Wave 5 ownership](../WAVES.md).
- Existing probes in `skills/10x-pipeline/test/helpers.mjs:215` and `skills/openspec-pipeline/test/openspec-contract.test.mjs:16`.
- Contract version in `docs/ADR/ADR-013-openspec-pipeline.md:11` and `skills/openspec-pipeline/scripts/openspec.mjs:7`.
- Published 1.16.1 package and Node engine requirement. [npm registry](https://registry.npmjs.org/@fission-ai%2fopenspec/1.16.1)
