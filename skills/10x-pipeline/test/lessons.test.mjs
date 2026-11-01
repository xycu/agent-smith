// Lesson candidates: the sanitizer of signals.lessonCandidates, driven through the real CLI in scratch projects.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, init, next, run, writeResult, readLogEntries,
  writeLog, writeMetaFile, readReportFile, entry, skipEntry, gitInit, commitFiles, gitEnv, gitAvailable,
} from "./helpers.mjs";
import { pendingEntry } from "./phase-helpers.mjs";

after(cleanupAll);

// A project whose first step is an impl-review (plan done, plan review saved). Returns the project after
// the review file was written; `result` is the RESULT the subagent reports.
function reviewProject(result, { policy = null, goal = "fix typo" } = {}) {
  const project = makeProject({ plan: planText({ done: 1 }), policy });
  writeReview(project, "plan-review");
  init(project, goal);
  assert.equal(readLogEntries(project)[0].step, "impl-review");
  writeReview(project, "impl-review");
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(project.changeDir, "reviews/impl-review.md"), later, later);
  writeResult(project, { status: "done", note: "reviewed", ...result });
  return project;
}

// Runs `next` and returns the signals stored on the impl-review entry.
function candidatesOf(signals, opts) {
  const project = reviewProject({ signals }, opts);
  const res = next(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return { project, entry: readLogEntries(project)[0] };
}

const lessons = (signals, opts) => candidatesOf({ lessonCandidates: signals }, opts).entry.signals?.lessonCandidates;

test("a valid list is kept in order", () => {
  assert.deepEqual(lessons(["Always A.", "Never B."]), ["Always A.", "Never B."]);
});

test("more than the cap keeps the first three", () => {
  assert.deepEqual(lessons(["one", "two", "three", "four", "five"]), ["one", "two", "three"]);
});

test("an over-long item is cut on the last space", () => {
  const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const [cut] = lessons([long]);
  assert.ok(Array.from(cut).length <= 200);
  assert.ok(long.startsWith(cut));
  assert.match(long.slice(cut.length), /^ /);
  assert.ok(Array.from(cut).length > 150);
});

test("an over-long single word is cut at the limit", () => {
  const [cut] = lessons(["x".repeat(500)]);
  assert.equal(cut, "x".repeat(200));
});

test("an item that fits exactly is kept whole; a cut at a space drops nothing else", () => {
  const exact = "a".repeat(200);
  assert.deepEqual(lessons([exact]), [exact]);
  const atSpace = `${"a".repeat(199)} bbb`;
  assert.deepEqual(lessons([atSpace]), ["a".repeat(199)]);
});

test("an emoji across the cut never leaves a lone surrogate", () => {
  const text = `${"a".repeat(199)}\u{1F600}\u{1F600}`;
  const [cut] = lessons([text]);
  assert.equal(Array.from(cut).length, 200);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(cut));
  const { project } = candidatesOf({ lessonCandidates: [text] });
  const raw = fs.readFileSync(path.join(project.agentDir, "run.jsonl"), "utf8");
  // JSON.stringify escapes a lone surrogate as \udXXX; a whole pair is written as the character.
  assert.ok(!/\\ud[89a-f][0-9a-f]{2}/i.test(raw));
});

test("newline, backtick, control character and bidi override are cleaned", () => {
  const [seed] = lessons(["Always\nuse `x`\u0007 and\t‮y"]);
  assert.equal(seed, "Always use 'x' and y");
});

test("non-array, non-string, empty and repeated items are dropped", () => {
  assert.equal(lessons("Always A."), undefined);
  assert.equal(lessons({ 0: "Always A." }), undefined);
  assert.equal(lessons([]), undefined);
  assert.equal(lessons([1, null, {}, ["x"], "", "   ", "‮"]), undefined);
  assert.deepEqual(lessons([1, "Always A.", "always a.", "  ALWAYS   A.  ", "Never B."]), ["Always A.", "Never B."]);
});

test("the key on a plan result is dropped", () => {
  const project = makeProject();
  init(project, "fix typo");
  writePlan(project, planText());
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned", signals: { lessonCandidates: ["Always A."] } });
  assert.equal(next(project).status, 0);
  const first = readLogEntries(project)[0];
  assert.equal(first.step, "plan");
  assert.equal(first.signals, undefined);
});

