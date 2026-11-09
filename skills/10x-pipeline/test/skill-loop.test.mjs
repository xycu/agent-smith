// Content check of the `## Anti-stall rules` section of SKILL.md. Its rule form is checked in rules.test.mjs.
// It also pins the `## Pull request (always)` section and its place in the done, archive and halt branches (ADR-017).
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
  ["did not launch", "**MUST NOT**", "result file", "`next`", "own report"],
];

test("the section holds exactly six rule lines, and SKILL.md has no other **GIVEN** line", () => {
  const rules = section().filter((l) => l.includes("**GIVEN**"));
  assert.equal(rules.length, 6);
  assert.equal(lines.filter((l) => l.includes("**GIVEN**")).length, 6);
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

// ---- Pull request (always), ADR-017 ---------------------------------------------------------

const PR_HEADING = "## Pull request (always)";

// A section by heading: from it to the next `## ` heading.
function sectionOf(heading) {
  const start = lines.findIndex((l) => l === heading);
  assert.ok(start >= 0, `no ${heading} section`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

test("the OPEN_PR line points at the open-pr script, which exists", () => {
  const line = lines.find((l) => l.startsWith("Pull request script: "));
  assert.ok(line && line.includes("`OPEN_PR=<this skill's base directory>/scripts/open-pr.mjs`"), line);
  assert.ok(fs.statSync(path.resolve(path.dirname(DEFAULT_PATH), "scripts/open-pr.mjs")).isFile());
});

test("the pull request section follows ## PR comment (opt-in) and runs the script from the run root", () => {
  const c = lines.indexOf("## PR comment (opt-in)");
  const p = lines.indexOf(PR_HEADING);
  assert.ok(c >= 0 && p > c, "pull request section is not after the PR comment section");
  const text = sectionOf(PR_HEADING);
  assert.match(text, /`cd "<run root>" && node \$OPEN_PR <change-id>`/);
  assert.match(text, /Pull request: NOT pushed, <reason>\. Branch agent-smith\/<change-id> is local only: <manual>/);
  assert.match(text, /never merges/);
  assert.match(text, /isolation\.require: false/);
  assert.doesNotMatch(text, /\b(sonnet|opus|haiku|fable|effort|tier|tiers|model|low|medium|high|xhigh|max)\b/i);
  assert.ok(!text.includes("**GIVEN**"));
});

test("done, archive and halt run the pull request step before the PR comment step and before any STOP", () => {
  for (const name of ["done", "archive", "halt"]) {
    const text = branch(name);
    const pr = text.indexOf("do the pull request step");
    const comment = text.indexOf("do the PR comment step");
    assert.ok(pr >= 0, `${name} has no pull request step`);
    assert.ok(comment > pr, `${name}: the PR comment step is not after the pull request step`);
  }
  const archive = branch("archive");
  assert.match(archive, /\n {2}4\. Write no result file and do not call `next`/);
  assert.match(archive, /\n {2}5\. Run `cd "<run root>" && node \$ROUTER verify-archive/);
  const step5 = archive.slice(archive.indexOf("\n  5. "));
  assert.ok(step5.indexOf("do the pull request step") >= 0, "the pull request step is not in step 5");
  assert.ok(step5.indexOf("do the pull request step") < step5.indexOf("On `archived: false`"), "pull request step after the STOP of archived: false");
  assert.ok(!archive.slice(0, archive.indexOf("\n  5. ")).includes("PR comment step"), "the PR comment step is still before the move");
  const halt = branch("halt");
  assert.match(halt, /Before you STOP, do the pull request step\. Then call TaskList\./);
});
