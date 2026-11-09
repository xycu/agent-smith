// Tests for run provenance: the record in meta.json, drift, legacy runs and the compare warnings.
// Black-box through the CLI in scratch projects. Test names start with the plan row number.
// A test that changes a plugin file (a prompt, plugin.json, agents/) edits a scratch copy of the plugin tree and
// spawns that copy's route.mjs. The repository files are never edited.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, run, init, next, writeResult, readMetaFile,
  writeMetaFile, writeLog, writeOverride, entry,
} from "./helpers.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SKILL_DIR, "../..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const DEFAULT = readJson(path.join(SKILL_DIR, "policy.json"));
const BASELINE = readJson(path.join(SKILL_DIR, "baseline-policy.json"));
const PLUGIN = readJson(path.join(REPO, ".claude-plugin/plugin.json"));
const HEX16 = /^[0-9a-f]{16}$/;
// chrome is the effective setting: on unless the run stored --chrome false.
const NO_FLAGS = { archive: false, chrome: true, "score.minRigor": null, "agents.restricted": false, "advisor.enabled": false };

const copies = [];
after(() => {
  cleanupAll();
  for (const dir of copies.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Sets a file's mtime 5 s ahead, so the router sees it as written after the step started.
function later(file) {
  const t = new Date(Date.now() + 5000);
  fs.utimesSync(file, t, t);
}

// Plan step done: plan.md written after the step started, result "done".
function finishPlan(project, text = planText()) {
  writePlan(project, text);
  later(project.planFile);
  writeResult(project, { status: "done", note: "planned" });
}

// The record a fresh init writes in a scratch project with this override.
function freshRecord(policy = null, goal = "fix typo") {
  const project = makeProject({ policy });
  const res = init(project, goal);
  assert.equal(res.status, 0, res.stdout);
  return readMetaFile(project).provenance;
}

// ---- scratch copy of the plugin tree ---------------------------------------------------

// skills/10x-pipeline (without its tests), .claude-plugin and, when it exists, agents, with the same relative layout.
function pluginCopy() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-plugin-"));
  copies.push(root);
  const skill = path.join(root, "skills/10x-pipeline");
  const tests = path.join(SKILL_DIR, "test");
  fs.cpSync(SKILL_DIR, skill, { recursive: true, filter: (src) => src !== tests });
  fs.cpSync(path.join(REPO, ".claude-plugin"), path.join(root, ".claude-plugin"), { recursive: true });
  if (fs.existsSync(path.join(REPO, "agents"))) fs.cpSync(path.join(REPO, "agents"), path.join(root, "agents"), { recursive: true });
  return { root, skill, route: path.join(skill, "scripts/route.mjs") };
}

// Runs the copy's route.mjs in the project root, as helpers.run does for the real one.
function runCopy(copy, project, args) {
  const res = spawnSync(process.execPath, [copy.route, ...args], { cwd: project.root, encoding: "utf8", env: process.env });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* leave null */ }
  return { status: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

function copyRecord(copy, policy = null) {
  const project = makeProject({ policy });
  const res = runCopy(copy, project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.status, 0, res.stdout);
  return readMetaFile(project).provenance;
}

// ---- 1.1 the record --------------------------------------------------------------------

test("1.1 policy.json ships the provenance block", () => {
  assert.deepEqual(DEFAULT.provenance, { ignore: ["compare", "provenance", "prices"], expected: { pinned: ["ladder", "rigor", "score"], unpinned: ["score"] } });
});

test("1.1 a fresh init writes schemaVersion, plugin, a hash per section except the ignored ones, prompts, agentFiles and flags", () => {
  const rec = freshRecord();
  assert.deepEqual(Object.keys(rec).sort(), ["flags", "plugin", "schemaVersion", "sections"]);
  assert.equal(rec.schemaVersion, 1);
  assert.equal(rec.plugin, PLUGIN.version);
  const want = [...Object.keys(DEFAULT).filter((k) => k !== "compare" && k !== "provenance" && k !== "prices"), "agentFiles"].sort();
  assert.ok(want.includes("prompts"));
  assert.deepEqual(Object.keys(rec.sections), want, "every section but compare, provenance and prices, sorted");
  for (const [name, hash] of Object.entries(rec.sections)) {
    if (name === "agentFiles") assert.ok(hash === null || HEX16.test(hash), `agentFiles ${hash}`);
    else assert.match(hash, HEX16, name);
  }
  assert.equal(new Set(Object.values(rec.sections).filter((h) => h !== null)).size, want.length - (rec.sections.agentFiles === null ? 1 : 0), "distinct sections give distinct hashes");
  assert.deepEqual(rec.flags, NO_FLAGS);
});

test("1.1 flags read the stored meta values and the merged policy, and a missing or malformed flag reads false", () => {
  const on = makeProject({ policy: { score: { minRigor: "thorough" }, agents: { restricted: true }, advisor: { enabled: true } } });
  assert.equal(init(on, "fix typo", ["--chrome"]).status, 0);
  assert.deepEqual(readMetaFile(on).provenance.flags, {
    archive: false, chrome: true, "score.minRigor": "thorough", "agents.restricted": true, "advisor.enabled": true,
  });
  assert.match(readMetaFile(on).provenance.sections.agents, HEX16);
  assert.match(readMetaFile(on).provenance.sections.advisor, HEX16);

  const malformed = freshRecord({ score: "off", agents: { restricted: "yes" }, advisor: true });
  assert.deepEqual(malformed.flags, NO_FLAGS);
  const shipped = freshRecord({ score: {} });
  assert.equal(shipped.flags["score.minRigor"], DEFAULT.score.minRigor);
});

test("1.1 a run with no executed step and no record gets one at init", () => {
  const project = makeProject();
  writeMetaFile(project, { id: project.id, goal: "fix typo" });
  const res = init(project, "fix typo");
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(readMetaFile(project).provenance, freshRecord());
});

test("1.1 computing the record never halts: a bad prompt reference records prompts null and checkPrompts halts as before", () => {
  const project = makeProject({ policy: { prompts: { "plan-review": ["@prompts/does-not-exist.md"] } } });
  const res = init(project, "fix typo");
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /^Router error: policy\.prompts\.plan-review /);
  const rec = readMetaFile(project).provenance;
  assert.equal(rec.sections.prompts, null);
  const good = freshRecord();
  assert.deepEqual({ ...rec.sections, prompts: good.sections.prompts }, good.sections);
  // After the fix a resume starts the run. The stored record is not rewritten: prompts stays null, the section drifts.
  writeOverride(project, {});
  const fixed = init(project, "fix typo");
  assert.equal(fixed.status, 0, fixed.stdout);
  assert.equal(fixed.json.step, "plan");
  assert.equal(readMetaFile(project).provenance.sections.prompts, null);
  assert.deepEqual(readMetaFile(project).provenance.drift, ["prompts"]);
});

test("1.1 an unreadable plugin.json gives plugin null, and agentFiles hashes agents/*.md or is null without a readable folder", () => {
  const copy = pluginCopy();
  const manifest = path.join(copy.root, ".claude-plugin/plugin.json");
  fs.writeFileSync(manifest, "{ not json");
  assert.equal(copyRecord(copy).plugin, null);
  fs.rmSync(manifest);
  assert.equal(copyRecord(copy).plugin, null);

  const agents = path.join(copy.root, "agents");
  fs.rmSync(agents, { recursive: true, force: true });
  assert.equal(copyRecord(copy).sections.agentFiles, null, "no agents folder");
  fs.writeFileSync(agents, "a file, not a folder\n");
  assert.equal(copyRecord(copy).sections.agentFiles, null, "agents is not a folder");
  fs.rmSync(agents);
  fs.mkdirSync(agents);
  fs.writeFileSync(path.join(agents, "score.md"), "---\nname: score\n---\nScore.\n");
  const first = copyRecord(copy).sections.agentFiles;
  assert.match(first, HEX16);
  fs.writeFileSync(path.join(agents, "notes.txt"), "not a definition\n");
  assert.equal(copyRecord(copy).sections.agentFiles, first, "only *.md files count");
  fs.appendFileSync(path.join(agents, "score.md"), "More.\n");
  assert.notEqual(copyRecord(copy).sections.agentFiles, first, "an edit changes the hash");
});

// ---- 1.2 stability and sensitivity ---------------------------------------------------------

test("1.2 the hashes are stable across runs with identical inputs, and a copy of the plugin elsewhere records the same", () => {
  const a = freshRecord();
  assert.deepEqual(freshRecord(), a);
  assert.deepEqual(freshRecord(null, "refactor the auth module so it can be tested"), a, "the goal is not part of the record");
  assert.deepEqual(copyRecord(pluginCopy()), a);
});

test("1.2 editing prompts/score.md changes only prompts", () => {
  const a = freshRecord();
  const copy = pluginCopy();
  fs.appendFileSync(path.join(copy.skill, "prompts/score.md"), "\nOne more line.\n");
  const edited = copyRecord(copy);
  assert.match(edited.sections.prompts, HEX16);
  assert.notEqual(edited.sections.prompts, a.sections.prompts);
  assert.deepEqual({ ...edited, sections: { ...edited.sections, prompts: a.sections.prompts } }, a);
});

test("1.2 changing compare.targetDropPercent or the provenance block changes nothing; another section changes only its own hash", () => {
  const a = freshRecord();
  assert.deepEqual(freshRecord({ compare: { targetDropPercent: 30 } }), a);
  assert.deepEqual(freshRecord({ provenance: { expected: { pinned: ["steps"] } } }), a);
  const limits = freshRecord({ limits: { maxPlanRevisions: 1 } });
  const differs = Object.keys(a.sections).filter((name) => a.sections[name] !== limits.sections[name]);
  assert.deepEqual(differs, ["limits"]);
  const prompt = freshRecord({ prompts: { "plan-review": "Review the plan of change {id}." } });
  assert.deepEqual(Object.keys(a.sections).filter((name) => a.sections[name] !== prompt.sections[name]), ["prompts"]);
  // A changed ignore list hashes the section it no longer ignores.
  const hashed = freshRecord({ provenance: { ignore: ["provenance"] } });
  assert.match(hashed.sections.compare, HEX16);
  // A list that is not an array of strings reads as the default.
  assert.deepEqual(freshRecord({ provenance: { ignore: "compare" } }), a);
  assert.deepEqual(freshRecord({ provenance: { ignore: [1] } }), a);
});

// ---- 1.3 resume and drift ------------------------------------------------------------------

test("1.3 a resume keeps the record, and a policy edit between steps adds its section to drift once and keeps the hashes", () => {
  const project = makeProject();
  assert.equal(init(project, "fix typo").json.step, "plan");
  const rec = readMetaFile(project).provenance;
  assert.ok(isObject(rec));

  // A resume with --chrome false consumes the plan result and changes the stored value. The record, its flags included,
  // stays as written.
  finishPlan(project);
  const resumed = init(project, "fix typo", ["--chrome", "false"]);
  assert.equal(resumed.status, 0, resumed.stdout);
  assert.equal(resumed.json.step, "plan-review");
  assert.equal(readMetaFile(project).chrome, false);
  assert.deepEqual(readMetaFile(project).provenance, rec);

  // A policy edit between steps: the next `next` names the section, the hashes stay.
  writeOverride(project, { limits: { maxPlanRevisions: 1 } });
  writeResult(project, { status: "failed", note: "x" });
  assert.equal(next(project).json.step, "plan-review");
  const once = readMetaFile(project).provenance;
  assert.deepEqual(once.drift, ["limits"]);
  const { drift, ...kept } = once;
  assert.deepEqual(kept, rec);

  // The same edit at a later `next` does not repeat the name.
  writeResult(project, { status: "failed", note: "x" });
  assert.equal(next(project).json.step, "plan-review");
  assert.deepEqual(readMetaFile(project).provenance.drift, ["limits"]);

  // Reverting keeps the name; a prompt edit adds prompts, sorted. The halt at the third failure writes it too.
  writeOverride(project, { prompts: { "plan-review": "Review the plan of change {id}." } });
  writeResult(project, { status: "failed", note: "x" });
  const ended = next(project);
  assert.equal(ended.json.action, "halt");
  const last = readMetaFile(project).provenance;
  assert.deepEqual(last.drift, ["limits", "prompts"]);
  assert.deepEqual(last.sections, rec.sections);
  assert.deepEqual(last.flags, rec.flags);
  assert.equal(last.plugin, rec.plugin);
});

test("1.3 next writes meta.json for drift only when the drift list changes", () => {
  const project = makeProject();
  assert.equal(init(project, "fix typo").json.step, "plan");
  const metaFile = path.join(project.agentDir, "meta.json");
  const past = new Date("2000-01-01T00:00:00Z");
  const untouched = () => fs.statSync(metaFile).mtimeMs === past.getTime();

  // No edit: nothing in meta.json changes, so the file is not written.
  fs.utimesSync(metaFile, past, past);
  finishPlan(project);
  assert.equal(next(project).json.step, "plan-review");
  assert.ok(untouched(), "no drift, no write");
  assert.equal("drift" in readMetaFile(project).provenance, false, "drift is omitted while empty");

  // An edit: the drift list changes, so the file is written.
  writeOverride(project, { limits: { maxPlanRevisions: 1 } });
  fs.utimesSync(metaFile, past, past);
  writeReview(project, "plan-review");
  later(path.join(project.changeDir, "reviews/plan-review.md"));
  writeResult(project, { status: "done", note: "reviewed" });
  assert.equal(next(project).json.step, "implement");
  assert.ok(!untouched(), "drift changed, meta.json written");
  assert.deepEqual(readMetaFile(project).provenance.drift, ["limits"]);

  // The same edit again: the list is unchanged, so the file is not written.
  fs.utimesSync(metaFile, past, past);
  writePlan(project, planText({ done: 1 }));
  writeResult(project, { status: "done", note: "implemented" });
  assert.equal(next(project).json.step, "impl-review");
  assert.ok(untouched(), "unchanged drift, no write");
});

// ---- 1.4 legacy runs -----------------------------------------------------------------------

test("1.4 a run whose log holds executed steps and has no record gets none, and nothing halts for it", () => {
  const project = makeProject();
  assert.equal(init(project, "fix typo").json.step, "plan");
  const { provenance, ...legacy } = readMetaFile(project);
  assert.ok(isObject(provenance));
  writeMetaFile(project, legacy); // as written by a router from before provenance existed

  finishPlan(project);
  const resumed = init(project, "fix typo");
  assert.equal(resumed.status, 0, resumed.stdout);
  assert.equal(resumed.json.step, "plan-review");
  assert.equal(Object.hasOwn(readMetaFile(project), "provenance"), false, "init gives a legacy run no record");

  writeOverride(project, { limits: { maxPlanRevisions: 1 } });
  writeResult(project, { status: "failed", note: "x" });
  const stepped = next(project);
  assert.equal(stepped.status, 0, stepped.stdout);
  assert.equal(stepped.json.action, "run");
  assert.equal(Object.hasOwn(readMetaFile(project), "provenance"), false, "next gives no record and no drift");

  const res = run(project, ["compare", project.id, "--baseline", side({ totals: [1000], meta: { provenance: freshRecord() } }).root]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.routed.provenance, null);
  assert.ok(res.json.warnings.includes("provenance-unknown:routed"), res.json.warnings.join(","));
});

test("1.4 a log with executed steps and no meta.json at all gets no record", () => {
  const project = makeProject();
  // A plan step that started and has no result yet: JSON drops the undefined fields.
  writeLog(project, [entry(1, "plan", { result: undefined, ok: undefined, verified: undefined, finishedAt: undefined })]);
  finishPlan(project);
  const res = init(project, "fix typo");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal(Object.hasOwn(readMetaFile(project), "provenance"), false);
});

// ---- 1.5 and 1.6 compare ---------------------------------------------------------------------

// A scratch project that models one checkout, as in compare.test.mjs: executed entries with usage and a meta file.
function side({ totals = [600], meta = {}, policy = null } = {}) {
  const project = makeProject({ policy });
  const steps = ["plan", "implement"];
  writeLog(project, totals.map((t, i) => entry(i + 1, steps[i % steps.length], { usage: { totalTokens: t, toolUses: 1, durationMs: 1 } })));
  writeMetaFile(project, { id: project.id, goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" }, ...meta });
  return project;
}

// `compare` run from the routed project against the baseline project.
const compare = (routed, baseline, extra = []) => run(routed, ["compare", routed.id, "--baseline", baseline.root, ...extra]);

// The output fields provenance must never change.
const verdictOf = (j) => ({ comparable: j.comparable, reasons: j.reasons, dropPercent: j.dropPercent, verdict: j.verdict, pinned: j.pinned, targetDropPercent: j.targetDropPercent });

test("1.5 compare stays silent when both sides lack provenance and warns provenance-unknown when exactly one does", () => {
  const rec = freshRecord();
  const none = compare(side(), side({ totals: [1000] }));
  assert.equal(none.status, 0, none.stdout);
  assert.deepEqual(none.json.warnings, []);
  assert.equal(none.json.baseline.provenance, null);
  assert.equal(none.json.routed.provenance, null);

  const baselineUnknown = compare(side({ meta: { provenance: rec } }), side({ totals: [1000] }));
  assert.deepEqual(baselineUnknown.json.warnings, ["provenance-unknown:baseline"]);
  assert.deepEqual(baselineUnknown.json.routed.provenance, rec);
  assert.equal(baselineUnknown.json.baseline.provenance, null);

  const routedUnknown = compare(side(), side({ totals: [1000], meta: { provenance: rec } }));
  assert.deepEqual(routedUnknown.json.warnings, ["provenance-unknown:routed"]);

  // A stored value that is not an object is no record.
  const broken = compare(side({ meta: { provenance: "x" } }), side({ totals: [1000], meta: { provenance: rec } }));
  assert.deepEqual(broken.json.warnings, ["provenance-unknown:routed"]);
  assert.equal(broken.json.routed.provenance, null);

  const both = compare(side({ meta: { provenance: rec } }), side({ totals: [1000], meta: { provenance: rec } }));
  assert.deepEqual(both.json.warnings, []);
  for (const res of [baselineUnknown, routedUnknown, both]) assert.deepEqual(verdictOf(res.json), verdictOf(none.json));
  assert.equal(none.json.verdict, "target not set");
  assert.equal(none.json.comparable, true);

  const md = compare(side(), side({ totals: [1000], meta: { provenance: rec } }), ["--format", "md"]);
  assert.ok(md.stdout.includes("Warnings: provenance-unknown:routed\n"), md.stdout);
});

// A copy of `rec` with some sections, flags or top-level keys replaced.
function changed(rec, { sections = {}, flags = {}, ...top } = {}) {
  return { ...rec, ...top, sections: { ...rec.sections, ...sections }, flags: { ...rec.flags, ...flags } };
}

test("1.6 compare warns provenance-differs, flags-differ and provenance-drift outside the expected set of the mode", () => {
  const rec = freshRecord();
  const h = (c) => c.repeat(16);
  const other = changed(rec, {
    plugin: "9.9.9",
    sections: { ladder: h("0"), rigor: h("1"), score: h("2"), steps: h("3"), prompts: h("4") },
    flags: { archive: true, "score.minRigor": "standard" },
  });
  const routed = side({ meta: { provenance: rec } });
  const baseline = side({ totals: [1000], meta: { provenance: other } });

  // Pinned pair: ladder, rigor and score are expected to differ, and so is score.minRigor.
  const pinned = compare(routed, baseline);
  assert.equal(pinned.status, 0, pinned.stdout);
  assert.deepEqual(pinned.json.warnings, ["provenance-differs:plugin,prompts,steps", "flags-differ:archive"]);
  // --unpinned: only score is expected to differ.
  const unpinned = compare(routed, baseline, ["--unpinned"]);
  assert.deepEqual(unpinned.json.warnings, ["baseline-unpinned", "provenance-differs:ladder,plugin,prompts,rigor,steps", "flags-differ:archive"]);

  // A section on one side only differs; a flag on one side only differs.
  const extra = changed(rec, { sections: { agents: h("5") }, flags: { "agents.restricted": undefined } });
  delete extra.flags["agents.restricted"];
  const oneSided = compare(side({ meta: { provenance: extra } }), side({ totals: [1000], meta: { provenance: rec } }));
  assert.deepEqual(oneSided.json.warnings, ["provenance-differs:agents", "flags-differ:agents.restricted"]);

  // Drift is reported per side, sorted, whatever the other side holds.
  const drifted = { ...rec, drift: ["prompts", "limits"] };
  assert.deepEqual(compare(side({ meta: { provenance: drifted } }), side({ totals: [1000], meta: { provenance: rec } })).json.warnings,
    ["provenance-drift:routed:limits,prompts"]);
  assert.deepEqual(compare(side({ meta: { provenance: drifted } }), side({ totals: [1000], meta: { provenance: drifted } })).json.warnings,
    ["provenance-drift:baseline:limits,prompts", "provenance-drift:routed:limits,prompts"]);
  assert.deepEqual(compare(side({ meta: { provenance: drifted } }), side({ totals: [1000] })).json.warnings,
    ["provenance-unknown:baseline", "provenance-drift:routed:limits,prompts"]);

  // The md output prints the same warnings.
  const md = compare(routed, baseline, ["--format", "md"]).stdout;
  assert.ok(md.includes("Warnings: provenance-differs:plugin,prompts,steps, flags-differ:archive\n"), md);
});

test("1.6 the expected set comes from the policy of the project that runs compare; a malformed set reads as the default", () => {
  const rec = freshRecord();
  const other = changed(rec, { sections: { ladder: "0".repeat(16), steps: "3".repeat(16) }, flags: { "score.minRigor": "standard" } });
  const baseline = side({ totals: [1000], meta: { provenance: other } });
  const own = compare(side({ meta: { provenance: rec }, policy: { provenance: { expected: { pinned: ["steps"] } } } }), baseline);
  assert.deepEqual(own.json.warnings, ["provenance-differs:ladder", "flags-differ:score.minRigor"]);
  const bad = compare(side({ meta: { provenance: rec }, policy: { provenance: { expected: { pinned: "steps" } } } }), baseline);
  assert.deepEqual(bad.json.warnings, ["provenance-differs:steps"]);
});

test("1.6 provenance never changes comparable, reasons, dropPercent or the verdict", () => {
  const rec = freshRecord();
  const other = changed(rec, { plugin: "9.9.9", sections: { steps: "3".repeat(16) }, flags: { chrome: false }, drift: ["limits"] });
  const target = { compare: { targetDropPercent: 30 } };
  const cases = [
    [{ policy: target }, { totals: [1000] }],
    [{ policy: { compare: { targetDropPercent: 50 } } }, { totals: [1000] }],
    [{ meta: { outcome: { action: "halt" } } }, { totals: [1000] }],
    [{}, { totals: [1000], meta: { outcome: { action: "halt" } } }],
  ];
  for (const [r, b] of cases) {
    const make = (opts, provenance) => side({ ...opts, meta: { ...(opts.meta ?? {}), ...(provenance ? { provenance } : {}) } });
    const plain = compare(make(r, null), make(b, null));
    const withRec = compare(make(r, rec), make(b, other));
    const oneSided = compare(make(r, rec), make(b, null), ["--unpinned"]);
    const oneSidedPlain = compare(make(r, null), make(b, null), ["--unpinned"]);
    assert.deepEqual(verdictOf(withRec.json), verdictOf(plain.json), JSON.stringify(r));
    assert.deepEqual(verdictOf(oneSided.json), verdictOf(oneSidedPlain.json), JSON.stringify(r));
    assert.ok(withRec.json.warnings.length > plain.json.warnings.length, "the pair with differences does warn");
  }
  assert.equal(compare(side({ policy: target }), side({ totals: [1000] })).json.verdict, "met");
  assert.equal(compare(side({ policy: { compare: { targetDropPercent: 50 } } }), side({ totals: [1000] })).json.verdict, "not met");
});

test("1.6 records the real router writes: the pinned baseline file differs only where expected, a routing-only override is named", () => {
  const routed = freshRecord();
  const pinnedBase = freshRecord(BASELINE);
  const pair = (r, b, extra = []) => compare(side({ meta: { provenance: r } }), side({ totals: [1000], meta: { provenance: b } }), extra).json.warnings;
  assert.deepEqual(pair(routed, pinnedBase), []);
  assert.deepEqual(pair(routed, pinnedBase, ["--unpinned"]), ["baseline-unpinned", "provenance-differs:ladder,rigor"]);

  // The routing-only additions of README "Baseline comparison" turn features off on one arm only.
  const routingOnly = freshRecord({ ...BASELINE, extraSteps: { allowance: { lean: 0, standard: 0, thorough: 0 } }, codeReplan: { afterFailures: 0 } });
  assert.deepEqual(pair(routed, routingOnly), ["provenance-differs:codeReplan,extraSteps"]);

  // Scorer A/B: the arms differ in score only, which both modes expect.
  const scorerOff = freshRecord({ score: { minRigor: null } });
  const scorerOn = freshRecord({ score: { minRigor: "standard" } });
  assert.notEqual(scorerOn.sections.score, scorerOff.sections.score);
  assert.deepEqual(pair(scorerOn, scorerOff, ["--unpinned"]), ["baseline-unpinned"]);
  assert.deepEqual(pair(scorerOn, scorerOff), []);
});

// ---- prices are display-only (run-cost-estimate 1.3) -------------------------------------

test("1.3 a run with an override that sets prices records no prices section, and compare gives no provenance-differs:prices", () => {
  const priced = freshRecord({ prices: { usdPerMillionTokens: { opus: 30, sonnet: 6, haiku: 2 } } });
  const plain = freshRecord();
  assert.equal(Object.hasOwn(priced.sections, "prices"), false);
  assert.deepEqual(priced, plain, "a price changes no hash and no flag");
  const otherPrices = freshRecord({ prices: { usdPerMillionTokens: { sonnet: 3 } } });
  const routed = side({ meta: { provenance: priced } });
  const baseline = side({ totals: [1000], meta: { provenance: otherPrices } });
  const res = compare(routed, baseline);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(res.json.warnings, []);
  assert.ok(!res.json.warnings.some((w) => w.includes("prices")));
});
