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
import { removeTree } from "../scripts/remove-tree.mjs";

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
// It opts into the step (`manualVerify.minRigor: "lean"`, which writeOverride would otherwise turn off); a test's own
// `manualVerify` keys are merged over that.
function mvProject({ manual = [A], log = null, policy = null, auto = AUTO } = {}) {
  const merged = { ...(policy ?? {}), manualVerify: { minRigor: "lean", ...(policy?.manualVerify ?? {}) } };
  const project = makeProject({ plan: planOf(manual, auto), policy: merged });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, log ?? [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
  return project;
}

const start = (project, rigor = "standard", extra = []) => init(project, GOAL, ["--rigor", rigor, ...extra]);
const lastEntry = (project) => readLogEntries(project).at(-1);

// A project with a pending manual-verify entry (step 4) whose baseline is the plan `manual`/`auto`. `over` replaces entry fields.
function verifying({ manual = [A, B], auto = AUTO, chrome = false, over = {}, policy = null } = {}) {
  const project = mvProject({ manual, auto, policy });
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
  assert.equal(e.tier, 2);
  assert.equal(e.model, "sonnet");
  assert.equal(e.effort, "medium");
  assert.deepEqual(e.before.manual, withId([A], 1));
  assert.deepEqual(e.before.auto, withId(AUTO, 0));
  assert.match(res.prompt, /Rows rejected by the router last time: none/);

  // Every level runs the step, lean included, with or without --chrome.
  for (const level of ["lean", "standard", "thorough"]) {
    const at = mvProject();
    assert.equal(start(at, level).json.step, "manual-verify", level);
    assert.equal(lastEntry(at).tier, 2, `${level}: first attempt on tier 2`);
  }
  assert.equal(start(mvProject(), "lean", ["--chrome"]).json.step, "manual-verify");
  // A pending Automated row comes first.
  const pending = mvProject({ auto: [{ text: "row one", done: false }] });
  assert.equal(start(pending).json.step, "implement");
  // A pool of 0 does not keep the step away: it is outside the pool.
  const spent = mvProject({ policy: { extraSteps: { allowance: { lean: 0, standard: 0, thorough: 0 } } } });
  assert.equal(start(spent).json.step, "manual-verify");
  // The shipped policy runs it too; minRigor null, a minRigor that is not a level or a non-positive maxAttempts turns it off.
  assert.equal(start(mvProject({ policy: { manualVerify: { minRigor: null } } })).json.step, "impl-review");
  assert.equal(start(mvProject({ policy: { manualVerify: { minRigor: "bogus" } } })).json.step, "impl-review");
  assert.equal(start(mvProject({ policy: { manualVerify: { maxAttempts: 0 } } })).json.step, "impl-review");
});

