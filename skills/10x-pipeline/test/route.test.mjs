// Black-box tests of route.mjs through the CLI. route.mjs runs on import and exports nothing.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, run, init, next, writeLog, entry,
  readLogEntries, readMetaFile, writeMetaFile, skipEntry, writeResult, readReportFile, gitAvailable, gitEnv, gitInit, commitFiles,
  ruleTail,
} from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";

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

test("an array suffix override joins with newlines in a step prompt", () => {
  const project = makeProject({ policy: { prompts: { suffix: ["line one", "line two"] } } });
  const res = init(project, "fix typo");
  assert.equal(res.json.action, "run");
  assert.ok(res.json.prompt.endsWith(ruleTail("line one\nline two")), res.json.prompt);
});

test("a string suffix override that starts with @prompts/ is a file reference in a step prompt", () => {
  const project = makeProject({ policy: { prompts: { suffix: "@prompts/advisor.md" } } });
  const res = init(project, "fix typo");
  assert.equal(res.json.action, "run");
  const text = fs.readFileSync(new URL("../prompts/advisor.md", import.meta.url), "utf8").trim();
  assert.ok(res.json.prompt.endsWith("\n\n" + ruleTail(text)), res.json.prompt);
  // Text after any other first character stays literal.
  const literal = makeProject({ policy: { prompts: { suffix: "See @prompts/advisor.md" } } });
  assert.ok(init(literal, "fix typo").json.prompt.endsWith("\n\n" + ruleTail("See @prompts/advisor.md")));
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

test("step budget differs per level: 12, 19, 24", () => {
  const cases = [
    { goal: "fix typo", extra: [], budget: 12 },
    { goal: PLAIN_GOAL, extra: [], budget: 19 },
    { goal: "fix typo", extra: ["--rigor", "thorough"], budget: 24 },
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
  writeLog(project, Array.from({ length: 11 }, (_, i) => entry(i + 1, "plan")));
  assert.equal(init(project, "fix typo").json.action, "run");
});

test("a complete run at the budget ends done, not halted (issue #87)", () => {
  for (const count of [11, 12]) {
    const project = makeProject({ plan: planText({ done: 1 }) });
    writeReview(project, "plan-review");
    writeReview(project, "impl-review", { verdict: "APPROVED" });
    const steps = ["plan", "plan-review", "implement"];
    while (steps.length < count - 1) steps.push("implement");
    steps.push("impl-review");
    writeLog(project, steps.map((s, i) => entry(i + 1, s)));
    assert.equal(init(project, "fix typo").json.action, "done", `${count} entries`);
  }
});

test("a decide halt is not masked by the budget text", () => {
  const project = makeProject({ plan: planText({ done: 1 }) });
  writeReview(project, "plan-review");
  writeReview(project, "impl-review", { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" });
  const steps = ["plan", "plan-review", "implement", "impl-review", "fix", "impl-review", "fix", "impl-review"];
  while (steps.length < 12) steps.splice(3, 0, "implement");
  writeLog(project, steps.map((s, i) => entry(i + 1, s)));
  const res = init(project, "fix typo");
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Implementation still NEEDS ATTENTION after 2 fix loops/);
  assert.doesNotMatch(res.json.reason, /Step budget/);
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

test("the effort floor beats maxTier", () => {
  const project = makeProject({ plan: planText(), policy: { steps: { "plan-review": { minTier: 0, maxTier: 0 } } } });
  const res = init(project, PLAIN_GOAL);
  assert.equal(res.json.step, "plan-review");
  const e = readLogEntries(project)[0];
  assert.equal(e.tier, 3);
  assert.equal(e.effort, "high");
  assert.match(e.tierWhy, /clamped to 0/);
  assert.match(e.tierWhy, /floor high \(tier 3\)/);
});

test("simple is false where the lean offset or the clamp absorbed the discount", () => {
  // Lean impl-review: 3 - 1 (discount) - 1 (offset) = 1, raised to the floor 2; without the discount it is 2 too.
  const lean = makeProject({ plan: planText({ done: 1 }) });
  writeReview(lean, "plan-review");
  init(lean, "fix typo");
  const leanEntry = readLogEntries(lean)[0];
  assert.equal(leanEntry.step, "impl-review");
  assert.match(leanEntry.tierWhy, /-1 simple change/);
  assert.equal(leanEntry.simple, false);

  // A minTier clamp that lifts the discounted plan tier back to the undiscounted one.
  const clamp = makeProject({ policy: { steps: { plan: { minTier: 3 } } } });
  init(clamp, "fix typo");
  const clampEntry = readLogEntries(clamp)[0];
  assert.match(clampEntry.tierWhy, /clamped to 3/);
  assert.equal(clampEntry.simple, false);

  // A discount that survives is still reported.
  const kept = makeProject();
  init(kept, "fix typo");
  const keptEntry = readLogEntries(kept)[0];
  assert.equal(keptEntry.step, "plan");
  assert.equal(keptEntry.simple, true);
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

// ---- skip entries ------------------------------------------------------------
// Lean skips plan-review only when churn was measured (git history) and the plan names a path.

function gitProject({ plan = null, commits = 10, nest = null } = {}) {
  const project = makeProject({ plan, nest });
  gitInit(project);
  for (let i = 1; i <= commits; i++) commitFiles(project, [`s${i}.js`], { message: `c${i}` });
  return project;
}

const withGit = (project, args) => run(project, args, { env: gitEnv(project) });

// Plan step done: plan.md written after the step started, result "done".
function finishPlan(project, text) {
  writePlan(project, text);
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned" });
}

function leanFlow() {
  const project = gitProject();
  const first = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(first.json.step, "plan");
  finishPlan(project, planText({ files: ["**File**: `x.js`"] }));
  const second = withGit(project, ["next", project.id]);
  return { project, second };
}

const skipsOf = (project) => readLogEntries(project).filter((e) => e.skipped);
const noGit = !gitAvailable() && "git is not installed";

test("lean plus a fresh plan skips plan-review and logs one skip entry", { skip: noGit }, () => {
  const { project, second } = leanFlow();
  assert.equal(second.json.step, "implement");
  const skips = skipsOf(project);
  assert.equal(skips.length, 1);
  assert.equal(skips[0].step, "plan-review");
  assert.equal(skips[0].afterN, 1);
  assert.equal(skips[0].rigor, "lean");
  assert.match(skips[0].reason, /^rigor lean: plan-review skipped \(churn window, 1 plan paths, none hot\)$/);
  assert.deepEqual(skips[0].risk, { source: "window", planPaths: 1 });
  assert.equal(second.json.n, 2);
  const entries = readLogEntries(project);
  assert.equal(entries.filter((e) => !e.skipped).length, 2);
  assert.equal(entries.find((e) => e.step === "implement").n, 2);
  assert.equal(skips[0].n, undefined);
  assert.equal(skips[0].result, undefined);
  // The simple-change discount still applies with a skip in the log.
  assert.equal(entries.find((e) => e.step === "implement").simple, true);
});

test("after a skip, the next step is not asked for plan-review again", { skip: noGit }, () => {
  const { project } = leanFlow();
  // Implement done: all rows checked and the result written.
  writePlan(project, planText({ done: 1, files: ["**File**: `x.js`"] }));
  const later = new Date(Date.now() + 9000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "implemented" });
  const res = withGit(project, ["next", project.id]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "impl-review");
  assert.equal(skipsOf(project).length, 1);
});

test("next after a skip does not halt with has no result", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(project, [entry(1, "plan"), skipEntry("plan-review", 1)]);
  const res = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.step, "implement");
  assert.equal(res.json.n, 2);
});

test("skips do not use budget", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  const entries = Array.from({ length: 8 }, (_, i) => entry(i + 1, "plan"));
  writeLog(project, [entries[0], skipEntry("plan-review", 1), skipEntry("plan-review", 1), ...entries.slice(1)]);
  const res = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.json.action, "run", JSON.stringify(res.json));
});

test("a skip between failed attempts keeps the failure streak", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(project, [
    entry(1, "plan"),
    skipEntry("plan-review", 1),
    entry(2, "implement", { ok: false }),
    skipEntry("plan-review", 2),
    entry(3, "implement", { ok: false }),
    entry(4, "implement", { ok: false }),
  ]);
  const res = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /implement failed 3 times in a row/);
});

test("standard still returns plan-review", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  const res = withGit(project, ["init", project.id, "--goal", PLAIN_GOAL]);
  assert.equal(res.json.step, "plan-review");
  assert.equal(skipsOf(project).length, 0);
});

