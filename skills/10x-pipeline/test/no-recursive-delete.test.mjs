import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeTree } from "../scripts/remove-tree.mjs";

const scratches = [];
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as-nrd-"));
  scratches.push(dir);
  return dir;
}
after(() => {
  for (const dir of scratches.splice(0)) {
    assert.ok(dir.startsWith(os.tmpdir()), `scratch ${dir} lies under the temp directory`);
    removeTree(dir);
  }
});

test("removeTree deletes a nested tree and reports the counts", () => {
  const base = scratch();
  const target = path.join(base, "tree");
  fs.mkdirSync(path.join(target, "a", "b", "c"), { recursive: true });
  fs.writeFileSync(path.join(target, "top.txt"), "1");
  fs.writeFileSync(path.join(target, "a", "one.txt"), "1");
  fs.writeFileSync(path.join(target, "a", "b", "two.txt"), "2");
  fs.writeFileSync(path.join(target, "a", "b", "c", "three.txt"), "3");
  const out = removeTree(target);
  assert.deepEqual(out, { files: 4, dirs: 4 });
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(base), true);
});

test("removeTree unlinks a symlink to an outside directory and leaves the target", () => {
  const base = scratch();
  const outside = path.join(base, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "keep.txt"), "keep");
  const target = path.join(base, "tree");
  fs.mkdirSync(target);
  fs.symlinkSync(outside, path.join(target, "link"));
  const out = removeTree(target);
  assert.deepEqual(out, { files: 1, dirs: 1 });
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.readFileSync(path.join(outside, "keep.txt"), "utf8"), "keep");
});

test("removeTree on a missing path does nothing", () => {
  const base = scratch();
  assert.deepEqual(removeTree(path.join(base, "nope")), { files: 0, dirs: 0 });
});

test("removeTree unlinks a plain file", () => {
  const base = scratch();
  const file = path.join(base, "f.txt");
  fs.writeFileSync(file, "x");
  assert.deepEqual(removeTree(file), { files: 1, dirs: 0 });
  assert.equal(fs.existsSync(file), false);
});

test("removeTree deletes read-only files and a read-only directory", () => {
  const base = scratch();
  const target = path.join(base, "objects");
  fs.mkdirSync(path.join(target, "ab"), { recursive: true });
  const file = path.join(target, "ab", "cdef");
  fs.writeFileSync(file, "blob");
  fs.chmodSync(file, 0o444);
  fs.chmodSync(path.join(target, "ab"), 0o555);
  removeTree(target);
  assert.equal(fs.existsSync(target), false);
});

test("removeTree refuses an empty path, the root, home, the cwd and their ancestors", () => {
  assert.throws(() => removeTree(""), /empty path/);
  assert.throws(() => removeTree("   "), /empty path/);
  assert.throws(() => removeTree(undefined), /empty path/);
  assert.throws(() => removeTree(path.parse(process.cwd()).root), /root/);
  assert.throws(() => removeTree(os.homedir()), /refusing/);
  assert.throws(() => removeTree(path.dirname(os.homedir())), /refusing/);
  assert.throws(() => removeTree(process.cwd()), /refusing/);
  assert.throws(() => removeTree(path.dirname(process.cwd())), /refusing/);
  assert.throws(() => removeTree("."), /refusing/);
});
