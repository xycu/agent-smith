// OpenSpec chain, Phase 3 (ADR-013 D4, D9, D10): each os- step is verified by the file it writes, the verify.md
// verdict ends the run or starts a fix loop of at most limits.maxFixLoops, the four step tiers, the features the chain
// drops, and the budget of the longest failure-free path.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupAll, run, writeResult, readLogEntries, readMetaFile, readReportFile, ruleTail } from "../../10x-pipeline/test/helpers.mjs";
import { makeOpenspecProject, writeArtifacts, writeVerify, initOpenspec } from "./openspec-helpers.mjs";
import { pluginPolicy } from "../../10x-pipeline/scripts/state.mjs";
import { readVerdict } from "../scripts/openspec.mjs";
import { removeTree } from "../../10x-pipeline/scripts/remove-tree.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = pluginPolicy();
const APPLY_GUIDE = fs.readFileSync(path.join(SKILL_DIR, "prompts/os-apply.md"), "utf8");

const GOAL = "Add a thing";
const PROPOSED = { proposal: true, specs: 1, tasks: { done: 0, open: 2 } };
const TICKED = { proposal: true, specs: 1, tasks: { done: 2, open: 0 } };
const VERIFY_FILE = "openspec/changes/demo/agent-smith/verify.md";
const CAP_HALT = `OpenSpec verify FAIL after 2 fix loops. Needs a human. Fix the issues, set the first lines of ${VERIFY_FILE} to "Verdict: PASS" and "Critical: 0", then run /agent-smith:openspec-pipeline demo again.`;

// A verify.md as the os-verify guide writes it. The counts default to the number of lines.
function verifyText({ verdict = "PASS", critical = [], warnings = [], criticalCount = critical.length, warningCount = warnings.length } = {}) {
  return [
    `Verdict: ${verdict}`,
    `Critical: ${criticalCount}`,
    `Warnings: ${warningCount}`,
    "",
    "## Critical",
    "",
    ...critical.map((line) => `- ${line}`),
    "",
    "## Warnings",
    "",
    ...warnings.map((line) => `- ${line}`),
    "",
    "## Report",
    "",
    "- not a critical line",
    "",
  ].join("\n");
}
const PASS = verifyText();
const FAIL = (lines = ["src/app.js:3 crashes on empty input - guard it"]) => verifyText({ verdict: "FAIL", critical: lines });

const next = (project) => run(project, ["next", project.id]);
// Answers the step in flight with `result`, after `before` wrote its files, and returns the next router output.
function answer(project, result, before = () => {}) {
  before();
  writeResult(project, result);
  const res = next(project);
  assert.ok(res.json, res.stdout + res.stderr);
  return res;
}
const done = (note = "ok") => ({ status: "done", note });
const pastMs = () => Date.now() - 60_000;
const backdate = (file) => fs.utimesSync(file, pastMs() / 1000, pastMs() / 1000);

// A run of a fully ticked change, at its first os-verify step.
function atVerify(extra = {}) {
  const project = makeOpenspecProject({ ...TICKED, ...extra });
  const res = initOpenspec(project, GOAL);
  assert.equal(res.json.step, "os-verify", res.stdout);
  return project;
}

// ---- verification ---------------------------------------------------------------

test("os-propose that ends done without new artifact files fails and runs again", () => {
  const project = makeOpenspecProject();
  assert.equal(initOpenspec(project, GOAL).json.step, "os-propose");
  const res = answer(project, done("proposed"));
  assert.equal(res.json.step, "os-propose", res.stdout);
  const [first] = readLogEntries(project);
  assert.equal(first.verified, false);
  assert.equal(first.ok, false);
  assert.match(readLogEntries(project)[1].tierWhy, /\+1 for 1 failed attempt/);
});

test("os-propose whose artifact files are all older than the step start fails", () => {
  const project = makeOpenspecProject();
  assert.equal(initOpenspec(project, GOAL).json.step, "os-propose");
  const res = answer(project, done(), () => {
    writeArtifacts(project, PROPOSED);
    const files = ["proposal.md", "tasks.md", "specs/cap-1/spec.md"].map((f) => path.join(project.changeDir, f));
    for (const file of files) backdate(file);
  });
  assert.equal(readLogEntries(project)[0].ok, false);
  // Planning is complete on disk, so the next step is os-apply.
  assert.equal(res.json.step, "os-apply", res.stdout);
});