test("other signal keys behave as before on an impl-review entry", () => {
  const { entry } = candidatesOf({ rigor: "standard", needsHuman: "  two\n words ", lessonCandidates: ["Always A."], foo: 1 });
  assert.deepEqual(entry.signals, { rigor: "standard", needsHuman: "two words", lessonCandidates: ["Always A."] });
});

test("an impl-review result with no signals leaves no signals on the entry", () => {
  const project = reviewProject({});
  assert.equal(next(project).status, 0);
  assert.equal(readLogEntries(project)[0].signals, undefined);
});

test("run.jsonl holds no raw signals and no key other than the three", () => {
  const { entry } = candidatesOf({ foo: "bar", lessonCandidates: ["Always A."], other: [1] });
  assert.equal(entry.result.signals, undefined);
  assert.deepEqual(Object.keys(entry.signals), ["lessonCandidates"]);
  assert.equal(entry.result.foo, undefined);
});

test("a policy override of maxCandidates and maxChars applies", () => {
  const policy = { lessons: { maxCandidates: 2, maxChars: 20 } };
  assert.deepEqual(lessons(["one", "two", "three"], { policy }), ["one", "two"]);
  assert.deepEqual(lessons(["alpha beta gamma delta epsilon"], { policy }), ["alpha beta gamma"]);
});

test("an invalid override falls back to the defaults", () => {
  for (const bad of [0, -1, "5", 1.5, null, Number.MAX_SAFE_INTEGER + 2]) {
    const policy = { lessons: { maxCandidates: bad, maxChars: bad } };
    assert.deepEqual(lessons(["a", "b", "c", "d"], { policy }), ["a", "b", "c"], String(bad));
    assert.equal(Array.from(lessons(["x".repeat(500)], { policy })[0]).length, 200, String(bad));
  }
});

// ---- report section ----------------------------------------------------------

const HEADING = "## Lesson candidates";
const noGit = !gitAvailable();

// A finished-review project built from a hand-made log: plan, plan-review, implement, then the given extra entries.
function logProject(extra, { archive = false } = {}) {
  const project = makeProject({ plan: planText({ done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), `---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n`);
  writeReview(project, "plan-review");
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), ...extra]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", ...(archive ? { archive: true } : {}) });
  return project;
}

const withLessons = (n, list, over = {}) => entry(n, "impl-review", { signals: { lessonCandidates: list }, ...over });

