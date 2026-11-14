// version-check: versions and descriptions agree, invalid fields are named, and the CLI is read-only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check, collect } from "../version-check.mjs";
import { removeTree } from "../../skills/10x-pipeline/scripts/remove-tree.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../version-check.mjs");
const created = [];

function makeRoot({ plugin = "0.1.0", meta = "0.1.0", entry, manifest = "0.1.0", pluginFields = {}, entryFields = {} } = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "vc-"));
  created.push(root);
  fs.mkdirSync(path.join(root, ".claude-plugin"));
  fs.writeFileSync(path.join(root, ".claude-plugin/plugin.json"), JSON.stringify({ name: "x", version: plugin, description: "Run workflows", ...pluginFields }));
  fs.writeFileSync(
    path.join(root, ".claude-plugin/marketplace.json"),
    JSON.stringify({ name: "x", metadata: { version: meta }, plugins: [{ name: "x", description: "Run workflows", ...entryFields, ...(entry === undefined ? {} : { version: entry }) }] }),
  );
  if (manifest !== null) fs.writeFileSync(path.join(root, ".release-please-manifest.json"), JSON.stringify({ ".": manifest }));
  return root;
}

test.after(() => {
  for (const dir of created) removeTree(dir);
});

test("equal valid versions pass", () => {
  assert.deepEqual(check(makeRoot()), []);
  assert.deepEqual(check(makeRoot({ plugin: "1.2.3-rc.1+build.5", meta: "1.2.3-rc.1+build.5", manifest: "1.2.3-rc.1+build.5" })), []);
});

test("a drifted field is named", () => {
  const errors = check(makeRoot({ meta: "0.2.0" }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /marketplace\.json:metadata\.version/);
});

test("a version in a marketplace plugin entry fails", () => {
  for (const entry of ["0.1.0", "0.2.0", null]) {
    const errors = check(makeRoot({ entry }));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /plugins\[0\]\.version must not be set/);
  }
  const second = makeRoot();
  fs.writeFileSync(
    path.join(second, ".claude-plugin/marketplace.json"),
    JSON.stringify({ name: "x", metadata: { version: "0.1.0" }, plugins: [{ name: "x", description: "Run workflows" }, { name: "y", version: "0.1.0" }] }),
  );
  assert.match(check(second)[0], /plugins\[1\]\.version must not be set/);
  for (const plugins of [[null], "x", [], undefined, null, {}, { 0: { description: "Run workflows" } }]) {
    const odd = makeRoot();
    fs.writeFileSync(path.join(odd, ".claude-plugin/marketplace.json"), JSON.stringify({ name: "x", metadata: { version: "0.1.0" }, plugins }));
    assert.deepEqual(check(odd), ["marketplace.json:plugins[0].description must be a nonblank string"]);
  }
});

test("the release-please manifest is required and checked", () => {
  assert.deepEqual(check(makeRoot({ manifest: "0.1.0" })), []);
  const absent = makeRoot();
  fs.rmSync(path.join(absent, ".release-please-manifest.json"));
  assert.match(check(absent)[0], /release-please-manifest\.json cannot be read/);
  const errors = check(makeRoot({ manifest: "0.2.0" }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\.release-please-manifest\.json:\./);
  const missing = makeRoot();
  fs.writeFileSync(path.join(missing, ".release-please-manifest.json"), "{}");
  assert.match(check(missing)[0], /manifest\.json:\. is missing/);
});

test("release-please-config.json updates every file the guard reads", () => {
  const repo = path.resolve(path.dirname(SCRIPT), "..");
  const config = JSON.parse(fs.readFileSync(path.join(repo, "release-please-config.json"), "utf8"));
  const extra = config.packages["."]["extra-files"];
  const byPath = new Map(extra.map((entry) => [entry.path, entry]));
  assert.equal(byPath.get(".claude-plugin/plugin.json")?.jsonpath, "$.version");
  assert.equal(byPath.get(".claude-plugin/marketplace.json")?.jsonpath, "$.metadata.version");
  assert.equal(extra.length, 2);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".claude-plugin/marketplace.json"), "utf8"));
  const found = JSON.stringify(manifest).match(/"version"/g).length;
  assert.equal(found, 1, "a new version key in marketplace.json would not be updated by $.metadata.version");
  assert.ok(manifest.plugins.every((p) => !("version" in p)));
});

test("a version that is not SemVer fails", () => {
  for (const bad of ["1.0", "v1.0.0", "01.0.0", "1.0.0.0", ""]) {
    const errors = check(makeRoot({ plugin: bad, meta: bad, manifest: bad }));
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

test("collect exposes only the three version fields", () => {
  assert.deepEqual(collect(makeRoot()), [
    ["plugin.json:version", "0.1.0"],
    ["marketplace.json:metadata.version", "0.1.0"],
    [".release-please-manifest.json:.", "0.1.0"],
  ]);
});

test("matching nonblank descriptions pass with exact text preserved", () => {
  assert.deepEqual(check(makeRoot()), []);
  assert.deepEqual(check(makeRoot({
    pluginFields: { description: " Run workflows " },
    entryFields: { description: " Run workflows " },
  })), []);
});

test("description drift in either manifest names both fields", () => {
  for (const fields of ["pluginFields", "entryFields"]) {
    for (const description of ["Different workflows", "Run workflows "]) {
      assert.deepEqual(check(makeRoot({ [fields]: { description } })), [
        "plugin.json:description and marketplace.json:plugins[0].description must match exactly",
      ]);
    }
  }
});

test("missing, non-string and blank descriptions name their field", () => {
  for (const [fields, label] of [
    ["pluginFields", "plugin.json:description"],
    ["entryFields", "marketplace.json:plugins[0].description"],
  ]) {
    for (const description of [undefined, null, 42, true, {}, [], "", " \t\n"]) {
      assert.deepEqual(check(makeRoot({ [fields]: { description } })), [
        `${label} must be a nonblank string`,
      ]);
    }
  }
  assert.deepEqual(check(makeRoot({
    pluginFields: { description: undefined },
    entryFields: { description: undefined },
  })), [
    "plugin.json:description must be a nonblank string",
    "marketplace.json:plugins[0].description must be a nonblank string",
  ]);
});

test("the CLI exits 1 on description drift and leaves manifests unchanged", () => {
  const root = makeRoot({ pluginFields: { description: "Different workflows" } });
  const files = [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", ".release-please-manifest.json"];
  const before = files.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
  const script = path.join(root, "tools/version-check.mjs");
  fs.mkdirSync(path.dirname(script));
  fs.copyFileSync(SCRIPT, script);
  const run = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(run.status, 1, run.stderr);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /version-check: version or description fields drift or are invalid/);
  assert.match(run.stderr, /plugin\.json:description and marketplace\.json:plugins\[0\]\.description must match exactly/);
  assert.deepEqual(files.map((file) => fs.readFileSync(path.join(root, file), "utf8")), before);
});
