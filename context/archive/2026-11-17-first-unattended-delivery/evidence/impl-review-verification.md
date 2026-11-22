# Implementation Review Verification

Review baseline: 82baa6dfa54c12a4713e453ef88ebf64d5145431. Two evidence-check defects were reproduced; production code and saved-run formats are unchanged. Original inventory outputs remain historical evidence.

## Reproduced defects and ownership

- F1: launch.md and script-manual-inventory.mjs accepted a raw path prefix containing .. that resolves outside the run root. The original launch assertion returned exit 0 for transcriptRoot = runRoot + "/../outside-run-root". Both readers now require canonical absolute paths and check the real path of the nearest existing ancestor.
- F2: script-manual-retry.mjs queried git for-each-ref with *first-unattended-delivery* and returned no refs despite the existing refs/heads/agent-smith/first-unattended-delivery. It now enumerates refs and filters complete names in JavaScript.

All affected readers are in this evidence directory. There are no production callers or persisted-data changes. The forward path corrects these evidence readers; rollback preserves earlier observations and reverts only these corrections through a new commit. Active run state, Progress and acceptance attempts retain their ownership.

[Before-fix reproduction](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-before.json) retains both failures. The production first-flow fix set in verification.md remains empty; these are review fixes to evidence validation.

## Regression command

This exercises the actual launch/inventory code with in-memory manifests and an isolated symlink fixture. It checks valid pending paths, traversal, sibling-prefix and physical escapes, and discovery of the existing run branch without writing refs.

~~~sh
cd "/Users/blazej/.codex/worktrees/d076/agent-smith/.claude/worktrees/agent-smith-first-unattended-delivery" && node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { removeTree } from "./skills/10x-pipeline/scripts/remove-tree.mjs";

const root = fs.realpathSync(process.cwd());
const evidence = "context/changes/first-unattended-delivery/evidence/";
const launch = fs.readFileSync(evidence + "launch.md", "utf8");
const fence = String.fromCharCode(96).repeat(3);
const jsonBlock = new RegExp("^" + fence + "json\\n([\\s\\S]*?)\\n" + fence + "$", "m");
const manifest = JSON.parse(launch.match(jsonBlock)[1]);
const launchCode = launch.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/)[1];
const inventoryCode = fs.readFileSync(evidence + "script-manual-inventory.mjs", "utf8");
function run(code, value) {
  const changed = structuredClone(manifest);
  changed.paths.transcriptRoot = value;
  const document = launch.replace(jsonBlock, fence + "json\n" + JSON.stringify(changed) + "\n" + fence);
  const injection = 'import injectedFs from "node:fs"; const originalRead = injectedFs.readFileSync; injectedFs.readFileSync = function(file, ...args) { return String(file).endsWith("/launch.md") ? ' + JSON.stringify(document) + ' : originalRead.call(this, file, ...args); };\n';
  return spawnSync(process.execPath, ["--input-type=module"], { input: injection + code, encoding: "utf8" });
}
const scratch = path.join(root, ".claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117");
const fixture = fs.mkdtempSync(path.join(scratch, "review-paths-"));
const results = [];
try {
  fs.symlinkSync(path.dirname(root), path.join(fixture, "escape"));
  fs.symlinkSync(path.join(fixture, "missing"), path.join(fixture, "dangling"));
  for (const [reader, code] of [["launch", launchCode], ["inventory", inventoryCode]]) {
    const valid = run(code, manifest.paths.transcriptRoot);
    assert.equal(valid.status, 0, valid.stderr);
    for (const [name, value] of [
      ["traversal", root + "/../outside-run-root"],
      ["sibling-prefix", root + "-outside/transcripts"],
      ["symlink-ancestor", path.join(fixture, "escape", "not-created", "transcripts")],
      ["dangling-symlink", path.join(fixture, "dangling", "transcripts")],
    ]) {
      const result = run(code, value);
      assert.notEqual(result.status, 0, reader + " accepted " + name);
      results.push(reader + " rejects " + name);
    }
  }
  const retry = fs.readFileSync(evidence + "script-manual-retry.mjs", "utf8")
    .replace('import "./script-manual-inventory.mjs";\n', "")
    .replace('const id = "claude-only-10x-example";', 'const id = "first-unattended-delivery";');
  const found = spawnSync(process.execPath, ["--input-type=module"], { input: retry, encoding: "utf8" });
  assert.equal(found.status, 0, found.stderr);
  const refs = JSON.parse(found.stdout.match(/^Matching local representative refs=(.*)$/m)[1]);
  assert.ok(refs.includes("refs/heads/agent-smith/first-unattended-delivery"));
  results.push("retry inventory finds existing namespaced run branch");
  console.log(JSON.stringify({ status: "PASS", validReaders: 2, regressions: results }, null, 2));
} finally {
  removeTree(fixture);
}
NODE
~~~

## Results

All commands below exited 0 on Node v24.19.0. The post-fix focused run started at 2026-11-17T01:23:12Z; the full run started at 01:21:10Z and finished at 01:34:37Z on 2026-11-17.

| Check | Result | Evidence |
| --- | --- | --- |
| Launch manifest, eight-row coverage, scratch boundary, Claude provider fixture | Four exit-0 checks after fixes | [Inline results](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-inline-results.json) |
| Evidence-reader regressions above | Two valid readers and nine regression cases passed | [Output](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-regressions.txt) |
| Focused six-suite gate after fixes | 248 tests passed, zero failures/skips, 245887.3565 ms | [Log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-focused-postfix.log), [exact command, times and exit](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-focused-postfix.json) |
| Full repository gate after fixes | 1798 tests, 1795 passed, zero failures, three skipped, 806961.429792 ms | [Log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-full.log), [exact commands, times and exits](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-gates.json) |
| Version alignment | version-check: OK (1.13.0) | [Log](../../../../.claude/worktrees/acceptance-first-unattended-delivery/scratch/local-20261117/impl-review-version.log) |
| Corrected manual inventory | Exit 0; native acceptance still pending | [Inventory output](script-manual-review-output.txt) |

The three skips are the two human-opt-in GH_LIVE comment tests and the conditional CLAUDE.md import test because the root CLAUDE.md is absent. Live opt-in tests stayed disabled. Gate commands are the plan's exact Node commands with the existing bounded test-only TMPDIR and distinct review log filenames; production execution-lock TMPDIR is unchanged.

The initial review focused run also passed 248/248 before the dedicated post-fix rerun. Only the latter is used for the final post-fix claim. Evidence link targets and whitespace checks pass. No new production defect was observed.

Native Claude discovery, guard delivery, a complete unattended run and representative publication remain pending under Manual criteria 3.1–3.3. Earlier outputs and attempts are preserved. The review fixes do not certify live acceptance.