test("a plan that names a hot path never skips", { skip: noGit }, () => {
  const project = makeProject({ plan: planText({ files: ["**File**: `f9.js`"] }) });
  gitInit(project);
  for (let i = 1; i <= 9; i++) commitFiles(project, ["f9.js", `s${i}.js`], { message: `c${i}` });
  commitFiles(project, ["other.js"], { message: "c10" });
  const res = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.json.step, "plan-review");
  assert.equal(readMetaFile(project).rigor.level, "standard");
  assert.equal(skipsOf(project).length, 0);
});

test("lean with unmeasured risk runs plan-review and logs no skip", { skip: noGit }, () => {
  // Not a git repo.
  const bare = makeProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  const a = withGit(bare, ["init", bare.id, "--goal", "fix typo"]);
  assert.equal(a.json.step, "plan-review");
  assert.match(a.json.reason, /risk not measured \(unavailable, 1 plan paths\)/);
  assert.equal(skipsOf(bare).length, 0);
  // A repo, but the plan names no path.
  const noPaths = gitProject({ plan: planText() });
  const b = withGit(noPaths, ["init", noPaths.id, "--goal", "fix typo"]);
  assert.equal(b.json.step, "plan-review");
  assert.match(b.json.reason, /risk not measured \(window, 0 plan paths\)/);
  assert.equal(skipsOf(noPaths).length, 0);
  // The unmeasured review still gets the lean floor.
  assert.ok(readLogEntries(noPaths)[0].tier >= 2);
});

