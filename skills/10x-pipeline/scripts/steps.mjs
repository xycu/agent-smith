import fs from "node:fs";
import path from "node:path";
import {
  SKILL_DIR, readJson, isFailure, trailingFailures, goalClass, isObject, rigorLevels, SHA_RE, runGit, gitOut,
  globToRegex, churnConfig, normalizePlanPath,
} from "./state.mjs";
import { readText, goalPhrase, predicate, scoreShift } from "./preplan.mjs";

// ---- phase executors ----------------------------------------------------------

// A SHA suffix on a Progress row: " \u2014 <7-40 hex>".
const SHA_SUFFIX_RE = /\s+\u2014\s+([0-9a-f]{7,40})$/;

// Ids of the done Automated rows, in plan order.
function doneIds(plan) {
  return plan.phaseList.flatMap((ph) => ph.auto.filter((r) => r.done).map((r) => r.id));
}

// Done Automated rows that were not done at `beforeIds`. An entry without a list (an in-flight run) names none.
function newlyTicked(beforeIds, plan) {
  if (!Array.isArray(beforeIds)) return [];
  const before = new Set(beforeIds);
  return doneIds(plan).filter((id) => !before.has(id));
}

const strictTemplate = (policy, template) => Array.isArray(policy.executors?.strictVerify) && policy.executors.strictVerify.includes(template);
const retryTemplate = (policy) => (typeof policy.executors?.retry?.template === "string" ? policy.executors.retry.template : null);

// Extra keys of the entry `before`, only for a template whose result is checked by a commit. Additive (ADR-005).
export function beforeExtra(policy, template, plan) {
  if (!strictTemplate(policy, template) && template !== retryTemplate(policy) && !CODE_REPLANS.includes(template)) return {};
  const head = (gitOut(["rev-parse", "HEAD"]) ?? "").trim();
  return { head: SHA_RE.test(head) ? head : null, done: doneIds(plan) };
}

// The churn exclude globs as regexes; the shipped list when the override is unusable.
function evidenceExcludes(policy) {
  const cfg = churnConfig(policy);
  if (cfg) return cfg.exclude;
  const shipped = readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude;
  return (Array.isArray(shipped) ? shipped : []).filter((g) => typeof g === "string").map(globToRegex);
}

// Is there a code commit in before.head..HEAD? null: no check possible (no head recorded, no repository, unknown
// commit), the count rule applies. false: no counted commit, or a SHA suffix of `ids` names no counted commit.
// true otherwise. A commit counts when it touched a path outside the change folder that the churn exclude globs
// do not cover.
function commitEvidence(before, ids, plan, id, policy) {
  const head = before?.head;
  if (typeof head !== "string" || !SHA_RE.test(head)) return null;
  const anc = runGit(["merge-base", "--is-ancestor", head, "HEAD"]);
  if (anc.status === 1) return false;
  if (anc.status !== 0) return null;
  const log = runGit(["log", "-z", "--name-only", "--relative", "--format=%x01%H%x01", `${head}..HEAD`, "--"]);
  if (log.status !== 0) return null;
  // Output: \x01<sha>\x01, then \0, an optional \n, and the paths separated by \0.
  const parts = log.stdout.split("\x01");
  const exclude = evidenceExcludes(policy);
  const prefix = `context/changes/${id}/`;
  const counted = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const files = parts[i + 1].replace(/^\0?\n?/, "").split("\0").map((f) => f.replace(/^\n/, "")).filter(Boolean);
    if (files.some((f) => !f.startsWith(prefix) && !exclude.some((re) => re.test(f)))) counted.push(parts[i]);
  }
  if (!counted.length) return false;
  const rows = plan.phaseList.flatMap((ph) => ph.auto);
  for (const rowId of ids) {
    const row = rows.find((r) => r.id === rowId);
    const m = row ? row.text.match(SHA_SUFFIX_RE) : null;
    if (m && !counted.some((sha) => sha.startsWith(m[1]))) return false;
  }
  return true;
}

// The check for an `implement` entry. Plain and segment entries keep the count rule. A tdd, e2e or retry entry also
// needs a code commit; it sets last.uncommitted (rows ticked without one) and last.fallback (a neutral entry) itself.
export function verifyImplement(last, plan, result, p, policy) {
  const counted = plan.autoDone > (last.before?.autoDone ?? 0);
  const retry = Array.isArray(last.retry);
  const strict = strictTemplate(policy, last.template);
  if (!strict && !retry) return counted;
  const done = new Set(doneIds(plan));
  const ids = retry ? last.retry.filter((id) => done.has(id)) : newlyTicked(last.before?.done, plan);
  const ev = commitEvidence(last.before, ids, plan, path.basename(p.change), policy);
  if (strict && result.status === "blocked") last.fallback = true;
  // The retry is the last attempt and the one place a Skip flip must not pass unseen. With no check possible (head
  // unreadable, no commit yet, no repository) its rows stay unproven and the review gets the warning, as for a missing
  // commit. The entry is a neutral fallback, not a failure, so a project without a repository is never failed for it.
  if (ev === null && retry) {
    if (ids.length) { last.uncommitted = ids; last.evidenceUnavailable = true; }
    if (result.status === "done" || result.status === "blocked") last.fallback = true;
    return false;
  }
  if (ev === null) return counted;
  if (ev === false && ids.length) last.uncommitted = ids;
  // The retry is the last attempt: a missing commit is accepted with a warning and costs no failure.
  if (retry && ev === false && (result.status === "done" || result.status === "blocked")) last.fallback = true;
  return retry ? ev : counted && ev;
}

