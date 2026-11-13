// OpenSpec chain, Phase 4 (ADR-013 D5): the archive branch of a run started with --archive (the pre-archive commit of
// openspec/changes/<id>/ and the os-archive action) and the read-only commands verify-archive, compare, status and risk
// on OpenSpec runs, live or archived. The move itself is simulated; the router never runs the openspec CLI.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, run, git, gitAvailable, gitEnv, gitInit, commitFiles, writeLog, writeMetaFile, readMetaFile, readLogEntries,
  readReportFile, entry,
} from "../../10x-pipeline/test/helpers.mjs";
import { makeOpenspecProject, writeArtifacts, writeVerify, moveToArchive } from "./openspec-helpers.mjs";
import { pluginPolicy } from "../../10x-pipeline/scripts/state.mjs";
import { removeTree } from "../../10x-pipeline/scripts/remove-tree.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = pluginPolicy();
const MESSAGE = (id) => `chore(${id}): commit change folder before archive`;
const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";
const TICKED = { proposal: true, specs: 1, tasks: { done: 2, open: 0 } };
const noGit = !gitAvailable() && "git is not available";

// The local date, as `openspec archive` names its folder.
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A finished OpenSpec run in a git repository: every task ticked, a PASS verify.md, a log that ends in a verified
// os-verify, meta.json with chain openspec (and the archive flag unless `archive` is false), one base commit.
function finishedRun({ id = "demo", archive = true, artifacts = TICKED, verify = PASS } = {}) {
  const project = makeOpenspecProject({ id, ...artifacts, verify });
  writeLog(project, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
  writeMetaFile(project, { id, goal: "Add a thing", chain: "openspec", ...(archive ? { archive: true } : {}) });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

const rel = (project) => path.relative(project.base, project.changeDir).split(path.sep).join("/");
const nextIn = (project) => run(project, ["next", project.id], { env: gitEnv(project) });
const commitCount = (project) => Number(git(project, ["rev-list", "--count", "HEAD"]));
const showNames = (project) => git(project, ["show", "--name-only", "--format=", "HEAD"]).split("\n").filter(Boolean);
const folderStatus = (project) => git(project, ["status", "--porcelain", "--", rel(project)]);

// ---- archive branch -------------------------------------------------------------

test("PASS with --archive commits only openspec/changes/<id>/ and returns the os-archive action", { skip: noGit }, () => {
  const project = finishedRun();
  const res = nextIn(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const j = res.json;
  assert.equal(j.action, "archive");
  assert.equal(j.archivePath, `openspec/changes/archive/${today()}-demo`);
  assert.match(j.commit, /^[0-9a-f]{7,}$/);
  assert.deepEqual(j.ignored, []);
  assert.equal(j.report, "openspec/changes/demo/agent-smith/report.md");
  assert.deepEqual(j.summary, { reason: "OpenSpec verify PASS", manualPending: [], steps: 2 });
  // The os-archive template at the tier of steps["os-archive"].
  const tier = POLICY.steps["os-archive"].baseTier;
  assert.equal(j.model, POLICY.ladder[tier].model);
  assert.equal(j.effort, POLICY.ladder[tier].effort);
  assert.match(j.reason, new RegExp(`^run done; committed [0-9a-f]+; tier ${tier} `));
  assert.ok(j.prompt.startsWith("Archive the OpenSpec change demo with the OpenSpec CLI.\n"), j.prompt.slice(0, 200));
  assert.ok(j.prompt.includes("`openspec archive demo --yes --json`"));
  assert.equal(j.prompt.includes("{id}"), false);
  assert.ok(j.prompt.endsWith("\n\n" + POLICY.prompts.suffix));
  assert.equal(j.resultFile, undefined);
  // The commit holds only the change folder, and the folder is clean.
  assert.equal(git(project, ["log", "-1", "--format=%s"]), MESSAGE("demo"));
  assert.equal(commitCount(project), 2);
  const names = showNames(project);
  assert.ok(names.every((n) => n.startsWith("openspec/changes/demo/")), names.join(", "));
  for (const f of ["tasks.md", "proposal.md", "agent-smith/verify.md", "agent-smith/report.md", "agent-smith/meta.json", "agent-smith/run.jsonl"]) {
    assert.ok(names.includes(`openspec/changes/demo/${f}`), f);
  }
  assert.equal(folderStatus(project), "");
  // The report names the CLI archive; the run is written as done and gets no log entry for the archive.
  assert.match(readReportFile(project), /^Archive: requested - `openspec archive demo --yes --json` runs after this report was written; see the commit "chore\(archive\): close demo"$/m);
  assert.equal(readMetaFile(project).outcome.action, "done");
  assert.equal(readLogEntries(project).length, 2);
  // A second call makes no new commit.
  const again = nextIn(project);
  assert.equal(again.json.action, "archive");
  assert.equal(again.json.commit, null);
  assert.equal(commitCount(project), 2);
});

test("an open task row never reaches the archive: it routes to os-apply and makes no commit", { skip: noGit }, () => {
  // The archive branch halts on an open row too, but D4 routes an open row to os-apply before any verdict is read,
  // so through the CLI the guard shows as no archive action and no commit.
  const project = finishedRun({ artifacts: { proposal: true, specs: 1, tasks: { done: 1, open: 1 } } });
  const res = nextIn(project);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "os-apply");
  assert.equal(commitCount(project), 1);
});

test("an existing archive target halts before the commit with committed false", { skip: noGit }, () => {
  const project = finishedRun();
  const target = `openspec/changes/archive/${today()}-demo`;
  fs.mkdirSync(path.join(project.root, target), { recursive: true });
  const res = nextIn(project);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal(res.json.reason, `Archive destination ${target} already exists; openspec archive would refuse it (archive_target_exists). Needs a human. Nothing was committed.`);
  assert.equal(res.json.committed, false);
  assert.equal(res.json.archive, "skipped: run halted");
  assert.equal(commitCount(project), 1);
  git(project, ["diff", "--cached", "--quiet"]);
  assert.equal(readMetaFile(project).outcome.action, "halt");
  assert.match(readReportFile(project), /^Archive: not run \(run halted\)$/m);
});

test("without --archive the run ends done with no commit", { skip: noGit }, () => {
  const project = finishedRun({ archive: false });
  const res = nextIn(project);
  assert.equal(res.json.action, "done", res.stdout);
  assert.equal(res.json.archive, undefined);
  assert.equal(res.json.committed, undefined);
  assert.equal(commitCount(project), 1);
  assert.doesNotMatch(readReportFile(project), /Archive:/);
});

test("a date-prefixed id keeps its name as the archive folder", { skip: noGit }, () => {
  const project = finishedRun({ id: "2026-01-02-dated" });
  const res = nextIn(project);
  assert.equal(res.json.action, "archive", res.stdout);
  assert.equal(res.json.archivePath, "openspec/changes/archive/2026-01-02-dated");
  assert.equal(git(project, ["log", "-1", "--format=%s"]), MESSAGE("2026-01-02-dated"));
  // After the move the run is found in that folder.
  git(project, ["mv", rel(project), res.json.archivePath]);
  const verified = run(project, ["verify-archive", project.id, "--path", res.json.archivePath]);
  assert.equal(verified.json.archived, true, verified.stdout);
  const halted = nextIn(project);
  assert.equal(halted.json.reason, "Change 2026-01-02-dated is archived at openspec/changes/archive/2026-01-02-dated. Nothing was written.");
});

test("init --chain openspec --archive halts when git ignores tasks.md", { skip: noGit }, () => {
  const project = makeOpenspecProject(TICKED);
  gitInit(project);
  fs.writeFileSync(path.join(project.root, ".gitignore"), "tasks.md\n");
  commitFiles(project, ["README.md"]);
  const res = run(project, ["init", "demo", "--goal", "x", "--chain", "openspec", "--archive"], { env: gitEnv(project) });
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /git ignores openspec\/changes\/demo\/tasks\.md/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("the archive action, a simulated move, verify-archive and next after the move", { skip: noGit }, () => {
  const project = finishedRun();
  const res = nextIn(project);
  assert.equal(res.json.action, "archive");
  git(project, ["mv", rel(project), res.json.archivePath]);
  const verified = run(project, ["verify-archive", "demo", "--chain", "openspec", "--path", res.json.archivePath]);
  assert.equal(verified.status, 0, verified.stdout);
  assert.deepEqual(verified.json, {
    archived: true,
    path: res.json.archivePath,
    report: `${res.json.archivePath}/agent-smith/report.md`,
  });
  const halted = nextIn(project);
  assert.equal(halted.status, 1, halted.stdout);
  assert.equal(halted.json.reason, `Change demo is archived at ${res.json.archivePath}. Nothing was written.`);
});

// ---- verify-archive -----------------------------------------------------------

const verify = (project, ...args) => run(project, ["verify-archive", project.id, "--chain", "openspec", ...args]);

// A project whose OpenSpec change was moved to each of `names` (the first gets the run folder, the rest are copies).
function archived(names, { live = false } = {}) {
  const project = makeOpenspecProject(TICKED);
  writeMetaFile(project, { id: "demo", goal: "x", chain: "openspec" });
  fs.writeFileSync(path.join(project.agentDir, "report.md"), "# Run report: demo\n");
  const first = moveToArchive(project, names[0].slice(0, 10));
  for (const name of names.slice(1)) fs.cpSync(first, path.join(project.root, "openspec/changes/archive", name), { recursive: true });
  if (live) fs.mkdirSync(project.changeDir, { recursive: true });
  return project;
}

test("verify-archive: archived true with the folder and the report", () => {
  const project = archived(["2026-02-03-demo"]);
  const res = verify(project);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(res.json, {
    archived: true,
    path: "openspec/changes/archive/2026-02-03-demo",
    report: "openspec/changes/archive/2026-02-03-demo/agent-smith/report.md",
  });
  // Without the flag the chain comes from the archived meta.json.
  assert.equal(run(project, ["verify-archive", "demo"]).json.archived, true);
});

test("verify-archive: false while the live folder exists, with or without an archive folder", () => {
  const live = makeOpenspecProject(TICKED);
  writeMetaFile(live, { id: "demo", goal: "x", chain: "openspec" });
  const res = verify(live);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /^openspec\/changes\/demo still exists and no archive folder of demo/);
  const both = archived(["2026-02-03-demo"], { live: true });
  const res2 = verify(both);
  assert.equal(res2.json.archived, false);
  assert.equal(res2.json.reason, "openspec/changes/demo still exists next to openspec/changes/archive/2026-02-03-demo.");
});

test("verify-archive: no folder at all is false", () => {
  const project = makeOpenspecProject({ change: false });
  const res = verify(project);
  assert.equal(res.json.archived, false);
  assert.equal(res.json.reason, "No archive folder for demo under openspec/changes/archive/.");
});

test("verify-archive --path picks one folder, and a --path that misses lists the folders found", () => {
  const project = archived(["2026-02-03-demo", "2026-02-04-demo"]);
  const picked = verify(project, "--path", "./openspec/changes/archive/2026-02-04-demo/");
  assert.equal(picked.status, 0, picked.stdout);
  assert.equal(picked.json.path, "openspec/changes/archive/2026-02-04-demo");
  // A run that crossed midnight: the router named the next day, the CLI used the day before.
  const missed = verify(project, "--path", "openspec/changes/archive/2026-02-05-demo");
  assert.equal(missed.json.archived, false);
  assert.equal(missed.json.reason, "--path openspec/changes/archive/2026-02-05-demo is not an archive folder of demo. Archive folders of demo: openspec/changes/archive/2026-02-03-demo, openspec/changes/archive/2026-02-04-demo.");
  for (const bad of ["context/archive/2026-02-03-demo", "openspec/changes/archive/2026-02-03-demo/agent-smith", "openspec/changes/archive/2026-02-03-other"]) {
    const res = verify(project, "--path", bad);
    assert.equal(res.json.archived, false, bad);
    assert.match(res.json.reason, /is not an archive folder of demo/, bad);
  }
  const blank = verify(project, "--path");
  assert.equal(blank.json.reason, "--path needs a folder");
});

test("verify-archive: two folders without --path are ambiguous", () => {
  const project = archived(["2026-02-03-demo", "2026-02-04-demo"]);
  const res = verify(project);
  assert.equal(res.json.archived, false);
  assert.deepEqual(res.json.ambiguous, ["openspec/changes/archive/2026-02-03-demo", "openspec/changes/archive/2026-02-04-demo"]);
  assert.match(res.json.reason, /Pass --path\.$/);
});

// ---- status, risk and compare ---------------------------------------------------

test("status --chain openspec adds the OpenSpec state the router reads", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 1, open: 2 } });
  const res = run(project, ["status", "demo", "--chain", "openspec"]);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(res.json.openspec, { planningComplete: true, tasks: { total: 3, complete: 1 } });
  const empty = makeOpenspecProject();
  assert.deepEqual(run(empty, ["status", "demo", "--chain", "openspec"]).json.openspec, { planningComplete: false, tasks: { total: 0, complete: 0 } });
});

