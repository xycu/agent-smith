// The `changeStatus` key of the plain 10x `done` output (the status of change.md at that call) and the content of the
// `done` branch of both SKILL.md files that uses it.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, run, init, writeLog, entry, writeMetaFile, readMetaFile, readReportFile,
  gitEnv, gitInit, commitFiles, gitAvailable,
} from "./helpers.mjs";
import { makeOpenspecProject, writeVerify } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function finishedProject() {
  const project = makeProject({ plan: planText({ done: 1 }) });
  writeReview(project, "plan-review");
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  return project;
}
const setChangeMd = (project, text) => fs.writeFileSync(path.join(project.changeDir, "change.md"), text);

// ---- router output -----------------------------------------------------------

test("done prints the status of change.md as it is", () => {
  for (const [line, want] of [["status: planned", "planned"], ["status: impl_reviewed", "impl_reviewed"], ['status: "impl_reviewed"', "impl_reviewed"]]) {
    const project = finishedProject();
    setChangeMd(project, `---\nchange_id: demo\n${line}\n---\n`);
    const res = init(project, "fix typo");
    assert.equal(res.json.action, "done", res.stdout);
    assert.equal(res.json.changeStatus, want, line);
  }
});

test("done prints null for a change.md without a status field or without frontmatter", () => {
  for (const text of ["---\nchange_id: demo\n---\n", "no frontmatter here\n"]) {
    const project = finishedProject();
    setChangeMd(project, text);
    const res = init(project, "fix typo");
    assert.equal(res.json.action, "done", res.stdout);
    assert.equal("changeStatus" in res.json, true);
    assert.equal(res.json.changeStatus, null);
  }
});

test("the status is read at each call and stored nowhere", () => {
  const project = finishedProject();
  assert.equal(init(project, "fix typo").json.changeStatus, "planned");
  setChangeMd(project, "---\nchange_id: demo\nstatus: impl_reviewed\n---\n");
  assert.equal(run(project, ["next", project.id]).json.changeStatus, "impl_reviewed");
  assert.equal(JSON.stringify(readMetaFile(project)).includes("changeStatus"), false);
  assert.equal(readReportFile(project).includes("changeStatus"), false);
});

test("a halt output carries no changeStatus", () => {
  const project = makeProject();
  writeLog(project, Array.from({ length: 12 }, (_, i) => entry(i + 1, "plan")));
  const res = init(project, "fix typo");
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal("changeStatus" in res.json, false);
});

test("an archive run returns the archive action with no changeStatus", { skip: !gitAvailable() }, () => {
  const project = makeProject({ plan: planText({ done: 1 }) });
  setChangeMd(project, "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review");
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.equal("changeStatus" in res.json, false);
  assert.equal("changeStatus" in res.json.summary, false);
});

test("an OpenSpec done has no changeStatus", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n" });
  writeLog(project, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
  writeMetaFile(project, { id: "demo", goal: "Add a thing", chain: "openspec" });
  const res = run(project, ["next", project.id]);
  assert.equal(res.json.action, "done", res.stdout);
  assert.equal("changeStatus" in res.json, false);
});

// ---- skill text ---------------------------------------------------------------

// From the line starting `- **`done`**` to the next line that starts with `- **` or `## `.
function doneBranch(rel) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("- **`done`**"));
  assert.ok(start >= 0, "no done branch");
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- **") && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

test("the 10x done branch reports a stale change status and names both ways to close the change", () => {
  const done = doneBranch("skills/10x-pipeline/SKILL.md");
  for (const s of ["changeStatus", "impl_reviewed", "/10x-archive <change-id>", "--archive", "both commands run from the run root"]) {
    assert.ok(done.includes(s), s);
  }
  assert.ok(done.includes("Change status: <changeStatus or missing>, expected impl_reviewed. The run did not set change.md to that status."));
  const at = done.indexOf("changeStatus");
  assert.ok(done.indexOf("$ROUTER status") < at, "after the status call");
  assert.ok(at < done.indexOf("Then do the pull request step"), "before the pull request step");
  assert.equal(done.includes("AskUserQuestion"), false);
  assert.equal(done.includes("**GIVEN**"), false);
});

test("the OpenSpec done branch does not name changeStatus", () => {
  assert.equal(doneBranch("skills/openspec-pipeline/SKILL.md").includes("changeStatus"), false);
});