test("manual verify attempts", () => {
  const head = [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")];
  const okRun = (n) => entry(n, "manual-verify", { ticked: [], unproven: [] });
  const failed = (n) => entry(n, "manual-verify", { ok: false, verified: false, fallback: true, ticked: [], unproven: [] });
  // No step when every Manual row is ticked.
  assert.equal(start(mvProject({ manual: [ticked(A)] })).json.step, "impl-review");
  assert.equal(start(mvProject({ manual: [ticked(A)], log: [...head, okRun(4)] })).json.step, "impl-review");
  // An ok attempt that left rows pending is followed by one retry, one tier up.
  const ok = mvProject({ log: [...head, okRun(4)] });
  const retry = start(ok).json;
  assert.equal(retry.step, "manual-verify", JSON.stringify(retry));
  assert.equal(lastEntry(ok).tier, 3);
  assert.equal(retry.model, "sonnet");
  assert.equal(retry.effort, "high");
  assert.match(lastEntry(ok).tierWhy, /\+1 from manual-verify retry/);
  // One failed attempt leaves a retry too.
  assert.equal(start(mvProject({ log: [...head, failed(4)] })).json.step, "manual-verify");
  // Two attempts end it, whatever they left.
  assert.equal(start(mvProject({ log: [...head, okRun(4), okRun(5)] })).json.step, "impl-review");
  assert.equal(start(mvProject({ log: [...head, failed(4), failed(5)] })).json.step, "impl-review");
  // retryBump 0 keeps the retry on the first attempt's tier.
  const flat = mvProject({ log: [...head, okRun(4)], policy: { manualVerify: { retryBump: 0 } } });
  assert.equal(start(flat).json.step, "manual-verify");
  assert.equal(lastEntry(flat).tier, 2);
});

test("manual verify before impl review", () => {
  const project = mvProject();
  assert.equal(start(project).json.step, "manual-verify");
  // The finished step changes nothing: zero ticks. The row is still pending, so one retry runs, then impl-review.
  const { res, e } = finish(project);
  assert.equal(e.ok, true);
  assert.equal(res.json.step, "manual-verify");
  const second = finish(project, 4);
  assert.equal(second.e.ok, true);
  assert.equal(second.res.json.step, "impl-review");
  // A fix after the review does not bring the step back, with a row still pending and an attempt left.
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

test("manual verify every row eligible", () => {
  // Any pending Manual row makes the step run: a command, no command, a human word, an owner row, a browser row.
  for (const text of [
    "Run `node --version`",
    "Run `foo --bar` and see it",
    "Run node --version and see it",
    HUMAN,
    "Run `node -e 1` and judge the result",
    "A person runs `node --version`",
    "Look at it",
    "The owner confirms the wording",
    "Check that the browser shows the form",
    "Open the domain list and check it",
  ]) {
    assert.equal(eligible(text), true, text);
    assert.equal(eligible(text, true), true, `${text} (--chrome)`);
  }
  assert.equal(eligible("Look at it", false, "lean"), true, "lean");
  // A ticked row with a human word and valid evidence counts as ticked.
  const project = verifying({ manual: [HUMAN, "Look at it"] });
  save(project, [ticked(HUMAN), ticked("Look at it")]);
  evidence(project, "out.txt");
  const { e } = finish(project);
  assert.equal(e.ok, true, JSON.stringify(e));
  assert.deepEqual(e.ticked, ["1.2", "1.3"]);
  assert.deepEqual(e.unproven, []);
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
  removeTree(out);
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
  // Rows are still pending, so one retry follows; a step that ticked every row goes on to impl-review.
  assert.equal(res.json.step, "manual-verify");
  const all = verifying();
  save(all, [ticked(A), ticked(B)]);
  evidence(all, "out.txt");
  assert.equal(finish(all).res.json.step, "impl-review");
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
  removeTree(outside);

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
  // The retry runs one tier up from the retry bump, not from a failure bump.
  assert.equal(lastEntry(project).tier, 3);
  assert.match(lastEntry(project).tierWhy, /\+1 from manual-verify retry/);
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
  // Chrome is on by default: a run that stored no value gets the template with the Chrome rules.
  const plain = mvProject();
  start(plain);
  assert.equal(readMetaFile(plain).chrome, undefined);
  assert.equal(lastEntry(plain).template, "manual-verify");
  // --chrome and --chrome true store true and change nothing in effect.
  const project = mvProject();
  const res = start(project, "standard", ["--chrome"]).json;
  assert.equal(readMetaFile(project).chrome, true);
  assert.equal(res.step, "manual-verify");
  assert.equal(lastEntry(project).template, "manual-verify");
  const bare = mvProject();
  start(bare, "standard", ["--chrome", "true"]);
  assert.equal(readMetaFile(bare).chrome, true);
  assert.equal(lastEntry(bare).template, "manual-verify");
  // A stored true that a run from before this change left reads on as well.
  const legacy = verifying({ chrome: true });
  save(legacy, [A, B]);
  assert.equal(finish(legacy).res.json.step, "manual-verify");
  assert.equal(lastEntry(legacy).template, "manual-verify");

  // --chrome false stores false and selects the template without the Chrome rules.
  const off = mvProject();
  const offRes = start(off, "standard", ["--chrome", "false"]).json;
  assert.equal(readMetaFile(off).chrome, false);
  assert.equal(offRes.step, "manual-verify");
  assert.equal(lastEntry(off).template, "manual-verify-nochrome");

  // A resume without the flag keeps the stored value, and a later flag changes it.
  writeResult(off, { status: "done", note: "x" });
  init(off, GOAL);
  assert.equal(readMetaFile(off).chrome, false);
  assert.equal(lastEntry(off).template, "manual-verify-nochrome", "the retry keeps the no-Chrome template");
  writeResult(project, { status: "done", note: "x" });
  init(project, GOAL);
  assert.equal(readMetaFile(project).chrome, true);
  writeResult(project, { status: "done", note: "x" });
  init(project, GOAL, ["--chrome", "false"]);
  assert.equal(readMetaFile(project).chrome, false);
});

test("neither manual verify template is charged to the pool", () => {
  // Neither template costs anything from the pool, whatever an override says.
  const failed = (n, template) => entry(n, "manual-verify", { template, ok: false, verified: false, fallback: true, ticked: [], unproven: [] });
  const log = (template) => [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), failed(4, template)];
  const pool = (n, cost = {}) => ({ extraSteps: { allowance: { lean: 0, standard: n, thorough: n }, cost } });
  for (const [template, extra] of [["manual-verify", []], ["manual-verify-nochrome", ["--chrome", "false"]]]) {
    // A pool of 1, or of 0, does not stop the retry.
    for (const n of [0, 1]) {
      const room = mvProject({ log: log(template), policy: pool(n) });
      assert.equal(start(room, "standard", extra).json.step, "manual-verify", `${template}: pool ${n}`);
    }
    // Two failed attempts leave the pool as it was: a first REJECTED review still gets the plan-rejected re-plan (cost 2
    // of the standard pool of 2), with or without a cost key for the step.
    for (const cost of [{}, { "manual-verify": 2, "manual-verify-nochrome": 2 }]) {
      const project = mvProject({
        log: [...log(template), failed(5, template), entry(6, "impl-review")],
        policy: { extraSteps: { allowance: { lean: 0, standard: 2, thorough: 3 }, cost: { "plan-rejected": 2, ...cost } } },
      });
      writeReview(project, "impl-review", { verdict: "REJECTED", findings: "1 critical, 0 warnings" });
      const res = start(project, "standard", extra).json;
      assert.equal(res.step, "plan", `${template}: ${JSON.stringify(res)}`);
      assert.equal(lastEntry(project).template, "plan-rejected", `${template} ${JSON.stringify(cost)}`);
    }
  }
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
  const project = mvProject();
  const prompt = start(project).json.prompt;
  assert.match(prompt, /^Prove the pending #### Manual rows of context\/changes\/demo\/plan\.md on your own/);
  assert.doesNotMatch(prompt, /that a command can prove/);
  assert.match(prompt, /start with no memory of earlier steps/);
  // Every pending row is in scope, read, judge and owner rows included.
  assert.match(prompt, /pending `\[ \]` \*\*WHEN\*\*[^\n]*\*\*MUST\*\* treat it as in scope, including a row that asks a person to read, judge, look at or confirm something and a row that asks the owner for a decision/);
  // A covering green test is evidence, its first line names the test file and the test name.
  assert.match(prompt, /automated test covers the claim[^\n]*run that test now, tick the row only if it passes[^\n]*`test-` evidence whose first line names the test file and the test name/);
  // A command is run and the row is ticked only when the output proves it.
  assert.match(prompt, /names a command \*\*WHEN\*\* you run that command \*\*THEN\*\* you \*\*MUST\*\* tick the row only if the output proves what the row says/);
  // A throw-away script lives outside the repository or under evidence/, never in the source or test tree.
  assert.match(prompt, /throw-away script[^\n]*`mktemp -d`, or under `context\/changes\/demo\/evidence\/`, never in the source tree or the test tree/);
  assert.match(prompt, /save the script source and its output as `script-` evidence/);
  // A judgment quotes what it checked.
  assert.match(prompt, /`judgment-` evidence file that quotes the text or behaviour you checked and gives your reasoning/);
  // Evidence kinds, the tick suffix and the size limit.
  assert.ok(prompt.includes("one of `command-`, `test-`, `script-`, `browser-` or `judgment-`"));
  assert.ok(prompt.includes("`context/changes/demo/evidence/<name>` (not empty, under 1 MB)"));
  assert.ok(prompt.includes("` — evidence: evidence/<name>`"));
  // The ledger of unproved rows.
  assert.ok(prompt.includes("`context/changes/demo/evidence/unproven.md` as `- <row id> — <reason>`"));
  assert.match(prompt, /rewrite the whole file so that it lists every row still pending, and only those/);
  assert.match(prompt, /`evidence\/unproven\.md` exists from an earlier attempt \*\*WHEN\*\* you start \*\*THEN\*\* you \*\*MUST\*\* read it first/);
  // plan.md hygiene.
  assert.match(prompt, /\*\*MUST NOT\*\* change a row title, an Automated row or a commit SHA suffix/);
  assert.match(prompt, /\*\*MUST NOT\*\* untick it/);
  assert.match(prompt, /rejected last time: none \*\*WHEN\*\*/);
  // Safety rules.
  assert.match(prompt, /push, deploy, publish or post to an external service[^\n]*\*\*MUST NOT\*\* run it/);
  assert.match(prompt, /outside the run root and your scratch directory \*\*THEN\*\* you \*\*MUST NOT\*\* write it/);
  assert.match(prompt, /not plan\.md and not under `context\/changes\/demo\/evidence\/` \*\*THEN\*\* you \*\*MUST NOT\*\* write it/);
  assert.match(prompt, /only read-only git commands: never `git reset`, `git commit`, `git checkout`/);
  assert.match(prompt, /delete a branch, a worktree or a ref[^\n]*\*\*MUST NOT\*\* run it/);
  assert.match(prompt, /start it in the background with its output sent to a file, and stop it before the step ends/);
  assert.match(prompt, /credential, a token, an environment dump or personal data[^\n]*\*\*MUST\*\* redact that part first/);
  // A command that never ends or waits for input is not run, and its row stays pending (a hang costs the step).
  const never = /never ends by itself or waits for input[^\n]*\*\*MUST NOT\*\* run it and you leave the row at `\[ \]`/;
  assert.match(prompt, never);
  assert.match(prompt, /\*\*MUST NOT\*\* print a plain-text question or wait for input/);
  // Line 1 carries the router's own list of browser rows ("none" when there is none).
  assert.match(prompt, /^Prove the pending[^\n]*Rows rejected by the router last time: none\. Browser rows: none\n/);
  // The shared rules: a browser row is never judged, and its unproved reason is recorded.
  assert.match(prompt, /listed under Browser rows in the first line of this prompt \*\*WHEN\*\* you prove it \*\*THEN\*\* you \*\*MUST\*\* use `browser-`, `test-`, `command-` or `script-` evidence and never a `judgment-` file or a read of the source/);
  assert.match(prompt, /a row other than a Browser row asks to read or judge/);
  assert.match(prompt, /Browser rows stays at `\[ \]` \*\*WHEN\*\* you write `evidence\/unproven\.md` \*\*THEN\*\* you \*\*MUST\*\* give the reason/);
  // The default template carries the Chrome rules: Chrome first, createIfEmpty, the calls recorded, the failure quoted.
  assert.ok(prompt.includes("ToolSearch"));
  assert.ok(prompt.includes("mcp__claude-in-chrome__*"));
  const at = (re) => prompt.search(re);
  const order = [/one ToolSearch call that selects `tabs_context_mcp`/, /pass `createIfEmpty: true`, because without it the call finds no tab group/, /begin the `browser-` evidence file with the tool calls that ran \(tool, target, result\)/, /begin the file with `Chrome: <tool> failed: <error text>`/, /\*\*MUST NOT\*\* judge it from the source of the page or the code/];
  const positions = order.map(at);
  assert.ok(positions.every((n) => n >= 0), JSON.stringify(positions));
  assert.deepEqual([...positions].sort((x, y) => x - y), positions, "the Chrome rules come in order");
  assert.match(prompt, /call them before any other proof/);
  assert.match(prompt, /\*\*MUST NOT\*\* open a page that is neither local nor named by the row, sign in, submit a form to an external service or enter a credential/);
  assert.match(prompt, /unavailable, fail or are not connected[^\n]*\*\*MUST NOT\*\* wait for a connection or ask for one: prove the row by a covering test, command or script, or leave it at `\[ \]` with `- <row id> — Chrome failed: <tool>: <error text>` in `evidence\/unproven\.md`/);

  // --chrome false: the same rules without the Chrome tools, plus the rule that they are off.
  const off = mvProject();
  const np = start(off, "standard", ["--chrome", "false"]).json.prompt;
  assert.equal(np.split("\n")[0], prompt.split("\n")[0]);
  assert.ok(!np.includes("ToolSearch"));
  assert.ok(!np.includes("mcp__claude-in-chrome__"));
  assert.match(np, never);
  assert.ok(np.includes("` — evidence: evidence/<name>`"));
  assert.ok(np.includes("`context/changes/demo/evidence/unproven.md`"));
  assert.match(np, /Chrome tools are off for this run \*\*WHEN\*\* a row needs a browser \*\*THEN\*\* you \*\*MUST NOT\*\* use a browser tool\./);
  assert.match(np, /Chrome tools are off for this run \*\*WHEN\*\* you prove a Browser row \*\*THEN\*\* you \*\*MUST\*\* use only a covering test, command or script, and begin its evidence file with the line `Chrome: off \(--chrome false\)`; otherwise leave the row at `\[ \]` with the reason `Chrome off \(--chrome false\)` in `evidence\/unproven\.md`/);
  assert.ok(!np.includes("createIfEmpty"));
  assert.match(np, /Browser rows: none\n/);

  // After a failed attempt the retry prompt names the rejected rows.
  const retry = verifying({ manual: [A, B] });
  save(retry, [ticked(A, null), B]);
  assert.match(finish(retry).res.json.prompt, /rejected last time: 1\.2/);
});

test("browser rows in the prompt", () => {
  // The first prompt lists the pending browser rows in plan order, in both templates.
  const rows = [A, BR, "Check it in Chrome", B];
  for (const extra of [[], ["--chrome", "false"]]) {
    const project = mvProject({ manual: rows });
    const out = start(project, "standard", extra).json;
    assert.equal(out.step, "manual-verify");
    assert.match(out.prompt, /Browser rows: 1\.3, 1\.4\n/, extra.join(" "));
    assert.match(out.prompt, /rejected by the router last time: none\./);
  }
  // The retry lists a rejected browser row (and only the browser rows among the rejected and the pending).
  const project = verifying({ manual: [BR, A, B] });
  save(project, [ticked(BR, "evidence/judgment-1.2.md"), A, B]);
  evidence(project, "judgment-1.2.md");
  const retry = finish(project).res.json;
  assert.equal(retry.step, "manual-verify");
  assert.match(retry.prompt, /last time: 1\.2\. Browser rows: 1\.2\n/);
  // A ticked row at the start is not listed: the evidence file name is not matched, and a done row is not pending.
  const done = mvProject({ manual: [{ text: `${BR} — evidence: evidence/browser-x.txt`, done: true }, A] });
  assert.match(start(done).json.prompt, /Browser rows: none\n/);
  // No ToolSearch or Chrome tool name in the shared file or the nochrome prompt.
  const shared = fs.readFileSync(new URL("../prompts/manual-verify.md", import.meta.url), "utf8");
  assert.ok(!shared.includes("ToolSearch") && !shared.includes("mcp__claude-in-chrome__"));
});

// ---- browser rows -------------------------------------------------------------

const BR = "Open the page in a browser and see the heading";
const WHY = (kind) => `browser row ticked with ${kind} evidence; only browser, test, command, script evidence proves it`;
const SHIPPED = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));

// One manual-verify step over the Manual rows `manual` (the first is ticked with `token`, the file written when `write`).
function tickWith(manual, token, { policy = null, write = true, extra = [] } = {}) {
  const project = verifying({ manual, policy });
  save(project, [ticked(manual[0], token), ...manual.slice(1)]);
  if (write && token) evidence(project, token.slice("evidence/".length));
  for (const f of extra) evidence(project, f);
  return { project, ...finish(project) };
}

test("browser row words and proof kinds", () => {
  const mv = SHIPPED.manualVerify;
  for (const w of [...SHIPPED.executors.e2e.rowWords, "chrome"]) assert.ok(mv.browserRowWords.includes(w), w);
  assert.deepEqual(mv.browserProofKinds, ["browser", "test", "command", "script"]);
  // Defaults are in force with no override: a judgment tick on a browser row is rejected.
  const rejects = (policy, token = "evidence/judgment-1.2.md") => {
    const { e } = tickWith([BR], token, { policy });
    return e.unproven.length === 1 && e.proved.length === 0;
  };
  assert.equal(rejects(null), true);
  // A wrong shape reads as the default and never halts.
  for (const bad of ["browser", [1], [" "], [""], null, { a: 1 }, 7]) {
    assert.equal(rejects({ manualVerify: { browserRowWords: bad } }), true, `words ${JSON.stringify(bad)}`);
  }
  for (const bad of ["test", [], [1], [""], null, { test: true }]) {
    assert.equal(rejects({ manualVerify: { browserProofKinds: bad } }), true, `kinds ${JSON.stringify(bad)}`);
    assert.equal(tickWith([BR], "evidence/test-1.2.md", { policy: { manualVerify: { browserProofKinds: bad } } }).e.ok, true, `kinds ${JSON.stringify(bad)}`);
  }
  // An empty browserRowWords turns the check off.
  const off = tickWith([BR], "evidence/judgment-1.2.md", { policy: { manualVerify: { browserRowWords: [] } } }).e;
  assert.equal(off.ok, true, JSON.stringify(off));
  assert.deepEqual(off.browserRows, []);
  // The removed browserWords key of an old override is ignored.
  assert.equal(rejects({ manualVerify: { browserWords: [] } }), true);
  assert.equal(tickWith([A], "evidence/judgment-1.2.md", { policy: { manualVerify: { browserWords: ["node"] } } }).e.ok, true);
  // A custom word list and kind list.
  const custom = { manualVerify: { browserRowWords: ["terminal"], browserProofKinds: ["judgment"] } };
  assert.equal(tickWith(["Look at the terminal output"], "evidence/judgment-1.2.md", { policy: custom }).e.ok, true);
  assert.equal(tickWith(["Look at the terminal output"], "evidence/test-1.2.md", { policy: custom }).e.ok, false);
  assert.equal(tickWith([BR], "evidence/judgment-1.2.md", { policy: custom }).e.ok, true, "a custom list replaces the default words");
  // A kind that evidenceKinds leaves out reads "other" and never proves a browser row.
  const noTest = tickWith([BR], "evidence/test-1.2.md", { policy: { manualVerify: { evidenceKinds: ["command", "script", "browser", "judgment"] } } }).e;
  assert.equal(noTest.ok, false);
  assert.deepEqual(noTest.unprovenWhy, { "1.2": WHY("other") });
  // A phrase matches at a word start: Chrome, end-to-end and E2E hit, Rebrowser does not.
  for (const text of ["Check it in Chrome", "Run the end-to-end flow", "Run the E2E suite", "Playwright shows it"]) {
    assert.deepEqual(tickWith([text], "evidence/judgment-1.2.md").e.browserRows, ["1.2"], text);
  }
  assert.deepEqual(tickWith(["Check the Rebrowser output"], "evidence/judgment-1.2.md").e.browserRows, []);
});

test("browser row judgment tick is unproven", () => {
  for (const token of ["evidence/judgment-1.2.md", "evidence/log-1.2.md", "evidence/notes.md"]) {
    const kind = token.includes("judgment") ? "judgment" : "other";
    const { project, res, e } = tickWith([BR, B], token);
    assert.equal(e.ok, false, token);
    assert.equal(e.fallback, true, token);
    assert.deepEqual(e.unproven, ["1.2"], token);
    assert.deepEqual(e.proved, [], token);
    assert.deepEqual(e.ticked, [], token);
    assert.deepEqual(e.browserRows, ["1.2"], token);
    assert.deepEqual(e.unprovenWhy, { "1.2": WHY(kind) }, token);
    // The retry runs one tier up and its prompt names the row and the browser rows.
    assert.equal(res.json.step, "manual-verify", token);
    assert.match(res.json.prompt, /rejected by the router last time: 1\.2/, token);
    assert.match(res.json.prompt, /Browser rows: 1\.2(\n|$)/, token);
    assert.equal(lastEntry(project).n, 5, token);
  }
  // A non-browser row next to it is proved by a judgment file.
  const mixed = tickWith([BR, B], "evidence/judgment-1.2.md");
  assert.equal(mixed.e.unprovenWhy["1.3"], undefined);
  // A tick without valid evidence on a browser row keeps its handling and gets no reason.
  const missing = tickWith([BR], "evidence/browser-missing.txt", { write: false }).e;
  assert.deepEqual(missing.unproven, ["1.2"]);
  assert.equal("unprovenWhy" in missing, false);
  assert.deepEqual(missing.browserRows, ["1.2"]);
  // The retry that settles the row with test evidence is proved; one that unticks leaves it pending.
  const retry = tickWith([BR], "evidence/judgment-1.2.md");
  save(retry.project, [ticked(BR, "evidence/test-1.2.md")]);
  evidence(retry.project, "test-1.2.md");
  const second = finish(retry.project, 4);
  assert.equal(second.e.ok, true, JSON.stringify(second.e));
  assert.deepEqual(second.e.proved, [{ id: "1.2", kind: "test", file: "evidence/test-1.2.md" }]);
  assert.equal("unprovenWhy" in second.e, false);
  const untick = tickWith([BR], "evidence/judgment-1.2.md");
  save(untick.project, [BR]);
  const third = finish(untick.project, 4);
  assert.deepEqual(third.e.unproven, []);
  assert.deepEqual(third.e.pending, ["1.2"]);
  // An old log entry without browserRows is read as before: manualUnprovenIds needs only unproven.
  const old = verifying({ manual: [A] });
  save(old, [ticked(A, "evidence/judgment-1.2.md")]);
  evidence(old, "judgment-1.2.md");
  assert.equal(finish(old).e.ok, true);
});

test("browser row proved by browser test command or script", () => {
  for (const kind of ["browser", "test", "command", "script"]) {
    const { e } = tickWith([BR], `evidence/${kind}-1.2.md`);
    assert.equal(e.ok, true, kind);
    assert.deepEqual(e.proved, [{ id: "1.2", kind, file: `evidence/${kind}-1.2.md` }], kind);
    assert.deepEqual(e.browserRows, ["1.2"], kind);
    assert.equal("unprovenWhy" in e, false, kind);
  }
  // A prefix is lower-cased, as for any kind.
  assert.equal(tickWith([BR], "evidence/Browser-1.2.md").e.ok, true);
  // A row that names no browser word is still proved by a judgment file.
  const plain = tickWith([HUMAN], "evidence/judgment-1.2.md").e;
  assert.equal(plain.ok, true);
  assert.deepEqual(plain.browserRows, []);
  // Several rows share one evidence file: the kind decides per row.
  const shared = verifying({ manual: [BR, B] });
  save(shared, [ticked(BR, "evidence/judgment-x.md"), ticked(B, "evidence/judgment-x.md")]);
  evidence(shared, "judgment-x.md");
  const both = finish(shared).e;
  assert.deepEqual(both.ticked, ["1.3"]);
  assert.deepEqual(both.unproven, ["1.2"]);
});

test("evidence file name does not make a browser row", () => {
  // Row 1.2 already carries a browser- evidence suffix at the start of the step; its baseline text is not matched on the suffix.
  const project = verifying({ manual: [{ text: `${A} — evidence: evidence/browser-x.txt`, done: true }, B] });
  const e0 = lastEntry(project);
  save(project, [{ text: `${A} — evidence: evidence/browser-x.txt`, done: true }, ticked(B, "evidence/judgment-b.md")]);
  evidence(project, "judgment-b.md");
  const { e } = finish(project);
  assert.ok(e0.before.manual[0].text.includes("browser-x"));
  assert.deepEqual(e.browserRows, []);
  assert.equal(e.ok, true, JSON.stringify(e));
  assert.deepEqual(e.proved, [{ id: "1.3", kind: "judgment", file: "evidence/judgment-b.md" }]);
  // The same row, newly ticked with a browser- file, is no browser row either.
  const fresh = tickWith([A], "evidence/browser-1.2.md").e;
  assert.deepEqual(fresh.browserRows, []);
  assert.equal(fresh.ok, true);
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

// A finished run whose manual-verify step rejected the judgment tick of browser row 1.2 (kind reason); `withWhy` false drops the reason.
function whyProject(archive, withWhy = true) {
  const project = unprovenProject(archive);
  writePlan(project, planOf([ticked(BR, "evidence/judgment-1.2.md"), B]));
  const before = { autoDone: 1, manual: withId([BR, B], 1), auto: withId(AUTO, 0) };
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    entry(4, "manual-verify", {
      template: "manual-verify", ok: false, verified: false, fallback: true, before, ticked: [], unproven: ["1.2"], pending: ["1.3"],
      ...(withWhy ? { browserRows: ["1.2"], unprovenWhy: { "1.2": WHY("judgment") } } : {}),
    }),
    entry(5, "impl-review"),
  ]);
  return project;
}

test("unproven why reaches outputs", { skip: noGit }, () => {
  const line = `1.2 ${BR} — ${WHY("judgment")}`;
  // The log entry fields come from verifyManual (see the browser row tests); here they reach the outputs.
  const plain = whyProject(false);
  const done = run(plain, ["next", plain.id], { env: gitEnv(plain) });
  assert.equal(done.json.action, "done", done.stdout);
  assert.deepEqual(done.json.manualUnproven, ["1.2"]);
  assert.deepEqual(done.json.manualUnprovenWhy, [line]);
  assert.deepEqual(readMetaFile(plain).outcome.manualUnprovenWhy, [line]);
  assert.doesNotMatch(readReportFile(plain), /Manual checks unproven, reasons/);

  // status: the browser row count and the reason object of the step row.
  const row = run(plain, ["status", plain.id]).json.steps.find((s) => s.step === "manual-verify");
  assert.equal(row.browserRows, 1);
  assert.deepEqual(row.unprovenWhy, { "1.2": WHY("judgment") });

  // With --archive: the summary, meta.outcome, report.md and its committed copy.
  const project = whyProject(true);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.deepEqual(res.json.summary.manualUnprovenWhy, [line]);
  assert.deepEqual(readMetaFile(project).outcome.manualUnprovenWhy, [line]);
  assert.ok(readReportFile(project).includes(`Manual checks unproven, reasons: 1\n- ${line}`), readReportFile(project));
  assert.ok(git(project, ["show", "HEAD:context/changes/demo/agent-smith/report.md"]).includes(`Manual checks unproven, reasons: 1\n- ${line}`));

  // An unproven tick without a kind reason (no evidence) carries no reason key and no line; the ids stay.
  const bare = whyProject(true, false);
  const out = run(bare, ["next", bare.id], { env: gitEnv(bare) });
  assert.equal(out.json.action, "archive", out.stdout);
  assert.deepEqual(out.json.summary.manualUnproven, ["1.2"]);
  assert.equal("manualUnprovenWhy" in out.json.summary, false);
  assert.equal("manualUnprovenWhy" in readMetaFile(bare).outcome, false);
  assert.doesNotMatch(readReportFile(bare), /Manual checks unproven, reasons/);
  const bareRow = run(bare, ["status", bare.id]).json.steps.find((s) => s.step === "manual-verify");
  assert.equal("browserRows" in bareRow, false);
  assert.equal("unprovenWhy" in bareRow, false);
});

test("manual checks report marks browser rows", () => {
  const before = { autoDone: 1, manual: withId([BR, B, "Look at it"], 1), auto: withId(AUTO, 0) };
  const project = mvProject({ manual: [ticked(BR, "evidence/judgment-1.2.md"), B, ticked("Look at it", "evidence/command-x.txt")] });
  writeMetaFile(project, { id: project.id, goal: GOAL, rigor: { requested: "standard" } });
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    entry(4, "manual-verify", {
      before, ticked: ["1.4"], unproven: ["1.2"], pending: ["1.3"], browserRows: ["1.2", "1.3"],
      unprovenWhy: { "1.2": WHY("judgment") },
      proved: [{ id: "1.4", kind: "command", file: "evidence/command-x.txt" }],
    }),
  ]);
  run(project, ["status", project.id, "--report"]);
  const section = readReportFile(project).slice(readReportFile(project).indexOf("## Manual checks"));
  assert.ok(section.includes("Only browser, test, command or script evidence proves a browser row."), section);
  assert.ok(section.includes("- 1.4 Look at it — command (evidence/command-x.txt)"), section);
  assert.ok(section.includes(`- 1.3 ${B} [browser row] — not proved: no reason recorded`), section);
  assert.match(section, /^Unproven: 1$/m);
  assert.ok(section.includes(`- 1.2 ${BR} [browser row] — unproven: ${WHY("judgment")}`), section);
  // A proved browser row is marked in its kind group.
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    entry(4, "manual-verify", {
      before, ticked: ["1.2"], unproven: [], pending: [], browserRows: ["1.2"],
      proved: [{ id: "1.2", kind: "test", file: "evidence/test-1.2.md" }],
    }),
  ]);
  run(project, ["status", project.id, "--report"]);
  const ok = readReportFile(project);
  assert.ok(ok.includes(`- 1.2 ${BR} [browser row] — test (evidence/test-1.2.md)`), ok);
  assert.doesNotMatch(ok, /^Unproven: /m);
  // An unproven tick with no recorded reason reads "no valid evidence"; an entry without browserRows marks nothing.
  writeLog(project, [
    entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
    entry(4, "manual-verify", { before, ticked: [], unproven: ["1.2"], pending: [] }),
  ]);
  run(project, ["status", project.id, "--report"]);
  const old = readReportFile(project);
  assert.ok(old.includes(`- 1.2 ${BR} — unproven: no valid evidence`), old);
  assert.doesNotMatch(old, /\[browser row\]/);
});

