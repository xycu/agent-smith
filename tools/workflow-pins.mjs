// Pin guard for GitHub Actions.
// Every remote action a workflow or a composite action uses must be pinned to a full commit SHA,
// followed by its version in a comment: `uses: owner/repo[/path]@<40 hex> # vX.Y.Z`.
// A tag can be moved to other code; a commit SHA cannot.
// Read: every *.yml and *.yaml file under .github/ (workflows, composite actions) and a root action.yml or action.yaml.
// Local (`./`) and `docker://` references are skipped.
// Plain node: built-ins only. No YAML parser, so anything unusual fails closed (see findUses).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAML = /\.ya?ml$/;
const PINNED = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40} # v\d+\S*$/;
// A `uses` key at any place of a line: plain, quoted, after `- ` or inside a flow mapping.
const USES = /(?:^|[\s{,])["']?uses["']?\s*:(?:\s+(.*?))?\s*$/;

// Returns { line, value } for every `uses:` of a text that is not a local or docker reference.
// The value is the rest of the line, comment included. A quoted value, a flow mapping, a value on the
// next line or a `uses:` inside a multi-line scalar are returned as they stand, so check() rejects them.
export function findUses(text) {
  const found = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trimStart().startsWith("#")) return;
    const m = raw.match(USES);
    if (!m) return;
    const value = m[1] ?? "";
    if (!value.startsWith("./") && !value.startsWith("docker://")) found.push({ line: index + 1, value });
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
  let count = 0;
  for (const file of files(root)) {
    for (const { line, value } of findUses(fs.readFileSync(path.join(root, file), "utf8"))) {
      count++;
      if (!PINNED.test(value)) errors.push(`${file}:${line}: unpinned action "uses: ${value}"`);
    }
  }
  if (count === 0) errors.push("no uses: line found");
  return errors;
}
