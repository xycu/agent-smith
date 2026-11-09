// Content check of the Manual gate in the `archive` branch of both SKILL.md files (ADR-014).
// The router data it reads is pinned elsewhere: archive.test.mjs (pending row in summary.manualPending)
// and openspec-archive.test.mjs (manualPending is []).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SKILLS = {
  "10x": "skills/10x-pipeline/SKILL.md",
  openspec: "skills/openspec-pipeline/SKILL.md",
};

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// From the line starting `- **`<name>`**` to the next line that starts with `- **` or `## `.
function branch(skill, name) {
  const lines = skill.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`- **\`${name}\`**`));
  assert.ok(start >= 0, `no ${name} branch`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- **") && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

for (const [chain, rel] of Object.entries(SKILLS)) {
  const skill = read(rel);

  test(`${chain}: allowed-tools lists AskUserQuestion`, () => {
    const front = skill.split("\n---")[0];
    assert.match(front, /^ {2}- AskUserQuestion$/m);
  });

  test(`${chain}: the archive branch asks before it launches the subagent`, () => {
    const archive = branch(skill, "archive");
    for (const k of ["manualPending", "manualUnproven", "uncommittedTicks"]) assert.ok(archive.includes(`summary.${k}`), k);
    const ask = archive.indexOf("AskUserQuestion");
    // ADR-017 moved the PR comment step to step 5, after the move; the question follows the status report of step 1.
    assert.ok(ask > archive.indexOf("node $ROUTER status"), "after the status report");
    assert.ok(ask < archive.indexOf("Call the Agent tool"), "before the Agent call");
  });

  test(`${chain}: labels, fail-closed reading and STOP`, () => {
    const archive = branch(skill, "archive");
    assert.ok(archive.includes("`No, keep it unarchived` first and `Yes, archive anyway` second"));
    assert.match(archive, /Fail closed/);
    assert.match(archive, /no question tool/);
    assert.match(archive, /Archive: skipped, <n> Manual check\(s\) pending or unproved\./);
    assert.match(archive, /at most 10, then "and N more"/);
    assert.match(archive, /STOP with a final message/);
  });

  test(`${chain}: step numbers stay and the other branches do not ask`, () => {
    const archive = branch(skill, "archive");
    assert.ok(archive.includes("4. Write no result file"));
    for (const n of [1, 2, 3, 4, 5]) assert.match(archive, new RegExp(`^ {2,3}${n}\\. `, "m"));
    for (const name of ["run", "done", "halt"]) {
      assert.ok(!branch(skill, name).includes("AskUserQuestion"), `${name} must not ask`);
    }
  });

  test(`${chain}: still exactly six GIVEN lines`, () => {
    assert.equal(skill.split("\n").filter((l) => l.includes("**GIVEN**")).length, 6);
  });
}

test("the router scripts never mention AskUserQuestion", () => {
  const dir = path.join(ROOT, "skills/10x-pipeline/scripts");
  for (const f of fs.readdirSync(dir)) {
    assert.ok(!fs.readFileSync(path.join(dir, f), "utf8").includes("AskUserQuestion"), f);
  }
});
