# Fresh Claude Delivery Launch

## Candidate and workload

Prepared for `first-unattended-delivery` on 2026-11-17 by leaf `/root/phase1_launch`, collected by enclosing Codex implementation step 3. The measured preparation baseline is `a9c1e80889b46da6c3a893501e8d9df69952d3d1` on `agent-smith/first-unattended-delivery`, with plugin version `1.13.0`. Commands were `git rev-parse HEAD`, `git branch --show-current` and reading `.claude-plugin/plugin.json`. The acceptance operator must pin the final committed S-12 candidate separately before creating the independent acceptance source. Installation and native activation remain pending.

The representative change is `claude-only-10x-example`. Extend README Configure with a recipe that restores the shipped Claude ladder in an OpenAI-configured project, preserves unrelated override keys, explains whole-array replacement and checks effective providers before a fresh run. Its implementation checks remain locally executable. This workload, headless mode, remote and base follow the approved plan. [plan.md](../plan.md)

## Launch manifest

Measured values describe this preparation environment. Null observations have sibling pending reasons. Intended paths and invocation values describe the selected future acceptance setup. The acceptance project has not been created by this leaf.

```json
{
  "candidate": {
    "preparationSha": "a9c1e80889b46da6c3a893501e8d9df69952d3d1",
    "preparationBranch": "agent-smith/first-unattended-delivery",
    "pluginVersion": "1.13.0",
    "source": "https://github.com/xycu/agent-smith",
    "acceptanceSha": null,
    "acceptanceShaPending": "Pin the final committed S-12 candidate before independent-clone preparation and installation.",
    "installedSha": null,
    "installedShaPending": "The acceptance top-level session must establish the installed plugin source revision.",
    "configurationCommit": null,
    "configurationCommitPending": "Commit the acceptance-only policy and depth settings before prepare-run creates isolation.",
    "changePreparationCommit": null,
    "changePreparationCommitPending": "Create the representative identity with the installed 10x-new skill in the independent acceptance source."
  },
  "versions": {
    "observedAt": "2026-11-17T00:29:32.336Z",
    "node": "v24.19.0",
    "git": "git version 2.54.0 (Apple Git-157)",
    "claude": "2.1.311 (Claude Code)",
    "floors": { "nodeMajor": 24, "pipelineClaude": "2.1.292", "failClosedHooksClaude": "2.1.295" },
    "toolkit": {
      "10x-new": { "sha256": null, "sha256Pending": "Discover and hash the installed creation skill before prelaunch change creation." },
      "10x-plan": { "sha256": null, "sha256Pending": "Discover and hash the installed skill in a fresh intended-host child." },
      "10x-plan-review": { "sha256": null, "sha256Pending": "Discover and hash the installed skill in a fresh intended-host child." },
      "10x-goal-implement": { "sha256": null, "sha256Pending": "Discover and hash the installed skill in a fresh intended-host child." },
      "10x-impl-review": { "sha256": null, "sha256Pending": "Discover and hash the installed skill in a fresh intended-host child." }
    }
  },
  "paths": {
    "runRoot": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery",
    "acceptanceParent": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery/.claude/worktrees/acceptance-first-unattended-delivery",
    "projectRoot": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery/.claude/worktrees/acceptance-first-unattended-delivery/project",
    "generatedRunRoot": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery/.claude/worktrees/acceptance-first-unattended-delivery/project/.claude/worktrees/agent-smith-claude-only-10x-example",
    "changeSource": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery/.claude/worktrees/acceptance-first-unattended-delivery/project/context/changes/claude-only-10x-example/change.md",
    "transcriptRoot": "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery/.claude/worktrees/acceptance-first-unattended-delivery/transcripts",
    "installedPluginRoot": null,
    "installedPluginRootPending": "Record the absolute candidate installation path through acceptance-host discovery before launch."
  },
  "invocation": {
    "changeId": "claude-only-10x-example",
    "mode": "headless",
    "host": "claude",
    "rigor": "standard",
    "chrome": false,
    "prComment": false,
    "archive": false,
    "remote": "origin",
    "remoteUrl": "git@github.com:xycu/agent-smith.git",
    "base": "main",
    "branch": "agent-smith/claude-only-10x-example",
    "preparationSlashArgument": "/10x-new claude-only-10x-example",
    "slashArgument": "/agent-smith:10x-pipeline claude-only-10x-example \"Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically.\" --rigor standard --chrome false --pr-comment false",
    "changeCreated": null,
    "changeCreatedPending": "Verify id uniqueness, discover 10x-new, create change.md and retain its identity and Notes before launch.",
    "nativeDiscovery": null,
    "nativeDiscoveryPending": "A fresh Claude child from the intended generated run root must discover the pinned plugin and all four workflow toolkit skills.",
    "nativeGuard": null,
    "nativeGuardPending": "Retain native Agent schema, guarded agent/hook identity, authorized work and safe denial observations.",
    "trustAndAccountReadiness": null,
    "trustAndAccountReadinessPending": "The acceptance top-level session must observe project trust, effective permissions, quota, model access and publication credentials."
  },
  "effectivePolicy": {
    "source": "Candidate plugin defaults after deleting only the fresh acceptance project's ladder override",
    "shippedProviders": ["claude", "claude", "claude", "claude", "claude", "claude", "claude", "claude"],
    "policySha256": "30236118e8dba18b112fe6968a939c827e4587343972b0a1b42ea021fc62ef9f",
    "openspecPolicySha256": "0c6301f80ccdee1d8be8887dbbcbac989a05f3466bd2c7a71c3f7446e91a99d0",
    "ladder": null,
    "ladderPending": "Measure loadPolicy().ladder in the committed acceptance source and generated run root before launch.",
    "configurationSha256": null,
    "configurationSha256Pending": "Hash the acceptance source override after deleting only ladder and committing preparation.",
    "configuredSpawnDepth": "2",
    "effectiveSpawnDepth": null,
    "effectiveSpawnDepthPending": "Observe inherited depth two in the fresh acceptance host.",
    "hooksSha256": "7e1eb5c8856486d998dbd3b09986b9b411d9a2e0e910b5a53c670b331e2e7f41",
    "hookContract": "PreToolUse Bash, node step-guard.mjs, synchronous, onFailure block",
    "effectiveHooks": null,
    "effectiveHooksPending": "Retain native hook delivery and denial evidence from the installed candidate."
  }
}
```

