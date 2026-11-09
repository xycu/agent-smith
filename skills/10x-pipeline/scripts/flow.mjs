import fs from "node:fs";
import path from "node:path";
import {
  SKILL_DIR, ROOT, out, readJson, mtime, readPlan, readReview, openFindingsConfig, openCounts, frontmatterField,
  executed, writeLog, lastIdx, trailingFailures, goalClass, isObject, rigorLevels, riskMeasured, loadPrices, estimateCost,
  halt,
} from "./state.mjs";
import { readText, preplanFile, preplanNext, readComplexity, scoreNext, scoreSummary, replanNext } from "./preplan.mjs";
import {
  verifyImplement, executorNext, retryRows, unprovenTicks, retryNext, reviewWarning, doneNotes, withoutEvidence,
  manualUnprovenIds, manualVerifyNext, mergedReasons, manualNotProvedRows, verifyManual, CODE_REPLANS, codeReplanNext,
  verifyCodeReplan,
} from "./steps.mjs";
import { verifyOpenspecStep } from "./openspec.mjs";

// ---- report ---------------------------------------------------------------

// The archive lines of the report. The archive step itself leaves no log entry, so this is where a reader of the moved copy learns about it.
function archiveLines(id, meta, oneLine) {
  if (meta.archive !== true) return [];
  const o = meta.outcome;
  if (!o) return ["Archive: not run (run not ended)"];
  if (o.action !== "done") return ["Archive: not run (run halted)"];
  const pending = Array.isArray(o.manualPending) ? o.manualPending : [];
  const notes = doneNotes(o);
  const unproven = notes.uncommittedTicks ?? [];
  const manualUnproven = notes.manualUnproven ?? [];
  const notProved = notes.manualNotProved ?? [];
  // An OpenSpec run is archived by the OpenSpec CLI (ADR-013 D5), not by /10x-archive.
  const requested = meta.chain === "openspec"
    ? `Archive: requested - \`openspec archive ${id} --yes --json\` runs after this report was written; see the commit "chore(archive): close ${id}"`
    : `Archive: requested - runs after this report was written; see the commit "chore(archive): close ${id}"`;
  return [
    requested,
    ...(pending.length ? [`Manual checks pending: ${pending.length}`, ...pending.map((row) => `- ${oneLine(row)}`)] : []),
    ...(manualUnproven.length ? [`Manual checks unproven: ${manualUnproven.length}`, ...manualUnproven.map((row) => `- ${oneLine(row)}`)] : []),
    ...(notProved.length ? [`Manual checks not proved: ${notProved.length}`, ...notProved.map((row) => `- ${oneLine(row)}`)] : []),
    ...(unproven.length ? [`Ticked without a commit: ${unproven.length}`, ...unproven.map((row) => `- ${oneLine(row)}`)] : []),
  ];
}

// The "Lesson candidates" section: the cleaned candidates of every approved impl-review entry, in log order, repeats dropped.
// Nothing here runs /10x-lesson; the human pastes a command. No candidates, no lines.
function lessonLines(log, oneLine) {
  const seen = new Set();
  const bullets = [];
  for (const e of log) {
    if (e.step !== "impl-review" || e.ok !== true) continue;
    const list = e.signals?.lessonCandidates;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== "string") continue;
      const seed = oneLine(item);
      const key = seed.toLowerCase();
      if (!seed || seen.has(key)) continue;
      seen.add(key);
      bullets.push(`- \`/10x-lesson ${seed}\` (step ${e.n})`);
    }
  }
  if (!bullets.length) return [];
  return [
    "## Lesson candidates",
    "",
    "Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.",
    "",
    ...bullets,
    "",
  ];
}

// The complexity score section, from log entries only: the summary of the ok score entry or the skip entry, then one
// line per entry whose tier the score moved. No summary, no section.
function complexityLines(fullLog) {
  const summary = scoreSummary(fullLog);
  if (!summary) return [];
  const source = executed(fullLog).find((e) => e.step === "score" && e.ok && e.score === summary);
  const factors = isObject(summary.factors) ? Object.entries(summary.factors).map(([name, value]) => `${name} ${value}`).join(", ") : "-";
  const shifts = executed(fullLog).filter((e) => isObject(e.scoreShift)).map((e) => {
    const s = e.scoreShift;
    return `- ${e.step} ${s.shift > 0 ? "+" : ""}${s.shift}${s.effective ? "" : " not applied (clamp or floor)"} (step ${e.n})`;
  });
  return [
    "## Complexity score",
    "",
    `Scores: cognitive ${summary.cognitive}, execution ${summary.execution} (${factors})`,
    `Confidence: ${summary.confidence} · Unknowns: ${summary.unknowns}`,
    `Source: ${source ? `score step ${source.n}` : "an existing complexity file, trusted as-is"}`,
    "",
    ...(shifts.length
      ? ["Tier shifts (cognitive moves plan, execution moves implement; one rung each):", "", ...shifts]
      : ["No tier shift."]),
    "",
  ];
}

