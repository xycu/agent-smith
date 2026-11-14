// The OpenSpec chain (ADR-013): reads the state of openspec/changes/<id>/ from files and picks the next step.
// It never calls the openspec CLI (D2). Import order: state, preplan, steps, openspec, then flow, isolation and route.
import fs from "node:fs";
import path from "node:path";
import { ROOT, executed, mtime, archiveRoot, DATED_ID, readGuarded } from "../../10x-pipeline/scripts/state.mjs";

// A task row of tasks.md, the pattern of the OpenSpec CLI (1.16.1, dist/utils/task-progress.js TASK_LINE_PATTERN): a list
// item under `-`, `*`, `+` or `1.`/`1)` with a checkbox that holds at most one non-space marker. A row is complete only
// for x or X; every other marker (`[ ]`, `[]`, `[~]`) is open work. Capture 1 is the marker. The contract test compares
// the counts with the CLI; a later CLI version can change its pattern (REFERENCE "Limits").
export const TASK_ROW = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;

// Read caps of the files a subagent writes (F6): a larger file reads as unreadable.
const TASKS_MAX_BYTES = 262144;
const VERIFY_MAX_BYTES = 65536;

const isFile = (file) => {
  try { return fs.statSync(file).isFile(); } catch { return false; }
};

// Task counts of tasks.md. A missing, symlinked, oversized or misplaced file counts no rows.
export function readTasks(file) {
  const res = { total: 0, complete: 0, open: 0 };
  const text = readGuarded(file, path.dirname(file), TASKS_MAX_BYTES);
  if (text === null) return res;
  for (const line of text.split("\n")) {
    const m = line.match(TASK_ROW);
    if (!m) continue;
    res.total++;
    if ((m[1] ?? "").toLowerCase() === "x") res.complete++;
    else res.open++;
  }
  return res;
}

// The *.md files anywhere under the specs folder. A missing folder has none.
function specFiles(dir) {
  const files = [];
  const walk = (d) => {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile() && item.name.endsWith(".md")) files.push(full);
    }
  };
  walk(dir);
  return files;
}
const countSpecs = (dir) => specFiles(dir).length;

