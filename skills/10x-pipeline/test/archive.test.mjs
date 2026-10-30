// Archive re-entry guard and verify-archive through the CLI. Archive folders are made by hand; no git needed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  cleanupAll, makeProject, run, init, next, writeLog, entry, ROUTE, gitEnv, gitInit, writeResult, readMetaFile, writeMetaFile,
  planText, writeReview, readReportFile, readLogEntries, commitFiles, git, gitAvailable,
} from "./helpers.mjs";

after(cleanupAll);

const DAY = "2026-10-30";

// A hand-made archive folder: change.md with the given frontmatter fields, plus any extra files (relative paths).
function writeArchive(project, name, { status = "archived", archivedAt = "2026-10-31T10:00:00Z", files = {} } = {}) {
  const dir = path.join(project.root, "context/archive", name);
  fs.mkdirSync(dir, { recursive: true });
  const lines = ["---", `change_id: ${project.id}`, `status: ${status}`];
  if (archivedAt) lines.push(`archived_at: ${archivedAt}`);
  lines.push("---", "");
  fs.writeFileSync(path.join(dir, "change.md"), lines.join("\n"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

// A project whose change folder is gone: only the archive exists.
function archivedOnly(archiveName = `${DAY}-demo`, over = {}) {
  const project = makeProject();
  fs.rmSync(project.changeDir, { recursive: true, force: true });
  fs.rmSync(path.join(project.root, "context/changes"), { recursive: true, force: true });
  writeArchive(project, archiveName, over);
  return project;
}

// A live change folder whose change.md already says archived (the partial failure of /10x-archive).
function halfArchived() {
  const project = makeProject();
  fs.writeFileSync(path.join(project.changeDir, "change.md"), `---\nchange_id: demo\nstatus: archived\n---\n`);
  return project;
}

// Every path under root with size and mtime, sorted. Equal snapshots mean nothing was written.
function snapshot(root) {
  const rows = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const st = fs.lstatSync(abs);
      rows.push(`${path.relative(root, abs)}|${st.isDirectory() ? "d" : st.size}|${st.mtimeMs}`);
      if (st.isDirectory()) walk(abs);
    }
  };
  walk(root);
  return rows;
}

function verify(project, ...args) {
  return run(project, ["verify-archive", project.id, ...args]);
}

// ---- re-entry guard ---------------------------------------------------------

test("next halts when only the archive folder exists and writes nothing", () => {
  const project = archivedOnly();
  const before = snapshot(project.root);
  const res = next(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /is archived at context\/archive\/2026-10-30-demo\. Nothing was written\./);
  assert.equal(fs.existsSync(path.join(project.root, "context/changes")), false);
  assert.deepEqual(snapshot(project.root), before);
});

test("init halts when only the archive folder exists and writes nothing", () => {
  const project = archivedOnly();
  const before = snapshot(project.root);
  const res = init(project, "again");
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /is archived at context\/archive\/2026-10-30-demo/);
  assert.equal(fs.existsSync(path.join(project.root, "context/changes")), false);
  assert.deepEqual(snapshot(project.root), before);
});

test("status --report halts with the archive path and writes nothing", () => {
  const project = archivedOnly();
  const before = snapshot(project.root);
  const res = run(project, ["status", project.id, "--report"]);
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /is archived at context\/archive\/2026-10-30-demo/);
  assert.deepEqual(snapshot(project.root), before);
});

test("plain status on an archived change still prints an empty log", () => {
  const project = archivedOnly();
  const before = snapshot(project.root);
  const res = run(project, ["status", project.id]);
  assert.equal(res.status, 0);
  assert.equal(res.json.change, "demo");
  assert.deepEqual(res.json.steps, []);
  assert.equal(res.json.report, undefined);
  assert.deepEqual(snapshot(project.root), before);
});

for (const [label, args] of [
  ["init", (project) => ["init", project.id, "--goal", "again"]],
  ["next", (project) => ["next", project.id]],
  ["status --report", (project) => ["status", project.id, "--report"]],
]) {
  test(`${label} halts on a half-archived folder and leaves the tree byte-identical`, () => {
    const project = halfArchived();
    writeLog(project, [entry(1, "plan")]);
    const before = snapshot(project.root);
    const content = fs.readFileSync(path.join(project.changeDir, "change.md"), "utf8");
    const res = run(project, args(project));
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /stamped archived but its folder was not moved\. Nothing was written/);
    assert.deepEqual(snapshot(project.root), before);
    assert.equal(fs.readFileSync(path.join(project.changeDir, "change.md"), "utf8"), content);
  });
}

test("a quoted status in change.md counts as archived for the half-archived guard", () => {
  const project = makeProject();
  fs.writeFileSync(path.join(project.changeDir, "change.md"), `---\nstatus: "archived"\n---\n`);
  const res = next(project);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /stamped archived/);
});

test("a suffix-collision archive folder does not trigger the guard", () => {
  const project = makeProject({ change: false });
  fs.rmSync(project.changeDir, { recursive: true, force: true });
  writeArchive(project, "2026-01-01-x-demo");
  const res = init(project, "fresh");
  // The guard stays quiet: the run goes on and the router creates the change folder as before.
  assert.equal(fs.existsSync(path.join(project.root, "context/changes/demo/agent-smith/meta.json")), true);
  assert.doesNotMatch(String(res.json?.reason ?? ""), /archived/);
});

