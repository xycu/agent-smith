// Shared test helpers: scratch projects, the router CLI, run.jsonl fixtures and a hermetic git environment.
// Plain node: built-ins only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const created = [];
export function cleanupAll() {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export const ROUTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/route.mjs");

// Builds a scratch project under the real path of the temp dir.
// `nest` puts the project root in a subdirectory of `base` (the future git root).
export function makeProject({ id = "demo", plan = null, policy = null, change = true, nest = null } = {}) {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-"));
  created.push(base);
  const root = nest ? path.join(base, nest) : base;
  const changeDir = path.join(root, "context/changes", id);
  fs.mkdirSync(changeDir, { recursive: true });
  if (change) fs.writeFileSync(path.join(changeDir, "change.md"), `---\nchange_id: ${id}\nstatus: planned\n---\n`);
  const project = {
    id,
    base,
    root,
    changeDir,
    agentDir: path.join(changeDir, "agent-smith"),
    planFile: path.join(changeDir, "plan.md"),
  };
  if (plan !== null) writePlan(project, plan);
  writeOverride(project, policy ?? {});
  return project;
}

// Writes the project override file, context/foundation/agent-smith-policy.json. It merges in `score.minRigor: null`
// unless the policy has its own `score` key, so the score step stays off and existing tests keep `plan` as the first
// step whatever the shipped default is. Shallow merge only: a test-provided `score` block wins whole. A test that
// wants the scorer opts in with `policy: { score: { minRigor: "standard" } }`.
export function writeOverride(project, policy = {}) {
  const file = path.join(project.root, "context/foundation/agent-smith-policy.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const value = Object.hasOwn(policy, "score") ? policy : { ...policy, score: { minRigor: null } };
  fs.writeFileSync(file, JSON.stringify(value));
}

export function writePlan(project, text) {
  fs.writeFileSync(project.planFile, text);
}

// A plan with `phases` phases. `files` is a list of lines placed after each phase header,
// for example "**File**: `a.js`". `pending` rows per phase stay open, the rest are checked.
export function planText({ phases = 1, rowsPerPhase = 1, done = 0, files = [] } = {}) {
  const blocks = [];
  const progress = [];
  let row = 0;
  for (let n = 1; n <= phases; n++) {
    blocks.push(`## Phase ${n}: Part ${n}\n\n${files.join("\n\n")}\n`);
    progress.push(`### Phase ${n}: Part ${n}\n\n#### Automated\n`);
    for (let r = 1; r <= rowsPerPhase; r++) {
      row++;
      progress.push(`- [${row <= done ? "x" : " "}] ${n}.${r} Check ${row}`);
    }
    progress.push("\n#### Manual\n\n- [ ] " + n + ".9 Look at it\n");
  }
  return `# Plan\n\n${blocks.join("\n")}\n## Progress\n\n${progress.join("\n")}\n`;
}

export function writeReview(project, name, { verdict = "SOUND", findings = "0 critical, 0 warnings" } = {}) {
  const dir = path.join(project.changeDir, "reviews");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.md`), `# Review\n\n- **Verdict**: ${verdict}\n- **Findings**: ${findings}\n`);
}

// Runs route.mjs in the project root. Returns { status, json, stdout, stderr }.
export function run(project, args, { env = {} } = {}) {
  const res = spawnSync(process.execPath, [ROUTE, ...args], {
    cwd: project.root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* leave null */ }
  return { status: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

export function init(project, goal, extra = []) {
  return run(project, ["init", project.id, "--goal", goal, ...extra]);
}

export function next(project) {
  return run(project, ["next", project.id]);
}

export function writeResult(project, result) {
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "last-result.json"), JSON.stringify(result));
}

export function readLogEntries(project) {
  const file = path.join(project.agentDir, "run.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function readMetaFile(project) {
  return JSON.parse(fs.readFileSync(path.join(project.agentDir, "meta.json"), "utf8"));
}

export function writeMetaFile(project, value) {
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "meta.json"), typeof value === "string" ? value : JSON.stringify(value));
}

export function readReportFile(project) {
  return fs.readFileSync(path.join(project.agentDir, "report.md"), "utf8");
}

// The one place that owns run.jsonl fixtures. Scratch projects only: AGENTS.md forbids hand edits of real runs.
// An executed entry in the router's schema. `over` replaces any field.
export function entry(n, step, over = {}) {
  return {
    n,
    step,
    template: step,
    skill: null,
    tier: 3,
    model: "sonnet",
    effort: "high",
    reason: "fixture",
    tierWhy: "fixture",
    simple: false,
    startedAt: 1000 + n,
    before: { autoDone: 0 },
    result: { status: "done", note: "fixture" },
    verified: true,
    ok: true,
    finishedAt: 2000 + n,
    ...over,
  };
}

// A skip entry in the router's schema (no n, template, ok or result).
export function skipEntry(step, afterN, over = {}) {
  return { skipped: true, step, reason: "fixture skip", rigor: "lean", afterN, at: 1500 + afterN, ...over };
}

export function writeLog(project, entries) {
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "run.jsonl"), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// ---- git -------------------------------------------------------------------

export function gitAvailable() {
  const res = spawnSync("git", ["--version"], { encoding: "utf8" });
  return res.status === 0;
}

// Hermetic environment: no global or system config, no hooks from elsewhere, fixed identity,
// discovery stops at the scratch parent. HOME points to the scratch dir for git older than 2.32.
export function gitEnv(project) {
  return {
    ...process.env,
    HOME: project.base,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CEILING_DIRECTORIES: path.dirname(project.base),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
}

// Runs git in project.base. `date` (ISO string) sets both author and committer date.
export function git(project, args, { date = null } = {}) {
  const env = gitEnv(project);
  if (date) { env.GIT_AUTHOR_DATE = date; env.GIT_COMMITTER_DATE = date; }
  const res = spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd: project.base,
    encoding: "utf8",
    env,
  });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
  return res.stdout.trim();
}

export function gitInit(project) {
  git(project, ["init", "-q"]);
}

// Writes `files` (relative to project.base) and commits them as one commit.
export function commitFiles(project, files, { date = null, message = "change" } = {}) {
  for (const f of files) {
    const abs = path.join(project.base, f);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.appendFileSync(abs, `${message}\n`);
  }
  git(project, ["add", "--", ...files]);
  git(project, ["commit", "-q", "--allow-empty", "-m", message], { date });
}