// ---- extra steps and executor choice ----

const extraAllowance = (policy, level) => (Number.isInteger(policy.extraSteps?.allowance?.[level]) ? policy.extraSteps.allowance[level] : 0);
const extraCost = (policy, template) => {
  const c = policy.extraSteps?.cost?.[template];
  return Number.isInteger(c) && c > 0 ? c : 0;
};

// What the extra-step pool of this level still holds: the allowance minus the cost of every executed entry, any outcome.
// A manual-verify entry is outside the pool and costs nothing, whatever an override says.
function extrasLeft(log, policy, level) {
  return extraAllowance(policy, level) - log.reduce((sum, e) => sum + (e.step === "manual-verify" ? 0 : extraCost(policy, e.template)), 0);
}

// An executor already failed or handed back a phase it covered: it is not chosen for that phase again.
const executorExcluded = (log, phase, executor) =>
  log.some((e) => e.executor === executor && e.phase <= phase && phase <= e.lastPhase && (e.fallback || e.ok === false));

// Does a pending phase want the e2e executor? The rigor gate is open, the setup record is valid, the phase name or a
// pending row names a browser word, and no earlier e2e attempt for the phase failed or handed back.
function e2eWanted(ph, log, policy, level, setup) {
  const cfg = policy.executors?.e2e;
  if (!isObject(cfg) || typeof cfg.template !== "string" || !setup.hit) return false;
  const levels = rigorLevels(policy);
  if (levels.indexOf(level) < 0 || levels.indexOf(cfg.minRigor) < 0 || levels.indexOf(level) < levels.indexOf(cfg.minRigor)) return false;
  if (executorExcluded(log, ph.n, "e2e")) return false;
  const text = [ph.name, ...ph.auto.filter((r) => !r.done).map((r) => r.text)].join("\n");
  return goalPhrase(text, cfg.rowWords) !== null;
}

