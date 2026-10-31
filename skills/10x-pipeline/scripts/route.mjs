#!/usr/bin/env node
// Router for /agent-smith:10x-pipeline.
// Decides the next step, model and effort from disk artifacts (plan.md Progress,
// review verdicts) plus the run log. The orchestrator never picks a model itself.
//
// Usage (run from the project root):
//   node route.mjs init   <change-id> [--goal "<text>"] [--rigor lean|standard|thorough] [--archive]
//   node route.mjs next   <change-id>        # consumes context/changes/<id>/agent-smith/last-result.json
//   node route.mjs risk   <change-id>        # read-only: churn hot paths, plan hits, diff hits
//   node route.mjs status <change-id> [--report]   # --report (re)writes agent-smith/report.md
//   node route.mjs verify-archive <change-id> [--path <p>]   # read-only: is the change archived (files only, no git)
//
// Policy: <skill>/policy.json, deep-merged with context/foundation/agent-smith-policy.json if present.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
    if (/^## /.test(line) && !/^## Progress\s*$/.test(line)) break;
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

// ---- archive lookup -------------------------------------------------------

// Folder names under context/archive/ that belong to this id: <YYYY-MM-DD>-<id>, anchored at both ends.
// A name that only ends with the id (2026-01-01-x-<id>) is another change. The id is already [a-z0-9-].
function archiveDirs(id) {
  const re = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${id}$`);
  let names;
  try { names = fs.readdirSync(path.join(ROOT, "context/archive")); } catch { return []; }
  return names.filter((name) => re.test(name)).sort();
}

// One field of the first --- block of a file, quotes stripped. null when the file, the block or the field is missing.
function frontmatterField(file, key) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return null; }
  const block = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return null;
  const line = block[1].split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  if (line === undefined) return null;
  return line.slice(key.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
}

// Halts with JSON and writes nothing when the change is archived (folder moved) or half-archived
// (change.md says archived, folder still in place). Runs before any mkdirSync.
function guardArchived(p, id) {
  if (!fs.existsSync(p.change)) {
    const found = archiveDirs(id).map((name) => `context/archive/${name}`);
    if (found.length) {
      out({ action: "halt", reason: `Change ${id} is archived at ${found.join(", ")}. Nothing was written.`, archivePath: found[0] }, 1);
    }
    return;
  }
  if (frontmatterField(path.join(p.change, "change.md"), "status") === "archived") {
    out({ action: "halt", reason: `Change ${id} is stamped archived but its folder was not moved. Nothing was written; finish or undo /10x-archive by hand.` }, 1);
  }
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
    report: path.join(dir, "report.md"),
    plan: path.join(change, "plan.md"),
    planReview: path.join(change, "reviews/plan-review.md"),
    implReview: path.join(change, "reviews/impl-review.md"),
  };
}

function readLog(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try {
      const e = JSON.parse(l);
      return e && typeof e === "object" ? [e] : [];
    } catch { return []; }
  });
}

// A skip entry records a step the router decided not to run. It has no n, template, ok or result.
// Every count, streak and freshness check reads the executed entries only.
function executed(log) {
  return log.filter((e) => !e.skipped);
}

// meta.json must be a plain object; anything else falls back.
function readMeta(file, fallback) {
  const m = readJson(file, null);
  return m && typeof m === "object" && !Array.isArray(m) ? m : fallback;
}

function writeLog(file, entries) {
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// ---- report ---------------------------------------------------------------

// The archive lines of the report. The archive step itself leaves no log entry, so this is where a reader of the moved copy learns about it.
function archiveLines(id, meta, oneLine) {
  if (meta.archive !== true) return [];
  const o = meta.outcome;
  if (!o) return ["Archive: not run (run not ended)"];
  if (o.action !== "done") return ["Archive: not run (run halted)"];
  const pending = Array.isArray(o.manualPending) ? o.manualPending : [];
  return [
    `Archive: requested - runs after this report was written; see the commit "chore(archive): close ${id}"`,
    ...(pending.length ? [`Manual checks pending: ${pending.length}`, ...pending.map((row) => `- ${oneLine(row)}`)] : []),
  ];
}

function buildReport(id, meta, fullLog) {
  const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const log = executed(fullLog);
  const skips = fullLog.filter((e) => e.skipped);
  const o = meta.outcome;
  const outcome = o ? `${o.action}${o.reason ? ` - ${oneLine(o.reason)}` : ""}` : "not ended";
  const tokens = (e) => (typeof e.usage?.totalTokens === "number" ? e.usage.totalTokens : null);
  const rows = log.map((e) => {
    const result = e.result ? (e.ok ? "ok" : "failed") : "-";
    const t = tokens(e);
    return `| ${e.n} | ${e.step} | ${e.model} | ${e.effort} | ${e.tier} | ${e.simple ? "yes" : "no"} | ${result} | ${t === null ? "-" : t} |`;
  });
  const withTokens = log.filter((e) => tokens(e) !== null);
  const total = withTokens.reduce((sum, e) => sum + tokens(e), 0);
  return [
    `# Run report: ${id}`,
    "",
    `Goal: ${oneLine(meta.goal) || "-"}`,
    ...(isObject(meta.rigor) && meta.rigor.level ? [`Rigor: ${meta.rigor.level}${meta.rigor.by ? ` (${oneLine(meta.rigor.by)})` : ""}`] : []),
    `Outcome: ${outcome}`,
    ...archiveLines(id, meta, oneLine),
    "",
    "| # | Step | Model | Effort | Tier | Simple | Result | Tokens |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `Steps: ${log.length} · Tokens: ${withTokens.length ? total : "-"} (figures for ${withTokens.length} of ${log.length} steps)${skips.length ? ` · Skipped: ${skips.length}` : ""}`,
    "",
    ...(skips.length ? [
      "## Skipped steps",
      "",
      "| After step | Step | Reason | Rigor |",
      "| --- | --- | --- | --- |",
      ...skips.map((e) => `| ${e.afterN} | ${e.step} | ${oneLine(e.reason).replace(/\|/g, "/")} | ${e.rigor ?? "-"} |`),
      "",
    ] : []),
  ].join("\n");
}

// Returns the report path relative to the project root.
function writeReport(p, id, meta, log) {
  fs.mkdirSync(p.dir, { recursive: true });
  fs.writeFileSync(p.report, buildReport(id, meta, log));
  return path.relative(ROOT, p.report);
}

