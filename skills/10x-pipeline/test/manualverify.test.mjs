// phase-executors, phase 5: the manual-verify step and --chrome.
// Black-box through the CLI in scratch projects. Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cleanupAll, makeProject, writePlan, writeReview, init, next, run, writeResult, readLogEntries, readMetaFile, writeMetaFile,
  readReportFile, entry, writeLog, gitInit, git, gitEnv, commitFiles, gitAvailable,
} from "./helpers.mjs";
import { buildPlan, pendingEntry } from "./phase-helpers.mjs";

after(cleanupAll);

const noGit = gitAvailable() ? false : "git is not installed";
const GOAL = "Parse blank lines";
const A = "Run `node --version` and see a version";
const B = "Run `npm --version` and see a version";
const HUMAN = "A reviewer reads the output of `node --version`";
const AUTO = [{ text: "row one", done: true }];

// Rows as the router reads them: Automated rows first, so the Manual ids continue the numbering.
const withId = (specs, offset) => specs.map((s, i) => {
  const row = typeof s === "string" ? { text: s, done: false } : s;
  return { id: `1.${offset + i + 1}`, text: `1.${offset + i + 1} ${row.text}`, done: row.done };
});

const planOf = (manual, auto = AUTO) => buildPlan([{ auto, manual }]);

// A project whose implement step is done: a fresh SOUND plan review, a plan with the Manual rows `manual` and a log.
function mvProject({ manual = [A], log = null, policy = null, auto = AUTO } = {}) {
  const project = makeProject({ plan: planOf(manual, auto), policy });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, log ?? [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
  return project;
}

const start = (project, rigor = "standard", extra = []) => init(project, GOAL, ["--rigor", rigor, ...extra]);
const lastEntry = (project) => readLogEntries(project).at(-1);

// A project with a pending manual-verify entry (step 4) whose baseline is the plan `manual`/`auto`. `over` replaces entry fields.
function verifying({ manual = [A, B], auto = AUTO, chrome = false, over = {} } = {}) {
  const project = mvProject({ manual, auto });
  writeMetaFile(project, { id: project.id, goal: GOAL, rigor: { requested: "standard" }, ...(chrome ? { chrome: true } : {}) });
  const before = { autoDone: 1, head: null, done: ["1.1"], manual: withId(manual, auto.length), auto: withId(auto, 0) };
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    pendingEntry(4, "manual-verify", { template: "manual-verify", before, ...over }),
  ]);
  return project;
}

// Saves the plan as the subagent left it. Each `manual` spec is a string or { text, done }.
const save = (project, manual, auto = AUTO) => writePlan(project, planOf(manual, auto));
const evidence = (project, name, text = "output\n") => {
  const dir = path.join(project.changeDir, "evidence");
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
  return path.join(dir, name);
};
const ticked = (text, token = "evidence/out.txt") => ({ text: token ? `${text} — evidence: ${token}` : text, done: true });

// Reports a result for the pending step, runs `next` and returns the finished entry plus the output.
function finish(project, index = 3, result = { status: "done", note: "x" }) {
  writeResult(project, result);
  const res = next(project);
  return { res, e: readLogEntries(project)[index] };
}

// ---- placement ----------------------------------------------------------------

test("manual verify placement", () => {
  const project = mvProject();
  const res = start(project).json;
  assert.equal(res.step, "manual-verify", JSON.stringify(res));
  const e = lastEntry(project);
  assert.equal(e.template, "manual-verify");
  assert.equal(e.skill, null);
  assert.equal(e.tier, 3);
  assert.deepEqual(e.before.manual, withId([A], 1));
  assert.deepEqual(e.before.auto, withId(AUTO, 0));
  assert.match(res.prompt, /Rows rejected by the router last time: none/);

  // thorough has a pool too; lean has none, so the step never runs there, with or without --chrome.
  assert.equal(start(mvProject(), "thorough").json.step, "manual-verify");
  assert.equal(start(mvProject(), "lean").json.step, "impl-review");
  assert.equal(start(mvProject(), "lean", ["--chrome"]).json.step, "impl-review");
  // A pending Automated row comes first.
  const pending = mvProject({ auto: [{ text: "row one", done: false }] });
  assert.equal(start(pending).json.step, "implement");
  // A pool that is spent keeps the step away.
  const spent = mvProject({ policy: { extraSteps: { allowance: { standard: 0 } } } });
  assert.equal(start(spent).json.step, "impl-review");
});