test("os-propose that writes the planning files is verified", () => {
  const project = makeOpenspecProject();
  initOpenspec(project, GOAL);
  const res = answer(project, done(), () => writeArtifacts(project, PROPOSED));
  assert.equal(readLogEntries(project)[0].ok, true);
  assert.equal(res.json.step, "os-apply");
});

test("os-apply with no new tick fails, and three failures in a row halt", () => {
  const project = makeOpenspecProject(PROPOSED);
  assert.equal(initOpenspec(project, GOAL).json.step, "os-apply");
  for (let n = 1; n <= 2; n++) {
    const res = answer(project, done("did nothing"));
    assert.equal(res.json.step, "os-apply", res.stdout);
    assert.equal(readLogEntries(project)[n - 1].ok, false);
  }
  const res = answer(project, done("did nothing"));
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /^os-apply failed 3 times in a row/);
  assert.equal(readLogEntries(project).length, 3);
});

test("os-apply is verified by more ticks than at its start; open rows run it again", () => {
  const project = makeOpenspecProject({ ...PROPOSED, tasks: { done: 0, open: 3 } });
  initOpenspec(project, GOAL);
  const res = answer(project, done(), () => writeArtifacts(project, { tasks: { done: 1, open: 2 } }));
  assert.equal(readLogEntries(project)[0].ok, true);
  assert.equal(res.json.step, "os-apply");
  assert.deepEqual(readLogEntries(project)[1].before, { ticks: 1 });
  const verify = answer(project, done(), () => writeArtifacts(project, { tasks: { done: 3, open: 0 } }));
  assert.equal(verify.json.step, "os-verify");
});

test("a missing, stale or malformed verify.md fails the os-verify step", () => {
  const cases = [
    ["missing", () => {}],
    ["stale", (project) => { writeVerify(project, PASS); backdate(path.join(project.agentDir, "verify.md")); }],
    ["bad verdict", (project) => writeVerify(project, "Verdict: MAYBE\nCritical: 0\nWarnings: 0\n")],
    ["lower case", (project) => writeVerify(project, "verdict: PASS\nCritical: 0\nWarnings: 0\n")],
    ["bad count", (project) => writeVerify(project, "Verdict: PASS\nCritical: none\nWarnings: 0\n")],
    ["swapped counts", (project) => writeVerify(project, "Verdict: PASS\nWarnings: 0\nCritical: 0\n")],
    ["blank first line", (project) => writeVerify(project, "\nVerdict: PASS\nCritical: 0\nWarnings: 0\n")],
    ["symlink", (project) => {
      const real = path.join(project.root, "real-verify.md");
      fs.writeFileSync(real, PASS);
      fs.mkdirSync(project.agentDir, { recursive: true });
      fs.symlinkSync(real, path.join(project.agentDir, "verify.md"));
    }],
  ];
  for (const [name, write] of cases) {
    const project = atVerify();
    const res = answer(project, done("verified"), () => write(project));
    const [first] = readLogEntries(project);
    assert.equal(first.ok, false, name);
    assert.equal(first.verified, false, name);
    assert.equal(Object.hasOwn(first, "review"), false, name);
    assert.equal(res.json.step, "os-verify", `${name}: ${res.stdout}`);
  }
});

test("PASS and PASS WITH WARNINGS end the run done", () => {
  for (const [text, verdict] of [[PASS, "PASS"], [verifyText({ verdict: "PASS WITH WARNINGS", warnings: ["naming"] }), "PASS WITH WARNINGS"]]) {
    const project = atVerify();
    const res = answer(project, done(), () => writeVerify(project, text));
    assert.equal(res.json.action, "done", res.stdout);
    assert.equal(res.json.reason, `OpenSpec verify ${verdict}`);
    assert.equal(res.json.report, "openspec/changes/demo/agent-smith/report.md");
    assert.equal(readMetaFile(project).outcome.action, "done");
    assert.equal(readLogEntries(project)[0].review.verdict, verdict);
  }
});

