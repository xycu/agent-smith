#!/usr/bin/env node
// Router for /agent-smith:10x-pipeline.
// Decides the next step, model and effort from disk artifacts (plan.md Progress,
// review verdicts) plus the run log. The orchestrator never picks a model itself.
//
// Usage (run from the project root):
//   node route.mjs init   <change-id> [--goal "<text>"] [--size s|m|l]
//   node route.mjs next   <change-id>        # consumes context/changes/<id>/agent-smith/last-result.json
//   node route.mjs status <change-id>
//
// Policy: <skill>/policy.json, deep-merged with context/foundation/agent-smith-policy.json if present.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.cwd();

function out(obj, code = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(code);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const val = args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? args[++i] : true;
    flags[key] = val;
  }
  return flags;
}

function deepMerge(base, over) {
  if (Array.isArray(over) || typeof over !== "object" || over === null) return over;
  const res = { ...base };
  for (const [k, v] of Object.entries(over)) {
    res[k] = k in res && typeof res[k] === "object" && !Array.isArray(res[k]) ? deepMerge(res[k], v) : v;
  }
  return res;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function loadPolicy() {
  const base = readJson(path.join(SKILL_DIR, "policy.json"), null);
  if (!base) out({ action: "halt", reason: `Cannot read ${path.join(SKILL_DIR, "policy.json")}` }, 1);
  const override = readJson(path.join(ROOT, "context/foundation/agent-smith-policy.json"), null);
  return override ? deepMerge(base, override) : base;
}

function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

// ---- disk readers ---------------------------------------------------------

function readPlan(file) {
  const res = { exists: false, hasProgress: false, phases: 0, rows: 0, autoDone: 0, autoPending: 0, manualPending: [], mtime: 0 };
  if (!fs.existsSync(file)) return res;
  res.exists = true;
  res.mtime = mtime(file);
  const text = fs.readFileSync(file, "utf8");
  const idx = text.search(/^## Progress\s*$/m);
  if (idx < 0) return res;
  res.hasProgress = true;
  let section = null;
  for (const line of text.slice(idx).split("\n")) {
    if (/^### Phase \d+/.test(line)) { res.phases++; section = null; continue; }
    if (/^#### Automated/.test(line)) { section = "auto"; continue; }
    if (/^#### Manual/.test(line)) { section = "manual"; continue; }
    const m = line.match(/^- \[( |x|X)\] (.*)$/);
    if (!m) continue;
    res.rows++;
    const done = m[1] !== " ";
    if (section === "manual") { if (!done) res.manualPending.push(m[2].trim()); }
    else if (done) res.autoDone++;
    else res.autoPending++;
  }
  return res;
}

function readReview(file) {
  const res = { exists: false, verdict: null, critical: 0, warnings: 0, mtime: 0 };
  if (!fs.existsSync(file)) return res;
  res.exists = true;
  res.mtime = mtime(file);
  const text = fs.readFileSync(file, "utf8");
  const v = text.match(/\*\*Verdict\*\*:\s*\[?([A-Za-z ]+?)\]?\s*$/m);
  if (v) res.verdict = v[1].trim().toUpperCase();
  const f = text.match(/\*\*Findings\*\*:[^\n]*/);
  if (f) {
    res.critical = Number((f[0].match(/(\d+)\s*critical/i) || [0, 0])[1]);
    res.warnings = Number((f[0].match(/(\d+)\s*warnings?/i) || [0, 0])[1]);
  }
  return res;
}

// ---- run log --------------------------------------------------------------

function paths(id) {
  const change = path.join(ROOT, "context/changes", id);
  const dir = path.join(change, "agent-smith");
  return {
    change,
    dir,
    meta: path.join(dir, "meta.json"),
    log: path.join(dir, "run.jsonl"),
    result: path.join(dir, "last-result.json"),
    plan: path.join(change, "plan.md"),
    planReview: path.join(change, "reviews/plan-review.md"),
    implReview: path.join(change, "reviews/impl-review.md"),
  };
}

function readLog(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function writeLog(file, entries) {
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// ---- result intake + verification ---------------------------------------

function attachResult(p, log) {
  const last = log[log.length - 1];
  if (!last || last.result) return;
  if (!fs.existsSync(p.result)) {
    out({ action: "halt", reason: `Step ${last.n} (${last.step}) has no result. Write ${path.relative(ROOT, p.result)} first.` }, 1);
  }
  let result = readJson(p.result, null);
  if (!result || typeof result !== "object") result = { status: "unknown", note: "unparseable result file" };
  fs.rmSync(p.result);

  const plan = readPlan(p.plan);
  let verified;
  switch (last.step) {
    case "plan": verified = plan.hasProgress && plan.mtime > last.startedAt; break;
    case "plan-review": verified = mtime(p.planReview) > last.startedAt && readReview(p.planReview).verdict !== null; break;
    case "impl-review": verified = mtime(p.implReview) > last.startedAt && readReview(p.implReview).verdict !== null; break;
    case "implement": verified = plan.autoDone > (last.before?.autoDone ?? 0); break;
    default: verified = true; // fix: trust status, the next impl-review checks the code
  }
  last.result = result;
  last.verified = verified;
  last.ok = result.status === "done" && verified;
  last.finishedAt = Date.now();
}

// ---- decision -------------------------------------------------------------

function lastIdx(log, names, okOnly = true) {
  for (let i = log.length - 1; i >= 0; i--) {
    if (names.includes(log[i].step) && (!okOnly || log[i].ok)) return i;
  }
  return -1;
}

function trailingFailures(log, step) {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].step !== step) break;
    if (log[i].ok) break;
    n++;
  }
  return n;
}

function decide(p, log, policy, meta) {
  const E = policy.escalation;
  const L = policy.limits;
  const plan = readPlan(p.plan);
  const pr = readReview(p.planReview);
  const ir = readReview(p.implReview);
  const count = (step) => log.filter((e) => e.step === step).length;

  if (!fs.existsSync(path.join(p.change, "change.md"))) {
    return { halt: `No change folder. Run /10x-new ${meta.id} first.` };
  }
  if (!plan.exists || !plan.hasProgress) {
    return { step: "plan", template: "plan", bump: meta.sizeBump, reason: plan.exists ? "plan.md has no ## Progress" : "no plan yet" };
  }

  // Plan review is fresh if it ran after the last successful plan step.
  const lp = lastIdx(log, ["plan"]);
  const lpr = lastIdx(log, ["plan-review"]);
  const prFresh = lp >= 0 || lpr >= 0
    ? pr.exists && lpr > lp
    : pr.exists && (plan.autoDone > 0 || pr.mtime >= plan.mtime);
  if (!prFresh) return { step: "plan-review", bump: 0, reason: "plan changed since last review" };

  const needsReplan =
    pr.verdict === "RETHINK" ||
    (pr.verdict === "REVISE" && (pr.critical > 0 || pr.warnings > policy.review.reviseToleranceWarnings));
  if (needsReplan && plan.autoDone === 0) {
    const revisions = log.filter((e) => e.template === "plan-revise").length;
    if (revisions >= L.maxPlanRevisions) return { halt: `Plan still ${pr.verdict} after ${revisions} revisions. Needs a human.` };
    return {
      step: "plan",
      template: "plan-revise",
      verdict: pr.verdict,
      bump: pr.verdict === "RETHINK" ? E.rethinkBump : E.reviseBump,
      reason: `plan review ${pr.verdict} (${pr.critical} critical, ${pr.warnings} warnings)`,
    };
  }

  if (plan.autoPending > 0) {
    let bump = 0;
    const why = [`${plan.autoPending} automated rows pending`];
    if (pr.warnings >= E.noisyPlanReviewWarnings) { bump += E.noisyPlanReviewBump; why.push(`plan review had ${pr.warnings} warnings`); }
    if (pr.verdict === "SOUND" && pr.critical === 0 && pr.warnings === 0 && trailingFailures(log, "implement") === 0) {
      bump -= E.cleanReviewDrop; why.push("clean plan review");
    }
    return { step: "implement", bump, reason: why.join(", ") };
  }

  // All automated rows done. Review is stale if code moved after the last review.
  const lir = lastIdx(log, ["impl-review"]);
  const lcode = lastIdx(log, ["implement", "fix"]);
  const irFresh = lir >= 0 || lcode >= 0
    ? ir.exists && lir > lcode
    : ir.exists && ir.mtime >= plan.mtime;
  if (!irFresh) {
    const struggled = log.some((e) => (e.step === "implement" || e.step === "fix") && !e.ok) || count("fix") > 0;
    return {
      step: "impl-review",
      bump: struggled ? E.hardChangeReviewerBump : 0,
      reason: struggled ? "implementation needed retries or fixes" : "implementation complete",
    };
  }

  const needsFix =
    ir.verdict === "REJECTED" ||
    (ir.verdict === "NEEDS ATTENTION" && (ir.critical > 0 || policy.review.fixOnNeedsAttention));
  if (needsFix) {
    if (count("fix") >= L.maxFixLoops) return { halt: `Implementation still ${ir.verdict} after ${count("fix")} fix loops. Needs a human.` };
    const lastCode = [...log].reverse().find((e) => e.step === "implement" || e.step === "fix");
    return {
      step: "fix",
      template: "fix",
      verdict: ir.verdict,
      floorTier: lastCode ? lastCode.tier : undefined,
      bump: ir.verdict === "REJECTED" ? E.rejectedBump : 0,
      reason: `impl review ${ir.verdict} (${ir.critical} critical, ${ir.warnings} warnings)`,
    };
  }

  return {
    done: true,
    reason: `impl review ${ir.verdict ?? "APPROVED"}`,
    manualPending: plan.manualPending,
  };
}

function tierFor(d, log, policy, plan) {
  const s = policy.steps[d.step];
  const C = policy.complexity;
  let tier = s.baseTier;
  const parts = [`base ${s.baseTier}`];
  if (C.appliesTo.includes(d.step)) {
    const cb = C.phaseThresholds.filter((t) => plan.phases >= t).length;
    if (cb) { tier += cb; parts.push(`+${cb} for ${plan.phases} phases`); }
  }
  if (d.bump) { tier += d.bump; parts.push(`${d.bump > 0 ? "+" : ""}${d.bump} from results`); }
  const fails = trailingFailures(log, d.step);
  if (fails) { tier += fails * policy.escalation.perFailure; parts.push(`+${fails * policy.escalation.perFailure} for ${fails} failed attempt(s)`); }
  if (d.floorTier !== undefined && tier < d.floorTier + (d.bump || 0)) {
    tier = d.floorTier + (d.bump || 0);
    parts.push(`floor at last code tier ${d.floorTier}`);
  }
  const clamped = Math.max(s.minTier ?? 0, Math.min(s.maxTier ?? policy.ladder.length - 1, tier, policy.ladder.length - 1));
  if (clamped !== tier) parts.push(`clamped to ${clamped}`);
  return { tier: clamped, fails, tierWhy: parts.join(", ") };
}

function render(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function next(id, policy) {
  const p = paths(id);
  fs.mkdirSync(p.dir, { recursive: true });
  const meta = readJson(p.meta, { id, goal: "", sizeBump: 0 });
  const log = readLog(p.log);
  attachResult(p, log);

  if (log.length >= policy.limits.maxTotalSteps) {
    writeLog(p.log, log);
    return out({ action: "halt", reason: `Step budget ${policy.limits.maxTotalSteps} spent.` });
  }

  const d = decide(p, log, policy, meta);
  if (d.halt || d.done) {
    writeLog(p.log, log);
    return out(d.done
      ? { action: "done", reason: d.reason, manualPending: d.manualPending, steps: log.length }
      : { action: "halt", reason: d.halt, steps: log.length });
  }

  const plan = readPlan(p.plan);
  const { tier, fails, tierWhy } = tierFor(d, log, policy, plan);
  if (fails >= policy.escalation.maxAttemptsPerStep) {
    writeLog(p.log, log);
    return out({ action: "halt", reason: `${d.step} failed ${fails} times in a row. Last note: ${log[log.length - 1]?.result?.note ?? "none"}` });
  }

  const { model, effort } = policy.ladder[tier];
  const template = d.template ?? d.step;
  const prompt = render(policy.prompts[template], { id, goal: meta.goal, verdict: d.verdict ?? "" }).trim() +
    "\n\n" + policy.prompts.suffix;
  const entry = {
    n: log.length + 1,
    step: d.step,
    template,
    skill: policy.steps[d.step].skill,
    tier,
    model,
    effort,
    reason: d.reason,
    tierWhy,
    startedAt: Date.now(),
    before: { autoDone: plan.autoDone },
  };
  log.push(entry);
  writeLog(p.log, log);
  out({
    action: "run",
    n: entry.n,
    step: d.step,
    model,
    effort,
    reason: `${d.reason}; tier ${tier} (${tierWhy})`,
    prompt,
    resultFile: path.relative(ROOT, p.result),
  });
}

function status(id) {
  const p = paths(id);
  const log = readLog(p.log);
  out({
    change: id,
    steps: log.map((e) => ({
      n: e.n, step: e.step, model: e.model, effort: e.effort,
      ok: e.ok ?? null, verified: e.verified ?? null, note: e.result?.note ?? null, reason: e.reason,
    })),
  });
}

// ---- main -----------------------------------------------------------------

const [cmd, id, ...rest] = process.argv.slice(2);
if (!cmd || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  out({ action: "halt", reason: "Usage: route.mjs init|next|status <change-id> [--goal text] [--size s|m|l]" }, 1);
}
const policy = loadPolicy();
const flags = parseFlags(rest);

if (cmd === "init") {
  const p = paths(id);
  fs.mkdirSync(p.dir, { recursive: true });
  const prev = readJson(p.meta, {});
  const size = typeof flags.size === "string" ? flags.size : prev.size ?? "m";
  fs.writeFileSync(p.meta, JSON.stringify({
    id,
    goal: typeof flags.goal === "string" ? flags.goal : prev.goal ?? "",
    size,
    sizeBump: policy.complexity.sizeBump[size] ?? 0,
  }, null, 2) + "\n");
  next(id, policy);
} else if (cmd === "next") {
  next(id, policy);
} else if (cmd === "status") {
  status(id);
} else {
  out({ action: "halt", reason: `Unknown command ${cmd}` }, 1);
}
