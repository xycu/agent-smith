// Shared file guard and plan Files parser of state.mjs (file-guard-dedup).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { guardedStat, readGuarded, planFileTokens } from "../scripts/state.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

test("guardedStat and readGuarded", () => {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-guard-"));
  try {
    const dir = path.join(base, "d");
    const outside = path.join(base, "o");
    fs.mkdirSync(dir);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(dir, "a.txt"), "hello");
    fs.writeFileSync(path.join(outside, "b.txt"), "secret");
    fs.symlinkSync(path.join(outside, "b.txt"), path.join(dir, "link.txt"));
    fs.symlinkSync(outside, path.join(dir, "sub"));
    assert.equal(readGuarded(path.join(dir, "a.txt"), dir, 100), "hello");
    assert.ok(guardedStat(path.join(dir, "a.txt"), dir)?.isFile());
    assert.equal(readGuarded(path.join(dir, "link.txt"), dir, 100), null, "symlinked file");
    assert.equal(readGuarded(path.join(dir, "sub", "b.txt"), dir, 100), null, "symlinked folder");
    assert.equal(readGuarded(path.join(dir, "a.txt"), dir, 3), null, "oversize");
    assert.equal(readGuarded(path.join(dir, "none.txt"), dir, 100), null, "missing");
    assert.equal(guardedStat(path.join(dir, "a.txt"), path.join(base, "nodir")), null, "missing dir");
    assert.equal(guardedStat(dir, base), null, "a folder");
  } finally {
    removeTree(base);
  }
});

test("planFileTokens", () => {
  assert.deepEqual(planFileTokens("**Files**: `a/b.mjs`, `c.mjs` and more"), ["a/b.mjs", "c.mjs"]);
  assert.deepEqual(planFileTokens("**File**: a.mjs, b.mjs"), ["a.mjs", "b.mjs"]);
  assert.deepEqual(planFileTokens("**Files**: ./a.mjs:12, b.mjs:3-9"), ["a.mjs", "b.mjs"]);
  assert.equal(planFileTokens("Files: a.mjs"), null);
  assert.deepEqual(planFileTokens("**Files**: , ,"), []);
});