// The Cost (estimate) line under the totals line: a blended rate over the steps that have a token figure and a price.
function costLine(cost) {
  const missing = cost.unpriced.length ? ` · no price for: ${cost.unpriced.join(", ")}` : "";
  if (cost.priced === 0) return `Cost (estimate): - (no step with a token figure has a price) at a blended rate${missing}`;
  return `Cost (estimate): $${cost.usd.toFixed(2)} at a blended rate (USD per million tokens, no input/output split) · priced ${cost.priced} of ${cost.withFigures} steps with a token figure${missing}`;
}

function buildReport(id, meta, fullLog) {
  const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const log = executed(fullLog);
  const skips = fullLog.filter((e) => e.skipped);
  const o = meta.outcome;
  const outcome = o ? `${o.action}${o.reason ? ` - ${oneLine(o.reason)}` : ""}` : "not ended";
  const tokens = (e) => (typeof e.usage?.totalTokens === "number" ? e.usage.totalTokens : null);
  // The cost estimate, only when the merged policy prices a model; without prices the report is as before.
  const prices = loadPrices();
  const cost = prices ? estimateCost(log, prices) : null;
  const rows = log.map((e) => {
    const shown = e.result ? (e.ok ? "ok" : e.fallback ? "fallback" : "failed") : "-";
    // The step commit of an isolated run, short.
    const committed = typeof e.commit === "string" ? `${shown} (${e.commit.slice(0, 7)})` : shown;
    // Neutral reruns after orchestrator faults, also on a pending entry ("-, 1 neutral rerun").
    const k = neutralCount(e);
    const result = k ? `${committed}, ${k} neutral rerun${k === 1 ? "" : "s"}` : committed;
    const t = tokens(e);
    const usd = cost ? cost.perEntry[e.n] : undefined;
    const costCell = cost ? ` ${typeof usd === "number" ? `$${usd.toFixed(4)}` : "-"} |` : "";
    return `| ${e.n} | ${e.step === "implement" && e.template !== e.step ? `implement (${e.template})` : e.step} | ${e.model} | ${e.effort} | ${e.tier} | ${e.simple ? "yes" : "no"} | ${result} | ${t === null ? "-" : t} |${costCell}`;
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
    `| # | Step | Model | Effort | Tier | Simple | Result | Tokens |${cost ? " Cost (est.) |" : ""}`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |${cost ? " --- |" : ""}`,
    ...rows,
    "",
    `Steps: ${log.length} · Tokens: ${withTokens.length ? total : "-"} (figures for ${withTokens.length} of ${log.length} steps)${skips.length ? ` · Skipped: ${skips.length}` : ""}`,
    ...(cost ? [costLine(cost)] : []),
    "",
    ...(skips.length ? [
      "## Skipped steps",
      "",
      "| After step | Step | Reason | Rigor |",
      "| --- | --- | --- | --- |",
      ...skips.map((e) => `| ${e.afterN} | ${e.step} | ${oneLine(e.reason).replace(/\|/g, "/")} | ${e.rigor ?? "-"} |`),
      "",
    ] : []),
    ...rollbackLines(log),
    ...neutralLines(log),
    ...reviewLines(log),
    ...manualCheckLines(log, oneLine),
    ...complexityLines(fullLog),
    ...lessonLines(log, oneLine),
  ].join("\n");
}

// The "Rolled-back steps" section of an isolated run: one line per failed step whose partial edits sit under a side
// ref, reset away (rolledBack) or left in the worktree because the run halted (kept). None, no section.
function rollbackLines(log) {
  const rows = log.filter((e) => typeof e.rolledBack === "string" || typeof e.kept === "string").map((e) =>
    typeof e.kept === "string"
      ? `- step ${e.n} ${e.step}: \`${e.kept}\` kept (run halted)`
      : `- step ${e.n} ${e.step}: \`${e.rolledBack}\` rolled back to ${String(e.startSha).slice(0, 7)}`);
  if (!rows.length) return [];
  return [
    "## Rolled-back steps",
    "",
    "Partial edits of failed steps, kept under a side ref. Inspect one with `git show --stat <ref>`.",
    "",
    ...rows,
    "",
  ];
}

// The number of neutral reruns a log entry had after orchestrator faults (0 when none or malformed).
function neutralCount(e) {
  return Array.isArray(e.neutralRetries) ? e.neutralRetries.length : 0;
}

// The "Neutral reruns" section: one line per step the router returned again unchanged after the orchestrator declared a
// fault of its own (orchestrator-error), then the orchestrator's notes. The notes are orchestrator text and the report
// may be posted to a pull request as it is, so each is one line, without backticks, cut like a lesson candidate.
// None, no section.
function neutralLines(log) {
  const rows = log.filter((e) => neutralCount(e) > 0).flatMap((e) => {
    const k = neutralCount(e);
    const notes = e.neutralRetries
      .map((r) => (isObject(r) && typeof r.note === "string" ? cleanLessonCandidate(r.note, NEUTRAL_NOTE_MAX) : ""))
      .filter(Boolean);
    return [`- step ${e.n} ${e.step}: ${k} rerun${k === 1 ? "" : "s"} after an orchestrator fault`, ...notes.map((note) => `  - ${note}`)];
  });
  if (!rows.length) return [];
  return [
    "## Neutral reruns",
    "",
    "Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; " +
      "no failed attempt was counted. The notes are the orchestrator's.",
    "",
    ...rows,
    "",
  ];
}

// The "Review findings" section: one line per executed review step that logged a `review` field, with the counts measured
// from the header and, for a review with Decision lines, the findings still open. The figures are the ones stored when the
// step ended, so the section says that a later edit of a review file is not reflected. None, no section.
function reviewLines(log) {
  const count = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);
  const rows = log.filter((e) => isObject(e.review)).map((e) => {
    const r = e.review;
    const confirm = e.template === `${e.step}-confirm` ? " (confirmation)" : "";
    const verdict = typeof r.verdict === "string" && r.verdict !== "" ? r.verdict : "-";
    const open = Number.isInteger(r.openCritical) && Number.isInteger(r.openWarnings)
      ? `; ${r.openCritical} critical, ${r.openWarnings} warnings open`
      : "";
    return `- step ${e.n} ${e.step}${confirm}: ${verdict}, ${count(r.critical)} critical, ${count(r.warnings)} warnings measured${open}`;
  });
  if (!rows.length) return [];
  return [
    "## Review findings",
    "",
    "Counts as recorded when each review step ended; later edits of a review file are not reflected.",
    "",
    ...rows,
    "",
  ];
}

