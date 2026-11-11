// workflow-pins: every remote action in .github/workflows is pinned to a full commit SHA with a version comment.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.github/workflows");
const PINNED = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40} # v\d+\S*$/;

export function findUses(text) {
  const found = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:-\s+)?uses:\s*(.+?)\s*$/);
    if (m && !m[1].startsWith("./") && !m[1].startsWith("docker://")) found.push(m[1]);
  }
  return found;
}

test("every remote action is pinned to a commit SHA with a version comment", () => {
  let count = 0;
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".yml"))) {
    for (const value of findUses(fs.readFileSync(path.join(DIR, file), "utf8"))) {
      count++;
      assert.match(value, PINNED, `${file}: unpinned action "uses: ${value}"`);
    }
  }
  assert.ok(count > 0, "no uses: line found");
});

test("a tag reference is rejected", () => {
  assert.ok(findUses("      - uses: actions/checkout@v5\n").every((v) => !PINNED.test(v)));
});
