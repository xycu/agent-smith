// Black-box tests of route.mjs through the CLI. route.mjs runs on import and exports nothing.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, run, init, next, writeLog, entry,
  readLogEntries, readMetaFile, writeMetaFile,
} from "./helpers.mjs";

after(cleanupAll);

const PLAIN_GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");

// ---- rigor start level -------------------------------------------------------

test("short goal starts lean; plain and hard goals start standard", () => {
  const lean = makeProject();
  assert.equal(init(lean, "fix typo").status, 0);
  assert.equal(readMetaFile(lean).rigor.level, "lean");
  assert.equal(readMetaFile(lean).rigor.by, "goal short");

  const plain = makeProject();
  init(plain, PLAIN_GOAL);
  assert.equal(readMetaFile(plain).rigor.level, "standard");

  const hard = makeProject();
  init(hard, "refactor the router");
  assert.equal(readMetaFile(hard).rigor.level, "standard");
});

test("--rigor sets the start level", () => {
  const project = makeProject();
  init(project, "fix typo", ["--rigor", "thorough"]);
  const meta = readMetaFile(project);
  assert.equal(meta.rigor.level, "thorough");
  assert.equal(meta.rigor.requested, "thorough");
});

test("--rigor with a bad or missing value halts with JSON and writes nothing", () => {
  for (const args of [["--rigor", "foo"], ["--rigor"]]) {
    const project = makeProject();
    const res = init(project, "fix typo", args);
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /Invalid --rigor/);
    assert.equal(fs.existsSync(project.agentDir), false);
  }
});

test("a second init without the flag keeps the level", () => {
  const project = makeProject();
  init(project, "fix typo", ["--rigor", "thorough"]);
  writeLog(project, []);
  const res = run(project, ["init", project.id]);
  assert.equal(res.status, 0);
  assert.equal(readMetaFile(project).rigor.level, "thorough");
});

test("--rigor lean on resume does not lower standard", () => {
  const project = makeProject();
  init(project, PLAIN_GOAL);
  writeLog(project, []);
  run(project, ["init", project.id, "--rigor", "lean"]);
  const meta = readMetaFile(project);
  assert.equal(meta.rigor.level, "standard");
  assert.equal(meta.rigor.requested, "lean");
  // A higher request on resume raises both.
  writeLog(project, []);
  run(project, ["init", project.id, "--rigor", "thorough"]);
  assert.equal(readMetaFile(project).rigor.level, "thorough");
  writeLog(project, []);
  run(project, ["init", project.id, "--rigor", "lean"]);
  assert.equal(readMetaFile(project).rigor.requested, "thorough");
  assert.equal(readMetaFile(project).rigor.level, "thorough");
});

test("init keeps every stored meta field", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeLog(project, []);
  const meta = readMetaFile(project);
  meta.baseSha = "a".repeat(40);
  meta.custom = { x: 1 };
  writeMetaFile(project, meta);
  run(project, ["init", project.id]);
  const after = readMetaFile(project);
  assert.equal(after.custom.x, 1);
  assert.equal(after.baseSha, "a".repeat(40));
});

// ---- rigor raising inputs ----------------------------------------------------

test("phase count raises rigor: 3 phases standard, 6 phases thorough", () => {
  const three = makeProject({ plan: planText({ phases: 3 }) });
  init(three, "fix typo");
  assert.equal(readMetaFile(three).rigor.level, "standard");
  assert.match(readMetaFile(three).rigor.by, /phases 3/);

  const six = makeProject({ plan: planText({ phases: 6 }) });
  init(six, "fix typo");
  assert.equal(readMetaFile(six).rigor.level, "thorough");
});

test("one failed step raises rigor to standard, three to thorough", () => {
  const one = makeProject({ plan: planText() });
  writeLog(one, [entry(1, "plan"), entry(2, "implement", { ok: false, verified: false })]);
  init(one, "fix typo");
  assert.equal(readMetaFile(one).rigor.level, "standard");
  assert.match(readMetaFile(one).rigor.by, /failed steps 1/);

  const three = makeProject({ plan: planText() });
  writeLog(three, [
    entry(1, "plan"),
    entry(2, "implement", { ok: false }),
    entry(3, "implement", { ok: false }),
    entry(4, "implement", { ok: false }),
  ]);
  init(three, "fix typo");
  assert.equal(readMetaFile(three).rigor.level, "thorough");
});

test("rigor never falls: the stored level wins over a lower input", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeLog(project, []);
  const meta = readMetaFile(project);
  meta.rigor.level = "thorough";
  writeMetaFile(project, meta);
  next(project);
  assert.equal(readMetaFile(project).rigor.level, "thorough");
});

test("a stored rigor with an unknown level is ignored", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeLog(project, []);
  const meta = readMetaFile(project);
  meta.rigor = { level: "bogus", requested: "bogus" };
  writeMetaFile(project, meta);
  const res = next(project);
  assert.equal(res.status, 0);
  assert.equal(readMetaFile(project).rigor.level, "lean");
});