test("a live folder with a same-named archive is left to /10x-archive", () => {
  const project = makeProject();
  writeArchive(project, `${DAY}-demo`);
  const res = next(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
});

// ---- verify-archive ---------------------------------------------------------

test("verify-archive returns archived true with path, archivedAt and report", () => {
  const project = archivedOnly(`${DAY}-demo`, { files: { "agent-smith/report.md": "# Run report\n" } });
  const res = verify(project);
  assert.equal(res.status, 0);
  assert.deepEqual(res.json, {
    archived: true,
    path: `context/archive/${DAY}-demo`,
    archivedAt: "2026-10-31T10:00:00Z",
    report: `context/archive/${DAY}-demo/agent-smith/report.md`,
  });
});

test("verify-archive reports null report and null archivedAt when absent", () => {
  const project = archivedOnly(`${DAY}-demo`, { archivedAt: null });
  const res = verify(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.archived, true);
  assert.equal(res.json.archivedAt, null);
  assert.equal(res.json.report, null);
});

test("verify-archive strips quotes from status", () => {
  const project = archivedOnly(`${DAY}-demo`, { status: "\"archived\"" });
  assert.equal(verify(project).json.archived, true);
});

test("verify-archive: no archive folder", () => {
  const project = makeProject();
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /No archive folder/);
});

test("verify-archive: a suffix-collision folder alone is not an archive of the id", () => {
  const project = archivedOnly("2026-01-01-x-demo");
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /No archive folder/);
});

test("verify-archive: status other than archived", () => {
  const project = archivedOnly(`${DAY}-demo`, { status: "implemented" });
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /has status implemented, not archived/);
});

test("verify-archive: archive folder without change.md", () => {
  const project = archivedOnly();
  fs.rmSync(path.join(project.root, "context/archive", `${DAY}-demo`, "change.md"));
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /change\.md is missing/);
});

test("verify-archive: change folder still present next to a stamped archive (partial failure)", () => {
  const project = halfArchived();
  writeArchive(project, `${DAY}-demo`);
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /context\/changes\/demo still exists/);
});

test("verify-archive: stamped folder that was not moved has its own reason", () => {
  const project = halfArchived();
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /stamped archived but was not moved/);
});

test("verify-archive: two archive folders (reused id) are listed and need --path", () => {
  const project = archivedOnly(`${DAY}-demo`);
  writeArchive(project, "2026-11-02-demo");
  const res = verify(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.archived, false);
  assert.match(res.json.reason, /context\/archive\/2026-10-30-demo/);
  assert.match(res.json.reason, /context\/archive\/2026-11-02-demo/);
  assert.match(res.json.reason, /--path/);
});

test("verify-archive --path picks one of two folders", () => {
  const project = archivedOnly(`${DAY}-demo`);
  writeArchive(project, "2026-11-02-demo", { status: "implemented" });
  const good = verify(project, "--path", `context/archive/${DAY}-demo`);
  assert.equal(good.status, 0);
  assert.equal(good.json.path, `context/archive/${DAY}-demo`);
  const bad = verify(project, "--path", "context/archive/2026-11-02-demo");
  assert.equal(bad.status, 1);
  assert.match(bad.json.reason, /not archived/);
});

test("verify-archive --path accepts a trailing slash and a leading ./", () => {
  const project = archivedOnly(`${DAY}-demo`);
  for (const value of [`context/archive/${DAY}-demo/`, `./context/archive/${DAY}-demo`]) {
    const res = verify(project, "--path", value);
    assert.equal(res.status, 0, value);
    assert.equal(res.json.path, `context/archive/${DAY}-demo`, value);
  }
});

test("verify-archive --path with no value says it needs a folder", () => {
  const project = archivedOnly();
  const res = verify(project, "--path");
  assert.equal(res.status, 1);
  assert.deepEqual(res.json, { archived: false, reason: "--path needs a folder" });
});

test("verify-archive --path refuses anything but an archive folder of the id", () => {
  const project = archivedOnly(`${DAY}-demo`);
  // A sibling archive of another id, readable and stamped archived: it must not be read for this id.
  const other = writeArchive({ ...project, id: "other" }, `${DAY}-other`);
  const outside = path.join(project.root, "context/changes");
  fs.mkdirSync(path.join(outside, "demo"), { recursive: true });
  fs.writeFileSync(path.join(outside, "demo/change.md"), "---\nstatus: archived\n---\n");
  const cases = [
    "context/archive/2026-01-01-x-demo",
    "context/archive/../changes/demo",
    "context/archive/2026-10-30-demo/../2026-10-30-demo",
    path.join(project.root, "context/archive", `${DAY}-demo`),
    `context/archive/${path.basename(other)}`,
    "context/changes/demo",
    "other/context/archive/2026-10-30-demo",
    "context\\archive\\2026-10-30-demo",
    "context/archive/2026-10-30-demo/agent-smith",
    "context/archive/",
    "",
  ];
  for (const value of cases) {
    const res = verify(project, "--path", value);
    assert.equal(res.status, 1, JSON.stringify(value));
    assert.equal(res.json.archived, false, JSON.stringify(value));
    assert.equal(res.json.reason, "--path is not an archive folder of demo", JSON.stringify(value));
  }
});