// The "Manual checks" section, from log entries only: the rows the last manual-verify entry counts as proved, grouped by
// evidence kind, then the rows it left pending with the merged reasons. Titles come from the first entry's baseline.
// No manual-verify entry, no section.
function manualCheckLines(log, oneLine) {
  const runs = log.filter((e) => e.step === "manual-verify");
  if (!runs.length) return [];
  const last = runs[runs.length - 1];
  const base = Array.isArray(runs[0].before?.manual) ? runs[0].before.manual : [];
  const titles = new Map(base.filter((r) => isObject(r) && typeof r.id === "string").map((r) => [r.id, String(r.text ?? "")]));
  const label = (id) => {
    const text = withoutEvidence(oneLine(titles.get(id) ?? ""));
    const title = text === id ? "" : text.startsWith(`${id} `) ? text.slice(id.length + 1) : text;
    return `${oneLine(id)}${title ? ` ${title}` : ""}`;
  };
  const proved = (Array.isArray(last.proved) ? last.proved : []).filter((r) => isObject(r) && typeof r.id === "string");
  const kinds = [...new Set(proved.map((r) => String(r.kind ?? "other")))];
  const provedRows = kinds.flatMap((kind) => proved.filter((r) => String(r.kind ?? "other") === kind)
    .map((r) => `- ${label(r.id)} — ${kind} (${oneLine(r.file)})`));
  const reasons = mergedReasons(log);
  const pending = (Array.isArray(last.pending) ? last.pending : []).filter((id) => typeof id === "string");
  const pendingRows = pending.map((id) => `- ${label(id)} — not proved: ${oneLine(reasons.get(id) ?? "no reason recorded")}`);
  return [
    "## Manual checks",
    "",
    "Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.",
    "",
    `Proved: ${provedRows.length}`,
    ...(provedRows.length ? ["", ...provedRows] : []),
    "",
    `Not proved: ${pendingRows.length}`,
    ...(pendingRows.length ? ["", ...pendingRows] : []),
    "",
  ];
}

// Returns the report path relative to the project root.
export function writeReport(p, id, meta, log) {
  fs.mkdirSync(p.dir, { recursive: true });
  fs.writeFileSync(p.report, buildReport(id, meta, log));
  return path.relative(ROOT, p.report);
}