// ---- budget ------------------------------------------------------------------

test("step budget differs per level: 10, 14, 18", () => {
  const cases = [
    { goal: "fix typo", extra: [], budget: 10 },
    { goal: PLAIN_GOAL, extra: [], budget: 14 },
    { goal: "fix typo", extra: ["--rigor", "thorough"], budget: 18 },
  ];
  for (const { goal, extra, budget } of cases) {
    const project = makeProject();
    writeLog(project, Array.from({ length: budget }, (_, i) => entry(i + 1, "plan")));
    const res = init(project, goal, extra);
    assert.equal(res.json.action, "halt", `budget ${budget}`);
    assert.match(res.json.reason, new RegExp(`Step budget ${budget} spent`));
  }
  // One entry fewer still runs.
  const project = makeProject();
  writeLog(project, Array.from({ length: 9 }, (_, i) => entry(i + 1, "plan")));
  assert.equal(init(project, "fix typo").json.action, "run");
});

test("an override that drives the budget below 1 still gives a positive budget", () => {
  const project = makeProject({ policy: { limits: { maxTotalSteps: 2 } } });
  const res = init(project, "fix typo");
  assert.equal(res.json.action, "run");
});

// ---- effort floor ------------------------------------------------------------

function planReviewProject(goal, rigor) {
  const project = makeProject({ plan: planText() });
  const res = init(project, goal, rigor ? ["--rigor", rigor] : []);
  return { project, res };
}

test("plan-review never gets a tier below the floor", () => {
  const std = planReviewProject(PLAIN_GOAL);
  assert.equal(std.res.json.step, "plan-review");
  assert.ok(readLogEntries(std.project)[0].tier >= 3);
  assert.equal(std.res.json.effort, "high");

  // Lean with unmeasured risk (not a git repo) still reviews, at the lean floor.
  const lean = planReviewProject("fix typo");
  assert.equal(lean.res.json.step, "plan-review");
  assert.ok(readLogEntries(lean.project)[0].tier >= 2);
  assert.match(lean.res.json.reason, /floor medium \(tier 2\)/);
});

test("impl-review never gets a tier below the floor; implement is unaffected", () => {
  const std = makeProject({ plan: planText({ done: 1 }) });
  writeReview(std, "plan-review");
  init(std, PLAIN_GOAL);
  const stdEntry = readLogEntries(std)[0];
  assert.equal(stdEntry.step, "impl-review");
  assert.ok(stdEntry.tier >= 3);

  const lean = makeProject({ plan: planText({ done: 1 }) });
  writeReview(lean, "plan-review");
  init(lean, "fix typo");
  const leanEntry = readLogEntries(lean)[0];
  assert.equal(leanEntry.step, "impl-review");
  assert.ok(leanEntry.tier >= 2);
  // The lean offset (-1) and the simple discount (-1) cannot push it below the floor.
  assert.match(leanEntry.tierWhy, /-1 rigor lean/);
  assert.equal(leanEntry.tier, 2);

  const impl = makeProject({ plan: planText() });
  writeReview(impl, "plan-review");
  init(impl, "fix typo");
  const implEntry = readLogEntries(impl)[0];
  assert.equal(implEntry.step, "implement");
  assert.doesNotMatch(implEntry.tierWhy, /floor medium|floor high/);
});

test("tierWhy names the floor for plan even when it changes nothing", () => {
  const project = makeProject();
  const res = init(project, "fix typo");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /floor medium \(tier 2\)/);
  assert.equal(readLogEntries(project)[0].tier, 2);
});

test("simple is false where the floor undid the discount and true where it survived", () => {
  const review = planReviewProject(PLAIN_GOAL);
  const reviewEntry = readLogEntries(review.project)[0];
  assert.equal(reviewEntry.step, "plan-review");
  assert.match(reviewEntry.tierWhy, /-1 simple change/);
  assert.equal(reviewEntry.simple, false);

  const plan = makeProject();
  init(plan, "fix typo");
  assert.equal(readLogEntries(plan)[0].simple, true);
});

// ---- malformed input ---------------------------------------------------------

test("a meta.json that is not an object falls back and the output stays valid JSON", () => {
  for (const content of ["[]", "5", "not json"]) {
    const project = makeProject();
    writeMetaFile(project, content);
    const res = init(project, "fix typo");
    assert.equal(res.status, 0, content);
    assert.equal(res.json.action, "run");
  }
});

test("a malformed rigor policy block gives a JSON halt, not a stack trace", () => {
  const project = makeProject({ policy: { rigor: { levels: "lean" } } });
  const res = init(project, "fix typo");
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /^Router error:/);
  assert.equal(res.stderr, "");
});

test("report and status show the rigor level", () => {
  const project = makeProject();
  init(project, "fix typo");
  const status = run(project, ["status", project.id, "--report"]);
  assert.equal(status.json.rigor, "lean");
  const report = fs.readFileSync(path.join(project.agentDir, "report.md"), "utf8");
  assert.match(report, /^Rigor: lean \(goal short\)$/m);
});
