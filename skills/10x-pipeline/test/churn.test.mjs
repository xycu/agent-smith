// Churn risk through the CLI: hermetic scratch git repos, asserted via `risk` and `next`.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  cleanupAll, makeProject, writePlan, planText, run, init, writeLog, entry, readLogEntries, readMetaFile, writeMetaFile,
  gitAvailable, gitEnv, gitInit, commitFiles, git,
} from "./helpers.mjs";

after(cleanupAll);

const skip = gitAvailable() ? false : "git is not installed";
const OLD = "2020-01-01T12:00:00Z";

function risk(project) {
  const res = run(project, ["risk", project.id], { env: gitEnv(project) });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return res.json;
}

function runWithGit(project, args) {
  return run(project, args, { env: gitEnv(project) });
}

// 10 commits: f9 in all of them, f4 in the first 4, g1..g4 once each, README.md in the last (excluded).
// Counts of the non-excluded paths: [1,1,1,1,4,9], threshold 4.
function dryRunRepo(project, prefix = "") {
  gitInit(project);
  for (let i = 1; i <= 9; i++) {
    const files = [`${prefix}f9.js`];
    if (i <= 4) files.push(`${prefix}f4.js`, `${prefix}g${i}.js`);
    commitFiles(project, files, { message: `c${i}` });
  }
  commitFiles(project, [`${prefix}README.md`], { message: "c10" });
}

function planWith(...lines) {
  return planText({ files: lines });
}

test("a repo with 10 or more recent commits reports source window", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `x.js`") });
  dryRunRepo(project);
  assert.equal(risk(project).source, "window");
});

test("counts [1,1,1,1,4,9] give threshold 4 and two hot paths", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `x.js`") });
  dryRunRepo(project);
  assert.deepEqual(risk(project).hot, ["f4.js", "f9.js"]);
});

test("the plan paths are read from both **File**: and **Files**: lines", { skip }, () => {
  const project = makeProject({
    plan: planWith("**File**: `new.test.mjs`", "**Files**: `f9.js`, `other.js`", "Intent text with **File**: `inline.js` mid-line"),
  });
  dryRunRepo(project);
  const r = risk(project);
  assert.equal(r.planPaths, 3);
  assert.deepEqual(r.planHits, ["f9.js"]);
  assert.equal(r.level, "standard");
});

// Hot files in src/: src/f4.js and src/f9.js. Each plan shape below names one of them without the exact relative path.
function srcRisk(token) {
  const project = makeProject();
  writePlan(project, planWith(`**File**: ${token(project.root)}`));
  dryRunRepo(project, "src/");
  return { project, r: risk(project) };
}

test("a plan path that is a directory matches the hot files below it", { skip }, () => {
  for (const token of ["`src/`", "`src`", "`./src/`"]) {
    const { r } = srcRisk(() => token);
    assert.deepEqual(r.hot, ["src/f4.js", "src/f9.js"], token);
    assert.equal(r.planPaths, 1, token);
    assert.deepEqual(r.planHits, ["src/f4.js", "src/f9.js"], token);
    assert.deepEqual(r.unclassified, [], token);
    assert.equal(r.level, "standard", token);
  }
  // A directory with no hot file below it is checked, not hot.
  const cold = srcRisk(() => "`lib/`").r;
  assert.equal(cold.planPaths, 1);
  assert.deepEqual(cold.planHits, []);
});

test("a plan path that is a glob matches through the glob matcher", { skip }, () => {
  const star = srcRisk(() => "`src/f*.js`").r;
  assert.deepEqual(star.planHits, ["src/f4.js", "src/f9.js"]);
  assert.equal(star.planPaths, 1);
  assert.deepEqual(srcRisk(() => "`src/**`").r.planHits, ["src/f4.js", "src/f9.js"]);
  assert.deepEqual(srcRisk(() => "`src/f?.js`").r.planHits, ["src/f4.js", "src/f9.js"]);
  assert.deepEqual(srcRisk(() => "`src/g*.js`").r.planHits, []);
});

test("an absolute path under the project root is matched; one outside is not classified", { skip }, () => {
  const inside = srcRisk((root) => `\`${root}/src/f9.js\``);
  assert.deepEqual(inside.r.planHits, ["src/f9.js"]);
  assert.equal(inside.r.planPaths, 1);
  const outside = srcRisk(() => "`/etc/hosts`").r;
  assert.equal(outside.planPaths, 0);
  assert.deepEqual(outside.unclassified, ["/etc/hosts"]);
  assert.deepEqual(outside.planHits, []);
});

