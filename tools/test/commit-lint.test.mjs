// commit-lint: accepted and rejected subject shapes, and the CLI exit codes in a scratch git repo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintSubject } from "../commit-lint.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../commit-lint.mjs");
const created = [];

// Hermetic git: no user or system config, fixed identity, no signing.
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

function git(cwd, ...args) {
  const run = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: GIT_ENV, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

function makeRepo(subjects) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cl-"));
  created.push(dir);
  git(dir, "init", "-q", "-b", "main");
  git(dir, "commit", "-q", "--allow-empty", "-m", "chore: base");
  git(dir, "tag", "base");
  for (const subject of subjects) git(dir, "commit", "-q", "--allow-empty", "-m", subject);
  return dir;
}

function cli(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: GIT_ENV, encoding: "utf8" });
}

test.after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

test("valid subjects pass", () => {
  for (const subject of [
    "feat: x",
    "fix(router): x",
    "feat!: x",
    "feat(api)!: x",
    "chore(llm-complexity-scorer): x",
    "docs(adr): split ADR-007 rule lines",
    "revert: x",
    "Merge branch 'main' into feature",
    'Revert "feat: x"',
  ]) {
    assert.equal(lintSubject(subject), null, subject);
  }
});

test("invalid subjects fail", () => {
  for (const subject of ["Update stuff", "feat:x", "feat(): x", "FEAT: x", "feat: ", "feature: x", "feat (x): y", "feat(Router): x", 'Revert "wip stuff"', 'Revert ""']) {
    assert.notEqual(lintSubject(subject), null, subject);
  }
});

test("the CLI exits 0 for good commits", () => {
  const dir = makeRepo(["feat: one", "fix(x): two"]);
  const run = cli(dir, "base..HEAD");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /commit-lint: OK/);
});

test("the CLI exits 1 and names the bad commit", () => {
  const dir = makeRepo(["feat: one", "wip stuff"]);
  const bad = git(dir, "rev-parse", "--short", "HEAD");
  const run = cli(dir, "base..HEAD");
  assert.equal(run.status, 1);
  assert.ok(run.stderr.includes(bad), run.stderr);
  assert.match(run.stderr, /wip stuff/);
});

test("the CLI exits 2 on a missing argument, an empty range or a bad range", () => {
  const dir = makeRepo(["feat: one"]);
  assert.equal(cli(dir).status, 2);
  assert.equal(cli(dir, "HEAD..HEAD").status, 2);
  assert.equal(cli(dir, "nope..HEAD").status, 2);
  assert.equal(cli(dir, "--all").status, 2);
});