test("manual verify not repeated", () => {
  // No eligible row: the plan's own Manual row needs a person.
  assert.equal(start(mvProject({ manual: ["Look at it", HUMAN] })).json.step, "impl-review");
  // An ok run takes maxRuns, whatever is still pending.
  const ok = mvProject({ log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "manual-verify", { ticked: [], unproven: [] })] });
  assert.equal(start(ok).json.step, "impl-review");
  // Two attempts that failed take maxAttempts.
  const failed = (n) => entry(n, "manual-verify", { ok: false, verified: false, fallback: true, ticked: [], unproven: [] });
  const two = mvProject({ log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), failed(4), failed(5)] });
  assert.equal(start(two).json.step, "impl-review");
  // One failed attempt leaves a retry.
  const one = mvProject({ log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), failed(4)] });
  assert.equal(start(one).json.step, "manual-verify");
  // A non-positive maxRuns turns the step off.
  assert.equal(start(mvProject({ policy: { manualVerify: { maxRuns: 0 } } })).json.step, "impl-review");
});

test("manual verify before impl review", () => {
  const project = mvProject();
  assert.equal(start(project).json.step, "manual-verify");
  // The finished step changes nothing: zero ticks. Impl-review runs right after it.
  const { res, e } = finish(project);
  assert.equal(e.ok, true);
  assert.equal(res.json.step, "impl-review");
  // A fix after the review does not bring the step back, with an eligible row still pending.
  const fixed = mvProject({
    log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "manual-verify", { ticked: [], unproven: [] }), entry(5, "impl-review"), entry(6, "fix")],
  });
  writeReview(fixed, "impl-review", { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" });
  assert.equal(start(fixed).json.step, "impl-review");
});

// ---- eligibility --------------------------------------------------------------

function eligible(text, chrome = false, level = "standard") {
  const project = mvProject({ manual: [text] });
  return start(project, level, chrome ? ["--chrome"] : []).json.step.startsWith("manual-verify");
}

test("manual verify eligible rows", () => {
  for (const [text, want] of [
    ["Run `node --version`", true],
    ["Run `npm test` and see it pass", true],
    ["Run `NODE --version` and see it", true],
    ["Run `foo --bar` and see it", false],
    ["Run node --version and see it", false],
    [HUMAN, false],
    ["Run `node -e 1` and judge the result", false],
    ["A person runs `node --version`", false],
    ["Look at it", false],
  ]) assert.equal(eligible(text), want, text);
  // A browser row needs --chrome; a human word still wins there.
  assert.equal(eligible("Check that the browser shows the form"), false);
  assert.equal(eligible("Check that the browser shows the form", true), true);
  assert.equal(eligible("A person checks the browser", true), false);
  // A ticked row with a command but a human word is unproven.
  const project = verifying({ manual: [HUMAN] });
  save(project, [ticked(HUMAN)]);
  evidence(project, "out.txt");
  const { e } = finish(project);
  assert.equal(e.ok, false);
  assert.deepEqual(e.unproven, ["1.2"]);
});

test("browser words whole word", () => {
  for (const [text, want] of [
    ["Open the domain list and check it", false],
    ["Open the pages list and check it", false],
    ["Open the page and check the title", true],
    ["Click Save and check the screen", true],
  ]) assert.equal(eligible(text, true), want, text);
  assert.equal(eligible("Open the page and check the title", false), false);
});

// ---- verification -------------------------------------------------------------