// ---- evidence kinds and unproved reasons ---------------------------------------

// Writes the unproved reasons file of a project (evidence/<name>) and returns its path.
const ledger = (project, lines, name = "unproven.md") => evidence(project, name, Array.isArray(lines) ? lines.join("\n") + "\n" : lines);

test("manual verify evidence kind", () => {
  const kindOf = (token, policy = null) => {
    const project = verifying({ manual: [A], policy });
    save(project, [ticked(A, token)]);
    evidence(project, token.slice("evidence/".length));
    const { e } = finish(project);
    assert.equal(e.ok, true, `${token}: ${JSON.stringify(e)}`);
    assert.deepEqual(e.ticked, ["1.2"], token);
    assert.equal(e.proved.length, 1, token);
    assert.deepEqual(e.proved[0], { id: "1.2", kind: e.proved[0].kind, file: token }, token);
    return e.proved[0].kind;
  };
  // Each known prefix.
  for (const kind of ["command", "test", "script", "browser", "judgment"]) {
    assert.equal(kindOf(`evidence/${kind}-1.2.txt`), kind, kind);
  }
  // The prefix is lower-cased; an unknown prefix and a base name with no prefix read "other", and the row is still ticked.
  assert.equal(kindOf("evidence/Test-1.2.txt"), "test");
  assert.equal(kindOf("evidence/log-1.2.txt"), "other");
  assert.equal(kindOf("evidence/judgment.md"), "other");
  assert.equal(kindOf("evidence/-1.2.txt"), "other");
  // A subfolder path: the kind comes from the base name, not from the folder.
  assert.equal(kindOf("evidence/sub/script-check.sh"), "script");
  assert.equal(kindOf("evidence/test-runs/out.txt"), "other");
  // A policy list replaces the default; a list of the wrong shape reads as the default and never halts.
  assert.equal(kindOf("evidence/custom-1.2.txt", { manualVerify: { evidenceKinds: ["custom"] } }), "custom");
  assert.equal(kindOf("evidence/test-1.2.txt", { manualVerify: { evidenceKinds: ["custom"] } }), "other");
  for (const bad of ["test", [], [1], [""], null, { test: true }]) {
    assert.equal(kindOf("evidence/test-1.2.txt", { manualVerify: { evidenceKinds: bad } }), "test", JSON.stringify(bad));
  }
  // A tick without valid evidence is not proved; an untouched row is listed as pending.
  const project = verifying({ manual: [A, B] });
  save(project, [ticked(A, "evidence/command-missing.txt"), B]);
  const { e } = finish(project);
  assert.deepEqual(e.proved, []);
  assert.deepEqual(e.unproven, ["1.2"]);
  assert.deepEqual(e.pending, ["1.3"]);
});

