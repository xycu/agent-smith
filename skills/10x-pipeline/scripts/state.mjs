import fs from "node:fs";
import { liveRunDirectory, lockRunDirectory } from "./run-lock.mjs";
import path from "node:path";
import { hash } from "node:crypto";
export { runLockPath } from "./run-lock.mjs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { accountingFor, nativeClaudeSession } from "./usage.mjs";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The OpenSpec chain's skill folder: its policy fragment, prompts, rules and module (ADR-013 Amendment 1).
export const OPENSPEC_DIR = path.resolve(SKILL_DIR, "../openspec-pipeline");
export const ROOT = process.cwd();
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function out(obj, code = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(code);
}

// A flag is "--key value" or "--key=value" (split at the first "="). valueFlags always take the next
// argument as their value, even one that starts with "--".
// Arguments that belong to no flag go to flags._, and so does an argument with no usable key ("--", "--_",
// "--=x"), which takes no value: flags._ lists every word no flag claimed. flags has no prototype, so a
// key such as "__proto__" is stored like any other and a caller that checks the keys sees it.
export function parseFlags(args, valueFlags = []) {
  const flags = Object.create(null);
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf("=");
    const key = arg.startsWith("--") ? arg.slice(2, eq === -1 ? undefined : eq) : "";
    if (key === "" || key === "_") { rest.push(arg); continue; }
    if (eq !== -1) { flags[key] = arg.slice(eq + 1); continue; }
    const takes = args[i + 1] !== undefined && (valueFlags.includes(key) || !args[i + 1].startsWith("--"));
    flags[key] = takes ? args[++i] : true;
  }
  flags._ = rest;
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

// The plugin policy: the 10x policy.json deep-merged with the OpenSpec fragment (skills/openspec-pipeline/policy.json,
// the os- steps and prompts; ADR-013 Amendment 1), without the project override. null when either file is unreadable
// or not an object.
export function pluginPolicy() {
  const base = readJson(path.join(SKILL_DIR, "policy.json"), null);
  const fragment = readJson(path.join(OPENSPEC_DIR, "policy.json"), null);
  if (!isObject(base) || !isObject(fragment)) return null;
  return deepMerge(base, fragment);
}

