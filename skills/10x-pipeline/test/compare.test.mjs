// Tests for the baseline arm (baseline-policy.json), the compare policy key and usage intake.
// Black-box through the CLI in scratch projects. Test names start with the plan row number.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writePlan, run, init, next, writeResult, readLogEntries, readMetaFile,
  gitAvailable, gitEnv, gitInit, commitFiles, git, entry, skipEntry, writeLog, writeMetaFile,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SKILL_DIR, name), "utf8"));
const BASELINE = readJson("baseline-policy.json");
const DEFAULT = readJson("policy.json");

// ---- 1.1 baseline file guard -----------------------------------------------------

test("1.1 baseline file has exactly ladder and rigor, all sonnet/high, standard rigor, no plan-review skip", () => {
  assert.deepEqual(Object.keys(BASELINE).sort(), ["ladder", "rigor"]);
  for (const tier of BASELINE.ladder) assert.deepEqual(tier, { model: "sonnet", effort: "high" });
  const highestMax = Math.max(...Object.values(DEFAULT.steps).map((s) => s.maxTier));
  assert.ok(BASELINE.ladder.length >= highestMax + 1, "ladder covers every step maxTier");
  assert.ok(BASELINE.ladder.length >= DEFAULT.ladder.length, "ladder is as long as the default ladder");
  assert.deepEqual(Object.keys(BASELINE.rigor).sort(), ["fromGoal", "skipPlanReviewAt"]);
  assert.deepEqual(BASELINE.rigor.fromGoal, { short: "standard", plain: "standard", hard: "standard" });
  assert.deepEqual(BASELINE.rigor.skipPlanReviewAt, []);
});

// ---- 1.2 the file pins the first step, the default policy does not ----------------

function firstStep(goal, policy) {
  const project = makeProject({ policy });
  const res = init(project, goal);
  assert.equal(res.status, 0, res.stderr);
  return { res: res.json, rigor: readMetaFile(project).rigor.level };
}

test("1.2 baseline file starts a hard-keyword goal and a short goal at sonnet/high and standard", () => {
  const hardDefault = firstStep("refactor the auth module", null);
  assert.equal(hardDefault.res.step, "plan");
  assert.equal(hardDefault.res.model, "opus");
  assert.equal(hardDefault.res.effort, "high");
  const hardBase = firstStep("refactor the auth module", BASELINE);
  assert.equal(hardBase.res.step, "plan");
  assert.equal(hardBase.res.model, "sonnet");
  assert.equal(hardBase.res.effort, "high");
  assert.equal(hardBase.rigor, "standard");

  const shortDefault = firstStep("fix typo", null);
  assert.equal(shortDefault.res.model, "sonnet");
  assert.equal(shortDefault.res.effort, "medium");
  assert.equal(shortDefault.rigor, "lean");
  const shortBase = firstStep("fix typo", BASELINE);
  assert.equal(shortBase.res.model, "sonnet");
  assert.equal(shortBase.res.effort, "high");
  assert.equal(shortBase.rigor, "standard");
});

// ---- 1.3 plan review is skipped by default and not under the baseline file -------

const noGit = !gitAvailable() && "git is not installed";