test("a PASS line with Critical: 1 routes as FAIL", () => {
  const project = atVerify();
  const res = answer(project, done(), () => writeVerify(project, verifyText({ verdict: "PASS", critical: ["tests do not run"] })));
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "os-apply");
  assert.deepEqual(readLogEntries(project)[0].review, { verdict: "FAIL", critical: 1, warnings: 0 });
  assert.equal(readLogEntries(project)[1].template, "os-apply-fix");
  assert.ok(res.json.prompt.includes("\n- tests do not run\n"), res.json.prompt);
});

test("FAIL returns os-apply in fix mode with the critical lines in the prompt", () => {
  const project = atVerify();
  const lines = ["src/a.js:1 null deref - add a guard", "spec scenario 2 not implemented - implement it"];
  const res = answer(project, done(), () => writeVerify(project, verifyText({ verdict: "FAIL", critical: lines, warnings: ["style"] })));
  assert.equal(res.json.step, "os-apply", res.stdout);
  assert.match(res.json.reason, /OpenSpec verify FAIL \(2 critical, 1 warnings\): fix loop 1 of 2/);
  const e = readLogEntries(project)[1];
  assert.equal(e.step, "os-apply");
  assert.equal(e.template, "os-apply-fix");
  assert.equal(e.skill, POLICY.steps["os-apply"].skill);
  const prompt = res.json.prompt;
  assert.ok(prompt.startsWith(
    "Run /openspec-apply-change for the OpenSpec change demo (openspec/changes/demo/) in fix mode. " +
    `Critical findings from ${VERIFY_FILE}:\n- ${lines[0]}\n- ${lines[1]}\n`), prompt);
  assert.equal(prompt.includes("not a critical line"), false);
  assert.equal(prompt.includes("- style"), false);
  const fixRule = APPLY_GUIDE.split("\n").find((line) => line.includes("(fix mode)"));
  assert.ok(prompt.includes(fixRule.replaceAll("{id}", "demo")));
  assert.ok(prompt.endsWith("\n\n" + ruleTail(POLICY.prompts.suffix, { chain: "openspec", step: "os-apply" })));
});

test("a FAIL with no critical line sends see verify.md", () => {
  const project = atVerify();
  const res = answer(project, done(), () => writeVerify(project, verifyText({ verdict: "FAIL", warnings: ["w"] })));
  assert.equal(res.json.step, "os-apply", res.stdout);
  assert.ok(res.json.prompt.includes(`Critical findings from ${VERIFY_FILE}:\nsee verify.md\n`), res.json.prompt);
});

test("the critical lines are capped at 20, made one line and cut to 300 code points", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as-verdict-"));
  try {
    const file = path.join(dir, "verify.md");
    const long = "é".repeat(400);
    const critical = [`a\tb   c`, long, ...Array.from({ length: 30 }, (_, i) => `issue ${i}`)];
    fs.writeFileSync(file, verifyText({ verdict: "FAIL", critical }).replace(/\n/g, "\r\n"));
    const read = readVerdict(file);
    assert.equal(read.ok, true);
    assert.equal(read.verdict, "FAIL");
    assert.equal(read.critical, 32);
    assert.equal(read.criticalLines.length, 20);
    assert.equal(read.criticalLines[0], "- a b c");
    assert.equal(Array.from(read.criticalLines[1]).length, 300);
    assert.equal(read.criticalLines[19], "- issue 17");
    // The section ends at the next ## heading; a ### heading does not end it.
    fs.writeFileSync(file, "Verdict: FAIL\nCritical: 2\nWarnings: 0\n## Critical\n- one\n### Detail\n- two\n## Other\n- three\n");
    assert.deepEqual(readVerdict(file).criticalLines, ["- one", "- two"]);
    assert.equal(readVerdict(path.join(dir, "missing.md")).ok, false);
  } finally {
    removeTree(dir);
  }
});

