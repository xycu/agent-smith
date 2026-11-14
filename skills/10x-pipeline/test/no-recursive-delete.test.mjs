import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeTree } from "../scripts/remove-tree.mjs";
import { cleanupAll, makeProject } from "./helpers.mjs";

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

const privileged = process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0);
test("removeTree leaves the mode of a read-only parent outside the target alone", { skip: privileged }, () => {
  const base = scratch();
  const outer = path.join(base, "outer");
  const target = path.join(outer, "tree");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "f.txt"), "x");
  fs.chmodSync(outer, 0o555);
  try {
    assert.throws(() => removeTree(target), (err) => err.code === "EACCES" || err.code === "EPERM");
    assert.equal(fs.statSync(outer).mode & 0o777, 0o555);
    assert.equal(fs.existsSync(path.join(target, "f.txt")), false, "the files inside the target are gone");
  } finally {
    fs.chmodSync(outer, 0o755);
  }
});

test("cleanupAll tries every scratch folder and throws one error that names the failures", { skip: privileged }, () => {
  // The first project lies under a parent that becomes read-only, so its own rmdir fails; the second must still go.
  const parent = scratch();
  const saved = process.env.TMPDIR;
  process.env.TMPDIR = parent;
  let locked;
  try {
    locked = makeProject();
  } finally {
    if (saved === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = saved;
  }
  const free = makeProject();
  assert.ok(locked.base.startsWith(fs.realpathSync(parent)), "the first project lies under the read-only parent");
  fs.chmodSync(parent, 0o555);
  try {
    assert.throws(() => cleanupAll(), (err) => {
      assert.ok(err instanceof AggregateError);
      assert.equal(err.errors.length, 1);
      assert.ok(err.message.includes(locked.base), err.message);
      assert.ok(!err.message.includes(free.base), err.message);
      return true;
    });
    assert.equal(fs.existsSync(free.base), false, "the folder after the failure is removed");
    assert.equal(fs.existsSync(locked.base), true);
  } finally {
    fs.chmodSync(parent, 0o755);
  }
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
const SCAN_DIRS = ["skills", "agents", "docs", "tools", ".github"];
const SCAN_FILES = ["README.md", "AGENTS.md"];
const SKIP = new Set([SELF, ADR]);

const DELETE_CALL = /(?<![\w$])(rmSync|rmdirSync|rm|rmdir)\s*\(/g;
const CODE_ALWAYS = [/\brimraf\b/, /\bshutil\.rmtree\b/];
const PROSE_BANNED = [/\brimraf\b/, /\bfind\b.*\s-delete\b/];
// Whole words only, so "banner", "bandwidth" or "forbidding" do not excuse a delete command on the same line.
const PROHIBITION = /MUST NOT|\bnever\b|\bNever\b|\bnot use\b|\bDo not\b|\bban(?:s|ned)?\b|\bforbid(?:s|den)?\b/;
// The reason the docs give for the ban ("a harness may block it", "people block `rm -rf` in their harness"),
// allowed as that phrase only: a line that merely holds "block" ("blocked", `blockSize`) is still checked.
const BLOCK_REASON = /\b(?:a|the) harness (?:may block|that blocks)\b|\bpeople block\b.*\bin their harness\b/;

// Read only the lexical structure needed for call boundaries and transparent option literals.
// Unsupported or unbalanced syntax throws so a delete call cannot silently lose its options.
function readGroup(text, open) {
  let i = open + 1;
  const close = { "(": ")", "[": "]", "{": "}" }[text[open]];
  const tokens = [];
  let expression = true;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("unterminated comment");
      i = end + 2;
      continue;
    }
    if (c === close) return { kind: text[open], tokens, end: i + 1 };
    if (")]}".includes(c)) throw new Error("unbalanced delimiter");
    let token;
    if ("([{".includes(c)) {
      token = readGroup(text, i);
      i = token.end;
    } else if (c === "'" || c === '"' || c === "`") {
      const begin = i++;
      let closed = false;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === c) { i++; closed = true; break; }
        if (c === "`" && text.startsWith("${", i)) {
          i = readGroup(text, i + 1).end;
        } else {
          if (c !== "`" && /[\r\n]/.test(text[i])) throw new Error("unterminated string");
          i++;
        }
      }
      if (!closed) throw new Error("unterminated string");
      token = { kind: "string", value: text.slice(begin + 1, i - 1), quote: c };
    } else if (c === "/" && expression) {
      i++;
      let inClass = false;
      let closed = false;
      while (i < text.length && !/[\r\n]/.test(text[i])) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "[") inClass = true;
        if (text[i] === "]") inClass = false;
        if (text[i++] === "/" && !inClass) { closed = true; break; }
      }
      if (!closed) throw new Error("unterminated regex");
      while (i < text.length && /[a-z]/i.test(text[i])) i++;
      token = { kind: "regex" };
    } else {
      const word = text.slice(i).match(/^(?:[\w$]|\\u(?:[a-f\d]{4}|\{[a-f\d]+\}))+/i);
      if (word) {
        token = { kind: "word", value: word[0] };
        i += word[0].length;
      } else {
        const operator = text.slice(i).match(/^(?:\.\.\.|\+\+|--|=>|&&|\|\||\?\?|\?\.)/);
        const value = operator ? operator[0] : c;
        if (!/^[.,:;?~!+*/%<>=&|^@-]+$/.test(value) || value === "@") throw new Error("unsupported token");
        token = { kind: "punctuation", value };
        i += value.length;
      }
    }
    tokens.push(token);
    if (token.kind === "punctuation") {
      if (token.value === "++" || token.value === "--") throw new Error("ambiguous increment");
      expression = ![".", "?."].includes(token.value);
    } else {
      expression = token.kind === "word" && /^(?:return|throw|typeof|void|delete|new|yield|await|in|instanceof)$/.test(token.value);
    }
  }
  throw new Error("unterminated group");
}