test("a differently cased path matches the hot file", { skip }, () => {
  const r = srcRisk(() => "`SRC/F9.JS`").r;
  assert.deepEqual(r.planHits, ["src/f9.js"]);
  assert.equal(r.planPaths, 1);
});

test("an unbackticked path with a trailing note or a line number is matched", { skip }, () => {
  for (const token of ["src/f9.js (new section)", "src/f9.js:12", "src/f9.js:12-20 (edit)", "./src/f9.js"]) {
    const r = srcRisk(() => token).r;
    assert.deepEqual(r.planHits, ["src/f9.js"], token);
    assert.equal(r.planPaths, 1, token);
    assert.deepEqual(r.unclassified, [], token);
  }
});

test("a token that cannot be classified is not a measured path", { skip }, () => {
  for (const token of ["src/f9.js and the tests", "../outside.js", "~/x.js"]) {
    const r = srcRisk(() => token).r;
    assert.equal(r.planPaths, 0, token);
    assert.equal(r.unclassified.length, 1, token);
    assert.deepEqual(r.planHits, [], token);
  }
});

test("lean plus a directory naming a hot file runs plan-review and raises rigor", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `src/`") });
  dryRunRepo(project, "src/");
  const res = runWithGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.json.step, "plan-review");
  assert.equal(readMetaFile(project).rigor.level, "standard");
  assert.equal(readLogEntries(project).filter((e) => e.skipped).length, 0);
});

test("lean with an unclassified plan path runs plan-review and never skips", { skip }, () => {
  // Only an unclassified path.
  const only = makeProject({ plan: planWith("**File**: `/etc/hosts`") });
  dryRunRepo(only, "src/");
  const a = runWithGit(only, ["init", only.id, "--goal", "fix typo"]);
  assert.equal(a.json.step, "plan-review");
  assert.match(a.json.reason, /risk not measured \(window, 0 plan paths, 1 unclassified\)/);
  // A cold checked path next to an unclassified one still runs plan-review.
  const mixed = makeProject({ plan: planWith("**Files**: `lib/cold.js`, `src/f9.js and more`") });
  dryRunRepo(mixed, "src/");
  const b = runWithGit(mixed, ["init", mixed.id, "--goal", "fix typo"]);
  assert.equal(b.json.step, "plan-review");
  assert.match(b.json.reason, /risk not measured \(window, 1 plan paths, 1 unclassified\)/);
  assert.equal(readLogEntries(mixed).filter((e) => e.skipped).length, 0);
  // Control: the cold path alone is measured and skips.
  const cold = makeProject({ plan: planWith("**File**: `lib/cold.js`") });
  dryRunRepo(cold, "src/");
  const c = runWithGit(cold, ["init", cold.id, "--goal", "fix typo"]);
  assert.equal(c.json.step, "implement");
  assert.equal(readLogEntries(cold).filter((e) => e.skipped).length, 1);
});

test("hotMinCommits blocks a young repo", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `a.js`") });
  gitInit(project);
  commitFiles(project, ["a.js", "b.js"], { message: "c1" });
  commitFiles(project, ["a.js"], { message: "c2" });
  for (let i = 3; i <= 10; i++) commitFiles(project, [`only${i}.js`], { message: `c${i}` });
  const r = risk(project);
  assert.equal(r.source, "window");
  assert.deepEqual(r.hot, []);
});

test("excluded globs never count", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `docs/guide.md`") });
  gitInit(project);
  for (let i = 1; i <= 10; i++) {
    commitFiles(project, ["context/notes.txt", "docs/guide.md", "README.md", "package-lock.json", "src/x.md", "app.js"], { message: `c${i}` });
  }
  const r = risk(project);
  assert.equal(r.source, "window");
  assert.deepEqual(r.hot, ["app.js"]);
});

test("fewer than minCommitsInWindow in the window falls back to all history", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `x.js`") });
  gitInit(project);
  for (let i = 1; i <= 12; i++) commitFiles(project, ["old.js"], { date: OLD, message: `c${i}` });
  const r = risk(project);
  assert.equal(r.source, "all-history");
  assert.deepEqual(r.hot, ["old.js"]);
});

test("still fewer commits gives no hot paths and unavailable", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `a.js`") });
  gitInit(project);
  for (let i = 1; i <= 5; i++) commitFiles(project, ["a.js"], { message: `c${i}` });
  const r = risk(project);
  assert.equal(r.source, "unavailable");
  assert.deepEqual(r.hot, []);
  assert.equal(r.level, null);
});