// Writes the end of a run: log, meta.json outcome and report.md. Prints nothing and does not exit.
// An ordinary halt of an archive run gets archive and committed here; a result that has its own archive field keeps it.
function finishRun(p, id, meta, log, result) {
  writeLog(p.log, log);
  meta.outcome = { action: result.action, reason: result.reason };
  if (result.action === "done") meta.outcome.manualPending = Array.isArray(result.manualPending) ? result.manualPending : [];
  fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  let report = null;
  let reportError;
  try { report = writeReport(p, id, meta, log); } catch (e) { reportError = e.message; }
  const extra = meta.archive === true && result.action === "halt" && result.archive === undefined
    ? { archive: "skipped: run halted", committed: false } : {};
  return reportError ? { ...result, ...extra, report, reportError } : { ...result, ...extra, report };
}

// Every end of run goes through here so no branch can skip the report.
function endRun(p, id, meta, log, result) {
  return out(finishRun(p, id, meta, log, result));
}

// ---- result intake + verification ---------------------------------------

// Keep only non-negative safe integers. Returns null when nothing survives.
function cleanUsage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const clean = {};
  for (const key of ["totalTokens", "toolUses", "durationMs"]) {
    const v = raw[key];
    if (Number.isSafeInteger(v) && v >= 0) clean[key] = v;
  }
  return Object.keys(clean).length ? clean : null;
}

// Keep only known signal keys with valid types: rigor (a level) and needsHuman (a short text).
// Anything else is dropped. Returns null when nothing survives.
const NEEDS_HUMAN_MAX = 300;
function cleanSignals(raw, policy) {
  if (!isObject(raw)) return null;
  const clean = {};
  if (typeof raw.rigor === "string" && rigorLevels(policy).includes(raw.rigor)) clean.rigor = raw.rigor;
  if (raw.needsHuman === true) clean.needsHuman = "The subagent asked for a human (no reason given).";
  else if (typeof raw.needsHuman === "string") {
    const text = raw.needsHuman.replace(/\s+/g, " ").trim().slice(0, NEEDS_HUMAN_MAX);
    if (text) clean.needsHuman = text;
  }
  return Object.keys(clean).length ? clean : null;
}