test("evidence suffix required", () => {
  const cases = {
    "a valid suffix": { token: "evidence/out.txt", file: "out\n", ok: true },
    "a nested valid name": { token: "evidence/sub/out.txt", file: "out\n", ok: true, name: "sub/out.txt" },
    "no suffix": { token: null, file: "out\n", ok: false },
    "a missing file": { token: "evidence/missing.txt", file: null, ok: false },
    "an empty file": { token: "evidence/out.txt", file: "", ok: false },
    "a .. name": { token: "evidence/../plan.md", file: "out\n", ok: false },
    "an absolute name": { token: "/etc/hosts", file: "out\n", ok: false },
    "a name outside the evidence folder": { token: "plan.md", file: "out\n", ok: false },
  };
  for (const [what, c] of Object.entries(cases)) {
    const project = verifying({ manual: [A] });
    save(project, [ticked(A, c.token)]);
    if (c.file !== null) evidence(project, c.name ?? "out.txt", c.file);
    const { e } = finish(project);
    assert.equal(e.ok, c.ok, what);
    assert.deepEqual(e.ticked, c.ok ? ["1.2"] : [], what);
    assert.deepEqual(e.unproven, c.ok ? [] : ["1.2"], what);
    assert.equal(e.fallback, c.ok ? undefined : true, what);
  }
  // A symlink inside the evidence folder that leaves it fails; one that stays inside passes.
  const out = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-out-"));
  fs.writeFileSync(path.join(out, "secret.txt"), "secret\n");
  const link = verifying({ manual: [A] });
  save(link, [ticked(A, "evidence/link.txt")]);
  fs.mkdirSync(path.join(link.changeDir, "evidence"));
  fs.symlinkSync(path.join(out, "secret.txt"), path.join(link.changeDir, "evidence/link.txt"));
  assert.equal(finish(link).e.ok, false);
  const inside = verifying({ manual: [A] });
  save(inside, [ticked(A, "evidence/link.txt")]);
  evidence(inside, "real.txt");
  fs.symlinkSync(path.join(inside.changeDir, "evidence/real.txt"), path.join(inside.changeDir, "evidence/link.txt"));
  assert.equal(finish(inside).e.ok, true);
  fs.rmSync(out, { recursive: true, force: true });
  // Several rows may share one evidence file.
  const shared = verifying({ manual: [A, B] });
  save(shared, [ticked(A), ticked(B)]);
  evidence(shared, "out.txt");
  const both = finish(shared).e;
  assert.equal(both.ok, true);
  assert.deepEqual(both.ticked, ["1.2", "1.3"]);
});

test("mangled evidence suffix is unproven", () => {
  // A ticked row whose evidence suffix the router cannot read must not vanish: it is a tick without valid evidence.
  const mangled = {
    "a hyphen for the dash": `${A} - evidence: evidence/out.txt`,
    "two hyphens for the dash": `${A} -- evidence: evidence/out.txt`,
    "an en dash for the dash": `${A} – evidence: evidence/out.txt`,
    "no space after the dash": `${A} —evidence: evidence/out.txt`,
    "no path": `${A} — evidence:`,
    "an empty path": `${A} — evidence: `,
    "a path with a space": `${A} — evidence: evidence/my out.txt`,
  };
  for (const [what, text] of Object.entries(mangled)) {
    const project = verifying({ manual: [A] });
    save(project, [{ text, done: true }]);
    evidence(project, "out.txt");
    const { e, res } = finish(project);
    assert.equal(e.ok, false, what);
    assert.equal(e.fallback, true, what);
    assert.deepEqual(e.ticked, [], what);
    assert.deepEqual(e.unproven, ["1.2"], what);
    // The row is still ticked, so the retry is offered and its prompt names the row.
    assert.equal(res.json.step, "manual-verify", what);
    assert.match(res.json.prompt, /Rows rejected by the router last time: 1\.2/, what);
  }
  // Control: the exact suffix passes. A mangled row among a valid one lists only the mangled row.
  const two = verifying({ manual: [A, B] });
  save(two, [ticked(A), { text: `${B} - evidence: evidence/out.txt`, done: true }]);
  evidence(two, "out.txt");
  const mixed = finish(two).e;
  assert.deepEqual(mixed.ticked, ["1.2"]);
  assert.deepEqual(mixed.unproven, ["1.3"]);
  assert.equal(mixed.ok, false);
  // An unticked row with an edited title is not a tick: nothing to prove.
  const unticked = verifying({ manual: [A] });
  save(unticked, [{ text: `${A} - evidence: evidence/out.txt`, done: false }]);
  const quiet = finish(unticked).e;
  assert.deepEqual(quiet.unproven, []);
  assert.equal(quiet.ok, false);
});