test("a rigor rise before any implement or fix brings plan-review back", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  // Fixture: a skip with no implement or fix after it (the router itself moves on to implement at once).
  writeLog(project, [entry(1, "plan"), skipEntry("plan-review", 1)]);
  const res = withGit(project, ["init", project.id, "--goal", "fix typo", "--rigor", "standard"]);
  assert.equal(res.json.step, "plan-review");
});

test("after a failed implement, a rigor rise does not bring plan-review back", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(project, [entry(1, "plan"), skipEntry("plan-review", 1), entry(2, "implement", { ok: false, verified: false })]);
  const res = withGit(project, ["init", project.id, "--goal", "fix typo", "--rigor", "thorough"]);
  assert.equal(res.json.step, "implement");
  assert.equal(readLogEntries(project).some((e) => e.template === "plan-revise"), false);
});

test("report lists the skipped step and keeps Steps as the executed count", { skip: noGit }, () => {
  const { project } = leanFlow();
  const status = withGit(project, ["status", project.id, "--report"]);
  assert.equal(status.status, 0);
  const report = readReportFile(project);
  assert.match(report, /^## Skipped steps$/m);
  assert.match(report, /^\| After step \| Step \| Reason \| Rigor \|$/m);
  assert.match(report, /^\| 1 \| plan-review \| rigor lean: plan-review skipped .* \| lean \|$/m);
  assert.match(report, /^Steps: 2 · .* · Skipped: 1$/m);
  const skippedRow = status.json.steps.find((s) => s.skipped);
  assert.equal(skippedRow.step, "plan-review");
  assert.equal(status.json.steps.filter((s) => !s.skipped).length, 2);
});

test("a report without skips has no Skipped section", () => {
  const project = makeProject();
  init(project, "fix typo");
  run(project, ["status", project.id, "--report"]);
  const report = readReportFile(project);
  assert.doesNotMatch(report, /Skipped/);
});

test("init on a log with a skip resumes cleanly", { skip: noGit }, () => {
  const project = gitProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(project, [entry(1, "plan"), skipEntry("plan-review", 1), entry(2, "implement", { verified: true })]);
  const res = withGit(project, ["init", project.id]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
});

// ---- signals -----------------------------------------------------------------

// A plan step that finished cleanly, with `signals` in the RESULT.
function planWithSignals(signals, goal = "fix typo") {
  const project = makeProject();
  init(project, goal);
  writePlan(project, planText());
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned", ...(signals === undefined ? {} : { signals }) });
  return project;
}

test("signals keep known keys and drop the rest", () => {
  const project = planWithSignals({ foo: 1, rigor: "thorough", needsHuman: "  two\n words  " });
  const res = next(project);
  assert.equal(res.status, 0);
  const first = readLogEntries(project)[0];
  assert.deepEqual(first.signals, { rigor: "thorough", needsHuman: "two words" });
});

test("bad signal values are dropped or cut", () => {
  const cases = [
    [{ rigor: 3 }, undefined],
    [{ rigor: "extreme" }, undefined],
    [["rigor", "thorough"], undefined],
    ["thorough", undefined],
    [{ needsHuman: "" }, undefined],
    [{ needsHuman: false }, undefined],
    [{ needsHuman: { text: "x" } }, undefined],
  ];
  for (const [signals] of cases) {
    const project = planWithSignals(signals);
    const res = next(project);
    assert.equal(res.status, 0, JSON.stringify(signals));
    assert.equal(readLogEntries(project)[0].signals, undefined, JSON.stringify(signals));
    assert.equal(readMetaFile(project).rigor.level, "lean", JSON.stringify(signals));
  }
  // An oversized needsHuman is cut, and true becomes a generic text.
  const long = planWithSignals({ needsHuman: "x".repeat(2000) });
  next(long);
  const text = readLogEntries(long)[0].signals.needsHuman;
  assert.ok(text.length > 0 && text.length <= 300);
  const flag = planWithSignals({ needsHuman: true });
  next(flag);
  assert.match(readLogEntries(flag)[0].signals.needsHuman, /asked for a human/);
});

test("run.jsonl holds no raw signals", () => {
  const project = planWithSignals({ foo: "bar", rigor: "standard" });
  next(project);
  const first = readLogEntries(project)[0];
  assert.equal(first.result.signals, undefined);
  assert.equal(fs.readFileSync(path.join(project.agentDir, "run.jsonl"), "utf8").includes('"foo"'), false);
});

test("signals.rigor raises the level; a lower value changes nothing", () => {
  const up = planWithSignals({ rigor: "thorough" });
  next(up);
  assert.equal(readMetaFile(up).rigor.level, "thorough");
  assert.match(readMetaFile(up).rigor.by, /signals/);

  const same = planWithSignals({ rigor: "lean" }, PLAIN_GOAL);
  next(same);
  assert.equal(readMetaFile(same).rigor.level, "standard");
});

test("signals.needsHuman halts once with a report and the ack lives on the log entry", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeResult(project, { status: "blocked", note: "no evidence", signals: { needsHuman: "Which database?" } });
  const halt = next(project);
  assert.equal(halt.status, 0);
  assert.equal(halt.json.action, "halt");
  assert.match(halt.json.reason, /needs a human: Which database\?/);
  assert.equal(halt.json.report, path.relative(project.root, path.join(project.agentDir, "report.md")));
  assert.match(readReportFile(project), /needs a human/);
  const first = readLogEntries(project)[0];
  assert.equal(first.needsHumanAck, true);
  assert.equal("needsHumanAck" in readMetaFile(project), false);

  // The same entry does not halt again; the blocked step counted as a failed attempt.
  const resumed = run(project, ["init", project.id]);
  assert.equal(resumed.json.action, "run");
  assert.equal(resumed.json.step, "plan");
  assert.equal(resumed.json.n, 2);
  assert.match(resumed.json.reason, /1 failed attempt/);
});

test("a RESULT without signals behaves as before", () => {
  const project = planWithSignals(undefined);
  const res = next(project);
  assert.equal(res.json.action, "run");
  assert.equal(readLogEntries(project)[0].signals, undefined);
  assert.equal(readLogEntries(project)[0].needsHumanAck, undefined);
});

test("the plan prompt carries named-skill loading, layered safety rules and the RESULT line with signals", () => {
  const project = makeProject();
  const res = init(project, "fix typo");
  const prompt = res.json.prompt;
  const rules = prompt.split("\n").filter((l) => l.startsWith("- **GIVEN**"));
  // Three defaults, then portable skill loading and the safety/precedence rules of top.md (ADR-023).
  assert.equal(rules.length, 10);
  assert.match(rules[0], /\*\*MUST\*\* decide from researched best practice/);
  assert.match(rules[1], /`signals\.needsHuman`/);
  assert.match(rules[2], /\*\*MAY\*\* add `signals\.rigor`/);
  assert.match(rules[3], /\*\*MUST\*\* load its SKILL\.md through the host/);
  assert.match(rules[4], /\*\*MUST\*\* keep the text before the RESULT line to a short status/);
  assert.match(rules[5], /\*\*MUST NOT\*\* use `rm -rf`/);
  assert.match(rules[6], /\*\*MUST\*\* list its files, .*one by one, and then `rmdir` the empty directories deepest first/);
  assert.match(rules[7], /\*\*MUST NOT\*\* call the Agent tool/);
  assert.match(rules[8], /always-true heading .*\*\*MUST\*\* follow the always-true rule/);
  assert.match(rules[9], /neither stands under an always-true heading .*\*\*MUST\*\* follow the rule written earlier/);
  const result = prompt.split("\n").find((l) => l.startsWith("RESULT: "));
  assert.equal(prompt.split("\n").at(-1), result, "the RESULT line of top.md ends the prompt");
  assert.ok(result.includes('"signals":{"needsHuman":"<reason, only when blocked>","rigor":"standard|thorough"}'));
  assert.match(prompt, /`signals` object is optional/);
  assert.doesNotMatch(prompt, /most conservative option/);
});

// ---- init --goal parsing (issue #90) -----------------------------------------

test("a goal that starts with -- is stored verbatim", () => {
  const project = makeProject();
  assert.equal(init(project, "--verbose flag should print timings").status, 0);
  assert.equal(readMetaFile(project).goal, "--verbose flag should print timings");
});

test("an unquoted goal halts at init, names the leftover words and writes nothing", () => {
  for (const args of [
    ["--goal", "fix", "the", "bug"],
    ["--goal", "fix", "the", "--rigor", "standard"],
    ["--goal", "fix", "--_", "the", "bug"],
    ["--rigor", "standard", "extra", "--goal", "fix"],
  ]) {
    const project = makeProject();
    const res = run(project, ["init", project.id, ...args]);
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /Unexpected argument\(s\) after the flags: .*Quote the goal: --goal "<text>"\. Nothing was written\./);
    assert.equal(fs.existsSync(project.agentDir), false);
  }
  const project = makeProject();
  const res = run(project, ["init", project.id, "--goal", "fix", "the", "bug"]);
  assert.match(res.json.reason, /flags: the bug\./);
});