// Writes the end of a run: log, meta.json outcome and report.md. Prints nothing and does not exit.
// An ordinary halt of an archive run gets archive and committed here; a result that has its own archive field keeps it.
export function finishRun(p, id, meta, log, result) {
  writeLog(p.log, log);
  meta.outcome = { action: result.action, reason: result.reason };
  if (result.action === "done") {
    meta.outcome.manualPending = Array.isArray(result.manualPending) ? result.manualPending : [];
    Object.assign(meta.outcome, doneNotes(result));
  }
  fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  let report = null;
  let reportError;
  try { report = writeReport(p, id, meta, log); } catch (e) { reportError = e.message; }
  const extra = meta.archive === true && result.action === "halt" && result.archive === undefined
    ? { archive: "skipped: run halted", committed: false } : {};
  return reportError ? { ...result, ...extra, report, reportError } : { ...result, ...extra, report };
}

// Every end of run goes through here so no branch can skip the report.
export function endRun(p, id, meta, log, result) {
  return out(finishRun(p, id, meta, log, result));
}

// ---- neutral rerun after an orchestrator fault ------------------------------

// The result status an orchestrator writes when the fault is its own and no subagent of the step ran or still runs.
export const ORCHESTRATOR_ERROR = "orchestrator-error";
// The longest note kept per neutral rerun, in code points.
const NEUTRAL_NOTE_MAX = 200;

// limits.maxNeutralRetries, read tolerantly: a value that is not a non-negative integer reads as the shipped default (2);
// 0 turns neutral reruns off, so the status then reads as any unknown status (a failed attempt).
export function maxNeutralRetries(policy) {
  const v = policy?.limits?.maxNeutralRetries;
  return Number.isSafeInteger(v) && v >= 0 ? v : 2;
}

