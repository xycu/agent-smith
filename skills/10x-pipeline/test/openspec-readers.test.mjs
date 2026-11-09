// OpenSpec chain, owner decisions on the implementation review (F4 to F8): the task row pattern of the CLI, the guards
// of the tasks.md and verify.md readers, the chain halt on a 10x run and the produced files of compare.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanupAll, run, writeLog, writeMetaFile, entry } from "./helpers.mjs";
import { makeOpenspecProject, initOpenspec } from "./openspec-helpers.mjs";
import { readTasks, readVerdict } from "../scripts/openspec.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

after(cleanupAll);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-readers-"));
after(() => removeTree(scratch));

// <scratch>/<name>/ is a change folder with an agent-smith/ subfolder.
function changeFolder(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(path.join(dir, "agent-smith"), { recursive: true });
  return dir;
}

test("F4: a task row is any CLI list form, and only x or X is complete", () => {
  const dir = changeFolder("rows");
  const file = path.join(dir, "tasks.md");
  fs.writeFileSync(file, [
    "## 1. Work", "",
    "- [x] 1.1 Dash done", "- [X] 1.2 Capital done", "- [ ] 1.3 Dash open", "* [ ] 1.4 Star open", "+ [ ] 1.5 Plus open",
    "1. [ ] 1.6 Numbered open", "2) [x] 1.7 Paren done", "- [~] 1.8 Tilde open", "- [] 1.9 Empty open",
    "  - [ ] 1.10 Nested open", "- [x]done", "- [Some doc](./doc.md)", "- Plain bullet", "",
  ].join("\n"));
  assert.deepEqual(readTasks(file), { total: 11, complete: 4, open: 7 });
});

test("F4: a tasks.md of star-bullet rows has rows, so the run does not halt for none", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: "* [ ] 1.1 Star bullet\n" });
  const res = initOpenspec(project, "Add a thing");
  assert.equal(res.json.step, "os-apply", res.stdout);
});

test("F6: tasks.md that is a symlink, outside the change folder or over 256 KiB counts no rows", () => {
  const dir = changeFolder("tasks-guard");
  const elsewhere = path.join(scratch, "elsewhere.md");
  fs.writeFileSync(elsewhere, "- [ ] 1.1 Real row\n");
  const link = path.join(dir, "tasks.md");
  fs.symlinkSync(elsewhere, link);
  assert.equal(readTasks(link).total, 0);
  fs.rmSync(link);
  fs.writeFileSync(link, "- [ ] 1.1 Row\n" + "x".repeat(262144));
  assert.equal(readTasks(link).total, 0);
  fs.writeFileSync(link, "- [ ] 1.1 Row\n");
  assert.equal(readTasks(link).total, 1);
});

const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";

test("F6: verify.md over 64 KiB, or in an agent-smith folder that is a symlink, is refused", () => {
  const dir = changeFolder("verify-guard");
  const file = path.join(dir, "agent-smith/verify.md");
  fs.writeFileSync(file, PASS);
  assert.equal(readVerdict(file).ok, true);
  fs.writeFileSync(file, PASS + "x".repeat(65536));
  assert.equal(readVerdict(file).ok, false);
  const outside = path.join(scratch, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "verify.md"), PASS);
  const linked = changeFolder("verify-linked");
  removeTree(path.join(linked, "agent-smith"));
  fs.symlinkSync(outside, path.join(linked, "agent-smith"));
  const res = readVerdict(path.join(linked, "agent-smith/verify.md"));
  assert.equal(res.ok, false);
  assert.match(res.error, /outside the change folder/);
});

test("F6: control and format characters are stripped from the critical lines", () => {
  const dir = changeFolder("verify-strip");
  const file = path.join(dir, "agent-smith/verify.md");
  fs.writeFileSync(file, "Verdict: FAIL\nCritical: 1\nWarnings: 0\n\n## Critical\n\n- src/a.js:1‮ gu\u0007ard​ it\n");
  const res = readVerdict(file);
  assert.equal(res.ok, true);
  assert.deepEqual(res.criticalLines, ["- src/a.js:1 gu ard it"]);
});

test("F8: --chain openspec on a name that holds a 10x run halts as a contradiction, and writes nothing", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 0, open: 1 } });
  const agent = path.join(project.tenxChangeDir, "agent-smith");
  fs.mkdirSync(agent, { recursive: true });
  fs.writeFileSync(path.join(agent, "meta.json"), JSON.stringify({ id: "demo", goal: "x" }));
  for (const args of [["next", "demo", "--chain", "openspec"], ["status", "demo", "--chain", "openspec"], ["init", "demo", "--goal", "x", "--chain", "openspec"]]) {
    const res = run(project, args);
    assert.equal(res.status, 1, res.stdout);
    assert.match(res.json.reason, /is a 10x run \(context\/changes\/demo\/agent-smith\/meta\.json exists\), so --chain openspec does not apply/);
  }
  assert.equal(fs.existsSync(project.agentDir), false);
  assert.deepEqual(fs.readdirSync(agent), ["meta.json"]);
});

test("F8: a stray 10x folder with no meta.json does not count as a 10x run", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 0, open: 1 } });
  fs.mkdirSync(path.join(project.tenxChangeDir, "agent-smith"), { recursive: true });
  const res = run(project, ["status", "demo", "--chain", "openspec"]);
  assert.equal(res.status, 0, res.stdout);
});

test("F7: compare --chain openspec lists no planning artifact or verdict as an input file", () => {
  const project = makeOpenspecProject({ proposal: true, design: true, specs: 1, tasks: { done: 1, open: 0 } });
  fs.writeFileSync(path.join(project.changeDir, "notes.md"), "mine\n");
  writeLog(project, [entry(1, "os-verify", { usage: { totalTokens: 10 } })]);
  writeMetaFile(project, { id: "demo", goal: "x", chain: "openspec", outcome: { action: "done", reason: "OpenSpec verify PASS" } });
  fs.writeFileSync(path.join(project.agentDir, "verify.md"), PASS);
  const res = run(project, ["compare", "demo", "--chain", "openspec", "--baseline", project.root]);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(res.json.routed.inputFiles, [".openspec.yaml", "notes.md"]);
});
