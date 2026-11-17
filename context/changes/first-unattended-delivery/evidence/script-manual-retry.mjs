import "./script-manual-inventory.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.realpathSync(process.cwd());
const id = "claude-only-10x-example";
console.log("Alternate proof search for retained representative artifacts and local refs");
for (const relative of [
  ".claude/worktrees/acceptance-first-unattended-delivery",
  "context/changes/" + id,
  "openspec/changes/" + id,
]) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    console.log(relative + " exists=false");
    continue;
  }
  assert.ok(fs.realpathSync(target).startsWith(root + path.sep));
  console.log(relative + " entries=" + JSON.stringify(fs.readdirSync(target).sort()));
}
const refs = spawnSync("git", ["for-each-ref", "--format=%(refname)", "*" + id + "*"], {
  cwd: root, encoding: "utf8", timeout: 10000,
});
assert.equal(refs.error, undefined);
assert.equal(refs.status, 0, refs.stderr);
console.log("Matching local representative refs=" + JSON.stringify(refs.stdout.trim().split("\n").filter(Boolean)));
console.log("Exit 0 establishes inventory completion only. Manual acceptance requires the live observations specified in the plan.");