function attachResult(p, log, policy) {
  const ran = executed(log);
  const last = ran[ran.length - 1];
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
  // The raw signals object never reaches run.jsonl; only the cleaned one does.
  const { signals: rawSignals, ...stored } = result;
  last.result = stored;
  const usage = cleanUsage(result.usage);
  if (usage) last.usage = usage;
  const signals = cleanSignals(rawSignals, policy);
  if (signals) last.signals = signals;
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

// Classifies the goal text for the first plan step: short, plain or hard.
// A hard keyword wins over a short goal. Words match by prefix, so "Refactoring" hits "refactor".
// Leading punctuation is ignored, and a word with no letter or digit does not count, so "..." is no goal.
// A malformed override (no keyword list, non-numeric limit) never throws: no keywords match, no goal is short.
function goalClass(goal, policy) {
  const F = policy.complexity.firstPlan ?? {};
  const keywords = Array.isArray(F.hardKeywords) ? F.hardKeywords.filter((k) => typeof k === "string" && k) : [];
  const words = (typeof goal === "string" ? goal.split(/\s+/) : [])
    .map((word) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  if (!words.length) return { kind: "plain" };
  for (const word of words) {
    const keyword = keywords.find((k) => word.startsWith(k.toLowerCase()));
    if (keyword) return { kind: "hard", keyword };
  }
  return { kind: Number.isFinite(F.maxWords) && words.length <= F.maxWords ? "short" : "plain" };
}

// ---- rigor ----------------------------------------------------------------

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Level order comes from policy.rigor.levels. A malformed block throws; main turns that into a JSON halt.
function rigorLevels(policy) {
  const levels = policy.rigor?.levels;
  if (!Array.isArray(levels) || !levels.length || levels.some((l) => typeof l !== "string")) {
    throw new Error("policy.rigor.levels must be a non-empty array of strings");
  }
  return levels;
}

// The highest of two level names. A name that is not a level loses.
function maxLevel(levels, a, b) {
  return levels.indexOf(b) > levels.indexOf(a) ? b : a;
}

// Every input that can set the level, as { level, by }. Inputs only raise.
function rigorInputs(meta, log, policy, plan, risk) {
  const R = policy.rigor;
  const levels = rigorLevels(policy);
  const inputs = [];
  const add = (level, by) => { if (levels.includes(level)) inputs.push({ level, by }); };

  const stored = isObject(meta.rigor) ? meta.rigor : {};
  const requested = typeof stored.requested === "string" && levels.includes(stored.requested) ? stored.requested : null;
  if (requested) add(requested, `--rigor ${requested}`);
  else {
    const kind = goalClass(meta.goal, policy).kind;
    add(R.fromGoal?.[kind], `goal ${kind}`);
  }

  const thresholds = Array.isArray(policy.complexity?.phaseThresholds) ? policy.complexity.phaseThresholds : [];
  const reached = plan.hasProgress ? thresholds.filter((t) => plan.phases >= t).length : 0;
  const fromPhases = Array.isArray(R.fromPhases) ? R.fromPhases : [];
  if (reached && fromPhases.length) add(fromPhases[Math.min(reached, fromPhases.length) - 1], `phases ${plan.phases}`);

  const failed = log.filter((e) => e.ok === false).length;
  for (const rule of Array.isArray(R.fromFailures) ? R.fromFailures : []) {
    if (isObject(rule) && failed >= rule.minFailed) add(rule.level, `failed steps ${failed}`);
  }

  for (const e of log) {
    if (!e.skipped && isObject(e.signals) && typeof e.signals.rigor === "string") add(e.signals.rigor, "signals");
  }
  if (risk && risk.level) {
    const names = risk.hits.slice(0, 3).join(", ");
    add(risk.level, `hot paths ${names}${risk.hits.length > 3 ? ` +${risk.hits.length - 3}` : ""}`);
  }
  return inputs;
}

// Resolves the level for this run: stored level, then every input, and never lower than the stored level.
// Updates meta.rigor in place and returns the level. `changed` tells the caller to write meta.json.
function resolveRigor(meta, log, policy, plan, risk) {
  const levels = rigorLevels(policy);
  const stored = isObject(meta.rigor) ? meta.rigor : {};
  const had = levels.includes(stored.level) ? stored.level : null;
  let level = had;
  for (const input of rigorInputs(meta, log, policy, plan, risk)) level = level === null ? input.level : maxLevel(levels, level, input.level);
  // No usable input (malformed override): take the second level, the cautious middle.
  if (level === null) level = levels[Math.min(1, levels.length - 1)];
  const updated = { ...stored, level };
  if (level !== had) {
    const by = rigorInputs(meta, log, policy, plan, risk).filter((i) => i.level === level).map((i) => i.by);
    updated.by = by.length ? by.join(", ") : "default";
  }
  const changed = JSON.stringify(updated) !== JSON.stringify(meta.rigor);
  meta.rigor = updated;
  return { level, changed };
}

// ---- churn risk -----------------------------------------------------------

const SINCE_RE = /^(\d+\.(day|days|week|weeks|month|months|year|years)|\d{4}-\d{2}-\d{2})$/;
const SHA_RE = /^[0-9a-f]{40,64}$/;

// Runs git without a shell in the project root. Never throws. Returns { status, stdout, stderr, timedOut }.
// status is git's exit code, 127 when git is missing, 124 on a timeout (opts.timeout in ms), 1 for any other failure.
// The only -c option is core.quotePath=false, a display setting: paths print raw, not escaped.
function runGit(args, opts = {}) {
  try {
    const stdout = execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024,
      ...(Number.isInteger(opts.timeout) && opts.timeout > 0 ? { timeout: opts.timeout } : {}),
    });
    return { status: 0, stdout, stderr: "", timedOut: false };
  } catch (e) {
    const timedOut = e.code === "ETIMEDOUT";
    const status = typeof e.status === "number" ? e.status : e.code === "ENOENT" ? 127 : timedOut ? 124 : 1;
    return { status, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") || String(e.message ?? ""), timedOut };
  }
}

// Returns stdout, or null on any failure.
function gitOut(args) {
  const res = runGit(args);
  return res.status === 0 ? res.stdout : null;
}

// The files of a change that `git add` must be able to commit, relative to the project root.
// run.jsonl, meta.json and report.md are what the router writes; change.md is the file the archive stamps.
// Probes files, never the directory: check-ignore on a directory that does not exist yet exits 1
// whatever .gitignore says, and a directory probe misses file patterns such as *.jsonl.
function ignoredProbePaths(id, opts = {}) {
  const base = `context/changes/${id}`;
  return [`${base}/agent-smith/run.jsonl`, `${base}/agent-smith/meta.json`, `${base}/agent-smith/report.md`, `${base}/change.md`]
    .filter((file) => runGit(["check-ignore", "-q", "--", file], opts).status === 0);
}

// Glob without dependencies: "**/" is zero or more directories, "**" anything, "*" and "?" stay inside one segment.
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

// Validated churn settings, or null when the block is unusable. A bad exclude falls back to the shipped list.
function churnConfig(policy) {
  const c = policy.risk?.churn;
  if (!isObject(c)) return null;
  const posInt = (v) => Number.isInteger(v) && v > 0;
  if (typeof c.since !== "string" || !SINCE_RE.test(c.since)) return null;
  if (!posInt(c.maxCommits) || !posInt(c.minCommitsInWindow) || !posInt(c.hotMinCommits)) return null;
  if (!Number.isFinite(c.hotPercentile) || c.hotPercentile <= 0 || c.hotPercentile > 100) return null;
  let exclude = c.exclude;
  if (!Array.isArray(exclude)) exclude = readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude;
  if (!Array.isArray(exclude)) exclude = [];
  return { ...c, exclude: exclude.filter((g) => typeof g === "string").map(globToRegex) };
}

// Commits per path from `git log`, or null when git fails. `since` null means all history.
function churnCounts(rev, since, maxCommits) {
  const args = ["log", "--no-merges", "--relative", ...(since ? [`--since=${since}`] : []),
    "-n", String(maxCommits), "--format=tformat:@@", "--name-only", rev, "--"];
  const text = gitOut(args);
  if (text === null) return null;
  const counts = new Map();
  let commits = 0;
  let seen = new Set();
  for (const line of text.split("\n")) {
    if (line === "@@") { commits++; seen = new Set(); continue; }
    if (!line || seen.has(line)) continue;
    seen.add(line);
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  return { counts, commits };
}

// The hot-path set cut off at `rev`: source is window, all-history or unavailable.
function hotSet(policy, rev) {
  const none = { source: "unavailable", hot: new Set(), exclude: [] };
  const cfg = churnConfig(policy);
  if (!cfg) return none;
  let source = "window";
  let found = churnCounts(rev, cfg.since, cfg.maxCommits);
  if (found && found.commits < cfg.minCommitsInWindow) { source = "all-history"; found = churnCounts(rev, null, cfg.maxCommits); }
  if (!found || found.commits < cfg.minCommitsInWindow) return { ...none, exclude: cfg.exclude };
  const counts = [];
  for (const [file, n] of found.counts) if (!cfg.exclude.some((re) => re.test(file))) counts.push([file, n]);
  const sorted = counts.map(([, n]) => n).sort((a, b) => a - b);
  const hot = new Set();
  if (sorted.length) {
    const threshold = sorted[Math.max(0, Math.ceil((cfg.hotPercentile / 100) * sorted.length) - 1)];
    for (const [file, n] of counts) if (n >= threshold && n >= cfg.hotMinCommits) hot.add(file);
  }
  return { source, hot, exclude: cfg.exclude };
}

// One plan token, normalized: trailing note, :line, leading ./ and an absolute path under the project root.
function normalizePlanPath(raw) {
  let token = raw.trim().replace(/\s+\([^)]*\)$/, "").replace(/:\d+(-\d+)?$/, "").replace(/^\.\//, "");
  if (token.startsWith("/")) {
    for (const base of new Set([ROOT, fs.realpathSync(ROOT)])) {
      if (token === base || token.startsWith(base + "/")) { token = path.posix.relative(base, token) || "."; break; }
    }
  }
  return token;
}

// Paths named on the **File**: and **Files**: lines of the plan (backtick tokens, else comma-split text).
function planPaths(file) {
  if (!fs.existsSync(file)) return [];
  const found = new Set();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\*\*Files?\*\*:(.*)$/);
    if (!m) continue;
    const quoted = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    const tokens = quoted.length ? quoted : m[1].split(",");
    for (const raw of tokens) {
      const token = normalizePlanPath(raw);
      if (token) found.add(token);
    }
  }
  return [...found].sort();
}