test("risk --chain openspec reports no plan paths and no plan hits", () => {
  const project = makeOpenspecProject(TICKED);
  writeMetaFile(project, { id: "demo", goal: "x", chain: "openspec" });
  const res = run(project, ["risk", "demo", "--chain", "openspec"]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.planPaths, 0);
  assert.deepEqual(res.json.planHits, []);
  assert.deepEqual(res.json.unclassified, []);
});

// An OpenSpec run of `steps` verified entries with token figures, ended done, live or moved to the archive.
function compareSide({ tokens, model = "sonnet", effort = "high", move = null }) {
  const project = makeOpenspecProject(TICKED);
  writeLog(project, tokens.map((t, i) => entry(i + 1, i === 0 ? "os-apply" : "os-verify", { model, effort, usage: { totalTokens: t } })));
  writeMetaFile(project, { id: "demo", goal: "Add a thing", chain: "openspec", outcome: { action: "done", reason: "OpenSpec verify PASS" } });
  if (move) moveToArchive(project, move);
  return project;
}

test("compare --chain openspec reads a live and an archived side", () => {
  const baseline = compareSide({ tokens: [600, 400] });
  const routed = compareSide({ tokens: [300, 200], model: "haiku", effort: "medium", move: "2026-02-03" });
  const res = run(routed, ["compare", "demo", "--chain", "openspec", "--baseline", baseline.root]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.baseline.source, "changes");
  assert.equal(res.json.baseline.dir, path.join(baseline.changeDir, "agent-smith"));
  assert.equal(res.json.routed.source, "archive");
  assert.equal(res.json.routed.dir, path.join(routed.root, "openspec/changes/archive/2026-02-03-demo/agent-smith"));
  assert.equal(res.json.comparable, true, JSON.stringify(res.json.reasons));
  assert.equal(res.json.dropPercent, 50);
  assert.equal(res.json.baseline.plan, null);
  // A live folder wins over an archived one, with the same warning as the 10x chain.
  const both = compareSide({ tokens: [100] });
  const archivedDir = path.join(both.root, "openspec/changes/archive/2026-02-03-demo/agent-smith");
  fs.mkdirSync(archivedDir, { recursive: true });
  fs.writeFileSync(path.join(archivedDir, "run.jsonl"), JSON.stringify(entry(1, "os-apply", { usage: { totalTokens: 9999 } })) + "\n");
  const res2 = run(both, ["compare", "demo", "--chain", "openspec", "--baseline", baseline.root]);
  assert.equal(res2.json.routed.source, "changes");
  assert.equal(res2.json.routed.tokens.total, 100);
  assert.ok(res2.json.warnings.includes("archive-also-present:routed"), JSON.stringify(res2.json.warnings));
});

test("compare --chain openspec does not read a 10x side", () => {
  const baseline = compareSide({ tokens: [600] });
  const routed = compareSide({ tokens: [300] });
  // A 10x run log of the same id in the routed project is not the OpenSpec side.
  removeTree(routed.agentDir);
  const tenx = path.join(routed.root, "context/changes/demo/agent-smith");
  fs.mkdirSync(tenx, { recursive: true });
  fs.writeFileSync(path.join(tenx, "run.jsonl"), JSON.stringify(entry(1, "plan")) + "\n");
  const res = run(routed, ["compare", "demo", "--chain", "openspec", "--baseline", baseline.root]);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /^routed: no run\.jsonl found for demo\. Looked in: .*openspec\/changes\/demo\/agent-smith\/run\.jsonl/);
});