// The plugin policy deep-merged with the project override. null when a plugin policy file is unreadable; each caller
// decides.
function mergedPolicy(onError = halt) {
  const base = pluginPolicy();
  if (!base) return null;
  const file = path.join(ROOT, "context/foundation/agent-smith-policy.json");
  if (!fs.existsSync(file)) return base;
  let override;
  try { override = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {
    onError(`Cannot parse ${file}: ${e.message}. Fix the JSON or remove the file.`);
  }
  // Any other JSON value would replace the whole policy (an array, a number) or be dropped silently (null, false).
  if (!isObject(override)) {
    const kind = override === null ? "null" : Array.isArray(override) ? "an array" : `a ${typeof override}`;
    onError(`${file} must hold a JSON object of policy keys, not ${kind}. Fix the file or remove it.`);
  }
  if (Object.hasOwn(override, "splitProviders")) {
    onError(`${file} cannot replace the chain's splitProviders roles. Remove that key and select a run with --provider-mode. Nothing was written.`);
  }
  return deepMerge(base, override);
}

export function loadPolicy(onError = halt) {
  const policy = mergedPolicy(onError);
  if (!policy) {
    const files = [path.join(SKILL_DIR, "policy.json"), path.join(OPENSPEC_DIR, "policy.json")];
    const bad = files.filter((file) => !isObject(readJson(file, null)));
    onError(`Cannot read ${(bad.length ? bad : files).join(" or ")}`);
  }
  return policy;
}

// Missing provider/host fields belong to runs and overrides made before OpenAI support.
export const providerOf = (target) => target?.provider === undefined ? "claude" : target.provider;
export const hostOf = (meta) => meta?.host === undefined ? "claude" : meta.host;
// A custom Codex permissions profile name that a -c inline-table key can carry: no dots, quotes or builtin ":" prefix.
export const PERMISSIONS_NAME_RE = /^[A-Za-z0-9_-]{1,128}$/;

const providerForHost = (host) => host === "codex" ? "openai" : "claude";

function assignedProvider(policy, meta, step, template) {
  if (meta.providerMode !== "split") return providerForHost(meta.providerMode);
  const rules = policy.splitProviders[meta.chain ?? "10x"];
  const other = rules.otherSteps.includes(step) && rules.hostTemplates[template] !== step;
  const host = providerForHost(hostOf(meta));
  return other ? (host === "claude" ? "openai" : "claude") : host;
}

export function providersByStep(policy, meta) {
  const chain = meta.chain ?? "10x";
  const rules = policy.splitProviders[chain];
  const entries = Object.keys(policy.steps).filter((s) => s.startsWith("os-") === (chain === "openspec")).map((s) => [s, s]);
  const legacy = [...new Set(policy.ladder.map(providerOf))];
  return Object.fromEntries([...entries, ...Object.entries(rules.hostTemplates)].map(([template, step]) =>
    [template, meta.providerMode ? assignedProvider(policy, meta, step, template) : legacy]));
}

// The override retains its ordinal positions. Only a homogeneous override replaces a provider's whole ladder.
function providerLadder(policy, provider) {
  const custom = policy.ladder;
  if (custom.every((r) => providerOf(r) === provider)) return custom;
  const file = provider === "openai" ? "codex-policy.json" : "policy.json";
  const shipped = readJson(path.join(SKILL_DIR, file), null)?.ladder;
  if (!Array.isArray(shipped) || !shipped.length || shipped.some((r) => !r || providerOf(r) !== provider)) {
    throw new Error(`Invalid shipped ${provider} ladder in ${file}`);
  }
  const ladder = [...shipped];
  custom.forEach((r, index) => { if (providerOf(r) === provider) ladder[index] = r; });
  return ladder;
}

export function stepPolicy(policy, meta, step, template = step) {
  if (!meta.providerMode) return policy;
  return { ...policy, ladder: providerLadder(policy, assignedProvider(policy, meta, step, template)) };
}

export function selectionProblem(policy, meta, checkBounds = true) {
  const host = hostOf(meta);
  if (meta.providerMode === undefined) return policyProblems(policy) ?? hostProblem(policy, host);
  if (!["claude", "codex", "split"].includes(meta.providerMode)) return "Invalid stored providerMode. Nothing was written.";
  if (!["claude", "codex"].includes(host)) return "Invalid stored host. Nothing was written.";
  if (!checkBounds) return null;
  const rules = policy.splitProviders[meta.chain ?? "10x"];
  const ladders = new Map();
  for (const [template, provider] of Object.entries(providersByStep(policy, meta))) {
    const step = rules.hostTemplates[template] ?? template;
    if (!ladders.has(provider)) ladders.set(provider, providerLadder(policy, provider));
    const problem = policyProblems({ ...policy, ladder: ladders.get(provider), steps: { [step]: policy.steps[step] } });
    if (problem) return `Step ${template} uses ${provider}. Supply contiguous provider tiers or adjust the assigned step bounds. ${problem}`;
  }
  return null;
}

// A pending dispatch created before capture modes used telemetry.
export function claudeCaptureMode(policy, replay) {
  return replay ? replay.claudeCaptureMode ?? "telemetry" : policy.claudeCapture.mode;
}

export function claudeDispatchBinding(mode, adapter) {
  return mode === "transcript" ? { sessionId: nativeClaudeSession(process.env) }
    : { checkpoint: adapter?.claudeCaptureCheckpoint() ?? null };
}

export function dispatchTarget(policy, tier, host) {
  const rung = policy.ladder[tier];
  const provider = providerOf(rung);
  return { provider, model: rung.model, effort: rung.effort,
    ...(host === "claude" && provider === "claude" ? { claudeCaptureMode: claudeCaptureMode(policy) } : {}),
    ...(provider === "openai" ? { profile: policy.codex?.profile ?? null } : {}),
    // Absent reads as null (legacy entries too); omitting the default keeps ordinary actions within their size budget.
    ...(provider === "openai" && policy.codex?.permissions != null ? { permissions: policy.codex.permissions } : {}) };
}

export function hostProblem(policy, host) {
  if (host !== "claude" && host !== "codex") return `Invalid host ${JSON.stringify(host)}. Use claude or codex. Nothing was written.`;
  if (host === "codex" && policy.ladder.some((rung) => providerOf(rung) !== "openai")) {
    return "A Codex host requires an OpenAI-only ladder. Configure the codex-policy.json overlay in context/foundation/agent-smith-policy.json. Nothing was written.";
  }
  return null;
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

// ---- co-author trailer --------------------------------------------------------

// The fault of policy.coAuthor, or null when it is null, missing or valid: { name, email }, each a non-blank string
// with no newline, "<" or ">". Never halts; each committing caller turns the message into its own stop.
// open-pr.mjs holds a copy of this rule (coAuthorLine), since it imports no router module; coauthor.test.mjs checks parity.
export function coAuthorProblem(policy) {
  const c = policy?.coAuthor;
  if (c === null || c === undefined) return null;
  if (!isObject(c)) return "policy.coAuthor must be null or an object { name, email }.";
  for (const key of ["name", "email"]) {
    const v = c[key];
    if (typeof v !== "string" || !v.trim() || /[\r\n<>]/.test(v)) {
      return `policy.coAuthor ${key} must be a non-blank string with no newline, "<" or ">".`;
    }
  }
  return null;
}

// The first fault in the keys that cap the spend of a run, as text that names the key and the override file, or null.
// Checked in a fixed order: blocks, limits, escalation, rigor.budgetDelta, ladder (model, effort in rigor.effortOrder), steps, claudeCapture. Never throws and never halts;
// main() halts for init, next and usage and status reports it. A baseTier outside [minTier, maxTier] is allowed (tierFor clamps it).
export function policyProblems(policy, checkBounds = true) {
  const bad = (key, rule, v) => `policy.${key} must be ${rule} (got ${v === undefined ? "undefined" : JSON.stringify(v)}). Fix it in context/foundation/agent-smith-policy.json. Nothing was written.`;
  const p = policy ?? {};
  if (Object.hasOwn(p.prompts ?? {}, "byFile") && typeof p.prompts.byFile !== "boolean") {
    return bad("prompts.byFile", "a boolean", p.prompts.byFile);
  }
  for (const key of ["limits", "escalation", "rigor", "steps"]) {
    if (!isObject(p[key])) return bad(key, "an object", p[key]);
  }
  if (!isObject(p.rigor.budgetDelta)) return bad("rigor.budgetDelta", "an object", p.rigor.budgetDelta);
  const int = (v, min) => Number.isSafeInteger(v) && v >= min;
  for (const [key, min] of [["maxTotalSteps", 1], ["maxPlanRevisions", 0], ["maxFixLoops", 0], ["maxNeutralRetries", 0]]) {
    if (!int(p.limits[key], min)) return bad(`limits.${key}`, min ? "a positive integer" : "a non-negative integer", p.limits[key]);
  }
  if (!int(p.escalation.maxAttemptsPerStep, 1)) return bad("escalation.maxAttemptsPerStep", "a positive integer", p.escalation.maxAttemptsPerStep);
  for (const [level, v] of Object.entries(p.rigor.budgetDelta)) {
    if (!Number.isSafeInteger(v)) return bad(`rigor.budgetDelta.${level}`, "an integer", v);
  }
  if (!Array.isArray(p.ladder) || p.ladder.length === 0) return bad("ladder", "a non-empty array", p.ladder);
  // An effort outside rigor.effortOrder would reach the Agent tool unranked; with no usable order the name is only non-empty.
  const efforts = Array.isArray(p.rigor.effortOrder) ? p.rigor.effortOrder.filter((e) => typeof e === "string" && e.trim()) : [];
  for (let i = 0; i < p.ladder.length; i++) {
    const rung = p.ladder[i];
    for (const field of ["model", "effort"]) {
      const v = isObject(rung) ? rung[field] : undefined;
      if (typeof v !== "string" || !v.trim()) return bad(`ladder[${i}].${field}`, "a non-empty string", v);
    }
    if (efforts.length && !efforts.includes(rung.effort)) return bad(`ladder[${i}].effort`, `one of ${efforts.join(", ")} (rigor.effortOrder)`, rung.effort);
    if (rung.provider !== undefined && rung.provider !== "claude" && rung.provider !== "openai") {
      return bad(`ladder[${i}].provider`, "claude or openai", rung.provider);
    }
  }
  if (p.codex !== undefined && !isObject(p.codex)) return bad("codex", "an object", p.codex);
  const profile = p.codex?.profile;
  if (profile !== undefined && profile !== null && (typeof profile !== "string" || !profile.trim() || /[\r\n\0]/.test(profile))) {
    return bad("codex.profile", "null or a non-blank profile name without control characters", profile);
  }
  const permissions = p.codex?.permissions;
  if (permissions !== undefined && permissions !== null && (typeof permissions !== "string" || !PERMISSIONS_NAME_RE.test(permissions))) {
    return bad("codex.permissions", "null or a custom permissions profile name of 1 to 128 letters, digits, - or _", permissions);
  }
  const top = p.ladder.length - 1;
  for (const [name, step] of Object.entries(p.steps)) {
    if (!isObject(step)) return bad(`steps.${name}`, "an object", step);
    for (const field of ["baseTier", "minTier", "maxTier"]) {
      if (!int(step[field], 0) || (checkBounds && step[field] > top)) return bad(`steps.${name}.${field}`, `an integer from 0 to ${top}`, step[field]);
    }
    if (step.minTier > step.maxTier) return bad(`steps.${name}.minTier`, `at most maxTier ${step.maxTier}`, step.minTier);
  }
  if (p.claudeCapture !== undefined) {
    if (!isObject(p.claudeCapture)) return bad("claudeCapture", "an object", p.claudeCapture);
    if (Object.hasOwn(p.claudeCapture, "mode") && !["transcript", "telemetry"].includes(p.claudeCapture.mode)) {
      return bad("claudeCapture.mode", "transcript or telemetry", p.claudeCapture.mode);
    }
    if (Object.hasOwn(p.claudeCapture, "require") && typeof p.claudeCapture.require !== "boolean") {
      return bad("claudeCapture.require", "a boolean", p.claudeCapture.require);
    }
  }
  return null;
}

// The trailer line of policy.coAuthor, or null when it is off. Call only after coAuthorProblem returned null.
export function coAuthorTrailer(policy) {
  const c = policy?.coAuthor;
  if (c === null || c === undefined) return null;
  return `Co-Authored-By: ${c.name.trim()} <${c.email.trim()}>`;
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
    const tokens = accountingFor(e).usage?.totalTokens;
    const has = Number.isSafeInteger(tokens) && tokens >= 0;
    const model = typeof e.model === "string" && e.model ? e.model : "unknown";
    const price = Object.hasOwn(prices, model) ? prices[model] : undefined;
    let usd = null;
    if (has) {
      res.withFigures++;
      if (price === undefined) unpriced.add(model);
      else {
        usd = (tokens * price) / 1e6;
        if (!Number.isFinite(usd)) usd = (tokens / 1e6) * price;
        if (!Number.isFinite(usd)) usd = null;
        res.usd = usd === null || res.usd === null || !Number.isFinite(res.usd + usd) ? null : res.usd + usd;
        res.priced++;
      }
    }
    if (e.n !== undefined) res.perEntry[e.n] = usd;
  }
  res.unpriced = [...unpriced].sort();
  return res;
}

// A USD figure rounded to `digits` decimals, as a number.
export const roundUsd = (usd, digits = 4) => Number.isFinite(usd) ? Number(usd.toFixed(digits)) : null;

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

// Per line, true when the line is a code-fence line or lies inside a fence. A fence opens on up to three spaces then
// three or more backticks or tildes (a backtick fence's info string holds no backtick) and closes on a line of the same
// character, at least as long, then blanks only. A trailing \r is ignored. An unclosed fence runs to the end of the text.
// shortcut: fences indented more than three spaces, inside block quotes or list items, and <pre> blocks are not tracked; upgrade to a Markdown parser if plans or reviews start using them.
function fencedLines(lines) {
  const out = [];
  let open = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (open) {
      const c = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (c && c[1][0] === open[0] && c[1].length >= open.length) open = null;
      out.push(true);
      continue;
    }
    const o = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (o && !(o[1][0] === "`" && o[2].includes("`"))) {
      open = o[1];
      out.push(true);
      continue;
    }
    out.push(false);
  }
  return out;
}