test("zero ticks is done", () => {
  const project = verifying();
  const { e, res } = finish(project);
  assert.equal(e.ok, true);
  assert.equal(e.verified, true);
  assert.deepEqual(e.ticked, []);
  assert.deepEqual(e.unproven, []);
  assert.equal(e.fallback, undefined);
  assert.equal(res.json.step, "impl-review");
  // A status that is not done is not ok, even with nothing changed, and it is neutral.
  const blocked = verifying();
  const b = finish(blocked, 3, { status: "failed", note: "nope" }).e;
  assert.equal(b.ok, false);
  assert.equal(b.fallback, true);
});

test("manual verify guards plan edits", () => {
  const manual = [A, { text: `${B} — evidence: evidence/old.txt`, done: true }];
  const run1 = (edit) => {
    const project = verifying({ manual });
    const m = edit.manual ?? [ticked(A), { text: `${B} — evidence: evidence/old.txt`, done: true }];
    save(project, m, edit.auto);
    evidence(project, "out.txt");
    return finish(project).e;
  };
  assert.equal(run1({}).ok, true, "control: a valid tick passes");
  assert.equal(run1({ auto: [{ text: "row one edited", done: true }] }).ok, false, "an Automated title is edited");
  assert.equal(run1({ auto: [{ text: "row one — abc1234", done: true }] }).ok, false, "a SHA suffix is added");
  assert.equal(run1({ auto: [{ text: "row one", done: false }] }).ok, false, "an Automated row is unticked");
  assert.equal(run1({ manual: [ticked("Run `node --version` and see two versions"), { text: `${B} — evidence: evidence/old.txt`, done: true }] }).ok, false, "a title is edited");
  assert.equal(run1({ manual: [ticked(A), { text: B, done: false }] }).ok, false, "a ticked Manual row is unticked");
  assert.equal(run1({ manual: [ticked(A)] }).ok, false, "a row is dropped");
  // An existing evidence suffix may change; only the title is compared.
  assert.equal(run1({ manual: [ticked(A), { text: `${B} — evidence: evidence/other.txt`, done: true }] }).ok, true);
});

test("evidence hardening", () => {
  // A symlinked evidence folder.
  const outside = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-ev-"));
  fs.writeFileSync(path.join(outside, "out.txt"), "output\n");
  const linked = verifying({ manual: [A] });
  save(linked, [ticked(A)]);
  fs.symlinkSync(outside, path.join(linked.changeDir, "evidence"));
  assert.equal(finish(linked).e.ok, false, "a symlinked evidence folder");
  fs.rmSync(outside, { recursive: true, force: true });

  // A directory in place of a file.
  const dir = verifying({ manual: [A] });
  save(dir, [ticked(A)]);
  fs.mkdirSync(path.join(dir.changeDir, "evidence/out.txt"), { recursive: true });
  assert.equal(finish(dir).e.ok, false, "a directory");

  // A file that is not newer than the baseline entry's startedAt.
  const stale = verifying({ manual: [A] });
  save(stale, [ticked(A)]);
  fs.utimesSync(evidence(stale, "out.txt"), 1, 1);
  assert.equal(finish(stale).e.ok, false, "a stale file");

  // A . segment.
  const dot = verifying({ manual: [A] });
  save(dot, [ticked(A, "evidence/./out.txt")]);
  evidence(dot, "out.txt");
  assert.equal(finish(dot).e.ok, false, "a . segment");

  // A retry may rely on a file its first attempt wrote.
  const retry = verifying({ manual: [A], over: { startedAt: Date.now() - 60000 } });
  save(retry, [ticked(A, null)]);
  evidence(retry, "out.txt");
  const first = finish(retry);
  assert.equal(first.e.ok, false, "the first attempt has no suffix");
  assert.equal(first.res.json.step, "manual-verify", "a retry follows");
  save(retry, [ticked(A)]);
  const second = finish(retry, 4);
  assert.equal(second.e.ok, true, JSON.stringify(second.e));
  assert.deepEqual(second.e.ticked, ["1.2"]);
});

