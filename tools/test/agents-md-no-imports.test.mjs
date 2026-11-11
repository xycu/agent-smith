import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Claude Code loads an `@path` outside code as an import into every session.
// Its rule (read from the 2.1.311 binary): `@` at a line start or after
// whitespace, then a token that starts with `./`, `~/`, `/` or `[a-zA-Z0-9._-]`,
// with any extension or none. The guard is stricter on purpose: it also flags an
// `@` after punctuation, so a looser rule in a later version stays covered.
function findImports(text) {
  const plain = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return plain.match(/(?<![\w@])@(?:~\/|\/(?=\S)|[a-zA-Z0-9._-])(?:[^\s\\]|\\ )*/g) || [];
}

test("matcher flags a bare import and ignores a code span", () => {
  assert.equal(findImports("See @README.md here").length, 1);
  assert.equal(findImports("See `@README.md` here").length, 0);
  assert.equal(findImports("```\n@README.md\n```").length, 0);
});

test("matcher flags an import of any extension and path form", () => {
  for (const path of ["docs/notes.txt", "LICENSE", "./a.md", "~/.claude/x.md", "/etc/x", ".env", "my\\ file.md"]) {
    assert.deepEqual(findImports(`See @${path} here`), [`@${path}`], path);
  }
  assert.deepEqual(findImports("@README.md\n@docs/REFERENCE.md"), ["@README.md", "@docs/REFERENCE.md"]);
});

test("matcher flags an import that follows punctuation", () => {
  for (const text of ["(@README.md)", "\"@README.md\"", "[@README.md]", "see:@README.md", "- <@README.md>"]) {
    assert.equal(findImports(text).length, 1, text);
  }
});

test("matcher ignores an @ that starts no import", () => {
  for (const text of ["blazej@ksycki.pl", "a @ b", "@ README.md", "@@README.md", "@#top", "ends with @"]) {
    assert.deepEqual(findImports(text), [], text);
  }
});

for (const name of ["AGENTS.md", "CLAUDE.md"]) {
  test(`${name} has no @ imports`, { skip: !existsSync(join(root, name)) }, () => {
    assert.deepEqual(findImports(readFileSync(join(root, name), "utf8")), []);
  });
}