function splitTokens(tokens) {
  const parts = [[]];
  for (const token of tokens) {
    if (token.value === "," && token.kind === "punctuation") parts.push([]);
    else parts.at(-1).push(token);
  }
  if (parts.at(-1).length === 0) parts.pop();
  return parts;
}

function propertyName(token) {
  if (!token) return null;
  if (token.kind === "[") {
    if (token.tokens.length !== 1 || token.tokens[0].kind !== "string") return null;
    return propertyName(token.tokens[0]);
  }
  if (token.kind !== "word" && token.kind !== "string") return null;
  if (token.quote === "`") return null;
  const value = token.value.replace(/\\u\{([a-f\d]+)\}|\\u([a-f\d]{4})|\\x([a-f\d]{2})/gi,
    (_, point, unicode, hex) => String.fromCodePoint(parseInt(point ?? unicode ?? hex, 16)));
  return value.includes("\\") ? null : value;
}

function safeOptions(tokens) {
  if (tokens.length !== 1 || tokens[0].kind !== "{") return false;
  return splitTokens(tokens[0].tokens).every((property) => {
    const name = propertyName(property[0]);
    // A prototype setter can inherit recursive options without spelling the property here.
    return name !== null && name !== "recursive" && name !== "__proto__" && property[1]?.value === ":" && property.length > 2;
  });
}

function recursiveFlags(flags) {
  for (const flag of flags) {
    if (flag === "--" || !flag.startsWith("-")) return false;
    if (/^-[a-z]*[rR][a-z]*$/i.test(flag) || flag === "--recursive") return true;
  }
  return false;
}

