// Deletes a directory tree the way ADR-016 says: list every entry, check the list,
// unlink the files one by one, then rmdir the directories from the deepest up.
// Never follows a symlink: a link is unlinked, its target is left alone.
// Plain node: built-ins only. No router module imports it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function isSameOrAncestor(candidate, of) {
  if (!of) return false;
  const rel = path.relative(candidate, of);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function refuse(target) {
  if (typeof target !== "string" || target.trim() === "") throw new Error("removeTree: empty path");
  const abs = path.resolve(target);
  if (abs === path.parse(abs).root) throw new Error(`removeTree: refusing the filesystem root (${abs})`);
  const guarded = [os.homedir(), process.cwd()].filter(Boolean).map((p) => path.resolve(p));
  for (const g of guarded) {
    if (isSameOrAncestor(abs, g)) throw new Error(`removeTree: refusing ${abs}, it is or holds ${g}`);
  }
  return abs;
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Lets a read-only directory give up its entries; files need no mode change to be unlinked.
function withWritableParent(p, fn) {
  try {
    fn();
  } catch (err) {
    if (err.code !== "EACCES" && err.code !== "EPERM") throw err;
    fs.chmodSync(path.dirname(p), 0o700);
    fn();
  }
}

// Returns { files, dirs }: the number of non-directory entries unlinked and directories removed.
export function removeTree(target) {
  const root = refuse(target);
  const top = lstatOrNull(root);
  if (!top) return { files: 0, dirs: 0 };
  if (!top.isDirectory()) {
    withWritableParent(root, () => fs.unlinkSync(root));
    return { files: 1, dirs: 0 };
  }

  // 1. List: walk with lstat, never into a symlink.
  const files = [];
  const dirs = [root];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (err) {
      if (err.code !== "EACCES" && err.code !== "EPERM") throw err;
      fs.chmodSync(dir, 0o700);
      names = fs.readdirSync(dir);
    }
    for (const name of names) {
      const p = path.join(dir, name);
      const st = fs.lstatSync(p);
      if (st.isDirectory()) dirs.push(p);
      else files.push(p);
    }
  }

  // 2. Check: every listed entry lies inside the target.
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  for (const p of [...files, ...dirs.slice(1)]) {
    if (!p.startsWith(prefix)) throw new Error(`removeTree: ${p} lies outside ${root}; nothing deleted`);
  }

  // 3. Delete the files one by one.
  for (const p of files) withWritableParent(p, () => fs.unlinkSync(p));

  // 4. rmdir the empty directories, deepest first.
  const ordered = dirs.slice().sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  for (const d of ordered) withWritableParent(d, () => fs.rmdirSync(d));
  return { files: files.length, dirs: dirs.length };
}
