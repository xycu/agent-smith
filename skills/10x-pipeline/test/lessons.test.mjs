// Lesson candidates: the sanitizer of signals.lessonCandidates, driven through the real CLI in scratch projects.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, init, next, writeResult, readLogEntries,
} from "./helpers.mjs";

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
