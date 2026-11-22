# Harden the OpenSpec install on TrueNAS CI

## Overview

Keep pull request CI on the runners chosen in ADR-020. Disable npm lifecycle scripts for the OpenSpec install that runs on each test shard. Amend ADR-020 so a maintainer can tell which GitHub control holds fork workflows for review, when it was checked, and which home-network services are accessible to a job. The owner chose this scope on November 21 and approved the two test edits on November 22. [Frame](frame.md)

## Current State Analysis

| Question | Evidence | Consequence |
| --- | --- | --- |
| Where does the install run? | The six shards share one install line. It requests `@fission-ai/openspec@2.0.0` in a fresh prefix with lockfile generation disabled. [CI workflow, lines 30–74](../../../.github/workflows/ci.yml#L30) | The top-level version is fixed. Transitive versions can move and their install scripts can execute on the runner. |
| What proves the CLI works? | The install step checks the exact version before exporting the absolute `OPENSPEC_BIN`. The focused test substitutes npm and a CLI. The CI suite invokes the selected binary on five real contract fixtures. [Runner test](../../../tools/test/ci-runner.test.mjs#L67) · [Contract fixtures](../../../skills/openspec-pipeline/test/openspec-contract.test.mjs#L75) | The local test can prove the arguments and failure handling. Real CLI compatibility requires executing the installed package. |
| Which jobs can reach the NAS? | CI and PR title jobs route same-repository PRs to TrueNAS. CI also runs there on pushes to main. Fork PRs normally select a hosted runner, but the fork can edit the workflow. Release runs on a hosted runner. [CI](../../../.github/workflows/ci.yml#L15) · [PR title](../../../.github/workflows/pr-title.yml) · [Release](../../../.github/workflows/release.yml) | The fork approval policy and owner review before approval matter. A writer, token or automation with branch write access can already cause code to run on TrueNAS. |
| What has the owner verified? | The November 15 evidence records `all_external_contributors` and a successful non-root CI run. ADR-020 D4 specifies limited LAN routing. The frame still requests the actual hosts and services. [Archived acceptance](../../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md) · [ADR-020](../../../docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md) | Preserve the dated reading and distinguish the intended network restriction from the observed reach of a runner job. |

## Desired End State

All six shards install a working OpenSpec CLI without executing lifecycle scripts from an unlocked dependency tree. ADR-020 identifies the checked setting, source and date, the owner-confirmed network exposure, and the same-repository risk the owner accepts.

## Scope limits

The primary change covers one workflow command, its two test assertions, ADR-020 and its index entry. Runner selectors, fork fallback, the non-root guard, release placement, workflow permissions and 40-hex action SHA pins with version comments are existing invariants. Repository administration and network configuration belong to the owner. ADR-006 keeps npm packages out of the router.

## Implementation Approach

Use two phases. Phase 1 has a local, deterministic regression check. Phase 2 records the evidence and owns the manual acceptance checks, including the published PR run. This lets implementation proceed while the owner supplies operational facts.

## Phase 1: Disable lifecycle scripts on all test shards

### Changes required

**Workflow intent.** Insert `--ignore-scripts` immediately before the package argument on the shared install line. **Contract.** Preserve the argument order through `--package-lock=false`, per-job prefix, isolated npm cache and user config, version check and export. A failed install or wrong version must still fail the job before it exports a binary. [CI install step](../../../.github/workflows/ci.yml#L52)

**Test intent.** Pin the literal flag and prove the shell passes it to npm. **Contract.** In the command-text match (line 60) and expected argv (line 116), insert the flag in the same position. These are the only approved edits to the test. Keeping the prefix in place also preserves the npm stub’s argument contract. [Runner test](../../../tools/test/ci-runner.test.mjs#L60)

### Success Criteria

#### Automated Verification

- The focused runner test passes with the script-disabled install pinned in both assertions (`node --test tools/test/ci-runner.test.mjs`).

## Phase 2: Record the trust boundary and verify acceptance

### Changes required

**ADR intent.** Append Amendment 3 and update the status line and the existing ADR-020 index row. Preserve earlier findings, including the November 11 and November 15 policy readings. **Contract.** Document the install protection and its limit: the unlocked tree can still change, and invoking the CLI executes dependency code. Describe which events run on the NAS, why the owner reviews fork workflow changes before approval, and the accepted exposure from same-repository branches, including automation. [ADR-020](../../../docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md) · [ADR index](../../../docs/ADR/README.md)

**Settings evidence.** For each repository setting actually relied on, record its UI name, required value, observed value, date of the owner’s check and source. The documented gate is Settings → Actions → General → Fork pull request workflows from outside collaborators → “Require approval for all external contributors.” Cite the November 15 reading with its actual date. Include additional controls only if the owner identifies a dependency and supplies evidence. The release-PR creation permission serves release-please and does not gate runner access.

**Reach evidence.** With the owner’s dated description, state which home-network hosts or service roles a job can connect to, on which services, and any relevant restrictions. Identify differences across runner instances if applicable. Use service roles sufficient for a public ADR and omit credentials. Outbound downloads, runner labels and the non-root check cannot establish LAN isolation. While the owner’s evidence is outstanding, identify the specific unknowns in the amendment and leave manual acceptance open. If a setting differs from its required value, record the discrepancy for the owner.

### Success Criteria

#### Automated Verification

- ADR-020 has an Amendment 3 heading and its existing index row references Amendment 3 (`rg -n '^## Amendment 3' docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` and `rg -n 'ADR-020.*Amendment 3' docs/ADR/README.md`).

#### Manual Verification

- The owner confirms the recorded setting values and check dates, the runner’s reachable home-network hosts and services, and the residual same-repository write risk against Amendment 3.
- The published PR has green CI across all six shards, including the installed OpenSpec 2.0.0 version checks and the five real OpenSpec contract cases passing without skips.

## Testing Strategy

During development run only the Phase 1 test file. Its shell harness records npm argv, checks the selected executable, and covers install and version failures. Inspect the diff for the one workflow line and the two authorized assertions. For post-publication acceptance, inspect the six shard results and the contract cases that compare router output to `openspec instructions apply --change demo --json`. CI runs the complete suite. The fake executable used locally cannot supply this evidence.

## Migration and fallback

The workflow consumes its own revision, and each shard creates a new prefix. Old runs retain their original install behavior. A retry on the hardened revision uses a new prefix. There is no persistent package or router state to migrate.

If a real install or fixture fails, distinguish a registry outage, unavailable package, or unrelated suite failure from a required lifecycle hook. Only a confirmed hook dependency triggers the frame’s fallback. Put the CI-only manifest and committed lockfile at `.github/ci/openspec/package.json` and `.github/ci/openspec/package-lock.json`, review the resolved tree and integrity entries, then copy both files into the fresh prefix and use `npm ci` there. Keep scripts disabled wherever possible. If needed, permit only the reviewed, locked install behavior. Repeat the exact-version and real-fixture checks. Keep the failed revision out of main while resolving the issue. If this alternative needs changes beyond the two approved assertions (for example to the npm stub), return the concrete incompatibility for owner authorization before widening the diff. Never fall back to running scripts against an unlocked tree.

## References

- [Owner decision and test scope](frame.md)
- [Original finding and acceptance](change.md)
- [Dependency-free router decision](../../../docs/ADR/ADR-006-node-runtime-floor.md)
- [Action pin checker](../../../tools/workflow-pins.mjs)

## Progress

### Phase 1: Disable lifecycle scripts on all test shards

#### Automated

- [ ] 1.1 The focused runner test passes with the script-disabled install pinned in both assertions (`node --test tools/test/ci-runner.test.mjs`).

### Phase 2: Record the trust boundary and verify acceptance

#### Automated

- [ ] 2.1 ADR-020 has an Amendment 3 heading and its existing index row references Amendment 3 (`rg -n '^## Amendment 3' docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` and `rg -n 'ADR-020.*Amendment 3' docs/ADR/README.md`).

#### Manual

- [ ] 2.2 The owner confirms the recorded setting values and check dates, the runner’s reachable home-network hosts and services, and the residual same-repository write risk against Amendment 3.
- [ ] 2.3 The published PR has green CI across all six shards, including the installed OpenSpec 2.0.0 version checks and the five real OpenSpec contract cases passing without skips.