// The hot paths one plan token names: the path itself, a directory above hot files, or a glob. Case is ignored.
// Returns null when the token cannot be classified (spaces, outside the project root), so nothing is claimed about it.
function matchPlanPath(token, hot) {
  if (/\s/.test(token) || token.startsWith("/") || token.startsWith("~") || /(^|\/)\.\.(\/|$)/.test(token)) return null;
  const clean = path.posix.normalize(token).replace(/\/+$/, "");
  if (clean === "." || clean === "") return [...hot];
  if (/[*?]/.test(clean)) {
    const glob = globToRegex(clean);
    const re = new RegExp(glob.source, "i");
    return [...hot].filter((f) => re.test(f));
  }
  const key = clean.toLowerCase();
  return [...hot].filter((f) => f.toLowerCase() === key || f.toLowerCase().startsWith(key + "/"));
}

// What churn says about this change: hot paths named by the plan and touched by the diff, and the level they raise to.
function measureRisk(p, meta, log, policy) {
  const rev = typeof meta.baseSha === "string" && SHA_RE.test(meta.baseSha) ? meta.baseSha : meta.baseSha === undefined ? "HEAD" : null;
  const set = rev === null ? { source: "unavailable", hot: new Set(), exclude: [] } : hotSet(policy, rev);
  // Only a token that was matched against the hot set counts as a measured plan path.
  const checked = [];
  const unclassified = [];
  const planHitSet = new Set();
  for (const token of planPaths(p.plan)) {
    const matched = matchPlanPath(token, set.hot);
    if (matched === null) { unclassified.push(token); continue; }
    checked.push(token);
    for (const f of matched) planHitSet.add(f);
  }
  const planHits = [...planHitSet].sort();
  let diffHits = [];
  const coded = log.some((e) => !e.skipped && (e.step === "implement" || e.step === "fix"));
  if (coded && rev !== null && rev !== "HEAD" && set.source !== "unavailable") {
    const text = gitOut(["diff", "--name-only", "--relative", rev, "HEAD", "--"]);
    if (text !== null) {
      diffHits = text.split("\n").filter((f) => f && !set.exclude.some((re) => re.test(f)) && set.hot.has(f));
    }
  }
  const hits = [...new Set([...planHits, ...diffHits])].sort();
  let level = null;
  const levels = rigorLevels(policy);
  for (const rule of Array.isArray(policy.risk?.raise) ? policy.risk.raise : []) {
    if (isObject(rule) && hits.length >= rule.minHot && levels.includes(rule.level)) level = level === null ? rule.level : maxLevel(levels, level, rule.level);
  }
  return { source: set.source, hot: [...set.hot].sort(), planPaths: checked.length, unclassified, planHits, diffHits: [...new Set(diffHits)].sort(), hits, level };
}

