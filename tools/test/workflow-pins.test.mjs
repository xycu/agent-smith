// workflow-pins: every remote action under .github is pinned to a full commit SHA with a version comment.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check, files, findUses } from "../workflow-pins.mjs";
import { removeTree } from "../../skills/10x-pipeline/scripts/remove-tree.mjs";

const SHA = "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09";
const GOOD = `      - uses: actions/checkout@${SHA} # v5.1.0\n`;
const created = [];

// Writes { "relative/path": text } into a new scratch root.
function makeRoot(tree) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "wp-"));
  created.push(root);
  for (const [rel, text] of Object.entries(tree)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test.after(() => {
  for (const dir of created) removeTree(dir);
});

test("every remote action of this repository is pinned to a commit SHA with a version comment", () => {
  assert.deepEqual(check(), []);
});

test("a pinned action passes and a tag reference is named with file and line", () => {
  assert.deepEqual(check(makeRoot({ ".github/workflows/ci.yml": GOOD })), []);
  assert.deepEqual(check(makeRoot({ ".github/workflows/ci.yml": `jobs:\n${GOOD}      - uses: actions/setup-node@v5\n` })), [
    '.github/workflows/ci.yml:3: unpinned action "uses: actions/setup-node@v5"',
  ]);
});

test("a .yaml workflow and a composite action are read", () => {
  const bad = "      - uses: actions/checkout@v5\n";
  for (const rel of [".github/workflows/x.yaml", ".github/actions/setup/action.yml", ".github/actions/setup/action.yaml", "action.yml", "action.yaml"]) {
    const root = makeRoot({ ".github/workflows/ci.yml": GOOD, [rel]: bad });
    assert.deepEqual(check(root), [`${rel}:1: unpinned action "uses: actions/checkout@v5"`], rel);
  }
  assert.deepEqual(files(makeRoot({ ".github/workflows/a.yml": "", ".github/workflows/b.yaml": "", ".github/notes.md": "", "action.yml": "", "other.yml": "" })), [
    ".github/workflows/a.yml",
    ".github/workflows/b.yaml",
    "action.yml",
  ]);
});

test("a SHA without a version comment, a short SHA and a branch are rejected", () => {
  for (const value of [`actions/checkout@${SHA}`, `actions/checkout@${SHA.slice(0, 7)} # v5.1.0`, "actions/checkout@main", `actions/checkout@${SHA} # main`]) {
    assert.equal(check(makeRoot({ ".github/workflows/ci.yml": `- uses: ${value}\n` })).length, 1, value);
  }
});

test("local and docker references and comment lines are skipped, a reusable workflow is checked", () => {
  const text = `- uses: ./.github/actions/setup\n- uses: docker://alpine:3.20\n# - uses: actions/checkout@v5\n- uses: o/r/.github/workflows/w.yml@${SHA} # v1\n`;
  assert.deepEqual(findUses(text), [{ line: 4, value: `o/r/.github/workflows/w.yml@${SHA} # v1` }]);
  assert.deepEqual(check(makeRoot({ ".github/workflows/ci.yml": text })), []);
});

test("unusual YAML forms fail closed", () => {
  const forms = [
    `- "uses": actions/checkout@v5`,
    `- 'uses': actions/checkout@v5`,
    `- { name: x, uses: actions/checkout@v5 }`,
    `- {uses: actions/checkout@v5}`,
    `- uses: "actions/checkout@${SHA}" # v5.1.0`,
    `- uses: >-\n    actions/checkout@v5`,
    `- uses:\n    actions/checkout@v5`,
    `- uses : actions/checkout@v5`,
  ];
  for (const form of forms) {
    assert.equal(check(makeRoot({ ".github/workflows/ci.yml": `${form}\n` })).length, 1, form);
  }
});

test("a repository with no uses: line fails", () => {
  assert.deepEqual(check(makeRoot({ ".github/workflows/ci.yml": "name: CI\n" })), ["no uses: line found"]);
  assert.deepEqual(check(makeRoot({ "README.md": "" })), ["no uses: line found"]);
});