// Runs before attachResult. When the last executed entry has no result and last-result.json holds the status
// orchestrator-error, the same entry is returned again: same n, tier, prompt, startedAt, startSha and before, so no
// failed attempt, tier bump, rigor rise, rollback or budget use follows. At the cap the run halts. Prints and exits in
// those cases; returns (and changes nothing) in every other case, so the caller goes on as before.
export function neutralRetry(p, id, meta, log, policy) {
  const ran = executed(log);
  const last = ran[ran.length - 1];
  if (!last || last.result || !fs.existsSync(p.result)) return;
  const result = readJson(p.result, null);
  if (!isObject(result) || result.status !== ORCHESTRATOR_ERROR) return;
  const cap = maxNeutralRetries(policy);
  if (cap === 0) return;
  const resultFile = path.relative(ROOT, p.result);
  // An entry logged before this feature has no stored prompt; the file stays so the orchestrator can replace it.
  if (typeof last.pendingPrompt !== "string") {
    halt(`Step ${last.n} (${last.step}) was logged without a stored prompt, so it cannot be rerun unchanged after an orchestrator fault. ` +
      `Write ${resultFile} with {"status":"failed","note":"..."} to count the attempt, then run next.`);
  }
  const reruns = Array.isArray(last.neutralRetries) ? last.neutralRetries : [];
  fs.rmSync(p.result);
  if (reruns.length >= cap) {
    return endRun(p, id, meta, log, {
      action: "halt",
      reason: `Step ${last.n} (${last.step}) hit its limit of ${cap} neutral reruns after orchestrator faults (limits.maxNeutralRetries). Needs a human. ` +
        "Fix the harness, then either write a result file with the real status (the router verifies the step by its files), " +
        "or raise limits.maxNeutralRetries in context/foundation/agent-smith-policy.json and write the orchestrator-error result file again, then run next.",
      steps: ran.length,
    });
  }
  const note = typeof result.note === "string" ? Array.from(result.note.replace(/\s+/g, " ").trim()).slice(0, NEUTRAL_NOTE_MAX).join("") : "";
  last.neutralRetries = [...reruns, { at: Date.now(), note }];
  writeLog(p.log, log);
  // A continued run must not keep the outcome of an earlier end (as next() does before a new step).
  if (meta.outcome) {
    delete meta.outcome;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }
  out({
    action: "run",
    n: last.n,
    step: last.step,
    ...(typeof last.agent === "string" ? { agent: last.agent } : {}),
    model: last.model,
    effort: last.effort,
    reason: `${last.reason}; tier ${last.tier} (${last.tierWhy})`,
    prompt: last.pendingPrompt,
    resultFile,
    neutralRetry: { count: last.neutralRetries.length, cap },
  });
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

// Keep only known signal keys with valid types: rigor (a level; never for a score entry), needsHuman (a short text) and,
// for an impl-review entry only, lessonCandidates (a few short one-line rules).
// Anything else is dropped. Returns null when nothing survives.
const NEEDS_HUMAN_MAX = 300;
const LESSON_DEFAULTS = { maxCandidates: 3, maxChars: 200 };

// The two lesson limits; a value that is not a positive safe integer reads as the default.
export function lessonLimits(policy) {
  const cfg = isObject(policy?.lessons) ? policy.lessons : {};
  const pick = (key) => (Number.isSafeInteger(cfg[key]) && cfg[key] > 0 ? cfg[key] : LESSON_DEFAULTS[key]);
  return { maxCandidates: pick("maxCandidates"), maxChars: pick("maxChars") };
}

// One candidate seed: no format characters, one line, no backticks, cut on a word boundary.
function cleanLessonCandidate(raw, maxChars) {
  let text = raw
    .replace(/\p{Cf}/gu, "")
    .replace(/[\p{Cc}\s]+/gu, " ")
    .replace(/`/g, "'")
    .trim();
  const chars = Array.from(text);
  if (chars.length > maxChars) {
    let kept = chars.slice(0, maxChars);
    if (chars[maxChars] !== " " && kept.includes(" ")) kept = kept.slice(0, kept.lastIndexOf(" "));
    text = kept.join("").trim();
  }
  return text;
}

function cleanLessonCandidates(raw, policy) {
  if (!Array.isArray(raw)) return [];
  const { maxCandidates, maxChars } = lessonLimits(policy);
  const seen = new Set();
  const clean = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const text = cleanLessonCandidate(item, maxChars);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
    if (clean.length === maxCandidates) break;
  }
  return clean;
}

function cleanSignals(raw, policy, step) {
  if (!isObject(raw)) return null;
  const clean = {};
  // The score only advises (ADR-007): a score result never raises the rigor level, whatever the generic suffix invites.
  if (step !== "score" && typeof raw.rigor === "string" && rigorLevels(policy).includes(raw.rigor)) clean.rigor = raw.rigor;
  if (raw.needsHuman === true) clean.needsHuman = "The subagent asked for a human (no reason given).";
  else if (typeof raw.needsHuman === "string") {
    const text = raw.needsHuman.replace(/\s+/g, " ").trim().slice(0, NEEDS_HUMAN_MAX);
    if (text) clean.needsHuman = text;
  }
  if (step === "impl-review") {
    const candidates = cleanLessonCandidates(raw.lessonCandidates, policy);
    if (candidates.length) clean.lessonCandidates = candidates;
  }
  return Object.keys(clean).length ? clean : null;
}

// The review counts kept in the log entry: the verdict and the measured header counts, plus the open pair for a review
// with Decision lines. Later reads (status, the report) use this copy, so a later edit of the review file changes nothing.
function reviewRecord(read, policy) {
  const rec = { verdict: read.verdict, critical: read.critical, warnings: read.warnings };
  const open = openCounts(read, policy);
  if (open.aware) { rec.openCritical = open.openCritical; rec.openWarnings = open.openWarnings; }
  return rec;
}

export function attachResult(p, log, policy) {
  const ran = executed(log);
  const last = ran[ran.length - 1];
  if (!last || last.result) return;
  if (!fs.existsSync(p.result)) {
    out({
      action: "halt",
      reason: `Step ${last.n} (${last.step}) has no result. Write ${path.relative(ROOT, p.result)} first. ` +
        `When the fault is the orchestrator's own and no subagent of the step is running, write {"status":"${ORCHESTRATOR_ERROR}","note":"..."} to rerun the step unchanged.`,
    }, 1);
  }
  let result = readJson(p.result, null);
  if (!result || typeof result !== "object") result = { status: "unknown", note: "unparseable result file" };
  fs.rmSync(p.result);
  // The stored prompt is only kept while the step is pending (a neutral rerun returns it unchanged).
  delete last.pendingPrompt;

  const plan = readPlan(p.plan);
  let verified;
  switch (last.step) {
    case "plan": verified = plan.hasProgress && plan.mtime > last.startedAt && (!CODE_REPLANS.includes(last.template) || verifyCodeReplan(last, plan)); break;
    case "plan-review":
    case "impl-review": {
      const file = last.step === "plan-review" ? p.planReview : p.implReview;
      const read = readReview(file);
      verified = mtime(file) > last.startedAt && read.verdict !== null;
      if (verified) last.review = reviewRecord(read, policy);
      break;
    }
    case "research": {
      const file = preplanFile(p, policy, last);
      verified = file !== null && mtime(file) > last.startedAt && frontmatterField(file, "status") !== null;
      break;
    }
    case "frame": {
      // The Confidence label is never read: its section lists all three labels as bullets.
      const file = preplanFile(p, policy, last);
      verified = file !== null && mtime(file) > last.startedAt && /^## Reframed/m.test(readText(file));
      break;
    }
    case "domain-brief": {
      // The file comes from the entry's template, so the two domain templates verify against different files.
      const file = preplanFile(p, policy, last);
      verified = file !== null && mtime(file) > last.startedAt && frontmatterField(file, "type") === "refactor-plan";
      break;
    }
    case "score": {
      // The file must be newer than the step start and pass the shape checks. The evidence is never judged.
      const read = readComplexity(p, policy);
      verified = read.ok && mtime(p.complexity) > last.startedAt;
      if (read.ok && verified) last.score = read.data;
      if (!read.ok && read.exists) last.invalid = read.error;
      break;
    }
    case "implement": verified = verifyImplement(last, plan, result, p, policy); break;
    case "manual-verify": verified = verifyManual(last, ran, plan, result, p, policy); break;
    // The OpenSpec steps (ADR-013 D4), each verified by the file it writes; os-verify also gets `review`.
    case "os-propose":
    case "os-apply":
    case "os-verify": verified = verifyOpenspecStep(last, p); break;
    default: verified = true; // fix: trust status, the next impl-review checks the code
  }
  // The raw signals object never reaches run.jsonl; only the cleaned one does.
  const { signals: rawSignals, ...stored } = result;
  last.result = stored;
  const usage = cleanUsage(result.usage);
  if (usage) last.usage = usage;
  const signals = cleanSignals(rawSignals, policy, last.step);
  if (signals) last.signals = signals;
  last.verified = verified;
  last.ok = result.status === "done" && verified;
  last.finishedAt = Date.now();
}