export function readPlan(file, { fingerprint = false } = {}) {
  const res = { exists: false, hasProgress: false, phases: 0, rows: 0, autoDone: 0, autoPending: 0, manualPending: [], phaseList: [], mtime: 0 };
  if (fingerprint) res.fingerprint = null;
  // A chain without a plan (OpenSpec: paths().plan is null) reads as a missing plan.
  if (typeof file !== "string" || !fs.existsSync(file)) return res;
  res.exists = true;
  res.mtime = mtime(file);
  const bytes = fs.readFileSync(file);
  if (fingerprint) res.fingerprint = hash("sha256", bytes);
  const lines = bytes.toString("utf8").split(/\r?\n/);
  const fenced = fencedLines(lines);
  const idx = lines.findIndex((line, i) => !fenced[i] && /^## Progress\s*$/.test(line));
  if (idx < 0) return res;
  res.hasProgress = true;
  let section = null;
  let cur = null;
  for (let i = idx; i < lines.length; i++) {
    if (fenced[i]) continue;
    const line = lines[i];
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
  const lines = text.split("\n");
  const fenced = fencedLines(lines);
  for (const [i, line] of lines.entries()) {
    if (!fenced[i] && /^#{2,3}\s/.test(line)) {
      flush();
      const h = line.match(/^###\s+(F\d+)\b/);
      if (h) cur = { id: h[1], lines: [] };
    } else if (cur) cur.lines.push(line);
  }
  flush();
  return findings;
}

const REVIEW_BODY = /^[ \t]*(?:(?:[-+*]|\d{1,9}[.)])[ \t]+)?(?:#{2,6}(?:[ \t]|$)|\x60{3,}|~{3,}|<(?:pre|code|script|style|textarea)(?=[\s/>]|$))/i;
const REVIEW_QUOTE = /^ {0,3}>[ \t]?/;
const REVIEW_TITLE = /^ {0,3}#(?:[ \t]|$)/;
const REVIEW_BULLET = /^ {0,3}[-+*][ \t]+\S/;

// Index inline delimiters within a paragraph so multiline spans need no repeated lookahead.
function reviewInlineSpans(lines) {
  const codeEnds = new Map();
  const inlineComments = new Set();
  const nextRun = new Map();
  let commentCloses = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim() || REVIEW_BODY.test(line) || REVIEW_QUOTE.test(line) || REVIEW_TITLE.test(line)) {
      nextRun.clear();
      commentCloses = false;
      continue;
    }
    for (const token of [...line.matchAll(/\x60+|<!--|-->/g)].reverse()) {
      const position = `${i}:${token.index}`;
      if (token[0] === "-->") commentCloses = true;
      else if (token[0] === "<!--") {
        if (commentCloses) inlineComments.add(position);
      } else {
        const size = token[0].length;
        const end = nextRun.get(size);
        if (end) codeEnds.set(position, end);
        nextRun.set(size, { line: i, column: token.index + size });
      }
    }
    // A nonempty bullet starts a new paragraph. Its continuation lines can still close spans it opens.
    if (REVIEW_BULLET.test(line)) {
      nextRun.clear();
      commentCloses = false;
    }
  }
  return { codeEnds, inlineComments };
}

function readReviewVerdict(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const { codeEnds, inlineComments } = reviewInlineSpans(lines);
  let header = null;
  let inComment = false;
  let quoted = false;
  let codeEnd = null;
  for (const [i, line] of lines.entries()) {
    if (!inComment && !(codeEnd?.line >= i)) {
      if (REVIEW_BODY.test(line)) break;
      const quote = REVIEW_QUOTE.exec(line);
      if (quote) {
        const content = line.slice(quote[0].length);
        quoted = Boolean(content.trim()) && !REVIEW_BODY.test(content) && !REVIEW_TITLE.test(content);
        continue;
      }
      if (REVIEW_TITLE.test(line)) {
        quoted = false;
        continue;
      }
      if (!line.trim() || /^ {0,3}[-+*][ \t]+/.test(line)) quoted = false;
      if (quoted) continue;
    }
    const blockComment = /^ {0,3}<!--/.test(line) ? line.indexOf("<") : -1;
    const skip = inComment || codeEnd?.line >= i || blockComment >= 0;
    for (const token of line.matchAll(/\\[\\<\x60]|\x60+|<!--|-->/g)) {
      if (codeEnd && (codeEnd.line > i || (codeEnd.line === i && token.index < codeEnd.column))) continue;
      if (inComment) inComment = token[0] !== "-->";
      else if (token[0] === "<!--") inComment = token.index === blockComment || inlineComments.has(`${i}:${token.index}`);
      else codeEnd = codeEnds.get(`${i}:${token.index}`);
    }
    if (skip) continue;
    // A hyphen underline turns the preceding paragraph into an H2, even if it looks like a verdict line.
    if (/^ {0,3}-+[ \t]*$/.test(lines[i + 1] ?? "") && /^ {0,3}\S/.test(line)
      && !/^ {0,3}(?:#{1,6}(?:[ \t]|$)|>|(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)|(?:[-*_][ \t]*){3,}$)/.test(line)) break;
    const label = /^ {0,3}(?:[-+*][ \t]+)?\*\*Verdict(?:\*\*:|:\*\*)(.*)$/.exec(line);
    if (!label) continue;
    if (header !== null) return null;
    header = label[1];
  }
  if (header === null) return null;
  let value = header.trim().replace(/^(?:(?:\p{RGI_Emoji}|\p{Extended_Pictographic})\s*)+/v, "");
  const annotation = /\s(?:-(?=\s+\S)|\()/.exec(value);
  if (annotation) {
    const tail = value.slice(annotation.index).trim().replace(/\.$/, "");
    if (tail.startsWith("-") || completeParenthetical(tail)) value = value.slice(0, annotation.index).trimEnd();
  }
  value = value.replace(/\.$/, "");
  if (/^\[[^[\]]+\]$/.test(value)) value = value.slice(1, -1).trim();
  return /\p{L}/u.test(value) ? value.toUpperCase() : null;
}

function completeParenthetical(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")" && --depth === 0) return i === text.length - 1;
  }
  return false;
}

export function readReview(file) {
  const res = { exists: false, verdict: null, critical: 0, warnings: 0, findings: [], mtime: 0 };
  let text;
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) return res;
    res.exists = true;
    res.mtime = stat.mtimeMs;
    if (!stat.isFile()) return { ...res, error: "expected a regular file" };
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { ...res, exists: false, mtime: 0 };
    return { ...res, exists: true, error: error.code ?? error.message };
  }
  res.verdict = readReviewVerdict(text);
  const f = text.match(/\*\*Findings(?:\*\*:|:\*\*)[^\n]*/);
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
  const dir = liveRunDirectory(ROOT, id, chain);
  const change = path.dirname(dir);
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
  const dir = liveRunDirectory(ROOT, id, "openspec");
  const change = path.dirname(dir);
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

export function readLog(file, { tolerant = false } = {}) {
  const entries = [];
  const logProblems = [];
  const absolute = path.resolve(file);
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") {
      logProblems.push({ file: absolute, line: null, reason: `Cannot read log (${error.code ?? "filesystem error"})` });
    }
  }
  for (const [index, line] of (text ?? "").split(/\r?\n/).entries()) {
    if (line === "") continue;
    let value;
    try { value = JSON.parse(line); } catch {
      logProblems.push({ file: absolute, line: index + 1, reason: "Invalid JSON" });
      continue;
    }
    if (isObject(value)) entries.push(value);
    else logProblems.push({ file: absolute, line: index + 1, reason: "Expected a JSON object" });
  }
  if (!tolerant && logProblems.length) {
    const first = logProblems[0];
    const location = first.line === null ? first.file : `${first.file} line ${first.line}`;
    const rel = path.relative(ROOT, absolute).split(path.sep).join("/");
    throw new Error(`${location}: ${first.reason}. Preserve the damaged copy and inspect the last usable step commit on the run branch ` +
      `with git show <sha>:./${rel} before restoring the affected content, then retry. Nothing was written.`);
  }
  return { entries, logProblems };
}