// The OpenSpec state of a change. planningComplete is predicate A (Phase 1, evidence/check-3-cli.md): proposal.md,
// at least one specs/**/*.md and tasks.md exist; design.md is optional.
export function readOpenspec(p) {
  const exists = (() => {
    try { return fs.statSync(p.change).isDirectory(); } catch { return false; }
  })();
  const proposal = exists && isFile(p.proposal);
  const design = exists && isFile(p.design);
  const specs = exists ? countSpecs(p.specs) : 0;
  const tasksFile = exists && isFile(p.tasks);
  const tasks = tasksFile ? readTasks(p.tasks) : { total: 0, complete: 0, open: 0 };
  return { exists, proposal, design, specs, tasksFile, planningComplete: proposal && specs > 0 && tasksFile, tasks };
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

// The archive folder `openspec archive` will move the change into, relative to the project root (ADR-013 D5):
// openspec/changes/archive/<local YYYY-MM-DD>-<id>, or the id unchanged when it already starts with a date. The CLI
// takes the local date when it runs, after this is computed, so a run that crosses midnight in between gets another
// folder; verify-archive then lists the folder it finds.
export function openspecArchivePath(id, now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${archiveRoot("openspec")}/${DATED_ID.test(id) ? id : `${day}-${id}`}`;
}

// The halt text for a run whose change folder does not exist. The router never creates the change (D3).
export function missingChangeReason(id) {
  return `No OpenSpec change folder openspec/changes/${id}/. Create it with openspec new change ${id}, then run the pipeline again. Store-hosted changes (--store) are not supported.`;
}

// ---- verify verdict -----------------------------------------------------------

// The critical lines kept from verify.md: at most this many, each cut to this many code points.
const CRITICAL_MAX_LINES = 20;
const CRITICAL_MAX_CHARS = 300;
const VERDICT_RE = /^Verdict: (PASS WITH WARNINGS|PASS|FAIL)\s*$/;
const COUNT_RE = (name) => new RegExp(`^${name}: (\\d+)\\s*$`);

// The verdict of verify.md, as the os-verify guide writes it: line 1 `Verdict: PASS|PASS WITH WARNINGS|FAIL`, line 2
// `Critical: <n>`, line 3 `Warnings: <n>`, then the `- ` lines under `## Critical` up to the next `## ` heading (at most
// 20, each made one line and cut to 300 code points). A Critical count above 0 reads as FAIL whatever line 1 says, and
// so does a `- ` line under `## Critical` with a lower count: the critical count is the larger of the two, so the file
// never reads cleaner than it says (as ADR-011 reads review headers). Returns { ok: true, verdict, critical, warnings,
// criticalLines } or { ok: false, error }. Only a regular file is read.
export function readVerdict(file) {
  let st;
  try { st = fs.lstatSync(file); } catch { return { ok: false, error: "missing or unreadable" }; }
  if (!st.isFile()) return { ok: false, error: "not a regular file" };
  if (st.size > VERIFY_MAX_BYTES) return { ok: false, error: `larger than ${VERIFY_MAX_BYTES} bytes` };
  // verify.md lives in <change>/agent-smith/, so its real path must lie inside the real change folder.
  const text = readGuarded(file, path.dirname(path.dirname(file)), VERIFY_MAX_BYTES);
  if (text === null) return { ok: false, error: "missing, unreadable or outside the change folder" };
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const v = (lines[0] ?? "").match(VERDICT_RE);
  if (!v) return { ok: false, error: 'line 1 is not "Verdict: PASS", "Verdict: PASS WITH WARNINGS" or "Verdict: FAIL"' };
  const c = (lines[1] ?? "").match(COUNT_RE("Critical"));
  if (!c) return { ok: false, error: 'line 2 is not "Critical: <n>"' };
  const w = (lines[2] ?? "").match(COUNT_RE("Warnings"));
  if (!w) return { ok: false, error: 'line 3 is not "Warnings: <n>"' };
  const critical = Number(c[1]);
  const warnings = Number(w[1]);
  if (!Number.isSafeInteger(critical) || !Number.isSafeInteger(warnings)) return { ok: false, error: "a count is too large" };
  const criticalLines = [];
  let inCritical = false;
  for (const line of lines.slice(3)) {
    if (/^## /.test(line)) { inCritical = /^## Critical\s*$/.test(line); continue; }
    if (!inCritical || !line.startsWith("- ")) continue;
    if (criticalLines.length === CRITICAL_MAX_LINES) break;
    const one = line.replace(/\p{Cf}/gu, "").replace(/[\p{Cc}\s]+/gu, " ").trim();
    criticalLines.push(Array.from(one).slice(0, CRITICAL_MAX_CHARS).join(""));
  }
  const count = Math.max(critical, criticalLines.length);
  return { ok: true, verdict: count > 0 ? "FAIL" : v[1], critical: count, warnings, criticalLines };
}

// The artifact files os-propose writes: proposal.md, design.md, tasks.md and every specs/**/*.md.
const artifactFiles = (p) => [p.proposal, p.design, p.tasks, ...specFiles(p.specs)];

// Is the last os- step verified by the files it wrote (attachResult; the status is checked there)? os-propose: planning
// is complete and an artifact file is newer than the step start. os-apply: tasks.md has more ticked rows than at the
// step start; in fix mode (template os-apply-fix) the reported status decides, as for the 10x fix step. os-verify:
// verify.md is a regular file newer than the step start and its verdict parses; the entry then gets `review`.
export function verifyOpenspecStep(last, p) {
  switch (last.step) {
    case "os-propose":
      return readOpenspec(p).planningComplete && artifactFiles(p).some((file) => mtime(file) > last.startedAt);
    case "os-apply": {
      if (last.template === "os-apply-fix") return true;
      const before = Number.isInteger(last.before?.ticks) ? last.before.ticks : 0;
      return readOpenspec(p).tasks.complete > before;
    }
    case "os-verify": {
      const read = readVerdict(p.verify);
      const verified = read.ok && mtime(p.verify) > last.startedAt;
      if (verified) last.review = { verdict: read.verdict, critical: read.critical, warnings: read.warnings };
      return verified;
    }
    default:
      return false;
  }
}

// ---- decision -------------------------------------------------------------------

// The next step of an OpenSpec run, in the shapes decide() returns: { step, template, reason }, { done, reason } or
// { halt }. Order (ADR-013 D4): no change folder halts; incomplete planning runs os-propose; a tasks.md without a
// checkbox row halts; an open row runs os-apply; all rows ticked and no verified os-verify, or a verified step after
// the last one, runs os-verify. Otherwise the last verified os-verify decides by the verdict of verify.md, read from
// the file now (not from the log copy), so a human edit after a halt routes: PASS or PASS WITH WARNINGS is done; FAIL
// runs os-apply in fix mode until limits.maxFixLoops verified fix steps ran, then halts.
export function decideOpenspec(p, log, policy, meta) {
  const id = path.basename(p.change);
  const os = readOpenspec(p);
  if (!os.exists) return { halt: missingChangeReason(id) };
  if (!os.planningComplete) {
    const missing = [
      ...(os.proposal ? [] : ["proposal.md"]),
      ...(os.specs > 0 ? [] : ["specs/**/*.md"]),
      ...(os.tasksFile ? [] : ["tasks.md"]),
    ];
    return { step: "os-propose", template: "os-propose", reason: `OpenSpec planning incomplete (missing ${missing.join(", ")})` };
  }
  if (os.tasks.total === 0) {
    return { halt: `${rel(p.tasks)} has no task row ("- [ ] " or "- [x] "), so nothing can be applied or verified. Needs a human: add the task rows, then run the pipeline again.` };
  }
  if (os.tasks.open > 0) {
    return { step: "os-apply", template: "os-apply", reason: `${os.tasks.open} of ${os.tasks.total} tasks open` };
  }
  const ran = executed(log);
  let lastVerify = -1;
  ran.forEach((e, i) => { if (e.step === "os-verify" && e.ok === true) lastVerify = i; });
  const after = ran.slice(lastVerify + 1).filter((e) => e.ok === true);
  if (lastVerify < 0 || after.length) {
    const since = after.length ? `; verify again after step ${after[after.length - 1].n} (${after[after.length - 1].template ?? after[after.length - 1].step})` : "";
    return { step: "os-verify", template: "os-verify", reason: `all ${os.tasks.total} tasks ticked${since}` };
  }

  const file = rel(p.verify);
  const read = readVerdict(p.verify);
  if (!read.ok) {
    return { halt: `The OpenSpec verify verdict cannot be read from ${file}: ${read.error}. Needs a human: fix the file, then run /agent-smith:openspec-pipeline ${id} again.` };
  }
  if (read.verdict !== "FAIL") return { done: true, reason: `OpenSpec verify ${read.verdict}` };
  const loops = ran.filter((e) => e.step === "os-apply" && e.template === "os-apply-fix" && e.ok === true).length;
  if (loops >= policy.limits.maxFixLoops) {
    let text = `OpenSpec verify FAIL after ${loops} fix loops. Needs a human. Fix the issues, set the first lines of ${file} to "Verdict: PASS" and "Critical: 0", then run /agent-smith:openspec-pipeline ${id} again.`;
    if (meta.isolated === true) text += " Commit the edit in the run worktree first: a failed step rolls back uncommitted edits.";
    return { halt: text };
  }
  return {
    step: "os-apply",
    template: "os-apply-fix",
    findings: read.criticalLines.length ? read.criticalLines.join("\n") : "see verify.md",
    reason: `OpenSpec verify FAIL (${read.critical} critical, ${read.warnings} warnings): fix loop ${loops + 1} of ${policy.limits.maxFixLoops}`,
  };
}