test("manual verify retry baseline", () => {
  const project = verifying({ manual: [A, B] });
  // First attempt: row 1.2 is ticked with no evidence. Neutral failure, a retry follows with the row named.
  save(project, [ticked(A, null), B]);
  const first = finish(project);
  assert.equal(first.e.ok, false);
  assert.equal(first.e.fallback, true);
  assert.deepEqual(first.e.unproven, ["1.2"]);
  assert.equal(first.res.json.step, "manual-verify");
  assert.match(first.res.json.prompt, /Rows rejected by the router last time: 1\.2/);
  assert.doesNotMatch(lastEntry(project).tierWhy, /failed attempt/);
  assert.equal(readMetaFile(project).rigor.level, "standard");

  // The retry leaves the bad tick: judged against the first baseline, it fails again, and the run goes on.
  const second = finish(project, 4);
  assert.equal(second.e.ok, false);
  assert.equal(second.e.fallback, true);
  assert.deepEqual(second.e.unproven, ["1.2"]);
  assert.equal(second.res.json.step, "impl-review");
  assert.equal(readMetaFile(project).rigor.level, "standard", "no rigor rise from a neutral failure");

  // The run ends done and lists the unproven tick.
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  const end = finish(project, 5);
  assert.equal(end.res.json.action, "done", end.res.stdout);
  assert.deepEqual(end.res.json.manualUnproven, ["1.2"]);
  assert.deepEqual(readMetaFile(project).outcome.manualUnproven, ["1.2"]);

  // A retry that adds valid evidence is judged against the same baseline and passes.
  const healed = verifying({ manual: [A, B] });
  save(healed, [ticked(A, null), B]);
  assert.equal(finish(healed).e.ok, false);
  save(healed, [ticked(A), ticked(B)]);
  evidence(healed, "out.txt");
  const ok = finish(healed, 4);
  assert.equal(ok.e.ok, true, JSON.stringify(ok.e));
  assert.deepEqual(ok.e.ticked, ["1.2", "1.3"]);
  assert.equal(ok.res.json.step, "impl-review");
});

// ---- --chrome -----------------------------------------------------------------

test("chrome flag", () => {
  const project = mvProject();
  const res = start(project, "standard", ["--chrome"]).json;
  assert.equal(readMetaFile(project).chrome, true);
  assert.equal(res.step, "manual-verify");
  assert.equal(lastEntry(project).template, "manual-verify-chrome");
  // The step is metered like the plain one.
  const plain = mvProject();
  start(plain);
  assert.equal(lastEntry(plain).template, "manual-verify");
  assert.equal(readMetaFile(plain).chrome, undefined);

  // A resume without the flag keeps it, "true" is the bare flag, and "false" clears it.
  writeResult(project, { status: "done", note: "x" });
  init(project, GOAL);
  assert.equal(readMetaFile(project).chrome, true);
  writeResult(project, { status: "done", note: "x" });
  init(project, GOAL, ["--chrome", "true"]);
  assert.equal(readMetaFile(project).chrome, true);
  writeResult(project, { status: "done", note: "x" });
  init(project, GOAL, ["--chrome", "false"]);
  assert.equal(readMetaFile(project).chrome, false);
  // With the flag off the plain template is chosen again.
  const off = mvProject();
  start(off, "standard", ["--chrome", "false"]);
  assert.equal(lastEntry(off).template, "manual-verify");
});

