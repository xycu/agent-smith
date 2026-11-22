# Local Delivery Verification

## Revision and scope

Local observations use Node `v24.19.0`, Git `2.54.0 (Apple Git-157)` and plugin `1.13.0`. The initial fixture and Phase 1 repository gate ran against preparation baseline `a9c1e80889b46da6c3a893501e8d9df69952d3d1`. Phase 2 starts from `9fdf5cd162ff3b49a9a5745180386934163891cf`, which adds the launch/acceptance evidence, Progress and lifecycle updates, and roadmap status. The enclosing implementation step owns all gate execution and result updates. [Launch manifest](launch.md#launch-manifest), [plan](../plan.md#phase-2-verify-the-local-delivery-contracts)

The verification scope covers local CLI configuration, isolation/setup, commits, skill-loop contracts, synthetic guard payloads and publication with the existing fake GitHub client and local repositories. Actual installed-host discovery, effective acceptance configuration, native guard denial and completed-run publication retain their pending criteria. [Acceptance record](acceptance.md#criteria)

## Scratch containment and Git discovery

The dedicated scratch parent is `.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117` beneath the absolute enclosing run root. Before creation, `git check-ignore .claude/worktrees/acceptance-first-unattended-delivery/scratch/placeholder` exited 0 and returned that path. The existing `.claude/worktrees/` exclusion keeps local scratch and raw logs out of enclosing commits. [Ignore rule](../../../../.gitignore)

The parent wrote a `.git` gitfile in the dedicated scratch parent pointing at its nonexistent `nonexistent-git-dir` child. With inherited `GIT_*` controls stripped, an uninitialized child returned exit 128 from `git rev-parse --show-toplevel` with `fatal: not a git repository: (null)`. An initialized child resolved its own root and HEAD `d85809d26659fa6dccb7b3df6c990d35dc325836`. This file boundary remains effective when test helpers strip process-level Git controls. The boundary assertion command exited 0. [Measured boundary](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/boundary.json), [helper behavior](../../../../skills/10x-pipeline/test/helpers.mjs)

The production execution-lock `TMPDIR` remains `/var/folders/my/ztvtzsw93c189l68dxvbs79m0000gn/T/`. Each test command supplies its dedicated `TMPDIR` only to that subprocess. The commands explicitly unset `GH_LIVE`. Production locks and their recovery retain router ownership.

The following procedure constructs the boundary when absent and verifies both discovery cases. It preserves the initialized fixture's existing HEAD on retries.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scratch = path.resolve(".claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
const ignored = spawnSync("git", ["check-ignore", "--", path.join(scratch, "placeholder")], { encoding: "utf8", env: clean });
assert.equal(ignored.status, 0, ignored.stderr);
fs.mkdirSync(scratch, { recursive: true });
const missing = path.join(scratch, "nonexistent-git-dir");
assert.equal(fs.existsSync(missing), false);
const gitfile = path.join(scratch, ".git");
const expected = `gitdir: ${missing}\n`;
if (fs.existsSync(gitfile)) assert.equal(fs.readFileSync(gitfile, "utf8"), expected);
else fs.writeFileSync(gitfile, expected);
const uninitialized = path.join(scratch, "boundary-uninitialized");
fs.mkdirSync(uninitialized, { recursive: true });
const denied = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: uninitialized, encoding: "utf8", env: clean });
assert.notEqual(denied.status, 0);
const initialized = path.join(scratch, "boundary-initialized");
fs.mkdirSync(initialized, { recursive: true });
function git(args) {
  const result = spawnSync("git", args, { cwd: initialized, encoding: "utf8", env: clean });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
git(["init", "-q"]);
const existing = spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: initialized, encoding: "utf8", env: clean });
if (existing.status !== 0) {
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "--allow-empty", "-qm", "test: verify scratch boundary"]);
}
assert.equal(git(["rev-parse", "--show-toplevel"]), initialized);
assert.match(git(["rev-parse", "HEAD"]), /^[0-9a-f]{40}$/);
console.log("PASS ignored scratch boundary and independent initialized fixture");
NODE
```

## Gate commands and results

The focused command uses the six existing suites named by the plan. The full command retains the repository's shell globs and concurrency. Each command starts from the absolute enclosing run root.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && env -u GH_LIVE TMPDIR="$PWD/.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117" node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/step-guard.test.mjs skills/10x-pipeline/test/open-pr.test.mjs > .claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-focused.log 2>&1
```

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && env -u GH_LIVE TMPDIR="$PWD/.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs > .claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-full.log 2>&1
```

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && node tools/version-check.mjs > .claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-version.log 2>&1
```