function statusReport(project) {
  const res = run(project, ["status", project.id, "--report"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return readReportFile(project);
}

test("a run that ends done lists the candidates with the step number", () => {
  const project = logProject([withLessons(4, ["Always A.", "Never B."])]);
  const res = next(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "done");
  const report = readReportFile(project);
  assert.ok(report.includes(`${HEADING}\n\nCandidates from the implementation review. Run a command yourself; the pipeline never runs \`/10x-lesson\`.\n\n- \`/10x-lesson Always A.\` (step 4)\n- \`/10x-lesson Never B.\` (step 4)`), report);
});

test("an overlapping candidate in two reviews shows once, with the first step number", () => {
  const project = logProject([withLessons(4, ["Always A."]), entry(5, "fix"), withLessons(6, ["always a.", "Never B."])]);
  const report = statusReport(project);
  assert.equal(report.split("/10x-lesson Always A.").length - 1, 1);
  assert.match(report, /- `\/10x-lesson Always A\.` \(step 4\)/);
  assert.match(report, /- `\/10x-lesson Never B\.` \(step 6\)/);
});

test("two reviews with three distinct candidates each list all six", () => {
  const project = logProject([withLessons(4, ["a1", "a2", "a3"]), entry(5, "fix"), withLessons(6, ["b1", "b2", "b3"])]);
  const report = statusReport(project);
  assert.equal(report.match(/^- `\/10x-lesson /gm).length, 6);
});

test("a failed review contributes nothing", () => {
  const project = logProject([withLessons(4, ["Always A."], { ok: false })]);
  assert.ok(!statusReport(project).includes("Lesson candidates"));
});

test("a step other than impl-review contributes nothing", () => {
  const project = logProject([entry(4, "fix", { signals: { lessonCandidates: ["Always A."] } })]);
  assert.ok(!statusReport(project).includes("Lesson candidates"));
});

test("no candidates gives a report without any Lesson candidates text", () => {
  const project = logProject([entry(4, "impl-review", { signals: { rigor: "standard" } })]);
  assert.ok(!statusReport(project).includes("Lesson candidates"));
  const bare = logProject([entry(4, "impl-review")]);
  assert.ok(!statusReport(bare).includes("Lesson candidates"));
});

test("the section follows the skipped-steps section", () => {
  const project = logProject([skipEntry("research", 3), withLessons(4, ["Always A."])]);
  const report = statusReport(project);
  assert.ok(report.indexOf("## Skipped steps") > 0);
  assert.ok(report.indexOf(HEADING) > report.indexOf("## Skipped steps"));
});

test("status --report rewrites the section for a run in progress", () => {
  const project = logProject([withLessons(4, ["Always A."])]);
  const report = statusReport(project);
  assert.match(report, /^Outcome: not ended$/m);
  assert.match(report, /- `\/10x-lesson Always A\.` \(step 4\)/);
});

test("a halt report keeps the section", () => {
  const project = logProject([withLessons(4, ["Always A."]), pendingEntry(5, "fix")]);
  writeResult(project, { status: "blocked", note: "stop", signals: { needsHuman: "Which one?" } });
  const res = next(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /needs a human/);
  assert.match(readReportFile(project), /- `\/10x-lesson Always A\.` \(step 4\)/);
});

test("an --archive run has the section in the report before the archive action", { skip: noGit }, () => {
  const project = logProject([withLessons(4, ["Always A."])], { archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "archive");
  assert.match(readReportFile(project), /- `\/10x-lesson Always A\.` \(step 4\)/);
});

test("candidate text goes through oneLine like other report text", () => {
  const project = logProject([withLessons(4, ["Always  A\n  B."])]);
  assert.match(statusReport(project), /- `\/10x-lesson Always A B\.` \(step 4\)/);
});

// ---- prompt wiring -------------------------------------------------------------

const POLICY = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));

function assertLessonRules(prompt, max, chars) {
  assert.match(prompt, /\*\*MAY\*\* add `signals\.lessonCandidates`/);
  assert.ok(prompt.includes('"lessonCandidates":['), prompt);
  assert.match(prompt, new RegExp(`an array of at most ${max} strings`));
  assert.match(prompt, new RegExp(`of at most ${chars} characters`));
  assert.match(prompt, /\*\*MUST NOT\*\* run `\/10x-lesson`/);
  assert.doesNotMatch(prompt, /\{lessonMax\}|\{lessonChars\}/);
}

test("the impl-review prompt carries the lesson rules with the default limits", () => {
  const project = makeProject({ plan: planText({ done: 1 }) });
  writeReview(project, "plan-review");
  const res = init(project, "fix typo");
  assert.equal(res.json.step, "impl-review");
  assert.equal(readLogEntries(project)[0].template, "impl-review");
  assertLessonRules(res.json.prompt, 3, 200);
  assert.ok(res.json.prompt.startsWith("Run /10x-impl-review context/changes/demo/plan.md\n"));
});

test("the impl-review prompt fills the overridden limits", () => {
  const project = makeProject({ plan: planText({ done: 1 }), policy: { lessons: { maxCandidates: 2, maxChars: 120 } } });
  writeReview(project, "plan-review");
  const res = init(project, "fix typo");
  assertLessonRules(res.json.prompt, 2, 120);
});

test("the impl-review-warn prompt carries the lesson rules after the warning rules", () => {
  const project = makeProject({ plan: planText({ done: 1 }) });
  writeReview(project, "plan-review");
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement", { uncommitted: ["1.1"] }),
    pendingEntry(4, "implement", { template: "implement-retry", retry: ["1.1"], phase: 1 }),
  ]);
  writeMetaFile(project, { id: "demo", goal: "fix typo" });
  writeResult(project, { status: "blocked", note: "nothing left to change" });
  const res = next(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "impl-review");
  const last = readLogEntries(project).at(-1);
  assert.equal(last.template, "impl-review-warn");
  assert.match(res.json.prompt, /no code commit behind them/);
  assertLessonRules(res.json.prompt, 3, 200);
  assert.ok(res.json.prompt.indexOf("## Rules") < res.json.prompt.indexOf("signals.lessonCandidates"));
});

test("policy wires the lessons file into both review templates", () => {
  assert.equal(POLICY.prompts["impl-review"].at(-1),"@prompts/impl-review-lessons.md");
  assert.equal(POLICY.prompts["impl-review-warn"].at(-1), "@prompts/impl-review-lessons.md");
});
