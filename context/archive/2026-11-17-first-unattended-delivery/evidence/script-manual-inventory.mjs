import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.realpathSync(process.cwd());
const evidence = path.join(root, "context/changes/first-unattended-delivery/evidence");
const launch = fs.readFileSync(path.join(evidence, "launch.md"), "utf8");
const manifest = JSON.parse(launch.match(/^```json\n([\s\S]*?)\n```$/m)[1]);
assert.equal(manifest.paths.runRoot, root);
console.log("Read-only inventory for pending Manual rows 3.1, 3.2 and 3.3");
console.log("Observed at " + new Date().toISOString());
for (const key of ["projectRoot", "generatedRunRoot", "changeSource", "transcriptRoot"]) {
  const target = manifest.paths[key];
  assert.ok(path.isAbsolute(target));
  assert.equal(target, path.resolve(target), "canonical path " + key);
  assert.ok(target.startsWith(root + path.sep));
  let ancestor = target;
  while (!fs.lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = path.dirname(ancestor);
  const physical = fs.realpathSync(ancestor);
  assert.ok(physical === root || physical.startsWith(root + path.sep), "physical path " + key);
  console.log(key + ": " + path.relative(root, target) + " exists=" + fs.existsSync(target));
}
for (const [section, keys] of Object.entries({
  candidate: ["acceptanceSha", "installedSha", "configurationCommit", "changePreparationCommit"],
  invocation: ["changeCreated", "nativeDiscovery", "nativeGuard", "trustAndAccountReadiness"],
  effectivePolicy: ["ladder", "effectiveSpawnDepth", "effectiveHooks"],
})) {
  for (const key of keys) console.log(section + "." + key + "=" + JSON.stringify(manifest[section][key]));
}
const acceptance = fs.readFileSync(path.join(evidence, "acceptance.md"), "utf8");
console.log("Recorded no-attempt statement=" + acceptance.includes("No attempt records exist yet."));
for (const line of acceptance.split("\n").filter(line => /^\| 3\.[123] \|/.test(line))) console.log(line);
for (const args of [["rev-parse", "HEAD"], ["branch", "--show-current"], ["status", "--short"]]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  console.log("git " + args.join(" ") + "\n" + result.stdout.trimEnd());
}
console.log("Inventory only. Native host enforcement, completed delivery and published PR acceptance remain unproved.");