| Gate | Revision | Exit | Counts or result | Retained evidence |
| --- | --- | --- | --- | --- |
| Phase 1 full repository suite | `a9c1e80889b46da6c3a893501e8d9df69952d3d1` | 0 | 1798 tests, 1795 passed, 0 failed, 3 skipped, 0 cancelled, 807710.208208 ms | [Raw log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase1-full.log), [result](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase1-full-result.json) |
| Phase 2 focused suite | `9fdf5cd162ff3b49a9a5745180386934163891cf` | 0 | 248 tests, 248 passed, 0 failed, 0 skipped, 237359.781375 ms | [Raw log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-focused.log), [result](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-focused-result.json) |
| Phase 2 full repository suite | `9fdf5cd162ff3b49a9a5745180386934163891cf` | 0 | 1798 tests, 1795 passed, 0 failed, 3 skipped, 0 cancelled, 799523.393291 ms | [Raw log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-full.log), [result](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-full-result.json) |
| Phase 2 version alignment | `9fdf5cd162ff3b49a9a5745180386934163891cf` | 0 | `version-check: OK (1.13.0)` | [Raw log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-version.log) |
| Acceptance-configured scratch CLI | `a9c1e80889b46da6c3a893501e8d9df69952d3d1` | 0 | `action=run`, `host=claude`, `provider=claude`, `agent=agent-smith:step`; eight shipped Claude rungs | [Fixture result](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/provider-fixture.json) |

Both full-suite runs reported the same three skips listed below. The focused suite reported zero skips.

| Skipped test | Reason |
| --- | --- |
| `live: a branch with no pull request is skipped` | `GH_LIVE` is unset. The test requires a human-enabled network/authentication opt-in. |
| `live: the real comment projection is one parseable object per line across pages` | `GH_LIVE` is unset. The test requires a human-enabled network/authentication opt-in. |
| `CLAUDE.md has no @ imports` | The candidate has no root `CLAUDE.md`, so the existing conditional test skips. |

The skip identities and conditions agree with the existing test index and conditional source. [Test index](../../../../skills/openspec-pipeline/test/README.md), [conditional import test](../../../../tools/test/agents-md-no-imports.test.mjs)

## Provider and acceptance-configuration fixture

The parent copied the current project override, deleted only `ladder`, and asserted every remaining key equals its original value. The retained object has `compare.targetDropPercent=30` and `limits.maxNeutralRetries=3`. All eight shipped ladder positions resolve to `claude` through `providerOf`. The real router CLI returned a guarded Claude dispatch for the selected README goal with standard rigor, Chrome disabled and comments disabled. [Measured fixture](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/provider-fixture.json)

The existing `makeProject` helper additionally supplies `score.minRigor=null`, `isolation.require=false` and `manualVerify.minRigor=null` to its scratch override. Those fixture settings bound this CLI observation. The future acceptance source must preserve isolation and guard controls, commit its own configuration and independently retain its effective ladder. Existing default/explicit-Claude, mixed-ladder and immutable-host tests cover host/provider separation and saved-run compatibility. Existing setup-to-init fixtures cover committed-configuration transfer into isolation. [Helpers](../../../../skills/10x-pipeline/test/helpers.mjs), [provider tests](../../../../skills/10x-pipeline/test/providers.test.mjs), [setup tests](../../../../skills/10x-pipeline/test/prepare-run.test.mjs)

