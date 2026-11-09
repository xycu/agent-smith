import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

// Guard (ADR-016): no recursive or forced directory delete in the files agents follow or run.
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SKILL_DIR, "../..");
const SELF = fileURLToPath(import.meta.url);
const ADR = path.join(REPO, "docs/ADR/ADR-016-no-recursive-force-delete.md");
const SCAN_DIRS = ["skills", "agents", "docs", "tools"];
const SCAN_FILES = ["README.md", "AGENTS.md"];
const SKIP = new Set([SELF, ADR]);

const DELETE_CALL = /\.(rmSync|rmdirSync|rm|rmdir)\s*\(/g;
const RECURSIVE_TRUE = /recursive\s*:\s*true/;
const CODE_ALWAYS = [/\brimraf\b/, /\bshutil\.rmtree\b/];
const PROSE_BANNED = [/\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/, /\brimraf\b/, /\bfind\b.*\s-delete\b/];
const PROHIBITION = /MUST NOT|\bnever\b|\bNever\b|\bnot use\b|\bDo not\b|\bban|\bforbid|\bblock/;

// The argument text of the call that opens at `open` (the index of its "("), read to the balanced ")".
function callArgs(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

export function scanCode(text) {
  const hits = [];
  for (const m of text.matchAll(DELETE_CALL)) {
    const args = callArgs(text, m.index + m[0].length - 1);
    if (RECURSIVE_TRUE.test(args)) hits.push(`${m[1]}(${args.split("\n")[0].slice(0, 60)}`);
  }
  for (const re of CODE_ALWAYS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export function scanProse(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if (PROSE_BANNED.some((re) => re.test(line)) && !PROHIBITION.test(line)) hits.push(`line ${i + 1}: ${line.slice(0, 80)}`);
  });
  return hits;
}

function scannedFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules") continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.(mjs|js|md|json)$/.test(ent.name)) out.push(p);
    }
  };
  for (const d of SCAN_DIRS) if (fs.existsSync(path.join(REPO, d))) walk(path.join(REPO, d));
  for (const f of SCAN_FILES) if (fs.existsSync(path.join(REPO, f))) out.push(path.join(REPO, f));
  return out.filter((p) => !SKIP.has(p));
}

test("guard: the scanner catches every banned form and lets creation through", () => {
  assert.ok(scanCode("fs.rmSync(d, { recursive: true });").length > 0);
  assert.ok(scanCode('fs.rmSync(path.join(a, "b"), { recursive:true, force: true });').length > 0);
  assert.ok(scanCode("fs.rmSync(\n  dir,\n  { recursive: true }\n);").length > 0);
  assert.ok(scanCode("await fs.promises.rm(d, { recursive: true });").length > 0);
  assert.ok(scanCode("fsp.rmdir(d, {recursive: true})").length > 0);
  assert.ok(scanCode('import rimraf from "rimraf";').length > 0);
  assert.ok(scanCode("shutil.rmtree(d)").length > 0);
  assert.deepEqual(scanCode("fs.mkdirSync(d, { recursive: true });"), []);
  assert.deepEqual(scanCode("fs.cpSync(a, b, { recursive: true });"), []);
  assert.deepEqual(scanCode("fs.rmSync(file, { force: true }); fs.rmdirSync(d);"), []);
  assert.ok(scanProse("Clean up with rm -rf x").length > 0);
  assert.ok(scanProse("run rm -r dir").length > 0);
  assert.ok(scanProse("then rm --recursive dir").length > 0);
  assert.ok(scanProse("find tmp -type f -delete").length > 0);
  assert.ok(scanProse("npx rimraf dist").length > 0);
  assert.deepEqual(scanProse("You **MUST NOT** use `rm -rf`."), []);
  assert.deepEqual(scanProse("rm file.txt"), []);
});

test("guard: no scanned file uses a recursive or forced directory delete", () => {
  const files = scannedFiles();
  assert.ok(files.some((f) => f.endsWith(path.join("scripts", "route.mjs"))), "the walk reaches the router");
  const problems = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    const hits = f.endsWith(".mjs") || f.endsWith(".js") ? scanCode(text) : scanProse(text);
    for (const h of hits) problems.push(`${path.relative(REPO, f)}: ${h}`);
  }
  assert.deepEqual(problems, []);
});

test("guard: the rule stays where agents read it", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  const suffix = policy.prompts.suffix.split("\n");
  assert.ok(suffix.some((l) => l.includes("**GIVEN**") && l.includes("**MUST NOT**") && l.includes("`rm -rf`") && l.includes("recursive: true")), "suffix ban");
  assert.ok(suffix.some((l) => l.includes("**GIVEN**") && l.includes("**MUST**") && l.includes("one by one") && l.includes("`rmdir`") && l.includes("deepest first")), "suffix procedure");
  const ban = suffix.findIndex((l) => l.includes("`rm -rf`"));
  assert.ok(ban < suffix.findIndex((l) => l.startsWith("RESULT:")), "rules come before the RESULT instructions");
  const mv = fs.readFileSync(path.join(SKILL_DIR, "prompts/manual-verify.md"), "utf8").split("\n");
  assert.ok(mv.some((l) => l.includes("**GIVEN**") && l.includes("`mktemp -d`") && l.includes("`rmdir`") && l.includes("one by one")), "manual-verify rule");
  for (const skill of ["skills/10x-pipeline/SKILL.md", "skills/openspec-pipeline/SKILL.md"]) {
    const text = fs.readFileSync(path.join(REPO, skill), "utf8");
    assert.match(text, /`rmdir`/, skill);
    assert.match(text, /ADR-016/, skill);
  }
  assert.match(fs.readFileSync(path.join(REPO, "AGENTS.md"), "utf8"), /removeTree/);
  assert.ok(fs.existsSync(ADR), "ADR-016 exists");
  assert.match(fs.readFileSync(ADR, "utf8"), /removeTree/);
});
