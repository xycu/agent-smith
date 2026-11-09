// Tests for the run cost estimate: the prices policy block, the estimator, and the cost in report.md, status and compare.
// The estimator is tested as a pure function; the outputs black-box through the CLI in scratch projects.
// Test names start with the plan row number. Prices are chosen so every sum is exact in binary floating point.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanupAll, makeProject, entry, writeLog } from "./helpers.mjs";
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
