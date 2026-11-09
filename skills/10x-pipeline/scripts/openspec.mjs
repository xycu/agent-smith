// The OpenSpec chain (ADR-013): reads the state of openspec/changes/<id>/ from files and picks the next step.
// It never calls the openspec CLI (D2). Import order: state, preplan, steps, openspec, then flow, isolation and route.
import fs from "node:fs";
import path from "node:path";
import { ROOT, executed } from "./state.mjs";

// A task row of tasks.md, as OpenSpec's apply step counts it. A row is complete only for x or X.
// The pattern is kept as narrow as OpenSpec's own; a row it misses is a known limit, not widened here.
export const TASK_ROW = /^\s*-\s+\[([ xX])\]\s+/;

const isFile = (file) => {
  try { return fs.statSync(file).isFile(); } catch { return false; }
};

// Task counts of tasks.md. A missing file counts no rows.
export function readTasks(file) {
  const res = { total: 0, complete: 0, open: 0 };
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return res; }
  for (const line of text.split("\n")) {
    const m = line.match(TASK_ROW);
    if (!m) continue;
    res.total++;
    if (m[1] === " ") res.open++;
    else res.complete++;
  }
  return res;
}

// Number of *.md files anywhere under the specs folder. A missing folder counts 0.
function countSpecs(dir) {
  let count = 0;
  const walk = (d) => {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile() && item.name.endsWith(".md")) count++;
    }
  };
  walk(dir);
  return count;
}

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

// The halt text for a run whose change folder does not exist. The router never creates the change (D3).
export function missingChangeReason(id) {
  return `No OpenSpec change folder openspec/changes/${id}/. Create it with openspec new change ${id}, then run the pipeline again. Store-hosted changes (--store) are not supported.`;
}

// The next step of an OpenSpec run, in the shapes decide() returns: { step, template, reason }, { done, reason } or
// { halt }. Order (ADR-013 D4): no change folder halts; incomplete planning runs os-propose; a tasks.md without a
// checkbox row halts; an open row runs os-apply; all rows ticked and no verified os-verify after the last verified
// os-apply runs os-verify.
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
  let lastApply = -1;
  ran.forEach((e, i) => { if (e.step === "os-apply" && e.ok === true) lastApply = i; });
  const verifiedAfter = ran.some((e, i) => i > lastApply && e.step === "os-verify" && e.ok === true);
  if (!verifiedAfter) {
    return { step: "os-verify", template: "os-verify", reason: `all ${os.tasks.total} tasks ticked` };
  }
  // The verdict branches of verify.md (done, the fix loop) are not routed yet; stop for a human instead of guessing.
  return { halt: `OpenSpec verify ran and this router does not route its verdict yet. Needs a human: read ${rel(p.verify)}.` };
}