// A skip entry records a step the router decided not to run. It has no n, template, ok or result.
// Every count, streak and freshness check reads the executed entries only.
export function executed(log) {
  return log.filter((e) => !e.skipped);
}

function damagedMetadata(file, reason) {
  const absolute = path.resolve(file);
  const rel = path.relative(ROOT, absolute);
  const inside = rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
  const hint = inside ? ` with git show <sha>:./${rel.split(path.sep).join("/")}` : "";
  return {
    meta: null,
    problem: `${absolute}: ${reason}. Preserve the damaged copy and inspect a verified copy from the same run${hint} `
      + "before restoring it, then retry. Nothing was written.",
  };
}

// Only diagnostic commands opt in to inspecting metadata without throwing on damage.
export function inspectMeta(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (error) {
    if (error.code === "ENOENT") return { meta: null, problem: null };
    return damagedMetadata(file, `Cannot read metadata (${error.code ?? "filesystem error"})`);
  }
  let meta;
  try { meta = JSON.parse(text); } catch {
    return damagedMetadata(file, "Invalid JSON");
  }
  if (!isObject(meta)) return damagedMetadata(file, "Expected a JSON object");
  return { meta, problem: null };
}

export function readMeta(file, fallback) {
  const { meta, problem } = inspectMeta(file);
  if (problem) throw new Error(problem);
  return meta ?? fallback;
}