test("a project root in a subdirectory of the git repo still matches plan paths", { skip }, () => {
  const project = makeProject({ nest: "sub", plan: planWith("**File**: `f9.js`") });
  dryRunRepo(project, "sub/");
  const r = risk(project);
  assert.equal(r.source, "window");
  assert.deepEqual(r.planHits, ["f9.js"]);
});

test("a mistyped risk.churn.since gives unavailable", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`"), policy: { risk: { churn: { since: "bogus" } } } });
  dryRunRepo(project);
  const r = risk(project);
  assert.equal(r.source, "unavailable");
  assert.deepEqual(r.hot, []);
});

test("an unreachable baseSha gives unavailable", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`") });
  dryRunRepo(project);
  init(project, "fix typo");
  const meta = readMetaFile(project);
  meta.baseSha = "0123456789abcdef0123456789abcdef01234567";
  writeMetaFile(project, meta);
  assert.equal(risk(project).source, "unavailable");
});

test("a baseSha that looks like an option is rejected", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`") });
  dryRunRepo(project);
  writeMetaFile(project, { id: "demo", goal: "x", baseSha: "--output=evil" });
  assert.equal(risk(project).source, "unavailable");
});

test("init stores baseSha once; later commits do not change the hot set", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `late.js`") });
  dryRunRepo(project);
  const head = git(project, ["rev-parse", "HEAD"]);
  assert.equal(runWithGit(project, ["init", project.id, "--goal", "fix typo"]).status, 0);
  assert.equal(readMetaFile(project).baseSha, head);
  writeLog(project, []);
  for (let i = 0; i < 6; i++) commitFiles(project, ["late.js"], { message: `late${i}` });
  runWithGit(project, ["init", project.id]);
  assert.equal(readMetaFile(project).baseSha, head);
  const r = risk(project);
  assert.deepEqual(r.hot, ["f4.js", "f9.js"]);
  assert.deepEqual(r.planHits, []);
});

test("a plan naming one hot file raises rigor to standard, three to thorough", { skip }, () => {
  const one = makeProject({ plan: planWith("**File**: `f9.js`") });
  dryRunRepo(one);
  assert.equal(runWithGit(one, ["init", one.id, "--goal", "fix typo"]).status, 0);
  assert.equal(readMetaFile(one).rigor.level, "standard");
  assert.match(readMetaFile(one).rigor.by, /hot paths f9\.js/);

  const three = makeProject({ plan: planWith("**Files**: `x.js`, `y.js`, `z.js`") });
  gitInit(three);
  for (let i = 1; i <= 10; i++) commitFiles(three, ["x.js", "y.js", "z.js", `s${i}.js`], { message: `c${i}` });
  assert.deepEqual(risk(three).hot, ["x.js", "y.js", "z.js"]);
  assert.equal(runWithGit(three, ["init", three.id, "--goal", "fix typo"]).status, 0);
  assert.equal(readMetaFile(three).rigor.level, "thorough");
});

test("a diff hit after implement raises rigor", { skip }, () => {
  const project = makeProject({ plan: planText({ phases: 1 }) });
  dryRunRepo(project);
  runWithGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(readMetaFile(project).rigor.level, "lean");
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
  commitFiles(project, ["f9.js"], { message: "implement" });
  const r = risk(project);
  assert.deepEqual(r.diffHits, ["f9.js"]);
  assert.equal(runWithGit(project, ["next", project.id]).status, 0);
  assert.equal(readMetaFile(project).rigor.level, "standard");
  assert.match(readMetaFile(project).rigor.by, /hot paths f9\.js/);
});

test("a directory that is not a git repo gives unavailable, no flag, no exception", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`") });
  const r = risk(project);
  assert.equal(r.source, "unavailable");
  assert.deepEqual(r.hot, []);
  assert.equal(r.level, null);
  const res = runWithGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.status, 0);
  assert.equal(readMetaFile(project).baseSha, undefined);
  assert.equal(readMetaFile(project).rigor.level, "lean");
});

test("an exclude override that is not an array is ignored without a stack trace", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`"), policy: { risk: { churn: { exclude: "context/**" } } } });
  dryRunRepo(project);
  const res = runWithGit(project, ["risk", project.id]);
  assert.equal(res.status, 0);
  assert.equal(res.stderr, "");
  assert.equal(res.json.source, "window");
  // The shipped list still applies, so README.md stays out.
  assert.deepEqual(res.json.hot, ["f4.js", "f9.js"]);
});

test("risk writes nothing", { skip }, () => {
  const project = makeProject({ plan: planWith("**File**: `f9.js`") });
  dryRunRepo(project);
  risk(project);
  assert.equal(fs.existsSync(project.agentDir), false);
  assert.equal(risk(project).source, "window");
});