test("verify-archive leaves the tree byte-identical", () => {
  const project = archivedOnly(`${DAY}-demo`, { files: { "agent-smith/report.md": "# Run report\n" } });
  const before = snapshot(project.root);
  assert.equal(verify(project).status, 0);
  assert.equal(verify(project, "--path", `context/archive/${DAY}-demo`).status, 0);
  assert.equal(verify(makeProject()).status, 1);
  assert.deepEqual(snapshot(project.root), before);
});

test("verify-archive answers when PATH holds no git", () => {
  const project = archivedOnly();
  const emptyBin = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-nogit-"));
  try {
    const res = run(project, ["verify-archive", project.id], { env: { PATH: emptyBin } });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.equal(res.json.archived, true);
  } finally {
    fs.rmSync(emptyBin, { recursive: true, force: true });
  }
});

// ---- --archive flag, persistence and init checks (Phase 2) -------------------

const POLICY = JSON.parse(fs.readFileSync(path.join(path.dirname(ROUTE), "..", "policy.json"), "utf8"));

// init with the hermetic environment, so no global ignore file or parent repository leaks in.
function initArchive(project, ...extra) {
  return run(project, ["init", project.id, "--goal", "fix typo", ...extra], { env: gitEnv(project) });
}

// A work tree with an optional .gitignore at its root.
function gitProject(ignore = null, opts = {}) {
  const project = makeProject(opts);
  gitInit(project);
  if (ignore !== null) fs.writeFileSync(path.join(project.base, ".gitignore"), ignore);
  return project;
}

// Closes the pending plan step so a second init consumes a result instead of halting on a missing one.
function answerPlan(project) {
  writeResult(project, { status: "done", note: "fixture" });
}

test("init --archive stores archive: true", () => {
  const project = gitProject();
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal(readMetaFile(project).archive, true);
});

test("init --archive true is the same as the bare flag", () => {
  const project = gitProject();
  assert.equal(initArchive(project, "--archive", "true").status, 0);
  assert.equal(readMetaFile(project).archive, true);
});

test("a resume without the flag keeps archive: true", () => {
  const project = gitProject();
  assert.equal(initArchive(project, "--archive").status, 0);
  answerPlan(project);
  const res = initArchive(project);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(readMetaFile(project).archive, true);
});

test("--archive false stores false and a later bare resume keeps false", () => {
  const project = makeProject();
  const first = run(project, ["init", project.id, "--goal", "fix typo", "--archive", "false"]);
  assert.equal(first.status, 0, first.stdout);
  assert.equal(readMetaFile(project).archive, false);
  answerPlan(project);
  assert.equal(run(project, ["init", project.id]).status, 0);
  assert.equal(readMetaFile(project).archive, false);
});

test("--archive false turns a stored true off", () => {
  const project = gitProject();
  assert.equal(initArchive(project, "--archive").status, 0);
  answerPlan(project);
  assert.equal(initArchive(project, "--archive", "false").status, 0);
  assert.equal(readMetaFile(project).archive, false);
});