// The --pr-comment request of init, as the end-of-run outputs and status carry it: present only as true.
export function prCommentField(meta) {
  return meta?.prComment === true ? { prComment: true } : {};
}

const STATE_BASENAMES = ["run.jsonl", "meta.json", "report.md", "prompt.md"];
const STATE_TEMP_RE = new RegExp(`^(?:${STATE_BASENAMES.map((name) => name.replaceAll(".", "\\.")).join("|")})\\.[1-9][0-9]*\\.tmp$`);
const stateTempPath = (file) => `${file}.${process.pid}.tmp`;

// Call under the run lock. Inspection is separate so refusal paths can keep every byte.
export function stateTempFiles(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (names.some((name) => /^prompt\.md\.[1-9][0-9]*\.tmp$/.test(name))
    && fs.realpathSync(dir) !== path.join(fs.realpathSync(ROOT), path.relative(ROOT, dir))) {
    throw new Error("Prompt temporary directory must not use symlink redirects");
  }
  return names.filter((name) => STATE_TEMP_RE.test(name))
    .map((name) => path.join(dir, name)).filter((file) => fs.lstatSync(file).isFile());
}

export function cleanupStateTemps(dir) {
  for (const file of stateTempFiles(dir)) fs.unlinkSync(file);
}

// The rename publishes one complete file. Exclusive creation gives this call ownership of its temp.
export function writeFileAtomic(file, data) {
  const temp = stateTempPath(file);
  let fd;
  let created = false;
  try {
    let target;
    try { target = fs.lstatSync(file); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    fd = fs.openSync(temp, "wx");
    created = true;
    if (target?.isFile()) fs.fchmodSync(fd, target.mode & 0o7777);
    fs.writeFileSync(fd, data);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
  } catch (error) {
    const failures = [error];
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (closeError) { failures.push(closeError); }
    }
    if (created) {
      try { fs.unlinkSync(temp); } catch (cleanupError) { failures.push(cleanupError); }
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, `${error.message}; atomic-write cleanup of ${temp} failed: ${failures.slice(1).map((e) => e.message).join("; ")}`, { cause: error });
    }
    throw error;
  }
}