test("manual verify unproven ledger", () => {
  // Runs one manual-verify step with the plan untouched and the given ledger; returns the finished entry.
  const withLedger = (write, { policy = null, manual = [A, B] } = {}) => {
    const project = verifying({ manual, policy });
    if (write) write(project);
    return finish(project).e;
  };
  // A valid file: each `- <row id> — <reason>` line that names a Manual row; other lines are ignored.
  const valid = withLedger((pr) => ledger(pr, [
    "# Unproved rows",
    "",
    "- 1.3 — needs a live pipeline run",
    "- 1.2 — Chrome is not connected",
    "- 9.9 — not a row of the plan",
    "- 1.3 - a hyphen is not the separator",
    "1.3 — no bullet",
    "- 1.3 —",
  ]));
  assert.equal(valid.ok, true, JSON.stringify(valid));
  assert.deepEqual(valid.reasons, { "1.2": "Chrome is not connected", "1.3": "needs a live pipeline run" });
  // Reasons are one line, without backticks or format characters, and cut to reasonMaxChars code points.
  const cleaned = withLedger((pr) => ledger(pr, ["- 1.3 — run `node -e 1`​\tand   see"]));
  assert.deepEqual(cleaned.reasons, { "1.3": "run 'node -e 1' and see" });
  const long = withLedger((pr) => ledger(pr, [`- 1.3 — ${"é".repeat(300)}`]));
  assert.equal(Array.from(long.reasons["1.3"]).length, 200);
  const short = withLedger((pr) => ledger(pr, ["- 1.3 — abcdefghijklmnop"]), { policy: { manualVerify: { reasonMaxChars: 5 } } });
  assert.deepEqual(short.reasons, { "1.3": "abcde" });
  const badMax = withLedger((pr) => ledger(pr, [`- 1.3 — ${"x".repeat(250)}`]), { policy: { manualVerify: { reasonMaxChars: "ten" } } });
  assert.equal(badMax.reasons["1.3"].length, 200, "a malformed reasonMaxChars reads as the default");
  // A missing, stale, oversized, symlinked or malformed file gives no reasons and never changes ok.
  const none = {
    "a missing file": null,
    "a stale file": (pr) => fs.utimesSync(ledger(pr, ["- 1.3 — old"]), 1, 1),
    "an oversized file": (pr) => ledger(pr, `- 1.3 — big\n${"x".repeat(70000)}\n`),
    "a directory": (pr) => fs.mkdirSync(path.join(pr.changeDir, "evidence/unproven.md"), { recursive: true }),
    "a symlink": (pr) => {
      const real = ledger(pr, ["- 1.3 — linked"], "real.md");
      fs.symlinkSync(real, path.join(pr.changeDir, "evidence/unproven.md"));
    },
    "no valid line": (pr) => ledger(pr, ["1.3: no bullet", "- 1.3 – an en dash"]),
  };
  for (const [what, write] of Object.entries(none)) {
    const e = withLedger(write);
    assert.equal(e.reasons, undefined, what);
    assert.equal(e.ok, true, what);
  }
  // A ledger next to a failed step is still read and the step stays not ok.
  const failedProject = verifying({ manual: [A, B] });
  ledger(failedProject, ["- 1.3 — blocked"]);
  const failed = finish(failedProject, 3, { status: "failed", note: "x" }).e;
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.reasons, { "1.3": "blocked" });
  // The file name comes from the policy; one of the wrong shape reads as the default.
  assert.deepEqual(withLedger((pr) => ledger(pr, ["- 1.3 — custom"], "why.md"), { policy: { manualVerify: { unprovenFile: "why.md" } } }).reasons, { "1.3": "custom" });
  assert.deepEqual(withLedger((pr) => ledger(pr, ["- 1.3 — default"]), { policy: { manualVerify: { unprovenFile: "../plan.md" } } }).reasons, { "1.3": "default" });
  assert.deepEqual(withLedger((pr) => ledger(pr, ["- 1.3 — default"]), { policy: { manualVerify: { unprovenFile: 7 } } }).reasons, { "1.3": "default" });
});