test("--archive with an invalid value halts and writes nothing", () => {
  const project = gitProject();
  const res = initArchive(project, "--archive", "maybe");
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Invalid --archive maybe/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("--archive in a directory that is not a repository halts and writes nothing", () => {
  const project = makeProject();
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /work tree/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("a stored archive: true is checked again on a resume", () => {
  const project = gitProject();
  assert.equal(initArchive(project, "--archive").status, 0);
  answerPlan(project);
  fs.rmSync(path.join(project.base, ".git"), { recursive: true, force: true });
  const res = initArchive(project);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /work tree/);
});

test("--archive halts when .gitignore hides agent-smith/ that does not exist yet", () => {
  const project = gitProject("agent-smith/\n");
  assert.equal(fs.existsSync(project.agentDir), false);
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /context\/changes\/demo\/agent-smith\/run\.jsonl/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("--archive halts when .gitignore has *.jsonl and names run.jsonl", () => {
  const project = gitProject("*.jsonl\n");
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /context\/changes\/demo\/agent-smith\/run\.jsonl/);
  assert.doesNotMatch(res.json.reason, /meta\.json/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("--archive halts when .gitignore hides context/ and names change.md", () => {
  const project = gitProject("context/\n");
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /context\/changes\/demo\/change\.md/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("--archive passes when .gitignore ignores none of the four files", () => {
  const project = gitProject("node_modules/\n*.log\n.DS_Store\n");
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal(readMetaFile(project).archive, true);
});

test("--archive works when the project root is below the repository root", () => {
  const project = makeProject({ nest: "proj" });
  gitInit(project);
  fs.writeFileSync(path.join(project.base, ".gitignore"), "agent-smith/\n");
  const bad = initArchive(project, "--archive");
  assert.equal(bad.status, 1);
  assert.match(bad.json.reason, /context\/changes\/demo\/agent-smith\/run\.jsonl/);
  fs.writeFileSync(path.join(project.base, ".gitignore"), "\n");
  assert.equal(initArchive(project, "--archive").status, 0);
});

test("init without --archive in a non-repository directory works and meta.json has no archive key", () => {
  const project = makeProject();
  const res = run(project, ["init", project.id, "--goal", "fix typo"], { env: gitEnv(project) });
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal("archive" in readMetaFile(project), false);
});

test("init --archive writes nothing when the change is archived", () => {
  const project = archivedOnly();
  const before = snapshot(project.root);
  const res = initArchive(project, "--archive");
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /is archived at/);
  assert.deepEqual(snapshot(project.root), before);
});

// ---- policy data -------------------------------------------------------------

test("steps.archive is pinned to one ladder entry with effort high or above", () => {
  const step = POLICY.steps.archive;
  assert.equal(step.skill, "10x-archive");
  assert.equal(step.interactive, true);
  assert.equal(step.minTier, step.baseTier);
  assert.equal(step.maxTier, step.baseTier);
  const entry = POLICY.ladder[step.baseTier];
  assert.ok(["high", "xhigh", "max"].includes(entry.effort), `effort ${entry.effort}`);
});

test("policy.archive holds the commit message template and the manual-pending gate", () => {
  assert.match(POLICY.archive.commitMessage, /^chore\(\{id\}\): /);
  assert.equal(POLICY.archive.haltOnManualPending, false);
  assert.ok(Number.isInteger(POLICY.archive.gitTimeoutMs) && POLICY.archive.gitTimeoutMs > 0);
});

test("prompts.archive gives the archive answers as nine one-line rules", () => {
  const lines = POLICY.prompts.archive.split("\n");
  assert.equal(lines[0], "Run /10x-archive {id}");
  const rules = lines.slice(1);
  assert.equal(rules.length, 9);
  for (const line of rules) assert.ok(line.startsWith("- **GIVEN**"), line);
  const text = POLICY.prompts.archive;
  for (const needle of [
    "Continue archiving", "Archive without repointing", "Archiwizuj bez podmiany",
    "Uncertain review coverage", "Missing review coverage", "blocked",
    "SHA history", "git fetch", "without asking",
  ]) assert.ok(text.includes(needle), `missing ${needle}`);
  assert.ok(rules.some((l) => l.includes("**MUST NOT**") && /\bask\b/.test(l)), "no MUST NOT about asking");
  assert.ok(rules.some((l) => l.includes("blocking rule") && l.includes("**MUST**") && /\bwin\b/.test(l)), "no precedence rule");
  // The router renders {id} only; any other placeholder would render empty.
  const names = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  assert.ok(names.length > 0 && names.every((n) => n === "id"), names.join(","));
});

// ---- the done branch: commit, clean check, archive action (Phase 3) ----------

const MESSAGE = "chore(demo): commit change folder before archive";
const noGit = !gitAvailable();

// A finished run in a git repository: change.md with `created`, a plan with every Automated row done,
// both reviews, a log that ends in an approved impl-review, meta.json with the archive flag, one base commit.
function archiveProject({ nest = null, policy = null, phases = 1, manual = "pending", changeMd = null, archive = true } = {}) {
  let plan = planText({ phases, rowsPerPhase: 1, done: phases });
  if (manual === "done") plan = plan.replace(/- \[ \] (\d+\.9 )/g, "- [x] $1");
  const project = makeProject({ nest, policy, plan });
  fs.writeFileSync(
    path.join(project.changeDir, "change.md"),
    changeMd ?? `---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n`,
  );
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", ...(archive ? { archive: true } : {}) });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

const relDir = (project) => path.relative(project.base, project.changeDir).split(path.sep).join("/");
const runNext = (project) => run(project, ["next", project.id], { env: gitEnv(project) });
const commitCount = (project) => Number(git(project, ["rev-list", "--count", "HEAD"]));
const showNames = (project) => git(project, ["-c", "core.quotePath=false", "show", "--name-only", "--format=", "HEAD"]).split("\n").filter(Boolean);
const folderStatus = (project) => git(project, ["status", "--porcelain", "--", relDir(project)]);
const blob = (project, file) => git(project, ["show", `HEAD:${relDir(project)}/${file}`]);
const onDisk = (project, file) => fs.readFileSync(path.join(project.changeDir, file), "utf8").trim();
const metaOutcome = (project) => readMetaFile(project).outcome;

function writeHook(project, name, script) {
  const dir = path.join(project.base, ".git/hooks");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
}

// The halt is printed by out() only: the committed report.md and meta.json are what is on disk.
function assertFilesAsCommitted(project) {
  assert.equal(onDisk(project, "agent-smith/report.md"), blob(project, "agent-smith/report.md"));
  assert.equal(onDisk(project, "agent-smith/meta.json"), blob(project, "agent-smith/meta.json"));
}

test("done with --archive commits the change folder and returns the archive action", { skip: noGit }, () => {
  const project = archiveProject();
  const res = runNext(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const j = res.json;
  assert.equal(j.action, "archive");
  assert.equal(j.resultFile, undefined);
  assert.equal(j.n, undefined);
  assert.ok(["high", "xhigh", "max"].includes(j.effort), j.effort);
  assert.equal(j.archivePath, "context/archive/2026-10-30-demo");
  assert.equal(j.report, `${path.relative(project.root, project.changeDir)}/agent-smith/report.md`);
  assert.match(j.commit, /^[0-9a-f]{7,}$/);
  assert.deepEqual(j.ignored, []);
  assert.deepEqual(j.summary, { reason: "impl review APPROVED", manualPending: ["1.9 Look at it"], steps: 4 });
  assert.match(j.prompt, /^Run \/10x-archive demo\n/);
  assert.match(j.prompt, /Continue archiving/);
  assert.match(j.reason, /^run done; committed [0-9a-f]+; tier 3 /);
  assert.equal(readLogEntries(project).length, 4);
  assert.equal(git(project, ["log", "-1", "--format=%s"]), MESSAGE);
  assert.equal(commitCount(project), 2);
  assert.equal(folderStatus(project), "");
  git(project, ["diff", "--cached", "--quiet"]);
  const names = showNames(project);
  for (const f of ["reviews/impl-review.md", "plan.md", "change.md", "agent-smith/report.md", "agent-smith/meta.json", "agent-smith/run.jsonl"]) {
    assert.ok(names.includes(`${relDir(project)}/${f}`), f);
  }
  assert.match(readReportFile(project), /^Archive: requested - runs after this report was written; see the commit "chore\(archive\): close demo"$/m);
  assert.equal(metaOutcome(project).action, "done");
  assert.match(readReportFile(project), /^Steps: 4 /m);
});

test("a second next returns archive again with no new commit", { skip: noGit }, () => {
  const project = archiveProject();
  assert.equal(runNext(project).json.action, "archive");
  const again = runNext(project);
  assert.equal(again.json.action, "archive");
  assert.equal(again.json.commit, null);
  assert.match(again.json.reason, /folder already committed/);
  assert.equal(commitCount(project), 2);
  assert.equal(folderStatus(project), "");
  assert.equal(readLogEntries(project).length, 4);
  assertFilesAsCommitted(project);
});

test("a run without --archive ends done and makes no commit", { skip: noGit }, () => {
  const project = archiveProject({ archive: false });
  const res = runNext(project);
  assert.equal(res.json.action, "done");
  assert.equal(res.json.archive, undefined);
  assert.equal(res.json.committed, undefined);
  assert.equal(commitCount(project), 1);
  assert.notEqual(folderStatus(project), "");
  assert.doesNotMatch(readReportFile(project), /Archive:/);
  assert.deepEqual(metaOutcome(project).manualPending, ["1.9 Look at it"]);
});

test("a run with archive: false ends done and makes no commit", { skip: noGit }, () => {
  const project = archiveProject({ archive: false });
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: false });
  assert.equal(runNext(project).json.action, "done");
  assert.equal(commitCount(project), 1);
});

// ---- halt table ------------------------------------------------------------

test("kind A: a staged file halts before the commit and the run is written as halted", { skip: noGit }, () => {
  const project = archiveProject();
  fs.writeFileSync(path.join(project.base, "extra.txt"), "x\n");
  git(project, ["add", "extra.txt"]);
  const res = runNext(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /staged changes: extra\.txt/);
  assert.equal(res.json.committed, false);
  assert.equal(res.json.archive, "skipped: run halted");
  assert.equal(metaOutcome(project).action, "halt");
  assert.equal(commitCount(project), 1);
  assert.match(readReportFile(project), /^Archive: not run \(run halted\)$/m);
  assert.equal(git(project, ["diff", "--cached", "--name-only"]), "extra.txt");
});

test("a detached HEAD halts before the commit", { skip: noGit }, () => {
  const project = archiveProject();
  git(project, ["checkout", "-q", "--detach"]);
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /detached/);
  assert.equal(res.json.committed, false);
  assert.equal(commitCount(project), 1);
});

test("a merge in progress halts before the commit", { skip: noGit }, () => {
  const project = archiveProject();
  fs.writeFileSync(path.join(project.base, ".git/MERGE_HEAD"), `${git(project, ["rev-parse", "HEAD"])}\n`);
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /MERGE_HEAD/);
  assert.equal(res.json.archive, "skipped: run halted");
  assert.equal(commitCount(project), 1);
});

test("kind C: a failing pre-commit hook halts with its output, nothing staged, outcome stays done", { skip: noGit }, () => {
  const project = archiveProject();
  writeHook(project, "pre-commit", "echo 'hook says no' >&2\nexit 1");
  const res = runNext(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /git commit failed: .*hook says no/);
  assert.match(res.json.reason, /Nothing was committed/);
  assert.equal(res.json.committed, false);
  assert.equal(res.json.archive, "skipped: pre-archive commit failed");
  git(project, ["diff", "--cached", "--quiet"]);
  assert.equal(commitCount(project), 1);
  assert.equal(metaOutcome(project).action, "done");
  assert.match(readReportFile(project), /^Archive: requested/m);
});

test("kind C: a report.md that cannot be written halts before git add; nothing staged, no commit", { skip: noGit }, () => {
  const project = archiveProject();
  // A directory where the report goes makes writeFileSync fail.
  fs.mkdirSync(path.join(project.agentDir, "report.md"), { recursive: true });
  const res = runNext(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /report\.md was not written: .*(EISDIR|directory)/i);
  assert.match(res.json.reason, /Nothing was committed/);
  assert.equal(res.json.committed, false);
  assert.equal(res.json.archive, "skipped: pre-archive commit failed");
  assert.equal(commitCount(project), 1);
  git(project, ["diff", "--cached", "--quiet"]);
  assert.equal(metaOutcome(project).action, "done");
});

test("kind D: a post-commit hook that dirties the folder halts, names the path, writes nothing, and a repeat passes", { skip: noGit }, () => {
  const project = archiveProject();
  writeHook(project, "post-commit", `touch ${relDir(project)}/stray.txt`);
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /not clean after the commit: .*stray\.txt/);
  assert.equal(res.json.committed, true);
  assert.equal(res.json.archive, "skipped: pre-archive commit exists; run not archived");
  assert.match(res.json.reason, /post-commit check 2\) is not repeated/);
  assert.equal(metaOutcome(project).action, "done");
  assertFilesAsCommitted(project);
  assert.equal(commitCount(project), 2);
  fs.rmSync(path.join(project.changeDir, "stray.txt"));
  const again = runNext(project);
  assert.equal(again.json.action, "archive");
  assert.equal(commitCount(project), 2);
});

test("kind D: a pre-commit hook that stages another file halts after the commit and names it", { skip: noGit }, () => {
  const project = archiveProject();
  writeHook(project, "pre-commit", "echo x > hooked.txt\ngit add hooked.txt");
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /hooked\.txt/);
  assert.match(res.json.reason, /commit exists, is local/);
  assert.equal(res.json.committed, true);
  assert.equal(res.json.archive, "skipped: pre-archive commit exists; run not archived");
  assert.equal(commitCount(project), 2);
  assertFilesAsCommitted(project);
});

test("kind D: a commit that holds an extra path is caught even when the index ends clean", { skip: noGit }, () => {
  const project = archiveProject();
  writeHook(project, "pre-commit", "echo x > hooked.txt\ngit add hooked.txt");
  writeHook(project, "post-commit", "git reset -q");
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /outside context\/changes\/demo/);
  assert.match(res.json.reason, /hooked\.txt/);
  assert.equal(res.json.committed, true);
});

test("kind B: after an archive, a staged file halts the next call with JSON only", { skip: noGit }, () => {
  const project = archiveProject();
  assert.equal(runNext(project).json.action, "archive");
  fs.writeFileSync(path.join(project.base, "extra.txt"), "x\n");
  git(project, ["add", "extra.txt"]);
  const before = snapshot(project.changeDir);
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /staged changes: extra\.txt/);
  assert.match(res.json.reason, /commit exists, is local/);
  assert.match(res.json.reason, /post-commit check 2\) is not repeated/);
  assert.equal(res.json.committed, true);
  assert.equal(res.json.archive, "skipped: pre-archive commit exists; run not archived");
  assert.deepEqual(snapshot(project.changeDir), before);
  assert.equal(folderStatus(project), "");
  assert.equal(commitCount(project), 2);
});

