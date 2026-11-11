import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = process.cwd();

export function out(obj, code = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(code);
}

export function parseFlags(args) {
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

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

// policy.json deep-merged with the project override. null when policy.json is unreadable; each caller decides.
function mergedPolicy() {
  const base = readJson(path.join(SKILL_DIR, "policy.json"), null);
  if (!base) return null;
  const override = readJson(path.join(ROOT, "context/foundation/agent-smith-policy.json"), null);
  return override ? deepMerge(base, override) : base;
}

export function loadPolicy() {
  const policy = mergedPolicy();
  if (!policy) out({ action: "halt", reason: `Cannot read ${path.join(SKILL_DIR, "policy.json")}` }, 1);
  return policy;
}

// ---- cost estimate ----------------------------------------------------------

// The price table of the policy: { usdPerMillionTokens: { <model alias>: <number> } }, or null when prices are off.
// A block of another shape reads as off and never halts; an entry that is not a finite number >= 0 under a non-empty
// key is dropped, so that alias is unpriced. A 0 price is a price.
export function priceTable(policy) {
  const prices = policy?.prices;
  if (prices === null || typeof prices !== "object" || Array.isArray(prices)) return null;
  const raw = prices.usdPerMillionTokens;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const usdPerMillionTokens = {};
  for (const [alias, price] of Object.entries(raw)) {
    if (alias.trim() !== "" && typeof price === "number" && Number.isFinite(price) && price >= 0) usdPerMillionTokens[alias] = price;
  }
  return Object.keys(usdPerMillionTokens).length ? { usdPerMillionTokens } : null;
}

// The price table of the merged policy, read without halting: an unreadable policy.json reads as no prices. Used where
// no policy is at hand (the report, status).
export function loadPrices() {
  try { return priceTable(mergedPolicy()); } catch { return null; }
}

// A blended-rate estimate over executed log entries. withFigures counts entries with a token figure (a non-negative
// safe integer, the test of usage intake); priced counts those whose model alias has a price; usd sums
// totalTokens * price / 1e6 over them, unrounded (each consumer rounds); unpriced lists the distinct aliases (unknown
// for a missing model) that had a figure and no price; perEntry maps entry n to its USD, or null. Never throws.
export function estimateCost(entries, table) {
  const res = { usd: 0, priced: 0, withFigures: 0, unpriced: [], perEntry: {} };
  const prices = table?.usdPerMillionTokens ?? {};
  const unpriced = new Set();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!isObject(e)) continue;
    const tokens = isObject(e.usage) ? e.usage.totalTokens : undefined;
    const has = Number.isSafeInteger(tokens) && tokens >= 0;
    const model = typeof e.model === "string" && e.model ? e.model : "unknown";
    const price = Object.hasOwn(prices, model) ? prices[model] : undefined;
    let usd = null;
    if (has) {
      res.withFigures++;
      if (price === undefined) unpriced.add(model);
      else {
        usd = (tokens * price) / 1e6;
        res.usd += usd;
        res.priced++;
      }
    }
    if (e.n !== undefined) res.perEntry[e.n] = usd;
  }
  res.unpriced = [...unpriced].sort();
  return res;
}

// A USD figure rounded to `digits` decimals, as a number.
export const roundUsd = (usd, digits = 4) => Number(usd.toFixed(digits));

export function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

// ---- disk readers ---------------------------------------------------------

// The id of a Progress row: its leading N.M, else the whole text without a trailing SHA or evidence suffix,
// so a suffix never changes an id.
const ROW_SUFFIX_RE = /\s+\u2014\s+(?:[0-9a-f]{7,40}|evidence:\s*\S+)$/;
function rowId(text) {
  const m = text.match(/^(\d+\.\d+)(?=\s|$)/);
  return m ? m[1] : text.replace(ROW_SUFFIX_RE, "");
}