// Paths named on the **File**: and **Files**: lines of each descriptive `## Phase N:` or `## Faza N:` block of the plan,
// as a Map from phase number to the sorted paths (backtick tokens, else comma-split text, normalized like planPaths).
function phaseFiles(planFile) {
  const found = new Map();
  let phase = null;
  for (const line of readText(planFile).split("\n")) {
    const h = line.match(/^## (?:Phase|Faza) (\d+)/);
    if (h) { phase = Number(h[1]); if (!found.has(phase)) found.set(phase, new Set()); continue; }
    if (/^## /.test(line)) { phase = null; continue; }
    const m = phase === null ? null : line.match(/^\*\*Files?\*\*:(.*)$/);
    if (!m) continue;
    const quoted = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    for (const raw of quoted.length ? quoted : m[1].split(",")) {
      const token = normalizePlanPath(raw);
      if (token) found.get(phase).add(token);
    }
  }
  return new Map([...found].map(([n, set]) => [n, [...set].sort()]));
}

const wordList = (v) => (Array.isArray(v) ? v.filter((w) => typeof w === "string" && w) : []);

// Does a pending phase want the tdd executor? Conservative and deterministic: the rigor gate is open, no earlier tdd
// attempt for the phase failed or handed back, no Automated row is done yet (the skill stops when the implementation
// exists), the phase names files and every one is code outside the exclude globs, and every pending Automated row
// names a test command in backticks and no UI word. `files` are the paths of the phase block.
function pureLogicPhase(ph, files, log, policy, level) {
  const cfg = policy.executors?.tdd;
  if (!isObject(cfg) || typeof cfg.template !== "string") return false;
  const levels = rigorLevels(policy);
  if (levels.indexOf(level) < 0 || levels.indexOf(cfg.minRigor) < 0 || levels.indexOf(level) < levels.indexOf(cfg.minRigor)) return false;
  if (executorExcluded(log, ph.n, "tdd") || ph.auto.some((r) => r.done) || !ph.auto.length) return false;
  const extensions = wordList(cfg.codeExtensions).map((x) => x.toLowerCase());
  const excluded = wordList(cfg.excludeGlobs).map(globToRegex);
  if (!files.length || !files.every((f) => extensions.includes(path.posix.extname(f).toLowerCase()) && !excluded.some((re) => re.test(f)))) return false;
  const testWords = wordList(cfg.testWords).map((w) => w.toLowerCase());
  return ph.auto.every((r) => {
    const spans = [...r.text.matchAll(/`([^`]+)`/g)].map((x) => x[1].toLowerCase());
    return spans.some((s) => testWords.some((w) => s.includes(w))) && goalPhrase(r.text, cfg.uiWords) === null;
  });
}

// The implement step for the first pending phase, or null: the caller then returns the plain step. `note` is what the
// implement branch computed: { bump, why }. The pool must pay for the whole route, so a run never starts a goal segment
// it cannot follow with the executor that justified it. e2e wins over tdd for a phase that fits both.
export function executorNext(plan, log, policy, ctx, note, planFile) {
  const pending = plan.phaseList.filter((ph) => ph.auto.some((r) => !r.done));
  if (!pending.length || extraAllowance(policy, ctx.level) <= 0) return null;
  const setup = predicate("e2eSetup", { policy });
  const files = isObject(policy.executors?.tdd) ? phaseFiles(planFile) : new Map();
  const choice = pending.map((ph) => {
    if (e2eWanted(ph, log, policy, ctx.level, setup)) return "e2e";
    return pureLogicPhase(ph, files.get(ph.n) ?? [], log, policy, ctx.level) ? "tdd" : "goal";
  });
  const special = choice.findIndex((c) => c !== "goal");
  const segment = policy.executors?.segment?.template;
  if (special < 0 || (special > 0 && typeof segment !== "string")) return null;
  const needed = (special > 0 ? extraCost(policy, segment) : 0) + extraCost(policy, policy.executors[choice[special]].template);
  if (extrasLeft(log, policy, ctx.level) < needed) return null;
  const executor = choice[0];
  const cfg = executor === "goal" ? null : policy.executors[executor];
  let last = 0;
  while (last + 1 < pending.length && choice[last + 1] === executor) last++;
  const phase = pending[0].n;
  const lastPhase = pending[last].n;
  const span = lastPhase > phase ? `phases ${phase}-${lastPhase}` : `phase ${phase}`;
  return {
    step: "implement",
    template: cfg ? cfg.template : segment,
    phase,
    lastPhase,
    executor,
    skill: cfg && typeof cfg.skill === "string" ? cfg.skill : undefined,
    interactive: executor !== "goal",
    bump: note.bump,
    reason: `${note.why.join(", ")}; ${executor === "goal" ? "goal-implement segment" : executor} for ${span}`,
  };
}

// Rows the latest implement entry ticked without a code commit that are still ticked, while a retry is left to run.
// A non-positive executors.retry.max turns the retry off.
export function retryRows(log, plan, policy) {
  const template = retryTemplate(policy);
  const max = policy.executors?.retry?.max;
  if (template === null || !Number.isInteger(max) || max <= 0) return [];
  if (log.filter((e) => e.template === template).length >= max) return [];
  const impl = log.filter((e) => e.step === "implement");
  const last = impl[impl.length - 1];
  if (!last || !Array.isArray(last.uncommitted)) return [];
  const done = new Set(doneIds(plan));
  return last.uncommitted.filter((id) => done.has(id));
}

// Rows ticked without a code commit that the router will not ask about again, in plan order.
export function unprovenTicks(log, plan, policy) {
  const template = retryTemplate(policy);
  const proven = new Set(log.filter((e) => template !== null && e.template === template && e.ok === true && Array.isArray(e.retry)).flatMap((e) => e.retry));
  const reopen = new Set(retryRows(log, plan, policy));
  const mine = new Set(log.filter((e) => e.step === "implement" && Array.isArray(e.uncommitted)).flatMap((e) => e.uncommitted));
  return doneIds(plan).filter((id) => mine.has(id) && !proven.has(id) && !reopen.has(id));
}

// The retry step: costs nothing from the pool and is not subject to executorExcluded.
export function retryNext(plan, rows, policy, note) {
  const at = rows.map((id) => plan.phaseList.find((ph) => ph.auto.some((r) => r.id === id))?.n).filter(Number.isInteger);
  return {
    step: "implement",
    template: retryTemplate(policy),
    phase: Math.min(...at),
    lastPhase: Math.max(...at),
    retry: rows,
    executor: "goal",
    bump: note.bump,
    reason: `${rows.length} row(s) ticked without a code commit (${rows.join(", ")}): retry`,
  };
}

// Added to the impl-review-warn prompt when the retry could not look for a commit at all.
const EVIDENCE_UNAVAILABLE = " Commit evidence was unavailable: the router could not read the commit history, so a commit may exist.";

// The impl-review template that warns about unproven ticks: only for the pass right after the implement entry that
// recorded them. A later pass, after a fix, uses the plain prompt.
export function reviewWarning(log, plan, policy) {
  const rows = unprovenTicks(log, plan, policy);
  if (!rows.length) return {};
  const at = log.reduce((acc, e, i) => (e.step === "implement" && Array.isArray(e.uncommitted) && e.uncommitted.some((id) => rows.includes(id)) ? i : acc), -1);
  if (log.slice(at + 1).some((e) => e.step === "impl-review")) return {};
  return { template: "impl-review-warn", uncommitted: rows, evidenceNote: log[at].evidenceUnavailable === true ? EVIDENCE_UNAVAILABLE : "" };
}

// The non-empty note keys of a done result, so a run that ends clean carries none.
export function doneNotes(d) {
  const notes = {};
  for (const key of ["uncommittedTicks", "manualUnproven", "manualNotProved"]) {
    if (Array.isArray(d?.[key]) && d[key].length) notes[key] = d[key];
  }
  return notes;
}

// ---- manual verification ----

// The ` — evidence: <token>` suffix a ticked Manual row carries.
const EVIDENCE_SUFFIX_RE = /\s+—\s+evidence:\s*(\S+)$/;
export const withoutEvidence = (text) => text.replace(EVIDENCE_SUFFIX_RE, "");

export const manualRows = (plan) => plan.phaseList.flatMap((ph) => ph.manual);

// Manual rows the last manual-verify entry ticked without valid evidence that are still ticked. Empty when that entry was ok.
export function manualUnprovenIds(log, plan) {
  const last = [...log].reverse().find((e) => e.step === "manual-verify");
  if (!last || last.ok || !Array.isArray(last.unproven)) return [];
  const done = new Set(manualRows(plan).filter((r) => r.done).map((r) => r.id));
  return last.unproven.filter((id) => done.has(id));
}

// The manual-verify step, or null. It runs before the first impl-review that finds a pending Manual row (or a row
// the last attempt ticked without valid evidence), at a level at or above `minRigor`, while fewer than `maxAttempts`
// entries exist. It is outside the extra-step pool. A retry (any earlier entry, ok or not) runs `retryBump` tiers up. A
// failed attempt is a neutral entry, so the run always goes on to impl-review.
export function manualVerifyNext(plan, log, policy, ctx, meta) {
  const cfg = policy.manualVerify;
  const posInt = (v) => Number.isInteger(v) && v > 0;
  if (!isObject(cfg) || !posInt(cfg.maxAttempts) || plan.autoPending > 0) return null;
  const levels = rigorLevels(policy);
  if (levels.indexOf(ctx.level) < 0 || levels.indexOf(cfg.minRigor) < 0 || levels.indexOf(ctx.level) < levels.indexOf(cfg.minRigor)) return null;
  const runs = log.filter((e) => e.step === "manual-verify");
  // Only before the first implementation review: no re-run after a fix.
  if (runs.length >= cfg.maxAttempts || log.some((e) => e.step === "impl-review")) return null;
  const rows = manualRows(plan);
  const pending = rows.filter((r) => !r.done).length;
  const retry = manualUnprovenIds(log, plan);
  if (!pending && !retry.length) return null;
  const wanted = new Set([...rows.filter((r) => !r.done).map((r) => r.id), ...retry]);
  const browserRows = browserRowIds(rows.filter((r) => wanted.has(r.id)), policy);
  const bump = runs.length && posInt(cfg.retryBump) ? cfg.retryBump : 0;
  return {
    step: "manual-verify",
    // Chrome is on unless the run stored --chrome false: an absent value and a run from before the default read on.
    template: meta?.chrome === false ? "manual-verify-nochrome" : "manual-verify",
    bump,
    ...(bump ? { bumpWhy: `manual-verify retry after ${runs.length} attempt(s)` } : {}),
    unproven: retry,
    browserRows,
    reason: `${pending} manual rows pending; ${retry.length ? `${retry.length} unproven tick(s) to settle` : runs.length ? "retry for the rows still pending" : "every pending row is in scope"}`,
  };
}

// An evidence file that was written after `since` and lies inside <change>/evidence/. The token comes from a row suffix.
function evidenceOk(changeDir, token, since) {
  const segments = token.startsWith("evidence/") ? token.slice("evidence/".length).split("/") : [];
  if (!segments.length || segments.some((s) => !/^[A-Za-z0-9._-]+$/.test(s) || s === "." || s === "..")) return false;
  try {
    const dir = path.join(changeDir, "evidence");
    const dirStat = fs.lstatSync(dir);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) return false;
    const file = path.join(dir, ...segments);
    const st = fs.statSync(file);
    if (!st.isFile() || st.size <= 0 || !(st.mtimeMs > since)) return false;
    return fs.realpathSync(file).startsWith(path.join(fs.realpathSync(changeDir), "evidence") + path.sep);
  } catch { return false; }
}

// The display-only knobs of the step. A value of the wrong shape reads as the default and never halts.
const MANUAL_DEFAULTS = {
  evidenceKinds: ["command", "test", "script", "browser", "judgment"], unprovenFile: "unproven.md", reasonMaxChars: 200,
  browserRowWords: ["playwright", "e2e", "end-to-end", "browser", "chrome"], browserProofKinds: ["browser", "test", "command", "script"],
};
// The unproved reasons file is read only up to this size; a larger file gives no reasons.
const UNPROVEN_MAX_BYTES = 65536;

function manualVerifyOptions(policy) {
  const cfg = isObject(policy?.manualVerify) ? policy.manualVerify : {};
  const kinds = Array.isArray(cfg.evidenceKinds) && cfg.evidenceKinds.length && cfg.evidenceKinds.every((k) => typeof k === "string" && k.trim() !== "")
    ? cfg.evidenceKinds.map((k) => k.trim().toLowerCase())
    : MANUAL_DEFAULTS.evidenceKinds;
  const file = typeof cfg.unprovenFile === "string" && /^[A-Za-z0-9._-]+$/.test(cfg.unprovenFile) && cfg.unprovenFile !== "." && cfg.unprovenFile !== ".."
    ? cfg.unprovenFile
    : MANUAL_DEFAULTS.unprovenFile;
  const max = Number.isSafeInteger(cfg.reasonMaxChars) && cfg.reasonMaxChars > 0 ? cfg.reasonMaxChars : MANUAL_DEFAULTS.reasonMaxChars;
  // An empty browserRowWords turns browser rows off; any other wrong shape reads as the default.
  const words = Array.isArray(cfg.browserRowWords) && cfg.browserRowWords.every((w) => typeof w === "string" && w.trim() !== "")
    ? cfg.browserRowWords
    : MANUAL_DEFAULTS.browserRowWords;
  const proof = Array.isArray(cfg.browserProofKinds) && cfg.browserProofKinds.length && cfg.browserProofKinds.every((k) => typeof k === "string" && k.trim() !== "")
    ? cfg.browserProofKinds.map((k) => k.trim().toLowerCase())
    : MANUAL_DEFAULTS.browserProofKinds;
  return { evidenceKinds: kinds, unprovenFile: file, reasonMaxChars: max, browserRowWords: words, browserProofKinds: proof };
}

// Ids of the Manual rows whose text (without the evidence suffix) names a browser word of manualVerify.browserRowWords.
// `rows` are { id, text }. A ticked row's evidence file name never counts.
export function browserRowIds(rows, policy) {
  const { browserRowWords } = manualVerifyOptions(policy);
  return rows.filter((r) => goalPhrase(withoutEvidence(String(r.text ?? "")), browserRowWords) !== null).map((r) => r.id);
}

// The kind of an evidence file: the part of its base name before the first "-", lower-cased, when it is a known kind.
// Any other prefix, and a base name with no prefix, reads "other".
function evidenceKind(token, kinds) {
  const base = token.split("/").pop() ?? "";
  const at = base.indexOf("-");
  if (at <= 0) return "other";
  const prefix = base.slice(0, at).toLowerCase();
  return kinds.includes(prefix) ? prefix : "other";
}

// The reasons of evidence/<unprovenFile>, for display only: { <row id>: <reason> } for each `- <row id> — <reason>` line
// that names a Manual row of the plan. The file counts only when it is a regular file inside the real evidence folder, at
// most UNPROVEN_MAX_BYTES, and newer than `since`. Anything else gives no reasons; nothing here changes `ok`.
function readUnprovenReasons(changeDir, policy, since, ids) {
  const { unprovenFile, reasonMaxChars } = manualVerifyOptions(policy);
  let text;
  try {
    const dir = path.join(changeDir, "evidence");
    const dirStat = fs.lstatSync(dir);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) return {};
    const file = path.join(dir, unprovenFile);
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > UNPROVEN_MAX_BYTES || !(st.mtimeMs > since)) return {};
    if (!fs.realpathSync(file).startsWith(path.join(fs.realpathSync(changeDir), "evidence") + path.sep)) return {};
    text = fs.readFileSync(file, "utf8");
  } catch { return {}; }
  const reasons = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s+(.+?)\s+—\s+(.+)$/);
    if (!m) continue;
    const id = m[1].replace(/^[`*_]+|[`*_]+$/g, "").trim();
    if (!ids.has(id)) continue;
    const clean = m[2].replace(/\p{Cf}/gu, "").replace(/[\p{Cc}\s]+/gu, " ").replace(/`/g, "'").trim();
    const reason = Array.from(clean).slice(0, reasonMaxChars).join("").trim();
    if (reason) reasons.set(id, reason);
  }
  return Object.fromEntries(reasons);
}

// The reasons of every manual-verify entry, merged in log order (a later entry wins).
export function mergedReasons(log) {
  const merged = new Map();
  for (const e of log) {
    if (e.skipped || e.step !== "manual-verify" || !isObject(e.reasons)) continue;
    for (const [id, reason] of Object.entries(e.reasons)) if (typeof reason === "string" && reason) merged.set(id, reason);
  }
  return merged;
}

// One line per Manual row still pending after at least one manual-verify entry ran, with its reason. Empty when the step never ran.
export function manualNotProvedRows(log, plan) {
  if (!log.some((e) => !e.skipped && e.step === "manual-verify")) return [];
  const reasons = mergedReasons(log);
  return manualRows(plan).filter((r) => !r.done).map((r) => `${r.text} — not proved: ${reasons.get(r.id) ?? "no reason recorded"}`);
}

// Verification of a manual-verify entry against the first entry of its trailing streak (a retry judges the first
// attempt's ticks again). Sets last.ticked and last.unproven; a step that is not ok is a neutral fallback entry.
export function verifyManual(last, ran, plan, result, p, policy) {
  const streak = [];
  for (let i = ran.length - 1; i >= 0 && ran[i].step === "manual-verify"; i--) streak.unshift(ran[i]);
  const first = streak[0] ?? last;
  const baseManual = Array.isArray(first.before?.manual) ? first.before.manual : [];
  const baseAuto = Array.isArray(first.before?.auto) ? first.before.auto : [];
  const nowManual = new Map(manualRows(plan).map((r) => [r.id, r]));
  const nowAuto = new Map(plan.phaseList.flatMap((ph) => ph.auto).map((r) => [r.id, r]));
  let intact = manualRows(plan).length === baseManual.length && nowAuto.size === baseAuto.length;
  for (const b of baseAuto) {
    const r = nowAuto.get(b.id);
    if (!r || r.text !== b.text || r.done !== b.done) intact = false;
  }
  const ticked = [];
  const unproven = [];
  const proved = [];
  const { evidenceKinds: kinds, browserProofKinds } = manualVerifyOptions(policy);
  const browserRows = browserRowIds(baseManual, policy);
  const unprovenWhy = {};
  for (const b of baseManual) {
    const r = nowManual.get(b.id);
    if (!r || withoutEvidence(r.text) !== withoutEvidence(b.text) || (b.done && !r.done)) {
      intact = false;
      // A newly ticked row whose title no longer matches (a mangled evidence suffix, for example) is a tick without valid evidence.
      if (r?.done && !b.done) unproven.push(b.id);
      continue;
    }
    if (b.done || !r.done) continue;
    const token = r.text.match(EVIDENCE_SUFFIX_RE)?.[1];
    if (token && evidenceOk(p.change, token, first.startedAt ?? 0)) {
      const kind = evidenceKind(token, kinds);
      // A browser row is proved only by a kind of browserProofKinds. The router reads no content: the prefix is a claim.
      if (browserRows.includes(b.id) && !browserProofKinds.includes(kind)) {
        unproven.push(b.id);
        unprovenWhy[b.id] = `browser row ticked with ${kind} evidence; only ${browserProofKinds.join(", ")} evidence proves it`;
        continue;
      }
      ticked.push(b.id);
      proved.push({ id: b.id, kind, file: token });
    } else unproven.push(b.id);
  }
  last.browserRows = browserRows;
  if (Object.keys(unprovenWhy).length) last.unprovenWhy = unprovenWhy;
  last.ticked = ticked;
  last.unproven = unproven;
  last.proved = proved;
  last.pending = manualRows(plan).filter((r) => !r.done).map((r) => r.id);
  const reasons = readUnprovenReasons(p.change, policy, last.startedAt ?? 0, new Set(manualRows(plan).map((r) => r.id)));
  if (Object.keys(reasons).length) last.reasons = reasons;
  const verified = intact && unproven.length === 0;
  if (!(result.status === "done" && verified)) last.fallback = true;
  return verified;
}

// ---- code re-plans ----

// The two templates of the `plan` step that revise a plan after code ran: repeated implement failures, or a first REJECTED review.
export const CODE_REPLANS = ["plan-replan", "plan-rejected"];

// The re-plan of one run, or null. kind "failure": the trailing implement failures equal codeReplan.afterFailures.
// kind "rejected": the impl-review said REJECTED and `extra.fixes` fix steps ran so far, at most codeReplan.rejectedMaxFixes.
// Both need the rigor gate, a positive cap not yet used by any re-plan, and (rejected only) pool room for its cost.
// A non-positive or missing knob turns that trigger off.
export function codeReplanNext(kind, log, policy, ctx, extra) {
  const cfg = policy.codeReplan;
  const posInt = (v) => Number.isInteger(v) && v > 0;
  if (!isObject(cfg) || !posInt(cfg.max) || log.filter((e) => CODE_REPLANS.includes(e.template)).length >= cfg.max) return null;
  const levels = rigorLevels(policy);
  if (levels.indexOf(ctx.level) < 0 || levels.indexOf(cfg.minRigor) < 0 || levels.indexOf(ctx.level) < levels.indexOf(cfg.minRigor)) return null;
  const bump = (v) => (Number.isInteger(v) ? v : 0);
  if (kind === "failure") {
    if (!posInt(cfg.afterFailures) || trailingFailures(log, "implement") !== cfg.afterFailures) return null;
    const failed = [...log].reverse().find((e) => e.step === "implement" && !e.fallback);
    const note = String(failed?.result?.note ?? "").replace(/\s+/g, " ").trim().slice(0, posInt(cfg.failureNoteMax) ? cfg.failureNoteMax : 300);
    return {
      step: "plan",
      template: "plan-replan",
      bump: bump(cfg.failureBump),
      bumpWhy: "code re-plan",
      failure: note || "no note",
      reason: `${cfg.afterFailures} implement attempts failed in a row: re-plan`,
    };
  }
  if (cfg.onRejected !== true || !Number.isInteger(cfg.rejectedMaxFixes) || !(extra.fixes <= cfg.rejectedMaxFixes)) return null;
  const cost = extraCost(policy, "plan-rejected");
  if (extraAllowance(policy, ctx.level) <= 0 || extrasLeft(log, policy, ctx.level) < cost) return null;
  return {
    step: "plan",
    template: "plan-rejected",
    verdict: "REJECTED",
    bump: bump(cfg.rejectedBump),
    bumpWhy: "code re-plan",
    reason: "impl review REJECTED before any fix: re-plan",
  };
}

// A code re-plan is verified when it still has pending Automated work and keeps every row that was ticked when it
// started: a re-plan must add rows, not untick or drop a ticked one. An entry without a list skips the subset test.
export function verifyCodeReplan(last, plan) {
  if (plan.autoPending <= 0) return false;
  if (!Array.isArray(last.before?.done)) return true;
  const now = new Set(doneIds(plan));
  return last.before.done.every((id) => now.has(id));
}

// A change is simple when the plan stays small and nothing has failed yet.
// Any failed step ends the discount for the rest of the run.
function simpleSignal(d, plan, log, meta, policy) {
  if (d.step === "plan") {
    return d.template === "plan" && goalClass(meta.goal, policy).kind === "short" && !log.some(isFailure)
      ? { simple: true, why: "short goal" }
      : { simple: false };
  }
  const S = policy.complexity.simple;
  const simple = plan.hasProgress && plan.phases >= 1 && plan.phases <= S.maxPhases &&
    plan.rows <= S.maxRows && !log.some(isFailure);
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

// `score` (optional) is { summary, riskClear }: the score summary from the log and whether churn risk was measured with
// no hot path. Without it, or without a summary, the tier is what it was before the score step existed.
export function tierFor(d, log, policy, plan, meta, level, score = null) {
  const s = policy.steps[d.step];
  const C = policy.complexity;
  let tier = s.baseTier;
  const parts = [`base ${s.baseTier}`];
  let cb = 0;
  if (C.appliesTo.includes(d.step)) {
    cb = C.phaseThresholds.filter((t) => plan.phases >= t).length;
    if (cb) { tier += cb; parts.push(`+${cb} for ${plan.phases} phases`); }
  }
  if (d.bump) { tier += d.bump; parts.push(`${d.bump > 0 ? "+" : ""}${d.bump} from ${d.bumpWhy ?? "results"}`); }
  const fails = trailingFailures(log, d.step);
  // The failure bump goes in inside settle (below), so an interactive step can count it in rungs that clear its floor.
  const failBump = fails * policy.escalation.perFailure;
  if (fails) parts.push(`+${failBump} for ${fails} failed attempt(s)`);
  const { simple, why } = simpleSignal(d, plan, log, meta, policy);
  const discount = simple ? C.simple.discount[d.step] ?? 0 : 0;
  if (discount > 0) { tier -= discount; parts.push(`-${discount} simple change (${why})`); }
  const offset = policy.rigor?.tierOffset?.[level]?.[d.step];
  const minEffort = policy.rigor?.minEffort?.[level];
  const interactive = Boolean(s.interactive || d.interactive) && typeof minEffort === "string";
  const order = Array.isArray(policy.rigor?.effortOrder) ? policy.rigor.effortOrder : [];
  const want = interactive ? order.indexOf(minEffort) : -1;
  const top = policy.ladder.length - 1;
  const floorIdx = interactive ? effortFloorTier(policy, minEffort) : 0;
  // A rung at or above the index floor whose own effort is below the floor: the effort floor never lets a step stay there.
  const belowFloor = (i) => want >= 0 && i >= floorIdx && i <= top && order.indexOf(policy.ladder[i].effort) < want;
  // The failure bump of an interactive step counts only rungs that clear its effort floor, so each failed attempt reaches
  // a rung the step can run on. A start on such a rung first moves past it at no cost. On a ladder ordered by effort no
  // rung is skipped, so this is plain addition. Returns the tier and the rung it skipped, if any.
  const addFailures = (t) => {
    if (!failBump || want < 0) return { t: t + failBump, skipped: null };
    let pos = t;
    let skipped = null;
    while (pos < top && belowFloor(pos)) { skipped = skipped ?? pos; pos++; }
    for (let k = 0; k < failBump && pos < top; k++) {
      pos++;
      while (pos < top && belowFloor(pos)) { skipped = skipped ?? pos; pos++; }
    }
    return { t: pos, skipped };
  };
  // Rigor offset, failure bump, last-code floor, clamp, then the effort floor. Returns the final tier and what it did.
  const settle = (start) => {
    const notes = [];
    let t = start;
    if (Number.isInteger(offset) && offset !== 0) { t += offset; notes.push(`${offset > 0 ? "+" : ""}${offset} rigor ${level}`); }
    const bumped = addFailures(t);
    t = bumped.t;
    if (d.floorTier !== undefined && t < d.floorTier + (d.bump || 0)) {
      t = d.floorTier + (d.bump || 0);
      notes.push(`floor at last code tier ${d.floorTier}`);
    }
    const clamped = Math.max(s.minTier ?? 0, Math.min(s.maxTier ?? policy.ladder.length - 1, t, policy.ladder.length - 1));
    if (clamped !== t) notes.push(`clamped to ${clamped}`);
    let final = clamped;
    if (interactive) {
      // Applied last, so the floor wins over maxTier and over every discount.
      if (final < floorIdx) final = floorIdx;
      notes.push(`floor ${minEffort} (tier ${floorIdx})`);
      // The ladder need not be ordered by effort, so the index floor alone can leave the step on a rung whose own
      // effort is below the floor. Move up past such rungs; an effort name missing from effortOrder counts as below.
      if (want >= 0) {
        const landed = final;
        while (final < top && order.indexOf(policy.ladder[final].effort) < want) final++;
        if (final !== landed) notes.push(`skips ${policy.ladder[landed].effort} rung (tier ${final})`);
        else if (bumped.skipped !== null && final === t) notes.push(`skips ${policy.ladder[bumped.skipped].effort} rung (tier ${final})`);
      }
    }
    return { final, notes };
  };
  // The cheaper first attempt of an isolated run (a failed one is rolled back): the retry pays the failure bump on the base.
  const drop = firstAttemptDrop(d, log, policy, meta, fails, discount);
  tier -= drop;
  // The score shift goes in before settle, so the clamp and, for interactive steps, the effort floor bound it.
  // The first-attempt drop counts as a discount for its guards: no down shift stacks on it.
  const shifted = isObject(score) && score.summary
    ? scoreShift(d, policy, score.summary, { riskClear: score.riskClear === true, failed: log.some(isFailure), discount: discount > 0 || drop > 0, phaseBump: cb > 0 })
    : { applies: false, shift: 0 };
  if (shifted.applies && shifted.shift !== 0) tier += shifted.shift;
  const settled = settle(tier);
  // Measured like the saved discount, net of the score shift: a drop that the clamp or the floor absorbed, or that an up
  // shift cancelled, is no cheaper attempt, so its failure counts for rigor and budget like any other.
  const applied = shifted.applies ? shifted.shift : 0;
  const survived = drop > 0 && settled.final < settle(tier + drop).final;
  const cheap = survived && settled.final < settle(tier + drop - applied).final;
  if (drop > 0) {
    parts.push(cheap ? `-${drop} first attempt`
      : survived ? `-${drop} first attempt not applied (cancelled by the score shift)`
        : `-${drop} first attempt not applied (clamp or floor)`);
  }
  let scoreEntry;
  if (shifted.applies && shifted.shift !== 0) {
    // The effective shift is measured like the saved discount: the final tier with and without it.
    const effective = settled.final - settle(tier - shifted.shift).final;
    const sign = shifted.shift > 0 ? "+" : "";
    parts.push(effective ? `${sign}${shifted.shift} score (${shifted.why})` : `${sign}${shifted.shift} score not applied (clamp or floor)`);
    scoreEntry = { sum: shifted.sum, value: shifted.value, shift: shifted.shift, effective };
  }
  parts.push(...settled.notes);
  // A discount that the clamp, the offset or the floor absorbed is no saving, so the report does not claim it.
  const saved = discount > 0 && settled.final < settle(tier + discount).final;
  return { tier: settled.final, fails, simple: saved, cheap, tierWhy: parts.join(", "), scoreShift: scoreEntry };
}

// The tier drop of a first attempt (escalation.firstAttempt), or 0. Only in an isolated run, for a listed template, when
// the step has no earlier failed entry and no trailing failure, and no simple-change discount applies. A `drop` that is
// not a positive integer, or a block of another shape, turns it off.
function firstAttemptDrop(d, log, policy, meta, fails, discount) {
  const cfg = policy.escalation?.firstAttempt;
  if (meta.isolated !== true || !isObject(cfg) || !Number.isInteger(cfg.drop) || cfg.drop <= 0) return 0;
  if (!Array.isArray(cfg.templates) || !cfg.templates.includes(d.template ?? d.step)) return 0;
  if (fails !== 0 || discount > 0 || log.some((e) => e.step === d.step && isFailure(e))) return 0;
  return cfg.drop;
}

export function render(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