function gitProject(policy) {
  const project = makeProject({ policy });
  gitInit(project);
  for (let i = 1; i <= 10; i++) commitFiles(project, [`s${i}.js`], { message: `c${i}` });
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

function afterPlan(policy) {
  const project = gitProject(policy);
  const first = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(first.json.step, "plan");
  finishPlan(project, planText({ files: ["**File**: `x.js`"] }));
  const second = withGit(project, ["next", project.id]);
  return { project, second };
}

test("1.3 plan review is skipped under the default policy and runs at sonnet/high under the baseline file", { skip: noGit }, () => {
  const control = afterPlan(null);
  assert.equal(control.second.json.step, "implement");
  const skips = readLogEntries(control.project).filter((e) => e.skipped);
  assert.equal(skips.length, 1);
  assert.equal(skips[0].step, "plan-review");

  const baseline = afterPlan(BASELINE);
  assert.equal(baseline.second.json.step, "plan-review");
  assert.equal(baseline.second.json.model, "sonnet");
  assert.equal(baseline.second.json.effort, "high");
  assert.equal(readLogEntries(baseline.project).filter((e) => e.skipped).length, 0);
});

// ---- 1.4 usage intake --------------------------------------------------------------

function planStepWithResult(extra) {
  const project = makeProject();
  assert.equal(init(project, "fix typo").status, 0);
  writePlan(project, planText());
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned", ...extra });
  const res = next(project);
  assert.equal(res.status, 0, res.stderr);
  return readLogEntries(project).find((e) => e.step === "plan");
}

test("1.4 usage intake keeps valid figures, drops invalid ones, leaves no key when absent", () => {
  const good = planStepWithResult({ usage: { totalTokens: 1000, toolUses: 3, durationMs: 500 } });
  assert.deepEqual(good.usage, { totalTokens: 1000, toolUses: 3, durationMs: 500 });

  const mixed = planStepWithResult({ usage: { totalTokens: -5, toolUses: 1.5, durationMs: "x" } });
  assert.equal(mixed.usage, undefined);

  const partial = planStepWithResult({ usage: { totalTokens: 42, toolUses: -1, durationMs: 2.5 } });
  assert.deepEqual(partial.usage, { totalTokens: 42 });

  const none = planStepWithResult({});
  assert.equal("usage" in none, false);
});

// ---- 1.5 shipped policy ------------------------------------------------------------

test("1.5 policy.json ships compare.targetDropPercent as null", () => {
  assert.deepEqual(DEFAULT.compare, { targetDropPercent: null });
});

// ---- Phase 2: compare -------------------------------------------------------------

// A scratch project that models one checkout: a run log of executed entries, a meta file and extra change files.
// `totals` is a list of totalTokens (a null item gives an entry with no usage); `over` replaces entry fields.
function side({ totals = [], over = {}, meta = {}, files = {}, policy = null, id = "demo", skips = [], raw = null } = {}) {
  const project = makeProject({ id, policy });
  if (raw !== null) {
    fs.mkdirSync(project.agentDir, { recursive: true });
    fs.writeFileSync(path.join(project.agentDir, "run.jsonl"), raw);
  } else {
    const steps = ["plan", "plan-review", "implement", "impl-review", "fix"];
    const entries = totals.map((t, i) => entry(i + 1, steps[i % steps.length], {
      ...(t === null ? {} : { usage: { totalTokens: t, toolUses: 2, durationMs: 100 } }),
      ...over,
    }));
    skips.forEach((s, i) => entries.push(skipEntry(s, i + 1)));
    writeLog(project, entries);
  }
  writeMetaFile(project, { id, goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" }, ...meta });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(project.changeDir, name), text);
  return project;
}

// `compare` run from the routed project against the baseline project.
const compare = (routed, baseline, extra = []) => run(routed, ["compare", routed.id, "--baseline", baseline.root, ...extra]);
const targetPolicy = (t) => ({ compare: { targetDropPercent: t } });

test("2.1 a complete done pair gives the drop, and the default policy leaves the target unset", () => {
  const res = compare(side({ totals: [250, 350] }), side({ totals: [400, 600] }));
  assert.equal(res.status, 0, res.stderr);
  const j = res.json;
  assert.equal(j.comparable, true);
  assert.deepEqual(j.reasons, []);
  assert.equal(j.dropPercent, 40);
  assert.equal(j.targetDropPercent, null);
  assert.equal(j.verdict, "target not set");
  assert.equal(j.pinned, true);
  assert.equal(j.baseline.tokens.total, 1000);
  assert.equal(j.routed.tokens.total, 600);
  assert.equal(j.baseline.steps, 2);
  assert.deepEqual(j.baseline.tokens.byModel, { sonnet: 1000 });
  assert.equal(j.baseline.toolUses.total, 4);
  assert.equal(j.baseline.durationMs.stepsWithFigures, 2);
  assert.equal(j.routed.source, "changes");
});

function verdictFor(baselineTotal, routedTotal, target) {
  const res = compare(side({ totals: [routedTotal], policy: targetPolicy(target) }), side({ totals: [baselineTotal] }));
  assert.equal(res.status, 0, res.stderr);
  return res.json;
}

test("2.2 the target verdict is decided on exact tokens and the printed drop never reads above a missed target", () => {
  assert.equal(verdictFor(100, 71, 29).verdict, "met");
  assert.equal(verdictFor(100, 72, 29).verdict, "not met");
  assert.equal(verdictFor(1000, 705, 29.5).verdict, "met");
  assert.equal(verdictFor(1000, 706, 29.5).verdict, "not met");
  const worse = verdictFor(100, 130, 29);
  assert.equal(worse.dropPercent, -30);
  assert.equal(worse.verdict, "not met");
  const missed = verdictFor(100000, 71004, 29);
  assert.equal(missed.dropPercent, 28.99);
  assert.equal(missed.verdict, "not met");
  const hit = verdictFor(100000, 71000, 29);
  assert.equal(hit.dropPercent, 29);
  assert.equal(hit.verdict, "met");
  // Round-3 amendment F1: a 2-decimal target that a wide relative slack would call met.
  const f1 = verdictFor(1004202, 712883, 29.01);
  assert.equal(f1.dropPercent, 29);
  assert.equal(f1.verdict, "not met");
  assert.equal(verdictFor(1000, 1000, 0).verdict, "met");
  assert.equal(verdictFor(1000, 0, 100).verdict, "met");
  assert.equal(verdictFor(1000, 1001, 0).verdict, "not met");
});

test("2.2 boundary sweep: printed drop is at least the target exactly when the verdict is met", () => {
  for (const target of [29.01, 29, 0.07, 33.33, 99.99]) {
    const cents = BigInt(Math.round(target * 100));
    for (const baseline of [1004202, 100000, 120000000]) {
      const need = (cents * BigInt(baseline) + 9999n) / 10000n; // smallest diff that meets the target
      for (let off = -2; off <= 2; off++) {
        const diff = Number(need) + off;
        if (diff < 0 || diff > baseline) continue;
        const j = verdictFor(baseline, baseline - diff, target);
        const truth = BigInt(diff) * 10000n >= cents * BigInt(baseline);
        const label = `baseline ${baseline} diff ${diff} target ${target}`;
        assert.equal(j.verdict, truth ? "met" : "not met", label);
        assert.equal(j.dropPercent >= target, truth, label);
        assert.ok(Math.abs(j.dropPercent * 100 - Math.round(j.dropPercent * 100)) < 1e-6, `at most 2 decimals: ${label}`);
      }
    }
  }
});

test("2.2 a null target and a compare block of null or without the key do not halt", () => {
  const unset = compare(side({ totals: [600], policy: { compare: null } }), side({ totals: [1000] }));
  assert.equal(unset.status, 0, unset.stderr);
  assert.equal(unset.json.verdict, "target not set");
  assert.equal(unset.json.targetDropPercent, null);
  const empty = compare(side({ totals: [600], policy: { compare: {} } }), side({ totals: [1000] }));
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.json.verdict, "target not set");
});

test("2.3 missing or invalid usage on any executed entry makes the pair not comparable and keeps the partial sums", () => {
  const good = side({ totals: [100, 100] });
  const missing = compare(side({ totals: [100, null, 50] }), good);
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(missing.json.comparable, false);
  assert.equal(missing.json.dropPercent, null);
  assert.equal(missing.json.verdict, "not comparable");
  assert.ok(missing.json.reasons.includes("usage-incomplete:routed"));
  assert.ok(!missing.json.reasons.includes("usage-incomplete:baseline"));
  assert.equal(missing.json.routed.tokens.total, 150);
  assert.equal(missing.json.routed.tokens.stepsWithFigures, 2);
  assert.equal(missing.json.routed.steps, 3);

  for (const bad of [-1, 1.5, "x", 2 ** 60, null]) {
    const project = side({ totals: [100] });
    writeLog(project, [entry(1, "plan", { usage: { totalTokens: bad, toolUses: 1, durationMs: 2 } })]);
    const res = compare(good, project);
    assert.equal(res.json.comparable, false, `bad value ${bad}`);
    assert.ok(res.json.reasons.includes("usage-incomplete:baseline"), `bad value ${bad}`);
    assert.equal(res.json.baseline.tokens.total, 0);
    assert.equal(res.json.baseline.toolUses.total, 1);
    assert.equal(res.json.baseline.durationMs.total, 2);
  }

  // Tool uses and duration carry their own coverage counts.
  const proj = side({ totals: [100] });
  writeLog(proj, [
    entry(1, "plan", { usage: { totalTokens: 10, toolUses: 3 } }),
    entry(2, "implement", { usage: { totalTokens: 20, durationMs: 7 } }),
  ]);
  const cov = compare(good, proj).json.baseline;
  assert.deepEqual(cov.toolUses, { total: 3, stepsWithFigures: 1 });
  assert.deepEqual(cov.durationMs, { total: 7, stepsWithFigures: 1 });

  // An entry with no model lands under byModel.unknown.
  const nomodel = side({ totals: [100] });
  writeLog(nomodel, [entry(1, "plan", { model: undefined, usage: { totalTokens: 5 } }), entry(2, "implement", { usage: { totalTokens: 6 } })]);
  assert.deepEqual(compare(good, nomodel).json.baseline.tokens.byModel, { unknown: 5, sonnet: 6 });
});

test("2.4 the baseline pin looks at executed entries; skip entries only warn", () => {
  const routed = side({ totals: [100] });
  const haiku = compare(routed, side({ totals: [200], over: { model: "haiku" } }));
  assert.equal(haiku.json.pinned, false);
  assert.ok(haiku.json.reasons.includes("baseline-not-pinned"));
  assert.equal(haiku.json.verdict, "not comparable");
  const medium = compare(routed, side({ totals: [200], over: { effort: "medium" } }));
  assert.equal(medium.json.pinned, false);
  assert.ok(medium.json.reasons.includes("baseline-not-pinned"));

  const skipped = compare(routed, side({ totals: [200, 200], skips: ["plan-review"] }));
  assert.equal(skipped.json.pinned, true);
  assert.equal(skipped.json.comparable, true);
  assert.ok(skipped.json.warnings.includes("baseline-skipped-steps:1"));
  assert.deepEqual(skipped.json.baseline.skipped, ["plan-review"]);
  assert.equal(skipped.json.baseline.steps, 2);

  const none = compare(routed, side({ totals: [], skips: ["plan-review"] }));
  assert.equal(none.json.pinned, false);
  assert.ok(none.json.reasons.includes("no-steps:baseline"));
  assert.ok(!none.json.reasons.includes("baseline-not-pinned"));
});

test("2.5 a side that did not end done is not comparable and lists its outcome", () => {
  const good = side({ totals: [100] });
  const halted = compare(side({ totals: [50], meta: { outcome: { action: "halt" } } }), good);
  assert.ok(halted.json.reasons.includes("outcome-not-done:routed"));
  assert.equal(halted.json.routed.outcome, "halt");
  assert.equal(halted.json.dropPercent, null);
  const open = compare(good, side({ totals: [50], meta: { outcome: undefined } }));
  assert.ok(open.json.reasons.includes("outcome-not-done:baseline"));
  assert.equal(open.json.baseline.outcome, null);
  assert.equal(open.json.verdict, "not comparable");
});

test("2.6 mismatches only warn and the numbers are kept", () => {
  const baseline = side({ totals: [1000], files: { "research.md": "r\n", "plan.md": "# P\n", "plan-brief.md": "b\n" } });
  const routed = side({ totals: [600], meta: { goal: "other goal", baseSha: "b".repeat(40) }, files: { "plan.md": "# Plan\n" } });
  const res = compare(routed, baseline);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.comparable, true);
  assert.equal(res.json.dropPercent, 40);
  for (const w of ["goal-mismatch", "baseSha-mismatch", "input-files-differ:research.md"]) assert.ok(res.json.warnings.includes(w), w);
  const same = compare(side({ totals: [600] }), side({ totals: [1000], files: { "plan.md": "x\n", "plan-brief.md": "y\n" } }));
  assert.deepEqual(same.json.warnings, []);

  // A live folder and an archived folder for one side: the live one is read.
  const both = side({ totals: [600] });
  const archived = path.join(both.root, "context/archive/2026-10-30-demo/agent-smith");
  fs.mkdirSync(archived, { recursive: true });
  fs.writeFileSync(path.join(archived, "run.jsonl"), JSON.stringify(entry(1, "plan", { usage: { totalTokens: 9999 } })) + "\n");
  const res2 = compare(both, side({ totals: [1000] }));
  assert.ok(res2.json.warnings.includes("archive-also-present:routed"));
  assert.equal(res2.json.routed.source, "changes");
  assert.equal(res2.json.routed.tokens.total, 600);
});

test("2.7 a zero baseline, an empty log and garbage lines do not throw", () => {
  const zero = compare(side({ totals: [0] }), side({ totals: [0] }));
  assert.equal(zero.status, 0, zero.stderr);
  assert.equal(zero.json.dropPercent, null);
  assert.ok(zero.json.reasons.includes("baseline-total-zero"));
  assert.equal(zero.json.verdict, "not comparable");

  const empty = compare(side({ totals: [100] }), side({ raw: "" }));
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.json.dropPercent, null);
  assert.ok(empty.json.reasons.includes("no-steps:baseline"));

  const garbage = `not json\n${JSON.stringify(entry(1, "plan", { usage: { totalTokens: 500 } }))}\n[1,2]\n{"broken"\n`;
  const res = compare(side({ totals: [100] }), side({ raw: garbage }));
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.baseline.steps, 1);
  assert.equal(res.json.baseline.tokens.total, 500);
});