test("an ordinary halt of an archive run carries archive and committed", { skip: noGit }, () => {
  const project = archiveProject({ policy: { limits: { maxTotalSteps: 1 } } });
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Step budget/);
  assert.equal(res.json.archive, "skipped: run halted");
  assert.equal(res.json.committed, false);
  assert.equal(commitCount(project), 1);
  assert.match(readReportFile(project), /^Archive: not run \(run halted\)$/m);
});

test("a halt of a run without --archive carries no archive field", { skip: noGit }, () => {
  const project = archiveProject({ archive: false, policy: { limits: { maxTotalSteps: 1 } } });
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.equal(res.json.archive, undefined);
  assert.equal(res.json.committed, undefined);
  assert.doesNotMatch(readReportFile(project), /Archive:/);
});

// ---- pre-checks ---------------------------------------------------------------

for (const [label, line] of [
  ["no created line", null],
  ["a quoted created", 'created: "2026-10-30"'],
  ["created without a space", "created:2026-10-30"],
  ["a created with a time", "created: 2026-10-30T10:00"],
]) {
  test(`change.md with ${label} halts before the commit as kind A`, { skip: noGit }, () => {
    const project = archiveProject({ changeMd: `---\nchange_id: demo\nstatus: implemented\n${line === null ? "" : `${line}\n`}---\n` });
    const res = runNext(project);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /created: YYYY-MM-DD/);
    assert.equal(res.json.committed, false);
    assert.equal(res.json.archive, "skipped: run halted");
    assert.equal(metaOutcome(project).action, "halt");
    assert.equal(commitCount(project), 1);
    git(project, ["diff", "--cached", "--quiet"]);
  });
}

