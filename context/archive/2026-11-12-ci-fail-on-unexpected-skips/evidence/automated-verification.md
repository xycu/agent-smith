# Required CI tool verification

Verification performed on 2026-11-14 in this change worktree, on non-root macOS. Manual TrueNAS acceptance remains pending.

## Decisions

- Used the approved CI-only OpenSpec installation and version 1.16.1 from plan assumptions A1–A2 and ADR-013 D2.
- Used nonempty `CI`, including the literal value `false`, as the failure boundary from plan assumption A3.
- Used the existing probes and existing CI regression file, following plan assumptions A4–A6 and the ownership lane in `context/changes/WAVES.md`.
- Selected the installed Node 24.19.0 executable explicitly through `fnm exec --using=24`. An initial Phase 2 shell selected Node 26 and that run was interrupted before repeating acceptance with Node 24.

## Phase 1

- Focused CI regression file passed all 11 tests.
- The full repository suite passed 1,423 tests with 1,420 passes, zero failures and three expected skips.
- Disabling the Git CI guard made its regression fail. Disabling the OpenSpec CI guard made its regression fail. Both source files were restored and the focused file passed before commit `b0b3e98`.

## Phase 2 focused verification

- Node 24.19.0 ran all 13 CI regression tests with zero skips. Cases cover CI absent, empty, 1 and false, successful probes, real missing commands, nonzero exits, signals, timeouts and spawn failures. Child environments preserve the parent CI, PATH and OPENSPEC_BIN values.
- Workflow stubs proved Git failure, npm installation failure, failing version commands and mismatched versions stop setup before OPENSPEC_BIN publication. Success used a unique temporary prefix and the selected installed executable while an ambient binary was available.
- The actual workflow setup command installed OpenSpec 1.16.1 under the worktree-local runner-temp fixture and exported its absolute executable path through a fixture GITHUB_ENV.
- Under Node 24.19.0 with CI=1 and that exported executable, all five real contract fixtures passed with zero skips. Fixture identities were an empty change, a proposal only, proposal/specs/tasks without design, all four files with mixed ticks, and rows in every list form and marker.
- Disabling workflow version validation made the wrong-version regression fail. The workflow was restored before acceptance.
- Version check passed at 1.10.1. All seven workflow-pin tests passed under Node 24.19.0. `git diff --check` passed.
- The first complete Node 24 suite exposed an ADR rule-format error in the amendment. The amendment was split into individual scenario lines, and all 16 tests in `rules.test.mjs` passed after correction.

## Final full-suite acceptance

Node 24.19.0 ran the complete repository suite with `--test-concurrency=2`, `CI=1`, `GH_LIVE=0` and `OPENSPEC_BIN` selecting the executable exported by the real workflow setup. The result was 1,425 tests, 1,422 passes, zero failures, zero cancellations and three skips.

| Skipped test | Verified condition |
| --- | --- |
| `live: a branch with no pull request is skipped` | `GH_LIVE=0` |
| `live: the real comment projection is one parseable object per line across pages` | `GH_LIVE=0` |
| `CLAUDE.md has no @ imports` | `CLAUDE.md` absent |

The real-gh authentication check executed because gh was available. All five real OpenSpec fixture identities, both permission-check identities and representative Git-dependent commit/isolation checks were present as executed passes. The skip inventory matched exactly.

The local full run took 1,199.9 seconds with concurrency 2. Live TrueNAS acceptance and runner timing remain covered by pending Manual row 2.5.

## Pending manual verification

- [ ] 2.5 A normal same-repository PR CI run on the non-root TrueNAS runner records OpenSpec 1.16.1, execution of all five contract fixtures and both permission checks, and only the documented conditional skips.