// The open findings of an aware review are over the line when one is critical or the open warnings exceed the shared
// tolerance (review.reviseToleranceWarnings, for both reviews).
function openOverTolerance(oc, policy) {
  return oc.openCritical > 0 || oc.openWarnings > policy.review.reviseToleranceWarnings;
}

// review.confirmRounds[<level>], read tolerantly: a value that is not a non-negative integer reads as the shipped default
// (0, off). It caps the confirmation reviews of each kind per run.
function confirmRounds(policy, level) {
  const v = policy?.review?.confirmRounds?.[level];
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

// The confirmation round: an extra review of the same kind (same step name, so freshness and the tier policy of the review
// apply; only the template differs) after an aware review that applied fixes and left nothing open. The caller has checked
// the verdict, `applied` and the open counts. The count is every executed entry with the confirm template, failed ones
// included, so N is a hard cap and a confirmation that applied fixes again schedules the next one only below it.
function confirmNext(kind, label, log, policy, level, oc) {
  const cap = confirmRounds(policy, level);
  const template = `${kind}-review-confirm`;
  const ran = log.filter((e) => e.template === template).length;
  if (ran >= cap) return null;
  return {
    step: `${kind}-review`,
    template,
    bump: 0,
    reason: `${label} applied ${oc.applied} fix(es) and left nothing open: confirmation round ${ran + 1} of ${cap}: self-applied fixes unchecked`,
  };
}

// "A, B or C" for the Decision words a halt text offers.
function joinWords(words) {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

// The halt of an aware review that left open findings: what is open, then the way back in (set the Decision lines or triage
// with the review skill), plus the findings the header counts without a block, plus, in an isolated run, the commit rule
// (the next failed step rolls back to its startSha and would restore the open lines).
function openFindingsHalt(label, skillName, file, oc, policy, meta) {
  const rel = path.relative(ROOT, file);
  const ids = oc.ids.length ? ` (${oc.ids.join(", ")})` : "";
  let text = `${label} left ${oc.openCritical} open critical and ${oc.openWarnings} open warnings${ids}. Needs a human.`;
  if (oc.unparsed > 0) {
    text += ` Plus ${oc.unparsed} counted in the Findings header with no ### F<n> block: add a block with a Decision line for each, or lower the header count.`;
  }
  const words = joinWords([...openFindingsConfig(policy).closed]);
  text += ` Set each finding's Decision in ${rel} (${words}) or triage with /${skillName} ${rel}, then run /agent-smith:10x-pipeline ${meta.id} again.`;
  if (meta.isolated === true) text += " Commit the edit in the run worktree first: a failed step rolls back uncommitted edits.";
  return { halt: text };
}

export function decide(p, fullLog, policy, meta, ctx) {
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
    const pre = preplanNext(p, fullLog, policy, meta, ctx);
    if (pre) return pre;
    const score = scoreNext(p, fullLog, policy, meta, ctx);
    if (score) return score;
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
      const measured = riskMeasured(ctx.risk);
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

  // A REVISE with Decision lines routes on its open findings: nothing open (within the tolerance) goes on, anything else
  // halts, or re-plans under onOpen "retry". A review without Decision lines keeps the measured header counts. RETHINK
  // never reads the open counts.
  const prOpen = openCounts(pr, policy);
  const prAware = prOpen.aware && pr.verdict === "REVISE";
  const needsReplan =
    pr.verdict === "RETHINK" ||
    (pr.verdict === "REVISE" && (prAware
      ? openOverTolerance(prOpen, policy)
      : pr.critical > 0 || pr.warnings > policy.review.reviseToleranceWarnings));
  if (needsReplan && plan.autoDone === 0) {
    if (prAware) {
      if (openFindingsConfig(policy).onOpen !== "retry") {
        return openFindingsHalt("Plan review REVISE", "10x-plan-review", p.planReview, prOpen, policy, meta);
      }
      return replanNext(log, pr, policy, ctx.level, prOpen);
    }
    return replanNext(log, pr, policy, ctx.level);
  }
  // Nothing open after a REVISE that applied fixes: with review.confirmRounds above 0, a confirmation review first.
  if (prAware && plan.autoDone === 0 && prOpen.applied > 0 && prOpen.openCritical === 0 && prOpen.openWarnings === 0) {
    const confirm = confirmNext("plan", `plan review ${pr.verdict}`, log, policy, ctx.level, prOpen);
    if (confirm) return confirm;
  }

  const lastRan = log[log.length - 1];
  if (lastRan?.template === "plan-replan" && !lastRan.ok) {
    return { halt: `The re-plan after ${policy.codeReplan?.afterFailures} failed implement attempts did not produce a valid plan. Needs a human.` };
  }
  const reopen = retryRows(log, plan, policy);
  if (plan.autoPending > 0 || reopen.length) {
    const replan = codeReplanNext("failure", log, policy, ctx);
    if (replan) return replan;
    let bump = 0;
    const why = [`${plan.autoPending} automated rows pending`];
    if (pr.warnings >= E.noisyPlanReviewWarnings) { bump += E.noisyPlanReviewBump; why.push(`plan review had ${pr.warnings} warnings`); }
    if (pr.verdict === "SOUND" && pr.critical === 0 && pr.warnings === 0 && trailingFailures(log, "implement") === 0) {
      bump -= E.cleanReviewDrop; why.push("clean plan review");
    }
    if (reopen.length) return retryNext(plan, reopen, policy, { bump, why });
    return executorNext(plan, log, policy, ctx, { bump, why }, p.plan) ?? { step: "implement", bump, reason: why.join(", ") };
  }

  // All automated rows done. Review is stale if code moved after the last review.
  const lir = lastIdx(log, ["impl-review"]);
  const lcode = lastIdx(log, ["implement", "fix"]);
  const irFresh = lir >= 0 || lcode >= 0
    ? ir.exists && lir > lcode
    : ir.exists && ir.mtime >= plan.mtime;
  if (!irFresh) {
    const verify = manualVerifyNext(plan, log, policy, ctx, meta);
    if (verify) return verify;
    const struggled = log.some((e) => (e.step === "implement" || e.step === "fix") && !e.ok && !e.fallback) || count("fix") > 0;
    return {
      step: "impl-review",
      ...reviewWarning(log, plan, policy),
      bump: struggled ? E.hardChangeReviewerBump : 0,
      reason: struggled ? "implementation needed retries or fixes" : "implementation complete",
    };
  }

  // A NEEDS ATTENTION with Decision lines routes on its open findings: nothing open (within the tolerance) is done, anything
  // else halts, or runs fix under onOpen "retry". review.fixOnNeedsAttention applies only to a review without Decision
  // lines. REJECTED never reads the open counts.
  const irOpen = openCounts(ir, policy);
  const irAware = irOpen.aware && ir.verdict === "NEEDS ATTENTION";
  const irOver = irAware && openOverTolerance(irOpen, policy);
  const retryOpen = openFindingsConfig(policy).onOpen === "retry";
  if (irOver && !retryOpen) {
    return openFindingsHalt("Implementation review NEEDS ATTENTION", "10x-impl-review", p.implReview, irOpen, policy, meta);
  }
  const needsFix =
    ir.verdict === "REJECTED" ||
    (ir.verdict === "NEEDS ATTENTION" && (irAware ? irOver : ir.critical > 0 || policy.review.fixOnNeedsAttention));
  if (needsFix) {
    const replan = ir.verdict === "REJECTED" ? codeReplanNext("rejected", log, policy, ctx, { fixes: count("fix") }) : null;
    if (replan) return replan;
    const loops = count("fix") + log.filter((e) => e.template === "plan-rejected").length;
    if (loops >= L.maxFixLoops) return { halt: `Implementation still ${ir.verdict} after ${loops} fix loops. Needs a human.` };
    const lastCode = [...log].reverse().find((e) => e.step === "implement" || e.step === "fix");
    return {
      step: "fix",
      template: "fix",
      verdict: ir.verdict,
      floorTier: lastCode ? lastCode.tier : undefined,
      bump: ir.verdict === "REJECTED" ? E.rejectedBump : 0,
      reason: `impl review ${ir.verdict} (${ir.critical} critical, ${ir.warnings} warnings)${irAware ? `; open ${irOpen.openCritical} critical, ${irOpen.openWarnings} warnings` : ""}`,
    };
  }

  // Nothing open after a NEEDS ATTENTION that applied fixes: with review.confirmRounds above 0, a confirmation review first.
  if (irAware && irOpen.applied > 0 && irOpen.openCritical === 0 && irOpen.openWarnings === 0) {
    const confirm = confirmNext("impl", `impl review ${ir.verdict}`, log, policy, ctx.level, irOpen);
    if (confirm) return confirm;
  }

  return {
    done: true,
    reason: `impl review ${ir.verdict ?? "APPROVED"}`,
    manualPending: plan.manualPending,
    ...doneNotes({
      uncommittedTicks: unprovenTicks(log, plan, policy),
      manualUnproven: manualUnprovenIds(log, plan),
      manualNotProved: manualNotProvedRows(log, plan),
    }),
  };
}

// ---- prompt text ------------------------------------------------------------

const PROMPT_REF = /^@prompts\/[A-Za-z0-9._-]+\.md$/;

// A prompt value is a string or an array of strings, joined with newlines. A part that is @prompts/<name>.md is
// replaced by the trimmed text of that file under the skill directory. References resolve before render(), so a goal
// text never injects one. Throws an Error naming the template when the key is missing or a reference does not
// resolve; main turns it into a JSON halt.
export function promptText(policy, template) {
  const value = policy.prompts?.[template];
  const parts = typeof value === "string" ? [value] : Array.isArray(value) ? value : null;
  if (!parts) throw new Error(`policy.prompts.${template} is missing or is not a string or an array of strings`);
  return parts.map((part) => {
    if (typeof part !== "string") throw new Error(`policy.prompts.${template} has a part that is not a string`);
    if (!part.startsWith("@prompts/")) return part;
    if (!PROMPT_REF.test(part)) throw new Error(`policy.prompts.${template} has a bad reference ${part}`);
    try {
      return fs.readFileSync(path.join(SKILL_DIR, part.slice(1)), "utf8").trim();
    } catch {
      throw new Error(`policy.prompts.${template} refers to ${part}, which cannot be read`);
    }
  }).join("\n");
}

// Every prompt of the policy must resolve before next() consumes last-result.json. A bad @prompts/ reference then ends
// the call with a clear halt and leaves the result file and the log untouched, so the run is recoverable after the
// policy is fixed.
export function checkPrompts(policy) {
  const prompts = isObject(policy.prompts) ? policy.prompts : {};
  for (const template of Object.keys(prompts)) {
    try {
      promptText(policy, template);
    } catch (e) {
      throw new Error(`${e instanceof Error ? e.message : String(e)}. The result file and the log are untouched: fix the policy and run next again.`);
    }
  }
}

// The upstream artifacts of preplan.artifacts that exist in the change folder, as a prompt line, else "".
// Paths are project-relative, in the order of first appearance in the map.
export function artifactsLine(p, policy) {
  const map = policy.preplan?.artifacts;
  if (!isObject(map)) return "";
  const found = [];
  for (const file of Object.values(map)) {
    if (typeof file !== "string" || !/^[A-Za-z0-9._-]+$/.test(file) || found.includes(file)) continue;
    if (fs.existsSync(path.join(p.change, file))) found.push(file);
  }
  if (!found.length) return "";
  const rel = found.map((file) => path.relative(ROOT, path.join(p.change, file)).split(path.sep).join("/"));
  return `\nUpstream artifacts (read each fully before planning): ${rel.join(", ")}`;
}

// ---- restricted step agents -------------------------------------------------------

// The agent type the orchestrator dispatches a step with: the value of agents.steps.<step> when agents.restricted is
// the boolean true and that value is a non-blank string, else null. A malformed block reads as off and never throws.
// There is no fallback to another type: a step without an agent gets no `agent` field at all.
export function stepAgent(policy, step) {
  const c = policy.agents;
  if (!isObject(c) || c.restricted !== true || !isObject(c.steps) || !Object.hasOwn(c.steps, step)) return null;
  const name = c.steps[step];
  return typeof name === "string" && name.trim() ? name : null;
}

// ---- opt-in advisor ---------------------------------------------------------------

// Does this template get the advisor rules (prompts.advisor)? Only when advisor.enabled is the boolean true and
// advisor.templates is an array of strings that names the template. A malformed block or list reads as off and never
// throws. The flag only adds prompt text: the router reads no settings file, never checks that a consult happened and
// never caps it.
export function advisorOn(policy, template) {
  const c = policy.advisor;
  if (!isObject(c) || c.enabled !== true) return false;
  const list = c.templates;
  if (!Array.isArray(list) || !list.every((t) => typeof t === "string")) return false;
  return list.includes(template);
}