test("a critical line under a lower Critical count reads as FAIL with the larger count", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as-verdict-"));
  try {
    const file = path.join(dir, "verify.md");
    fs.writeFileSync(file, "Verdict: PASS\nCritical: 0\nWarnings: 0\n## Critical\n- real bug at a.js:1\n## Warnings\n");
    const read = readVerdict(file);
    assert.equal(read.ok, true);
    assert.equal(read.verdict, "FAIL");
    assert.equal(read.critical, 1);
    assert.deepEqual(read.criticalLines, ["- real bug at a.js:1"]);
    // Empty sections keep the header verdict, and a header count above the lines stays.
    fs.writeFileSync(file, "Verdict: PASS WITH WARNINGS\nCritical: 0\nWarnings: 1\n## Critical\n## Warnings\n- w\n");
    assert.equal(readVerdict(file).verdict, "PASS WITH WARNINGS");
    fs.writeFileSync(file, "Verdict: FAIL\nCritical: 3\nWarnings: 0\n## Critical\n- one\n## Warnings\n");
    assert.equal(readVerdict(file).critical, 3);
  } finally {
    removeTree(dir);
  }
});

test("a third FAIL after two fix loops halts; a verify.md edited to PASS after the halt routes to done", () => {
  const project = atVerify();
  let res = answer(project, done(), () => writeVerify(project, FAIL()));
  for (let loop = 1; loop <= 2; loop++) {
    assert.equal(res.json.step, "os-apply", res.stdout);
    res = answer(project, done("fixed"));
    assert.equal(res.json.step, "os-verify", res.stdout);
    assert.match(res.json.reason, /verify again after step \d+ \(os-apply-fix\)/);
    res = answer(project, done(), () => writeVerify(project, FAIL()));
  }
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal(res.json.reason, CAP_HALT);
  assert.equal(res.status, 0);
  assert.equal(res.json.steps, 5);
  // The human fixes the code and edits the verdict; the router reads the file, not the log copy.
  writeVerify(project, PASS);
  const again = next(project);
  assert.equal(again.json.action, "done", again.stdout);
  assert.equal(again.json.reason, "OpenSpec verify PASS");
  assert.equal(readLogEntries(project).length, 5);
});

test("a verified os-verify whose verify.md is gone or broken at decision time halts with its path", () => {
  const project = atVerify();
  assert.equal(answer(project, done(), () => writeVerify(project, PASS)).json.action, "done");
  fs.writeFileSync(path.join(project.agentDir, "verify.md"), "garbage\n");
  const res = next(project);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, new RegExp(`^The OpenSpec verify verdict cannot be read from ${VERIFY_FILE}: line 1 `));
  fs.rmSync(path.join(project.agentDir, "verify.md"));
  assert.match(next(project).json.reason, new RegExp(`cannot be read from ${VERIFY_FILE}: missing or unreadable`));
});

test("a failed fix step runs again in fix mode", () => {
  const project = atVerify();
  answer(project, done(), () => writeVerify(project, FAIL()));
  const res = answer(project, { status: "failed", note: "tests still red" });
  assert.equal(res.json.step, "os-apply", res.stdout);
  const e = readLogEntries(project);
  assert.equal(e[1].ok, false);
  assert.equal(e[2].template, "os-apply-fix");
  assert.match(e[2].tierWhy, /\+1 for 1 failed attempt/);
});