// A project whose routed run lives only in context/archive/<name>, with an optional log.
function archivedProject(names, { log = null } = {}) {
  const project = makeProject({ id: "demo" });
  fs.rmSync(project.changeDir, { recursive: true });
  for (const name of names) fs.mkdirSync(path.join(project.root, "context/archive", name, "agent-smith"), { recursive: true });
  if (log) {
    const agentDir = path.join(project.root, "context/archive", names[0], "agent-smith");
    writeLog({ agentDir }, log);
    writeMetaFile({ agentDir }, { goal: "fix typo", baseSha: "a".repeat(40), outcome: { action: "done" } });
  }
  return project;
}

test("2.8 side lookup: archive, agent-smith folder, relative dir, ambiguity, near misses and a missing log", () => {
  const baseline = side({ totals: [1000] });

  const arch = archivedProject(["2026-10-30-demo"], { log: [entry(1, "plan", { usage: { totalTokens: 600 } })] });
  const fromArchive = compare(arch, baseline);
  assert.equal(fromArchive.status, 0, fromArchive.stderr);
  assert.equal(fromArchive.json.routed.source, "archive");
  assert.equal(fromArchive.json.routed.tokens.total, 600);
  assert.equal(fromArchive.json.dropPercent, 40);

  // The agent-smith folder itself, and a relative project dir.
  const routed = side({ totals: [600] });
  const folder = run(routed, ["compare", "demo", "--baseline", baseline.agentDir, "--routed", routed.agentDir]);
  assert.equal(folder.status, 0, folder.stderr);
  assert.equal(folder.json.baseline.source, "folder");
  assert.equal(folder.json.routed.source, "folder");
  const rel = run(routed, ["compare", "demo", "--baseline", path.relative(routed.root, baseline.root)]);
  assert.equal(rel.status, 0, rel.stderr);
  assert.equal(rel.json.baseline.tokens.total, 1000);

  // Two archive folders for one id halt and list both.
  const two = compare(routed, archivedProject(["2026-10-29-demo", "2026-10-30-demo"]));
  assert.equal(two.status, 1);
  assert.equal(two.json.action, "halt");
  assert.match(two.json.reason, /2026-10-29-demo/);
  assert.match(two.json.reason, /2026-10-30-demo/);

  // Near-miss archive names are not this change.
  const near = archivedProject(["2026-10-30-other-demo", "2026-10-30-demo-x"]);
  for (const d of ["2026-10-30-other-demo", "2026-10-30-demo-x"]) {
    fs.writeFileSync(path.join(near.root, "context/archive", d, "agent-smith/run.jsonl"), "{}\n");
  }
  const nearRes = compare(routed, near);
  assert.equal(nearRes.status, 1);
  assert.match(nearRes.json.reason, /no run\.jsonl/);

  // A missing run.jsonl halts and names the paths tried.
  const missing = compare(routed, makeProject({ id: "demo" }));
  assert.equal(missing.status, 1);
  assert.equal(missing.json.action, "halt");
  assert.match(missing.json.reason, /run\.jsonl/);
});