test("chrome flag value", () => {
  const project = mvProject();
  const res = start(project, "standard", ["--chrome", "foo"]);
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Invalid --chrome foo\. Use --chrome, --chrome true or --chrome false\./);
  assert.equal(fs.existsSync(path.join(project.agentDir, "meta.json")), false, "nothing was written");
  assert.equal(readLogEntries(project).length, 3, "the log is untouched");
});

test("manual verify prompts", () => {
  const plain = mvProject();
  const prompt = start(plain).json.prompt;
  assert.match(prompt, /^Check the pending #### Manual rows of context\/changes\/demo\/plan\.md/);
  assert.ok(prompt.includes("`context/changes/demo/evidence/<name>`"));
  assert.ok(prompt.includes("` — evidence: evidence/<name>`"));
  assert.ok(!prompt.includes("ToolSearch"));
  assert.match(prompt, /MUST NOT\*\* tick it/);

  const chrome = mvProject();
  const cp = start(chrome, "standard", ["--chrome"]).json.prompt;
  assert.ok(cp.includes("context/changes/demo/evidence/<name>"));
  assert.ok(cp.includes("evidence: evidence/<name>"));
  assert.ok(cp.includes("ToolSearch"));
  assert.ok(cp.includes("mcp__claude-in-chrome__*"));
  assert.match(cp, /unavailable or the extension is not connected/);
  assert.match(cp, /leave that row unticked and finish with status `done`/);

  // After a failed attempt the retry prompt names the rejected rows.
  const retry = verifying({ manual: [A, B] });
  save(retry, [ticked(A, null), B]);
  assert.match(finish(retry).res.json.prompt, /rejected last time: 1\.2/);
});

// ---- outputs ------------------------------------------------------------------

// A finished run in a repository: an approved impl-review and a manual-verify step that ticked row 1.2 without evidence.
function unprovenProject(archive) {
  const project = makeProject({ plan: planOf([ticked(A, null), B]) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [
    entry(1, "plan"),
    entry(2, "plan-review"),
    entry(3, "implement"),
    entry(4, "manual-verify", { template: "manual-verify", ok: false, verified: false, fallback: true, ticked: [], unproven: ["1.2"] }),
    entry(5, "impl-review"),
  ]);
  writeMetaFile(project, { id: "demo", goal: GOAL, rigor: { requested: "standard" }, ...(archive ? { archive: true } : {}) });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

test("manual unproven reaches outputs", { skip: noGit }, () => {
  // Without --archive: the done output and meta.outcome carry the ids; report.md has no archive lines.
  const plain = unprovenProject(false);
  const done = run(plain, ["next", plain.id], { env: gitEnv(plain) });
  assert.equal(done.json.action, "done", done.stdout);
  assert.deepEqual(done.json.manualUnproven, ["1.2"]);
  assert.deepEqual(readMetaFile(plain).outcome.manualUnproven, ["1.2"]);
  assert.doesNotMatch(readReportFile(plain), /Manual checks unproven/);

  // With --archive: the archive action summary, meta.outcome and the lines of report.md.
  const project = unprovenProject(true);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.deepEqual(res.json.summary.manualUnproven, ["1.2"]);
  assert.deepEqual(readMetaFile(project).outcome.manualUnproven, ["1.2"]);
  assert.match(readReportFile(project), /^Manual checks unproven: 1\n- 1\.2$/m);
  assert.match(git(project, ["show", "HEAD:context/changes/demo/agent-smith/report.md"]), /^Manual checks unproven: 1$/m);

  // An ok manual-verify step leaves no such key anywhere.
  const clean = unprovenProject(true);
  writeLog(clean, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    entry(4, "manual-verify", { template: "manual-verify", ticked: [], unproven: [] }), entry(5, "impl-review"),
  ]);
  const ok = run(clean, ["next", clean.id], { env: gitEnv(clean) });
  assert.equal(ok.json.action, "archive", ok.stdout);
  assert.equal("manualUnproven" in ok.json.summary, false);
  assert.equal("manualUnproven" in readMetaFile(clean).outcome, false);
  assert.doesNotMatch(readReportFile(clean), /Manual checks unproven/);
});