test("the review field shows in status and report.md", () => {
  const project = atVerify();
  answer(project, done(), () => writeVerify(project, verifyText({ verdict: "FAIL", critical: ["x"], warnings: ["y", "z"] })));
  const st = run(project, ["status", "demo"]);
  assert.equal(st.status, 0, st.stdout);
  assert.deepEqual(st.json.steps[0].review, { verdict: "FAIL", critical: 1, warnings: 2 });
  assert.equal(Object.hasOwn(st.json.steps[1], "review"), false);
  const rep = run(project, ["status", "demo", "--report"]);
  assert.equal(rep.status, 0, rep.stdout);
  const report = readReportFile(project);
  assert.match(report, /^## Review findings$/m);
  assert.match(report, /^- step 1 os-verify: FAIL, 1 critical, 2 warnings measured$/m);
});

test("signals.needsHuman halts and signals.rigor raises the level", () => {
  const blocked = makeOpenspecProject(PROPOSED);
  initOpenspec(blocked, GOAL);
  const res = answer(blocked, { status: "blocked", note: "unclear", signals: { needsHuman: "task 1.1 is unclear" } });
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal(res.json.reason, "Step 1 (os-apply) needs a human: task 1.1 is unclear");

  const risky = makeOpenspecProject(PROPOSED);
  initOpenspec(risky, GOAL);
  assert.equal(readMetaFile(risky).rigor.level, "lean");
  const up = answer(risky, { status: "done", note: "ok", signals: { rigor: "thorough" } }, () => writeArtifacts(risky, { tasks: { done: 2, open: 0 } }));
  assert.equal(up.json.step, "os-verify", up.stdout);
  assert.equal(readMetaFile(risky).rigor.level, "thorough");
  assert.equal(readLogEntries(risky)[1].rigor, "thorough");
});

// ---- tiers and dropped features ------------------------------------------------------

test("the four os- steps carry the tiers of plan, implement, impl-review and archive", () => {
  const pairs = { "os-propose": "plan", "os-apply": "implement", "os-verify": "impl-review", "os-archive": "archive" };
  const pick = ({ baseTier, minTier, maxTier, interactive }) => ({ baseTier, minTier, maxTier, interactive: interactive === true });
  for (const [step, like] of Object.entries(pairs)) assert.deepEqual(pick(POLICY.steps[step]), pick(POLICY.steps[like]), step);
});

test("the tierWhy of the first os-propose starts with base 5", () => {
  const project = makeOpenspecProject();
  initOpenspec(project, GOAL);
  assert.match(readLogEntries(project)[0].tierWhy, /^base 5/);
});

test("with the score, manual-verify and thorough rigor on, an OpenSpec run never returns a dropped step or template", () => {
  const project = makeOpenspecProject({ policy: { score: { minRigor: "standard" }, manualVerify: { minRigor: "lean" } } });
  const outputs = [initOpenspec(project, GOAL, ["--rigor", "thorough"])];
  const steps = [
    () => writeArtifacts(project, PROPOSED),
    () => writeArtifacts(project, { tasks: { done: 2, open: 0 } }),
    () => writeVerify(project, FAIL()),
    () => {},
    () => writeVerify(project, PASS),
  ];
  for (const before of steps) outputs.push(answer(project, done(), before));
  const last = outputs[outputs.length - 1];
  assert.equal(last.json.action, "done", last.stdout);
  assert.equal(readMetaFile(project).rigor.level, "thorough");
  const log = readLogEntries(project);
  assert.deepEqual(log.map((e) => e.template), ["os-propose", "os-apply", "os-verify", "os-apply-fix", "os-verify"]);
  const dropped = ["score", "research", "domain-brief", "frame", "manual-verify", "implement-e2e", "implement-tdd", "implement-segment", "implement-retry"];
  for (const e of log) {
    assert.equal(dropped.includes(e.step), false, e.step);
    assert.equal(dropped.includes(e.template), false, e.template);
    assert.equal(e.skipped, undefined, "no skip entry");
  }
  for (const res of outputs.filter((r) => r.json.action === "run")) assert.match(res.json.step, /^os-/);
});

// ---- budget ------------------------------------------------------------------------

test("the 7-step path with two FAIL verdicts halts on the fix-loop cap, not on the lean budget of 12", () => {
  const project = makeOpenspecProject();
  assert.equal(initOpenspec(project, GOAL).json.step, "os-propose");
  let res = answer(project, done(), () => writeArtifacts(project, PROPOSED));
  res = answer(project, done(), () => writeArtifacts(project, { tasks: { done: 2, open: 0 } }));
  for (let i = 0; i < 2; i++) {
    assert.equal(res.json.step, "os-verify", res.stdout);
    res = answer(project, done(), () => writeVerify(project, FAIL()));
    assert.equal(res.json.step, "os-apply", res.stdout);
    res = answer(project, done("fixed"));
  }
  assert.equal(res.json.step, "os-verify", res.stdout);
  res = answer(project, done(), () => writeVerify(project, FAIL()));
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal(res.json.reason, CAP_HALT);
  assert.equal(res.json.steps, 7);
  const meta = readMetaFile(project);
  assert.equal(meta.rigor.level, "lean");
  assert.equal(POLICY.limits.maxTotalSteps + POLICY.rigor.budgetDelta.lean, 12);
  assert.ok(readLogEntries(project).every((e) => e.ok === true));
});
