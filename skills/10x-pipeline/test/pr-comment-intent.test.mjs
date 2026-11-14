// Durable opt-in through the real router. These fixtures never invoke the posting script.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, readMetaFile, writeMetaFile, writeLog, entry,
  planText, gitInit, gitEnv, commitFiles,
} from "./helpers.mjs";
import { writeReview } from "./ahead.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);
const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";

function projectFor(chain, complete = false) {
  const project = chain === "openspec" ? makeOpenspecProject() : makeProject({ plan: complete ? planText({ done: 1 }) : null });
  if (!complete) return project;
  if (chain === "openspec") {
    writeArtifacts(project, { proposal: true, specs: 1, tasks: { done: 1 }, verify: PASS });
    writeLog(project, [entry(1, "os-apply"), entry(2, "os-verify")]);
  } else {
    fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: impl_reviewed\ncreated: 2026-01-01\n---\n");
    writeReview(project, "plan-review", { verdict: "SOUND" });
    writeReview(project, "impl-review", { verdict: "APPROVED" });
    writeLog(project, [entry(1, "implement"), entry(2, "impl-review")]);
  }
  return project;
}

function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true }).sort()
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .map((name) => [name, fs.readFileSync(path.join(dir, name), "base64")]));
}

for (const chain of ["10x", "openspec"]) {
  const start = (project, flags = []) => run(project, ["init", project.id, "--chain", chain, "--goal", "fix typo", ...flags]);

  test(`${chain}: PR comment accepts both boolean flag forms and status exposes stored intent`, () => {
    for (const [flags, expected] of [
      [["--pr-comment"], true], [["--pr-comment", "true"], true], [["--pr-comment=true"], true],
      [["--pr-comment", "false"], false], [["--pr-comment=false"], false],
    ]) {
      const project = projectFor(chain);
      assert.equal(start(project, flags).json.action, "run");
      assert.equal(readMetaFile(project).prComment, expected);
      assert.equal(run(project, ["status", project.id, "--chain", chain]).json.prComment, expected ? true : undefined);
    }
  });

  test(`${chain}: direct resume keeps intent and explicit false resets it durably`, () => {
    const project = projectFor(chain);
    start(project, ["--pr-comment"]);
    start(project);
    assert.equal(readMetaFile(project).prComment, true);
    start(project, ["--pr-comment", "false"]);
    start(project);
    assert.equal(readMetaFile(project).prComment, false);
    assert.equal(Object.hasOwn(run(project, ["status", project.id, "--chain", chain]).json, "prComment"), false);
  });

  test(`${chain}: malformed PR intent is refused before changing run state`, () => {
    for (const value of ["yes", "1", "", "null"]) {
      const project = projectFor(chain);
      const before = snapshot(project.changeDir);
      const result = start(project, [`--pr-comment=${value}`]);
      assert.equal(result.json.action, "halt");
      assert.match(result.json.reason, /Invalid --pr-comment/);
      assert.deepEqual(snapshot(project.changeDir), before);
    }
  });

  test(`${chain}: done, resumed done and legacy metadata preserve strict opt-in`, () => {
    for (const intent of [true, false, undefined, "true"]) {
      const project = projectFor(chain, true);
      writeMetaFile(project, { id: project.id, ...(chain === "openspec" ? { chain } : {}), ...(intent === undefined ? {} : { prComment: intent }) });
      for (const command of ["init", "next"]) {
        const result = command === "init" ? start(project) : run(project, [command, project.id, "--chain", chain]);
        assert.equal(result.json.action, "done", result.stdout);
        assert.equal(result.json.prComment === true, intent === true);
      }
    }
    const reset = projectFor(chain, true);
    assert.equal(start(reset, ["--pr-comment"]).json.prComment, true);
    assert.equal(start(reset, ["--pr-comment=false"]).json.prComment, undefined);
  });

  test(`${chain}: an ended needs-human halt carries authorized intent`, () => {
    const project = projectFor(chain);
    writeLog(project, [entry(1, chain === "openspec" ? "os-propose" : "plan", { signals: { needsHuman: "fixture decision" } })]);
    const result = start(project, ["--pr-comment"]);
    assert.equal(result.json.action, "halt");
    assert.match(result.json.reason, /needs a human/);
    assert.equal(result.json.prComment, true);
  });

  test(`${chain}: archive and archive-precheck halt keep the terminal intent`, () => {
    const project = projectFor(chain, true);
    gitInit(project);
    commitFiles(project, ["README.md"]);
    const result = run(project, ["init", project.id, "--chain", chain, "--archive", "--pr-comment"], { env: gitEnv(project) });
    assert.equal(result.json.action, "archive", result.stdout);
    assert.equal(result.json.prComment, true);
    fs.mkdirSync(path.join(project.root, result.json.archivePath), { recursive: true });
    const stopped = run(project, ["next", project.id, "--chain", chain], { env: gitEnv(project) });
    assert.equal(stopped.json.action, "halt", stopped.stdout);
    assert.equal(stopped.json.prComment, true);
  });
}