test("an existing archive destination halts before the commit", { skip: noGit }, () => {
  const project = archiveProject();
  fs.mkdirSync(path.join(project.root, "context/archive/2026-10-30-demo"), { recursive: true });
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Archive destination context\/archive\/2026-10-30-demo already exists/);
  assert.equal(commitCount(project), 1);
  git(project, ["diff", "--cached", "--quiet"]);
});

test("a .gitignore entry added after init halts at done before any commit", { skip: noGit }, () => {
  const project = archiveProject();
  for (const ignore of ["agent-smith/\n", "*.jsonl\n"]) {
    fs.writeFileSync(path.join(project.base, ".gitignore"), ignore);
    const res = runNext(project);
    assert.equal(res.json.action, "halt", ignore);
    assert.match(res.json.reason, /git ignores .*run\.jsonl/, ignore);
    assert.equal(res.json.committed, false);
    assert.equal(commitCount(project), 1);
    git(project, ["diff", "--cached", "--quiet"]);
  }
});

test("pending Manual rows are listed in the report; none means no such line", { skip: noGit }, () => {
  const two = archiveProject({ phases: 2 });
  assert.equal(runNext(two).json.action, "archive");
  const report = readReportFile(two);
  assert.match(report, /^Manual checks pending: 2$/m);
  assert.match(report, /^- 1\.9 Look at it$/m);
  assert.match(report, /^- 2\.9 Look at it$/m);
  assert.match(report, /^Steps: 4 /m);
  const none = archiveProject({ manual: "done" });
  assert.equal(runNext(none).json.action, "archive");
  assert.doesNotMatch(readReportFile(none), /Manual checks pending/);
});

