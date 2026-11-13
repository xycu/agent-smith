// pr-title-workflow: pr-title.yml lints the pull request title in its own workflow (ADR-008, Amendment 2).
// It must not share ci.yml's cancel group, must not use pull_request_target, and must keep the title out of the shell text.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dir = new URL("../../.github/workflows/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, dir), "utf8");
const wf = read("pr-title.yml");

test("pr-title.yml runs on the four title and head events and nothing else", () => {
  const types = /^ {4}types: \[(.*)\]\s*$/m.exec(wf);
  assert.ok(types, "types line");
  assert.deepEqual(types[1].split(",").map((t) => t.trim()), ["opened", "edited", "synchronize", "reopened"]);
});

test("no workflow uses pull_request_target", () => {
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".yml"))) {
    assert.doesNotMatch(read(name), /^\s*pull_request_target\s*:|pull_request_target\s*[\]\n,]/m, name);
  }
});

test("the concurrency group is keyed by the pull request number, not the ref", () => {
  const group = wf.split("\n").find((l) => l.trim().startsWith("group:"));
  assert.match(group, /pull_request\.number/);
  assert.doesNotMatch(group, /github\.ref/);
  assert.match(wf, /cancel-in-progress: true/);
});

test("the title reaches the lint step through env, not through the run text", () => {
  assert.match(wf, /env:\n\s+TITLE: \$\{\{ github\.event\.pull_request\.title \}\}/);
  const run = wf.split("\n").find((l) => l.includes("commit-lint.mjs --title"));
  assert.ok(run, "lint run line");
  assert.doesNotMatch(run, /\$\{\{/);
  assert.match(run, /--title "\$TITLE"/);
});

test("the workflow is not named CI, so release.yml never starts from it", () => {
  assert.match(wf, /^name: PR title$/m);
  assert.doesNotMatch(wf, /^name: CI$/m);
});

test("ci.yml has no edited trigger and no types under pull_request", () => {
  const ci = read("ci.yml");
  assert.doesNotMatch(ci, /\bedited\b/);
  const on = ci.slice(ci.indexOf("\non:"), ci.indexOf("\npermissions:"));
  assert.doesNotMatch(on, /types:/);
});
