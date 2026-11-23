// workflow-pins: every remote action under .github is pinned to a full commit SHA with a version comment.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

test("local references are retained, Docker and comments are skipped, remote workflows are checked", () => {
  const text = `- uses: ./.github/actions/setup\n- uses: docker://alpine:3.20\n# - uses: actions/checkout@v5\n- uses: o/r/.github/workflows/w.yml@${SHA} # v1\n`;
  assert.deepEqual(findUses(text), [{ line: 1, value: "./.github/actions/setup" }, { line: 4, value: `o/r/.github/workflows/w.yml@${SHA} # v1` }]);
  assert.deepEqual(check(makeRoot({ ".github/workflows/ci.yml": text, ".github/actions/setup/action.yml": "" })), []);
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

test("local metadata and transitive root-relative references validate remotes at their actual line", () => {
  for (const metadata of ["actions/setup/action.yml", "actions/nested/action.yaml"]) {
    const tree = {
      ".github/workflows/ci.yml": GOOD + "- uses: ./actions/setup\n",
      "actions/setup/action.yml": "- uses: ./actions/nested\n",
      [metadata]: "runs:\n  steps:\n    - uses: actions/setup-node@v5\n",
    };
    assert.deepEqual(check(makeRoot(tree)), [
      `${metadata}:3: unpinned action "uses: actions/setup-node@v5"`,
    ]);
  }
  assert.deepEqual(check(makeRoot({
    ".github/workflows/ci.yml": "- uses: ./actions/setup # setup tools\n",
    "actions/setup/action.yml": "- uses: ./actions/nested\n",
    "actions/nested/action.yaml": GOOD,
    "actions/unreferenced/action.yml": "- uses: actions/checkout@main\n",
  })), []);
});

test("missing local metadata reports each referring location and both expected names", () => {
  for (const extra of [{}, { "actions/missing/README.md": "" }]) {
    const errors = check(makeRoot({
      ".github/workflows/ci.yml": GOOD + "- uses: ./actions/missing\n- uses: ./actions/missing\n",
      ...extra,
    }));
    assert.equal(errors.length, 2);
    for (const [index, error] of errors.entries()) {
      assert.ok(error.startsWith(`.github/workflows/ci.yml:${index + 2}:`), error);
      assert.match(error, /\.\/actions\/missing/);
      assert.match(error, /action\.yml/);
      assert.match(error, /action\.yaml/);
    }
  }
  const errors = check(makeRoot({
    ".github/workflows/ci.yml": GOOD + "- uses: ./actions/setup\n",
    "actions/setup/action.yml": "runs:\n- uses: ./actions/missing\n",
  }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^actions\/setup\/action.yml:2:.*\.\/actions\/missing.*action\.yml.*action\.yaml/);
});

test("root action references use existing root metadata", () => {
  assert.deepEqual(check(makeRoot({
    ".github/workflows/ci.yml": "- uses: ./\n",
    "action.yml": GOOD,
  })), []);
});

test("both metadata spellings are inspected", () => {
  assert.deepEqual(check(makeRoot({
    ".github/workflows/ci.yml": "- uses: ./actions/setup\n",
    "actions/setup/action.yml": GOOD,
    "actions/setup/action.yaml": "- uses: actions/setup-node@v5\n",
  })), ['actions/setup/action.yaml:1: unpinned action "uses: actions/setup-node@v5"']);
});

test("repeated targets, diamonds, normalized paths and seeded metadata are scanned once", () => {
  const root = makeRoot({
    ".github/workflows/ci.yml": "- uses: ./actions/a\n- uses: ./actions/b\n- uses: ./actions/a/../a\n- uses: ./.github/actions/shared\n",
    "actions/a/action.yml": "- uses: ./actions/shared\n",
    "actions/b/action.yml": "- uses: ./actions/shared\n",
    "actions/shared/action.yml": "- uses: actions/setup-node@v5\n",
    ".github/actions/shared/action.yml": "- uses: actions/checkout@v5\n",
  });
  assert.deepEqual(check(root), [
    '.github/actions/shared/action.yml:1: unpinned action "uses: actions/checkout@v5"',
    'actions/shared/action.yml:1: unpinned action "uses: actions/setup-node@v5"',
  ]);
});

test("self-cycles and two-action cycles terminate and still validate reachable remotes", () => {
  for (const next of ["a", "b"]) {
    for (const remote of [GOOD, "- uses: actions/setup-node@v5\n", ""]) {
      const root = makeRoot({
        ".github/workflows/ci.yml": "- uses: ./actions/a\n",
        "actions/a/action.yml": `- uses: ./actions/${next}\n${remote}`,
        "actions/b/action.yml": "- uses: ./actions/a\n",
      });
      const result = spawnSync(process.execPath, ["--input-type=module", "-e",
        'import { check } from "./tools/workflow-pins.mjs"; console.log(JSON.stringify(check(process.argv[1])));', root,
      ], { cwd: path.resolve(import.meta.dirname, "../.."), encoding: "utf8", timeout: 5000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), remote === "" ? ["no uses: line found"] : remote === GOOD ? [] : [
        'actions/a/action.yml:2: unpinned action "uses: actions/setup-node@v5"',
      ]);
    }
  }
});

test("local reusable workflow files remain checked once and missing workflows identify their source", () => {
  assert.deepEqual(check(makeRoot({
    ".github/workflows/ci.yml": GOOD + "- uses: ./.github/workflows/reuse.yaml # shared\n",
    ".github/workflows/reuse.yaml": "- uses: actions/setup-node@v5\n",
  })), ['.github/workflows/reuse.yaml:1: unpinned action "uses: actions/setup-node@v5"']);
  const errors = check(makeRoot({
    ".github/workflows/ci.yml": GOOD + "- uses: ./.github/workflows/missing.yml\n",
  }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^\.github\/workflows\/ci.yml:2:.*\.github\/workflows\/missing.yml/);
});

test("unsupported local values fail closed without following a partial path", () => {
  for (const value of [
    '"./actions/setup"', "'./actions/setup'", "./actions/setup }", "./actions/setup,",
    "./actions/setup extra", "./actions/setup#comment", "./actions/${{ inputs.action }}",
    "[./actions/setup]", ">-\n    ./actions/setup", "\n    ./actions/setup",
  ]) {
    const errors = check(makeRoot({
      ".github/workflows/ci.yml": GOOD + `- uses: ${value}\n`,
      "actions/setup/action.yml": GOOD,
    }));
    assert.equal(errors.length, 1, value);
    assert.match(errors[0], /^\.github\/workflows\/ci.yml:2:/, value);
  }
});

test("local-only, empty metadata and Docker-only graphs retain the no-remote guard", () => {
  for (const metadata of ["", "- uses: docker://alpine:3.20\n"]) {
    assert.deepEqual(check(makeRoot({
      ".github/workflows/ci.yml": "- uses: ./actions/setup\n",
      "actions/setup/action.yml": metadata,
    })), ["no uses: line found"]);
  }
  assert.deepEqual(check(makeRoot({
    ".github/workflows/ci.yml": "- uses: docker://alpine:3.20\n",
  })), ["no uses: line found"]);
});

test("non-file metadata and dangling links fail at the referring source", () => {
  for (const kind of ["directory", "dangling"]) {
    const root = makeRoot({ ".github/workflows/ci.yml": GOOD + "- uses: ./actions/setup\n" });
    fs.mkdirSync(path.join(root, "actions/setup"), { recursive: true });
    const metadata = path.join(root, "actions/setup/action.yml");
    if (kind === "directory") fs.mkdirSync(metadata);
    else fs.symlinkSync("absent.yml", metadata);
    const errors = check(root);
    assert.equal(errors.length, 1, kind);
    assert.match(errors[0], /^\.github\/workflows\/ci.yml:2:.*actions\/setup\/action.yml/, kind);
  }
});

test("contained symlink aliases share file identity and lexical or symlink escapes fail", () => {
  const parent = makeRoot({
    "repo/.github/workflows/ci.yml": GOOD + "- uses: ./actions/setup\n- uses: ./actions/alias\n",
    "repo/actions/setup/action.yml": "- uses: actions/setup-node@v5\n",
    "outside/action.yml": "- uses: actions/checkout@main\n",
  });
  const root = path.join(parent, "repo");
  fs.symlinkSync("setup", path.join(root, "actions/alias"));
  assert.deepEqual(check(root), ['actions/setup/action.yml:1: unpinned action "uses: actions/setup-node@v5"']);
  fs.symlinkSync(path.join(parent, "outside"), path.join(root, "escape"));
  fs.symlinkSync(path.join(parent, "outside/action.yml"), path.join(root, "actions/setup/action.yaml"));
  fs.writeFileSync(path.join(root, ".github/workflows/ci.yml"),
    GOOD + "- uses: ./../outside\n- uses: ./escape\n- uses: ./actions/setup\n");
  const errors = check(root);
  assert.equal(errors.length, 4);
  for (const line of [2, 3, 4]) {
    assert.ok(errors.some((error) => error.startsWith(`.github/workflows/ci.yml:${line}:`) && /escapes/.test(error)), errors.join("\n"));
  }
  assert.ok(!errors.some((error) => error.includes("checkout@main")), errors.join("\n"));
});

test("metadata read failures are returned with the source and target", (t) => {
  const root = makeRoot({
    ".github/workflows/ci.yml": GOOD + "- uses: ./actions/setup\n",
    "actions/setup/action.yml": GOOD,
  });
  const read = fs.readFileSync;
  t.mock.method(fs, "readFileSync", (file, ...args) => {
    if (file === path.join(root, "actions/setup/action.yml")) {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    }
    return read(file, ...args);
  });
  const errors = check(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^\.github\/workflows\/ci.yml:2:.*actions\/setup\/action.yml.*EACCES/);
});
