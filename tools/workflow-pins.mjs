// Pin guard for GitHub Actions.
// Every remote action a workflow or a composite action uses must be pinned to a full commit SHA,
// followed by its version in a comment: `uses: owner/repo[/path]@<40 hex> # vX.Y.Z`.
// A tag can be moved to other code; a commit SHA cannot.
// Read: every *.yml and *.yaml file under .github/ (workflows, composite actions) and a root action.yml or action.yaml.
// Follow root-relative local actions recursively, including outside .github/, scanning each canonical metadata file once.
// Missing or unreadable local metadata fails closed. Docker references are skipped.
// Plain node: built-ins only. No YAML parser, so anything unusual fails closed (see findUses).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAML = /\.ya?ml$/;
const PINNED = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40} # v\d+\S*$/;
// A `uses` key at any place of a line: plain, quoted, after `- ` or inside a flow mapping.
const USES = /(?:^|[\s{,])["']?uses["']?\s*:(?:\s+(.*?))?\s*$/;

// Returns { line, value } for every `uses:` of a text except Docker references.
// The value is the rest of the line, comment included. A quoted value, a flow mapping, a value on the
// next line or a `uses:` inside a multi-line scalar are returned as they stand, so check() rejects them.
export function findUses(text) {
  const found = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trimStart().startsWith("#")) return;
    const m = raw.match(USES);
    if (!m) return;
    const value = m[1] ?? "";
    if (!value.startsWith("docker://")) found.push({ line: index + 1, value });
  });
  return found;
}

// Returns the files to check, relative to root, sorted.
export function files(root = ROOT) {
  const found = [];
  const github = path.join(root, ".github");
  if (fs.existsSync(github)) {
    for (const entry of fs.readdirSync(github, { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && YAML.test(entry.name)) found.push(path.relative(root, path.join(entry.parentPath, entry.name)));
    }
  }
  for (const name of ["action.yml", "action.yaml"]) {
    if (fs.existsSync(path.join(root, name))) found.push(name);
  }
  return found.sort();
}

// Returns a list of error strings; empty when every remote action is pinned and at least one was found.
export function check(root = ROOT) {
  const errors = [];
  const visited = new Set();
  const queue = files(root).map((file) => ({ file, source: file }));
  root = path.resolve(root);
  const canonicalRoot = fs.realpathSync(root);
  let count = 0;

  function contained(target) {
    const lexical = path.relative(root, target);
    if (lexical === ".." || lexical.startsWith(`..${path.sep}`) || path.isAbsolute(lexical)) {
      throw new Error("target escapes checked root");
    }
    const canonical = fs.realpathSync(target);
    const relative = path.relative(canonicalRoot, canonical);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("target escapes checked root");
    }
    return canonical;
  }

  for (const { file, source } of queue) {
    let text;
    try {
      const target = contained(path.resolve(root, file));
      if (!fs.statSync(target).isFile()) throw new Error("expected regular file");
      if (visited.has(target)) continue;
      text = fs.readFileSync(target, "utf8");
      visited.add(target);
    } catch (error) {
      errors.push(`${source}: cannot read ${file} (${error.code ?? error.message})`);
      continue;
    }
    for (const { line, value } of findUses(text)) {
      if (!value.startsWith("./")) {
        count++;
        if (!PINNED.test(value)) errors.push(`${file}:${line}: unpinned action "uses: ${value}"`);
        continue;
      }
      const source = `${file}:${line}: local action "uses: ${value}"`;
      // Restrict traversal to plain static paths. Remote values keep their raw pin comments.
      const local = value.match(/^(\.\/[^\s"'\x00-\x1f\x7f{}\[\],#\`$\\]*)(?:[ \t]+#.*)?$/);
      if (!local) {
        errors.push(`${source}: unsupported local path`);
        continue;
      }
      const target = path.resolve(root, local[1]);
      try {
        if (/^\.\/\.github\/workflows\/[^/]+\.ya?ml$/.test(local[1])) {
          queue.push({ file: path.relative(root, target), source });
          continue;
        }
        const directory = contained(target);
        if (!fs.statSync(directory).isDirectory()) throw new Error("expected action directory");
        let found = false;
        for (const name of ["action.yml", "action.yaml"]) {
          const metadata = path.join(target, name);
          try {
            fs.lstatSync(metadata);
          } catch (error) {
            if (error.code === "ENOENT") continue;
            throw error;
          }
          found = true;
          queue.push({ file: path.relative(root, metadata), source });
        }
        if (!found) throw new Error("metadata missing");
      } catch (error) {
        errors.push(`${source}: expected action.yml or action.yaml at ${local[1]} (${error.code ?? error.message})`);
      }
    }
  }
  if (count === 0) errors.push("no uses: line found");
  return errors;
}