test("an argument with no flag name is a leftover word and swallows no word after it", () => {
  for (const [args, words] of [
    [["--goal", "fix", "--_", "the", "bug"], "--_ the bug"],
    [["--goal", "fix", "--", "the", "bug"], "-- the bug"],
    [["--goal", "fix", "--=x", "the"], "--=x the"],
    [["--goal", "fix", "--_=x", "the"], "--_=x the"],
  ]) {
    const project = makeProject();
    const res = run(project, ["init", project.id, ...args]);
    assert.equal(res.status, 1);
    assert.ok(res.json.reason.startsWith(`Unexpected argument(s) after the flags: ${words}. `), res.json.reason);
    assert.equal(fs.existsSync(project.agentDir), false);
  }
});

test("a flag init does not read halts at init, is named and writes nothing", () => {
  for (const [args, names] of [
    [["--gaol", "fix the bug"], "--gaol"],
    [["--goal", "fix", "--report"], "--report"],
    [["--goal", "fix", "--__proto__", "the", "--constructor", "bug"], "--__proto__, --constructor"],
  ]) {
    const project = makeProject();
    const res = run(project, ["init", project.id, ...args]);
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.ok(res.json.reason.startsWith(`Unknown flag(s) for init: ${names}. init reads: --goal, --rigor, --archive, --chrome, --chain, --host, --pr-comment. Nothing was written.`), res.json.reason);
    assert.equal(fs.existsSync(project.agentDir), false);
  }
});

