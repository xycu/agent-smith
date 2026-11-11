import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Claude Code loads an `@path` outside code as an import into every session.
export function findImports(text) {
  const plain = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return plain.match(/(^|\s)@[\w./-]+\.(md|json|mjs)\b/gm) || [];
}

test("matcher flags a bare import and ignores a code span", () => {
  assert.equal(findImports("See @README.md here").length, 1);
  assert.equal(findImports("See `@README.md` here").length, 0);
});

for (const name of ["AGENTS.md", "CLAUDE.md"]) {
  test(`${name} has no @ imports`, { skip: !existsSync(join(root, name)) }, () => {
    assert.deepEqual(findImports(readFileSync(join(root, name), "utf8")), []);
  });
}