function snapshot(dir) {
  const rows = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      rows.push(`${p} ${st.isDirectory() ? "dir" : st.size} ${st.mtimeMs}`);
      if (st.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return rows.join("\n");
}

test("2.9 compare writes nothing and rejects missing flag values and an invalid target", () => {
  const baseline = side({ totals: [1000] });
  const routed = side({ totals: [600] });
  const before = [snapshot(baseline.base), snapshot(routed.base)];
  const ok = compare(routed, baseline);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual([snapshot(baseline.base), snapshot(routed.base)], before);

  const cases = [
    ["compare", "demo"],
    ["compare", "demo", "--baseline"],
    ["compare", "demo", "--baseline", baseline.root, "--routed"],
    ["compare", "demo", "--baseline", baseline.root, "--format"],
  ];
  for (const args of cases) {
    const res = run(routed, args);
    assert.equal(res.status, 1, args.join(" "));
    assert.equal(res.json.action, "halt");
  }
  for (const bad of [-5, "x", 150, true, [29]]) {
    const proj = side({ totals: [600], policy: targetPolicy(bad) });
    const res = compare(proj, baseline);
    assert.equal(res.status, 1, `target ${JSON.stringify(bad)}`);
    assert.match(res.json.reason, /targetDropPercent/);
  }
  assert.deepEqual([snapshot(baseline.base), snapshot(routed.base)], before);
});

test("2.10 a routed folder moved with git mv is read from the archive, ignored or tracked run.jsonl", { skip: noGit }, () => {
  for (const ignored of [true, false]) {
    const routed = side({ totals: [600] });
    gitInit(routed);
    if (ignored) fs.writeFileSync(path.join(routed.base, ".gitignore"), "run.jsonl\n");
    git(routed, ["add", "-A"]);
    git(routed, ["commit", "-q", "-m", "change folder"]);
    fs.mkdirSync(path.join(routed.base, "context/archive"), { recursive: true });
    git(routed, ["mv", "context/changes/demo", "context/archive/2026-10-31-demo"]);
    assert.equal(fs.existsSync(routed.changeDir), false);
    const res = compare(routed, side({ totals: [1000] }));
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.json.routed.source, "archive", `ignored ${ignored}`);
    assert.equal(res.json.routed.tokens.total, 600);
    assert.equal(res.json.dropPercent, 40);
  }
});

test("2.11 a log written by the real router under the baseline file is read with the written total", () => {
  const baseline = makeProject({ policy: BASELINE });
  assert.equal(init(baseline, "fix typo").status, 0);
  writePlan(baseline, planText());
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(baseline.planFile, later, later);
  writeResult(baseline, { status: "done", note: "planned", usage: { totalTokens: 1234, toolUses: 2, durationMs: 50 } });
  assert.equal(next(baseline).status, 0);
  const res = run(side({ totals: [600] }), ["compare", "demo", "--baseline", baseline.root]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.json.baseline.steps >= 1);
  assert.equal(res.json.baseline.tokens.total, 1234);
  assert.equal(res.json.pinned, true);
  assert.equal(res.json.verdict, "not comparable");
  assert.ok(res.json.reasons.includes("outcome-not-done:baseline"));
});