test("--goal=<text> stores the text after the first =", () => {
  const project = makeProject();
  assert.equal(run(project, ["init", project.id, "--goal=--retries=3 should back off", "--rigor=standard", "--archive=false"]).status, 0);
  const meta = readMetaFile(project);
  assert.equal(meta.goal, "--retries=3 should back off");
  assert.equal(meta.rigor.level, "standard");
  assert.notEqual(meta.archive, true);
});

test("--goal=<text> takes no following word: an unquoted rest halts and an empty value keeps the stored goal", () => {
  const project = makeProject();
  const res = run(project, ["init", project.id, "--goal=fix", "the", "bug"]);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /Unexpected argument\(s\) after the flags: the bug\./);
  assert.equal(fs.existsSync(project.agentDir), false);
  init(project, "first goal");
  writeLog(project, []);
  assert.equal(run(project, ["init", project.id, "--goal="]).status, 0);
  assert.equal(readMetaFile(project).goal, "first goal");
});

test("the --key=value form works for the other commands and the openspec chain", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeLog(project, [entry(1, "plan", { result: { status: "done" } })]);
  const res = run(project, ["usage", project.id, "1", "--tokens=5"]);
  assert.equal(res.json.attached, true);
  assert.equal(res.json.usage.totalTokens, 5);
  assert.equal(run(project, ["status", project.id, "--chain=nope"]).status, 1);
  const os = makeOpenspecProject();
  assert.equal(run(os, ["init", os.id, "--chain=openspec", "--goal=fix the bug"]).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(os.agentDir, "meta.json"), "utf8")).chain, "openspec");
});