test("haltOnManualPending true halts before the commit; the default continues", { skip: noGit }, () => {
  const gated = archiveProject({ policy: { archive: { haltOnManualPending: true } } });
  const res = runNext(gated);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /haltOnManualPending.*1\.9 Look at it/);
  assert.equal(res.json.committed, false);
  assert.equal(commitCount(gated), 1);
  const open = archiveProject();
  assert.equal(runNext(open).json.action, "archive");
});

test("a blank commit message halts as kind A and never stages the folder", { skip: noGit }, () => {
  const project = archiveProject({ policy: { archive: { commitMessage: "   " } } });
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /commitMessage/);
  assert.equal(res.json.committed, false);
  assert.equal(res.json.archive, "skipped: run halted");
  git(project, ["diff", "--cached", "--quiet"]);
  assert.equal(commitCount(project), 1);
});

test("a custom ladder too short for the pinned archive tier halts before git add", { skip: noGit }, () => {
  const ladder = [{ model: "haiku", effort: "low" }, { model: "haiku", effort: "low" }, { model: "sonnet", effort: "low" }];
  const project = archiveProject({ policy: { ladder } });
  const res = runNext(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /policy\.ladder has no entry for tier 3/);
  assert.equal(res.json.committed, false);
  git(project, ["diff", "--cached", "--quiet"]);
  assert.equal(commitCount(project), 1);
});

test("the commit message comes from policy.archive.commitMessage", { skip: noGit }, () => {
  const project = archiveProject({ policy: { archive: { commitMessage: "docs({id}): ship it" } } });
  assert.equal(runNext(project).json.action, "archive");
  assert.equal(git(project, ["log", "-1", "--format=%s"]), "docs(demo): ship it");
});

// ---- what the commit holds ------------------------------------------------------

test("a stray file that git does not ignore is part of the commit", { skip: noGit }, () => {
  const project = archiveProject();
  fs.writeFileSync(path.join(project.changeDir, ".DS_Store"), "junk\n");
  assert.equal(runNext(project).json.action, "archive");
  assert.ok(showNames(project).includes(`${relDir(project)}/.DS_Store`));
});

test("ignored files outside the probes are reported, not committed, and do not halt", { skip: noGit }, () => {
  const project = archiveProject();
  fs.writeFileSync(path.join(project.base, ".gitignore"), "reviews/\n.DS_Store\n");
  fs.writeFileSync(path.join(project.changeDir, ".DS_Store"), "junk\n");
  const res = runNext(project);
  assert.equal(res.json.action, "archive");
  assert.ok(res.json.ignored.includes("context/changes/demo/reviews/"), JSON.stringify(res.json.ignored));
  assert.ok(res.json.ignored.includes("context/changes/demo/.DS_Store"), JSON.stringify(res.json.ignored));
  const names = showNames(project);
  assert.ok(!names.some((n) => n.includes("impl-review.md")));
  assert.ok(names.includes(`${relDir(project)}/plan.md`));
  assert.equal(folderStatus(project), "");
});

test("non-ASCII file names in the folder pass the checks and are committed", { skip: noGit }, () => {
  const project = archiveProject();
  fs.writeFileSync(path.join(project.changeDir, "zażółć.md"), "x\n");
  const res = runNext(project);
  assert.equal(res.json.action, "archive", res.stdout);
  assert.ok(showNames(project).includes(`${relDir(project)}/zażółć.md`));
});