export function readPlan(file) {
  const res = { exists: false, hasProgress: false, phases: 0, rows: 0, autoDone: 0, autoPending: 0, manualPending: [], phaseList: [], mtime: 0 };
  // A chain without a plan (OpenSpec: paths().plan is null) reads as a missing plan.
  if (typeof file !== "string" || !fs.existsSync(file)) return res;
  res.exists = true;
  res.mtime = mtime(file);
  const text = fs.readFileSync(file, "utf8");
  const idx = text.search(/^## Progress\s*$/m);
  if (idx < 0) return res;
  res.hasProgress = true;
  let section = null;
  let cur = null;
  for (const line of text.slice(idx).split("\n")) {
    if (/^## /.test(line) && !/^## Progress\s*$/.test(line)) break;
    if (/^### Phase \d+/.test(line)) {
      res.phases++;
      section = null;
      const h = line.match(/^### Phase (\d+)\s*:?\s*(.*)$/);
      cur = { n: Number(h[1]), name: h[2].trim(), auto: [], manual: [] };
      res.phaseList.push(cur);
      continue;
    }
    if (/^#### Automated/.test(line)) { section = "auto"; continue; }
    if (/^#### Manual/.test(line)) { section = "manual"; continue; }
    const m = line.match(/^- \[( |x|X)\] (.*)$/);
    if (!m) continue;
    res.rows++;
    const done = m[1] !== " ";
    if (cur) {
      const text = m[2].trim();
      cur[section === "manual" ? "manual" : "auto"].push({ id: rowId(text), text, done });
    }
    if (section === "manual") { if (!done) res.manualPending.push(m[2].trim()); }
    else if (done) res.autoDone++;
    else res.autoPending++;
  }
  return res;
}

// The findings of a review: one record per "### F<n>" block, which runs to the next "## " or "### " heading. The severity
// is the first of CRITICAL, WARNING and OBSERVATION on the block's Severity line (emoji ignored); a block that names none
// reads as a warning, so an unreadable severity is never cleaner than it is. The decision is the first run of ASCII
// letters after "**Decision**:" on that line, upper-cased ("APPLIED - abc1234" reads APPLIED, "**APPLIED**" and "`APPLIED`"
// read APPLIED, "ACCEPTED-AS-RULE: x" reads ACCEPTED), or null when the line is missing or has no letters. Both label forms,
// "**Severity**:" and "**Severity:**", are read. Nothing here judges whether a decision is true.
function readFindings(text) {
  const findings = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join("\n");
    const sev = body.match(/\*\*Severity(?:\*\*|:\*\*)[^\n]*/);
    const word = sev ? sev[0].match(/CRITICAL|WARNING|OBSERVATION/i) : null;
    const dec = body.match(/\*\*Decision(?:\*\*:|:\*\*)[^A-Za-z\n]*([A-Za-z]+)/);
    findings.push({
      id: cur.id,
      severity: word ? word[0].toLowerCase() : "warning",
      decision: dec ? dec[1].toUpperCase() : null,
    });
    cur = null;
  };
  for (const line of text.split("\n")) {
    if (/^#{2,3}\s/.test(line)) {
      flush();
      const h = line.match(/^###\s+(F\d+)\b/);
      if (h) cur = { id: h[1], lines: [] };
    } else if (cur) cur.lines.push(line);
  }
  flush();
  return findings;
}

export function readReview(file) {
  const res = { exists: false, verdict: null, critical: 0, warnings: 0, findings: [], mtime: 0 };
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
  res.findings = readFindings(text);
  return res;
}

// The open-findings keys of the policy, read tolerantly: a value of the wrong shape reads as the shipped default and never
// halts, except a non-boolean `enabled`, which reads as off. The words are upper-cased to match readFindings. `onOpen` is
// "retry" only when it says so; anything else reads "halt".
const DEFAULT_CLOSED_DECISIONS = ["APPLIED", "FIXED", "ACCEPTED", "SKIPPED", "DISMISSED"];
export function openFindingsConfig(policy) {
  const c = policy?.review?.openFindings;
  if (!isObject(c)) return { enabled: true, closed: new Set(DEFAULT_CLOSED_DECISIONS), onOpen: "halt" };
  const words = Array.isArray(c.closedDecisions) && c.closedDecisions.every((w) => typeof w === "string" && w.trim() !== "")
    ? c.closedDecisions.map((w) => w.trim().toUpperCase())
    : DEFAULT_CLOSED_DECISIONS;
  return { enabled: c.enabled === true, closed: new Set(words), onOpen: c.onOpen === "retry" ? "retry" : "halt" };
}

// What is still open in a review. `aware` is false (and the caller uses the measured header counts) unless the feature is on
// and at least one finding carries a Decision line. A missing, PENDING or unknown decision is open; observations never count.
// A header count above the parsed blocks adds the difference as open (`unparsed`), so a review that lists fewer blocks than it
// claims is never read as cleaner than it says.
export function openCounts(review, policy) {
  const res = { aware: false, openCritical: 0, openWarnings: 0, applied: 0, ids: [], unparsed: 0 };
  const cfg = openFindingsConfig(policy);
  const findings = review.findings ?? [];
  if (!cfg.enabled || !findings.some((f) => f.decision !== null)) return res;
  res.aware = true;
  let parsedCritical = 0;
  let parsedWarnings = 0;
  for (const f of findings) {
    if (f.severity === "observation") continue;
    if (f.severity === "critical") parsedCritical++; else parsedWarnings++;
    if (f.decision === "APPLIED" || f.decision === "FIXED") res.applied++;
    if (f.decision !== null && cfg.closed.has(f.decision)) continue;
    res.ids.push(f.id);
    if (f.severity === "critical") res.openCritical++; else res.openWarnings++;
  }
  const extraCritical = Math.max(0, review.critical - parsedCritical);
  const extraWarnings = Math.max(0, review.warnings - parsedWarnings);
  res.openCritical += extraCritical;
  res.openWarnings += extraWarnings;
  res.unparsed = extraCritical + extraWarnings;
  return res;
}

// ---- archive lookup -------------------------------------------------------

// The archive root of a chain, relative to the project root: context/archive for 10x, openspec/changes/archive for
// OpenSpec (the folder `openspec archive` moves a change into).
export const archiveRoot = (chain = "10x") => (chain === "openspec" ? "openspec/changes/archive" : "context/archive");

// An id that already starts with a date. `openspec archive` keeps such a name as the archive folder name.
export const DATED_ID = /^\d{4}-\d{2}-\d{2}-/;

// Does a folder name under the chain's archive root belong to this id: <YYYY-MM-DD>-<id>, anchored at both ends, or,
// for OpenSpec, the id itself when it already starts with a date. A name that only ends with the id (2026-01-01-x-<id>)
// is another change. The id is already [a-z0-9-].
export function isArchiveName(name, id, chain = "10x") {
  if (chain === "openspec" && DATED_ID.test(id) && name === id) return true;
  return new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${id}$`).test(name);
}

// Folder names under the chain's archive root that belong to this id (isArchiveName), sorted.
export function archiveDirs(id, chain = "10x") {
  let names;
  try { names = fs.readdirSync(path.join(ROOT, archiveRoot(chain))); } catch { return []; }
  return names.filter((name) => isArchiveName(name, id, chain)).sort();
}

// One field of the first --- block of a file, quotes stripped. null when the file, the block or the field is missing.
export function frontmatterField(file, key) {
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
// An OpenSpec change has no status stamp: it halts only when the live folder is gone and an archive folder exists.
export function guardArchived(p, id, chain = p.chain ?? "10x") {
  if (!fs.existsSync(p.change)) {
    const found = archiveDirs(id, chain).map((name) => `${archiveRoot(chain)}/${name}`);
    if (found.length) {
      out({ action: "halt", reason: `Change ${id} is archived at ${found.join(", ")}. Nothing was written.`, archivePath: found[0] }, 1);
    }
    return;
  }
  if (chain === "openspec") return;
  if (frontmatterField(path.join(p.change, "change.md"), "status") === "archived") {
    out({ action: "halt", reason: `Change ${id} is stamped archived but its folder was not moved. Nothing was written; finish or undo /10x-archive by hand.` }, 1);
  }
}

// ---- run log --------------------------------------------------------------

// `complexity` is the score file of the policy's score block, or null when no policy is given or the block is malformed.
// The OpenSpec chain keeps its run state in openspec/changes/<id>/agent-smith/ and has no plan, reviews or score file.
export function paths(id, policy = null, chain = "10x") {
  if (chain === "openspec") return openspecPaths(id);
  const change = path.join(ROOT, "context/changes", id);
  const dir = path.join(change, "agent-smith");
  const score = policy ? scoreConfig(policy) : null;
  return {
    change,
    complexity: score ? path.join(change, score.file) : null,
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

// The paths of an OpenSpec run. `chain` marks the object, so helpers that take `p` can tell the chains apart.
function openspecPaths(id) {
  const change = path.join(ROOT, "openspec/changes", id);
  const dir = path.join(change, "agent-smith");
  return {
    chain: "openspec",
    change,
    complexity: null,
    dir,
    meta: path.join(dir, "meta.json"),
    log: path.join(dir, "run.jsonl"),
    result: path.join(dir, "last-result.json"),
    report: path.join(dir, "report.md"),
    plan: null,
    planReview: null,
    implReview: null,
    tasks: path.join(change, "tasks.md"),
    proposal: path.join(change, "proposal.md"),
    design: path.join(change, "design.md"),
    specs: path.join(change, "specs"),
    verify: path.join(dir, "verify.md"),
  };
}

export function readLog(file) {
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
export function executed(log) {
  return log.filter((e) => !e.skipped);
}

// meta.json must be a plain object; anything else falls back.
export function readMeta(file, fallback) {
  const m = readJson(file, null);
  return m && typeof m === "object" && !Array.isArray(m) ? m : fallback;
}

export function writeLog(file, entries) {
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// ---- decision -------------------------------------------------------------

export function lastIdx(log, names, okOnly = true) {
  for (let i = log.length - 1; i >= 0; i--) {
    if (names.includes(log[i].step) && (!okOnly || log[i].ok)) return i;
  }
  return -1;
}

// A failed step. A fallback entry (an executor that handed the phase back) is neutral, not a failure, and so is an
// advisory entry (a score attempt: the score only advises, so its failure raises no rigor and withholds no discount).
export const isFailure = (e) => e.ok === false && !e.fallback && !e.advisory;

// A failed advisory entry uses no step budget; the score's own attempt cap bounds its cost.
// A failed advisory entry (score) and a failed cheap first attempt (escalation.firstAttempt) use no budget.
// A cheap fallback (a blocked tdd or e2e step) is no failure, so it uses budget like any other fallback.
export const budgetSteps = (log) => executed(log).filter((e) => !((e.advisory && e.ok === false) || (e.cheap && isFailure(e)))).length;

export function trailingFailures(log, step) {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].fallback) continue;
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
export function goalClass(goal, policy) {
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

export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Level order comes from policy.rigor.levels. A malformed block throws; main turns that into a JSON halt.
export function rigorLevels(policy) {
  const levels = policy.rigor?.levels;
  if (!Array.isArray(levels) || !levels.length || levels.some((l) => typeof l !== "string")) {
    throw new Error("policy.rigor.levels must be a non-empty array of strings");
  }
  return levels;
}

// The highest of two level names. A name that is not a level loses.
export function maxLevel(levels, a, b) {
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

  // A failed cheap first attempt is neutral for the level: the retry runs above it anyway.
  const failed = log.filter((e) => isFailure(e) && !e.cheap).length;
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
export function resolveRigor(meta, log, policy, plan, risk) {
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
export const SHA_RE = /^[0-9a-f]{40,64}$/;

// Runs git without a shell in the project root. Never throws. Returns { status, stdout, stderr, timedOut }.
// status is git's exit code, 127 when git is missing, 124 on a timeout (opts.timeout in ms), 1 for any other failure.
// The only -c option is core.quotePath=false, a display setting: paths print raw, not escaped.
export function runGit(args, opts = {}) {
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
export function gitOut(args) {
  const res = runGit(args);
  return res.status === 0 ? res.stdout : null;
}

// The files of a change that `git add` must be able to commit, relative to the project root.
// run.jsonl, meta.json and report.md are what the router writes; change.md is the file the archive stamps.
// Probes files, never the directory: check-ignore on a directory that does not exist yet exits 1
// whatever .gitignore says, and a directory probe misses file patterns such as *.jsonl.
// For OpenSpec (`opts.chain`) the identity file is tasks.md, the file the router reads to route.
export function ignoredProbePaths(id, opts = {}) {
  const { chain = "10x", ...gitOpts } = opts;
  const base = chain === "openspec" ? `openspec/changes/${id}` : `context/changes/${id}`;
  const own = chain === "openspec" ? `${base}/tasks.md` : `${base}/change.md`;
  return [`${base}/agent-smith/run.jsonl`, `${base}/agent-smith/meta.json`, `${base}/agent-smith/report.md`, own]
    .filter((file) => runGit(["check-ignore", "-q", "--", file], gitOpts).status === 0);
}

// Glob without dependencies: "**/" is zero or more directories, "**" anything, "*" and "?" stay inside one segment.
export function globToRegex(glob) {
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
export function churnConfig(policy) {
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
export function normalizePlanPath(raw) {
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
  if (typeof file !== "string" || !fs.existsSync(file)) return [];
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
export function measureRisk(p, meta, log, policy) {
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

// Churn risk was measured: history was readable, the plan names at least one path and every named path was matched
// against the hot set. The lean plan-review skip and the score down shift share this test so the two cannot drift.
export function riskMeasured(risk) {
  return isObject(risk) && risk.source !== "unavailable" && (risk.planPaths ?? 0) >= 1 && (risk.unclassified?.length ?? 0) === 0;
}

export const ARTIFACT_NAME = /^[A-Za-z0-9._-]+$/;

// The score block of the policy, or null when it is malformed. A malformed block turns the step off and never throws.
export function scoreConfig(policy) {
  const c = policy?.score;
  if (!isObject(c) || !isObject(policy.steps?.score)) return null;
  const posInt = (v) => Number.isSafeInteger(v) && v > 0;
  const names = (v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s);
  if (typeof c.file !== "string" || !ARTIFACT_NAME.test(c.file) || /^\.+$/.test(c.file)) return null;
  if (!Number.isSafeInteger(c.schemaVersion) || !posInt(c.maxBytes) || !posInt(c.maxAttempts) || !posInt(c.maxInvalid)) return null;
  if (!isObject(c.scale) || !Number.isSafeInteger(c.scale.min) || !Number.isSafeInteger(c.scale.max) || c.scale.min > c.scale.max) return null;
  if (!isObject(c.factors) || !names(c.factors.cognitive) || !names(c.factors.execution) || !names(c.confidences)) return null;
  return c;
}

export function halt(reason) {
  out({ action: "halt", reason }, 1);
}

// ---- run lock -------------------------------------------------------------

// The lock lives in the OS temp directory, outside the change folder, so no step commit or archive-state check sees it.
export function runLockPath(dir) {
  return path.join(os.tmpdir(), `agent-smith-${crypto.createHash("sha256").update(dir).digest("hex").slice(0, 16)}.lock`);
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

// Takes the lock of the run or halts. The pid is in the file from the moment it exists: written to a private temp file,
// then linked to the lock name, so a second caller never reads an empty lock as stale.
export function acquireRunLock(id, chain) {
  const lock = runLockPath(paths(id, null, chain).dir);
  const tmp = `${lock}.${process.pid}.tmp`;
  const own = String(process.pid);
  fs.writeFileSync(tmp, own);
  const unlinkQuiet = (file) => { try { fs.unlinkSync(file); } catch { /* already gone */ } };
  // The temp file is always this process's. The lock is removed only while it still holds this pid, so a lock
  // another process holds, or took over, is never touched.
  const release = () => {
    unlinkQuiet(tmp);
    let holder = null;
    try { holder = fs.readFileSync(lock, "utf8"); } catch { /* already gone */ }
    if (holder === own) unlinkQuiet(lock);
  };
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        fs.linkSync(tmp, lock);
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        let pid = NaN;
        try { pid = Number(fs.readFileSync(lock, "utf8").trim()); } catch { /* vanished: retry */ }
        if (Number.isInteger(pid) && pid > 0 && pidAlive(pid)) {
          release();
          halt(`Another init, next or usage of change ${id} is running (lock file ${lock}, pid ${pid}). Run router calls one at a time. A lock left by a dead process is removed automatically. Nothing was written.`);
        }
        if (attempt > 0) throw e;
        unlinkQuiet(lock); // stale: remove it and try once more; another caller may have removed it already
      }
    }
  } catch (e) {
    release();
    throw e;
  }
  unlinkQuiet(tmp);
  process.on("exit", release);
}