test("manual verify reasons merge", () => {
  const project = verifying({ manual: [A, B] });
  // First attempt: nothing ticked, a reason for each row.
  ledger(project, ["- 1.2 — first reason", "- 1.3 — only in the first attempt"]);
  const first = finish(project);
  assert.deepEqual(first.e.reasons, { "1.2": "first reason", "1.3": "only in the first attempt" });
  assert.equal(first.res.json.step, "manual-verify");
  // Second attempt: row 1.3 is proved, row 1.2 gets a new reason (the later entry wins).
  save(project, [A, ticked(B, "evidence/command-b.txt")]);
  evidence(project, "command-b.txt");
  const later = Date.now() / 1000 + 5;
  fs.utimesSync(ledger(project, ["- 1.2 — second reason"]), later, later);
  const second = finish(project, 4);
  assert.equal(second.e.ok, true, JSON.stringify(second.e));
  assert.deepEqual(second.e.reasons, { "1.2": "second reason" });
  assert.deepEqual(second.e.proved, [{ id: "1.3", kind: "command", file: "evidence/command-b.txt" }]);
  assert.deepEqual(second.e.pending, ["1.2"]);
  assert.equal(second.res.json.step, "impl-review");

  // The run ends done; only the row still pending is listed, with the merged reason. manualPending is unchanged.
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  const end = finish(project, 5);
  assert.equal(end.res.json.action, "done", end.res.stdout);
  const notProved = [`1.2 ${A} — not proved: second reason`];
  assert.deepEqual(end.res.json.manualNotProved, notProved);
  assert.deepEqual(end.res.json.manualPending, [`1.2 ${A}`]);
  assert.deepEqual(readMetaFile(project).outcome.manualNotProved, notProved);
  assert.equal("manualUnproven" in end.res.json, false);

  // report.md: the section lists the proved row by kind and the pending row with its reason, after the review findings.
  const report = readReportFile(project);
  const section = report.slice(report.indexOf("## Manual checks"));
  assert.ok(report.indexOf("## Review findings") >= 0 && report.indexOf("## Review findings") < report.indexOf("## Manual checks"), report);
  assert.match(section, /^Proved: 1$/m);
  assert.ok(section.includes(`- 1.3 ${B} — command (evidence/command-b.txt)`), section);
  assert.match(section, /^Not proved: 1$/m);
  assert.ok(section.includes(`- 1.2 ${A} — not proved: second reason`), section);
  assert.doesNotMatch(section, /only in the first attempt/);

  // status: proved per kind and pending, next to ticked and unproven.
  const rows = run(project, ["status", project.id]).json.steps.filter((s) => s.step === "manual-verify");
  assert.deepEqual(rows.map((s) => [s.ticked, s.unproven, s.proved, s.pending]), [[0, 0, {}, 2], [1, 0, { command: 1 }, 1]]);
  const other = run(project, ["status", project.id]).json.steps.find((s) => s.step === "impl-review");
  assert.equal("proved" in other, false);
});

