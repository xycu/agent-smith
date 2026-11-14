// Environment boundaries and real child-test repository safety.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanEnv, gitEnv, git, run } from "./helpers.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("environment builders strip inherited Git keys and preserve explicit overrides", () => {
  const parent = { ...process.env };
  const base = fs.mkdtempSync(path.join(ROOT, ".as-env-unit-"));
  const project = { base, root: base };
  const inherited = {
    GIT_DIR: "/hostile/git", GIT_WORK_TREE: "/hostile/tree", GIT_INDEX_FILE: "/hostile/index",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.bare", GIT_CONFIG_VALUE_0: "true",
    GIT_AUTHOR_NAME: "Hostile", GIT_COMMITTER_NAME: "Hostile",
    GIT_AUTHOR_DATE: "invalid", GIT_COMMITTER_DATE: "invalid",
    GIT_ARBITRARY_SENTINEL: "hostile", HAS_GIT_INSIDE: "keep",
  };
  try {
    Object.assign(process.env, inherited);
    const before = { ...process.env };
    const expected = Object.fromEntries(Object.entries(before).filter(([key]) => !key.startsWith("GIT_")));
    const first = cleanEnv();
    assert.deepEqual(first, expected);
    assert.notEqual(first, cleanEnv());
    process.env.HAS_GIT_INSIDE = "new";
    assert.equal(cleanEnv().HAS_GIT_INSIDE, "new");
    assert.equal(first.HAS_GIT_INSIDE, "keep");
    process.env.HAS_GIT_INSIDE = "keep";

    const fixture = gitEnv(project);
    assert.deepEqual(fixture, {
      ...expected, HOME: base,
      GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull, GIT_CONFIG_NOSYSTEM: "1",
      GIT_CEILING_DIRECTORIES: path.dirname(base),
      GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com",
    });
    const script = path.join(base, "environment.mjs");
    fs.writeFileSync(script, "console.log(JSON.stringify(process.env));\n");
    assert.deepEqual(run(project, [], { script }).json, expected);
    const overrides = {
      ...fixture, HOME: base, PATH: `${base}${path.delimiter}${before.PATH}`,
      GIT_ARBITRARY_SENTINEL: "intentional", GIT_LOG: "fixture-log",
      GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false",
    };
    assert.deepEqual(run(project, [], { script, env: overrides }).json, { ...expected, ...overrides });
    git(project, ["init", "-q"]);
    const date = "2020-01-02T03:04:05+00:00";
    git(project, ["commit", "-q", "--allow-empty", "-m", "test: fixture"], { date });
    const seconds = Date.parse(date) / 1000;
    assert.equal(git(project, ["log", "-1", "--format=%an|%cn|%at|%ct"]), `Test|Test|${seconds}|${seconds}`);
    assert.deepEqual({ ...process.env }, before);
  } finally {
    for (const key of Object.keys(process.env)) if (!Object.hasOwn(parent, key)) delete process.env[key];
    Object.assign(process.env, parent);
    removeTree(base);
  }
});

// Observer construction is independent of the helper under test.
const observerEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull, GIT_CONFIG_NOSYSTEM: "1",
  GIT_OPTIONAL_LOCKS: "0",
});
function observeGit(cwd, args) {
  const result = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd, env: observerEnv(), encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function snapshot(victim) {
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      const relative = path.relative(victim, file);
      if (stat.isDirectory()) {
        files.push([relative, "directory"]);
        walk(file);
      } else if (stat.isSymbolicLink()) {
        files.push([relative, "symlink", fs.readlinkSync(file)]);
      } else {
        files.push([relative, fs.readFileSync(file).toString("base64")]);
      }
    }
  }
  const state = {
    head: observeGit(victim, ["rev-parse", "HEAD"]),
    refs: observeGit(victim, ["show-ref"]),
    commits: observeGit(victim, ["rev-list", "--all", "--count"]),
    staged: observeGit(victim, ["ls-files", "--stage"]),
    index: fs.readFileSync(path.join(victim, ".git/index")),
  };
  walk(victim);
  return { ...state, files };
}

const required = [
  "the CLI exits 0 for good commits",
  "the start commit of an isolated OpenSpec run holds only openspec/changes/<id>/",
];
const representative = [
  "tools/test/commit-lint.test.mjs",
  "skills/openspec-pipeline/test/openspec-isolation.test.mjs",
];
const combined = [
  ...representative,
  ...["isolation", "open-pr", "pr-comment", "provenance", "rule-levels", "agents"]
    .map((name) => `skills/10x-pipeline/test/${name}.test.mjs`),
];

for (const scenario of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "combined"]) {
  test(`child tests preserve victim under ${scenario}`, { timeout: 600000 }, () => {
    const parent = fs.mkdtempSync(path.join(ROOT, ".as-env-victim-"));
    try {
      // A filesystem boundary survives the environment sanitizer.
      fs.writeFileSync(path.join(parent, ".git"), `gitdir: ${path.join(parent, "absent-git")}\n`);
      const plain = path.join(parent, "plain");
      const local = path.join(parent, "local");
      const victim = path.join(parent, "victim");
      for (const dir of [plain, local, victim]) fs.mkdirSync(dir);
      for (const args of [["rev-parse", "--show-toplevel"], ["rev-parse", "HEAD"]]) {
        const result = spawnSync("git", args, { cwd: plain, env: observerEnv(), timeout: 30000 });
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.notEqual(result.status, 0, "plain scratch must not discover the enclosing worktree");
      }
      observeGit(local, ["init", "-q"]);
      assert.equal(fs.realpathSync(observeGit(local, ["rev-parse", "--show-toplevel"])), fs.realpathSync(local));
      observeGit(victim, ["init", "-q"]);
      fs.writeFileSync(path.join(victim, "sentinel"), "victim content\n");
      observeGit(victim, ["add", "sentinel"]);
      observeGit(victim, ["-c", "user.name=Observer", "-c", "user.email=observer@example.com",
        "commit", "-q", "-m", "test: victim"]);
      const before = snapshot(victim);
      const hostile = {
        GIT_DIR: path.join(victim, ".git"),
        GIT_WORK_TREE: victim,
        GIT_INDEX_FILE: path.join(victim, ".git/index"),
      };
      const files = scenario === "combined" ? combined : representative;
      const childEnv = {
        ...observerEnv(), TMPDIR: parent, TMP: parent, TEMP: parent, GH_LIVE: "0",
        ...(scenario === "combined" ? hostile : { [scenario]: hostile[scenario] }),
      };
      // Node marks test workers so a nested runner needs its own context.
      delete childEnv.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], {
        cwd: ROOT, encoding: "utf8", timeout: 540000, maxBuffer: 32 * 1024 * 1024,
        env: childEnv,
      });
      const output = `${result.stdout}\n${result.stderr}`;
      assert.deepEqual(snapshot(victim), before, `victim changed under ${scenario}\n${output}`);
      assert.equal(result.error, undefined, `${result.error}\n${output}`);
      assert.equal(result.signal, null, output);
      assert.equal(result.status, 0, output);
      for (const name of required) {
        const line = result.stdout.split("\n").find((line) => line.startsWith("ok ") && line.includes(name));
        assert.ok(line && !line.includes("# SKIP"), `required Git test did not execute: ${name}\n${output}`);
      }
    } finally {
      removeTree(parent);
    }
  });
}