export function writeLog(file, entries) {
  writeFileAtomic(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
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

// True only when level and minRigor are both known levels and level >= minRigor; anything else is closed.
export function atOrAbove(policy, level, minRigor) {
  const levels = rigorLevels(policy);
  return levels.indexOf(level) >= 0 && levels.indexOf(minRigor) >= 0 && levels.indexOf(level) >= levels.indexOf(minRigor);
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
      cwd: ROOT, encoding: opts.encoding ?? "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024,
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

// The churn exclude globs as regexes: the override's list, else the shipped one, else none. Independent of the other churn keys.
export function churnExcludes(policy) {
  let exclude = policy.risk?.churn?.exclude;
  if (!Array.isArray(exclude)) exclude = readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude;
  if (!Array.isArray(exclude)) exclude = [];
  return exclude.filter((g) => typeof g === "string").map(globToRegex);
}

// Validated churn settings, or null when the block is unusable. A bad exclude falls back to the shipped list.
export function churnConfig(policy) {
  const c = policy.risk?.churn;
  if (!isObject(c)) return null;
  const posInt = (v) => Number.isInteger(v) && v > 0;
  if (typeof c.since !== "string" || !SINCE_RE.test(c.since)) return null;
  if (!posInt(c.maxCommits) || !posInt(c.minCommitsInWindow) || !posInt(c.hotMinCommits)) return null;
  if (!Number.isFinite(c.hotPercentile) || c.hotPercentile <= 0 || c.hotPercentile > 100) return null;
  return { ...c, exclude: churnExcludes(policy) };
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

// The normalized path tokens of one **File**: / **Files**: plan line (backtick tokens, else comma-split text),
// or null when the line is no such line.
export function planFileTokens(line) {
  const m = line.match(/^\*\*Files?\*\*:(.*)\r?$/);
  if (!m) return null;
  const quoted = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  return (quoted.length ? quoted : m[1].split(",")).map(normalizePlanPath).filter(Boolean);
}

// Paths named on the **File**: and **Files**: lines of the plan.
function planPaths(file) {
  if (typeof file !== "string" || !fs.existsSync(file)) return [];
  const found = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    for (const token of planFileTokens(line) ?? []) found.add(token);
  }
  return [...found].sort();
}

// lstat of a regular file of at most `max` bytes whose real path lies inside the real path of `dir`, else null.
// A symlinked file, a symlinked parent folder and an oversized file are refused. Never throws.
export function guardedStat(file, dir, max = Infinity) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > max) return null;
    return fs.realpathSync(file).startsWith(fs.realpathSync(dir) + path.sep) ? st : null;
  } catch { return null; }
}

// The UTF-8 text of a file that passes guardedStat, else null.
export function readGuarded(file, dir, max) {
  try { return guardedStat(file, dir, max) ? fs.readFileSync(file, "utf8") : null; } catch { return null; }
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

// Router callers halt on contention. External runners supply their own envelope failure callback.
export function acquireRunLock(id, chain, onBusy = halt) {
  return lockRunDirectory(ROOT, id, chain, onBusy);
}
