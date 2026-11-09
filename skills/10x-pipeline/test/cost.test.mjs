// Tests for the run cost estimate: the prices policy block, the estimator, and the cost in report.md, status and compare.
// The estimator is tested as a pure function; the outputs black-box through the CLI in scratch projects.
// Test names start with the plan row number. Prices are chosen so every sum is exact in binary floating point.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cleanupAll, makeProject, entry, writeLog, writeMetaFile, run, init, next, writePlan, planText, writeResult, readReportFile,
} from "./helpers.mjs";
import { makeOpenspecProject, initOpenspec, writeArtifacts } from "./openspec-helpers.mjs";
import { priceTable, estimateCost } from "../scripts/state.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const STATE = pathToFileURL(path.join(SKILL_DIR, "scripts/state.mjs")).href;
const PRICES = { prices: { usdPerMillionTokens: { opus: 30, sonnet: 6, haiku: 2 } } };

// loadPrices() run in the project root, as the router runs it.
function loadPricesIn(project) {
  const res = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import(${JSON.stringify(STATE)}).then((m) => process.stdout.write(JSON.stringify(m.loadPrices())));`],
  { cwd: project.root, encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

// ---- 1.1 the shipped policy ---------------------------------------------------------------

test("1.1 policy.json ships prices null and lists prices in provenance.ignore", () => {
  assert.equal(DEFAULT.prices, null);
  assert.ok(DEFAULT.provenance.ignore.includes("prices"));
  assert.equal(priceTable(DEFAULT), null);
});

// ---- 1.2 priceTable and estimateCost --------------------------------------------------------

test("1.2 priceTable reads a malformed block as off and drops malformed entries, without throwing", () => {
  for (const prices of [undefined, null, 5, "x", [], true]) assert.equal(priceTable({ prices }), null, JSON.stringify(prices));
  for (const usd of [undefined, null, 5, "x", [1]]) assert.equal(priceTable({ prices: { usdPerMillionTokens: usd } }), null, JSON.stringify(usd));
  assert.equal(priceTable({ prices: { usdPerMillionTokens: {} } }), null, "no valid entry is off");
  assert.equal(priceTable({ prices: { usdPerMillionTokens: { sonnet: "6", opus: -1 } } }), null);
  assert.equal(priceTable(null), null);
  assert.equal(priceTable(undefined), null);
  const t = priceTable({ prices: {
    usdPerMillionTokens: { sonnet: 6, opus: "30", haiku: -2, fable: 0, nan: NaN, inf: Infinity, "": 3, " ": 3, big: 1.5 },
    extra: "ignored",
  } });
  assert.deepEqual(t, { usdPerMillionTokens: { sonnet: 6, fable: 0, big: 1.5 } });
});

test("1.2 estimateCost sums priced steps, counts coverage, lists unpriced aliases and maps each entry", () => {
  const table = { usdPerMillionTokens: { sonnet: 6, haiku: 2, fable: 0 } };
  const entries = [
    entry(1, "plan", { model: "sonnet", usage: { totalTokens: 1_000_000 } }),
    entry(2, "plan-review", { model: "haiku", usage: { totalTokens: 500_000 } }),
    entry(3, "implement", { model: "sonnet" }),
    entry(4, "impl-review", { model: "opus", usage: { totalTokens: 250_000 } }),
    entry(5, "fix", { model: undefined, usage: { totalTokens: 100 } }),
    entry(6, "fix", { model: "fable", usage: { totalTokens: 2_000_000 } }),
    entry(7, "fix", { model: "sonnet", usage: { totalTokens: -1 } }),
    entry(8, "fix", { model: "opus", usage: { totalTokens: 7 } }),
  ];
  const c = estimateCost(entries, table);
  assert.equal(c.usd, 7);
  assert.equal(c.priced, 3);
  assert.equal(c.withFigures, 6);
  assert.deepEqual(c.unpriced, ["opus", "unknown"]);
  assert.deepEqual(c.perEntry, { 1: 6, 2: 1, 3: null, 4: null, 5: null, 6: 0, 7: null, 8: null });

  const off = estimateCost(entries, null);
  assert.equal(off.usd, 0);
  assert.equal(off.priced, 0);
  assert.equal(off.withFigures, 6);
  assert.deepEqual(off.unpriced, ["opus", "sonnet", "haiku", "fable", "unknown"].sort());
});

test("1.2 estimateCost never throws on a hand-edited log", () => {
  const table = { usdPerMillionTokens: { sonnet: 6 } };
  const c = estimateCost([null, 5, "x", [], { usage: "x" }, { model: 3, usage: { totalTokens: 1_000_000 } }, { n: 9, usage: null }], table);
  assert.deepEqual(c, { usd: 0, priced: 0, withFigures: 1, unpriced: ["unknown"], perEntry: { 9: null } });
  assert.deepEqual(estimateCost(undefined, table), { usd: 0, priced: 0, withFigures: 0, unpriced: [], perEntry: {} });
});

test("1.2 a prices override merges over the shipped null, and a malformed override reads as no prices", () => {
  assert.equal(loadPricesIn(makeProject()), null);
  assert.deepEqual(loadPricesIn(makeProject({ policy: PRICES })), PRICES.prices);
  assert.equal(loadPricesIn(makeProject({ policy: { prices: { usdPerMillionTokens: "6" } } })), null);
  assert.equal(loadPricesIn(makeProject({ policy: { prices: [1] } })), null);
});

// ---- 2.x report.md and status ----------------------------------------------------------------

// Sets a file's mtime 5 s ahead, so the router sees it as written after the step started.
function later(file) {
  const t = new Date(Date.now() + 5000);
  fs.utimesSync(file, t, t);
}

// A 10x scratch run with a fixture log: sonnet 1M, haiku 500k, a step with no usage, an opus step.
function fixtureRun(policy) {
  const project = makeProject({ policy });
  writeLog(project, [
    entry(1, "plan", { model: "sonnet", usage: { totalTokens: 1_000_000, toolUses: 3, durationMs: 10 } }),
    entry(2, "plan-review", { model: "haiku", usage: { totalTokens: 500_000 } }),
    entry(3, "implement", { model: "sonnet" }),
    entry(4, "impl-review", { model: "opus", usage: { totalTokens: 250_000 } }),
  ]);
  writeMetaFile(project, { id: project.id, goal: "fix typo", rigor: { level: "lean" }, outcome: { action: "done" } });
  return project;
}

const statusOf = (project, extra = []) => {
  const res = run(project, ["status", project.id, ...extra]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return res.json;
};

const BLENDED = "at a blended rate (USD per million tokens, no input/output split)";

test("2.1 with the shipped policy report.md and status carry no cost text or key", () => {
  const project = fixtureRun(null);
  const st = statusOf(project, ["--report"]);
  assert.equal(Object.hasOwn(st, "cost"), false);
  for (const row of st.steps) assert.equal(Object.hasOwn(row, "cost"), false);
  const report = readReportFile(project);
  assert.ok(!/cost/i.test(report), report);
  assert.ok(report.includes("| # | Step | Model | Effort | Tier | Simple | Result | Tokens |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n"), report);
  assert.ok(report.includes("| 1 | plan | sonnet | high | 3 | no | ok | 1000000 |\n"), report);
});

test("2.2 with prices set the report has the Cost (est.) column and the Cost (estimate) line with the exact total", () => {
  const project = fixtureRun({ prices: { usdPerMillionTokens: { sonnet: 6, haiku: 2 } } });
  statusOf(project, ["--report"]);
  const report = readReportFile(project);
  assert.ok(report.includes("| # | Step | Model | Effort | Tier | Simple | Result | Tokens | Cost (est.) |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"), report);
  assert.ok(report.includes("| 1 | plan | sonnet | high | 3 | no | ok | 1000000 | $6.0000 |\n"), report);
  assert.ok(report.includes("| 2 | plan-review | haiku | high | 3 | no | ok | 500000 | $1.0000 |\n"), report);
  assert.ok(report.includes("| 4 | impl-review | opus | high | 3 | no | ok | 250000 | - |\n"), report);
  assert.ok(report.includes(`Steps: 4 · Tokens: 1750000 (figures for 3 of 4 steps)\nCost (estimate): $7.00 ${BLENDED} · priced 2 of 3 steps with a token figure · no price for: opus\n`), report);

  const all = fixtureRun(PRICES);
  statusOf(all, ["--report"]);
  assert.ok(readReportFile(all).includes(`Cost (estimate): $14.50 ${BLENDED} · priced 3 of 3 steps with a token figure\n`));

  const none = fixtureRun({ prices: { usdPerMillionTokens: { fable: 1 } } });
  statusOf(none, ["--report"]);
  assert.ok(readReportFile(none).includes("Cost (estimate): - (no step with a token figure has a price) at a blended rate · no price for: haiku, opus, sonnet\n"));
});

test("2.3 a step with no token figure shows - in the cost column and is not counted in M", () => {
  const project = fixtureRun(PRICES);
  statusOf(project, ["--report"]);
  const report = readReportFile(project);
  assert.ok(report.includes("| 3 | implement | sonnet | high | 3 | no | ok | - | - |\n"), report);
  assert.ok(report.includes("priced 3 of 3 steps with a token figure"), report);
});

test("2.4 status prints the top-level cost object and a per-step cost when prices are set", () => {
  const st = statusOf(fixtureRun({ prices: { usdPerMillionTokens: { sonnet: 6, haiku: 2 } } }));
  assert.deepEqual(st.cost, { usd: 7, currency: "USD", rate: "blended", priced: 2, withFigures: 3, unpriced: ["opus"] });
  assert.deepEqual(st.steps.map((r) => r.cost), [6, 1, null, null]);
  const none = statusOf(fixtureRun({ prices: { usdPerMillionTokens: { fable: 1 } } }));
  assert.equal(none.cost.usd, null);
  assert.equal(none.cost.priced, 0);
});

test("2.4 a real step with a usage figure is priced in status and status --report", () => {
  const project = makeProject({ policy: PRICES });
  const first = init(project, "fix typo");
  assert.equal(first.status, 0, first.stdout);
  writePlan(project, planText());
  later(project.planFile);
  writeResult(project, { status: "done", note: "planned", usage: { totalTokens: 500_000, toolUses: 2, durationMs: 5 } });
  assert.equal(next(project).status, 0);
  const price = PRICES.prices.usdPerMillionTokens[first.json.model];
  const st = statusOf(project, ["--report"]);
  assert.deepEqual(st.cost, { usd: price / 2, currency: "USD", rate: "blended", priced: 1, withFigures: 1, unpriced: [] });
  assert.equal(st.steps[0].cost, price / 2);
  assert.ok(readReportFile(project).includes(`Cost (estimate): $${(price / 2).toFixed(2)} ${BLENDED} · priced 1 of 1 steps with a token figure\n`));
});

test("2.5 an OpenSpec run gets the same report line and status object", () => {
  const project = makeOpenspecProject({ policy: PRICES });
  const first = initOpenspec(project, "add a thing");
  assert.equal(first.status, 0, first.stdout);
  assert.equal(first.json.step, "os-propose");
  writeArtifacts(project, { proposal: true, specs: 1, tasks: { open: 1 } });
  for (const f of ["proposal.md", "tasks.md", "specs/cap-1/spec.md"]) later(path.join(project.changeDir, f));
  writeResult(project, { status: "done", note: "proposed", usage: { totalTokens: 250_000 } });
  assert.equal(next(project).status, 0);
  const price = PRICES.prices.usdPerMillionTokens[first.json.model];
  const st = statusOf(project, ["--chain", "openspec", "--report"]);
  assert.deepEqual(st.cost, { usd: price / 4, currency: "USD", rate: "blended", priced: 1, withFigures: 1, unpriced: [] });
  assert.equal(st.steps[0].cost, price / 4);
  assert.ok(readReportFile(project).includes(`Cost (estimate): $${(price / 4).toFixed(2)} ${BLENDED} · priced 1 of 1 steps with a token figure\n`));

  const plain = makeOpenspecProject();
  assert.equal(initOpenspec(plain, "add a thing").status, 0);
  const plainStatus = statusOf(plain, ["--chain", "openspec"]);
  assert.equal(Object.hasOwn(plainStatus, "cost"), false);
});

// ---- 3.x compare ----------------------------------------------------------------------------

// A scratch project that models one checkout: executed entries [model, tokens] with usage and a done meta file.
function side(steps, { policy = null, meta = {} } = {}) {
  const project = makeProject({ policy });
  writeLog(project, steps.map(([model, t], i) => entry(i + 1, i ? "implement" : "plan", {
    model, effort: "high", usage: { totalTokens: t, toolUses: 1, durationMs: 1 },
  })));
  writeMetaFile(project, { id: project.id, goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" }, ...meta });
  return project;
}

// `compare` run from the routed project, whose policy holds the prices, against the baseline project.
const compare = (routed, baseline, extra = []) => {
  const res = run(routed, ["compare", routed.id, "--baseline", baseline.root, ...extra]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return res;
};
const verdictOf = (j) => ({ comparable: j.comparable, reasons: j.reasons, dropPercent: j.dropPercent, verdict: j.verdict, pinned: j.pinned, targetDropPercent: j.targetDropPercent });
const SONNET_OPUS = { prices: { usdPerMillionTokens: { sonnet: 6, opus: 30 } } };

test("3.1 with the shipped policy the compare JSON has cost null on both sides and the Markdown no cost row", () => {
  const baseline = side([["sonnet", 2_000_000]]);
  const routed = side([["sonnet", 1_000_000], ["opus", 500_000]]);
  const json = compare(routed, baseline).json;
  assert.equal(json.baseline.cost, null);
  assert.equal(json.routed.cost, null);
  const md = compare(routed, baseline, ["--format", "md"]).stdout;
  assert.ok(!/cost/i.test(md), md);
  assert.ok(md.includes("Verdict: target not set. Unit: raw tokens, a proxy for the weekly limit.\n"), md);
});

test("3.2 with prices set both sides carry cost with the exact USD, coverage and USD per alias, and the Markdown prints the rows", () => {
  const baseline = side([["sonnet", 2_000_000]]);
  const routed = side([["sonnet", 1_000_000], ["opus", 500_000]], { policy: SONNET_OPUS });
  const json = compare(routed, baseline).json;
  assert.deepEqual(json.baseline.cost, { usd: 12, priced: 1, withFigures: 1, unpriced: [], byModel: { sonnet: 12 } });
  assert.deepEqual(json.routed.cost, { usd: 21, priced: 2, withFigures: 2, unpriced: [], byModel: { sonnet: 6, opus: 15 } });
  assert.deepEqual(json.warnings, []);
  const md = compare(routed, baseline, ["--format", "md"]).stdout;
  assert.ok(md.includes("| Tokens | 2000000 (1 of 1) | 1500000 (2 of 2) |\n| Cost (estimate) | $12.00 (1 of 1 priced) | $21.00 (2 of 2 priced) |\n"), md);
  assert.ok(md.includes("Tokens by tier, routed: opus/high 500000, sonnet/high 1000000\nCost by model, baseline: sonnet $12.00\nCost by model, routed: opus $15.00, sonnet $6.00\n"), md);
  assert.ok(md.includes("Verdict: target not set. Unit: raw tokens, a proxy for the weekly limit. Cost is an estimate at a blended rate and does not enter the verdict.\n"), md);
});

test("3.3 verdict, comparable, reasons and dropPercent are identical with and without prices, also for a pair that is not comparable", () => {
  const cases = [
    [{}, {}],
    [{ policy: { compare: { targetDropPercent: 20 } } }, {}],
    [{ policy: { compare: { targetDropPercent: 50 } } }, {}],
    [{ meta: { outcome: { action: "halt" } } }, {}],
    [{}, { meta: { outcome: { action: "halt" } } }],
  ];
  for (const [r, b] of cases) {
    const baseline = side([["sonnet", 2_000_000]], b);
    const plain = compare(side([["sonnet", 1_000_000], ["opus", 500_000]], r), baseline).json;
    const pricedPolicy = { ...(r.policy ?? {}), ...SONNET_OPUS };
    const priced = compare(side([["sonnet", 1_000_000], ["opus", 500_000]], { ...r, policy: pricedPolicy }), baseline).json;
    assert.deepEqual(verdictOf(priced), verdictOf(plain), JSON.stringify(r));
    assert.notEqual(priced.routed.cost, null);
  }
});

test("3.4 an unpriced alias on a side gives cost-incomplete:<side> and does not change comparable", () => {
  const baseline = side([["sonnet", 2_000_000]]);
  const routedSteps = [["sonnet", 1_000_000], ["haiku", 500_000]];
  const plain = compare(side(routedSteps), baseline).json;
  const res = compare(side(routedSteps, { policy: SONNET_OPUS }), baseline).json;
  assert.deepEqual(res.warnings, ["cost-incomplete:routed"]);
  assert.deepEqual(res.routed.cost, { usd: 6, priced: 1, withFigures: 2, unpriced: ["haiku"], byModel: { sonnet: 6 } });
  assert.deepEqual(verdictOf(res), verdictOf(plain));
  assert.equal(res.comparable, true);
  const both = compare(side([["sonnet", 1_000_000]], { policy: { prices: { usdPerMillionTokens: { opus: 30 } } } }), baseline).json;
  assert.deepEqual(both.warnings, ["cost-incomplete:baseline", "cost-incomplete:routed"]);
  assert.equal(both.routed.cost.usd, null);
  const md = compare(side([["sonnet", 1_000_000]], { policy: { prices: { usdPerMillionTokens: { opus: 30 } } } }), baseline, ["--format", "md"]).stdout;
  assert.match(md, /Cost \(estimate\) \| - \(0 of 1 priced\) \| - \(0 of 1 priced\)/);
});