test("manual checks report section", () => {
  const before = { autoDone: 1, manual: withId([A, B, "Look at it"], 1), auto: withId(AUTO, 0) };
  const project = mvProject({ manual: [ticked(A, "evidence/judgment-1.2.md"), B, ticked("Look at it", "evidence/x.txt")] });
  writeMetaFile(project, { id: project.id, goal: GOAL, rigor: { requested: "standard" } });
  writeLog(project, [
    entry(1, "score", { score: { cognitive: 2, execution: 2, factors: { ambiguity: 1 }, confidence: "medium", unknowns: 0 } }),
    entry(2, "plan"), entry(3, "plan-review", { review: { verdict: "SOUND", critical: 0, warnings: 0 } }), entry(4, "implement"),
    entry(5, "manual-verify", {
      before, ticked: ["1.2", "1.4"], unproven: [], pending: ["1.3"],
      proved: [{ id: "1.2", kind: "judgment", file: "evidence/judgment-1.2.md" }, { id: "1.4", kind: "other", file: "evidence/x.txt" }],
    }),
  ]);
  run(project, ["status", project.id, "--report"]);
  const report = readReportFile(project);
  const at = (h) => report.indexOf(h);
  assert.ok(at("## Review findings") < at("## Manual checks") && at("## Manual checks") < at("## Complexity score"), report);
  const section = report.slice(at("## Manual checks"), at("## Complexity score"));
  assert.ok(section.includes(`- 1.2 ${A} — judgment (evidence/judgment-1.2.md)`), section);
  assert.ok(section.includes("- 1.4 Look at it — other (evidence/x.txt)"), section);
  assert.ok(section.includes(`- 1.3 ${B} — not proved: no reason recorded`), section);
  // No manual-verify entry, no section.
  const none = mvProject();
  writeMetaFile(none, { id: none.id, goal: GOAL });
  run(none, ["status", none.id, "--report"]);
  assert.doesNotMatch(readReportFile(none), /## Manual checks/);
});

test("manual not proved reaches outputs", { skip: noGit }, () => {
  const before = { autoDone: 1, manual: withId([A, B], 1), auto: withId(AUTO, 0) };
  const mv = entry(4, "manual-verify", {
    template: "manual-verify", before, ticked: ["1.2"], unproven: [], pending: ["1.3"],
    proved: [{ id: "1.2", kind: "command", file: "evidence/command-a.txt" }],
    reasons: { "1.2": "proved later", "1.3": "needs a browser" },
  });
  // The unprovenProject fixture with row 1.2 proved, row 1.3 pending and, unless withStep is false, the manual-verify entry.
  const project = (archive, withStep = true) => {
    const pr = unprovenProject(archive);
    writePlan(pr, planOf([ticked(A, "evidence/command-a.txt"), B]));
    writeLog(pr, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), ...(withStep ? [mv] : []), entry(withStep ? 5 : 4, "impl-review")]);
    return pr;
  };
  const notProved = [`1.3 ${B} — not proved: needs a browser`];

  // Without --archive: the done output and meta.outcome.
  const plain = project(false);
  const done = run(plain, ["next", plain.id], { env: gitEnv(plain) });
  assert.equal(done.json.action, "done", done.stdout);
  assert.deepEqual(done.json.manualNotProved, notProved);
  assert.deepEqual(done.json.manualPending, [`1.3 ${B}`]);
  assert.deepEqual(readMetaFile(plain).outcome.manualNotProved, notProved);
  assert.doesNotMatch(readReportFile(plain), /Manual checks not proved/);
  assert.match(readReportFile(plain), /^## Manual checks$/m);

  // With --archive: the archive summary and the report lines, next to the unchanged pending lines.
  const archived = project(true);
  const res = run(archived, ["next", archived.id], { env: gitEnv(archived) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.deepEqual(res.json.summary.manualNotProved, notProved);
  assert.deepEqual(res.json.summary.manualPending, [`1.3 ${B}`]);
  assert.deepEqual(readMetaFile(archived).outcome.manualNotProved, notProved);
  const report = readReportFile(archived);
  assert.match(report, /^Manual checks pending: 1$/m);
  assert.ok(report.includes(`Manual checks not proved: 1\n- 1.3 ${B} — not proved: needs a browser`), report);

  // A run where the step never ran has none of the new keys or lines.
  const never = project(true, false);
  const plainRes = run(never, ["next", never.id], { env: gitEnv(never) });
  assert.equal(plainRes.json.action, "archive", plainRes.stdout);
  assert.equal("manualNotProved" in plainRes.json.summary, false);
  assert.equal("manualNotProved" in readMetaFile(never).outcome, false);
  assert.doesNotMatch(readReportFile(never), /Manual checks not proved|## Manual checks/);
});