function decide(p, fullLog, policy, meta, ctx) {
  const E = policy.escalation;
  const L = policy.limits;
  const log = executed(fullLog);
  const plan = readPlan(p.plan);
  let pr = readReview(p.planReview);
  const ir = readReview(p.implReview);
  const count = (step) => log.filter((e) => e.step === step).length;

  if (!fs.existsSync(path.join(p.change, "change.md"))) {
    return { halt: `No change folder. Run /10x-new ${meta.id} first.` };
  }
  if (!plan.exists || !plan.hasProgress) {
    const { kind, keyword } = goalClass(meta.goal, policy);
    const B = policy.complexity.firstPlan?.bump ?? {};
    return {
      step: "plan",
      template: "plan",
      bump: kind === "hard" ? B.hard : B.plain,
      bumpWhy: `goal class ${kind}`,
      reason: `${plan.exists ? "plan.md has no ## Progress" : "no plan yet"} (goal: ${kind}${keyword ? `, "${keyword}"` : ""})`,
    };
  }

  // Plan review is fresh if it ran after the last successful plan step.
  const lp = lastIdx(log, ["plan"]);
  const lpr = lastIdx(log, ["plan-review"]);
  const prFresh = lp >= 0 || lpr >= 0
    ? pr.exists && lpr > lp
    : pr.exists && (plan.autoDone > 0 || pr.mtime >= plan.mtime);
  if (!prFresh) {
    // A plan-review skip written after the last successful plan step counts as handled.
    // It holds while the level can still skip, and for good once implement or fix has run.
    const skipAt = fullLog.map((e, i) => (e.skipped && e.step === "plan-review" ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    const planAt = fullLog.map((e, i) => (!e.skipped && e.step === "plan" && e.ok ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    const skippable = (policy.rigor.skipPlanReviewAt ?? []).includes(ctx.level);
    const codeRan = log.some((e) => e.step === "implement" || e.step === "fix");
    if (skipAt > planAt && (skippable || codeRan)) {
      pr = { exists: false, verdict: null, critical: 0, warnings: 0, mtime: 0 }; // absent after a skip
    } else {
      const source = ctx.risk?.source ?? "unavailable";
      const planPathCount = ctx.risk?.planPaths ?? 0;
      const unclassified = ctx.risk?.unclassified?.length ?? 0;
      const measured = source !== "unavailable" && planPathCount >= 1 && unclassified === 0;
      if (skippable && !codeRan && plan.autoDone === 0 && measured) {
        return {
          skip: {
            step: "plan-review",
            reason: `rigor ${ctx.level}: plan-review skipped (churn ${source}, ${planPathCount} plan paths, none hot)`,
            risk: { source, planPaths: planPathCount },
          },
        };
      }
      const why = skippable && !measured ? `plan changed since last review; risk not measured (${source}, ${planPathCount} plan paths${unclassified ? `, ${unclassified} unclassified` : ""})` : "plan changed since last review";
      return { step: "plan-review", bump: 0, reason: why };
    }
  }

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

// A change is simple when the plan stays small and nothing has failed yet.
// Any failed step ends the discount for the rest of the run.
function simpleSignal(d, plan, log, meta, policy) {
  if (d.step === "plan") {
    return d.template === "plan" && goalClass(meta.goal, policy).kind === "short" && !log.some((e) => e.ok === false)
      ? { simple: true, why: "short goal" }
      : { simple: false };
  }
  const S = policy.complexity.simple;
  const simple = plan.hasProgress && plan.phases >= 1 && plan.phases <= S.maxPhases &&
    plan.rows <= S.maxRows && !log.some((e) => e.ok === false);
  return simple ? { simple, why: `${plan.phases} phase, ${plan.rows} rows` } : { simple: false };
}

// Lowest ladder index whose effort is at least `name` in policy.rigor.effortOrder.
// An unknown name is ignored (index 0); no entry that high gives the top index.
function effortFloorTier(policy, name) {
  const order = Array.isArray(policy.rigor?.effortOrder) ? policy.rigor.effortOrder : [];
  const want = order.indexOf(name);
  if (want < 0) return 0;
  const idx = policy.ladder.findIndex((entry) => order.indexOf(entry.effort) >= want);
  return idx < 0 ? policy.ladder.length - 1 : idx;
}

function tierFor(d, log, policy, plan, meta, level) {
  const s = policy.steps[d.step];
  const C = policy.complexity;
  let tier = s.baseTier;
  const parts = [`base ${s.baseTier}`];
  if (C.appliesTo.includes(d.step)) {
    const cb = C.phaseThresholds.filter((t) => plan.phases >= t).length;
    if (cb) { tier += cb; parts.push(`+${cb} for ${plan.phases} phases`); }
  }
  if (d.bump) { tier += d.bump; parts.push(`${d.bump > 0 ? "+" : ""}${d.bump} from ${d.bumpWhy ?? "results"}`); }
  const fails = trailingFailures(log, d.step);
  if (fails) { tier += fails * policy.escalation.perFailure; parts.push(`+${fails * policy.escalation.perFailure} for ${fails} failed attempt(s)`); }
  const { simple, why } = simpleSignal(d, plan, log, meta, policy);
  const discount = simple ? C.simple.discount[d.step] ?? 0 : 0;
  if (discount > 0) { tier -= discount; parts.push(`-${discount} simple change (${why})`); }
  const offset = policy.rigor?.tierOffset?.[level]?.[d.step];
  const minEffort = policy.rigor?.minEffort?.[level];
  // Rigor offset, last-code floor, clamp, then the effort floor. Returns the final tier and what it did.
  const settle = (start) => {
    const notes = [];
    let t = start;
    if (Number.isInteger(offset) && offset !== 0) { t += offset; notes.push(`${offset > 0 ? "+" : ""}${offset} rigor ${level}`); }
    if (d.floorTier !== undefined && t < d.floorTier + (d.bump || 0)) {
      t = d.floorTier + (d.bump || 0);
      notes.push(`floor at last code tier ${d.floorTier}`);
    }
    const clamped = Math.max(s.minTier ?? 0, Math.min(s.maxTier ?? policy.ladder.length - 1, t, policy.ladder.length - 1));
    if (clamped !== t) notes.push(`clamped to ${clamped}`);
    let final = clamped;
    if (s.interactive && typeof minEffort === "string") {
      // Applied last, so the floor wins over maxTier and over every discount.
      const floor = effortFloorTier(policy, minEffort);
      if (final < floor) final = floor;
      notes.push(`floor ${minEffort} (tier ${floor})`);
    }
    return { final, notes };
  };
  const settled = settle(tier);
  parts.push(...settled.notes);
  // A discount that the clamp, the offset or the floor absorbed is no saving, so the report does not claim it.
  const saved = discount > 0 && settled.final < settle(tier + discount).final;
  return { tier: settled.final, fails, simple: saved, tierWhy: parts.join(", ") };
}

function render(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ---- archive adapter ------------------------------------------------------

const CREATED_RE = /^\d{4}-\d{2}-\d{2}$/;
const IN_PROGRESS = ["MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply"];
const SKIP_COMMITTED = "skipped: pre-archive commit exists; run not archived";
const SKIP_FAILED = "skipped: pre-archive commit failed";

// `created` as /10x-archive reads it: the first line of change.md that starts with "created:", second field split
// on blanks, unmodified. The archive folder name must equal the skill's DEST, so no quote stripping and no trimming.
function createdValue(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return null; }
  const line = text.split("\n").find((l) => l.startsWith("created:"));
  return line === undefined ? null : (line.split(/[ \t]+/)[1] ?? "");
}

// `git status --porcelain -z` as { xy, file } records, or null when git fails. With -z a name with spaces stays unquoted.
// A rename or copy record is followed by one more NUL field (the old name), which is dropped.
function statusEntries(args, opts) {
  const res = runGit(["status", "--porcelain", "-z", ...args], opts);
  if (res.status !== 0) return null;
  const parts = res.stdout.split("\0");
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    entries.push({ xy, file: rec.slice(3) });
    if (/[RC]/.test(xy)) i++;
  }
  return entries;
}

// Up to ten names, joined for a halt message.
const listNames = (names) => `${names.slice(0, 10).join(", ")}${names.length > 10 ? `, +${names.length - 10} more` : ""}`;

// First lines of what a failed git call printed (stderr, then stdout: hooks write to either).
function gitMessage(res) {
  const text = `${res.stderr}\n${res.stdout}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(" | ");
  return text || `exit status ${res.status}`;
}

// The halt text when `rev-parse --is-inside-work-tree` did not answer "true". A git that is missing or timed out
// is reported as such, not as "not a work tree".
function notWorkTree(inside, timeout) {
  if (inside.timedOut) return `--archive needs a git work tree, but git timed out after ${timeout} ms while checking ${ROOT}.`;
  if (inside.status === 127) return `--archive needs a git work tree, but git could not be run: ${gitMessage(inside)}.`;
  if (inside.status !== 0) return `--archive needs a git work tree and ${ROOT} is not one: ${gitMessage(inside)}.`;
  return `--archive needs a git work tree and ${ROOT} is not one.`;
}

const COMMIT_EXISTS = "The pre-archive commit exists, is local and is not undone by the router. A resume makes no commit, " +
  "so the check that the commit touched only the change folder (post-commit check 2) is not repeated; clearing the index " +
  "does not remove a path the commit already holds (amend the commit, or accept it). `next` repeats safely after the cause is fixed.";

// The done branch of a run with --archive. Pre-checks, final report, commit, post-commit checks, then the archive action.
// While the folder is not committed a halt may write the end state (endRun). Once the commit exists, or the run is
// written as done, a halt only prints (out): rewriting meta.json or report.md would dirty the committed folder.
function archiveDone(p, id, meta, log, policy, level, d) {
  const rel = `context/changes/${id}`;
  const ran = executed(log);
  const timeout = policy.archive?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });

  // 1. Already committed and clean (a resume).
  const tracked = g(["ls-files", "--error-unmatch", "--", `${rel}/agent-smith/report.md`]).status === 0;
  const dirty = tracked ? statusEntries(["--", `${rel}/`], { timeout }) : null;
  const committed = tracked && dirty !== null && dirty.length === 0;

  // 2. Pre-checks. Kind A (folder not committed) writes the run's end state, kind B prints only.
  const precheck = (reason) => {
    if (committed) {
      return out({ action: "halt", reason: `${reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true });
    }
    return endRun(p, id, meta, log, { action: "halt", reason: `${reason} Nothing was committed.`, steps: ran.length });
  };
  const inside = g(["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") precheck(notWorkTree(inside, timeout));
  const ignoredProbes = ignoredProbePaths(id, { timeout });
  if (ignoredProbes.length) precheck(`git ignores ${ignoredProbes.join(", ")}, so the change folder cannot be committed.`);
  if (g(["symbolic-ref", "-q", "HEAD"]).status !== 0) precheck("HEAD is detached; check out a branch first.");
  for (const name of IN_PROGRESS) {
    const where = g(["rev-parse", "--git-path", name]);
    if (where.status === 0 && fs.existsSync(path.resolve(ROOT, where.stdout.trim()))) {
      precheck(`A merge, rebase, cherry-pick or revert is in progress (${name} exists); finish or abort it first.`);
    }
  }
  const staged = g(["diff", "--cached", "--quiet"]);
  if (staged.status === 1) {
    const names = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
    precheck(`The index holds staged changes: ${listNames(names)} (paths relative to the git root). Commit or unstage them first.`);
  } else if (staged.status !== 0) {
    precheck(`git diff --cached failed: ${gitMessage(staged)}`);
  }
  const created = createdValue(path.join(p.change, "change.md"));
  if (created === null || !CREATED_RE.test(created)) {
    precheck(`change.md needs a line "created: YYYY-MM-DD" (found ${created === null ? "none" : JSON.stringify(created)}); /10x-archive builds the archive folder name from it.`);
  }
  const archivePath = `context/archive/${created}-${id}`;
  if (fs.existsSync(path.join(ROOT, archivePath))) {
    precheck(`Archive destination ${archivePath} already exists; a reused id on the same date needs a human.`);
  }
  const manualPending = Array.isArray(d.manualPending) ? d.manualPending : [];
  if (policy.archive?.haltOnManualPending === true && manualPending.length) {
    precheck(`Manual rows are pending and archive.haltOnManualPending is true: ${manualPending.join("; ")}`);
  }
  // The message and the tier are settled before git add, so a bad policy never leaves a staged index
  // and never throws after the commit exists.
  const template = policy.archive?.commitMessage;
  if (typeof template !== "string" || !template.trim()) precheck("policy.archive.commitMessage must be a non-blank string.");
  const message = render(template, { id }).trim();
  if (!message) precheck("policy.archive.commitMessage renders to a blank message.");
  let settled;
  try {
    settled = tierFor({ step: "archive" }, ran, policy, readPlan(p.plan), meta, level);
  } catch (e) {
    precheck(`Cannot pick the archive tier: ${e instanceof Error ? e.message : String(e)}`);
  }
  const target = policy.ladder[settled.tier];
  if (!isObject(target) || typeof target.model !== "string" || typeof target.effort !== "string") {
    precheck(`policy.ladder has no entry for tier ${settled.tier}, which the archive step is pinned to.`);
  }

  // 3. Ignored files are reported, never a halt.
  const prefix = (g(["rev-parse", "--show-prefix"]).stdout ?? "").replace(/\r?\n$/, "");
  const unprefix = (file) => (file.startsWith(prefix) ? file.slice(prefix.length) : file);
  const ignoredEntries = statusEntries(["--ignored", "--", `${rel}/`], { timeout }) ?? [];
  const ignored = ignoredEntries.filter((e) => e.xy === "!!").map((e) => unprefix(e.file)).slice(0, 10);

  // 4. Final report, then the commit.
  const done = finishRun(p, id, meta, log, { action: "done", reason: d.reason, manualPending, steps: ran.length });
  const commitFailed = (what, res) => {
    const reset = g(["reset", "-q", "--", rel]);
    const note = res.timedOut
      ? ` git timed out after ${timeout} ms; a hook child may still run and an index.lock may remain.`
      : "";
    return out({
      action: "halt",
      reason: `git ${what} failed: ${gitMessage(res)}.${note} The change folder was ${reset.status === 0 ? "unstaged again" : `not unstaged (git reset failed: ${gitMessage(reset)})`}. Nothing was committed.`,
      steps: ran.length,
      archive: SKIP_FAILED,
      committed: false,
    });
  };
  // A report that could not be written halts here, before anything is staged or committed.
  if (done.reportError) {
    return out({
      action: "halt",
      reason: `report.md was not written: ${done.reportError}. Nothing was committed.`,
      steps: ran.length,
      archive: SKIP_FAILED,
      committed: false,
    });
  }
  const added = g(["add", "--", rel]);
  if (added.status !== 0) commitFailed("add", added);
  const check = g(["diff", "--cached", "--quiet"]);
  if (check.status !== 0 && check.status !== 1) commitFailed("diff --cached", check);
  let madeCommit = false;
  if (check.status === 1) {
    const made = g(["commit", "-m", message, "--", rel]);
    if (made.status !== 0) commitFailed("commit", made);
    madeCommit = true;
  }

  // 5. Post-commit checks. The commit exists, so a halt prints only.
  const commitHalt = (reason) => out({ action: "halt", reason: `${reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true });
  const left = g(["diff", "--cached", "--quiet"]);
  if (left.status !== 0) {
    const names = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
    commitHalt(`The index is not empty after the commit (a hook staged something): ${listNames(names)} (paths relative to the git root).`);
  }
  if (madeCommit) {
    const shown = g(["show", "--name-only", "-z", "--format=", "HEAD"]);
    if (shown.status !== 0) commitHalt(`Cannot list the commit: ${gitMessage(shown)}`);
    const inFolder = `${prefix}${rel}/`;
    const extra = shown.stdout.split("\0").filter(Boolean).filter((name) => !name.startsWith(inFolder));
    if (extra.length) commitHalt(`The commit holds paths outside ${rel}: ${listNames(extra)} (paths relative to the git root).`);
  }
  const unclean = statusEntries(["--", `${rel}/`], { timeout });
  if (unclean === null) commitHalt("Cannot read the status of the change folder.");
  if (unclean.length) commitHalt(`The change folder is not clean after the commit: ${listNames(unclean.map((e) => unprefix(e.file)))}.`);

  // 6. The archive action. No log entry and no resultFile: nothing may be written into the folder that moves.
  let commit = null;
  if (madeCommit) {
    const head = g(["rev-parse", "--short", "HEAD"]);
    commit = head.status === 0 && head.stdout.trim() ? head.stdout.trim() : "HEAD";
  }
  const prompt = render(policy.prompts.archive, { id }).trim() + "\n\n" + policy.prompts.suffix;
  return out({
    action: "archive",
    model: target.model,
    effort: target.effort,
    reason: `run done; ${commit ? `committed ${commit}` : "folder already committed"}; tier ${settled.tier} (${settled.tierWhy})`,
    prompt,
    summary: { reason: d.reason, manualPending, steps: ran.length },
    report: done.report,
    archivePath,
    commit,
    ignored,
  });
}

function next(id, policy) {
  const p = paths(id);
  guardArchived(p, id);
  fs.mkdirSync(p.dir, { recursive: true });
  const meta = readMeta(p.meta, { id, goal: "" });
  const log = readLog(p.log);
  attachResult(p, log, policy);

  const planNow = readPlan(p.plan);
  const risk = planNow.exists ? measureRisk(p, meta, log, policy) : null;
  const { level, changed } = resolveRigor(meta, log, policy, planNow, risk);
  if (changed) fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");

  // A subagent that cannot decide from evidence stops the run once. The ack lives on the log entry.
  const ranNow = executed(log);
  const lastRan = ranNow[ranNow.length - 1];
  if (lastRan?.signals?.needsHuman && !lastRan.needsHumanAck) {
    lastRan.needsHumanAck = true;
    return endRun(p, id, meta, log, {
      action: "halt",
      reason: `Step ${lastRan.n} (${lastRan.step}) needs a human: ${lastRan.signals.needsHuman}`,
      steps: ranNow.length,
    });
  }

  const budget = Math.max(1, policy.limits.maxTotalSteps + (policy.rigor.budgetDelta?.[level] ?? 0));
  if (executed(log).length >= budget) {
    return endRun(p, id, meta, log, { action: "halt", reason: `Step budget ${budget} spent.` });
  }

  // decide() may skip a step: log the skip and ask again, at most three times in one call.
  let d;
  for (let asked = 1; ; asked++) {
    d = decide(p, log, policy, meta, { level, risk });
    if (!d.skip) break;
    if (asked >= 3) {
      return endRun(p, id, meta, log, { action: "halt", reason: "Router error: skip loop", steps: executed(log).length });
    }
    log.push({
      skipped: true,
      step: d.skip.step,
      reason: d.skip.reason,
      rigor: level,
      risk: d.skip.risk,
      afterN: executed(log).length,
      at: Date.now(),
    });
    writeLog(p.log, log);
  }
  const ran = executed(log);
  if (d.done && meta.archive === true) return archiveDone(p, id, meta, log, policy, level, d);
  if (d.halt || d.done) {
    return endRun(p, id, meta, log, d.done
      ? { action: "done", reason: d.reason, manualPending: d.manualPending, steps: ran.length }
      : { action: "halt", reason: d.halt, steps: ran.length });
  }

  const plan = readPlan(p.plan);
  const { tier, fails, simple, tierWhy } = tierFor(d, ran, policy, plan, meta, level);
  if (fails >= policy.escalation.maxAttemptsPerStep) {
    return endRun(p, id, meta, log, { action: "halt", reason: `${d.step} failed ${fails} times in a row. Last note: ${ran[ran.length - 1]?.result?.note ?? "none"}` });
  }

  // A continued run must not keep the outcome of an earlier end.
  if (meta.outcome) {
    delete meta.outcome;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }

  const { model, effort } = policy.ladder[tier];
  const template = d.template ?? d.step;
  const prompt = render(policy.prompts[template], { id, goal: meta.goal, verdict: d.verdict ?? "" }).trim() +
    "\n\n" + policy.prompts.suffix;
  const entry = {
    n: ran.length + 1,
    step: d.step,
    template,
    skill: policy.steps[d.step].skill,
    tier,
    model,
    effort,
    reason: d.reason,
    tierWhy,
    simple,
    rigor: level,
    startedAt: Date.now(),
    before: { autoDone: plan.autoDone },
  };
  if (d.verdict) entry.verdict = d.verdict; // the review verdict that caused this step
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

// Read-only, files only, no git: did /10x-archive move this change and stamp it archived.
function verifyArchive(id, flags) {
  const no = (reason, extra = {}) => out({ archived: false, reason, ...extra }, 1);
  let name;
  if (flags.path !== undefined) {
    if (typeof flags.path !== "string") no("--path needs a folder");
    const m = flags.path.replace(/^\.\//, "").replace(/\/$/, "").match(/^context\/archive\/([^/\\]+)$/);
    if (!m || !archiveDirs(id).includes(m[1])) no(`--path is not an archive folder of ${id}`);
    name = m[1];
  } else {
    const found = archiveDirs(id);
    if (found.length > 1) {
      const folders = found.map((n) => `context/archive/${n}`);
      no(`More than one archive folder for ${id}: ${folders.join(", ")}. Pass --path.`, { ambiguous: folders });
    }
    name = found[0];
  }
  const p = paths(id);
  const stillThere = fs.existsSync(p.change);
  if (name === undefined) {
    const stamped = stillThere && frontmatterField(path.join(p.change, "change.md"), "status") === "archived";
    no(stamped
      ? `No archive folder for ${id}: context/changes/${id} is stamped archived but was not moved.`
      : `No archive folder for ${id} under context/archive/.`);
  }
  const rel = `context/archive/${name}`;
  const changeFile = path.join(ROOT, rel, "change.md");
  if (!fs.existsSync(changeFile)) no(`${rel}/change.md is missing.`);
  const status = frontmatterField(changeFile, "status");
  if (status !== "archived") no(`${rel}/change.md has status ${status === null ? "(none)" : status}, not archived.`);
  if (stillThere) no(`context/changes/${id} still exists next to ${rel}.`);
  const archivedAt = frontmatterField(changeFile, "archived_at");
  out({
    archived: true,
    path: rel,
    archivedAt: archivedAt === "null" ? null : archivedAt,
    report: fs.existsSync(path.join(ROOT, rel, "agent-smith/report.md")) ? `${rel}/agent-smith/report.md` : null,
  });
}

// Read-only: prints the churn numbers for a change.
function riskCommand(id, policy) {
  const p = paths(id);
  const meta = readMeta(p.meta, { id, goal: "" });
  const r = measureRisk(p, meta, readLog(p.log), policy);
  out({ source: r.source, hot: r.hot, planPaths: r.planPaths, unclassified: r.unclassified, planHits: r.planHits, diffHits: r.diffHits, level: r.level });
}

function status(id, flags) {
  const p = paths(id);
  const log = readLog(p.log);
  const res = {
    change: id,
    rigor: readMeta(p.meta, {}).rigor?.level ?? null,
    steps: log.map((e) => e.skipped ? { skipped: true, step: e.step, reason: e.reason, rigor: e.rigor ?? null, afterN: e.afterN ?? null, risk: e.risk ?? null } : ({
      n: e.n, step: e.step, model: e.model, effort: e.effort, simple: e.simple ?? null,
      ok: e.ok ?? null, verified: e.verified ?? null, note: e.result?.note ?? null, reason: e.reason,
      usage: e.usage ?? null,
    })),
  };
  if (flags.report) {
    guardArchived(p, id);
    if (!fs.existsSync(p.change)) out({ action: "halt", reason: `No change folder context/changes/${id}.` }, 1);
    const meta = readMeta(p.meta, { id, goal: "" });
    res.report = writeReport(p, id, meta, log);
  }
  out(res);
}

// ---- main -----------------------------------------------------------------

function halt(reason) {
  out({ action: "halt", reason }, 1);
}

function main() {
  const [cmd, id, ...rest] = process.argv.slice(2);
  if (!cmd || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    halt("Usage: route.mjs init|next|status|risk <change-id> [--goal text] [--rigor level] [--archive] [--report] | verify-archive <change-id> [--path <p>]");
  }
  const policy = loadPolicy();
  const flags = parseFlags(rest);

  if (cmd === "init") {
    const levels = rigorLevels(policy);
    // --rigor is checked before anything is written.
    if (flags.rigor !== undefined && (typeof flags.rigor !== "string" || !levels.includes(flags.rigor))) {
      halt(`Invalid --rigor ${flags.rigor === true ? "(no value)" : flags.rigor}. Use one of: ${levels.join(", ")}.`);
    }
    // --archive is checked before anything is written: a bare flag or "true" turns it on, "false" turns it off.
    let archive;
    if (flags.archive !== undefined) {
      if (flags.archive === true || flags.archive === "true") archive = true;
      else if (flags.archive === "false") archive = false;
      else halt(`Invalid --archive ${flags.archive}. Use --archive, --archive true or --archive false.`);
    }
    const p = paths(id);
    guardArchived(p, id);
    const prev = readMeta(p.meta, {});
    // No flag keeps the stored value, so a resume of an archive run is checked again.
    if ((archive ?? prev.archive) === true) {
      const timeout = policy.archive?.gitTimeoutMs;
      const inside = runGit(["rev-parse", "--is-inside-work-tree"], { timeout });
      if (inside.status !== 0 || inside.stdout.trim() !== "true") {
        halt(`${notWorkTree(inside, timeout)} Nothing was written.`);
      }
      const ignored = ignoredProbePaths(id, { timeout });
      if (ignored.length) {
        halt(`--archive needs git to track the change folder, but git ignores ${ignored.join(", ")}. Fix .gitignore or run without --archive. Nothing was written.`);
      }
    }
    fs.mkdirSync(p.dir, { recursive: true });
    // An empty, blank or valueless --goal keeps the stored goal.
    const goal = typeof flags.goal === "string" && flags.goal.trim() ? flags.goal : typeof prev.goal === "string" ? prev.goal : "";
    // Keep every stored field (rigor and whatever later changes add); a stored rigor that is no object is dropped.
    const meta = { ...prev, id, goal };
    if (!isObject(prev.rigor)) delete meta.rigor;
    if (archive !== undefined) meta.archive = archive;
    if (flags.rigor !== undefined) {
      // On resume --rigor can raise the requested level, never lower it.
      const old = isObject(prev.rigor) && levels.includes(prev.rigor.requested) ? prev.rigor.requested : flags.rigor;
      meta.rigor = { ...meta.rigor, requested: maxLevel(levels, old, flags.rigor) };
    }
    // The commit the run started from: churn is counted up to it. Set once, kept on resume.
    if (!(typeof meta.baseSha === "string" && SHA_RE.test(meta.baseSha))) {
      delete meta.baseSha;
      const head = (gitOut(["rev-parse", "HEAD"]) ?? "").trim();
      if (SHA_RE.test(head)) meta.baseSha = head;
    }
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
    next(id, policy);
  } else if (cmd === "next") {
    next(id, policy);
  } else if (cmd === "status") {
    status(id, flags);
  } else if (cmd === "risk") {
    riskCommand(id, policy);
  } else if (cmd === "verify-archive") {
    verifyArchive(id, flags);
  } else {
    halt(`Unknown command ${cmd}`);
  }
}

try {
  main();
} catch (e) {
  // Never a stack trace: a bad policy or a bad file ends the run with JSON.
  halt(`Router error: ${e instanceof Error ? e.message : String(e)}`);
}