Observed version commands were `node --version`, `git --version` and `claude --version`, each exit 0. Version floors above are historical documented prerequisites. Hashes use Node `createHash("sha256").update(readFileSync(file)).digest("hex")` over the named candidate files. Shipped providers were measured through `pluginPolicy().ladder.map(providerOf)` from `skills/10x-pipeline/scripts/state.mjs`. The current Codex project's OpenAI override remains owned by its active run. [state.mjs](../../../../skills/10x-pipeline/scripts/state.mjs), [README.md](../../../../README.md)

## Prelaunch preparation

The authorized acceptance top-level session performs this preparation before the zero-steering attempt window.

1. Repin `candidate.acceptanceSha` to the committed S-12 candidate and record its plugin version. From the enclosing run root, run `git check-ignore -- .claude/worktrees/acceptance-first-unattended-delivery/project/probe` before creating acceptance storage. Confirm the existing `.claude/worktrees/` exclusion. Create an independent clone of the pinned candidate at `paths.projectRoot`. Set and verify the recorded `origin` URL and `main` base. Retain `git rev-parse --show-toplevel` and `git rev-parse --path-format=absolute --git-common-dir` from that project, asserting both beneath `paths.projectRoot` and independent of the enclosing Git directory.
2. In that acceptance source, read `context/foundation/agent-smith-policy.json`, retain the original object, delete only its `ladder` property, and write the remaining object. Assert deep equality with the original object after removing `ladder`. Retain all unrelated keys and existing isolation and guard controls. Commit that policy and the documented `.claude/settings.json` spawn-depth setting before worktree creation. Record the configuration commit and SHA-256. Arrays replace whole under the existing merge. [state.mjs](../../../../skills/10x-pipeline/scripts/state.mjs), [prepare-run.mjs](../../../../skills/10x-pipeline/scripts/prepare-run.mjs)
3. Establish installation source, resolved absolute plugin root, installed revision and toolkit hashes through host discovery. The recorded installed revision must match the acceptance candidate. Check actual path substitution and quoting. If the path exposes the parked quoting dependency, retain the observation and follow its existing owner-directed resumption procedure. [WAVES.md](../../WAVES.md), [quote-router-in-skill-loops](../../quote-router-in-skill-loops/change.md)
4. Check that `claude-only-10x-example` has no live or archived owner across both `context/` and `openspec/`, and no saved run. Use directory and identity-file inspection across every chain. Discover the installed `10x-new` creation skill. From the independent acceptance source, execute `claude -p '/10x-new claude-only-10x-example'`, retaining the command and transcript beneath `paths.transcriptRoot`. Record the README goal above in the resulting Notes and verify `change_id: claude-only-10x-example`. Record preparation identity and source commit separately from candidate/configuration commits. Missing creation-skill discovery leaves this prerequisite pending.
5. Verify `loadPolicy().ladder` with `providerOf` in the committed acceptance configuration. Retain its actual rungs and provenance, then confirm the same effective policy in the generated worktree. A fresh child from that worktree must discover `10x-plan`, `10x-plan-review`, `10x-goal-implement` and `10x-impl-review`, the pinned plugin and `agent-smith:step`. Record actual Agent schema, fresh session identity, effective trust, permissions, depth, account/model readiness and native hook identity.
6. In a separate disposable scratch project beneath the ignored acceptance parent, retain HEAD and status, invoke the guarded native child with `git checkout -h`, and retain denial before execution plus unchanged HEAD/status. Retain authorized Write/Edit/local commit evidence in the generated worktree. Fixture payloads retain their local-test scope. The safe help command remains read-only if a hook is absent.
7. Fill every pending prelaunch observation, run the manifest assertion below, and assert the prepared `change.md` exists with the chosen identity. Append a stable attempt record before launching. Begin the zero-steering window at the normal-entry command below. Preserve every failed or blocked attempt and every subsequent intervention count.

