// Tests for scripts/pr-common.mjs, the helpers shared by open-pr.mjs and pr-comment.mjs.
// Plain node: built-ins only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { firstLine, spawn, ghFailure, checkReportArg, capBody, withTempDir } from "../scripts/pr-common.mjs";

const gh = (over) => ({ status: 1, stdout: "", stderr: "", missing: false, timedOut: false, ...over });

test("firstLine skips blank lines and cuts at max", () => {
  assert.equal(firstLine("\n  \n  hello  \nworld"), "hello");
  assert.equal(firstLine("abcdef", 3), "abc");
  assert.equal(firstLine(undefined), "");
});

test("capBody neutralizes mentions with the zero-width escape and leaves emails alone", () => {
  assert.equal(capBody("a @b"), "a @​b");
  assert.ok(capBody("a @b").includes("@​b"));
  assert.equal(capBody("mail me@x.io"), "mail me@x.io");
  assert.equal(capBody("@b"), "@​b");
});

test("capBody leaves text under the cap and cuts text over it", () => {
  assert.equal(capBody("x".repeat(60000)), "x".repeat(60000));
  assert.equal(capBody("x".repeat(60005)), `${"x".repeat(60000)}\n\nReport truncated: 5 characters omitted.`);
});

test("capBody never splits a surrogate pair", () => {
  const out = capBody(`${"x".repeat(59999)}\u{1F600}tail`);
  assert.equal(out, `${"x".repeat(59999)}\n\nReport truncated: 6 characters omitted.`);
  assert.equal(capBody(`${"x".repeat(59998)}\u{1F600}tail`).startsWith(`${"x".repeat(59998)}\u{1F600}`), true);
});

test("ghFailure maps missing, timeout, auth and plain failures", () => {
  assert.equal(ghFailure(gh({ missing: true }), "gh x"), "gh is not installed");
  assert.equal(ghFailure(gh({ timedOut: true }), "gh x"), "gh timed out");
  assert.equal(ghFailure(gh({ status: 4 }), "gh x"), "gh is not authenticated");
  assert.equal(ghFailure(gh({ stderr: "run: gh auth login" }), "gh x"), "gh is not authenticated");
  assert.equal(ghFailure(gh({ stderr: "\nboom\nmore" }), "gh x"), "gh x failed: boom");
  assert.equal(ghFailure(gh({ status: 3 }), "gh x"), "gh x failed: gh exited 3");
});

test("checkReportArg accepts agent-smith/report.md and rejects the rest", () => {
  assert.doesNotThrow(() => checkReportArg("a/agent-smith/report.md"));
  assert.throws(() => checkReportArg("a/agent-smith/other.md"), /--report must name a file report.md inside a directory agent-smith/);
  assert.throws(() => checkReportArg("a/b/report.md"), /--report must name/);
});

test("withTempDir returns fn's value and removes the directory", () => {
  let seen;
  assert.equal(withTempDir("as-pc-", (d) => { seen = d; fs.writeFileSync(path.join(d, "f"), "x"); return 7; }), 7);
  assert.equal(fs.existsSync(seen), false);
});

test("withTempDir removes the directory when fn throws and keeps the error", () => {
  let seen;
  assert.throws(() => withTempDir("as-pc-", (d) => { seen = d; throw new Error("boom"); }), /boom/);
  assert.equal(fs.existsSync(seen), false);
});

test("withTempDir lets a mkdtemp error propagate", () => {
  const old = process.env.TMPDIR;
  process.env.TMPDIR = path.join(os.tmpdir(), "as-pc-missing-dir");
  try {
    assert.throws(() => withTempDir("as-pc-", () => 1), /ENOENT/);
  } finally {
    if (old === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = old;
  }
});

test("withTempDir does not throw when removal fails", { skip: process.platform === "win32" }, () => {
  const cwd = process.cwd();
  const old = process.env.TMPDIR;
  // A real path, because process.cwd() is one and removeTree compares paths as written.
  process.env.TMPDIR = fs.realpathSync(os.tmpdir());
  let seen;
  try {
    // removeTree refuses a path that is or holds the working directory.
    assert.equal(withTempDir("as-pc-", (d) => { seen = d; process.chdir(d); return "ok"; }), "ok");
  } finally {
    process.chdir(cwd);
    if (old === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = old;
  }
  // The refused directory is still there; clean it up by hand.
  assert.equal(fs.existsSync(seen), true);
  fs.rmdirSync(seen);
});

test("spawn reports a missing binary", () => {
  const res = spawn("as-no-such-binary-xyz", [], 5000, process.env);
  assert.equal(res.missing, true);
  assert.equal(res.status, 127);
});
