// init --pr-comment stores prComment in meta.json like --archive; the done, archive and halt outputs and status carry
// prComment: true when it is set, on both chains. The router never calls gh; the orchestrator posts the report.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, init, readMetaFile, writeMetaFile, writeLog, entry, planText, writeReview, gitInit,
  commitFiles, gitAvailable, gitEnv, git,
} from "./helpers.mjs";
import { makeOpenspecProject, initOpenspec } from "./openspec-helpers.mjs";

after(cleanupAll);

const noGit = !gitAvailable();
const status = (project, extra = []) => run(project, ["status", project.id, ...extra]);
const runNext = (project) => run(project, ["next", project.id], { env: gitEnv(project) });

function writeHook(project, name, script) {
  const dir = path.join(project.base, ".git/hooks");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
}

// A finished 10x run in a git repository, as archiveProject of archive.test.mjs builds it.
function finished10x({ archive = true, prComment = true } = {}) {
  const project = makeProject({ plan: planText({ phases: 1, rowsPerPhase: 1, done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", ...(archive ? { archive: true } : {}), ...(prComment ? { prComment: true } : {}) });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

// A finished OpenSpec run, as finishedRun of openspec-archive.test.mjs builds it.
function finishedOpenspec({ archive = true, prComment = true } = {}) {
  const project = makeOpenspecProject({
    proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n",
  });
  writeLog(project, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
  writeMetaFile(project, {
    id: "demo", goal: "Add a thing", chain: "openspec", ...(archive ? { archive: true } : {}), ...(prComment ? { prComment: true } : {}),
  });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

// ---- init -------------------------------------------------------------------

test("init --pr-comment and --pr-comment true store prComment true", () => {
  for (const extra of [["--pr-comment"], ["--pr-comment", "true"], ["--pr-comment=true"]]) {
    const project = makeProject();
    const res = init(project, "fix typo", extra);
    assert.equal(res.json.action, "run", res.stdout + res.stderr);
    assert.equal(readMetaFile(project).prComment, true, extra.join(" "));
  }
});

test("a resume without the flag keeps prComment; --pr-comment false clears it and the output field", () => {
  const project = makeProject();
  init(project, "fix typo", ["--pr-comment"]);
  // The resume halts on the pending step without a result; meta.json is written before that.
  init(project, "fix typo");
  assert.equal(readMetaFile(project).prComment, true);
  assert.equal(status(project).json.prComment, true);
  init(project, "fix typo", ["--pr-comment", "false"]);
  assert.equal(readMetaFile(project).prComment, false);
  assert.equal(Object.hasOwn(status(project).json, "prComment"), false);
});

test("an invalid --pr-comment value halts and writes nothing", () => {
  const project = makeProject();
  const res = init(project, "fix typo", ["--pr-comment", "maybe"]);
  assert.equal(res.json.action, "halt");
  assert.equal(res.json.reason, "Invalid --pr-comment maybe. Use --pr-comment, --pr-comment true or --pr-comment false.");
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("a run without the flag has no prComment key and no output field", () => {
  const project = makeProject();
  const res = init(project, "fix typo");
  assert.equal(Object.hasOwn(res.json, "prComment"), false);
  assert.equal(Object.hasOwn(readMetaFile(project), "prComment"), false);
  assert.equal(Object.hasOwn(status(project).json, "prComment"), false);
});

test("--chain openspec stores, keeps and clears prComment the same way", () => {
  const project = makeOpenspecProject({ proposal: true });
  assert.notEqual(initOpenspec(project, "Add a thing", ["--pr-comment"]).json.action, "halt");
  assert.equal(readMetaFile(project).prComment, true);
  initOpenspec(project, "Add a thing");
  assert.equal(readMetaFile(project).prComment, true);
  assert.equal(run(project, ["status", project.id, "--chain", "openspec"]).json.prComment, true);
  initOpenspec(project, "Add a thing", ["--pr-comment", "false"]);
  assert.equal(readMetaFile(project).prComment, false);
});

// ---- outputs ------------------------------------------------------------------

test("done of a run without --archive carries prComment: true", { skip: noGit }, () => {
  const res = runNext(finished10x({ archive: false }));
  assert.equal(res.json.action, "done", res.stdout);
  assert.equal(res.json.prComment, true);
  const off = runNext(finished10x({ archive: false, prComment: false }));
  assert.equal(off.json.action, "done");
  assert.equal(Object.hasOwn(off.json, "prComment"), false);
});

test("the archive action carries prComment: true and its summary is unchanged", { skip: noGit }, () => {
  const res = runNext(finished10x());
  assert.equal(res.json.action, "archive", res.stdout);
  assert.equal(res.json.prComment, true);
  assert.deepEqual(res.json.summary, { reason: "impl review APPROVED", manualPending: ["1.9 Look at it"], steps: 4 });
});

test("an ordinary halt through endRun (kind A, staged file) carries prComment: true", { skip: noGit }, () => {
  const project = finished10x();
  fs.writeFileSync(path.join(project.base, "extra.txt"), "x\n");
  git(project, ["add", "extra.txt"]);
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.equal(res.json.committed, false);
  assert.equal(res.json.prComment, true);
});

test("the direct halts of archiveDone carry prComment: true (kind B, C and D)", { skip: noGit }, () => {
  // Kind C: a failing pre-commit hook.
  const c = finished10x();
  writeHook(c, "pre-commit", "exit 1");
  const rc = runNext(c);
  assert.equal(rc.json.archive, "skipped: pre-archive commit failed");
  assert.equal(rc.json.prComment, true);
  // Kind D: a hook that stages another file; the commit exists.
  const d = finished10x();
  writeHook(d, "pre-commit", "echo x > hooked.txt\ngit add hooked.txt");
  const rd = runNext(d);
  assert.equal(rd.json.committed, true);
  assert.equal(rd.json.prComment, true);
  // Kind B: after the archive action, a staged file halts the next call.
  const b = finished10x();
  assert.equal(runNext(b).json.action, "archive");
  fs.writeFileSync(path.join(b.base, "extra.txt"), "x\n");
  git(b, ["add", "extra.txt"]);
  const rb = runNext(b);
  assert.equal(rb.json.action, "halt");
  assert.equal(rb.json.committed, true);
  assert.equal(rb.json.prComment, true);
});

test("OpenSpec done and archive action carry prComment: true", { skip: noGit }, () => {
  const done = run(finishedOpenspec({ archive: false }), ["next", "demo", "--chain", "openspec"]);
  assert.equal(done.json.action, "done", done.stdout);
  assert.equal(done.json.prComment, true);
  const project = finishedOpenspec();
  const arch = run(project, ["next", "demo", "--chain", "openspec"], { env: gitEnv(project) });
  assert.equal(arch.json.action, "archive", arch.stdout);
  assert.equal(arch.json.prComment, true);
  assert.deepEqual(arch.json.summary, { reason: "OpenSpec verify PASS", manualPending: [], steps: 2 });
});
