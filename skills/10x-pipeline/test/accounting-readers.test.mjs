// Hand-authored protocol fixtures through real producers and router intake; no live-host qualification.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, entry, skipEntry, writeLog, writeMetaFile, run, init,
  writeResult, readLogEntries, readReportFile, planText,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { codexFixture, execute } from "./codex-helpers.mjs";
import { boundClaudeFixture, claudeUsageFixture } from "./claude-helpers.mjs";
import { claudeCaptureCheckpoint, collectClaudeUsage } from "../scripts/claude-usage.mjs";
import { unavailableEvidence } from "../scripts/usage.mjs";
import { estimateCost } from "../scripts/state.mjs";

after(cleanupAll);
const PRICES = { prices: { usdPerMillionTokens: { sonnet: 6 } } };
const TREE = { schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout", hostVersion: "0.169.0",
  invocation: { host: "codex", rootThreadId: "root", rootTurnId: "turn" }, sessionCount: 2,
  requestCount: 4, reconciliation: "response-snapshot" };
const measured = (n, totalTokens, over = {}) => entry(n, "plan", { usage: { totalTokens }, usageEvidence: TREE, ...over });
const omitted = (n, reason = "incomplete-capture") => entry(n, "plan", { usage: { totalTokens: 999, durationMs: 3 },
  usageEvidence: unavailableEvidence(reason, TREE) });