test("nested root: the commit holds paths below the project prefix and a hook's extra file is named", { skip: noGit }, () => {
  const project = archiveProject({ nest: "app" });
  const res = runNext(project);
  assert.equal(res.json.action, "archive", res.stdout);
  assert.equal(res.json.archivePath, "context/archive/2026-10-30-demo");
  const names = showNames(project);
  assert.ok(names.length > 0);
  for (const n of names) assert.ok(n.startsWith("app/context/changes/demo/"), n);

  const hooked = archiveProject({ nest: "app" });
  writeHook(hooked, "pre-commit", "echo x > hooked.txt\ngit add hooked.txt");
  const halt = runNext(hooked);
  assert.equal(halt.json.action, "halt");
  assert.match(halt.json.reason, /hooked\.txt/);
  assert.equal(halt.json.committed, true);
});

test("nested root named with non-ASCII and a space: spaces in names stay unquoted", { skip: noGit }, () => {
  const project = archiveProject({ nest: "ząb dir" });
  fs.writeFileSync(path.join(project.base, ".gitignore"), "ig file.txt\n");
  fs.writeFileSync(path.join(project.changeDir, "ig file.txt"), "x\n");
  fs.writeFileSync(path.join(project.changeDir, "with space.md"), "x\n");
  const res = runNext(project);
  assert.equal(res.json.action, "archive", res.stdout);
  assert.deepEqual(res.json.ignored, ["context/changes/demo/ig file.txt"]);
  const names = showNames(project);
  assert.ok(names.includes("ząb dir/context/changes/demo/with space.md"), names.join("|"));
  assert.ok(!names.some((n) => n.includes("ig file.txt")));
  assert.equal(folderStatus(project), "");

  const hooked = archiveProject({ nest: "ząb dir" });
  writeHook(hooked, "pre-commit", "echo x > 'hooked file.txt'\ngit add 'hooked file.txt'");
  const halt = runNext(hooked);
  assert.equal(halt.json.action, "halt");
  assert.match(halt.json.reason, /hooked file\.txt/);
  assert.doesNotMatch(halt.json.reason, /"/);
});

// ---- the move, and the git write rule -------------------------------------------

test("verify-archive confirms a simulated move after the commit", { skip: noGit }, () => {
  const project = archiveProject();
  const res = runNext(project);
  assert.equal(res.json.action, "archive");
  fs.mkdirSync(path.join(project.root, "context/archive"), { recursive: true });
  git(project, ["mv", relDir(project), path.relative(project.base, path.join(project.root, res.json.archivePath)).split(path.sep).join("/")]);
  const changeMd = path.join(project.root, res.json.archivePath, "change.md");
  fs.writeFileSync(changeMd, fs.readFileSync(changeMd, "utf8").replace("status: implemented", "status: archived"));
  const verified = run(project, ["verify-archive", "demo", "--path", res.json.archivePath], { env: gitEnv(project) });
  assert.equal(verified.status, 0, verified.stdout);
  assert.equal(verified.json.archived, true);
  assert.equal(verified.json.path, res.json.archivePath);
  assert.ok(verified.json.report);
});

test("git subcommands: init --archive and the full path run only allowed commands on the change folder", { skip: noGit || process.platform === "win32" }, () => {
  const project = archiveProject({ archive: false });
  const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const bin = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-shim-"));
  const logFile = path.join(bin, "calls.log");
  try {
    fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\nprintf '%s\\037' "$@" >> "${logFile}"\nprintf '\\n' >> "${logFile}"\nexec "${realGit}" "$@"\n`, { mode: 0o755 });
    const env = { ...gitEnv(project), PATH: `${bin}${path.delimiter}${process.env.PATH}` };
    const first = run(project, ["init", "demo", "--archive"], { env });
    assert.equal(first.json.action, "archive", first.stdout);
    assert.equal(run(project, ["next", "demo"], { env }).json.action, "archive");
    const calls = fs.readFileSync(logFile, "utf8").split("\n").filter(Boolean).map((l) => l.split("\u001f").slice(0, -1));
    assert.ok(calls.length > 10);
    const allowed = ["rev-parse", "check-ignore", "symbolic-ref", "diff", "status", "add", "commit", "reset", "show", "ls-files", "log"];
    const rel = "context/changes/demo";
    const seen = new Set();
    for (const args of calls) {
      let i = 0;
      const dashC = [];
      while (args[i] === "-c") { dashC.push(args[i + 1]); i += 2; }
      assert.deepEqual([...new Set(dashC)], ["core.quotePath=false"], args.join(" "));
      const sub = args[i];
      seen.add(sub);
      assert.ok(allowed.includes(sub), `subcommand ${sub}`);
      assert.ok(!args.includes("--no-verify") && !args.includes("--no-gpg-sign"), args.join(" "));
      if (["add", "commit", "reset"].includes(sub)) {
        assert.deepEqual(args.slice(-2), ["--", rel], args.join(" "));
        assert.equal(args.filter((a) => a === "--").length, 1, args.join(" "));
      }
    }
    for (const sub of ["check-ignore", "add", "commit", "show", "status"]) assert.ok(seen.has(sub), `no ${sub} call`);
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
});