function shellDelete(text) {
  for (const match of text.matchAll(/\brm\b((?:[ \t]+(?:--[a-z-]+|-[a-zA-Z]+)(?=$|[\s"'\x60;|&)]))*)/g)) {
    if (recursiveFlags(match[1].trim().split(/\s+/))) return true;
  }
  return false;
}

function shellArrayDelete(text) {
  // Command and array must be adjacent. Reading a balanced array keeps flags in that array.
  for (const match of text.matchAll(/(["'])rm\1\s*,\s*\[/g)) {
    try {
      const array = readGroup(text, match.index + match[0].length - 1);
      const flags = splitTokens(array.tokens).map((part) =>
        part.length === 1 && part[0].kind === "string" ? part[0].value : "");
      if (recursiveFlags(flags)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function scanCode(text) {
  const hits = scanProse(text);
  for (const m of text.matchAll(DELETE_CALL)) {
    try {
      const args = splitTokens(readGroup(text, m.index + m[0].length - 1).tokens);
      if (args.length > 1 && !safeOptions(args[1])) hits.push(`${m[1]}: unsafe options`);
    } catch {
      hits.push(`${m[1]}: unclassifiable arguments`);
    }
  }
  for (const re of CODE_ALWAYS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  // Arrays can span lines, while prose allowances remain line-local.
  const commands = text.split("\n").filter((line) => !explainsBan(line)).join("\n");
  if (shellArrayDelete(commands)) hits.push("recursive shell delete");
  return hits;
}

function explainsBan(line) {
  return PROHIBITION.test(line) || BLOCK_REASON.test(line);
}

export function scanProse(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if ((shellDelete(line) || PROSE_BANNED.some((re) => re.test(line))) && !explainsBan(line)) hits.push(`line ${i + 1}: ${line.slice(0, 80)}`);
  });
  return hits;
}

function scannedFiles(root = REPO) {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules") continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.(mjs|js|md|json|yml|yaml|sh)$/.test(ent.name)) out.push(p);
    }
  };
  for (const d of SCAN_DIRS) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  for (const f of SCAN_FILES) if (fs.existsSync(path.join(root, f))) out.push(path.join(root, f));
  return out.filter((p) => !SKIP.has(path.join(REPO, path.relative(root, p))));
}

test("guard: the scanner catches every banned form and lets creation through", () => {
  const shellBad = [
    'execSync("rm -rf " + dir)',
    'exec("rm -f -r build")',
    'execSync(`rm -R ${dir}`)',
    'spawnSync("rm", ["-rf", dir])',
    "spawn('rm', ['-f', '--recursive', dir])",
    'spawnSync("rm", [\n "-f",\n "-R", dir\n])',
    'spawnSync("rm", ["-fr", dir])',
  ];
  for (const source of shellBad) assert.ok(scanCode(source).length, source);
  for (const source of [
    'exec("rm -f file")',
    'exec("rm -- -rf")',
    'exec("rm -f file; echo -r")',
    'spawnSync("rm", ["-f", dir]); other(["-r"])',
    'spawnSync("rm", ["--", "-rf"])',
    'spawnSync("rm", [\n "-f", file\n])',
    'spawnSync("rm", [\n "--", "-rf"\n])',
    'assert.ok(text.includes("rm -rf"), "a harness may block it");',
    'assert.ok(text.includes("rm -rf"), "Never use it");',
  ]) assert.deepEqual(scanCode(source), [], source);
  for (const source of ["rm -f -r build", "rm -f --recursive build", "rm -fr build", "rm -R build"]) {
    assert.ok(scanProse(source).length, source);
  }
  for (const source of ["rm -f file", "rm -- -rf", "rm -f file; echo -r", "rm -f file\necho -r"]) {
    assert.deepEqual(scanProse(source), [], source);
  }
  const unsafe = [
    "opts", "options()", "{ ...opts }", "{ recursive, force: true }", "{ force }",
    '{ "recursive": true }', "{ recursive: !0 }", "{ recursive: false }",
    "{ recursi\\u0076e: true }", "{ ['recursive']: false }",
    '{ ["recursi\\u0076e"]: true }', "{ [key]: true }",
    "{ get recursive() { return false; } }", "{ __proto__: opts }",
    '{ "recursi\\x76e": false }', "{ recursi\\u{76}e: false }",
  ];
  const safe = ["{}", "{ force: true }", '{ "force": true }', "{ fo\\u0072ce: true }",
    "{ ['force']: true }", "{ force: check(a, b), maxRetries: 2, }",
    '{ "fo\\x72ce": true }', "{ fo\\u{72}ce: true }"];
  const paths = [
    "dir", 'path.join(a, "b,)")', '"a\\\"b,)"',
    "/[,)]/.test(name) ? a : b", "/a\\/[,)]/.test(name) ? a : b",
    "size / divisor", "a / b / c",
    '`a${join(`b${name}`, ",)")}`',
    "/* ,) */ path.join(a, b) // ,)\n",
  ];
  for (const api of ["rm", "rmSync", "rmdir", "rmdirSync", "fs.rmSync", "fs.promises.rm", "fsp.rmdir"]) {
    for (const target of paths) {
      for (const options of unsafe) {
        const source = `${api}(${target}, ${options})`;
        assert.ok(scanCode(source).length, source);
      }
      for (const options of safe) {
        const source = `${api}(${target}, ${options})`;
        assert.deepEqual(scanCode(source), [], source);
      }
      assert.deepEqual(scanCode(`${api}(${target})`), [], `${api}(${target})`);
    }
  }
  for (const source of ['fs.rmSync("unterminated)', "fs.rmSync(/unterminated)", "fs.rmSync(path(",
    "fs.rmSync(dir, { [a + b]: true })", "fs.rmSync(dir, {} || opts)", "fs.rmSync(@path)", "fs.rmSync(i++)"]) {
    assert.ok(scanCode(source).length, source);
  }

  assert.ok(scanCode("fs.rmSync(d, { recursive: true });").length > 0);
  assert.ok(scanCode('fs.rmSync(path.join(a, "b"), { recursive:true, force: true });').length > 0);
  assert.ok(scanCode("fs.rmSync(\n  dir,\n  { recursive: true }\n);").length > 0);
  assert.ok(scanCode("await fs.promises.rm(d, { recursive: true });").length > 0);
  assert.ok(scanCode("fsp.rmdir(d, {recursive: true})").length > 0);
  assert.ok(scanCode('import rimraf from "rimraf";').length > 0);
  assert.ok(scanCode("shutil.rmtree(d)").length > 0);
  assert.ok(scanCode('import { rmSync } from "node:fs";\nrmSync(d, { recursive: true });').length > 0);
  assert.deepEqual(scanCode("perform(x, { recursive: true });"), []);
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
  assert.ok(scanProse("If the step is blocked, run rm -rf tmp").length > 0);
  assert.ok(scanProse("blockSize=4 rm -rf tmp # block cleanup").length > 0);
  assert.deepEqual(scanProse("Reasonable people block `rm -rf` in their harness."), []);
  assert.deepEqual(scanProse("Remove it file by file, because a harness may block `rm -rf`."), []);
  assert.ok(scanProse("Clear the banner cache with rm -rf cache").length > 0);
  assert.ok(scanProse("Save bandwidth: rm -rf dist").length > 0);
  assert.deepEqual(scanProse("ADR-016 bans `rm -rf`."), []);
  assert.deepEqual(scanProse("`rm -rf` is banned and forbidden here."), []);
});

function scanFiles(root = REPO) {
  const problems = [];
  for (const file of scannedFiles(root)) {
    const text = fs.readFileSync(file, "utf8");
    const hits = /\.(mjs|js)$/.test(file) ? scanCode(text) : scanProse(text);
    for (const hit of hits) problems.push(`${path.relative(root, file)}: ${hit}`);
  }
  return problems;
}

test("guard: no scanned file uses a recursive or forced directory delete", () => {
  const root = scratch();
  const fixtures = {
    ".github/workflows/example.yml": "run: rm -f -r build",
    ".github/workflows/example.yaml": "run: rm --recursive build",
    ".github/cleanup.sh": "rm -R build",
    ".github/workflows/safe.yml": "run: rm -- -rf",
    ".github/safe.sh": "rm file",
    "skills/safe.mjs": "fs.rmSync(file, { force: true })",
    "tools/safe.js": "fs.rmdirSync(dir)",
    "agents/safe.md": "Never use rm -rf",
    "docs/safe.json": "{}",
    "README.md": "rm file",
    "AGENTS.md": "Never use rm -rf",
    "skills/node_modules/ignored.sh": "rm -rf build",
    "docs/ADR/ADR-016-no-recursive-force-delete.md": "rm -rf build",
    "skills/10x-pipeline/test/no-recursive-delete.test.mjs": "rm -rf build",
    ".github/ignored.txt": "rm -rf build",
  };
  for (const [file, text] of Object.entries(fixtures)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const discovered = scannedFiles(root).map((file) => path.relative(root, file));
  assert.deepEqual(discovered.sort(), Object.keys(fixtures).filter((file) =>
    !file.includes("node_modules") && !file.endsWith(".txt") &&
    file !== "docs/ADR/ADR-016-no-recursive-force-delete.md" &&
    file !== "skills/10x-pipeline/test/no-recursive-delete.test.mjs").sort());
  const problems = scanFiles(root);
  assert.equal(problems.length, 3, problems.join("\n"));
  for (const file of Object.keys(fixtures).slice(0, 3)) {
    assert.ok(problems.some((problem) => problem.startsWith(file + ": ")), file);
  }
  assert.ok(scannedFiles().some((file) => file.endsWith(path.join("scripts", "route.mjs"))), "the walk reaches the router");
  assert.deepEqual(scanFiles(), []);
});

test("guard: the rule stays where agents read it", () => {
  // The rule lives in the always-true rules/top.md (ADR-023), which no policy key or project override changes.
  const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  assert.ok(!policy.prompts.suffix.includes("`rm -rf`"), "the overridable suffix no longer carries the ban");
  const top = fs.readFileSync(path.join(SKILL_DIR, "rules/top.md"), "utf8").split("\n");
  assert.ok(top.some((l) => l.includes("**GIVEN**") && l.includes("**MUST NOT**") && l.includes("`rm -rf`") && l.includes("recursive: true")), "top.md ban");
  assert.ok(top.some((l) => l.includes("**GIVEN**") && l.includes("**MUST**") && l.includes("one by one") && l.includes("`rmdir`") && l.includes("deepest first")), "top.md procedure");
  const ban = top.findIndex((l) => l.includes("`rm -rf`"));
  assert.ok(ban < top.findIndex((l) => l.startsWith("RESULT:")), "rules come before the RESULT instructions");
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