test("a quoted goal followed by another flag still works", () => {
  const project = makeProject();
  assert.equal(init(project, "fix the bug", ["--rigor", "standard"]).status, 0);
  assert.equal(readMetaFile(project).goal, "fix the bug");
  assert.equal(readMetaFile(project).rigor.level, "standard");
});

test("a bare or empty --goal on a resume keeps the stored goal", () => {
  const project = makeProject();
  init(project, "first goal");
  writeLog(project, []);
  assert.equal(run(project, ["init", project.id, "--goal"]).status, 0);
  assert.equal(readMetaFile(project).goal, "first goal");
  writeLog(project, []);
  assert.equal(init(project, "").status, 0);
  assert.equal(readMetaFile(project).goal, "first goal");
});

test("--goal --archive stores --archive as the goal and leaves archive off", () => {
  const project = makeProject();
  assert.equal(run(project, ["init", project.id, "--goal", "--archive"]).status, 0);
  const meta = readMetaFile(project);
  assert.equal(meta.goal, "--archive");
  assert.notEqual(meta.archive, true);
});

test("usage still reads its positional step number", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeLog(project, [entry(1, "plan", { result: { status: "done" } })]);
  const res = run(project, ["usage", project.id, "1", "--tokens", "5"]);
  assert.equal(res.json.attached, true);
  assert.equal(res.json.n, 1);
});

test("the leftover-word halt applies to the openspec chain too", () => {
  const project = makeOpenspecProject();
  const res = run(project, ["init", project.id, "--chain", "openspec", "--goal", "fix", "the", "bug"]);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /Unexpected argument\(s\) after the flags: the bug\./);
  assert.equal(fs.existsSync(project.agentDir), false);
});

// ---- missing change.md ----------------------------------------------------------

test("init and next without change.md halt and write nothing (missing change.md)", () => {
  const project = makeProject({ change: false });
  for (const res of [init(project, "x"), next(project)]) {
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /No change folder\. Run \/10x-new demo first\./);
    assert.equal(fs.existsSync(project.agentDir), false);
  }
});

// Every other command, for a change folder without change.md and for an id with no folder at all.
test("status, risk, usage, verify-archive and compare write nothing without change.md (missing change.md)", () => {
  const project = makeProject({ change: false });
  const tree = () => fs.readdirSync(path.join(project.root, "context"), { recursive: true }).sort();
  const before = tree();
  for (const id of ["demo", "nosuch"]) {
    const report = run(project, ["status", id, "--report"]);
    assert.equal(report.status, 1, report.stdout + report.stderr);
    assert.equal(report.json.action, "halt");
    assert.equal(report.json.reason, `No change folder. Run /10x-new ${id} first.`);
    const status = run(project, ["status", id]);
    assert.equal(status.status, 0, status.stdout + status.stderr);
    assert.deepEqual(status.json.steps, []);
    for (const args of [["risk", id], ["usage", id, "1", "--tokens", "5"], ["verify-archive", id],
      ["compare", id, "--baseline", project.root]]) {
      const res = run(project, args);
      assert.ok(res.json, `${args[0]} ${id}: ${res.stdout}${res.stderr}`);
      assert.deepEqual(tree(), before, `${args[0]} ${id} wrote a file`);
    }
    assert.deepEqual(tree(), before, `status ${id} wrote a file`);
  }
});
