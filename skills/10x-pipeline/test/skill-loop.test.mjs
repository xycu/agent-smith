// Content check of the `## Anti-stall rules` section of SKILL.md. Its rule form is checked in rules.test.mjs.
// SKILL_PATH overrides the file, for the deliberate-break check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../SKILL.md");
const skill = fs.readFileSync(process.env.SKILL_PATH || DEFAULT_PATH, "utf8");
const lines = skill.split("\n");

const HEADING = "## Anti-stall rules";

// The section: from its heading to the next `## ` heading.
function section() {
  const start = lines.findIndex((l) => l === HEADING);
  assert.ok(start >= 0, `no ${HEADING} section`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end);
}

// A SKILL.md loop branch: from the line starting `- **`<name>`**` to the next line that starts with `- **` or `## `.
// Local copy of the helper in pr-comment.test.mjs, which is not exported.
function branch(name) {
  const start = lines.findIndex((l) => l.startsWith(`- **\`${name}\`**`));
  assert.ok(start >= 0, `no ${name} branch`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- **") && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

const NEEDLES = [
  ["run_in_background", "launch notice", "end its turn"],
  ["without `usage`", "`next`", "same turn"],
  ["**MUST NOT**", "rewrite", "result file"],
  ["done", "archive", "halt", "still running"],
  ["tool output", "nothing is running"],
];

test("the section holds exactly five rule lines, and SKILL.md has no other **GIVEN** line", () => {
  const rules = section().filter((l) => l.includes("**GIVEN**"));
  assert.equal(rules.length, 5);
  assert.equal(lines.filter((l) => l.includes("**GIVEN**")).length, 5);
});

test("rule line k holds the needles of behavior k", () => {
  const rules = section().filter((l) => l.includes("**GIVEN**"));
  NEEDLES.forEach((needles, k) => {
    for (const needle of needles) {
      assert.ok(rules[k] && rules[k].includes(needle), `rule ${k + 1} lacks "${needle}"`);
    }
  });
});

test("the section lies between ## Loop and ## PR comment (opt-in), outside every Loop branch", () => {
  const a = lines.indexOf("## Loop");
  const b = lines.indexOf(HEADING);
  const c = lines.indexOf("## PR comment (opt-in)");
  assert.ok(a >= 0 && a < b && b < c, "section is not between Loop and PR comment");
  for (const name of ["run", "done", "archive", "halt"]) {
    assert.ok(!branch(name).includes("**GIVEN**"), `${name} branch holds a rule line`);
  }
});

test("the run branch points at the anti-stall rules", () => {
  assert.ok(branch("run").includes("anti-stall rules"));
});

test("the section names no model, effort or tier", () => {
  assert.doesNotMatch(section().join("\n"), /\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i);
});
