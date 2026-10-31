// Helpers of the phase-executors tests: plan builders, log fixtures and the gate check of the plan's Progress rows.
// Plain node: built-ins only. helpers.mjs stays untouched.
import fs from "node:fs";
import path from "node:path";
import { entry, git } from "./helpers.mjs";

// A plan with explicit phases: [{ name, files: ["`a.mjs`"], auto: [{ text, done }] | [text], manual: [text] }].
// Row ids are N.M with M counting the Automated rows first, then the Manual rows.
export function buildPlan(phases) {
  const blocks = [];
  const progress = [];
  phases.forEach((ph, i) => {
    const n = i + 1;
    const name = ph.name ?? `Part ${n}`;
    const files = (ph.files ?? []).map((f) => `**File**: ${f}`).join("\n\n");
    blocks.push(`## Phase ${n}: ${name}\n\n${files}\n`);
    progress.push(`### Phase ${n}: ${name}\n\n#### Automated\n`);
    const auto = (ph.auto ?? []).map((r) => (typeof r === "string" ? { text: r, done: false } : r));
    auto.forEach((r, m) => progress.push(`- [${r.done ? "x" : " "}] ${n}.${m + 1} ${r.text}`));
    progress.push("\n#### Manual\n");
    (ph.manual ?? []).forEach((r, m) => {
      const row = typeof r === "string" ? { text: r, done: false } : r;
      progress.push(`- [${row.done ? "x" : " "}] ${n}.${auto.length + m + 1} ${row.text}`);
    });
    progress.push("");
  });
  return `# Plan\n\n${blocks.join("\n")}\n## Progress\n\n${progress.join("\n")}\n`;
}

// An executed entry that waits for its result: no result, ok, verified or finishedAt.
export function pendingEntry(n, step, over = {}) {
  return entry(n, step, { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined, ...over });
}

export function headSha(project) {
  return git(project, ["rev-parse", "HEAD"]);
}

// ---- gate check -------------------------------------------------------------

const PATTERN_ROW_RE = /--test-name-pattern\s+"([^"]*)"\s+(\S+\.test\.mjs)/g;
const PLAIN_PATTERN_RE = /^[^\\^$.*+?()[\]{}|]+$/;
const TITLE_RE = /\b(?:test|it|describe)(?:\.(?:skip|only|todo))?\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

// Titles of the test(), it() and describe() calls of a file that are string literals (a template literal with ${} is not).
function titlesOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const titles = [];
  for (const m of text.matchAll(TITLE_RE)) {
    if (m[1] === "`" && m[2].includes("${")) continue;
    titles.push(m[2]);
  }
  return titles;
}

// Static check of one `### Phase N` block of a plan's ## Progress. Returns the integer exit code the plan's gate rows
// pass to process.exit: 0 when the phase has at least one `--test-name-pattern "<p>" <file>` row and every row names an
// existing file and a plain pattern that appears inside a test title literal of that file; 1 otherwise, with the
// first problem on stderr. Never returns anything else. File paths resolve against `cwd`.
export function gateCheck(planPath, phase, cwd = process.cwd()) {
  const fail = (message) => {
    process.stderr.write(`gateCheck phase ${phase}: ${message}\n`);
    return 1;
  };
  try {
    let text;
    try { text = fs.readFileSync(planPath, "utf8"); } catch { return fail(`cannot read ${planPath}`); }
    const lines = text.split("\n");
    const start = lines.findIndex((l) => /^## Progress\s*$/.test(l));
    if (start < 0) return fail("the plan has no ## Progress section");
    const rows = [];
    let inPhase = false;
    for (const line of lines.slice(start + 1)) {
      if (/^## /.test(line)) break;
      const h = line.match(/^### Phase (\d+)/);
      if (h) { inPhase = Number(h[1]) === phase; continue; }
      if (inPhase && /^- \[[ xX]\] /.test(line)) rows.push(line);
    }
    let found = 0;
    const cache = new Map();
    for (const row of rows) {
      for (const m of row.matchAll(PATTERN_ROW_RE)) {
        found++;
        const [, pattern, rel] = m;
        if (!PLAIN_PATTERN_RE.test(pattern)) return fail(`pattern "${pattern}" is empty or holds a regex metacharacter`);
        const file = path.resolve(cwd, rel);
        if (!fs.existsSync(file)) return fail(`${rel} does not exist (pattern "${pattern}")`);
        if (!cache.has(file)) cache.set(file, titlesOf(file));
        if (!cache.get(file).some((title) => title.includes(pattern))) return fail(`no test title in ${rel} contains "${pattern}"`);
      }
    }
    if (!found) return fail("the phase has no --test-name-pattern row");
    return 0;
  } catch (e) {
    return fail(String(e && e.message ? e.message : e));
  }
}
