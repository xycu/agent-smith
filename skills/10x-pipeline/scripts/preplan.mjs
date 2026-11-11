import fs from "node:fs";
import path from "node:path";
import { ROOT, frontmatterField, executed, isObject, atOrAbove, ARTIFACT_NAME, scoreConfig, guardedStat } from "./state.mjs";

// ---- pre-plan steps ---------------------------------------------------------

export function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

// A file name of preplan.artifacts in the change folder, or null when the name is missing or unsafe.
export function artifactFile(p, policy, key) {
  const name = policy.preplan?.artifacts?.[key];
  return typeof name === "string" && ARTIFACT_NAME.test(name) ? path.join(p.change, name) : null;
}

// The artifact a pre-plan log entry must have written: the file of its template, else of its step.
export function preplanFile(p, policy, entry) {
  return artifactFile(p, policy, entry.template ?? entry.step);
}

// The first configured phrase that starts at a word start of the goal (index 0, or after a non-letter, non-digit).
// Phrases may contain spaces. Lowercase compare. Returns the phrase or null.
export function goalPhrase(goal, phrases) {
  const text = typeof goal === "string" ? goal.toLowerCase() : "";
  for (const raw of Array.isArray(phrases) ? phrases : []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const phrase = raw.toLowerCase();
    for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1)) {
      if (i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1])) return raw;
    }
  }
  return null;
}

const letterWords = (text) => String(text ?? "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

// Cells of one pipe-table line, trimmed, without the outer pipes.
function tableCells(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

const isSeparatorRow = (cells) => cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));