The creation command and normal-entry command run from the independent acceptance source. Every shell session first enters the enclosing run root, then the manifest's prepared project root.

## Normal entry

Pass the entire slash invocation as the single `-p` argument. The acceptance orchestrator owns all transitions and terminal publication.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && cd ".claude/worktrees/acceptance-first-unattended-delivery/project" && claude -p '/agent-smith:10x-pipeline claude-only-10x-example "Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically." --rigor standard --chrome false --pr-comment false'
```

Archive and report comments remain opt-outs for this qualification. Record actual route, terminal action and review outcome, elapsed time, unedited enclosing RESULT reports, invocation/child collection associations and measured usage scope. A halt or post-launch permission/correction intervention is an unsuccessful attempt. Follow router-owned settlement/recovery for any execution lock, retaining the enabling revision and production TMPDIR. [SKILL.md](../../../../skills/10x-pipeline/SKILL.md)

## Local manifest assertion

This checks the launch specification while retaining explicit pending prerequisites. Before an actual launch, fill all pending fields and retain the independent-source and generated-worktree observations above. The conditional identity check becomes mandatory when `changeCreated` is true.

```sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pluginPolicy, providerOf } from "./skills/10x-pipeline/scripts/state.mjs";

const file = "context/changes/first-unattended-delivery/evidence/launch.md";
const text = fs.readFileSync(file, "utf8");
const manifests = [...text.matchAll(/^```json\n([\s\S]*?)\n```$/gm)];
assert.equal(manifests.length, 1);
const m = JSON.parse(manifests[0][1]);
for (const key of ["candidate", "versions", "paths", "invocation", "effectivePolicy"]) {
  assert.ok(m[key] && typeof m[key] === "object" && !Array.isArray(m[key]), key);
}
assert.match(m.candidate.preparationSha, /^[0-9a-f]{40}$/);
assert.match(m.candidate.pluginVersion, /^\d+\.\d+\.\d+/);
assert.match(m.versions.node, /^v(?:2[4-9]|[3-9]\d)\./);
for (const key of ["git", "claude", "observedAt"]) assert.ok(m.versions[key]?.trim(), key);
const root = fs.realpathSync(process.cwd());
assert.equal(m.paths.runRoot, root);
for (const [key, value] of Object.entries(m.paths)) {
  if (key.endsWith("Pending") || value === null) continue;
  assert.ok(path.isAbsolute(value), key);
  assert.equal(value, path.resolve(value), "canonical path " + key);
  assert.ok(value === root || value.startsWith(root + path.sep), key);
  let ancestor = value;
  while (!fs.lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = path.dirname(ancestor);
  const physical = fs.realpathSync(ancestor);
  assert.ok(physical === root || physical.startsWith(root + path.sep), "physical path " + key);
}
assert.equal(m.paths.projectRoot, path.join(m.paths.acceptanceParent, "project"));
assert.equal(m.paths.changeSource, path.join(m.paths.projectRoot, "context/changes/claude-only-10x-example/change.md"));
assert.ok(m.paths.generatedRunRoot.startsWith(m.paths.projectRoot + path.sep));
assert.equal(m.invocation.changeId, "claude-only-10x-example");
assert.equal(m.invocation.preparationSlashArgument, "/10x-new claude-only-10x-example");
assert.equal(m.invocation.host, "claude");
assert.equal(m.invocation.mode, "headless");
assert.equal(m.invocation.remote, "origin");
assert.equal(m.invocation.remoteUrl, "git@github.com:xycu/agent-smith.git");
assert.equal(m.invocation.base, "main");
assert.equal(m.invocation.branch, "agent-smith/claude-only-10x-example");
assert.equal(m.invocation.rigor, "standard");
for (const flag of ["chrome", "prComment", "archive"]) assert.equal(m.invocation[flag], false);
const slash = '/agent-smith:10x-pipeline claude-only-10x-example "Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically." --rigor standard --chrome false --pr-comment false';
assert.equal(m.invocation.slashArgument, slash);
assert.ok(text.includes("claude -p '" + slash + "'"));
const shipped = pluginPolicy().ladder.map(providerOf);
assert.ok(shipped.length > 0 && shipped.every(provider => provider === "claude"));
assert.deepEqual(m.effectivePolicy.shippedProviders, shipped);
if (m.effectivePolicy.ladder !== null) {
  assert.ok(Array.isArray(m.effectivePolicy.ladder) && m.effectivePolicy.ladder.length > 0);
  assert.ok(m.effectivePolicy.ladder.every(rung => providerOf(rung) === "claude"));
}
function pendingReasons(object) {
  for (const [key, value] of Object.entries(object)) {
    if (value === null) assert.ok(object[key + "Pending"]?.trim(), key);
    else if (typeof value === "object") pendingReasons(value);
  }
}
pendingReasons(m);
assert.equal(m.effectivePolicy.configuredSpawnDepth, "2");
if (m.invocation.changeCreated === true) {
  assert.match(fs.readFileSync(m.paths.changeSource, "utf8"), /^change_id:\s*claude-only-10x-example\s*$/m);
} else {
  assert.equal(m.invocation.changeCreated, null);
  assert.ok(m.invocation.changeCreatedPending);
}
console.log("PASS launch manifest, shipped Claude providers and explicit pending prerequisites");
NODE
```

## Retention and rollback

Keep raw transcripts under the ignored acceptance parent and durable summaries under this evidence directory. Preserve attempt identities, clones, source/run branches, commits and original configuration evidence. Repin a prior candidate into a fresh acceptance copy when a repair fails. Saved run host/provider history and router-owned recovery retain their ownership. Destructive migration or contraction requires a separately revised plan. [plan.md](../plan.md)