function fixture(entries, { chain = "10x", policy = PRICES, host = "claude" } = {}) {
  const project = chain === "openspec" ? makeOpenspecProject({ policy }) : makeProject({ policy });
  writeLog(project, entries);
  writeMetaFile(project, { id: project.id, goal: "fixture", host, baseSha: "a".repeat(40),
    rigor: { level: "standard" }, outcome: { action: "done" }, ...(chain === "openspec" ? { chain } : {}) });
  return project;
}
function status(project, chain = "10x") {
  const result = run(project, ["status", project.id, "--report", "--chain", chain]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.json;
}
function compare(routed, baseline = routed, chain = "10x", extra = []) {
  const result = run(routed, ["compare", routed.id, "--baseline", baseline.root, "--routed", routed.root,
    "--chain", chain, ...extra]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return extra.includes("md") ? result.stdout : result.json;
}

test("coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger", () => {
  const verified = fixture([measured(1, 100)]);
  const legacy = fixture([entry(1, "plan", { usage: { totalTokens: 100 } })]);
  for (const [project, scope] of [[verified, "verified"], [legacy, "legacy"]]) {
    const bytes = fs.readFileSync(path.join(project.agentDir, "run.jsonl"));
    const json = status(project);
    assert.equal(json.tokens.total, 100);
    assert.equal(json.usageCoverage[scope], 1);
    assert.equal(json.steps[0].tokenScope, scope);
    assert.equal(json.groupingScope, "enclosing-dispatch");
    assert.deepEqual(fs.readFileSync(path.join(project.agentDir, "run.jsonl")), bytes);
  }
  const differentScope = compare(verified, legacy);
  assert.equal(differentScope.comparable, false);
  assert.ok(differentScope.reasons.includes("usage-scope-mismatch"));
  assert.equal(differentScope.dropPercent, null);
  assert.equal(compare(verified).comparable, true);
  const old = compare(legacy);
  assert.equal(old.comparable, true);
  assert.equal(old.dropPercent, 0);
  assert.ok(old.warnings.includes("legacy-usage-scope"));
  assert.match(compare(legacy, legacy, "10x", ["--format", "md"]), /Legacy token figures have unverified scope/);
});

test("mixed and unavailable coverage keeps measured zero, labels subtotals, and excludes skipped usage", () => {
  const project = fixture([measured(1, 0), omitted(2), entry(3, "plan", { usage: { totalTokens: 5 } }),
    skipEntry("research", 3, { usage: { totalTokens: 888 }, usageEvidence: TREE })]);
  const json = status(project);
  assert.deepEqual(json.usageCoverage, { verified: 1, unavailable: 1, legacy: 1, missing: 1 });
  assert.deepEqual(json.tokens, { total: 5, stepsWithFigures: 2 });
  assert.equal(json.steps[0].usage.totalTokens, 0);
  assert.equal(json.steps[1].usage.totalTokens, undefined);
  assert.equal(json.steps[1].usage.durationMs, 3);
  assert.equal(json.cost.withFigures, 2);
  const report = readReportFile(project);
  assert.match(report, /\| 0 \|/);
  assert.match(report, /Tokens: 5 .*subtotal/);
  assert.match(report, /Verified observed host usage: 1 · Unavailable: 1 · Legacy\/unverified scope: 1 · Missing figures: 1/);
  assert.match(report, /incomplete-capture/);
  assert.match(report, /routing-rate approximation/);
  assert.doesNotMatch(report, /999|888/);
  const pair = compare(project);
  assert.ok(pair.reasons.includes("usage-scope-mismatch"));
  assert.ok(pair.reasons.includes("usage-incomplete:routed"));
  const md = compare(project, project, "10x", ["--format", "md"]);
  assert.match(md, /Token total for routed is a subtotal/);
  assert.match(md, /Unavailable routed step 2: incomplete-capture/);
});

const native = (reason) => unavailableEvidence(reason, { source: "claude-native", hostVersion: "2.1.323" });

test("the report header groups settled usage limitations by source and reason", () => {
  const project = fixture([
    measured(1, 0),
    entry(2, "plan", { usage: { totalTokens: 5 } }),
    entry(3, "plan", { usageEvidence: native("capture-disabled") }),
    entry(4, "plan", { usageEvidence: native("capture-disabled") }),
    entry(5, "plan", { usageEvidence: native("incomplete-capture"), usage: { durationMs: 2 } }),
    entry(6, "plan", { usageEvidence: native("missing-source") }),
    omitted(7, "missing-source"),
    omitted(8, "unsupported-host"),
    entry(9, "plan", { result: undefined, usageEvidence: native("capture-disabled") }),
    entry(10, "plan", { provider: "openai", usageEvidence: native("capture-disabled") }),
    skipEntry("research", 10, { result: {}, usageEvidence: native("capture-disabled") }),
  ]);
  assert.deepEqual(status(project).tokens, { total: 5, stepsWithFigures: 2 });
  const report = readReportFile(project);
  const header = "Token capture limitations: Native Claude token capture was off (2 steps) · Claude usage source unavailable (1 step) · " +
    "Codex usage source unavailable (1 step) · Codex version unqualified for token accounting (1 step)";
  assert.ok(report.startsWith(`# Run report: ${project.id}\n\n${header}\n\nGoal: `), report);
  assert.equal(report.match(/^Token capture limitations:/gm)?.length, 1);
  assert.match(report, /^- Step 5 plan: incomplete-capture — The captured records do not prove complete invocation coverage\.$/m);
  assert.match(report, /^- Step 6 plan: missing-source — The required host usage source is unavailable\.$/m);
  assert.match(report, /^- Step 8 plan: unsupported-host — The host version is not qualified for accounting\.$/m);
});

test("OpenSpec report requires the saved Codex host, Claude dispatch, and duration for headless attribution", () => {
  const chain = "openspec";
  const project = fixture([
    entry(1, "os-propose", { usageEvidence: native("incomplete-capture"), usage: { durationMs: 0 } }),
    entry(2, "os-verify", { usageEvidence: native("incomplete-capture") }),
    entry(3, "os-verify", { provider: "openai", usageEvidence: native("incomplete-capture"), usage: { durationMs: 6 } }),
    entry(4, "os-verify", { usageEvidence: native("capture-disabled") }),
    entry(5, "os-verify", { result: undefined, usageEvidence: native("incomplete-capture"), usage: { durationMs: 2 } }),
  ], { chain, host: "codex" });
  status(project, chain);
  const report = readReportFile(project);
  assert.match(report, /^Token capture limitations: Headless Claude on Codex recorded duration only \(1 step\)$/m);
  assert.match(report, /^- Step 2 os-verify: incomplete-capture — The captured records do not prove complete invocation coverage\.$/m);
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: missing pending and counter-only steps do not invent legacy token figures`, () => {
    const project = fixture([measured(1, 100), entry(2, "plan", { result: undefined }),
      entry(3, "plan", { usage: { durationMs: 3 } })], { chain });
    assert.deepEqual(status(project, chain).usageCoverage, { verified: 1, unavailable: 0, legacy: 0, missing: 2 });
    assert.doesNotMatch(readReportFile(project), /Legacy figures retain/);
    const pair = compare(project, project, chain);
    assert.ok(pair.reasons.includes("usage-incomplete:routed"));
    assert.ok(!pair.reasons.includes("usage-scope-mismatch"));
    assert.ok(!pair.warnings.includes("legacy-usage-scope"));
    const zero = fixture([entry(1, "plan", { usage: { totalTokens: 0 } })], { chain });
    assert.deepEqual(status(zero, chain).usageCoverage, { verified: 0, unavailable: 0, legacy: 1, missing: 0 });
  });
}

test("no figures render as missing while an explicit verified zero renders as zero", () => {
  const missing = fixture([omitted(1)]);
  status(missing);
  assert.match(readReportFile(missing), /Tokens: - \(figures for 0 of 1/);
  const missingMd = compare(missing, missing, "10x", ["--format", "md"]);
  assert.match(missingMd, /\| Tokens \| - \(0 of 1\) \| - \(0 of 1\) \|/);
  const zero = fixture([measured(1, 0)]);
  status(zero);
  assert.match(readReportFile(zero), /Tokens: 0 \(figures for 1 of 1/);
  assert.match(compare(zero, zero, "10x", ["--format", "md"]), /\| Tokens \| 0 \(1 of 1\) \| 0 \(1 of 1\) \|/);
  assert.ok(compare(zero).reasons.includes("baseline-total-zero"));
});

test("aggregate overflow is sticky for tokens and counters, with no selectively smaller group totals", () => {
  const big = Number.MAX_SAFE_INTEGER;
  const project = fixture([measured(1, big, { usage: { totalTokens: big, toolUses: big, durationMs: big } }),
    measured(2, 1, { usage: { totalTokens: 1, toolUses: 1, durationMs: 1 } }), measured(3, 2)]);
  const json = status(project);
  assert.deepEqual(json.tokens, { total: null, stepsWithFigures: 3 });
  assert.deepEqual(json.toolUses, { total: null, stepsWithFigures: 2 });
  assert.deepEqual(json.durationMs, { total: null, stepsWithFigures: 2 });
  assert.match(readReportFile(project), /Tokens: unavailable \(overflow\)/);
  const pair = compare(project);
  assert.ok(pair.reasons.includes("usage-overflow:routed"));
  assert.equal(pair.routed.tokens.byModel.sonnet, null);
  assert.equal(pair.routed.tokens.byTier["sonnet/high"], null);
  assert.equal(pair.routed.tokens.byProviderModel["claude/sonnet"], null);
  assert.equal(pair.routed.tokens.byProviderTier["claude/sonnet/high"], null);
  assert.match(compare(project, project, "10x", ["--format", "md"]), /sonnet - \(overflow\)/);
});

test("model grouping retains prototype-shaped aliases as ordinary own keys", () => {
  const project = fixture([measured(1, 3, { model: "__proto__" }), measured(2, 4, { model: "constructor" })]);
  const pair = compare(project, project, "10x", ["--unpinned"]);
  assert.equal(Object.hasOwn(pair.routed.tokens.byModel, "__proto__"), true);
  assert.equal(pair.routed.tokens.byModel.__proto__, 3);
  assert.equal(pair.routed.tokens.byModel.constructor, 4);
});

test("cost preserves ordinary legacy arithmetic and rejects unavailable token claims", () => {
  const tokens = 9_007_199_254_740_991;
  const price = 6.7;
  const result = estimateCost([entry(1, "plan", { usage: { totalTokens: tokens } }), omitted(2)],
    { usdPerMillionTokens: { sonnet: price } });
  assert.equal(result.usd, (tokens * price) / 1e6);
  assert.equal(result.withFigures, 1);
  assert.equal(result.priced, 1);
  assert.equal(result.perEntry[2], null);
  const overflow = estimateCost([measured(1, tokens)], { usdPerMillionTokens: { sonnet: Number.MAX_VALUE } });
  assert.equal(overflow.usd, null);
  assert.equal(overflow.perEntry[1], null);
  const recoverable = estimateCost([measured(1, 1_000_000)], { usdPerMillionTokens: { sonnet: Number.MAX_VALUE } });
  assert.equal(recoverable.usd, Number.MAX_VALUE);
});

test("cost overflow is unavailable throughout JSON and Markdown, while routing groups use the enclosing model", () => {
  const project = fixture([measured(1, 1_000_000), measured(2, 1_000_000)],
    { policy: { prices: { usdPerMillionTokens: { sonnet: Number.MAX_VALUE } } } });
  assert.equal(status(project).cost.usd, null);
  assert.match(readReportFile(project), /Cost \(estimate\): - \(aggregate unavailable\).*routing-rate approximation/);
  const pair = compare(project);
  assert.equal(pair.routed.cost.usd, null);
  assert.equal(pair.routed.cost.byModel.sonnet, null);
  assert.equal(pair.routed.cost.byProviderModel["claude/sonnet"], null);
  assert.equal(pair.routed.cost.scope, "enclosing-dispatch-routing-rate");
  assert.equal(pair.routed.tokens.byModel.sonnet, 2_000_000);
  const md = compare(project, project, "10x", ["--format", "md"]);
  assert.match(md, /Cost by model, routed: sonnet -/);
  assert.match(md, /child usage can be priced at the enclosing dispatch rate/);
});

// A reader fixture copies only completed entries already accepted by real router intake.
// Keep the live pending dispatch intact; the fixture has an explicit terminal outcome for compare.
function acceptedReader(project, chain) {
  return fixture(readLogEntries(project).filter(row => row.result), { chain });
}
function planned(project, chain) {
  if (chain === "openspec") writeArtifacts(project, { proposal: true, design: true, specs: 1, tasks: { open: 1 } });
  else writePlan(project, planText());
}
for (const chain of ["10x", "openspec"]) {
  for (const producer of ["codex", "claude"]) {
    test(`${chain}/${producer}: measured producer output survives real intake and legacy continuation refuses scope verdicts`, () => {
      let project, action, env = {};
      let w;
      if (producer === "codex") {
        w = codexFixture(chain, { mode: {
          reply: 'RESULT: {"status":"done","note":"accounting fixture"}',
          pages: { false: { first: { data: [{ id: "child" }], nextCursor: null } } },
          rolloutUsages: { child: [{ input_tokens: 20, output_tokens: 2 }, { input_tokens: 30, output_tokens: 3 }] },
        } });
        ({ project, action, env } = w);
      } else {
        project = chain === "openspec" ? makeOpenspecProject() : makeProject();
        const first = init(project, "fix typo", ["--chain", chain]);
        assert.equal(first.json.action, "run", first.stdout);
        action = first.json;
      }
      // Emulate a retained pre-upgrade failed attempt, then continue on the current reader/producer revision.
      writeResult(project, { status: "failed", note: "retained legacy attempt", usage: { totalTokens: 7 } });
      const retry = run(project, ["next", project.id, "--chain", chain], { env });
      assert.equal(retry.json.action, "run", retry.stdout);
      action = retry.json;
      planned(project, chain);
      let result;
      if (producer === "codex") {
        const produced = execute(w, action);
        assert.equal(produced.json.completed, true, produced.stdout + produced.stderr);
        result = produced.json.result;
      } else {
        const capture = claudeUsageFixture({ project, chain, n: action.n, step: action.step });
        result = { status: "done", note: "native fixture result", ...collectClaudeUsage(capture.descriptor) };
      }
      assert.equal(result.usageEvidence.status, "verified");
      writeResult(project, result);
      const next = run(project, ["next", project.id, "--chain", chain], { env });
      assert.equal(next.status, 0, next.stdout + next.stderr);
      const accepted = readLogEntries(project).find(row => row.n === action.n);
      assert.deepEqual(accepted.usageEvidence, result.usageEvidence);
      assert.deepEqual(accepted.usage, result.usage);
      const liveStatus = status(project, chain);
      assert.ok(liveStatus.usageCoverage.verified >= 1);
      assert.match(readReportFile(project), /Verified observed host usage: 1/);
      const completed = acceptedReader(project, chain);
      const mixed = compare(completed, completed, chain, ["--unpinned"]);
      assert.equal(mixed.comparable, false);
      assert.ok(mixed.reasons.includes("usage-scope-mismatch"));
      assert.equal(mixed.routed.usageCoverage.legacy, 1);
      assert.equal(mixed.routed.usageCoverage.verified, 1);
      assert.equal(mixed.routed.tokens.total, result.usage.totalTokens + 7);
      // The same actual accepted producer row, alone, has complete verified coverage.
      const verified = fixture([accepted], { chain });
      const pair = compare(verified, verified, chain, ["--unpinned"]);
      assert.equal(pair.comparable, true, JSON.stringify(pair.reasons));
      assert.equal(pair.routed.tokens.total, result.usage.totalTokens);
      assert.equal(pair.routed.usageSteps[0].usageEvidence.sessionCount, result.usageEvidence.sessionCount);
      assert.equal(pair.routed.groupingScope, "enclosing-dispatch");
      const bytes = fs.readFileSync(path.join(completed.agentDir, "run.jsonl"));
      status(completed, chain);
      compare(completed, completed, chain, ["--unpinned", "--format", "md"]);
      assert.deepEqual(fs.readFileSync(path.join(completed.agentDir, "run.jsonl")), bytes);
    });
  }
}

for (const chain of ["10x", "openspec"]) {
  for (const enabled of [false, true]) {
    test(`${chain}: native capture ${enabled ? "on" : "off"} appears in the terminal report and status rebuild`, () => {
      const project = chain === "openspec"
        ? makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 1 } })
        : makeProject({ plan: planText({ done: 1 }) });
      if (chain === "10x") writeReview(project, "plan-review");
      const dispatch = init(project, "fix typo", ["--chain", chain]);
      const action = dispatch.json;
      assert.equal(action?.action, "run", dispatch.stdout + dispatch.stderr);
      assert.equal(action.step, chain === "openspec" ? "os-verify" : "impl-review");
      const router = { change: project.id, chain, n: action.n, step: action.step };
      const invocation = { host: "claude" };
      let accounting;
      if (enabled) {
        const capture = boundClaudeFixture({ project, ...router });
        const checkpoint = claudeCaptureCheckpoint(capture.env);
        capture.write();
        accounting = collectClaudeUsage({ ...capture.descriptor, invocation, checkpoint }, capture.env);
        assert.equal(accounting.usageEvidence.status, "verified");
        assert.equal(accounting.usage.totalTokens, 151);
      } else {
        accounting = collectClaudeUsage({ router, invocation }, {});
        assert.equal(accounting.usageEvidence.reason, "capture-disabled");
      }
      if (chain === "openspec") {
        writeArtifacts(project, { verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n" });
      } else {
        writeReview(project, "impl-review", { verdict: "APPROVED" });
      }
      writeResult(project, { status: "done", note: "reviewed", ...accounting });
      const end = run(project, ["next", project.id, "--chain", chain]);
      assert.equal(end.json?.action, "done", end.stdout + end.stderr);
      const initial = readReportFile(project);
      if (enabled) {
        assert.doesNotMatch(initial, /^Token capture limitations:/m);
        assert.match(initial, /^Steps: 1 · Tokens: 151 \(figures for 1 of 1 steps\)/m);
        assert.match(initial, /^Verified observed host usage: 1 · Unavailable: 0/m);
      } else {
        assert.match(initial, /^Token capture limitations: Native Claude token capture was off \(1 step\)$/m);
        assert.match(initial, /^Steps: 1 · Tokens: - \(figures for 0 of 1 steps\)/m);
        assert.match(initial, /^- Step 1 \S+: capture-disabled — Claude token capture is off\. Run `node <absolute-plugin-scripts>\/claude-capture\.mjs`[^\n]*$/m);
      }
      fs.writeFileSync(path.join(project.root, end.json.report), "Old report\n");
      const rebuilt = status(project, chain);
      assert.deepEqual(rebuilt.steps[0].usageEvidence, accounting.usageEvidence);
      assert.equal(rebuilt.tokens.stepsWithFigures, enabled ? 1 : 0);
      assert.equal(readReportFile(project), initial);
    });
  }

  test(`${chain}: structured late evidence refreshes coverage and pricing without counting archive-only usage`, () => {
    const project = fixture([{ ...omitted(1), usage: { durationMs: 3 } }], { chain });
    assert.equal(readLogEntries(project)[0].usage.totalTokens, undefined);
    status(project, chain);
    assert.match(readReportFile(project), /Tokens: -/);
    const payload = { change: project.id, chain, n: 1, step: "plan", usage: { totalTokens: 12 }, usageEvidence: TREE };
    const file = path.join(project.root, "late-usage.json");
    fs.writeFileSync(file, JSON.stringify(payload));
    const result = run(project, ["usage", project.id, "1", "--chain", chain, "--usage-file", file]);
    assert.equal(result.status, 0, result.stdout);
    assert.match(readReportFile(project), /Tokens: 12/);
    assert.match(readReportFile(project), /Verified observed host usage: 1 · Unavailable: 0/);
    assert.match(readReportFile(project), /routing-rate approximation/);
    const accepted = fs.readFileSync(path.join(project.agentDir, "run.jsonl"));
    const capture = claudeUsageFixture({ project, chain, n: null, step: chain === "openspec" ? "os-archive" : "archive" });
    const archive = collectClaudeUsage(capture.descriptor);
    assert.equal(archive.usage.totalTokens, 151);
    assert.equal(status(project, chain).tokens.total, 12, "archive envelope is never added to numbered usage");
    assert.deepEqual(fs.readFileSync(path.join(project.agentDir, "run.jsonl")), accepted);
    const pair = compare(project, project, chain);
    assert.equal(pair.routed.tokens.total, 12);
    assert.equal(pair.routed.usageCoverage.verified, 1);
  });
}