// The invariant and policy rows of a distillation report that share a word with the goal. Format: see the
// reference template of /10x-domain-distillation. The section runs from "## Invariants and policies" to the next
// "## " line. A table counts when a header cell starts with "invariant" or "policy" and another cell is "status".
// The status is the first alphabetic word of the status cell without * _ and backticks. A "###" heading is not a
// word source. Words are whole lowercase letter tokens of the candidate column (if any), the invariant or policy
// cell and the gap cell. Returns { hit, why }; no file, no section or no matching row is no hit.
function aggregateGap(cfg, goal) {
  const none = (why) => ({ hit: false, why });
  if (!isObject(cfg)) return none("aggregateGap is not configured");
  const files = Array.isArray(cfg.files) ? cfg.files.filter((f) => typeof f === "string" && f) : [];
  const file = files.find((f) => fs.existsSync(path.resolve(ROOT, f)));
  if (file === undefined) return none("no distillation file");
  const lines = readText(path.resolve(ROOT, file)).split(/\r?\n/);
  const start = lines.findIndex((l) => /^## Invariants and policies\s*$/.test(l));
  if (start < 0) return none(`${file} has no "## Invariants and policies" section`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  const statuses = new Set((Array.isArray(cfg.statuses) ? cfg.statuses : []).filter((s) => typeof s === "string").map((s) => s.toLowerCase()));
  const stop = new Set((Array.isArray(cfg.stopwords) ? cfg.stopwords : []).filter((s) => typeof s === "string").map((s) => s.toLowerCase()));
  const minLen = Number.isFinite(cfg.minWordLength) ? cfg.minWordLength : 4;
  const goalWords = new Set(letterWords(goal));

  const section = lines.slice(start + 1, end);
  for (let i = 0; i < section.length; i++) {
    if (!section[i].trim().startsWith("|")) continue;
    const block = [];
    for (; i < section.length && section[i].trim().startsWith("|"); i++) block.push(section[i]);
    const header = tableCells(block[0]).map((cell) => cell.toLowerCase());
    if (block.length < 3 || !isSeparatorRow(tableCells(block[1]))) continue;
    const statusAt = header.indexOf("status");
    const textAt = header.findIndex((cell) => cell.startsWith("invariant") || cell.startsWith("policy"));
    if (statusAt < 0 || textAt < 0) continue;
    const wordAt = [header.findIndex((cell) => cell.startsWith("candidate")), textAt, header.indexOf("gap")].filter((at) => at >= 0);
    for (const line of block.slice(2)) {
      const cells = tableCells(line);
      const status = (String(cells[statusAt] ?? "").replace(/[*_`]/g, "").match(/[A-Za-z]+/) ?? [""])[0].toLowerCase();
      if (!statuses.has(status)) continue;
      for (const at of wordAt) {
        const word = letterWords(cells[at]).find((w) => w.length >= minLen && !stop.has(w) && goalWords.has(w));
        if (word !== undefined) return { hit: true, why: `${file}: ${cells[0] || "row"} (${status}) shares "${word}" with the goal` };
      }
    }
  }
  return none(`${file} has no declared row that shares a word with the goal`);
}

// Pure, read-only. Each takes { p, policy, meta, ran } and returns { hit, why }. An unknown name is no hit.
const PREDICATES = {
  researchExists: ({ p, policy }) => existsPredicate(artifactFile(p, policy, "research")),
  frameExists: ({ p, policy }) => existsPredicate(artifactFile(p, policy, "frame")),
  briefExists: ({ p, policy }) => {
    // The brief files are those of the templates of the domain-brief gate (default and variants), read from the policy.
    const gate = policy.preplan?.gates?.["domain-brief"];
    const templates = [gate?.template, ...(Array.isArray(gate?.variants) ? gate.variants.map((v) => v?.template) : [])].filter((t) => typeof t === "string");
    const hit = [...new Set(templates)].map((key) => artifactFile(p, policy, key)).find((file) => file !== null && fs.existsSync(file));
    return hit === undefined ? { hit: false, why: "no brief file" } : existsPredicate(hit);
  },
  repoMapExists: ({ policy }) => {
    const cfg = policy.preplan?.predicates?.repoMapExists;
    if (!isObject(cfg) || typeof cfg.file !== "string" || !cfg.file) return { hit: false, why: "repoMapExists is not configured" };
    const file = path.resolve(ROOT, cfg.file);
    if (!fs.existsSync(file)) return { hit: false, why: `${cfg.file} is missing` };
    for (const [key, want] of Object.entries(isObject(cfg.frontmatter) ? cfg.frontmatter : {})) {
      if (frontmatterField(file, key) !== String(want)) return { hit: false, why: `${cfg.file} has no ${key}: ${want}` };
    }
    return { hit: true, why: `${cfg.file} exists` };
  },
  framingDoubt: ({ policy, meta, ran }) => {
    const phrase = goalPhrase(meta.goal, policy.preplan?.predicates?.framingDoubt?.goalWords);
    if (phrase !== null) return { hit: true, why: `goal phrase "${phrase}"` };
    const early = ran.find((e) => (e.step === "research" || e.step === "domain-brief") && isObject(e.signals) && typeof e.signals.rigor === "string");
    if (early) return { hit: true, why: `signals.rigor of step ${early.n} (${early.step})` };
    return { hit: false, why: "no cause-shaped or design-shaped goal phrase, no signals.rigor of an earlier step" };
  },
  dependencyLeak: ({ policy, meta }) => {
    const phrase = goalPhrase(meta.goal, policy.preplan?.predicates?.dependencyLeak?.goalWords);
    return phrase !== null ? { hit: true, why: `goal phrase "${phrase}"` } : { hit: false, why: "no dependency phrase in the goal" };
  },
  aggregateGap: ({ policy, meta }) => aggregateGap(policy.preplan?.predicates?.aggregateGap, meta.goal),
  e2eSetup: ({ policy }) => e2eSetup(policy.executors?.e2e?.setup),
};

function existsPredicate(file) {
  if (file === null) return { hit: false, why: "artifact is not configured" };
  return fs.existsSync(file) ? { hit: true, why: `${path.basename(file)} exists` } : { hit: false, why: `${path.basename(file)} is missing` };
}

export function predicate(name, env) {
  const fn = typeof name === "string" && Object.hasOwn(PREDICATES, name) ? PREDICATES[name] : null;
  if (!fn) return { hit: false, why: "unknown predicate" };
  try { return fn(env); } catch { return { hit: false, why: "predicate failed" }; }
}

// The pre-plan branch of the "no plan yet" case. Returns null (go on to plan), { skip: { step, reason } } or
// { step, template, bump, reason }. Nothing runs once a plan attempt exists. A gate closed by rigor is silent;
// an open gate that does not run logs a skip with its reason. Malformed config is ignored, never thrown.
export function preplanNext(p, fullLog, policy, meta, ctx) {
  const cfg = policy.preplan;
  if (!isObject(cfg) || !Array.isArray(cfg.order) || !isObject(cfg.gates)) return null;
  const ran = executed(fullLog);
  if (ran.some((e) => e.step === "plan")) return null;
  const env = { p, policy, meta, ran };
  const names = (list) => (Array.isArray(list) ? list : []);
  for (const step of cfg.order) {
    const gate = typeof step === "string" ? cfg.gates[step] : null;
    if (!isObject(gate) || !isObject(policy.steps?.[step])) continue;
    const variants = names(gate.variants).filter((v) => isObject(v) && typeof v.template === "string");
    const templates = new Set([...(typeof gate.template === "string" ? [gate.template] : []), ...variants.map((v) => v.template)]);
    const mine = ran.filter((e) => e.step === step && templates.has(e.template ?? e.step));
    if (mine.some((e) => e.ok)) continue;
    if (mine.length) {
      const last = mine[mine.length - 1];
      return { step, template: last.template ?? step, bump: 0, reason: `retry ${step} (${last.template ?? step}): attempt ${mine.length} did not pass` };
    }
    if (fullLog.some((e) => e.skipped && e.step === step)) continue;
    const open = atOrAbove(policy, ctx.level, gate.minRigor);
    if (!open) continue;
    const lead = `rigor ${ctx.level}: ${step}`;
    for (const name of names(gate.skipIf)) {
      const res = predicate(name, env);
      if (res.hit) return { skip: { step, reason: `${lead} skipped (${name}: ${res.why})` } };
    }
    const when = names(gate.when);
    const hits = [];
    if (when.length) {
      const misses = [];
      for (const name of when) {
        const res = predicate(name, env);
        if (res.hit) hits.push(`${name}: ${res.why}`);
        else misses.push(`${name}: ${res.why}`);
      }
      if (!hits.length) return { skip: { step, reason: `${lead} skipped (no signal; ${misses.join("; ")})` } };
    }
    let template = null;
    for (const v of variants) {
      const res = typeof v.when === "string" ? predicate(v.when, env) : { hit: false };
      if (res.hit) { template = v.template; hits.push(`${v.when}: ${res.why}`); break; }
    }
    if (template === null && typeof gate.template === "string") template = gate.template;
    if (template === null) return { skip: { step, reason: `${lead} skipped (no template matched)` } };
    return { step, template, bump: 0, reason: `${lead} runs (${hits.length ? hits.join("; ") : `gate open, template ${template}`})` };
  }
  return null;
}

// ---- complexity score (ADR-007) -------------------------------------------------

// Reads and validates the score file of the change folder. Checks the shape only and never judges the evidence.
// Returns { ok: true, data } with the log summary (factor scores, the two sums, confidence, unknowns count; no
// evidence text), or { ok: false, error, exists }. Extra keys are ignored.
export function readComplexity(p, policy) {
  const cfg = scoreConfig(policy);
  if (!cfg) return { ok: false, error: "score policy is malformed", exists: false };
  const file = path.join(p.change, cfg.file);
  const bad = (error) => ({ ok: false, error, exists: true });
  // guardedStat alone decides whether the file is read; the second lstat only words the refusal.
  if (!guardedStat(file, p.change, cfg.maxBytes)) {
    let st;
    try { st = fs.lstatSync(file); } catch { return { ok: false, error: `no ${cfg.file}`, exists: false }; }
    if (st.isSymbolicLink()) return bad("a symlink, not a regular file");
    if (!st.isFile()) return bad("not a regular file");
    return bad(st.size > cfg.maxBytes ? `larger than ${cfg.maxBytes} bytes` : "outside the change folder");
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return bad("not valid JSON"); }
  if (!isObject(doc)) return bad("not a JSON object");
  if (doc.schemaVersion !== cfg.schemaVersion) return bad(`schemaVersion is not ${cfg.schemaVersion}`);
  if (!isObject(doc.factors)) return bad("factors is not an object");
  const factors = {};
  for (const name of [...cfg.factors.cognitive, ...cfg.factors.execution]) {
    const f = doc.factors[name];
    if (!isObject(f)) return bad(`factor ${name} is missing`);
    if (!Number.isInteger(f.score) || f.score < cfg.scale.min || f.score > cfg.scale.max) {
      return bad(`factor ${name} score is not an integer from ${cfg.scale.min} to ${cfg.scale.max}`);
    }
    if (typeof f.evidence !== "string" || !f.evidence.trim()) return bad(`factor ${name} has no evidence`);
    factors[name] = f.score;
  }
  if (!Array.isArray(doc.unknowns)) return bad("unknowns is not an array");
  if (!cfg.confidences.includes(doc.confidence)) return bad(`confidence is not one of ${cfg.confidences.join(", ")}`);
  const sum = (group) => cfg.factors[group].reduce((total, name) => total + factors[name], 0);
  return {
    ok: true,
    data: {
      schemaVersion: doc.schemaVersion,
      factors,
      cognitive: sum("cognitive"),
      execution: sum("execution"),
      confidence: doc.confidence,
      unknowns: doc.unknowns.length,
    },
  };
}

// The score branch of the "no plan yet" case, asked after the pre-plan steps. Same shape as preplanNext: null,
// { skip: { step, reason, score? } } or a step. Closed (silent) below score.minRigor, with a malformed block and once
// any plan attempt is logged. A valid file that is there before the first attempt is trusted as-is and skips the
// step. Failed attempts retry up to the attempt cap or the invalid-file cap, then the step skips: it never halts.
export function scoreNext(p, fullLog, policy, meta, ctx) {
  const cfg = scoreConfig(policy);
  if (!cfg) return null;
  if (!atOrAbove(policy, ctx.level, cfg.minRigor)) return null;
  const ran = executed(fullLog);
  if (ran.some((e) => e.step === "plan")) return null;
  const mine = ran.filter((e) => e.step === "score");
  if (mine.some((e) => e.ok)) return null;
  if (fullLog.some((e) => e.skipped && e.step === "score")) return null;
  const lead = `rigor ${ctx.level}: score`;
  if (!mine.length) {
    const read = readComplexity(p, policy);
    if (read.ok) return { skip: { step: "score", reason: `${lead} skipped (${cfg.file} exists and is valid; trusted as-is)`, score: read.data } };
    return { step: "score", template: "score", bump: 0, reason: `${lead} runs` };
  }
  const cap = Math.min(cfg.maxAttempts, policy.escalation.maxAttemptsPerStep);
  const invalid = mine.filter((e) => e.invalid).length;
  const last = mine[mine.length - 1];
  if (mine.length >= cap || invalid >= cfg.maxInvalid) {
    const why = invalid >= cfg.maxInvalid ? `${invalid} invalid ${cfg.file}` : `${mine.length} failed attempts`;
    const note = last.invalid ?? last.result?.note ?? "none";
    return { skip: { step: "score", reason: `${lead} skipped after ${why} (last: ${note}); going on with deterministic signals` } };
  }
  return { step: "score", template: "score", bump: 0, reason: `retry score: attempt ${mine.length} did not pass` };
}

// The score summary the router copied into the log: from the last ok score run entry, else from the score skip entry
// (a valid file that was already there), else null. The file itself is never read again, so a later edit, deletion
// or corruption of it changes neither a tier nor the report.
export function scoreSummary(fullLog) {
  const ran = executed(fullLog).filter((e) => e.step === "score" && e.ok && isObject(e.score));
  if (ran.length) return ran[ran.length - 1].score;
  const skip = fullLog.filter((e) => e.skipped && e.step === "score" && isObject(e.score));
  return skip.length ? skip[skip.length - 1].score : null;
}

// The tier shift of one step from the logged score. Returns { applies, sum, value, shift, why }: `applies` when a
// summary exists and the step's template is listed under score.shift.<step>.templates; `shift` +1 at or above `up`,
// -1 at or below `down` when every down guard holds, else 0. A threshold that is not a number turns that direction
// off. Up shifts have no guards. Down guards: enough confidence, few unknowns, churn risk measured with no hot path,
// no failed step, no simple-change discount and no phase-count bump on this step (ADR-007: the shift never overrides
// the churn risk axis and sits next to the deterministic signals). The rigor level is never touched.
export function scoreShift(d, policy, summary, guards) {
  const none = { applies: false, shift: 0 };
  const cfg = scoreConfig(policy);
  const S = cfg?.shift;
  if (!isObject(summary) || !isObject(S)) return none;
  const template = d.template ?? d.step;
  const rule = S[d.step];
  if (!["plan", "implement"].includes(d.step) || !isObject(rule) || !Array.isArray(rule.templates) || !rule.templates.includes(template)) return none;
  const group = cfg.factors[rule.sum];
  const value = summary[rule.sum];
  if (!Array.isArray(group) || !Number.isFinite(value)) return none;
  const why = `${rule.sum} ${value}/${cfg.scale.max * group.length}, confidence ${summary.confidence}`;
  const res = { applies: true, sum: rule.sum, value, shift: 0, why };
  if (Number.isFinite(rule.up) && value >= rule.up) return { ...res, shift: 1 };
  if (!Number.isFinite(rule.down) || value > rule.down) return res;
  const confidence = cfg.confidences.indexOf(summary.confidence);
  const minConfidence = cfg.confidences.indexOf(S.downMinConfidence);
  const held = minConfidence >= 0 && confidence >= minConfidence &&
    Number.isFinite(S.downMaxUnknowns) && Number.isInteger(summary.unknowns) && summary.unknowns <= S.downMaxUnknowns &&
    guards.riskClear === true && !guards.failed && !guards.discount && !guards.phaseBump;
  return held ? { ...res, shift: -1 } : res;
}

// The re-plan branch of decide(): plan review said RETHINK, or REVISE with findings to fix, and no code ran yet.
// `log` holds executed entries. Below preplan.loops.minRigor (or with a malformed level) the loops are closed and
// only the last branch applies, which is the behaviour from before the loops existed. Non-integer loop values
// disable that loop. Revisions count every plan-revise entry, failed ones included: a failed re-plan leaves the
// review fresh and spends one revision.
export function replanNext(log, pr, policy, level, oc = null) {
  const E = policy.escalation;
  const L = policy.limits;
  const loops = isObject(policy.preplan?.loops) ? policy.preplan.loops : {};
  const open = atOrAbove(policy, level, loops.minRigor);
  const posInt = (v) => Number.isInteger(v) && v > 0;
  const okFrames = log.filter((e) => e.template === "frame-rethink" && e.ok);
  const revisions = log.filter((e) => e.template === "plan-revise").length;
  // The open counts of an aware REVISE (onOpen "retry"), as a suffix inside the parentheses of both REVISE reasons.
  const openNote = oc ? `; open ${oc.openCritical} critical, ${oc.openWarnings} warnings` : "";

  // (a) A second RETHINK after the frame round and a good re-plan needs a human.
  if (open && pr.verdict === "RETHINK" && posInt(loops.rethinkToFrame) && okFrames.length >= loops.rethinkToFrame) {
    const lastFrame = log.lastIndexOf(okFrames[okFrames.length - 1]);
    if (log.some((e, i) => i > lastFrame && e.template === "plan-revise" && e.ok)) {
      return { halt: "Plan review said RETHINK again after frame and re-plan. Needs a human." };
    }
  }
  // (b) The revision cap, as before.
  if (revisions >= L.maxPlanRevisions) return { halt: `Plan still ${pr.verdict} after ${revisions} revisions. Needs a human.` };
  // (c) RETHINK: one frame round before the re-plan. A failed frame-rethink has no ok, so it is retried here.
  if (open && pr.verdict === "RETHINK" && posInt(loops.rethinkToFrame) && okFrames.length < loops.rethinkToFrame) {
    return {
      step: "frame",
      template: "frame-rethink",
      verdict: pr.verdict,
      bump: 0,
      reason: `plan review ${pr.verdict} (${pr.critical} critical, ${pr.warnings} warnings): frame round before the re-plan`,
    };
  }
  // (d) A REVISE that needs a re-plan after earlier REVISE re-plans: one research round first.
  if (open && pr.verdict === "REVISE" && posInt(loops.reviseResearchAfter) && posInt(loops.reviseResearchMax)) {
    const revised = log.filter((e) => e.template === "plan-revise" && e.ok && e.verdict === "REVISE").length;
    const researched = log.filter((e) => e.template === "research-revise" && e.ok).length;
    if (revised >= loops.reviseResearchAfter && researched < loops.reviseResearchMax) {
      return {
        step: "research",
        template: "research-revise",
        verdict: pr.verdict,
        bump: 0,
        reason: `plan review ${pr.verdict} (${pr.critical} critical, ${pr.warnings} warnings${openNote}) after ${revised} REVISE re-plan(s): research round before the re-plan`,
      };
    }
  }
  // (e) Otherwise the re-plan, as before.
  return {
    step: "plan",
    template: "plan-revise",
    verdict: pr.verdict,
    bump: pr.verdict === "RETHINK" ? E.rethinkBump : E.reviseBump,
    reason: `plan review ${pr.verdict} (${pr.critical} critical, ${pr.warnings} warnings${openNote})`,
  };
}

// The /10x-e2e-setup record: the lines `- <field>: <path>` of the configured section of the configured file. Every
// listed field needs a path that is relative, has no `..` segment, resolves under ROOT (symlinks included) and exists.
// Anything else, or a missing file, section or field, is no hit.
function e2eSetup(cfg) {
  const none = (why) => ({ hit: false, why });
  if (!isObject(cfg) || typeof cfg.file !== "string" || !cfg.file || typeof cfg.section !== "string" || !cfg.section) return none("e2e setup is not configured");
  const fields = (Array.isArray(cfg.fields) ? cfg.fields : []).filter((f) => typeof f === "string" && f);
  if (!fields.length) return none("e2e setup has no fields");
  const lines = readText(path.resolve(ROOT, cfg.file)).split(/\r?\n/);
  const start = lines.findIndex((l) => l.trimEnd() === cfg.section);
  if (start < 0) return none(`${cfg.file} has no "${cfg.section}" section`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  let root;
  try { root = fs.realpathSync(ROOT); } catch { return none("project root is unreadable"); }
  for (const field of fields) {
    const row = lines.slice(start + 1, end).map((l) => l.match(/^\s*[-*]\s+([^:]+?)\s*:\s*(.*)$/)).find((m) => m && m[1].toLowerCase() === field.toLowerCase());
    const value = row ? row[2].split(" — ")[0].replace(/`/g, "").trim() : "";
    if (!value) return none(`${cfg.file} has no ${field} path`);
    if (path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) return none(`${field} path ${value} is absolute or leaves the project`);
    const abs = path.resolve(ROOT, value);
    if (!abs.startsWith(ROOT + path.sep)) return none(`${field} path ${value} is outside the project`);
    let real;
    try { real = fs.realpathSync(abs); } catch { return none(`${field} path ${value} does not exist`); }
    if (!real.startsWith(root + path.sep)) return none(`${field} path ${value} resolves outside the project`);
  }
  return { hit: true, why: `${cfg.file} names ${fields.join(" and ")}` };
}
