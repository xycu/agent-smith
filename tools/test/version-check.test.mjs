// version-check: all version fields equal and valid SemVer, drift and bad values fail with the field named.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check } from "../version-check.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../version-check.mjs");
const created = [];

function makeRoot({ plugin = "0.1.0", meta = "0.1.0", entry = "0.1.0" } = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "vc-"));
  created.push(root);
  fs.mkdirSync(path.join(root, ".claude-plugin"));
  fs.writeFileSync(path.join(root, ".claude-plugin/plugin.json"), JSON.stringify({ name: "x", version: plugin }));
  fs.writeFileSync(
    path.join(root, ".claude-plugin/marketplace.json"),
    JSON.stringify({ name: "x", metadata: { version: meta }, plugins: [{ name: "x", version: entry }] }),
  );
  return root;
}

test.after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

test("equal valid versions pass", () => {
  assert.deepEqual(check(makeRoot()), []);
  assert.deepEqual(check(makeRoot({ plugin: "1.2.3-rc.1+build.5", meta: "1.2.3-rc.1+build.5", entry: "1.2.3-rc.1+build.5" })), []);
});

test("a drifted field is named", () => {
  const errors = check(makeRoot({ entry: "0.2.0" }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /marketplace\.json:plugins\[0\]\.version/);
  const both = check(makeRoot({ meta: "0.3.0", entry: "0.2.0" }));
  assert.equal(both.length, 2);
});

test("a version that is not SemVer fails", () => {
  for (const bad of ["1.0", "v1.0.0", "01.0.0", "1.0.0.0", ""]) {
    const errors = check(makeRoot({ plugin: bad, meta: bad, entry: bad }));
    assert.ok(errors.length >= 1, `"${bad}" must fail`);
    assert.match(errors[0], /not a SemVer 2\.0\.0 version/);
  }
});

test("a missing file or field is an error message, not a throw", () => {
  const noFile = makeRoot();
  fs.rmSync(path.join(noFile, ".claude-plugin/marketplace.json"));
  assert.match(check(noFile)[0], /marketplace\.json cannot be read/);

  const noField = makeRoot();
  fs.writeFileSync(path.join(noField, ".claude-plugin/plugin.json"), JSON.stringify({ name: "x" }));
  assert.match(check(noField)[0], /plugin\.json:version is missing/);

  const badJson = makeRoot();
  fs.writeFileSync(path.join(badJson, ".claude-plugin/plugin.json"), "{");
  assert.match(check(badJson)[0], /plugin\.json is not valid JSON/);
});

test("the CLI exits 0 on the repository and prints the version", () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /version-check: OK \(\d+\.\d+\.\d+/);
});
