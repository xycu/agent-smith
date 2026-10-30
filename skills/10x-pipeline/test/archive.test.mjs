// Archive re-entry guard and verify-archive through the CLI. Archive folders are made by hand; no git needed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanupAll, makeProject, run, init, next, writeLog, entry, ROUTE, gitEnv, gitInit, writeResult, readMetaFile } from "./helpers.mjs";

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