This reproduces the scratch fixture without launching a model or touching production run state. Cleanup uses the existing helper's `removeTree` procedure.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && env -u GH_LIVE TMPDIR="$PWD/.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117" node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, init, cleanupAll } from "./skills/10x-pipeline/test/helpers.mjs";
import { providerOf } from "./skills/10x-pipeline/scripts/state.mjs";

const shipped = JSON.parse(fs.readFileSync("skills/10x-pipeline/policy.json", "utf8"));
assert.ok(shipped.ladder.length > 0);
assert.ok(shipped.ladder.every(rung => providerOf(rung) === "claude"));
const original = JSON.parse(fs.readFileSync("context/foundation/agent-smith-policy.json", "utf8"));
const policy = structuredClone(original);
delete policy.ladder;
for (const key of Object.keys(policy)) assert.deepEqual(policy[key], original[key]);
try {
  const project = makeProject({ id: "claude-only-10x-example", policy });
  const goal = "Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically.";
  const result = init(project, goal, ["--host", "claude", "--rigor", "standard", "--chrome", "false", "--pr-comment", "false"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.action, "run", result.stdout);
  assert.equal(result.json.host, "claude");
  assert.equal(result.json.provider, "claude");
  assert.equal(result.json.agent, "agent-smith:step");
  const scratchPolicy = JSON.parse(fs.readFileSync(path.join(project.root, "context/foundation/agent-smith-policy.json"), "utf8"));
  assert.equal(scratchPolicy.isolation.require, false);
  assert.equal(scratchPolicy.score.minRigor, null);
  assert.equal(scratchPolicy.manualVerify.minRigor, null);
  for (const key of Object.keys(policy)) assert.deepEqual(scratchPolicy[key], policy[key]);
  console.log("PASS shipped Claude ladder, preserved unrelated overrides and guarded scratch CLI dispatch");
} finally {
  cleanupAll();
}
NODE
```

## Observed failures and compatibility

The observed-fix set is empty. Both full-suite gates, the focused gate and the configuration fixture passed. No first-flow production defect was reproduced. The delivered change consists of evidence, canonical Progress, change lifecycle and the skill-required roadmap status update. [Plan scope](../plan.md#phase-2-verify-the-local-delivery-contracts)

Policy loading remains the reader of project configuration and the owner of provider resolution. The router remains the writer of run logs, metadata and its existing step commits. Enclosing implementation owns evidence and canonical Progress. The top-level orchestrator owns publication. Existing data shapes, saved provider/host identity and mixed-version compatibility retain their existing contracts. This documentation/evidence stage performs no persisted-state migration or destructive contraction. [Migration notes](../plan.md#migration-notes)

Rollback preserves scratch observations, evidence, branches and commits. A failed future candidate is replaced by a separately pinned prior candidate in a fresh acceptance copy. Production execution recovery remains router-owned and retains its enabling revision and original `TMPDIR`.

## Delegation and remaining proof

Native Codex leaf `/root/phase2_verification` authored this record for enclosing `/root`, implementation step `n=3`, `startedAt=1794875227846`. Its write ownership is this file. The enclosing step collects its handback, executes gates, updates acceptance/Progress and makes authorized commits. Child-inclusive token coverage is unknown, so this record claims no token total.

Installed activation, native identity/denial, the fresh complete Claude-only run, and representative PR/CI/final-state evidence remain pending under Manual rows 3.1–3.3. No live acceptance attempt has been launched by this leaf. [Acceptance record](acceptance.md)

The parent collected the completed `/root/phase2_verification` handback before executing Phase 2 gates. Both retained inline boundary/provider commands exited 0 on retry. [Inline results](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/phase2-inline-results.json)

All five Automated criteria passed. The gate stack required no repair. Evidence assertions rejected ten malformed in-memory cases, and evidence link targets and whitespace checks passed. The three Manual criteria retain pending statuses in the acceptance record. Raw logs and scratch fixtures remain under the verified ignored acceptance parent.
