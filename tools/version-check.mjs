// Version-drift guard for the plugin package.
// The plugin version sits in several fields that must stay equal and be valid SemVer 2.0.0:
//   .claude-plugin/plugin.json       -> version
//   .claude-plugin/marketplace.json  -> metadata.version and plugins[0].version
// release-please updates them together (release-please-config.json `extra-files`); this check fails
// if a manual edit, a bad updater config or a partial revert makes them differ.
// Plain node: built-ins only. Exit 0 when the fields agree, 1 otherwise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Official SemVer 2.0.0 expression from https://semver.org.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function readJson(root, rel) {
  const file = path.join(root, rel);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`${rel} cannot be read`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${rel} is not valid JSON`);
  }
}

// Returns [label, version] for every tracked field. Throws when a file or a field is missing.
export function collect(root = ROOT) {
  const plugin = readJson(root, ".claude-plugin/plugin.json");
  const marketplace = readJson(root, ".claude-plugin/marketplace.json");
  const fields = [
    ["plugin.json:version", plugin.version],
    ["marketplace.json:metadata.version", marketplace.metadata?.version],
    ["marketplace.json:plugins[0].version", marketplace.plugins?.[0]?.version],
  ];
  for (const [label, value] of fields) {
    if (typeof value !== "string") throw new Error(`${label} is missing`);
  }
  return fields;
}

// Returns a list of error strings; empty when every field is valid SemVer and all are equal.
export function check(root = ROOT) {
  let fields;
  try {
    fields = collect(root);
  } catch (error) {
    return [error.message];
  }
  const errors = [];
  const reference = fields[0][1];
  for (const [label, value] of fields) {
    if (!SEMVER.test(value)) errors.push(`${label} = ${JSON.stringify(value)} is not a SemVer 2.0.0 version`);
    else if (value !== reference) errors.push(`${label} = ${JSON.stringify(value)} (expected ${JSON.stringify(reference)})`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = check();
  if (errors.length > 0) {
    console.error("version-check: version fields drift or are invalid:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`version-check: OK (${collect()[0][1]})`);
}
